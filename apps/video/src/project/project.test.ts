import { describe, expect, it } from 'vitest';
import {
  CLIENT_ALPHA_1080P_PROFILE,
  MediaAssetSchema,
  NormalizedCropRectSchema,
  RenderJobSchema,
  UnsupportedVideoProjectVersionError,
  VideoProjectSchema,
  addMediaAsset,
  addShot,
  createDefaultVideoProject,
  createImagePairShot,
  createOutputFileName,
  createShotContentHash,
  createShotSettingsHash,
  createSingleImageShot,
  estimateOutputFileSizeRange,
  getActiveAudioTracksAtTime,
  getActiveOverlaysAtTime,
  getProjectDurationSec,
  getProjectFrameCount,
  getTimelineSegmentAtTime,
  getTimelineSegments,
  migrateVideoProject,
  moveShot,
  removeShot,
  reorderShots,
  replaceMediaAsset,
  replaceShotAsset,
  retimeShot,
  setShotMotionPreset,
  setShotSourceMode,
  stableHash,
  stableSerialize,
  type MediaAsset,
  type VideoProject,
} from './index';

const NOW = '2026-08-06T00:00:00.000Z';
const LATER = '2026-08-06T00:01:00.000Z';

const rights = {
  source: 'Synthetic test fixture',
  owner: 'Real Estate AIM test suite',
  licenceOrPermission: 'Self-created fixture',
  permittedUse: 'Automated local testing',
};

const sha = (character: string): string => character.repeat(64);

const imageAsset = (
  id: string,
  digestCharacter: string,
  kind: 'image' | 'logo' | 'watermark' = 'image',
): MediaAsset => ({
  id,
  kind,
  fileName: `${id}.png`,
  mimeType: 'image/png',
  fileSizeBytes: 2048,
  contentHash: sha(digestCharacter),
  decodedWidth: 2400,
  decodedHeight: 1600,
  localBlobKey: `local/${id}`,
  rights,
  createdAt: NOW,
});

const audioAsset = (id = 'audio-1'): MediaAsset => ({
  id,
  kind: 'audio',
  fileName: `${id}.wav`,
  mimeType: 'audio/wav',
  fileSizeBytes: 4096,
  contentHash: sha('e'),
  decodedDurationSec: 30,
  localBlobKey: `local/${id}`,
  rights,
  createdAt: NOW,
});

const createFixtureProject = (): VideoProject => {
  let project = createDefaultVideoProject({
    id: 'project-1',
    name: '12 Test Street',
    propertyAddress: '12 Test Street, Melbourne VIC',
    now: NOW,
  });

  const assets = [
    imageAsset('image-1', 'a'),
    imageAsset('image-2', 'b'),
    imageAsset('image-3', 'c'),
    imageAsset('image-4', 'd'),
  ];
  for (const asset of assets) {
    project = addMediaAsset(project, asset);
  }

  project = addShot(
    project,
    createSingleImageShot(
      {
        id: 'shot-1',
        startAssetId: 'image-1',
        motionPreset: 'zoom-in',
        durationSec: 4,
      },
      project.mediaAssets,
    ),
  );
  project = addShot(
    project,
    createSingleImageShot(
      {
        id: 'shot-2',
        startAssetId: 'image-2',
        motionPreset: 'pan-left',
        durationSec: 5,
      },
      project.mediaAssets,
    ),
  );
  project = addShot(
    project,
    createImagePairShot(
      {
        id: 'shot-3',
        startAssetId: 'image-3',
        endAssetId: 'image-4',
        durationSec: 6,
      },
      project.mediaAssets,
    ),
  );

  return project;
};

