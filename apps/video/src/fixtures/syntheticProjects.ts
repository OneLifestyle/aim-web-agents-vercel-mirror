import {
  addMediaAsset,
  addShot,
  createDefaultVideoProject,
  createImagePairShot,
  createSingleImageShot,
  getProjectDurationSec,
  retimeShot,
  VideoProjectSchema,
  type MediaAsset,
  type MotionPreset,
  type OutputVariant,
  type VideoProject,
} from '../project';
import {
  createAudioMediaAsset,
  createImageMediaAsset,
  SELF_CREATED_FIXTURE_RIGHTS,
} from '../media/assets';
import {
  decodeImageDimensions,
  validateAudioFile,
  validateImageBatch,
  type DecodedImageDimensions,
  type MediaIntakeIssue,
} from '../media/intake';
import { createCoverCrop, createMotionPresetCrops } from '../motion';
import { analyseVoiceActivity } from '../audio/voiceActivity';
import {
  createSelfCreatedMusicFile,
  createSelfCreatedVoiceoverFile,
  createSyntheticVoiceActivitySampleSource,
  SYNTHETIC_VOICE_ACTIVITY_DURATIONS,
  createSyntheticPropertyImage,
} from './syntheticMedia';

export const FIXTURE_TIMESTAMP = '2026-08-06T00:00:00.000Z';

export const FIXTURE_MOTION_PRESETS: readonly MotionPreset[] = Object.freeze([
  'still',
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
]);

const DEFAULT_MUSIC_DURATION_SEC = 20;
const DEFAULT_END_CARD_DURATION_SEC = 2.5;

const SOURCE_DIMENSIONS: readonly DecodedImageDimensions[] = Object.freeze([
  { width: 1920, height: 1280 },
  { width: 1080, height: 1440 },
  { width: 1920, height: 1080 },
  { width: 1600, height: 1200 },
]);

const LOGO_DIMENSIONS = Object.freeze({ width: 512, height: 512 });
const WATERMARK_DIMENSIONS = Object.freeze({ width: 720, height: 240 });

export interface SyntheticFixtureProjectBundle {
  project: VideoProject;
  /** Local media blobs keyed by each MediaAsset.localBlobKey. */
  blobs: Map<string, Blob>;
  /** Non-blocking intake warnings retained as fixture evidence. */
  intakeIssues: MediaIntakeIssue[];
}

export interface BuildSyntheticFixtureProjectOptions {
  outputVariant?: OutputVariant;
  includeLogo?: boolean;
  includeWatermark?: boolean;
  shotDurationSec?: number;
  endCardDurationSec?: number;
  imageFiles?: readonly File[];
  musicFile?: File;
  musicDurationSec?: number;
  logoFile?: File;
  watermarkFile?: File;
  decodeImageDimensions?: (blob: Blob) => Promise<DecodedImageDimensions>;
  decodeAudioDuration?: (blob: Blob) => Promise<number>;
}

export class SyntheticFixtureBuildError extends Error {
  readonly issues: readonly MediaIntakeIssue[];

  constructor(message: string, issues: readonly MediaIntakeIssue[]) {
    super(message);
    this.name = 'SyntheticFixtureBuildError';
    this.issues = issues;
  }
}

interface GeneratedImageFiles {
  files: File[];
  dimensions: WeakMap<Blob, DecodedImageDimensions>;
}

const pad = (value: number) => String(value).padStart(2, '0');

const createGeneratedImageFiles = async (
  count: number,
): Promise<GeneratedImageFiles> => {
  const files: File[] = [];
  const dimensions = new WeakMap<Blob, DecodedImageDimensions>();

  // Sequential creation keeps the 30-shot fixture's transient canvas memory
  // bounded while still producing real, locally generated PNG sources.
  for (let index = 0; index < count; index += 1) {
    const sourceDimensions = SOURCE_DIMENSIONS[index % SOURCE_DIMENSIONS.length]!;
    const blob = await createSyntheticPropertyImage(
      index,
      sourceDimensions.width,
      sourceDimensions.height,
    );
    const file = new File(
      [blob],
      `synthetic-property-${pad(index + 1)}.png`,
      { type: 'image/png', lastModified: Date.UTC(2026, 7, 6) },
    );
    files.push(file);
    dimensions.set(file, sourceDimensions);
  }

  return { files, dimensions };
};

