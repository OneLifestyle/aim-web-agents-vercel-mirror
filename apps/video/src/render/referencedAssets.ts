import type { VideoProject } from '../project/schemas';

/** Visuals that can contribute pixels to the selected output variant. */
export const getReferencedVisualAssetIds = (
  project: VideoProject,
): ReadonlySet<string> => {
  const ids = new Set<string>();
  for (const shot of project.shots) {
    ids.add(shot.startAssetId);
    if (shot.sourceMode === 'pair') ids.add(shot.endAssetId);
  }

  if (project.outputVariant === 'branded') {
    for (const overlay of project.overlays) {
      if (overlay.kind === 'watermark' && overlay.assetId) ids.add(overlay.assetId);
    }
    if (project.endCard.enabled && project.endCard.logoAssetId) {
      ids.add(project.endCard.logoAssetId);
    }
  }
  return ids;
};

/** All local blobs required for one complete preview/export. */
export const getReferencedAssetIds = (
  project: VideoProject,
): ReadonlySet<string> => {
  const ids = new Set(getReferencedVisualAssetIds(project));
  for (const track of project.audioTracks) {
    if (track.enabled) ids.add(track.assetId);
  }
  return ids;
};
