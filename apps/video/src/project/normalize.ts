import { VideoProjectSchema, type VideoProject } from './schemas';
import { getProjectDurationSec, getShotsDurationSec } from './timeline';

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
  const assetById = new Map(project.mediaAssets.map((asset) => [asset.id, asset]));
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
      .map((track) => {
        const asset = assetById.get(track.assetId);
        const availableSource = track.loop
          ? totalDurationSec
          : Math.max(0.001, (asset?.decodedDurationSec ?? track.durationSec) - track.trimStartSec);
        const durationSec = Math.max(
          0.001,
          Math.min(
            track.loop ? totalDurationSec - track.startTimeSec : track.durationSec,
            totalDurationSec - track.startTimeSec,
            availableSource,
          ),
        );
        return {
          ...track,
          durationSec,
          fadeInSec: Math.min(track.fadeInSec, durationSec / 2),
          fadeOutSec: Math.min(track.fadeOutSec, durationSec / 2),
        };
      });

  return VideoProjectSchema.parse({
    ...project,
    overlays,
    audioTracks,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    renderStatus: options.renderStatus ?? 'idle',
  });
};