const createGeneratedBrandFile = async (
  kind: 'logo' | 'watermark',
): Promise<{ file: File; dimensions: DecodedImageDimensions }> => {
  const dimensions = kind === 'logo' ? LOGO_DIMENSIONS : WATERMARK_DIMENSIONS;
  const index = kind === 'logo' ? 100 : 101;
  const blob = await createSyntheticPropertyImage(
    index,
    dimensions.width,
    dimensions.height,
  );
  return {
    file: new File([blob], `synthetic-${kind}.png`, {
      type: 'image/png',
      lastModified: Date.UTC(2026, 7, 6),
    }),
    dimensions,
  };
};

const collectBlockingIssues = (issues: readonly MediaIntakeIssue[]) =>
  issues.filter((candidate) => candidate.severity === 'error');

const assertNoBlockingIssues = (
  label: string,
  issues: readonly MediaIntakeIssue[],
) => {
  const blockingIssues = collectBlockingIssues(issues);
  if (blockingIssues.length > 0) {
    throw new SyntheticFixtureBuildError(
      `${label} failed deterministic media intake.`,
      blockingIssues,
    );
  }
};

const withFixtureTimestamp = (asset: MediaAsset): MediaAsset => ({
  ...asset,
  createdAt: FIXTURE_TIMESTAMP,
});

const addAssetAndBlob = (
  project: VideoProject,
  asset: MediaAsset,
  blob: Blob,
  blobs: Map<string, Blob>,
): VideoProject => {
  blobs.set(asset.localBlobKey, blob);
  return addMediaAsset(project, asset, { updatedAt: FIXTURE_TIMESTAMP });
};

const defaultShotDuration = (shotCount: number) =>
  shotCount === 6 ? 1.5 : 1;

