import type { CampaignSessionState } from '../domain';

export const FIXTURE_QUERY_KEY = 'fixture' as const;
export const FIXTURE_NO_NETWORK_MARKER = 'copywriting-fixture:no-network:v1' as const;

export class FixtureNetworkAccessError extends Error {
  readonly operation: string;

  constructor(operation: string) {
    super(`Fixture mode blocked network/provider operation “${operation}”. No live fallback is permitted.`);
    this.name = 'FixtureNetworkAccessError';
    this.operation = operation;
  }
}

/** Call at the app-local service boundary before every provider/network action. */
export const assertNetworkAllowed = (state: CampaignSessionState, operation: string): void => {
  const fixtureIsActive = state.fixture.activationMarker === FIXTURE_NO_NETWORK_MARKER;
  if (fixtureIsActive || state.fixture.networkPolicy === 'forbid') {
    throw new FixtureNetworkAccessError(operation);
  }
};

export const isNoNetworkFixtureState = (state: CampaignSessionState): boolean => (
  state.fixture.activationMarker === FIXTURE_NO_NETWORK_MARKER &&
  state.fixture.networkPolicy === 'forbid' &&
  Boolean(state.fixture.id)
);
