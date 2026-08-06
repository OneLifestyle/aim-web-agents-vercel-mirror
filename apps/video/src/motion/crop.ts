import { clampProgress } from './easing';
import type {
  CropEndpoints,
  Dimensions,
  ImagePixelPlacement,
  MotionPreset,
  NormalizedCropRect,
} from './types';

const DEFAULT_ZOOM_CROP_SCALE = 0.86;
const DEFAULT_PAN_CROP_SCALE = 0.9;
const BOUNDS_EPSILON = 1e-10;
const ASPECT_EPSILON = 1e-8;

export interface MotionPresetOptions {
  /** End-window size relative to the cover crop. Smaller means more zoom. */
  zoomCropScale?: number;
  /** Window size relative to the cover crop. Smaller means more pan travel. */
  panCropScale?: number;
}

function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label} must be a positive finite number.`);
  }
}

export function assertValidDimensions(
  dimensions: Dimensions,
  label = 'Dimensions',
): void {
  assertPositiveFinite(dimensions.width, `${label} width`);
  assertPositiveFinite(dimensions.height, `${label} height`);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function cleanUnitValue(value: number): number {
  if (Math.abs(value) <= BOUNDS_EPSILON) {
    return 0;
  }

  if (Math.abs(1 - value) <= BOUNDS_EPSILON) {
    return 1;
  }

  return clamp(value, 0, 1);
}

function cleanUnitSize(value: number): number {
  if (Math.abs(1 - value) <= BOUNDS_EPSILON) {
    return 1;
  }

  return clamp(value, 0, 1);
}

function makeBoundedCrop(
  x: number,
  y: number,
  width: number,
  height: number,
): NormalizedCropRect {
  const boundedWidth = cleanUnitSize(width);
  const boundedHeight = cleanUnitSize(height);

  return {
    x: cleanUnitValue(clamp(x, 0, 1 - boundedWidth)),
    y: cleanUnitValue(clamp(y, 0, 1 - boundedHeight)),
    width: boundedWidth,
    height: boundedHeight,
  };
}

export function assertNormalizedCrop(
  crop: NormalizedCropRect,
  label = 'Crop',
): void {
  const entries = Object.entries(crop);
  for (const [key, value] of entries) {
    if (!Number.isFinite(value)) {
      throw new RangeError(`${label} ${key} must be a finite number.`);
    }
  }

  if (crop.width <= 0 || crop.height <= 0) {
    throw new RangeError(`${label} width and height must be greater than zero.`);
  }

  if (
    crop.x < -BOUNDS_EPSILON ||
    crop.y < -BOUNDS_EPSILON ||
    crop.x + crop.width > 1 + BOUNDS_EPSILON ||
    crop.y + crop.height > 1 + BOUNDS_EPSILON
  ) {
    throw new RangeError(`${label} must stay within normalized source bounds.`);
  }
}

export function assertCropMatchesCanvasAspect(
  crop: NormalizedCropRect,
  source: Dimensions,
  canvas: Dimensions,
  label = 'Crop',
): void {
  assertNormalizedCrop(crop, label);
  assertValidDimensions(source, 'Source');
  assertValidDimensions(canvas, 'Canvas');

  const cropAspect =
    (crop.width * source.width) / (crop.height * source.height);
  const canvasAspect = canvas.width / canvas.height;
  const relativeError = Math.abs(cropAspect / canvasAspect - 1);

  if (relativeError > ASPECT_EPSILON) {
    throw new RangeError(
      `${label} pixel aspect must match the destination canvas aspect.`,
    );
  }
}

/**
 * Returns the largest centered source crop that covers the canvas without
 * stretching or exposing an edge.
 */
export function createCoverCrop(
  source: Dimensions,
  canvas: Dimensions,
): NormalizedCropRect {
  assertValidDimensions(source, 'Source');
  assertValidDimensions(canvas, 'Canvas');

  const sourceAspect = source.width / source.height;
  const canvasAspect = canvas.width / canvas.height;

  if (sourceAspect > canvasAspect) {
    const width = canvasAspect / sourceAspect;
    return makeBoundedCrop((1 - width) / 2, 0, width, 1);
  }

  const height = sourceAspect / canvasAspect;
  return makeBoundedCrop(0, (1 - height) / 2, 1, height);
}

function assertScale(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new RangeError(`${label} must be greater than zero and at most one.`);
  }
}

function scaleCropAroundCenter(
  crop: NormalizedCropRect,
  scale: number,
): NormalizedCropRect {
  assertScale(scale, 'Crop scale');
  const width = crop.width * scale;
  const height = crop.height * scale;
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;

  return makeBoundedCrop(
    centerX - width / 2,
    centerY - height / 2,
    width,
    height,
  );
}

function createPanEndpoints(
  coverCrop: NormalizedCropRect,
  panCropScale: number,
  direction: 'left' | 'right',
): CropEndpoints {
  const panCrop = scaleCropAroundCenter(coverCrop, panCropScale);
  const leftX = coverCrop.x;
  const rightX = coverCrop.x + coverCrop.width - panCrop.width;
  const y = coverCrop.y + (coverCrop.height - panCrop.height) / 2;
  const leftCrop = makeBoundedCrop(
    leftX,
    y,
    panCrop.width,
    panCrop.height,
  );
  const rightCrop = makeBoundedCrop(
    rightX,
    y,
    panCrop.width,
    panCrop.height,
  );

  // Preset direction describes visible image movement. Moving the crop window
  // right makes source pixels travel left on the canvas, and vice versa.
  return direction === 'left'
    ? { start: leftCrop, end: rightCrop }
    : { start: rightCrop, end: leftCrop };
}

export function createMotionPresetCrops(
  preset: MotionPreset,
  source: Dimensions,
  canvas: Dimensions,
  options: MotionPresetOptions = {},
): CropEndpoints {
  const coverCrop = createCoverCrop(source, canvas);
  const zoomCropScale =
    options.zoomCropScale ?? DEFAULT_ZOOM_CROP_SCALE;
  const panCropScale = options.panCropScale ?? DEFAULT_PAN_CROP_SCALE;
  assertScale(zoomCropScale, 'Zoom crop scale');
  assertScale(panCropScale, 'Pan crop scale');

  switch (preset) {
    case 'still':
      return { start: coverCrop, end: { ...coverCrop } };
    case 'zoom-in':
      return {
        start: coverCrop,
        end: scaleCropAroundCenter(coverCrop, zoomCropScale),
      };
    case 'zoom-out':
      return {
        start: scaleCropAroundCenter(coverCrop, zoomCropScale),
        end: coverCrop,
      };
    case 'pan-left':
      return createPanEndpoints(coverCrop, panCropScale, 'left');
    case 'pan-right':
      return createPanEndpoints(coverCrop, panCropScale, 'right');
    default: {
      const unsupportedPreset: never = preset;
      throw new RangeError(
        `Unsupported motion preset: ${String(unsupportedPreset)}`,
      );
    }
  }
}

export function interpolateNormalizedCrop(
  start: NormalizedCropRect,
  end: NormalizedCropRect,
  progress: number,
): NormalizedCropRect {
  assertNormalizedCrop(start, 'Start crop');
  assertNormalizedCrop(end, 'End crop');
  const clampedProgress = clampProgress(progress);
  const interpolate = (startValue: number, endValue: number): number =>
    startValue + (endValue - startValue) * clampedProgress;

  return makeBoundedCrop(
    interpolate(start.x, end.x),
    interpolate(start.y, end.y),
    interpolate(start.width, end.width),
    interpolate(start.height, end.height),
  );
}

/** Converts one normalized crop into equivalent pixel placement forms. */
export function createImagePixelPlacement(
  crop: NormalizedCropRect,
  source: Dimensions,
  canvas: Dimensions,
): ImagePixelPlacement {
  assertCropMatchesCanvasAspect(crop, source, canvas);

  const sourceRect = {
    x: crop.x * source.width,
    y: crop.y * source.height,
    width: crop.width * source.width,
    height: crop.height * source.height,
  };
  const scale = canvas.width / sourceRect.width;

  return {
    sourceRect,
    destinationRect: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
    fullImageRect: {
      x: -sourceRect.x * scale,
      y: -sourceRect.y * scale,
      width: source.width * scale,
      height: source.height * scale,
    },
    scale,
  };
}
