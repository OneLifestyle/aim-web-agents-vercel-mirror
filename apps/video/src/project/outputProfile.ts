import {
  OutputProfileSchema,
  type OutputProfile,
  type OutputVariant,
} from './schemas';

export const CLIENT_ALPHA_OUTPUT_PROFILE_ID = 'client-alpha-1080p-v1';

export const CLIENT_ALPHA_1080P_PROFILE: Readonly<OutputProfile> = Object.freeze(
  OutputProfileSchema.parse({
    id: CLIENT_ALPHA_OUTPUT_PROFILE_ID,
    version: '1.0.0',
    container: 'mp4',
    canvas: {
      width: 1920,
      height: 1080,
    },
    aspectRatio: '16:9',
    fps: 30,
    videoCodec: 'h264-avc',
    audioCodec: 'aac-lc',
    pixelFormat: 'yuv420p',
    qualityMode: 'variable-bitrate',
    targetVideoBitrateMbps: 6,
    targetAudioBitrateKbps: 192,
    safeAreas: {
      action: {
        top: 0.035,
        right: 0.035,
        bottom: 0.035,
        left: 0.035,
      },
      title: {
        top: 0.05,
        right: 0.05,
        bottom: 0.05,
        left: 0.05,
      },
    },
    expectedFileSizeMbPerMinute: {
      min: 15,
      max: 60,
    },
    filenameConvention: '{project-slug}-{variant}-client-alpha-1080p-v1.mp4',
  }),
);

export const createClientAlphaOutputProfile = (): OutputProfile =>
  OutputProfileSchema.parse(CLIENT_ALPHA_1080P_PROFILE);

export const slugifyOutputName = (value: string): string => {
  const slug = value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100)
    .replace(/-+$/g, '');

  return slug || 'property-video';
};

export const createOutputFileName = (
  projectName: string,
  variant: OutputVariant,
): string =>
  `${slugifyOutputName(projectName)}-${variant}-client-alpha-1080p-v1.mp4`;

export interface ExpectedFileSizeRange {
  minBytes: number;
  maxBytes: number;
}

export const estimateOutputFileSizeRange = (
  durationSec: number,
  profile: OutputProfile = createClientAlphaOutputProfile(),
): ExpectedFileSizeRange => {
  if (!Number.isFinite(durationSec) || durationSec < 0) {
    throw new RangeError('Output duration must be a finite non-negative number.');
  }

  const minutes = durationSec / 60;
  const bytesPerMegabyte = 1_000_000;

  return {
    minBytes: Math.ceil(
      minutes * profile.expectedFileSizeMbPerMinute.min * bytesPerMegabyte,
    ),
    maxBytes: Math.ceil(
      minutes * profile.expectedFileSizeMbPerMinute.max * bytesPerMegabyte,
    ),
  };
};
