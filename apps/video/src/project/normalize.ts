import { VideoProjectSchema, type VideoProject } from './schemas';
import { getProjectDurationSec, getShotsDurationSec } from './timeline';
import { resolveAudioPlacement } from '../audio/placement';

export interface NormalizeProjectOptions {
  updatedAt?: string;
  renderStatus?: VideoProject['renderStatus'];
}

/**
 * Keeps timeline-dependent overlays and audio valid after shot mutations.
 * Callers may inject a timestamp for deterministic fixtures/tests.
 */
export const normalizeProjectTiming = (
  project: VideoProject,
  options: NormalizeProjectOptions = {},
): VideoProject => {
  const totalDurationSec = getProjectDurationSec(project);
  const shotsDurationSec = getShotsDurationSec(project);
  const overlays = totalDurationSec <= 0
    ? []
    : project.overlays
      .filter((overlay) => overlay.timing.startTimeSec < totalDurationSec)
      .map((overlay) => ({
        ...overlay,
        timing: {
          ...overlay.timing,
          durationSec: Math.max(
            0.001,
            Math.min(
              overlay.kind === 'watermark'
                ? Math.max(0.001, shotsDurationSec)
                : overlay.timing.durationSec,
              totalDurationSec - overlay.timing.startTimeSec,
            ),
          ),
        },
      }));
  const audioTracks = totalDurationSec <= 0
    ? []
    : project.audioTracks
      .filter((track) => track.startTimeSec < totalDurationSec)
      .map((track) => resolveAudioPlacement(project, track).track)
      .filter((track) => track.durationSec > 0);

  return VideoProjectSchema.parse({
    ...project,
    overlays,
    audioTracks,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    renderStatus: options.renderStatus ?? 'idle',
  });
};