export const buildSyntheticVerificationProject = async (
  shotCount: 6 | 15 | 30,
  options: BuildSyntheticFixtureProjectOptions = {},
): Promise<SyntheticFixtureProjectBundle> => {
  const outputVariant = options.outputVariant ?? 'branded';
  const includeLogo = outputVariant === 'branded' && (options.includeLogo ?? true);
  const includeWatermark = outputVariant === 'branded'
    && (options.includeWatermark ?? true);
  const fixturePrefix = `fixture-${shotCount}-${outputVariant}`;
  const shotDurationSec = options.shotDurationSec ?? defaultShotDuration(shotCount);
  const endCardDurationSec = options.endCardDurationSec
    ?? DEFAULT_END_CARD_DURATION_SEC;
  const blobs = new Map<string, Blob>();
  const intakeIssues: MediaIntakeIssue[] = [];

  const generatedImages = options.imageFiles
    ? undefined
    : await createGeneratedImageFiles(shotCount);
  const imageFiles = options.imageFiles ?? generatedImages!.files;
  if (imageFiles.length !== shotCount) {
    throw new RangeError(
      `The ${shotCount}-shot fixture requires exactly ${shotCount} source image files.`,
    );
  }

  const decodeSourceDimensions = options.decodeImageDimensions
    ?? (async (blob: Blob) => {
      const known = generatedImages?.dimensions.get(blob);
      return known ?? decodeImageDimensions(blob);
    });
  const imageIntake = await validateImageBatch(imageFiles, {
    mode: 'bulk',
    decodeDimensions: decodeSourceDimensions,
  });
  intakeIssues.push(...imageIntake.issues);
  assertNoBlockingIssues('Synthetic property photographs', imageIntake.issues);
  if (imageIntake.accepted.length !== shotCount) {
    throw new SyntheticFixtureBuildError(
      `Only ${imageIntake.accepted.length} of ${shotCount} synthetic photographs were accepted.`,
      imageIntake.issues,
    );
  }

  let project = createDefaultVideoProject({
    id: `${fixturePrefix}-project`,
    name: `${shotCount}-shot synthetic property`,
    propertyAddress: '12 Verification Avenue, Melbourne VIC',
    videoTitle: 'A deterministic place to call home',
    subtitle: '12 Verification Avenue, Melbourne VIC',
    outputVariant,
    now: FIXTURE_TIMESTAMP,
  });

  for (const [index, accepted] of imageIntake.accepted.entries()) {
    const id = `${fixturePrefix}-image-${pad(index + 1)}`;
    const asset = withFixtureTimestamp(createImageMediaAsset(
      accepted,
      'image',
      SELF_CREATED_FIXTURE_RIGHTS,
      id,
    ));
    project = addAssetAndBlob(project, asset, accepted.file, blobs);
  }

  for (let index = 0; index < shotCount - 1; index += 1) {
    const source = project.mediaAssets[index]!;
    const motionPreset = FIXTURE_MOTION_PRESETS[
      index % FIXTURE_MOTION_PRESETS.length
    ]!;
    const crops = createMotionPresetCrops(
      motionPreset,
      { width: source.decodedWidth!, height: source.decodedHeight! },
      project.canvas,
    );
    const shot = createSingleImageShot(
      {
        id: `${fixturePrefix}-shot-${pad(index + 1)}`,
        startAssetId: source.id,
        motionPreset,
        durationSec: shotDurationSec,
        startCrop: crops.start,
        endCrop: crops.end,
        easing: motionPreset === 'still' ? 'linear' : 'ease-in-out',
      },
      project.mediaAssets,
    );
    project = addShot(project, shot, project.orderedShotIds.length, {
      updatedAt: FIXTURE_TIMESTAMP,
    });
  }

  const pairStartAsset = project.mediaAssets[shotCount - 2]!;
  const pairEndAsset = project.mediaAssets[shotCount - 1]!;
  const pairShot = createImagePairShot(
    {
      id: `${fixturePrefix}-shot-${pad(shotCount)}`,
      startAssetId: pairStartAsset.id,
      endAssetId: pairEndAsset.id,
      durationSec: shotDurationSec,
      startCrop: createCoverCrop(
        {
          width: pairStartAsset.decodedWidth!,
          height: pairStartAsset.decodedHeight!,
        },
        project.canvas,
      ),
      endCrop: createCoverCrop(
        {
          width: pairEndAsset.decodedWidth!,
          height: pairEndAsset.decodedHeight!,
        },
        project.canvas,
      ),
      easing: 'linear',
    },
    project.mediaAssets,
  );
  project = addShot(project, pairShot, project.orderedShotIds.length, {
    updatedAt: FIXTURE_TIMESTAMP,
  });

  let logoAssetId: string | undefined;
  if (includeLogo) {
    const generatedLogo = options.logoFile
      ? undefined
      : await createGeneratedBrandFile('logo');
    const logoFile = options.logoFile ?? generatedLogo!.file;
    const logoIntake = await validateImageBatch([logoFile], {
      mode: 'branding',
      decodeDimensions: options.decodeImageDimensions
        ?? (async (blob) => (
          blob === generatedLogo?.file
            ? generatedLogo.dimensions
            : decodeImageDimensions(blob)
        )),
    });
    intakeIssues.push(...logoIntake.issues);
    assertNoBlockingIssues('Synthetic logo', logoIntake.issues);
    const acceptedLogo = logoIntake.accepted[0];
    if (!acceptedLogo) {
      throw new SyntheticFixtureBuildError('Synthetic logo was not accepted.', logoIntake.issues);
    }
    logoAssetId = `${fixturePrefix}-logo`;
    const logoAsset = withFixtureTimestamp(createImageMediaAsset(
      acceptedLogo,
      'logo',
      SELF_CREATED_FIXTURE_RIGHTS,
      logoAssetId,
    ));
    project = addAssetAndBlob(project, logoAsset, acceptedLogo.file, blobs);
  }

  let watermarkAssetId: string | undefined;
  if (includeWatermark) {
    const generatedWatermark = options.watermarkFile
      ? undefined
      : await createGeneratedBrandFile('watermark');
    const watermarkFile = options.watermarkFile ?? generatedWatermark!.file;
    const watermarkIntake = await validateImageBatch([watermarkFile], {
      mode: 'branding',
      decodeDimensions: options.decodeImageDimensions
        ?? (async (blob) => (
          blob === generatedWatermark?.file
            ? generatedWatermark.dimensions
            : decodeImageDimensions(blob)
        )),
    });
    intakeIssues.push(...watermarkIntake.issues);
    assertNoBlockingIssues('Synthetic watermark', watermarkIntake.issues);
    const acceptedWatermark = watermarkIntake.accepted[0];
    if (!acceptedWatermark) {
      throw new SyntheticFixtureBuildError(
        'Synthetic watermark was not accepted.',
        watermarkIntake.issues,
      );
    }
    watermarkAssetId = `${fixturePrefix}-watermark`;
    const watermarkAsset = withFixtureTimestamp(createImageMediaAsset(
      acceptedWatermark,
      'watermark',
      SELF_CREATED_FIXTURE_RIGHTS,
      watermarkAssetId,
    ));
    project = addAssetAndBlob(
      project,
      watermarkAsset,
      acceptedWatermark.file,
      blobs,
    );
  }

  const musicDurationSec = options.musicDurationSec ?? DEFAULT_MUSIC_DURATION_SEC;
  const musicFile = options.musicFile
    ?? createSelfCreatedMusicFile(musicDurationSec);
  const musicIntake = await validateAudioFile(musicFile, {
    decodeDuration: options.decodeAudioDuration
      ?? (async () => musicDurationSec),
  });
  intakeIssues.push(...musicIntake.issues);
  assertNoBlockingIssues('Self-created fixture music', musicIntake.issues);
  if (!musicIntake.accepted) {
    throw new SyntheticFixtureBuildError(
      'Self-created fixture music was not accepted.',
      musicIntake.issues,
    );
  }
  const musicAssetId = `${fixturePrefix}-music`;
  const musicAsset = withFixtureTimestamp(createAudioMediaAsset(
    musicIntake.accepted,
    SELF_CREATED_FIXTURE_RIGHTS,
    musicAssetId,
  ));
  project = addAssetAndBlob(project, musicAsset, musicIntake.accepted.file, blobs);

  const endCard = outputVariant === 'branded'
    ? {
        enabled: true,
        durationSec: endCardDurationSec,
        title: 'Presented by Real Estate AIM',
        subtitle: 'Synthetic renderer verification',
        agentName: 'AIM Video Operator',
        agencyName: 'Singularealty',
        phone: '+61 3 9000 0000',
        email: 'verification@example.invalid',
        logoAssetId,
        backgroundColor: '#14324a',
        textColor: '#ffffff',
      }
    : {
        enabled: true,
        durationSec: endCardDurationSec,
        title: 'Thank you for viewing',
        subtitle: '12 Verification Avenue, Melbourne VIC',
        backgroundColor: '#14324a',
        textColor: '#ffffff',
      };
  const totalDurationSec = project.shots.reduce(
    (sum, shot) => sum + shot.durationSec,
    endCardDurationSec,
  );
  const titleDurationSec = Math.min(3.5, totalDurationSec);

  project = VideoProjectSchema.parse({
    ...project,
    updatedAt: FIXTURE_TIMESTAMP,
    endCard,
    overlays: [
      {
        id: `${fixturePrefix}-title-overlay`,
        kind: 'title',
        timing: { startTimeSec: 0, durationSec: titleDurationSec },
        text: 'A deterministic place to call home',
      },
      {
        id: `${fixturePrefix}-address-overlay`,
        kind: 'subtitle',
        timing: { startTimeSec: 0, durationSec: titleDurationSec },
        text: '12 Verification Avenue, Melbourne VIC',
      },
      ...(watermarkAssetId
        ? [{
            id: `${fixturePrefix}-watermark-overlay`,
            kind: 'watermark' as const,
            timing: { startTimeSec: 0, durationSec: totalDurationSec },
            assetId: watermarkAssetId,
            opacity: 0.18,
          }]
        : []),
    ],
    audioTracks: [
      {
        id: `${fixturePrefix}-music-track`,
        assetId: musicAssetId,
        kind: 'music',
        startTimeSec: 0,
        durationSec: totalDurationSec,
        trimStartSec: 0,
        volume: 0.32,
        fadeInSec: Math.min(1.5, totalDurationSec / 4),
        fadeOutSec: Math.min(1.5, totalDurationSec / 4),
        loop: true,
        duckUnderVoice: true,
        enabled: true,
      },
    ],
  });

  if (getProjectDurationSec(project) !== totalDurationSec) {
    throw new Error('Synthetic fixture duration did not match its validated timeline.');
  }

  return { project, blobs, intakeIssues };
};

