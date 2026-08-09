import { describe, expect, it, vi } from 'vitest';
import {
  addMediaAsset,
  addShot,
  createDefaultVideoProject,
  createSingleImageShot,
  VideoProjectSchema,
  type AudioTrack,
  type MediaAsset,
  type VideoProject,
  type VoiceActivityEnvelope,
} from '../project';
import { createSyntheticVoiceActivitySampleSource } from '../fixtures/syntheticMedia';
import {
  createDuckEnvelopePoints,
  createGainEnvelopePoints,
  createTrackGainEnvelopePoints,
  type GainEnvelopePoint,
} from './mixAudio';
import { audioGainAtTime } from './timing';
import {
  analyseVoiceActivity,
  buildAnalysisWindows,
  calculateRms,
  classifyActivityWindows,
  ensureProjectVoiceActivityEnvelope,
  estimateAdaptiveThresholds,
  getCurrentVoiceActivityEnvelope,
  musicDuckGainAtTime,
  postProcessActivitySegments,
  type VoiceActivityWindow,
} from './voiceActivity';

const NOW = '2026-08-09T00:00:00.000Z';
const sha = (character: string) => character.repeat(64);
const rights = {
  source: 'Synthetic local unit fixture',
  owner: 'Real Estate AIM test suite',
  licenceOrPermission: 'Self-created fixture',
  permittedUse: 'Automated local testing',
};

const imageAsset: MediaAsset = {
  id: 'image-1',
  kind: 'image',
  fileName: 'image.png',
  mimeType: 'image/png',
  fileSizeBytes: 1024,
  contentHash: sha('a'),
  decodedWidth: 1920,
  decodedHeight: 1080,
  localBlobKey: 'image-1',
  rights,
  createdAt: NOW,
};

const audioAsset = (id: string, hashCharacter: string): MediaAsset => ({
  id,
  kind: 'audio',
  fileName: `${id}.wav`,
  mimeType: 'audio/wav',
  fileSizeBytes: 2048,
  contentHash: sha(hashCharacter),
  decodedDurationSec: 5,
  localBlobKey: id,
  rights,
  createdAt: NOW,
});

const createProjectWithAudio = (
  requestedVoiceAsset = audioAsset('voice-1', 'b'),
  envelope?: VoiceActivityEnvelope,
) => {
  const durationSec = envelope?.sourceDurationSec ?? requestedVoiceAsset.decodedDurationSec ?? 5;
  const voiceAsset = { ...requestedVoiceAsset, decodedDurationSec: durationSec };
  let project = createDefaultVideoProject({ id: 'vad-project', name: 'VAD test', now: NOW });
  project = addMediaAsset(project, imageAsset, { updatedAt: NOW });
  project = addShot(project, createSingleImageShot({
    id: 'shot-1',
    startAssetId: imageAsset.id,
    durationSec,
  }, project.mediaAssets), 0, { updatedAt: NOW });
  project = addMediaAsset(project, voiceAsset, { updatedAt: NOW });
  const voiceTrack: AudioTrack = {
    id: 'voice-track',
    assetId: voiceAsset.id,
    kind: 'voiceover',
    startTimeSec: 0,
    durationSec,
    trimStartSec: 0,
    volume: 0.9,
    fadeInSec: 0,
    fadeOutSec: 0,
    loop: false,
    duckUnderVoice: false,
    enabled: true,
  };
  return VideoProjectSchema.parse({
    ...project,
    audioTracks: [voiceTrack],
    voiceActivityEnvelope: envelope,
  });
};

const analyseFixture = (name: Parameters<typeof createSyntheticVoiceActivitySampleSource>[0]) => {
  const source = createSyntheticVoiceActivitySampleSource(name, 4_000);
  return analyseVoiceActivity(source, 'voice-1', sha('b'));
};

