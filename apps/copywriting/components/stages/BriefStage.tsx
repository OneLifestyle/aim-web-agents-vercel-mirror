import React from 'react';
import type {
  ApprovedBriefBlocker,
  BriefApprovalPresentation,
} from '../../domain/approvedBrief';
import type { CampaignSessionState } from '../../domain/sessionState';
import { ReviewedBriefProof } from '../ReviewedBriefProof';

type BriefStageProps = {
  session: CampaignSessionState;
  blockers: ApprovedBriefBlocker[];
  approvalPresentation: BriefApprovalPresentation;
  headingRef: React.Ref<HTMLHeadingElement>;
  onBooleanChange: (field: 'agentIncluded' | 'agencyIncluded' | 'openHomeIncluded', value: boolean) => void;
  onAgentChange: (field: 'name' | 'title' | 'phone' | 'email' | 'inclusionMode', value: string) => void;
  onAgencyChange: (value: string) => void;
  onOpenHomeChange: (field: 'date' | 'time' | 'url', value: string) => void;
  onListingApproximateWordCountChange: (wordCount: number) => void;
  onNavigate: (stage: 'property' | 'campaign' | 'photos' | 'brief', targetId?: string) => void;
  onPrevious?: () => void;
  onApprove: () => void;
  onOpenOutputs: () => void;
};

