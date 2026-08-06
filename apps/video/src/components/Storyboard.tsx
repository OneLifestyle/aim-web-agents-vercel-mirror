import {
  ArrowDown,
  ArrowUp,
  AlertTriangle,
  CheckCircle2,
  GripVertical,
  Play,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { ProjectAssetRuntime } from '../media/projectAssetRuntime';
import type { MotionPreset, VideoProject, VideoShot } from '../project/schemas';
import { getProjectDurationSec } from '../project/timeline';

const MOTION_OPTIONS: readonly { value: MotionPreset; label: string }[] = [
  { value: 'still', label: 'Still' },
  { value: 'zoom-in', label: 'Zoom In' },
  { value: 'zoom-out', label: 'Zoom Out' },
  { value: 'pan-left', label: 'Pan Left' },
  { value: 'pan-right', label: 'Pan Right' },
];

interface StoryboardProps {
  project: VideoProject;
  runtime: ProjectAssetRuntime;
  disabled?: boolean;
  onMove: (shotId: string, direction: 'up' | 'down') => void;
  onMoveBefore: (shotId: string, targetShotId: string) => void;
  onSourceMode: (shotId: string, mode: 'single' | 'pair') => void;
  onPairEnd: (shotId: string, assetId: string) => void;
  onMotion: (shotId: string, preset: MotionPreset) => void;
  onDuration: (shotId: string, durationSec: number) => void;
  onReplace: (shotId: string, slot: 'start' | 'end', file: File) => void;
  onRemove: (shotId: string) => void;
  onPreview: (shotId: string) => void;
}

const Thumbnail = ({
  assetId,
  label,
  project,
  runtime,
}: {
  assetId: string;
  label?: string;
  project: VideoProject;
  runtime: ProjectAssetRuntime;
}) => {
  const asset = project.mediaAssets.find((candidate) => candidate.id === assetId);
  const url = runtime.getUrl(assetId);
  if (!asset || !url) {
    return <div className="shot-thumbnail shot-thumbnail--missing">Local photograph missing</div>;
  }
  return (
    <div className="shot-thumbnail">
      <img src={url} alt={asset.fileName} />
      {label ? <span className="shot-thumbnail__label">{label}</span> : null}
    </div>
  );
};

function ShotCard({
  shot,
  index,
  project,
  runtime,
  dragging,
  onDragStart,
  onDragEnd,
  onDrop,
  onMove,
  onSourceMode,
  onPairEnd,
  onMotion,
  onDuration,
  onReplace,
  onRemove,
  onPreview,
}: {
  shot: VideoShot;
  index: number;
  project: VideoProject;
  runtime: ProjectAssetRuntime;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: (draggedShotId: string) => void;
} & Omit<StoryboardProps, 'project' | 'runtime' | 'onMoveBefore'>) {
  const photos = project.mediaAssets.filter((asset) => asset.kind === 'image');
  const endOptions = photos.filter((asset) => asset.id !== shot.startAssetId);
  const mediaAvailable = runtime.has(shot.startAssetId)
    && (shot.sourceMode === 'single' || runtime.has(shot.endAssetId));

  return (
    <article
      className={`shot-card${dragging ? ' shot-card--dragging' : ''}`}
      data-shot-id={shot.id}
      data-testid={`shot-card-${index + 1}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(event.dataTransfer.getData('text/plain'));
      }}
    >
      <div className="shot-card__sequence">
        <span className="shot-card__number">{index + 1}</span>
        <button
          type="button"
          className="button button--quiet drag-handle"
          draggable
          aria-label={`Drag shot ${index + 1}`}
          onDragStart={(event) => {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', shot.id);
            onDragStart();
          }}
          onDragEnd={onDragEnd}
        >
          <GripVertical size={17} />
        </button>
      </div>
      <div className={`shot-card__media${shot.sourceMode === 'pair' ? ' shot-card__media--pair' : ''}`}>
        <Thumbnail
          assetId={shot.startAssetId}
          label={shot.sourceMode === 'pair' ? 'Start' : undefined}
          project={project}
          runtime={runtime}
        />
        {shot.sourceMode === 'pair' ? (
          <Thumbnail assetId={shot.endAssetId} label="End" project={project} runtime={runtime} />
        ) : null}
      </div>
      <div className="shot-card__editor">
        <div className="shot-card__fields">
          <label className="field">
            <span>Source</span>
            <select
              value={shot.sourceMode}
              aria-label={`Source mode for shot ${index + 1}`}
              onChange={(event) => onSourceMode(shot.id, event.target.value as 'single' | 'pair')}
            >
              <option value="single">Single Image</option>
              <option value="pair" disabled={endOptions.length === 0}>Image Pair</option>
            </select>
          </label>
          {shot.sourceMode === 'single' ? (
            <label className="field">
              <span>Motion</span>
              <select
                value={shot.motionPreset}
                aria-label={`Motion for shot ${index + 1}`}
                onChange={(event) => onMotion(shot.id, event.target.value as MotionPreset)}
              >
                {MOTION_OPTIONS.map((option) => (
                  <option value={option.value} key={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          ) : (
            <label className="field">
              <span>End photograph</span>
              <select
                value={shot.endAssetId}
                aria-label={`End photograph for shot ${index + 1}`}
                onChange={(event) => onPairEnd(shot.id, event.target.value)}
              >
                {endOptions.map((asset) => <option value={asset.id} key={asset.id}>{asset.fileName}</option>)}
              </select>
            </label>
          )}
          <label className="field">
            <span>Duration</span>
            <select
              value={shot.durationSec}
              aria-label={`Duration for shot ${index + 1}`}
              onChange={(event) => onDuration(shot.id, Number(event.target.value))}
            >
              {[2, 2.5, 3, 3.5, 4, 5, 6, 8].map((seconds) => (
                <option value={seconds} key={seconds}>{seconds}s</option>
              ))}
            </select>
          </label>
        </div>
        {shot.sourceMode === 'pair' ? (
          <p className="pair-disclosure">
            Image Pair is active with two real photographs. This alpha exports a deterministic
            cross-dissolve proxy. AI Motion Pair generation is not connected yet.
          </p>
        ) : null}
        <div className="shot-card__footer">
          <span className={mediaAvailable ? 'shot-status' : 'shot-status shot-status--error'}>
            {mediaAvailable ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {mediaAvailable ? (shot.status === 'ready' ? 'Ready' : shot.status) : 'Photo missing'}
          </span>
          <div className="shot-card__actions">
            <button
              type="button"
              className="button button--quiet"
              aria-label={`Move shot ${index + 1} up`}
              disabled={index === 0}
              onClick={() => onMove(shot.id, 'up')}
            ><ArrowUp size={14} /> Move Up</button>
            <button
              type="button"
              className="button button--quiet"
              aria-label={`Move shot ${index + 1} down`}
              disabled={index === project.orderedShotIds.length - 1}
              onClick={() => onMove(shot.id, 'down')}
            ><ArrowDown size={14} /> Move Down</button>
            <label className="button button--quiet">
              <RefreshCw size={14} /> Replace
              <input
                className="visually-hidden"
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                aria-label={`Replace start photograph for shot ${index + 1}`}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) onReplace(shot.id, 'start', file);
                  event.target.value = '';
                }}
              />
            </label>
            {shot.sourceMode === 'pair' ? (
              <label className="button button--quiet">
                <RefreshCw size={14} /> Replace end
                <input
                  className="visually-hidden"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  aria-label={`Replace end photograph for shot ${index + 1}`}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onReplace(shot.id, 'end', file);
                    event.target.value = '';
                  }}
                />
              </label>
            ) : null}
            <button type="button" className="button button--quiet" disabled={!mediaAvailable} onClick={() => onPreview(shot.id)}>
              <Play size={14} /> Preview
            </button>
            <button
              type="button"
              className="button button--quiet button--danger"
              aria-label={`Remove shot ${index + 1}`}
              onClick={() => onRemove(shot.id)}
            ><Trash2 size={14} /> Remove</button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function Storyboard(props: StoryboardProps) {
  const { project } = props;
  const [draggedShotId, setDraggedShotId] = useState<string | null>(null);
  const shotById = new Map(project.shots.map((shot) => [shot.id, shot]));
  const orderedShots = project.orderedShotIds
    .map((id) => shotById.get(id))
    .filter((shot): shot is VideoShot => Boolean(shot));
  const totalDuration = getProjectDurationSec(project);

  return (
    <section className="surface" aria-labelledby="storyboard-heading">
      <div className="surface__header">
        <div>
          <h2 id="storyboard-heading">Arrange video</h2>
          <p>Drag shots or use Move Up and Move Down. Each card keeps a stable identity.</p>
        </div>
        <span className="status-chip">{orderedShots.length} shots · {totalDuration.toFixed(1)}s</span>
      </div>
      <div className="surface__body">
        <fieldset className="control-lock" disabled={props.disabled}>
        {orderedShots.length === 0 ? (
          <div className="storyboard-empty">Add photographs to create the guided shot list.</div>
        ) : (
          <div className="storyboard-list">
            {orderedShots.map((shot, index) => (
              <ShotCard
                {...props}
                shot={shot}
                index={index}
                key={shot.id}
                dragging={draggedShotId === shot.id}
                onDragStart={() => setDraggedShotId(shot.id)}
                onDragEnd={() => setDraggedShotId(null)}
                onDrop={(transferredShotId) => {
                  const sourceShotId = transferredShotId || draggedShotId;
                  if (sourceShotId && sourceShotId !== shot.id) {
                    props.onMoveBefore(sourceShotId, shot.id);
                  }
                  setDraggedShotId(null);
                }}
              />
            ))}
          </div>
        )}
        {orderedShots.length ? (
          <div className="sequence-strip" aria-label="Read-only duration overview">
            {orderedShots.map((shot, index) => (
              <span
                className="sequence-strip__item"
                style={{ flexGrow: shot.durationSec }}
                title={`Shot ${index + 1}: ${shot.durationSec}s`}
                key={shot.id}
              >{index + 1}</span>
            ))}
          </div>
        ) : null}
        </fieldset>
      </div>
    </section>
  );
}
