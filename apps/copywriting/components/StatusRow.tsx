import React from 'react';

type StatusRowProps = {
  title: React.ReactNode;
  meta?: React.ReactNode;
  state: string;
  stateLabel: string;
  actions?: React.ReactNode;
  id?: string;
};

export const StatusRow: React.FC<StatusRowProps> = ({
  title,
  meta,
  state,
  stateLabel,
  actions,
  id,
}) => (
  <div className="status-row" data-state={state} id={id}>
    <div>
      <div className="status-row__title">{title}</div>
      {meta ? <div className="status-row__meta">{meta}</div> : null}
    </div>
    <div className="status-row__actions">
      <span className="status-row__state">{stateLabel}</span>
      {actions}
    </div>
  </div>
);
