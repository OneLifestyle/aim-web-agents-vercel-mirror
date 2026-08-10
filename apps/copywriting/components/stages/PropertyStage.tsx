import React, { useRef } from 'react';
import type { CopywritingProductId, ReviewedClaim, ReviewedFact } from '../../types';
import type { CampaignSessionState } from '../../domain/sessionState';
import { StatusRow } from '../StatusRow';

type PropertyStageProps = {
  session: CampaignSessionState;
  suggestions: string[];
  activeSuggestionIndex: number;
  isSuggesting: boolean;
  isFetching: boolean;
  fetchError: string | null;
  headingRef: React.Ref<HTMLHeadingElement>;
  onProductChange: (product: CopywritingProductId) => void;
  onAddressChange: (value: string) => void;
  onAddressKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  onSelectAddress: (address: string) => void;
  onFetch: () => void;
  onIncludeAddressChange: (included: boolean) => void;
  onConfirmFact: (fact: ReviewedFact) => void;
  onCorrectFact: (fact: ReviewedFact) => void;
  onConfirmClaim: (claim: ReviewedClaim) => void;
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

export const PropertyStage: React.FC<PropertyStageProps> = ({
  session,
  suggestions,
  activeSuggestionIndex,
  isSuggesting,
  isFetching,
  fetchError,
  headingRef,
  onProductChange,
  onAddressChange,
  onAddressKeyDown,
  onSelectAddress,
  onFetch,
  onIncludeAddressChange,
  onConfirmFact,
  onCorrectFact,
  onConfirmClaim,
  onCorrectClaim,
  onExcludeClaim,
  onOverviewDecision,
  onProfileInclusionChange,
  onApprove,
}) => {
  const hasFetchedContext = session.property.overview || session.property.claims.length > 0 || session.property.facts.some(fact => fact.sourceValue !== null && fact.sourceValue !== '');
  const selectedAddressMatches = Boolean(
    session.address.selectedLabel &&
    session.address.selectedLabel.trim().toLocaleLowerCase('en-AU') === session.address.query.trim().toLocaleLowerCase('en-AU'),
  );
  const hasUnresolved = session.property.facts.some(fact => fact.state === 'needs-review' || fact.state === 'conflict' || fact.approvedValue === null || fact.approvedValue === '')
    || session.property.claims.some(claim => claim.state === 'needs-review' || claim.state === 'conflict')
    || (Boolean(session.property.overview.trim()) && session.property.overviewState === 'needs-review');
  const listboxId = 'property-address-suggestions';
  const addressInputId = 'property-address-input';
  const addressHelpId = 'fetch-details-reason';
  const addressErrorId = 'property-address-error';
  const productChoiceRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const addressHelp = isSuggesting
    ? 'Looking for matching addresses…'
    : !session.product
      ? 'Choose Listing Copy or Campaign Pack, then select a suggested address.'
      : selectedAddressMatches
        ? 'Selected suggestion is ready for Fetch Details.'
        : 'Select a suggested address before fetching property details.';

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
          <p>Choose the campaign product, select a property, then approve the facts and claims that will govern the copy.</p>
        </div>
      </header>

      <div className="section-stack">
        <section className="surface" aria-labelledby="product-intent-title">
          <div className="surface__header">
            <div>
              <h2 id="product-intent-title">What are you creating?</h2>
              <p>Choose once. Campaign Pack includes the Listing Copy foundation and all 16 campaign outputs.</p>
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
                  <span>One primary property document · lower-cost entry product.</span>
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
                  <span>Listing Copy foundation + 16 campaign outputs in one product.</span>
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
                <small id="refetch-details-consequence">Refetch replaces returned research and source fact values. Review and reapprove governed changes before using current outputs.</small>
              ) : null}
            </div>

            {selectedAddressMatches ? (
              <div className="selected-address">Selected property · {session.address.selectedLabel}</div>
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
                </div>
              </div>
              <div>
                {session.property.facts.map(fact => (
                  <StatusRow
                    key={fact.key}
                    state={fact.state}
                    stateLabel={factStateLabel(fact)}
                    title={<><span>{fact.label}</span><span className="fact-value">{formatFactValue(fact, fact.approvedValue)}</span></>}
                    meta={fact.state === 'corrected' || fact.sourceValue !== fact.approvedValue
                      ? <>Source: <span className="fact-source">{formatFactValue(fact, fact.sourceValue, fact.sourceUnit ?? 'm²')}</span> · {fact.provenance}</>
                      : fact.provenance}
                    actions={(
                      <>
                        {fact.state === 'needs-review' ? <button className="row-action" type="button" aria-label={`Confirm ${fact.label}: ${formatFactValue(fact, fact.approvedValue)}`} onClick={() => onConfirmFact(fact)}>Confirm</button> : null}
                        <button className="row-action" type="button" aria-label={`Correct ${fact.label}: ${formatFactValue(fact, fact.approvedValue)}`} onClick={() => onCorrectFact(fact)}>Correct</button>
                      </>
                    )}
                  />
                ))}
              </div>
            </section>

            <section className="surface" aria-labelledby="property-claims-title">
              <div className="surface__header">
                <div>
                  <h2 id="property-claims-title">Material claims</h2>
                  <p>Only confirmed or corrected claims enter the Reviewed Campaign Brief. Exclusions govern every suggestion and output.</p>
                </div>
              </div>
              <div>
                {session.property.claims.length > 0 ? session.property.claims.map(claim => (
                  <StatusRow
                    key={claim.id}
                    state={claim.state}
                    stateLabel={claimStateLabel(claim)}
                    title={claim.approvedText || claim.sourceText}
                    meta={claim.state === 'excluded'
                      ? `${claim.provenance} · Enforced in Campaign Direction, Listing Copy and all 16 Campaign Pack outputs.`
                      : claim.state === 'corrected'
                        ? `Source: ${claim.sourceText} · ${claim.provenance}`
                        : claim.provenance}
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
                )) : (
                  <div className="surface__body"><p className="field-help">No material sourced claims were returned.</p></div>
                )}
              </div>
            </section>

            <section className="surface" aria-labelledby="property-context-title">
              <div className="surface__header">
                <div><h2 id="property-context-title">Property and location context</h2><p>Confirm the overview and choose exactly which fetched location context may enter generation.</p></div>
              </div>
              {session.property.overview ? (
                <StatusRow
                  state={session.property.overviewState}
                  stateLabel={session.property.overviewState === 'confirmed' ? 'Confirmed' : session.property.overviewState === 'excluded' ? 'Excluded' : 'Needs review'}
                  title="Property overview"
                  meta="Property research · selected overview policy applies to Listing Copy and every Campaign Pack output."
                  actions={(
                    <>
                      {session.property.overviewState !== 'confirmed' ? <button className="row-action" type="button" aria-label="Confirm property overview" onClick={() => onOverviewDecision('confirmed')}>Confirm</button> : null}
                      {session.property.overviewState !== 'excluded' ? <button className="row-action" type="button" aria-label="Exclude property overview" onClick={() => onOverviewDecision('excluded')}>Exclude</button> : null}
                    </>
                  )}
                />
              ) : null}
              <details className="disclosure" open={!session.property.approved}>
                <summary>Property overview source <span>{session.property.overview ? (session.property.overviewState === 'excluded' ? 'Not included' : session.property.overviewState === 'confirmed' ? 'Confirmed' : 'Needs review') : 'Not supplied'}</span></summary>
                <div className="disclosure__body">{session.property.overview || 'No property overview returned.'}</div>
              </details>
              <details className="disclosure">
                <summary>Suburb context <span>{session.property.suburbContext ? 'Available' : 'Not supplied'}</span></summary>
                <div className="disclosure__body">{session.property.suburbContext || 'No suburb context returned.'}</div>
              </details>
              <details className="disclosure">
                <summary>Area context <span>{session.property.areaContext ? 'Available' : 'Not supplied'}</span></summary>
                <div className="disclosure__body">{session.property.areaContext || 'No area context returned.'}</div>
              </details>
              <div className="surface__body" style={{ paddingTop: 18 }}>
                <fieldset className="fieldset">
                  <legend><strong>Location context included in copy</strong></legend>
                  <div className="photo-policy">
                    {([
                      ['none', 'None', 'No suburb or broader-area context enters generation.'],
                      ['suburb', 'Suburb only', 'Use the fetched suburb context only.'],
                      ['area', 'Area only', 'Use the fetched broader-area context only.'],
                      ['both', 'Suburb and area', 'Use both fetched location contexts.'],
                    ] as const).map(([value, label, description]) => {
                      const unavailable = (value === 'suburb' && !session.property.suburbContext)
                        || (value === 'area' && !session.property.areaContext)
                        || (value === 'both' && (!session.property.suburbContext || !session.property.areaContext));
                      return (
                        <label className="photo-policy__option" data-selected={session.property.profileInclusion === value} key={value}>
                          <input type="radio" name="profile-inclusion" value={value} checked={session.property.profileInclusion === value} disabled={unavailable} onChange={() => onProfileInclusionChange(value)} />
                          <span><strong>{label}</strong><span>{description}{unavailable ? ' Not available from this fetch.' : ''}</span></span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </section>

            <div className="action-row">
              <button className="button button--primary" type="button" onClick={onApprove} disabled={hasUnresolved} aria-describedby={hasUnresolved ? 'property-approval-reason' : undefined}>
                Approve property facts
              </button>
              {hasUnresolved ? <span className="disabled-reason" id="property-approval-reason">Resolve every required fact, material claim and property overview decision before approval.</span> : null}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};
