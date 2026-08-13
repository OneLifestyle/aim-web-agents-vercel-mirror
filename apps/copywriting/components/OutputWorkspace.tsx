import React from 'react';
import type { CampaignOutputDocument, PreviewTab } from '../types';
import type { CampaignSessionState } from '../domain/sessionState';
import type { DerivedCampaignPackState } from '../domain/outputIntegrity';
import {
  CANONICAL_OUTPUT_GROUPS,
  OUTPUT_PRESENTATION_BY_ID,
} from '../domain/outputInventory';
import { deriveOutputRegenerationAction } from '../utils/outputActions';
import { DocumentBody } from './DocumentBody';

type DocumentNavigatorListProps = {
  outputs: CampaignSessionState['outputs'];
  activeOutputId: PreviewTab;
  product?: CampaignSessionState['product'];
  onSelect: (outputId: PreviewTab) => void;
};

const outputStateLabel = (document: CampaignOutputDocument): string => {
  if (document.state === 'not-generated') return 'Not generated';
  if (document.state === 'queued') return 'Queued';
  if (document.state === 'generating') return 'Generating';
  if (document.state === 'ready') return 'Ready';
  if (document.state === 'needs-review') return 'Review required';
  if (document.state === 'needs-regeneration') return 'Brief changed';
  return 'Failed';
};

const GOVERNING_ITEM_LABELS: Readonly<Record<string, string>> = {
  landValue: 'Land',
  bedrooms: 'Bedrooms',
  bathrooms: 'Bathrooms',
  carSpaces: 'Car spaces',
  propertyType: 'Property type',
  'Listing Copy foundation': 'Listing Copy',
};

const governingItemLabel = (value: string): string => {
  if (GOVERNING_ITEM_LABELS[value]) return GOVERNING_ITEM_LABELS[value];
  if (/^brief[-.]/i.test(value)) return 'Reviewed Brief';
  if (/^(?:claim|highlight|photo)\./i.test(value)) return 'Reviewed property or photo detail';
  return value;
};

const userFacingIssueMessage = (message: string, governingItem: string): string => {
  const labelledMessage = governingItem
    ? message.replaceAll(governingItem, governingItemLabel(governingItem))
    : message;
  return labelledMessage
    .replaceAll('landValue', 'Land')
    .replaceAll('Approved Brief Snapshot', 'approved brief')
    .replaceAll('Listing Copy foundation', 'Listing Copy');
};

const handleDisclosureKeyDown: React.KeyboardEventHandler<HTMLElement> = event => {
  if (event.key !== 'Enter' && event.key !== ' ') return;

  event.preventDefault();
  const disclosure = event.currentTarget.closest('details');
  if (disclosure) disclosure.open = !disclosure.open;
};

