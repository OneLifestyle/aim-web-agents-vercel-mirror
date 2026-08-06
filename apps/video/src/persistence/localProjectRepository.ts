import { VideoProjectSchema, type VideoProject } from '../project/schemas';
import { sha256Blob } from '../media/intake';

const DATABASE_NAME = 'aim-video-local-projects';
const DATABASE_VERSION = 1;
const PROJECT_STORE = 'projects';
const ASSET_STORE = 'assets';

interface StoredProjectRecord {
  id: string;
  name: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  project: unknown;
}

interface StoredAssetRecord {
  key: string;
  projectId: string;
  assetId: string;
  localBlobKey?: string;
  contentHash: string;
  blob: Blob;
}

export interface LocalProjectSummary {
  id: string;
  storageKey: IDBValidKey;
  name: string;
  address?: string;
  createdAt: string;
  updatedAt: string;
  photoCount: number;
  status: 'ready' | 'corrupt' | 'unsupported';
  problem?: string;
}

export interface LoadedLocalProject {
  project: VideoProject;
  blobs: Map<string, Blob>;
  missingAssetIds: string[];
  corruptAssetIds: string[];
}

export class LocalProjectError extends Error {
  readonly code: 'NOT_FOUND' | 'CORRUPT_PROJECT' | 'UNSUPPORTED_VERSION' | 'STORAGE_UNAVAILABLE' | 'MISSING_ASSET';

  constructor(
    code: 'NOT_FOUND' | 'CORRUPT_PROJECT' | 'UNSUPPORTED_VERSION' | 'STORAGE_UNAVAILABLE' | 'MISSING_ASSET',
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = 'LocalProjectError';
  }
}

const requestResult = <T>(request: IDBRequest<T>) => new Promise<T>((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
});

const transactionDone = (transaction: IDBTransaction) => new Promise<void>((resolve, reject) => {
  transaction.oncomplete = () => resolve();
  transaction.onabort = () => reject(transaction.error ?? new Error('IndexedDB transaction was aborted.'));
  transaction.onerror = () => reject(transaction.error ?? new Error('IndexedDB transaction failed.'));
});

const openDatabase = (onVersionChange: () => void) => new Promise<IDBDatabase>((resolve, reject) => {
  if (typeof indexedDB === 'undefined') {
    reject(new LocalProjectError('STORAGE_UNAVAILABLE', 'Local project storage is unavailable in this browser.'));
    return;
  }
  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  let settled = false;
  request.onupgradeneeded = () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(PROJECT_STORE)) {
      database.createObjectStore(PROJECT_STORE, { keyPath: 'id' });
    }
    if (!database.objectStoreNames.contains(ASSET_STORE)) {
      const assets = database.createObjectStore(ASSET_STORE, { keyPath: 'key' });
      assets.createIndex('projectId', 'projectId', { unique: false });
    }
  };
  request.onsuccess = () => {
    const database = request.result;
    if (settled) {
      database.close();
      return;
    }
    settled = true;
    database.onversionchange = () => {
      database.close();
      onVersionChange();
    };
    resolve(database);
  };
  request.onerror = () => {
    if (settled) return;
    settled = true;
    reject(request.error ?? new Error('Could not open local project storage.'));
  };
  request.onblocked = () => {
    if (settled) return;
    settled = true;
    reject(new LocalProjectError(
      'STORAGE_UNAVAILABLE',
      'Local project storage is busy in another tab. Close the other tab, then try again.',
    ));
  };
});

export const createLocalAssetStorageKey = (projectId: string, localBlobKey: string) =>
  JSON.stringify([projectId, localBlobKey]);

export const normalizeBlobMime = (blob: Blob, mimeType: string): Blob =>
  blob.type.trim().toLowerCase() === mimeType.trim().toLowerCase()
    ? blob
    : new Blob([blob], { type: mimeType });

const storedRecordLocalKey = (record: StoredAssetRecord) =>
  record.localBlobKey ?? record.assetId;

const blobMatchesAsset = async (
  blob: unknown,
  asset: VideoProject['mediaAssets'][number],
): Promise<boolean> => {
  if (
    !(blob instanceof Blob)
    || blob.size !== asset.fileSizeBytes
    || blob.type.trim().toLowerCase() !== asset.mimeType.trim().toLowerCase()
  ) return false;
  return (await sha256Blob(blob)) === asset.contentHash;
};

const storedAssetMatches = async (
  record: StoredAssetRecord,
  projectId: string,
  asset: VideoProject['mediaAssets'][number],
) => record.projectId === projectId
  && record.key === createLocalAssetStorageKey(projectId, asset.localBlobKey)
  && record.assetId === asset.id
  && storedRecordLocalKey(record) === asset.localBlobKey
  && record.contentHash === asset.contentHash
  && await blobMatchesAsset(record.blob, asset);

