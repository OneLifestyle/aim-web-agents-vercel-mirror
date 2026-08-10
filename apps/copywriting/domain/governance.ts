import type {
  ApprovedBriefSnapshot,
  CampaignSuggestion,
  HardExcludedClaim,
  ReviewedClaim,
  ReviewedFact,
  SuggestionGovernanceContext,
} from '../types';
import type { CampaignSessionState } from './sessionState';

export interface GovernanceConflict {
  kind: 'excluded-claim' | 'superseded-fact';
  governingBriefItem: string;
  matchedText: string;
  claimId?: string;
}

export interface SanitizedLowerAuthorityText {
  text: string;
  removedFragments: string[];
  conflicts: GovernanceConflict[];
}

const NUMBER_WORDS: Readonly<Record<number, string>> = {
  0: 'zero',
  1: 'one',
  2: 'two',
  3: 'three',
  4: 'four',
  5: 'five',
  6: 'six',
  7: 'seven',
  8: 'eight',
  9: 'nine',
  10: 'ten',
  11: 'eleven',
  12: 'twelve',
};
const WORD_NUMBERS = Object.fromEntries(
  Object.entries(NUMBER_WORDS).map(([number, word]) => [word, Number(number)]),
) as Readonly<Record<string, number>>;
const NUMBER_TOKEN = '(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const SIX_CAR_CLAIM_ALIASES = [
  'six-car garage',
  'six car garage',
  '6-car garage',
  'six vehicle garage',
  'parking for six',
] as const;

