import type {
  ApprovedBriefSnapshot,
  CopywritingProductId,
  PreviewTab,
  ReviewedClaim,
  ReviewedFact,
} from '../types';
import {
  CAMPAIGN_PACK_OUTPUT_ORDER,
  OUTPUT_PRESENTATION_BY_ID,
  buildApprovedBriefSnapshot,
  cloneCampaignSessionState,
  createInitialCampaignSessionState,
  deriveCampaignPackState,
  governSuggestions,
  markOutputsNeedsRegeneration,
  validateReturnedOutput,
  type CampaignSessionState,
} from '../domain';
import { FIXTURE_NO_NETWORK_MARKER, FIXTURE_QUERY_KEY } from './runtime';

export const FIXTURE_APPROVED_AT = '2026-08-09T01:00:00.000Z' as const;
export const FIXTURE_GENERATED_AT = '2026-08-09T01:05:00.000Z' as const;
export const FIXTURE_ADDRESS = '18 Wattlebird Rise, Fictional Bay VIC 3999' as const;

export const REQUIRED_FIXTURE_IDS = [
  'gate.locked',
  'gate.error',
  'gate.verified',
  'start.empty',
  'start.product-selected',
  'address.selected',
  'property.fetched',
  'claim.unresolved',
  'claim.corrected',
  'claim.excluded',
  'direction.approved',
  'photos.off',
  'photos.included-reviewed',
  'brief.ready',
  'listing.ready',
  'listing.stale',
  'pack.generating',
  'pack.partial',
  'pack.complete',
  'pack.failed-child-preserved-siblings',
  'open-house.no-schedule',
  'open-house.date-only',
  'open-house.time-only',
  'open-house.full-schedule',
  'open-house.conflicting-approved-schedule',
  'output.integrity-conflict',
  'session.temporary',
  'six-car-garage-exclusion.safe',
  'six-car-garage-exclusion.conflict',
] as const;

export type FixtureId = typeof REQUIRED_FIXTURE_IDS[number];

export interface FixtureOptions {
  product?: CopywritingProductId;
  conflictOutputId?: PreviewTab;
}

export interface CampaignFixtureDefinition {
  id: FixtureId;
  title: string;
  description: string;
  createState: (options?: FixtureOptions) => CampaignSessionState;
}

const SIX_CAR_ALIASES = [
  'six-car garage',
  'six car garage',
  '6-car garage',
  'six vehicle garage',
  'parking for six',
] as const;

const createFixtureFacts = (): ReviewedFact[] => [
  {
    key: 'bedrooms',
    label: 'Bedrooms',
    sourceValue: 4,
    approvedValue: 4,
    provenance: 'Fictional property research fixture',
    state: 'confirmed',
  },
  {
    key: 'bathrooms',
    label: 'Bathrooms',
    sourceValue: 2,
    approvedValue: 2,
    provenance: 'Fictional property research fixture',
    state: 'confirmed',
  },
  {
    key: 'carSpaces',
    label: 'Car spaces',
    sourceValue: 6,
    approvedValue: 2,
    provenance: 'Fictional source corrected by fixture reviewer',
    state: 'corrected',
  },
  {
    key: 'landValue',
    label: 'Land',
    sourceValue: 742,
    approvedValue: 742,
    sourceUnit: 'm²',
    unit: 'm²',
    provenance: 'Fictional property research fixture',
    state: 'confirmed',
  },
  {
    key: 'propertyType',
    label: 'Property type',
    sourceValue: 'House',
    approvedValue: 'House',
    provenance: 'Fictional property research fixture',
    state: 'confirmed',
  },
];

const createFixtureClaims = (): ReviewedClaim[] => [
  {
    id: 'claim.north-facing-garden',
    sourceText: 'North-facing rear garden',
    approvedText: 'North-facing rear garden',
    provenance: 'Fictional property research fixture',
    state: 'confirmed',
    aliases: ['north facing rear garden'],
  },
  {
    id: 'claim.updated-kitchen',
    sourceText: 'Designer marble kitchen',
    approvedText: 'Updated kitchen with pale stone-look benchtops',
    provenance: 'Fictional source corrected by fixture reviewer',
    state: 'corrected',
    aliases: [],
  },
  {
    id: 'claim.six-car-garage',
    sourceText: 'six-car garage',
    approvedText: 'six-car garage',
    provenance: 'Fictional property research fixture',
    state: 'excluded',
    aliases: [...SIX_CAR_ALIASES],
    reason: 'The source claim conflicts with the approved value of 2 car spaces.',
  },
];

