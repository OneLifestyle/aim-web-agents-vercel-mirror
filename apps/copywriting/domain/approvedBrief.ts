import type {
  ApprovedBriefSnapshot,
  HardExcludedClaim,
  ReviewedClaim,
  ReviewedFact,
} from '../types';
import type { CampaignSessionState } from './sessionState';
import { isCampaignToneOption } from './campaignDirection.js';
import { derivePhotoReviewState } from './photoReview.js';
import {
  findGovernanceConflicts,
  normalizeHardExclusion,
  sanitizeCorrectedClaimContext,
  sanitizeLowerAuthorityText,
} from './governance.js';

export interface BuildApprovedBriefSnapshotOptions {
  approvedAt?: string;
  statement?: string;
}

export interface ApprovedBriefBlocker {
  id: string;
  message: string;
  governingStage: 'property' | 'campaign' | 'photos' | 'brief';
  /** Stable focus target used by Review actions. */
  targetId?: string;
  /** Agent-facing conflict context. Internal fact keys must not be exposed here. */
  affectedItem?: string;
  approvedValue?: string;
  conflictingValue?: string;
  sourceContext?: string;
  resolution?: string;
}

export type BriefApprovalState = 'NEEDS_ATTENTION' | 'READY_TO_APPROVE' | 'APPROVED';

export interface BriefApprovalPresentation {
  state: BriefApprovalState;
  statusLabel: string;
  noticeTitle: 'Brief is ready for approval' | null;
  primaryAction: 'approve' | 'open-outputs';
  primaryActionLabel: 'Approve brief and continue' | 'Open outputs';
}

const trimFactValue = (value: string | number | null): string | number | null => (
  typeof value === 'string' ? value.trim() : value
);

const cloneReviewedClaim = (claim: ReviewedClaim): ReviewedClaim => ({
  ...claim,
  id: claim.id.trim(),
  sourceText: claim.sourceText.trim(),
  approvedText: claim.approvedText.trim(),
  provenance: claim.provenance.trim(),
  aliases: claim.aliases.map(alias => alias.trim()),
  ...(claim.reason ? { reason: claim.reason.trim() } : {}),
});

const buildHardExclusion = (claim: ReviewedClaim): HardExcludedClaim => normalizeHardExclusion({
  id: claim.id.trim(),
  text: claim.approvedText.trim() || claim.sourceText.trim(),
  aliases: [claim.sourceText, claim.approvedText, ...claim.aliases],
  provenance: claim.provenance.trim(),
  ...(claim.reason ? { reason: claim.reason.trim() } : {}),
});

const buildFactProvenanceEntry = (
  fact: ReviewedFact,
): ApprovedBriefSnapshot['factProvenance'][number] => ({
  key: fact.key,
  sourceValue: trimFactValue(fact.sourceValue),
  approvedValue: trimFactValue(fact.approvedValue),
  ...(fact.sourceUnit ? { sourceUnit: fact.sourceUnit } : {}),
  ...(fact.unit ? { unit: fact.unit } : {}),
  provenance: fact.provenance.trim(),
  state: fact.state,
});

const getFact = (state: CampaignSessionState, key: ReviewedFact['key']): ReviewedFact => {
  const fact = state.property.facts.find(candidate => candidate.key === key);
  if (!fact) throw new Error(`Approved Brief is missing required fact ${key}.`);
  return fact;
};

const isEmptyApprovedFact = (fact: ReviewedFact): boolean => (
  typeof fact.approvedValue === 'string' && fact.approvedValue.trim() === ''
);

const formatFactValue = (
  fact: ApprovedBriefSnapshot['factProvenance'][number],
): string => {
  const value = fact.approvedValue;
  if (value === null || value === '') return 'Not supplied';
  return fact.key === 'landValue' ? `${value} ${fact.unit ?? 'm²'}` : String(value);
};

const getFactLabel = (key: ReviewedFact['key']): string => ({
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  carSpaces: 'Car spaces',
  landValue: 'Land',
  propertyType: 'Property type',
})[key];

