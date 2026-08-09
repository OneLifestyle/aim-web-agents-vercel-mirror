import { describe, expect, it } from 'vitest';
import type { AudioTrack, VideoProject } from '../project/schemas';
import { createGainEnvelopePoints } from './mixAudio';
import { resolveAudioPlacement } from './placement';
import { audioGainAtTime } from './timing';

const music: AudioTrack = {
  id: 'music-track',
  assetId: 'music-asset',
  kind: 'music',
  startTimeSec: 0,
  durationSec: 63,
  trimStartSec: 0,
  volume: 0.8,
  fadeInSec: 1.5,
  fadeOutSec: 1.5,
  loop: true,
  duckUnderVoice: true,
  enabled: true,
};

const voiceover: AudioTrack = {
  id: 'voice-track',
  assetId: 'voice-asset',
  kind: 'voiceover',
  startTimeSec: 0,
  durationSec: 55,
  trimStartSec: 0,
  volume: 0.9,
  fadeInSec: 0,
  fadeOutSec: 0,
  loop: false,
  duckUnderVoice: false,
  enabled: true,
};

const projectAt = (durationSec: number): VideoProject => ({
  orderedShotIds: ['shot'],
  shots: [{ id: 'shot', durationSec }],
  endCard: { enabled: false, durationSec: 0 },
  mediaAssets: [
    { id: 'music-asset', decodedDurationSec: 90 },
    { id: 'voice-asset', decodedDurationSec: 60 },
  ],
  audioTracks: [music, voiceover],
} as VideoProject);

describe('canonical project-relative audio placement', () => {
  it('moves music and its fade with 63 → 68 → 61 second retiming', () => {
    const initial = resolveAudioPlacement(projectAt(63), music);
    expect(initial.usedDurationSec).toBe(63);
    expect(initial.endTimeSec).toBe(63);

    const extendedProject = projectAt(68);
    const extended = resolveAudioPlacement(extendedProject, music);
    expect(extended.sourceDurationSec).toBe(90);
    expect(extended.usedDurationSec).toBe(68);
    expect(extended.endTimeSec).toBe(68);
    expect(audioGainAtTime(music, extendedProject, 67.25)).toBeCloseTo(0.4);
    const extendedSchedule = createGainEnvelopePoints(music, extendedProject);
    expect(extendedSchedule).toContainEqual(expect.objectContaining({
      timeSec: 66.5,
      gain: 0.8,
    }));
    expect(extendedSchedule.at(-1)).toMatchObject({ timeSec: 68, gain: 0 });

    const shortenedProject = projectAt(61);
    const shortened = resolveAudioPlacement(shortenedProject, music);
    expect(shortened.usedDurationSec).toBe(61);
    expect(createGainEnvelopePoints(music, shortenedProject).at(-1))
      .toMatchObject({ timeSec: 61, gain: 0 });
  });

  it('keeps voiceover bounded by its 60-second source after project extension', () => {
    const clipped = resolveAudioPlacement(projectAt(50), voiceover);
    expect(clipped.usedDurationSec).toBe(50);
    const placement = resolveAudioPlacement(projectAt(68), voiceover);
    expect(placement.sourceDurationSec).toBe(60);
    expect(placement.usedDurationSec).toBe(60);
    expect(placement.endTimeSec).toBe(60);
  });

  it('loops a short music source without stretching it', () => {
    const shortSourceProject = {
      ...projectAt(68),
      mediaAssets: [
        { id: 'music-asset', decodedDurationSec: 20 },
        { id: 'voice-asset', decodedDurationSec: 60 },
      ],
    } as VideoProject;
    const placement = resolveAudioPlacement(shortSourceProject, {
      ...music,
      startTimeSec: 4,
      trimStartSec: 3,
      loop: false,
    });
    expect(placement.track.startTimeSec).toBe(0);
    expect(placement.track.trimStartSec).toBe(0);
    expect(placement.track.loop).toBe(true);
    expect(placement.sourceDurationSec).toBe(20);
    expect(placement.usedDurationSec).toBe(68);
  });
});
