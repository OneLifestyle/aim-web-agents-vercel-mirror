import { z } from 'zod';
import { assertCropMatchesCanvasAspect } from '../motion/crop';
import {
  createShotContentHash,
  createShotSettingsHash,
  STABLE_HASH_PREFIX,
} from './hash';

export const VIDEO_PROJECT_VERSION = '1.0.0' as const;
export const MAX_PROJECT_SHOTS = 30;
export const MIN_SHOT_DURATION_SEC = 0.5;
export const MAX_SHOT_DURATION_SEC = 20;
export const MAX_END_CARD_DURATION_SEC = 10;

const MAX_TIMELINE_DURATION_SEC = 60 * 60;
const MAX_MEDIA_DURATION_SEC = 24 * 60 * 60;
const TIMING_EPSILON = 0.000_001;

export const VideoProjectVersionSchema = z.literal(VIDEO_PROJECT_VERSION);
export type VideoProjectVersion = z.infer<typeof VideoProjectVersionSchema>;

export const StableIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9._:-]*$/,
    'IDs may contain letters, numbers, periods, underscores, colons, and hyphens.',
  );

export const Sha256Schema = z
  .string()
  .regex(/^[a-f0-9]{64}$/i, 'Expected a hexadecimal SHA-256 digest.');

export const StableHashSchema = z
  .string()
  .regex(
    new RegExp(`^${STABLE_HASH_PREFIX}[a-f0-9]{16}$`),
    'Expected a deterministic non-cryptographic project hash.',
  );

export const IsoDateTimeSchema = z.string().datetime({ offset: true });

const OptionalDisplayTextSchema = z.string().trim().max(500).optional();
const RequiredDisplayTextSchema = z.string().trim().min(1).max(500);

export const CanvasDimensionsSchema = z.strictObject({
  width: z.number().int().positive().max(7680),
  height: z.number().int().positive().max(4320),
});
export type CanvasDimensions = z.infer<typeof CanvasDimensionsSchema>;

export const NormalizedCropRectSchema = z
  .strictObject({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().positive().max(1),
    height: z.number().positive().max(1),
  })
  .superRefine((rect, context) => {
    if (rect.x + rect.width > 1 + TIMING_EPSILON) {
      context.addIssue({
        code: 'custom',
        path: ['width'],
        message: 'Crop rectangle exceeds the source width.',
      });
    }

    if (rect.y + rect.height > 1 + TIMING_EPSILON) {
      context.addIssue({
        code: 'custom',
        path: ['height'],
        message: 'Crop rectangle exceeds the source height.',
      });
    }
  });
export type NormalizedCropRect = z.infer<typeof NormalizedCropRectSchema>;

export const FULL_FRAME_CROP: Readonly<NormalizedCropRect> = Object.freeze({
  x: 0,
  y: 0,
  width: 1,
  height: 1,
});

export const MediaAssetKindSchema = z.enum([
  'image',
  'audio',
  'logo',
  'watermark',
]);
export type MediaAssetKind = z.infer<typeof MediaAssetKindSchema>;

export const MediaRightsSchema = z.strictObject({
  source: RequiredDisplayTextSchema,
  owner: RequiredDisplayTextSchema,
  licenceOrPermission: RequiredDisplayTextSchema,
  permittedUse: RequiredDisplayTextSchema,
  confirmedAt: IsoDateTimeSchema.optional(),
});
export type MediaRights = z.infer<typeof MediaRightsSchema>;

