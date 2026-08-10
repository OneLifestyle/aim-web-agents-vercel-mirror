import type { PreviewTab } from '../types';
import {
  CAMPAIGN_PACK_OUTPUT_ORDER,
  CANONICAL_OUTPUT_GROUPS,
  CANONICAL_OUTPUT_ORDER,
  assembleGenerationParamsFromApprovedSnapshot,
  assertCanonicalOutputInventory,
  assertSerializableCampaignSessionState,
  buildApprovedBriefSnapshot,
  buildExportEligibilityInput,
  computeApprovedBriefSnapshotId,
  deriveBriefApprovalPresentation,
  deriveCampaignPackState,
  findExcludedClaimConflict,
  getApprovedBriefBlockers,
  getOutputEligibility,
  markOutputsNeedsRegeneration,
  markPackChildrenNeedsRegenerationForFoundation,
  mergeScopedRetryOutputs,
  normalizeHardExclusion,
  stripPhotoDependentDirection,
  validateReturnedOutput,
} from '../domain';
import {
  FIXTURE_APPROVED_AT,
  FIXTURE_GENERATED_AT,
  FIXTURE_CATALOGUE,
  REQUIRED_FIXTURE_IDS,
  getFixtureState,
  resolveDevelopmentFixture,
} from './catalogue';
import {
  FixtureNetworkAccessError,
  assertNetworkAllowed,
  isNoNetworkFixtureState,
} from './runtime';
import { buildGuidedExportPlan } from '../utils/guidedExport';

export interface FixtureAssertionReport {
  passed: true;
  assertionCount: number;
  fixtureCount: number;
  coveredOutputIds: PreviewTab[];
}

const comparableJson = (value: unknown): string => JSON.stringify(value);
const countWords = (value: string): number => value.trim().split(/\s+/).filter(Boolean).length;
const countLinesMatching = (value: string, pattern: RegExp): number => (
  value.split('\n').filter(line => pattern.test(line.trim())).length
);

