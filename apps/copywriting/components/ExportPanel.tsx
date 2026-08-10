import React from 'react';
import {
  GUIDED_EXPORT_FORMATS,
  type GuidedExportFormat,
  type GuidedExportPlan,
  type GuidedExportReceipt,
  type GuidedExportScope,
} from '../utils/guidedExport';

type ExportPanelProps = {
  plan: GuidedExportPlan;
  scope: GuidedExportScope;
  format: GuidedExportFormat;
  includeContactDetails: boolean;
  receipt: GuidedExportReceipt | null;
  campaignPackAvailable?: boolean;
  onScopeChange: (scope: GuidedExportScope) => void;
  onFormatChange: (format: GuidedExportFormat) => void;
  onContactDetailsChange: (included: boolean) => void;
  onExport: () => void;
};

const scopeOptions: Array<{ id: GuidedExportScope; label: string; description: string }> = [
  { id: 'current_output', label: 'Current document', description: 'Only the document open in the reader.' },
  { id: 'current_group', label: 'Current group', description: 'Eligible generated documents in this navigator group.' },
  { id: 'campaign_pack', label: 'Full campaign document', description: 'Eligible generated Listing Copy and Campaign Pack documents together.' },
];

export const ExportPanel: React.FC<ExportPanelProps> = ({
  plan,
  scope,
  format,
  includeContactDetails,
  receipt,
  campaignPackAvailable = true,
  onScopeChange,
  onFormatChange,
  onContactDetailsChange,
  onExport,
}) => {
  const visibleScopeOptions = campaignPackAvailable
    ? scopeOptions
    : scopeOptions.filter(option => option.id !== 'campaign_pack');
  const scopeUnavailable = !campaignPackAvailable && scope === 'campaign_pack';
  const canExport = plan.canExport && !scopeUnavailable;
  const disabledReason = scopeUnavailable
    ? 'Campaign Pack export is unavailable for the Listing Copy product. Choose Current document or Current group.'
    : plan.disabledReason;

  return (
    <div className="section-stack">
    <fieldset className="fieldset">
      <legend>Export scope</legend>
      <div className="export-scope-list">
        {visibleScopeOptions.map(option => (
          <label className="export-scope" data-selected={scope === option.id} key={option.id}>
            <input
              type="radio"
              name="export-scope"
              value={option.id}
              checked={scope === option.id}
              onChange={() => onScopeChange(option.id)}
            />
            <span>
              <strong>{option.label}</strong>
              <span>{option.description}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>

    {scopeUnavailable ? (
      <div className="notice" data-tone="review" id="export-disabled-reason">
        <div><strong>Campaign Pack scope unavailable</strong><p>{disabledReason}</p></div>
      </div>
    ) : null}

    <div className="export-counts" aria-label="Export document counts">
      <div className="export-count"><span>Included</span><strong>{plan.counts.included}</strong></div>
      <div className="export-count"><span>Missing</span><strong>{plan.counts.missing}</strong></div>
      <div className="export-count"><span>Stale</span><strong>{plan.counts.stale}</strong></div>
      <div className="export-count"><span>Blocked</span><strong>{plan.counts.blocked}</strong></div>
      <div className="export-count"><span>Failed</span><strong>{plan.counts.failed}</strong></div>
    </div>

    {plan.omissions.length > 0 ? (
      <div className="notice" data-tone="review">
        <div>
          <strong>{plan.omissions.length} document{plan.omissions.length === 1 ? '' : 's'} omitted</strong>
          <p>Export never generates missing content. Stale or integrity-blocked documents are not included.</p>
          <ul>
            {plan.omissions.map(omission => (
              <li key={omission.id}>{omission.name} — {omission.reason}</li>
            ))}
          </ul>
        </div>
      </div>
    ) : null}

    <fieldset className="fieldset">
      <legend>Format</legend>
      <div className="export-scope-list">
        {(Object.keys(GUIDED_EXPORT_FORMATS) as GuidedExportFormat[]).map(formatId => {
          const option = GUIDED_EXPORT_FORMATS[formatId];
          return (
            <label className="export-scope" data-selected={format === formatId} key={formatId}>
              <input
                type="radio"
                name="export-format"
                value={formatId}
                checked={format === formatId}
                onChange={() => onFormatChange(formatId)}
              />
              <span>
                <strong>{option.label}</strong>
                <span>{option.delivery === 'print' ? 'Opens the browser print workflow.' : 'Downloads through your browser.'}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>

    <label className="choice" data-selected={includeContactDetails}>
      <input
        type="checkbox"
        checked={includeContactDetails && plan.presentation.contactSignatureAvailable}
        disabled={!plan.presentation.contactSignatureAvailable}
        onChange={event => onContactDetailsChange(event.target.checked)}
      />
      <span>
        <strong>Include contact signature</strong>
        <span>{plan.presentation.contactSignatureLabel}</span>
      </span>
    </label>

    <div className="surface surface--quiet">
      <div className="surface__body" style={{ paddingTop: 18 }}>
        <div className="field-help">Address policy</div>
        <strong>{plan.presentation.addressPolicyLabel}</strong>
        <div className="field-help" style={{ marginTop: 12 }}>Filename preview</div>
        <strong>{plan.filenamePreview}</strong>
      </div>
    </div>

    {receipt ? (
      <div className="receipt" role={receipt.role} aria-live="polite">
        <strong>{receipt.title}</strong>
        <div>{receipt.message}</div>
      </div>
    ) : null}

    {!canExport && disabledReason && !scopeUnavailable ? (
      <div className="disabled-reason" id="export-disabled-reason">{disabledReason}</div>
    ) : null}
    <button
      className="button button--primary"
      type="button"
      onClick={onExport}
      disabled={!canExport}
      aria-describedby={!canExport && disabledReason ? 'export-disabled-reason' : undefined}
    >
      Export {plan.counts.included} document{plan.counts.included === 1 ? '' : 's'}
    </button>
    </div>
  );
};
