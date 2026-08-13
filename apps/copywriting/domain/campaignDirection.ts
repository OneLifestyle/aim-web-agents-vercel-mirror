import type { CampaignSuggestion, ReviewedFact } from '../types';
import { propertyClaimTargetId, propertyFactTargetId } from './propertyReview.js';
import type { CampaignSessionState } from './sessionState';

export const CAMPAIGN_TONE_OPTIONS = [
  'Warm, assured and specific',
  'Clear, measured and factual',
  'Confident, polished and restrained',
  'Friendly, conversational and grounded',
  'Aspirational, refined and credible',
] as const;

export type CampaignToneOption = typeof CAMPAIGN_TONE_OPTIONS[number];

export const isCampaignToneOption = (value: string): value is CampaignToneOption => (
  CAMPAIGN_TONE_OPTIONS.includes(value as CampaignToneOption)
);

const TONE_BY_WRITING_STYLE: Readonly<Record<string, CampaignToneOption>> = {
  'Inventory / Fact-Based': 'Clear, measured and factual',
  Luxury: 'Confident, polished and restrained',
  Casual: 'Friendly, conversational and grounded',
  Friendly: 'Friendly, conversational and grounded',
  Aspirational: 'Aspirational, refined and credible',
  Urgent: 'Confident, polished and restrained',
};

/** Keeps Tone deterministic without expanding the provider response contract. */
export const recommendCampaignTone = (writingStyles: readonly string[]): CampaignToneOption => {
  for (const writingStyle of writingStyles) {
    const tone = TONE_BY_WRITING_STYLE[writingStyle.trim()];
    if (tone) return tone;
  }
  return 'Warm, assured and specific';
};

export const getCampaignSuggestionPropertyTargetId = (
  suggestion: Pick<CampaignSuggestion, 'conflictClaimId'>,
): string => {
  const conflictId = suggestion.conflictClaimId;
  if (!conflictId) return 'property-claims-title';
  if (conflictId.startsWith('claim.')) return propertyClaimTargetId(conflictId);
  if (conflictId.startsWith('fact.')) {
    const key = conflictId.slice('fact.'.length) as ReviewedFact['key'];
    return propertyFactTargetId(key);
  }
  return 'property-claims-title';
};

type CampaignDirection = CampaignSessionState['campaign'];
type RecommendationCoverageKey = 'audience' | 'voice' | 'emphasis' | 'boundaries' | 'tone';

export interface CampaignAnalysisApplicationOptions {
  /**
   * Optional controlled-tone override. When omitted for successful Voice
   * analysis, Tone is derived deterministically from the recommended styles.
   */
  recommendedTone?: string | null;
  /**
   * Identifies which analysis sections completed. Completed sections replace
   * their earlier AI-derived values while preserving explicit user values.
   */
  coverage?: Partial<Record<RecommendationCoverageKey, boolean>>;
}

export interface CampaignAnalysisApplication {
  campaign: CampaignDirection;
  appliedSuggestionIds: string[];
  exceptionSuggestions: CampaignSuggestion[];
  governingValuesChanged: boolean;
}

const uniqueStrings = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const rawValue of values) {
    const value = rawValue.trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    unique.push(value);
  }
  return unique;
};

const stringArraysEqual = (left: readonly string[], right: readonly string[]): boolean => (
  left.length === right.length && left.every((value, index) => value === right[index])
);

const governingValuesEqual = (left: CampaignDirection, right: CampaignDirection): boolean => (
  left.primaryAudience === right.primaryAudience
  && left.secondaryAudience === right.secondaryAudience
  && left.tone === right.tone
  && stringArraysEqual(left.writingStyles, right.writingStyles)
  && stringArraysEqual(left.emphasis, right.emphasis)
  && stringArraysEqual(left.styleAvoidances, right.styleAvoidances)
);

const changedAppliedTexts = (
  suggestions: readonly CampaignSuggestion[],
  kind: CampaignSuggestion['kind'],
): Set<string> => new Set(suggestions
  .filter(suggestion => (
    suggestion.state === 'applied'
    && suggestion.kind === kind
    && suggestion.application?.changedGoverningValue !== false
  ))
  .map(suggestion => suggestion.text));

