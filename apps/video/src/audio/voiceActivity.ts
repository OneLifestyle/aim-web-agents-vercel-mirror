import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import {
  VOICE_ACTIVITY_ANALYSIS_VERSION,
  VideoProjectSchema,
  VoiceActivityEnvelopeSchema,
  type VideoProject,
  type VoiceActivityEnvelope,
  type VoiceActivitySegment,
} from '../project/schemas';
import { resolveAudioPlacement } from './placement';

export const VOICE_ACTIVITY_DEFAULTS = Object.freeze({
  analysisWindowDurationSec: 0.03,
  attackDurationSec: 0.18,
  releaseDurationSec: 0.65,
  minimumActiveHoldSec: 0.15,
  minimumSilenceForRecoverySec: 0.8,
  activeMusicGain: 0.28,
});

const MINIMUM_ANALYSIS_RMS = 0.000_000_1;
const TIME_PRECISION = 1_000_000;
const RMS_PRECISION = 100_000_000;

const roundTime = (value: number) => Math.round(value * TIME_PRECISION) / TIME_PRECISION;
const roundRms = (value: number) => Math.round(value * RMS_PRECISION) / RMS_PRECISION;

export interface AudioSampleSource {
  readonly duration: number;
  readonly length: number;
  readonly numberOfChannels: number;
  readonly sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

export interface VoiceActivityWindow {
  startTimeSec: number;
  endTimeSec: number;
  rms: number;
  active?: boolean;
}

export interface VoiceActivityThresholds {
  noiseFloorRms: number;
  speechStartThresholdRms: number;
  speechContinueThresholdRms: number;
}

export interface AnalyseVoiceActivityOptions {
  analysisWindowDurationSec?: number;
  attackDurationSec?: number;
  releaseDurationSec?: number;
  minimumActiveHoldSec?: number;
  minimumSilenceForRecoverySec?: number;
  activeMusicGain?: number;
}

export const getCurrentVoiceActivityEnvelope = (
  project: Pick<VideoProject, 'voiceActivityEnvelope'>,
): VoiceActivityEnvelope | undefined => {
  const parsed = VoiceActivityEnvelopeSchema.safeParse(project.voiceActivityEnvelope);
  return parsed.success ? parsed.data : undefined;
};

export const calculateRms = (samples: ArrayLike<number>): number => {
  if (samples.length === 0) return 0;
  let sumSquares = 0;
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    sumSquares += sample * sample;
  }
  return Math.sqrt(sumSquares / samples.length);
};

/** Build channel-combined RMS windows without retaining copied PCM. */
export const buildAnalysisWindows = (
  source: AudioSampleSource,
  windowDurationSec: number = VOICE_ACTIVITY_DEFAULTS.analysisWindowDurationSec,
): VoiceActivityWindow[] => {
  if (!Number.isFinite(source.sampleRate) || source.sampleRate <= 0) {
    throw new RangeError('Voice activity analysis requires a positive sample rate.');
  }
  if (source.numberOfChannels <= 0 || source.length <= 0 || source.duration <= 0) return [];
  const samplesPerWindow = Math.max(1, Math.round(source.sampleRate * windowDurationSec));
  const windows: VoiceActivityWindow[] = [];
  const channelData = Array.from(
    { length: source.numberOfChannels },
    (_, channel) => source.getChannelData(channel),
  );

  for (let start = 0; start < source.length; start += samplesPerWindow) {
    const end = Math.min(source.length, start + samplesPerWindow);
    let sumSquares = 0;
    let sampleCount = 0;
    for (const samples of channelData) {
      for (let index = start; index < end; index += 1) {
        const sample = samples[index] ?? 0;
        sumSquares += sample * sample;
        sampleCount += 1;
      }
    }
    windows.push({
      startTimeSec: roundTime(start / source.sampleRate),
      endTimeSec: roundTime(Math.min(source.duration, end / source.sampleRate)),
      rms: sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0,
    });
  }
  return windows;
};

const percentile = (sorted: readonly number[], fraction: number) => {
  if (sorted.length === 0) return 0;
  const index = Math.max(0, Math.min(sorted.length - 1, Math.floor((sorted.length - 1) * fraction)));
  return sorted[index] ?? 0;
};

/**
 * Estimate thresholds from the track itself. The lower threshold retains an
 * active state through breaths/soft phonemes; the higher one starts activity.
 */
