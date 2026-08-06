import { AUDIO_FILE_LIMITS, BRAND_IMAGE_LIMITS, IMAGE_FILE_LIMITS } from './limits';
import { readEncodedImageDimensions } from './encodedImageDimensions';
import {
  audioMimeForFormat,
  detectAudioSignature,
  detectImageSignature,
  imageMimeForFormat,
  type SupportedAudioFormat,
  type SupportedImageFormat,
} from './signatures';

export type MediaIntakeErrorCode =
  | 'EMPTY_BATCH'
  | 'TOO_FEW_PHOTOS'
  | 'TOO_MANY_PHOTOS'
  | 'FILE_TOO_LARGE'
  | 'TOTAL_TOO_LARGE'
  | 'ZERO_BYTE_FILE'
  | 'UNSUPPORTED_SIGNATURE'
  | 'CORRUPT_FILE'
  | 'DIMENSIONS_TOO_SMALL'
  | 'DIMENSIONS_TOO_LARGE'
  | 'DUPLICATE_FILE'
  | 'AUDIO_TOO_LONG';

export interface MediaIntakeIssue {
  code: MediaIntakeErrorCode;
  filename?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DecodedImageDimensions {
  width: number;
  height: number;
}

export interface AcceptedImageFile {
  file: File;
  contentHash: string;
  detectedFormat: SupportedImageFormat;
  detectedMimeType: string;
  width: number;
  height: number;
}

export interface AcceptedAudioFile {
  file: File;
  contentHash: string;
  detectedFormat: SupportedAudioFormat;
  detectedMimeType: string;
  durationSec: number;
}

export interface ImageBatchResult {
  accepted: AcceptedImageFile[];
  issues: MediaIntakeIssue[];
}

export interface AudioIntakeResult {
  accepted: AcceptedAudioFile | null;
  issues: MediaIntakeIssue[];
}

export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
};

export const sha256Blob = async (blob: Blob) => {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

export const decodeImageDimensions = async (blob: Blob): Promise<DecodedImageDimensions> => {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    const dimensions = { width: bitmap.width, height: bitmap.height };
    bitmap.close();
    return dimensions;
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The image could not be decoded.'));
    };
    image.src = url;
  });
};

export const decodeAudioDuration = async (blob: Blob) => {
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Audio decoding is not supported in this browser.');
  const context = new AudioContextConstructor();
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return buffer.duration;
  } finally {
    await context.close();
  }
};

const issue = (
  code: MediaIntakeErrorCode,
  message: string,
  filename?: string,
  severity: MediaIntakeIssue['severity'] = 'error',
): MediaIntakeIssue => ({ code, filename, message, severity });

export interface ValidateImageBatchOptions {
  currentImageCount?: number;
  currentTotalBytes?: number;
  existingHashes?: ReadonlySet<string>;
  mode?: 'bulk' | 'replacement' | 'branding';
  decodeDimensions?: (blob: Blob) => Promise<DecodedImageDimensions>;
}

