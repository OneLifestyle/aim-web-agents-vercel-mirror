import React from 'react';
import type { ApprovedBriefSnapshot } from '../types';
import type { CampaignSessionState } from '../domain/sessionState';

type ReviewedBriefProofProps = {
  session: CampaignSessionState;
  snapshot?: ApprovedBriefSnapshot | null;
  compact?: boolean;
  onNavigate?: (
    stage: 'property' | 'campaign' | 'photos' | 'brief',
    targetId?: string,
  ) => void;
  onListingApproximateWordCountChange?: (wordCount: number) => void;
};

const joinOrNone = (items: readonly string[], fallback = 'None'): string => items.filter(Boolean).join(' · ') || fallback;

export const ReviewedBriefProof: React.FC<ReviewedBriefProofProps> = ({
  session,
  snapshot = null,
  compact = false,
  onNavigate,
  onListingApproximateWordCountChange,
}) => {
  const getFactValue = (key: string): string | number | null => {
    if (snapshot) {
      const facts = snapshot.approvedFacts;
      if (key === 'bedrooms') return facts.bedrooms;
      if (key === 'bathrooms') return facts.bathrooms;
      if (key === 'carSpaces') return facts.carSpaces;
      if (key === 'landValue') return facts.landValue;
      return facts.propertyType;
    }
    return session.property.facts.find(fact => fact.key === key)?.approvedValue ?? null;
  };
  const landUnit = snapshot?.approvedFacts.landUnit
    ?? session.property.facts.find(fact => fact.key === 'landValue')?.unit
    ?? 'm²';
  const confirmedClaims = snapshot
    ? [...snapshot.claims.confirmed, ...snapshot.claims.corrected]
    : session.property.claims.filter(claim => claim.state === 'confirmed' || claim.state === 'corrected');
  const exclusions = snapshot
    ? snapshot.hardExclusions
    : session.property.claims.filter(claim => claim.state === 'excluded').map(claim => ({
      id: claim.id,
      text: claim.approvedText || claim.sourceText,
      aliases: claim.aliases,
      provenance: claim.provenance,
    }));
  const primaryAudience = snapshot?.audience.primary ?? session.campaign.primaryAudience;
  const secondaryAudience = snapshot?.audience.secondary ?? session.campaign.secondaryAudience;
  const writingStyles = snapshot?.voice.writingStyles ?? session.campaign.writingStyles;
  const tone = snapshot?.voice.tone ?? session.campaign.tone;
  const emphasis = snapshot?.campaignEmphasis ?? session.campaign.emphasis;
  const avoidances = snapshot?.styleAvoidances ?? session.campaign.styleAvoidances;
  const photoPolicy = snapshot?.photoContext.policy ?? session.photos.policy;
  const selectedPhotoIds = new Set(session.photos.items.filter(photo => photo.selected).map(photo => photo.id));
  const approvedHighlights = snapshot
    ? snapshot.photoContext.approvedHighlights
    : session.photos.highlights.filter(highlight => (
      selectedPhotoIds.has(highlight.imageId)
      && (highlight.state === 'approved' || highlight.state === 'corrected')
    ));
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
      ? 'Suburb only'
      : profileInclusion === 'area'
        ? 'Area only'
        : 'No location context';
  const agentIncluded = snapshot?.agentContext.included ?? session.people.agentIncluded;
  const agentName = snapshot?.agentContext.name ?? session.people.agent.name;
  const agencyIncluded = snapshot?.agencyContext.included ?? session.people.agencyIncluded;
  const agencyName = snapshot?.agencyContext.name ?? session.people.agencyName;
  const openHomeIncluded = snapshot?.openHomeContext.included ?? session.people.openHomeIncluded;
  const openHomeDate = snapshot?.openHomeContext.date ?? session.people.openHome.date;
  const openHomeTime = snapshot?.openHomeContext.time ?? session.people.openHome.time;
  const approximateWordCount = snapshot?.listingGenerationSettings.approximateWordCount
    ?? session.listingGenerationSettings.approximateWordCount;
  const TitleHeading = compact ? 'h3' : 'h2';
  const SectionHeading = compact ? 'h4' : 'h3';
  const titleId = compact ? 'drawer-brief-proof-title' : 'brief-proof-title';
  const listingSettingsTitleId = `${compact ? 'drawer-' : ''}brief-listing-settings-title`;
  const listingLengthId = `${compact ? 'drawer-' : ''}brief-listing-length`;
  const listingLengthHelpId = `${listingLengthId}-help`;

  return (
    <article className="brief-proof" aria-labelledby={titleId}>
      <header className="brief-proof__opening">
        <p className="document-kicker">{snapshot ? 'Approved Brief Snapshot' : 'Reviewed Campaign Brief'}</p>
        <TitleHeading className="brief-proof__title" id={titleId}>{address || 'Property campaign'}</TitleHeading>
        <p>{(snapshot?.product ?? session.product) === 'campaign-pack' ? 'Campaign Pack · Listing foundation + 16 campaign outputs' : 'Listing Copy · one primary property document'}</p>
        {snapshot ? <p className="field-help">Snapshot {snapshot.snapshotId} · approved {new Date(snapshot.approvedAt).toLocaleString('en-AU')}</p> : null}
      </header>

      <section className="brief-section brief-section--generation" aria-labelledby={listingSettingsTitleId}>
        <SectionHeading className="brief-section__title" id={listingSettingsTitleId}>Listing generation settings</SectionHeading>
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
            <span className="field-help" id={listingLengthHelpId}>Changing this setting requires brief reapproval and marks existing Listing Copy and Campaign Pack outputs Needs regeneration. Generation does not start automatically.</span>
          </label>
        ) : (
          <p><strong>Approximate Listing Copy length.</strong> Approximately {approximateWordCount} words.</p>
        )}
      </section>

      <section className="brief-section" aria-labelledby={`${compact ? 'drawer-' : ''}brief-property-title`}>
        <SectionHeading className="brief-section__title" id={`${compact ? 'drawer-' : ''}brief-property-title`}>Property</SectionHeading>
        <div className="brief-facts">
          <div className="brief-fact"><span>Bedrooms</span><strong>{getFactValue('bedrooms') ?? 'Not supplied'}</strong></div>
          <div className="brief-fact"><span>Bathrooms</span><strong>{getFactValue('bathrooms') ?? 'Not supplied'}</strong></div>
          <div className="brief-fact"><span>Car spaces</span><strong>{getFactValue('carSpaces') ?? 'Not supplied'}</strong></div>
          <div className="brief-fact"><span>Land</span><strong>{getFactValue('landValue') ?? 'Not supplied'} {getFactValue('landValue') !== null ? landUnit : ''}</strong></div>
          <div className="brief-fact"><span>Property type</span><strong>{getFactValue('propertyType') || 'Not supplied'}</strong></div>
          <div className="brief-fact"><span>Address in copy</span><strong>{(snapshot?.includeAddressInCopy ?? session.address.includeInCopy) ? 'Included' : 'Omitted'}</strong></div>
        </div>
        {!compact ? (
          <>
            <p><strong>Overview.</strong> {overview || 'Not included.'}</p>
            <p><strong>Suburb context.</strong> {suburb || 'No suburb context supplied.'}</p>
            <p><strong>Area context.</strong> {area || 'No area context supplied.'}</p>
          </>
        ) : null}
        <p><strong>Location inclusion.</strong> {profileInclusionLabel}</p>
        <p><strong>Approved claims.</strong> {confirmedClaims.length > 0 ? confirmedClaims.map(claim => 'approvedText' in claim ? claim.approvedText : '').filter(Boolean).join(' · ') : 'None'}</p>
        <p><strong>Hard exclusions.</strong> {exclusions.length > 0 ? exclusions.map(claim => claim.text).join(' · ') : 'None'}</p>
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('property', 'core-facts-title')}>Review governing property stage</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${compact ? 'drawer-' : ''}brief-direction-title`}>
        <SectionHeading className="brief-section__title" id={`${compact ? 'drawer-' : ''}brief-direction-title`}>Campaign direction</SectionHeading>
        <p><strong>Audience.</strong> {primaryAudience || 'Not supplied'}{secondaryAudience ? ` · secondary ${secondaryAudience}` : ''}</p>
        <p><strong>Voice.</strong> {joinOrNone(writingStyles)}{tone ? ` · ${tone}` : ''}</p>
        <p><strong>Campaign emphasis.</strong> {joinOrNone(emphasis)}</p>
        <p><strong>Style and positioning to avoid.</strong> {joinOrNone(avoidances)}</p>
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('campaign', 'campaign-audience-title')}>Review governing Campaign stage</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${compact ? 'drawer-' : ''}brief-people-title`}>
        <SectionHeading className="brief-section__title" id={`${compact ? 'drawer-' : ''}brief-people-title`}>People and campaign context</SectionHeading>
        <p><strong>Agent.</strong> {agentIncluded ? agentName || 'Included' : 'Not included'}</p>
        <p><strong>Agency.</strong> {agencyIncluded ? agencyName || 'Included' : 'Not included'}</p>
        <p><strong>Open home.</strong> {openHomeIncluded ? `${openHomeDate || 'Date required'} · ${openHomeTime || 'Time required'}` : 'Not included'}</p>
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('brief', 'brief-supporting-context-summary')}>Review people and open-home context</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${compact ? 'drawer-' : ''}brief-photos-title`}>
        <SectionHeading className="brief-section__title" id={`${compact ? 'drawer-' : ''}brief-photos-title`}>Photo context</SectionHeading>
        <p><strong>{photoPolicy === 'included' ? 'Use reviewed photo context' : 'Photo context off'}.</strong> {photoPolicy === 'included' ? `${approvedHighlights.length} approved highlight${approvedHighlights.length === 1 ? '' : 's'}` : 'No analysed photo content enters generation.'}</p>
        {!compact && photoPolicy === 'included' && approvedHighlights.length > 0 ? <p>{approvedHighlights.map(highlight => `Photo ${highlight.imageNumber}: ${highlight.approvedText}`).join(' · ')}</p> : null}
        {onNavigate ? <button className="row-action" type="button" onClick={() => onNavigate('photos', 'photo-policy-title')}>Review governing Photos stage</button> : null}
      </section>

      <section className="brief-section" aria-labelledby={`${compact ? 'drawer-' : ''}brief-approval-title`}>
        <SectionHeading className="brief-section__title" id={`${compact ? 'drawer-' : ''}brief-approval-title`}>Human approval</SectionHeading>
        <p>{snapshot?.humanApproval.approved
          ? snapshot.humanApproval.statement
          : 'Not yet approved. Approval creates a session-only snapshot and does not save this campaign.'}</p>
      </section>
    </article>
  );
};