const getConflictDetails = (
  conflict: ReturnType<typeof findGovernanceConflicts>[number],
  factProvenance: ApprovedBriefSnapshot['factProvenance'],
  hardExclusions: readonly HardExcludedClaim[],
  resolution: string,
): Pick<ApprovedBriefBlocker, 'affectedItem' | 'approvedValue' | 'conflictingValue' | 'sourceContext' | 'resolution'> => {
  if (conflict.kind === 'superseded-fact') {
    const fact = factProvenance.find(candidate => candidate.key === conflict.governingBriefItem);
    return {
      affectedItem: fact ? getFactLabel(fact.key) : 'Reviewed property fact',
      ...(fact ? { approvedValue: formatFactValue(fact) } : {}),
      conflictingValue: conflict.matchedText,
      ...(fact?.provenance ? { sourceContext: fact.provenance } : {}),
      resolution,
    };
  }
  const exclusion = hardExclusions.find(candidate => candidate.id === conflict.claimId);
  return {
    affectedItem: 'Hard factual exclusion',
    approvedValue: exclusion?.text ?? conflict.governingBriefItem,
    conflictingValue: conflict.matchedText,
    ...(exclusion?.provenance ? { sourceContext: exclusion.provenance } : {}),
    resolution,
  };
};

const conflictMessage = (
  details: Pick<ApprovedBriefBlocker, 'affectedItem' | 'approvedValue' | 'conflictingValue'>,
): string => {
  const affectedItem = details.affectedItem ?? 'Reviewed fact';
  if (details.approvedValue && details.conflictingValue) {
    return `${affectedItem} conflict: approved ${details.approvedValue}; conflicting wording “${details.conflictingValue}”.`;
  }
  return `${affectedItem} conflicts with reviewed property information.`;
};

