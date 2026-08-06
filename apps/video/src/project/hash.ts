import type {
  Easing,
  MediaAsset,
  MotionPreset,
  NormalizedCropRect,
  PairTreatment,
  ShotSourceMode,
  VideoShot,
} from './schemas';

const FNV_64_OFFSET_BASIS = 0xcbf29ce484222325n;
const FNV_64_PRIME = 0x100000001b3n;
const FNV_64_MASK = 0xffffffffffffffffn;

export const STABLE_HASH_PREFIX = 'fnv1a64:';

const serializeNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    throw new TypeError('Stable serialization only accepts finite numbers.');
  }

  if (Object.is(value, -0)) {
    return '0';
  }

  return JSON.stringify(value);
};

/**
 * Canonical JSON serialization for cache/invalidation inputs. Object keys are
 * sorted and undefined object properties are omitted, matching JSON semantics.
 */
export const stableSerialize = (value: unknown): string => {
  const ancestors = new Set<object>();

  const visit = (current: unknown, arrayMember = false): string => {
    if (current === null) {
      return 'null';
    }

    if (typeof current === 'string' || typeof current === 'boolean') {
      return JSON.stringify(current);
    }

    if (typeof current === 'number') {
      return serializeNumber(current);
    }

    if (typeof current === 'undefined') {
      if (arrayMember) {
        return 'null';
      }

      throw new TypeError('Stable serialization cannot encode top-level undefined.');
    }

    if (typeof current !== 'object') {
      throw new TypeError(`Stable serialization cannot encode ${typeof current}.`);
    }

    if (ancestors.has(current)) {
      throw new TypeError('Stable serialization cannot encode circular values.');
    }

    ancestors.add(current);

    try {
      if (Array.isArray(current)) {
        return `[${current.map((entry) => visit(entry, true)).join(',')}]`;
      }

      const prototype = Object.getPrototypeOf(current);
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError('Stable serialization only accepts plain objects and arrays.');
      }

      const record = current as Record<string, unknown>;
      const entries = Object.keys(record)
        .filter((key) => record[key] !== undefined)
        .sort()
        .map((key) => `${JSON.stringify(key)}:${visit(record[key])}`);

      return `{${entries.join(',')}}`;
    } finally {
      ancestors.delete(current);
    }
  };

  return visit(value);
};

/**
 * Fast synchronous deterministic hash for non-secret cache keys. This is not a
 * cryptographic digest and must never replace SHA-256 for source-file identity.
 */
export const stableHash = (value: unknown): string => {
  let hash = FNV_64_OFFSET_BASIS;
  const bytes = new TextEncoder().encode(stableSerialize(value));

  for (const byte of bytes) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_64_PRIME) & FNV_64_MASK;
  }

  return `${STABLE_HASH_PREFIX}${hash.toString(16).padStart(16, '0')}`;
};

const getAssetContentHash = (
  assets: readonly MediaAsset[],
  assetId: string,
): string => {
  const asset = assets.find((candidate) => candidate.id === assetId);

  if (!asset) {
    throw new Error(`Cannot hash shot: media asset "${assetId}" does not exist.`);
  }

  return asset.contentHash;
};

export interface ShotContentHashInput {
  sourceMode: ShotSourceMode;
  startAssetId: string;
  endAssetId?: string;
  generatedClipRef?: string;
}

export const createShotContentHash = (
  shot: ShotContentHashInput,
  assets: readonly MediaAsset[],
): string => {
  if (shot.sourceMode === 'pair' && shot.endAssetId === undefined) {
    throw new Error('Cannot hash Image Pair shot without an end asset.');
  }

  return stableHash({
    sourceMode: shot.sourceMode,
    startAssetContentHash: getAssetContentHash(assets, shot.startAssetId),
    endAssetContentHash:
      shot.sourceMode === 'pair'
        ? getAssetContentHash(assets, shot.endAssetId!)
        : null,
    generatedClipRef:
      shot.sourceMode === 'pair' ? (shot.generatedClipRef ?? null) : null,
  });
};

export interface ShotSettingsHashInput {
  sourceMode: ShotSourceMode;
  motionPreset: MotionPreset;
  pairTreatment?: PairTreatment;
  durationSec: number;
  startCrop: NormalizedCropRect;
  endCrop: NormalizedCropRect;
  easing: Easing;
}

export const createShotSettingsHash = (
  shot: ShotSettingsHashInput,
): string =>
  stableHash({
    sourceMode: shot.sourceMode,
    treatment:
      shot.sourceMode === 'single' ? shot.motionPreset : shot.pairTreatment,
    durationSec: shot.durationSec,
    startCrop: shot.startCrop,
    endCrop: shot.endCrop,
    easing: shot.easing,
  });

export const withShotHashes = (
  shot: VideoShot,
  assets: readonly MediaAsset[],
): VideoShot => ({
  ...shot,
  contentHash: createShotContentHash(shot, assets),
  settingsHash: createShotSettingsHash(shot),
});
