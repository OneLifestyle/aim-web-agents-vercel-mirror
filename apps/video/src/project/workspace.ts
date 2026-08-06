import { createCoverCrop, createMotionPresetCrops } from '../motion';
import { withShotHashes } from './hash';
import {
  type MediaAsset,
  type MotionPreset,
  type VideoProject,
  type VideoShot,
} from './schemas';
import { getProjectDurationSec, getShotsDurationSec } from './timeline';
import { normalizeProjectTiming } from './normalize';

const imageDimensions = (asset: MediaAsset) => {
  if (!asset.decodedWidth || !asset.decodedHeight) {
    throw new Error(`${asset.fileName} is missing decoded image dimensions.`);
  }
  return { width: asset.decodedWidth, height: asset.decodedHeight };
};

const findImage = (project: VideoProject, assetId: string) => {
  const asset = project.mediaAssets.find((candidate) => candidate.id === assetId);
  if (!asset || asset.kind !== 'image') {
    throw new Error('The selected photograph is no longer available in this local project.');
  }
  return asset;
};

const finalize = (project: VideoProject): VideoProject => normalizeProjectTiming(project);

export const finalizeWorkspaceProject = finalize;

export const updateProjectDetails = (
  project: VideoProject,
  patch: Partial<Pick<VideoProject, 'name' | 'propertyAddress' | 'videoTitle' | 'subtitle' | 'outputVariant'>>,
) => finalize({ ...project, ...patch });

export const syncPresentationOverlays = (project: VideoProject): VideoProject => {
  const totalDurationSec = getProjectDurationSec(project);
  if (totalDurationSec <= 0) return finalize({ ...project, overlays: [] });
  const titleDuration = Math.min(4, totalDurationSec);
  const existingWatermark = project.overlays.find((overlay) => overlay.kind === 'watermark');
  const overlays: VideoProject['overlays'] = [];
  if (project.videoTitle?.trim()) {
    overlays.push({
      id: 'overlay-title',
      kind: 'title',
      text: project.videoTitle.trim(),
      timing: { startTimeSec: 0, durationSec: titleDuration },
    });
  }
  if (project.subtitle?.trim() || project.propertyAddress?.trim()) {
    overlays.push({
      id: 'overlay-subtitle',
      kind: 'subtitle',
      text: (project.subtitle || project.propertyAddress)!.trim(),
      timing: { startTimeSec: 0, durationSec: titleDuration },
    });
  }
  if (existingWatermark?.assetId) {
    const shotsDurationSec = getShotsDurationSec(project);
    if (shotsDurationSec > 0) {
      overlays.push({
        ...existingWatermark,
        timing: { startTimeSec: 0, durationSec: shotsDurationSec },
      });
    }
  }
  return finalize({ ...project, overlays });
};

export const replaceShot = (
  project: VideoProject,
  shot: VideoShot,
): VideoProject => finalize({
  ...project,
  shots: project.shots.map((candidate) => candidate.id === shot.id
    ? withShotHashes(shot, project.mediaAssets)
    : candidate),
});

export const setWorkspaceShotMotion = (
  project: VideoProject,
  shotId: string,
  motionPreset: MotionPreset,
): VideoProject => {
  const shot = project.shots.find((candidate) => candidate.id === shotId);
  if (!shot || shot.sourceMode !== 'single') throw new Error('Single Image shot not found.');
  const source = findImage(project, shot.startAssetId);
  const crops = createMotionPresetCrops(motionPreset, imageDimensions(source), project.canvas);
  return replaceShot(project, {
    ...shot,
    motionPreset,
    startCrop: crops.start,
    endCrop: crops.end,
    status: 'ready',
  });
};

export const setWorkspaceShotSourceMode = (
  project: VideoProject,
  shotId: string,
  sourceMode: 'single' | 'pair',
  endAssetId?: string,
): VideoProject => {
  const shot = project.shots.find((candidate) => candidate.id === shotId);
  if (!shot) throw new Error('Storyboard shot not found.');
  const startAsset = findImage(project, shot.startAssetId);
  if (sourceMode === 'single') {
    const crops = createMotionPresetCrops('still', imageDimensions(startAsset), project.canvas);
    return replaceShot(project, {
      id: shot.id,
      sourceMode: 'single',
      startAssetId: startAsset.id,
      durationSec: shot.durationSec,
      motionPreset: 'still',
      startCrop: crops.start,
      endCrop: crops.end,
      easing: 'ease-in-out',
      contentHash: shot.contentHash,
      settingsHash: shot.settingsHash,
      status: 'ready',
    });
  }
  if (!endAssetId || endAssetId === startAsset.id) {
    throw new Error('Choose a different photograph for the end of the Image Pair.');
  }
  const endAsset = findImage(project, endAssetId);
  return replaceShot(project, {
    id: shot.id,
    sourceMode: 'pair',
    startAssetId: startAsset.id,
    endAssetId: endAsset.id,
    durationSec: shot.durationSec,
    motionPreset: 'still',
    pairTreatment: 'dissolve',
    generationStatus: 'not-requested',
    startCrop: createCoverCrop(imageDimensions(startAsset), project.canvas),
    endCrop: createCoverCrop(imageDimensions(endAsset), project.canvas),
    easing: 'linear',
    contentHash: shot.contentHash,
    settingsHash: shot.settingsHash,
    status: 'ready',
  });
};

