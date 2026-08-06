import {
  AudioBufferSource,
  BufferTarget,
  CanvasSource,
  Mp4OutputFormat,
  Output,
  Quality,
  canEncodeAudio,
  canEncodeVideo,
} from 'mediabunny';
import { mixProjectAudio } from '../audio/mixAudio';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import { createOutputFileName } from '../project/outputProfile';
import { VideoProjectSchema, type VideoProject } from '../project/schemas';
import { drawProjectFrame, getProjectDuration } from './canvasComposition';
import { inspectMp4Blob, type Mp4Inspection } from './inspectMp4';
import { getReferencedVisualAssetIds } from './referencedAssets';
import { RenderCancelledError, RenderCapabilityError } from './renderErrors';

export { RenderCancelledError, RenderCapabilityError } from './renderErrors';

export const SELECTED_RENDERER = {
  name: 'Mediabunny',
  version: '1.52.3',
  licence: 'MPL-2.0',
} as const;

export type RenderProgressStage = 'checking' | 'loading' | 'mixing-audio' | 'rendering' | 'finalizing' | 'inspecting';

export interface RenderProgress {
  stage: RenderProgressStage;
  progress: number;
  frame: number;
  totalFrames: number;
  message: string;
}

export interface RenderProjectOptions {
  signal?: AbortSignal;
  onProgress?: (progress: RenderProgress) => void;
}

export interface RenderedVideo {
  blob: Blob;
  fileName: string;
  inspection: Mp4Inspection;
  elapsedMs: number;
  renderer: typeof SELECTED_RENDERER;
}

const emit = (
  options: RenderProjectOptions,
  stage: RenderProgressStage,
  progress: number,
  frame: number,
  totalFrames: number,
  message: string,
) => options.onProgress?.({ stage, progress, frame, totalFrames, message });

const assertNotCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new RenderCancelledError();
};

const preloadImages = async (
  project: VideoProject,
  runtime: ProjectAssetRuntime,
  signal?: AbortSignal,
) => {
  const images = new Map<string, CanvasImageSource>();
  for (const assetId of getReferencedVisualAssetIds(project)) {
    assertNotCancelled(signal);
    const image = await runtime.getImage(assetId);
    images.set(assetId, image);
  }
  return images;
};

export const checkRenderCapabilities = async (project: VideoProject) => {
  if (typeof VideoEncoder === 'undefined' || typeof AudioEncoder === 'undefined') {
    throw new RenderCapabilityError('This browser does not provide the WebCodecs encoders required for local MP4 export.');
  }
  const [videoSupported, audioSupported] = await Promise.all([
    canEncodeVideo('avc', {
      width: project.canvas.width,
      height: project.canvas.height,
      quality: new Quality({ bitrate: project.outputProfile.targetVideoBitrateMbps * 1_000_000 }),
    }),
    canEncodeAudio('aac', {
      numberOfChannels: 2,
      sampleRate: 48_000,
      quality: new Quality({ bitrate: project.outputProfile.targetAudioBitrateKbps * 1_000 }),
    }),
  ]);
  if (!videoSupported) {
    throw new RenderCapabilityError('This browser cannot encode 1920 × 1080 H.264 video locally. Use current Chrome on supported hardware.');
  }
  if (!audioSupported) {
    throw new RenderCapabilityError('This browser cannot encode AAC audio locally. Use current Chrome on supported hardware.');
  }
  return { videoSupported, audioSupported };
};

