import type {
  AgentProfile,
  ApprovedBriefSnapshot,
  CampaignOutputDocument,
  CampaignStageId,
  CampaignSuggestion,
  CopywritingProductId,
  OpenHouseDetails,
  PhotoContextPolicy,
  ProfileInclusion,
  PropertyOverviewReviewState,
  PreviewTab,
  ReviewedClaim,
  ReviewedFact,
  ReviewedPhoto,
  ReviewedPhotoHighlight,
} from '../types';
import { CANONICAL_OUTPUT_ORDER } from './outputInventory';

export const TEMPORARY_SESSION_NOTICE = 'Temporary session · Not saved after reload' as const;

export type CampaignGateState = 'locked' | 'error' | 'verified';
export type CampaignPackOperationState = 'idle' | 'generating' | 'partial' | 'ready';

export interface CampaignPackState {
  state: CampaignPackOperationState;
  currentOutputId: PreviewTab | null;
  requestedOutputIds: PreviewTab[];
  succeededOutputIds: PreviewTab[];
  failedOutputIds: PreviewTab[];
  remainingOutputIds: PreviewTab[];
  retryOutputIds: PreviewTab[];
}

export interface CampaignSessionState {
  schemaVersion: 'copywriting-campaign-session.v2';
  sessionId: string;
  sessionNotice: typeof TEMPORARY_SESSION_NOTICE;
  fixture: {
    id: string | null;
    activationMarker: string | null;
    networkPolicy: 'normal' | 'forbid';
  };
  gate: {
    state: CampaignGateState;
    error: string | null;
  };
  product: CopywritingProductId | null;
  listingGenerationSettings: {
    approximateWordCount: number;
  };
  stage: CampaignStageId;
  activeOutputId: PreviewTab | null;
  address: {
    query: string;
    selectedLabel: string | null;
    includeInCopy: boolean;
  };
  property: {
    facts: ReviewedFact[];
    overview: string;
    overviewState: PropertyOverviewReviewState;
    suburbContext: string;
    areaContext: string;
    profileInclusion: ProfileInclusion;
    claims: ReviewedClaim[];
    approved: boolean;
  };
  campaign: {
    primaryAudience: string;
    secondaryAudience: string;
    writingStyles: string[];
    tone: string;
    emphasis: string[];
    styleAvoidances: string[];
    suggestions: CampaignSuggestion[];
    approved: boolean;
  };
  photos: {
    policy: PhotoContextPolicy;
    items: ReviewedPhoto[];
    highlights: ReviewedPhotoHighlight[];
    approved: boolean;
  };
  people: {
    agentIncluded: boolean;
    agent: AgentProfile & { title: string };
    agencyIncluded: boolean;
    agencyName: string;
    openHomeIncluded: boolean;
    openHome: OpenHouseDetails;
  };
  brief: {
    snapshot: ApprovedBriefSnapshot | null;
    approved: boolean;
  };
  outputs: Record<PreviewTab, CampaignOutputDocument>;
  pack: CampaignPackState;
}

export interface InitialCampaignSessionOptions {
  sessionId?: string;
  gateState?: CampaignGateState;
  fixture?: CampaignSessionState['fixture'];
}

export const createEmptyOutputDocuments = (): Record<PreviewTab, CampaignOutputDocument> => {
  return Object.fromEntries(CANONICAL_OUTPUT_ORDER.map(outputId => [
    outputId,
    {
      id: outputId,
      content: '',
      state: 'not-generated',
      boundSnapshotId: null,
      generatedAt: null,
      integrityIssues: [],
      usedPhotoContext: false,
    } satisfies CampaignOutputDocument,
  ])) as Record<PreviewTab, CampaignOutputDocument>;
};

