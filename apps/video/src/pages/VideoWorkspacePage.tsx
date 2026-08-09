import { Check, Download, FolderOpen, Play, Save, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  analyseVoiceActivity,
  analyseVoiceActivityBlob,
  ensureProjectVoiceActivityEnvelope,
  getCurrentVoiceActivityEnvelope,
  getProjectVoiceActivitySegments,
} from '../audio/voiceActivity';
import { audioGainAtTime } from '../audio/timing';
import { createGainEnvelopePoints } from '../audio/mixAudio';
import { resolveAudioPlacement } from '../audio/placement';
import { MediaIntakePanel } from '../components/MediaIntakePanel';
import { ProductionSettings } from '../components/ProductionSettings';
import { ProjectHome } from '../components/ProjectHome';
import { ProjectPreview } from '../components/ProjectPreview';
import { Storyboard } from '../components/Storyboard';
import {
  buildCanonicalRendererFixture,
  buildFifteenShotFixture,
  buildFounderAudioRepairFixture,
  buildThirtyShotFixture,
  buildVoiceoverDuckingRendererFixture,
  createSelfCreatedVoiceoverFile,
  createRepresentativeVoiceActivitySampleSource,
  createSyntheticPropertyImage,
} from '../fixtures';
import {
  createAudioMediaAsset,
  createImageMediaAsset,
  createOperatorConfirmedRights,
  createStableId,
  mediaRightsAreRecorded,
  operatorRightsAreComplete,
  type OperatorRightsInput,
} from '../media/assets';
import {
  validateAudioFile,
  validateImageBatch,
  type MediaIntakeIssue,
} from '../media/intake';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import { createMotionPresetCrops } from '../motion';
import {
  LocalProjectRepository,
  type LocalProjectSummary,
} from '../persistence/localProjectRepository';
import {
  addWorkspaceMedia,
  clearUnusedMedia,
  createDefaultVideoProject,
  createSingleImageShot,
  finalizeWorkspaceProject,
  getProjectFrameCount,
  getProjectDurationSec,
  getShotsDurationSec,
  removeWorkspaceShot,
  reorderWorkspaceShots,
  retimeWorkspaceShot,
  setWorkspaceShotAsset,
  setWorkspaceShotMotion,
  setWorkspaceShotSourceMode,
  syncPresentationOverlays,
  updateProjectDetails,
  VideoProjectSchema,
  stableHash,
  type AudioTrack,
  type EndCard,
  type MotionPreset,
  type OutputVariant,
  type RenderJob,
  type VideoProject,
} from '../project';
import {
  downloadRenderedVideo,
  RenderCancelledError,
  renderProjectToMp4,
  type RenderProgress,
  type RenderedVideo,
} from '../render/renderProjectToMp4';
import { compareExportedFrames, type FrameParitySample } from '../render/compareFrames';
import { getReferencedAssetIds } from '../render/referencedAssets';
import { createControlledRenderError } from '../render/renderErrors';
import '../styles/workspace.css';

const MOTION_ROTATION: readonly MotionPreset[] = [
  'still',
  'zoom-in',
  'zoom-out',
  'pan-left',
  'pan-right',
];

const EMPTY_OPERATOR_RIGHTS: OperatorRightsInput = {
  source: '',
  owner: '',
  licenceOrPermission: '',
};

const SYNTHETIC_OPERATOR_RIGHTS: OperatorRightsInput = {
  source: 'Generated locally by the AIM Video browser verification fixture',
  owner: 'Singularealty / Real Estate AIM test fixture',
  licenceOrPermission: 'Self-created synthetic test media',
};

interface ToastMessage {
  id: string;
  message: string;
  error?: boolean;
}

interface BrowserVerificationApi {
  loadFixture: (count: 6 | 15 | 30, variant?: OutputVariant) => Promise<{ projectId: string; shots: number; assets: number }>;
  loadVoiceoverFixture: () => Promise<{
    projectId: string;
    shots: number;
    assets: number;
    activeSegments: number;
    analysisElapsedMs: number;
    approximateAnalysisHeapDeltaBytes: number | null;
  }>;
  loadAudioRepairFixture: () => Promise<{
    projectId: string;
    shots: number;
    assets: number;
    audio: AudioRuntimeState;
  }>;
  setMediaValidationDelay: (delayMs: number) => void;
  setProjectOpenDelay: (delayMs: number) => void;
  measureVoiceAnalysisPerformance: () => Array<{
    durationSec: number;
    elapsedMs: number;
    activeSegments: number;
    approximateHeapDeltaBytes: number | null;
  }>;
  recalculateMissingEnvelopeAndReopen: () => Promise<{
    analysisPerformed: boolean;
    persistedSegments: number;
    missingEnvelopeReopenElapsedMs: number;
    cachedEnvelopeReopenElapsedMs: number;
  }>;
  prepareMissingEnvelopeDamagedReopen: () => Promise<{
    projectId: string;
    imageAssetId: string;
  }>;
  state: () => {
    projectId: string | null;
    shots: number;
    assets: number;
    voiceActivitySegments: number;
    orderedShotIds: string[];
    shotSignatures: Array<{
      id: string;
      startAssetId: string;
      endAssetId?: string;
      durationSec: number;
      contentHash: string;
      settingsHash: string;
    }>;
    firstShot?: { id: string; contentHash: string; settingsHash: string; durationSec: number };
    audio?: AudioRuntimeState;
  };
  saveAndReopen: () => Promise<{
    projectId: string;
    missingAssetIds: string[];
    corruptAssetIds: string[];
    shots: number;
    voiceActivitySegments: number;
    voiceActivitySourceHash?: string;
    audio?: AudioRuntimeState;
  }>;
  reopenWithoutSave: () => Promise<{
    missingAssetIds: string[];
    corruptAssetIds: string[];
  }>;
  replaceFirstShot: () => Promise<{ stableShotId: boolean; settingsRetained: boolean; otherShotsUnchanged: boolean }>;
  retimeFirstShot: (durationSec: number) => {
    stableShotId: boolean;
    otherShotsUnchanged: boolean;
    durationSec: number;
    audio: AudioRuntimeState;
  };
  reorderFirstToLast: () => { firstShotId: string; lastShotId: string };
  removeFirstRuntimeAsset: () => string | null;
  replaceVoiceoverFixture: () => Promise<{ sourceChanged: boolean; activeSegments: number }>;
  removeVoiceoverFixture: () => { removed: boolean; envelopeRemoved: boolean };
  setDuckingEnabled: (enabled: boolean) => { enabled: boolean; speechGain: number; silenceGain: number };
  renderDirect: (options?: { download?: boolean; cancelAtFrame?: number; cancelAtStage?: RenderProgress['stage'] }) => Promise<{
    cancelled?: boolean;
    error?: string;
    elapsedMs?: number;
    sizeBytes?: number;
    inspection?: RenderedVideo['inspection'];
    parity?: FrameParitySample[];
    audioEvidence?: {
      channel: number;
      sampleWindowSec: number;
      speechOneRms: number;
      longSilenceRms: number;
      speechTwoRms: number;
      postVoiceoverRms?: number;
      finalFadeRms?: number;
      intendedMusicGains: {
        speechOne: number;
        longSilence: number;
        speechTwo: number;
        postVoiceover?: number;
        finalFade?: number;
      };
    };
  }>;
}

interface AudioRuntimeState {
  projectDurationSec: number;
  musicSourceDurationSec: number | null;
  musicUsedDurationSec: number | null;
  musicEndTimeSec: number | null;
  musicFadeOutStartSec: number | null;
  voiceoverSourceDurationSec: number | null;
  voiceoverUsedDurationSec: number | null;
  voiceoverEndTimeSec: number | null;
  speechSegments: Array<{ startTimeSec: number; endTimeSec: number }>;
  musicGainSchedule: Array<{ timeSec: number; gain: number; discontinuity: boolean }>;
  representativeMusicGains: {
    firstSpeech: number | null;
    meaningfulSilence: number | null;
    quieterResumedSpeech: number | null;
    postVoiceover: number | null;
    finalFade: number | null;
  };
}

