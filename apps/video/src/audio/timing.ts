import type { AudioTrack, VideoProject } from '../project/schemas';
import { resolveAudioPlacement } from './placement';
import { musicDuckGainAtTime } from './voiceActivity';

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

export const audioTrackGainAtTime = (track: AudioTrack, timeSec: number) => {
  if (!isAudioTrackActive(track, timeSec)) return 0;
  return Math.max(0, Math.min(1, track.volume * fadeGain(track, timeSec)));
};

export const audioGainAtTime = (
  track: AudioTrack,
  project: VideoProject,
  timeSec: number,
) => {
  const resolvedTrack = resolveAudioPlacement(project, track).track;
  if (!isAudioTrackActive(resolvedTrack, timeSec)) return 0;
  const duck = resolvedTrack.kind === 'music' && resolvedTrack.duckUnderVoice
    ? musicDuckGainAtTime(project, timeSec)
    : 1;
  return Math.max(0, Math.min(1, audioTrackGainAtTime(resolvedTrack, timeSec) * duck));
};
