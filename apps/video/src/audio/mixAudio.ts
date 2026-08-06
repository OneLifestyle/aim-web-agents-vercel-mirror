import type { AudioTrack, VideoProject } from '../project/schemas';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import { getProjectDuration } from '../render/canvasComposition';
import { audioGainAtTime } from './timing';

const AUDIO_SAMPLE_RATE = 48_000;
const AUDIO_CHANNELS = 2;
const ONE_SAMPLE_SEC = 1 / AUDIO_SAMPLE_RATE;

const assertNotCancelled = (signal?: AbortSignal) => {
  if (signal?.aborted) throw new DOMException('Audio mixing was cancelled.', 'AbortError');
};

const decodeTrack = async (context: OfflineAudioContext, blob: Blob) =>
  context.decodeAudioData(await blob.arrayBuffer());

export interface GainEnvelopePoint {
  timeSec: number;
  gain: number;
  discontinuity: boolean;
}

/**
 * Exact piecewise-linear fade/duck breakpoints shared with the same gain
 * evaluator used by preview. Discontinuous duck and zero-fade boundaries are
 * represented by a one-sample pre-boundary point followed by a value jump.
 */
export const createGainEnvelopePoints = (
  track: AudioTrack,
  allTracks: readonly AudioTrack[],
  totalDurationSec: number,
): GainEnvelopePoint[] => {
  const start = Math.max(0, track.startTimeSec);
  const end = Math.min(totalDurationSec, track.startTimeSec + track.durationSec);
  const discontinuities = new Set<number>([start, end]);
  const knots = new Set<number>([
    start,
    Math.min(end, start + track.fadeInSec),
    Math.max(start, end - track.fadeOutSec),
    end,
  ]);

  if (track.kind === 'music' && track.duckUnderVoice) {
    for (const voice of allTracks) {
      if (!voice.enabled || voice.kind !== 'voiceover') continue;
      const voiceStart = Math.max(start, voice.startTimeSec);
      const voiceEnd = Math.min(end, voice.startTimeSec + voice.durationSec);
      if (voiceStart > start && voiceStart < end) discontinuities.add(voiceStart);
      if (voiceEnd > start && voiceEnd < end) discontinuities.add(voiceEnd);
    }
  }

  for (const boundary of discontinuities) {
    knots.add(boundary);
    if (boundary > start) knots.add(Math.max(start, boundary - ONE_SAMPLE_SEC));
  }

  return [...knots]
    .filter((timeSec) => timeSec >= start && timeSec <= end)
    .sort((left, right) => left - right)
    .map((timeSec) => ({
      timeSec,
      gain: audioGainAtTime(track, allTracks, timeSec),
      discontinuity: discontinuities.has(timeSec),
    }));
};

const scheduleGainEnvelope = (
  gain: AudioParam,
  track: AudioTrack,
  allTracks: readonly AudioTrack[],
  totalDurationSec: number,
) => {
  const start = Math.max(0, track.startTimeSec);
  gain.setValueAtTime(0, 0);
  for (const point of createGainEnvelopePoints(track, allTracks, totalDurationSec)) {
    if (point.discontinuity || point.timeSec === start) {
      gain.setValueAtTime(point.gain, point.timeSec);
    } else {
      gain.linearRampToValueAtTime(point.gain, point.timeSec);
    }
  }
};

export const mixProjectAudio = async (
  project: VideoProject,
  runtime: ProjectAssetRuntime,
  signal?: AbortSignal,
) => {
  const totalDurationSec = getProjectDuration(project);
  const frameCount = Math.max(1, Math.ceil(totalDurationSec * AUDIO_SAMPLE_RATE));
  const context = new OfflineAudioContext(AUDIO_CHANNELS, frameCount, AUDIO_SAMPLE_RATE);
  const enabledTracks = project.audioTracks.filter((track) => track.enabled);

  for (const track of enabledTracks) {
    assertNotCancelled(signal);
    const blob = runtime.getBlob(track.assetId);
    if (!blob) throw new Error(`Local audio for ${track.kind} is missing.`);
    const decoded = await decodeTrack(context, blob);
    assertNotCancelled(signal);
    const source = context.createBufferSource();
    source.buffer = decoded;
    source.loop = track.loop;
    if (track.loop && decoded.duration > 0) source.loopEnd = decoded.duration;
    const gain = context.createGain();
    scheduleGainEnvelope(gain.gain, track, project.audioTracks, totalDurationSec);
    source.connect(gain).connect(context.destination);
    const start = Math.max(0, track.startTimeSec);
    const duration = Math.min(track.durationSec, totalDurationSec - start);
    const offset = decoded.duration > 0 ? track.trimStartSec % decoded.duration : 0;
    source.start(start, offset);
    source.stop(start + duration);
  }

  assertNotCancelled(signal);
  const mixed = await context.startRendering();
  assertNotCancelled(signal);
  return mixed;
};