describe('renderer-neutral runtime contract', () => {
  it('creates a strict versioned local project with the alpha profile', () => {
    const project = createDefaultVideoProject({
      id: 'project-empty',
      name: 'New property video',
      now: NOW,
    });

    expect(project.version).toBe('1.0.0');
    expect(project.mediaAssets).toEqual([]);
    expect(project.orderedShotIds).toEqual([]);
    expect(project.outputProfile.id).toBe('client-alpha-1080p-v1');
    expect(project.outputProfile.canvas).toEqual({ width: 1920, height: 1080 });
    expect(project.fps).toBe(30);
    expect(() => VideoProjectSchema.parse({ ...project, unexpected: true })).toThrow();
  });

  it('rejects invalid visual/audio metadata, zero bytes, and invalid crop bounds', () => {
    expect(() =>
      MediaAssetSchema.parse({
        ...imageAsset('bad-image', 'f'),
        fileSizeBytes: 0,
      }),
    ).toThrow();
    expect(() =>
      MediaAssetSchema.parse({
        ...imageAsset('bad-image', 'f'),
        decodedWidth: undefined,
      }),
    ).toThrow(/decoded width/i);
    expect(() =>
      MediaAssetSchema.parse({
        ...audioAsset(),
        decodedDurationSec: undefined,
      }),
    ).toThrow(/decoded duration/i);
    expect(() =>
      NormalizedCropRectSchema.parse({ x: 0.8, y: 0, width: 0.4, height: 1 }),
    ).toThrow(/exceeds/i);
  });

  it('rejects duplicate pair sources, missing references, stale hashes, and bad ordering', () => {
    const project = createFixtureProject();
    expect(() =>
      createImagePairShot(
        {
          id: 'pair-bad',
          startAssetId: 'image-1',
          endAssetId: 'image-1',
        },
        project.mediaAssets,
      ),
    ).toThrow(/different source assets/i);

    expect(() =>
      VideoProjectSchema.parse({
        ...project,
        orderedShotIds: ['shot-1', 'shot-2'],
      }),
    ).toThrow(/every shot ID/i);

    expect(() =>
      VideoProjectSchema.parse({
        ...project,
        shots: project.shots.map((shot) =>
          shot.id === 'shot-1' ? { ...shot, contentHash: stableHash('wrong') } : shot,
        ),
      }),
    ).toThrow(/stale or corrupt/i);

    expect(() =>
      createSingleImageShot(
        { id: 'missing-source', startAssetId: 'not-there' },
        project.mediaAssets,
      ),
    ).toThrow(/does not exist/i);
  });

  it('creates source-aware 16:9 crops and rejects aspect-invalid custom crops', () => {
    const assets = [imageAsset('crop-source', 'a')];
    const shot = createSingleImageShot(
      { id: 'crop-shot', startAssetId: 'crop-source', motionPreset: 'zoom-in' },
      assets,
    );

    expect(shot.startCrop).toEqual({ x: 0, y: 0.078125, width: 1, height: 0.84375 });
    expect(shot.endCrop.width).toBeLessThan(shot.startCrop.width);
    expect(() => createSingleImageShot({
      id: 'bad-crop-shot',
      startAssetId: 'crop-source',
      startCrop: { x: 0, y: 0, width: 1, height: 1 },
    }, assets)).toThrow(/pixel aspect/i);
  });

  it('rejects altered alpha profiles and duplicate local blob keys', () => {
    const project = createFixtureProject();
    const invalidProfiles = [
      { ...project.outputProfile, id: 'other-profile' },
      { ...project.outputProfile, canvas: { width: 1280, height: 720 } },
      { ...project.outputProfile, fps: 24 },
      { ...project.outputProfile, targetVideoBitrateMbps: 8 },
      { ...project.outputProfile, safeAreas: { ...project.outputProfile.safeAreas, title: { top: 0.1, right: 0.05, bottom: 0.05, left: 0.05 } } },
    ];
    for (const outputProfile of invalidProfiles) {
      expect(() => VideoProjectSchema.parse({ ...project, outputProfile })).toThrow();
    }

    expect(() => VideoProjectSchema.parse({
      ...project,
      mediaAssets: project.mediaAssets.map((asset, index) => ({
        ...asset,
        localBlobKey: index < 2 ? 'duplicate/blob' : asset.localBlobKey,
      })),
    })).toThrow(/duplicate local blob key/i);
  });

  it('enforces controlled render-job state and timestamp transitions', () => {
    const project = createDefaultVideoProject({ id: 'render-project', name: 'Render', now: NOW });
    const baseJob = {
      id: 'render-job',
      projectId: project.id,
      outputVariant: project.outputVariant,
      outputProfileId: project.outputProfile.id,
      createdAt: NOW,
    } as const;

    expect(() => RenderJobSchema.parse({
      ...baseJob,
      status: 'succeeded',
      progress: 1,
    })).toThrow(/complete timing/i);
    expect(() => RenderJobSchema.parse({
      ...baseJob,
      status: 'rendering',
      progress: 0.5,
    })).toThrow(/start time/i);
    expect(() => RenderJobSchema.parse({
      ...baseJob,
      status: 'failed',
      progress: 0.5,
      startedAt: LATER,
      completedAt: NOW,
      error: {
        code: 'encode-failed',
        message: 'Synthetic failure',
        retriable: true,
        occurredAt: LATER,
      },
    })).toThrow(/cannot precede/i);

    const succeeded = RenderJobSchema.parse({
      ...baseJob,
      status: 'succeeded',
      progress: 1,
      startedAt: NOW,
      completedAt: LATER,
      totalFrames: 30,
      renderedFrames: 30,
      outputFileName: 'render.mp4',
      outputSizeBytes: 1024,
    });
    expect(() => VideoProjectSchema.parse({
      ...project,
      renderStatus: 'failed',
      renderJobs: [succeeded],
      lastRenderJobId: succeeded.id,
    })).toThrow(/must match/i);
  });

  it('rejects unknown versions at the migration boundary', () => {
    const project = createDefaultVideoProject({
      id: 'version-test',
      name: 'Version test',
      now: NOW,
    });

    expect(migrateVideoProject(project)).toEqual(project);
    expect(() => migrateVideoProject({ ...project, version: '2.0.0' })).toThrow(
      UnsupportedVideoProjectVersionError,
    );
    expect(() => migrateVideoProject({ ...project, version: '0.9.0' })).toThrow(
      /supports 1.0.0/i,
    );
    expect(() => migrateVideoProject({ ...project, version: undefined })).toThrow();
  });
});

