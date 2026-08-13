import React, { useRef } from 'react';
import type { CopywritingProductId, ReviewedClaim, ReviewedFact } from '../../types';
import type { ApprovedBriefBlocker } from '../../domain/approvedBrief';
import type { CampaignSessionState } from '../../domain/sessionState';
import {
  countBulkConfirmablePropertyClaims,
  countBulkConfirmablePropertyFacts,
  derivePropertyAddressState,
  derivePropertyReviewReadiness,
  getPropertyBlockerReviewAccessibleName,
  propertyClaimTargetId,
  propertyFactAgentLabel,
  propertyFactTargetId,
  resolvePropertyBlockerTargetId,
  selectedPropertyAddressMatchesQuery,
} from '../../domain/propertyReview';
import { StatusRow } from '../StatusRow';

type PropertyStageProps = {
  session: CampaignSessionState;
  suggestions: string[];
  activeSuggestionIndex: number;
  isSuggesting: boolean;
  isFetching: boolean;
  fetchError: string | null;
  hasFetchedDetails: boolean;
  propertyIssues: readonly ApprovedBriefBlocker[];
  headingRef: React.Ref<HTMLHeadingElement>;
  onProductChange: (product: CopywritingProductId) => void;
  onAddressChange: (value: string) => void;
  onAddressKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectAddress: (address: string) => void;
  onFetch: () => void;
  onIncludeAddressChange: (included: boolean) => void;
  onConfirmFact: (fact: ReviewedFact) => void;
  onConfirmAllFacts: () => void;
  onCorrectFact: (fact: ReviewedFact) => void;
  onConfirmClaim: (claim: ReviewedClaim) => void;
  onConfirmAllClaims: () => void;
  canBulkConfirmClaim?: (claim: ReviewedClaim) => boolean;
  onCorrectClaim: (claim: ReviewedClaim) => void;
  onExcludeClaim: (claim: ReviewedClaim) => void;
  onOverviewDecision: (state: CampaignSessionState['property']['overviewState']) => void;
  onProfileInclusionChange: (profileInclusion: CampaignSessionState['property']['profileInclusion']) => void;
  onApprove: () => void;
};

const formatFactValue = (
  fact: ReviewedFact,
  value: string | number | null,
  landUnit = fact.unit ?? 'm²',
): string => {
  if (value === null || value === '') return 'Not supplied';
  if (fact.key === 'landValue') return `${value} ${landUnit}`;
  return String(value);
};

const factStateLabel = (fact: ReviewedFact): string => {
  if (fact.state === 'confirmed') return 'Confirmed';
  if (fact.state === 'corrected') return 'Corrected';
  if (fact.state === 'conflict') return 'Conflict';
  return 'Needs review';
};

const claimStateLabel = (claim: ReviewedClaim): string => {
  if (claim.state === 'confirmed') return 'Confirmed';
  if (claim.state === 'corrected') return 'Corrected';
  if (claim.state === 'excluded') return 'Excluded';
  if (claim.state === 'conflict') return 'Conflict';
  return 'Needs review';
};

const PRODUCT_OPTIONS: CopywritingProductId[] = ['listing-copy', 'campaign-pack'];