export const estimateAdaptiveThresholds = (
  windows: readonly VoiceActivityWindow[],
): VoiceActivityThresholds => {
  const sorted = windows.map((window) => window.rms).sort((left, right) => left - right);
  const noiseFloorRms = percentile(sorted, 0.15);
  const highPercentile = percentile(sorted, 0.95);
  const peak = sorted.at(-1) ?? 0;
  const representativeHigh = Math.max(highPercentile, peak * 0.7);
  const dynamicRange = Math.max(0, representativeHigh - noiseFloorRms);

  let speechStartThresholdRms: number;
  let speechContinueThresholdRms: number;
  if (representativeHigh <= MINIMUM_ANALYSIS_RMS) {
    speechStartThresholdRms = MINIMUM_ANALYSIS_RMS;
    speechContinueThresholdRms = MINIMUM_ANALYSIS_RMS / 2;
  } else if (dynamicRange < representativeHigh * 0.15) {
    // A consistently energetic track may contain little or no captured silence.
    speechStartThresholdRms = Math.max(MINIMUM_ANALYSIS_RMS, representativeHigh * 0.55);
    speechContinueThresholdRms = Math.max(MINIMUM_ANALYSIS_RMS / 2, representativeHigh * 0.4);
  } else {
    speechStartThresholdRms = Math.max(
      MINIMUM_ANALYSIS_RMS,
      noiseFloorRms + dynamicRange * 0.12,
    );
    speechContinueThresholdRms = Math.max(
      MINIMUM_ANALYSIS_RMS / 2,
      noiseFloorRms + dynamicRange * 0.07,
    );
  }

  return {
    noiseFloorRms: roundRms(noiseFloorRms),
    speechStartThresholdRms: roundRms(speechStartThresholdRms),
    speechContinueThresholdRms: roundRms(Math.min(
      speechContinueThresholdRms,
      speechStartThresholdRms,
    )),
  };
};

export const classifyActivityWindows = (
  windows: readonly VoiceActivityWindow[],
  thresholds: VoiceActivityThresholds,
): VoiceActivityWindow[] => {
  let active = false;
  return windows.map((window) => {
    if (active) {
      active = window.rms >= thresholds.speechContinueThresholdRms;
    } else {
      active = window.rms >= thresholds.speechStartThresholdRms;
    }
    return { ...window, active };
  });
};

const windowsToSegments = (windows: readonly VoiceActivityWindow[]): VoiceActivitySegment[] => {
  const segments: VoiceActivitySegment[] = [];
  let startTimeSec: number | null = null;
  let endTimeSec = 0;
  for (const window of windows) {
    if (window.active) {
      if (startTimeSec === null) startTimeSec = window.startTimeSec;
      endTimeSec = window.endTimeSec;
    } else if (startTimeSec !== null) {
      segments.push({ startTimeSec, endTimeSec });
      startTimeSec = null;
    }
  }
  if (startTimeSec !== null) segments.push({ startTimeSec, endTimeSec });
  return segments;
};

export const postProcessActivitySegments = (
  windows: readonly VoiceActivityWindow[],
  minimumActiveHoldSec: number = VOICE_ACTIVITY_DEFAULTS.minimumActiveHoldSec,
  minimumSilenceForRecoverySec: number = VOICE_ACTIVITY_DEFAULTS.minimumSilenceForRecoverySec,
): VoiceActivitySegment[] => {
  const retained = windowsToSegments(windows).filter(
    (segment) => segment.endTimeSec - segment.startTimeSec >= minimumActiveHoldSec,
  );
  const merged: VoiceActivitySegment[] = [];
  for (const segment of retained) {
    const previous = merged.at(-1);
    if (previous && segment.startTimeSec - previous.endTimeSec < minimumSilenceForRecoverySec) {
      previous.endTimeSec = segment.endTimeSec;
    } else {
      merged.push({ ...segment });
    }
  }
  return merged.map((segment) => ({
    startTimeSec: roundTime(segment.startTimeSec),
    endTimeSec: roundTime(segment.endTimeSec),
  }));
};

export const analyseVoiceActivity = (
  source: AudioSampleSource,
  sourceAssetId: string,
  sourceContentHash: string,
  options: AnalyseVoiceActivityOptions = {},
): VoiceActivityEnvelope => {
  const settings = { ...VOICE_ACTIVITY_DEFAULTS, ...options };
  const windows = buildAnalysisWindows(source, settings.analysisWindowDurationSec);
  const thresholds = estimateAdaptiveThresholds(windows);
  const classified = classifyActivityWindows(windows, thresholds);
  const activeSegments = postProcessActivitySegments(
    classified,
    settings.minimumActiveHoldSec,
    settings.minimumSilenceForRecoverySec,
  );
  return VoiceActivityEnvelopeSchema.parse({
    analysisVersion: VOICE_ACTIVITY_ANALYSIS_VERSION,
    sourceAssetId,
    sourceContentHash,
    sourceDurationSec: roundTime(source.duration),
    analysisWindowDurationSec: settings.analysisWindowDurationSec,
    ...thresholds,
    attackDurationSec: settings.attackDurationSec,
    releaseDurationSec: settings.releaseDurationSec,
    minimumActiveHoldSec: settings.minimumActiveHoldSec,
    minimumSilenceForRecoverySec: settings.minimumSilenceForRecoverySec,
    activeMusicGain: settings.activeMusicGain,
    activeSegments,
  });
};

const getAudioContextConstructor = () => {
  const scope = globalThis as typeof globalThis & {
    AudioContext?: typeof AudioContext;
    webkitAudioContext?: typeof AudioContext;
  };
  return scope.AudioContext ?? scope.webkitAudioContext;
};