export const MediaAssetSchema = z
  .strictObject({
    id: StableIdSchema,
    kind: MediaAssetKindSchema,
    fileName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(127),
    fileSizeBytes: z.number().int().positive(),
    lastModifiedMs: z.number().int().nonnegative().optional(),
    contentHash: Sha256Schema,
    decodedWidth: z.number().int().positive().max(100_000).optional(),
    decodedHeight: z.number().int().positive().max(100_000).optional(),
    decodedDurationSec: z
      .number()
      .positive()
      .max(MAX_MEDIA_DURATION_SEC)
      .optional(),
    localBlobKey: z.string().min(1).max(512),
    rights: MediaRightsSchema,
    createdAt: IsoDateTimeSchema,
  })
  .superRefine((asset, context) => {
    const isVisual =
      asset.kind === 'image' ||
      asset.kind === 'logo' ||
      asset.kind === 'watermark';

    if (isVisual) {
      if (asset.decodedWidth === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['decodedWidth'],
          message: 'Visual media requires its decoded width.',
        });
      }

      if (asset.decodedHeight === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['decodedHeight'],
          message: 'Visual media requires its decoded height.',
        });
      }

      if (asset.decodedDurationSec !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['decodedDurationSec'],
          message: 'Still-image media cannot have a decoded duration.',
        });
      }
    } else {
      if (asset.decodedDurationSec === undefined) {
        context.addIssue({
          code: 'custom',
          path: ['decodedDurationSec'],
          message: 'Audio media requires its decoded duration.',
        });
      }

      if (asset.decodedWidth !== undefined || asset.decodedHeight !== undefined) {
        context.addIssue({
          code: 'custom',
          path: ['decodedWidth'],
          message: 'Audio media cannot have decoded image dimensions.',
        });
      }
    }
  });
export type MediaAsset = z.infer<typeof MediaAssetSchema>;

export const ShotSourceModeSchema = z.enum(['single', 'pair']);
export type ShotSourceMode = z.infer<typeof ShotSourceModeSchema>;

export const MotionPresetSchema = z.enum([
  'still',
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
]);
export type MotionPreset = z.infer<typeof MotionPresetSchema>;

export const PairTreatmentSchema = z.literal('dissolve');
export type PairTreatment = z.infer<typeof PairTreatmentSchema>;

export const EasingSchema = z.enum([
  'linear',
  'ease-in',
  'ease-out',
  'ease-in-out',
]);
export type Easing = z.infer<typeof EasingSchema>;

export const GenerationStatusSchema = z.enum([
  'not-requested',
  'queued',
  'generating',
  'succeeded',
  'failed',
]);
export type GenerationStatus = z.infer<typeof GenerationStatusSchema>;

export const ShotStatusSchema = z.enum([
  'ready',
  'needs-attention',
  'rendering',
  'rendered',
  'error',
]);
export type ShotStatus = z.infer<typeof ShotStatusSchema>;

const CommonVideoShotShape = {
  id: StableIdSchema,
  startAssetId: StableIdSchema,
  durationSec: z
    .number()
    .min(MIN_SHOT_DURATION_SEC)
    .max(MAX_SHOT_DURATION_SEC),
  startCrop: NormalizedCropRectSchema,
  endCrop: NormalizedCropRectSchema,
  easing: EasingSchema,
  contentHash: StableHashSchema,
  settingsHash: StableHashSchema,
  status: ShotStatusSchema,
};

export const SingleImageShotSchema = z.strictObject({
  ...CommonVideoShotShape,
  sourceMode: z.literal('single'),
  motionPreset: MotionPresetSchema,
});

export const ImagePairShotSchema = z
  .strictObject({
    ...CommonVideoShotShape,
    sourceMode: z.literal('pair'),
    endAssetId: StableIdSchema,
    motionPreset: z.literal('still'),
    pairTreatment: PairTreatmentSchema,
    generatedClipRef: z.string().min(1).max(1024).optional(),
    generationStatus: GenerationStatusSchema.optional(),
    generationProvider: z.string().min(1).max(200).optional(),
    generationMetadata: z.record(z.string(), z.json()).optional(),
  })
  .superRefine((shot, context) => {
    if (shot.startAssetId === shot.endAssetId) {
      context.addIssue({
        code: 'custom',
        path: ['endAssetId'],
        message: 'An Image Pair requires two different source assets.',
      });
    }
  });

export const VideoShotSchema = z.discriminatedUnion('sourceMode', [
  SingleImageShotSchema,
  ImagePairShotSchema,
]);
export type VideoShot = z.infer<typeof VideoShotSchema>;