const FALLBACK_TIMESTAMP = '1970-01-01T00:00:00.000Z';

const safeText = (value: unknown, fallback: string) =>
  typeof value === 'string' && value.trim() ? value.trim() : fallback;

const safeTimestamp = (value: unknown) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value)) ? value : FALLBACK_TIMESTAMP;

const classifyInvalidProject = (project: unknown) => {
  const version = typeof project === 'object' && project !== null && 'version' in project
    ? String(project.version)
    : null;
  if (version && version !== '1.0.0') {
    return {
      status: 'unsupported' as const,
      problem: `Project version ${version} is not supported by this client alpha.`,
    };
  }
  return {
    status: 'corrupt' as const,
    problem: 'The local project manifest is corrupt and was not opened.',
  };
};

const invalidSummary = (
  record: Partial<StoredProjectRecord>,
  storageKey: IDBValidKey,
  classification: ReturnType<typeof classifyInvalidProject>,
): LocalProjectSummary => ({
  id: typeof storageKey === 'string' ? storageKey : `corrupt-${String(storageKey)}`,
  storageKey,
  name: safeText(record.name, 'Corrupt local project'),
  address: typeof record.address === 'string' && record.address.trim() ? record.address.trim() : undefined,
  createdAt: safeTimestamp(record.createdAt),
  updatedAt: safeTimestamp(record.updatedAt),
  photoCount: typeof record.photoCount === 'number' && Number.isInteger(record.photoCount) && record.photoCount >= 0
    ? record.photoCount
    : 0,
  ...classification,
});

export class LocalProjectRepository {
  private databasePromise: Promise<IDBDatabase> | null = null;

  private database() {
    if (!this.databasePromise) {
      const pending = openDatabase(() => {
        this.databasePromise = null;
      });
      this.databasePromise = pending;
      void pending.catch(() => {
        if (this.databasePromise === pending) this.databasePromise = null;
      });
    }
    return this.databasePromise;
  }

