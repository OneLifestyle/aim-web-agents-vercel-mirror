
export interface PropertyDetails {
  beds: number | null;
  baths: number | null;
  cars: number | null;
  landSize: number | null;
  propertyType: string;
}

export interface AgentProfile {
    name: string;
    agency: string;
    phone: string;
    email: string;
    inclusionMode: 'append' | 'integrate';
}

export interface OpenHouseDetails {
    date: string;
    time: string;
    url: string;
}

export interface CopyContext {
  primaryTargetMarket: string;
  secondaryTargetMarket: string; // Empty string if 'None'
  writingStyle: string[]; // Array of strings, max 2
  featuresToHighlight: string;
  thingsToAvoid: string;
}

export interface StrategyAnalysisResult {
    primaryTargetMarket: string;
    secondaryTargetMarket: string | null;
    writingStyles: string[];
    featuresToHighlight: string;
    thingsToAvoid: string;
}

export interface OutputSettings {
  wordCount: number;
}

export type ProfileInclusion = 'none' | 'suburb' | 'area' | 'both';
export type PropertyOverviewReviewState = 'needs-review' | 'confirmed' | 'excluded';

export interface ImageContent {
    base64: string;
    mimeType: string;
}

export interface ImageFile {
  file: File;
  url: string;
  status: 'idle' | 'processing' | 'success' | 'error';
  error?: string;
}

export interface GenerationParams {
  address: string;
  includeAddress: boolean;
  details: PropertyDetails;
  context: CopyContext;
  features: string;
  output: OutputSettings;
  imageAnalysis: string | null;
  researchData: string | null;
  profileData: { suburb: string; area: string; } | null;
  profileInclusion: ProfileInclusion;
  agentProfile: AgentProfile;
  openHouse: OpenHouseDetails;
  approvedBriefSnapshot: ApprovedBriefSnapshot;
}

export type CopywritingProductId = 'listing-copy' | 'campaign-pack';

export type CampaignStageId = 'property' | 'campaign' | 'photos' | 'brief' | 'outputs';

export type ReviewState = 'needs-review' | 'confirmed' | 'corrected' | 'excluded' | 'conflict';

export type PhotoHighlightState = 'needs-review' | 'approved' | 'corrected' | 'excluded' | 'failed';

export type PhotoContextPolicy = 'off' | 'included';

export type LandUnit = 'm²' | 'ha' | 'acres';

export interface ReviewedFact<T extends string | number | null = string | number | null> {
  key: 'bedrooms' | 'bathrooms' | 'carSpaces' | 'landValue' | 'propertyType';
  label: string;
  sourceValue: T;
  approvedValue: T;
  sourceUnit?: LandUnit;
  unit?: LandUnit;
  provenance: string;
  state: Exclude<ReviewState, 'excluded'>;
}

export interface ReviewedClaim {
  id: string;
  sourceText: string;
  approvedText: string;
  provenance: string;
  state: ReviewState;
  aliases: string[];
  reason?: string;
}

export interface CampaignSuggestion {
  id: string;
  kind: 'audience' | 'voice' | 'selling-point' | 'boundary';
  text: string;
  state: 'suggested' | 'applied' | 'blocked';
  conflictClaimId?: string;
  dependsOnPhotoContext?: boolean;
  audienceTarget?: 'primary' | 'secondary';
  application?: {
    changedGoverningValue: boolean;
    previousValue?: string;
  };
}

export interface ReviewedPhoto {
  id: string;
  name: string;
  imageNumber: number;
  selected: boolean;
  analysisState: 'not-analysed' | 'analysing' | 'ready' | 'failed';
  previewUrl?: string;
  error?: string;
}

export interface ReviewedPhotoHighlight {
  id: string;
  imageId: string;
  imageNumber: number;
  sourceText: string;
  approvedText: string;
  state: PhotoHighlightState;
  provenance: string;
}

export interface HardExcludedClaim {
  id: string;
  text: string;
  aliases: string[];
  provenance: string;
  reason?: string;
}