describe('stable hashes and output profile', () => {
  it('canonicalizes key order and labels its synchronous hash as non-cryptographic', () => {
    expect(stableSerialize({ b: 2, a: [1, true] })).toBe(
      '{"a":[1,true],"b":2}',
    );
    expect(stableHash({ b: 2, a: 1 })).toBe(stableHash({ a: 1, b: 2 }));
    expect(stableHash({ a: 1 })).toMatch(/^fnv1a64:[a-f0-9]{16}$/);
    expect(() => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      stableSerialize(circular);
    }).toThrow(/circular/i);
  });

  it('separates shot content identity from editable settings identity', () => {
    const project = createFixtureProject();
    const shot = project.shots[0]!;
    const retimed = { ...shot, durationSec: 8 };

    expect(createShotContentHash(retimed, project.mediaAssets)).toBe(shot.contentHash);
    expect(createShotSettingsHash(retimed)).not.toBe(shot.settingsHash);
  });

  it('defines the exact technical alpha profile and deterministic filename', () => {
    expect(CLIENT_ALPHA_1080P_PROFILE).toMatchObject({
      container: 'mp4',
      canvas: { width: 1920, height: 1080 },
      aspectRatio: '16:9',
      fps: 30,
      videoCodec: 'h264-avc',
      audioCodec: 'aac-lc',
      pixelFormat: 'yuv420p',
    });
    expect(createOutputFileName('  12 Élan Street!  ', 'branded')).toBe(
      '12-elan-street-branded-client-alpha-1080p-v1.mp4',
    );
    expect(estimateOutputFileSizeRange(60)).toEqual({
      minBytes: 15_000_000,
      maxBytes: 60_000_000,
    });
  });
});

