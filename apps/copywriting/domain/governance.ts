import type {
  ApprovedBriefSnapshot,
  CampaignSuggestion,
  HardExcludedClaim,
  ReviewedClaim,
  ReviewedFact,
  SuggestionGovernanceContext,
} from '../types';
import type { CampaignSessionState } from './sessionState';
import {
  findContradictoryLandMeasurementMention,
} from './structuredFacts.js';

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
const NUMBER_TOKEN = '(?:\\d+(?:\\.\\d+)?(?![\\d.])|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)';
const SIGNED_NUMBER_TOKEN = `(?:(?:minus|plus)\\s+)?${NUMBER_TOKEN}`;
const NON_CAPACITY_CONTINUATION_PATTERN = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|a\\s*m|p\\s*m|am|pm|hours?|hrs?|minutes?|mins?|dollars?|per\\s+(?:hours?|days?|weeks?|months?|years?|entry|visit|stay)|\\d{1,2}(?:\\s+\\d{2,4})?|guests?|people|residents?|visitors?|buyers?|inspections?)';
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
  .replace(/\bapprox\.(?=\s)/gi, match => `${match.slice(0, -1)}\uE002`)
  .replace(/\bsq\.\s*m\.(?=\s)/gi, match => match.replaceAll('.', '\uE002'))
  .replace(/\bsq\.(?=\s*m\b)/gi, match => `${match.slice(0, -1)}\uE002`)
  .split(/(?<=[.!?])\s+|\n+/)
  .map(fragment => fragment.replace(/\uE002/g, '.').trim())
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
  if (normalized.startsWith('minus ')) {
    const magnitude = parseNumberToken(normalized.slice('minus '.length));
    return magnitude === null ? null : -magnitude;
  }
  if (normalized.startsWith('plus ')) return parseNumberToken(normalized.slice('plus '.length));
  if (normalized in WORD_NUMBERS) return WORD_NUMBERS[normalized];
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const propertyTypeAliases = (sourceValue: string): string[] => {
  const normalizedSource = normalizeGovernanceText(sourceValue);
  return normalizedSource === 'apartment unit'
    ? ['apartment', 'unit']
    : [normalizedSource];
};

const stripNonPrimaryPropertyTypeRoles = (text: string, sourceAlias: string): string => {
  switch (sourceAlias) {
    case 'house':
      return text
        .replace(/\b(?:open|guest|pool|cubby|club|neighbouring|neighboring)\s+house\b/g, ' ')
        .replace(/\b(?:historic|heritage|landmark)\s+\w+\s+house\b/g, ' ')
        .replace(/\b(?:near|beside|opposite|close\s+to|moments?\s+from|steps?\s+from|minutes?\s+from|(?:a\s+)?short\s+walk\s+(?:from|to))\s+(?:[a-z0-9]+\s+){0,3}house\b/g, ' ')
        .replace(/\b(?:[a-z]+\s+){0,3}opera\s+house\b|\bauction\s+house\b/g, ' ')
        .replace(/\b(?:to|will|can|could|may|designed\s+to)\s+house\b/g, ' ')
        .replace(/\bhouse\s+(?:proud|prices?|market|number)\b/g, ' ');
    case 'unit':
      return text
        .replace(/\b(?:storage|solar|heating|cooling|hot\s+water|air\s+conditioning|split\s+system|reverse\s+cycle|self\s+contained|separate|secondary|guest|ancillary|apartment)\s+unit\b/g, ' ')
        .replace(/\bunit\s+(?:number|of\s+measure|title|renovation|[a-z]*\d+[a-z]*)\b/g, ' ');
    case 'apartment':
      return text.replace(/\b(?:self\s+contained|separate|secondary|guest|ancillary|studio)\s+apartment\b/g, ' ');
    case 'studio':
      return text
        .replace(/\b(?:separate|detached|backyard|garden|music|art|artists?|photography|recording|home\s+office|flexible)\s+studio\b/g, ' ')
        .replace(/\bstudio\s+(?:space|room)\b/g, ' ');
    default:
      return text;
  }
};

const primarySaleCompoundForAlias = (sourceAlias: string): string | null => {
  switch (sourceAlias) {
    case 'house': return 'guest\\s+house';
    case 'unit': return '(?:self\\s+contained|separate|ancillary)\\s+unit';
    case 'studio': return '(?:separate|detached)\\s+studio';
    case 'apartment': return 'studio\\s+apartment';
    default: return null;
  }
};

