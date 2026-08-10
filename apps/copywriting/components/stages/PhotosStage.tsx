import React, { useEffect, useRef, useState } from 'react';
import type { ReviewedPhotoHighlight } from '../../types';
import type { CampaignSessionState } from '../../domain/sessionState';
import { StatusRow } from '../StatusRow';

type PhotosStageProps = {
  session: CampaignSessionState;
  headingRef: React.Ref<HTMLHeadingElement>;
  isAnalysing: boolean;
  analysisProgress: {
    completed: number;
    total: number;
    currentPhotoId: string | null;
  } | null;
  onPolicyChange: (policy: CampaignSessionState['photos']['policy']) => void;
  onFilesSelected: (files: FileList | readonly File[]) => void;
  onPhotoSelected: (id: string, selected: boolean) => void;
  onRemovePhoto: (id: string) => void;
  onAnalyse: (photoId?: string) => void;
  onHighlightAction: (highlight: ReviewedPhotoHighlight, action: 'approve' | 'correct' | 'exclude') => void;
  onApprove: () => void;
};

const highlightLabel = (highlight: ReviewedPhotoHighlight): string => {
  if (highlight.state === 'approved') return 'Approved';
  if (highlight.state === 'corrected') return 'Corrected';
  if (highlight.state === 'excluded') return 'Excluded';
  if (highlight.state === 'failed') return 'Failed';
  return 'Needs review';
};

