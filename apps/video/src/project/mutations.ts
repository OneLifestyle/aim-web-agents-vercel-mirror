import { withShotHashes } from './hash';
import { createCoverCrop, createMotionPresetCrops } from '../motion';
import { normalizeProjectTiming } from './normalize';
import {
  MAX_SHOT_DURATION_SEC,
  MIN_SHOT_DURATION_SEC,
  MediaAssetSchema,
  type MediaAsset,
  type MotionPreset,
  type PairTreatment,
  type VideoProject,
  type VideoShot,
} from './schemas';

export interface ProjectMutationOptions {
  /** Explicit timestamp keeps mutations deterministic in tests and persistence. */
  updatedAt?: string;
}

const finalizeProjectMutation = (
  next: VideoProject,
  options: ProjectMutationOptions,
): VideoProject => normalizeProjectTiming(next, {
  updatedAt: options.updatedAt,
  renderStatus: 'idle',
});

const assertShotExists = (project: VideoProject, shotId: string): VideoShot => {
  const shot = project.shots.find((candidate) => candidate.id === shotId);

  if (!shot) {
    throw new Error(`Shot "${shotId}" does not exist.`);
  }

  return shot;
};

const imageDimensions = (asset: MediaAsset) => {
  if (asset.decodedWidth === undefined || asset.decodedHeight === undefined) {
    throw new Error(`Image asset "${asset.id}" lacks decoded dimensions.`);
  }
  return { width: asset.decodedWidth, height: asset.decodedHeight };
};

const recropShot = (
  shot: VideoShot,
  mediaAssets: readonly MediaAsset[],
  canvas: VideoProject['canvas'],
): VideoShot => {
  const startAsset = mediaAssets.find((asset) => asset.id === shot.startAssetId);
  if (!startAsset || startAsset.kind !== 'image') {
    throw new Error(`Image asset "${shot.startAssetId}" does not exist.`);
  }
  if (shot.sourceMode === 'single') {
    const crops = createMotionPresetCrops(
      shot.motionPreset,
      imageDimensions(startAsset),
      canvas,
    );
    return { ...shot, startCrop: crops.start, endCrop: crops.end };
  }
  const endAsset = mediaAssets.find((asset) => asset.id === shot.endAssetId);
  if (!endAsset || endAsset.kind !== 'image') {
    throw new Error(`Image asset "${shot.endAssetId}" does not exist.`);
  }
  return {
    ...shot,
    startCrop: createCoverCrop(imageDimensions(startAsset), canvas),
    endCrop: createCoverCrop(imageDimensions(endAsset), canvas),
  };
};

const assertImageAssetExists = (
  project: VideoProject,
  assetId: string,
): MediaAsset => {
  const asset = project.mediaAssets.find((candidate) => candidate.id === assetId);

  if (!asset || asset.kind !== 'image') {
    throw new Error(`Image asset "${assetId}" does not exist.`);
  }

  return asset;
};

const replaceShotInProject = (
  project: VideoProject,
  replacement: VideoShot,
  options: ProjectMutationOptions,
): VideoProject =>
  finalizeProjectMutation(
    {
      ...project,
      shots: project.shots.map((shot) =>
        shot.id === replacement.id ? replacement : shot,
      ),
    },
    options,
  );

export const reorderShots = (
  project: VideoProject,
  orderedShotIds: readonly string[],
  options: ProjectMutationOptions = {},
): VideoProject => {
  const expectedIds = new Set(project.orderedShotIds);
  const suppliedIds = new Set(orderedShotIds);

  if (
    orderedShotIds.length !== project.orderedShotIds.length ||
    suppliedIds.size !== orderedShotIds.length ||
    orderedShotIds.some((shotId) => !expectedIds.has(shotId))
  ) {
    throw new Error('Reordered shot IDs must be an exact permutation of the project.');
  }

  return finalizeProjectMutation(
    {
      ...project,
      orderedShotIds: [...orderedShotIds],
    },
    options,
  );
};

export const moveShot = (
  project: VideoProject,
  shotId: string,
  direction: 'up' | 'down',
  options: ProjectMutationOptions = {},
): VideoProject => {
  assertShotExists(project, shotId);
  const index = project.orderedShotIds.indexOf(shotId);
  const targetIndex = direction === 'up' ? index - 1 : index + 1;

  if (targetIndex < 0 || targetIndex >= project.orderedShotIds.length) {
    return project;
  }

  const order = [...project.orderedShotIds];
  [order[index], order[targetIndex]] = [order[targetIndex]!, order[index]!];
  return reorderShots(project, order, options);
};