const createReviewedCampaignState = (photoPolicy: 'off' | 'included' = 'off'): CampaignSessionState => {
  const state = createInitialCampaignSessionState({
    sessionId: 'session.fixture.editorial-v2',
    gateState: 'verified',
  });
  state.product = 'campaign-pack';
  state.stage = 'brief';
  state.address = {
    query: FIXTURE_ADDRESS,
    selectedLabel: FIXTURE_ADDRESS,
    includeInCopy: true,
  };
  state.property = {
    facts: createFixtureFacts(),
    overview: 'A four-bedroom home with a calm garden outlook. Research described a six-car garage. Updated living spaces open to a north-facing rear garden.',
    overviewState: 'confirmed',
    suburbContext: 'Fictional Bay is an invented Victorian bayside setting used only for deterministic development QA.',
    areaContext: 'The fictional district is described as walkable, leafy and connected to local services.',
    profileInclusion: 'both',
    claims: createFixtureClaims(),
    approved: true,
  };
  state.campaign = {
    primaryAudience: 'Established Families',
    secondaryAudience: 'Empty Nesters / Downsizers',
    writingStyles: ['Professional', 'Descriptive'],
    tone: 'Warm, assured and specific',
    emphasis: [
      'North-facing rear garden',
      'Updated kitchen with pale stone-look benchtops',
      'Flexible family living with two car spaces',
    ],
    styleAvoidances: ['Avoid clichés', 'Do not imply a guaranteed investment return'],
    suggestions: [],
    approved: true,
  };
  state.photos = {
    policy: photoPolicy,
    items: [
      {
        id: 'photo.01',
        name: 'fictional-living-room.jpg',
        imageNumber: 1,
        selected: true,
        analysisState: 'ready',
      },
      {
        id: 'photo.02',
        name: 'fictional-kitchen.jpg',
        imageNumber: 2,
        selected: true,
        analysisState: 'ready',
      },
      {
        id: 'photo.03',
        name: 'fictional-driveway.jpg',
        imageNumber: 3,
        selected: false,
        analysisState: 'ready',
      },
    ],
    highlights: [
      {
        id: 'highlight.01.windows',
        imageId: 'photo.01',
        imageNumber: 1,
        sourceText: 'North-facing living room with broad windows',
        approvedText: 'North-facing living room with broad windows',
        state: 'approved',
        provenance: 'Fictional photo analysis fixture',
      },
      {
        id: 'highlight.02.kitchen',
        imageId: 'photo.02',
        imageNumber: 2,
        sourceText: 'Marble kitchen finishes',
        approvedText: 'Bright kitchen with pale stone-look benchtops',
        state: 'corrected',
        provenance: 'Fictional photo analysis corrected by fixture reviewer',
      },
      {
        id: 'highlight.03.garage',
        imageId: 'photo.03',
        imageNumber: 3,
        sourceText: 'Six vehicle garage visible from the driveway',
        approvedText: 'Six vehicle garage visible from the driveway',
        state: 'excluded',
        provenance: 'Fictional photo analysis fixture',
      },
    ],
    approved: true,
  };
  state.people = {
    agentIncluded: true,
    agent: {
      name: 'Mara Ellison',
      title: 'Licensed Estate Agent',
      agency: 'Harbour & Heath Property',
      phone: '03 5550 0188',
      email: 'mara.ellison@example.test',
      inclusionMode: 'append',
    },
    agencyIncluded: true,
    agencyName: 'Harbour & Heath Property',
    openHomeIncluded: true,
    openHome: {
      date: '2026-08-22',
      time: '11:00',
      url: 'https://example.test/open-home/fictional-bay',
    },
  };
  return state;
};

const attachFixtureIdentity = (state: CampaignSessionState, fixtureId: FixtureId): CampaignSessionState => {
  state.fixture = {
    id: fixtureId,
    activationMarker: FIXTURE_NO_NETWORK_MARKER,
    networkPolicy: 'forbid',
  };
  return state;
};

const approveFixtureBrief = (state: CampaignSessionState): CampaignSessionState => {
  const snapshot = buildApprovedBriefSnapshot(state, {
    approvedAt: FIXTURE_APPROVED_AT,
    statement: 'Approved for deterministic generation in this temporary development fixture.',
  });
  state.brief = {
    snapshot,
    approved: true,
  };
  return state;
};

