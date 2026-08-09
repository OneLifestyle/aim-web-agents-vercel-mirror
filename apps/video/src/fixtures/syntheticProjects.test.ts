import { describe, expect, it } from 'vitest';
import { getCurrentVoiceActivityEnvelope } from '../audio/voiceActivity';
import {
  VideoProjectSchema,
  retimeShot,
  type MotionPreset,
} from '../project';
import {
  FIXTURE_MOTION_PRESETS,
  buildCanonicalRendererFixture,
  buildFifteenShotFixture,
  buildThirtyShotFixture,
  buildVoiceoverDuckingRendererFixture,
  type BuildSyntheticFixtureProjectOptions,
} from './syntheticProjects';

const PNG_SIGNATURE = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);
const WAV_SIGNATURE = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0, 0, 0,
  0x57, 0x41, 0x56, 0x45,
]);

const imageFile = (name: string, marker: number) => new File(
  [PNG_SIGNATURE, new Uint8Array([marker, marker ^ 0xff])],
  name,
  { type: 'image/png', lastModified: Date.UTC(2026, 7, 6) },
);

const fixtureOptions = (
  count: number,
  outputVariant: 'branded' | 'unbranded' = 'branded',
): BuildSyntheticFixtureProjectOptions => ({
  outputVariant,
  imageFiles: Array.from({ length: count }, (_, index) =>
    imageFile(`fixture-${index + 1}.png`, index + 1)),
  logoFile: imageFile('fixture-logo.png', 201),
  watermarkFile: imageFile('fixture-watermark.png', 202),
  musicFile: new File([WAV_SIGNATURE, new Uint8Array([1, 2, 3, 4])], 'fixture.wav', {
    type: 'audio/wav',
    lastModified: Date.UTC(2026, 7, 6),
  }),
  decodeImageDimensions: async () => ({ width: 2400, height: 1600 }),
  decodeAudioDuration: async () => 20,
});
const expectRequiredTreatments = (presets: readonly MotionPreset[]) => {
  expect(new Set(presets)).toEqual(new Set(FIXTURE_MOTION_PRESETS));
};

describe('deterministic synthetic verification projects', () => {
  it('builds the canonical six-shot renderer fixture with every treatment', async () => {
    const { project, blobs, intakeIssues } = await buildCanonicalRendererFixture(
      fixtureOptions(6),
    );
    expect(() => VideoProjectSchema.parse(project)).not.toThrow();
    expect(project.shots).toHaveLength(6);
    expect(project.orderedShotIds).toHaveLength(6);
    expect(project.canvas).toEqual({ width: 1920, height: 1080 });
    expect(project.fps).toBe(30);
    expect(project.outputProfile.id).toBe('client-alpha-1080p-v1');

    const singles = project.shots.filter((shot) => shot.sourceMode === 'single');
    const pairs = project.shots.filter((shot) => shot.sourceMode === 'pair');
    expectRequiredTreatments(singles.map((shot) => shot.motionPreset));
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({
      pairTreatment: 'dissolve',
      generationStatus: 'not-requested',
    });
    expect(project.overlays.map((overlay) => overlay.kind)).toEqual([
      'title',
      'subtitle',
      'watermark',
    ]);
    expect(project.audioTracks).toHaveLength(1);
    expect(project.audioTracks[0]).toMatchObject({
      kind: 'music',
      loop: true,
      duckUnderVoice: true,
      enabled: true,
    });
    expect(project.endCard).toMatchObject({
      enabled: true,
      agencyName: 'Singularealty',
    });
    expect(project.endCard.logoAssetId).toBeTruthy();
    expect(blobs.size).toBe(project.mediaAssets.length);
    expect(project.mediaAssets.every((asset) => blobs.has(asset.localBlobKey))).toBe(true);
    expect(project.mediaAssets.every((asset) => asset.rights.source.length > 0)).toBe(true);
    expect(intakeIssues).toContainEqual(expect.objectContaining({
      code: 'TOO_FEW_PHOTOS',
      severity: 'warning',
    }));
  });

  it.each([
    ['fifteen', 15, buildFifteenShotFixture],
    ['thirty', 30, buildThirtyShotFixture],
  ] as const)('builds the %s-shot limit fixture', async (_label, count, build) => {
    const { project, blobs } = await build(fixtureOptions(count));
    expect(VideoProjectSchema.parse(project)).toEqual(project);
    expect(project.shots).toHaveLength(count);
    expect(project.mediaAssets.filter((asset) => asset.kind === 'image')).toHaveLength(count);
    expect(project.shots.filter((shot) => shot.sourceMode === 'pair')).toHaveLength(1);
    expectRequiredTreatments(
      project.shots
        .filter((shot) => shot.sourceMode === 'single')
        .map((shot) => shot.motionPreset),
    );
    expect(blobs.size).toBe(count + 3);
  });

  it('builds an unbranded fixture without logo, watermark, or contact details', async () => {
    const { project } = await buildFifteenShotFixture(
      fixtureOptions(15, 'unbranded'),
    );
    expect(project.outputVariant).toBe('unbranded');
    expect(project.mediaAssets.some((asset) => asset.kind === 'logo')).toBe(false);
    expect(project.mediaAssets.some((asset) => asset.kind === 'watermark')).toBe(false);
    expect(project.overlays.some((overlay) => overlay.kind === 'watermark')).toBe(false);
    expect(project.endCard.logoAssetId).toBeUndefined();
    expect(project.endCard.agentName).toBeUndefined();
    expect(project.endCard.phone).toBeUndefined();
  });

  it('builds a branded voiceover fixture with a reusable two-region activity envelope', async () => {
    const { project, blobs } = await buildVoiceoverDuckingRendererFixture(fixtureOptions(6));
    expect(VideoProjectSchema.parse(project)).toEqual(project);
    expect(project.outputVariant).toBe('branded');
    expect(project.audioTracks.map((track) => track.kind).sort()).toEqual(['music', 'voiceover']);
    const envelope = getCurrentVoiceActivityEnvelope(project)!;
    expect(envelope.activeSegments).toHaveLength(2);
    expect(envelope.activeSegments[1]!.startTimeSec
      - envelope.activeSegments[0]!.endTimeSec).toBeGreaterThan(4.8);
    expect(blobs.size).toBe(project.mediaAssets.length);
  });

  it('repeats stable IDs and hashes and isolates a retime to one settings hash', async () => {
    const first = await buildFifteenShotFixture(fixtureOptions(15));
    const second = await buildFifteenShotFixture(fixtureOptions(15));
    expect(second.project.orderedShotIds).toEqual(first.project.orderedShotIds);
    expect(second.project.shots.map((shot) => shot.contentHash)).toEqual(
      first.project.shots.map((shot) => shot.contentHash),
    );
    expect(second.project.shots.map((shot) => shot.settingsHash)).toEqual(
      first.project.shots.map((shot) => shot.settingsHash),
    );

    const target = first.project.shots[0]!;
    const unchanged = first.project.shots[1]!;
    const retimed = retimeShot(first.project, target.id, target.durationSec + 0.5);
    const changedTarget = retimed.shots.find((shot) => shot.id === target.id)!;
    const unchangedAfter = retimed.shots.find((shot) => shot.id === unchanged.id)!;
    expect(changedTarget.id).toBe(target.id);
    expect(changedTarget.contentHash).toBe(target.contentHash);
    expect(changedTarget.settingsHash).not.toBe(target.settingsHash);
    expect(unchangedAfter).toEqual(unchanged);
  });
});