export const DocumentNavigatorList: React.FC<DocumentNavigatorListProps> = ({
  outputs,
  activeOutputId,
  product,
  onSelect,
}) => {
  const groups = product === 'listing-copy'
    ? CANONICAL_OUTPUT_GROUPS.filter(group => group.id === 'foundation')
    : CANONICAL_OUTPUT_GROUPS;

  return (
    <>
    {groups.map(group => (
      <details className="document-nav__group" key={group.id} open>
        <summary onKeyDown={handleDisclosureKeyDown}><span>{group.label}</span><span>{group.countLabel}</span></summary>
        <ul>
          {group.outputIds.map(outputId => {
            const document = outputs[outputId];
            return (
              <li key={outputId}>
                <button
                  className="document-nav__item"
                  data-state={document.state}
                  type="button"
                  aria-current={activeOutputId === outputId ? 'page' : undefined}
                  onClick={() => onSelect(outputId)}
                  onKeyDown={event => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    onSelect(outputId);
                  }}
                >
                  <span>{OUTPUT_PRESENTATION_BY_ID[outputId].label}</span>
                  <span className="document-nav__state">{outputStateLabel(document)}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </details>
    ))}
    </>
  );
};

type OutputWorkspaceProps = {
  session: CampaignSessionState;
  activeOutputId: PreviewTab;
  packState: DerivedCampaignPackState;
  copyStatus: string | null;
  notice?: string | null;
  onDismissNotice?: () => void;
  headingRef?: React.Ref<HTMLHeadingElement>;
  onSelectOutput: (outputId: PreviewTab) => void;
  onOpenNavigator: () => void;
  onOpenBrief: () => void;
  onPrevious?: () => void;
  onOpenExport: () => void;
  onGenerateListing: () => void;
  onGeneratePack: () => void;
  onRetryPack: () => void;
  onRegenerate: () => void;
  onCopy: () => void;
};

export const OutputWorkspace: React.FC<OutputWorkspaceProps> = ({
  session,
  activeOutputId,
  packState,
  copyStatus,
  notice = null,
  onDismissNotice,
  headingRef,
  onSelectOutput,
  onOpenNavigator,
  onOpenBrief,
  onPrevious,
  onOpenExport,
  onGenerateListing,
  onGeneratePack,
  onRetryPack,
  onRegenerate,
  onCopy,
}) => {
  const document = session.outputs[activeOutputId];
  const presentation = OUTPUT_PRESENTATION_BY_ID[activeOutputId];
  const hasContent = Boolean(document.content.trim());
  const isListing = activeOutputId === 'Full Copy';
  const listing = session.outputs['Full Copy'];
  const isBusy = document.state === 'generating' || document.state === 'queued';
  const isPackGenerating = packState.state === 'generating';
  const regenerationAction = deriveOutputRegenerationAction(document);
  const regenerationDisabled = isBusy || isPackGenerating || !session.brief.approved;
  const canCopy = document.state === 'ready'
    && Boolean(session.brief.snapshot)
    && document.boundSnapshotId === session.brief.snapshot?.snapshotId
    && document.integrityIssues.length === 0;
  const canGeneratePack = session.product === 'campaign-pack'
    && listing.state === 'ready'
    && packState.state === 'idle';
  const packReadyCount = packState.readyOutputIds.length;
  const packFailureCount = packState.failedOutputIds.length;
  const packBlockedCount = packState.blockedOutputIds.length;
  const packStaleCount = packState.staleOutputIds.length;
  const packRemainingCount = packState.missingOutputIds.length + packState.inProgressOutputIds.length;
  const packProgressLabel = [
    `${packReadyCount} of 16 ready`,
    packFailureCount > 0 ? `${packFailureCount} failed` : null,
    packBlockedCount > 0 ? `${packBlockedCount} blocked` : null,
    packStaleCount > 0 ? `${packStaleCount} need updating` : null,
    `${packRemainingCount} remaining`,
  ].filter(Boolean).join(' · ');
  const approvedSnapshot = session.brief.snapshot;
  const agentLabel = approvedSnapshot?.agentContext.included
    ? [approvedSnapshot.agentContext.name, approvedSnapshot.agentContext.title].filter(Boolean).join(' · ')
    : '';
  const agencyLabel = approvedSnapshot?.agencyContext.included ? approvedSnapshot.agencyContext.name : '';
  const groupLabel = CANONICAL_OUTPUT_GROUPS.find(group => group.id === presentation.groupId)?.label ?? 'Campaign output';

  return (
    <div className="output-layout">
      <nav className="document-nav" aria-label={session.product === 'listing-copy' ? 'Listing document' : 'Campaign documents'}>
        <div className="document-nav__header">
          <h2>{session.product === 'listing-copy' ? 'Listing document' : 'Campaign documents'}</h2>
          <p>{session.product === 'listing-copy' ? 'Listing Copy · 1 document' : 'Listing Copy + 16 campaign outputs'}</p>
        </div>
        <DocumentNavigatorList outputs={session.outputs} activeOutputId={activeOutputId} product={session.product} onSelect={onSelectOutput} />
      </nav>

      <main className="document-workspace" id="main-content">
        <div className="document-toolbar">
          <div className="document-toolbar__identity">
            <strong>{presentation.label}</strong>
            <span>Generated draft · Read-only · {outputStateLabel(document)}</span>
          </div>
          <button className="button button--secondary mobile-only" type="button" onClick={onOpenNavigator}>Documents</button>
          <div className="document-toolbar__actions">
            {onPrevious ? <button className="button button--quiet" type="button" onClick={onPrevious}>Previous: Reviewed Brief</button> : null}
            <button className="button button--quiet" type="button" onClick={onOpenBrief}>Review brief</button>
            {regenerationAction.visible ? (
              <button className="button button--secondary" type="button" aria-label={regenerationAction.accessibleName} onClick={onRegenerate} disabled={regenerationDisabled}>Regenerate</button>
            ) : null}
            <button className="button button--secondary" type="button" aria-label={`Copy ${presentation.label}`} onClick={onCopy} disabled={!canCopy} aria-describedby={!canCopy ? 'copy-disabled-reason' : undefined}>Copy</button>
            <button className="button button--primary" type="button" aria-label={`Open export options for ${presentation.label}`} onClick={onOpenExport}>Export</button>
          </div>
        </div>

        <div className="document-canvas">
          {notice ? (
            <div className="notice output-notice" role="status" aria-live="polite">
              <div><strong>Campaign update</strong><p>{notice}</p></div>
              {onDismissNotice ? <button className="row-action" type="button" aria-label="Dismiss campaign update" onClick={onDismissNotice}>Dismiss</button> : null}
            </div>
          ) : null}

          {session.product === 'campaign-pack' && (packState.state !== 'idle' || listing.state === 'ready') ? (
            <section className="surface pack-summary" aria-labelledby="pack-progress-title">
              <div className="surface__body" style={{ paddingTop: 18 }}>
                <div className="pack-summary__line">
                  <div><strong id="pack-progress-title">Campaign Pack · 16</strong><div>{packProgressLabel}</div></div>
                  {packState.state === 'generating' ? <span role="status" aria-live="polite">Generating {session.pack.currentOutputId ? OUTPUT_PRESENTATION_BY_ID[session.pack.currentOutputId].label : 'campaign output'}…</span> : null}
                  {canGeneratePack ? <button className="button button--primary" type="button" onClick={onGeneratePack}>Generate 16 campaign outputs</button> : null}
                  {packState.retryOutputIds.length > 0 && packState.state !== 'generating' && packState.state !== 'idle' ? <button className="button button--secondary" type="button" onClick={onRetryPack}>Retry remaining outputs</button> : null}
                </div>
                {packState.state === 'generating' ? <div className="progress-track" aria-hidden="true"><span style={{ width: `${Math.round((packReadyCount / 16) * 100)}%` }} /></div> : null}
              </div>
            </section>
          ) : null}

          {hasContent ? (
            <article className="document-sheet">
              <p className="document-kicker">{isListing ? 'Listing Copy' : groupLabel}</p>
              <h1 ref={headingRef} tabIndex={-1}>{presentation.label}</h1>
              <div className="document-metadata">
                <span>Generated draft · Read-only</span>
                <span>{approvedSnapshot?.selectedAddress || session.address.selectedLabel || session.address.query || 'Property address not supplied'}</span>
                {agentLabel ? <span>{agentLabel}</span> : null}
                {agencyLabel ? <span>{agencyLabel}</span> : null}
                <span>{outputStateLabel(document)}</span>
                {document.generatedAt ? <span>Created {new Date(document.generatedAt).toLocaleString('en-AU')}</span> : null}
                <span>Regeneration replaces this draft; previous drafts are not kept as versions</span>
              </div>
              {document.integrityIssues.length > 0 ? (
                <div className="notice" data-tone="risk" role="alert">
                  <div>
                    <strong>Review required</strong>
                    {document.integrityIssues.map(issue => <p key={`${issue.code}-${issue.governingBriefItem}`}>{userFacingIssueMessage(issue.message, issue.governingBriefItem)} Review: {governingItemLabel(issue.governingBriefItem)}.</p>)}
                  </div>
                </div>
              ) : null}
              {document.state === 'failed' ? <div className="notice" data-tone="risk" role="alert"><div><strong>Generation failed</strong><p>{document.error || 'Replacement content was not generated.'} The existing draft remains visible for inspection only.</p></div></div> : null}
              {document.state === 'needs-regeneration' ? <div className="notice" data-tone="review"><div><strong>Brief changed</strong><p>This draft was created from an earlier reviewed brief. Regenerate to replace the current draft before copying or exporting. Previous drafts are not kept as versions.</p></div></div> : null}
              <DocumentBody content={document.content} />
            </article>
          ) : (
            <section className="document-empty">
              <p className="document-kicker">{isListing ? 'Listing Copy' : groupLabel}</p>
              <h1 ref={headingRef} tabIndex={-1}>{presentation.label}</h1>
              <p>{isListing
                ? 'Generate a read-only Listing Copy draft from the approved brief.'
                : 'This document has not been generated. Selecting it never starts generation.'}</p>
              {isListing ? <button className="button button--primary" type="button" onClick={onGenerateListing} disabled={!session.brief.approved || isBusy}>{isBusy ? 'Generating Listing Copy…' : 'Generate Listing Copy'}</button> : null}
              {document.state === 'failed' ? <div className="notice" data-tone="risk" role="alert"><div><strong>Generation failed</strong><p>{document.error || 'Content was not generated.'}</p></div></div> : null}
            </section>
          )}
        </div>

        <div className="document-mobile-actions mobile-only">
          {hasContent ? (
            <>
              {onPrevious ? <button className="button button--secondary" type="button" aria-label="Previous: Reviewed Brief" onClick={onPrevious}>Previous</button> : null}
              {regenerationAction.visible ? <button className="button button--secondary" type="button" aria-label={regenerationAction.accessibleName} onClick={onRegenerate} disabled={regenerationDisabled}>Regenerate</button> : null}
              <button className="button button--secondary" type="button" aria-label={`Copy ${presentation.label}`} onClick={onCopy} disabled={!canCopy} aria-describedby={!canCopy ? 'copy-disabled-reason' : undefined}>Copy</button>
              <button className="button button--primary" type="button" aria-label={`Open export options for ${presentation.label}`} onClick={onOpenExport}>Export</button>
            </>
          ) : (
            <>
              <button className="button button--secondary" type="button" onClick={onPrevious ?? onOpenBrief}>{onPrevious ? 'Reviewed Brief' : 'Review brief'}</button>
              <button className="button button--primary" type="button" onClick={isListing ? onGenerateListing : onOpenNavigator} disabled={isListing && (!session.brief.approved || isBusy)}>{isListing ? 'Generate' : 'Documents'}</button>
            </>
          )}
        </div>
        {!canCopy ? <span className="sr-only" id="copy-disabled-reason">Copy is available when this document is ready and matches the approved brief.</span> : null}
        <div className="sr-only" role="status" aria-live="polite">{copyStatus}</div>
      </main>
    </div>
  );
};