const listingFixtureText = (photoContextIncluded: boolean): string => `# Space to settle in, moments from Fictional Bay

There is an easy sense of arrival at this fictional four-bedroom home, where a composed street presence gives way to generous family spaces and a calm garden outlook. The layout balances places to gather with quieter rooms to retreat to, creating a home that can adapt as daily routines and weekend plans change.

At its heart, the updated kitchen brings together practical storage, pale stone-look benchtops and a clear connection to the main living and dining zone. It is a welcoming setting for everyday meals, homework at the table and relaxed entertaining, with the surrounding spaces arranged to keep conversation flowing.

${photoContextIncluded
  ? 'Reviewed photo context highlights a north-facing living room with broad windows and a bright kitchen with pale stone-look benchtops. These approved visual details reinforce the sense of natural light without overstating finishes or condition.'
  : 'The living spaces open towards the approved north-facing rear garden, extending the everyday floor plan into a private outdoor setting. Established greenery softens the outlook and provides a flexible backdrop for long lunches, play and quiet time outside.'}

Four bedrooms provide useful separation for family life, guests or working from home. The main bedroom feels considered and private, while the remaining rooms sit within easy reach of the second bathroom. Two bathrooms support the morning rhythm, and two car spaces complete the practical picture.

Set across 742 m², the property offers room to enjoy now while leaving future possibilities to each buyer's own enquiries and plans. The campaign makes no promises about development or investment outcomes; its appeal lies in the scale, flexibility and welcoming character already present.

Fictional Bay is an invented Victorian bayside setting used for deterministic development review. Within that fictional context, the home is positioned for an easy connection to leafy streets, local services and places to meet, while retaining a composed residential atmosphere.

Warm, assured and specific, this is a home defined by usable space rather than spectacle: a four-bedroom layout, an updated kitchen, an approved north-facing garden connection and the flexibility to support changing seasons of family life.
`;

const brochureFixtureText = (photoContextIncluded: boolean): string => `# A composed family address in Fictional Bay

Created for a fictional Victorian property campaign, this brochure introduces a four-bedroom house with two bathrooms, two car spaces and a calm garden outlook. Generous shared spaces and a practical private-room layout make the home feel ready for both busy weekdays and slower weekends.

## The residence

The updated kitchen is framed by pale stone-look benchtops, practical storage and a direct relationship with the main living and dining area. ${photoContextIncluded
  ? 'Approved photo observations note broad windows in the north-facing living room and a bright, welcoming kitchen.'
  : 'The living zone extends naturally towards the approved north-facing rear garden.'}

## Key features

- Four well-proportioned bedrooms
- Two bathrooms for an efficient family routine
- Updated kitchen with pale stone-look benchtops
- Flexible living and dining zones
- North-facing rear garden with a calm outlook
- 742 m² allotment and two car spaces

## The setting

Fictional Bay is an invented, leafy Victorian bayside setting used only for provider-free interface testing. The address is presented as connected to local services and neighbourhood meeting places, without making unverified proximity or investment claims.

## Campaign note

All copy is a generated, read-only draft based on the reviewed fixture brief. Buyers should rely on their own enquiries and the agent's approved campaign material.
`;

const blogFixtureText = (photoContextIncluded: boolean): string => `# Designing an easier family rhythm in Fictional Bay

A home can be generous without feeling imposing. At this fictional Fictional Bay address, the strongest impression comes from the way four bedrooms, two bathrooms and a series of connected living spaces support the changing pace of family life. The campaign is less about grand claims and more about the practical details that help mornings, evenings and weekends flow.

## A layout that understands daily life

The floor plan creates a useful balance between shared and private space. Bedrooms offer separation when concentration or rest matters, while the central living areas make it easy to come together. That flexibility can support younger families, older children, visiting relatives or a work-from-home routine without asking one room to perform every role.

Two bathrooms help distribute the busiest parts of the day. They are presented as practical assets rather than theatrical features, consistent with the warm and assured tone of the reviewed campaign brief. Two car spaces add another layer of everyday usefulness and reflect the human-corrected property fact that governs every output in this fixture.

## The kitchen as a working centre

The updated kitchen brings pale stone-look benchtops, practical storage and a direct connection to living and dining. It works as a true centre of the plan: somewhere to prepare a quick breakfast, spread out an afternoon project or keep conversation moving while dinner comes together.

${photoContextIncluded
  ? 'Reviewed visual context adds two specific observations: the north-facing living room has broad windows, and the kitchen reads as bright with pale stone-look benchtops. Because those details were selected and approved, they can support the editorial story without drifting beyond the governing brief.'
  : 'With photo context deliberately off, this article relies only on reviewed property and campaign information. The description stays with approved facts and the confirmed north-facing rear garden rather than inferring finishes, outlooks or conditions from imagery.'}

## A garden connection with room to evolve

The approved north-facing rear garden gives the shared spaces an inviting outdoor relationship. It can accommodate a quiet coffee, a long lunch or space for play, yet the copy avoids prescribing a single way to use it. That restraint matters: useful property writing creates a clear picture while leaving room for each reader to imagine their own routines.

Across the 742 m² allotment, the existing setting feels spacious and grounded. The campaign does not suggest a guaranteed development path or investment outcome. Any future possibility belongs to buyer enquiries and relevant approvals, while the present-day appeal rests in the combination of land, layout and garden outlook.

## A fictional neighbourhood, written with care

Fictional Bay is intentionally invented for deterministic Australian interface testing. Within that fictional setting, the suburb is described as leafy, walkable and connected to local services. No real school zone, transport time or amenity distance is claimed, and no customer or private property information is used.

That approach illustrates a broader editorial principle: location copy should create atmosphere without turning assumptions into facts. Here, the neighbourhood story supports the home's calm character while remaining visibly subordinate to the reviewed property brief.

## Details that build confidence

Strong campaign writing often earns trust through accumulation rather than exaggeration. Four bedrooms establish flexibility. Two bathrooms support the household rhythm. The updated kitchen anchors the centre of the plan. Two car spaces complete the practical requirements. The garden and living connection provide the emotional thread.

Each point is modest on its own, but together they describe a home that feels considered and adaptable. Corrected facts replace source claims, hard exclusions remain enforced and only the selected context is allowed into the final draft. That governance is largely invisible to the reader, yet it is essential to the credibility of the finished campaign.

## Reading the campaign as a whole

Viewed together, the property facts and editorial choices create a consistent story. The home is not positioned as a showpiece or a promise of future value. It is presented as a generous, useful setting with a warm centre, a clear garden relationship and enough separation to support different activities at the same time.

That consistency matters across channels. A short message may lead with the four-bedroom plan, while a brochure can spend more time on the kitchen and the long-form article can explore daily rhythm. The emphasis changes with the format, but the approved facts, measured tone and governing exclusions remain the same.

## A home for the pace between milestones

The most persuasive idea is also the simplest: this fictional property offers space for ordinary life to feel a little easier. It can hold shared meals, focused work, garden afternoons and changing family needs without relying on spectacle.

For buyers drawn to an assured family home in a calm bayside setting, the address presents a measured invitation to look closer. The final impression is one of warmth, flexibility and useful space, expressed through approved details and a deliberately restrained editorial voice.
`;