export const addMediaAsset = (
  project: VideoProject,
  mediaAsset: MediaAsset,
  options: ProjectMutationOptions = {},
): VideoProject => {
  const parsedAsset = MediaAssetSchema.parse(mediaAsset);

  if (project.mediaAssets.some((asset) => asset.id === parsedAsset.id)) {
    throw new Error(`Media asset "${parsedAsset.id}" already exists.`);
  }

  return finalizeProjectMutation(
    {
      ...project,
      mediaAssets: [...project.mediaAssets, parsedAsset],
    },
    options,
  );
};

export const addShot = (
  project: VideoProject,
  shot: VideoShot,
  index = project.orderedShotIds.length,
  options: ProjectMutationOptions = {},
): VideoProject => {
  if (project.shots.some((candidate) => candidate.id === shot.id)) {
    throw new Error(`Shot "${shot.id}" already exists.`);
  }
  if (!Number.isInteger(index) || index < 0 || index > project.orderedShotIds.length) {
    throw new RangeError('Shot insertion index is outside the storyboard.');
  }

  const validatedShot = withShotHashes(shot, project.mediaAssets);
  const orderedShotIds = [...project.orderedShotIds];
  orderedShotIds.splice(index, 0, validatedShot.id);

  return finalizeProjectMutation(
    {
      ...project,
      shots: [...project.shots, validatedShot],
      orderedShotIds,
    },
    options,
  );
};

export const removeShot = (
  project: VideoProject,
  shotId: string,
  options: ProjectMutationOptions = {},
): VideoProject => {
  assertShotExists(project, shotId);

  return finalizeProjectMutation(
    {
      ...project,
      shots: project.shots.filter((shot) => shot.id !== shotId),
      orderedShotIds: project.orderedShotIds.filter((id) => id !== shotId),
    },
    options,
  );
};

export const replaceShotAsset = (
  project: VideoProject,
  shotId: string,
  slot: 'start' | 'end',
  replacementAssetId: string,
  options: ProjectMutationOptions = {},
): VideoProject => {
  const shot = assertShotExists(project, shotId);
  assertImageAssetExists(project, replacementAssetId);

  let changedShot: VideoShot;
  if (slot === 'start') {
    changedShot = { ...shot, startAssetId: replacementAssetId, status: 'ready' };
  } else {
    if (shot.sourceMode !== 'pair') {
      throw new Error('Only an Image Pair shot has an end asset.');
    }
    changedShot = { ...shot, endAssetId: replacementAssetId, status: 'ready' };
  }

  const replacement = withShotHashes(
    recropShot(changedShot, project.mediaAssets, project.canvas),
    project.mediaAssets,
  );

  return replaceShotInProject(project, replacement, options);
};

/**
 * Replaces the bytes/metadata behind a stable asset ID and invalidates only the
 * content hashes of shots that reference that asset.
 */
export const replaceMediaAsset = (
  project: VideoProject,
  assetId: string,
  replacement: MediaAsset,
  options: ProjectMutationOptions = {},
): VideoProject => {
  const existing = project.mediaAssets.find((asset) => asset.id === assetId);
  if (!existing) {
    throw new Error(`Media asset "${assetId}" does not exist.`);
  }
  if (replacement.id !== assetId) {
    throw new Error('Stable media replacement must retain the original asset ID.');
  }
  if (replacement.kind !== existing.kind) {
    throw new Error('Stable media replacement must retain the original asset kind.');
  }

  const parsedReplacement = MediaAssetSchema.parse(replacement);
  const mediaAssets = project.mediaAssets.map((asset) =>
    asset.id === assetId ? parsedReplacement : asset,
  );
  const shots = project.shots.map((shot) => {
    const referencesReplacement =
      shot.startAssetId === assetId ||
      (shot.sourceMode === 'pair' && shot.endAssetId === assetId);

    return referencesReplacement
      ? withShotHashes(
          recropShot({ ...shot, status: 'ready' }, mediaAssets, project.canvas),
          mediaAssets,
        )
      : shot;
  });

  return finalizeProjectMutation(
    {
      ...project,
      mediaAssets,
      shots,
    },
    options,
  );
};