declare global {
  interface Window {
    __AIM_VIDEO_TEST__?: BrowserVerificationApi;
  }
}

const createNewProject = () => {
  const base = createDefaultVideoProject({
    id: createStableId('project'),
    name: 'Untitled property video',
    videoTitle: 'Property presentation',
  });
  return syncPresentationOverlays(VideoProjectSchema.parse({
    ...base,
    endCard: {
      ...base.endCard,
      enabled: true,
      durationSec: 3,
      title: 'Thank you for viewing',
      backgroundColor: '#132133',
      textColor: '#ffffff',
    },
  }));
};

const renderSourceFingerprint = (project: VideoProject): string => stableHash({
  ...project,
  createdAt: 'render-source',
  updatedAt: 'render-source',
  renderStatus: 'idle',
  renderJobs: [],
  lastRenderJobId: undefined,
});

const measureAudioBufferRms = (
  buffer: AudioBuffer,
  channel: number,
  centerTimeSec: number,
  windowDurationSec: number,
) => {
  const samples = buffer.getChannelData(Math.min(channel, buffer.numberOfChannels - 1));
  const halfWindow = windowDurationSec / 2;
  const start = Math.max(0, Math.floor((centerTimeSec - halfWindow) * buffer.sampleRate));
  const end = Math.min(samples.length, Math.ceil((centerTimeSec + halfWindow) * buffer.sampleRate));
  let sumSquares = 0;
  for (let index = start; index < end; index += 1) {
    const sample = samples[index] ?? 0;
    sumSquares += sample * sample;
  }
  return end > start ? Math.sqrt(sumSquares / (end - start)) : 0;
};

const getAudioRuntimeState = (project: VideoProject): AudioRuntimeState => {
  const music = project.audioTracks.find((track) => track.kind === 'music');
  const voiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
  const musicPlacement = music ? resolveAudioPlacement(project, music) : undefined;
  const voiceoverPlacement = voiceover ? resolveAudioPlacement(project, voiceover) : undefined;
  const gainAt = (timeSec: number) => music ? audioGainAtTime(music, project, timeSec) : null;
  return {
    projectDurationSec: getProjectDurationSec(project),
    musicSourceDurationSec: musicPlacement?.sourceDurationSec ?? null,
    musicUsedDurationSec: musicPlacement?.usedDurationSec ?? null,
    musicEndTimeSec: musicPlacement?.endTimeSec ?? null,
    musicFadeOutStartSec: musicPlacement
      ? musicPlacement.endTimeSec - musicPlacement.track.fadeOutSec
      : null,
    voiceoverSourceDurationSec: voiceoverPlacement?.sourceDurationSec ?? null,
    voiceoverUsedDurationSec: voiceoverPlacement?.usedDurationSec ?? null,
    voiceoverEndTimeSec: voiceoverPlacement?.endTimeSec ?? null,
    speechSegments: getProjectVoiceActivitySegments(project),
    musicGainSchedule: music ? createGainEnvelopePoints(music, project) : [],
    representativeMusicGains: {
      firstSpeech: gainAt(10),
      meaningfulSilence: gainAt(40),
      quieterResumedSpeech: gainAt(57),
      postVoiceover: gainAt(62),
      finalFade: gainAt(67.5),
    },
  };
};

const collectRenderedAudioEvidence = async (project: VideoProject, blob: Blob) => {
  if (!getCurrentVoiceActivityEnvelope(project)) return undefined;
  const AudioContextConstructor = window.AudioContext
    ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error('Rendered audio evidence cannot be decoded in this browser.');
  const context = new AudioContextConstructor();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const sampleWindowSec = 0.4;
    const founderEquivalent = getProjectDurationSec(project) >= 60;
    const speechOneTimeSec = founderEquivalent ? 10 : 1.5;
    const longSilenceTimeSec = founderEquivalent ? 40 : 5;
    const speechTwoTimeSec = founderEquivalent ? 57 : 8.25;
    const postVoiceoverTimeSec = founderEquivalent ? 62 : undefined;
    const finalFadeTimeSec = founderEquivalent ? 67.5 : undefined;
    const music = project.audioTracks.find((track) => track.kind === 'music');
    if (!music) throw new Error('Rendered audio evidence requires fixture music.');
    return {
      channel: Math.min(1, decoded.numberOfChannels - 1),
      sampleWindowSec,
      speechOneRms: measureAudioBufferRms(decoded, 1, speechOneTimeSec, sampleWindowSec),
      longSilenceRms: measureAudioBufferRms(decoded, 1, longSilenceTimeSec, sampleWindowSec),
      speechTwoRms: measureAudioBufferRms(decoded, 1, speechTwoTimeSec, sampleWindowSec),
      ...(postVoiceoverTimeSec === undefined ? {} : {
        postVoiceoverRms: measureAudioBufferRms(decoded, 1, postVoiceoverTimeSec, sampleWindowSec),
      }),
      ...(finalFadeTimeSec === undefined ? {} : {
        finalFadeRms: measureAudioBufferRms(decoded, 1, finalFadeTimeSec, sampleWindowSec),
      }),
      intendedMusicGains: {
        speechOne: audioGainAtTime(music, project, speechOneTimeSec),
        longSilence: audioGainAtTime(music, project, longSilenceTimeSec),
        speechTwo: audioGainAtTime(music, project, speechTwoTimeSec),
        ...(postVoiceoverTimeSec === undefined ? {} : {
          postVoiceover: audioGainAtTime(music, project, postVoiceoverTimeSec),
        }),
        ...(finalFadeTimeSec === undefined ? {} : {
          finalFade: audioGainAtTime(music, project, finalFadeTimeSec),
        }),
      },
    };
  } finally {
    await context.close();
  }
};

