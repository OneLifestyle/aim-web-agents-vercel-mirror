import type { AudioTrack, VideoProject } from '../project/schemas';
import { getProjectDurationSec } from '../project/timeline';

export interface ResolvedAudioPlacement {
  track: AudioTrack;
  sourceDurationSec: number;
  usedDurationSec: number;
  endTimeSec: number;
}

export const getAudioSourceDurationSec = (
  project: Pick<VideoProject, 'mediaAssets'>,
  track: AudioTrack,
) => project.mediaAssets.find((asset) => asset.id === track.assetId)?.decodedDurationSec
  ?? track.durationSec;

/**
 * Current-alpha audio placement is automatic. Music follows the complete
 * project; voiceover remains bounded by its decoded source and the project.
 * Persisted durationSec is retained for schema compatibility, but is not the
 * runtime authority for either track kind.
 */
export const resolveAudioPlacement = (
  project: VideoProject,
  track: AudioTrack,
): ResolvedAudioPlacement => {
  const projectDurationSec = getProjectDurationSec(project);
  const sourceDurationSec = getAudioSourceDurationSec(project, track);
  const startTimeSec = track.kind === 'music'
    ? 0
    : Math.max(0, Math.min(track.startTimeSec, projectDurationSec));
  const trimStartSec = track.kind === 'music'
    ? 0
    : Math.max(0, Math.min(track.trimStartSec, sourceDurationSec));
  const availableProjectDurationSec = Math.max(0, projectDurationSec - startTimeSec);
  const availableSourceDurationSec = Math.max(0, sourceDurationSec - trimStartSec);
  const usedDurationSec = track.kind === 'music'
    ? availableProjectDurationSec
    : Math.min(availableProjectDurationSec, availableSourceDurationSec);
  const fadeLimitSec = usedDurationSec / 2;
  const resolvedTrack: AudioTrack = {
    ...track,
    startTimeSec,
    trimStartSec,
    durationSec: usedDurationSec,
    fadeInSec: Math.min(track.fadeInSec, fadeLimitSec),
    fadeOutSec: Math.min(track.fadeOutSec, fadeLimitSec),
    loop: track.kind === 'music' ? true : false,
  };

  return {
    track: resolvedTrack,
    sourceDurationSec,
    usedDurationSec,
    endTimeSec: startTimeSec + usedDurationSec,
  };
};

export const resolveProjectAudioTracks = (project: VideoProject): AudioTrack[] =>
  project.audioTracks
    .map((track) => resolveAudioPlacement(project, track).track)
    .filter((track) => track.durationSec > 0);