export const buildCanonicalRendererFixture = (
  options?: BuildSyntheticFixtureProjectOptions,
) => buildSyntheticVerificationProject(6, options);

/** Branded real-render fixture for speech → long silence → speech evidence. */
export const buildVoiceoverDuckingRendererFixture = async (
  options: BuildSyntheticFixtureProjectOptions = {},
): Promise<SyntheticFixtureProjectBundle> => {
  const bundle = await buildSyntheticVerificationProject(6, {
    ...options,
    outputVariant: 'branded',
  });
  const voiceoverFile = createSelfCreatedVoiceoverFile('long-silence');
  const voiceoverDurationSec = SYNTHETIC_VOICE_ACTIVITY_DURATIONS['long-silence'];
  const intake = await validateAudioFile(voiceoverFile, {
    decodeDuration: async () => voiceoverDurationSec,
  });
  assertNoBlockingIssues('Self-created fixture voiceover', intake.issues);
  if (!intake.accepted) {
    throw new SyntheticFixtureBuildError('Self-created fixture voiceover was not accepted.', intake.issues);
  }
  const voiceoverAssetId = 'fixture-6-branded-voiceover';
  const voiceoverAsset = withFixtureTimestamp(createAudioMediaAsset(
    intake.accepted,
    SELF_CREATED_FIXTURE_RIGHTS,
    voiceoverAssetId,
  ));
  const projectWithAsset = addAssetAndBlob(
    bundle.project,
    voiceoverAsset,
    voiceoverFile,
    bundle.blobs,
  );
  const envelope = analyseVoiceActivity(
    createSyntheticVoiceActivitySampleSource('long-silence'),
    voiceoverAsset.id,
    voiceoverAsset.contentHash,
  );
  const project = VideoProjectSchema.parse({
    ...projectWithAsset,
    voiceActivityEnvelope: envelope,
    audioTracks: [
      ...projectWithAsset.audioTracks,
      {
        id: 'fixture-6-branded-voiceover-track',
        assetId: voiceoverAsset.id,
        kind: 'voiceover',
        startTimeSec: 0,
        durationSec: voiceoverDurationSec,
        trimStartSec: 0,
        volume: 0.9,
        fadeInSec: 0.25,
        fadeOutSec: 0.25,
        loop: false,
        duckUnderVoice: false,
        enabled: true,
      },
    ],
  });
  return {
    project,
    blobs: bundle.blobs,
    intakeIssues: [...bundle.intakeIssues, ...intake.issues],
  };
};