export interface ApprovedBriefSnapshot {
  schemaVersion: 'copywriting-approved-brief.v2';
  snapshotId: string;
  approvedAt: string;
  selectedAddress: string;
  includeAddressInCopy: boolean;
  product: CopywritingProductId;
  listingGenerationSettings: {
    approximateWordCount: number;
  };
  approvedFacts: {
    bedrooms: number | null;
    bathrooms: number | null;
    carSpaces: number | null;
    landValue: number | null;
    landUnit: LandUnit;
    propertyType: string;
  };
  factProvenance: Array<{
    key: ReviewedFact['key'];
    sourceValue: string | number | null;
    approvedValue: string | number | null;
    sourceUnit?: LandUnit;
    unit?: LandUnit;
    provenance: string;
    state: ReviewedFact['state'];
  }>;
  propertyOverview: string;
  suburbContext: string;
  areaContext: string;
  profileInclusion: ProfileInclusion;
  claims: {
    confirmed: ReviewedClaim[];
    corrected: ReviewedClaim[];
    excluded: HardExcludedClaim[];
  };
  agentContext: {
    included: boolean;
    name: string;
    title: string;
    phone: string;
    email: string;
    inclusionMode: AgentProfile['inclusionMode'];
  };
  agencyContext: {
    included: boolean;
    name: string;
  };
  openHomeContext: {
    included: boolean;
    date: string;
    time: string;
    url: string;
  };
  audience: {
    primary: string;
    secondary: string;
  };
  voice: {
    writingStyles: string[];
    tone: string;
  };
  campaignEmphasis: string[];
  styleAvoidances: string[];
  hardExclusions: HardExcludedClaim[];
  photoContext: {
    policy: PhotoContextPolicy;
    selectedPhotos: Array<Pick<ReviewedPhoto, 'id' | 'name' | 'imageNumber'>>;
    approvedHighlights: ReviewedPhotoHighlight[];
  };
  humanApproval: {
    approved: true;
    statement: string;
  };
}

export interface SuggestionGovernanceContext {
  approvedFacts: ApprovedBriefSnapshot['approvedFacts'];
  factProvenance: ApprovedBriefSnapshot['factProvenance'];
  hardExclusions: HardExcludedClaim[];
  photoContextPolicy: PhotoContextPolicy;
}

export type OutputDocumentState =
  | 'not-generated'
  | 'queued'
  | 'generating'
  | 'ready'
  | 'needs-review'
  | 'needs-regeneration'
  | 'failed';

export type IntegrityIssueCode =
  | 'excluded-claim'
  | 'superseded-fact'
  | 'photo-context-conflict'
  | 'missing-required-context'
  | 'foundation-mismatch'
  | 'snapshot-mismatch';

export interface OutputIntegrityIssue {
  code: IntegrityIssueCode;
  message: string;
  governingBriefItem: string;
  claimId?: string;
  matchedText?: string;
}

export interface CampaignOutputDocument {
  id: PreviewTab;
  content: string;
  state: OutputDocumentState;
  boundSnapshotId: string | null;
  generatedAt: string | null;
  integrityIssues: OutputIntegrityIssue[];
  usedPhotoContext: boolean;
  error?: string;
}

// Fix: Added 'Just Listed' to PreviewTab union type to match App.tsx usage and geminiService.ts logic
export type PreviewTab = 'Full Copy' | 'Just Listed' | 'Brochure Copy' | 'Email' | 'Flyer' | 'Facebook' | 'Facebook Marketplace' | 'Instagram' | 'X (Twitter)' | 'Google Business' | 'TikTok' | 'Open House' | 'Long-form / Blog' | 'Video Script' | 'Coming Soon Teaser' | 'Coming Soon Email' | 'Coming Soon SMS';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  image?: string; // data URL string
}

export interface GroundingSource {
    uri: string;
    title: string;
    type: 'web' | 'maps';
}

export interface TimelineItem {
    id: string;
    date: string;
    address: string;
    copyType: PreviewTab;
    copy: string;
}

export interface UsageStats {
    operation: string;
    usageStatus: 'available' | 'unavailable' | 'partial';
    pricingStatus: 'priced' | 'unknown';
    promptTokens: number | null;
    candidatesTokens: number | null;
    totalTokens: number | null;
    thinkingTokens?: number | null;
    cachedTokens?: number | null;
    groundingQueries?: number | null;
    mapsGroundingQueries?: number | null;
    estimatedCost: number | null;
    model: string;
    costDisclaimerFlags: string[];
    excludedOperationCount?: number;
    unknownCostOperationCount?: number;
}

export interface ServiceResponse<T> {
    data: T;
    usage?: UsageStats;
}

export interface ResearchResult {
    fullText: string;
    summary: string;
    keyFeatures: string;
    suburbProfile: string;
    regionalProfile: string;
    sources: GroundingSource[] | null;
    specs?: {
        beds: number | null;
        baths: number | null;
        cars: number | null;
        landSize: number | null;
        propertyType: string;
        priceGuide: string | null;
        lastSold: string | null;
    }
}

export interface DebugLogEntry {
    id: string;
    stepName: string;
    timestamp: Date;
    status: 'pending' | 'success' | 'error';
    model?: string;
    inputs?: string;
    outputs?: string;
    usage?: UsageStats;
    message?: string;
}