export const retimeShot = (
  project: VideoProject,
  shotId: string,
  durationSec: number,
  options: ProjectMutationOptions = {},
): VideoProject => {
  if (
    !Number.isFinite(durationSec) ||
    durationSec < MIN_SHOT_DURATION_SEC ||
    durationSec > MAX_SHOT_DURATION_SEC
  ) {
    throw new RangeError(
      `Shot duration must be between ${MIN_SHOT_DURATION_SEC} and ${MAX_SHOT_DURATION_SEC} seconds.`,
    );
  }

  const shot = assertShotExists(project, shotId);
  const replacement = withShotHashes(
    { ...shot, durationSec, status: 'ready' },
    project.mediaAssets,
  );

  return replaceShotInProject(project, replacement, options);
};

export type ShotTreatmentChange =
  | {
      kind: 'motion';
      motionPreset: MotionPreset;
    }
  | {
      kind: 'pair';
      pairTreatment: PairTreatment;
    };

export const setShotTreatment = (
  project: VideoProject,
  shotId: string,
  treatment: ShotTreatmentChange,
  options: ProjectMutationOptions = {},
): VideoProject => {
  const shot = assertShotExists(project, shotId);

  if (treatment.kind === 'motion') {
    if (shot.sourceMode !== 'single') {
      throw new Error('Motion presets apply only to Single Image shots.');
    }

    return replaceShotInProject(
      project,
      withShotHashes(
        recropShot(
          { ...shot, motionPreset: treatment.motionPreset, status: 'ready' },
          project.mediaAssets,
          project.canvas,
        ),
        project.mediaAssets,
      ),
      options,
    );
  }

  if (shot.sourceMode !== 'pair') {
    throw new Error('Pair treatments apply only to Image Pair shots.');
  }

  return replaceShotInProject(
    project,
    withShotHashes(
      { ...shot, pairTreatment: treatment.pairTreatment, status: 'ready' },
      project.mediaAssets,
    ),
    options,
  );
};

export const setShotMotionPreset = (
  project: VideoProject,
  shotId: string,
  motionPreset: MotionPreset,
  options: ProjectMutationOptions = {},
): VideoProject =>
  setShotTreatment(project, shotId, { kind: 'motion', motionPreset }, options);

export type ShotSourceModeChange =
  | {
      sourceMode: 'single';
      startAssetId?: string;
      motionPreset?: MotionPreset;
    }
  | {
      sourceMode: 'pair';
      startAssetId?: string;
      endAssetId: string;
    };

export const setShotSourceMode = (
  project: VideoProject,
  shotId: string,
  change: ShotSourceModeChange,
  options: ProjectMutationOptions = {},
): VideoProject => {
  const shot = assertShotExists(project, shotId);
  const startAssetId = change.startAssetId ?? shot.startAssetId;
  assertImageAssetExists(project, startAssetId);

  if (change.sourceMode === 'single') {
    const replacement = withShotHashes(
      recropShot({
        id: shot.id,
        sourceMode: 'single',
        startAssetId,
        motionPreset:
          change.motionPreset ??
          (shot.sourceMode === 'single' ? shot.motionPreset : 'still'),
        durationSec: shot.durationSec,
        startCrop: shot.startCrop,
        endCrop: shot.endCrop,
        easing: shot.easing,
        contentHash: shot.contentHash,
        settingsHash: shot.settingsHash,
        status: 'ready',
      }, project.mediaAssets, project.canvas),
      project.mediaAssets,
    );

    return replaceShotInProject(project, replacement, options);
  }

  assertImageAssetExists(project, change.endAssetId);
  const priorGenerationFields =
    shot.sourceMode === 'pair'
      ? {
          generatedClipRef: shot.generatedClipRef,
          generationStatus: shot.generationStatus,
          generationProvider: shot.generationProvider,
          generationMetadata: shot.generationMetadata,
        }
      : {
          generationStatus: 'not-requested' as const,
        };
  const replacement = withShotHashes(
    recropShot({
      id: shot.id,
      sourceMode: 'pair',
      startAssetId,
      endAssetId: change.endAssetId,
      motionPreset: 'still',
      pairTreatment: 'dissolve',
      ...priorGenerationFields,
      durationSec: shot.durationSec,
      startCrop: shot.startCrop,
      endCrop: shot.endCrop,
      easing: shot.easing,
      contentHash: shot.contentHash,
      settingsHash: shot.settingsHash,
      status: 'ready',
    }, project.mediaAssets, project.canvas),
    project.mediaAssets,
  );

  return replaceShotInProject(project, replacement, options);
};