export function VideoWorkspacePage() {
  const repository = useMemo(() => new LocalProjectRepository(), []);
  const runtime = useMemo(() => new ProjectAssetRuntime(), []);
  const abortControllerRef = useRef<AbortController | null>(null);
  const mediaOperationRef = useRef(false);
  const mediaOperationEpochRef = useRef(0);
  const mediaValidationDelayMsRef = useRef(0);
  const projectOpenDelayMsRef = useRef(0);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState('');
  const [propertyAddressDraft, setPropertyAddressDraft] = useState('');
  const [localProjects, setLocalProjects] = useState<LocalProjectSummary[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(true);
  const [homeError, setHomeError] = useState<string | null>(null);
  const [mediaIssues, setMediaIssues] = useState<MediaIntakeIssue[]>([]);
  const [mediaBusy, setMediaBusy] = useState(false);
  const [photoRightsConfirmed, setPhotoRightsConfirmed] = useState(false);
  const [photoRightsDetails, setPhotoRightsDetails] = useState<OperatorRightsInput>(EMPTY_OPERATOR_RIGHTS);
  const [focusShotId, setFocusShotId] = useState<string | null>(null);
  const [renderProgress, setRenderProgress] = useState<RenderProgress | null>(null);
  const [renderedVideo, setRenderedVideo] = useState<RenderedVideo | null>(null);
  const [renderedSourceFingerprint, setRenderedSourceFingerprint] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedProjectFingerprint, setSavedProjectFingerprint] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const projectFingerprint = useMemo(() => project ? stableHash(project) : null, [project]);
  const headerDraftDirty = project !== null && (
    projectNameDraft !== project.name
    || propertyAddressDraft !== (project.propertyAddress ?? '')
  );
  const hasUnsavedChanges = projectFingerprint !== null
    && (projectFingerprint !== savedProjectFingerprint || headerDraftDirty);
  const projectLocked = rendering || saving || mediaBusy;

  const notify = useCallback((message: string, error = false) => {
    const id = createStableId('toast');
    setToasts((current) => [...current, { id, message, error }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200);
  }, []);

  const beginMediaOperation = useCallback(() => {
    if (mediaOperationRef.current || rendering || saving) return null;
    mediaOperationRef.current = true;
    setMediaBusy(true);
    return mediaOperationEpochRef.current;
  }, [rendering, saving]);

  const mediaOperationIsCurrent = useCallback((epoch: number) =>
    mediaOperationRef.current && mediaOperationEpochRef.current === epoch, []);

  const finishMediaOperation = useCallback((epoch: number) => {
    if (!mediaOperationIsCurrent(epoch)) return;
    mediaOperationRef.current = false;
    setMediaBusy(false);
  }, [mediaOperationIsCurrent]);

  const invalidateMediaOperations = useCallback(() => {
    mediaOperationEpochRef.current += 1;
    mediaOperationRef.current = false;
    setMediaBusy(false);
  }, []);

  const applyHeaderDrafts = useCallback((current: VideoProject) =>
    syncPresentationOverlays(updateProjectDetails(current, {
      name: projectNameDraft.trim() || 'Untitled property video',
      propertyAddress: propertyAddressDraft.trim() || undefined,
    })), [projectNameDraft, propertyAddressDraft]);

  const commitHeaderDrafts = useCallback((current: VideoProject) => {
    if (
      projectNameDraft === current.name
      && propertyAddressDraft === (current.propertyAddress ?? '')
    ) return;
    const next = applyHeaderDrafts(current);
    setProjectNameDraft(next.name);
    setPropertyAddressDraft(next.propertyAddress ?? '');
    setProject(next);
  }, [applyHeaderDrafts, projectNameDraft, propertyAddressDraft]);

  const refreshProjects = useCallback(async () => {
    setLoadingProjects(true);
    setHomeError(null);
    try {
      setLocalProjects(await repository.list());
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'Local projects could not be read.');
    } finally {
      setLoadingProjects(false);
    }
  }, [repository]);

  useEffect(() => {
    void refreshProjects();
    return () => {
      abortControllerRef.current?.abort();
      mediaOperationEpochRef.current += 1;
      mediaOperationRef.current = false;
      runtime.clear();
      repository.close();
    };
  }, [refreshProjects, repository, runtime]);

  useEffect(() => {
    if (
      project
      && renderedVideo
      && renderedSourceFingerprint !== renderSourceFingerprint(project)
    ) {
      setRenderedVideo(null);
      setRenderedSourceFingerprint(null);
      setRenderProgress(null);
    }
  }, [project, renderedSourceFingerprint, renderedVideo]);

  useEffect(() => {
    if (!hasUnsavedChanges && !saving && !mediaBusy) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [hasUnsavedChanges, mediaBusy, saving]);

  const createProject = () => {
    invalidateMediaOperations();
    runtime.clear();
    const nextProject = createNewProject();
    setProjectNameDraft(nextProject.name);
    setPropertyAddressDraft(nextProject.propertyAddress ?? '');
    setProject(nextProject);
    setMediaIssues([]);
    setPhotoRightsConfirmed(false);
    setPhotoRightsDetails(EMPTY_OPERATOR_RIGHTS);
    setRenderedVideo(null);
    setRenderedSourceFingerprint(null);
    setRenderError(null);
    setSavedProjectFingerprint(null);
  };

  const openProject = async (projectId: string) => {
    invalidateMediaOperations();
    const openEpoch = mediaOperationEpochRef.current;
    try {
      const loaded = await repository.load(projectId);
      if (import.meta.env.DEV && projectOpenDelayMsRef.current > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, projectOpenDelayMsRef.current));
      }
      if (mediaOperationEpochRef.current !== openEpoch) return;
      setPhotoRightsConfirmed(false);
      setPhotoRightsDetails(EMPTY_OPERATOR_RIGHTS);
      runtime.setAll(loaded.blobs);
      const activity = await ensureProjectVoiceActivityEnvelope(loaded.project, runtime);
      if (mediaOperationEpochRef.current !== openEpoch) return;
      const openedProject = activity.project;
      if (activity.analysisPerformed) {
        try {
          await repository.save(openedProject, runtime.snapshot());
        } catch (error) {
          notify(
            `Speech activity was recalculated for this session but could not be cached: ${error instanceof Error ? error.message : 'the local project could not be updated.'}`,
            true,
          );
        }
        if (mediaOperationEpochRef.current !== openEpoch) return;
      }
      setProjectNameDraft(openedProject.name);
      setPropertyAddressDraft(openedProject.propertyAddress ?? '');
      setProject(openedProject);
      setMediaIssues([
        ...loaded.missingAssetIds.map((assetId) => ({
          code: 'CORRUPT_FILE' as const,
          filename: loaded.project.mediaAssets.find((asset) => asset.id === assetId)?.fileName,
          severity: 'error' as const,
          message: 'This saved local asset is missing. Replace the affected shot or media item before export.',
        })),
        ...loaded.corruptAssetIds.map((assetId) => ({
          code: 'CORRUPT_FILE' as const,
          filename: loaded.project.mediaAssets.find((asset) => asset.id === assetId)?.fileName,
          severity: 'error' as const,
          message: 'This saved local asset failed its size or SHA-256 integrity check. Replace it before export.',
        })),
      ]);
      setRenderedVideo(null);
      setRenderedSourceFingerprint(null);
      setRenderError(null);
      setSavedProjectFingerprint(stableHash(openedProject));
    } catch (error) {
      if (mediaOperationEpochRef.current === openEpoch) {
        setHomeError(error instanceof Error ? error.message : 'The local project could not be opened.');
      }
    }
  };

  const deleteProject = async (summary: LocalProjectSummary) => {
    if (!window.confirm(`Delete “${summary.name}” and its local media from this browser?`)) return;
    invalidateMediaOperations();
    try {
      await repository.delete(summary.storageKey);
      await refreshProjects();
    } catch (error) {
      setHomeError(error instanceof Error ? error.message : 'The local project could not be deleted.');
    }
  };

  const saveProject = async () => {
    if (!project || saving || mediaBusy || mediaOperationRef.current) return;
    setSaving(true);
    try {
      const validated = VideoProjectSchema.parse(applyHeaderDrafts(project));
      await repository.save(validated, runtime.snapshot());
      setProjectNameDraft(validated.name);
      setPropertyAddressDraft(validated.propertyAddress ?? '');
      setProject(validated);
      setSavedProjectFingerprint(stableHash(validated));
      notify('Project and local media saved in this browser.');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The project could not be saved.', true);
    } finally {
      setSaving(false);
    }
  };

  const closeProject = () => {
    if (saving || mediaBusy || mediaOperationRef.current) return;
    if (hasUnsavedChanges && !window.confirm('Close this local project and discard unsaved changes?')) return;
    abortControllerRef.current?.abort();
    runtime.clear();
    setProject(null);
    setProjectNameDraft('');
    setPropertyAddressDraft('');
    setRenderedVideo(null);
    setRenderedSourceFingerprint(null);
    setRenderProgress(null);
    setRenderError(null);
    setPhotoRightsConfirmed(false);
    setPhotoRightsDetails(EMPTY_OPERATOR_RIGHTS);
    setSavedProjectFingerprint(null);
    invalidateMediaOperations();
    void refreshProjects();
  };

  const addPhotos = async (files: readonly File[]) => {
    if (!project) return;
    if (!photoRightsConfirmed || !operatorRightsAreComplete(photoRightsDetails)) {
      setMediaIssues([{ code: 'EMPTY_BATCH', severity: 'warning', message: 'Record source, owner and permission basis, then confirm photograph authorisation.' }]);
      return;
    }
    const operationEpoch = beginMediaOperation();
    if (operationEpoch === null) return;
    try {
      if (import.meta.env.DEV && mediaValidationDelayMsRef.current > 0) {
        await new Promise((resolve) => window.setTimeout(resolve, mediaValidationDelayMsRef.current));
        if (!mediaOperationIsCurrent(operationEpoch)) return;
      }
      const photos = project.mediaAssets.filter((asset) => asset.kind === 'image');
      const result = await validateImageBatch(files, {
        currentImageCount: photos.length,
        currentTotalBytes: photos.reduce((sum, asset) => sum + asset.fileSizeBytes, 0),
        existingHashes: new Set(photos.map((asset) => asset.contentHash)),
      });
      if (!mediaOperationIsCurrent(operationEpoch)) return;
      setMediaIssues(result.issues);
      if (!result.accepted.length) return;
      const rights = createOperatorConfirmedRights(
        'This client property video and local operator exports',
        photoRightsDetails,
      );
      const assets = result.accepted.map((accepted) => createImageMediaAsset(accepted, 'image', rights));
      const mediaAssets = [...project.mediaAssets, ...assets];
      const shots = assets.map((asset, index) => {
        const preset = MOTION_ROTATION[(project.shots.length + index) % MOTION_ROTATION.length]!;
        const crops = createMotionPresetCrops(preset, {
          width: asset.decodedWidth!,
          height: asset.decodedHeight!,
        }, project.canvas);
        return createSingleImageShot({
          id: createStableId('shot'),
          startAssetId: asset.id,
          durationSec: 3,
          motionPreset: preset,
          startCrop: crops.start,
          endCrop: crops.end,
        }, mediaAssets);
      });
      for (let index = 0; index < assets.length; index += 1) {
        runtime.set(assets[index]!.id, result.accepted[index]!.file);
      }
      setProject(syncPresentationOverlays(addWorkspaceMedia(project, assets, shots)));
      setRenderedVideo(null);
      notify(`${assets.length} photograph${assets.length === 1 ? '' : 's'} added to the storyboard.`);
    } catch (error) {
      if (mediaOperationIsCurrent(operationEpoch)) {
        setMediaIssues([{ code: 'CORRUPT_FILE', severity: 'error', message: error instanceof Error ? error.message : 'The photographs could not be added.' }]);
      }
    } finally {
      finishMediaOperation(operationEpoch);
    }
  };

  const replacePhoto = async (shotId: string, slot: 'start' | 'end', file: File) => {
    if (!project) return;
    if (!photoRightsConfirmed || !operatorRightsAreComplete(photoRightsDetails)) {
      notify('Record the photograph source, owner and permission basis before replacing a shot.', true);
      return;
    }
    const operationEpoch = beginMediaOperation();
    if (operationEpoch === null) return;
    let addedAssetId: string | null = null;
    try {
      const result = await validateImageBatch([file], {
        mode: 'replacement',
        currentTotalBytes: project.mediaAssets
          .filter((asset) => asset.kind === 'image')
          .reduce((sum, asset) => sum + asset.fileSizeBytes, 0),
        existingHashes: new Set(project.mediaAssets.map((asset) => asset.contentHash)),
      });
      if (!mediaOperationIsCurrent(operationEpoch)) return;
      setMediaIssues(result.issues);
      if (!result.accepted[0]) return;
      const asset = createImageMediaAsset(
        result.accepted[0],
        'image',
        createOperatorConfirmedRights(
          'Replacement photograph in this client property video and local exports',
          photoRightsDetails,
        ),
      );
      addedAssetId = asset.id;
      runtime.set(asset.id, file);
      const withAsset = addWorkspaceMedia(project, [asset]);
      setProject(syncPresentationOverlays(setWorkspaceShotAsset(withAsset, shotId, slot, asset.id)));
      setRenderedVideo(null);
      notify(`Shot photograph replaced. Other shot settings were retained.`);
    } catch (error) {
      if (addedAssetId) runtime.delete(addedAssetId);
      if (mediaOperationIsCurrent(operationEpoch)) {
        notify(error instanceof Error ? error.message : 'The shot could not be replaced.', true);
      }
    } finally {
      finishMediaOperation(operationEpoch);
    }
  };

  const moveShot = (shotId: string, direction: 'up' | 'down') => {
    if (!project) return;
    const index = project.orderedShotIds.indexOf(shotId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (target < 0 || target >= project.orderedShotIds.length) return;
    const order = [...project.orderedShotIds];
    [order[index], order[target]] = [order[target]!, order[index]!];
    setProject(reorderWorkspaceShots(project, order));
    setRenderedVideo(null);
  };

  const moveShotBefore = (shotId: string, targetShotId: string) => {
    if (!project) return;
    const order = project.orderedShotIds.filter((id) => id !== shotId);
    const target = order.indexOf(targetShotId);
    order.splice(Math.max(0, target), 0, shotId);
    setProject(reorderWorkspaceShots(project, order));
    setRenderedVideo(null);
  };

  const setShotSource = (shotId: string, sourceMode: 'single' | 'pair') => {
    if (!project) return;
    try {
      const shot = project.shots.find((candidate) => candidate.id === shotId);
      const endAsset = project.mediaAssets.find((asset) => asset.kind === 'image' && asset.id !== shot?.startAssetId);
      setProject(setWorkspaceShotSourceMode(project, shotId, sourceMode, endAsset?.id));
      setRenderedVideo(null);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'The source mode could not be changed.', true);
    }
  };

  const clearUnused = () => {
    if (!project) return;
    const cleared = clearUnusedMedia(project);
    for (const assetId of cleared.removedAssetIds) runtime.delete(assetId);
    setProject(cleared.project);
    notify(`${cleared.removedAssetIds.length} unused local media item${cleared.removedAssetIds.length === 1 ? '' : 's'} cleared.`);
  };

  const handleAudioFile = async (
    kind: 'music' | 'voiceover',
    file: File | null,
    rightsDetails?: OperatorRightsInput,
  ) => {
    if (!project || mediaOperationRef.current) return;
    const existingTrack = project.audioTracks.find((track) => track.kind === kind);
    const existingAssetId = existingTrack?.assetId;
    if (!file) {
      if (existingAssetId) runtime.delete(existingAssetId);
      setProject(finalizeWorkspaceProject({
        ...project,
        audioTracks: project.audioTracks.filter((track) => track.kind !== kind),
        mediaAssets: project.mediaAssets.filter((asset) => asset.id !== existingAssetId),
        voiceActivityEnvelope: kind === 'voiceover'
          ? undefined
          : project.voiceActivityEnvelope,
      }));
      return;
    }
    if (!rightsDetails || !operatorRightsAreComplete(rightsDetails)) {
      notify('Record the production-media source, owner and permission basis before adding audio.', true);
      return;
    }
    const operationEpoch = beginMediaOperation();
    if (operationEpoch === null) return;
    try {
      const result = await validateAudioFile(file);
      if (!mediaOperationIsCurrent(operationEpoch)) return;
      if (!result.accepted) {
        notify(result.issues[0]?.message ?? 'This audio file could not be used.', true);
        return;
      }
      const asset = createAudioMediaAsset(
        result.accepted,
        createOperatorConfirmedRights(
          `${kind === 'music' ? 'Music' : 'Voiceover'} in this client property video and local exports`,
          rightsDetails ?? EMPTY_OPERATOR_RIGHTS,
        ),
      );
      const totalDuration = Math.max(0.001, getShotsDurationSec(project) + (project.endCard.enabled ? project.endCard.durationSec : 0));
      const durationSec = kind === 'music' ? totalDuration : Math.min(totalDuration, result.accepted.durationSec);
      const fade = Math.min(kind === 'music' ? 1.5 : 0.5, durationSec / 2);
      const track: AudioTrack = {
        id: existingTrack?.id ?? createStableId('audio'),
        assetId: asset.id,
        kind,
        startTimeSec: 0,
        durationSec,
        trimStartSec: 0,
        volume: kind === 'music' ? 0.35 : 0.9,
        fadeInSec: fade,
        fadeOutSec: fade,
        loop: kind === 'music',
        duckUnderVoice: kind === 'music',
        enabled: true,
      };
      const voiceActivityEnvelope = kind === 'voiceover'
        ? result.accepted.decodedAudioBuffer
          ? analyseVoiceActivity(result.accepted.decodedAudioBuffer, asset.id, asset.contentHash)
          : await analyseVoiceActivityBlob(file, asset.id, asset.contentHash)
        : project.voiceActivityEnvelope;
      if (!mediaOperationIsCurrent(operationEpoch)) return;
      const nextProject = finalizeWorkspaceProject({
        ...project,
        mediaAssets: [...project.mediaAssets.filter((item) => item.id !== existingAssetId), asset],
        audioTracks: [...project.audioTracks.filter((item) => item.kind !== kind), track],
        voiceActivityEnvelope,
      });
      runtime.set(asset.id, file);
      if (existingAssetId) runtime.delete(existingAssetId);
      setProject(nextProject);
      notify(`${kind === 'music' ? 'Music' : 'Voiceover'} added with local rights metadata.`);
    } catch (error) {
      if (mediaOperationIsCurrent(operationEpoch)) {
        notify(error instanceof Error ? error.message : 'This audio file could not be used.', true);
      }
    } finally {
      finishMediaOperation(operationEpoch);
    }
  };

  const handleAudioChange = (kind: 'music' | 'voiceover', patch: Partial<AudioTrack>) => {
    if (!project) return;
    setProject(finalizeWorkspaceProject({
      ...project,
      audioTracks: project.audioTracks.map((track) => {
        if (track.kind !== kind) return track;
        const next = { ...track, ...patch };
        if (next.fadeInSec + next.fadeOutSec > next.durationSec) {
          next.fadeInSec = Math.min(next.fadeInSec, next.durationSec / 2);
          next.fadeOutSec = Math.min(next.fadeOutSec, next.durationSec / 2);
        }
        return next;
      }),
    }));
    setRenderedVideo(null);
  };

  const handleBrandFile = async (
    kind: 'logo' | 'watermark',
    file: File | null,
    rightsDetails?: OperatorRightsInput,
  ) => {
    if (!project || mediaOperationRef.current) return;
    const oldAssetId = kind === 'logo'
      ? project.endCard.logoAssetId
      : project.overlays.find((overlay) => overlay.kind === 'watermark')?.assetId;
    if (!file) {
      if (oldAssetId) runtime.delete(oldAssetId);
      const withoutAsset: VideoProject = {
        ...project,
        mediaAssets: project.mediaAssets.filter((asset) => asset.id !== oldAssetId),
        endCard: kind === 'logo' ? { ...project.endCard, logoAssetId: undefined } : project.endCard,
        overlays: kind === 'watermark'
          ? project.overlays.filter((overlay) => overlay.kind !== 'watermark')
          : project.overlays,
      };
      setProject(syncPresentationOverlays(finalizeWorkspaceProject(withoutAsset)));
      return;
    }
    if (!rightsDetails || !operatorRightsAreComplete(rightsDetails)) {
      notify('Record the production-media source, owner and permission basis before adding branding.', true);
      return;
    }
    const operationEpoch = beginMediaOperation();
    if (operationEpoch === null) return;
    try {
      const result = await validateImageBatch([file], { mode: 'branding' });
      if (!mediaOperationIsCurrent(operationEpoch)) return;
      if (!result.accepted[0]) {
        notify(result.issues[0]?.message ?? `This ${kind} could not be used.`, true);
        return;
      }
      const asset = createImageMediaAsset(
        result.accepted[0],
        kind,
        createOperatorConfirmedRights(
          `${kind} in this client's branded local property video output`,
          rightsDetails ?? EMPTY_OPERATOR_RIGHTS,
        ),
      );
      const base: VideoProject = {
        ...project,
        mediaAssets: [...project.mediaAssets.filter((item) => item.id !== oldAssetId), asset],
        endCard: kind === 'logo' ? { ...project.endCard, logoAssetId: asset.id } : project.endCard,
        overlays: kind === 'watermark'
          ? [
              ...project.overlays.filter((overlay) => overlay.kind !== 'watermark'),
              {
                id: 'overlay-watermark',
                kind: 'watermark',
                assetId: asset.id,
                opacity: 0.68,
                timing: { startTimeSec: 0, durationSec: Math.max(0.001, getShotsDurationSec(project)) },
              },
            ]
          : project.overlays,
      };
      const nextProject = syncPresentationOverlays(finalizeWorkspaceProject(base));
      runtime.set(asset.id, file);
      if (oldAssetId) runtime.delete(oldAssetId);
      setProject(nextProject);
      notify(`${kind === 'logo' ? 'Logo' : 'Watermark'} added for branded output.`);
    } catch (error) {
      if (mediaOperationIsCurrent(operationEpoch)) {
        notify(error instanceof Error ? error.message : `This ${kind} could not be used.`, true);
      }
    } finally {
      finishMediaOperation(operationEpoch);
    }
  };

  const startRender = async () => {
    if (!project || rendering || saving || mediaBusy || mediaOperationRef.current) return;
    setRenderError(null);
    setRenderedVideo(null);
    let startedProject: VideoProject | null = null;
    let jobId = '';
    try {
      const prepared = VideoProjectSchema.parse(applyHeaderDrafts(project));
      const photoCount = prepared.mediaAssets.filter((asset) => asset.kind === 'image').length;
      if (photoCount < 15 || photoCount > 30) throw new Error('A complete export requires 15 to 30 photographs. Clear unused media if needed.');
      const requiredIds = getReferencedAssetIds(prepared);
      const missing = [...requiredIds].filter((assetId) => !runtime.has(assetId));
      if (missing.length) throw new Error(`${missing.length} referenced local media item${missing.length === 1 ? ' is' : 's are'} missing. Replace the affected media before export.`);
      const rightsMissing = prepared.mediaAssets.filter((asset) => requiredIds.has(asset.id) && !mediaRightsAreRecorded(asset));
      if (rightsMissing.length) throw new Error('Media-rights metadata is incomplete for one or more selected files.');

      jobId = createStableId('render');
      const createdAt = new Date().toISOString();
      const job: RenderJob = {
        id: jobId,
        projectId: prepared.id,
        outputVariant: prepared.outputVariant,
        outputProfileId: prepared.outputProfile.id,
        status: 'rendering',
        progress: 0,
        createdAt,
        startedAt: createdAt,
        totalFrames: getProjectFrameCount(prepared),
        renderedFrames: 0,
      };
      startedProject = VideoProjectSchema.parse({
        ...prepared,
        renderStatus: 'rendering',
        renderJobs: [...prepared.renderJobs, job],
        lastRenderJobId: jobId,
      });
      setProject(startedProject);
      setRendering(true);
      const controller = new AbortController();
      abortControllerRef.current = controller;
      const result = await renderProjectToMp4(startedProject, runtime, {
        signal: controller.signal,
        onProgress: setRenderProgress,
      });
      const completedAt = new Date().toISOString();
      const succeeded = VideoProjectSchema.parse({
        ...startedProject,
        updatedAt: completedAt,
        renderStatus: 'succeeded',
        renderJobs: startedProject.renderJobs.map((candidate) => candidate.id === jobId ? {
          ...candidate,
          status: 'succeeded',
          progress: 1,
          renderedFrames: candidate.totalFrames,
          completedAt,
          outputFileName: result.fileName,
          outputSizeBytes: result.blob.size,
        } : candidate),
      });
      setProject(succeeded);
      setRenderedVideo(result);
      setRenderedSourceFingerprint(renderSourceFingerprint(succeeded));
      downloadRenderedVideo(result);
      await repository.save(succeeded, runtime.snapshot());
      setSavedProjectFingerprint(stableHash(succeeded));
      notify('Real MP4 rendered, inspected, downloaded and saved to the local project record.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'The local export failed.';
      setRenderError(message);
      if (startedProject && jobId) {
        const controlled = createControlledRenderError(error);
        const completedAt = new Date().toISOString();
        const cancelled = error instanceof RenderCancelledError;
        const failedProject = VideoProjectSchema.parse({
          ...startedProject,
          updatedAt: completedAt,
          renderStatus: cancelled ? 'cancelled' : 'failed',
          renderJobs: startedProject.renderJobs.map((candidate) => candidate.id === jobId ? {
            ...candidate,
            status: cancelled ? 'cancelled' : 'failed',
            completedAt,
            ...(cancelled ? {} : { error: controlled }),
          } : candidate),
        });
        setProject(failedProject);
      }
      notify(message, !((error instanceof RenderCancelledError)));
    } finally {
      abortControllerRef.current = null;
      setRendering(false);
    }
  };

  useEffect(() => {
    if (!import.meta.env.DEV) return undefined;
    const api: BrowserVerificationApi = {
      setMediaValidationDelay: (delayMs) => {
        mediaValidationDelayMsRef.current = Math.max(0, Math.min(delayMs, 2_000));
      },
      setProjectOpenDelay: (delayMs) => {
        projectOpenDelayMsRef.current = Math.max(0, Math.min(delayMs, 2_000));
      },
      measureVoiceAnalysisPerformance: () => [30, 120].map((durationSec, index) => {
        const source = createRepresentativeVoiceActivitySampleSource(durationSec);
        const memory = (performance as Performance & {
          memory?: { usedJSHeapSize: number };
        }).memory;
        const heapBefore = memory?.usedJSHeapSize;
        const startedAt = performance.now();
        const envelope = analyseVoiceActivity(
          source,
          `performance-voice-${index + 1}`,
          String(index + 1).repeat(64),
        );
        const elapsedMs = performance.now() - startedAt;
        const heapAfter = memory?.usedJSHeapSize;
        return {
          durationSec,
          elapsedMs,
          activeSegments: envelope.activeSegments.length,
          approximateHeapDeltaBytes: heapBefore === undefined || heapAfter === undefined
            ? null
            : Math.max(0, heapAfter - heapBefore),
        };
      }),
      loadFixture: async (count, variant = 'branded') => {
        invalidateMediaOperations();
        const builder = count === 6
          ? buildCanonicalRendererFixture
          : count === 15
            ? buildFifteenShotFixture
            : buildThirtyShotFixture;
        const bundle = await builder({ outputVariant: variant });
        runtime.setAll(bundle.blobs);
        setProjectNameDraft(bundle.project.name);
        setPropertyAddressDraft(bundle.project.propertyAddress ?? '');
        setProject(bundle.project);
        setMediaIssues(bundle.intakeIssues);
        setRenderedVideo(null);
        setRenderedSourceFingerprint(null);
        setRenderError(null);
        setRenderProgress(null);
        setSavedProjectFingerprint(null);
        return {
          projectId: bundle.project.id,
          shots: bundle.project.shots.length,
          assets: bundle.project.mediaAssets.length,
        };
      },
      loadVoiceoverFixture: async () => {
        invalidateMediaOperations();
        const bundle = await buildVoiceoverDuckingRendererFixture();
        const voiceover = bundle.project.audioTracks.find((track) => track.kind === 'voiceover')!;
        const voiceoverAsset = bundle.project.mediaAssets.find((asset) => asset.id === voiceover.assetId)!;
        const voiceoverBlob = bundle.blobs.get(voiceover.assetId)!;
        const memory = (performance as Performance & {
          memory?: { usedJSHeapSize: number };
        }).memory;
        const heapBefore = memory?.usedJSHeapSize;
        const startedAt = performance.now();
        await analyseVoiceActivityBlob(voiceoverBlob, voiceoverAsset.id, voiceoverAsset.contentHash);
        const analysisElapsedMs = performance.now() - startedAt;
        const heapAfter = memory?.usedJSHeapSize;
        runtime.setAll(bundle.blobs);
        setProjectNameDraft(bundle.project.name);
        setPropertyAddressDraft(bundle.project.propertyAddress ?? '');
        setProject(bundle.project);
        setMediaIssues(bundle.intakeIssues);
        setRenderedVideo(null);
        setRenderedSourceFingerprint(null);
        setRenderError(null);
        setRenderProgress(null);
        setSavedProjectFingerprint(null);
        return {
          projectId: bundle.project.id,
          shots: bundle.project.shots.length,
          assets: bundle.project.mediaAssets.length,
          activeSegments: getCurrentVoiceActivityEnvelope(bundle.project)?.activeSegments.length ?? 0,
          analysisElapsedMs,
          approximateAnalysisHeapDeltaBytes: heapBefore === undefined || heapAfter === undefined
            ? null
            : Math.max(0, heapAfter - heapBefore),
        };
      },
      loadAudioRepairFixture: async () => {
        invalidateMediaOperations();
        const bundle = await buildFounderAudioRepairFixture();
        const initialProject = syncPresentationOverlays(retimeWorkspaceShot(
          bundle.project,
          bundle.project.orderedShotIds[0]!,
          5,
        ));
        runtime.setAll(bundle.blobs);
        setProjectNameDraft(initialProject.name);
        setPropertyAddressDraft(initialProject.propertyAddress ?? '');
        setProject(initialProject);
        setMediaIssues(bundle.intakeIssues);
        setRenderedVideo(null);
        setRenderedSourceFingerprint(null);
        setRenderError(null);
        setRenderProgress(null);
        setSavedProjectFingerprint(null);
        return {
          projectId: initialProject.id,
          shots: initialProject.shots.length,
          assets: initialProject.mediaAssets.length,
          audio: getAudioRuntimeState(initialProject),
        };
      },
      recalculateMissingEnvelopeAndReopen: async () => {
        if (!project) throw new Error('No fixture project is open.');
        const withoutEnvelope = VideoProjectSchema.parse({
          ...project,
          voiceActivityEnvelope: undefined,
        });
        await repository.save(withoutEnvelope, runtime.snapshot());
        const missingStartedAt = performance.now();
        const loadedWithoutEnvelope = await repository.load(project.id);
        runtime.setAll(loadedWithoutEnvelope.blobs);
        const recalculated = await ensureProjectVoiceActivityEnvelope(loadedWithoutEnvelope.project, runtime);
        await repository.save(recalculated.project, runtime.snapshot());
        const missingEnvelopeReopenElapsedMs = performance.now() - missingStartedAt;
        const cachedStartedAt = performance.now();
        const persisted = await repository.load(project.id);
        runtime.setAll(persisted.blobs);
        const cached = await ensureProjectVoiceActivityEnvelope(persisted.project, runtime);
        const cachedEnvelopeReopenElapsedMs = performance.now() - cachedStartedAt;
        setProjectNameDraft(cached.project.name);
        setPropertyAddressDraft(cached.project.propertyAddress ?? '');
        setProject(cached.project);
        setSavedProjectFingerprint(stableHash(cached.project));
        return {
          analysisPerformed: recalculated.analysisPerformed,
          persistedSegments: getCurrentVoiceActivityEnvelope(persisted.project)?.activeSegments.length ?? 0,
          missingEnvelopeReopenElapsedMs,
          cachedEnvelopeReopenElapsedMs,
        };
      },
      prepareMissingEnvelopeDamagedReopen: async () => {
        if (!project) throw new Error('No fixture project is open.');
        const imageAsset = project.mediaAssets.find((asset) => asset.kind === 'image');
        if (!imageAsset) throw new Error('No fixture photograph is available to corrupt.');
        const withoutEnvelope = VideoProjectSchema.parse({
          ...project,
          voiceActivityEnvelope: undefined,
        });
        await repository.save(withoutEnvelope, runtime.snapshot());
        setProject(withoutEnvelope);
        setSavedProjectFingerprint(stableHash(withoutEnvelope));
        return { projectId: project.id, imageAssetId: imageAsset.id };
      },
      state: () => ({
        projectId: project?.id ?? null,
        shots: project?.shots.length ?? 0,
        assets: project?.mediaAssets.length ?? 0,
        voiceActivitySegments: project
          ? getCurrentVoiceActivityEnvelope(project)?.activeSegments.length ?? 0
          : 0,
        orderedShotIds: project ? [...project.orderedShotIds] : [],
        shotSignatures: project ? project.orderedShotIds.map((shotId) => {
          const shot = project.shots.find((candidate) => candidate.id === shotId)!;
          return {
            id: shot.id,
            startAssetId: shot.startAssetId,
            ...(shot.sourceMode === 'pair' ? { endAssetId: shot.endAssetId } : {}),
            durationSec: shot.durationSec,
            contentHash: shot.contentHash,
            settingsHash: shot.settingsHash,
          };
        }) : [],
        firstShot: project?.shots[0] ? {
          id: project.shots[0].id,
          contentHash: project.shots[0].contentHash,
          settingsHash: project.shots[0].settingsHash,
          durationSec: project.shots[0].durationSec,
        } : undefined,
        audio: project ? getAudioRuntimeState(project) : undefined,
      }),
      saveAndReopen: async () => {
        if (!project) throw new Error('No fixture project is open.');
        await repository.save(project, runtime.snapshot());
        const loaded = await repository.load(project.id);
        runtime.setAll(loaded.blobs);
        setProjectNameDraft(loaded.project.name);
        setPropertyAddressDraft(loaded.project.propertyAddress ?? '');
        setProject(loaded.project);
        setSavedProjectFingerprint(stableHash(loaded.project));
        return {
          projectId: loaded.project.id,
          missingAssetIds: loaded.missingAssetIds,
          corruptAssetIds: loaded.corruptAssetIds,
          shots: loaded.project.shots.length,
          voiceActivitySegments: getCurrentVoiceActivityEnvelope(loaded.project)?.activeSegments.length ?? 0,
          voiceActivitySourceHash: getCurrentVoiceActivityEnvelope(loaded.project)?.sourceContentHash,
          audio: getAudioRuntimeState(loaded.project),
        };
      },
      reopenWithoutSave: async () => {
        if (!project) throw new Error('No fixture project is open.');
        runtime.clear();
        const loaded = await repository.load(project.id);
        runtime.setAll(loaded.blobs);
        setProjectNameDraft(loaded.project.name);
        setPropertyAddressDraft(loaded.project.propertyAddress ?? '');
        setProject(loaded.project);
        setSavedProjectFingerprint(stableHash(loaded.project));
        return {
          missingAssetIds: loaded.missingAssetIds,
          corruptAssetIds: loaded.corruptAssetIds,
        };
      },
      replaceFirstShot: async () => {
        if (!project?.shots[0]) throw new Error('No fixture shot is available.');
        const original = project;
        const originalShot = original.shots[0];
        const otherHashes = new Map(original.shots.slice(1).map((shot) => [shot.id, `${shot.contentHash}:${shot.settingsHash}`]));
        const file = new File(
          [await createSyntheticPropertyImage(777, 1920, 1080)],
          'synthetic-replacement.png',
          { type: 'image/png', lastModified: Date.UTC(2026, 7, 6) },
        );
        const intake = await validateImageBatch([file], { mode: 'replacement' });
        const accepted = intake.accepted[0];
        if (!accepted) throw new Error(intake.issues[0]?.message ?? 'Synthetic replacement failed intake.');
        const asset = createImageMediaAsset(
          accepted,
          'image',
          createOperatorConfirmedRights(
            'Internal synthetic browser verification replacement',
            SYNTHETIC_OPERATOR_RIGHTS,
            '2026-08-06T00:00:00.000Z',
          ),
        );
        runtime.set(asset.id, file);
        const next = setWorkspaceShotAsset(addWorkspaceMedia(original, [asset]), originalShot.id, 'start', asset.id);
        setProject(next);
        const nextShot = next.shots.find((shot) => shot.id === originalShot.id)!;
        const treatmentRetained = originalShot.sourceMode === nextShot.sourceMode
          && (originalShot.sourceMode === 'single' && nextShot.sourceMode === 'single'
            ? originalShot.motionPreset === nextShot.motionPreset
            : originalShot.sourceMode === 'pair' && nextShot.sourceMode === 'pair'
              ? originalShot.pairTreatment === nextShot.pairTreatment
              : false);
        return {
          stableShotId: nextShot.id === originalShot.id,
          settingsRetained: treatmentRetained
            && nextShot.durationSec === originalShot.durationSec
            && nextShot.easing === originalShot.easing,
          otherShotsUnchanged: next.shots.slice(1).every((shot) => otherHashes.get(shot.id) === `${shot.contentHash}:${shot.settingsHash}`),
        };
      },
      retimeFirstShot: (durationSec) => {
        if (!project?.shots[0]) throw new Error('No fixture shot is available.');
        const original = project;
        const originalShot = original.shots[0];
        const otherHashes = new Map(original.shots.slice(1).map((shot) => [shot.id, `${shot.contentHash}:${shot.settingsHash}`]));
        const next = syncPresentationOverlays(retimeWorkspaceShot(original, originalShot.id, durationSec));
        setProject(next);
        const nextShot = next.shots.find((shot) => shot.id === originalShot.id)!;
        return {
          stableShotId: nextShot.id === originalShot.id,
          otherShotsUnchanged: next.shots.slice(1).every((shot) => otherHashes.get(shot.id) === `${shot.contentHash}:${shot.settingsHash}`),
          durationSec: nextShot.durationSec,
          audio: getAudioRuntimeState(next),
        };
      },
      reorderFirstToLast: () => {
        if (!project || project.orderedShotIds.length < 2) throw new Error('Fixture requires at least two shots.');
        const firstShotId = project.orderedShotIds[0]!;
        const order = [...project.orderedShotIds.slice(1), firstShotId];
        const next = reorderWorkspaceShots(project, order);
        setProject(next);
        return { firstShotId, lastShotId: next.orderedShotIds.at(-1)! };
      },
      removeFirstRuntimeAsset: () => {
        if (!project?.shots[0]) return null;
        const assetId = project.shots[0].startAssetId;
        runtime.delete(assetId);
        return assetId;
      },
      replaceVoiceoverFixture: async () => {
        if (!project) throw new Error('No fixture project is open.');
        const existingTrack = project.audioTracks.find((track) => track.kind === 'voiceover');
        if (!existingTrack) throw new Error('No fixture voiceover is available to replace.');
        const oldAsset = project.mediaAssets.find((asset) => asset.id === existingTrack.assetId)!;
        const file = createSelfCreatedVoiceoverFile('edge-silence');
        const intake = await validateAudioFile(file);
        if (!intake.accepted) throw new Error(intake.issues[0]?.message ?? 'Synthetic replacement voiceover failed intake.');
        const asset = createAudioMediaAsset(intake.accepted, oldAsset.rights);
        const envelope = intake.accepted.decodedAudioBuffer
          ? analyseVoiceActivity(intake.accepted.decodedAudioBuffer, asset.id, asset.contentHash)
          : await analyseVoiceActivityBlob(file, asset.id, asset.contentHash);
        runtime.set(asset.id, file);
        runtime.delete(oldAsset.id);
        const next = finalizeWorkspaceProject({
          ...project,
          mediaAssets: [...project.mediaAssets.filter((candidate) => candidate.id !== oldAsset.id), asset],
          audioTracks: project.audioTracks.map((track) => track.kind === 'voiceover' ? {
            ...track,
            assetId: asset.id,
            durationSec: Math.min(track.durationSec, intake.accepted!.durationSec),
          } : track),
          voiceActivityEnvelope: envelope,
        });
        setProject(next);
        return {
          sourceChanged: envelope.sourceContentHash !== oldAsset.contentHash,
          activeSegments: envelope.activeSegments.length,
        };
      },
      removeVoiceoverFixture: () => {
        if (!project) throw new Error('No fixture project is open.');
        const voiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
        if (voiceover) runtime.delete(voiceover.assetId);
        const next = finalizeWorkspaceProject({
          ...project,
          mediaAssets: project.mediaAssets.filter((asset) => asset.id !== voiceover?.assetId),
          audioTracks: project.audioTracks.filter((track) => track.kind !== 'voiceover'),
          voiceActivityEnvelope: undefined,
        });
        setProject(next);
        return { removed: Boolean(voiceover), envelopeRemoved: next.voiceActivityEnvelope === undefined };
      },
      setDuckingEnabled: (enabled) => {
        if (!project) throw new Error('No fixture project is open.');
        const next = finalizeWorkspaceProject({
          ...project,
          audioTracks: project.audioTracks.map((track) => track.kind === 'music'
            ? { ...track, duckUnderVoice: enabled }
            : track),
        });
        setProject(next);
        const music = next.audioTracks.find((track) => track.kind === 'music')!;
        return {
          enabled: music.duckUnderVoice,
          speechGain: audioGainAtTime(music, next, 1.5),
          silenceGain: audioGainAtTime(music, next, 5),
        };
      },
      renderDirect: async (options = {}) => {
        if (!project) throw new Error('No fixture project is open.');
        const controller = new AbortController();
        abortControllerRef.current = controller;
        setRendering(true);
        setRenderError(null);
        try {
          const result = await renderProjectToMp4(VideoProjectSchema.parse(project), runtime, {
            signal: controller.signal,
            onProgress: (progress) => {
              setRenderProgress(progress);
              if (options.cancelAtFrame !== undefined && progress.frame >= options.cancelAtFrame) controller.abort();
              if (options.cancelAtStage === progress.stage) controller.abort();
            },
          });
          setRenderedVideo(result);
          setRenderedSourceFingerprint(renderSourceFingerprint(project));
          const parity = await compareExportedFrames(project, runtime, result.blob);
          const audioEvidence = await collectRenderedAudioEvidence(project, result.blob);
          if (options.download !== false) downloadRenderedVideo(result);
          return {
            elapsedMs: result.elapsedMs,
            sizeBytes: result.blob.size,
            inspection: result.inspection,
            parity,
            audioEvidence,
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Direct verification render failed.';
          setRenderError(message);
          return {
            cancelled: error instanceof RenderCancelledError,
            error: message,
          };
        } finally {
          abortControllerRef.current = null;
          setRendering(false);
        }
      },
    };
    window.__AIM_VIDEO_TEST__ = api;
    return () => {
      if (window.__AIM_VIDEO_TEST__ === api) delete window.__AIM_VIDEO_TEST__;
    };
  }, [invalidateMediaOperations, project, repository, runtime]);

  if (!project) {
    return (
      <div className="video-app">
        <ProjectHome
          projects={localProjects}
          loading={loadingProjects}
          error={homeError}
          onCreate={createProject}
          onOpen={(id) => { void openProject(id); }}
          onDelete={(summary) => { void deleteProject(summary); }}
        />
      </div>
    );
  }

  return (
    <div className="video-app">
      <header className="project-header">
        <div className="project-header__identity">
          <input
            value={projectNameDraft}
            aria-label="Project name"
            disabled={projectLocked}
            onChange={(event) => setProjectNameDraft(event.target.value)}
            onBlur={() => commitHeaderDrafts(project)}
          />
          <input
            value={propertyAddressDraft}
            aria-label="Optional property address"
            placeholder="Optional property address"
            disabled={projectLocked}
            onChange={(event) => setPropertyAddressDraft(event.target.value)}
            onBlur={() => commitHeaderDrafts(project)}
          />
        </div>
        <div className="project-header__actions">
          <span className="status-chip"><FolderOpen size={13} /> Local Project</span>
          {saving ? <span className="status-chip">Saving…</span> : mediaBusy ? <span className="status-chip">Checking media…</span> : hasUnsavedChanges ? <span className="status-chip">Unsaved changes</span> : <span className="status-chip"><Check size={13} /> Saved</span>}
          <button type="button" className="button" disabled={projectLocked || !hasUnsavedChanges} onClick={() => { void saveProject(); }}><Save size={15} /> {saving ? 'Saving…' : 'Save locally'}</button>
          <button type="button" className="button" disabled={projectLocked} onClick={() => document.getElementById('preview-heading')?.scrollIntoView({ behavior: 'smooth' })}><Play size={15} /> Preview</button>
          <button type="button" className="button button--primary" disabled={projectLocked} onClick={() => document.getElementById('export-video')?.scrollIntoView({ behavior: 'smooth' })}><Download size={15} /> Export</button>
          <button type="button" className="button button--quiet" disabled={projectLocked} onClick={closeProject}><X size={15} /> Close</button>
        </div>
      </header>

      <main className="workspace-shell">
        <div className="workspace-grid">
          <div className="workspace-main">
            <MediaIntakePanel
              project={project}
              issues={mediaIssues}
              busy={mediaBusy}
              disabled={projectLocked}
              rightsConfirmed={photoRightsConfirmed}
              rightsDetails={photoRightsDetails}
              onRightsConfirmedChange={setPhotoRightsConfirmed}
              onRightsDetailsChange={setPhotoRightsDetails}
              onAddFiles={(files) => { void addPhotos(files); }}
              onClearUnused={clearUnused}
            />
            <Storyboard
              project={project}
              runtime={runtime}
              disabled={projectLocked}
              onMove={moveShot}
              onMoveBefore={moveShotBefore}
              onSourceMode={setShotSource}
              onPairEnd={(shotId, assetId) => {
                try { setProject(setWorkspaceShotAsset(project, shotId, 'end', assetId)); } catch (error) { notify(error instanceof Error ? error.message : 'End photograph could not be changed.', true); }
              }}
              onMotion={(shotId, preset) => {
                try { setProject(setWorkspaceShotMotion(project, shotId, preset)); setRenderedVideo(null); } catch (error) { notify(error instanceof Error ? error.message : 'Motion could not be changed.', true); }
              }}
              onDuration={(shotId, durationSec) => {
                try { setProject(syncPresentationOverlays(retimeWorkspaceShot(project, shotId, durationSec))); setRenderedVideo(null); } catch (error) { notify(error instanceof Error ? error.message : 'Duration could not be changed.', true); }
              }}
              onReplace={(shotId, slot, file) => { void replacePhoto(shotId, slot, file); }}
              onRemove={(shotId) => { setProject(syncPresentationOverlays(removeWorkspaceShot(project, shotId))); setRenderedVideo(null); }}
              onPreview={(shotId) => {
                setFocusShotId(shotId);
                document.getElementById('preview-heading')?.scrollIntoView({ behavior: 'smooth' });
              }}
            />
            <ProjectPreview
              project={project}
              runtime={runtime}
              focusShotId={focusShotId}
              disabled={projectLocked}
              onFocusConsumed={() => setFocusShotId(null)}
            />
          </div>

          <ProductionSettings
            project={project}
            renderProgress={renderProgress}
            renderedVideo={renderedVideo}
            renderError={renderError}
            rendering={rendering}
            disabled={saving || mediaBusy}
            onProjectText={(field, value) => setProject(syncPresentationOverlays(updateProjectDetails(project, {
              [field]: value || undefined,
            })))}
            onAudioFile={(kind, file, rightsDetails) => { void handleAudioFile(kind, file, rightsDetails); }}
            onAudioChange={handleAudioChange}
            onBrandFile={(kind, file, rightsDetails) => { void handleBrandFile(kind, file, rightsDetails); }}
            onEndCardChange={(patch: Partial<EndCard>) => {
              try {
                setProject(syncPresentationOverlays(finalizeWorkspaceProject({
                  ...project,
                  endCard: { ...project.endCard, ...patch },
                })));
              } catch (error) {
                notify(error instanceof Error ? error.message : 'End-card details are invalid.', true);
              }
            }}
            onVariant={(variant: OutputVariant) => setProject(updateProjectDetails(project, { outputVariant: variant }))}
            onRender={() => { void startRender(); }}
            onCancel={() => abortControllerRef.current?.abort()}
            onDownloadAgain={() => { if (renderedVideo) downloadRenderedVideo(renderedVideo); }}
          />
        </div>
      </main>
      <div className="toast-stack" aria-live="polite">
        {toasts.map((toast) => <div className={`toast${toast.error ? ' toast--error' : ''}`} key={toast.id}>{toast.message}</div>)}
      </div>
    </div>
  );
}