const sharedProvenance = (items: readonly { provenance: string }[]): string | null => {
  const counts = new Map<string, number>();
  items.forEach(item => {
    const value = item.provenance.trim();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  const [mostCommon, count = 0] = [...counts.entries()].sort((left, right) => right[1] - left[1])[0] ?? [];
  return mostCommon && count > 1 ? mostCommon : null;
};

const contextPreview = (value: string, maximumLength = 110): string => {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (!compact) return 'Not supplied';
  return compact.length <= maximumLength ? compact : `${compact.slice(0, maximumLength - 1).trimEnd()}…`;
};

const agentFacingIssueText = (value: string): string => value
  .replace(/\blandValue\b/g, 'Land')
  .replace(/\bcarSpaces\b/g, 'Car spaces')
  .replace(/\bpropertyType\b/g, 'Property type');

type PropertyIssueDetails = {
  affectedItem?: unknown;
  approvedValue?: unknown;
  conflictingValue?: unknown;
  sourceContext?: unknown;
  resolution?: unknown;
};

const issueDetailText = (issue: ApprovedBriefBlocker): string => {
  const details = issue as ApprovedBriefBlocker & PropertyIssueDetails;
  const parts: string[] = [];
  if (details.affectedItem !== undefined) parts.push(`Affected item: ${propertyFactAgentLabel(String(details.affectedItem))}`);
  if (details.approvedValue !== undefined) parts.push(`Approved: ${String(details.approvedValue)}`);
  if (details.conflictingValue !== undefined) parts.push(`Conflicting claim: ${String(details.conflictingValue)}`);
  if (details.sourceContext !== undefined) parts.push(`Source: ${String(details.sourceContext)}`);
  if (details.resolution !== undefined) parts.push(`Resolve by: ${String(details.resolution)}`);
  return parts.map(agentFacingIssueText).join(' · ');
};

export const PropertyStage: React.FC<PropertyStageProps> = ({
  session,
  suggestions,
  activeSuggestionIndex,
  isSuggesting,
  isFetching,
  fetchError,
  hasFetchedDetails,
  propertyIssues,
  headingRef,
  onProductChange,
  onAddressChange,
  onAddressKeyDown,
  onSelectAddress,
  onFetch,
  onIncludeAddressChange,
  onConfirmFact,
  onConfirmAllFacts,
  onCorrectFact,
  onConfirmClaim,
  onConfirmAllClaims,
  canBulkConfirmClaim,
  onCorrectClaim,
  onExcludeClaim,
  onOverviewDecision,
  onProfileInclusionChange,
  onApprove,
}) => {
  const hasFetchedContext = hasFetchedDetails;
  const selectedAddressMatches = selectedPropertyAddressMatchesQuery(
    session.address.query,
    session.address.selectedLabel,
  );
  const addressState = derivePropertyAddressState({
    query: session.address.query,
    selectedLabel: session.address.selectedLabel,
    isFetching,
    fetchError,
    hasFetchedContext,
  });
  const readiness = derivePropertyReviewReadiness(session, propertyIssues);
  const confirmableFactCount = countBulkConfirmablePropertyFacts(session.property.facts);
  const confirmableClaimCount = countBulkConfirmablePropertyClaims(
    session.property.claims,
    canBulkConfirmClaim,
  );
  const factProvenance = sharedProvenance(session.property.facts);
  const claimProvenance = sharedProvenance(session.property.claims);
  const listboxId = 'property-address-suggestions';
  const addressInputId = 'property-address-input';
  const addressHelpId = 'fetch-details-reason';
  const addressErrorId = 'property-address-error';
  const productChoiceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const addressHelp = isSuggesting
    ? 'Looking for matching addresses…'
    : !session.product
      ? 'Choose Listing Copy or Campaign Pack, then select a suggested address.'
      : addressState === 'fetching'
        ? 'Fetching property details for the selected address…'
        : addressState === 'fetched'
          ? 'Property details fetched. Refetch only when you need to replace the current research.'
          : addressState === 'failed-retry'
            ? selectedAddressMatches
              ? 'Property details could not be fetched. The selected address is ready to retry.'
              : 'Address lookup failed. Try the address again.'
            : addressState === 'selected'
              ? 'Address selected. Fetch Details is ready.'
              : addressState === 'typed'
                ? 'Choose a suggested address before fetching property details.'
                : 'Start typing, then choose a suggested address.';

  const focusIssueTarget = (issue: ApprovedBriefBlocker) => {
    const target = document.getElementById(resolvePropertyBlockerTargetId(issue, session));
    if (!target) return;
    target.setAttribute('tabindex', '-1');
    target.focus();
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const handleProductKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') nextIndex = (index + 1) % PRODUCT_OPTIONS.length;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') nextIndex = (index - 1 + PRODUCT_OPTIONS.length) % PRODUCT_OPTIONS.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = PRODUCT_OPTIONS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    onProductChange(PRODUCT_OPTIONS[nextIndex]);
    productChoiceRefs.current[nextIndex]?.focus();
  };

  return (
    <div>
      <header className="stage-header">
        <div className="stage-header__copy">
          <h1 ref={headingRef} tabIndex={-1}>Property</h1>
          <p>Choose the campaign product, select a property, then approve the facts and claims that will guide the copy.</p>
        </div>
      </header>

      <div className="section-stack">
        <section className="surface" aria-labelledby="product-intent-title">
          <div className="surface__header">
            <div>
              <h2 id="product-intent-title">What are you creating?</h2>
              <p>Choose once. Campaign Pack includes Listing Copy and all 16 campaign outputs.</p>
            </div>
          </div>
          <div className="surface__body">
            <div className="product-choice-list" role="radiogroup" aria-label="Copywriting product">
              <button
                ref={element => { productChoiceRefs.current[0] = element; }}
                className="product-choice"
                data-selected={session.product === 'listing-copy'}
                role="radio"
                aria-checked={session.product === 'listing-copy'}
                tabIndex={!session.product || session.product === 'listing-copy' ? 0 : -1}
                type="button"
                onClick={() => onProductChange('listing-copy')}
                onKeyDown={event => handleProductKeyDown(event, 0)}
              >
                <span className="brand-mark" aria-hidden="true">L</span>
                <span>
                  <strong>Listing Copy</strong>
                  <span>Create the main property listing description.</span>
                </span>
              </button>
              <button
                ref={element => { productChoiceRefs.current[1] = element; }}
                className="product-choice"
                data-selected={session.product === 'campaign-pack'}
                role="radio"
                aria-checked={session.product === 'campaign-pack'}
                tabIndex={session.product === 'campaign-pack' ? 0 : -1}
                type="button"
                onClick={() => onProductChange('campaign-pack')}
                onKeyDown={event => handleProductKeyDown(event, 1)}
              >
                <span className="brand-mark" aria-hidden="true">C</span>
                <span>
                  <span className="product-choice__recommended">Recommended</span>
                  <strong>Campaign Pack</strong>
                  <span>Listing Copy plus 16 campaign outputs in one product.</span>
                </span>
              </button>
            </div>
          </div>
        </section>

        <section className="surface" aria-labelledby="property-address-title">
          <div className="surface__header">
            <div>
              <h2 id="property-address-title">Property address</h2>
              <p>Typed text and a selected suggestion are different. Fetch Details requires a selected suggestion.</p>
            </div>
          </div>
          <div className="surface__body section-stack">
            <div className="field combobox">
              <label htmlFor={addressInputId}>Australian property address</label>
              <div className="combobox__input-wrap">
                <input
                  id={addressInputId}
                  type="text"
                  role="combobox"
                  autoComplete="off"
                  aria-autocomplete="list"
                  aria-controls={listboxId}
                  aria-expanded={suggestions.length > 0}
                  aria-activedescendant={activeSuggestionIndex >= 0 && activeSuggestionIndex < suggestions.length ? `address-option-${activeSuggestionIndex}` : undefined}
                  aria-describedby={`${addressHelpId}${fetchError ? ` ${addressErrorId}` : ''}`}
                  aria-invalid={Boolean(fetchError)}
                  value={session.address.query}
                  onChange={event => onAddressChange(event.target.value)}
                  onKeyDown={onAddressKeyDown}
                  placeholder="Start typing a street address"
                />
                <button
                  className={`button ${hasFetchedContext ? 'button--secondary' : 'button--primary'}`}
                  type="button"
                  onClick={onFetch}
                  disabled={!session.product || !selectedAddressMatches || isFetching}
                  aria-describedby={`${addressHelpId}${hasFetchedContext ? ' refetch-details-consequence' : ''}`}
                >
                  {isFetching ? 'Fetching details…' : hasFetchedContext ? 'Refetch' : 'Fetch Details'}
                </button>
              </div>
              {suggestions.length > 0 ? (
                <ul className="combobox__list" role="listbox" id={listboxId}>
                  {suggestions.map((suggestion, index) => (
                    <li
                      className="combobox__option"
                      id={`address-option-${index}`}
                      key={suggestion}
                      role="option"
                      aria-selected={activeSuggestionIndex === index}
                      onMouseDown={event => {
                        event.preventDefault();
                        onSelectAddress(suggestion);
                      }}
                    >
                      {suggestion}
                    </li>
                  ))}
                </ul>
              ) : null}
              <small id={addressHelpId}>{addressHelp}</small>
              {hasFetchedContext ? (
                <small id="refetch-details-consequence">Refetch replaces returned research and source fact values. Review and reapprove changes before using current outputs.</small>
              ) : null}
            </div>

            {selectedAddressMatches ? (
              <div className="selected-address">
                {addressState === 'fetched'
                  ? 'Property details fetched'
                  : addressState === 'failed-retry'
                    ? 'Fetch needs retry'
                    : 'Selected property'} · {session.address.selectedLabel}
              </div>
            ) : null}

            <label className="choice" data-selected={session.address.includeInCopy}>
              <input
                type="checkbox"
                checked={session.address.includeInCopy}
                onChange={event => onIncludeAddressChange(event.target.checked)}
              />
              <span>
                <strong>Include the property address in generated copy</strong>
                <span>The selected address always identifies this temporary campaign; this policy controls generated wording.</span>
              </span>
            </label>

            {isFetching ? (
              <div className="progress-region" role="status" aria-live="polite">
                <div className="progress-region__header"><strong>Fetching property details</strong><span>Researching selected address</span></div>
                <div className="progress-track"><span style={{ width: '42%' }} /></div>
              </div>
            ) : null}
            {fetchError ? (
              <div className="notice" data-tone="risk" role="alert" id={addressErrorId}>
                <div><strong>Fetch Details failed</strong><p>{fetchError} Existing reviewed values were kept.</p></div>
              </div>
            ) : null}
          </div>
        </section>

        {hasFetchedContext ? (
          <>
            <section className="surface" aria-labelledby="core-facts-title">
              <div className="surface__header">
                <div>
                  <h2 id="core-facts-title">Core facts</h2>
                  <p>Approved values are dominant. Source values remain inspectable when corrected.</p>
                  {factProvenance ? <p>Primary source · {factProvenance}. Exceptions retain their own source below.</p> : null}
                </div>
                {confirmableFactCount > 0 ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    aria-label={`Confirm all ${confirmableFactCount} unresolved Core Facts`}
                    onClick={onConfirmAllFacts}
                  >
                    Confirm all ({confirmableFactCount})
                  </button>
                ) : null}
              </div>
              <div>
                {session.property.facts.map(fact => {
                  const hasDistinctProvenance = Boolean(
                    fact.provenance.trim()
                    && fact.provenance.trim() !== factProvenance,
                  );
                  return (
                  <StatusRow
                    key={fact.key}
                    id={propertyFactTargetId(fact.key)}
                    state={fact.state}
                    stateLabel={factStateLabel(fact)}
                    title={<><span>{fact.label}</span><span className="fact-value">{formatFactValue(fact, fact.approvedValue)}</span></>}
                    meta={fact.state === 'corrected'
                      || fact.sourceValue !== fact.approvedValue
                      || (fact.key === 'landValue' && (fact.sourceUnit ?? 'm²') !== (fact.unit ?? 'm²'))
                      ? <>
                          Source: <span className="fact-source">{formatFactValue(fact, fact.sourceValue, fact.sourceUnit ?? 'm²')}</span>
                          {hasDistinctProvenance ? <> · {fact.provenance}</> : null}
                        </>
                      : hasDistinctProvenance ? fact.provenance : undefined}
                    actions={(
                      <>
                        {fact.state === 'needs-review' ? <button className="row-action" type="button" aria-label={`Confirm ${fact.label}: ${formatFactValue(fact, fact.approvedValue)}`} onClick={() => onConfirmFact(fact)}>Confirm</button> : null}
                        <button className="row-action" type="button" aria-label={`Correct ${fact.label}: ${formatFactValue(fact, fact.approvedValue)}`} onClick={() => onCorrectFact(fact)}>Correct</button>
                      </>
                    )}
                  />
                );})}
              </div>
            </section>

            <section className="surface" aria-labelledby="property-claims-title">
              <div className="surface__header">
                <div>
                  <h2 id="property-claims-title">Material claims</h2>
                  <p>Only confirmed or corrected claims enter the Reviewed Campaign Brief. Exclusions apply to every suggestion and output.</p>
                  {claimProvenance ? <p>Primary source · {claimProvenance}. Exceptions retain their own source below.</p> : null}
                </div>
                {confirmableClaimCount > 0 ? (
                  <button
                    className="button button--secondary"
                    type="button"
                    aria-label={`Confirm all ${confirmableClaimCount} unresolved Material Claims`}
                    onClick={onConfirmAllClaims}
                  >
                    Confirm all ({confirmableClaimCount})
                  </button>
                ) : null}
              </div>
              <div>
                {session.property.claims.length > 0 ? session.property.claims.map(claim => {
                  const hasDistinctProvenance = Boolean(
                    claim.provenance.trim()
                    && claim.provenance.trim() !== claimProvenance,
                  );
                  return (
                  <StatusRow
                    key={claim.id}
                    id={propertyClaimTargetId(claim.id)}
                    state={claim.state}
                    stateLabel={claimStateLabel(claim)}
                    title={claim.approvedText || claim.sourceText}
                    meta={claim.state === 'excluded'
                      ? `${hasDistinctProvenance ? `${claim.provenance} · ` : ''}Excluded from Campaign Direction, Listing Copy and Campaign Pack outputs.`
                      : claim.state === 'corrected'
                        ? `Source: ${claim.sourceText}${hasDistinctProvenance ? ` · ${claim.provenance}` : ''}`
                        : hasDistinctProvenance ? claim.provenance : undefined}
                    actions={claim.state === 'excluded' ? (
                      <button
                        className="row-action"
                        type="button"
                        aria-label={`Review exclusion for claim: ${claim.approvedText || claim.sourceText}`}
                        onClick={() => onCorrectClaim(claim)}
                      >
                        Review exclusion
                      </button>
                    ) : (
                      <>
                        {claim.state === 'needs-review' ? <button className="row-action" type="button" aria-label={`Confirm claim: ${claim.approvedText || claim.sourceText}`} onClick={() => onConfirmClaim(claim)}>Confirm</button> : null}
                        <button className="row-action" type="button" aria-label={`Correct claim: ${claim.approvedText || claim.sourceText}`} onClick={() => onCorrectClaim(claim)}>Correct</button>
                        <button className="row-action" type="button" aria-label={`Exclude claim: ${claim.approvedText || claim.sourceText}`} onClick={() => onExcludeClaim(claim)}>Exclude</button>
                      </>
                    )}
                  />
                );}) : (
                  <div className="surface__body"><p className="field-help">No material sourced claims were returned.</p></div>
                )}
              </div>
            </section>

            <section className="surface" aria-labelledby="property-context-title">
              <div className="surface__header">
                <div><h2 id="property-context-title">Property and location context</h2><p>Confirm the overview and choose exactly which fetched location context may enter generation.</p></div>
              </div>
              {session.property.overview || session.property.overviewState === 'confirmed' ? (
                <StatusRow
                  id="property-overview-row"
                  state={!session.property.overview && session.property.overviewState === 'confirmed' ? 'conflict' : session.property.overviewState}
                  stateLabel={!session.property.overview && session.property.overviewState === 'confirmed' ? 'Needs attention' : session.property.overviewState === 'confirmed' ? 'Confirmed' : session.property.overviewState === 'excluded' ? 'Excluded' : 'Needs review'}
                  title={session.property.overview ? 'Property overview' : 'Property overview · Not supplied'}
                  meta="The selected overview decision applies to Listing Copy and Campaign Pack outputs."
                  actions={(
                    <>
                      {session.property.overviewState !== 'confirmed' ? <button className="row-action" type="button" aria-label="Confirm property overview" onClick={() => onOverviewDecision('confirmed')}>Confirm</button> : null}
                      {session.property.overviewState !== 'excluded' ? <button className="row-action" type="button" aria-label="Exclude property overview" onClick={() => onOverviewDecision('excluded')}>Exclude</button> : null}
                    </>
                  )}
                />
              ) : null}
              <details className="disclosure" open={!session.property.approved}>
                <summary>
                  <span><span aria-hidden="true">▾</span> Property overview · {contextPreview(session.property.overview)}</span>
                  <span>{session.property.overview ? (session.property.overviewState === 'excluded' ? 'Not included' : session.property.overviewState === 'confirmed' ? 'Confirmed' : 'Needs review') : 'Not supplied'}</span>
                </summary>
                <div className="disclosure__body">{session.property.overview || 'No property overview returned.'}</div>
              </details>
              <details className="disclosure" id="suburb-context-disclosure">
                <summary>
                  <span><span aria-hidden="true">▾</span> Suburb context · {contextPreview(session.property.suburbContext)}</span>
                  <span>{session.property.suburbContext ? (session.property.profileInclusion === 'suburb' || session.property.profileInclusion === 'both' ? 'Included' : 'Available') : 'Not supplied'}</span>
                </summary>
                <div className="disclosure__body">{session.property.suburbContext || 'No suburb context returned.'}</div>
              </details>
              <details className="disclosure" id="area-context-disclosure">
                <summary>
                  <span><span aria-hidden="true">▾</span> Area context · {contextPreview(session.property.areaContext)}</span>
                  <span>{session.property.areaContext ? (session.property.profileInclusion === 'area' || session.property.profileInclusion === 'both' ? 'Included' : 'Available') : 'Not supplied'}</span>
                </summary>
                <div className="disclosure__body">{session.property.areaContext || 'No area context returned.'}</div>
              </details>
              <div className="surface__body" style={{ paddingTop: 18 }}>
                <label className="field">
                  <span>Location context included in copy</span>
                  <select
                    value={session.property.profileInclusion}
                    onChange={event => onProfileInclusionChange(event.target.value as CampaignSessionState['property']['profileInclusion'])}
                  >
                    <option value="none">None</option>
                    <option value="suburb" disabled={!session.property.suburbContext}>Suburb only</option>
                    <option value="area" disabled={!session.property.areaContext}>Area only</option>
                    <option value="both" disabled={!session.property.suburbContext || !session.property.areaContext}>Suburb and area</option>
                  </select>
                  <small>Expand either context above to read the full fetched source before including it.</small>
                </label>
              </div>
            </section>

            {readiness.issues.length > 0 ? (
              <section className="surface" aria-labelledby="property-issues-title">
                <div className="surface__header">
                  <div>
                    <h2 id="property-issues-title">Property decisions to resolve</h2>
                    <p>{readiness.unresolvedActionCount} user decision{readiness.unresolvedActionCount === 1 ? '' : 's'} {readiness.unresolvedActionCount === 1 ? 'remains' : 'remain'} before approval.</p>
                  </div>
                </div>
                <div>
                  {readiness.issues.map(issue => {
                    const details = issueDetailText(issue);
                    return (
                      <div className="status-row" data-state="failed" key={`${issue.id}-${issue.message}`}>
                        <div>
                          <div className="status-row__title">{agentFacingIssueText(issue.message)}</div>
                          {details ? <div className="status-row__meta">{details}</div> : null}
                        </div>
                        <div className="status-row__actions">
                          <span className="status-row__state">Needs attention</span>
                          <button className="row-action" type="button" aria-label={getPropertyBlockerReviewAccessibleName(issue, session)} onClick={() => focusIssueTarget(issue)}>Review</button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {!session.property.approved ? (
              <div className="action-row">
                <button
                  className="button button--secondary"
                  id="property-approval-action"
                  type="button"
                  onClick={onApprove}
                  disabled={!readiness.canApprove}
                  title={readiness.issues[0] ? agentFacingIssueText(readiness.issues[0].message) : undefined}
                  aria-describedby={!readiness.canApprove ? 'property-approval-reason' : undefined}
                >
                  Approve property facts
                </button>
                {!readiness.canApprove ? (
                  <span className="disabled-reason" id="property-approval-reason">
                    Resolve the listed Property decisions before approval.
                  </span>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
};