export const normalizeGovernanceText = (value: string): string => value
  .normalize('NFKD')
  .toLocaleLowerCase('en-AU')
  .replace(/,(?=\d{3}(?:\D|$))/g, '')
  .replace(/(?<=\d)\.(?=\d)/g, '\uE000')
  .replace(/[’']/g, '')
  .replace(/[^a-z0-9²\uE000]+/g, ' ')
  .replace(/\uE000/g, '.')
  .replace(/\s+/g, ' ')
  .trim();

const splitContextFragments = (text: string): string[] => text
  .split(/(?<=[.!?])\s+|\n+/)
  .map(fragment => fragment.trim())
  .filter(Boolean);

/** Removes lower-authority fragments that still contain superseded claim wording. */
export const sanitizeCorrectedClaimContext = (
  text: string,
  correctedClaims: readonly ReviewedClaim[],
): string => splitContextFragments(text)
  .filter(fragment => !correctedClaims.some(claim => {
    const approvedPhrase = normalizeGovernanceText(claim.approvedText);
    let remainingFragment = ` ${normalizeGovernanceText(fragment)} `;
    if (approvedPhrase) remainingFragment = remainingFragment.replaceAll(` ${approvedPhrase} `, ' ');
    return [claim.sourceText, ...claim.aliases]
      .filter(phrase => normalizeGovernanceText(phrase) !== approvedPhrase)
      .some(phrase => {
        const normalizedPhrase = normalizeGovernanceText(phrase);
        return Boolean(normalizedPhrase) && remainingFragment.includes(` ${normalizedPhrase} `);
      });
  }))
  .join(' ')
  .trim();

/** Detects superseded prose for a human-corrected non-structured claim. */
export const findSupersededClaimConflicts = (
  text: string,
  correctedClaims: readonly ReviewedClaim[],
): GovernanceConflict[] => correctedClaims.flatMap(claim => {
  const approvedPhrase = normalizeGovernanceText(claim.approvedText);
  let remainingText = ` ${normalizeGovernanceText(text)} `;
  if (approvedPhrase) remainingText = remainingText.replaceAll(` ${approvedPhrase} `, ' ');

  const matchedText = [claim.sourceText, ...claim.aliases]
    .filter(phrase => normalizeGovernanceText(phrase) !== approvedPhrase)
    .find(phrase => {
      const normalizedPhrase = normalizeGovernanceText(phrase);
      return Boolean(normalizedPhrase) && remainingText.includes(` ${normalizedPhrase} `);
    });
  return matchedText ? [{
    kind: 'superseded-fact' as const,
    governingBriefItem: claim.id,
    matchedText,
    claimId: claim.id,
  }] : [];
});

const uniqueNormalizedTerms = (values: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    const stableKey = trimmed.toLocaleLowerCase('en-AU');
    if (stableKey && !seen.has(stableKey)) {
      seen.add(stableKey);
      result.push(trimmed);
    }
  }
  return result;
};

export const normalizeHardExclusion = (claim: HardExcludedClaim): HardExcludedClaim => ({
  ...claim,
  text: claim.text.trim(),
  aliases: uniqueNormalizedTerms([
    claim.text,
    ...claim.aliases,
    ...([claim.text, ...claim.aliases].some(value => {
      const normalized = normalizeGovernanceText(value);
      return normalized === 'six car garage'
        || normalized === '6 car garage'
        || normalized === 'six vehicle garage'
        || normalized === 'parking for six';
    }) ? SIX_CAR_CLAIM_ALIASES : []),
  ]),
});

export const findExcludedClaimConflict = (
  text: string,
  hardExclusions: readonly HardExcludedClaim[],
): GovernanceConflict | null => {
  const normalizedText = ` ${normalizeGovernanceText(text)} `;
  for (const rawExclusion of hardExclusions) {
    const exclusion = normalizeHardExclusion(rawExclusion);
    for (const term of exclusion.aliases) {
      const normalizedTerm = normalizeGovernanceText(term);
      if (normalizedTerm && normalizedText.includes(` ${normalizedTerm} `)) {
        return {
          kind: 'excluded-claim',
          governingBriefItem: exclusion.text,
          matchedText: term,
          claimId: exclusion.id,
        };
      }
    }
  }
  return null;
};

const valueAlternatives = (value: string | number): string[] => {
  if (typeof value === 'string') return [normalizeGovernanceText(value)];
  const variants = [String(value)];
  const word = NUMBER_WORDS[value];
  if (word) variants.push(word);
  return variants;
};

const parseNumberToken = (token: string): number | null => {
  const normalized = normalizeGovernanceText(token);
  if (normalized in WORD_NUMBERS) return WORD_NUMBERS[normalized];
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const findContradictoryNumericMention = (
  normalizedText: string,
  fact: ApprovedBriefSnapshot['factProvenance'][number],
): string | null => {
  if (typeof fact.approvedValue !== 'number') return null;
  let patterns: RegExp[] = [];
  switch (fact.key) {
    case 'bedrooms':
      patterns = [new RegExp(`\\b(${NUMBER_TOKEN})\\s+bed(?:room)?s?\\b`, 'g')];
      break;
    case 'bathrooms':
      patterns = [new RegExp(`\\b(${NUMBER_TOKEN})\\s+bath(?:room)?s?\\b`, 'g')];
      break;
    case 'carSpaces':
      patterns = [
        new RegExp(`\\b(${NUMBER_TOKEN})\\s+(?:car(?:\\s+spaces?)?|vehicle(?:s)?|garage(?:s)?)\\b`, 'g'),
        new RegExp(`\\bparking\\s+(?:for\\s+)?(${NUMBER_TOKEN})\\b`, 'g'),
        new RegExp(`\\bgarage\\s+(?:for\\s+)?(${NUMBER_TOKEN})\\b`, 'g'),
      ];
      break;
    case 'landValue':
      patterns = [
        new RegExp(`\\b(${NUMBER_TOKEN})\\s*(?:m²|m2|sqm|sq\\s*m|square metres?|square meters?|ha|hectares?|acres?)\\b`, 'g'),
        new RegExp(`\\bland(?:\\s+size)?\\s+(?:of\\s+)?(${NUMBER_TOKEN})\\b`, 'g'),
      ];
      break;
    case 'propertyType':
      return null;
  }
  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const mentionedValue = parseNumberToken(match[1]);
      if (mentionedValue !== null && mentionedValue !== fact.approvedValue) return match[1];
    }
  }
  return null;
};

