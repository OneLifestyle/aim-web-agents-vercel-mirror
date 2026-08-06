import {
  BadgeCheck,
  Download,
  LoaderCircle,
  Music2,
  Palette,
  ShieldCheck,
  Square,
  StopCircle,
  Type,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { operatorRightsAreComplete, type OperatorRightsInput } from '../media/assets';
import type { RenderProgress, RenderedVideo } from '../render/renderProjectToMp4';
import type { AudioTrack, EndCard, OutputVariant, VideoProject } from '../project/schemas';
import { getProjectDurationSec } from '../project/timeline';

interface ProductionSettingsProps {
  project: VideoProject;
  renderProgress: RenderProgress | null;
  renderedVideo: RenderedVideo | null;
  renderError: string | null;
  rendering: boolean;
  disabled?: boolean;
  onProjectText: (field: 'videoTitle' | 'subtitle', value: string) => void;
  onAudioFile: (kind: 'music' | 'voiceover', file: File | null, rightsDetails?: OperatorRightsInput) => void;
  onAudioChange: (kind: 'music' | 'voiceover', patch: Partial<AudioTrack>) => void;
  onBrandFile: (kind: 'logo' | 'watermark', file: File | null, rightsDetails?: OperatorRightsInput) => void;
  onEndCardChange: (patch: Partial<EndCard>) => void;
  onVariant: (variant: OutputVariant) => void;
  onRender: () => void;
  onCancel: () => void;
  onDownloadAgain: () => void;
}

const assetName = (project: VideoProject, assetId?: string) => (
  assetId ? project.mediaAssets.find((asset) => asset.id === assetId)?.fileName : undefined
);

const AudioControls = ({
  project,
  kind,
  rightsConfirmed,
  rightsDetails,
  onAudioFile,
  onAudioChange,
}: Pick<ProductionSettingsProps, 'project' | 'onAudioFile' | 'onAudioChange'> & {
  kind: 'music' | 'voiceover';
  rightsConfirmed: boolean;
  rightsDetails: OperatorRightsInput;
}) => {
  const track = project.audioTracks.find((candidate) => candidate.kind === kind);
  const label = kind === 'music' ? 'Music' : 'Voiceover';
  return (
    <div className="settings-fields">
      <div className="upload-row">
        <div>
          <div className="upload-row__name">{track ? assetName(project, track.assetId) : `No ${label.toLowerCase()} added`}</div>
          <div className="upload-row__meta">Local WAV, MP3 or M4A · up to 100 MB</div>
        </div>
        <div className="inline-actions">
          <label className="button button--quiet">
            <Upload size={14} /> {track ? 'Replace' : 'Add'}
            <input
              className="visually-hidden"
              type="file"
              accept=".wav,.mp3,.m4a,audio/wav,audio/mpeg,audio/mp4"
              disabled={!rightsConfirmed}
              aria-label={`Upload ${label.toLowerCase()}`}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAudioFile(kind, file, rightsDetails);
                event.target.value = '';
              }}
            />
          </label>
          {track ? <button type="button" className="button button--quiet button--danger" onClick={() => onAudioFile(kind, null)}>Remove</button> : null}
        </div>
      </div>
      {track ? (
        <>
          <label className="field">
            <span>{label} volume · {Math.round(track.volume * 100)}%</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={track.volume}
              onChange={(event) => onAudioChange(kind, { volume: Number(event.target.value) })}
            />
          </label>
          <div className="settings-fields settings-fields--two">
            <label className="field">
              <span>Fade in</span>
              <select value={track.fadeInSec} onChange={(event) => onAudioChange(kind, { fadeInSec: Number(event.target.value) })}>
                {[0, 0.5, 1, 1.5, 2].map((seconds) => <option value={seconds} key={seconds}>{seconds}s</option>)}
              </select>
            </label>
            <label className="field">
              <span>Fade out</span>
              <select value={track.fadeOutSec} onChange={(event) => onAudioChange(kind, { fadeOutSec: Number(event.target.value) })}>
                {[0, 0.5, 1, 1.5, 2].map((seconds) => <option value={seconds} key={seconds}>{seconds}s</option>)}
              </select>
            </label>
          </div>
        </>
      ) : null}
    </div>
  );
};

const ImageUpload = ({
  label,
  name,
  rightsConfirmed,
  onFile,
}: {
  label: string;
  name?: string;
  rightsConfirmed: boolean;
  onFile: (file: File | null) => void;
}) => (
  <div className="upload-row">
    <div>
      <div className="upload-row__name">{name || `No ${label.toLowerCase()} added`}</div>
      <div className="upload-row__meta">Local JPEG, PNG or WebP</div>
    </div>
    <div className="inline-actions">
      <label className="button button--quiet">
        <Upload size={14} /> {name ? 'Replace' : 'Add'}
        <input
          className="visually-hidden"
          type="file"
          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          disabled={!rightsConfirmed}
          aria-label={`Upload ${label.toLowerCase()}`}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = '';
          }}
        />
      </label>
      {name ? <button type="button" className="button button--quiet button--danger" onClick={() => onFile(null)}>Remove</button> : null}
    </div>
  </div>
);