const videoScriptFixtureText = (photoContextIncluded: boolean): string => `# Property campaign film — Fictional Bay

## OPENING — STREET AND ARRIVAL

VISUAL: A measured approach to the fictional address, moving from the leafy street to the front entry.

VOICEOVER: Welcome to a composed family home in Fictional Bay, where four bedrooms, flexible living spaces and a calm garden outlook come together with an easy sense of balance.

## SCENE TWO — LIVING AND CONNECTION

VISUAL: Move through the main living and dining zone, holding on the relationship between the shared spaces.

VOICEOVER: The plan is designed around everyday connection. There is room to gather, room to retreat and the flexibility to adapt as work, family and weekend routines change.

${photoContextIncluded
  ? 'VISUAL: Use the reviewed living-room image, showing the approved broad windows, then transition to the approved bright kitchen view with pale stone-look benchtops.\n\nVOICEOVER: Reviewed visual details bring natural light and a welcoming kitchen character into focus, while the campaign remains grounded in the approved brief.'
  : 'VISUAL: Show only general approved campaign footage of the living zone and garden threshold; do not infer details from unreviewed imagery.\n\nVOICEOVER: The living spaces connect naturally with the approved north-facing rear garden, creating an inviting setting for everyday life and relaxed entertaining.'}

## SCENE THREE — KITCHEN AND DAILY RHYTHM

VISUAL: A sequence of the updated kitchen, storage and the connection back to dining.

VOICEOVER: At the centre, the updated kitchen combines pale stone-look benchtops, practical storage and a layout that keeps conversation moving from breakfast through to dinner.

## SCENE FOUR — PRIVATE SPACES

VISUAL: Calm transitions through the bedrooms and bathrooms, avoiding fast cuts.

VOICEOVER: Four bedrooms provide useful separation for rest, guests or focused work. Two bathrooms support the busiest parts of the day, and two car spaces complete the practical picture.

## SCENE FIVE — GARDEN AND SETTING

VISUAL: Finish in the approved north-facing rear garden, then widen to suggest the 742 m² setting.

VOICEOVER: Outside, the garden offers a calm backdrop for long lunches, play or a quiet moment in the sun. Across 742 square metres, the home feels spacious, grounded and ready for its next chapter.

## TRANSITION — THE EVERYDAY DETAILS

VISUAL: Use a slower sequence of storage, circulation and the connection between shared rooms. Keep the camera at a natural eye level and let each frame settle.

VOICEOVER: It is the combination of practical details that gives this home its easy character: useful storage, a connected kitchen, private bedrooms and outdoor space that feels like part of the daily plan.

## CLOSE — CAMPAIGN INVITATION

VISUAL: Return to a still exterior frame with the fictional campaign title and approved agent contact treatment.

VOICEOVER: Four bedrooms. Two bathrooms. Flexible family living in the invented bayside setting of Fictional Bay. Discover a home shaped for the pace of real life.

ON SCREEN: 18 Wattlebird Rise, Fictional Bay VIC 3999. Generated draft for deterministic development review.
`;

