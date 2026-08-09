import type { AudioTrack, VideoProject } from '../project/schemas';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import { getProjectDuration } from '../render/canvasComposition';
import { audioGainAtTime, audioTrackGainAtTime } from './timing';
import { getCurrentVoiceActivityEnvelope, getProjectVoiceActivitySegments, musicDuckGainAtTime } from './voiceActivity';

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

const trackBoundaryState = (
  track: AudioTrack,
  totalDurationSec: number,
) => {
  const start = Math.max(0, track.startTimeSec);
  const end = Math.min(totalDurationSec, track.startTimeSec + track.durationSec);
  const discontinuities = new Set<number>([start, end]);
  const knots = new Set<number>([
    start,
    Math.min(end, start + track.fadeInSec),
    Math.max(start, end - track.fadeOutSec),
    end,
  ]);

  for (const boundary of discontinuities) {
    knots.add(boundary);
    if (boundary > start) knots.add(Math.max(start, boundary - ONE_SAMPLE_SEC));
  }
  return { start, end, discontinuities, knots };
};

export const createTrackGainEnvelopePoints = (
  track: AudioTrack,
  totalDurationSec: number,
): GainEnvelopePoint[] => {
  const { start, end, discontinuities, knots } = trackBoundaryState(track, totalDurationSec);
  return [...knots]
    .filter((timeSec) => timeSec >= start && timeSec <= end)
    .sort((left, right) => left - right)
    .map((timeSec) => ({
      timeSec,
      gain: audioTrackGainAtTime(track, timeSec),
      discontinuity: discontinuities.has(timeSec),
    }));
};

export const createDuckEnvelopePoints = (
  track: AudioTrack,
  project: VideoProject,
  totalDurationSec = getProjectDuration(project),
): GainEnvelopePoint[] => {
  const { start, end, discontinuities, knots } = trackBoundaryState(track, totalDurationSec);

  if (track.kind === 'music' && track.duckUnderVoice) {
    const envelope = getCurrentVoiceActivityEnvelope(project);
    if (envelope) {
      const activitySegments = getProjectVoiceActivitySegments(project);
      for (const segment of activitySegments) {
        knots.add(Math.max(start, segment.startTimeSec - envelope.attackDurationSec));
        knots.add(Math.max(start, Math.min(end, segment.startTimeSec)));
        knots.add(Math.max(start, Math.min(end, segment.endTimeSec)));
        knots.add(Math.max(start, Math.min(end, segment.endTimeSec + envelope.releaseDurationSec)));
      }
      if (envelope.attackDurationSec > 0 && envelope.releaseDurationSec > 0) {
        for (let index = 1; index < activitySegments.length; index += 1) {
          const previous = activitySegments[index - 1]!;
          const next = activitySegments[index]!;
          const attackStart = next.startTimeSec - envelope.attackDurationSec;
          const releaseEnd = previous.endTimeSec + envelope.releaseDurationSec;
          const overlapStart = Math.max(previous.endTimeSec, attackStart);
          const overlapEnd = Math.min(releaseEnd, next.startTimeSec);
          if (overlapEnd <= overlapStart) continue;
          // musicDuckGainAtTime takes the lower of overlapping linear ramps;
          // include their intersection so Web Audio schedules that exact cusp.
          const intersection = (
            1
            + previous.endTimeSec / envelope.releaseDurationSec
            + attackStart / envelope.attackDurationSec
          ) / (
            1 / envelope.releaseDurationSec
            + 1 / envelope.attackDurationSec
          );
          if (intersection >= overlapStart && intersection <= overlapEnd) {
            knots.add(Math.max(start, Math.min(end, intersection)));
          }
        }
      }
    }
  }

  return [...knots]
    .filter((timeSec) => timeSec >= start && timeSec <= end)
    .sort((left, right) => left - right)
    .map((timeSec) => ({
      timeSec,
      gain: track.kind === 'music' && track.duckUnderVoice
        ? musicDuckGainAtTime(project, timeSec)
        : 1,
      discontinuity: discontinuities.has(timeSec),
    }));
};

/** Intended combined gain points for parity inspection, not export scheduling. */
export const createGainEnvelopePoints = (
  track: AudioTrack,
  project: VideoProject,
  totalDurationSec = getProjectDuration(project),
): GainEnvelopePoint[] => {
  const times = new Set([
    ...createTrackGainEnvelopePoints(track, totalDurationSec).map((point) => point.timeSec),
    ...createDuckEnvelopePoints(track, project, totalDurationSec).map((point) => point.timeSec),
  ]);
  return [...times].sort((left, right) => left - right).map((timeSec) => ({
    timeSec,
    gain: audioGainAtTime(track, project, timeSec),
    discontinuity: timeSec === Math.max(0, track.startTimeSec)
      || timeSec === Math.min(totalDurationSec, track.startTimeSec + track.durationSec),
  }));
};

const scheduleEnvelope = (
  gain: AudioParam,
  points: readonly GainEnvelopePoint[],
  initialGain: number,
) => {
  gain.setValueAtTime(initialGain, 0);
  for (const point of points) {
    if (point.discontinuity) {
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
    const trackGain = context.createGain();
    const duckGain = context.createGain();
    scheduleEnvelope(
      trackGain.gain,
      createTrackGainEnvelopePoints(track, totalDurationSec),
      0,
    );
    scheduleEnvelope(
      duckGain.gain,
      createDuckEnvelopePoints(track, project, totalDurationSec),
      1,
    );
    source.connect(trackGain).connect(duckGain).connect(context.destination);
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
