import React from 'react';
import type { CampaignSuggestion } from '../../types';
import type { CampaignSessionState } from '../../domain/sessionState';
import {
  getCampaignAnalysisExceptions,
  getCampaignSuggestionPropertyTargetId,
} from '../../domain/campaignDirection';
import { TARGET_MARKETS, TONE_OPTIONS, WRITING_STYLES } from '../../constants';
import { StatusRow } from '../StatusRow';

type CampaignStageProps = {
  session: CampaignSessionState;
  headingRef: React.Ref<HTMLHeadingElement>;
  isAnalysing: boolean;
  analysisError: string | null;
  approvalIssues: string[];
  onFieldChange: (field: 'primaryAudience' | 'secondaryAudience' | 'tone', value: string) => void;
  onWritingStyleToggle: (style: string) => void;
  onListChange: (field: 'emphasis' | 'styleAvoidances', value: string) => void;
  onAnalyse: () => void;
  onSuggestionAction: (suggestion: CampaignSuggestion, action: 'apply' | 'dismiss') => void;
  onReviewProperty?: (targetId?: string) => void;
  onPrevious?: () => void;
  onApprove: () => void;
};

const suggestionKindLabel: Record<CampaignSuggestion['kind'], string> = {
  audience: 'Audience proposal',
  voice: 'Voice proposal',
  'selling-point': 'Campaign emphasis proposal',
  boundary: 'Boundary proposal',
};