const openHouseFixtureText = (snapshot: ApprovedBriefSnapshot): string => {
  const openHome = snapshot.openHomeContext.included
    ? snapshot.openHomeContext
    : { date: '', time: '', url: '' };
  return [
    `🏡 Open House: ${FIXTURE_ADDRESS}`,
    `📅 Date: ${openHome.date}`,
    `⏰ Time: ${openHome.time}`,
    `📍 Location: ${FIXTURE_ADDRESS}`,
    '',
    'Explore a warm four-bedroom home with two bathrooms, two car spaces and a north-facing rear garden.',
    openHome.url ? `🔗 ${openHome.url}` : '🔗',
  ].join('\n');
};

const safeOutputText = (
  outputId: PreviewTab,
  photoContextIncluded: boolean,
  snapshot: ApprovedBriefSnapshot,
): string => {
  const photoSentence = photoContextIncluded
    ? 'Approved visual context notes broad windows and a bright kitchen with pale stone-look benchtops.'
    : 'A north-facing rear garden creates an inviting outdoor connection.';
  if (outputId === 'Full Copy') return listingFixtureText(photoContextIncluded);
  if (outputId === 'Brochure Copy') return brochureFixtureText(photoContextIncluded);
  if (outputId === 'Coming Soon SMS') {
    return 'Coming soon in Fictional Bay: a warm four-bedroom home with two bathrooms, two car spaces and a north-facing rear garden. Reply for campaign details.';
  }
  if (outputId === 'Long-form / Blog') return blogFixtureText(photoContextIncluded);
  if (outputId === 'Video Script') return videoScriptFixtureText(photoContextIncluded);
  if (outputId === 'Open House') return openHouseFixtureText(snapshot);
  return `${OUTPUT_PRESENTATION_BY_ID[outputId].label}: Discover a four-bedroom Fictional Bay home with two bathrooms and two car spaces. ${photoSentence}`;
};

