import type { LandUnit, PreviewTab } from '../types';
import {
  CAMPAIGN_PACK_OUTPUT_ORDER,
  CANONICAL_OUTPUT_GROUPS,
  CANONICAL_OUTPUT_ORDER,
  LAND_APPROXIMATION_RELATIVE_TOLERANCE,
  LAND_NORMAL_ROUNDING_RELATIVE_TOLERANCE,
  LAND_SQUARE_METRES_PER_UNIT,
  assembleGenerationParamsFromApprovedSnapshot,
  assertCanonicalOutputInventory,
  assertSerializableCampaignSessionState,
  buildApprovedBriefSnapshot,
  buildExportEligibilityInput,
  compareLandMeasurements,
  computeApprovedBriefSnapshotId,
  deriveBriefApprovalPresentation,
  deriveCampaignPackState,
  findExcludedClaimConflict,
  findLandMeasurementMentions,
  findSupersededFactConflicts,
  getApprovedBriefBlockers,
  getOutputEligibility,
  markOutputsNeedsRegeneration,
  markPackChildrenNeedsRegenerationForFoundation,
  mergeScopedRetryOutputs,
  normalizeHardExclusion,
  sanitizeLowerAuthorityText,
  splitGovernanceListItems,
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
  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    const staleEligibility = getOutputEligibility(listingLengthStaleOutputs[outputId], changedListingLengthSnapshot.snapshotId);
    assert(!staleEligibility.canCopy && !staleEligibility.canExport, `${outputId} stale output must block Copy and Export`);
  }
  const listingLengthStaleExport = buildExportEligibilityInput(
    listingLengthStaleOutputs,
    changedListingLengthSnapshot.snapshotId,
  );
  assert(
    listingLengthStaleExport.counts.included === 0 && listingLengthStaleExport.counts.stale === 17,
    'all stale outputs must be omitted and classified as stale by export eligibility',
  );
  const listingLengthStalePack = deriveCampaignPackState(listingLengthStaleOutputs);
  assert(
    listingLengthStalePack.state === 'partial' && listingLengthStalePack.staleOutputIds.length === 16,
    'a Campaign Pack with sixteen stale children must derive Partial with a 16-item regeneration scope',
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

  const decimalLandOpenHouse = getFixtureState('open-house.blank-schedule-with-decimal-land');
  const decimalLandSnapshot = decimalLandOpenHouse.brief.snapshot!;
  const decimalLandFact = decimalLandSnapshot.factProvenance.find(fact => fact.key === 'landValue');
  const decimalLandOutput = decimalLandOpenHouse.outputs['Open House'];
  const decimalLandPack = deriveCampaignPackState(decimalLandOpenHouse.outputs);
  assert(
    decimalLandFact?.approvedValue === 2.02 && decimalLandFact.unit === 'ha' && decimalLandFact.state === 'corrected',
    'decimal-land fixture must govern the corrected 2.02 ha value',
  );
  assert(decimalLandSnapshot.openHomeContext.date === '', 'decimal-land Open House must keep approved date blank');
  assert(decimalLandSnapshot.openHomeContext.time === '', 'decimal-land Open House must keep approved time blank');
  assert(decimalLandSnapshot.openHomeContext.url === '', 'decimal-land Open House must keep approved URL blank');
  assert(decimalLandOutput.content.includes('2.02 ha'), 'decimal-land Open House must contain the corrected land measurement');
  assert(/📅 Date:\s*\n/.test(decimalLandOutput.content), 'decimal-land Open House must render a blank Date label');
  assert(/⏰ Time:\s*\n/.test(decimalLandOutput.content), 'decimal-land Open House must render a blank Time label');
  assert(decimalLandOutput.state === 'ready', 'decimal-land Open House must become Ready');
  assert(decimalLandOutput.integrityIssues.length === 0, 'decimal-land Open House must have zero integrity issues');
  assert(
    decimalLandPack.state === 'ready'
      && decimalLandPack.readyOutputIds.length === 16
      && decimalLandPack.blockedOutputIds.length === 0
      && decimalLandPack.remainingOutputIds.length === 0,
    'decimal-land Campaign Pack must derive 16 Ready, 0 blocked and 0 remaining',
  );

  for (const decimalMeasurement of [
    { text: '1.25 ha', value: 1.25, unit: 'ha' },
    { text: '2.02 ha', value: 2.02, unit: 'ha' },
    { text: '10.50 acres', value: 10.5, unit: 'acres' },
    { text: '202.50 m²', value: 202.5, unit: 'm²' },
  ] as const) {
    const measurementBrief = getFixtureState('brief.ready');
    const measurementLandFact = measurementBrief.property.facts.find(fact => fact.key === 'landValue')!;
    measurementLandFact.sourceValue = decimalMeasurement.value;
    measurementLandFact.approvedValue = decimalMeasurement.value;
    measurementLandFact.sourceUnit = decimalMeasurement.unit;
    measurementLandFact.unit = decimalMeasurement.unit;
    measurementLandFact.state = 'confirmed';
    measurementBrief.people.openHomeIncluded = false;
    measurementBrief.people.openHome = { date: '', time: '', url: '' };
    const measurementSnapshot = buildApprovedBriefSnapshot(measurementBrief, { approvedAt: FIXTURE_APPROVED_AT });
    const decimalMeasurementOutput = validateReturnedOutput({
      id: 'Open House',
      content: `Open House\nDate:\nTime:\nLand: ${decimalMeasurement.text}`,
      snapshot: measurementSnapshot,
      boundSnapshotId: measurementSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(decimalMeasurementOutput.state === 'ready', `${decimalMeasurement.text} must not be classified as an Open House time`);
  }

  const ambiguousDotBrief = getFixtureState('brief.ready');
  const ambiguousDotLandFact = ambiguousDotBrief.property.facts.find(fact => fact.key === 'landValue')!;
  ambiguousDotLandFact.sourceValue = 2.3;
  ambiguousDotLandFact.approvedValue = 2.3;
  ambiguousDotLandFact.sourceUnit = 'ha';
  ambiguousDotLandFact.unit = 'ha';
  ambiguousDotLandFact.state = 'confirmed';
  ambiguousDotBrief.people.openHomeIncluded = false;
  ambiguousDotBrief.people.openHome = { date: '', time: '', url: '' };
  const ambiguousDotSnapshot = buildApprovedBriefSnapshot(ambiguousDotBrief, { approvedAt: FIXTURE_APPROVED_AT });
  const ambiguousDotTime = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House\nDate:\nTime:\nLand: 2.30 ha',
    snapshot: ambiguousDotSnapshot,
    boundSnapshotId: ambiguousDotSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(ambiguousDotTime.state === 'ready', 'dot-separated 2.30 without am/pm must not be classified as time syntax');

  for (const legitimateTime of ['14:30', '09:05', '2:30 pm', '2:30pm', '2.30 pm', '2.30pm', '2 pm', '11 am']) {
    const inventedTimeOutput = validateReturnedOutput({
      id: 'Open House',
      content: `Open House\nDate:\nTime:\nJoin us at ${legitimateTime}.`,
      snapshot: noScheduleSnapshot,
      boundSnapshotId: noScheduleSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      inventedTimeOutput.state === 'needs-review'
        && inventedTimeOutput.integrityIssues.some(issue => issue.message.includes('unapproved time')),
      `${legitimateTime} must remain detected as an invented Open House time`,
    );
  }

  for (const placeholder of ['TBC', 'TBD', '[DATE]', '[TIME]', '{{date}}', '{{time}}']) {
    const placeholderOutput = validateReturnedOutput({
      id: 'Open House',
      content: `Open House\nDate: ${placeholder}\nTime:`,
      snapshot: noScheduleSnapshot,
      boundSnapshotId: noScheduleSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      placeholderOutput.state === 'needs-review'
        && placeholderOutput.integrityIssues.some(issue => issue.message.includes('unresolved placeholder')),
      `${placeholder} must remain rejected as an unresolved Open House placeholder`,
    );
  }

  for (const inventedDate of ['Saturday', '10 August 2026', '10/08/2026']) {
    const inventedDateOutput = validateReturnedOutput({
      id: 'Open House',
      content: `Open House\nDate: ${inventedDate}\nTime:`,
      snapshot: noScheduleSnapshot,
      boundSnapshotId: noScheduleSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      inventedDateOutput.state === 'needs-review'
        && inventedDateOutput.integrityIssues.some(issue => issue.message.includes('unapproved date')),
      `${inventedDate} must remain detected as an invented Open House date`,
    );
  }

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

  const urlOnlyOpenHouse = getFixtureState('brief.ready');
  urlOnlyOpenHouse.people.openHomeIncluded = true;
  urlOnlyOpenHouse.people.openHome = {
    date: '',
    time: '',
    url: 'https://example.test/open-home/url-only',
  };
  const urlOnlySnapshot = buildApprovedBriefSnapshot(urlOnlyOpenHouse, { approvedAt: FIXTURE_APPROVED_AT });
  const urlOnlyOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House details: https://example.test/open-home/url-only',
    snapshot: urlOnlySnapshot,
    boundSnapshotId: urlOnlySnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(urlOnlyOutput.state === 'ready', 'URL-only Open Home context must be Ready while date and time remain blank');
  const inventedUrlOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House details: https://example.test/open-home/invented',
    snapshot: noScheduleSnapshot,
    boundSnapshotId: noScheduleSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(inventedUrlOutput.state === 'needs-review', 'an invented Open Home URL with no approved URL must remain blocked');
  const conflictingUrlOutput = validateReturnedOutput({
    id: 'Open House',
    content: 'Open House details: https://example.test/open-home/url-only and https://example.test/open-home/url-only-extra',
    snapshot: urlOnlySnapshot,
    boundSnapshotId: urlOnlySnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(conflictingUrlOutput.state === 'needs-review', 'an additional unapproved URL must be blocked even when the approved URL is present');

  const conflictingExtraScheduleOutput = validateReturnedOutput({
    id: 'Open House',
    content: [
      'Open House on Saturday 22 August 2026 at 11:00 am.',
      'An alternative inspection is advertised for Sunday 23 August 2026 at 2:00 pm.',
      safeSnapshot!.openHomeContext.url,
    ].join(' '),
    snapshot: safeSnapshot!,
    boundSnapshotId: safeSnapshot!.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(conflictingExtraScheduleOutput.state === 'needs-review', 'extra invented date/time context must block even when approved schedule values are present');

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

  assert(LAND_SQUARE_METRES_PER_UNIT['m²'] === 1, 'canonical land base unit must be one square metre');
  assert(LAND_SQUARE_METRES_PER_UNIT.ha === 10_000, 'one hectare must equal exactly 10,000 square metres');
  assert(LAND_SQUARE_METRES_PER_UNIT.acres === 4_046.8564224, 'one acre must use the exact approved square-metre conversion');
  assert(LAND_NORMAL_ROUNDING_RELATIVE_TOLERANCE === 0.0025, 'normal conversion rounding must remain capped at 0.25%');
  assert(LAND_APPROXIMATION_RELATIVE_TOLERANCE === 0.01, 'explicit approximation must remain capped at 1%');

  const exactLandComparison = compareLandMeasurements(
    { value: 20_200, unit: 'm²' },
    { value: 2.02, unit: 'ha' },
  );
  assert(exactLandComparison.equivalent && exactLandComparison.reason === 'exact', '20,200 m² and 2.02 ha must be canonically exact');
  assert(exactLandComparison.leftSquareMetres === 20_200 && exactLandComparison.rightSquareMetres === 20_200, 'exact conversion must canonicalise both sides to 20,200 m²');
  const fiveAcreComparison = compareLandMeasurements(
    { value: 5, unit: 'acres' },
    { value: 2.02, unit: 'ha' },
  );
  assert(fiveAcreComparison.equivalent && fiveAcreComparison.reason === 'display-rounding', 'five acres must fit conservative normal conversion rounding for 2.02 ha');
  assert(fiveAcreComparison.differenceSquareMetres < fiveAcreComparison.allowedDifferenceSquareMetres, 'five-acre conversion difference must remain inside the capped allowance');
  const explicitApproximationComparison = compareLandMeasurements(
    { value: 5.04, unit: 'acres', decimalPlaces: 2, approximate: true },
    { value: 2.02, unit: 'ha' },
  );
  assert(
    explicitApproximationComparison.equivalent && explicitApproximationComparison.reason === 'explicit-approximation',
    'an explicit approximation inside 1% but outside normal rounding must use the approximation rule',
  );
  assert(
    !compareLandMeasurements(
      { value: 5.04, unit: 'acres', decimalPlaces: 2 },
      { value: 2.02, unit: 'ha' },
    ).equivalent,
    'the same 5.04-acre surface without approximation language must be rejected',
  );
  assert(
    !compareLandMeasurements(
      { value: 5.05, unit: 'acres', decimalPlaces: 2, approximate: true },
      { value: 2.02, unit: 'ha' },
    ).equivalent,
    'explicit approximation outside 1% must remain contradictory',
  );
  assert(
    !compareLandMeasurements(
      { value: 0.001, unit: 'm²', decimalPlaces: 3, approximate: true },
      { value: 0, unit: 'm²' },
    ).equivalent,
    'relative tolerances must not create an absolute allowance around zero land',
  );

  const createLandSnapshot = (
    sourceValue: number,
    sourceUnit: LandUnit,
    approvedValue: number,
    approvedUnit: LandUnit,
    sourceWording: string,
  ) => {
    const state = getFixtureState('brief.ready');
    const landFact = state.property.facts.find(candidate => candidate.key === 'landValue')!;
    landFact.sourceValue = sourceValue;
    landFact.approvedValue = approvedValue;
    landFact.sourceUnit = sourceUnit;
    landFact.unit = approvedUnit;
    landFact.state = sourceValue === approvedValue && sourceUnit === approvedUnit ? 'confirmed' : 'corrected';
    state.property.overview = `${sourceWording} A calm garden outlook remains.`;
    state.people.openHomeIncluded = false;
    state.people.openHome = { date: '', time: '', url: '' };
    return buildApprovedBriefSnapshot(state, { approvedAt: FIXTURE_APPROVED_AT });
  };
  const liveLandSnapshot = createLandSnapshot(
    20_200,
    'm²',
    2.02,
    'ha',
    'The holding extends across 20,200 m² of land.',
  );
  const liveLandFact = liveLandSnapshot.factProvenance.find(candidate => candidate.key === 'landValue')!;
  assert(liveLandFact.sourceValue === 20_200 && liveLandFact.sourceUnit === 'm²', 'live land snapshot must retain source value and unit provenance');
  assert(liveLandFact.approvedValue === 2.02 && liveLandFact.unit === 'ha' && liveLandFact.state === 'corrected', 'live land snapshot must retain approved surface and corrected review state');
  assert(liveLandSnapshot.propertyOverview.includes('20,200 m²'), 'equivalent source representation must survive lower-authority sanitation');
  assert(liveLandSnapshot.approvedFacts.landValue === 2.02 && liveLandSnapshot.approvedFacts.landUnit === 'ha', 'approved snapshot truth must remain the reviewed 2.02 ha surface');

  const leadingDecimalMention = findLandMeasurementMentions('Land: .5 ha.')[0];
  assert(
    leadingDecimalMention?.value === 0.5 && leadingDecimalMention.matchedText === '.5 ha',
    'a leading-decimal land surface must parse as 0.5 rather than backtracking to 5',
  );
  const approximateLeadingDecimalMention = findLandMeasurementMentions('Land: approximately .5 ha.')[0];
  assert(
    approximateLeadingDecimalMention?.value === 0.5 && approximateLeadingDecimalMention.approximate === true,
    'an approximate leading-decimal land surface must retain both its value and approximation cue',
  );
  assert(
    findLandMeasurementMentions('Land: 1.2.02 ha.').length === 0,
    'a malformed chained decimal must not backtrack into a valid suffix measurement',
  );
  const fiveHectareSnapshot = createLandSnapshot(5, 'ha', 5, 'ha', 'The approved holding spans 5 ha of land.');
  const wrongLeadingDecimalOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The property spans .5 ha of land.',
    snapshot: fiveHectareSnapshot,
    boundSnapshotId: fiveHectareSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    wrongLeadingDecimalOutput.state === 'needs-review'
      && wrongLeadingDecimalOutput.integrityIssues.some(issue => issue.matchedText === '.5 ha'),
    'approved 5 ha must reject a written .5 ha rather than reading it as 5 ha',
  );
  const halfHectareSnapshot = createLandSnapshot(0.5, 'ha', 0.5, 'ha', 'The approved holding spans 0.5 ha of land.');
  const safeLeadingDecimalOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The property spans approximately .5 ha of land.',
    snapshot: halfHectareSnapshot,
    boundSnapshotId: halfHectareSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(safeLeadingDecimalOutput.state === 'ready', 'approved 0.5 ha must accept approximately .5 ha');
  const fiveAcreSnapshot = createLandSnapshot(5, 'acres', 5, 'acres', 'The approved holding spans 5 acres of land.');
  for (const unicodeCompoundWording of ['twenty‑five acres', 'twenty–five acres', 'twenty—five acres']) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `The property spans ${unicodeCompoundWording} of land.`,
      snapshot: fiveAcreSnapshot,
      boundSnapshotId: fiveAcreSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.some(issue => issue.matchedText === unicodeCompoundWording),
      `${unicodeCompoundWording} must parse as twenty-five rather than a five-acre suffix`,
    );
  }
  const unicodeMinusOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The property spans −2.02 ha of land.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    unicodeMinusOutput.state === 'needs-review'
      && unicodeMinusOutput.integrityIssues.some(issue => issue.matchedText === '−2.02 ha'),
    'a Unicode minus sign must retain negative land meaning and fail closed',
  );
  const twoHundredSquareMetreSnapshot = createLandSnapshot(200, 'm²', 200, 'm²', 'The approved site spans 200 m² of land.');
  const narrowGroupedConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The property spans 20 200 m² of land.',
    snapshot: twoHundredSquareMetreSnapshot,
    boundSnapshotId: twoHundredSquareMetreSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    narrowGroupedConflict.state === 'needs-review'
      && narrowGroupedConflict.integrityIssues.some(issue => issue.matchedText === '20 200 m²'),
    'a narrow no-break grouped number must parse as 20,200 rather than a 200 m² suffix',
  );

  const safeLandWording = [
    '2.02 ha',
    '2.02 hectares',
    '20,200 m²',
    '20200 m²',
    '20,200 m2',
    '20200 sqm',
    '20,200 sq m',
    '20,200 square metres',
    '20,200 square meters',
    '20 200 m²',
    '20 200 m²',
    '20 200 m²',
    '2.02 hectare',
    '5 acres',
    'approximately 2.02 hectares',
    'approximately five acres',
    'about 5 acres',
    'around 5 acres',
    'about 5.04 acres',
    'approximately 5.04 acres',
    'approx 5.04 acres',
    'approx. 5.04 acres',
    'around 5.04 acres',
    '5 acre',
    'approx 5 acres',
    'approx. 5 acres',
    '—2.02 ha',
    '–2.02 ha',
  ] as const;
  for (const wording of safeLandWording) {
    const mentions = findLandMeasurementMentions(`Approved land: ${wording}.`);
    assert(mentions.length === 1, `${wording} must parse as exactly one structured land mention`);
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `A four-bedroom house with two bathrooms and two car spaces. Approved land: ${wording}.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready' && output.integrityIssues.length === 0, `${wording} must validate Ready against approved 2.02 ha`);
    assert(findSupersededFactConflicts(output.content, liveLandSnapshot.factProvenance).length === 0, `${wording} must not create a superseded land conflict`);
  }
  for (const wording of [
    'approximately 5.04 acres',
    'approx 5.04 acres',
    'approx. 5.04 acres',
    'about 5.04 acres',
    'around 5.04 acres',
  ]) {
    const mention = findLandMeasurementMentions(wording)[0];
    assert(mention?.approximate === true, `${wording} must activate the explicit approximation policy`);
    assert(
      compareLandMeasurements(mention, { value: 2.02, unit: 'ha' }).reason === 'explicit-approximation',
      `${wording} must pass through the bounded 1% approximation path rather than normal rounding`,
    );
  }

  const conflictingLandWording = [
    '3.02 ha',
    '30,200 m²',
    '30200 m2',
    '7.5 acres',
    '2.02 acres',
    '2.02 m²',
    '20,200 acres',
    'about 5.05 acres',
    '-2.02 ha',
    'minus 2.02 ha',
    '30,200-square-metre',
    '30,200 square-metre',
    '30,200 sq. m.',
    '30,200 sq-m',
    '30,200‑square‑metre',
    'twenty-five acres',
    'twenty five acres',
  ] as const;
  for (const wording of conflictingLandWording) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `A four-bedroom house with two bathrooms and two car spaces. Land: ${wording}.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    const landIssue = output.integrityIssues.find(issue => issue.governingBriefItem === 'landValue');
    assert(output.state === 'needs-review', `${wording} must remain blocked as materially contradictory land`);
    assert(
      landIssue?.code === 'superseded-fact'
        && landIssue.matchedText?.replace(/\.$/, '') === wording.replace(/\.$/, ''),
      `${wording} must report the complete contradictory land surface`,
    );
    const eligibility = getOutputEligibility(output, liveLandSnapshot.snapshotId);
    assert(!eligibility.canCopy && !eligibility.canExport, `${wording} must block Copy and Export`);
  }

  for (const [index, outputId] of CANONICAL_OUTPUT_ORDER.entries()) {
    const safeWording = safeLandWording[index % safeLandWording.length];
    const outputContent = outputId === 'Open House'
      ? `Open House\nDate:\nTime:\nApproved land: ${safeWording}.`
      : `${outputId}: Approved land ${safeWording}.`;
    const safeOutput = validateReturnedOutput({
      id: outputId,
      content: outputContent,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(safeOutput.state === 'ready', `${outputId} must accept an equivalent land surface`);
    assert(safeOutput.integrityIssues.length === 0, `${outputId} equivalent land surface must have zero issues`);
    const safeEligibility = getOutputEligibility(safeOutput, liveLandSnapshot.snapshotId);
    assert(safeEligibility.canCopy && safeEligibility.canExport, `${outputId} equivalent land surface must remain Copy/Export eligible`);

    const wrongWording = conflictingLandWording[index % conflictingLandWording.length];
    const conflictContent = outputId === 'Open House'
      ? `Open House\nDate:\nTime:\nLand: ${wrongWording}.`
      : `${outputId}: Land ${wrongWording}.`;
    const conflictOutput = validateReturnedOutput({
      id: outputId,
      content: conflictContent,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(conflictOutput.state === 'needs-review', `${outputId} must block a contradictory land surface`);
    assert(conflictOutput.integrityIssues.some(issue => issue.governingBriefItem === 'landValue'), `${outputId} contradictory land must name landValue`);
    const conflictEligibility = getOutputEligibility(conflictOutput, liveLandSnapshot.snapshotId);
    assert(!conflictEligibility.canCopy && !conflictEligibility.canExport, `${outputId} contradictory land must block Copy/Export`);
  }

  const inverseLandSnapshot = createLandSnapshot(
    2.02,
    'ha',
    20_200,
    'm²',
    'The holding extends across 2.02 ha of land.',
  );
  assert(inverseLandSnapshot.propertyOverview.includes('2.02 ha'), 'inverse equivalent source representation must survive sanitation');
  for (const wording of ['2.02 ha', '20,200 m²']) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `Land: ${wording}.`,
      snapshot: inverseLandSnapshot,
      boundSnapshotId: inverseLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready', `inverse provenance must accept ${wording}`);
  }

  const acreSourceSnapshot = createLandSnapshot(
    5,
    'acres',
    2.02,
    'ha',
    'The holding extends across 5 acres of land.',
  );
  assert(acreSourceSnapshot.propertyOverview.includes('5 acres'), 'normally rounded five-acre source representation must survive sanitation');
  const acreSourceOutput = validateReturnedOutput({
    id: 'Flyer',
    content: 'Flyer: approximately five acres of approved land.',
    snapshot: acreSourceSnapshot,
    boundSnapshotId: acreSourceSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(acreSourceOutput.state === 'ready', 'five-acre provenance must remain equivalent to approved 2.02 ha');

  const substantiveLandSnapshot = createLandSnapshot(
    30_000,
    'm²',
    2.02,
    'ha',
    'The source described 30,000 m² of land.',
  );
  assert(!substantiveLandSnapshot.propertyOverview.includes('30,000 m²'), 'materially wrong source land must still be sanitised from lower-authority context');
  const substantiveSourceOutput = validateReturnedOutput({
    id: 'Flyer',
    content: 'Flyer: the property spans 30,000 m² of land.',
    snapshot: substantiveLandSnapshot,
    boundSnapshotId: substantiveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(substantiveSourceOutput.state === 'needs-review', 'materially wrong source land must remain superseded');
  assert(substantiveSourceOutput.integrityIssues.some(issue => issue.matchedText === '30,000 m²'), 'materially wrong source must report its complete surface');

  const equivalentSanitation = sanitizeLowerAuthorityText(
    'Approximately 2.02 hectares (20,200 m²) with mature gardens. A peaceful rural holding.',
    { factProvenance: liveLandSnapshot.factProvenance, hardExclusions: liveLandSnapshot.hardExclusions },
  );
  assert(equivalentSanitation.removedFragments.length === 0, 'equivalent mixed-unit context must not lose any fragment');
  assert(equivalentSanitation.text.includes('20,200 m²'), 'equivalent mixed-unit context must retain its source representation');
  const conflictingSanitation = sanitizeLowerAuthorityText(
    'The holding spans 3.02 ha of land. A peaceful rural holding.',
    { factProvenance: liveLandSnapshot.factProvenance, hardExclusions: liveLandSnapshot.hardExclusions },
  );
  assert(conflictingSanitation.removedFragments.length === 1, 'one materially contradictory land fragment must be removed');
  assert(conflictingSanitation.text === 'A peaceful rural holding.', 'safe lower-authority sibling fragment must be preserved');
  const punctuatedUnitSanitation = sanitizeLowerAuthorityText(
    'Set on 30,200 sq. m. with mature trees. A peaceful outlook remains.',
    { factProvenance: liveLandSnapshot.factProvenance, hardExclusions: liveLandSnapshot.hardExclusions },
  );
  assert(
    punctuatedUnitSanitation.removedFragments.length === 1
      && punctuatedUnitSanitation.conflicts.some(conflict => conflict.matchedText === '30,200 sq. m.'),
    'sentence sanitation must preserve sq. m. as one measurement before removing the contradictory fragment',
  );
  assert(punctuatedUnitSanitation.text === 'A peaceful outlook remains.', 'punctuated-unit sanitation must preserve its safe sibling sentence');

  const groupedSuggestionItems = splitGovernanceListItems(
    '20,200 m² landholding, north-facing garden; quiet road',
  );
  assert(
    comparableJson(groupedSuggestionItems) === comparableJson([
      '20,200 m² landholding',
      'north-facing garden',
      'quiet road',
    ]),
    'suggestion governance must preserve digit-grouping commas while splitting list items',
  );

  const liveFlyerFixture = getFixtureState('land-equivalence.flyer-live');
  const liveFlyerSnapshot = liveFlyerFixture.brief.snapshot!;
  const liveFlyerOutput = liveFlyerFixture.outputs.Flyer;
  assert(liveFlyerOutput.content.includes('approximately 2.02 hectares'), 'live Flyer fixture must contain the visibly approved hectare wording');
  assert(liveFlyerOutput.content.includes('20,200 m²'), 'live Flyer fixture must contain the exact equivalent source representation that triggered V2');
  assert(liveFlyerOutput.state === 'ready' && liveFlyerOutput.integrityIssues.length === 0, 'exact live Flyer scenario must validate Ready with no superseded landValue issue');
  assert(getOutputEligibility(liveFlyerOutput, liveFlyerSnapshot.snapshotId).canCopy, 'remediated live Flyer must be Copy eligible');
  assert(getOutputEligibility(liveFlyerOutput, liveFlyerSnapshot.snapshotId).canExport, 'remediated live Flyer must be Export eligible');
  const liveFlyerPack = deriveCampaignPackState(liveFlyerFixture.outputs);
  assert(liveFlyerPack.state === 'partial' && liveFlyerPack.readyOutputIds.length === 4, 'remediated first four Campaign Pack children must be Ready');
  assert(
    comparableJson(liveFlyerPack.readyOutputIds) === comparableJson(['Just Listed', 'Brochure Copy', 'Email', 'Flyer']),
    'remediated live Flyer path must preserve the exact first four Campaign Pack IDs',
  );
  assert(liveFlyerPack.blockedOutputIds.length === 0 && liveFlyerPack.missingOutputIds.length === 12, 'remediated live Flyer path must have zero blocked and twelve not-yet-generated children');

  const landSafePackFixture = getFixtureState('land-equivalence.pack-safe');
  const landSafePackSnapshot = landSafePackFixture.brief.snapshot!;
  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    const output = landSafePackFixture.outputs[outputId];
    assert(output.state === 'ready', `${outputId} land-equivalence fixture output must be Ready`);
    assert(output.integrityIssues.length === 0, `${outputId} land-equivalence fixture output must have zero issues`);
    const eligibility = getOutputEligibility(output, landSafePackSnapshot.snapshotId);
    assert(eligibility.canCopy && eligibility.canExport, `${outputId} land-equivalence fixture output must be Copy/Export eligible`);
  }
  const landSafePack = deriveCampaignPackState(landSafePackFixture.outputs);
  assert(landSafePack.state === 'ready' && landSafePack.readyOutputIds.length === 16, 'all-safe semantic Campaign Pack must derive 16/16 Ready');
  assert(landSafePack.blockedOutputIds.length === 0 && landSafePack.retryOutputIds.length === 0, 'all-safe semantic Campaign Pack must have no blocked or retry children');
  const landSafeExport = buildExportEligibilityInput(landSafePackFixture.outputs, landSafePackSnapshot.snapshotId);
  assert(landSafeExport.counts.included === 17 && landSafeExport.omitted.length === 0, 'all-safe semantic campaign must export Listing Copy plus all 16 children');

  const landConflictPackFixture = getFixtureState('land-equivalence.pack-conflict');
  const landConflictPackSnapshot = landConflictPackFixture.brief.snapshot!;
  const landConflictPack = deriveCampaignPackState(landConflictPackFixture.outputs);
  assert(landConflictPack.state === 'partial', 'one contradictory Flyer must derive a Partial parent Campaign Pack');
  assert(landConflictPack.readyOutputIds.length === 3, 'contradictory Flyer fixture must preserve exactly three Ready predecessors');
  assert(comparableJson(landConflictPack.readyOutputIds) === comparableJson(['Just Listed', 'Brochure Copy', 'Email']), 'land conflict must preserve the three observed successful siblings in canonical order');
  assert(comparableJson(landConflictPack.blockedOutputIds) === comparableJson(['Flyer']), 'only Flyer must be integrity-blocked');
  assert(landConflictPack.missingOutputIds.length === 12, 'twelve later children must remain not generated after the blocked Flyer');
  assert(landConflictPackFixture.outputs.Flyer.integrityIssues.some(issue => issue.matchedText === '3.02 ha'), 'blocked Flyer must expose the complete contradictory land phrase');
  assert(!getOutputEligibility(landConflictPackFixture.outputs.Flyer, landConflictPackSnapshot.snapshotId).canCopy, 'blocked Flyer must not be Copy eligible');
  for (const outputId of ['Just Listed', 'Brochure Copy', 'Email'] as const) {
    assert(landConflictPackFixture.outputs[outputId].state === 'ready', `${outputId} must stay Ready after Flyer blocks`);
    assert(getOutputEligibility(landConflictPackFixture.outputs[outputId], landConflictPackSnapshot.snapshotId).canExport, `${outputId} must remain Export eligible after Flyer blocks`);
  }
  const landConflictExport = buildExportEligibilityInput(landConflictPackFixture.outputs, landConflictPackSnapshot.snapshotId);
  assert(landConflictExport.counts.included === 4, 'partial land-conflict export must retain Listing Copy and three Ready children');
  assert(landConflictExport.counts.blocked === 1 && landConflictExport.counts.missing === 12, 'partial land-conflict export must classify one blocked and twelve missing children');

  const adversarialBenignCopy = [
    "30 O'Malleys Road presents a four-bedroom house with two bathrooms and two car spaces.",
    'Built in 2020, the home includes a 20 m² studio and a bedroom measuring 3.5 m by 4 m.',
    'Campaign notes dated 10 August reference a 10% deposit guide and a price of $1,250,000.',
    'Call 0412 345 678 before 2:30 pm for agency administration; no Open Home schedule is asserted here.',
    'The approved land is about 5 acres.',
  ].join(' ');
  const adversarialMentions = findLandMeasurementMentions(adversarialBenignCopy);
  assert(adversarialMentions.length === 1 && adversarialMentions[0].matchedText === 'about 5 acres', 'land parser must ignore room area, dimensions, street, date, price, percentage, year and phone contexts');
  const adversarialSafeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: adversarialBenignCopy,
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(adversarialSafeOutput.state === 'ready', 'adversarial benign multi-number copy must validate Ready');
  assert(adversarialSafeOutput.integrityIssues.length === 0, 'adversarial benign multi-number copy must have no cross-category issue');
  const adversarialConflictOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: adversarialBenignCopy.replace('about 5 acres', '3.02 ha'),
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(adversarialConflictOutput.state === 'needs-review', 'adversarial copy must still block a genuine wrong land value');
  assert(
    adversarialConflictOutput.integrityIssues.length === 1
      && adversarialConflictOutput.integrityIssues[0].governingBriefItem === 'landValue'
      && adversarialConflictOutput.integrityIssues[0].matchedText === '3.02 ha',
    'adversarial land conflict must identify only the genuine wrong measurement and no unrelated category',
  );
  assert(findLandMeasurementMentions('A 20 m² studio, 12 m² bedroom, 200 m² of internal living space and room measuring 3.5 m by 4 m.').length === 0, 'room, studio and internal-area measurements must not be consumed as land');
  assert(findLandMeasurementMentions('A 20,200 m² home site.').length === 1, 'an explicit home-site square-metre measurement must remain land-owned');
  assert(findLandMeasurementMentions('Price $1,250,000; built 2020; call 0412 345 678.').length === 0, 'price, year and phone numbers must not parse as land');

  for (const [copy, expectedLandSurfaces] of [
    ['Near a 10-hectare park, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The 2.02 ha parcel includes a 250 m² house.', ['2.02 ha']],
    ['The land includes a 250 m² residence.', []],
    ['The home is spread over 250 m² and the block is 2.02 ha.', ['2.02 ha']],
    ['A 250 m² (internal living area) home sits on 2.02 ha.', ['2.02 ha']],
    ['A house of 250 m².', []],
    ['A home of 250 m².', []],
    ['A dwelling of 250 m².', []],
    ['A 200 m² warehouse.', []],
    ['A workshop spans 120 m².', []],
    ['A 0.5 ha garden on approximately five acres.', ['approximately five acres']],
    ['A one-acre garden within approximately five acres.', ['approximately five acres']],
    ['A 50 m² alfresco beside a home on 2.02 ha.', ['2.02 ha']],
    ['A 75 m² granny flat within the 2.02 ha holding.', ['2.02 ha']],
    ['Approximately five acres with a one-acre paddock.', ['Approximately five acres']],
    ['A 1 ha vineyard within the 2.02 ha holding.', ['2.02 ha']],
    ['A 20 m² light-filled studio on 2.02 ha.', ['2.02 ha']],
    ['A 250 m² architect-designed residence on 2.02 ha.', ['2.02 ha']],
    ['A 250 m² two-level home on 2.02 ha.', ['2.02 ha']],
    ['A 40 m² double garage on 2.02 ha.', ['2.02 ha']],
    ['A 40 m² heated pool on 2.02 ha.', ['2.02 ha']],
    ['Near a 10-hectare national park, the holding spans 2.02 ha.', ['2.02 ha']],
    ['Near a 10 ha regional reserve, the holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha neighbouring vineyard beside the 2.02 ha holding.', ['2.02 ha']],
    ['Near 10 ha of parkland, the holding spans 2.02 ha.', ['2.02 ha']],
    ['Beside a 10 ha property is the approved 2.02 ha holding.', ['2.02 ha']],
    ['Near a 10-hectare rural estate, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Opposite a one-acre block, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The nearby national park spans 10 ha; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The regional reserve covers 10 ha opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The neighbouring vineyard covers 10 ha; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 250 m² exceptionally well designed family residence on 2.02 ha.', ['2.02 ha']],
    ['The building spans 250 m² on 2.02 ha.', ['2.02 ha']],
    ['A 250 m² building sits on 2.02 ha.', ['2.02 ha']],
    ['A 250 m² footprint accompanies the home on 2.02 ha.', ['2.02 ha']],
    ['A 250 m² floorplan accompanies the home on 2.02 ha.', ['2.02 ha']],
    ['A 10 ha park nearby; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha property nearby; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha neighbouring property complements the 2.02 ha holding.', ['2.02 ha']],
    ['A 10 ha nearby property complements the 2.02 ha holding.', ['2.02 ha']],
    ['A 10 ha nearby block sits opposite the approved home; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha stretch of parkland nearby complements the 2.02 ha holding.', ['2.02 ha']],
    ['Adjacent to a 10 ha park, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Adjoining a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bordering a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Next to a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha reserve borders the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha estate adjoins the approved site; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Views over a 10 ha reserve complement the approved 2.02 ha holding.', ['2.02 ha']],
    ['Backing onto a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Across the road from a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The nearby reserve provides 10 ha of open space; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The regional reserve offers 10 ha of open space; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The national park comprises 10 ha of open space; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha reserve provides open space nearby; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha reserve provides open space beside the approved property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The ensuite spans 5 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 12 m² laundry complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A foyer of 10 m² complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A 20 m² master suite complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['The lounge measures 40 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A hallway of 8 m² complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A 15 m² cellar complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A 10 m² walk-in robe complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['Laundry: 8 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Ensuite — 5 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bedroom 2: 12 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bathroom 2 measures 5 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Room 3 — 10 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Walk-in robe: 6 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Master suite: 25 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Cellar (12 m²); the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Lounge: 20 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Garage: 40 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['| Bedroom 2 | 12 m² |; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bedroom 2, 12 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bedroom 2 / 12 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bedroom 2 = 12 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bedroom 2 size: 12 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Kitchen/living: 40 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bed 2 | 12 m² |; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Bath 2: 5 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Living/Dining: 40 m²; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The regional park covering 10 ha lies opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The nearby reserve providing 10 ha lies opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The regional reserve offering 10 ha lies opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The national park comprising 10 ha lies opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The neighbouring vineyard extending 10 ha lies opposite the property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Nearby, a 10 ha property complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['Beside a 10 ha neighbouring property for sale, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Near a 10 ha property offered for sale, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Nearby, a 10 ha property for sale complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['Nearby—a 10 ha reserve complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['Nearby — a 10 ha reserve complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['Beside—a 10 ha reserve, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['Opposite—10 ha of parkland, the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha reserve—nearby—complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A 10 ha reserve—beside the approved property—complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['A 10 ha property—nearby—complements the approved 2.02 ha holding.', ['2.02 ha']],
    ['The approved 2.02 ha property is for sale: a 10 ha nearby property complements it.', ['2.02 ha']],
    ['The neighbouring property has a reserve spanning 10 ha; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The nearby property includes a garden covering 10 ha; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A neighbouring property contains a 10 ha paddock beside the approved holding; the holding spans 2.02 ha.', ['2.02 ha']],
    ['The nearby reserve includes a lake covering 10 ha; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The national park has a 10 ha lake beside the approved property; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['The neighbouring vineyard contains a 10 ha dam; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ["On the property's doorstep, the regional park covers 10 ha; the approved holding spans 2.02 ha.", ['2.02 ha']],
    ["The property's neighbouring reserve spans 10 ha; the approved holding spans 2.02 ha.", ['2.02 ha']],
    ["Our property's neighbouring reserve spans 10 ha; the approved holding spans 2.02 ha.", ['2.02 ha']],
    ["The approved property's neighbouring reserve spans 10 ha; the approved holding spans 2.02 ha.", ['2.02 ha']],
    ["The subject property's adjacent park covers 10 ha; the approved holding spans 2.02 ha.", ['2.02 ha']],
    ['A 3.02 ha paddock on the neighbouring property; our holding spans 2.02 ha.', ['2.02 ha']],
    ['A 3.02 ha garden within the neighbouring property; our holding spans 2.02 ha.', ['2.02 ha']],
    ['A 3.02 ha vineyard on the neighbouring property; our holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha council reserve lies nearby; the approved holding spans 2.02 ha.', ['2.02 ha']],
    ['A 10 ha block beside the approved property complements the 2.02 ha holding.', ['2.02 ha']],
  ] as const) {
    const matchedSurfaces = findLandMeasurementMentions(copy).map(mention => mention.matchedText);
    assert(
      comparableJson(matchedSurfaces) === comparableJson(expectedLandSurfaces),
      `${copy} must assign only total-site measurements to landValue`,
    );
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: copy,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready', `${copy} must not false-block a benign building, park or subordinate-area measurement`);
  }

  const vineyardPropertyConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A 3.02 ha vineyard property.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    vineyardPropertyConflict.state === 'needs-review'
      && vineyardPropertyConflict.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'a vineyard property surface must remain a total-site land assertion and block when contradictory',
  );
  const impossibleSubordinateArea = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The 2.02 ha property includes a 3.02 ha paddock.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    impossibleSubordinateArea.state === 'needs-review'
      && impossibleSubordinateArea.integrityIssues.length === 1
      && impossibleSubordinateArea.integrityIssues[0].matchedText === '3.02 ha',
    'a subordinate area materially larger than the approved total site must fail closed',
  );
  const impossibleContainedVineyard = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A 3.02 ha vineyard within the 2.02 ha holding.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    impossibleContainedVineyard.state === 'needs-review'
      && impossibleContainedVineyard.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'a contained vineyard larger than the approved holding must not be treated as external',
  );
  for (const totalOrchardWording of [
    'A 1 ha orchard estate.',
    'A 1 ha orchard property.',
    'A 1 ha productive orchard property.',
  ]) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: totalOrchardWording,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.some(issue => issue.governingBriefItem === 'landValue'),
      `${totalOrchardWording} must remain a total-site assertion and block when contradictory`,
    );
  }
  const buildingSiteConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A 3.02 ha building site.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    buildingSiteConflict.state === 'needs-review'
      && buildingSiteConflict.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'building site must remain an Australian total-land phrase rather than a building-area role',
  );
  for (const totalSiteWording of [
    'A 3.02 ha house site.',
    'A 3.02 ha parkland property.',
    'A 3.02 ha parkland estate.',
    'Set across 3.02 ha of parkland.',
    'The holding spans 3.02 ha of parkland.',
    'This 3.02 ha parkland offers a rural setting.',
    'A 3.02 ha property near the coast.',
    'Set on a 3.02 ha block near the village.',
    'A 3.02 ha estate near the river.',
    'The regional property spans 3.02 ha.',
    'This regional estate covers 3.02 ha.',
    'The regional vineyard property spans 3.02 ha.',
    'This nearby 3.02 ha property offers a rural setting.',
    'This adjoining 3.02 ha estate offers a rural setting.',
    'The property provides 3.02 ha.',
    'The land provides 3.02 ha.',
    'The home provides 3.02 ha of grounds.',
    'This 3.02 ha nearby property is for sale.',
    'The approved 3.02 ha neighbouring property is offered for sale.',
    'This 3.02 ha national park property is for sale.',
    'The approved 3.02 ha regional park estate is offered for sale.',
    'A 3.02 ha nearby property is offered for sale.',
    'A 3.02 ha national park property is offered for sale.',
    'For sale: a 3.02 ha nearby property.',
    'Offered for sale is a 3.02 ha national park property.',
    'Now for sale — a 3.02 ha neighbouring block.',
  ]) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: totalSiteWording,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
      `${totalSiteWording} must remain a total-land phrase`,
    );
  }
  const containedParkConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A 3.02 ha national park is included within the 2.02 ha property.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    containedParkConflict.state === 'needs-review'
      && containedParkConflict.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'an explicitly contained park larger than the property must not be classified external',
  );
  const partOfParkConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A 3.02 ha national park forms part of the 2.02 ha property.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    partOfParkConflict.state === 'needs-review'
      && partOfParkConflict.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'a park stated to form part of the property must remain contained land',
  );
  const prefixContainedParkConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'Within the property, the national park covers 3.02 ha.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    prefixContainedParkConflict.state === 'needs-review'
      && prefixContainedParkConflict.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
    'a public-area noun explicitly contained within the property must not be classified as external',
  );
  for (const containedAreaWording of [
    'On the property, the national park covers 3.02 ha.',
    'The property includes a national park covering 3.02 ha.',
    'The property features a nearby reserve spanning 3.02 ha.',
    'Our nearby reserve covers 3.02 ha.',
    'The approved property has a reserve spanning 3.02 ha.',
    'Property has a reserve spanning 3.02 ha.',
    "Our property's private garden covers 3.02 ha.",
    'A 3.02 ha paddock on the approved property.',
    'A 3.02 ha garden within our property.',
  ]) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: containedAreaWording,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.some(issue => issue.matchedText === '3.02 ha'),
      `${containedAreaWording} must remain an explicitly property-owned subordinate-area conflict`,
    );
  }
  const compactSiteSnapshot = createLandSnapshot(
    742,
    'm²',
    742,
    'm²',
    'The approved site spans 742 m² of land.',
  );
  for (const multiLevelBuildingCopy of [
    'A three-level residence offers 900 m² of internal living space on 742 m² of land.',
    'A two-level warehouse provides 900 m² of building area on a 742 m² site.',
    'Offering 900 m² over three levels, this residence sits on 742 m² of land.',
    'Offering 900 m² spread across three levels, the home sits on 742 m² of land.',
    'The home provides 900 m² of accommodation and sits on 742 m² of land.',
    'The home provides 900 m² of accommodation over three levels and sits on 742 m² of land.',
  ]) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: multiLevelBuildingCopy,
      snapshot: compactSiteSnapshot,
      boundSnapshotId: compactSiteSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready', `${multiLevelBuildingCopy} must not compare floor/building area with total land`);
  }

  const structuredSafeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A four-bedroom house with two bathrooms, two car spaces and 2.02 ha of land.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(structuredSafeOutput.state === 'ready', 'number-word structured fact equivalents must remain Ready');
  for (const [wording, governingBriefItem] of [
    ['three bedrooms', 'bedrooms'],
    ['three bathrooms', 'bathrooms'],
    ['parking for three cars', 'carSpaces'],
  ] as const) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `A house with ${wording} and 2.02 ha of land.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'needs-review', `${wording} must be blocked`);
    assert(
      output.integrityIssues.length === 1
        && output.integrityIssues[0].governingBriefItem === governingBriefItem,
      `${wording} must be owned only by ${governingBriefItem}`,
    );
  }
  const vehicleSpacesConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A four-bedroom house with two bathrooms and three vehicle spaces on 2.02 ha of land.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(
    vehicleSpacesConflict.state === 'needs-review'
      && vehicleSpacesConflict.integrityIssues.length === 1
      && vehicleSpacesConflict.integrityIssues[0].governingBriefItem === 'carSpaces',
    'three vehicle spaces must remain an unambiguous car-space conflict owned only by carSpaces',
  );
  for (const [wording, governingBriefItem] of [
    ['101 bedrooms', 'bedrooms'],
    ['101 bathrooms', 'bathrooms'],
    ['101 car spaces', 'carSpaces'],
    ['2020 bedrooms', 'bedrooms'],
    ['2020 bathrooms', 'bathrooms'],
  ] as const) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `The output explicitly claims ${wording}.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.length === 1
        && output.integrityIssues[0].governingBriefItem === governingBriefItem,
      `${wording} must remain an explicit contradictory count rather than being treated as a year`,
    );
  }
  for (const [wording, governingBriefItem] of [
    ['-4 bedrooms', 'bedrooms'],
    ['minus four bedrooms', 'bedrooms'],
    ['-2 bathrooms', 'bathrooms'],
    ['minus two bathrooms', 'bathrooms'],
    ['-2 car spaces', 'carSpaces'],
    ['minus two car spaces', 'carSpaces'],
    ['−4 bedrooms', 'bedrooms'],
    ['−2 bathrooms', 'bathrooms'],
    ['−2 car spaces', 'carSpaces'],
  ] as const) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `The output explicitly claims ${wording}.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      output.state === 'needs-review'
        && output.integrityIssues.length === 1
        && output.integrityIssues[0].governingBriefItem === governingBriefItem,
      `${wording} must retain its sign and fail closed as an impossible structured count`,
    );
  }
  for (const benignNumericRole of [
    'A 2020 bedroom renovation complements this four-bedroom house.',
    'The 2020 bathroom renovation complements the two bathrooms.',
    'Parking for 10 August inspections is managed off site; the home has two car spaces.',
    'Parking for 10 Aug inspections is managed off site; the home has two car spaces.',
    'Parking for 10/08 inspections is managed off site; the home has two car spaces.',
    'A 2020 bedroom and bathroom renovation complements the four-bedroom home.',
    'A 2020 bathroom and kitchen renovation complements the two bathrooms.',
    'A 2020 bathroom fit-out complements the two bathrooms.',
    'A 2020 bathroom and laundry renovation complements the two bathrooms.',
    'A 2020 bathroom and ensuite renovation complements the two bathrooms.',
    'A 2020 bathroom and suite renovation complements the two bathrooms.',
    'Parking for 10 am inspections is managed off site; the home has two car spaces.',
    'Parking for 10.08 inspections is managed off site; the home has two car spaces.',
    'Parking for 10 guests is managed off site; the home has two car spaces.',
    'In 2020, bedrooms were renovated throughout the home.',
    'In 2020, bathrooms were renovated throughout the home.',
    'The 2020 bedroom was renovated with care.',
    'The 2020 bathroom received an update.',
    'Parking for $3 per hour is available nearby; the home has two car spaces.',
    'Parking for three dollars per hour is available nearby; the home has two car spaces.',
    'Parking for 10 a.m. inspections is managed off site; the home has two car spaces.',
    'Street parking for three hours is available; the home has two car spaces.',
    '—4 bedrooms are advertised as an approved headline.',
    '—2 bathrooms are advertised as an approved headline.',
    '—2 car spaces are advertised as an approved headline.',
  ]) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `${benignNumericRole} The approved land is 2.02 ha.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready' && output.integrityIssues.length === 0, `${benignNumericRole} must not be consumed as a structured count`);
  }
  for (const benignCarWording of ['three vehicle collections', 'a double garage', 'two garage doors']) {
    const output = validateReturnedOutput({
      id: 'Full Copy',
      content: `A four-bedroom house with two bathrooms, ${benignCarWording} and 2.02 ha of land.`,
      snapshot: liveLandSnapshot,
      boundSnapshotId: liveLandSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(output.state === 'ready', `${benignCarWording} must not be inferred as a car-space count`);
  }

  for (const nullFactCase of [
    { factKey: 'bedrooms', wording: 'four bedrooms' },
    { factKey: 'bathrooms', wording: 'two bathrooms' },
    { factKey: 'carSpaces', wording: 'two car spaces' },
    { factKey: 'landValue', wording: '2.02 ha of land' },
  ] as const) {
    const nullState = getFixtureState('brief.ready');
    const fact = nullState.property.facts.find(candidate => candidate.key === nullFactCase.factKey)!;
    fact.sourceValue = null;
    fact.approvedValue = null;
    fact.state = 'confirmed';
    nullState.property.overview = 'A calm garden outlook remains.';
    nullState.campaign.emphasis = ['North-facing rear garden'];
    nullState.people.openHomeIncluded = false;
    nullState.people.openHome = { date: '', time: '', url: '' };
    const nullSnapshot = buildApprovedBriefSnapshot(nullState, { approvedAt: FIXTURE_APPROVED_AT });
    const inventedOutput = validateReturnedOutput({
      id: 'Full Copy',
      content: `The output invents ${nullFactCase.wording}.`,
      snapshot: nullSnapshot,
      boundSnapshotId: nullSnapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(inventedOutput.state === 'needs-review', `approved-null ${nullFactCase.factKey} must reject an invented explicit mention`);
    assert(inventedOutput.integrityIssues.some(issue => issue.governingBriefItem === nullFactCase.factKey), `approved-null ${nullFactCase.factKey} issue must name its structured fact`);
    if (nullFactCase.factKey !== 'landValue') {
      const largeCountWording = nullFactCase.factKey === 'bedrooms'
        ? '101 bedrooms'
        : nullFactCase.factKey === 'bathrooms'
          ? '101 bathrooms'
          : '101 car spaces';
      const largeInventedOutput = validateReturnedOutput({
        id: 'Full Copy',
        content: `The output invents ${largeCountWording}.`,
        snapshot: nullSnapshot,
        boundSnapshotId: nullSnapshot.snapshotId,
        usedPhotoContext: false,
        generatedAt: FIXTURE_GENERATED_AT,
      });
      assert(
        largeInventedOutput.state === 'needs-review'
          && largeInventedOutput.integrityIssues.some(issue => issue.governingBriefItem === nullFactCase.factKey),
        `approved-null ${nullFactCase.factKey} must reject an invented count above 100`,
      );
    }
  }

  const propertyTypeState = getFixtureState('brief.ready');
  const correctedPropertyType = propertyTypeState.property.facts.find(candidate => candidate.key === 'propertyType')!;
  correctedPropertyType.sourceValue = 'House';
  correctedPropertyType.approvedValue = 'Townhouse';
  correctedPropertyType.state = 'corrected';
  propertyTypeState.property.overview = 'A welcoming townhouse with a calm garden outlook.';
  const correctedPropertyTypeSnapshot = buildApprovedBriefSnapshot(propertyTypeState, { approvedAt: FIXTURE_APPROVED_AT });
  const safePropertyTypeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A welcoming townhouse with four bedrooms, two bathrooms and two car spaces.',
    snapshot: correctedPropertyTypeSnapshot,
    boundSnapshotId: correctedPropertyTypeSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(safePropertyTypeOutput.state === 'ready', 'exact approved property type must validate Ready');
  const wrongPropertyTypeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A welcoming house with four bedrooms, two bathrooms and two car spaces.',
    snapshot: correctedPropertyTypeSnapshot,
    boundSnapshotId: correctedPropertyTypeSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(wrongPropertyTypeOutput.state === 'needs-review', 'exact superseded property type must remain blocked');
  assert(wrongPropertyTypeOutput.integrityIssues.some(issue => issue.governingBriefItem === 'propertyType'), 'superseded property type must name propertyType');
  const benignHouseContextOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'House-proud buyers will appreciate this townhouse, while a guest house adds flexibility.',
    snapshot: correctedPropertyTypeSnapshot,
    boundSnapshotId: correctedPropertyTypeSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(benignHouseContextOutput.state === 'ready', 'house-proud and guest house must not be consumed as the main property type');
  const dreamHouseConflict = validateReturnedOutput({
    id: 'Full Copy',
    content: 'Welcome to your dream house.',
    snapshot: correctedPropertyTypeSnapshot,
    boundSnapshotId: correctedPropertyTypeSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(dreamHouseConflict.state === 'needs-review', 'an explicit dream house assertion must remain a primary superseded property type');

  const createPropertyTypeSnapshot = (sourceValue: string, approvedValue: string) => {
    const state = getFixtureState('brief.ready');
    const fact = state.property.facts.find(candidate => candidate.key === 'propertyType')!;
    fact.sourceValue = sourceValue;
    fact.approvedValue = approvedValue;
    fact.state = 'corrected';
    state.property.overview = `A welcoming ${approvedValue.toLocaleLowerCase('en-AU')} with a calm garden outlook.`;
    return buildApprovedBriefSnapshot(state, { approvedAt: FIXTURE_APPROVED_AT });
  };
  for (const [sourceValue, approvedValue, benignRoleCopy, conflictingPrimaryCopy] of [
    ['Unit', 'Apartment', 'Apartment 5 at Unit 5, 30 Example Road.', 'A residential unit for sale.'],
    ['Unit', 'Apartment', 'An apartment with a self contained unit for guests.', 'This updated unit is for sale.'],
    ['Unit', 'Apartment', 'An apartment with a hot water unit.', 'A residential unit with secure parking.'],
    ['Unit', 'Apartment', 'An apartment with a solar unit and heating unit.', 'A well-presented unit with secure parking.'],
    ['Unit', 'Apartment', 'Apartment G03 at Unit G03, 30 Example Road.', 'This updated unit is for sale.'],
    ['Unit', 'Apartment', 'An approved apartment unit with reverse-cycle unit heating.', 'A residential unit with secure parking.'],
    ['Apartment / Unit', 'House', 'A house with a separate apartment at Unit 5.', 'An apartment property.'],
    ['Land', 'House', 'A welcoming house with productive land and established gardens.', 'A vacant land offering.'],
    ['Land', 'House', 'A welcoming house on a parcel of land.', 'Residential land for sale.'],
    ['Studio', 'House', 'A welcoming house with a separate studio.', 'A studio property.'],
    ['Studio', 'House', 'A house with a versatile backyard studio.', 'A purpose-built studio with a kitchen.'],
    ['Studio', 'House', 'A house with a flexible studio space.', 'A versatile studio with a kitchen.'],
    ['Studio', 'House', 'A house with an artists studio.', 'A purpose-built studio with a kitchen.'],
    ['Studio', 'House', 'A house with a detached studio.', 'This detached studio is offered for sale.'],
    ['Rural', 'House', 'A welcoming house with peaceful rural charm.', 'A rural property.'],
    ['House', 'Townhouse', 'A townhouse near historic Como House.', 'A detached house with four bedrooms.'],
    ['House', 'Townhouse', 'A townhouse beside a neighbouring house.', 'A beautifully presented house.'],
    ['House', 'Townhouse', 'A townhouse near Como House.', 'Welcome to your dream house.'],
    ['House', 'Townhouse', 'A townhouse moments from Como House.', 'A detached house with four bedrooms.'],
    ['House', 'Townhouse', 'A short walk to Como House, this townhouse offers convenience.', 'A beautifully presented house.'],
    ['House', 'Townhouse', 'A townhouse with a guest house for visitors.', 'This guest house is now for sale.'],
    ['Unit', 'Apartment', 'An apartment with a self contained unit for guests.', 'This self contained unit is the property offered for sale.'],
    ['Apartment', 'House', 'A house with a studio apartment for guests.', 'This studio apartment is the property offered for sale.'],
    ['House', 'Townhouse', 'This guest house complements the townhouse, which is offered for sale.', 'A guest house is offered for sale.'],
    ['House', 'Townhouse', 'This guest house is included with the townhouse property.', 'Guest house for sale.'],
    ['Unit', 'Apartment', 'This separate unit supports the apartment offered for sale.', 'A separate unit is offered for sale.'],
    ['Unit', 'Apartment', 'This separate unit is included with the apartment property.', 'Separate unit for sale.'],
    ['Studio', 'House', 'This detached studio complements the house, which is offered for sale.', 'A detached studio is offered for sale.'],
    ['Studio', 'House', 'This detached studio is included with the house property.', 'Offered for sale is a detached studio.'],
    ['House', 'Townhouse', 'This guest house is included with the townhouse property.', 'A guest house is currently offered for sale.'],
    ['Studio', 'House', 'This detached studio is included with the house property.', 'A detached studio is available for sale.'],
    ['Unit', 'Apartment', 'This separate unit is included with the apartment property.', 'A separate unit is presented for sale.'],
    ['House', 'Townhouse', 'For sale: a townhouse with a guest house for visitors.', 'For sale: a guest house.'],
    ['House', 'Townhouse', 'This guest house is included with the townhouse property.', 'For sale is a guest house.'],
    ['Unit', 'Apartment', 'This separate unit is included with the apartment property.', 'Now for sale — a separate unit.'],
    ['Studio', 'House', 'This detached studio is included with the house property.', 'Available for sale is a detached studio.'],
    ['House', 'Townhouse', 'The townhouse is offered for sale. A guest house adds flexibility.', 'For sale: Guest house.'],
    ['Unit', 'Apartment', 'The apartment is for sale. A separate unit provides storage.', 'Now for sale — separate unit.'],
    ['Studio', 'House', 'The house is for sale. A detached studio adds flexibility.', 'Available for sale: detached studio.'],
    ['House', 'Townhouse', 'For sale: a townhouse near Como House.', 'For sale: a guest house.'],
    ['House', 'Townhouse', 'For sale: a townhouse moments from Como House.', 'Guest house for sale.'],
    ['House', 'Townhouse', 'Available for sale: a townhouse near historic Como House.', 'A guest house is offered for sale.'],
    ['House', 'Townhouse', 'For sale: a townhouse beside a neighbouring house.', 'For sale is a guest house.'],
    ['House', 'Townhouse', 'For sale: a beautifully presented townhouse with a charming guest house.', 'For sale: a charming guest house.'],
    ['House', 'Townhouse', 'A townhouse with a renovated guest house is offered for sale.', 'A renovated guest house is now offered for sale.'],
    ['House', 'Townhouse', 'The townhouse featuring a renovated guest house is offered for sale.', 'Offered for sale is a beautifully presented guest house.'],
    ['House', 'Townhouse', 'For sale: a townhouse; a charming guest house adds flexibility.', 'For sale is a modern guest house.'],
    ['House', 'Townhouse', 'For sale: a townhouse — a charming guest house adds flexibility.', 'For sale: a renovated guest house.'],
    ['Unit', 'Apartment', 'For sale: an apartment with an updated separate unit.', 'For sale: an updated separate unit.'],
    ['Unit', 'Apartment', 'An apartment with a renovated separate unit is offered for sale.', 'Available for sale is a newly renovated ancillary unit.'],
    ['Studio', 'House', 'For sale: a house with a purpose built detached studio.', 'For sale: a purpose built detached studio.'],
    ['Apartment', 'House', 'A house with a renovated studio apartment is offered for sale.', 'For sale: a stylish studio apartment.'],
    ['House', 'Townhouse', 'A townhouse near Sydney Opera House.', 'A detached house with four bedrooms.'],
    ['House', 'Townhouse', 'A townhouse marketed through an auction house.', 'A beautifully presented house.'],
  ] as const) {
    const snapshot = createPropertyTypeSnapshot(sourceValue, approvedValue);
    const benignOutput = validateReturnedOutput({
      id: 'Full Copy',
      content: benignRoleCopy,
      snapshot,
      boundSnapshotId: snapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(benignOutput.state === 'ready' && benignOutput.integrityIssues.length === 0, `${benignRoleCopy} must not treat ${sourceValue} in a secondary role as the primary property type`);
    const conflictingOutput = validateReturnedOutput({
      id: 'Full Copy',
      content: conflictingPrimaryCopy,
      snapshot,
      boundSnapshotId: snapshot.snapshotId,
      usedPhotoContext: false,
      generatedAt: FIXTURE_GENERATED_AT,
    });
    assert(
      conflictingOutput.state === 'needs-review'
        && conflictingOutput.integrityIssues.length === 1
        && conflictingOutput.integrityIssues[0].governingBriefItem === 'propertyType',
      `${conflictingPrimaryCopy} must remain an exact primary property-type conflict`,
    );
  }

  const landToHouseState = getFixtureState('brief.ready');
  const landToHouseFact = landToHouseState.property.facts.find(candidate => candidate.key === 'propertyType')!;
  landToHouseFact.sourceValue = 'Land';
  landToHouseFact.approvedValue = 'House';
  landToHouseFact.state = 'corrected';
  landToHouseState.property.overview = 'A welcoming house set across 742 m² of land.';
  const landToHouseSnapshot = buildApprovedBriefSnapshot(landToHouseState, { approvedAt: FIXTURE_APPROVED_AT });
  const landAreaWithHouseOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A welcoming house set across 742 m² of land.',
    snapshot: landToHouseSnapshot,
    boundSnapshotId: landToHouseSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(landAreaWithHouseOutput.state === 'ready', 'land measurement wording must not be mistaken for superseded Land property type');
  const vacantLandTypeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A vacant land offering spanning 742 m².',
    snapshot: landToHouseSnapshot,
    boundSnapshotId: landToHouseSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(vacantLandTypeOutput.state === 'needs-review', 'a genuine superseded vacant Land property type must remain blocked');
  assert(vacantLandTypeOutput.integrityIssues.some(issue => issue.governingBriefItem === 'propertyType'), 'vacant Land conflict must remain owned by propertyType');

  const approvedCorrectedClaimOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The updated kitchen has pale stone-look benchtops.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(approvedCorrectedClaimOutput.state === 'ready', 'approved corrected free-text claim must remain Ready');
  const supersededCorrectedClaimOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'The home includes a Designer marble kitchen.',
    snapshot: liveLandSnapshot,
    boundSnapshotId: liveLandSnapshot.snapshotId,
    usedPhotoContext: false,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(supersededCorrectedClaimOutput.state === 'needs-review', 'superseded corrected free-text claim must remain blocked');
  assert(supersededCorrectedClaimOutput.integrityIssues.some(issue => issue.claimId === 'claim.updated-kitchen'), 'superseded corrected claim must retain claim provenance');

  const reviewedPhotoSafeOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'North-facing living room with broad windows.',
    snapshot: photosIncludedSnapshot,
    boundSnapshotId: photosIncludedSnapshot.snapshotId,
    usedPhotoContext: true,
    knownPhotoHighlights: photosIncluded.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(reviewedPhotoSafeOutput.state === 'ready', 'approved reviewed photo context must validate Ready');
  const supersededPhotoOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'Marble kitchen finishes.',
    snapshot: photosIncludedSnapshot,
    boundSnapshotId: photosIncludedSnapshot.snapshotId,
    usedPhotoContext: true,
    knownPhotoHighlights: photosIncluded.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(supersededPhotoOutput.state === 'needs-review', 'superseded photo highlight wording must remain blocked');
  assert(supersededPhotoOutput.integrityIssues.some(issue => issue.code === 'photo-context-conflict'), 'superseded photo highlight must remain a photo-context conflict');
  const excludedPhotoHighlight = photosIncluded.photos.highlights.find(highlight => highlight.state === 'excluded')!;
  const excludedPhotoOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: excludedPhotoHighlight.approvedText,
    snapshot: photosIncludedSnapshot,
    boundSnapshotId: photosIncludedSnapshot.snapshotId,
    usedPhotoContext: true,
    knownPhotoHighlights: photosIncluded.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(excludedPhotoOutput.state === 'needs-review', 'returned copy using an excluded reviewed photo highlight must remain blocked');
  assert(
    excludedPhotoOutput.integrityIssues.some(issue => issue.code === 'photo-context-conflict'),
    'excluded reviewed photo wording must be explicitly detected by photo-context integrity',
  );
  const photoOffMisuseOutput = validateReturnedOutput({
    id: 'Full Copy',
    content: 'A calm north-facing living room.',
    snapshot: photosOffSnapshot,
    boundSnapshotId: photosOffSnapshot.snapshotId,
    usedPhotoContext: true,
    knownPhotoHighlights: photosOff.photos.highlights,
    generatedAt: FIXTURE_GENERATED_AT,
  });
  assert(photoOffMisuseOutput.state === 'needs-review', 'reported photo use while policy is off must remain blocked');
  assert(photoOffMisuseOutput.integrityIssues.some(issue => issue.code === 'photo-context-conflict'), 'photo-off misuse must retain photo-context conflict code');

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
