import React from 'react';

type CampaignBarProps = {
  address: string;
  productLabel: string;
  locationLabel: string;
  onOpenBrief: () => void;
  briefLabel: string;
  stateLabel?: string;
  nextAction?: React.ReactNode;
};

export const CampaignBar: React.FC<CampaignBarProps> = ({
  address,
  productLabel,
  locationLabel,
  onOpenBrief,
  briefLabel,
  stateLabel,
  nextAction,
}) => (
  <header className="campaign-bar">
    <div className="campaign-bar__brand">
      <span className="brand-mark" aria-hidden="true">A</span>
      <div>
        <strong>AIM Copywriting</strong>
        <span>Guided Editorial Workspace</span>
      </div>
    </div>
    <div className="campaign-bar__identity">
      <strong title={address}>{address || 'New campaign'}</strong>
      <span className="campaign-bar__context" title={`${productLabel} · ${locationLabel}${stateLabel ? ` · ${stateLabel}` : ''}`}>
        {productLabel} · {locationLabel}{stateLabel ? ` · ${stateLabel}` : ''}
      </span>
    </div>
    <div className="campaign-bar__meta">
      <span>{productLabel}</span>
      <span>{locationLabel}</span>
      {stateLabel ? <span>{stateLabel}</span> : null}
    </div>
    <nav className="campaign-bar__actions" aria-label="Campaign actions">
      <span className="session-truth" role="note">Temporary session · Not saved after reload</span>
      <button className="button button--secondary" type="button" aria-label={briefLabel} onClick={onOpenBrief}>
        <span className="button__full-label">{briefLabel}</span>
        <span className="button__compact-label" aria-hidden="true">Brief</span>
      </button>
      {nextAction}
    </nav>
  </header>
);
