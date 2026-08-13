import type { ReviewedClaim, ReviewedFact } from '../types';
import {
  getApprovedBriefBlockers,
  type ApprovedBriefBlocker,
} from './approvedBrief';
import type { CampaignSessionState } from './sessionState';

const DOTTED_SOURCE_CITATION_TOKEN = /\[\d+(?:\.\d+)+\]/g;
const EDGE_SOURCE_CITATION_TOKEN = /(?:^\s*\[\d{1,2}(?:\s*[,;]\s*\d{1,2})*\]\s+|\s+\[\d{1,2}(?:\s*[,;]\s*\d{1,2})*\]\s*$)/g;
const LEADING_LIST_MARKER = /^\s*(?:[-*•]\s+|\(\d{1,3}\)\s+|\d{1,3}[.)]\s+|[a-z][.)]\s+)/i;

/**
 * Removes provider/source citation tokens and explicit list markers from a
 * human-readable Property claim. Numeric property content is deliberately
 * preserved: `20,200 m²`, `20200 m²`, `1.5 acres` and similar leading values
 * are not list markers.
 */
export const cleanPropertyClaimText = (value: string): string => {
  let cleaned = value
    .replace(DOTTED_SOURCE_CITATION_TOKEN, ' ')
    .replace(EDGE_SOURCE_CITATION_TOKEN, ' ');
  while (LEADING_LIST_MARKER.test(cleaned)) cleaned = cleaned.replace(LEADING_LIST_MARKER, '');
  return cleaned
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/^[,;:]\s*/, '')
    .trim();
};

/** Splits fetched claim-list text without treating grouped-number commas as separators. */
export const splitPropertyClaimText = (value: string, maximumItems = 8): string[] => (
  value
    .replace(/\r/g, '')
    .split(/\n|;|•/)
    .map(cleanPropertyClaimText)
    .filter(Boolean)
    .slice(0, Math.max(0, maximumItems))
);

const factCanBeBulkConfirmed = (fact: ReviewedFact): boolean => (
  fact.state === 'needs-review'
  && !(typeof fact.sourceValue === 'string' && fact.sourceValue.trim() === '')
);

/**
 * Confirms only eligible unresolved facts. Corrected/conflict decisions and all
 * item provenance remain byte-for-byte intact.
 */
export const confirmAllEligiblePropertyFacts = (
  facts: readonly ReviewedFact[],
): ReviewedFact[] => facts.map(fact => {
  if (!factCanBeBulkConfirmed(fact)) return fact;
  return {
    ...fact,
    approvedValue: fact.sourceValue,
    ...(fact.key === 'landValue' ? { unit: fact.sourceUnit ?? 'm²' as const } : {}),
    state: 'confirmed',
  };
});

/**
 * Confirms only eligible unresolved claims. Corrected, excluded and conflict
 * decisions, aliases and provenance are preserved.
 */
export const confirmAllEligiblePropertyClaims = (
  claims: readonly ReviewedClaim[],
  canConfirm: (claim: ReviewedClaim) => boolean = () => true,
  hasConflict: (claim: ReviewedClaim) => boolean = () => false,
): ReviewedClaim[] => claims.map(claim => {
  if (claim.state !== 'needs-review' || !claim.sourceText.trim()) return claim;
  if (hasConflict(claim)) return { ...claim, state: 'conflict' };
  if (!canConfirm(claim)) return claim;
  return {
    ...claim,
    approvedText: claim.sourceText,
    state: 'confirmed',
  };
});

export const countBulkConfirmablePropertyFacts = (facts: readonly ReviewedFact[]): number => (
  facts.filter(factCanBeBulkConfirmed).length
);

export const countBulkConfirmablePropertyClaims = (
  claims: readonly ReviewedClaim[],
  canConfirm: (claim: ReviewedClaim) => boolean = () => true,
): number => (
  claims.filter(claim => (
    claim.state === 'needs-review'
    && Boolean(claim.sourceText.trim())
    && canConfirm(claim)
  )).length
);

export type PropertyAddressState =
  | 'empty'
  | 'typed'
  | 'selected'
  | 'fetching'
  | 'fetched'
  | 'failed-retry';

export interface PropertyAddressStateInput {
  query: string;
  selectedLabel: string | null;
  isFetching: boolean;
  fetchError: string | null;
  hasFetchedContext: boolean;
}

export const selectedPropertyAddressMatchesQuery = (
  query: string,
  selectedLabel: string | null,
): boolean => Boolean(
  selectedLabel
  && selectedLabel.trim().toLocaleLowerCase('en-AU') === query.trim().toLocaleLowerCase('en-AU'),
);

