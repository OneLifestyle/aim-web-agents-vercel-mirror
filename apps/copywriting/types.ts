
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
  profileInclusion: 'none' | 'suburb' | 'area' | 'both';
  agentProfile: AgentProfile;
  openHouse: OpenHouseDetails;
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
