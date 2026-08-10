import type {
  ApprovedBriefSnapshot,
  CampaignOutputDocument,
  IntegrityIssueCode,
  OutputIntegrityIssue,
  PreviewTab,
  ReviewedPhotoHighlight,
} from '../types';
import { CAMPAIGN_PACK_OUTPUT_ORDER, CANONICAL_OUTPUT_ORDER } from './outputInventory';
import {
  findExcludedClaimConflict,
  findSupersededClaimConflicts,
  findSupersededFactConflicts,
  normalizeGovernanceText,
} from './governance';

export interface ValidateReturnedOutputInput {
  id: PreviewTab;
  content: string;
  snapshot: ApprovedBriefSnapshot;
  boundSnapshotId: string | null;
  usedPhotoContext: boolean;
  knownPhotoHighlights?: readonly ReviewedPhotoHighlight[];
  generatedAt?: string;
}

export interface OutputEligibility {
  canCopy: boolean;
  canExport: boolean;
  reasons: string[];
}

export interface ExportEligibilityOmission {
  outputId: PreviewTab;
  state: CampaignOutputDocument['state'];
  reasons: string[];
}

export interface ExportEligibilityInput {
  sections: Partial<Record<PreviewTab, string>>;
  eligibleOutputIds: PreviewTab[];
  omitted: ExportEligibilityOmission[];
  counts: {
    included: number;
    missing: number;
    stale: number;
    blocked: number;
    failed: number;
  };
}

export interface DerivedCampaignPackState {
  state: 'idle' | 'generating' | 'partial' | 'ready';
  readyOutputIds: PreviewTab[];
  failedOutputIds: PreviewTab[];
  staleOutputIds: PreviewTab[];
  blockedOutputIds: PreviewTab[];
  missingOutputIds: PreviewTab[];
  inProgressOutputIds: PreviewTab[];
  remainingOutputIds: PreviewTab[];
  retryOutputIds: PreviewTab[];
}

const createIssue = (
  code: IntegrityIssueCode,
  message: string,
  governingBriefItem: string,
  extra: Pick<OutputIntegrityIssue, 'claimId' | 'matchedText'> = {},
): OutputIntegrityIssue => ({
  code,
  message,
  governingBriefItem,
  ...extra,
});

const includesGovernedText = (content: string, governedText: string): boolean => {
  const normalizedContent = ` ${normalizeGovernanceText(content)} `;
  const normalizedGovernedText = normalizeGovernanceText(governedText);
  return Boolean(normalizedGovernedText) && normalizedContent.includes(` ${normalizedGovernedText} `);
};

const findPhotoContextIssues = (
  content: string,
  snapshot: ApprovedBriefSnapshot,
  usedPhotoContext: boolean,
  knownHighlights: readonly ReviewedPhotoHighlight[],
): OutputIntegrityIssue[] => {
  const issues: OutputIntegrityIssue[] = [];
  const selectedPhotoIds = new Set(snapshot.photoContext.selectedPhotos.map(photo => photo.id));
  const approvedHighlightIds = new Set(snapshot.photoContext.approvedHighlights.map(highlight => highlight.id));

  if (snapshot.photoContext.policy === 'off' && usedPhotoContext) {
    issues.push(createIssue(
      'photo-context-conflict',
      'The output reports using photo context while the Approved Brief has photo context off.',
      'Photo context off',
    ));
  }
  if (
    snapshot.photoContext.policy === 'included' &&
    usedPhotoContext &&
    snapshot.photoContext.approvedHighlights.length === 0
  ) {
    issues.push(createIssue(
      'photo-context-conflict',
      'The output reports using photo context but the Approved Brief contains no approved highlights.',
      'Approved photo highlights',
    ));
  }

  for (const highlight of knownHighlights) {
    const textVariants = [highlight.sourceText, highlight.approvedText].filter(Boolean);
    const appearsInOutput = textVariants.some(text => includesGovernedText(content, text));
    if (!appearsInOutput) continue;

    const isApproved = approvedHighlightIds.has(highlight.id) &&
      selectedPhotoIds.has(highlight.imageId) &&
      (highlight.state === 'approved' || highlight.state === 'corrected');
    if (snapshot.photoContext.policy === 'off' || !isApproved) {
      issues.push(createIssue(
        'photo-context-conflict',
        `Photo ${highlight.imageNumber} context was not approved for this output.`,
        `Photo highlight ${highlight.id}`,
        { matchedText: highlight.approvedText || highlight.sourceText },
      ));
      continue;
    }
    if (
      highlight.state === 'corrected' &&
      normalizeGovernanceText(highlight.sourceText) !== normalizeGovernanceText(highlight.approvedText) &&
      (() => {
        const approvedPhrase = normalizeGovernanceText(highlight.approvedText);
        let remainingContent = ` ${normalizeGovernanceText(content)} `;
        if (approvedPhrase) remainingContent = remainingContent.replaceAll(` ${approvedPhrase} `, ' ');
        const sourcePhrase = normalizeGovernanceText(highlight.sourceText);
        return Boolean(sourcePhrase) && remainingContent.includes(` ${sourcePhrase} `);
      })()
    ) {
      issues.push(createIssue(
        'photo-context-conflict',
        `Photo ${highlight.imageNumber} uses superseded highlight wording.`,
        `Photo highlight ${highlight.id}`,
        { matchedText: highlight.sourceText },
      ));
    }
  }

  return issues;
};