export const renderProjectToMp4 = async (
  projectInput: VideoProject,
  runtime: ProjectAssetRuntime,
  options: RenderProjectOptions = {},
): Promise<RenderedVideo> => {
  const startedAt = performance.now();
  const project = VideoProjectSchema.parse(projectInput);
  const durationSec = getProjectDuration(project);
  if (project.orderedShotIds.length === 0 || durationSec <= 0) {
    throw new Error('Add photographs before exporting the video.');
  }
  const totalFrames = Math.ceil(durationSec * project.fps);
  emit(options, 'checking', 0.01, 0, totalFrames, 'Checking local video support');
  assertNotCancelled(options.signal);
  await checkRenderCapabilities(project);

  emit(options, 'loading', 0.03, 0, totalFrames, 'Preparing local photographs');
  const images = await preloadImages(project, runtime, options.signal);
  assertNotCancelled(options.signal);

  const canvas = document.createElement('canvas');
  canvas.width = project.canvas.width;
  canvas.height = project.canvas.height;
  const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!context) throw new Error('Canvas rendering is not available.');
  const target = new BufferTarget();
  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target,
  });
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    quality: new Quality({ bitrate: project.outputProfile.targetVideoBitrateMbps * 1_000_000 }),
    keyFrameInterval: 2,
    sizeChangeBehavior: 'deny',
    transform: { alpha: 'discard' },
  });
  const audioSource = new AudioBufferSource({
    codec: 'aac',
    quality: new Quality({ bitrate: project.outputProfile.targetAudioBitrateKbps * 1_000 }),
  });
  output.addVideoTrack(videoSource, { frameRate: project.fps });
  output.addAudioTrack(audioSource);
  output.setMetadataTags(project.outputVariant === 'branded'
    ? {
        title: project.videoTitle || project.name,
        artist: 'Real Estate AIM — local operator export',
        comment: 'Deterministic local client-alpha render; no generative-video provider.',
      }
    : {
        title: project.videoTitle || project.name,
        comment: 'Deterministic local property-video export.',
      });

  try {
    await output.start();
    emit(options, 'mixing-audio', 0.05, 0, totalFrames, 'Mixing music and voice locally');
    const mixedAudio = await mixProjectAudio(project, runtime, options.signal);
    assertNotCancelled(options.signal);
    await audioSource.add(mixedAudio);
    assertNotCancelled(options.signal);

    const frameDuration = 1 / project.fps;
    for (let frame = 0; frame < totalFrames; frame += 1) {
      assertNotCancelled(options.signal);
      const timeSec = frame / project.fps;
      drawProjectFrame(context, project, images, timeSec);
      await videoSource.add(timeSec, frameDuration);
      if (frame === totalFrames - 1 || frame % 3 === 0) {
        const ratio = (frame + 1) / totalFrames;
        emit(
          options,
          'rendering',
          0.08 + ratio * 0.84,
          frame + 1,
          totalFrames,
          `Rendering frame ${frame + 1} of ${totalFrames}`,
        );
      }
    }

    assertNotCancelled(options.signal);
    emit(options, 'finalizing', 0.94, totalFrames, totalFrames, 'Finalizing MP4');
    await output.finalize();
    assertNotCancelled(options.signal);
    const buffer = target.buffer;
    if (!buffer) throw new Error('The local encoder produced no output.');
    const blob = new Blob([buffer], { type: 'video/mp4' });
    emit(options, 'inspecting', 0.98, totalFrames, totalFrames, 'Inspecting MP4 tracks');
    assertNotCancelled(options.signal);
    const inspection = await inspectMp4Blob(blob);
    assertNotCancelled(options.signal);
    emit(options, 'inspecting', 1, totalFrames, totalFrames, 'MP4 ready to download');
    assertNotCancelled(options.signal);
    return {
      blob,
      fileName: createOutputFileName(project.name, project.outputVariant),
      inspection,
      elapsedMs: performance.now() - startedAt,
      renderer: SELECTED_RENDERER,
    };
  } catch (error) {
    if (output.state !== 'canceled' && output.state !== 'finalized') await output.cancel();
    if (error instanceof RenderCancelledError || options.signal?.aborted) throw new RenderCancelledError();
    throw error;
  }
};

export const downloadRenderedVideo = (rendered: RenderedVideo) => {
  const url = URL.createObjectURL(rendered.blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = rendered.fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
