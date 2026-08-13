import React from 'react';
import {
  getApprovedBriefBlockers,
  type ApprovedBriefBlocker,
} from '../domain/approvedBrief';
import type { CampaignSessionState } from '../domain/sessionState';
import type {
  ApprovedBriefSnapshot,
  CampaignStageId,
  ReviewedFact,
} from '../types';

export type ReviewedBriefStageSummary = {
  id: CampaignStageId;
  label: string;
  stateLabel: string;
  state: 'approved' | 'ready' | 'in-review' | 'needs-attention' | 'optional-off' | 'not-started';
};

type ReviewedBriefProofProps = {
  session: CampaignSessionState;
  snapshot?: ApprovedBriefSnapshot | null;
  compact?: boolean;
  blockers?: readonly ApprovedBriefBlocker[];
  stageStates?: readonly ReviewedBriefStageSummary[];
  onNavigate?: (
    stage: 'property' | 'campaign' | 'photos' | 'brief',
    targetId?: string,
  ) => void;
  onListingApproximateWordCountChange?: (wordCount: number) => void;
};

const FACT_LABELS: Record<ReviewedFact['key'], string> = {
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  carSpaces: 'Car spaces',
  landValue: 'Land',
  propertyType: 'Property type',
};

const joinOrNone = (items: readonly string[], fallback = 'None'): string => items.filter(Boolean).join(' · ') || fallback;

const formatFactValue = (
  value: string | number | null,
  unit?: string,
): string => {
  if (value === null || value === '') return 'Not supplied';
  const displayValue = typeof value === 'number' ? value.toLocaleString('en-AU') : value;
  return `${displayValue}${unit ? ` ${unit}` : ''}`;
};

const getBlockerTargetId = (blocker: ApprovedBriefBlocker): string => {
  const exactTarget = (blocker as ApprovedBriefBlocker & { targetId?: string }).targetId;
  if (exactTarget) return exactTarget;
  if (blocker.id.startsWith('fact.')) return 'core-facts-title';
  if (blocker.id.startsWith('claim.')) return 'property-claims-title';
  if (blocker.id.startsWith('campaign.primary-audience')) return 'campaign-audience-title';
  if (blocker.id.startsWith('campaign.writing-styles') || blocker.id.startsWith('campaign.tone')) return 'campaign-voice-title';
  if (blocker.id.startsWith('campaign.emphasis')) return 'campaign-emphasis-title';
  if (blocker.id.startsWith('photo.') || blocker.id.startsWith('highlight.')) return 'visual-highlights-title';
  if (blocker.id.startsWith('people.')) return 'brief-supporting-context-summary';
  if (blocker.id.startsWith('listing-generation.')) return 'brief-listing-length';
  if (blocker.governingStage === 'property') return 'core-facts-title';
  if (blocker.governingStage === 'campaign') return 'campaign-audience-title';
  if (blocker.governingStage === 'photos') return 'photo-policy-title';
  return 'brief-supporting-context-summary';
};

const getStructuredBlockerDetails = (blocker: ApprovedBriefBlocker): Array<[string, string]> => {
  const structured = blocker as ApprovedBriefBlocker & {
    affectedItem?: unknown;
    approvedValue?: unknown;
    conflictingValue?: unknown;
    sourceContext?: unknown;
    resolution?: unknown;
  };
  return [
    ['Affected item', structured.affectedItem],
    ['Approved value', structured.approvedValue],
    ['Conflicting claim', structured.conflictingValue],
    ['Source', structured.sourceContext],
    ['Resolution', structured.resolution],
  ].flatMap(([label, value]) => (
    value === undefined || value === null || value === '' ? [] : [[label, String(value)] as [string, string]]
  ));
};