const OPEN_HOME_PLACEHOLDER = /\b(?:tbc|tbd|date here|time here|insert date|insert time)\b|\[(?:date|time|url|property listing url)\]|\{\{?(?:date|time|url)\}?\}/i;
const UNAPPROVED_OPEN_HOME_DATE = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\b(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/(?:\d{2}|\d{4}))\b|\b(?:\d{1,2}\s+(?:january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+\d{4})?|(?:january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:,?\s+\d{4})?)\b/i;
const UNAPPROVED_OPEN_HOME_TIME = /\b(?:[01]?\d|2[0-3])[:.][0-5]\d\s*(?:am|pm)?\b|\b(?:1[0-2]|0?[1-9])\s*(?:am|pm)\b/i;
const UNAPPROVED_OPEN_HOME_URL = /\b(?:https?:\/\/|www\.)\S+/i;

const findOpenHouseIssues = (
  outputId: PreviewTab,
  content: string,
  snapshot: ApprovedBriefSnapshot,
): OutputIntegrityIssue[] => {
  if (outputId !== 'Open House') return [];
  const { included, date, time } = snapshot.openHomeContext;
  const approvedDate = included ? date.trim() : '';
  const approvedTime = included ? time.trim() : '';
  const approvedUrl = included ? snapshot.openHomeContext.url.trim() : '';
  const dateAlternatives = [approvedDate];
  const isoDateMatch = approvedDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoDateMatch) {
    const [, year, month, day] = isoDateMatch;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (!Number.isNaN(parsedDate.valueOf())) {
      const monthName = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC' }).format(parsedDate);
      dateAlternatives.push(
        `${Number(day)} ${monthName} ${year}`,
        `${monthName} ${Number(day)} ${year}`,
        `${day}/${month}/${year}`,
        `${Number(day)}/${Number(month)}/${year}`,
      );
    }
  }
  const timeAlternatives = [approvedTime];
  const isoTimeMatch = approvedTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (isoTimeMatch) {
    const [, hoursText, minutes] = isoTimeMatch;
    const hours = Number(hoursText);
    const twelveHour = hours % 12 || 12;
    const period = hours < 12 ? 'am' : 'pm';
    timeAlternatives.push(
      `${twelveHour}:${minutes} ${period}`,
      `${twelveHour}.${minutes} ${period}`,
      ...(minutes === '00' ? [`${twelveHour} ${period}`, `${twelveHour}${period}`] : []),
    );
  }
  const conflicts: string[] = [];
  if (approvedDate) {
    if (!dateAlternatives.some(candidate => includesGovernedText(content, candidate))) conflicts.push('approved date');
  } else if (UNAPPROVED_OPEN_HOME_DATE.test(content)) {
    conflicts.push('unapproved date');
  }
  if (approvedTime) {
    if (!timeAlternatives.some(candidate => includesGovernedText(content, candidate))) conflicts.push('approved time');
  } else if (UNAPPROVED_OPEN_HOME_TIME.test(content)) {
    conflicts.push('unapproved time');
  }
  if (approvedUrl) {
    if (!content.includes(approvedUrl)) conflicts.push('approved URL');
  } else if (UNAPPROVED_OPEN_HOME_URL.test(content)) {
    conflicts.push('unapproved URL');
  }
  if (OPEN_HOME_PLACEHOLDER.test(content)) conflicts.push('unresolved placeholder');
  if (conflicts.length === 0) return [];
  return [createIssue(
    'missing-required-context',
    `Open House copy conflicts with approved optional context: ${conflicts.join(', ')}.`,
    'Open home context',
  )];
};