export const BriefStage: React.FC<BriefStageProps> = ({
  session,
  blockers,
  approvalPresentation,
  headingRef,
  onBooleanChange,
  onAgentChange,
  onAgencyChange,
  onOpenHomeChange,
  onListingApproximateWordCountChange,
  onNavigate,
  onPrevious,
  onApprove,
  onOpenOutputs,
}) => {
  const exclusionCount = session.property.claims.filter(claim => claim.state === 'excluded').length;
  const selectedPhotoIds = new Set(session.photos.items.filter(photo => photo.selected).map(photo => photo.id));
  const approvedHighlightCount = session.photos.highlights.filter(highlight => (
    selectedPhotoIds.has(highlight.imageId)
    && (highlight.state === 'approved' || highlight.state === 'corrected')
  )).length;
  const photoState = session.photos.policy === 'off'
    ? 'Photo context off'
    : `${approvedHighlightCount} approved photo highlight${approvedHighlightCount === 1 ? '' : 's'}`;
  const governingTargetId = (blocker: ApprovedBriefBlocker): string => {
    if (blocker.targetId) return blocker.targetId;
    if (blocker.id.startsWith('fact.')) return 'core-facts-title';
    if (blocker.id.startsWith('claim.')) return 'property-claims-title';
    if (blocker.id.startsWith('campaign.writing-styles') || blocker.id.startsWith('campaign.tone')) return 'campaign-voice-title';
    if (blocker.id.startsWith('campaign.emphasis')) return 'campaign-emphasis-title';
    if (blocker.id.startsWith('photo.') || blocker.id.startsWith('highlight.')) return 'visual-highlights-title';
    if (blocker.governingStage === 'property') return 'core-facts-title';
    if (blocker.governingStage === 'campaign') return 'campaign-audience-title';
    if (blocker.governingStage === 'photos') return 'photo-policy-title';
    return 'brief-supporting-context-summary';
  };
  const blockerDetails = (blocker: ApprovedBriefBlocker): Array<[string, string]> => [
    ['Affected item', blocker.affectedItem],
    ['Approved value', blocker.approvedValue],
    ['Conflicting claim', blocker.conflictingValue],
    ['Source', blocker.sourceContext],
    ['Resolution', blocker.resolution],
  ].flatMap(([label, value]) => value ? [[label, value] as [string, string]] : []);
  const isApproved = approvalPresentation.state === 'APPROVED';
  const includedPeopleContext = [
    session.people.agentIncluded ? 'Agent' : '',
    session.people.agencyIncluded ? 'Agency' : '',
    session.people.openHomeIncluded ? 'Open Home' : '',
  ].filter(Boolean);
  const hasPeopleBlocker = blockers.some(blocker => blocker.id.startsWith('people.'));

  return (
    <div>
    <header className="stage-header">
      <div className="stage-header__copy">
        <h1 ref={headingRef} tabIndex={-1}>Reviewed Brief</h1>
        <p>Resolve important exceptions first, then approve the brief used for Listing Copy and every Campaign Pack output.</p>
      </div>
      {onPrevious ? <div className="stage-header__actions"><button className="button button--secondary" type="button" onClick={onPrevious}>Previous: Photos</button></div> : null}
    </header>

    <div className="section-stack">
      {blockers.length > 0 ? (
        <section className="surface" aria-labelledby="brief-issues-title">
          <div className="surface__header">
            <div><h2 id="brief-issues-title">Issues to resolve</h2><p>Approval stays unavailable while required review conditions remain unresolved.</p></div>
          </div>
          <div>
            {blockers.map(blocker => {
              const details = blockerDetails(blocker);
              return (
                <div className="status-row" data-state="failed" key={`${blocker.governingStage}-${blocker.id}`}>
                  <div>
                    <div className="status-row__title">{blocker.message}</div>
                    {details.length > 0
                      ? details.map(([label, value]) => <div className="status-row__meta" key={label}><strong>{label}:</strong> {value}</div>)
                      : <div className="status-row__meta">Review in {blocker.governingStage}</div>}
                  </div>
                  <div className="status-row__actions"><span className="status-row__state">Needs attention</span><button className="row-action" type="button" aria-label={`Review ${blocker.message} in ${blocker.governingStage}`} onClick={() => onNavigate(blocker.governingStage, governingTargetId(blocker))}>Review</button></div>
                </div>
              );
            })}
          </div>
        </section>
      ) : approvalPresentation.noticeTitle ? (
        <div className="notice" data-tone="success">
          <div>
            <strong>{approvalPresentation.noticeTitle}</strong>
            <p>All required facts, claims, direction and photo policy have a human review decision.</p>
          </div>
        </div>
      ) : null}

      <details className="supporting-details" open={hasPeopleBlocker || undefined}>
        <summary id="brief-supporting-context-summary">
          <span>
            <strong>Agent, agency and Open Home details</strong>
            <span>{includedPeopleContext.length > 0 ? `${includedPeopleContext.join(' · ')} included` : 'Optional · add contact details here before approval and export'}</span>
          </span>
        </summary>
        <section className="surface supporting-details__surface" aria-labelledby="brief-contact-title">
          <div className="surface__header">
            <div><h2 id="brief-contact-title">Contact and campaign details</h2><p>Choose what to include. Valid agent or agency details can also be added as an export signature.</p></div>
          </div>
          <div className="surface__body section-stack">
            <label className="choice" data-selected={session.people.agentIncluded} htmlFor="brief-agent-included">
              <input id="brief-agent-included" type="checkbox" checked={session.people.agentIncluded} onChange={event => onBooleanChange('agentIncluded', event.target.checked)} />
              <span><strong>Include agent details</strong><span>Name and contact details may be appended as a signature or integrated naturally.</span></span>
            </label>
            {session.people.agentIncluded ? (
              <div className="field-grid field-grid--three">
                <label className="field" htmlFor="brief-agent-name"><span>Agent name</span><input id="brief-agent-name" value={session.people.agent.name} onChange={event => onAgentChange('name', event.target.value)} /></label>
                <label className="field" htmlFor="brief-agent-title"><span>Title</span><input id="brief-agent-title" value={session.people.agent.title} onChange={event => onAgentChange('title', event.target.value)} /></label>
                <label className="field" htmlFor="brief-agent-phone"><span>Phone</span><input id="brief-agent-phone" type="tel" value={session.people.agent.phone} onChange={event => onAgentChange('phone', event.target.value)} /></label>
                <label className="field" htmlFor="brief-agent-email"><span>Email</span><input id="brief-agent-email" type="email" value={session.people.agent.email} onChange={event => onAgentChange('email', event.target.value)} /></label>
                <label className="field" htmlFor="brief-agent-placement"><span>Placement</span><select id="brief-agent-placement" className="select-input" value={session.people.agent.inclusionMode} onChange={event => onAgentChange('inclusionMode', event.target.value)}><option value="append">Append signature</option><option value="integrate">Integrate naturally</option></select></label>
              </div>
            ) : null}

            <label className="choice" data-selected={session.people.agencyIncluded} htmlFor="brief-agency-included">
              <input id="brief-agency-included" type="checkbox" checked={session.people.agencyIncluded} onChange={event => onBooleanChange('agencyIncluded', event.target.checked)} />
              <span><strong>Include agency details</strong><span>Include the approved agency name where relevant.</span></span>
            </label>
            {session.people.agencyIncluded ? <label className="field" htmlFor="brief-agency-name"><span>Agency name</span><input id="brief-agency-name" value={session.people.agencyName} onChange={event => onAgencyChange(event.target.value)} /></label> : null}

            <label className="choice" data-selected={session.people.openHomeIncluded} htmlFor="brief-open-home-included">
              <input id="brief-open-home-included" type="checkbox" checked={session.people.openHomeIncluded} onChange={event => onBooleanChange('openHomeIncluded', event.target.checked)} />
              <span><strong>Include Open Home details (optional)</strong><span>Add any approved date, time or URL. Each field is optional.</span></span>
            </label>
            {session.people.openHomeIncluded ? (
              <div className="field-grid field-grid--three">
                <label className="field" htmlFor="brief-open-home-date"><span>Date (optional)</span><input id="brief-open-home-date" type="date" value={session.people.openHome.date} onChange={event => onOpenHomeChange('date', event.target.value)} /></label>
                <label className="field" htmlFor="brief-open-home-time"><span>Time (optional)</span><input id="brief-open-home-time" type="time" value={session.people.openHome.time} onChange={event => onOpenHomeChange('time', event.target.value)} /></label>
                <label className="field" htmlFor="brief-open-home-url"><span>URL (optional)</span><input id="brief-open-home-url" type="url" value={session.people.openHome.url} onChange={event => onOpenHomeChange('url', event.target.value)} /></label>
              </div>
            ) : null}
          </div>
        </section>
      </details>

      <ReviewedBriefProof
        session={session}
        snapshot={isApproved ? session.brief.snapshot : null}
        blockers={blockers}
        onListingApproximateWordCountChange={isApproved ? undefined : onListingApproximateWordCountChange}
      />

      <div className="brief-proof__approval">
        <div className="brief-approval__decision">
          <strong>{isApproved ? 'Approved' : `${blockers.length} unresolved`} · {exclusionCount} excluded · {photoState}</strong>
          <p>{isApproved
            ? 'This approved brief is used by the current outputs. It is not saved after reload.'
            : 'Approval records this reviewed brief for generation in the current temporary session only.'}</p>
        </div>
        <button
          className="button button--primary"
          type="button"
          onClick={isApproved ? onOpenOutputs : onApprove}
          disabled={!isApproved && blockers.length > 0}
          aria-describedby={!isApproved && blockers.length > 0 ? 'brief-approval-blocked' : undefined}
        >
          {approvalPresentation.primaryActionLabel}
        </button>
        {!isApproved && blockers.length > 0 ? <span className="sr-only" id="brief-approval-blocked">Resolve all listed brief issues before approval.</span> : null}
      </div>
    </div>
    </div>
  );
};
