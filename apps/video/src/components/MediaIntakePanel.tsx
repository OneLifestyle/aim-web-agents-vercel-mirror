import { ImagePlus, ShieldCheck, Trash2, UploadCloud } from 'lucide-react';
import { useState } from 'react';
import { formatBytes, type MediaIntakeIssue } from '../media/intake';
import { IMAGE_FILE_LIMITS } from '../media/limits';
import { operatorRightsAreComplete, type OperatorRightsInput } from '../media/assets';
import type { VideoProject } from '../project/schemas';

interface MediaIntakePanelProps {
  project: VideoProject;
  issues: readonly MediaIntakeIssue[];
  busy: boolean;
  disabled?: boolean;
  rightsConfirmed: boolean;
  rightsDetails: OperatorRightsInput;
  onRightsConfirmedChange: (confirmed: boolean) => void;
  onRightsDetailsChange: (details: OperatorRightsInput) => void;
  onAddFiles: (files: readonly File[]) => void;
  onClearUnused: () => void;
}

export function MediaIntakePanel({
  project,
  issues,
  busy,
  disabled = false,
  rightsConfirmed,
  rightsDetails,
  onRightsConfirmedChange,
  onRightsDetailsChange,
  onAddFiles,
  onClearUnused,
}: MediaIntakePanelProps) {
  const [dragActive, setDragActive] = useState(false);
  const photos = project.mediaAssets.filter((asset) => asset.kind === 'image');
  const totalBytes = photos.reduce((sum, asset) => sum + asset.fileSizeBytes, 0);
  const referenced = new Set(project.shots.flatMap((shot) => shot.sourceMode === 'pair'
    ? [shot.startAssetId, shot.endAssetId]
    : [shot.startAssetId]));
  const unusedCount = photos.filter((asset) => !referenced.has(asset.id)).length;
  const rightsReady = rightsConfirmed && operatorRightsAreComplete(rightsDetails);

  const acceptFiles = (files: FileList | null) => {
    if (files?.length) onAddFiles(Array.from(files));
  };

  return (
    <section className="surface" aria-labelledby="media-heading">
      <div className="surface__header">
        <div>
          <h2 id="media-heading">Add photos</h2>
          <p>JPEG, PNG or WebP · 15–30 photographs · files stay on this computer.</p>
        </div>
        <span className={photos.length >= 15 ? 'status-chip' : 'status-chip status-chip--warning'}>
          <ImagePlus size={14} /> {photos.length} / {IMAGE_FILE_LIMITS.maximumProjectCount}
        </span>
      </div>
      <div className="surface__body">
        <fieldset className="control-lock" disabled={disabled}>
        <label
          className={`media-dropzone${dragActive ? ' media-dropzone--active' : ''}`}
          onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragActive(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragActive(false);
            if (rightsReady) acceptFiles(event.dataTransfer.files);
          }}
        >
          <span className="media-dropzone__icon"><UploadCloud size={24} /></span>
          <span>
            <strong>{busy ? 'Checking photographs…' : 'Choose or drop photographs'}</strong>
            Actual file signatures, pixel dimensions, size and duplicates are checked before use.
          </span>
          <span className="button" aria-hidden="true">Choose photos</span>
          <input
            className="visually-hidden"
            data-testid="photo-input"
            type="file"
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            disabled={busy || !rightsReady}
            onChange={(event) => {
              acceptFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </label>
        <label className="switch-row" style={{ marginTop: 12 }}>
          <span><ShieldCheck size={15} /> I confirm these photographs are authorised for this client video.</span>
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(event) => onRightsConfirmedChange(event.target.checked)}
          />
        </label>
        <div className="settings-fields settings-fields--two" style={{ marginTop: 12 }}>
          <label className="field">
            <span>Photo source</span>
            <input
              value={rightsDetails.source}
              placeholder="e.g. Vendor campaign folder"
              onChange={(event) => onRightsDetailsChange({ ...rightsDetails, source: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Rights owner</span>
            <input
              value={rightsDetails.owner}
              placeholder="e.g. Photographer or vendor"
              onChange={(event) => onRightsDetailsChange({ ...rightsDetails, owner: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Permission basis or reference</span>
            <input
              value={rightsDetails.licenceOrPermission}
              placeholder="e.g. Written campaign permission"
              onChange={(event) => onRightsDetailsChange({ ...rightsDetails, licenceOrPermission: event.target.value })}
            />
          </label>
        </div>
        {!rightsReady ? (
          <div className="issue issue--warning">Record source, owner and permission basis, then confirm authorisation before choosing photographs.</div>
        ) : null}
        {issues.length ? (
          <div className="issue-list" aria-live="polite">
            {issues.map((item, index) => (
              <div className={`issue issue--${item.severity}`} key={`${item.code}-${item.filename ?? index}`}>
                {item.filename ? <strong>{item.filename}: </strong> : null}{item.message}
              </div>
            ))}
          </div>
        ) : null}
        <div className="media-summary">
          <span>{photos.length} photographs · {formatBytes(totalBytes)} local media</span>
          <button
            type="button"
            className="button button--quiet"
            disabled={unusedCount === 0}
            onClick={onClearUnused}
          >
            <Trash2 size={14} /> Clear unused media{unusedCount ? ` (${unusedCount})` : ''}
          </button>
        </div>
        </fieldset>
      </div>
    </section>
  );
}