export const validateReturnedOutput = ({
  id,
  content,
  snapshot,
  boundSnapshotId,
  usedPhotoContext,
  knownPhotoHighlights = [],
  generatedAt = snapshot.approvedAt,
}: ValidateReturnedOutputInput): CampaignOutputDocument => {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    return {
      id,
      content: '',
      state: 'failed',
      boundSnapshotId,
      generatedAt,
      integrityIssues: [],
      usedPhotoContext,
      error: 'Generation returned an empty output.',
    };
  }

  const issues: OutputIntegrityIssue[] = [];
  if (boundSnapshotId !== snapshot.snapshotId) {
    issues.push(createIssue(
      'snapshot-mismatch',
      'The output is not bound to the active Approved Brief Snapshot.',
      snapshot.snapshotId,
      { matchedText: boundSnapshotId ?? 'unbound' },
    ));
  }
  const excludedClaimConflict = findExcludedClaimConflict(trimmedContent, snapshot.hardExclusions);
  if (excludedClaimConflict) {
    issues.push(createIssue(
      'excluded-claim',
      `The output contains excluded claim “${excludedClaimConflict.matchedText}”.`,
      excludedClaimConflict.governingBriefItem,
      {
        claimId: excludedClaimConflict.claimId,
        matchedText: excludedClaimConflict.matchedText,
      },
    ));
  }
  for (const conflict of findSupersededFactConflicts(trimmedContent, snapshot.factProvenance)) {
    issues.push(createIssue(
      'superseded-fact',
      `The output contains superseded ${conflict.governingBriefItem} context.`,
      conflict.governingBriefItem,
      { matchedText: conflict.matchedText },
    ));
  }
  for (const conflict of findSupersededClaimConflicts(trimmedContent, snapshot.claims.corrected)) {
    issues.push(createIssue(
      'superseded-fact',
      `The output contains superseded wording for corrected claim “${conflict.governingBriefItem}”.`,
      conflict.governingBriefItem,
      { claimId: conflict.claimId, matchedText: conflict.matchedText },
    ));
  }
  issues.push(...findPhotoContextIssues(
    trimmedContent,
    snapshot,
    usedPhotoContext,
    knownPhotoHighlights,
  ));
  issues.push(...findOpenHouseIssues(id, trimmedContent, snapshot));

  return {
    id,
    content: trimmedContent,
    state: issues.length === 0 ? 'ready' : 'needs-review',
    boundSnapshotId,
    generatedAt,
    integrityIssues: issues,
    usedPhotoContext,
  };
};

export const markOutputsNeedsRegeneration = (
  outputs: Readonly<Record<PreviewTab, CampaignOutputDocument>>,
  activeSnapshotId: string,
): Record<PreviewTab, CampaignOutputDocument> => Object.fromEntries(
  CANONICAL_OUTPUT_ORDER.map(outputId => {
    const output = outputs[outputId];
    const hasPriorResult = Boolean(output.content.trim() || output.generatedAt);
    if (!hasPriorResult || output.boundSnapshotId === activeSnapshotId) {
      return [outputId, {
        ...output,
        integrityIssues: output.integrityIssues.map(issue => ({ ...issue })),
      }];
    }
    const mismatchIssue = createIssue(
      'snapshot-mismatch',
      'The Approved Brief changed after this draft was generated.',
      activeSnapshotId,
      { matchedText: output.boundSnapshotId ?? 'unbound' },
    );
    return [outputId, {
      ...output,
      state: 'needs-regeneration',
      integrityIssues: [
        ...output.integrityIssues.filter(issue => issue.code !== 'snapshot-mismatch').map(issue => ({ ...issue })),
        mismatchIssue,
      ],
    } satisfies CampaignOutputDocument];
  }),
) as Record<PreviewTab, CampaignOutputDocument>;

export const markPackChildrenNeedsRegenerationForFoundation = (
  outputs: Readonly<Record<PreviewTab, CampaignOutputDocument>>,
): Record<PreviewTab, CampaignOutputDocument> => Object.fromEntries(
  CANONICAL_OUTPUT_ORDER.map(outputId => {
    const output = outputs[outputId];
    if (outputId === 'Full Copy' || (!output.content.trim() && !output.generatedAt)) {
      return [outputId, {
        ...output,
        integrityIssues: output.integrityIssues.map(issue => ({ ...issue })),
      }];
    }
    return [outputId, {
      ...output,
      state: 'needs-regeneration' as const,
      integrityIssues: [
        ...output.integrityIssues
          .filter(issue => issue.code !== 'foundation-mismatch')
          .map(issue => ({ ...issue })),
        createIssue(
          'foundation-mismatch',
          'The Listing Copy foundation changed after this campaign output was generated.',
          'Listing Copy foundation',
        ),
      ],
    }];
  }),
) as Record<PreviewTab, CampaignOutputDocument>;

export const getOutputEligibility = (
  output: CampaignOutputDocument,
  activeSnapshotId: string,
): OutputEligibility => {
  const reasons: string[] = [];
  if (!output.content.trim()) reasons.push('Output has not been generated.');
  if (output.state !== 'ready') reasons.push(`Output state is ${output.state}.`);
  if (output.boundSnapshotId !== activeSnapshotId) reasons.push('Output is bound to an earlier Approved Brief Snapshot.');
  if (output.integrityIssues.length > 0) reasons.push('Output has unresolved integrity issues.');
  return {
    canCopy: reasons.length === 0,
    canExport: reasons.length === 0,
    reasons,
  };
};