  async list(): Promise<LocalProjectSummary[]> {
    const database = await this.database();
    const transaction = database.transaction(PROJECT_STORE, 'readonly');
    const done = transactionDone(transaction);
    const store = transaction.objectStore(PROJECT_STORE);
    const [records, storageKeys] = await Promise.all([
      requestResult(store.getAll()) as Promise<unknown[]>,
      requestResult(store.getAllKeys()),
    ]);
    await done;
    return records
      .map((unknownRecord, index) => {
        const record = typeof unknownRecord === 'object' && unknownRecord !== null
          ? unknownRecord as Partial<StoredProjectRecord>
          : {};
        const storageKey = storageKeys[index] ?? `corrupt-record-${index + 1}`;
        const parsed = VideoProjectSchema.safeParse(record.project);
        if (!parsed.success) {
          return invalidSummary(record, storageKey, classifyInvalidProject(record.project));
        }
        if (typeof storageKey !== 'string' || storageKey !== parsed.data.id || record.id !== parsed.data.id) {
          return invalidSummary(record, storageKey, {
            status: 'corrupt',
            problem: 'The stored project identity does not match its validated manifest.',
          });
        }
        return {
          id: parsed.data.id,
          storageKey,
          name: parsed.data.name,
          address: parsed.data.propertyAddress,
          createdAt: parsed.data.createdAt,
          updatedAt: parsed.data.updatedAt,
          photoCount: parsed.data.mediaAssets.filter((asset) => asset.kind === 'image').length,
          status: 'ready' as const,
        };
      })
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  async save(projectInput: VideoProject, blobs: ReadonlyMap<string, Blob>) {
    const project = VideoProjectSchema.parse(projectInput);
    const database = await this.database();
    const readTransaction = database.transaction(ASSET_STORE, 'readonly');
    const readDone = transactionDone(readTransaction);
    const existing = await requestResult(
      readTransaction.objectStore(ASSET_STORE).index('projectId').getAll(IDBKeyRange.only(project.id)),
    ) as StoredAssetRecord[];
    await readDone;

    const existingByLocalKey = new Map<string, StoredAssetRecord[]>();
    for (const record of existing) {
      const localKey = storedRecordLocalKey(record);
      existingByLocalKey.set(localKey, [...(existingByLocalKey.get(localKey) ?? []), record]);
    }
    const recordsToStore: StoredAssetRecord[] = [];
    for (const asset of project.mediaAssets) {
      const existingRecords = existingByLocalKey.get(asset.localBlobKey) ?? [];
      const existingRecord = existingRecords.length === 1 ? existingRecords[0] : undefined;
      const suppliedRuntimeBlob = blobs.get(asset.id);
      const runtimeBlob = suppliedRuntimeBlob
        ? normalizeBlobMime(suppliedRuntimeBlob, asset.mimeType)
        : undefined;
      const blob = runtimeBlob ?? existingRecord?.blob;
      if (!blob) {
        throw new LocalProjectError(
          'MISSING_ASSET',
          `${asset.fileName} is missing from local media. Replace or remove it before saving.`,
        );
      }
      if (
        runtimeBlob
          ? !(await blobMatchesAsset(runtimeBlob, asset))
          : !existingRecord || !(await storedAssetMatches(existingRecord, project.id, asset))
      ) {
        throw new LocalProjectError(
          'CORRUPT_PROJECT',
          `${asset.fileName} no longer matches its validated local bytes. Replace it before saving.`,
        );
      }
      recordsToStore.push({
        key: createLocalAssetStorageKey(project.id, asset.localBlobKey),
        projectId: project.id,
        assetId: asset.id,
        localBlobKey: asset.localBlobKey,
        contentHash: asset.contentHash,
        blob,
      });
    }

    const transaction = database.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite');
    const done = transactionDone(transaction);
    const projects = transaction.objectStore(PROJECT_STORE);
    const assets = transaction.objectStore(ASSET_STORE);
    const liveRecordKeys = new Set(recordsToStore.map((record) => record.key));

    projects.put({
      id: project.id,
      name: project.name,
      address: project.propertyAddress,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      photoCount: project.mediaAssets.filter((asset) => asset.kind === 'image').length,
      project,
    } satisfies StoredProjectRecord);

    for (const record of existing) {
      if (!liveRecordKeys.has(record.key)) {
        assets.delete(record.key);
      }
    }
    for (const record of recordsToStore) assets.put(record);

    await done;
  }

  async load(projectId: string): Promise<LoadedLocalProject> {
    const database = await this.database();
    const transaction = database.transaction([PROJECT_STORE, ASSET_STORE], 'readonly');
    const done = transactionDone(transaction);
    const record = await requestResult(transaction.objectStore(PROJECT_STORE).get(projectId)) as
      | Partial<StoredProjectRecord>
      | undefined;
    const assetRecords = await requestResult(
      transaction.objectStore(ASSET_STORE).index('projectId').getAll(IDBKeyRange.only(projectId)),
    ) as StoredAssetRecord[];
    await done;
    if (!record) throw new LocalProjectError('NOT_FOUND', 'This local project no longer exists.');

    const parsed = VideoProjectSchema.safeParse(record.project);
    if (!parsed.success) {
      const classification = classifyInvalidProject(record.project);
      throw new LocalProjectError(
        classification.status === 'unsupported' ? 'UNSUPPORTED_VERSION' : 'CORRUPT_PROJECT',
        classification.problem,
      );
    }
    if (record.id !== projectId || parsed.data.id !== projectId) {
      throw new LocalProjectError(
        'CORRUPT_PROJECT',
        'The stored project identity does not match its validated manifest.',
      );
    }

    const recordsByLocalKey = new Map<string, StoredAssetRecord[]>();
    for (const assetRecord of assetRecords) {
      const localKey = storedRecordLocalKey(assetRecord);
      recordsByLocalKey.set(localKey, [...(recordsByLocalKey.get(localKey) ?? []), assetRecord]);
    }
    const blobs = new Map<string, Blob>();
    const missingAssetIds: string[] = [];
    const corruptAssetIds: string[] = [];
    for (const asset of parsed.data.mediaAssets) {
      const storedRecords = recordsByLocalKey.get(asset.localBlobKey) ?? [];
      const stored = storedRecords.length === 1 ? storedRecords[0] : undefined;
      if (storedRecords.length === 0) {
        missingAssetIds.push(asset.id);
      } else if (!stored || !(await storedAssetMatches(stored, projectId, asset))) {
        corruptAssetIds.push(asset.id);
      } else {
        blobs.set(asset.id, stored.blob);
      }
    }
    return { project: parsed.data, blobs, missingAssetIds, corruptAssetIds };
  }

  async delete(projectId: IDBValidKey) {
    const database = await this.database();
    const transaction = database.transaction([PROJECT_STORE, ASSET_STORE], 'readwrite');
    const done = transactionDone(transaction);
    transaction.objectStore(PROJECT_STORE).delete(projectId);
    const assets = transaction.objectStore(ASSET_STORE);
    const records = typeof projectId === 'string'
      ? await requestResult(assets.index('projectId').getAll(IDBKeyRange.only(projectId))) as StoredAssetRecord[]
      : [];
    for (const record of records) assets.delete(record.key);
    await done;
  }

  close() {
    if (!this.databasePromise) return;
    void this.databasePromise.then((database) => database.close(), () => undefined);
    this.databasePromise = null;
  }
}

export const deleteAllLocalVideoDataForTests = () => new Promise<void>((resolve, reject) => {
  const request = indexedDB.deleteDatabase(DATABASE_NAME);
  request.onsuccess = () => resolve();
  request.onerror = () => reject(request.error ?? new Error('Could not clear test storage.'));
  request.onblocked = () => reject(new Error('Local project database is still open.'));
});
