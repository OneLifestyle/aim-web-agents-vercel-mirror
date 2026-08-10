import React from 'react';

type BetaGateProps = {
  checking: boolean;
  submitting: boolean;
  value: string;
  error: string | null;
  onValueChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
};

export const BetaGate: React.FC<BetaGateProps> = ({
  checking,
  submitting,
  value,
  error,
  onValueChange,
  onSubmit,
}) => (
  <main className="gate-shell">
    <section className="gate-card" aria-labelledby="beta-gate-title">
      <div className="gate-brand">
        <span className="brand-mark" aria-hidden="true">A</span>
        AIM Copywriting
      </div>
      <h1 id="beta-gate-title">Private beta access</h1>
      <p>Enter your access code to open the Guided Editorial Campaign Workspace.</p>
      {checking ? (
        <div className="notice" role="status" aria-live="polite">
          <div>
            <strong>Checking access</strong>
            <p>Your private beta session is being verified.</p>
          </div>
        </div>
      ) : (
        <form className="gate-form" onSubmit={onSubmit} noValidate>
          <label className="field">
            <span>Beta access code</span>
            <input
              type="password"
              autoComplete="current-password"
              value={value}
              onChange={event => onValueChange(event.target.value)}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? 'beta-access-error' : 'beta-access-help'}
            />
            <small id="beta-access-help">Access is verified through the existing private-beta gate.</small>
          </label>
          {error ? (
            <div className="notice" data-tone="risk" role="alert" id="beta-access-error">
              <div>
                <strong>Access not verified</strong>
                <p>{error}</p>
              </div>
            </div>
          ) : null}
          <button className="button button--primary" type="submit" disabled={submitting || !value.trim()}>
            {submitting ? 'Verifying access…' : 'Open workspace'}
          </button>
        </form>
      )}
    </section>
  </main>
);