/** 68-second founder-equivalent fixture with a 60-second quieter resumption. */
export const buildFounderAudioRepairFixture = async (): Promise<SyntheticFixtureProjectBundle> => {
  const musicDurationSec = 75;
  const bundle = await buildSyntheticVerificationProject(15, {
    outputVariant: 'branded',
    shotDurationSec: 4.4,
    endCardDurationSec: 2,
    musicDurationSec,
    musicFile: createSelfCreatedMusicFile(musicDurationSec),
  });
  let retimedProject = bundle.project;
  for (const [index, shotId] of retimedProject.orderedShotIds.entries()) {
    retimedProject = retimeShot(
      retimedProject,
      shotId,
      index === 0 ? 10 : 4,
      { updatedAt: FIXTURE_TIMESTAMP },
    );
  }
  const voiceoverFile = createSelfCreatedVoiceoverFile('quiet-resumption');
  const voiceoverDurationSec = SYNTHETIC_VOICE_ACTIVITY_DURATIONS['quiet-resumption'];
  const intake = await validateAudioFile(voiceoverFile, {
    decodeDuration: async () => voiceoverDurationSec,
  });
  assertNoBlockingIssues('Self-created quiet-resumption voiceover', intake.issues);
  if (!intake.accepted) {
    throw new SyntheticFixtureBuildError(
      'Self-created quiet-resumption voiceover was not accepted.',
      intake.issues,
    );
  }
  const voiceoverAssetId = 'founder-audio-repair-voiceover';
  const voiceoverAsset = withFixtureTimestamp(createAudioMediaAsset(
    intake.accepted,
    SELF_CREATED_FIXTURE_RIGHTS,
    voiceoverAssetId,
  ));
  const projectWithAsset = addAssetAndBlob(
    retimedProject,
    voiceoverAsset,
    voiceoverFile,
    bundle.blobs,
  );
  const envelope = analyseVoiceActivity(
    createSyntheticVoiceActivitySampleSource('quiet-resumption'),
    voiceoverAsset.id,
    voiceoverAsset.contentHash,
  );
  const project = VideoProjectSchema.parse({
    ...projectWithAsset,
    id: 'founder-audio-repair-project',
    name: 'Founder-equivalent audio repair fixture',
    voiceActivityEnvelope: envelope,
    audioTracks: [
      ...projectWithAsset.audioTracks,
      {
        id: 'founder-audio-repair-voiceover-track',
        assetId: voiceoverAsset.id,
        kind: 'voiceover',
        startTimeSec: 0,
        durationSec: voiceoverDurationSec,
        trimStartSec: 0,
        volume: 0.9,
        fadeInSec: 0,
        fadeOutSec: 0,
        loop: false,
        duckUnderVoice: false,
        enabled: true,
      },
    ],
  });
  if (getProjectDurationSec(project) !== 68) {
    throw new Error('Founder-equivalent audio fixture must be exactly 68 seconds.');
  }
  return {
    project,
    blobs: bundle.blobs,
    intakeIssues: [...bundle.intakeIssues, ...intake.issues],
  };
};

export const buildFifteenShotFixture = (
  options?: BuildSyntheticFixtureProjectOptions,
) => buildSyntheticVerificationProject(15, options);

export const buildThirtyShotFixture = (
  options?: BuildSyntheticFixtureProjectOptions,
) => buildSyntheticVerificationProject(30, options);