const stableCanonicalJson = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableCanonicalJson).join(',')}]`;
  const objectValue = value as Record<string, unknown>;
  return `{${Object.keys(objectValue).filter(key => objectValue[key] !== undefined).sort().map(key => (
    `${JSON.stringify(key)}:${stableCanonicalJson(objectValue[key])}`
  )).join(',')}}`;
};

/** Browser-safe deterministic FNV-1a 64-bit hash. */
export const createStableSessionHash = (value: unknown): string => {
  const input = stableCanonicalJson(value);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index));
    hash = (hash * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
};

export const computeApprovedBriefSnapshotId = (
  snapshot: ApprovedBriefSnapshot | Omit<ApprovedBriefSnapshot, 'snapshotId'>,
): string => {
  const {
    snapshotId: _existingSnapshotId,
    approvedAt: _approvalClock,
    ...governingSnapshot
  } = snapshot as ApprovedBriefSnapshot;
  return `brief-${createStableSessionHash(governingSnapshot)}`;
};

export const getApprovedBriefBlockers = (state: CampaignSessionState): ApprovedBriefBlocker[] => {
  const blockers: ApprovedBriefBlocker[] = [];

  if (!state.address.selectedLabel) {
    blockers.push({
      id: 'address.required',
      message: 'Select a property address before approving the brief.',
      governingStage: 'property',
      targetId: 'property-address-input',
      resolution: 'Choose an address suggestion, then fetch or review its property details.',
    });
  }
  if (!state.product) {
    blockers.push({
      id: 'product.required',
      message: 'Select Listing Copy or Campaign Pack before approving the brief.',
      governingStage: 'property',
      targetId: 'product-intent-title',
      resolution: 'Choose the document set required for this campaign.',
    });
  }
  const approximateWordCount = state.listingGenerationSettings.approximateWordCount;
  if (
    !Number.isInteger(approximateWordCount)
    || approximateWordCount < 50
    || approximateWordCount > 1000
    || (approximateWordCount - 50) % 50 !== 0
  ) {
    blockers.push({
      id: 'listing-generation.approximate-word-count',
      message: 'Choose an approximate Listing Copy length from 50 to 1,000 words in 50-word steps.',
      governingStage: 'brief',
      targetId: 'brief-listing-length',
      resolution: 'Choose one of the supported Listing Copy lengths.',
    });
  }
  if (!state.property.approved) {
    blockers.push({
      id: 'property.approval',
      message: 'Approve the reviewed property facts before approving the brief.',
      governingStage: 'property',
      targetId: 'property-approval-action',
      resolution: 'Resolve the listed Property items, then approve the Property stage.',
    });
  }
  if (state.property.overview.trim() && state.property.overviewState === 'needs-review') {
    blockers.push({
      id: 'property.overview',
      message: 'Confirm or exclude the fetched property overview before approving the brief.',
      governingStage: 'property',
      targetId: 'property-overview-row',
      resolution: 'Confirm the overview or exclude it from generation.',
    });
  }
  if (state.property.overviewState === 'confirmed' && !state.property.overview.trim()) {
    blockers.push({
      id: 'property.overview.empty',
      message: 'The property overview cannot be confirmed when no overview was returned.',
      governingStage: 'property',
      targetId: 'property-overview-row',
      resolution: 'Exclude the empty overview or refetch the property details.',
    });
  }
  if (
    (state.property.profileInclusion === 'suburb' || state.property.profileInclusion === 'both')
    && !state.property.suburbContext.trim()
  ) {
    blockers.push({
      id: 'property.suburb-context',
      message: 'The selected location policy requires available suburb context.',
      governingStage: 'property',
      targetId: 'suburb-context-disclosure',
      resolution: 'Choose an available location option or refetch the property details.',
    });
  }
  if (
    (state.property.profileInclusion === 'area' || state.property.profileInclusion === 'both')
    && !state.property.areaContext.trim()
  ) {
    blockers.push({
      id: 'property.area-context',
      message: 'The selected location policy requires available area context.',
      governingStage: 'property',
      targetId: 'area-context-disclosure',
      resolution: 'Choose an available location option or refetch the property details.',
    });
  }
  if (!state.campaign.approved) {
    blockers.push({
      id: 'campaign.approval',
      message: 'Approve the campaign direction before approving the brief.',
      governingStage: 'campaign',
      targetId: 'campaign-approval-action',
      resolution: 'Review the final Campaign Direction, then approve it.',
    });
  }
  if (!state.campaign.primaryAudience.trim()) {
    blockers.push({
      id: 'campaign.primary-audience',
      message: 'Choose a primary audience before approving the brief.',
      governingStage: 'campaign',
      targetId: 'campaign-primary-audience',
      resolution: 'Choose or analyse a primary audience.',
    });
  }
  if (state.campaign.writingStyles.length === 0 || state.campaign.writingStyles.length > 2) {
    blockers.push({
      id: 'campaign.writing-styles',
      message: 'Choose one or two writing styles before approving the brief.',
      governingStage: 'campaign',
      targetId: 'campaign-writing-styles',
      resolution: 'Choose or analyse one or two writing styles.',
    });
  }
  if (!isCampaignToneOption(state.campaign.tone)) {
    blockers.push({
      id: 'campaign.tone',
      message: 'Choose a supported tone before approving the brief.',
      governingStage: 'campaign',
      targetId: 'campaign-tone',
      resolution: 'Choose a controlled tone or analyse Campaign Direction.',
    });
  }

  for (const fact of state.property.facts) {
    if (fact.state === 'needs-review' || fact.state === 'conflict' || isEmptyApprovedFact(fact)) {
      blockers.push({
        id: `fact.${fact.key}`,
        message: `${fact.label} requires an approved value.`,
        governingStage: 'property',
        targetId: `property-fact-${fact.key}`,
        affectedItem: fact.label,
        approvedValue: fact.approvedValue === null || fact.approvedValue === ''
          ? 'Not supplied'
          : fact.key === 'landValue'
            ? `${fact.approvedValue} ${fact.unit ?? 'm²'}`
            : String(fact.approvedValue),
        sourceContext: fact.provenance,
        resolution: 'Confirm the source value or correct it explicitly.',
      });
    }
    const sourceUnit = fact.key === 'landValue' ? fact.sourceUnit ?? 'm²' : undefined;
    const approvedUnit = fact.key === 'landValue' ? fact.unit ?? 'm²' : undefined;
    const valuesDiffer = trimFactValue(fact.sourceValue) !== trimFactValue(fact.approvedValue);
    const unitsDiffer = sourceUnit !== approvedUnit;
    if (fact.state === 'confirmed' && (valuesDiffer || unitsDiffer)) {
      blockers.push({
        id: `fact.${fact.key}.confirmation-mismatch`,
        message: `${fact.label} must be marked corrected when its approved value or unit differs from the source.`,
        governingStage: 'property',
        targetId: `property-fact-${fact.key}`,
        affectedItem: fact.label,
        sourceContext: fact.provenance,
        resolution: 'Open Correct and save the reviewed value.',
      });
    }
    if (fact.state === 'corrected' && !valuesDiffer && !unitsDiffer) {
      blockers.push({
        id: `fact.${fact.key}.unchanged-correction`,
        message: `${fact.label} has no changed value or unit and should be confirmed instead.`,
        governingStage: 'property',
        targetId: `property-fact-${fact.key}`,
        affectedItem: fact.label,
        sourceContext: fact.provenance,
        resolution: 'Confirm the unchanged source value.',
      });
    }
    if (typeof fact.approvedValue === 'number') {
      const mustBeInteger = fact.key === 'bedrooms' || fact.key === 'carSpaces';
      const maximum = fact.key === 'landValue' ? 100_000_000 : 100;
      if (!Number.isFinite(fact.approvedValue) || fact.approvedValue < 0 || fact.approvedValue > maximum || (mustBeInteger && !Number.isInteger(fact.approvedValue))) {
        blockers.push({
          id: `fact.${fact.key}.invalid-number`,
          message: `${fact.label} is outside the supported approved range.`,
          governingStage: 'property',
          targetId: `property-fact-${fact.key}`,
          affectedItem: fact.label,
          sourceContext: fact.provenance,
          resolution: 'Correct the value to a supported non-negative property fact.',
        });
      }
    }
  }
  for (const claim of state.property.claims) {
    if (claim.state === 'needs-review') {
      blockers.push({
        id: claim.id,
        message: `${claim.sourceText} requires a review decision.`,
        governingStage: 'property',
        targetId: `property-claim-${claim.id}`,
        affectedItem: 'Material claim',
        conflictingValue: claim.approvedText || claim.sourceText,
        sourceContext: claim.provenance,
        resolution: 'Confirm, correct, or exclude this claim.',
      });
    }
  }

  const factProvenance: ApprovedBriefSnapshot['factProvenance'] = state.property.facts.map(buildFactProvenanceEntry);
  const hardExclusions = state.property.claims
    .filter(claim => claim.state === 'excluded')
    .map(buildHardExclusion);
  const correctedClaimsForContext = state.property.claims.filter(claim => claim.state === 'corrected');
  const contextGovernance = { factProvenance, hardExclusions };
  for (const claim of state.property.claims) {
    if (claim.state !== 'conflict') continue;
    const conflict = findGovernanceConflicts(
      claim.approvedText || claim.sourceText,
      contextGovernance,
    )[0];
    if (conflict) {
      const details = getConflictDetails(
        conflict,
        factProvenance,
        hardExclusions,
        'Correct the material claim or exclude it from the campaign.',
      );
      blockers.push({
        id: claim.id,
        message: conflictMessage(details),
        governingStage: 'property',
        targetId: `property-claim-${claim.id}`,
        ...details,
      });
    } else {
      blockers.push({
        id: claim.id,
        message: `${claim.sourceText} requires a review decision.`,
        governingStage: 'property',
        targetId: `property-claim-${claim.id}`,
        affectedItem: 'Material claim',
        conflictingValue: claim.approvedText || claim.sourceText,
        sourceContext: claim.provenance,
        resolution: 'Correct or exclude this claim.',
      });
    }
  }
  const effectiveContext = (text: string): string => sanitizeCorrectedClaimContext(
    sanitizeLowerAuthorityText(text, contextGovernance).text,
    correctedClaimsForContext,
  );
  if (state.property.overviewState === 'confirmed' && state.property.overview.trim() && !effectiveContext(state.property.overview)) {
    blockers.push({
      id: 'property.overview.governance-empty',
      message: 'The selected property overview contains only superseded or excluded context. Exclude it or review the governing claims.',
      governingStage: 'property',
      targetId: 'property-overview-row',
      resolution: 'Exclude the overview or correct the related Property facts and claims.',
    });
  }
  if (
    (state.property.profileInclusion === 'suburb' || state.property.profileInclusion === 'both')
    && state.property.suburbContext.trim()
    && !effectiveContext(state.property.suburbContext)
  ) {
    blockers.push({
      id: 'property.suburb-context.governance-empty',
      message: 'The selected suburb context contains no approved usable context.',
      governingStage: 'property',
      targetId: 'suburb-context-disclosure',
      resolution: 'Exclude suburb context or correct the related Property facts and claims.',
    });
  }
  if (
    (state.property.profileInclusion === 'area' || state.property.profileInclusion === 'both')
    && state.property.areaContext.trim()
    && !effectiveContext(state.property.areaContext)
  ) {
    blockers.push({
      id: 'property.area-context.governance-empty',
      message: 'The selected area context contains no approved usable context.',
      governingStage: 'property',
      targetId: 'area-context-disclosure',
      resolution: 'Exclude area context or correct the related Property facts and claims.',
    });
  }
  for (const claim of state.property.claims) {
    if (claim.state !== 'confirmed' && claim.state !== 'corrected') continue;
    const conflict = findGovernanceConflicts(claim.approvedText, { factProvenance, hardExclusions })[0];
    if (conflict) {
      const details = getConflictDetails(
        conflict,
        factProvenance,
        hardExclusions,
        'Correct the material claim or exclude it from the campaign.',
      );
      blockers.push({
        id: claim.id,
        message: conflictMessage(details),
        governingStage: 'property',
        targetId: `property-claim-${claim.id}`,
        ...details,
      });
    }
  }
  for (const emphasis of state.campaign.emphasis) {
    const conflict = findGovernanceConflicts(emphasis, { factProvenance, hardExclusions })[0];
    if (conflict) {
      const details = getConflictDetails(
        conflict,
        factProvenance,
        hardExclusions,
        'Correct or remove this campaign emphasis. Factual exclusions are resolved in Property.',
      );
      blockers.push({
        id: `campaign.emphasis.${createStableSessionHash(emphasis)}`,
        message: conflictMessage(details),
        governingStage: 'campaign',
        targetId: 'campaign-emphasis-title',
        ...details,
      });
    }
  }
  for (const suggestion of state.campaign.suggestions) {
    // Selling-point recommendations already live in Campaign emphasis and are
    // validated above. Do not count the same user decision twice.
    if (suggestion.state === 'applied' && suggestion.kind !== 'selling-point') {
      const conflict = findGovernanceConflicts(suggestion.text, { factProvenance, hardExclusions })[0];
      if (conflict) {
        const details = getConflictDetails(
          conflict,
          factProvenance,
          hardExclusions,
          'Remove the recommendation or review the governing Property item.',
        );
        blockers.push({
          id: suggestion.id,
          message: conflictMessage(details),
          governingStage: 'campaign',
          targetId: `campaign-suggestion-${suggestion.id}`,
          ...details,
        });
      }
    }
  }

  if (state.photos.policy === 'included') {
    const photoReview = derivePhotoReviewState(state.photos);
    const selectedPhotoIds = new Set(photoReview.selectedPhotoIds);
    const photoDecisionBlockers: ApprovedBriefBlocker[] = photoReview.decisions.map(decision => {
      const photo = decision.photoId
        ? state.photos.items.find(candidate => candidate.id === decision.photoId)
        : undefined;
      const highlight = decision.highlightId
        ? state.photos.highlights.find(candidate => candidate.id === decision.highlightId)
        : undefined;
      return {
        id: decision.id,
        message: decision.message,
        governingStage: 'photos' as const,
        targetId: decision.targetId,
        ...(photo ? { affectedItem: `Photo ${photo.imageNumber}`, sourceContext: photo.name } : {}),
        ...(highlight ? {
          affectedItem: `Photo ${highlight.imageNumber} highlight`,
          conflictingValue: highlight.approvedText || highlight.sourceText,
          sourceContext: highlight.provenance,
        } : {}),
        resolution: decision.kind === 'review-highlight'
          ? 'Approve, correct, or exclude this highlight.'
          : decision.kind === 'select-photo'
            ? 'Select a reviewed photo or choose Photo context off.'
            : 'Analyse or retry the photo, or remove it from review.',
      };
    });
    for (const highlight of state.photos.highlights) {
      if (
        selectedPhotoIds.has(highlight.imageId)
        && (highlight.state === 'approved' || highlight.state === 'corrected')
      ) {
        const conflict = findGovernanceConflicts(highlight.approvedText, { factProvenance, hardExclusions })[0];
        if (conflict) {
          const details = getConflictDetails(
            conflict,
            factProvenance,
            hardExclusions,
            'Correct or exclude this highlight, or deselect the photo.',
          );
          photoDecisionBlockers.push({
            id: highlight.id,
            message: `Photo ${highlight.imageNumber}: ${conflictMessage(details)}`,
            governingStage: 'photos',
            targetId: `photo-highlight-${highlight.id}`,
            ...details,
          });
        }
      }
    }
    blockers.push(...photoDecisionBlockers);
    if (!state.photos.approved && photoDecisionBlockers.length === 0) {
      blockers.push({
        id: 'photos.approval',
        message: 'Approve the reviewed photo context before approving the brief.',
        governingStage: 'photos',
        targetId: 'photos-approval-action',
        resolution: 'Approve the selected photos and reviewed highlights, or turn photo context off.',
      });
    }
  }

  if (state.people.agentIncluded && !state.people.agent.name.trim()) {
    blockers.push({
      id: 'people.agent-name',
      message: 'Included agent context requires an approved agent name.',
      governingStage: 'brief',
      targetId: 'brief-agent-name',
      resolution: 'Add the agent name or turn off agent context.',
    });
  }
  if (state.people.agencyIncluded && !state.people.agencyName.trim()) {
    blockers.push({
      id: 'people.agency-name',
      message: 'Included agency context requires an approved agency name.',
      governingStage: 'brief',
      targetId: 'brief-agency-name',
      resolution: 'Add the agency name or turn off agency context.',
    });
  }
  return blockers;
};

/**
 * The single Reviewed Brief approval truth used by persistent navigation,
 * the full proof surface and its primary action.
 */
export const deriveBriefApprovalPresentation = (
  state: CampaignSessionState,
  blockers: readonly ApprovedBriefBlocker[] = getApprovedBriefBlockers(state),
): BriefApprovalPresentation => {
  const hasApprovedSnapshot = blockers.length === 0
    && state.brief.approved
    && state.brief.snapshot?.humanApproval.approved === true;
  if (hasApprovedSnapshot) {
    return {
      state: 'APPROVED',
      statusLabel: 'Approved',
      noticeTitle: null,
      primaryAction: 'open-outputs',
      primaryActionLabel: 'Open outputs',
    };
  }
  if (blockers.length > 0) {
    return {
      state: 'NEEDS_ATTENTION',
      statusLabel: `${blockers.length} issue${blockers.length === 1 ? '' : 's'}`,
      noticeTitle: null,
      primaryAction: 'approve',
      primaryActionLabel: 'Approve brief and continue',
    };
  }
  return {
    state: 'READY_TO_APPROVE',
    statusLabel: 'Ready to approve',
    noticeTitle: 'Brief is ready for approval',
    primaryAction: 'approve',
    primaryActionLabel: 'Approve brief and continue',
  };
};

export const buildApprovedBriefSnapshot = (
  state: CampaignSessionState,
  options: BuildApprovedBriefSnapshotOptions = {},
): ApprovedBriefSnapshot => {
  const blockers = getApprovedBriefBlockers(state);
  if (blockers.length > 0) {
    throw new Error(`Approved Brief cannot be created: ${blockers.map(blocker => blocker.message).join(' ')}`);
  }

  const bedrooms = getFact(state, 'bedrooms');
  const bathrooms = getFact(state, 'bathrooms');
  const carSpaces = getFact(state, 'carSpaces');
  const landValue = getFact(state, 'landValue');
  const propertyType = getFact(state, 'propertyType');
  const confirmedClaims = state.property.claims
    .filter(claim => claim.state === 'confirmed')
    .map(cloneReviewedClaim);
  const correctedClaims = state.property.claims
    .filter(claim => claim.state === 'corrected')
    .map(cloneReviewedClaim);
  const hardExclusions = state.property.claims
    .filter(claim => claim.state === 'excluded')
    .map(buildHardExclusion);
  const factProvenance: ApprovedBriefSnapshot['factProvenance'] = state.property.facts.map(buildFactProvenanceEntry);
  const governance = { factProvenance, hardExclusions };
  const sanitizeContext = (text: string): string => sanitizeCorrectedClaimContext(
    sanitizeLowerAuthorityText(text, governance).text,
    correctedClaims,
  );
  const selectedPhotos = state.photos.policy === 'included'
    ? state.photos.items
      .filter(photo => photo.selected)
      .map(({ id, name, imageNumber }) => ({ id: id.trim(), name: name.trim(), imageNumber }))
    : [];
  const selectedPhotoIds = new Set(selectedPhotos.map(photo => photo.id));
  const approvedHighlights = state.photos.policy === 'included'
    ? state.photos.highlights
      .filter(highlight => (
        selectedPhotoIds.has(highlight.imageId) &&
        (highlight.state === 'approved' || highlight.state === 'corrected')
      ))
      .map(highlight => ({
        ...highlight,
        id: highlight.id.trim(),
        imageId: highlight.imageId.trim(),
        sourceText: highlight.sourceText.trim(),
        approvedText: highlight.approvedText.trim(),
        provenance: highlight.provenance.trim(),
      }))
    : [];

  const snapshotWithoutId: Omit<ApprovedBriefSnapshot, 'snapshotId'> = {
    schemaVersion: 'copywriting-approved-brief.v2',
    approvedAt: options.approvedAt ?? new Date().toISOString(),
    selectedAddress: state.address.selectedLabel!.trim(),
    includeAddressInCopy: state.address.includeInCopy,
    product: state.product!,
    listingGenerationSettings: {
      approximateWordCount: state.listingGenerationSettings.approximateWordCount,
    },
    approvedFacts: {
      bedrooms: bedrooms.approvedValue as number | null,
      bathrooms: bathrooms.approvedValue as number | null,
      carSpaces: carSpaces.approvedValue as number | null,
      landValue: landValue.approvedValue as number | null,
      landUnit: landValue.unit ?? 'm²',
      propertyType: String(propertyType.approvedValue).trim(),
    },
    factProvenance,
    propertyOverview: state.property.overviewState === 'confirmed' ? sanitizeContext(state.property.overview) : '',
    suburbContext: state.property.profileInclusion === 'suburb' || state.property.profileInclusion === 'both'
      ? sanitizeContext(state.property.suburbContext)
      : '',
    areaContext: state.property.profileInclusion === 'area' || state.property.profileInclusion === 'both'
      ? sanitizeContext(state.property.areaContext)
      : '',
    profileInclusion: state.property.profileInclusion,
    claims: {
      confirmed: confirmedClaims,
      corrected: correctedClaims,
      excluded: hardExclusions.map(exclusion => ({ ...exclusion, aliases: [...exclusion.aliases] })),
    },
    agentContext: {
      included: state.people.agentIncluded,
      name: state.people.agent.name.trim(),
      title: state.people.agent.title.trim(),
      phone: state.people.agent.phone.trim(),
      email: state.people.agent.email.trim(),
      inclusionMode: state.people.agent.inclusionMode,
    },
    agencyContext: {
      included: state.people.agencyIncluded,
      name: state.people.agencyName.trim(),
    },
    openHomeContext: {
      included: state.people.openHomeIncluded,
      date: state.people.openHome.date.trim(),
      time: state.people.openHome.time.trim(),
      url: state.people.openHome.url.trim(),
    },
    audience: {
      primary: state.campaign.primaryAudience.trim(),
      secondary: state.campaign.secondaryAudience.trim(),
    },
    voice: {
      writingStyles: state.campaign.writingStyles.map(style => style.trim()),
      tone: state.campaign.tone.trim(),
    },
    campaignEmphasis: state.campaign.emphasis.map(text => sanitizeLowerAuthorityText(text, governance).text).filter(Boolean),
    styleAvoidances: state.campaign.styleAvoidances.map(text => text.trim()),
    hardExclusions: hardExclusions.map(exclusion => ({ ...exclusion, aliases: [...exclusion.aliases] })),
    photoContext: {
      policy: state.photos.policy,
      selectedPhotos,
      approvedHighlights,
    },
    humanApproval: {
      approved: true,
      statement: (options.statement ?? 'Approved for generation in this temporary session.').trim(),
    },
  };
  return {
    ...snapshotWithoutId,
    snapshotId: computeApprovedBriefSnapshotId(snapshotWithoutId),
  };
};
