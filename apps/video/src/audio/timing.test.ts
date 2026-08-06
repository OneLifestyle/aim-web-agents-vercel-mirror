import { describe, expect, it } from 'vitest';
import type { AudioTrack } from '../project/schemas';
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

describe('audio timing', () => {
  it('applies fades at the track boundaries', () => {
    const track = makeTrack();
    expect(audioGainAtTime(track, [track], 0)).toBe(0);
    expect(audioGainAtTime(track, [track], 0.5)).toBeCloseTo(0.4);
    expect(audioGainAtTime(track, [track], 5)).toBeCloseTo(0.8);
    expect(audioGainAtTime(track, [track], 9.5)).toBeCloseTo(0.4);
  });

  it('reduces music while voiceover is active', () => {
    const music = makeTrack();
    const voiceover = makeTrack({
      id: 'audio-track-2',
      kind: 'voiceover',
      startTimeSec: 3,
      durationSec: 2,
      volume: 1,
      fadeInSec: 0,
      fadeOutSec: 0,
      loop: false,
      duckUnderVoice: false,
    });
    expect(audioGainAtTime(music, [music, voiceover], 2)).toBeCloseTo(0.8);
    expect(audioGainAtTime(music, [music, voiceover], 4)).toBeCloseTo(0.224);
    expect(isAudioTrackActive(voiceover, 5)).toBe(false);

    const points = createGainEnvelopePoints(music, [music, voiceover], 10);
    expect(points.find((point) => point.timeSec === 3)?.gain).toBeCloseTo(0.224);
    expect(points.find((point) => point.timeSec === 3)?.discontinuity).toBe(true);
    expect(points.find((point) => point.timeSec === 5)?.gain).toBeCloseTo(0.8);
    expect(points.find((point) => point.timeSec === 5)?.discontinuity).toBe(true);
    expect(points.some((point) => point.timeSec < 3 && point.timeSec > 2.999)).toBe(true);
    expect(points.some((point) => point.timeSec < 5 && point.timeSec > 4.999)).toBe(true);
  });

  it('holds a zero-fade track to one sample before its exact stop', () => {
    const track = makeTrack({ fadeInSec: 0, fadeOutSec: 0 });
    const points = createGainEnvelopePoints(track, [track], 10);
    expect(points.at(-2)?.gain).toBeCloseTo(0.8);
    expect(points.at(-1)).toMatchObject({ timeSec: 10, gain: 0, discontinuity: true });
  });
});