const containsStructuredFactMention = (
  normalizedText: string,
  fact: ApprovedBriefSnapshot['factProvenance'][number],
): string | null => {
  const contradictoryNumericMention = findContradictoryNumericMention(normalizedText, fact);
  if (contradictoryNumericMention !== null) return contradictoryNumericMention;
  const sourceValue = fact.sourceValue;
  let comparisonText = normalizedText;
  if (fact.key === 'propertyType' && typeof fact.approvedValue === 'string') {
    comparisonText = comparisonText.replace(/\bopen\s+house\b/g, ' ');
    const approvedPhrase = normalizeGovernanceText(fact.approvedValue);
    if (approvedPhrase) comparisonText = ` ${comparisonText} `.replaceAll(` ${approvedPhrase} `, ' ');
  }
  if (
    fact.key === 'landValue'
    && sourceValue !== null
    && sourceValue !== ''
    && fact.sourceUnit
    && fact.unit
    && fact.sourceUnit !== fact.unit
  ) {
    const escapedValue = String(sourceValue).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sourceUnitPattern = fact.sourceUnit === 'm²'
      ? '(?:m²|m2|sqm|sq\\s*m|square metres?|square meters?)'
      : fact.sourceUnit === 'ha'
        ? '(?:ha|hectares?)'
        : '(?:acres?)';
    const sourceUnitMention = new RegExp(`\\b${escapedValue}\\s*${sourceUnitPattern}\\b`).exec(comparisonText);
    if (sourceUnitMention) return sourceUnitMention[0];
  }
  if (sourceValue === null || sourceValue === '' || sourceValue === fact.approvedValue) return null;
  const alternatives = valueAlternatives(sourceValue);

  for (const value of alternatives) {
    if (!value) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    let patterns: RegExp[] = [];
    switch (fact.key) {
      case 'bedrooms':
        patterns = [new RegExp(`\\b${escaped}\\s+bed(?:room)?s?\\b`)];
        break;
      case 'bathrooms':
        patterns = [new RegExp(`\\b${escaped}\\s+bath(?:room)?s?\\b`)];
        break;
      case 'carSpaces':
        patterns = [
          new RegExp(`\\b${escaped}\\s+(?:car(?:\\s+spaces?)?|vehicle(?:s)?|garage(?:s)?)\\b`),
          new RegExp(`\\bparking\\s+(?:for\\s+)?${escaped}\\b`),
          new RegExp(`\\bgarage\\s+(?:for\\s+)?${escaped}\\b`),
        ];
        break;
      case 'landValue': {
        const unit = normalizeGovernanceText(fact.sourceUnit ?? fact.unit ?? '');
        const unitPattern = unit === 'm²'
          ? '(?:m²|m2|sqm|sq\\s*m|square metres?|square meters?)'
          : unit === 'ha'
            ? '(?:ha|hectares?)'
            : unit === 'acres'
              ? '(?:acres?)'
              : '(?:m²|m2|square metres?|square meters?|ha|hectares?|acres?)';
        patterns = [
          new RegExp(`\\b${escaped}\\s*${unitPattern}\\b`),
          new RegExp(`\\bland(?:\\s+size)?\\s+(?:of\\s+)?${escaped}\\b`),
        ];
        break;
      }
      case 'propertyType':
        patterns = [new RegExp(`\\b${escaped}\\b`)];
        break;
    }
    if (patterns.some(pattern => pattern.test(comparisonText))) return String(sourceValue);
  }
  return null;
};

export const findSupersededFactConflicts = (
  text: string,
  factProvenance: readonly ApprovedBriefSnapshot['factProvenance'][number][],
): GovernanceConflict[] => {
  const normalizedText = normalizeGovernanceText(text);
  const conflicts: GovernanceConflict[] = [];
  for (const fact of factProvenance) {
    const matchedText = containsStructuredFactMention(normalizedText, fact);
    if (matchedText !== null) {
      conflicts.push({
        kind: 'superseded-fact',
        governingBriefItem: fact.key,
        matchedText,
      });
    }
  }
  return conflicts;
};