export const PhotosStage: React.FC<PhotosStageProps> = ({
  session,
  headingRef,
  isAnalysing,
  analysisProgress,
  onPolicyChange,
  onFilesSelected,
  onPhotoSelected,
  onRemovePhoto,
  onAnalyse,
  onHighlightAction,
  onApprove,
}) => {
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const photoThumbnailRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedPhotos = session.photos.items.filter(photo => photo.selected);
  const photosAwaitingAnalysis = selectedPhotos.filter(photo => photo.analysisState !== 'ready');
  const selectedIds = new Set(selectedPhotos.map(photo => photo.id));
  const relevantHighlights = session.photos.highlights.filter(highlight => selectedIds.has(highlight.imageId));
  const activeAnalysingPhoto = analysisProgress?.currentPhotoId
    ? session.photos.items.find(photo => photo.id === analysisProgress.currentPhotoId) ?? null
    : null;
  const photoProgress = analysisProgress && analysisProgress.total > 0
    ? Math.round((analysisProgress.completed / analysisProgress.total) * 100)
    : 0;
  const activePhoto = session.photos.items.find(photo => photo.id === activePhotoId) ?? session.photos.items[0] ?? null;
  const activePhotoHighlights = activePhoto
    ? session.photos.highlights.filter(highlight => highlight.imageId === activePhoto.id)
    : [];
  const unresolved = session.photos.policy === 'included' && (
    selectedPhotos.length === 0
    || selectedPhotos.some(photo => photo.analysisState !== 'ready')
    || selectedPhotos.some(photo => !relevantHighlights.some(highlight => (
      highlight.imageId === photo.id
      && (highlight.state === 'approved' || highlight.state === 'corrected')
    )))
    || relevantHighlights.some(highlight => highlight.state === 'needs-review')
  );

  useEffect(() => {
    if (session.photos.items.length === 0) {
      if (activePhotoId !== null) setActivePhotoId(null);
      return;
    }
    if (!session.photos.items.some(photo => photo.id === activePhotoId)) {
      setActivePhotoId(session.photos.items[0].id);
    }
  }, [activePhotoId, session.photos.items]);

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? []);
    event.currentTarget.value = '';
    if (files.length) onFilesSelected(files);
  };

  const handleDeleteActivePhoto = () => {
    if (!activePhoto) return;
    const activeIndex = session.photos.items.findIndex(photo => photo.id === activePhoto.id);
    const nextPhoto = session.photos.items[activeIndex + 1]
      ?? session.photos.items[activeIndex - 1]
      ?? null;
    setActivePhotoId(nextPhoto?.id ?? null);
    onRemovePhoto(activePhoto.id);
    window.setTimeout(() => {
      const nextThumbnail = nextPhoto
        ? photoThumbnailRefs.current.get(nextPhoto.id)
        : null;
      (nextThumbnail ?? uploadInputRef.current)?.focus();
    }, 0);
  };

  return (
    <div className="photos-stage">
      <header className="stage-header">
        <div className="stage-header__copy">
          <h1 ref={headingRef} tabIndex={-1}>Photos</h1>
          <p>Choose whether reviewed photo context may govern generation. Analysis alone never includes a highlight.</p>
        </div>
      </header>

      <div className="section-stack">
        <section className="surface" aria-labelledby="photo-policy-title">
          <div className="surface__header">
            <div><h2 id="photo-policy-title">Photo context policy</h2><p>This is a genuine binary generation policy, not a display preference.</p></div>
          </div>
          <div className="surface__body">
            <div className="photo-policy" role="radiogroup" aria-label="Photo context policy">
              <label className="photo-policy__option" data-selected={session.photos.policy === 'off'}>
                <input type="radio" name="photo-policy" checked={session.photos.policy === 'off'} onChange={() => onPolicyChange('off')} />
                <span><strong>Photo context off</strong><span>Analysis may remain visible, but no photo content enters generation.</span></span>
              </label>
              <label className="photo-policy__option" data-selected={session.photos.policy === 'included'}>
                <input type="radio" name="photo-policy" checked={session.photos.policy === 'included'} onChange={() => onPolicyChange('included')} />
                <span><strong>Use reviewed photo context</strong><span>Only selected photos and approved highlights enter the brief.</span></span>
              </label>
            </div>
          </div>
        </section>

        <section className="surface" aria-labelledby="photo-upload-title">
          <div className="surface__header">
            <div><h2 id="photo-upload-title">Campaign photos</h2><p>Up to 20 JPG, PNG, WebP, HEIC or HEIF images. Analysis is explicit and runs per image.</p></div>
            <button className="button button--secondary" type="button" disabled={photosAwaitingAnalysis.length === 0 || isAnalysing} onClick={() => onAnalyse()}>
              {isAnalysing
                ? 'Analysing photos…'
                : photosAwaitingAnalysis.length > 0
                  ? `Analyse ${photosAwaitingAnalysis.length} unready photo${photosAwaitingAnalysis.length === 1 ? '' : 's'}`
                  : 'Selected photos analysed'}
            </button>
          </div>
          <div className="surface__body section-stack">
            <label
              className="upload-zone"
              data-dragging={isDraggingFiles}
              onDragEnter={event => { event.preventDefault(); setIsDraggingFiles(true); }}
              onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; setIsDraggingFiles(true); }}
              onDragLeave={event => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDraggingFiles(false);
              }}
              onDrop={event => {
                event.preventDefault();
                setIsDraggingFiles(false);
                if (event.dataTransfer.files.length > 0) onFilesSelected(event.dataTransfer.files);
              }}
            >
              <input
                ref={uploadInputRef}
                className="sr-only"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
                multiple
                onChange={handleFileInputChange}
              />
              <strong>Upload campaign photos</strong>
              <span>Choose images or drop them here · {session.photos.items.length}/20 added</span>
            </label>

            {session.photos.items.length > 0 ? (
              <div className="photo-contact">
                <div className="photo-strip" role="group" aria-label="Uploaded photo thumbnails">
                  {session.photos.items.map(photo => {
                    const stateLabel = photo.analysisState === 'ready' ? 'Analysed' : photo.analysisState === 'failed' ? 'Failed' : photo.analysisState === 'analysing' ? 'Analysing' : 'Not analysed';
                    return (
                      <button
                        ref={element => {
                          if (element) photoThumbnailRefs.current.set(photo.id, element);
                          else photoThumbnailRefs.current.delete(photo.id);
                        }}
                        className="photo-thumb"
                        data-active={activePhoto?.id === photo.id}
                        data-selected={photo.selected}
                        key={photo.id}
                        type="button"
                        aria-pressed={activePhoto?.id === photo.id}
                        aria-controls="selected-photo-detail"
                        aria-label={`Review Photo ${photo.imageNumber}: ${photo.name}. ${stateLabel}. ${photo.selected ? 'Included for review' : 'Not included for review'}.`}
                        onClick={() => setActivePhotoId(photo.id)}
                      >
                        {photo.previewUrl ? <img src={photo.previewUrl} alt="" /> : <div className="photo-thumb__placeholder" aria-hidden="true">{photo.imageNumber}</div>}
                        <span className="photo-thumb__label"><strong>Photo {photo.imageNumber}</strong><span>{stateLabel}</span></span>
                      </button>
                    );
                  })}
                </div>

                {activePhoto ? (
                  <section className="photo-contact__detail" id="selected-photo-detail" aria-labelledby={`photo-detail-title-${activePhoto.id}`}>
                    {activePhoto.previewUrl ? <img className="photo-detail__image" src={activePhoto.previewUrl} alt={`Photo ${activePhoto.imageNumber}: ${activePhoto.name}`} /> : <div className="photo-detail__placeholder" aria-hidden="true">{activePhoto.imageNumber}</div>}
                    <div className="photo-detail__copy">
                      <p className="document-kicker">Selected image</p>
                      <h3 id={`photo-detail-title-${activePhoto.id}`}>Photo {activePhoto.imageNumber}</h3>
                      <p>{activePhoto.name} · {activePhoto.analysisState === 'ready' ? 'Analysed' : activePhoto.analysisState === 'failed' ? 'Failed' : activePhoto.analysisState === 'analysing' ? 'Analysing' : 'Not analysed'}</p>
                      {activePhoto.error ? <div className="notice" data-tone="risk" role="alert"><div><strong>Photo issue</strong><p>{activePhoto.error}</p></div></div> : null}
                      <p className="field-help">{activePhotoHighlights.length} linked highlight{activePhotoHighlights.length === 1 ? '' : 's'} · inclusion is independent from keeping the uploaded photo.</p>
                      <label className="choice" data-selected={activePhoto.selected}>
                        <input type="checkbox" checked={activePhoto.selected} onChange={event => onPhotoSelected(activePhoto.id, event.target.checked)} />
                        <span><strong>Use Photo {activePhoto.imageNumber} for review</strong><span>Only approved highlights from included photos can enter the brief.</span></span>
                      </label>
                      {activePhoto.selected && activePhoto.analysisState !== 'ready' ? (
                        <button className="button button--secondary" type="button" disabled={isAnalysing} onClick={() => onAnalyse(activePhoto.id)}>
                          {activePhoto.analysisState === 'failed' ? 'Retry this photo' : 'Analyse this photo'}
                        </button>
                      ) : null}
                      <button className="button button--risk" type="button" disabled={activePhoto.analysisState === 'analysing'} aria-label={`Delete Photo ${activePhoto.imageNumber}: ${activePhoto.name}`} onClick={handleDeleteActivePhoto}>Delete photo</button>
                    </div>
                  </section>
                ) : null}
              </div>
            ) : null}

            {isAnalysing && analysisProgress ? (
              <div className="progress-region" role="status" aria-live="polite">
                <div className="progress-region__header">
                  <strong>{activeAnalysingPhoto
                    ? `Analysing Photo ${activeAnalysingPhoto.imageNumber}`
                    : analysisProgress.currentPhotoId
                      ? 'Analysing selected photo'
                      : 'Finishing photo analysis'}</strong>
                  <span>{analysisProgress.completed} of {analysisProgress.total} photos in this run processed · successful siblings remain available</span>
                </div>
                <div
                  className="progress-track"
                  role="progressbar"
                  aria-label="Photo analysis progress"
                  aria-valuemin={0}
                  aria-valuemax={analysisProgress.total}
                  aria-valuenow={analysisProgress.completed}
                  aria-valuetext={`${analysisProgress.completed} of ${analysisProgress.total} photos in this run processed`}
                >
                  <span style={{ width: `${photoProgress}%` }} />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {session.photos.highlights.length > 0 ? (
          <section className="surface" aria-labelledby="visual-highlights-title">
            <div className="surface__header">
              <div><h2 id="visual-highlights-title">Visual Highlights</h2><p>Each highlight stays linked to its source image and requires an explicit review state.</p></div>
            </div>
            <div>
              {session.photos.highlights.map(highlight => (
                <StatusRow
                  key={highlight.id}
                  state={highlight.state === 'failed' ? 'failed' : highlight.state === 'approved' ? 'approved' : highlight.state}
                  stateLabel={highlightLabel(highlight)}
                  title={highlight.approvedText || highlight.sourceText}
                  meta={`Photo ${highlight.imageNumber} · ${session.photos.policy === 'off' || !selectedIds.has(highlight.imageId) ? 'Not included in generation' : highlight.provenance}`}
                  actions={highlight.state === 'failed' ? undefined : highlight.state === 'excluded' ? (
                    <button className="row-action" type="button" aria-label={`Review exclusion for Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'correct')}>Review exclusion</button>
                  ) : (
                    <>
                      {highlight.state === 'needs-review' ? <button className="row-action" type="button" aria-label={`Approve Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'approve')}>Approve</button> : null}
                      <button className="row-action" type="button" aria-label={`Correct Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'correct')}>Correct</button>
                      <button className="row-action" type="button" aria-label={`Exclude Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'exclude')}>Exclude</button>
                    </>
                  )}
                />
              ))}
            </div>
          </section>
        ) : null}

        <div className="action-row">
          <button className="button button--primary" type="button" onClick={onApprove} disabled={unresolved} aria-describedby={unresolved ? 'photos-approval-reason' : undefined}>
            Approve photo policy
          </button>
          {unresolved ? <span className="disabled-reason" id="photos-approval-reason">Select a photo and resolve every selected photo highlight, or turn photo context off.</span> : null}
        </div>
      </div>
    </div>
  );
};
