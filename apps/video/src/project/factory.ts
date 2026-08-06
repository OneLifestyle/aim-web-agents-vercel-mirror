import {
  createShotContentHash,
  createShotSettingsHash,
} from './hash';
import {
  assertCropMatchesCanvasAspect,
  createCoverCrop,
  createMotionPresetCrops,
} from '../motion';
import { createClientAlphaOutputProfile } from './outputProfile';
import {
  VIDEO_PROJECT_VERSION,
  VideoProjectSchema,
  VideoShotSchema,
  type Easing,
  type CanvasDimensions,
  type MediaAsset,
  type MotionPreset,
  type NormalizedCropRect,
  type OutputVariant,
  type VideoProject,
  type VideoShot,
} from './schemas';

type DistributedOmit<T, K extends PropertyKey> = T extends unknown
  ? Omit<T, Extract<keyof T, K>>
  : never;

export type VideoShotDraft = DistributedOmit<
  VideoShot,
  'contentHash' | 'settingsHash'
>;

export interface CreateDefaultVideoProjectInput {
  id: string;
  name: string;
  propertyAddress?: string;
  videoTitle?: string;
  subtitle?: string;
  outputVariant?: OutputVariant;
  now?: string;
}

export const createDefaultVideoProject = (
  input: CreateDefaultVideoProjectInput,
): VideoProject => {
  const timestamp = input.now ?? new Date().toISOString();
  const outputProfile = createClientAlphaOutputProfile();

  return VideoProjectSchema.parse({
    version: VIDEO_PROJECT_VERSION,
    id: input.id,
    name: input.name,
    propertyAddress: input.propertyAddress,
    videoTitle: input.videoTitle,
    subtitle: input.subtitle,
    createdAt: timestamp,
    updatedAt: timestamp,
    mediaAssets: [],
    shots: [],
    orderedShotIds: [],
    canvas: { ...outputProfile.canvas },
    fps: outputProfile.fps,
    overlays: [],
    audioTracks: [],
    endCard: {
      enabled: false,
      durationSec: 3,
    },
    outputVariant: input.outputVariant ?? 'unbranded',
    outputProfile,
    renderStatus: 'idle',
    renderJobs: [],
  });
};

export const createVideoShot = (
  draft: VideoShotDraft,
  mediaAssets: readonly MediaAsset[],
): VideoShot =>
  VideoShotSchema.parse({
    ...draft,
    contentHash: createShotContentHash(draft, mediaAssets),
    settingsHash: createShotSettingsHash(draft),
  });

export interface CreateSingleImageShotInput {
  id: string;
  startAssetId: string;
  durationSec?: number;
  motionPreset?: MotionPreset;
  startCrop?: NormalizedCropRect;
  endCrop?: NormalizedCropRect;
  easing?: Easing;
  canvas?: CanvasDimensions;
}

const imageDimensions = (
  assetId: string,
  mediaAssets: readonly MediaAsset[],
) => {
  const asset = mediaAssets.find((candidate) => candidate.id === assetId);
  if (
    !asset
    || asset.kind !== 'image'
    || asset.decodedWidth === undefined
    || asset.decodedHeight === undefined
  ) {
    throw new Error(`Image asset "${assetId}" does not exist or lacks decoded dimensions.`);
  }
  return { width: asset.decodedWidth, height: asset.decodedHeight };
};

const resolveCanvas = (canvas?: CanvasDimensions): CanvasDimensions =>
  canvas ?? createClientAlphaOutputProfile().canvas;

export const createSingleImageShot = (
  input: CreateSingleImageShotInput,
  mediaAssets: readonly MediaAsset[],
): VideoShot => {
  const canvas = resolveCanvas(input.canvas);
  const source = imageDimensions(input.startAssetId, mediaAssets);
  const motionPreset = input.motionPreset ?? 'still';
  const defaults = createMotionPresetCrops(motionPreset, source, canvas);
  const startCrop = input.startCrop ? { ...input.startCrop } : defaults.start;
  const endCrop = input.endCrop ? { ...input.endCrop } : defaults.end;
  assertCropMatchesCanvasAspect(startCrop, source, canvas, 'Start crop');
  assertCropMatchesCanvasAspect(endCrop, source, canvas, 'End crop');

  return createVideoShot(
    {
      id: input.id,
      sourceMode: 'single',
      startAssetId: input.startAssetId,
      motionPreset,
      durationSec: input.durationSec ?? 4,
      startCrop,
      endCrop,
      easing: input.easing ?? 'ease-in-out',
      status: 'ready',
    },
    mediaAssets,
  );
};

export interface CreateImagePairShotInput {
  id: string;
  startAssetId: string;
  endAssetId: string;
  durationSec?: number;
  startCrop?: NormalizedCropRect;
  endCrop?: NormalizedCropRect;
  easing?: Easing;
  canvas?: CanvasDimensions;
}

export const createImagePairShot = (
  input: CreateImagePairShotInput,
  mediaAssets: readonly MediaAsset[],
): VideoShot => {
  const canvas = resolveCanvas(input.canvas);
  const startSource = imageDimensions(input.startAssetId, mediaAssets);
  const endSource = imageDimensions(input.endAssetId, mediaAssets);
  const startCrop = input.startCrop
    ? { ...input.startCrop }
    : createCoverCrop(startSource, canvas);
  const endCrop = input.endCrop
    ? { ...input.endCrop }
    : createCoverCrop(endSource, canvas);
  assertCropMatchesCanvasAspect(startCrop, startSource, canvas, 'Start crop');
  assertCropMatchesCanvasAspect(endCrop, endSource, canvas, 'End crop');

  return createVideoShot(
    {
      id: input.id,
      sourceMode: 'pair',
      startAssetId: input.startAssetId,
      endAssetId: input.endAssetId,
      motionPreset: 'still',
      pairTreatment: 'dissolve',
      generationStatus: 'not-requested',
      durationSec: input.durationSec ?? 4,
      startCrop,
      endCrop,
      easing: input.easing ?? 'linear',
      status: 'ready',
    },
    mediaAssets,
  );
};
