import { describe, expect, it } from 'vitest';
import type { AudioTrack, VideoProject, VoiceActivityEnvelope } from '../project/schemas';
import { createGainEnvelopePoints } from './mixAudio';
import { audioGainAtTime, isAudioTrackActive } from './timing';

const makeTrack = (overrides: Partial<AudioTrack> = {}): AudioTrack => ({
  id: 'audio-track-1',
  assetId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  kind: 'music',
  startTimeSec: 0,
  durationSec: 10,
  trimStartSec: 0,
  volume: 0.8,
  fadeInSec: 1,
  fadeOutSec: 1,
  loop: true,
  duckUnderVoice: true,
  enabled: true,
  ...overrides,
});

const voiceEnvelope: VoiceActivityEnvelope = {
  analysisVersion: 'energy-rms-v2',
  sourceAssetId: 'voice-asset',
  sourceContentHash: 'b'.repeat(64),
  sourceDurationSec: 10,
  analysisWindowDurationSec: 0.03,
  noiseFloorRms: 0.001,
  speechStartThresholdRms: 0.02,
  speechContinueThresholdRms: 0.01,
  attackDurationSec: 0.18,
  releaseDurationSec: 0.65,
  minimumActiveHoldSec: 0.15,
  minimumSilenceForRecoverySec: 0.8,
  activeMusicGain: 0.28,
  activeSegments: [{ startTimeSec: 0, endTimeSec: 2 }],
};

const makeProject = (tracks: AudioTrack[], envelope?: VoiceActivityEnvelope): VideoProject => ({
  audioTracks: tracks,
  voiceActivityEnvelope: envelope,
  mediaAssets: [{
    id: 'voice-asset',
    kind: 'audio',
    contentHash: 'b'.repeat(64),
    decodedDurationSec: 10,
  }],
  orderedShotIds: ['shot-1'],
  shots: [{ id: 'shot-1', durationSec: 10 }],
  endCard: { enabled: false, durationSec: 0 },
} as VideoProject);

describe('audio timing', () => {
  it('applies fades at the track boundaries', () => {
    const track = makeTrack();
    const project = makeProject([track]);
    expect(audioGainAtTime(track, project, 0)).toBe(0);
    expect(audioGainAtTime(track, project, 0.5)).toBeCloseTo(0.4);
    expect(audioGainAtTime(track, project, 5)).toBeCloseTo(0.8);
    expect(audioGainAtTime(track, project, 9.5)).toBeCloseTo(0.4);
  });

  it('reduces music while voiceover is active', () => {
    const music = makeTrack();
    const voiceover = makeTrack({
      id: 'audio-track-2',
      assetId: 'voice-asset',
      kind: 'voiceover',
      startTimeSec: 3,
      durationSec: 2,
      volume: 1,
      fadeInSec: 0,
      fadeOutSec: 0,
      loop: false,
      duckUnderVoice: false,
    });
    const project = makeProject([music, voiceover], voiceEnvelope);
    expect(audioGainAtTime(music, project, 2)).toBeCloseTo(0.8);
    expect(audioGainAtTime(music, project, 4)).toBeCloseTo(0.224);
    expect(isAudioTrackActive(voiceover, 5)).toBe(false);

    const points = createGainEnvelopePoints(music, project, 10);
    expect(points.find((point) => point.timeSec === 3)?.gain).toBeCloseTo(0.224);
    expect(points.find((point) => point.timeSec === 3)?.discontinuity).toBe(false);
    expect(points.find((point) => point.timeSec === 5)?.gain).toBeCloseTo(0.224);
    expect(points.find((point) => point.timeSec === 5.65)?.gain).toBeCloseTo(0.8);
    expect(points.find((point) => point.timeSec === 2.82)?.gain).toBeCloseTo(0.8);
  });

  it('holds a zero-fade track to one sample before its exact stop', () => {
    const track = makeTrack({ fadeInSec: 0, fadeOutSec: 0 });
    const points = createGainEnvelopePoints(track, makeProject([track]), 10);
    expect(points.at(-2)?.gain).toBeCloseTo(0.8);
    expect(points.at(-1)).toMatchObject({ timeSec: 10, gain: 0, discontinuity: true });
  });

  it('does not trust a stale persisted music endpoint after the project extends', () => {
    const music = makeTrack({
      durationSec: 63,
      fadeInSec: 1.5,
      fadeOutSec: 1.5,
    });
    const project = {
      ...makeProject([music]),
      mediaAssets: [{
        id: music.assetId,
        kind: 'audio',
        contentHash: 'c'.repeat(64),
        decodedDurationSec: 90,
      }],
      shots: [{ id: 'shot-1', durationSec: 68 }],
    } as VideoProject;

    expect(audioGainAtTime(music, project, 64)).toBeCloseTo(0.8);
    expect(audioGainAtTime(music, project, 67.25)).toBeCloseTo(0.4);
    expect(audioGainAtTime(music, project, 68)).toBe(0);
  });
});