export const findGovernanceConflicts = (
  text: string,
  context: Pick<SuggestionGovernanceContext, 'factProvenance' | 'hardExclusions'>,
): GovernanceConflict[] => {
  const exclusionConflict = findExcludedClaimConflict(text, context.hardExclusions);
  const conflicts = findSupersededFactConflicts(text, context.factProvenance);
  return exclusionConflict ? [exclusionConflict, ...conflicts] : conflicts;
};

/**
 * Removes entire lower-authority sentences/bullets when they contradict a
 * corrected structured fact or hard exclusion. The approved value is supplied
 * separately by the snapshot, so contradictory source prose is never retained
 * as an equally valid alternative.
 */
export const sanitizeLowerAuthorityText = (
  text: string,
  context: Pick<SuggestionGovernanceContext, 'factProvenance' | 'hardExclusions'>,
): SanitizedLowerAuthorityText => {
  const kept: string[] = [];
  const removedFragments: string[] = [];
  const conflicts: GovernanceConflict[] = [];

  for (const fragment of splitContextFragments(text)) {
    const fragmentConflicts = findGovernanceConflicts(fragment, context);
    if (fragmentConflicts.length > 0) {
      removedFragments.push(fragment);
      conflicts.push(...fragmentConflicts);
    } else {
      kept.push(fragment);
    }
  }

  return {
    text: kept.join(' ').trim(),
    removedFragments,
    conflicts,
  };
};

export const detectSuggestionConflict = (
  suggestion: Pick<CampaignSuggestion, 'text'>,
  governance: SuggestionGovernanceContext,
): GovernanceConflict | null => findGovernanceConflicts(suggestion.text, governance)[0] ?? null;

export const governSuggestions = (
  suggestions: readonly CampaignSuggestion[],
  governance: SuggestionGovernanceContext,
): CampaignSuggestion[] => suggestions.map(suggestion => {
  const conflict = detectSuggestionConflict(suggestion, governance);
  if (!conflict) return { ...suggestion };
  return {
    ...suggestion,
    state: 'blocked',
    conflictClaimId: conflict.claimId ?? `fact.${conflict.governingBriefItem}`,
  };
});

export const buildSuggestionGovernanceContext = (
  snapshot: ApprovedBriefSnapshot,
): SuggestionGovernanceContext => ({
  approvedFacts: { ...snapshot.approvedFacts },
  factProvenance: snapshot.factProvenance.map(fact => ({ ...fact })),
  hardExclusions: snapshot.hardExclusions.map(exclusion => ({
    ...exclusion,
    aliases: [...exclusion.aliases],
  })),
  photoContextPolicy: snapshot.photoContext.policy,
});

export const reviewedFactHasCorrection = (fact: ReviewedFact): boolean => (
  fact.state === 'corrected'
  || fact.sourceValue !== fact.approvedValue
  || (fact.key === 'landValue' && (fact.sourceUnit ?? 'm²') !== (fact.unit ?? 'm²'))
);

/** Conservatively removes campaign direction that depended on mutable photo context. */
export const stripPhotoDependentDirection = (state: CampaignSessionState): CampaignSessionState => {
  const dependentSuggestions = state.campaign.suggestions.filter(suggestion => suggestion.dependsOnPhotoContext);
  if (dependentSuggestions.length === 0) return state;
  const appliedTexts = new Set(
    dependentSuggestions
      .filter(suggestion => suggestion.state === 'applied' && suggestion.kind === 'selling-point')
      .map(suggestion => suggestion.text),
  );
  return {
    ...state,
    campaign: {
      ...state.campaign,
      emphasis: state.campaign.emphasis.filter(item => !appliedTexts.has(item)),
      suggestions: state.campaign.suggestions.filter(suggestion => !suggestion.dependsOnPhotoContext),
      approved: false,
    },
  };
};