const inferCoverage = (
  recommendations: readonly CampaignSuggestion[],
  options: CampaignAnalysisApplicationOptions,
): Record<RecommendationCoverageKey, boolean> => {
  const voice = options.coverage?.voice ?? recommendations.some(suggestion => suggestion.kind === 'voice');
  return {
    audience: options.coverage?.audience ?? recommendations.some(suggestion => suggestion.kind === 'audience'),
    voice,
    emphasis: options.coverage?.emphasis ?? recommendations.some(suggestion => suggestion.kind === 'selling-point'),
    boundaries: options.coverage?.boundaries ?? recommendations.some(suggestion => suggestion.kind === 'boundary'),
    tone: options.coverage?.tone ?? (options.recommendedTone !== undefined || voice),
  };
};

/**
 * Applies safe, governed analysis recommendations directly to the editable
 * Campaign Direction. Blocked recommendations remain unapplied, while
 * surplus recommendations remain explicit alternatives. Applied suggestions
 * stay in state as hidden provenance so photo-dependent direction can still
 * be invalidated safely later.
 */
export const applyCampaignAnalysisRecommendations = (
  current: CampaignDirection,
  rawRecommendations: readonly CampaignSuggestion[],
  options: CampaignAnalysisApplicationOptions = {},
): CampaignAnalysisApplication => {
  const recommendations = rawRecommendations
    .map(suggestion => ({ ...suggestion, text: suggestion.text.trim() }))
    .filter(suggestion => Boolean(suggestion.text));
  const coverage = inferCoverage(recommendations, options);
  const safeRecommendedWritingStyles = recommendations
    .filter(suggestion => suggestion.kind === 'voice' && suggestion.state !== 'blocked')
    .map(suggestion => suggestion.text);
  const recommendedTone = options.recommendedTone === undefined
    ? recommendCampaignTone(safeRecommendedWritingStyles)
    : options.recommendedTone?.trim();

  if (
    coverage.tone
    && (typeof recommendedTone !== 'string' || !isCampaignToneOption(recommendedTone))
  ) {
    throw new Error('Campaign analysis returned an unsupported controlled tone.');
  }

  const previousApplied = current.suggestions.filter(suggestion => suggestion.state === 'applied');
  const retainedApplied = previousApplied.filter(suggestion => {
    if (suggestion.kind === 'audience') return !coverage.audience;
    if (suggestion.kind === 'voice') return !coverage.voice;
    if (suggestion.kind === 'selling-point') return !coverage.emphasis;
    return !coverage.boundaries;
  });

  const previousVoiceTexts = coverage.voice ? changedAppliedTexts(previousApplied, 'voice') : new Set<string>();
  const previousEmphasisTexts = coverage.emphasis ? changedAppliedTexts(previousApplied, 'selling-point') : new Set<string>();
  const previousBoundaryTexts = coverage.boundaries ? changedAppliedTexts(previousApplied, 'boundary') : new Set<string>();

  let primaryAudience = current.primaryAudience;
  let secondaryAudience = current.secondaryAudience;
  if (coverage.audience) {
    for (const suggestion of previousApplied) {
      if (
        suggestion.kind !== 'audience'
        || suggestion.application?.changedGoverningValue === false
      ) continue;
      const field = suggestion.audienceTarget === 'secondary' ? 'secondary' : 'primary';
      if (field === 'primary' && primaryAudience === suggestion.text) {
        primaryAudience = suggestion.application?.previousValue ?? '';
      }
      if (field === 'secondary' && secondaryAudience === suggestion.text) {
        secondaryAudience = suggestion.application?.previousValue ?? '';
      }
    }
  }

  let writingStyles = coverage.voice
    ? current.writingStyles.filter(style => !previousVoiceTexts.has(style)).slice(0, 2)
    : [...current.writingStyles];
  let emphasis = coverage.emphasis
    ? current.emphasis.filter(text => !previousEmphasisTexts.has(text))
    : [...current.emphasis];
  let styleAvoidances = coverage.boundaries
    ? current.styleAvoidances.filter(text => !previousBoundaryTexts.has(text))
    : [...current.styleAvoidances];
  let tone = current.tone;
  if (coverage.tone) tone = recommendedTone!;

  const usedAudienceTargets = new Set<'primary' | 'secondary'>();
  const appliedSuggestionIds: string[] = [];
  const nextRecommendations: CampaignSuggestion[] = [];

  for (const recommendation of recommendations) {
    if (recommendation.state === 'blocked') {
      nextRecommendations.push({ ...recommendation, state: 'blocked' });
      continue;
    }

    let applied = false;
    let changedGoverningValue = false;
    let previousValue: string | undefined;
    let nextRecommendation = { ...recommendation };

    if (recommendation.kind === 'audience' && coverage.audience) {
      const target = recommendation.audienceTarget === 'secondary' ? 'secondary' : 'primary';
      if (!usedAudienceTargets.has(target)) {
        usedAudienceTargets.add(target);
        if (target === 'secondary') {
          previousValue = secondaryAudience;
          changedGoverningValue = secondaryAudience !== recommendation.text;
          secondaryAudience = recommendation.text;
        } else {
          previousValue = primaryAudience;
          changedGoverningValue = primaryAudience !== recommendation.text;
          primaryAudience = recommendation.text;
        }
        applied = true;
      }
    }

    if (recommendation.kind === 'voice' && coverage.voice) {
      if (writingStyles.includes(recommendation.text)) {
        applied = true;
      } else if (writingStyles.length < 2) {
        writingStyles = [...writingStyles, recommendation.text];
        changedGoverningValue = true;
        applied = true;
      }
    }

    if (recommendation.kind === 'selling-point' && coverage.emphasis) {
      applied = true;
      if (!emphasis.includes(recommendation.text)) {
        emphasis = [...emphasis, recommendation.text];
        changedGoverningValue = true;
      }
      if (!changedGoverningValue && recommendation.dependsOnPhotoContext) {
        nextRecommendation = { ...nextRecommendation, dependsOnPhotoContext: false };
      }
    }

    if (recommendation.kind === 'boundary' && coverage.boundaries) {
      applied = true;
      if (!styleAvoidances.includes(recommendation.text)) {
        styleAvoidances = [...styleAvoidances, recommendation.text];
        changedGoverningValue = true;
      }
    }

    if (!applied) {
      nextRecommendations.push({ ...nextRecommendation, state: 'suggested' });
      continue;
    }

    appliedSuggestionIds.push(recommendation.id);
    nextRecommendations.push({
      ...nextRecommendation,
      state: 'applied',
      application: {
        changedGoverningValue,
        ...(recommendation.kind === 'audience' ? { previousValue } : {}),
      },
    });
  }

  const campaign: CampaignDirection = {
    ...current,
    primaryAudience,
    secondaryAudience,
    writingStyles: uniqueStrings(writingStyles).slice(0, 2),
    tone,
    emphasis: uniqueStrings(emphasis),
    styleAvoidances: uniqueStrings(styleAvoidances),
    suggestions: [...retainedApplied, ...nextRecommendations],
  };
  const exceptionSuggestions = campaign.suggestions.filter(suggestion => suggestion.state !== 'applied');

  return {
    campaign,
    appliedSuggestionIds,
    exceptionSuggestions,
    governingValuesChanged: !governingValuesEqual(current, campaign),
  };
};