export const CampaignStage: React.FC<CampaignStageProps> = ({
  session,
  headingRef,
  isAnalysing,
  analysisError,
  approvalIssues,
  onFieldChange,
  onWritingStyleToggle,
  onListChange,
  onAnalyse,
  onSuggestionAction,
  onReviewProperty,
  onPrevious,
  onApprove,
}) => {
  const analysisExceptions = getCampaignAnalysisExceptions(session.campaign);
  const hasControlledTone = TONE_OPTIONS.some(tone => tone === session.campaign.tone);
  const hasDirection = Boolean(
    session.campaign.primaryAudience.trim()
    && session.campaign.writingStyles.length > 0
    && hasControlledTone,
  );
  const hasApprovalIssues = approvalIssues.length > 0;

  return (
    <div>
      <header className="stage-header">
        <div className="stage-header__copy">
          <h1 ref={headingRef} tabIndex={-1}>Campaign</h1>
          <p>AIM prepares the audience, voice, emphasis and style boundaries. Review the final controls and change only what needs attention.</p>
        </div>
        <div className="stage-header__actions">
          {onPrevious ? <button className="button button--quiet" type="button" onClick={onPrevious}>Previous: Property</button> : null}
          <button
            className="button button--secondary"
            type="button"
            onClick={onAnalyse}
            disabled={!session.property.approved || isAnalysing}
            aria-describedby={!session.property.approved ? 'campaign-analysis-reason' : undefined}
          >
            {isAnalysing ? 'Analysing direction and features…' : 'Analyse direction and property features'}
          </button>
        </div>
      </header>

      {!session.property.approved ? (
        <div className="notice" data-tone="review" id="campaign-analysis-reason">
          <div><strong>Property review comes first</strong><p>Approve property facts before requesting or approving campaign direction.</p></div>
        </div>
      ) : null}
      {analysisError ? (
        <div className="notice" data-tone="risk" role="alert">
          <div><strong>Campaign analysis update</strong><p>{analysisError} Your approved manual direction was kept.</p></div>
        </div>
      ) : null}
      {hasApprovalIssues ? (
        <div className="notice" data-tone="risk" role="alert" id="campaign-approval-conflicts">
          <div>
            <strong>Campaign direction conflicts with the reviewed property</strong>
            {approvalIssues.map(issue => <p key={issue}>{issue}</p>)}
          </div>
        </div>
      ) : null}
      {isAnalysing ? (
        <div className="progress-region" role="status" aria-live="polite">
          <div className="progress-region__header"><strong>Campaign direction analysis</strong><span>Preparing editable direction and checking exceptions against reviewed facts</span></div>
          <div className="progress-track"><span style={{ width: '58%' }} /></div>
        </div>
      ) : null}

      <div className="section-stack">
        {analysisExceptions.length > 0 ? (
          <section className="surface" aria-labelledby="campaign-proposals-title">
            <div className="surface__header">
              <div><h2 id="campaign-proposals-title">Exceptions and alternatives</h2><p>Safe recommendations are already reflected in the editable controls below. Review only blocked items or genuine alternatives.</p></div>
            </div>
            <div>
              {analysisExceptions.map(suggestion => (
                <StatusRow
                  key={suggestion.id}
                  id={`campaign-suggestion-${suggestion.id}`}
                  state={suggestion.state === 'blocked' ? 'failed' : 'partial'}
                  stateLabel={suggestion.state === 'blocked' ? 'Blocked' : 'Alternative'}
                  title={suggestion.text}
                  meta={suggestion.state === 'blocked'
                    ? `${suggestionKindLabel[suggestion.kind]} · Conflicts with a reviewed Property fact or hard factual exclusion`
                    : suggestionKindLabel[suggestion.kind]}
                  actions={suggestion.state === 'suggested' ? (
                    <>
                      <button className="row-action" type="button" aria-label={`Apply ${suggestionKindLabel[suggestion.kind]}: ${suggestion.text}`} onClick={() => onSuggestionAction(suggestion, 'apply')}>Apply</button>
                      <button className="row-action" type="button" aria-label={`Dismiss ${suggestionKindLabel[suggestion.kind]}: ${suggestion.text}`} onClick={() => onSuggestionAction(suggestion, 'dismiss')}>Dismiss</button>
                    </>
                  ) : onReviewProperty ? (
                    <button className="row-action" type="button" aria-label={`Review the Property item blocking ${suggestion.text}`} onClick={() => onReviewProperty(getCampaignSuggestionPropertyTargetId(suggestion))}>Review Property</button>
                  ) : undefined}
                />
              ))}
            </div>
          </section>
        ) : null}

        <section className="surface" aria-labelledby="campaign-audience-title">
          <div className="surface__header">
            <div><h2 id="campaign-audience-title">Audience</h2><p>Choose the people this campaign should speak to first and second.</p></div>
          </div>
          <div className="surface__body field-grid">
            <label className="field" htmlFor="campaign-primary-audience">
              <span>Primary audience</span>
              <select id="campaign-primary-audience" className="select-input" value={session.campaign.primaryAudience} onChange={event => onFieldChange('primaryAudience', event.target.value)}>
                <option value="">Select primary audience</option>
                {TARGET_MARKETS.map(market => <option value={market} key={market}>{market}</option>)}
              </select>
            </label>
            <label className="field">
              <span>Secondary audience</span>
              <select className="select-input" value={session.campaign.secondaryAudience} onChange={event => onFieldChange('secondaryAudience', event.target.value)}>
                <option value="">None</option>
                {TARGET_MARKETS.filter(market => market !== session.campaign.primaryAudience).map(market => <option value={market} key={market}>{market}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="surface" aria-labelledby="campaign-voice-title">
          <div className="surface__header">
            <div><h2 id="campaign-voice-title">Voice</h2><p>Select up to two writing styles and a controlled tone. AIM pre-populates both after analysis.</p></div>
          </div>
          <div className="surface__body section-stack">
            <fieldset className="fieldset" id="campaign-writing-styles">
              <legend>Writing style · select up to two</legend>
              <div className="token-list">
                {WRITING_STYLES.map(style => (
                  <button
                    type="button"
                    key={style}
                    aria-pressed={session.campaign.writingStyles.includes(style)}
                    disabled={!session.campaign.writingStyles.includes(style) && session.campaign.writingStyles.length >= 2}
                    onClick={() => onWritingStyleToggle(style)}
                  >
                    {style}
                  </button>
                ))}
              </div>
            </fieldset>
            <label className="field" htmlFor="campaign-tone">
              <span>Tone</span>
              <select id="campaign-tone" className="select-input" value={hasControlledTone ? session.campaign.tone : ''} onChange={event => onFieldChange('tone', event.target.value)}>
                <option value="">Select tone</option>
                {TONE_OPTIONS.map(tone => <option value={tone} key={tone}>{tone}</option>)}
              </select>
            </label>
          </div>
        </section>

        <section className="surface" aria-labelledby="campaign-emphasis-title">
          <div className="surface__header">
            <div><h2 id="campaign-emphasis-title">Campaign emphasis</h2><p>Approved selling points only. Put one item on each line.</p></div>
          </div>
          <div className="surface__body">
            <label className="field">
              <span>Selling points to emphasise</span>
              <textarea rows={5} value={session.campaign.emphasis.join('\n')} onChange={event => onListChange('emphasis', event.target.value)} placeholder="Natural light&#10;Flexible family zones" />
            </label>
          </div>
        </section>

        <section className="surface" aria-labelledby="campaign-boundaries-title">
          <div className="surface__header">
            <div><h2 id="campaign-boundaries-title">Style boundaries</h2><p>Writing guidance controls presentation. It never creates or resolves a factual exclusion.</p></div>
          </div>
          <div className="surface__body section-stack">
            <label className="field">
              <span>Writing style and positioning to avoid</span>
              <textarea rows={4} value={session.campaign.styleAvoidances.join('\n')} onChange={event => onListChange('styleAvoidances', event.target.value)} placeholder="Avoid clichés&#10;Avoid urgency&#10;Avoid overly luxurious language" />
            </label>
            <div className="notice" data-tone={session.property.claims.some(claim => claim.state === 'excluded') ? 'success' : 'review'}>
              <div>
                <strong>Hard factual exclusions</strong>
                <p>{session.property.claims.filter(claim => claim.state === 'excluded').length > 0
                  ? session.property.claims.filter(claim => claim.state === 'excluded').map(claim => claim.approvedText || claim.sourceText).join(' · ')
                  : 'No factual claims are currently excluded. These decisions are made in Property, not in style guidance.'}</p>
              </div>
              {onReviewProperty ? <button className="row-action" type="button" onClick={() => onReviewProperty('property-claims-title')}>Review Property claims</button> : null}
            </div>
          </div>
        </section>

        <div className="action-row">
          <button id="campaign-approval-action" className="button button--secondary" type="button" onClick={onApprove} disabled={!session.property.approved || !hasDirection || hasApprovalIssues} aria-describedby={!hasDirection ? 'campaign-approval-reason' : hasApprovalIssues ? 'campaign-approval-conflicts' : undefined}>
            Approve campaign direction
          </button>
          {!hasDirection ? <span className="disabled-reason" id="campaign-approval-reason">Choose a primary audience, at least one writing style and a listed tone.</span> : null}
        </div>
      </div>
    </div>
  );
};
