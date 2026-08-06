import type { AudioTrack } from '../project/schemas';

export const isAudioTrackActive = (track: AudioTrack, timeSec: number) => (
  track.enabled
  && timeSec >= track.startTimeSec
  && timeSec < track.startTimeSec + track.durationSec
);

const fadeGain = (track: AudioTrack, timeSec: number) => {
  const relative = timeSec - track.startTimeSec;
  if (relative < 0 || relative >= track.durationSec) return 0;
  const fadeIn = track.fadeInSec > 0 ? Math.min(1, relative / track.fadeInSec) : 1;
  const remaining = track.durationSec - relative;
  const fadeOut = track.fadeOutSec > 0 ? Math.min(1, remaining / track.fadeOutSec) : 1;
  return Math.max(0, Math.min(fadeIn, fadeOut));
};
export const audioGainAtTime = (
  track: AudioTrack,
  allTracks: readonly AudioTrack[],
  timeSec: number,
) => {
  if (!isAudioTrackActive(track, timeSec)) return 0;
  const voiceoverActive = allTracks.some((candidate) => (
    candidate.kind === 'voiceover' && isAudioTrackActive(candidate, timeSec)
  ));
  const duck = track.kind === 'music' && track.duckUnderVoice && voiceoverActive ? 0.28 : 1;
  return Math.max(0, Math.min(1, track.volume * fadeGain(track, timeSec) * duck));
};