export const AudioTrackSchema = z
  .strictObject({
    id: StableIdSchema,
    assetId: StableIdSchema,
    kind: z.enum(['music', 'voiceover']),
    startTimeSec: z.number().nonnegative().max(MAX_TIMELINE_DURATION_SEC),
    durationSec: z.number().positive().max(MAX_TIMELINE_DURATION_SEC),
    trimStartSec: z.number().nonnegative().max(MAX_MEDIA_DURATION_SEC),
    volume: z.number().min(0).max(1),
    fadeInSec: z.number().nonnegative().max(60),
    fadeOutSec: z.number().nonnegative().max(60),
    loop: z.boolean(),
    duckUnderVoice: z.boolean(),
    enabled: z.boolean(),
  })
  .superRefine((track, context) => {
    if (track.fadeInSec + track.fadeOutSec > track.durationSec + TIMING_EPSILON) {
      context.addIssue({
        code: 'custom',
        path: ['fadeOutSec'],
        message: 'Audio fades cannot be longer than the track placement.',
      });
    }

    if (track.kind === 'voiceover' && track.duckUnderVoice) {
      context.addIssue({
        code: 'custom',
        path: ['duckUnderVoice'],
        message: 'Only music can be reduced under voiceover.',
      });
    }
  });
export type AudioTrack = z.infer<typeof AudioTrackSchema>;

export const OverlayTimingSchema = z.strictObject({
  startTimeSec: z.number().nonnegative().max(MAX_TIMELINE_DURATION_SEC),
  durationSec: z.number().positive().max(MAX_TIMELINE_DURATION_SEC),
});
export type OverlayTiming = z.infer<typeof OverlayTimingSchema>;

export const OverlaySchema = z
  .strictObject({
    id: StableIdSchema,
    kind: z.enum(['title', 'subtitle', 'watermark']),
    timing: OverlayTimingSchema,
    text: z.string().trim().min(1).max(500).optional(),
    assetId: StableIdSchema.optional(),
    opacity: z.number().min(0).max(1).optional(),
  })
  .superRefine((overlay, context) => {
    if (
      (overlay.kind === 'title' || overlay.kind === 'subtitle') &&
      overlay.text === undefined
    ) {
      context.addIssue({
        code: 'custom',
        path: ['text'],
        message: 'Text overlays require text.',
      });
    }

    if (overlay.kind === 'watermark' && overlay.assetId === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['assetId'],
        message: 'Watermark overlays require a media asset.',
      });
    }
  });
export type Overlay = z.infer<typeof OverlaySchema>;