const setReadyOutput = (state: CampaignSessionState, outputId: PreviewTab): void => {
  const snapshot = state.brief.snapshot;
  if (!snapshot) throw new Error('Fixture output generation requires an Approved Brief Snapshot.');
  state.outputs[outputId] = validateReturnedOutput({
    id: outputId,
    content: safeOutputText(outputId, snapshot.photoContext.policy === 'included', snapshot),
    snapshot,
    boundSnapshotId: snapshot.snapshotId,
    usedPhotoContext: snapshot.photoContext.policy === 'included',
    knownPhotoHighlights: state.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
};

const createBriefReadyState = (photoPolicy: 'off' | 'included' = 'off'): CampaignSessionState => (
  createReviewedCampaignState(photoPolicy)
);

const createApprovedBriefState = (photoPolicy: 'off' | 'included' = 'off'): CampaignSessionState => (
  approveFixtureBrief(createReviewedCampaignState(photoPolicy))
);

interface OpenHomeFixtureContext {
  included: boolean;
  date: string;
  time: string;
  url: string;
}

const createListingReadyState = (
  photoPolicy: 'off' | 'included' = 'included',
  openHome?: OpenHomeFixtureContext,
): CampaignSessionState => {
  const reviewedState = createReviewedCampaignState(photoPolicy);
  if (openHome) {
    reviewedState.people.openHomeIncluded = openHome.included;
    reviewedState.people.openHome = {
      date: openHome.date,
      time: openHome.time,
      url: openHome.url,
    };
  }
  const state = approveFixtureBrief(reviewedState);
  state.stage = 'outputs';
  state.activeOutputId = 'Full Copy';
  setReadyOutput(state, 'Full Copy');
  return state;
};

const createPackCompleteState = (
  photoPolicy: 'off' | 'included' = 'off',
  openHome?: OpenHomeFixtureContext,
): CampaignSessionState => {
  const state = createListingReadyState(photoPolicy, openHome);
  CAMPAIGN_PACK_OUTPUT_ORDER.forEach(outputId => setReadyOutput(state, outputId));
  const derived = deriveCampaignPackState(state.outputs);
  state.pack = {
    state: derived.state,
    currentOutputId: null,
    requestedOutputIds: [...CAMPAIGN_PACK_OUTPUT_ORDER],
    succeededOutputIds: [...derived.readyOutputIds],
    failedOutputIds: [...derived.failedOutputIds],
    remainingOutputIds: [...derived.remainingOutputIds],
    retryOutputIds: [...derived.retryOutputIds],
  };
  return state;
};

const createOpenHouseConflictState = (): CampaignSessionState => {
  const state = createPackCompleteState('off', {
    included: true,
    date: '2026-08-22',
    time: '11:00',
    url: '',
  });
  const snapshot = state.brief.snapshot!;
  state.outputs['Open House'] = validateReturnedOutput({
    id: 'Open House',
    content: `🏡 Open House: ${FIXTURE_ADDRESS}\n📅 Date: Sunday 23 August 2026\n⏰ Time: 1:00 pm\n📍 Location: ${FIXTURE_ADDRESS}\n\nExplore this welcoming four-bedroom home.`,
    snapshot,
    boundSnapshotId: snapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  state.activeOutputId = 'Open House';
  synchronisePackFromOutputs(state);
  return state;
};

const setFailedOutput = (state: CampaignSessionState, outputId: PreviewTab, message: string): void => {
  const snapshot = state.brief.snapshot;
  if (!snapshot) throw new Error('Failed output fixture requires an Approved Brief Snapshot.');
  state.outputs[outputId] = {
    id: outputId,
    content: '',
    state: 'failed',
    boundSnapshotId: snapshot.snapshotId,
    generatedAt: FIXTURE_GENERATED_AT,
    integrityIssues: [],
    usedPhotoContext: false,
    error: message,
  };
};

const synchronisePackFromOutputs = (state: CampaignSessionState): void => {
  const derived = deriveCampaignPackState(state.outputs);
  state.pack = {
    state: derived.state,
    currentOutputId: null,
    requestedOutputIds: [...CAMPAIGN_PACK_OUTPUT_ORDER],
    succeededOutputIds: [...derived.readyOutputIds],
    failedOutputIds: [...derived.failedOutputIds],
    remainingOutputIds: [...derived.remainingOutputIds],
    retryOutputIds: [...derived.retryOutputIds],
  };
};

const createSixCarConflictState = (conflictOutputId: PreviewTab = 'Facebook Marketplace'): CampaignSessionState => {
  const safeState = createPackCompleteState('off');
  const snapshot = safeState.brief.snapshot!;
  safeState.campaign.suggestions = governSuggestions([
    {
      id: 'suggestion.safe-garden',
      kind: 'selling-point',
      text: 'Lead with the north-facing rear garden.',
      state: 'suggested',
    },
    {
      id: 'suggestion.six-car-conflict',
      kind: 'selling-point',
      text: 'Lead with parking for six as the campaign hero.',
      state: 'suggested',
    },
  ], {
    approvedFacts: snapshot.approvedFacts,
    factProvenance: snapshot.factProvenance,
    hardExclusions: snapshot.hardExclusions,
    photoContextPolicy: snapshot.photoContext.policy,
  });
  safeState.outputs['Full Copy'] = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A confident family home with a six-car garage and flexible entertaining spaces.',
    snapshot,
    boundSnapshotId: snapshot.snapshotId,
    usedPhotoContext: false,
    knownPhotoHighlights: safeState.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  const childId = CAMPAIGN_PACK_OUTPUT_ORDER.includes(conflictOutputId)
    ? conflictOutputId
    : 'Facebook Marketplace';
  safeState.outputs[childId] = validateReturnedOutput({
    id: childId,
    content: `${OUTPUT_PRESENTATION_BY_ID[childId].label}: Parking for six makes every arrival effortless.`,
    snapshot,
    boundSnapshotId: snapshot.snapshotId,
    usedPhotoContext: false,
    knownPhotoHighlights: safeState.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  safeState.activeOutputId = childId;
  synchronisePackFromOutputs(safeState);
  return safeState;
};

const fixture = (
  id: FixtureId,
  title: string,
  description: string,
  createState: (options?: FixtureOptions) => CampaignSessionState,
): CampaignFixtureDefinition => ({
  id,
  title,
  description,
  createState: options => attachFixtureIdentity(createState(options), id),
});

export const FIXTURE_CATALOGUE: Readonly<Record<FixtureId, CampaignFixtureDefinition>> = {
  'gate.locked': fixture('gate.locked', 'Private beta gate', 'Gate before verification.', () => (
    createInitialCampaignSessionState({ sessionId: 'session.fixture.gate-locked', gateState: 'locked' })
  )),
  'gate.error': fixture('gate.error', 'Private beta error', 'Safe verification failure with retry.', () => {
    const state = createInitialCampaignSessionState({ sessionId: 'session.fixture.gate-error', gateState: 'error' });
    state.gate.error = 'Access could not be verified. Check the code and try again.';
    return state;
  }),
  'gate.verified': fixture('gate.verified', 'Verified beta gate', 'Verified transition to the empty start.', () => (
    createInitialCampaignSessionState({ sessionId: 'session.fixture.gate-verified', gateState: 'verified' })
  )),
  'start.empty': fixture('start.empty', 'Empty campaign start', 'No product or address selected.', () => (
    createInitialCampaignSessionState({ sessionId: 'session.fixture.start-empty', gateState: 'verified' })
  )),
  'start.product-selected': fixture('start.product-selected', 'Product selected', 'Listing Copy or Campaign Pack selected with no address.', options => {
    const state = createInitialCampaignSessionState({ sessionId: 'session.fixture.product-selected', gateState: 'verified' });
    state.product = options?.product ?? 'campaign-pack';
    return state;
  }),
  'address.selected': fixture('address.selected', 'Address selected', 'A valid fictional suggestion enables Fetch Details.', options => {
    const state = createInitialCampaignSessionState({ sessionId: 'session.fixture.address-selected', gateState: 'verified' });
    state.product = options?.product ?? 'campaign-pack';
    state.address = { query: FIXTURE_ADDRESS, selectedLabel: FIXTURE_ADDRESS, includeInCopy: true };
    return state;
  }),
  'property.fetched': fixture('property.fetched', 'Fetched property', 'Fictional facts and claims await review.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'property';
    state.property.approved = false;
    state.property.overviewState = 'needs-review';
    state.property.facts = state.property.facts.map(fact => ({ ...fact, state: 'needs-review' }));
    state.property.claims = state.property.claims.map(claim => ({ ...claim, state: 'needs-review' }));
    state.campaign.approved = false;
    return state;
  }),
  'claim.unresolved': fixture('claim.unresolved', 'Unresolved claim', 'A required sourced claim blocks approval.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'property';
    state.property.approved = false;
    state.property.claims[0] = { ...state.property.claims[0], state: 'needs-review' };
    return state;
  }),
  'claim.corrected': fixture('claim.corrected', 'Corrected structured fact', 'Source car spaces and approved value remain distinct.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'property';
    state.property.approved = false;
    return state;
  }),
  'claim.excluded': fixture('claim.excluded', 'Hard excluded claim', 'Six-car garage is retained only as an exclusion.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'property';
    state.property.approved = false;
    return state;
  }),
  'direction.approved': fixture('direction.approved', 'Approved campaign direction', 'Audience, voice, emphasis and boundaries approved.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'campaign';
    return state;
  }),
  'photos.off': fixture('photos.off', 'Photo context off', 'Analysed photos remain inspectable but are not used.', () => {
    const state = createReviewedCampaignState('off');
    state.stage = 'photos';
    return state;
  }),
  'photos.included-reviewed': fixture('photos.included-reviewed', 'Reviewed photo context', 'Selected photos contain approved, corrected and excluded highlights.', () => {
    const state = createReviewedCampaignState('included');
    state.stage = 'photos';
    return state;
  }),
  'brief.ready': fixture('brief.ready', 'Reviewed Brief ready', 'Complete reviewed context ready for human session approval.', () => createBriefReadyState('off')),
  'listing.ready': fixture('listing.ready', 'Listing Copy ready', 'Read-only Listing Copy passes current integrity checks.', () => createListingReadyState('included')),
  'listing.stale': fixture('listing.stale', 'Listing Copy stale', 'A governing fact changed after Listing Copy generation.', () => {
    const state = createListingReadyState('off');
    const carSpaces = state.property.facts.find(fact => fact.key === 'carSpaces')!;
    carSpaces.approvedValue = 3;
    carSpaces.state = 'corrected';
    state.campaign.emphasis = state.campaign.emphasis.map(text => text.replace('two car spaces', 'three car spaces'));
    const nextSnapshot = buildApprovedBriefSnapshot(state, { approvedAt: '2026-08-09T01:10:00.000Z' });
    state.brief.snapshot = nextSnapshot;
    state.outputs = markOutputsNeedsRegeneration(state.outputs, nextSnapshot.snapshotId);
    return state;
  }),
  'pack.generating': fixture('pack.generating', 'Campaign Pack generating', 'Named deterministic child progress with completed siblings.', () => {
    const state = createListingReadyState('off');
    const succeeded = CAMPAIGN_PACK_OUTPUT_ORDER.slice(0, 4);
    succeeded.forEach(outputId => setReadyOutput(state, outputId));
    const currentOutputId = CAMPAIGN_PACK_OUTPUT_ORDER[4];
    state.outputs[currentOutputId] = {
      ...state.outputs[currentOutputId],
      state: 'generating',
      boundSnapshotId: state.brief.snapshot!.snapshotId,
    };
    CAMPAIGN_PACK_OUTPUT_ORDER.slice(5).forEach(outputId => {
      state.outputs[outputId] = {
        ...state.outputs[outputId],
        state: 'queued',
        boundSnapshotId: state.brief.snapshot!.snapshotId,
      };
    });
    state.pack = {
      state: 'generating',
      currentOutputId,
      requestedOutputIds: [...CAMPAIGN_PACK_OUTPUT_ORDER],
      succeededOutputIds: [...succeeded],
      failedOutputIds: [],
      remainingOutputIds: [...CAMPAIGN_PACK_OUTPUT_ORDER.slice(4)],
      retryOutputIds: [],
    };
    return state;
  }),
  'pack.partial': fixture('pack.partial', 'Campaign Pack partial', 'Fourteen ready, one failed and one remaining.', () => {
    const state = createPackCompleteState('off');
    setFailedOutput(state, 'TikTok', 'TikTok generation stopped before completion.');
    state.outputs['Video Script'] = {
      ...state.outputs['Video Script'],
      content: '',
      state: 'not-generated',
      boundSnapshotId: null,
      generatedAt: null,
      integrityIssues: [],
    };
    synchronisePackFromOutputs(state);
    return state;
  }),
  'pack.complete': fixture('pack.complete', 'Campaign Pack complete', 'Listing foundation plus all 16 children ready.', () => createPackCompleteState('included')),
  'pack.failed-child-preserved-siblings': fixture('pack.failed-child-preserved-siblings', 'Failed child with siblings', 'One failed child preserves fifteen ready siblings.', () => {
    const state = createPackCompleteState('off');
    setFailedOutput(state, 'TikTok', 'TikTok generation stopped before completion.');
    synchronisePackFromOutputs(state);
    state.activeOutputId = 'TikTok';
    return state;
  }),
  'open-house.no-schedule': fixture('open-house.no-schedule', 'Open House without schedule', 'Generic Open House copy stays Ready with blank optional scheduling values.', () => createPackCompleteState('off', {
    included: false,
    date: '',
    time: '',
    url: '',
  })),
  'open-house.date-only': fixture('open-house.date-only', 'Open House with date only', 'The approved date is preserved while time and URL remain blank.', () => createPackCompleteState('off', {
    included: true,
    date: '2026-08-22',
    time: '',
    url: '',
  })),
  'open-house.time-only': fixture('open-house.time-only', 'Open House with time only', 'The approved time is preserved while date and URL remain blank.', () => createPackCompleteState('off', {
    included: true,
    date: '',
    time: '11:00',
    url: '',
  })),
  'open-house.full-schedule': fixture('open-house.full-schedule', 'Open House with full schedule', 'Approved date and time are both preserved.', () => createPackCompleteState('off', {
    included: true,
    date: '2026-08-22',
    time: '11:00',
    url: '',
  })),
  'open-house.conflicting-approved-schedule': fixture('open-house.conflicting-approved-schedule', 'Open House schedule conflict', 'A returned schedule that conflicts with approved values cannot become Ready.', () => (
    createOpenHouseConflictState()
  )),
  'output.integrity-conflict': fixture('output.integrity-conflict', 'Output integrity conflict', 'Returned Listing Copy contains an excluded claim.', () => {
    const state = createListingReadyState('off');
    const snapshot = state.brief.snapshot!;
    state.outputs['Full Copy'] = validateReturnedOutput({
      id: 'Full Copy',
      content: 'The headline feature is a 6-car garage with room for every vehicle.',
      snapshot,
      boundSnapshotId: snapshot.snapshotId,
      usedPhotoContext: false,
      knownPhotoHighlights: state.photos.highlights,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    return state;
  }),
  'session.temporary': fixture('session.temporary', 'Temporary populated session', 'Approved populated campaign with truthful reload-loss wording.', () => createApprovedBriefState('off')),
  'six-car-garage-exclusion.safe': fixture('six-car-garage-exclusion.safe', 'Six-car regression safe', 'Corrected two-car fact and all 17 validated outputs.', () => createPackCompleteState('off')),
  'six-car-garage-exclusion.conflict': fixture('six-car-garage-exclusion.conflict', 'Six-car regression conflict', 'Bad suggestion, Listing Copy and configurable child prove enforcement.', options => (
    createSixCarConflictState(options?.conflictOutputId)
  )),
};

export const getFixtureState = (fixtureId: FixtureId, options?: FixtureOptions): CampaignSessionState => {
  const definition = FIXTURE_CATALOGUE[fixtureId];
  if (!definition) throw new Error(`Unknown copywriting fixture “${fixtureId}”.`);
  return cloneCampaignSessionState(definition.createState(options));
};

export const isFixtureId = (value: string): value is FixtureId => (
  (REQUIRED_FIXTURE_IDS as readonly string[]).includes(value)
);

/** Development-only query activation. Production ignores fixture parameters. */
export const resolveDevelopmentFixture = (
  search: string,
  isDevelopment: boolean,
): CampaignSessionState | null => {
  if (!isDevelopment) return null;
  const params = new URLSearchParams(search);
  const requestedFixture = params.get(FIXTURE_QUERY_KEY);
  if (!requestedFixture) return null;
  if (!isFixtureId(requestedFixture)) {
    throw new Error(`Unknown copywriting fixture “${requestedFixture}”. Fixture mode will not fall back to live state.`);
  }
  const requestedProduct = params.get('product');
  const product = requestedProduct === 'listing-copy' || requestedProduct === 'campaign-pack'
    ? requestedProduct
    : undefined;
  const requestedConflictOutput = params.get('conflictOutput');
  const conflictOutputId = requestedConflictOutput && CAMPAIGN_PACK_OUTPUT_ORDER.includes(requestedConflictOutput as PreviewTab)
    ? requestedConflictOutput as PreviewTab
    : undefined;
  return getFixtureState(requestedFixture, { product, conflictOutputId });
};