const deriveStageStates = (
  session: CampaignSessionState,
  blockers: readonly ApprovedBriefBlocker[],
): ReviewedBriefStageSummary[] => {
  const hasOutputAttention = Object.values(session.outputs).some(output => (
    output.state === 'failed' || output.state === 'needs-review' || output.state === 'needs-regeneration'
  ));
  const hasReadyOutput = Object.values(session.outputs).some(output => output.state === 'ready');
  const hasAnyOutput = Object.values(session.outputs).some(output => Boolean(output.content.trim() || output.generatedAt));
  const briefApproved = blockers.length === 0
    && session.brief.approved
    && session.brief.snapshot?.humanApproval.approved === true;

  return [
    {
      id: 'property',
      label: 'Property',
      state: session.property.approved ? 'approved' : 'in-review',
      stateLabel: session.property.approved ? 'Approved' : 'Review required',
    },
    {
      id: 'campaign',
      label: 'Campaign',
      state: session.campaign.approved ? 'approved' : 'in-review',
      stateLabel: session.campaign.approved ? 'Approved' : 'Review required',
    },
    {
      id: 'photos',
      label: 'Photos',
      state: session.photos.policy === 'off' ? 'optional-off' : session.photos.approved ? 'approved' : 'in-review',
      stateLabel: session.photos.policy === 'off' ? 'Off' : session.photos.approved ? 'Approved' : 'Review required',
    },
    {
      id: 'brief',
      label: 'Reviewed Brief',
      state: briefApproved ? 'approved' : blockers.length > 0 ? 'needs-attention' : 'ready',
      stateLabel: briefApproved ? 'Approved' : blockers.length > 0 ? `${blockers.length} decision${blockers.length === 1 ? '' : 's'} needed` : 'Ready to approve',
    },
    {
      id: 'outputs',
      label: 'Outputs',
      state: hasOutputAttention ? 'needs-attention' : hasReadyOutput ? 'ready' : hasAnyOutput ? 'in-review' : 'not-started',
      stateLabel: hasOutputAttention ? 'Needs attention' : hasReadyOutput ? 'Ready' : hasAnyOutput ? 'In progress' : 'Not generated',
    },
  ];
};