describe('voice activity sample analysis', () => {
  it('constructs 30 ms windows and calculates RMS energy', () => {
    expect(calculateRms(new Float32Array([1, -1, 1, -1]))).toBe(1);
    expect(calculateRms(new Float32Array(0))).toBe(0);
    const source = createSyntheticVoiceActivitySampleSource('edge-silence', 1_000);
    const windows = buildAnalysisWindows(source);
    expect(windows).toHaveLength(Math.ceil(source.duration / 0.03));
    expect(windows[0]).toMatchObject({ startTimeSec: 0, endTimeSec: 0.03 });
    expect(windows.at(-1)?.endTimeSec).toBe(source.duration);
  });

  it('estimates an adaptive threshold above a low noise floor', () => {
    const windows = buildAnalysisWindows(createSyntheticVoiceActivitySampleSource('noise-floor', 4_000));
    const thresholds = estimateAdaptiveThresholds(windows);
    expect(thresholds.noiseFloorRms).toBeGreaterThan(0);
    expect(thresholds.speechContinueThresholdRms).toBeGreaterThan(thresholds.noiseFloorRms);
    expect(thresholds.speechStartThresholdRms).toBeGreaterThan(thresholds.speechContinueThresholdRms);
  });

  it('uses hysteresis instead of flapping at the start threshold', () => {
    const windows: VoiceActivityWindow[] = [0.03, 0.025, 0.015, 0.011, 0.009, 0.021].map((rms, index) => ({
      startTimeSec: index * 0.03,
      endTimeSec: (index + 1) * 0.03,
      rms,
    }));
    const classified = classifyActivityWindows(windows, {
      noiseFloorRms: 0.002,
      speechStartThresholdRms: 0.02,
      speechContinueThresholdRms: 0.01,
    });
    expect(classified.map((window) => window.active)).toEqual([true, true, true, true, false, true]);
  });

  it('joins a short speech gap and keeps it inside one active segment', () => {
    const envelope = analyseFixture('short-pause');
    expect(envelope.activeSegments).toHaveLength(1);
    expect(envelope.activeSegments[0]?.startTimeSec).toBeLessThanOrEqual(0.54);
    expect(envelope.activeSegments[0]?.endTimeSec).toBeGreaterThanOrEqual(2.97);
  });

  it('preserves a meaningful five-second silence between active regions', () => {
    const envelope = analyseFixture('long-silence');
    expect(envelope.activeSegments).toHaveLength(2);
    const gap = envelope.activeSegments[1]!.startTimeSec - envelope.activeSegments[0]!.endTimeSec;
    expect(gap).toBeGreaterThan(4.8);
  });

  it('preserves initial and ending silence', () => {
    const envelope = analyseFixture('edge-silence');
    expect(envelope.activeSegments).toHaveLength(1);
    expect(envelope.activeSegments[0]!.startTimeSec).toBeGreaterThanOrEqual(0.96);
    expect(envelope.activeSegments[0]!.endTimeSec).toBeLessThanOrEqual(4.05);
  });

  it('separates stronger activity from a low-level background', () => {
    const envelope = analyseFixture('noise-floor');
    expect(envelope.activeSegments).toHaveLength(1);
    expect(envelope.activeSegments[0]!.startTimeSec).toBeGreaterThanOrEqual(1.2);
    expect(envelope.activeSegments[0]!.endTimeSec).toBeLessThanOrEqual(3.81);
  });

  it('rejects a brief isolated spike', () => {
    expect(analyseFixture('isolated-spike').activeSegments).toEqual([]);
  });

  it('detects materially quieter speech resumed after meaningful silence', () => {
    const envelope = analyseFixture('quiet-resumption');
    expect(envelope.activeSegments).toHaveLength(2);
    expect(envelope.activeSegments[0]).toMatchObject({
      startTimeSec: expect.any(Number),
      endTimeSec: expect.any(Number),
    });
    expect(envelope.activeSegments[0]!.startTimeSec).toBeLessThanOrEqual(1.05);
    expect(envelope.activeSegments[0]!.endTimeSec).toBeGreaterThanOrEqual(19.95);
    expect(envelope.activeSegments[1]!.startTimeSec).toBeLessThanOrEqual(55.05);
    expect(envelope.activeSegments[1]!.endTimeSec).toBeGreaterThanOrEqual(59.45);
    expect(envelope.activeSegments[1]!.startTimeSec - envelope.activeSegments[0]!.endTimeSec)
      .toBeGreaterThan(34.8);
  });

  it('detects a clean voice envelope after strong global attenuation', () => {
    const source = createSyntheticVoiceActivitySampleSource('short-pause', 4_000);
    const samples = source.getChannelData(0);
    for (let index = 0; index < samples.length; index += 1) samples[index] = (samples[index] ?? 0) * 0.001;
    const envelope = analyseVoiceActivity(source, 'voice-1', sha('b'));
    expect(envelope.activeSegments).toHaveLength(1);
  });

  it('filters short activity before joining nearby segments', () => {
    const windows: VoiceActivityWindow[] = [
      { startTimeSec: 0, endTimeSec: 0.03, rms: 0.1, active: true },
      { startTimeSec: 0.03, endTimeSec: 0.06, rms: 0, active: false },
    ];
    expect(postProcessActivitySegments(windows, 0.15, 0.8)).toEqual([]);
  });
});