export const runFixtureAssertions = (): FixtureAssertionReport => {
  let assertionCount = 0;
  const assert: (condition: unknown, message: string) => asserts condition = (condition, message) => {
    assertionCount += 1;
    if (!condition) throw new Error(`Copywriting fixture assertion failed: ${message}`);
  };

  assertCanonicalOutputInventory();
  assert(CANONICAL_OUTPUT_ORDER.length === 17, 'all 17 stable output identifiers must be present');
  assert(CAMPAIGN_PACK_OUTPUT_ORDER.length === 16, 'Campaign Pack must contain exactly 16 children');
  assert(new Set(CANONICAL_OUTPUT_ORDER).size === 17, 'output identifiers must not be duplicated');
  assert(
    comparableJson(Object.keys(FIXTURE_CATALOGUE)) === comparableJson(REQUIRED_FIXTURE_IDS),
    'fixture catalogue order and required IDs must be identical',
  );

  for (const fixtureId of REQUIRED_FIXTURE_IDS) {
    const state = getFixtureState(fixtureId);
    assertSerializableCampaignSessionState(state);
    assert(isNoNetworkFixtureState(state), `${fixtureId} must carry the hard no-network marker`);
    assert(state.fixture.id === fixtureId, `${fixtureId} must preserve its stable fixture identity`);
  }
  assert(
    comparableJson(getFixtureState('brief.ready')) === comparableJson(getFixtureState('brief.ready')),
    'fixture construction must be deterministic',
  );
  assert(
    resolveDevelopmentFixture('?fixture=brief.ready', false) === null,
    'production runtime must ignore fixture query activation',
  );
  assert(
    resolveDevelopmentFixture('?fixture=brief.ready', true)?.fixture.id === 'brief.ready',
    'development fixture query must select the requested fixture',
  );
  assert(
    resolveDevelopmentFixture('?fixture=start.product-selected&product=listing-copy', true)?.product === 'listing-copy',
    'product-selected fixture must support the Listing Copy variant',
  );
  let unknownFixtureThrew = false;
  try {
    resolveDevelopmentFixture('?fixture=not-a-real-fixture', true);
  } catch {
    unknownFixtureThrew = true;
  }
  assert(unknownFixtureThrew, 'unknown development fixture must throw rather than fall back to live runtime');
  let networkGuardThrew = false;
  try {
    assertNetworkAllowed(getFixtureState('brief.ready'), 'generateCopy');
  } catch (error) {
    networkGuardThrew = error instanceof FixtureNetworkAccessError;
  }
  assert(networkGuardThrew, 'fixture mode must fail loudly before a provider/network fallback');

  const readyBrief = getFixtureState('brief.ready');
  const readyBriefBlockers = getApprovedBriefBlockers(readyBrief);
  const readyBriefPresentation = deriveBriefApprovalPresentation(readyBrief, readyBriefBlockers);
  assert(readyBriefBlockers.length === 0, 'brief.ready must have no approval blocker');
  assert(!readyBrief.brief.approved && readyBrief.brief.snapshot === null, 'brief.ready must be reviewed but not yet approved');
  assert(readyBriefPresentation.state === 'READY_TO_APPROVE', 'brief.ready must derive READY_TO_APPROVE');
  assert(readyBriefPresentation.statusLabel === 'Ready to approve', 'brief.ready campaign-bar status must be Ready to approve');
  assert(readyBriefPresentation.statusLabel === 'Ready to approve', 'brief.ready stage status must be Ready to approve');
  assert(readyBriefPresentation.noticeTitle === 'Brief is ready for approval', 'brief.ready must show the ready-for-approval notice');
  assert(readyBriefPresentation.primaryActionLabel === 'Approve brief and continue', 'brief.ready primary CTA must approve the brief');
  assert(readyBriefPresentation.primaryAction !== 'open-outputs', 'brief.ready must not expose Open outputs as its primary action');

  const approvedBrief = getFixtureState('session.temporary');
  const approvedBriefBlockers = getApprovedBriefBlockers(approvedBrief);
  const approvedBriefPresentation = deriveBriefApprovalPresentation(approvedBrief, approvedBriefBlockers);
  assert(Boolean(approvedBrief.brief.snapshot) && approvedBrief.brief.approved, 'approved brief fixture must contain an approved snapshot');
  assert(approvedBriefPresentation.state === 'APPROVED', 'approved brief fixture must derive APPROVED');
  assert(approvedBriefPresentation.statusLabel === 'Approved', 'approved brief campaign-bar status must be Approved');
  assert(approvedBriefPresentation.statusLabel === 'Approved', 'approved brief stage status must be Approved');
  assert(approvedBriefPresentation.noticeTitle === null, 'approved brief must not show the ready-for-approval notice');
  assert(approvedBriefPresentation.primaryActionLabel === 'Open outputs', 'approved brief primary CTA must open outputs');
  assert(approvedBriefPresentation.primaryAction !== 'approve', 'approved brief must not expose another approval CTA');

  const safe = getFixtureState('six-car-garage-exclusion.safe');
  const safeSnapshot = safe.brief.snapshot;
  assert(Boolean(safeSnapshot), 'six-car safe fixture must have an Approved Brief Snapshot');
  assert(safe.listingGenerationSettings.approximateWordCount === 250, 'campaign session must default Listing Copy length to approximately 250 words');
  assert(safeSnapshot!.listingGenerationSettings.approximateWordCount === 250, 'approved snapshot must govern the default approximate Listing Copy length');
  assert(safeSnapshot!.approvedFacts.carSpaces === 2, 'approved car-space value must be 2');
  assert(
    computeApprovedBriefSnapshotId(JSON.parse(JSON.stringify(safeSnapshot!))) === safeSnapshot!.snapshotId,
    'snapshot ID must recompute after a JSON transport round trip',
  );
  const carFact = safeSnapshot!.factProvenance.find(fact => fact.key === 'carSpaces');
  assert(carFact?.sourceValue === 6, 'source car-space value must remain visible as 6');
  assert(carFact?.approvedValue === 2 && carFact.state === 'corrected', 'approved car-space provenance must be corrected to 2');
  const sixCarExclusion = safeSnapshot!.hardExclusions.find(claim => claim.id === 'claim.six-car-garage');
  assert(Boolean(sixCarExclusion), 'stable six-car exclusion ID must be retained');
  for (const alias of ['six-car garage', 'six car garage', '6-car garage', 'six vehicle garage', 'parking for six']) {
    assert(
      sixCarExclusion!.aliases.some(candidate => candidate.toLocaleLowerCase('en-AU') === alias),
      `six-car exclusion must include alias “${alias}”`,
    );
  }
  assert(
    !findExcludedClaimConflict(safeSnapshot!.propertyOverview, safeSnapshot!.hardExclusions),
    'contradictory lower-authority overview prose must be sanitised',
  );
  assert(
    !safeSnapshot!.propertyOverview.toLocaleLowerCase('en-AU').includes('six-car'),
    'sanitised property overview must not retain the source six-car sentence',
  );

  const safeGenerationParams = assembleGenerationParamsFromApprovedSnapshot(safeSnapshot!);
  assert(safeGenerationParams.output.wordCount === 250, 'generation params must use the snapshot-governed default Listing Copy length');
  const changedListingLength = getFixtureState('six-car-garage-exclusion.safe');
  changedListingLength.listingGenerationSettings.approximateWordCount = 500;
  const changedListingLengthSnapshot = buildApprovedBriefSnapshot(changedListingLength, {
    approvedAt: '2026-08-09T01:09:00.000Z',
  });
  const changedListingLengthParams = assembleGenerationParamsFromApprovedSnapshot(changedListingLengthSnapshot);
  assert(changedListingLengthSnapshot.snapshotId !== safeSnapshot!.snapshotId, 'Listing-length change must create a new stable snapshot hash');
  assert(changedListingLengthParams.output.wordCount === 500, 'generation params must use the changed snapshot-governed Listing length');
  const listingLengthStaleOutputs = markOutputsNeedsRegeneration(changedListingLength.outputs, changedListingLengthSnapshot.snapshotId);
  assert(
    CANONICAL_OUTPUT_ORDER.every(outputId => listingLengthStaleOutputs[outputId].state === 'needs-regeneration'),
    'Listing-length change must stale Listing Copy and all 16 Campaign Pack children',
  );
  for (const [field, value] of [
    ['researchData', safeGenerationParams.researchData ?? ''],
    ['features', safeGenerationParams.features],
    ['featuresToHighlight', safeGenerationParams.context.featuresToHighlight],
    ['imageAnalysis', safeGenerationParams.imageAnalysis ?? ''],
  ] as const) {
    assert(
      !findExcludedClaimConflict(value, safeSnapshot!.hardExclusions),
      `${field} must exclude every six-car alias`,
    );
  }
  assert(safeGenerationParams.details.cars === 2, 'legacy generation params must use approved two-car value');
  assert(safeGenerationParams.approvedBriefSnapshot.snapshotId === safeSnapshot!.snapshotId, 'generation params must bind the exact snapshot');

  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    const output = safe.outputs[outputId];
    assert(output.id === outputId, `${outputId} must retain its stable engine ID`);
    assert(output.state === 'ready', `${outputId} safe output must independently validate Ready`);
    assert(output.boundSnapshotId === safeSnapshot!.snapshotId, `${outputId} must bind to the safe snapshot`);
    assert(output.integrityIssues.length === 0, `${outputId} safe output must have no integrity issue`);
    assert(!findExcludedClaimConflict(output.content, safeSnapshot!.hardExclusions), `${outputId} must contain no excluded alias`);
  }

  const listingFixture = safe.outputs['Full Copy'].content;
  const brochureFixture = safe.outputs['Brochure Copy'].content;
  const smsFixture = safe.outputs['Coming Soon SMS'].content;
  const blogFixture = safe.outputs['Long-form / Blog'].content;
  const videoFixture = safe.outputs['Video Script'].content;
  assert(listingFixture.startsWith('# '), 'Listing Copy fixture must include a stable editorial headline');
  assert(listingFixture.split(/\n\s*\n/).length >= 7, 'Listing Copy fixture must contain several scrollable paragraphs');
  assert(countWords(listingFixture) >= 300, 'Listing Copy fixture must have realistic multi-paragraph depth');
  assert(countLinesMatching(brochureFixture, /^#{1,3}\s+/) >= 4, 'Brochure fixture must contain structured headings');
  assert(countLinesMatching(brochureFixture, /^[-*•]\s+/) >= 6, 'Brochure fixture must contain a concise feature list');
  assert(countWords(brochureFixture) >= 180, 'Brochure fixture must have medium-length copy');
  assert(!smsFixture.includes('\n') && !smsFixture.startsWith('#'), 'SMS fixture must remain one short unstructured channel message');
  assert(smsFixture.length >= 100 && smsFixture.length <= 180, 'SMS fixture must remain genuinely concise');
  assert(countLinesMatching(blogFixture, /^#{1,3}\s+/) >= 7, 'Blog fixture must contain a title and multiple subheadings');
  assert(countWords(blogFixture) >= 700, 'Blog fixture must substantially exceed one viewport');
  assert(countLinesMatching(videoFixture, /^#{1,3}\s+/) >= 7, 'Video Script fixture must contain a title and structured scene headings');
  assert(countWords(videoFixture) >= 350, 'Video Script fixture must contain several substantial body sections');
  assert(videoFixture.includes('VISUAL:') && videoFixture.includes('VOICEOVER:'), 'Video Script fixture must use a channel-specific production rhythm');
  assert(videoFixture !== listingFixture, 'Video Script and Listing Copy fixtures must be materially distinct documents');

  const safePack = deriveCampaignPackState(safe.outputs);
  assert(safePack.state === 'ready', 'safe parent Campaign Pack must be Ready');
  assert(safePack.readyOutputIds.length === 16, 'all 16 safe children must be Ready');
  assert(safePack.retryOutputIds.length === 0, 'complete safe pack must have no retry scope');
  const foundationRegeneratedOutputs = markPackChildrenNeedsRegenerationForFoundation(safe.outputs);
  assert(foundationRegeneratedOutputs['Full Copy'].state === 'ready', 'Listing Copy remains Ready after its successful regeneration');
  assert(
    CAMPAIGN_PACK_OUTPUT_ORDER.every(outputId => foundationRegeneratedOutputs[outputId].state === 'needs-regeneration'),
    'Listing Copy regeneration must stale all 16 dependent Campaign Pack outputs',
  );
  const safeExport = buildExportEligibilityInput(safe.outputs, safeSnapshot!.snapshotId);
  assert(safeExport.eligibleOutputIds.length === 17, 'safe export input must include Listing Copy and all 16 children');
  assert(safeExport.omitted.length === 0, 'safe export input must have no omissions');
  assert(
    !findExcludedClaimConflict(Object.values(safeExport.sections).join('\n'), safeSnapshot!.hardExclusions),
    'combined eligible export input must contain no excluded alias',
  );

  const conflict = getFixtureState('six-car-garage-exclusion.conflict', {
    conflictOutputId: 'Facebook Marketplace',
  });
  const conflictSnapshot = conflict.brief.snapshot!;
  const blockedSuggestion = conflict.campaign.suggestions.find(suggestion => suggestion.id === 'suggestion.six-car-conflict');
  assert(blockedSuggestion?.state === 'blocked', 'conflicting Campaign Direction suggestion must be blocked');
  assert(blockedSuggestion?.conflictClaimId === 'claim.six-car-garage', 'blocked suggestion must name the governing exclusion');
  const conflictingListing = conflict.outputs['Full Copy'];
  assert(conflictingListing.state === 'needs-review', 'bad returned Listing Copy must not become Ready');
  assert(
    conflictingListing.integrityIssues.some(issue => issue.claimId === 'claim.six-car-garage'),
    'bad Listing Copy must point to the governing six-car exclusion',
  );
  const listingEligibility = getOutputEligibility(conflictingListing, conflictSnapshot.snapshotId);
  assert(!listingEligibility.canCopy && !listingEligibility.canExport, 'integrity-conflicting Listing Copy must block Copy and Export');
  const conflictingChild = conflict.outputs['Facebook Marketplace'];
  assert(conflictingChild.state === 'needs-review', 'deliberately bad Campaign Pack child must need review');
  for (const outputId of CAMPAIGN_PACK_OUTPUT_ORDER.filter(id => id !== 'Facebook Marketplace')) {
    assert(conflict.outputs[outputId].state === 'ready', `${outputId} sibling must remain Ready after one child conflicts`);
  }
  const conflictPack = deriveCampaignPackState(conflict.outputs);
  assert(conflictPack.state === 'partial', 'parent with an integrity-blocked child must be Partial');
  assert(conflictPack.readyOutputIds.length === 15, 'conflict fixture must preserve fifteen ready siblings');
  assert(
    comparableJson(conflictPack.retryOutputIds) === comparableJson(['Facebook Marketplace']),
    'retry scope must contain only the conflicting child',
  );
  const conflictExport = buildExportEligibilityInput(conflict.outputs, conflictSnapshot.snapshotId);
  assert(!conflictExport.eligibleOutputIds.includes('Full Copy'), 'blocked Listing Copy must be omitted from export input');
  assert(!conflictExport.eligibleOutputIds.includes('Facebook Marketplace'), 'blocked child must be omitted from export input');
  assert(conflictExport.eligibleOutputIds.length === 15, 'conflict export input must preserve fifteen safe children');
  assert(
    !findExcludedClaimConflict(Object.values(conflictExport.sections).join('\n'), conflictSnapshot.hardExclusions),
    'eligible conflict-fixture export input must contain no excluded alias',
  );

  const failedSiblingFixture = getFixtureState('pack.failed-child-preserved-siblings');
  const failedPack = deriveCampaignPackState(failedSiblingFixture.outputs);
  assert(comparableJson(failedPack.retryOutputIds) === comparableJson(['TikTok']), 'failed-child retry scope must target TikTok only');
  const readySiblingBefore = comparableJson(failedSiblingFixture.outputs.Facebook);
  const retryReplacement = validateReturnedOutput({
    id: 'TikTok',
    content: 'TikTok: A four-bedroom Fictional Bay home with two bathrooms and two car spaces.',
    snapshot: failedSiblingFixture.brief.snapshot!,
    boundSnapshotId: failedSiblingFixture.brief.snapshot!.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  const retriedOutputs = mergeScopedRetryOutputs(
    failedSiblingFixture.outputs,
    failedPack.retryOutputIds,
    { TikTok: retryReplacement },
  );
  assert(comparableJson(retriedOutputs.Facebook) === readySiblingBefore, 'retry must preserve a ready sibling byte-for-byte');
  assert(retriedOutputs.TikTok.state === 'ready', 'scoped retry may replace the declared failed child');
  let outOfScopeRetryThrew = false;
  try {
    mergeScopedRetryOutputs(failedSiblingFixture.outputs, failedPack.retryOutputIds, {
      Facebook: failedSiblingFixture.outputs.Facebook,
    });
  } catch {
    outOfScopeRetryThrew = true;
  }
  assert(outOfScopeRetryThrew, 'retry merger must reject replacement of a successful sibling');

  const partial = getFixtureState('pack.partial');
  const partialPack = deriveCampaignPackState(partial.outputs);
  assert(partialPack.readyOutputIds.length === 14, 'partial fixture must have fourteen ready children');
  assert(partialPack.failedOutputIds.length === 1, 'partial fixture must have one failed child');
  assert(partialPack.missingOutputIds.length === 1, 'partial fixture must have one remaining child');
  assert(
    comparableJson(partialPack.retryOutputIds) === comparableJson(['TikTok', 'Video Script']),
    'partial retry scope must include only failed and missing children in canonical order',
  );

  const staleFromFact = getFixtureState('six-car-garage-exclusion.safe');
  const fact = staleFromFact.property.facts.find(candidate => candidate.key === 'carSpaces')!;
  fact.approvedValue = 3;
  fact.state = 'corrected';
  staleFromFact.campaign.emphasis = staleFromFact.campaign.emphasis.map(text => text.replace('two car spaces', 'three car spaces'));
  const changedFactSnapshot = buildApprovedBriefSnapshot(staleFromFact, {
    approvedAt: '2026-08-09T01:10:00.000Z',
  });
  assert(changedFactSnapshot.snapshotId !== safeSnapshot!.snapshotId, 'governing fact change must create a new stable snapshot hash');
  const factStaleOutputs = markOutputsNeedsRegeneration(staleFromFact.outputs, changedFactSnapshot.snapshotId);
  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    assert(factStaleOutputs[outputId].state === 'needs-regeneration', `${outputId} must stale after the car-space change`);
  }

  const staleFromExclusion = getFixtureState('six-car-garage-exclusion.safe');
  const excludedClaim = staleFromExclusion.property.claims.find(claim => claim.id === 'claim.six-car-garage')!;
  excludedClaim.state = 'corrected';
  excludedClaim.approvedText = 'Two-car garage';
  excludedClaim.aliases = [];
  const changedExclusionSnapshot = buildApprovedBriefSnapshot(staleFromExclusion, {
    approvedAt: '2026-08-09T01:11:00.000Z',
  });
  assert(changedExclusionSnapshot.snapshotId !== safeSnapshot!.snapshotId, 'exclusion-state change must create a new snapshot hash');
  const exclusionStaleOutputs = markOutputsNeedsRegeneration(staleFromExclusion.outputs, changedExclusionSnapshot.snapshotId);
  assert(
    CANONICAL_OUTPUT_ORDER.every(outputId => exclusionStaleOutputs[outputId].state === 'needs-regeneration'),
    'exclusion-state change must stale Listing Copy and all 16 children',
  );

  const photosOff = getFixtureState('photos.off');
  const photosOffSnapshot = buildApprovedBriefSnapshot(photosOff, { approvedAt: FIXTURE_APPROVED_AT });
  const photosOffParams = assembleGenerationParamsFromApprovedSnapshot(photosOffSnapshot);
  assert(photosOffSnapshot.photoContext.selectedPhotos.length === 0, 'photo off snapshot must serialise no selected photos');
  assert(photosOffSnapshot.photoContext.approvedHighlights.length === 0, 'photo off snapshot must serialise no highlights');
  assert(photosOffParams.imageAnalysis === null, 'photo off generation params must contain no image analysis');

  const photosIncluded = getFixtureState('photos.included-reviewed');
  const photosIncludedSnapshot = buildApprovedBriefSnapshot(photosIncluded, { approvedAt: FIXTURE_APPROVED_AT });
  const photosIncludedParams = assembleGenerationParamsFromApprovedSnapshot(photosIncludedSnapshot);
  assert(photosIncludedSnapshot.photoContext.selectedPhotos.length === 2, 'included photo snapshot must contain selected photos only');
  assert(photosIncludedSnapshot.photoContext.approvedHighlights.length === 2, 'included photo snapshot must contain approved/corrected highlights only');
  assert(Boolean(photosIncludedParams.imageAnalysis?.includes('North-facing living room with broad windows')), 'included params must contain approved highlight');
  assert(Boolean(photosIncludedParams.imageAnalysis?.includes('Bright kitchen with pale stone-look benchtops')), 'included params must contain corrected highlight');
  assert(!photosIncludedParams.imageAnalysis?.includes('Marble kitchen finishes'), 'included params must omit superseded photo wording');
  assert(!photosIncludedParams.imageAnalysis?.includes('Six vehicle garage'), 'included params must omit excluded photo highlight');

  const includedBlankOpenHome = getFixtureState('brief.ready');
  includedBlankOpenHome.people.openHomeIncluded = true;
  includedBlankOpenHome.people.openHome = { date: '', time: '', url: '' };
  assert(
    !getApprovedBriefBlockers(includedBlankOpenHome).some(blocker => blocker.id.startsWith('people.open-home')),
    'included Open Home context with blank optional fields must not block brief approval',
  );

  const noScheduleOpenHouse = getFixtureState('open-house.no-schedule');
  const noScheduleSnapshot = noScheduleOpenHouse.brief.snapshot!;
  const noScheduleOutput = noScheduleOpenHouse.outputs['Open House'];
  const noSchedulePack = deriveCampaignPackState(noScheduleOpenHouse.outputs);
  const noScheduleParams = assembleGenerationParamsFromApprovedSnapshot(noScheduleSnapshot);
  assert(noScheduleSnapshot.openHomeContext.included === false, 'no-schedule fixture must use the normal absent optional context state');
  assert(noScheduleParams.openHouse.date === '' && noScheduleParams.openHouse.time === '' && noScheduleParams.openHouse.url === '', 'no-schedule params must keep every optional value blank');
  assert(noScheduleOutput.state === 'ready', 'Open House without an approved schedule must become Ready');
  assert(noScheduleOutput.content.includes('Open House') && noScheduleOutput.content.includes('four-bedroom home'), 'no-schedule Open House must retain useful generic promotional copy');
  assert(/📅 Date:\s*\n/.test(noScheduleOutput.content), 'no-schedule Open House must leave its Date value blank');
  assert(/⏰ Time:\s*\n/.test(noScheduleOutput.content), 'no-schedule Open House must leave its Time value blank');
  assert(!/\b(?:tbc|tbd|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\[(?:date|time|url)\]|\{\{?(?:date|time|url)\}?\}|https?:\/\//i.test(noScheduleOutput.content), 'no-schedule Open House fixture must not inject a schedule, URL or placeholder');
  assert(noSchedulePack.state === 'ready' && noSchedulePack.readyOutputIds.length === 16, 'no-schedule Campaign Pack must reach 16/16 Ready');

  const inventedNoScheduleOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House this Saturday at 11:00 am. Explore a welcoming four-bedroom home.',
    snapshot: noScheduleSnapshot,
    boundSnapshotId: noScheduleSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(inventedNoScheduleOutput.state === 'needs-review', 'an invented schedule without approved context must not become Ready');

  const dateOnlyOpenHouse = getFixtureState('open-house.date-only');
  const dateOnlySnapshot = dateOnlyOpenHouse.brief.snapshot!;
  const dateOnlyOutput = dateOnlyOpenHouse.outputs['Open House'];
  assert(dateOnlySnapshot.openHomeContext.date === '2026-08-22' && dateOnlySnapshot.openHomeContext.time === '', 'date-only snapshot must preserve the approved date and blank time');
  assert(dateOnlyOutput.state === 'ready' && dateOnlyOutput.content.includes('2026-08-22'), 'date-only Open House must preserve its approved date and become Ready');
  assert(/⏰ Time:\s*\n/.test(dateOnlyOutput.content), 'date-only Open House must leave its Time value blank');

  const timeOnlyOpenHouse = getFixtureState('open-house.time-only');
  const timeOnlySnapshot = timeOnlyOpenHouse.brief.snapshot!;
  const timeOnlyOutput = timeOnlyOpenHouse.outputs['Open House'];
  assert(timeOnlySnapshot.openHomeContext.date === '' && timeOnlySnapshot.openHomeContext.time === '11:00', 'time-only snapshot must preserve the approved time and blank date');
  assert(timeOnlyOutput.state === 'ready' && timeOnlyOutput.content.includes('11:00'), 'time-only Open House must preserve its approved time and become Ready');
  assert(/📅 Date:\s*\n/.test(timeOnlyOutput.content), 'time-only Open House must leave its Date value blank');

  const fullScheduleOpenHouse = getFixtureState('open-house.full-schedule');
  const fullScheduleSnapshot = fullScheduleOpenHouse.brief.snapshot!;
  const fullScheduleOutput = fullScheduleOpenHouse.outputs['Open House'];
  assert(fullScheduleOutput.state === 'ready', 'full-schedule Open House must become Ready');
  assert(
    fullScheduleOutput.content.includes(fullScheduleSnapshot.openHomeContext.date)
      && fullScheduleOutput.content.includes(fullScheduleSnapshot.openHomeContext.time),
    'full-schedule Open House must preserve both approved values',
  );

  const conflictingScheduleOpenHouse = getFixtureState('open-house.conflicting-approved-schedule');
  const conflictingScheduleOutput = conflictingScheduleOpenHouse.outputs['Open House'];
  const conflictingSchedulePack = deriveCampaignPackState(conflictingScheduleOpenHouse.outputs);
  assert(conflictingScheduleOutput.state === 'needs-review', 'conflicting approved Open House schedule must not become Ready');
  assert(conflictingScheduleOutput.integrityIssues.some(issue => issue.governingBriefItem === 'Open home context'), 'conflicting schedule must identify Open home context as the governing brief item');
  assert(conflictingSchedulePack.state === 'partial' && conflictingSchedulePack.readyOutputIds.length === 15, 'conflicting Open House must preserve fifteen Ready Campaign Pack siblings');
  assert(comparableJson(conflictingSchedulePack.retryOutputIds) === comparableJson(['Open House']), 'conflicting schedule retry scope must contain only Open House');

  assert(safe.outputs['Open House'].state === 'ready', 'supplied Open House URL must retain Ready integrity when preserved');
  assert(safe.outputs['Open House'].content.includes(safeSnapshot!.openHomeContext.url), 'supplied approved Open House URL must be preserved exactly');

  const openHouseMissingContext = validateReturnedOutput({
    id: 'Open House',
    content: 'Join us for an open home at 11:00 am.',
    snapshot: safeSnapshot!,
    boundSnapshotId: safeSnapshot!.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    openHouseMissingContext.integrityIssues.some(issue => issue.code === 'missing-required-context'),
    'Open House output missing its approved date must not become Ready',
  );
  const wrongSnapshotOutput = validateReturnedOutput({
    id: 'Email',
    content: 'A four-bedroom home with two bathrooms and two car spaces.',
    snapshot: safeSnapshot!,
    boundSnapshotId: 'brief-earlier',
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    wrongSnapshotOutput.integrityIssues.some(issue => issue.code === 'snapshot-mismatch'),
    'wrong snapshot binding must prevent Ready',
  );

  const repeatSnapshot = buildApprovedBriefSnapshot(safe, {
    approvedAt: '2026-08-09T09:59:59.000Z',
    statement: safeSnapshot!.humanApproval.statement,
  });
  assert(
    repeatSnapshot.snapshotId === safeSnapshot!.snapshotId,
    'snapshot hash must be stable across approval-clock changes for identical governing content',
  );

  const liveSixCarExclusion = normalizeHardExclusion({
    id: 'claim.live-six-car',
    text: 'six-car garage',
    aliases: [],
    provenance: 'Live reviewed claim',
  });
  for (const alias of ['six-car garage', 'six car garage', '6-car garage', 'six vehicle garage', 'parking for six']) {
    assert(
      liveSixCarExclusion.aliases.some(candidate => candidate.toLocaleLowerCase('en-AU') === alias),
      `live six-car exclusion must expand alias “${alias}”`,
    );
  }

  const unitCorrection = getFixtureState('brief.ready');
  const unitLandFact = unitCorrection.property.facts.find(candidate => candidate.key === 'landValue')!;
  unitLandFact.sourceValue = 742;
  unitLandFact.approvedValue = 742;
  unitLandFact.sourceUnit = 'm²';
  unitLandFact.unit = 'acres';
  unitLandFact.state = 'corrected';
  unitCorrection.property.overview = 'Set across 742 m². A calm garden outlook completes the setting.';
  const unitSnapshot = buildApprovedBriefSnapshot(unitCorrection, { approvedAt: FIXTURE_APPROVED_AT });
  assert(!unitSnapshot.propertyOverview.includes('742 m²'), 'unit-only correction must sanitise the superseded source unit from context');
  const staleUnitOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'Set across 742 m² with a calm garden outlook.',
    snapshot: unitSnapshot,
    boundSnapshotId: unitSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    staleUnitOutput.integrityIssues.some(issue => issue.code === 'superseded-fact'),
    'returned output using a superseded land unit must not become Ready',
  );

  const expandedPropertyType = getFixtureState('brief.ready');
  const propertyTypeFact = expandedPropertyType.property.facts.find(candidate => candidate.key === 'propertyType')!;
  propertyTypeFact.sourceValue = 'House';
  propertyTypeFact.approvedValue = 'House and studio';
  propertyTypeFact.state = 'corrected';
  expandedPropertyType.property.overview = 'A House and studio arranged around a calm garden.';
  const expandedPropertySnapshot = buildApprovedBriefSnapshot(expandedPropertyType, { approvedAt: FIXTURE_APPROVED_AT });
  assert(
    expandedPropertySnapshot.propertyOverview.includes('House and studio'),
    'approved property type containing its source phrase must survive lower-authority sanitation',
  );
  const expandedPropertyOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A four-bedroom House and studio with two bathrooms and two car spaces.',
    snapshot: expandedPropertySnapshot,
    boundSnapshotId: expandedPropertySnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(expandedPropertyOutput.state === 'ready', 'exact approved expanded property type must validate Ready');

  const containedPhotoWording = getFixtureState('photos.included-reviewed');
  const containedHighlight = containedPhotoWording.photos.highlights.find(highlight => highlight.imageId === 'photo.01')!;
  containedHighlight.sourceText = 'Broad windows';
  containedHighlight.approvedText = 'North-facing living room with broad windows';
  containedHighlight.state = 'corrected';
  const containedPhotoSnapshot = buildApprovedBriefSnapshot(containedPhotoWording, { approvedAt: FIXTURE_APPROVED_AT });
  const containedPhotoOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'North-facing living room with broad windows.',
    snapshot: containedPhotoSnapshot,
    boundSnapshotId: containedPhotoSnapshot.snapshotId,
    usedPhotoContext: true,
    knownPhotoHighlights: containedPhotoWording.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(containedPhotoOutput.state === 'ready', 'approved photo wording containing its source phrase must validate Ready');

  const photoDependentDirection = getFixtureState('direction.approved');
  photoDependentDirection.campaign.emphasis.push('Light-filled living room from Photo 1');
  photoDependentDirection.campaign.suggestions.push({
    id: 'suggestion.photo-dependent.fixture',
    kind: 'selling-point',
    text: 'Light-filled living room from Photo 1',
    state: 'applied',
    dependsOnPhotoContext: true,
  });
  const strippedPhotoDirection = stripPhotoDependentDirection(photoDependentDirection);
  assert(!strippedPhotoDirection.campaign.approved, 'effective photo change must reopen Campaign Direction approval');
  assert(
    !strippedPhotoDirection.campaign.emphasis.includes('Light-filled living room from Photo 1'),
    'effective photo change must remove applied photo-derived emphasis',
  );
  assert(
    !strippedPhotoDirection.campaign.suggestions.some(suggestion => suggestion.dependsOnPhotoContext),
    'effective photo change must remove dependent proposals',
  );

  const fetchedOverviewBlockers = getApprovedBriefBlockers(getFixtureState('property.fetched'));
  assert(
    fetchedOverviewBlockers.some(blocker => blocker.id === 'property.overview'),
    'a fetched property overview must receive a human Confirm or Exclude decision',
  );
  const contextExcluded = getFixtureState('brief.ready');
  contextExcluded.property.overviewState = 'excluded';
  contextExcluded.property.profileInclusion = 'none';
  const contextExcludedSnapshot = buildApprovedBriefSnapshot(contextExcluded, { approvedAt: FIXTURE_APPROVED_AT });
  const contextExcludedParams = assembleGenerationParamsFromApprovedSnapshot(contextExcludedSnapshot);
  assert(contextExcludedSnapshot.propertyOverview === '', 'excluded property overview must serialise as empty context');
  assert(
    contextExcludedSnapshot.profileInclusion === 'none'
      && contextExcludedSnapshot.suburbContext === ''
      && contextExcludedSnapshot.areaContext === '',
    'location inclusion None must serialise no suburb or area context',
  );
  assert(contextExcludedParams.profileData === null, 'location inclusion None must produce no legacy profile payload');

  const afternoonOpenHouse = getFixtureState('brief.ready');
  afternoonOpenHouse.people.openHome.time = '13:00';
  const afternoonSnapshot = buildApprovedBriefSnapshot(afternoonOpenHouse, { approvedAt: FIXTURE_APPROVED_AT });
  const afternoonOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House on Saturday 22 August 2026 at 1:00 pm. https://example.test/open-home/fictional-bay',
    snapshot: afternoonSnapshot,
    boundSnapshotId: afternoonSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(afternoonOutput.state === 'ready', 'approved 13:00 Open Home time must accept equivalent 1:00 pm output wording');

  const openHousePropertyType = getFixtureState('brief.ready');
  const openHousePropertyTypeFact = openHousePropertyType.property.facts.find(candidate => candidate.key === 'propertyType')!;
  openHousePropertyTypeFact.sourceValue = 'House';
  openHousePropertyTypeFact.approvedValue = 'Townhouse';
  openHousePropertyTypeFact.state = 'corrected';
  const openHousePropertyTypeSnapshot = buildApprovedBriefSnapshot(openHousePropertyType, { approvedAt: FIXTURE_APPROVED_AT });
  const openHousePropertyTypeOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House on Saturday 22 August 2026 at 11:00 am for this welcoming townhouse. https://example.test/open-home/fictional-bay',
    snapshot: openHousePropertyTypeSnapshot,
    boundSnapshotId: openHousePropertyTypeSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(openHousePropertyTypeOutput.state === 'ready', 'property-type correction House to Townhouse must not treat Open House as stale wording');

  const groupedLand = getFixtureState('brief.ready');
  const groupedLandFact = groupedLand.property.facts.find(candidate => candidate.key === 'landValue')!;
  groupedLandFact.sourceValue = 1000;
  groupedLandFact.approvedValue = 1000;
  groupedLandFact.state = 'confirmed';
  const groupedLandSnapshot = buildApprovedBriefSnapshot(groupedLand, { approvedAt: FIXTURE_APPROVED_AT });
  const groupedLandOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'Set across 1,000 m² with a calm garden outlook.',
    snapshot: groupedLandSnapshot,
    boundSnapshotId: groupedLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(groupedLandOutput.state === 'ready', 'approved grouped land value 1,000 m² must validate Ready');

  const supersededSqm = getFixtureState('brief.ready');
  const supersededSqmFact = supersededSqm.property.facts.find(candidate => candidate.key === 'landValue')!;
  supersededSqmFact.sourceValue = 600;
  supersededSqmFact.approvedValue = 742;
  supersededSqmFact.state = 'corrected';
  const supersededSqmSnapshot = buildApprovedBriefSnapshot(supersededSqm, { approvedAt: FIXTURE_APPROVED_AT });
  for (const wording of ['600sqm', '600 sq m']) {
    const staleLandOutput = validateReturnedOutput({
      id: 'Full Copy',
      content: `Set on ${wording} with a calm garden outlook.`,
      snapshot: supersededSqmSnapshot,
      boundSnapshotId: supersededSqmSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(staleLandOutput.state === 'needs-review', `superseded land wording ${wording} must not reach Ready`);
  }

  const fullCampaignExport = buildGuidedExportPlan({
    address: safeSnapshot!.selectedAddress,
    documents: CANONICAL_OUTPUT_ORDER.map(outputId => safe.outputs[outputId]),
    orderedTabs: CANONICAL_OUTPUT_ORDER,
    categories: CANONICAL_OUTPUT_GROUPS.map(group => ({ title: group.label, tabs: [...group.outputIds] })),
    selectedTab: 'Full Copy',
    selectedGroup: CANONICAL_OUTPUT_GROUPS[0].label,
    scope: 'campaign_pack',
    format: 'word',
    activeSnapshotId: safeSnapshot!.snapshotId,
    generatedAt: new Date(FIXTURE_GENERATED_AT),
    includeContactDetails: false,
    includeAddressInCopy: safeSnapshot!.includeAddressInCopy,
    campaignPackOutputIds: CAMPAIGN_PACK_OUTPUT_ORDER,
  });
  assert(
    fullCampaignExport.counts.included === 17 && fullCampaignExport.counts.total === 17,
    'full campaign export must include Listing Copy plus all 16 eligible Campaign Pack outputs',
  );

  return {
    passed: true,
    assertionCount,
    fixtureCount: REQUIRED_FIXTURE_IDS.length,
    coveredOutputIds: [...CANONICAL_OUTPUT_ORDER],
  };
};

export const runDevelopmentFixtureAssertions = (isDevelopment: boolean): FixtureAssertionReport | null => (
  isDevelopment ? runFixtureAssertions() : null
);