export const ReviewedBriefProof: React.FC<ReviewedBriefProofProps> = ({
  session,
  snapshot = null,
  compact = false,
  blockers: suppliedBlockers,
  stageStates: suppliedStageStates,
  onNavigate,
  onListingApproximateWordCountChange,
}) => {
  const blockers = suppliedBlockers ?? getApprovedBriefBlockers(session);
  const stageStates = suppliedStageStates ?? deriveStageStates(session, blockers);
  const factItems = snapshot
    ? snapshot.factProvenance.map(fact => ({
      ...fact,
      label: FACT_LABELS[fact.key],
    }))
    : session.property.facts.map(fact => ({ ...fact }));
  const confirmedClaims = snapshot
    ? snapshot.claims.confirmed
    : session.property.claims.filter(claim => claim.state === 'confirmed');
  const correctedClaims = snapshot
    ? snapshot.claims.corrected
    : session.property.claims.filter(claim => claim.state === 'corrected');
  const exclusions = snapshot
    ? snapshot.hardExclusions
    : session.property.claims.filter(claim => claim.state === 'excluded').map(claim => ({
      id: claim.id,
      text: claim.approvedText || claim.sourceText,
      aliases: claim.aliases,
      provenance: claim.provenance,
      ...(claim.reason ? { reason: claim.reason } : {}),
    }));
  const correctedFacts = factItems.filter(fact => fact.state === 'corrected');
  const primaryAudience = snapshot?.audience.primary ?? session.campaign.primaryAudience;
  const secondaryAudience = snapshot?.audience.secondary ?? session.campaign.secondaryAudience;
  const writingStyles = snapshot?.voice.writingStyles ?? session.campaign.writingStyles;
  const tone = snapshot?.voice.tone ?? session.campaign.tone;
  const emphasis = snapshot?.campaignEmphasis ?? session.campaign.emphasis;
  const avoidances = snapshot?.styleAvoidances ?? session.campaign.styleAvoidances;
  const photoPolicy = snapshot?.photoContext.policy ?? session.photos.policy;
  const selectedPhotos = snapshot
    ? snapshot.photoContext.selectedPhotos
    : session.photos.items.filter(photo => photo.selected);
  const selectedPhotoIds = new Set(selectedPhotos.map(photo => photo.id));
  const approvedHighlights = snapshot
    ? snapshot.photoContext.approvedHighlights
    : session.photos.highlights.filter(highlight => (
      selectedPhotoIds.has(highlight.imageId)
      && (highlight.state === 'approved' || highlight.state === 'corrected')
    ));
  const photoGroups = selectedPhotos.map(photo => ({
    photo,
    highlights: approvedHighlights.filter(highlight => highlight.imageId === photo.id),
  }));
  const address = snapshot?.selectedAddress ?? session.address.selectedLabel ?? session.address.query;
  const profileInclusion = snapshot?.profileInclusion ?? session.property.profileInclusion;
  const overview = snapshot
    ? snapshot.propertyOverview
    : session.property.overviewState === 'confirmed'
      ? session.property.overview
      : '';
  const suburb = snapshot
    ? snapshot.suburbContext
    : profileInclusion === 'suburb' || profileInclusion === 'both'
      ? session.property.suburbContext
      : '';
  const area = snapshot
    ? snapshot.areaContext
    : profileInclusion === 'area' || profileInclusion === 'both'
      ? session.property.areaContext
      : '';
  const profileInclusionLabel = profileInclusion === 'both'
    ? 'Suburb and area included'
    : profileInclusion === 'suburb'
      ? 'Suburb included'
      : profileInclusion === 'area'
        ? 'Area included'
        : 'No location context included';
  const agent = snapshot?.agentContext ?? {
    included: session.people.agentIncluded,
    name: session.people.agent.name,
    title: session.people.agent.title,
    phone: session.people.agent.phone,
    email: session.people.agent.email,
    inclusionMode: session.people.agent.inclusionMode,
  };
  const agency = snapshot?.agencyContext ?? {
    included: session.people.agencyIncluded,
    name: session.people.agencyName,
  };
  const openHome = snapshot?.openHomeContext ?? {
    included: session.people.openHomeIncluded,
    date: session.people.openHome.date,
    time: session.people.openHome.time,
    url: session.people.openHome.url,
  };
  const approximateWordCount = snapshot?.listingGenerationSettings.approximateWordCount
    ?? session.listingGenerationSettings.approximateWordCount;
  const hasGeneratedOutputs = (Object.values(session.outputs) as Array<CampaignSessionState['outputs'][keyof CampaignSessionState['outputs']]>)
    .some(output => Boolean(output.content.trim() || output.generatedAt));
  const TitleHeading = compact ? 'h3' : 'h2';
  const SectionHeading = compact ? 'h4' : 'h3';
  const titleId = compact ? 'drawer-brief-proof-title' : 'brief-proof-title';
  const idPrefix = compact ? 'drawer-' : '';
  const listingSettingsTitleId = `${idPrefix}brief-listing-settings-title`;
  const listingLengthId = `${idPrefix}brief-listing-length`;
  const listingLengthHelpId = `${listingLengthId}-help`;
  const product = snapshot?.product ?? session.product;
  const correctionCount = correctedFacts.length + correctedClaims.length;

  return (
    <article className="brief-proof" aria-labelledby={titleId}>
      <header className="brief-proof__opening">
        <p className="document-kicker">{snapshot ? 'Approved brief' : 'Reviewed brief'}</p>
        <TitleHeading className="brief-proof__title" id={titleId}>{address || 'Property campaign'}</TitleHeading>
        <p>{product === 'campaign-pack' ? 'Listing Copy and 16 campaign outputs' : 'Listing Copy'}</p>
        {snapshot ? <p className="field-help">Approved {new Date(snapshot.approvedAt).toLocaleString('en-AU')}</p> : null}
      </header>

      {compact ? (
        <section className="brief-section" aria-labelledby={`${idPrefix}brief-readiness-title`}>
          <SectionHeading className="brief-section__title" id={`${idPrefix}brief-readiness-title`}>Current readiness</SectionHeading>
          <div>
            {stageStates.map(stage => (
              <div className="status-row" data-state={stage.state === 'needs-attention' ? 'failed' : stage.state} key={stage.id}>
                <div className="status-row__title">{stage.label}</div>
                <div className="status-row__state">{stage.stateLabel}</div>
              </div>
            ))}
          </div>
          {blockers.length > 0 ? (
            <div className="section-stack">
              <p><strong>{blockers.length} decision{blockers.length === 1 ? '' : 's'} still required.</strong> Resolve these before approval or generation.</p>
              {blockers.map(blocker => {
                const details = getStructuredBlockerDetails(blocker);
                return (
                  <div className="status-row" data-state="failed" key={`${blocker.governingStage}-${blocker.id}`}>
                    <div>
                      <div className="status-row__title">{blocker.message}</div>
                      {details.map(([label, value]) => <div className="status-row__meta" key={label}><strong>{label}:</strong> {value}</div>)}
                    </div>
                    {onNavigate ? (
                      <div className="status-row__actions">
                        <button className="row-action" type="button" onClick={() => onNavigate(blocker.governingStage, getBlockerTargetId(blocker))}>Review</button>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : <p><strong>No blockers.</strong> {snapshot ? 'This is the brief used by the current drafts.' : 'The brief is ready for explicit approval.'}</p>}
        </section>
      ) : null}

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-decision-summary-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-decision-summary-title`}>What you are approving</SectionHeading>
        <p><strong>{correctionCount} correction{correctionCount === 1 ? '' : 's'} · {exclusions.length} factual exclusion{exclusions.length === 1 ? '' : 's'} · Photo context {photoPolicy === 'included' ? 'included' : 'off'}.</strong></p>
        <p>Campaign direction: {primaryAudience || 'Audience not supplied'} · {joinOrNone(writingStyles, 'Voice not supplied')} · approximately {approximateWordCount} words.</p>
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-core-facts-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-core-facts-title`}>Core Facts</SectionHeading>
        <div className="brief-facts">
          {factItems.map(fact => {
            const sourceUnit = fact.key === 'landValue' ? fact.sourceUnit ?? 'm²' : undefined;
            const approvedUnit = fact.key === 'landValue' ? fact.unit ?? 'm²' : undefined;
            return (
              <div className="brief-fact" data-state={fact.state} key={fact.key}>
                <span>{fact.label}{fact.state === 'corrected' ? ' · Corrected' : ''}</span>
                <strong>{formatFactValue(fact.approvedValue, approvedUnit)}</strong>
                {fact.state === 'corrected' ? <span>Source: {formatFactValue(fact.sourceValue, sourceUnit)}</span> : null}
              </div>
            );
          })}
          <div className="brief-fact"><span>Address in copy</span><strong>{(snapshot?.includeAddressInCopy ?? session.address.includeInCopy) ? 'Included' : 'Omitted'}</strong></div>
        </div>
        {!compact ? (
          <details className="supporting-details">
            <summary><span><strong>Source context</strong><span>Fact-level provenance remains available for review</span></span></summary>
            <div className="surface__body">
              <ul>{factItems.map(fact => <li key={fact.key}><strong>{fact.label}.</strong> {fact.provenance}</li>)}</ul>
            </div>
          </details>
        ) : null}
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('property', 'core-facts-title')}>Review Core Facts</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-material-claims-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-material-claims-title`}>Material Claims</SectionHeading>
        {correctedClaims.length > 0 ? (
          <div>
            <p><strong>Corrected claims</strong></p>
            <ul>{correctedClaims.map(claim => <li key={claim.id}>{claim.approvedText}<span className="field-help">Corrected from: {claim.sourceText}</span></li>)}</ul>
          </div>
        ) : null}
        {compact ? (
          <p>{confirmedClaims.length} confirmed claim{confirmedClaims.length === 1 ? '' : 's'}{correctedClaims.length > 0 ? ` · ${correctedClaims.length} corrected` : ''}.</p>
        ) : (
          <details className="supporting-details">
            <summary><span><strong>Confirmed supporting claims · {confirmedClaims.length}</strong><span>Approved evidence, condensed by default</span></span></summary>
            <div className="surface__body">
              {confirmedClaims.length > 0 ? <ul>{confirmedClaims.map(claim => <li key={claim.id}>{claim.approvedText}<span className="field-help">{claim.provenance}</span></li>)}</ul> : <p>No additional claims included.</p>}
            </div>
          </details>
        )}
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('property', 'property-claims-title')}>Review Material Claims</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-overview-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-overview-title`}>Property Overview</SectionHeading>
        {compact ? <p>{overview ? 'Included' : 'Not included'}</p> : overview ? (
          <details className="supporting-details">
            <summary><span><strong>Included overview</strong><span>{overview.slice(0, 140)}{overview.length > 140 ? '…' : ''}</span></span></summary>
            <div className="surface__body"><p>{overview}</p></div>
          </details>
        ) : <p>Not included.</p>}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-location-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-location-title`}>Location Context</SectionHeading>
        <p><strong>{profileInclusionLabel}.</strong></p>
        {!compact && suburb ? <details className="supporting-details"><summary><span><strong>Suburb context</strong><span>{suburb.slice(0, 120)}{suburb.length > 120 ? '…' : ''}</span></span></summary><div className="surface__body"><p>{suburb}</p></div></details> : null}
        {!compact && area ? <details className="supporting-details"><summary><span><strong>Area context</strong><span>{area.slice(0, 120)}{area.length > 120 ? '…' : ''}</span></span></summary><div className="surface__body"><p>{area}</p></div></details> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-direction-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-direction-title`}>Campaign Direction</SectionHeading>
        <p><strong>Primary audience.</strong> {primaryAudience || 'Not supplied'}</p>
        {secondaryAudience ? <p><strong>Secondary audience.</strong> {secondaryAudience}</p> : null}
        <p><strong>Writing style.</strong> {joinOrNone(writingStyles)}</p>
        {tone ? <p><strong>Tone.</strong> {tone}</p> : null}
        <p><strong>Campaign emphasis.</strong> {joinOrNone(emphasis)}</p>
        <p><strong>Style boundaries.</strong> {joinOrNone(avoidances)}</p>
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('campaign', 'campaign-audience-title')}>Review Campaign Direction</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-photos-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-photos-title`}>Photo Context</SectionHeading>
        {photoPolicy === 'off' ? <p><strong>Off.</strong> No analysed photo content will be used.</p> : (
          <>
            <p><strong>Included.</strong> {selectedPhotos.length} reviewed photo{selectedPhotos.length === 1 ? '' : 's'} · {approvedHighlights.length} approved highlight{approvedHighlights.length === 1 ? '' : 's'}.</p>
            {!compact ? photoGroups.map(({ photo, highlights }) => (
              <div key={photo.id}>
                <p><strong>Photo {photo.imageNumber} · {photo.name}</strong></p>
                {highlights.length > 0 ? <ul>{highlights.map(highlight => <li key={highlight.id}>{highlight.approvedText}{highlight.state === 'corrected' ? <span className="field-help">Corrected from: {highlight.sourceText}</span> : null}</li>)}</ul> : <p>No approved highlight included.</p>}
              </div>
            )) : null}
          </>
        )}
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('photos', 'photo-policy-title')}>Review Photo Context</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${idPrefix}brief-exclusions-title`}>
        <SectionHeading className="brief-section__title" id={`${idPrefix}brief-exclusions-title`}>Hard Factual Exclusions</SectionHeading>
        {exclusions.length > 0 ? <ul>{exclusions.map(claim => <li key={claim.id}><strong>{claim.text}</strong>{claim.reason ? <span className="field-help">{claim.reason}</span> : null}</li>)}</ul> : <p>None.</p>}
      </section>

      {agent.included ? (
        <section className="brief-section" aria-labelledby={`${idPrefix}brief-agent-title`}>
          <SectionHeading className="brief-section__title" id={`${idPrefix}brief-agent-title`}>Agent</SectionHeading>
          <p><strong>{agent.name || 'Name not supplied'}</strong>{agent.title ? ` · ${agent.title}` : ''}</p>
          {agent.phone ? <p>{agent.phone}</p> : null}
          {agent.email ? <p>{agent.email}</p> : null}
          <p>Placement: {agent.inclusionMode === 'integrate' ? 'Integrate naturally' : 'Append signature'}.</p>
        </section>
      ) : null}

      {agency.included ? (
        <section className="brief-section" aria-labelledby={`${idPrefix}brief-agency-title`}>
          <SectionHeading className="brief-section__title" id={`${idPrefix}brief-agency-title`}>Agency</SectionHeading>
          <p>{agency.name || 'Name not supplied'}</p>
        </section>
      ) : null}

      {openHome.included ? (
        <section className="brief-section" aria-labelledby={`${idPrefix}brief-open-home-title`}>
          <SectionHeading className="brief-section__title" id={`${idPrefix}brief-open-home-title`}>Open Home</SectionHeading>
          <p><strong>Date.</strong> {openHome.date || 'Not supplied'}</p>
          <p><strong>Time.</strong> {openHome.time || 'Not supplied'}</p>
          <p><strong>URL.</strong> {openHome.url || 'Not supplied'}</p>
        </section>
      ) : null}

      {!agent.included && !agency.included && !openHome.included ? (
        <section className="brief-section" aria-label="Optional campaign details">
          <p className="field-help">Agent, agency and Open Home details are not included.</p>
        </section>
      ) : null}

      <section className="brief-section brief-section--generation" aria-labelledby={listingSettingsTitleId}>
        <SectionHeading className="brief-section__title" id={listingSettingsTitleId}>Generation Settings</SectionHeading>
        {onListingApproximateWordCountChange && !snapshot ? (
          <label className="field" htmlFor={listingLengthId}>
            <span>Approximate Listing Copy length</span>
            <div className="brief-length-control">
              <input
                id={listingLengthId}
                type="range"
                min={50}
                max={1000}
                step={50}
                value={approximateWordCount}
                aria-describedby={listingLengthHelpId}
                aria-valuetext={`Approximately ${approximateWordCount} words`}
                onChange={event => onListingApproximateWordCountChange(Number(event.target.value))}
              />
              <output htmlFor={listingLengthId}>Approximately {approximateWordCount} words</output>
            </div>
            <span className="field-help" id={listingLengthHelpId}>{hasGeneratedOutputs
              ? 'Changing this setting reopens brief approval. Existing drafts will need to be updated; generation does not start automatically.'
              : 'This is the initial target length for Listing Copy. You can adjust it before approving the brief.'}</span>
          </label>
        ) : <p><strong>Listing Copy length.</strong> Approximately {approximateWordCount} words.</p>}
      </section>

      {snapshot?.humanApproval.approved ? (
        <section className="brief-section" aria-labelledby={`${idPrefix}brief-approval-title`}>
          <SectionHeading className="brief-section__title" id={`${idPrefix}brief-approval-title`}>Approval</SectionHeading>
          <p>{snapshot.humanApproval.statement}</p>
        </section>
      ) : null}
    </article>
  );
};
