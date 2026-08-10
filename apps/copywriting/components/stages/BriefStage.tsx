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
  const governingTargetId = (stage: 'property' | 'campaign' | 'photos' | 'brief'): string => {
    if (stage === 'property') return 'core-facts-title';
    if (stage === 'campaign') return 'campaign-audience-title';
    if (stage === 'photos') return 'photo-policy-title';
    return 'brief-supporting-context-summary';
  };
  const isApproved = approvalPresentation.state === 'APPROVED';

  return (
    <div>
    <header className="stage-header">
      <div className="stage-header__copy">
        <h1 ref={headingRef} tabIndex={-1}>Reviewed Brief</h1>
        <p>Resolve consequential issues first, then approve the single brief that governs Listing Copy and every Campaign Pack output.</p>
      </div>
    </header>

    <div className="section-stack">
      {blockers.length > 0 ? (
        <section className="surface" aria-labelledby="brief-issues-title">
          <div className="surface__header">
            <div><h2 id="brief-issues-title">Issues to resolve</h2><p>Approval stays unavailable while required review conditions remain unresolved.</p></div>
          </div>
          <div>
            {blockers.map(blocker => (
              <div className="status-row" data-state="failed" key={`${blocker.governingStage}-${blocker.id}`}>
                <div><div className="status-row__title">{blocker.message}</div><div className="status-row__meta">Governed in {blocker.governingStage}</div></div>
                <div className="status-row__actions"><span className="status-row__state">Needs attention</span><button className="row-action" type="button" aria-label={`Review ${blocker.message} in ${blocker.governingStage}`} onClick={() => onNavigate(blocker.governingStage, governingTargetId(blocker.governingStage))}>Review</button></div>
              </div>
            ))}
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

      <ReviewedBriefProof
        session={session}
        snapshot={isApproved ? session.brief.snapshot : null}
        onListingApproximateWordCountChange={isApproved ? undefined : onListingApproximateWordCountChange}
      />

      <details className="supporting-details">
        <summary id="brief-supporting-context-summary">
          <span>
            <strong>Supporting people and open-home details</strong>
            <span>Optional campaign context · edit only when needed</span>
          </span>
        </summary>
        <section className="surface supporting-details__surface" aria-labelledby="brief-contact-title">
          <div className="surface__header">
            <div><h2 id="brief-contact-title">People and campaign context</h2><p>Optional details are included only when explicitly enabled.</p></div>
          </div>
          <div className="surface__body section-stack">
            <label className="choice" data-selected={session.people.agentIncluded}>
              <input type="checkbox" checked={session.people.agentIncluded} onChange={event => onBooleanChange('agentIncluded', event.target.checked)} />
              <span><strong>Include agent context</strong><span>Name and contact details may be appended or integrated.</span></span>
            </label>
            {session.people.agentIncluded ? (
              <div className="field-grid field-grid--three">
                <label className="field"><span>Agent name</span><input value={session.people.agent.name} onChange={event => onAgentChange('name', event.target.value)} /></label>
                <label className="field"><span>Title</span><input value={session.people.agent.title} onChange={event => onAgentChange('title', event.target.value)} /></label>
                <label className="field"><span>Phone</span><input type="tel" value={session.people.agent.phone} onChange={event => onAgentChange('phone', event.target.value)} /></label>
                <label className="field"><span>Email</span><input type="email" value={session.people.agent.email} onChange={event => onAgentChange('email', event.target.value)} /></label>
                <label className="field"><span>Placement</span><select className="select-input" value={session.people.agent.inclusionMode} onChange={event => onAgentChange('inclusionMode', event.target.value)}><option value="append">Append signature</option><option value="integrate">Integrate naturally</option></select></label>
              </div>
            ) : null}

            <label className="choice" data-selected={session.people.agencyIncluded}>
              <input type="checkbox" checked={session.people.agencyIncluded} onChange={event => onBooleanChange('agencyIncluded', event.target.checked)} />
              <span><strong>Include agency context</strong><span>Use the existing workspace/agency identity where relevant.</span></span>
            </label>
            {session.people.agencyIncluded ? <label className="field"><span>Agency name</span><input value={session.people.agencyName} onChange={event => onAgencyChange(event.target.value)} /></label> : null}

            <label className="choice" data-selected={session.people.openHomeIncluded}>
              <input type="checkbox" checked={session.people.openHomeIncluded} onChange={event => onBooleanChange('openHomeIncluded', event.target.checked)} />
              <span><strong>Include open-home context (optional)</strong><span>Add any approved date, time or URL. Each field is optional.</span></span>
            </label>
            {session.people.openHomeIncluded ? (
              <div className="field-grid field-grid--three">
                <label className="field"><span>Date (optional)</span><input type="date" value={session.people.openHome.date} onChange={event => onOpenHomeChange('date', event.target.value)} /></label>
                <label className="field"><span>Time (optional)</span><input type="time" value={session.people.openHome.time} onChange={event => onOpenHomeChange('time', event.target.value)} /></label>
                <label className="field"><span>URL (optional)</span><input type="url" value={session.people.openHome.url} onChange={event => onOpenHomeChange('url', event.target.value)} /></label>
              </div>
            ) : null}
          </div>
        </section>
      </details>

      <div className="brief-proof__approval">
        <div className="brief-approval__decision">
          <strong>{isApproved ? 'Approved' : `${blockers.length} unresolved`} · {exclusionCount} excluded · {photoState}</strong>
          <p>{isApproved
            ? 'This session-only Approved Brief Snapshot governs the current outputs. It is not saved after reload.'
            : 'Approval creates a session-only Approved Brief Snapshot. It does not save or persist this campaign.'}</p>
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