export const validateImageBatch = async (
  files: readonly File[],
  options: ValidateImageBatchOptions = {},
): Promise<ImageBatchResult> => {
  const {
    currentImageCount = 0,
    currentTotalBytes = 0,
    existingHashes = new Set<string>(),
    mode = 'bulk',
    decodeDimensions: decode = decodeImageDimensions,
  } = options;
  const issues: MediaIntakeIssue[] = [];
  const accepted: AcceptedImageFile[] = [];

  if (files.length === 0) {
    return { accepted, issues: [issue('EMPTY_BATCH', 'Choose one or more image files.')] };
  }

  if (mode === 'bulk' && currentImageCount + files.length > IMAGE_FILE_LIMITS.maximumProjectCount) {
    issues.push(issue(
      'TOO_MANY_PHOTOS',
      `A local project supports up to ${IMAGE_FILE_LIMITS.maximumProjectCount} photographs.`,
    ));
    return { accepted, issues };
  }

  const batchBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (mode !== 'branding' && currentTotalBytes + batchBytes > IMAGE_FILE_LIMITS.maximumTotalBytes) {
    issues.push(issue(
      'TOTAL_TOO_LARGE',
      `The photographs exceed the ${formatBytes(IMAGE_FILE_LIMITS.maximumTotalBytes)} project limit.`,
    ));
    return { accepted, issues };
  }

  const seenHashes = new Set(existingHashes);
  for (const file of files) {
    if (file.size === 0) {
      issues.push(issue('ZERO_BYTE_FILE', 'This file is empty.', file.name));
      continue;
    }
    const maximumBytes = mode === 'branding'
      ? BRAND_IMAGE_LIMITS.maximumFileBytes
      : IMAGE_FILE_LIMITS.maximumFileBytes;
    if (file.size > maximumBytes) {
      issues.push(issue(
        'FILE_TOO_LARGE',
        `This image exceeds the ${formatBytes(maximumBytes)} file limit.`,
        file.name,
      ));
      continue;
    }

    const signatureBytes = new Uint8Array(await file.slice(0, 32).arrayBuffer());
    const detectedFormat = detectImageSignature(signatureBytes);
    if (!detectedFormat) {
      issues.push(issue(
        'UNSUPPORTED_SIGNATURE',
        'Use a real JPEG, PNG or WebP image. Renaming a file does not change its format.',
        file.name,
      ));
      continue;
    }

    const limits = mode === 'branding' ? BRAND_IMAGE_LIMITS : IMAGE_FILE_LIMITS;
    const encodedDimensions = await readEncodedImageDimensions(file, detectedFormat);
    if (encodedDimensions) {
      const encodedPixels = encodedDimensions.width * encodedDimensions.height;
      if (
        encodedDimensions.width > limits.maximumDimension
        || encodedDimensions.height > limits.maximumDimension
        || encodedPixels > limits.maximumPixels
      ) {
        issues.push(issue(
          'DIMENSIONS_TOO_LARGE',
          'This image declares more pixels than the local safety limit and was not decoded.',
          file.name,
        ));
        continue;
      }
    }

    const contentHash = await sha256Blob(file);
    if (seenHashes.has(contentHash)) {
      issues.push(issue('DUPLICATE_FILE', 'This photograph is already in the project.', file.name));
      continue;
    }

    let dimensions: DecodedImageDimensions;
    try {
      dimensions = await decode(file);
    } catch {
      issues.push(issue('CORRUPT_FILE', 'The image signature is valid but the pixels cannot be decoded.', file.name));
      continue;
    }

    const pixels = dimensions.width * dimensions.height;
    if (
      mode !== 'branding'
      && (dimensions.width < IMAGE_FILE_LIMITS.minimumWidth || dimensions.height < IMAGE_FILE_LIMITS.minimumHeight)
    ) {
      issues.push(issue(
        'DIMENSIONS_TOO_SMALL',
        `Images must be at least ${IMAGE_FILE_LIMITS.minimumWidth} × ${IMAGE_FILE_LIMITS.minimumHeight} pixels.`,
        file.name,
      ));
      continue;
    }
    if (
      dimensions.width > limits.maximumDimension
      || dimensions.height > limits.maximumDimension
      || pixels > limits.maximumPixels
    ) {
      issues.push(issue('DIMENSIONS_TOO_LARGE', 'This image has more pixels than the local safety limit.', file.name));
      continue;
    }

    seenHashes.add(contentHash);
    accepted.push({
      file,
      contentHash,
      detectedFormat,
      detectedMimeType: imageMimeForFormat(detectedFormat),
      width: dimensions.width,
      height: dimensions.height,
    });
  }

  if (
    mode === 'bulk'
    && currentImageCount + accepted.length < IMAGE_FILE_LIMITS.minimumProjectCount
    && accepted.length > 0
  ) {
    issues.push(issue(
      'TOO_FEW_PHOTOS',
      `Add at least ${IMAGE_FILE_LIMITS.minimumProjectCount} photographs before exporting a complete property video.`,
      undefined,
      'warning',
    ));
  }

  return { accepted, issues };
};

export interface ValidateAudioOptions {
  decodeDuration?: (blob: Blob) => Promise<number>;
}

export const validateAudioFile = async (
  file: File,
  options: ValidateAudioOptions = {},
): Promise<AudioIntakeResult> => {
  const issues: MediaIntakeIssue[] = [];
  if (file.size === 0) {
    return { accepted: null, issues: [issue('ZERO_BYTE_FILE', 'This audio file is empty.', file.name)] };
  }
  if (file.size > AUDIO_FILE_LIMITS.maximumFileBytes) {
    return {
      accepted: null,
      issues: [issue(
        'FILE_TOO_LARGE',
        `Audio files must be ${formatBytes(AUDIO_FILE_LIMITS.maximumFileBytes)} or smaller.`,
        file.name,
      )],
    };
  }
  const detectedFormat = detectAudioSignature(new Uint8Array(await file.slice(0, 32).arrayBuffer()));
  if (!detectedFormat) {
    return {
      accepted: null,
      issues: [issue('UNSUPPORTED_SIGNATURE', 'Use a real WAV, MP3 or M4A audio file.', file.name)],
    };
  }

  let durationSec: number;
  try {
    durationSec = await (options.decodeDuration ?? decodeAudioDuration)(file);
  } catch {
    return {
      accepted: null,
      issues: [issue('CORRUPT_FILE', 'The audio signature is valid but the track cannot be decoded.', file.name)],
    };
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0) {
    return {
      accepted: null,
      issues: [issue('CORRUPT_FILE', 'The audio track has no playable duration.', file.name)],
    };
  }
  if (durationSec > AUDIO_FILE_LIMITS.maximumDurationSec) {
    return {
      accepted: null,
      issues: [issue(
        'AUDIO_TOO_LONG',
        `Audio tracks may be up to ${AUDIO_FILE_LIMITS.maximumDurationSec / 60} minutes.`,
        file.name,
      )],
    };
  }

  return {
    accepted: {
      file,
      contentHash: await sha256Blob(file),
      detectedFormat,
      detectedMimeType: audioMimeForFormat(detectedFormat),
      durationSec,
    },
    issues,
  };
};
