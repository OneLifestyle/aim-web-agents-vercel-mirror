import React from 'react';
import type { CampaignSuggestion } from '../../types';
import type { CampaignSessionState } from '../../domain/sessionState';
import { TARGET_MARKETS, WRITING_STYLES } from '../../constants';
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
  onApprove,
}) => {
  const hasDirection = Boolean(
    session.campaign.primaryAudience.trim()
    && session.campaign.writingStyles.length > 0
    && session.campaign.tone.trim(),
  );
  const hasApprovalIssues = approvalIssues.length > 0;

  return (
    <div>
      <header className="stage-header">
        <div className="stage-header__copy">
          <h1 ref={headingRef} tabIndex={-1}>Campaign</h1>
          <p>Set the audience, voice, emphasis and boundaries. AI analysis remains a proposal until you apply it.</p>
        </div>
        <button
          className="button button--secondary"
          type="button"
          onClick={onAnalyse}
          disabled={!session.property.approved || isAnalysing}
          aria-describedby={!session.property.approved ? 'campaign-analysis-reason' : undefined}
        >
          {isAnalysing ? 'Analysing direction and features…' : 'Analyse direction and property features'}
        </button>
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
          <div className="progress-region__header"><strong>Campaign Direction analysis</strong><span>Checking proposals against reviewed facts and exclusions</span></div>
          <div className="progress-track"><span style={{ width: '58%' }} /></div>
        </div>
      ) : null}

      <div className="section-stack">
        {session.campaign.suggestions.length > 0 ? (
          <section className="surface" aria-labelledby="campaign-proposals-title">
            <div className="surface__header">
              <div><h2 id="campaign-proposals-title">Proposals to review</h2><p>Blocked proposals name the governing correction or exclusion and cannot be applied.</p></div>
            </div>
            <div>
              {session.campaign.suggestions.map(suggestion => (
                <StatusRow
                  key={suggestion.id}
                  state={suggestion.state === 'blocked' ? 'failed' : suggestion.state === 'applied' ? 'approved' : 'partial'}
                  stateLabel={suggestion.state === 'blocked' ? 'Blocked' : suggestion.state === 'applied' ? 'Applied' : 'Suggested'}
                  title={suggestion.text}
                  meta={suggestion.state === 'blocked'
                    ? `${suggestionKindLabel[suggestion.kind]} · Conflicts with ${suggestion.conflictClaimId ?? 'the Reviewed Brief'}`
                    : suggestionKindLabel[suggestion.kind]}
                  actions={suggestion.state === 'suggested' ? (
                    <>
                      <button className="row-action" type="button" aria-label={`Apply ${suggestionKindLabel[suggestion.kind]}: ${suggestion.text}`} onClick={() => onSuggestionAction(suggestion, 'apply')}>Apply</button>
                      <button className="row-action" type="button" aria-label={`Dismiss ${suggestionKindLabel[suggestion.kind]}: ${suggestion.text}`} onClick={() => onSuggestionAction(suggestion, 'dismiss')}>Dismiss</button>
                    </>
                  ) : suggestion.state === 'applied' ? (
                    <button className="row-action" type="button" aria-label={`Remove applied ${suggestionKindLabel[suggestion.kind]}: ${suggestion.text}`} onClick={() => onSuggestionAction(suggestion, 'dismiss')}>Remove</button>
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
            <label className="field">
              <span>Primary audience</span>
              <select className="select-input" value={session.campaign.primaryAudience} onChange={event => onFieldChange('primaryAudience', event.target.value)}>
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
            <div><h2 id="campaign-voice-title">Voice</h2><p>Select up to two writing styles and name the intended tone.</p></div>
          </div>
          <div className="surface__body section-stack">
            <fieldset className="fieldset">
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
            <label className="field">
              <span>Tone</span>
              <input value={session.campaign.tone} onChange={event => onFieldChange('tone', event.target.value)} placeholder="e.g. Warm, assured and specific" />
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
            <div><h2 id="campaign-boundaries-title">Boundaries</h2><p>Style preferences are advisory. Excluded or inaccurate claims remain governed in Property.</p></div>
          </div>
          <div className="surface__body section-stack">
            <label className="field">
              <span>Style and positioning to avoid</span>
              <textarea rows={4} value={session.campaign.styleAvoidances.join('\n')} onChange={event => onListChange('styleAvoidances', event.target.value)} placeholder="Avoid generic luxury clichés" />
            </label>
            <div className="notice" data-tone={session.property.claims.some(claim => claim.state === 'excluded') ? 'success' : 'review'}>
              <div>
                <strong>Hard factual exclusions</strong>
                <p>{session.property.claims.filter(claim => claim.state === 'excluded').length > 0
                  ? session.property.claims.filter(claim => claim.state === 'excluded').map(claim => claim.approvedText || claim.sourceText).join(' · ')
                  : 'No claims are currently excluded. Review material claims in Property.'}</p>
              </div>
            </div>
          </div>
        </section>

        <div className="action-row">
          <button className="button button--primary" type="button" onClick={onApprove} disabled={!session.property.approved || !hasDirection || hasApprovalIssues} aria-describedby={!hasDirection ? 'campaign-approval-reason' : hasApprovalIssues ? 'campaign-approval-conflicts' : undefined}>
            Approve campaign direction
          </button>
          {!hasDirection ? <span className="disabled-reason" id="campaign-approval-reason">Add a primary audience, at least one writing style and a tone.</span> : null}
        </div>
      </div>
    </div>
  );
};