const PRIMARY_SALE_MODIFIER_STOP_PATTERN = '(?:a|an|the|our|this|with|includes?|including|contains?|containing|has|having|features?|featuring|offers?|offering|provides?|providing|comprises?|comprising|incorporates?|incorporating|boasts?|boasting|plus|and|complements?|supports?|alongside|near|nearby|beside|opposite|adjacent|adjoining|within|inside|on|at|close|moments?|steps?|minutes?|from|to|where|which|that)';
const PRIMARY_SALE_MODIFIER_SEQUENCE = `(?:(?!${PRIMARY_SALE_MODIFIER_STOP_PATTERN}\\b)[a-z]+\\s+){0,3}`;
const APPROVED_PROPERTY_TYPE_BOUNDARY = '\uE004';

/**
 * Property type remains an exact, role-scoped comparison. These patterns do
 * not introduce synonyms: they only distinguish an asserted primary type from
 * address components, features and ordinary descriptive nouns.
 */
const findPrimaryPropertyTypeMention = (text: string, sourceValue: string): string | null => {
  for (const sourceAlias of propertyTypeAliases(sourceValue)) {
    if (!sourceAlias) continue;
    const escaped = sourceAlias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const roleScopedText = stripNonPrimaryPropertyTypeRoles(text, sourceAlias);
    const primarySaleCompound = primarySaleCompoundForAlias(sourceAlias);
    if (primarySaleCompound) {
      const compoundSalePatterns = [
        new RegExp(
          `^(?:(?:a|an|the|our|this)\\s+)?${PRIMARY_SALE_MODIFIER_SEQUENCE}${primarySaleCompound}\\s+(?:(?:is\\s+)?(?:(?:now|currently)\\s+)?(?:(?:offered|listed|marketed|available|presented)\\s+)?for\\s+sale)\\b`,
        ),
        new RegExp(
          `^(?:(?:a|an|the|our|this)\\s+)?${PRIMARY_SALE_MODIFIER_SEQUENCE}${primarySaleCompound}\\s+is\\s+(?:now\\s+)?(?:the\\s+)?property(?:\\s+(?:offered|listed|marketed)\\s+for\\s+sale)?\\b`,
        ),
        new RegExp(
          `^(?:(?:now|offered|listed|marketed|available|presented)\\s+)?for\\s+sale(?:\\s+is)?\\s+(?:(?:a|an|the|our|this)\\s+)?${PRIMARY_SALE_MODIFIER_SEQUENCE}${primarySaleCompound}\\b`,
        ),
      ];
      if (compoundSalePatterns.some(pattern => pattern.test(text))) return sourceValue;
    }
    const explicitPrimaryPatterns = [
      new RegExp(
        `\\b${escaped}\\s+(?:(?:is\\s+)?(?:(?:now|currently)\\s+)?(?:(?:offered|listed|marketed|available|presented)\\s+)?for\\s+sale)\\b`,
      ),
      new RegExp(
        `\\b${escaped}\\s+is\\s+(?:now\\s+)?(?:the\\s+)?property(?:\\s+(?:offered|listed|marketed)\\s+for\\s+sale)?\\b`,
      ),
      new RegExp(
        `\\b(?:offered|listed|marketed)\\s+for\\s+sale\\s+is\\s+(?:(?:a|an|the|our)\\s+)?(?:[a-z]+\\s+){0,3}${escaped}\\b`,
      ),
      new RegExp(
        `^(?:(?:now|offered|listed|marketed|available|presented)\\s+)?for\\s+sale(?:\\s+is)?\\s+(?:(?:a|an|the|our)\\s+)?(?:(?!(?:with|includes?|features?|featuring|plus|and|complements?|supports?)\\b)[a-z]+\\s+){0,3}${escaped}\\b`,
      ),
    ];
    if (explicitPrimaryPatterns.some(pattern => pattern.test(roleScopedText))) return sourceValue;
    const patterns = sourceAlias === 'land'
      ? [
        /\b(?:vacant|residential|commercial|development|buildable|building)\s+land\b/,
        /\bland\s+(?:property|offering|for\s+sale|only)\b/,
        /\bproperty\s+type\s+(?:is\s+)?land\b/,
      ]
      : sourceAlias === 'rural' || sourceAlias === 'acreage'
        ? [
          new RegExp(`\\b${escaped}\\s+(?:property|holding|acreage|estate|home|for\\s+sale)\\b`),
          new RegExp(`\\bproperty\\s+type\\s+(?:is\\s+)?${escaped}\\b`),
        ]
        : [new RegExp(`\\b${escaped}\\b`)];
    if (patterns.some(pattern => pattern.test(roleScopedText))) return sourceValue;
  }
  return null;
};