const createInitialFacts = (): ReviewedFact[] => [
  {
    key: 'bedrooms',
    label: 'Bedrooms',
    sourceValue: null,
    approvedValue: null,
    provenance: 'Not fetched',
    state: 'needs-review',
  },
  {
    key: 'bathrooms',
    label: 'Bathrooms',
    sourceValue: null,
    approvedValue: null,
    provenance: 'Not fetched',
    state: 'needs-review',
  },
  {
    key: 'carSpaces',
    label: 'Car spaces',
    sourceValue: null,
    approvedValue: null,
    provenance: 'Not fetched',
    state: 'needs-review',
  },
  {
    key: 'landValue',
    label: 'Land',
    sourceValue: null,
    approvedValue: null,
    sourceUnit: 'm²',
    unit: 'm²',
    provenance: 'Not fetched',
    state: 'needs-review',
  },
  {
    key: 'propertyType',
    label: 'Property type',
    sourceValue: '',
    approvedValue: '',
    provenance: 'Not fetched',
    state: 'needs-review',
  },
];

export const createInitialCampaignSessionState = (
  options: InitialCampaignSessionOptions = {},
): CampaignSessionState => ({
  schemaVersion: 'copywriting-campaign-session.v2',
  sessionId: options.sessionId ?? 'session.local',
  sessionNotice: TEMPORARY_SESSION_NOTICE,
  fixture: options.fixture ?? {
    id: null,
    activationMarker: null,
    networkPolicy: 'normal',
  },
  gate: {
    state: options.gateState ?? 'locked',
    error: null,
  },
  product: null,
  listingGenerationSettings: {
    approximateWordCount: 250,
  },
  stage: 'property',
  activeOutputId: null,
  address: {
    query: '',
    selectedLabel: null,
    includeInCopy: true,
  },
  property: {
    facts: createInitialFacts(),
    overview: '',
    overviewState: 'needs-review',
    suburbContext: '',
    areaContext: '',
    profileInclusion: 'none',
    claims: [],
    approved: false,
  },
  campaign: {
    primaryAudience: '',
    secondaryAudience: '',
    writingStyles: [],
    tone: '',
    emphasis: [],
    styleAvoidances: [],
    suggestions: [],
    approved: false,
  },
  photos: {
    policy: 'off',
    items: [],
    highlights: [],
    approved: false,
  },
  people: {
    agentIncluded: false,
    agent: {
      name: '',
      title: '',
      agency: '',
      phone: '',
      email: '',
      inclusionMode: 'append',
    },
    agencyIncluded: false,
    agencyName: '',
    openHomeIncluded: false,
    openHome: {
      date: '',
      time: '',
      url: '',
    },
  },
  brief: {
    snapshot: null,
    approved: false,
  },
  outputs: createEmptyOutputDocuments(),
  pack: {
    state: 'idle',
    currentOutputId: null,
    requestedOutputIds: [],
    succeededOutputIds: [],
    failedOutputIds: [],
    remainingOutputIds: [],
    retryOutputIds: [],
  },
});

const assertPlainSerializableValue = (value: unknown, path: string): void => {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new Error(`${path} contains a non-finite number.`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPlainSerializableValue(item, `${path}[${index}]`));
    return;
  }
  if (typeof value !== 'object') {
    throw new Error(`${path} contains a non-serialisable ${typeof value} value.`);
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new Error(`${path} contains a non-plain ${prototype?.constructor?.name ?? 'object'} value.`);
  }
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    assertPlainSerializableValue(child, `${path}.${key}`);
  }
};

export const assertSerializableCampaignSessionState = (state: CampaignSessionState): void => {
  assertPlainSerializableValue(state, 'campaignSession');
  const encoded = JSON.stringify(state);
  if (!encoded || JSON.parse(encoded).schemaVersion !== state.schemaVersion) {
    throw new Error('Campaign session state failed its JSON serialisation round trip.');
  }
};

export const cloneCampaignSessionState = (state: CampaignSessionState): CampaignSessionState => {
  assertSerializableCampaignSessionState(state);
  return JSON.parse(JSON.stringify(state)) as CampaignSessionState;
};
