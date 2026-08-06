import type {
  AudioTrack,
  Overlay,
  VideoProject,
  VideoShot,
} from './schemas';

export interface ShotTimelineSegment {
  kind: 'shot';
  segmentId: string;
  shotId: string;
  sequenceIndex: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

export interface EndCardTimelineSegment {
  kind: 'end-card';
  segmentId: 'end-card';
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;
}

export type TimelineSegment = ShotTimelineSegment | EndCardTimelineSegment;

export const getOrderedShots = (project: VideoProject): VideoShot[] => {
  const shotById = new Map(project.shots.map((shot) => [shot.id, shot]));

  return project.orderedShotIds.map((shotId) => {
    const shot = shotById.get(shotId);
    if (!shot) {
      throw new Error(`Project order references missing shot "${shotId}".`);
    }
    return shot;
  });
};

export const getShotTimelineSegments = (
  project: VideoProject,
): ShotTimelineSegment[] => {
  let cursorSec = 0;

  return getOrderedShots(project).map((shot, sequenceIndex) => {
    const startTimeSec = cursorSec;
    const endTimeSec = startTimeSec + shot.durationSec;
    cursorSec = endTimeSec;

    return {
      kind: 'shot',
      segmentId: shot.id,
      shotId: shot.id,
      sequenceIndex,
      startTimeSec,
      endTimeSec,
      durationSec: shot.durationSec,
    };
  });
};

export const getShotsDurationSec = (project: VideoProject): number =>
  getOrderedShots(project).reduce((sum, shot) => sum + shot.durationSec, 0);

export const getEndCardStartSec = getShotsDurationSec;

export const getProjectDurationSec = (project: VideoProject): number =>
  getShotsDurationSec(project) +
  (project.endCard.enabled ? project.endCard.durationSec : 0);

export const getTimelineSegments = (project: VideoProject): TimelineSegment[] => {
  const shotSegments = getShotTimelineSegments(project);

  if (!project.endCard.enabled || project.endCard.durationSec <= 0) {
    return shotSegments;
  }

  const startTimeSec =
    shotSegments.at(-1)?.endTimeSec ?? getEndCardStartSec(project);

  return [
    ...shotSegments,
    {
      kind: 'end-card',
      segmentId: 'end-card',
      startTimeSec,
      endTimeSec: startTimeSec + project.endCard.durationSec,
      durationSec: project.endCard.durationSec,
    },
  ];
};

const assertTimelineTime = (timeSec: number): void => {
  if (!Number.isFinite(timeSec) || timeSec < 0) {
    throw new RangeError('Timeline time must be a finite non-negative number.');
  }
};

export const getTimelineSegmentAtTime = (
  project: VideoProject,
  timeSec: number,
): TimelineSegment | undefined => {
  assertTimelineTime(timeSec);

  return getTimelineSegments(project).find(
    (segment) =>
      timeSec >= segment.startTimeSec && timeSec < segment.endTimeSec,
  );
};

export const getShotAtTime = (
  project: VideoProject,
  timeSec: number,
): VideoShot | undefined => {
  const segment = getTimelineSegmentAtTime(project, timeSec);
  if (!segment || segment.kind !== 'shot') {
    return undefined;
  }

  return project.shots.find((shot) => shot.id === segment.shotId);
};

export const getActiveOverlaysAtTime = (
  project: VideoProject,
  timeSec: number,
): Overlay[] => {
  assertTimelineTime(timeSec);

  return project.overlays.filter(
    (overlay) =>
      timeSec >= overlay.timing.startTimeSec &&
      timeSec < overlay.timing.startTimeSec + overlay.timing.durationSec,
  );
};

export const getActiveAudioTracksAtTime = (
  project: VideoProject,
  timeSec: number,
): AudioTrack[] => {
  assertTimelineTime(timeSec);

  return project.audioTracks.filter(
    (track) =>
      track.enabled &&
      timeSec >= track.startTimeSec &&
      timeSec < track.startTimeSec + track.durationSec,
  );
};

export const getProjectFrameCount = (project: VideoProject): number =>
  Math.ceil(getProjectDurationSec(project) * project.fps);
