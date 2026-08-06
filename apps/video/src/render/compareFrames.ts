import { BlobSource, Input, MP4, VideoSampleSink } from 'mediabunny';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import type { VideoProject } from '../project/schemas';
import { drawProjectFrame, getProjectDuration } from './canvasComposition';
import { getShotSegments } from './canvasComposition';
import { getReferencedVisualAssetIds } from './referencedAssets';

export interface FrameParitySample {
  requestedTimeSec: number;
  timeSec: number;
  meanAbsoluteChannelError: number;
  withinLossyTolerance: boolean;
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Canvas 2D is unavailable for frame comparison.');
  return { canvas, context };
};

const scaledPixels = (
  source: HTMLCanvasElement,
  width = 96,
  height = 54,
) => {
  const { context } = createCanvas(width, height);
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
};

const meanAbsoluteRgbError = (left: Uint8ClampedArray, right: Uint8ClampedArray) => {
  if (left.length !== right.length) throw new Error('Frame comparison buffers differ in size.');
  let total = 0;
  let channels = 0;
  for (let index = 0; index < left.length; index += 4) {
    total += Math.abs(left[index]! - right[index]!);
    total += Math.abs(left[index + 1]! - right[index + 1]!);
    total += Math.abs(left[index + 2]! - right[index + 2]!);
    channels += 3;
  }
  return total / channels;
};

export const compareExportedFrames = async (
  project: VideoProject,
  runtime: ProjectAssetRuntime,
  mp4Blob: Blob,
  requestedTimes?: readonly number[],
): Promise<FrameParitySample[]> => {
  const durationSec = getProjectDuration(project);
  const segments = getShotSegments(project);
  const times = requestedTimes ?? (
    segments.length <= 6
      ? [
          ...segments.map((segment) => (
            segment.startTimeSec + (segment.endTimeSec - segment.startTimeSec) / 2
          )),
          ...(project.endCard.enabled
            ? [Math.min(durationSec - 1 / project.fps, segments.at(-1)?.endTimeSec ?? 0)]
            : []),
        ]
      : [
          Math.min(0.5, durationSec / 4),
          durationSec * 0.5,
          Math.max(0, durationSec - Math.max(0.2, 1 / project.fps)),
        ]
  );
  const images = new Map<string, CanvasImageSource>();
  for (const assetId of getReferencedVisualAssetIds(project)) {
    if (runtime.has(assetId)) images.set(assetId, await runtime.getImage(assetId));
  }

  const input = new Input({ source: new BlobSource(mp4Blob), formats: [MP4] });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track) throw new Error('Rendered MP4 has no video track for parity comparison.');
    const sink = new VideoSampleSink(track);
    const expected = createCanvas(project.canvas.width, project.canvas.height);
    const decoded = createCanvas(project.canvas.width, project.canvas.height);
    const results: FrameParitySample[] = [];

    for (const requestedTime of times) {
      const timeSec = Math.max(0, Math.min(requestedTime, durationSec - 1 / project.fps));
      const sample = await sink.getSample(timeSec);
      if (!sample) throw new Error(`No exported video frame was available at ${timeSec.toFixed(3)} seconds.`);
      const decodedTimeSec = sample.timestamp;
      drawProjectFrame(expected.context, project, images, decodedTimeSec);
      decoded.context.clearRect(0, 0, decoded.canvas.width, decoded.canvas.height);
      sample.draw(decoded.context, 0, 0, decoded.canvas.width, decoded.canvas.height);
      sample.close();
      const error = meanAbsoluteRgbError(scaledPixels(expected.canvas), scaledPixels(decoded.canvas));
      results.push({
        requestedTimeSec: timeSec,
        timeSec: decodedTimeSec,
        meanAbsoluteChannelError: error,
        withinLossyTolerance: error <= 12,
      });
    }
    return results;
  } finally {
    input.dispose();
  }
};
