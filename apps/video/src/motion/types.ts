export interface Dimensions {
  width: number;
  height: number;
}

/**
 * A source-image crop expressed as fractions of the decoded source dimensions.
 */
export interface NormalizedCropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type MotionPreset =
  | 'still'
  | 'zoom-in'
  | 'zoom-out'
  | 'pan-left'
  | 'pan-right';

export type MotionEasing = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';

export type PairTreatment = 'dissolve';

export interface CropEndpoints {
  start: NormalizedCropRect;
  end: NormalizedCropRect;
}

/**
 * Geometry for both Canvas drawImage(sourceRect, destinationRect) and an
 * absolutely positioned full image. Renderers can use either representation.
 */
export interface ImagePixelPlacement {
  sourceRect: PixelRect;
  destinationRect: PixelRect;
  fullImageRect: PixelRect;
  scale: number;
}