const isRenovationYearRole = (
  factKey: ApprovedBriefSnapshot['factProvenance'][number]['key'],
  value: number,
  normalizedText: string,
  matchEnd: number,
): boolean => {
  if (
    factKey !== 'bedrooms'
    && factKey !== 'bathrooms'
  ) return false;
  if (!Number.isInteger(value) || value < 1800 || value > 2100) return false;
  const suffix = normalizedText.slice(matchEnd);
  return (
    /^\s+(?:(?:and\s+)?(?:bedroom|bathroom|kitchen|laundry|ensuite|suite|toilet)\s+)*(?:renovation|remodel|refurbishment|update|upgrade|extension|addition|fit\s*out|works|construction|conversion)\b/.test(suffix)
    || /^\s+(?:was|were)\s+(?:renovated|remodelled|remodeled|refurbished|updated|upgraded|extended|converted)\b/.test(suffix)
    || /^\s+received\s+(?:an?\s+)?(?:renovation|remodel|refurbishment|update|upgrade|extension|addition|fit\s*out|conversion)\b/.test(suffix)
  );
};

const isParkingDecimalDateRole = (matchText: string, token: string): boolean => {
  if (/\b(?:cars?|vehicles?)\b/.test(matchText)) return false;
  const dateMatch = token.match(/^(\d{1,2})\.(\d{2})$/);
  if (!dateMatch) return false;
  const day = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  return day >= 1 && day <= 31 && month >= 1 && month <= 12;
};