describe('speech-aware music envelope', () => {
  const scheduledValueAt = (points: readonly GainEnvelopePoint[], timeSec: number) => {
    const nextIndex = points.findIndex((point) => point.timeSec >= timeSec);
    if (nextIndex <= 0) return points[Math.max(0, nextIndex)]?.gain ?? 0;
    const next = points[nextIndex]!;
    const previous = points[nextIndex - 1]!;
    if (next.discontinuity || next.timeSec === previous.timeSec) return previous.gain;
    const progress = (timeSec - previous.timeSec) / (next.timeSec - previous.timeSec);
    return previous.gain + (next.gain - previous.gain) * progress;
  };

  const makeMusicProject = (duckUnderVoice = true): { project: VideoProject; music: AudioTrack } => {
    const envelope = analyseFixture('long-silence');
    const withVoice = createProjectWithAudio(audioAsset('voice-1', 'b'), envelope);
    const musicAsset = audioAsset('music-1', 'c');
    const music: AudioTrack = {
      id: 'music-track',
      assetId: musicAsset.id,
      kind: 'music',
      startTimeSec: 0,
      durationSec: 5,
      trimStartSec: 0,
      volume: 0.8,
      fadeInSec: 0,
      fadeOutSec: 0,
      loop: true,
      duckUnderVoice,
      enabled: true,
    };
    return {
      music,
      project: VideoProjectSchema.parse({
        ...withVoice,
        mediaAssets: [...withVoice.mediaAssets, musicAsset],
        audioTracks: [music, ...withVoice.audioTracks],
      }),
    };
  };

  it('applies smooth attack and release around detected activity', () => {
    const { project } = makeMusicProject();
    const first = getCurrentVoiceActivityEnvelope(project)!.activeSegments[0]!;
    expect(musicDuckGainAtTime(project, first.startTimeSec - 0.18)).toBeCloseTo(1);
    expect(musicDuckGainAtTime(project, first.startTimeSec - 0.09)).toBeCloseTo(0.64, 2);
    expect(musicDuckGainAtTime(project, first.startTimeSec)).toBeCloseTo(0.28);
    expect(musicDuckGainAtTime(project, first.endTimeSec)).toBeCloseTo(0.28);
    expect(musicDuckGainAtTime(project, first.endTimeSec + 0.325)).toBeCloseTo(0.64, 2);
    expect(musicDuckGainAtTime(project, first.endTimeSec + 0.65)).toBeCloseTo(1);
  });

  it('uses the same gain evaluator for preview samples and export schedule knots', () => {
    const { project, music } = makeMusicProject();
    const points = createGainEnvelopePoints(music, project);
    for (const point of points) {
      expect(point.gain).toBeCloseTo(audioGainAtTime(music, project, point.timeSec), 8);
    }
    expect(audioGainAtTime(music, project, 1.5)).toBeLessThan(0.3);
    expect(audioGainAtTime(music, project, 4.5)).toBeCloseTo(0.8);
  });

  it('keeps preview/export gain exact when music fade and duck ramps overlap', () => {
    const { project, music } = makeMusicProject();
    const fadedMusic = { ...music, fadeInSec: 1.5 };
    const fadedProject = VideoProjectSchema.parse({
      ...project,
      audioTracks: project.audioTracks.map((track) => track.kind === 'music' ? fadedMusic : track),
    });
    const envelope = getCurrentVoiceActivityEnvelope(fadedProject)!;
    const sampleTimeSec = envelope.activeSegments[0]!.startTimeSec - envelope.attackDurationSec / 2;
    const trackPoints = createTrackGainEnvelopePoints(fadedMusic, 5);
    const duckPoints = createDuckEnvelopePoints(fadedMusic, fadedProject, 5);
    const exportedGain = scheduledValueAt(trackPoints, sampleTimeSec)
      * scheduledValueAt(duckPoints, sampleTimeSec);
    expect(exportedGain).toBeCloseTo(audioGainAtTime(fadedMusic, fadedProject, sampleTimeSec), 8);
  });

  it('schedules the exact cusp when release and the next attack overlap', () => {
    const { project, music } = makeMusicProject();
    const envelope = getCurrentVoiceActivityEnvelope(project)!;
    const closeSegments = {
      ...envelope,
      activeSegments: [
        { startTimeSec: 0.5, endTimeSec: 1.5 },
        { startTimeSec: 2.31, endTimeSec: 3 },
      ],
    };
    const closeProject = VideoProjectSchema.parse({
      ...project,
      voiceActivityEnvelope: closeSegments,
    });
    const attackStart = closeSegments.activeSegments[1]!.startTimeSec
      - closeSegments.attackDurationSec;
    const intersection = (
      1
      + closeSegments.activeSegments[0]!.endTimeSec / closeSegments.releaseDurationSec
      + attackStart / closeSegments.attackDurationSec
    ) / (
      1 / closeSegments.releaseDurationSec
      + 1 / closeSegments.attackDurationSec
    );
    const points = createDuckEnvelopePoints(music, closeProject, 5);
    expect(points.some((point) => Math.abs(point.timeSec - intersection) < 1e-9)).toBe(true);
    expect(scheduledValueAt(points, intersection)).toBeCloseTo(
      musicDuckGainAtTime(closeProject, intersection),
      8,
    );
  });

  it('does not duck without a voiceover or when ducking is disabled', () => {
    const withoutVoice = createDefaultVideoProject({ id: 'none', name: 'None', now: NOW });
    expect(musicDuckGainAtTime(withoutVoice, 1)).toBe(1);
    const { project, music } = makeMusicProject(false);
    expect(audioGainAtTime(music, project, 1.5)).toBeCloseTo(0.8);
  });
});

