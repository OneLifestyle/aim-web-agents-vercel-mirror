import type { ReviewedPhoto, ReviewedPhotoHighlight } from '../types';
import type { CampaignSessionState } from './sessionState';

type PhotoReviewStateInput = CampaignSessionState['photos'];

export const PHOTO_ANALYSIS_STATE_LABELS: Record<ReviewedPhoto['analysisState'], string> = {
  'not-analysed': 'Waiting',
  analysing: 'Analysing',
  ready: 'Ready',
  failed: 'Failed',
};

export const getPhotoAnalysisStateLabel = (state: ReviewedPhoto['analysisState']): string => (
  PHOTO_ANALYSIS_STATE_LABELS[state]
);

export const getPhotoHighlightElementId = (highlightId: string): string => `photo-highlight-${highlightId}`;
export const getPhotoThumbnailElementId = (photoId: string): string => `photo-thumbnail-${photoId}`;

/** Off subordinates administration until the user deliberately reveals it. */
export const isPhotoAdministrationVisible = (
  policy: CampaignSessionState['photos']['policy'],
  offControlsExpanded: boolean,
): boolean => policy === 'included' || offControlsExpanded;

export type PhotoReviewDecisionKind = 'select-photo' | 'analyse-photo' | 'review-highlight' | 'resolve-photo';

export interface PhotoReviewDecision {
  id: string;
  kind: PhotoReviewDecisionKind;
  message: string;
  targetId: string;
  photoId?: string;
  highlightId?: string;
}

export interface DerivedPhotoReviewState {
  decisions: PhotoReviewDecision[];
  unresolvedCount: number;
  canApprovePolicy: boolean;
  isApproved: boolean;
  selectedPhotoIds: string[];
  bulkApprovableHighlightIds: string[];
}

export interface PhotoReviewRules {
  /** Returns false for a factual conflict that must remain an item exception. */
  canBulkApproveHighlight?: (highlight: ReviewedPhotoHighlight) => boolean;
  /** Identifies a reviewed highlight that must be corrected or excluded. */
  isHighlightConflict?: (highlight: ReviewedPhotoHighlight) => boolean;
}

export const getBulkApprovablePhotoHighlights = (
  photos: PhotoReviewStateInput,
  canApprove: (highlight: ReviewedPhotoHighlight) => boolean = () => true,
): ReviewedPhotoHighlight[] => {
  if (photos.policy !== 'included') return [];
  const readySelectedPhotoIds = new Set(photos.items
    .filter(photo => photo.selected && photo.analysisState === 'ready')
    .map(photo => photo.id));
  return photos.highlights.filter(highlight => (
    readySelectedPhotoIds.has(highlight.imageId)
    && highlight.state === 'needs-review'
    && Boolean(highlight.sourceText.trim())
    && canApprove(highlight)
  ));
};

/**
 * Derives one entry per real user decision. Secondary invariants, such as a
 * selected photo not yet having an approved highlight, are not counted again
 * when the unresolved highlight already explains the required action.
 */
export const derivePhotoReviewState = (
  photos: PhotoReviewStateInput,
  rules: PhotoReviewRules = {},
): DerivedPhotoReviewState => {
  const selectedPhotos = photos.items.filter(photo => photo.selected);
  const selectedPhotoIds = selectedPhotos.map(photo => photo.id);
  const decisions: PhotoReviewDecision[] = [];

  if (photos.policy === 'included' && selectedPhotos.length === 0) {
    decisions.push({
      id: 'photos.selection',
      kind: 'select-photo',
      message: 'Select at least one photo for review, or turn photo context off.',
      targetId: 'photo-upload-title',
    });
  }

  if (photos.policy === 'included') {
    for (const photo of selectedPhotos) {
      const photoTargetId = getPhotoThumbnailElementId(photo.id);
      if (photo.analysisState !== 'ready') {
        decisions.push({
          id: `photo.${photo.id}.analysis`,
          kind: 'analyse-photo',
          message: photo.analysisState === 'failed'
            ? `Retry Photo ${photo.imageNumber}, or remove it from review.`
            : `Analyse Photo ${photo.imageNumber} before including it.`,
          targetId: photoTargetId,
          photoId: photo.id,
        });
        continue;
      }

      const highlights = photos.highlights.filter(highlight => highlight.imageId === photo.id);
      const highlightsNeedingReview = highlights.filter(highlight => highlight.state === 'needs-review');
      for (const highlight of highlightsNeedingReview) {
        decisions.push({
          id: highlight.id,
          kind: 'review-highlight',
          message: `Review Photo ${photo.imageNumber} highlight.`,
          targetId: getPhotoHighlightElementId(highlight.id),
          photoId: photo.id,
          highlightId: highlight.id,
        });
      }

      const failedHighlights = highlights.filter(highlight => highlight.state === 'failed');
      if (failedHighlights.length > 0) {
        decisions.push({
          id: `photo.${photo.id}.failed-highlight`,
          kind: 'analyse-photo',
          message: `Retry Photo ${photo.imageNumber} analysis, or remove it from review.`,
          targetId: photoTargetId,
          photoId: photo.id,
        });
      }

      const hasApprovedHighlight = highlights.some(highlight => (
        highlight.state === 'approved' || highlight.state === 'corrected'
      ));
      for (const highlight of highlights) {
        if (
          (highlight.state === 'approved' || highlight.state === 'corrected')
          && rules.isHighlightConflict?.(highlight)
        ) {
          decisions.push({
            id: `${highlight.id}.conflict`,
            kind: 'review-highlight',
            message: `Correct or exclude the conflicting Photo ${photo.imageNumber} highlight.`,
            targetId: getPhotoHighlightElementId(highlight.id),
            photoId: photo.id,
            highlightId: highlight.id,
          });
        }
      }
      if (
        !hasApprovedHighlight
        && highlightsNeedingReview.length === 0
        && failedHighlights.length === 0
      ) {
        decisions.push({
          id: `photo.${photo.id}.highlight-required`,
          kind: 'resolve-photo',
          message: `Correct a usable Photo ${photo.imageNumber} highlight, or remove the photo from review.`,
          targetId: photoTargetId,
          photoId: photo.id,
        });
      }
    }
  }

  const bulkApprovableHighlightIds = getBulkApprovablePhotoHighlights(
    photos,
    rules.canBulkApproveHighlight,
  ).map(highlight => highlight.id);
  const canApprovePolicy = photos.policy === 'off' || decisions.length === 0;

  return {
    decisions,
    unresolvedCount: decisions.length,
    canApprovePolicy,
    isApproved: photos.approved && canApprovePolicy,
    selectedPhotoIds,
    bulkApprovableHighlightIds,
  };
};

/** Approves only eligible unresolved highlights and preserves every exception. */
export const approveAllEligiblePhotoHighlights = (
  photos: PhotoReviewStateInput,
  canApprove: (highlight: ReviewedPhotoHighlight) => boolean = () => true,
): PhotoReviewStateInput => {
  const eligibleIds = new Set(getBulkApprovablePhotoHighlights(photos, canApprove)
    .map(highlight => highlight.id));
  if (eligibleIds.size === 0) return photos;

  return {
    ...photos,
    approved: false,
    highlights: photos.highlights.map(highlight => eligibleIds.has(highlight.id)
      ? { ...highlight, approvedText: highlight.sourceText, state: 'approved' as const }
      : highlight),
  };
};
