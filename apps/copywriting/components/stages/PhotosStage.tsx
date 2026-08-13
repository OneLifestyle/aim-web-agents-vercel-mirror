import React, { useEffect, useRef, useState } from 'react';
import type { ReviewedPhotoHighlight } from '../../types';
import type { CampaignSessionState } from '../../domain/sessionState';
import {
  derivePhotoReviewState,
  getPhotoAnalysisStateLabel,
  getPhotoHighlightElementId,
  getPhotoThumbnailElementId,
  isPhotoAdministrationVisible,
} from '../../domain/photoReview';
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
  canBulkApproveHighlight?: (highlight: ReviewedPhotoHighlight) => boolean;
  isHighlightConflict?: (highlight: ReviewedPhotoHighlight) => boolean;
  onApproveAllHighlights?: () => void;
  onPrevious?: () => void;
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
  canBulkApproveHighlight,
  isHighlightConflict,
  onApproveAllHighlights,
  onPrevious,
  onApprove,
}) => {
  const [activePhotoId, setActivePhotoId] = useState<string | null>(null);
  const [isDraggingFiles, setIsDraggingFiles] = useState(false);
  const [offControlsExpanded, setOffControlsExpanded] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const photoThumbnailRefs = useRef(new Map<string, HTMLButtonElement>());
  const selectedPhotos = session.photos.items.filter(photo => photo.selected);
  const photosAwaitingAnalysis = selectedPhotos.filter(photo => photo.analysisState !== 'ready');
  const selectedIds = new Set(selectedPhotos.map(photo => photo.id));
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
  const reviewState = derivePhotoReviewState(session.photos, {
    canBulkApproveHighlight,
    isHighlightConflict,
  });
  const bulkApprovableCount = reviewState.bulkApprovableHighlightIds.length;
  const showPhotoAdministration = isPhotoAdministrationVisible(
    session.photos.policy,
    offControlsExpanded,
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
          <p>Choose whether reviewed photo context may be used in generation. Analysis alone never includes a highlight.</p>
        </div>
        {onPrevious ? <div className="stage-header__actions"><button className="button button--quiet" type="button" onClick={onPrevious}>Previous: Campaign</button></div> : null}
      </header>

      <div className="section-stack">
        <section className="surface" aria-labelledby="photo-policy-title">
          <div className="surface__header">
            <div><h2 id="photo-policy-title">Photo context</h2><p>Choose whether reviewed photo observations may be included in generation.</p></div>
          </div>
          <div className="surface__body">
            <div className="photo-policy" role="radiogroup" aria-label="Photo context policy">
              <label className="photo-policy__option" data-selected={session.photos.policy === 'off'}>
                <input type="radio" name="photo-policy" checked={session.photos.policy === 'off'} onChange={() => { setOffControlsExpanded(false); onPolicyChange('off'); }} />
                <span><strong>Photo context off</strong><span>Analysis may remain visible, but no photo content enters generation.</span></span>
              </label>
              <label className="photo-policy__option" data-selected={session.photos.policy === 'included'}>
                <input type="radio" name="photo-policy" checked={session.photos.policy === 'included'} onChange={() => onPolicyChange('included')} />
                <span><strong>Use reviewed photo context</strong><span>Only selected photos and approved highlights enter the brief.</span></span>
              </label>
            </div>
            {session.photos.policy === 'off' ? (
              <div className="notice photo-controls-disclosure">
                <div>
                  <strong>Photos will not influence this campaign’s copy.</strong>
                  <p>Uploaded photos, analysis and review decisions remain in this temporary session.</p>
                  <div className="action-row photo-controls-disclosure">
                    <button
                      className="button button--secondary"
                      type="button"
                      aria-expanded={offControlsExpanded}
                      aria-controls="photo-administration"
                      onClick={() => setOffControlsExpanded(expanded => !expanded)}
                    >
                      {offControlsExpanded ? 'Hide photo controls' : 'Show photo controls'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div
          className="section-stack photo-administration"
          id="photo-administration"
          hidden={!showPhotoAdministration}
        >
        <section className="surface" aria-labelledby="photo-upload-title">
          <div className="surface__header">
            <div><h2 id="photo-upload-title">Campaign photos</h2><p>Up to 20 JPG, PNG, WebP, HEIC or HEIF images. Analyse the selected batch, then review exceptions.</p></div>
            <button className="button button--primary" type="button" disabled={photosAwaitingAnalysis.length === 0 || isAnalysing} onClick={() => onAnalyse()}>
              {isAnalysing
                ? 'Analysing photos…'
                : photosAwaitingAnalysis.length > 0
                  ? `Analyse ${photosAwaitingAnalysis.length} Photo${photosAwaitingAnalysis.length === 1 ? '' : 's'}`
                  : 'Selected photos ready'}
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
                    const stateLabel = getPhotoAnalysisStateLabel(photo.analysisState);
                    return (
                      <button
                        ref={element => {
                          if (element) photoThumbnailRefs.current.set(photo.id, element);
                          else photoThumbnailRefs.current.delete(photo.id);
                        }}
                        className="photo-thumb"
                        id={getPhotoThumbnailElementId(photo.id)}
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
                      <p>{activePhoto.name} · {getPhotoAnalysisStateLabel(activePhoto.analysisState)}</p>
                      {activePhoto.error ? <div className="notice" data-tone="risk" role="alert"><div><strong>Photo issue</strong><p>{activePhoto.error}</p></div></div> : null}
                      <p className="field-help">{activePhotoHighlights.length} linked highlight{activePhotoHighlights.length === 1 ? '' : 's'} · inclusion is independent from keeping the uploaded photo.</p>
                      <label className="choice" data-selected={activePhoto.selected}>
                        <input type="checkbox" checked={activePhoto.selected} onChange={event => onPhotoSelected(activePhoto.id, event.target.checked)} />
                        <span><strong>Use Photo {activePhoto.imageNumber} for review</strong><span>Only approved highlights from included photos can enter the brief.</span></span>
                      </label>
                      {activePhoto.selected && activePhoto.analysisState === 'failed' ? (
                        <button className="button button--secondary" type="button" disabled={isAnalysing} onClick={() => onAnalyse(activePhoto.id)}>
                          Retry this photo
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
              {bulkApprovableCount > 0 && onApproveAllHighlights ? (
                <button className="button button--secondary" type="button" onClick={onApproveAllHighlights}>
                  Approve all {bulkApprovableCount} reviewed highlight{bulkApprovableCount === 1 ? '' : 's'}
                </button>
              ) : null}
            </div>
            <div>
              {session.photos.highlights.map(highlight => {
                const hasFactualConflict = isHighlightConflict?.(highlight) ?? false;
                return (
                <div key={highlight.id} id={getPhotoHighlightElementId(highlight.id)}>
                  <StatusRow
                    state={highlight.state === 'failed' ? 'failed' : highlight.state === 'approved' ? 'approved' : highlight.state}
                    stateLabel={hasFactualConflict ? 'Factual conflict' : highlightLabel(highlight)}
                    title={highlight.approvedText || highlight.sourceText}
                    meta={`Photo ${highlight.imageNumber} · ${session.photos.policy === 'off' || !selectedIds.has(highlight.imageId) ? 'Not included in generation' : highlight.provenance}`}
                    actions={highlight.state === 'failed' ? undefined : highlight.state === 'excluded' ? (
                      <button className="row-action" type="button" aria-label={`Review exclusion for Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'correct')}>Review exclusion</button>
                    ) : (
                      <>
                        {highlight.state === 'needs-review' && !hasFactualConflict ? <button className="row-action" type="button" aria-label={`Approve Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'approve')}>Approve</button> : null}
                        <button className="row-action" type="button" aria-label={`Correct Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'correct')}>Correct</button>
                        <button className="row-action" type="button" aria-label={`Exclude Photo ${highlight.imageNumber} highlight: ${highlight.approvedText || highlight.sourceText}`} onClick={() => onHighlightAction(highlight, 'exclude')}>Exclude</button>
                      </>
                    )}
                  />
                  <details className="disclosure">
                    <summary>
                      <span><strong>Source Context</strong><span>Photo {highlight.imageNumber} analysis · {highlight.provenance}</span></span>
                    </summary>
                    <div className="disclosure__body">
                      <p>{highlight.sourceText || 'No usable source observation was returned.'}</p>
                    </div>
                  </details>
                </div>
              );})}
            </div>
          </section>
        ) : null}
        </div>

        <div className="action-row">
          <button id="photos-approval-action" className="button button--secondary" type="button" onClick={onApprove} disabled={!reviewState.canApprovePolicy} aria-describedby={!reviewState.canApprovePolicy ? 'photos-approval-reason' : undefined}>
            Approve photo context
          </button>
          {!reviewState.canApprovePolicy ? (
            <span className="disabled-reason" id="photos-approval-reason">
              {reviewState.unresolvedCount} decision{reviewState.unresolvedCount === 1 ? '' : 's'} remaining. {reviewState.decisions[0]?.message}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
};