export const buildExportEligibilityInput = (
  outputs: Readonly<Record<PreviewTab, CampaignOutputDocument>>,
  activeSnapshotId: string,
): ExportEligibilityInput => {
  const sections: Partial<Record<PreviewTab, string>> = {};
  const eligibleOutputIds: PreviewTab[] = [];
  const omitted: ExportEligibilityOmission[] = [];
  let missing = 0;
  let stale = 0;
  let blocked = 0;
  let failed = 0;

  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    const output = outputs[outputId];
    const eligibility = getOutputEligibility(output, activeSnapshotId);
    if (eligibility.canExport) {
      sections[outputId] = output.content;
      eligibleOutputIds.push(outputId);
      continue;
    }
    if (output.state === 'failed') {
      failed += 1;
    } else if (
      output.state === 'needs-regeneration' ||
      (Boolean(output.content.trim()) && output.boundSnapshotId !== activeSnapshotId)
    ) {
      stale += 1;
    } else if (output.state === 'needs-review' || output.integrityIssues.length > 0) {
      blocked += 1;
    } else {
      missing += 1;
    }
    omitted.push({
      outputId,
      state: output.state,
      reasons: eligibility.reasons,
    });
  }

  return {
    sections,
    eligibleOutputIds,
    omitted,
    counts: {
      included: eligibleOutputIds.length,
      missing,
      stale,
      blocked,
      failed,
    },
  };
};

export const deriveCampaignPackState = (
  outputs: Readonly<Record<PreviewTab, CampaignOutputDocument>>,
): DerivedCampaignPackState => {
  const readyOutputIds: PreviewTab[] = [];
  const failedOutputIds: PreviewTab[] = [];
  const staleOutputIds: PreviewTab[] = [];
  const blockedOutputIds: PreviewTab[] = [];
  const missingOutputIds: PreviewTab[] = [];
  const inProgressOutputIds: PreviewTab[] = [];

  for (const outputId of CAMPAIGN_PACK_OUTPUT_ORDER) {
    const output = outputs[outputId];
    switch (output.state) {
      case 'ready': readyOutputIds.push(outputId); break;
      case 'failed': failedOutputIds.push(outputId); break;
      case 'needs-regeneration': staleOutputIds.push(outputId); break;
      case 'needs-review': blockedOutputIds.push(outputId); break;
      case 'queued':
      case 'generating': inProgressOutputIds.push(outputId); break;
      case 'not-generated': missingOutputIds.push(outputId); break;
    }
  }
  const remainingOutputIds = CAMPAIGN_PACK_OUTPUT_ORDER.filter(outputId => !readyOutputIds.includes(outputId));
  const retryOutputIds = remainingOutputIds.filter(outputId => !inProgressOutputIds.includes(outputId));
  const state = readyOutputIds.length === CAMPAIGN_PACK_OUTPUT_ORDER.length
    ? 'ready'
    : inProgressOutputIds.length > 0
      ? 'generating'
      : readyOutputIds.length > 0 || failedOutputIds.length > 0 || staleOutputIds.length > 0 || blockedOutputIds.length > 0
        ? 'partial'
        : 'idle';

  return {
    state,
    readyOutputIds,
    failedOutputIds,
    staleOutputIds,
    blockedOutputIds,
    missingOutputIds,
    inProgressOutputIds,
    remainingOutputIds,
    retryOutputIds,
  };
};

/**
 * Commits validated retry results only for the declared retry scope. Ready
 * siblings are cloned unchanged and can never be overwritten accidentally.
 */
export const mergeScopedRetryOutputs = (
  outputs: Readonly<Record<PreviewTab, CampaignOutputDocument>>,
  retryOutputIds: readonly PreviewTab[],
  replacements: Partial<Record<PreviewTab, CampaignOutputDocument>>,
): Record<PreviewTab, CampaignOutputDocument> => {
  const retrySet = new Set(retryOutputIds);
  for (const outputId of Object.keys(replacements) as PreviewTab[]) {
    if (!retrySet.has(outputId)) {
      throw new Error(`Retry replacement for ${outputId} is outside the declared retry scope.`);
    }
    if (replacements[outputId]?.id !== outputId) {
      throw new Error(`Retry replacement identifier does not match ${outputId}.`);
    }
  }
  return Object.fromEntries(CANONICAL_OUTPUT_ORDER.map(outputId => {
    const replacement = replacements[outputId];
    const source = replacement ?? outputs[outputId];
    return [outputId, {
      ...source,
      integrityIssues: source.integrityIssues.map(issue => ({ ...issue })),
    } satisfies CampaignOutputDocument];
  })) as Record<PreviewTab, CampaignOutputDocument>;
};