describe('voice activity lifecycle', () => {
  it('reuses matching analysis across a JSON save/reopen round trip', async () => {
    const envelope = analyseFixture('edge-silence');
    const project = createProjectWithAudio(audioAsset('voice-1', 'b'), envelope);
    const reopened = VideoProjectSchema.parse(JSON.parse(JSON.stringify(project)));
    const analyser = vi.fn();
    const result = await ensureProjectVoiceActivityEnvelope(reopened, { getBlob: () => new Blob(['unused']) }, analyser);
    expect(result.analysisPerformed).toBe(false);
    expect(analyser).not.toHaveBeenCalled();
    expect(result.project.voiceActivityEnvelope).toEqual(envelope);
  });

  it('invalidates and recalculates analysis when voiceover identity changes', async () => {
    const oldEnvelope = analyseFixture('edge-silence');
    const oldProject = createProjectWithAudio(audioAsset('voice-1', 'b'), oldEnvelope);
    const replacement = audioAsset('voice-2', 'd');
    const replaced = VideoProjectSchema.parse({
      ...oldProject,
      mediaAssets: oldProject.mediaAssets.map((asset) => asset.id === 'voice-1' ? replacement : asset),
      audioTracks: oldProject.audioTracks.map((track) => track.kind === 'voiceover'
        ? { ...track, assetId: replacement.id }
        : track),
    });
    const analyser = vi.fn(async (_blob: Blob, assetId: string, hash: string) =>
      analyseVoiceActivity(createSyntheticVoiceActivitySampleSource('edge-silence', 4_000), assetId, hash));
    const result = await ensureProjectVoiceActivityEnvelope(
      replaced,
      { getBlob: (assetId) => assetId === replacement.id ? new Blob(['replacement']) : null },
      analyser,
    );
    expect(result.analysisPerformed).toBe(true);
    expect(analyser).toHaveBeenCalledOnce();
    expect(result.project.voiceActivityEnvelope).toMatchObject({
      sourceAssetId: replacement.id,
      sourceContentHash: replacement.contentHash,
    });
  });

  it('recalculates an envelope from the prior v1 derived-analysis cache', async () => {
    const currentEnvelope = analyseFixture('edge-silence');
    const current = createProjectWithAudio(audioAsset('voice-1', 'b'), currentEnvelope);
    const legacy = VideoProjectSchema.parse({
      ...current,
      voiceActivityEnvelope: {
        analysisVersion: 'energy-rms-v1',
        obsoleteSegments: [[1, 4]],
      },
    });
    const analyser = vi.fn(async (_blob: Blob, assetId: string, hash: string) =>
      analyseVoiceActivity(createSyntheticVoiceActivitySampleSource('edge-silence', 4_000), assetId, hash));
    const result = await ensureProjectVoiceActivityEnvelope(
      legacy,
      { getBlob: () => new Blob(['voice']) },
      analyser,
    );
    expect(result.analysisPerformed).toBe(true);
    expect(analyser).toHaveBeenCalledOnce();
    expect(getCurrentVoiceActivityEnvelope(result.project)?.analysisVersion).toBe('energy-rms-v2');
  });

  it('reuses voice analysis when music source, volume, or ducking setting changes', async () => {
    const envelope = analyseFixture('edge-silence');
    const withVoice = createProjectWithAudio(audioAsset('voice-1', 'b'), envelope);
    const music = audioAsset('music-2', 'f');
    const changedMusic = VideoProjectSchema.parse({
      ...withVoice,
      mediaAssets: [...withVoice.mediaAssets, music],
      audioTracks: [
        ...withVoice.audioTracks,
        {
          id: 'music-track',
          assetId: music.id,
          kind: 'music',
          startTimeSec: 0,
          durationSec: 5,
          trimStartSec: 0,
          volume: 0.47,
          fadeInSec: 0,
          fadeOutSec: 0,
          loop: true,
          duckUnderVoice: false,
          enabled: true,
        },
      ],
    });
    const analyser = vi.fn();
    const result = await ensureProjectVoiceActivityEnvelope(
      changedMusic,
      { getBlob: () => new Blob(['unused']) },
      analyser,
    );
    expect(result.analysisPerformed).toBe(false);
    expect(analyser).not.toHaveBeenCalled();
    expect(result.project.voiceActivityEnvelope).toEqual(envelope);
  });

  it('removes stale derived analysis when no voiceover remains', async () => {
    const envelope = analyseFixture('edge-silence');
    const withVoice = createProjectWithAudio(audioAsset('voice-1', 'b'), envelope);
    const withoutVoice = VideoProjectSchema.parse({
      ...withVoice,
      audioTracks: [],
      mediaAssets: withVoice.mediaAssets.filter((asset) => asset.id !== 'voice-1'),
    });
    const result = await ensureProjectVoiceActivityEnvelope(withoutVoice, { getBlob: () => null });
    expect(result.analysisPerformed).toBe(false);
    expect(result.project.voiceActivityEnvelope).toBeUndefined();
  });
});
