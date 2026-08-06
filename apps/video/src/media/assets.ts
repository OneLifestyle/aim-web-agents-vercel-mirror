import type { MediaAsset, MediaAssetKind, MediaRights } from '../project/schemas';
import type { AcceptedAudioFile, AcceptedImageFile } from './intake';

export const createStableId = (prefix: string) => `${prefix}-${crypto.randomUUID()}`;

export interface OperatorRightsInput {
  source: string;
  owner: string;
  licenceOrPermission: string;
}

export const operatorRightsAreComplete = (input: OperatorRightsInput) =>
  input.source.trim().length > 0
  && input.owner.trim().length > 0
  && input.licenceOrPermission.trim().length > 0;

export const createOperatorConfirmedRights = (
  permittedUse: string,
  input: OperatorRightsInput,
  confirmedAt = new Date().toISOString(),
): MediaRights => {
  if (!operatorRightsAreComplete(input)) {
    throw new Error('Record the media source, rights owner and permission basis before import.');
  }
  return {
    source: input.source.trim(),
    owner: input.owner.trim(),
    licenceOrPermission: input.licenceOrPermission.trim(),
    permittedUse: permittedUse.trim(),
    confirmedAt,
  };
};

export const SELF_CREATED_FIXTURE_RIGHTS: MediaRights = {
  source: 'Generated locally by the AIM Video synthetic fixture generator',
  owner: 'Singularealty / Real Estate AIM test fixture',
  licenceOrPermission: 'Self-created synthetic test media; no external media source',
  permittedUse: 'Internal deterministic renderer verification',
};

export const mediaRightsAreRecorded = (asset: MediaAsset) => (
  asset.rights.source.trim().length > 0
  && asset.rights.owner.trim().length > 0
  && asset.rights.licenceOrPermission.trim().length > 0
  && asset.rights.permittedUse.trim().length > 0
  && !asset.rights.licenceOrPermission.toLowerCase().includes('not recorded')
  && asset.rights.source !== 'Local operator upload'
  && asset.rights.owner !== 'Recorded by operator as an authorised source'
);

export const createImageMediaAsset = (
  accepted: AcceptedImageFile,
  kind: Extract<MediaAssetKind, 'image' | 'logo' | 'watermark'>,
  rights: MediaRights,
  id = createStableId('asset'),
): MediaAsset => ({
  id,
  kind,
  fileName: accepted.file.name,
  mimeType: accepted.detectedMimeType,
  fileSizeBytes: accepted.file.size,
  lastModifiedMs: accepted.file.lastModified,
  contentHash: accepted.contentHash,
  decodedWidth: accepted.width,
  decodedHeight: accepted.height,
  localBlobKey: id,
  rights,
  createdAt: new Date().toISOString(),
});

export const createAudioMediaAsset = (
  accepted: AcceptedAudioFile,
  rights: MediaRights,
  id = createStableId('asset'),
): MediaAsset => ({
  id,
  kind: 'audio',
  fileName: accepted.file.name,
  mimeType: accepted.detectedMimeType,
  fileSizeBytes: accepted.file.size,
  lastModifiedMs: accepted.file.lastModified,
  contentHash: accepted.contentHash,
  decodedDurationSec: accepted.durationSec,
  localBlobKey: id,
  rights,
  createdAt: new Date().toISOString(),
});
