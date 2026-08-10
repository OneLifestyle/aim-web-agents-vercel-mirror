import type {
  ApprovedBriefSnapshot,
  GenerationParams,
} from '../types';
import { sanitizeLowerAuthorityText } from './governance';

const cloneApprovedBriefSnapshot = (snapshot: ApprovedBriefSnapshot): ApprovedBriefSnapshot => (
  JSON.parse(JSON.stringify(snapshot)) as ApprovedBriefSnapshot
);

/**
 * Assembles the legacy engine request exclusively from the Approved Brief.
 * Fetched/source prose is never read here, and photo context is binary.
 */
export const assembleGenerationParamsFromApprovedSnapshot = (
  snapshot: ApprovedBriefSnapshot,
): GenerationParams => {
  const governance = {
    factProvenance: snapshot.factProvenance,
    hardExclusions: snapshot.hardExclusions,
  };
  const approvedClaimText = [
    ...snapshot.claims.confirmed.map(claim => claim.approvedText),
    ...snapshot.claims.corrected.map(claim => claim.approvedText),
  ]
    .map(text => sanitizeLowerAuthorityText(text, governance).text)
    .filter(Boolean);
  const campaignEmphasis = snapshot.campaignEmphasis
    .map(text => sanitizeLowerAuthorityText(text, governance).text)
    .filter(Boolean);
  const approvedFeatures = [...approvedClaimText, ...campaignEmphasis];
  const profileInclusion = snapshot.profileInclusion;
  const imageAnalysis = snapshot.photoContext.policy === 'included'
    ? snapshot.photoContext.approvedHighlights
      .map(highlight => `Photo ${highlight.imageNumber}: ${highlight.approvedText.trim()}`)
      .filter(line => !line.endsWith(':'))
      .join('\n') || null
    : null;
  const researchData = sanitizeLowerAuthorityText(snapshot.propertyOverview, governance).text || null;
  const includedAgent = snapshot.agentContext.included;
  const includedAgency = snapshot.agencyContext.included;
  const includedOpenHome = snapshot.openHomeContext.included;

  return {
    address: snapshot.selectedAddress,
    includeAddress: snapshot.includeAddressInCopy,
    details: {
      beds: snapshot.approvedFacts.bedrooms,
      baths: snapshot.approvedFacts.bathrooms,
      cars: snapshot.approvedFacts.carSpaces,
      landSize: snapshot.approvedFacts.landValue,
      propertyType: snapshot.approvedFacts.propertyType,
    },
    context: {
      primaryTargetMarket: snapshot.audience.primary,
      secondaryTargetMarket: snapshot.audience.secondary,
      writingStyle: [...snapshot.voice.writingStyles],
      featuresToHighlight: approvedFeatures.join('\n'),
      thingsToAvoid: snapshot.styleAvoidances.join('\n'),
    },
    features: approvedFeatures.join('\n'),
    output: {
      wordCount: snapshot.listingGenerationSettings.approximateWordCount,
    },
    imageAnalysis,
    researchData,
    profileData: profileInclusion === 'none'
      ? null
      : {
        suburb: profileInclusion === 'suburb' || profileInclusion === 'both'
          ? snapshot.suburbContext
          : '',
        area: profileInclusion === 'area' || profileInclusion === 'both'
          ? snapshot.areaContext
          : '',
      },
    profileInclusion,
    agentProfile: {
      name: includedAgent ? snapshot.agentContext.name : '',
      agency: includedAgency ? snapshot.agencyContext.name : '',
      phone: includedAgent ? snapshot.agentContext.phone : '',
      email: includedAgent ? snapshot.agentContext.email : '',
      inclusionMode: snapshot.agentContext.inclusionMode,
    },
    openHouse: {
      date: includedOpenHome ? snapshot.openHomeContext.date : '',
      time: includedOpenHome ? snapshot.openHomeContext.time : '',
      url: includedOpenHome ? snapshot.openHomeContext.url : '',
    },
    approvedBriefSnapshot: cloneApprovedBriefSnapshot(snapshot),
  };
};