export const analyseVoiceActivityBlob = async (
  blob: Blob,
  sourceAssetId: string,
  sourceContentHash: string,
  options?: AnalyseVoiceActivityOptions,
): Promise<VoiceActivityEnvelope> => {
  const AudioContextConstructor = getAudioContextConstructor();
  if (!AudioContextConstructor) {
    throw new Error('Local voiceover analysis is not supported in this browser.');
  }
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    return analyseVoiceActivity(decoded, sourceAssetId, sourceContentHash, options);
  } catch (error) {
    throw new Error(
      'The voiceover could not be decoded for local speech activity analysis. Replace it with a playable WAV, MP3 or M4A file.',
      { cause: error },
    );
  } finally {
    await context.close();
  }
};

export const voiceActivityEnvelopeMatchesProject = (project: VideoProject) => {
  const voiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
  const envelope = getCurrentVoiceActivityEnvelope(project);
  if (!voiceover || !envelope) return false;
  const asset = project.mediaAssets.find((candidate) => candidate.id === voiceover.assetId);
  return Boolean(
    asset
    && envelope.analysisVersion === VOICE_ACTIVITY_ANALYSIS_VERSION
    && envelope.sourceAssetId === asset.id
    && envelope.sourceContentHash === asset.contentHash
    && Math.abs(envelope.sourceDurationSec - (asset.decodedDurationSec ?? 0)) <= 0.01,
  );
};

export interface EnsureVoiceActivityResult {
  project: VideoProject;
  analysisPerformed: boolean;
  elapsedMs: number;
}

export const ensureProjectVoiceActivityEnvelope = async (
  project: VideoProject,
  runtime: Pick<ProjectAssetRuntime, 'getBlob'>,
  analyseBlob: typeof analyseVoiceActivityBlob = analyseVoiceActivityBlob,
): Promise<EnsureVoiceActivityResult> => {
  const voiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
  if (!voiceover) {
    return {
      project: project.voiceActivityEnvelope
        ? VideoProjectSchema.parse({ ...project, voiceActivityEnvelope: undefined })
        : project,
      analysisPerformed: false,
      elapsedMs: 0,
    };
  }
  if (voiceActivityEnvelopeMatchesProject(project)) {
    return { project, analysisPerformed: false, elapsedMs: 0 };
  }
  const asset = project.mediaAssets.find((candidate) => candidate.id === voiceover.assetId);
  const blob = runtime.getBlob(voiceover.assetId);
  if (!asset || !blob) throw new Error('Local voiceover media is missing and cannot be analysed.');
  const startedAt = performance.now();
  const envelope = await analyseBlob(blob, asset.id, asset.contentHash);
  return {
    project: VideoProjectSchema.parse({ ...project, voiceActivityEnvelope: envelope }),
    analysisPerformed: true,
    elapsedMs: performance.now() - startedAt,
  };
};

/** Map source-relative activity into the placed voiceover timeline. */
export const getProjectVoiceActivitySegments = (
  project: VideoProject,
): VoiceActivitySegment[] => {
  if (!voiceActivityEnvelopeMatchesProject(project)) return [];
  const persistedVoiceover = project.audioTracks.find((track) => track.kind === 'voiceover' && track.enabled);
  const envelope = getCurrentVoiceActivityEnvelope(project);
  if (!persistedVoiceover || !envelope) return [];
  const voiceover = resolveAudioPlacement(project, persistedVoiceover).track;
  const sourceStart = voiceover.trimStartSec;
  const sourceEnd = sourceStart + voiceover.durationSec;
  return envelope.activeSegments.flatMap((segment) => {
    const clippedStart = Math.max(sourceStart, segment.startTimeSec);
    const clippedEnd = Math.min(sourceEnd, segment.endTimeSec);
    if (clippedEnd <= clippedStart) return [];
    return [{
      startTimeSec: roundTime(voiceover.startTimeSec + clippedStart - sourceStart),
      endTimeSec: roundTime(voiceover.startTimeSec + clippedEnd - sourceStart),
    }];
  });
};

export const musicDuckGainAtTime = (project: VideoProject, timeSec: number) => {
  const envelope = getCurrentVoiceActivityEnvelope(project);
  if (!envelope) return 1;
  let gain = 1;
  for (const segment of getProjectVoiceActivitySegments(project)) {
    const attackStart = segment.startTimeSec - envelope.attackDurationSec;
    const releaseEnd = segment.endTimeSec + envelope.releaseDurationSec;
    let segmentGain = 1;
    if (timeSec >= attackStart && timeSec < segment.startTimeSec && envelope.attackDurationSec > 0) {
      const progress = (timeSec - attackStart) / envelope.attackDurationSec;
      segmentGain = 1 + (envelope.activeMusicGain - 1) * progress;
    } else if (timeSec >= segment.startTimeSec && timeSec < segment.endTimeSec) {
      segmentGain = envelope.activeMusicGain;
    } else if (timeSec >= segment.endTimeSec && timeSec < releaseEnd && envelope.releaseDurationSec > 0) {
      const progress = (timeSec - segment.endTimeSec) / envelope.releaseDurationSec;
      segmentGain = envelope.activeMusicGain + (1 - envelope.activeMusicGain) * progress;
    }
    gain = Math.min(gain, segmentGain);
  }
  return Math.max(0, Math.min(1, gain));
};