const HexColorSchema = z
  .string()
  .regex(/^#[a-f0-9]{6}$/i, 'Expected a six-digit hexadecimal colour.');

export const EndCardSchema = z
  .strictObject({
    enabled: z.boolean(),
    durationSec: z.number().min(0).max(MAX_END_CARD_DURATION_SEC),
    title: OptionalDisplayTextSchema,
    subtitle: OptionalDisplayTextSchema,
    agentName: OptionalDisplayTextSchema,
    agencyName: OptionalDisplayTextSchema,
    phone: OptionalDisplayTextSchema,
    email: z.string().trim().email().max(320).optional(),
    logoAssetId: StableIdSchema.optional(),
    backgroundColor: HexColorSchema.optional(),
    textColor: HexColorSchema.optional(),
  })
  .superRefine((endCard, context) => {
    if (endCard.enabled && endCard.durationSec <= 0) {
      context.addIssue({
        code: 'custom',
        path: ['durationSec'],
        message: 'An enabled end card requires a positive duration.',
      });
    }
  });
export type EndCard = z.infer<typeof EndCardSchema>;

export const OutputVariantSchema = z.enum(['unbranded', 'branded']);
export type OutputVariant = z.infer<typeof OutputVariantSchema>;

export const SafeAreaInsetsSchema = z.strictObject({
  top: z.number().min(0).max(0.25),
  right: z.number().min(0).max(0.25),
  bottom: z.number().min(0).max(0.25),
  left: z.number().min(0).max(0.25),
});
export type SafeAreaInsets = z.infer<typeof SafeAreaInsetsSchema>;

export const OutputProfileSchema = z
  .strictObject({
    id: z.literal('client-alpha-1080p-v1'),
    version: z.literal('1.0.0'),
    container: z.literal('mp4'),
    canvas: z.strictObject({
      width: z.literal(1920),
      height: z.literal(1080),
    }),
    aspectRatio: z.literal('16:9'),
    fps: z.literal(30),
    videoCodec: z.literal('h264-avc'),
    audioCodec: z.literal('aac-lc'),
    pixelFormat: z.literal('yuv420p'),
    qualityMode: z.literal('variable-bitrate'),
    targetVideoBitrateMbps: z.literal(6),
    targetAudioBitrateKbps: z.literal(192),
    safeAreas: z.strictObject({
      action: z.strictObject({
        top: z.literal(0.035),
        right: z.literal(0.035),
        bottom: z.literal(0.035),
        left: z.literal(0.035),
      }),
      title: z.strictObject({
        top: z.literal(0.05),
        right: z.literal(0.05),
        bottom: z.literal(0.05),
        left: z.literal(0.05),
      }),
    }),
    expectedFileSizeMbPerMinute: z.strictObject({
      min: z.literal(15),
      max: z.literal(60),
    }),
    filenameConvention: z.literal(
      '{project-slug}-{variant}-client-alpha-1080p-v1.mp4',
    ),
  })
  .superRefine((profile, context) => {
    if (profile.canvas.width * 9 !== profile.canvas.height * 16) {
      context.addIssue({
        code: 'custom',
        path: ['canvas'],
        message: 'Output profile canvas must be exactly 16:9.',
      });
    }
  });
export type OutputProfile = z.infer<typeof OutputProfileSchema>;

export const RenderStatusSchema = z.enum([
  'idle',
  'queued',
  'rendering',
  'cancelling',
  'cancelled',
  'succeeded',
  'failed',
]);
export type RenderStatus = z.infer<typeof RenderStatusSchema>;

export const RenderErrorSchema = z.strictObject({
  code: z.enum([
    'validation-failed',
    'missing-asset',
    'decode-failed',
    'encode-failed',
    'cancelled',
    'unsupported',
    'unknown',
  ]),
  message: z.string().trim().min(1).max(2000),
  retriable: z.boolean(),
  occurredAt: IsoDateTimeSchema,
  details: z.record(z.string(), z.json()).optional(),
});
export type RenderError = z.infer<typeof RenderErrorSchema>;

export const RenderJobSchema = z
  .strictObject({
    id: StableIdSchema,
    projectId: StableIdSchema,
    outputVariant: OutputVariantSchema,
    outputProfileId: StableIdSchema,
    status: RenderStatusSchema,
    progress: z.number().min(0).max(1),
    createdAt: IsoDateTimeSchema,
    startedAt: IsoDateTimeSchema.optional(),
    completedAt: IsoDateTimeSchema.optional(),
    totalFrames: z.number().int().nonnegative().optional(),
    renderedFrames: z.number().int().nonnegative().optional(),
    outputFileName: z.string().min(1).max(255).optional(),
    outputSizeBytes: z.number().int().positive().optional(),
    error: RenderErrorSchema.optional(),
  })
  .superRefine((job, context) => {
    if (job.renderedFrames !== undefined && job.totalFrames !== undefined) {
      if (job.renderedFrames > job.totalFrames) {
        context.addIssue({
          code: 'custom',
          path: ['renderedFrames'],
          message: 'Rendered frame count cannot exceed total frame count.',
        });
      }
    }

    if (job.status === 'failed' && job.error === undefined) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'A failed render job requires a controlled error.',
      });
    }

    if (job.status !== 'failed' && job.error !== undefined) {
      context.addIssue({
        code: 'custom',
        path: ['error'],
        message: 'Only failed render jobs may store a render error.',
      });
    }

    if (job.status === 'succeeded') {
      if (job.progress !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['progress'],
          message: 'A successful render job must be complete.',
        });
      }

      if (
        job.startedAt === undefined
        || job.completedAt === undefined
        || job.outputFileName === undefined
        || job.outputSizeBytes === undefined
        || job.totalFrames === undefined
        || job.renderedFrames !== job.totalFrames
      ) {
        context.addIssue({
          code: 'custom',
          path: ['completedAt'],
          message: 'A successful render job requires complete timing, frame and output details.',
        });
      }
    }

    if (
      (job.status === 'rendering' || job.status === 'cancelling')
      && (job.startedAt === undefined || job.totalFrames === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['startedAt'],
        message: 'An active render job requires a start time and total frame count.',
      });
    }

    if (
      (job.status === 'cancelled' || job.status === 'failed')
      && (job.startedAt === undefined || job.completedAt === undefined)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'A terminal render job requires start and completion times.',
      });
    }

    if (job.startedAt && Date.parse(job.startedAt) < Date.parse(job.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['startedAt'],
        message: 'Render start cannot precede job creation.',
      });
    }
    if (job.completedAt && job.startedAt && Date.parse(job.completedAt) < Date.parse(job.startedAt)) {
      context.addIssue({
        code: 'custom',
        path: ['completedAt'],
        message: 'Render completion cannot precede its start.',
      });
    }
  });