const suggestionIsAlreadyRepresented = (
  campaign: CampaignDirection,
  suggestion: CampaignSuggestion,
): boolean => {
  if (suggestion.kind === 'audience') {
    return suggestion.audienceTarget === 'secondary'
      ? campaign.secondaryAudience === suggestion.text
      : campaign.primaryAudience === suggestion.text;
  }
  if (suggestion.kind === 'voice') return campaign.writingStyles.includes(suggestion.text);
  if (suggestion.kind === 'selling-point') return campaign.emphasis.includes(suggestion.text);
  return campaign.styleAvoidances.includes(suggestion.text);
};

export const getCampaignAnalysisExceptions = (
  campaignOrSuggestions: CampaignDirection | readonly CampaignSuggestion[],
): CampaignSuggestion[] => {
  const campaign = Array.isArray(campaignOrSuggestions)
    ? null
    : campaignOrSuggestions as CampaignDirection;
  const suggestions: readonly CampaignSuggestion[] = campaign
    ? campaign.suggestions
    : campaignOrSuggestions as readonly CampaignSuggestion[];
  return suggestions.filter(suggestion => (
    suggestion.state === 'blocked'
    || (
      suggestion.state === 'suggested'
      && (!campaign || !suggestionIsAlreadyRepresented(campaign, suggestion))
    )
  ));
};