/** One deterministic address lifecycle used for status copy and Fetch/Refetch controls. */
export const derivePropertyAddressState = ({
  query,
  selectedLabel,
  isFetching,
  fetchError,
  hasFetchedContext,
}: PropertyAddressStateInput): PropertyAddressState => {
  if (isFetching) return 'fetching';
  if (fetchError) return 'failed-retry';
  const selectedMatches = selectedPropertyAddressMatchesQuery(query, selectedLabel);
  if (hasFetchedContext && selectedMatches) return 'fetched';
  if (selectedMatches) return 'selected';
  if (query.trim()) return 'typed';
  return 'empty';
};

export const propertyFactTargetId = (key: ReviewedFact['key']): string => `property-fact-${key}`;
export const propertyClaimTargetId = (id: string): string => `property-claim-${id}`;

const PROPERTY_FACT_LABELS: Readonly<Record<ReviewedFact['key'], string>> = {
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  carSpaces: 'Car spaces',
  landValue: 'Land',
  propertyType: 'Property type',
};

export const propertyFactAgentLabel = (key: string): string => (
  PROPERTY_FACT_LABELS[key as ReviewedFact['key']] ?? key
);

type TargetablePropertyBlocker = ApprovedBriefBlocker & { targetId?: string };

/** Falls back safely for older blockers while enriched blockers carry an exact targetId. */
export const resolvePropertyBlockerTargetId = (
  blocker: TargetablePropertyBlocker,
  state: Pick<CampaignSessionState, 'property'>,
): string => {
  if (blocker.targetId) return blocker.targetId;
  if (state.property.claims.some(claim => claim.id === blocker.id)) return propertyClaimTargetId(blocker.id);
  if (blocker.id.startsWith('fact.')) {
    const key = blocker.id.split('.')[1] as ReviewedFact['key'] | undefined;
    if (key && key in PROPERTY_FACT_LABELS) return propertyFactTargetId(key);
  }
  if (blocker.id.startsWith('property.overview')) return 'property-overview-row';
  if (blocker.id.startsWith('property.suburb-context')) return 'suburb-context-disclosure';
  if (blocker.id.startsWith('property.area-context')) return 'area-context-disclosure';
  if (blocker.id.startsWith('address.')) return 'property-address-title';
  if (blocker.id.startsWith('product.')) return 'product-intent-title';
  return 'property-approval-action';
};

/** Contextual accessible name for repeated Property issue Review actions. */
export const getPropertyBlockerReviewAccessibleName = (
  blocker: TargetablePropertyBlocker,
  state: Pick<CampaignSessionState, 'property'>,
): string => {
  const targetId = resolvePropertyBlockerTargetId(blocker, state);
  const fact = state.property.facts.find(candidate => propertyFactTargetId(candidate.key) === targetId);
  if (fact) return `Review ${fact.label || propertyFactAgentLabel(fact.key)}`;

  const claim = state.property.claims.find(candidate => propertyClaimTargetId(candidate.id) === targetId);
  if (claim) {
    const claimLabel = claim.approvedText.trim() || claim.sourceText.trim();
    const claimNumber = state.property.claims.findIndex(candidate => candidate.id === claim.id) + 1;
    return `Review material claim ${claimNumber}: ${claimLabel || 'Unnamed claim'}`;
  }

  const targetLabels: Readonly<Record<string, string>> = {
    'property-overview-row': 'Property overview',
    'suburb-context-disclosure': 'Suburb context',
    'area-context-disclosure': 'Area context',
    'property-address-title': 'Property address',
    'product-intent-title': 'campaign product',
    'property-approval-action': 'Property approval',
  };
  const targetLabel = targetLabels[targetId];
  if (targetLabel) return `Review ${targetLabel}`;
  if (blocker.affectedItem?.trim()) return `Review ${propertyFactAgentLabel(blocker.affectedItem.trim())}`;
  return `Review Property decision: ${blocker.message}`;
};

export type PropertyReviewStatus = 'blocked' | 'ready' | 'approved';

export interface PropertyReviewReadiness {
  status: PropertyReviewStatus;
  issues: readonly ApprovedBriefBlocker[];
  unresolvedActionCount: number;
  canApprove: boolean;
}

/**
 * Canonical Property readiness. When issues are supplied they must be the full
 * candidate-approval blocker set produced with `property.approved: true`.
 */
export const derivePropertyReviewReadiness = (
  state: CampaignSessionState,
  candidateApprovalBlockers?: readonly ApprovedBriefBlocker[],
): PropertyReviewReadiness => {
  const issues = (candidateApprovalBlockers ?? getApprovedBriefBlockers({
    ...state,
    property: { ...state.property, approved: true },
  })).filter(blocker => blocker.governingStage === 'property');
  const unresolvedActionCount = new Set(issues.map(issue => issue.targetId ?? issue.id)).size;
  const status: PropertyReviewStatus = issues.length > 0
    ? 'blocked'
    : state.property.approved
      ? 'approved'
      : 'ready';
  return {
    status,
    issues,
    unresolvedActionCount,
    canApprove: status === 'ready',
  };
};
