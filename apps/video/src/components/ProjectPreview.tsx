import { Pause, Play, RotateCcw } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { audioGainAtTime, isAudioTrackActive } from '../audio/timing';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import type { VideoProject } from '../project/schemas';
import {
  drawProjectFrame,
  getProjectDuration,
  getShotSegments,
} from '../render/canvasComposition';
import { getReferencedVisualAssetIds } from '../render/referencedAssets';

interface ProjectPreviewProps {
  project: VideoProject;
  runtime: ProjectAssetRuntime;
  focusShotId?: string | null;
  disabled?: boolean;
  onFocusConsumed?: () => void;
}

const formatTime = (seconds: number) => {
  const bounded = Math.max(0, seconds);
  const minutes = Math.floor(bounded / 60);
  const remainder = Math.floor(bounded % 60);
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
};

export function ProjectPreview({
  project,
  runtime,
  focusShotId,
  disabled = false,
  onFocusConsumed,
}: ProjectPreviewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const frameRequestRef = useRef<number | null>(null);
  const anchorRef = useRef({ clockMs: 0, timeSec: 0 });
  const currentTimeRef = useRef(0);
  const audioElementsRef = useRef(new Map<string, HTMLAudioElement>());
  const [images, setImages] = useState<ReadonlyMap<string, CanvasImageSource>>(new Map());
  const [loadError, setLoadError] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const duration = getProjectDuration(project);
  const segments = useMemo(() => getShotSegments(project), [project]);
  const activeSegment = segments.find((segment) => (
    currentTime >= segment.startTimeSec && currentTime < segment.endTimeSec
  ));

  useEffect(() => {
    let active = true;
    setLoadError(null);
    void Promise.all([...getReferencedVisualAssetIds(project)]
      .filter((assetId) => runtime.has(assetId))
      .map(async (assetId) => [assetId, await runtime.getImage(assetId)] as const))
      .then((entries) => {
        if (active) setImages(new Map(entries));
      })
      .catch((error: unknown) => {
        if (active) setLoadError(error instanceof Error ? error.message : 'A local image could not be prepared.');
      });
    return () => {
      active = false;
    };
  }, [project, runtime]);

  useEffect(() => {
    const next = new Map<string, HTMLAudioElement>();
    for (const track of project.audioTracks) {
      const url = runtime.getUrl(track.assetId);
      if (!url) continue;
      const audio = new Audio(url);
      audio.preload = 'auto';
      audio.loop = track.loop;
      audio.addEventListener('error', () => {
        setAudioError(`The ${track.kind} preview could not decode this local audio file.`);
      });
      next.set(track.id, audio);
    }
    const previous = audioElementsRef.current;
    audioElementsRef.current = next;
    return () => {
      for (const audio of previous.values()) audio.pause();
      for (const audio of next.values()) audio.pause();
    };
  }, [project.audioTracks, runtime]);

  const draw = useCallback((timeSec: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (canvas.width !== project.canvas.width) canvas.width = project.canvas.width;
    if (canvas.height !== project.canvas.height) canvas.height = project.canvas.height;
    const context = canvas.getContext('2d', { alpha: false });
    if (!context) return;
    try {
      drawProjectFrame(context, project, images, timeSec);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'The preview frame could not be drawn.');
    }
  }, [images, project]);

  useEffect(() => draw(currentTime), [currentTime, draw]);

  const syncAudio = useCallback((timeSec: number, play: boolean, forcePosition = false) => {
    for (const track of project.audioTracks) {
      const audio = audioElementsRef.current.get(track.id);
      if (!audio) continue;
      const active = isAudioTrackActive(track, timeSec);
      audio.volume = audioGainAtTime(track, project, timeSec);
      if (track.kind === 'music') {
        previewRef.current?.setAttribute('data-preview-music-gain', String(audio.volume));
      }
      if (!active || !play) {
        audio.pause();
        continue;
      }
      const sourceDuration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : track.durationSec;
      const expected = (track.trimStartSec + timeSec - track.startTimeSec) % Math.max(sourceDuration, 0.001);
      if (forcePosition || Math.abs(audio.currentTime - expected) > 0.1) audio.currentTime = expected;
      void audio.play()
        .then(() => setAudioError(null))
        .catch(() => {
          setAudioError(`The ${track.kind} preview could not start. Use Play again or check the local audio file.`);
        });
    }
  }, [project]);

  const seek = useCallback((timeSec: number) => {
    const next = Math.max(0, Math.min(timeSec, duration));
    currentTimeRef.current = next;
    setCurrentTime(next);
    anchorRef.current = { clockMs: performance.now(), timeSec: next };
    syncAudio(next, isPlaying, true);
  }, [duration, isPlaying, syncAudio]);

  useEffect(() => {
    if (!focusShotId) return;
    const segment = segments.find((candidate) => candidate.shot.id === focusShotId);
    if (segment) seek(segment.startTimeSec);
    onFocusConsumed?.();
  }, [focusShotId, onFocusConsumed, seek, segments]);

  useEffect(() => {
    if (!isPlaying) return;
    const tick = (clockMs: number) => {
      const next = anchorRef.current.timeSec + (clockMs - anchorRef.current.clockMs) / 1000;
      if (next >= duration) {
        currentTimeRef.current = duration;
        setCurrentTime(duration);
        setIsPlaying(false);
        syncAudio(duration, false);
        return;
      }
      currentTimeRef.current = next;
      setCurrentTime(next);
      syncAudio(next, true);
      frameRequestRef.current = requestAnimationFrame(tick);
    };
    frameRequestRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current);
    };
  }, [duration, isPlaying, syncAudio]);

  useEffect(() => {
    if (!disabled) return;
    setIsPlaying(false);
    syncAudio(currentTimeRef.current, false);
  }, [disabled, syncAudio]);

  useEffect(() => () => {
    if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current);
    for (const audio of audioElementsRef.current.values()) audio.pause();
  }, []);

  const togglePlayback = () => {
    if (isPlaying) {
      setIsPlaying(false);
      syncAudio(currentTimeRef.current, false);
      return;
    }
    const start = currentTimeRef.current >= duration ? 0 : currentTimeRef.current;
    currentTimeRef.current = start;
    setCurrentTime(start);
    anchorRef.current = { clockMs: performance.now(), timeSec: start };
    setIsPlaying(true);
    syncAudio(start, true, true);
  };

  return (
    <section ref={previewRef} className="surface" aria-labelledby="preview-heading">
      <div className="surface__header">
        <div>
          <h2 id="preview-heading">Preview complete video</h2>
          <p>This complete preview follows the same timing and motion choices used in your export.</p>
        </div>
        <span className="status-chip">
          {activeSegment ? `Shot ${segments.indexOf(activeSegment) + 1}` : project.endCard.enabled ? 'End card' : 'Ready'}
        </span>
      </div>
      <div className="surface__body">
        <div className="preview-stage" data-testid="preview-stage">
          <canvas ref={canvasRef} aria-label="Complete property video preview" />
          {project.orderedShotIds.length === 0 ? (
            <div className="preview-stage__empty">Add photographs to build the complete property preview.</div>
          ) : null}
          {loadError ? <div className="preview-stage__empty" role="alert">{loadError}</div> : null}
        </div>
        <div className="preview-controls">
          <button
            type="button"
            className="button button--primary"
            onClick={togglePlayback}
            disabled={disabled || duration <= 0 || project.orderedShotIds.length === 0}
          >
            {isPlaying ? <Pause size={15} /> : <Play size={15} />}
            {isPlaying ? 'Pause' : 'Play'}
          </button>
          <button type="button" className="button button--quiet" onClick={() => seek(0)} disabled={disabled || duration <= 0}>
            <RotateCcw size={15} />
            Start
          </button>
          <span className="preview-controls__time">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <input
            type="range"
            min={0}
            max={Math.max(duration, 0.01)}
            step={1 / project.fps}
            value={Math.min(currentTime, duration)}
            aria-label="Seek complete video"
            disabled={disabled || duration <= 0}
            onChange={(event) => seek(Number(event.target.value))}
          />
        </div>
        {audioError ? <div className="issue issue--warning" role="status">{audioError}</div> : null}
      </div>
    </section>
  );
}