export type RenderJob = z.infer<typeof RenderJobSchema>;

const findDuplicateId = (ids: readonly string[]): string | undefined => {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      return id;
    }
    seen.add(id);
  }

  return undefined;
};

const approximatelyEqual = (left: number, right: number): boolean =>
  Math.abs(left - right) <= TIMING_EPSILON;

export const VideoProjectSchema = z
  .strictObject({
    version: VideoProjectVersionSchema,
    id: StableIdSchema,
    name: z.string().trim().min(1).max(200),
    propertyAddress: OptionalDisplayTextSchema,
    videoTitle: OptionalDisplayTextSchema,
    subtitle: OptionalDisplayTextSchema,
    createdAt: IsoDateTimeSchema,
    updatedAt: IsoDateTimeSchema,
    mediaAssets: z.array(MediaAssetSchema).max(100),
    shots: z.array(VideoShotSchema).max(MAX_PROJECT_SHOTS),
    orderedShotIds: z.array(StableIdSchema).max(MAX_PROJECT_SHOTS),
    canvas: CanvasDimensionsSchema,
    fps: z.number().int().positive().max(120),
    overlays: z.array(OverlaySchema).max(100),
    audioTracks: z.array(AudioTrackSchema).max(2),
    endCard: EndCardSchema,
    outputVariant: OutputVariantSchema,
    outputProfile: OutputProfileSchema,
    renderStatus: RenderStatusSchema,
    renderJobs: z.array(RenderJobSchema).max(100),
    lastRenderJobId: StableIdSchema.optional(),
  })
  .superRefine((project, context) => {
    if (Date.parse(project.updatedAt) < Date.parse(project.createdAt)) {
      context.addIssue({
        code: 'custom',
        path: ['updatedAt'],
        message: 'Project update time cannot precede its creation time.',
      });
    }

    const duplicateAssetId = findDuplicateId(
      project.mediaAssets.map((asset) => asset.id),
    );
    if (duplicateAssetId) {
      context.addIssue({
        code: 'custom',
        path: ['mediaAssets'],
        message: `Duplicate media asset ID: ${duplicateAssetId}.`,
      });
    }

    const duplicateBlobKey = findDuplicateId(
      project.mediaAssets.map((asset) => asset.localBlobKey),
    );
    if (duplicateBlobKey) {
      context.addIssue({
        code: 'custom',
        path: ['mediaAssets'],
        message: `Duplicate local blob key: ${duplicateBlobKey}.`,
      });
    }

    const duplicateShotId = findDuplicateId(project.shots.map((shot) => shot.id));
    if (duplicateShotId) {
      context.addIssue({
        code: 'custom',
        path: ['shots'],
        message: `Duplicate shot ID: ${duplicateShotId}.`,
      });
    }

    const duplicateOrderedId = findDuplicateId(project.orderedShotIds);
    if (duplicateOrderedId) {
      context.addIssue({
        code: 'custom',
        path: ['orderedShotIds'],
        message: `Shot order contains duplicate ID: ${duplicateOrderedId}.`,
      });
    }

    const assetById = new Map(project.mediaAssets.map((asset) => [asset.id, asset]));
    const shotById = new Map(project.shots.map((shot) => [shot.id, shot]));

    if (
      project.orderedShotIds.length !== project.shots.length ||
      project.orderedShotIds.some((shotId) => !shotById.has(shotId))
    ) {
      context.addIssue({
        code: 'custom',
        path: ['orderedShotIds'],
        message: 'Shot order must contain every shot ID exactly once.',
      });
    }

    for (const [index, shot] of project.shots.entries()) {
      const sourceIds =
        shot.sourceMode === 'pair'
          ? [shot.startAssetId, shot.endAssetId]
          : [shot.startAssetId];
      let allSourcesExist = true;

      for (const sourceId of sourceIds) {
        const source = assetById.get(sourceId);
        if (!source || source.kind !== 'image') {
          allSourcesExist = false;
          context.addIssue({
            code: 'custom',
            path: ['shots', index, 'startAssetId'],
            message: `Shot source "${sourceId}" must reference an image asset.`,
          });
        }
      }

      if (allSourcesExist) {
        const cropChecks = shot.sourceMode === 'pair'
          ? [
              { crop: shot.startCrop, source: assetById.get(shot.startAssetId)!, path: 'startCrop' },
              { crop: shot.endCrop, source: assetById.get(shot.endAssetId)!, path: 'endCrop' },
            ]
          : [
              { crop: shot.startCrop, source: assetById.get(shot.startAssetId)!, path: 'startCrop' },
              { crop: shot.endCrop, source: assetById.get(shot.startAssetId)!, path: 'endCrop' },
            ];
        for (const check of cropChecks) {
          try {
            assertCropMatchesCanvasAspect(
              check.crop,
              { width: check.source.decodedWidth!, height: check.source.decodedHeight! },
              project.canvas,
            );
          } catch {
            context.addIssue({
              code: 'custom',
              path: ['shots', index, check.path],
              message: 'Shot crop pixel aspect must match the project canvas.',
            });
          }
        }

        const expectedContentHash = createShotContentHash(shot, project.mediaAssets);
        const expectedSettingsHash = createShotSettingsHash(shot);

        if (shot.contentHash !== expectedContentHash) {
          context.addIssue({
            code: 'custom',
            path: ['shots', index, 'contentHash'],
            message: 'Shot source content hash is stale or corrupt.',
          });
        }

        if (shot.settingsHash !== expectedSettingsHash) {
          context.addIssue({
            code: 'custom',
            path: ['shots', index, 'settingsHash'],
            message: 'Shot settings hash is stale or corrupt.',
          });
        }
      }
    }

    const orderedShots = project.orderedShotIds
      .map((shotId) => shotById.get(shotId))
      .filter((shot): shot is VideoShot => shot !== undefined);
    const shotsDurationSec = orderedShots.reduce(
      (sum, shot) => sum + shot.durationSec,
      0,
    );
    const totalDurationSec =
      shotsDurationSec + (project.endCard.enabled ? project.endCard.durationSec : 0);

    const duplicateOverlayId = findDuplicateId(
      project.overlays.map((overlay) => overlay.id),
    );
    if (duplicateOverlayId) {
      context.addIssue({
        code: 'custom',
        path: ['overlays'],
        message: `Duplicate overlay ID: ${duplicateOverlayId}.`,
      });
    }

    for (const [index, overlay] of project.overlays.entries()) {
      if (
        overlay.timing.startTimeSec + overlay.timing.durationSec >
        totalDurationSec + TIMING_EPSILON
      ) {
        context.addIssue({
          code: 'custom',
          path: ['overlays', index, 'timing'],
          message: 'Overlay timing exceeds the complete project duration.',
        });
      }

      if (overlay.assetId !== undefined) {
        const overlayAsset = assetById.get(overlay.assetId);
        if (!overlayAsset || overlayAsset.kind !== 'watermark') {
          context.addIssue({
            code: 'custom',
            path: ['overlays', index, 'assetId'],
            message: 'Overlay asset must reference a watermark media asset.',
          });
        }
      }
    }

    const duplicateAudioId = findDuplicateId(
      project.audioTracks.map((track) => track.id),
    );
    if (duplicateAudioId) {
      context.addIssue({
        code: 'custom',
        path: ['audioTracks'],
        message: `Duplicate audio track ID: ${duplicateAudioId}.`,
      });
    }

    const audioKinds = new Set<string>();
    for (const [index, track] of project.audioTracks.entries()) {
      const audioAsset = assetById.get(track.assetId);
      if (!audioAsset || audioAsset.kind !== 'audio') {
        context.addIssue({
          code: 'custom',
          path: ['audioTracks', index, 'assetId'],
          message: 'Audio track must reference an audio media asset.',
        });
      } else if (
        track.trimStartSec + track.durationSec >
          audioAsset.decodedDurationSec! + TIMING_EPSILON &&
        !track.loop
      ) {
        context.addIssue({
          code: 'custom',
          path: ['audioTracks', index, 'durationSec'],
          message: 'Non-looping audio placement exceeds the decoded source duration.',
        });
      }

      if (
        track.startTimeSec + track.durationSec >
        totalDurationSec + TIMING_EPSILON
      ) {
        context.addIssue({
          code: 'custom',
          path: ['audioTracks', index, 'durationSec'],
          message: 'Audio timing exceeds the complete project duration.',
        });
      }

      if (audioKinds.has(track.kind)) {
        context.addIssue({
          code: 'custom',
          path: ['audioTracks', index, 'kind'],
          message: `Only one ${track.kind} track is supported in this profile.`,
        });
      }
      audioKinds.add(track.kind);
    }

    if (project.endCard.logoAssetId !== undefined) {
      const logo = assetById.get(project.endCard.logoAssetId);
      if (!logo || logo.kind !== 'logo') {
        context.addIssue({
          code: 'custom',
          path: ['endCard', 'logoAssetId'],
          message: 'End-card logo must reference a logo media asset.',
        });
      }
    }

    if (
      project.canvas.width !== project.outputProfile.canvas.width ||
      project.canvas.height !== project.outputProfile.canvas.height
    ) {
      context.addIssue({
        code: 'custom',
        path: ['canvas'],
        message: 'Project canvas must match the selected output profile.',
      });
    }

    if (!approximatelyEqual(project.fps, project.outputProfile.fps)) {
      context.addIssue({
        code: 'custom',
        path: ['fps'],
        message: 'Project frame rate must match the selected output profile.',
      });
    }

    const duplicateRenderJobId = findDuplicateId(
      project.renderJobs.map((job) => job.id),
    );
    if (duplicateRenderJobId) {
      context.addIssue({
        code: 'custom',
        path: ['renderJobs'],
        message: `Duplicate render job ID: ${duplicateRenderJobId}.`,
      });
    }

    for (const [index, job] of project.renderJobs.entries()) {
      if (job.projectId !== project.id) {
        context.addIssue({
          code: 'custom',
          path: ['renderJobs', index, 'projectId'],
          message: 'Render job belongs to a different project.',
        });
      }
      if (job.outputProfileId !== project.outputProfile.id) {
        context.addIssue({
          code: 'custom',
          path: ['renderJobs', index, 'outputProfileId'],
          message: 'Render job references a different output profile.',
        });
      }
    }

    if (
      project.lastRenderJobId !== undefined &&
      !project.renderJobs.some((job) => job.id === project.lastRenderJobId)
    ) {
      context.addIssue({
        code: 'custom',
        path: ['lastRenderJobId'],
        message: 'Last render job ID does not exist in this project.',
      });
    }

    if (project.renderStatus !== 'idle') {
      const lastJob = project.renderJobs.find((job) => job.id === project.lastRenderJobId);
      if (!lastJob || lastJob.status !== project.renderStatus) {
        context.addIssue({
          code: 'custom',
          path: ['renderStatus'],
          message: 'Active project render status must match the referenced last render job.',
        });
      }
    }
  });
export type VideoProject = z.infer<typeof VideoProjectSchema>;
