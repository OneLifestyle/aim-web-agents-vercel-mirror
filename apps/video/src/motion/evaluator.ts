import {
  assertCropMatchesCanvasAspect,
  createCoverCrop,
  createImagePixelPlacement,
  createMotionPresetCrops,
  interpolateNormalizedCrop,
  type MotionPresetOptions,
} from './crop';
import { applyEasing, clampProgress } from './easing';
import type {
  CropEndpoints,
  Dimensions,
  ImagePixelPlacement,
  MotionEasing,
  MotionPreset,
  NormalizedCropRect,
  PairTreatment,
} from './types';

export type FramePosition =
  | {
      progress: number;
      timeSeconds?: never;
      durationSeconds?: never;
    }
  | {
      progress?: never;
      timeSeconds: number;
      durationSeconds: number;
    };

interface FrameEvaluationBase {
  canvasDimensions: Dimensions;
  easing?: MotionEasing;
}
export type SingleImageFrameRequest = FramePosition &
  FrameEvaluationBase & {
    sourceMode: 'single';
    sourceDimensions: Dimensions;
    motionPreset: MotionPreset;
    /** Optional validated project-contract crops for future custom framing. */
    cropEndpoints?: CropEndpoints;
    presetOptions?: MotionPresetOptions;
  };

export type PairDissolveFrameRequest = FramePosition &
  FrameEvaluationBase & {
    sourceMode: 'pair';
    pairTreatment: PairTreatment;
    startSourceDimensions: Dimensions;
    endSourceDimensions: Dimensions;
    startImageCrop?: NormalizedCropRect;
    endImageCrop?: NormalizedCropRect;
  };

export type ShotFrameRequest =
  | SingleImageFrameRequest
  | PairDissolveFrameRequest;

export interface EvaluatedSingleImageFrame {
  sourceMode: 'single';
  linearProgress: number;
  easedProgress: number;
  crop: NormalizedCropRect;
  placement: ImagePixelPlacement;
}

export interface EvaluatedPairLayer {
  role: 'start' | 'end';
  opacity: number;
  crop: NormalizedCropRect;
  placement: ImagePixelPlacement;
}

export interface EvaluatedPairDissolveFrame {
  sourceMode: 'pair';
  pairTreatment: 'dissolve';
  linearProgress: number;
  easedProgress: number;
  layers: readonly [EvaluatedPairLayer, EvaluatedPairLayer];
}

export type EvaluatedShotFrame =
  | EvaluatedSingleImageFrame
  | EvaluatedPairDissolveFrame;

export function resolveFrameProgress(position: FramePosition): number {
  if ('progress' in position && position.progress !== undefined) {
    return clampProgress(position.progress);
  }

  if (!Number.isFinite(position.timeSeconds)) {
    throw new RangeError('Frame time must be a finite number.');
  }

  if (
    !Number.isFinite(position.durationSeconds) ||
    position.durationSeconds <= 0
  ) {
    throw new RangeError('Frame duration must be a positive finite number.');
  }

  return clampProgress(position.timeSeconds / position.durationSeconds);
}

export function evaluateSingleImageFrame(
  request: SingleImageFrameRequest,
): EvaluatedSingleImageFrame {
  const linearProgress = resolveFrameProgress(request);
  const easedProgress = applyEasing(
    linearProgress,
    request.easing ?? 'ease-in-out',
  );
  const cropEndpoints =
    request.cropEndpoints ??
    createMotionPresetCrops(
      request.motionPreset,
      request.sourceDimensions,
      request.canvasDimensions,
      request.presetOptions,
    );

  assertCropMatchesCanvasAspect(
    cropEndpoints.start,
    request.sourceDimensions,
    request.canvasDimensions,
    'Start crop',
  );
  assertCropMatchesCanvasAspect(
    cropEndpoints.end,
    request.sourceDimensions,
    request.canvasDimensions,
    'End crop',
  );

  const crop = interpolateNormalizedCrop(
    cropEndpoints.start,
    cropEndpoints.end,
    easedProgress,
  );

  return {
    sourceMode: 'single',
    linearProgress,
    easedProgress,
    crop,
    placement: createImagePixelPlacement(
      crop,
      request.sourceDimensions,
      request.canvasDimensions,
    ),
  };
}

export function evaluatePairDissolveFrame(
  request: PairDissolveFrameRequest,
): EvaluatedPairDissolveFrame {
  if (request.pairTreatment !== 'dissolve') {
    const unsupportedTreatment: never = request.pairTreatment;
    throw new RangeError(
      `Unsupported pair treatment: ${String(unsupportedTreatment)}`,
    );
  }

  const linearProgress = resolveFrameProgress(request);
  const easedProgress = applyEasing(
    linearProgress,
    request.easing ?? 'ease-in-out',
  );
  const startCrop =
    request.startImageCrop ??
    createCoverCrop(request.startSourceDimensions, request.canvasDimensions);
  const endCrop =
    request.endImageCrop ??
    createCoverCrop(request.endSourceDimensions, request.canvasDimensions);

  return {
    sourceMode: 'pair',
    pairTreatment: 'dissolve',
    linearProgress,
    easedProgress,
    layers: [
      {
        role: 'start',
        opacity: 1 - easedProgress,
        crop: startCrop,
        placement: createImagePixelPlacement(
          startCrop,
          request.startSourceDimensions,
          request.canvasDimensions,
        ),
      },
      {
        role: 'end',
        opacity: easedProgress,
        crop: endCrop,
        placement: createImagePixelPlacement(
          endCrop,
          request.endSourceDimensions,
          request.canvasDimensions,
        ),
      },
    ],
  };
}

/** Pure renderer-neutral evaluator shared by exact-time preview and export. */
export function evaluateShotFrame(
  request: ShotFrameRequest,
): EvaluatedShotFrame {
  switch (request.sourceMode) {
    case 'single':
      return evaluateSingleImageFrame(request);
    case 'pair':
      return evaluatePairDissolveFrame(request);
    default: {
      const unsupportedRequest: never = request;
      throw new RangeError(
        `Unsupported source mode: ${String(unsupportedRequest)}`,
      );
    }
  }
}
