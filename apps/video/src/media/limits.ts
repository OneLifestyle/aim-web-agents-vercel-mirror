export const IMAGE_FILE_LIMITS = {
  minimumProjectCount: 15,
  maximumProjectCount: 30,
  maximumFileBytes: 25 * 1024 * 1024,
  maximumTotalBytes: 500 * 1024 * 1024,
  minimumWidth: 640,
  minimumHeight: 360,
  maximumDimension: 16_000,
  maximumPixels: 80_000_000,
} as const;
export const AUDIO_FILE_LIMITS = {
  maximumFileBytes: 100 * 1024 * 1024,
  maximumDurationSec: 30 * 60,
} as const;

export const BRAND_IMAGE_LIMITS = {
  maximumFileBytes: 10 * 1024 * 1024,
  maximumDimension: 8_000,
  maximumPixels: 32_000_000,
} as const;