describe('timeline helpers', () => {
  it('creates contiguous shot/end-card segments with exact boundary behavior', () => {
    const base = createFixtureProject();
    const project = VideoProjectSchema.parse({
      ...base,
      endCard: {
        ...base.endCard,
        enabled: true,
        durationSec: 3,
        title: 'Presented by Test Agency',
      },
    });

    expect(getProjectDurationSec(project)).toBe(18);
    expect(getProjectFrameCount(project)).toBe(540);
    expect(getTimelineSegments(project).map((segment) => segment.kind)).toEqual([
      'shot',
      'shot',
      'shot',
      'end-card',
    ]);
    expect(getTimelineSegmentAtTime(project, 3.999)?.segmentId).toBe('shot-1');
    expect(getTimelineSegmentAtTime(project, 4)?.segmentId).toBe('shot-2');
    expect(getTimelineSegmentAtTime(project, 15)?.kind).toBe('end-card');
    expect(getTimelineSegmentAtTime(project, 18)).toBeUndefined();
    expect(() => getTimelineSegmentAtTime(project, -1)).toThrow(RangeError);
  });

  it('selects overlays and enabled audio using the same half-open timing rule', () => {
    let project = createFixtureProject();
    project = addMediaAsset(project, audioAsset());
    project = VideoProjectSchema.parse({
      ...project,
      overlays: [
        {
          id: 'overlay-title',
          kind: 'title',
          timing: { startTimeSec: 0, durationSec: 2 },
          text: '12 Test Street',
        },
      ],
      audioTracks: [
        {
          id: 'music-1',
          assetId: 'audio-1',
          kind: 'music',
          startTimeSec: 0,
          durationSec: 15,
          trimStartSec: 0,
          volume: 0.35,
          fadeInSec: 1,
          fadeOutSec: 1,
          loop: false,
          duckUnderVoice: true,
          enabled: true,
        },
      ],
    });

    expect(getActiveOverlaysAtTime(project, 1)).toHaveLength(1);
    expect(getActiveOverlaysAtTime(project, 2)).toHaveLength(0);
    expect(getActiveAudioTracksAtTime(project, 14.99)).toHaveLength(1);
    expect(getActiveAudioTracksAtTime(project, 15)).toHaveLength(0);
  });
});