const normalizeStructuredCountText = (text: string): string => normalizeGovernanceText(
  text
    .replace(/[$£€]\s*(?=\d)/g, ' currency ')
    .replace(/\u2212/g, '-')
    .replace(/(?<=[A-Za-z0-9])[\u2010\u2011\u2012\u2013\u2014](?=[A-Za-z0-9])/g, '-')
    .replace(/[\u2010\u2011\u2012\u2013\u2014]/g, ' ')
    .replace(/(?<![A-Za-z0-9])-(?=(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)/gi, ' minus ')
    .replace(/(?<![A-Za-z0-9])\+(?=(?:\d+(?:\.\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b)/gi, ' plus '),
);

const findContradictoryNumericMention = (
  text: string,
  fact: ApprovedBriefSnapshot['factProvenance'][number],
): string | null => {
  if (fact.key === 'landValue') {
    const conflict = findContradictoryLandMeasurementMention(
      text,
      typeof fact.approvedValue === 'number'
        ? { value: fact.approvedValue, unit: fact.unit ?? 'm²' }
        : null,
    );
    return conflict?.matchedText ?? null;
  }

  const normalizedText = normalizeStructuredCountText(text);
  let patterns: RegExp[] = [];
  switch (fact.key) {
    case 'bedrooms':
      patterns = [new RegExp(`(?<![a-z0-9])(${SIGNED_NUMBER_TOKEN})\\s+bed(?:room)?s?\\b`, 'g')];
      break;
    case 'bathrooms':
      patterns = [new RegExp(`(?<![a-z0-9])(${SIGNED_NUMBER_TOKEN})\\s+bath(?:room)?s?\\b`, 'g')];
      break;
    case 'carSpaces':
      patterns = [
        new RegExp(`(?<![a-z0-9])(${SIGNED_NUMBER_TOKEN})\\s+(?:(?:car|vehicle|parking)\\s+spaces?|(?:car|vehicle)\\s+garage)\\b`, 'g'),
        new RegExp(`\\b(?:parking|garage)\\s+capacity\\s+(?:of\\s+|for\\s+)?(${SIGNED_NUMBER_TOKEN})(?:\\s+(?:cars?|vehicles?))?\\b`, 'g'),
        new RegExp(`\\b(?:parking|garage)\\s+for\\s+(${SIGNED_NUMBER_TOKEN})(?!\\s+${NON_CAPACITY_CONTINUATION_PATTERN}\\b)(?:\\s+(?:cars?|vehicles?))?\\b`, 'g'),
      ];
      break;
    case 'propertyType':
      return null;
  }
  for (const pattern of patterns) {
    for (const match of normalizedText.matchAll(pattern)) {
      const mentionedValue = parseNumberToken(match[1]);
      if (
        mentionedValue !== null
        && !(fact.key === 'carSpaces' && isParkingDecimalDateRole(match[0], match[1]))
        && !isRenovationYearRole(fact.key, mentionedValue, normalizedText, (match.index ?? 0) + match[0].length)
        && (typeof fact.approvedValue !== 'number' || mentionedValue !== fact.approvedValue)
      ) return match[1];
    }
  }
  return null;
};

const containsStructuredFactMention = (
  text: string,
  fact: ApprovedBriefSnapshot['factProvenance'][number],
): string | null => {
  const contradictoryNumericMention = findContradictoryNumericMention(text, fact);
  if (contradictoryNumericMention !== null) return contradictoryNumericMention;
  if (fact.key === 'landValue') return null;

  const normalizedText = normalizeGovernanceText(text);
  const sourceValue = fact.sourceValue;
  if (sourceValue === null || sourceValue === '' || sourceValue === fact.approvedValue) return null;
  if (fact.key === 'propertyType' && typeof fact.approvedValue === 'string') {
    const approvedPhrase = normalizeGovernanceText(fact.approvedValue);
    const normalizedSource = normalizeGovernanceText(String(sourceValue ?? ''));
    for (const rawFragment of splitContextFragments(text)) {
      for (const rawPropertyClause of rawFragment.split(/\s*;\s*/).filter(Boolean)) {
        let comparisonFragment = normalizeGovernanceText(rawPropertyClause);
        if (
          approvedPhrase.includes('apartment')
          && (normalizedSource === 'unit' || normalizedSource === 'apartment unit')
        ) comparisonFragment = comparisonFragment.replace(/\bapartment\s+unit\b/g, ` ${APPROVED_PROPERTY_TYPE_BOUNDARY} `);
        if (approvedPhrase) {
          comparisonFragment = ` ${comparisonFragment} `
            .replaceAll(` ${approvedPhrase} `, ` ${APPROVED_PROPERTY_TYPE_BOUNDARY} `)
            .trim();
        }
        const matchedPropertyType = findPrimaryPropertyTypeMention(comparisonFragment, String(sourceValue));
        if (matchedPropertyType !== null) return matchedPropertyType;
      }
    }
    return null;
  }
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
          new RegExp(`\\b${escaped}\\s+(?:(?:car|vehicle|parking)\\s+spaces?|(?:car|vehicle)\\s+garage)\\b`),
          new RegExp(`\\b(?:parking|garage)\\s+capacity\\s+(?:of\\s+|for\\s+)?${escaped}(?:\\s+(?:cars?|vehicles?))?\\b`),
          new RegExp(`\\b(?:parking|garage)\\s+for\\s+${escaped}(?!\\s+${NON_CAPACITY_CONTINUATION_PATTERN}\\b)(?:\\s+(?:cars?|vehicles?))?\\b`),
        ];
        break;
    }
    if (patterns.some(pattern => pattern.test(normalizedText))) return String(sourceValue);
  }
  return null;
};

export const findSupersededFactConflicts = (
  text: string,
  factProvenance: readonly ApprovedBriefSnapshot['factProvenance'][number][],
): GovernanceConflict[] => {
  const conflicts: GovernanceConflict[] = [];
  for (const fact of factProvenance) {
    const matchedText = containsStructuredFactMention(text, fact);
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

/** Splits provider suggestion lists without splitting grouped numbers such as 20,200. */
export const splitGovernanceListItems = (value: string): string[] => value
  .replace(/(?<=\d),(?=\d{3}(?:\D|$))/g, '\uE003')
  .split(/\r?\n|\s*[,;]\s*/)
  .map(item => item.replace(/\uE003/g, ',').trim())
  .filter(Boolean);

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