export function ProductionSettings(props: ProductionSettingsProps) {
  const {
    project,
    renderProgress,
    renderedVideo,
    renderError,
    rendering,
    disabled = false,
    onProjectText,
    onAudioFile,
    onAudioChange,
    onBrandFile,
    onEndCardChange,
    onVariant,
    onRender,
    onCancel,
    onDownloadAgain,
  } = props;
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [rightsDetails, setRightsDetails] = useState<OperatorRightsInput>({
    source: '',
    owner: '',
    licenceOrPermission: '',
  });
  const rightsReady = rightsConfirmed && operatorRightsAreComplete(rightsDetails);
  const music = project.audioTracks.find((track) => track.kind === 'music');
  const voiceover = project.audioTracks.find((track) => track.kind === 'voiceover');
  const watermark = project.overlays.find((overlay) => overlay.kind === 'watermark');
  const photoCount = project.mediaAssets.filter((asset) => asset.kind === 'image').length;
  const duration = getProjectDurationSec(project);
  const canRender = photoCount >= 15
    && photoCount <= 30
    && project.orderedShotIds.length > 0
    && !rendering
    && !disabled;

  return (
    <aside className="production-panel" aria-labelledby="production-heading">
      <section className="surface">
        <div className="surface__header">
          <div>
            <h2 id="production-heading">Production settings</h2>
            <p>Title, music and voice, branding, end card and output.</p>
          </div>
          <span className="status-chip">16:9</span>
        </div>
        <div className="surface__body">
          <fieldset className="control-lock" disabled={rendering || disabled}>
          <section className="settings-group">
            <h3 className="settings-group__title"><Type size={16} /> Title and address</h3>
            <div className="settings-fields">
              <label className="field">
                <span>Video title</span>
                <input value={project.videoTitle ?? ''} placeholder="A remarkable family home" onChange={(event) => onProjectText('videoTitle', event.target.value)} />
              </label>
              <label className="field">
                <span>Address or subtitle</span>
                <input value={project.subtitle ?? ''} placeholder={project.propertyAddress || 'Property address'} onChange={(event) => onProjectText('subtitle', event.target.value)} />
              </label>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group__title"><Music2 size={16} /> Music and voice</h3>
            <label className="switch-row" style={{ marginBottom: 12 }}>
              <span><ShieldCheck size={15} /> I confirm permission for uploaded audio and branding.</span>
              <input type="checkbox" checked={rightsConfirmed} onChange={(event) => setRightsConfirmed(event.target.checked)} />
            </label>
            <div className="settings-fields">
              <label className="field">
                <span>Media source</span>
                <input value={rightsDetails.source} placeholder="e.g. Agency licence library" onChange={(event) => setRightsDetails({ ...rightsDetails, source: event.target.value })} />
              </label>
              <label className="field">
                <span>Rights owner</span>
                <input value={rightsDetails.owner} placeholder="e.g. Agency or creator" onChange={(event) => setRightsDetails({ ...rightsDetails, owner: event.target.value })} />
              </label>
              <label className="field">
                <span>Licence, permission or reference</span>
                <input value={rightsDetails.licenceOrPermission} placeholder="e.g. Subscription licence / written permission" onChange={(event) => setRightsDetails({ ...rightsDetails, licenceOrPermission: event.target.value })} />
              </label>
            </div>
            {!rightsReady ? <div className="issue issue--warning">Record source, owner and permission basis, then confirm permission to add production media.</div> : null}
            <AudioControls project={project} kind="music" rightsConfirmed={rightsReady} rightsDetails={rightsDetails} onAudioFile={onAudioFile} onAudioChange={onAudioChange} />
            <div style={{ height: 12 }} />
            <AudioControls project={project} kind="voiceover" rightsConfirmed={rightsReady} rightsDetails={rightsDetails} onAudioFile={onAudioFile} onAudioChange={onAudioChange} />
            {music && voiceover ? (
              <label className="switch-row" style={{ marginTop: 12 }}>
                <span>Reduce music while voiceover plays</span>
                <input
                  type="checkbox"
                  checked={music.duckUnderVoice}
                  onChange={(event) => onAudioChange('music', { duckUnderVoice: event.target.checked })}
                />
              </label>
            ) : null}
          </section>

          <section className="settings-group">
            <h3 className="settings-group__title"><BadgeCheck size={16} /> Output</h3>
            <div className="variant-control" role="group" aria-label="Output variant">
              <button
                type="button"
                className={`variant-option${project.outputVariant === 'unbranded' ? ' variant-option--selected' : ''}`}
                aria-pressed={project.outputVariant === 'unbranded'}
                onClick={() => onVariant('unbranded')}
              >
                <strong>Unbranded 16:9</strong>
                <span>Neutral title and closing frame. Portal-safe candidate, not universally certified.</span>
              </button>
              <button
                type="button"
                className={`variant-option${project.outputVariant === 'branded' ? ' variant-option--selected' : ''}`}
                aria-pressed={project.outputVariant === 'branded'}
                onClick={() => onVariant('branded')}
              >
                <strong>Branded 16:9</strong>
                <span>Optional logo, watermark, agent and agency contact details.</span>
              </button>
            </div>
          </section>

          <section className="settings-group">
            <h3 className="settings-group__title"><Palette size={16} /> Branding</h3>
            {project.outputVariant === 'unbranded' ? <div className="issue">Logo, watermark and contact details are not included in Unbranded 16:9.</div> : null}
            <fieldset className="control-lock" disabled={project.outputVariant === 'unbranded'}>
              <div className="settings-fields">
                <ImageUpload
                  label="Logo"
                  name={assetName(project, project.endCard.logoAssetId)}
                  rightsConfirmed={rightsReady}
                  onFile={(file) => onBrandFile('logo', file, rightsDetails)}
                />
                <ImageUpload
                  label="Watermark"
                  name={assetName(project, watermark?.assetId)}
                  rightsConfirmed={rightsReady}
                  onFile={(file) => onBrandFile('watermark', file, rightsDetails)}
                />
              </div>
            </fieldset>
          </section>

          <section className="settings-group">
            <h3 className="settings-group__title"><Square size={16} /> End card</h3>
            <div className="settings-fields">
              <label className="field">
                <span>Closing text</span>
                <input value={project.endCard.title ?? ''} placeholder="Thank you for viewing" onChange={(event) => onEndCardChange({ title: event.target.value || undefined })} />
              </label>
              <fieldset className="control-lock" disabled={project.outputVariant === 'unbranded'}>
              <div className="settings-fields settings-fields--two">
                <label className="field">
                  <span>Agent name</span>
                  <input value={project.endCard.agentName ?? ''} onChange={(event) => onEndCardChange({ agentName: event.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>Agency</span>
                  <input value={project.endCard.agencyName ?? ''} onChange={(event) => onEndCardChange({ agencyName: event.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>Phone</span>
                  <input value={project.endCard.phone ?? ''} onChange={(event) => onEndCardChange({ phone: event.target.value || undefined })} />
                </label>
                <label className="field">
                  <span>Email</span>
                  <input type="email" value={project.endCard.email ?? ''} onChange={(event) => onEndCardChange({ email: event.target.value || undefined })} />
                </label>
              </div>
              </fieldset>
            </div>
          </section>
          </fieldset>

          <section className="settings-group render-box" id="export-video">
            {rendering ? (
              <button type="button" className="button" onClick={onCancel}>
                <StopCircle size={16} /> Cancel export
              </button>
            ) : (
              <button type="button" className="button button--primary button--large" disabled={!canRender} onClick={onRender}>
                <Download size={17} /> Render MP4
              </button>
            )}
            <p className="render-box__meta">
              Full HD 16:9 MP4 · produced locally on this computer
            </p>
            {photoCount < 15 ? <p className="render-box__meta">Add {15 - photoCount} more authorised photograph{15 - photoCount === 1 ? '' : 's'} to export.</p> : null}
            {renderProgress ? (
              <div className="render-progress" aria-live="polite">
                <div className="render-progress__track"><div className="render-progress__bar" style={{ width: `${Math.round(renderProgress.progress * 100)}%` }} /></div>
                <div className="render-progress__label">
                  <span>{renderProgress.message}</span><span>{Math.round(renderProgress.progress * 100)}%</span>
                </div>
              </div>
            ) : null}
            {rendering ? <p className="render-box__meta"><LoaderCircle className="animate-pulse" size={13} /> Encoding on this computer. Keep this tab open.</p> : null}
            {renderError ? <div className="issue issue--error" role="alert">{renderError}</div> : null}
            {renderedVideo ? (
              <div className="issue" style={{ background: '#e7f7f1', color: '#0b6b52', marginTop: 12 }}>
                <strong>MP4 ready.</strong> {(renderedVideo.blob.size / 1_000_000).toFixed(1)} MB · Full HD 16:9
                <button type="button" className="button" style={{ marginTop: 8 }} onClick={onDownloadAgain}><Download size={14} /> Download again</button>
              </div>
            ) : null}
            <p className="render-box__meta">Complete duration: {duration.toFixed(1)} seconds. Changing one shot keeps every other shot choice intact; each export creates a fresh complete MP4.</p>
          </section>
        </div>
      </section>
    </aside>
  );
}