export const setWorkspaceShotAsset = (
  project: VideoProject,
  shotId: string,
  slot: 'start' | 'end',
  assetId: string,
): VideoProject => {
  const shot = project.shots.find((candidate) => candidate.id === shotId);
  if (!shot) throw new Error('Storyboard shot not found.');
  const asset = findImage(project, assetId);
  if (slot === 'end') {
    if (shot.sourceMode !== 'pair') throw new Error('Only an Image Pair has an end photograph.');
    if (asset.id === shot.startAssetId) throw new Error('The two Image Pair photographs must be different.');
    return replaceShot(project, {
      ...shot,
      endAssetId: asset.id,
      endCrop: createCoverCrop(imageDimensions(asset), project.canvas),
      status: 'ready',
    });
  }
  if (shot.sourceMode === 'pair') {
    if (asset.id === shot.endAssetId) throw new Error('The two Image Pair photographs must be different.');
    return replaceShot(project, {
      ...shot,
      startAssetId: asset.id,
      startCrop: createCoverCrop(imageDimensions(asset), project.canvas),
      status: 'ready',
    });
  }
  const crops = createMotionPresetCrops(shot.motionPreset, imageDimensions(asset), project.canvas);
  return replaceShot(project, {
    ...shot,
    startAssetId: asset.id,
    startCrop: crops.start,
    endCrop: crops.end,
    status: 'ready',
  });
};

export const retimeWorkspaceShot = (
  project: VideoProject,
  shotId: string,
  durationSec: number,
): VideoProject => {
  const shot = project.shots.find((candidate) => candidate.id === shotId);
  if (!shot) throw new Error('Storyboard shot not found.');
  return replaceShot(project, { ...shot, durationSec, status: 'ready' });
};

export const reorderWorkspaceShots = (
  project: VideoProject,
  orderedShotIds: readonly string[],
): VideoProject => {
  if (orderedShotIds.length !== project.orderedShotIds.length
    || new Set(orderedShotIds).size !== orderedShotIds.length
    || orderedShotIds.some((id) => !project.orderedShotIds.includes(id))) {
    throw new Error('Storyboard order must contain every shot exactly once.');
  }
  return finalize({ ...project, orderedShotIds: [...orderedShotIds] });
};

export const removeWorkspaceShot = (project: VideoProject, shotId: string): VideoProject =>
  finalize({
    ...project,
    shots: project.shots.filter((shot) => shot.id !== shotId),
    orderedShotIds: project.orderedShotIds.filter((id) => id !== shotId),
  });

export const addWorkspaceMedia = (
  project: VideoProject,
  assets: readonly MediaAsset[],
  shots: readonly VideoShot[] = [],
): VideoProject => finalize({
  ...project,
  mediaAssets: [...project.mediaAssets, ...assets],
  shots: [...project.shots, ...shots.map((shot) => withShotHashes(shot, [...project.mediaAssets, ...assets]))],
  orderedShotIds: [...project.orderedShotIds, ...shots.map((shot) => shot.id)],
});

export const clearUnusedMedia = (project: VideoProject): { project: VideoProject; removedAssetIds: string[] } => {
  const referenced = new Set<string>();
  for (const shot of project.shots) {
    referenced.add(shot.startAssetId);
    if (shot.sourceMode === 'pair') referenced.add(shot.endAssetId);
  }
  for (const track of project.audioTracks) referenced.add(track.assetId);
  for (const overlay of project.overlays) if (overlay.assetId) referenced.add(overlay.assetId);
  if (project.endCard.logoAssetId) referenced.add(project.endCard.logoAssetId);
  const removedAssetIds = project.mediaAssets
    .filter((asset) => !referenced.has(asset.id))
    .map((asset) => asset.id);
  return {
    project: finalize({
      ...project,
      mediaAssets: project.mediaAssets.filter((asset) => referenced.has(asset.id)),
    }),
    removedAssetIds,
  };
};