describe('immutable storyboard mutations', () => {
  it('reorders and moves shots without changing shot IDs or settings', () => {
    const original = createFixtureProject();
    const originalShots = structuredClone(original.shots);
    const reordered = reorderShots(
      original,
      ['shot-3', 'shot-1', 'shot-2'],
      { updatedAt: LATER },
    );

    expect(original.orderedShotIds).toEqual(['shot-1', 'shot-2', 'shot-3']);
    expect(reordered.orderedShotIds).toEqual(['shot-3', 'shot-1', 'shot-2']);
    expect(reordered.shots).toEqual(originalShots);
    expect(reordered.updatedAt).toBe(LATER);
    expect(moveShot(reordered, 'shot-1', 'down').orderedShotIds).toEqual([
      'shot-3',
      'shot-2',
      'shot-1',
    ]);
    expect(() => reorderShots(original, ['shot-1', 'shot-1', 'shot-3'])).toThrow(
      /exact permutation/i,
    );
  });

  it('adds and removes a shot without reconfiguring unaffected shots', () => {
    const original = createFixtureProject();
    const addedShot = createSingleImageShot(
      { id: 'shot-4', startAssetId: 'image-4', motionPreset: 'zoom-out' },
      original.mediaAssets,
    );
    const added = addShot(original, addedShot, 1);
    const removed = removeShot(added, 'shot-4');

    expect(added.orderedShotIds).toEqual(['shot-1', 'shot-4', 'shot-2', 'shot-3']);
    expect(removed.orderedShotIds).toEqual(original.orderedShotIds);
    expect(removed.shots).toEqual(original.shots);
  });

  it('reconciles full-duration overlays and audio after remove and retime', () => {
    let configured = createFixtureProject();
    configured = addMediaAsset(configured, audioAsset());
    configured = addMediaAsset(configured, imageAsset('watermark-1', 'f', 'watermark'));
    configured = VideoProjectSchema.parse({
      ...configured,
      overlays: [{
        id: 'watermark-overlay',
        kind: 'watermark',
        assetId: 'watermark-1',
        opacity: 0.5,
        timing: { startTimeSec: 0, durationSec: 15 },
      }],
      audioTracks: [{
        id: 'music-track',
        assetId: 'audio-1',
        kind: 'music',
        startTimeSec: 0,
        durationSec: 15,
        trimStartSec: 0,
        volume: 0.4,
        fadeInSec: 1,
        fadeOutSec: 1,
        loop: true,
        duckUnderVoice: true,
        enabled: true,
      }],
    });

    const removed = removeShot(configured, 'shot-3', { updatedAt: LATER });
    expect(getProjectDurationSec(removed)).toBe(9);
    expect(removed.overlays[0]?.timing.durationSec).toBe(9);
    expect(removed.audioTracks[0]?.durationSec).toBe(9);

    const retimed = retimeShot(configured, 'shot-3', 1, { updatedAt: LATER });
    expect(getProjectDurationSec(retimed)).toBe(10);
    expect(retimed.overlays[0]?.timing.durationSec).toBe(10);
    expect(retimed.audioTracks[0]?.durationSec).toBe(10);
  });

  it('replaces one shot source while preserving its stable ID and all settings', () => {
    const original = createFixtureProject();
    const before = original.shots.find((shot) => shot.id === 'shot-1')!;
    const unaffectedBefore = original.shots.find((shot) => shot.id === 'shot-2')!;
    const replaced = replaceShotAsset(original, 'shot-1', 'start', 'image-4');
    const after = replaced.shots.find((shot) => shot.id === 'shot-1')!;

    expect(after.id).toBe(before.id);
    expect(after.startAssetId).toBe('image-4');
    expect(after.durationSec).toBe(before.durationSec);
    expect(after.motionPreset).toBe(before.motionPreset);
    expect(after.settingsHash).toBe(before.settingsHash);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(replaced.shots.find((shot) => shot.id === 'shot-2')).toEqual(
      unaffectedBefore,
    );
    expect(original.shots.find((shot) => shot.id === 'shot-1')).toEqual(before);
  });

  it('replaces bytes behind one stable asset without touching shot settings', () => {
    const original = createFixtureProject();
    const before = original.shots.find((shot) => shot.id === 'shot-2')!;
    const replacement = {
      ...original.mediaAssets.find((asset) => asset.id === 'image-2')!,
      fileSizeBytes: 8192,
      contentHash: sha('f'),
      localBlobKey: 'local/image-2-replacement',
    };
    const replaced = replaceMediaAsset(original, 'image-2', replacement);
    const after = replaced.shots.find((shot) => shot.id === 'shot-2')!;

    expect(after.id).toBe(before.id);
    expect(after.startAssetId).toBe(before.startAssetId);
    expect(after.settingsHash).toBe(before.settingsHash);
    expect(after.contentHash).not.toBe(before.contentHash);
    expect(replaced.shots.find((shot) => shot.id === 'shot-1')).toEqual(
      original.shots.find((shot) => shot.id === 'shot-1'),
    );
  });

  it('retimes only the selected shot and changes only its settings hash', () => {
    const original = createFixtureProject();
    const before = original.shots.find((shot) => shot.id === 'shot-2')!;
    const retimed = retimeShot(original, 'shot-2', 7.5);
    const after = retimed.shots.find((shot) => shot.id === 'shot-2')!;

    expect(after.id).toBe(before.id);
    expect(after.durationSec).toBe(7.5);
    expect(after.contentHash).toBe(before.contentHash);
    expect(after.settingsHash).not.toBe(before.settingsHash);
    expect(retimed.shots.find((shot) => shot.id === 'shot-1')).toEqual(
      original.shots.find((shot) => shot.id === 'shot-1'),
    );
    expect(() => retimeShot(original, 'shot-2', 0.49)).toThrow(RangeError);
    expect(() => retimeShot(original, 'shot-2', 20.01)).toThrow(RangeError);
  });

  it('changes treatment and source mode without changing shot identity', () => {
    const original = createFixtureProject();
    const treated = setShotMotionPreset(original, 'shot-1', 'pan-right');
    const treatedShot = treated.shots.find((shot) => shot.id === 'shot-1')!;
    expect(treatedShot.id).toBe('shot-1');
    expect(treatedShot.motionPreset).toBe('pan-right');

    const paired = setShotSourceMode(treated, 'shot-1', {
      sourceMode: 'pair',
      endAssetId: 'image-3',
    });
    const pairShot = paired.shots.find((shot) => shot.id === 'shot-1')!;
    expect(pairShot).toMatchObject({
      id: 'shot-1',
      sourceMode: 'pair',
      startAssetId: 'image-1',
      endAssetId: 'image-3',
      pairTreatment: 'dissolve',
      generationStatus: 'not-requested',
    });

    const single = setShotSourceMode(paired, 'shot-1', {
      sourceMode: 'single',
      motionPreset: 'still',
    });
    expect(single.shots.find((shot) => shot.id === 'shot-1')).toMatchObject({
      id: 'shot-1',
      sourceMode: 'single',
      motionPreset: 'still',
      durationSec: 4,
    });
  });
});
