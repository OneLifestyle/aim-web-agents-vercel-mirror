
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PropertyDetails, AgentProfile, CopyContext, OutputSettings, ImageFile, PreviewTab, GroundingSource, ImageContent, ResearchResult, GenerationParams, DebugLogEntry, UsageStats, OpenHouseDetails } from './types';
import { TARGET_MARKETS, WRITING_STYLES, PROPERTY_TYPES, IconFileWord, IconFilePdf, IconFileTxt } from './constants';
import { IconCamera, IconChevronDown, IconClipboard, IconDownload, IconFileText, IconLoader, IconMinus, IconPlus, IconSparkles, IconTrash, IconUpload, IconWorld, IconMapPin, IconCheckCircle, IconExclamationCircle, IconChevronLeft, IconChevronRight } from './constants';
import * as geminiService from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { buildCampaignExportPlan, sanitizeFileNamePart, type CampaignExportDocument, type CampaignExportGenerationLogSummary, type CampaignExportInputSnapshotSummary, type CampaignExportScope, type CampaignExportUsageCostSummary } from './utils/exportAssembly';
import { Spinner } from './components/Spinner';

type VersionSet = Partial<Record<PreviewTab, string>>;
type SelectedAddress = {
    label: string;
};
type CampaignOperationId = 'propertyResearch' | 'copyContextAnalysis' | 'propertyFeaturesAnalysis' | 'imageAnalysis' | 'generateFullCopy' | 'generateAllVariations' | 'exportFullCampaign';
type ActiveCampaignOperation = {
    id: CampaignOperationId;
    label: string;
};
type AnalysisRunStatus = 'idle' | 'success' | 'error';
type PropertyBriefReviewState = 'missing' | 'review' | 'confirmed';
type AddressSuggestionCacheEntry = {
    suggestions: string[];
    usage?: UsageStats;
};
type CampaignOutputStatus = 'ready' | 'missing' | 'generating' | 'queued' | 'needs-generation' | 'retry-needed';
type SafeErrorDiagnostic = {
    userMessage: string;
    technicalMessage: string;
    errorName?: string;
    statusCode?: number;
    providerErrorCode?: string;
    isRetryable?: boolean;
    safeMessage: string;
};
type CampaignPackBatchStatus = 'idle' | 'generating' | 'partial_failed' | 'complete';
type CampaignPackBatchState = {
    status: CampaignPackBatchStatus;
    startedCount: number;
    requestedOutputIds: PreviewTab[];
    currentOutputId: PreviewTab | null;
    currentOutputTitle: string | null;
    currentCategory: string | null;
    currentIndex: number | null;
    succeededOutputIds: PreviewTab[];
    failedOutputId: PreviewTab | null;
    remainingOutputIds: PreviewTab[];
    userMessage: string | null;
    diagnostic: SafeErrorDiagnostic | null;
};
type CampaignOutputSectionMeta = {
    id: PreviewTab;
    label: PreviewTab;
    displayLabel: string;
    shortLabel: string;
    group: string;
    description: string;
    slug: string;
    canDownload: boolean;
};
type CampaignOutputCategoryFilter = 'All' | string;
type CopywritingOfferId = 'listing-copy' | 'campaign-pack' | 'campaign-blueprint';
type CopywritingOfferStatus = 'active' | 'recommended' | 'planned';
type CopywritingOfferMeta = {
    id: CopywritingOfferId;
    title: string;
    shortDescription: string;
    status: CopywritingOfferStatus;
    primaryActionLabel: string;
    includedSummary: string;
    disabledReason?: string;
};
type VisualHighlightEntry = {
    imageNumber: number;
    summary: string;
    details: string[];
    rawDetail: string;
};

const previewTabConfig: Record<string, PreviewTab[]> = {
    'Listing': ['Full Copy', 'Just Listed', 'Brochure Copy', 'Email', 'Flyer'],
    'Coming Soon': ['Coming Soon Teaser', 'Coming Soon Email', 'Coming Soon SMS'],
    'Social Media': ['Facebook', 'Facebook Marketplace', 'Instagram', 'X (Twitter)', 'Google Business', 'TikTok'],
    'Events': ['Open House'],
    'Blog': ['Long-form / Blog'],
    'Video': ['Video Script']
};
const mainTabs = Object.keys(previewTabConfig);
const campaignExportCategories = mainTabs.map(title => ({
    title,
    tabs: previewTabConfig[title],
}));
const categoryFilters: CampaignOutputCategoryFilter[] = ['All', ...mainTabs];
const LISTING_COPY_TAB: PreviewTab = 'Full Copy';
const ALL_CONTENT_TABS = Object.values(previewTabConfig).flat();
const DOWNSTREAM_CAMPAIGN_TABS = ALL_CONTENT_TABS.filter(tab => tab !== LISTING_COPY_TAB);
const TOTAL_DOWNSTREAM_CAMPAIGN_OUTPUTS = DOWNSTREAM_CAMPAIGN_TABS.length;
const COPYWRITING_OFFERS: CopywritingOfferMeta[] = [
    {
        id: 'listing-copy',
        title: 'Listing Copy',
        shortDescription: 'Core property story.',
        status: 'active',
        primaryActionLabel: 'Generate Listing Copy',
        includedSummary: 'Listing narrative and headline direction from the approved brief.',
    },
    {
        id: 'campaign-pack',
        title: 'Campaign Pack',
        shortDescription: 'Full channel package from the listing.',
        status: 'recommended',
        primaryActionLabel: 'Generate Campaign Pack',
        includedSummary: 'Social, email, brochure, flyer, blog, video and open house copy.',
    },
    {
        id: 'campaign-blueprint',
        title: 'Campaign Blueprint',
        shortDescription: 'Future rollout and discovery plan.',
        status: 'planned',
        primaryActionLabel: 'Planned beta',
        includedSummary: 'Future rollout plan, discovery brief, calendar and handoff.',
        disabledReason: 'Campaign Blueprint is planned for a later beta and does not generate yet.',
    },
];
const getOutputDisplayLabel = (tab: PreviewTab): string => tab === LISTING_COPY_TAB ? 'Listing Copy' : tab;
const CAMPAIGN_OUTPUT_SECTION_META: Record<PreviewTab, Omit<CampaignOutputSectionMeta, 'id' | 'label' | 'group' | 'slug'>> = {
    'Full Copy': {
        displayLabel: 'Listing Copy',
        shortLabel: 'Listing Copy',
        description: 'Core listing narrative and the source for campaign variations.',
        canDownload: true,
    },
    'Just Listed': {
        displayLabel: 'Just Listed',
        shortLabel: 'Just listed',
        description: 'Launch copy for newly listed property announcements.',
        canDownload: true,
    },
    'Brochure Copy': {
        displayLabel: 'Brochure Copy',
        shortLabel: 'Brochure',
        description: 'Longer-form brochure text for printed and digital collateral.',
        canDownload: true,
    },
    'Email': {
        displayLabel: 'Email',
        shortLabel: 'Email',
        description: 'Email campaign copy for database and buyer follow-up.',
        canDownload: true,
    },
    'Flyer': {
        displayLabel: 'Flyer',
        shortLabel: 'Flyer',
        description: 'Concise flyer copy for local print and handout use.',
        canDownload: true,
    },
    'Coming Soon Teaser': {
        displayLabel: 'Coming Soon Teaser',
        shortLabel: 'Teaser',
        description: 'Pre-market teaser copy before the full campaign launch.',
        canDownload: true,
    },
    'Coming Soon Email': {
        displayLabel: 'Coming Soon Email',
        shortLabel: 'Coming email',
        description: 'Pre-market email copy for early buyer interest.',
        canDownload: true,
    },
    'Coming Soon SMS': {
        displayLabel: 'Coming Soon SMS',
        shortLabel: 'SMS',
        description: 'Short pre-market SMS copy.',
        canDownload: true,
    },
    'Facebook': {
        displayLabel: 'Facebook',
        shortLabel: 'Facebook',
        description: 'Facebook post copy for campaign promotion.',
        canDownload: true,
    },
    'Facebook Marketplace': {
        displayLabel: 'Facebook Marketplace',
        shortLabel: 'Marketplace',
        description: 'Marketplace-ready property description copy.',
        canDownload: true,
    },
    'Instagram': {
        displayLabel: 'Instagram',
        shortLabel: 'Instagram',
        description: 'Instagram caption copy with social-first framing.',
        canDownload: true,
    },
    'X (Twitter)': {
        displayLabel: 'X (Twitter)',
        shortLabel: 'X',
        description: 'Short-form social copy for X.',
        canDownload: true,
    },
    'Google Business': {
        displayLabel: 'Google Business',
        shortLabel: 'Google',
        description: 'Google Business profile update copy.',
        canDownload: true,
    },
    'TikTok': {
        displayLabel: 'TikTok',
        shortLabel: 'TikTok',
        description: 'Short video social caption or hook copy.',
        canDownload: true,
    },
    'Open House': {
        displayLabel: 'Open House',
        shortLabel: 'Open house',
        description: 'Open home event copy and invitation text.',
        canDownload: true,
    },
    'Long-form / Blog': {
        displayLabel: 'Long-form / Blog',
        shortLabel: 'Blog',
        description: 'Long-form article copy for content marketing.',
        canDownload: true,
    },
    'Video Script': {
        displayLabel: 'Video Script',
        shortLabel: 'Video',
        description: 'Property video script and direction notes.',
        canDownload: true,
    },
};
const OUTPUT_MUTATING_OPERATIONS = new Set<CampaignOperationId>(['generateFullCopy', 'generateAllVariations', 'exportFullCampaign']);
const ADDRESS_LOOKUP_MIN_CHARS = 5;
const ADDRESS_LOOKUP_DEBOUNCE_MS = 450;
const ADDRESS_SUGGESTION_CACHE_LIMIT = 20;
const IMAGE_UPLOAD_LIMIT = 20;
const aimUi = {
    pageShell: 'min-h-screen bg-stone-50 text-slate-950',
    card: 'rounded-lg border border-stone-200 bg-white/95 shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
    cardMuted: 'rounded-lg border border-stone-200 bg-stone-50/80',
    sectionBase: 'bg-white/95 p-4 rounded-lg border flex flex-col scroll-mt-24 transition-colors shadow-[0_1px_2px_rgba(15,23,42,0.05)]',
    sectionIdle: 'border-stone-200',
    sectionActive: 'border-amber-300 ring-2 ring-amber-100',
    input: 'w-full rounded-md border border-stone-300 bg-white p-2 text-sm text-slate-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500/70 disabled:bg-stone-100 disabled:text-stone-400',
    primaryButton: 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500/70 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-red-300',
    secondaryButton: 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50',
    darkButton: 'inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md bg-slate-800 px-3 py-1.5 text-sm font-bold text-white transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-400',
    analysisButton: 'inline-flex min-h-8 items-center gap-1.5 rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-bold text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50',
    chipNeutral: 'rounded-full border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600',
    chipReady: 'rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700',
    chipWorking: 'rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800',
    chipPlanned: 'rounded-full border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600',
};
const compactActionButtonClass = aimUi.secondaryButton;
const INITIAL_CAMPAIGN_PACK_BATCH_STATE: CampaignPackBatchState = {
    status: 'idle',
    startedCount: 0,
    requestedOutputIds: [],
    currentOutputId: null,
    currentOutputTitle: null,
    currentCategory: null,
    currentIndex: null,
    succeededOutputIds: [],
    failedOutputId: null,
    remainingOutputIds: [],
    userMessage: null,
    diagnostic: null,
};
const profileInclusionLabels: Record<'none' | 'suburb' | 'area' | 'both', string> = {
    none: 'None',
    suburb: 'Suburb',
    area: 'Area',
    both: 'Both',
};

const getCampaignOutputCategory = (tab: PreviewTab): string => (
    mainTabs.find(tabGroup => previewTabConfig[tabGroup].includes(tab)) || 'Campaign'
);

const getCampaignPackOutputTitle = (tab: PreviewTab): string => (
    CAMPAIGN_OUTPUT_SECTION_META[tab]?.displayLabel || getOutputDisplayLabel(tab)
);

const outputNoun = (count: number): string => `output${count === 1 ? '' : 's'}`;

const redactSafeErrorMessage = (value: string): string => value
    .replace(/\b(?:api[_-]?key|token|authorization|bearer|secret|password)\b\s*[:=]\s*["']?[^"'\s,}]+/gi, '$1=[redacted]')
    .replace(/\b[A-Za-z0-9_-]{36,}\b/g, '[redacted]')
    .trim();

const isRetryableStatusCode = (statusCode: number): boolean => (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
);

const normalizeSafeError = (error: unknown, fallbackUserMessage: string): SafeErrorDiagnostic => {
    const errorRecord = error && typeof error === 'object' ? error as Record<string, unknown> : {};
    const rawMessage = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : fallbackUserMessage;
    const technicalSource = typeof errorRecord.technicalMessage === 'string' && errorRecord.technicalMessage.trim()
        ? errorRecord.technicalMessage
        : rawMessage;
    const safeMessage = redactSafeErrorMessage(technicalSource || fallbackUserMessage) || fallbackUserMessage;
    const statusCode = typeof errorRecord.statusCode === 'number' ? errorRecord.statusCode : undefined;
    const providerErrorCode = typeof errorRecord.providerErrorCode === 'string' && errorRecord.providerErrorCode.trim()
        ? redactSafeErrorMessage(errorRecord.providerErrorCode)
        : undefined;
    const errorName = typeof errorRecord.errorName === 'string' && errorRecord.errorName.trim()
        ? errorRecord.errorName
        : error instanceof Error
            ? error.name
            : undefined;
    const knownRetryable = typeof errorRecord.isRetryable === 'boolean'
        ? errorRecord.isRetryable
        : statusCode
            ? isRetryableStatusCode(statusCode)
            : /load failed|failed to fetch|network|timeout|temporar|unavailable/i.test(safeMessage)
                ? true
                : undefined;
    const userMessage = /load failed|failed to fetch|network/i.test(safeMessage)
        ? 'The request lost connection before the Campaign Pack finished.'
        : statusCode === 429
            ? 'The generation service is busy or rate-limited.'
            : statusCode && statusCode >= 500
                ? 'The generation service stopped before finishing.'
                : safeMessage || fallbackUserMessage;

    return {
        userMessage,
        technicalMessage: safeMessage,
        errorName,
        statusCode,
        providerErrorCode,
        isRetryable: knownRetryable,
        safeMessage,
    };
};

const buildCampaignPackPausedMessage = (
    failedOutputTitle: string | null,
    succeededCount: number,
    remainingCount: number
): string => {
    const createdVerb = succeededCount === 1 ? 'was' : 'were';
    const remainingVerb = remainingCount === 1 ? 'remains' : 'remain';
    const progressText = `${succeededCount} ${outputNoun(succeededCount)} ${createdVerb} created and ${remainingCount} ${remainingVerb}`;
    if (failedOutputTitle) {
        return `Campaign Pack paused while generating ${failedOutputTitle}. ${progressText}. Retry the remaining outputs when ready.`;
    }
    return `Campaign Pack paused before finishing. ${progressText}. Retry the remaining outputs when ready.`;
};

const formatCampaignPackOutputList = (tabs: PreviewTab[]): string => (
    tabs.length > 0
        ? tabs.map(tab => `${getCampaignPackOutputTitle(tab)} (${tab})`).join(', ')
        : 'none'
);

const buildCampaignPackFailureDiagnostics = ({
    requestedCount,
    attemptedCount,
    succeededOutputIds,
    failedOutputId,
    remainingOutputIds,
    diagnostic,
}: {
    requestedCount: number;
    attemptedCount: number;
    succeededOutputIds: PreviewTab[];
    failedOutputId: PreviewTab | null;
    remainingOutputIds: PreviewTab[];
    diagnostic: SafeErrorDiagnostic;
}): string => {
    const failedTitle = failedOutputId ? getCampaignPackOutputTitle(failedOutputId) : 'unknown';
    const failedCategory = failedOutputId ? getCampaignOutputCategory(failedOutputId) : 'unknown';
    const failedSequence = failedOutputId ? `${attemptedCount}/${requestedCount}` : 'unknown';

    return [
        'Campaign Pack partial failure diagnostic',
        `Operation: Generate Campaign Pack`,
        `Attempted count: ${attemptedCount}`,
        `Succeeded count: ${succeededOutputIds.length}`,
        `Failed count: 1`,
        `Remaining count: ${remainingOutputIds.length}`,
        `Current output title: ${failedTitle}`,
        `Current output id: ${failedOutputId || 'unknown'}`,
        `Current category: ${failedCategory}`,
        `Sequence position: ${failedSequence}`,
        `Succeeded before failure: ${formatCampaignPackOutputList(succeededOutputIds)}`,
        `Remaining output ids: ${formatCampaignPackOutputList(remainingOutputIds)}`,
        `Safe error message: ${diagnostic.safeMessage}`,
        `Error class: ${diagnostic.errorName || 'unknown'}`,
        `HTTP/provider status: ${diagnostic.statusCode ?? 'unavailable'}`,
        `Provider error code: ${diagnostic.providerErrorCode || 'unavailable'}`,
        `Retry safe: ${diagnostic.isRetryable === false ? 'not confirmed; retry only if user chooses' : 'yes; retry missing outputs only'}`,
        `Retry guidance: Generate Campaign Pack again to create only missing or failed outputs. Already-ready outputs are preserved.`,
        `Failure recorded: ${new Date().toISOString()}`,
        `Token/cost note: Token-only estimates are beta diagnostics, not billing statements. Grounding/tool charges are not included.`,
    ].join('\n');
};

const normalizeAddressLookupQuery = (value: string): string => value.trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeSnapshotText = (value: string | null | undefined): string => (value || '').replace(/\s+/g, ' ').trim();

const normalizeFeatureDisplayText = (value: string): string => value
    .replace(/\*\*/g, '')
    .replace(/^\s*(?:(?:[-*•‣◦]|\d+[.)])\s*)+/, '')
    .replace(/^\s*[:;,.]\s*/, '')
    .trim();

const buildListingBriefSnapshot = (params: GenerationParams, reviewState: PropertyBriefReviewState): string => JSON.stringify({
    address: normalizeSnapshotText(params.address),
    includeAddress: params.includeAddress,
    propertyBriefReviewState: reviewState,
    details: {
        beds: params.details.beds,
        baths: params.details.baths,
        cars: params.details.cars,
        landSize: params.details.landSize,
        propertyType: normalizeSnapshotText(params.details.propertyType),
    },
    context: {
        primaryTargetMarket: normalizeSnapshotText(params.context.primaryTargetMarket),
        secondaryTargetMarket: normalizeSnapshotText(params.context.secondaryTargetMarket),
        writingStyle: params.context.writingStyle.map(normalizeSnapshotText),
        featuresToHighlight: normalizeSnapshotText(params.context.featuresToHighlight),
        thingsToAvoid: normalizeSnapshotText(params.context.thingsToAvoid),
    },
    features: normalizeSnapshotText(params.features),
    wordCount: params.output.wordCount,
    imageAnalysis: normalizeSnapshotText(params.imageAnalysis),
    researchData: normalizeSnapshotText(params.researchData),
    profileData: params.profileData
        ? {
            suburb: normalizeSnapshotText(params.profileData.suburb),
            area: normalizeSnapshotText(params.profileData.area),
        }
        : null,
    profileInclusion: params.profileInclusion,
    agentProfile: {
        name: normalizeSnapshotText(params.agentProfile.name),
        agency: normalizeSnapshotText(params.agentProfile.agency),
        phone: normalizeSnapshotText(params.agentProfile.phone),
        email: normalizeSnapshotText(params.agentProfile.email),
        inclusionMode: params.agentProfile.inclusionMode,
    },
    openHouse: {
        date: normalizeSnapshotText(params.openHouse.date),
        time: normalizeSnapshotText(params.openHouse.time),
        url: normalizeSnapshotText(params.openHouse.url),
    },
});

const stripGenericImageLanguage = (value: string): string => {
    return value
        .replace(/\*\*/g, '')
        .replace(/^\s*(?:[-*•]\s*)?based on (?:the )?(?:image|photo)(?: provided)?[:,\s-]*/i, '')
        .replace(/^\s*(?:[-*•]\s*)?(?:this|the) (?:image|photo) (?:shows|features|captures|depicts)\s+/i, '')
        .trim();
};

const getCompactSummary = (content: string | null | undefined, fallback: string): string => {
    const text = (content || '').replace(/\s+/g, ' ').trim();
    if (!text) return fallback;
    return text.length > 140 ? `${text.slice(0, 137).trim()}...` : text;
};

const parseVisualHighlightContent = (content: string, imageNumber: number): VisualHighlightEntry => {
    const rawLines = content.split('\n').map(line => line.trim()).filter(Boolean);
    const cleanedLines = rawLines
        .map(line => stripGenericImageLanguage(line.replace(/^Summary\s*:\s*/i, '').replace(/^Details\s*:?\s*/i, '')))
        .filter(Boolean);
    const explicitSummary = rawLines.find(line => /^Summary\s*:/i.test(line));
    const bulletDetails = rawLines
        .filter(line => /^[-*•]\s+/.test(line))
        .map(line => stripGenericImageLanguage(line.replace(/^[-*•]\s+/, '')))
        .filter(Boolean);

    const summarySource = explicitSummary
        ? explicitSummary.replace(/^Summary\s*:\s*/i, '')
        : cleanedLines.find(line => !/^[-*•]/.test(line)) || cleanedLines[0] || `Visual highlights from Image ${imageNumber}`;
    const summary = stripGenericImageLanguage(summarySource);
    const details = bulletDetails.length > 0
        ? bulletDetails
        : cleanedLines
            .filter(line => line !== summary)
            .slice(0, 4);

    return {
        imageNumber,
        summary,
        details,
        rawDetail: stripGenericImageLanguage(content),
    };
};

const parseVisualHighlights = (analysis: string): VisualHighlightEntry[] => {
    const entryPattern = /(?:^|\n)Image\s+(\d+):\s*/g;
    const matches = Array.from(analysis.matchAll(entryPattern));

    if (matches.length === 0) {
        return [parseVisualHighlightContent(analysis, 1)];
    }

    return matches.map((match, index) => {
        const imageNumber = Number(match[1]) || index + 1;
        const start = (match.index ?? 0) + match[0].length;
        const end = index + 1 < matches.length ? matches[index + 1].index ?? analysis.length : analysis.length;
        return parseVisualHighlightContent(analysis.slice(start, end).trim(), imageNumber);
    });
};

const campaignOperationsConflict = (nextOperation: CampaignOperationId, activeOperation: CampaignOperationId): boolean => {
    if (nextOperation === activeOperation) return true;
    if (nextOperation === 'propertyResearch' || activeOperation === 'propertyResearch') return true;
    return OUTPUT_MUTATING_OPERATIONS.has(nextOperation) && OUTPUT_MUTATING_OPERATIONS.has(activeOperation);
};

const Section: React.FC<{
    id?: string;
    title: string;
    children: React.ReactNode;
    className?: string;
    rightElement?: React.ReactNode;
    isActive?: boolean;
    activeLabel?: string;
    showActiveChip?: boolean;
}> = ({ id, title, children, className, rightElement, isActive = false, activeLabel = 'Updating...', showActiveChip = true }) => (
  <div id={id} className={`${aimUi.sectionBase} ${isActive ? aimUi.sectionActive : aimUi.sectionIdle} ${className || ''}`}>
    <div className="flex justify-between items-center mb-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <div className="flex items-center gap-2">
            {isActive && showActiveChip && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-800">
                    <Spinner className="w-3 h-3" />
                    {activeLabel}
                </span>
            )}
            {rightElement}
        </div>
    </div>
    {children}
  </div>
);

const Placeholder: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="flex min-h-[130px] flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50/80 p-6 text-center">
        <div className="mb-2 text-stone-400">
            {React.cloneElement(icon as React.ReactElement, { className: "w-8 h-8" })}
        </div>
        <h3 className="text-sm font-bold text-slate-900 mb-1">{title}</h3>
        <p className="text-xs text-slate-500 max-w-xs leading-relaxed">{description}</p>
    </div>
);

const NumberInput: React.FC<{ label: string; value: number | null; onChange: (value: number) => void; min?: number; }> = ({ label, value, onChange, min = 0 }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <div className="flex items-center justify-between w-full rounded-md border border-stone-300 bg-white p-2">
            <button onClick={() => onChange(Math.max(min, (value ?? 0) - 1))} className="text-slate-600 hover:text-red-600 transition-colors rounded-full w-6 h-6 flex items-center justify-center bg-stone-100 hover:bg-red-50"><IconMinus /></button>
            <span className="font-medium text-slate-800">{value !== null ? value : '-'}</span>
            <button onClick={() => onChange((value ?? 0) + 1)} className="text-slate-600 hover:text-red-600 transition-colors rounded-full w-6 h-6 flex items-center justify-center bg-stone-100 hover:bg-red-50"><IconPlus /></button>
        </div>
    </div>
);

const SelectInput: React.FC<{
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: readonly string[];
    placeholder?: string;
    disabled?: boolean;
}> = ({ label, value, onChange, options, placeholder, disabled }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">{label}</label>
        <div className="relative w-full">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className={`${aimUi.input} appearance-none pr-8`}
            >
                {placeholder && <option value="" disabled>{placeholder}</option>}
                {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-600">
                <IconChevronDown />
            </div>
        </div>
    </div>
);

const CircularProgress: React.FC<{ percent?: number; completed?: boolean; className?: string }> = ({ percent = 0, completed = false, className }) => {
    const radius = 10;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    return (
        <div className={`relative flex items-center justify-center ${className}`}>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 24 24">
                <circle
                    className="text-gray-300"
                    strokeWidth="2"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="12"
                    cy="12"
                />
                <circle
                    className={`${completed ? 'text-green-500' : 'text-red-600'} transition-all duration-300 ease-in-out`}
                    strokeWidth="2"
                    strokeDasharray={circumference}
                    strokeDashoffset={completed ? 0 : offset}
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="transparent"
                    r={radius}
                    cx="12"
                    cy="12"
                />
            </svg>
            {completed && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <IconCheckCircle className="w-full h-full text-green-500 bg-white rounded-full" />
                </div>
            )}
        </div>
    );
};

const ActiveTaskMonitor: React.FC<{ imageFiles: ImageFile[], isAnalyzing: boolean }> = ({ imageFiles, isAnalyzing }) => {
    if (!isAnalyzing && !imageFiles.some(f => f.status === 'processing')) return null;

    return (
        <div className="bg-slate-800 rounded-lg p-3 mb-4 border border-slate-700">
            <div className="flex justify-between items-center mb-2 border-b border-slate-700 pb-1">
                <span className="text-white font-bold text-xs uppercase tracking-wider">Photo Analysis Queue</span>
                <Spinner className="w-3 h-3 text-red-500" />
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto custom-scrollbar">
                {imageFiles.map((file, idx) => (
                    <div key={idx} className="flex items-center text-xs text-slate-300">
                        <div className="w-4 h-4 mr-2 flex items-center justify-center">
                            {file.status === 'processing' && <Spinner className="w-3 h-3 text-yellow-500" />}
                            {file.status === 'success' && <IconCheckCircle className="w-4 h-4 text-green-500" />}
                            {file.status === 'error' && <IconExclamationCircle className="w-4 h-4 text-red-500" />}
                            {file.status === 'idle' && <div className="w-2 h-2 rounded-full bg-slate-600"></div>}
                        </div>
                        <span className={`truncate ${file.status === 'processing' ? 'text-white font-medium' : ''}`}>
                            Image {idx + 1}
                        </span>
                        <span className="ml-auto text-[10px] opacity-60">
                            {file.status === 'processing' ? 'Analyzing...' : file.status}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const addNullable = (current: number | null, next: number | null | undefined): number | null => {
    if (next === null || next === undefined) return current;
    return (current ?? 0) + next;
};

const aggregateUsage = (operation: string, usages: Array<UsageStats | undefined>, fallbackModel: string): UsageStats => {
    const presentUsages = usages.filter((usage): usage is UsageStats => Boolean(usage));
    const models = Array.from(new Set(presentUsages.map(usage => usage.model).filter(Boolean)));
    const excludedOperationCount = usages.length - presentUsages.length + presentUsages.filter(usage => usage.usageStatus === 'unavailable').length;
    const unknownCostOperationCount = presentUsages.filter(usage => (
        usage.pricingStatus === 'unknown' ||
        (usage.usageStatus !== 'unavailable' && usage.estimatedCost === null)
    )).length;
    const costValues = presentUsages
        .map(usage => usage.estimatedCost)
        .filter((cost): cost is number => typeof cost === 'number');

    return {
        operation,
        usageStatus: excludedOperationCount > 0 || unknownCostOperationCount > 0 ? 'partial' : 'available',
        pricingStatus: unknownCostOperationCount > 0 ? 'unknown' : 'priced',
        promptTokens: presentUsages.reduce((sum, usage) => addNullable(sum, usage.promptTokens), null as number | null),
        candidatesTokens: presentUsages.reduce((sum, usage) => addNullable(sum, usage.candidatesTokens), null as number | null),
        totalTokens: presentUsages.reduce((sum, usage) => addNullable(sum, usage.totalTokens), null as number | null),
        thinkingTokens: presentUsages.reduce((sum, usage) => addNullable(sum, usage.thinkingTokens), null as number | null),
        cachedTokens: presentUsages.reduce((sum, usage) => addNullable(sum, usage.cachedTokens), null as number | null),
        groundingQueries: presentUsages.reduce((sum, usage) => addNullable(sum, usage.groundingQueries), null as number | null),
        mapsGroundingQueries: presentUsages.reduce((sum, usage) => addNullable(sum, usage.mapsGroundingQueries), null as number | null),
        estimatedCost: costValues.length > 0 ? costValues.reduce((sum, cost) => sum + cost, 0) : null,
        model: models.length === 0 ? fallbackModel : models.length === 1 ? models[0] : `mixed: ${models.join(', ')}`,
        costDisclaimerFlags: Array.from(new Set([
            'token_only_estimate',
            'grounding_tool_charges_not_included',
            'provider_usage_required',
            ...presentUsages.flatMap(usage => usage.costDisclaimerFlags)
        ])),
        excludedOperationCount,
        unknownCostOperationCount
    };
};

const formatTokenCount = (value: number | null | undefined): string => {
    return typeof value === 'number' ? value.toLocaleString() : 'unavailable';
};

const getPublicStepName = (stepName: string): string => {
    if (stepName.startsWith('Fetch Property Details')) return 'Reviewing property context';
    if (stepName.startsWith('AI Strategy Analysis')) return 'Creating campaign strategy';
    if (stepName.startsWith('AI Feature Extraction')) return 'Extracting property features';
    if (stepName.startsWith('Analyze Photos')) return 'Analyzing uploaded photos';
    if (stepName.startsWith('Generate Copy')) return 'Generating campaign copy';
    if (stepName.startsWith('Generate All Variations')) return 'Creating campaign pack';
    if (stepName.startsWith('Generate Campaign Pack')) return 'Creating campaign pack';
    if (stepName.startsWith('Download Full Campaign')) return 'Preparing full campaign document';
    if (stepName.startsWith('Download All')) return 'Preparing full campaign document';
    if (stepName.startsWith('Refine Copy')) return 'Refining selected section';
    if (stepName.startsWith('Address Suggestions')) return 'Finding matching addresses';
    if (stepName.startsWith('Chat')) return 'Assistant reply';
    return stepName;
};

const DebugPanel: React.FC<{
    logs: DebugLogEntry[];
    isExpanded: boolean;
    onToggleExpanded: () => void;
}> = ({ logs, isExpanded, onToggleExpanded }) => {
    const totalCost = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.estimatedCost ?? 0), 0), [logs]);
    const excludedCount = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.excludedOperationCount ?? (log.usage?.usageStatus === 'unavailable' ? 1 : 0)), 0), [logs]);
    const unknownCount = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.unknownCostOperationCount ?? (log.usage?.pricingStatus === 'unknown' ? 1 : 0)), 0), [logs]);
    const errorLogs = useMemo(() => logs.filter(log => log.status === 'error'), [logs]);
    const pendingCount = useMemo(() => logs.filter(log => log.status === 'pending').length, [logs]);
    const latestLog = logs[0];
    const latestError = errorLogs[0];
    const formatLogDetail = (value: string, status: DebugLogEntry['status']): string => {
        if (status === 'error') return value;
        return `${value.substring(0, 150)}${value.length > 150 ? '...' : ''}`;
    };

    return (
        <div className={`${aimUi.card} overflow-hidden`}>
            <div className="flex items-start justify-between gap-3 border-b border-stone-100 bg-stone-50/70 p-3">
                <div>
                    <p className="text-sm font-semibold text-slate-900">Beta diagnostics</p>
                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Campaign Build Log, model usage and token-only cost estimates.</p>
                </div>
                <button
                    type="button"
                    onClick={onToggleExpanded}
                    className="shrink-0 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                    aria-expanded={isExpanded}
                >
                    {isExpanded ? 'Hide build log' : 'Show build log'}
                </button>
            </div>

            <div className="space-y-2 p-3 text-xs text-slate-600">
                <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 font-semibold text-slate-700">{logs.length} log entries</span>
                    {pendingCount > 0 && <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-800">{pendingCount} running</span>}
                    {errorLogs.length > 0 && <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-700">{errorLogs.length} error{errorLogs.length === 1 ? '' : 's'}</span>}
                </div>
                {latestLog ? (
                    <p>
                        Latest step: <span className="font-semibold text-slate-800">{getPublicStepName(latestLog.stepName)}</span>
                        {latestLog.status === 'pending' ? ' is running.' : latestLog.status === 'success' ? ' completed.' : ' needs attention.'}
                    </p>
                ) : (
                    <p>No campaign activity yet. Diagnostics will appear after lookup, analysis, generation or downloads.</p>
                )}
                {latestError && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700">
                        <span className="font-semibold">Latest error:</span> {latestError.message || getPublicStepName(latestError.stepName)}
                    </div>
                )}
                <p className="text-[11px] leading-snug text-slate-500">
                    Expanded diagnostics are for beta review only and are not billing statements.
                </p>
            </div>

            {isExpanded && (
                <div className="m-3 mt-0 flex max-h-[min(58vh,620px)] flex-col overflow-hidden rounded-lg border border-slate-700 bg-slate-900 text-xs text-slate-300 font-mono">
                    <div className="p-3 border-b border-slate-700 bg-slate-800 font-bold text-white flex justify-between items-center">
                        <span>Campaign Build Log</span>
                        <div className="flex gap-1">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {logs.length === 0 && <div className="text-center opacity-50 pt-10">No campaign activity yet...</div>}
                        {logs.map((log) => (
                            <div key={log.id} className="border-l-2 border-slate-600 pl-3 relative">
                                <div className="absolute -left-[5px] top-0 w-2 h-2 rounded-full bg-slate-600" style={{ backgroundColor: log.status === 'success' ? '#10b981' : log.status === 'error' ? '#ef4444' : '#f59e0b' }}></div>
                                <div className="flex justify-between mb-1">
                                    <span className="font-bold text-white">{getPublicStepName(log.stepName)}</span>
                                    <span className="opacity-60">{log.timestamp.toLocaleTimeString()}</span>
                                </div>
                                {getPublicStepName(log.stepName) !== log.stepName && (
                                    <div className="mb-1 text-[10px] text-slate-500">Technical step: {log.stepName}</div>
                                )}
                                {log.status === 'pending' && <span className="text-yellow-500 animate-pulse">Processing...</span>}
                                {log.status === 'error' && <span className="text-red-400">{log.message}</span>}

                                {log.usage && (
                                    <div className="bg-slate-800 p-2 rounded mt-1 mb-2">
                                        <div className="flex justify-between"><span>Model:</span> <span className="text-white">{log.usage.model}</span></div>
                                        <div className="flex justify-between"><span>Provider usage:</span> <span>{log.usage.usageStatus}</span></div>
                                        <div className="flex justify-between"><span>Token pricing:</span> <span className={log.usage.pricingStatus === 'unknown' ? 'text-yellow-400' : 'text-slate-300'}>{log.usage.pricingStatus}</span></div>
                                        <div className="flex justify-between"><span>Input/output tokens:</span> <span>{formatTokenCount(log.usage.promptTokens)} / {formatTokenCount(log.usage.candidatesTokens)}</span></div>
                                        {(log.usage.thinkingTokens !== null && log.usage.thinkingTokens !== undefined) && (
                                            <div className="flex justify-between"><span>Thinking tokens:</span> <span>{formatTokenCount(log.usage.thinkingTokens)}</span></div>
                                        )}
                                        {(log.usage.cachedTokens !== null && log.usage.cachedTokens !== undefined) && (
                                            <div className="flex justify-between"><span>Cached tokens:</span> <span>{formatTokenCount(log.usage.cachedTokens)}</span></div>
                                        )}
                                        <div className="flex justify-between border-t border-slate-700 mt-1 pt-1">
                                            <span>Token-only est. cost:</span>
                                            <span className={log.usage.estimatedCost === null ? 'text-yellow-400' : 'text-green-400'}>
                                                {log.usage.estimatedCost === null ? 'unknown' : `$${log.usage.estimatedCost.toFixed(5)}`}
                                            </span>
                                        </div>
                                        <div className="mt-1 text-[10px] text-slate-400 leading-snug">Grounding/tool charges are not included. Provider usage may be unavailable for some operations.</div>
                                        {(log.usage.excludedOperationCount || log.usage.unknownCostOperationCount) && (
                                            <div className="mt-1 text-[10px] text-yellow-400 leading-snug">
                                                {log.usage.excludedOperationCount ? `${log.usage.excludedOperationCount} operation(s) excluded. ` : ''}
                                                {log.usage.unknownCostOperationCount ? `${log.usage.unknownCostOperationCount} unknown cost item(s).` : ''}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {log.inputs && (
                                    <div className="mb-1">
                                        <span className="block text-slate-500 mb-0.5">Inputs:</span>
                                        <div className="bg-slate-800 p-1.5 rounded text-slate-400 whitespace-pre-wrap overflow-hidden text-[10px]">{formatLogDetail(log.inputs, log.status)}</div>
                                    </div>
                                )}
                                {log.outputs && (
                                    <div>
                                        <span className="block text-slate-500 mb-0.5">Outputs:</span>
                                        <div className="bg-slate-800 p-1.5 rounded text-slate-200 whitespace-pre-wrap overflow-hidden text-[10px] border border-slate-700">{formatLogDetail(log.outputs, log.status)}</div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                    <div className="p-2 border-t border-slate-700 bg-slate-800 text-right">
                        <span className="text-slate-400 mr-2">Token-only session estimate:</span>
                        <span className="text-green-400 font-bold">${totalCost.toFixed(5)}</span>
                        <div className="text-[10px] text-slate-500 mt-1">
                            Grounding/tool charges not included. Some operations excluded where provider usage is unavailable. Beta diagnostics are not billing statements.
                            {(excludedCount > 0 || unknownCount > 0) && ` Excluded: ${excludedCount}. Unknown cost: ${unknownCount}.`}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const App: React.FC = () => {
    const [address, setAddress] = useState('');
    const [addressSuggestions, setAddressSuggestions] = useState<string[]>([]);
    const [selectedAddress, setSelectedAddress] = useState<SelectedAddress | null>(null);
    const [isSuggesting, setIsSuggesting] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isFetchComplete, setIsFetchComplete] = useState(false);
    const [propertyBriefReviewState, setPropertyBriefReviewState] = useState<PropertyBriefReviewState>('missing');

    const [includeAddress, setIncludeAddress] = useState(true);
    const [propertyDetails, setPropertyDetails] = useState<PropertyDetails>({
        beds: null,
        baths: null,
        cars: null,
        landSize: null,
        propertyType: 'House',
    });

    // Agent Profile State
    const [agentProfile, setAgentProfile] = useState<AgentProfile>({
        name: '',
        agency: '',
        phone: '',
        email: '',
        inclusionMode: 'append'
    });

    const [openHouse, setOpenHouse] = useState<OpenHouseDetails>({
        date: '',
        time: '',
        url: ''
    });

    const [copyContext, setCopyContext] = useState<CopyContext>({
        primaryTargetMarket: 'Young Families',
        secondaryTargetMarket: '',
        writingStyle: ['Professional'],
        featuresToHighlight: '',
        thingsToAvoid: '',
    });
    const [propertyFeatures, setPropertyFeatures] = useState('');
    const [imageFiles, setImageFiles] = useState<ImageFile[]>([]);
    const [outputSettings, setOutputSettings] = useState<OutputSettings>({ wordCount: 250 });

    const [userLocation, setUserLocation] = useState<{latitude: number; longitude: number} | undefined>(undefined);
    const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');

    const [isResearching, setIsResearching] = useState(false);
    const [researchError, setResearchError] = useState<string | null>(null);
    const [researchData, setResearchData] = useState<string | null>(null);
    const [keyFeatures, setKeyFeatures] = useState<string[] | null>(null);
    const [profileData, setProfileData] = useState<{ suburb: string; area: string } | null>(null);
    const [profileInclusion, setProfileInclusion] = useState<'none' | 'suburb' | 'area' | 'both'>('none');
    const [priceGuide, setPriceGuide] = useState<string | null>(null);
    const [lastSoldDetails, setLastSoldDetails] = useState<string | null>(null);

    const [isAnalyzingImages, setIsAnalyzingImages] = useState(false);
    const [imageAnalysis, setImageAnalysis] = useState<string | null>(null);
    const [imageAnalysisError, setImageAnalysisError] = useState<string | null>(null);
    const [includeVisualHighlights, setIncludeVisualHighlights] = useState(true);
    const [isDraggingOver, setIsDraggingOver] = useState(false);
    const [expandedVisualHighlights, setExpandedVisualHighlights] = useState<Record<number, boolean>>({});

    const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const [versionSets, setVersionSets] = useState<VersionSet[]>([]);
    const [listingCopyBriefSnapshots, setListingCopyBriefSnapshots] = useState<(string | null)[]>([]);
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);

    const [activeMainTab, setActiveMainTab] = useState<string>('Listing');
    const [activeSubTab, setActiveSubTab] = useState<PreviewTab>('Full Copy');
    const [selectedOutputCategory, setSelectedOutputCategory] = useState<CampaignOutputCategoryFilter>('All');
    const [isCampaignLibraryExpanded, setIsCampaignLibraryExpanded] = useState(false);
    const [generatingTab, setGeneratingTab] = useState<PreviewTab | null>(null);
    const [queuedOutputTabs, setQueuedOutputTabs] = useState<PreviewTab[]>([]);
    const [campaignPackBatch, setCampaignPackBatch] = useState<CampaignPackBatchState>(INITIAL_CAMPAIGN_PACK_BATCH_STATE);
    const [isAnalyzingStrategy, setIsAnalyzingStrategy] = useState(false);
    const [isAnalyzingFeatures, setIsAnalyzingFeatures] = useState(false);
    const [copyContextAnalysisStatus, setCopyContextAnalysisStatus] = useState<AnalysisRunStatus>('idle');
    const [propertyFeaturesAnalysisStatus, setPropertyFeaturesAnalysisStatus] = useState<AnalysisRunStatus>('idle');
    const [copyContextAnalysisError, setCopyContextAnalysisError] = useState<string | null>(null);
    const [propertyFeaturesAnalysisError, setPropertyFeaturesAnalysisError] = useState<string | null>(null);
    const [isPropertyOverviewExpanded, setIsPropertyOverviewExpanded] = useState(true);
    const [isSuburbProfileExpanded, setIsSuburbProfileExpanded] = useState(true);
    const [activeCampaignOperations, setActiveCampaignOperations] = useState<ActiveCampaignOperation[]>([]);
    const activeCampaignOperationsRef = useRef<Map<CampaignOperationId, ActiveCampaignOperation>>(new Map());
    const addressLookupRequestRef = useRef(0);
    const activeAddressLookupAbortRef = useRef<AbortController | null>(null);
    const addressSuggestionCacheRef = useRef<Map<string, AddressSuggestionCacheEntry>>(new Map());
    const addressSuggestionLogIdRef = useRef<string | null>(null);
    const lastAddressLookupQueryRef = useRef<string | null>(null);
    const [isAddressLookupQueued, setIsAddressLookupQueued] = useState(false);


    const [notification, setNotification] = useState<string | null>(null);

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isCategoryExportMenuOpen, setIsCategoryExportMenuOpen] = useState(false);
    const [isDownloadAllMenuOpen, setIsDownloadAllMenuOpen] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const categoryExportMenuRef = useRef<HTMLDivElement>(null);
    const downloadAllMenuRef = useRef<HTMLDivElement>(null);
    const outputWorkspaceRef = useRef<HTMLDivElement>(null);
    const selectedOutputCardRef = useRef<HTMLDivElement>(null);
    const generatedOutputRef = useRef<HTMLDivElement>(null);

    const [includeContactDetails, setIncludeContactDetails] = useState(false);

    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
    const [isBuildLogExpanded, setIsBuildLogExpanded] = useState(false);
    const [isBetaVerified, setIsBetaVerified] = useState(() => geminiService.hasVerifiedBetaAccess());
    const [isCheckingBetaAccess, setIsCheckingBetaAccess] = useState(() => !geminiService.hasVerifiedBetaAccess());
    const [betaCodeInput, setBetaCodeInput] = useState('');
    const [betaAccessError, setBetaAccessError] = useState<string | null>(null);
    const [isVerifyingBetaAccess, setIsVerifyingBetaAccess] = useState(false);

    const hasSelectedAddressForFetch = Boolean(
        selectedAddress &&
        address.trim() &&
        normalizeAddressLookupQuery(selectedAddress.label) === normalizeAddressLookupQuery(address)
    );
    const fetchDetailsRequirementText = 'Select a suggested address before fetching property details.';
    const fetchDetailsDisabledReason = !address.trim()
        ? 'Start typing a property address first.'
        : !hasSelectedAddressForFetch
            ? fetchDetailsRequirementText
            : undefined;
    const hasFetchedPropertyBrief = isFetchComplete && Boolean(address.trim()) && Boolean(researchData || keyFeatures || profileData);
    const hasManualPropertyFacts = Boolean(address.trim()) && [
        propertyDetails.beds,
        propertyDetails.baths,
        propertyDetails.cars,
        propertyDetails.landSize
    ].some(value => value !== null);
    const hasManualPropertyContext = Boolean(propertyFeatures.trim() || copyContext.featuresToHighlight.trim());
    const isManualPropertyBrief = !hasFetchedPropertyBrief && hasManualPropertyFacts && hasManualPropertyContext;
    const isFetchedPropertyBriefConfirmed = hasFetchedPropertyBrief && propertyBriefReviewState === 'confirmed';
    const isPropertyBriefReady = isFetchedPropertyBriefConfirmed || isManualPropertyBrief;
    const propertyBriefStatusLabel = isPropertyBriefReady
        ? isManualPropertyBrief ? 'Manual brief' : 'Property brief ready'
        : hasFetchedPropertyBrief && propertyBriefReviewState === 'review'
            ? 'Review property brief'
            : address.trim()
                ? hasSelectedAddressForFetch ? 'Fetch details to start' : 'Select suggested address'
                : 'Property brief missing';
    const propertyBriefReadinessHint = isPropertyBriefReady
        ? isManualPropertyBrief
            ? 'Manual property facts and features are available. AI research and suburb analysis still depend on Fetch Details.'
            : 'The fetched property facts have been reviewed and confirmed for generation.'
        : hasFetchedPropertyBrief && propertyBriefReviewState === 'review'
            ? 'Review and adjust the property facts before generating copy.'
            : address.trim()
                ? hasSelectedAddressForFetch
                    ? 'Fetch details, review the facts, then confirm the brief before generating Listing Copy.'
                    : fetchDetailsRequirementText
                : 'Enter a property address to begin the brief.';

    const addLog = (entry: Partial<DebugLogEntry> & { stepName: string, status: 'pending' | 'success' | 'error' }) => {
        const newLog: DebugLogEntry = {
            id: Math.random().toString(36).substr(2, 9),
            timestamp: new Date(),
            inputs: '',
            outputs: '',
            message: '',
            ...entry
        };
        setDebugLogs(prev => [newLog, ...prev]);
        return newLog.id;
    };

    const updateLog = (id: string, updates: Partial<DebugLogEntry>) => {
        setDebugLogs(prev => prev.map(log => log.id === id ? { ...log, ...updates } : log));
    };

    const upsertAddressSuggestionLog = (updates: Partial<DebugLogEntry> & { status: 'pending' | 'success' | 'error' }): string => {
        if (addressSuggestionLogIdRef.current) {
            const logId = addressSuggestionLogIdRef.current;
            setDebugLogs(prev => {
                const existing = prev.find(log => log.id === logId);
                if (!existing) return prev;
                const updated = {
                    ...existing,
                    stepName: 'Address Suggestions',
                    timestamp: new Date(),
                    ...updates
                };
                return [updated, ...prev.filter(log => log.id !== logId)];
            });
            return logId;
        }

        const logId = addLog({
            stepName: 'Address Suggestions',
            ...updates
        });
        addressSuggestionLogIdRef.current = logId;
        return logId;
    };

    const beginCampaignOperation = (id: CampaignOperationId, label: string): boolean => {
        const activeOperations: ActiveCampaignOperation[] = Array.from(activeCampaignOperationsRef.current.values());
        const blockingOperation = activeOperations.find(operation => campaignOperationsConflict(id, operation.id));
        if (blockingOperation) {
            const actionDescription = blockingOperation.id === id ? 'that action' : 'a related campaign action';
            setNotification(`${blockingOperation.label} is still running. Wait for ${actionDescription} to finish before starting this.`);
            return false;
        }

        const nextOperation = { id, label };
        const nextOperations = new Map<CampaignOperationId, ActiveCampaignOperation>(activeCampaignOperationsRef.current);
        nextOperations.set(id, nextOperation);
        activeCampaignOperationsRef.current = nextOperations;
        setActiveCampaignOperations(Array.from(activeCampaignOperationsRef.current.values()));
        return true;
    };

    const endCampaignOperation = (id: CampaignOperationId): void => {
        if (!activeCampaignOperationsRef.current.has(id)) return;
        const nextOperations = new Map<CampaignOperationId, ActiveCampaignOperation>(activeCampaignOperationsRef.current);
        nextOperations.delete(id);
        activeCampaignOperationsRef.current = nextOperations;
        setActiveCampaignOperations(Array.from(nextOperations.values()));
    };

    const handleAgentChange = (field: keyof AgentProfile, value: string) => {
        setAgentProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleOpenHouseChange = (field: keyof OpenHouseDetails, value: string) => {
        setOpenHouse(prev => ({ ...prev, [field]: value }));
    };

    const clearFetchedPropertyContext = () => {
        setResearchData(null);
        setKeyFeatures(null);
        setProfileData(null);
        setGroundingSources([]);
        setPriceGuide(null);
        setLastSoldDetails(null);
        setProfileInclusion('none');
        setCopyContextAnalysisStatus('idle');
        setPropertyFeaturesAnalysisStatus('idle');
        setCopyContextAnalysisError(null);
        setPropertyFeaturesAnalysisError(null);
    };

    useEffect(() => {
        if (notification) {
            const timer = setTimeout(() => setNotification(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [notification]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
                setIsExportMenuOpen(false);
            }
            if (categoryExportMenuRef.current && !categoryExportMenuRef.current.contains(event.target as Node)) {
                setIsCategoryExportMenuOpen(false);
            }
            if (downloadAllMenuRef.current && !downloadAllMenuRef.current.contains(event.target as Node)) {
                setIsDownloadAllMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    useEffect(() => {
        if (isBetaVerified) {
            setIsCheckingBetaAccess(false);
            return;
        }

        let isMounted = true;
        const checkOptionalBetaGate = async () => {
            try {
                await geminiService.verifyBetaAccess('');
                if (isMounted) setIsBetaVerified(true);
            } catch {
                geminiService.clearBetaAccess();
            } finally {
                if (isMounted) setIsCheckingBetaAccess(false);
            }
        };

        checkOptionalBetaGate();

        return () => {
            isMounted = false;
        };
    }, [isBetaVerified]);

    useEffect(() => {
        const query = address.trim();
        const normalizedQuery = normalizeAddressLookupQuery(query);
        const requestId = addressLookupRequestRef.current + 1;
        addressLookupRequestRef.current = requestId;
        activeAddressLookupAbortRef.current?.abort();
        activeAddressLookupAbortRef.current = null;

        // Reset suggestions and loading state if the query is too short
        if (!normalizedQuery || normalizedQuery.length < ADDRESS_LOOKUP_MIN_CHARS) {
            setAddressSuggestions([]);
            setIsSuggesting(false);
            setIsAddressLookupQueued(false);
            lastAddressLookupQueryRef.current = null;
            return;
        }

        if (selectedAddress && normalizeAddressLookupQuery(selectedAddress.label) === normalizedQuery) {
            setAddressSuggestions([]);
            setIsSuggesting(false);
            setIsAddressLookupQueued(false);
            lastAddressLookupQueryRef.current = normalizedQuery;
            return;
        }

        const cached = addressSuggestionCacheRef.current.get(normalizedQuery);
        if (cached) {
            setAddressSuggestions(cached.suggestions);
            setIsSuggesting(false);
            setIsAddressLookupQueued(false);
            setShowSuggestions(true);
            lastAddressLookupQueryRef.current = normalizedQuery;
            upsertAddressSuggestionLog({
                status: 'success',
                inputs: query,
                outputs: `${cached.suggestions.length} cached suggestions shown`,
                usage: cached.usage
            });
            return;
        }

        if (lastAddressLookupQueryRef.current === normalizedQuery) {
            setShowSuggestions(true);
            setIsAddressLookupQueued(false);
            return;
        }

        setIsAddressLookupQueued(true);
        setShowSuggestions(true);

        const handler = setTimeout(async () => {
            if (addressLookupRequestRef.current !== requestId) return;
            setIsAddressLookupQueued(false);
            setIsSuggesting(true);
            setShowSuggestions(true);
            const abortController = new AbortController();
            activeAddressLookupAbortRef.current = abortController;
            upsertAddressSuggestionLog({
                status: 'pending',
                inputs: query,
                outputs: 'Latest address lookup in progress'
            });
            try {
                const result = await geminiService.suggestAddresses(query, userLocation, abortController.signal);
                // Only update if the query hasn't changed or been cleared since the request started.
                if (addressLookupRequestRef.current === requestId) {
                    addressSuggestionCacheRef.current.set(normalizedQuery, {
                        suggestions: result.data,
                        usage: result.usage
                    });
                    if (addressSuggestionCacheRef.current.size > ADDRESS_SUGGESTION_CACHE_LIMIT) {
                        const oldestKey = addressSuggestionCacheRef.current.keys().next().value;
                        if (oldestKey) addressSuggestionCacheRef.current.delete(oldestKey);
                    }
                    lastAddressLookupQueryRef.current = normalizedQuery;
                    setAddressSuggestions(result.data);
                    upsertAddressSuggestionLog({
                        status: 'success',
                        inputs: query,
                        outputs: `${result.data.length} suggestions returned for latest query`,
                        usage: result.usage
                    });
                }
            } catch (error) {
                if (error instanceof DOMException && error.name === 'AbortError') return;
                console.error("Address suggestions error:", error);
                if (addressLookupRequestRef.current === requestId) {
                    setAddressSuggestions([]);
                    upsertAddressSuggestionLog({
                        status: 'error',
                        inputs: query,
                        message: error instanceof Error ? error.message : 'Address suggestions failed.',
                    });
                }
            } finally {
                if (addressLookupRequestRef.current === requestId) {
                    setIsSuggesting(false);
                }
                if (activeAddressLookupAbortRef.current === abortController) {
                    activeAddressLookupAbortRef.current = null;
                }
            }
        }, ADDRESS_LOOKUP_DEBOUNCE_MS);

        return () => {
            clearTimeout(handler);
            activeAddressLookupAbortRef.current?.abort();
        };
    }, [address, selectedAddress, userLocation]);

    const handleSuggestionClick = (suggestion: string) => {
        const confirmedAddress = suggestion.trim();
        addressLookupRequestRef.current += 1;
        activeAddressLookupAbortRef.current?.abort();
        activeAddressLookupAbortRef.current = null;
        lastAddressLookupQueryRef.current = normalizeAddressLookupQuery(confirmedAddress);
        setSelectedAddress({ label: confirmedAddress });
        setAddress(confirmedAddress);
        setAddressSuggestions([]);
        setShowSuggestions(false);
        setIsSuggesting(false);
        setIsAddressLookupQueued(false);
        setIsFetchComplete(false);
        setPropertyBriefReviewState('missing');
        clearFetchedPropertyContext();
        upsertAddressSuggestionLog({
            status: 'success',
            inputs: confirmedAddress,
            outputs: 'Address selected for research',
        });
    };

    const handleAddressChange = (value: string) => {
        setAddress(value);
        setShowSuggestions(true);
        setIsFetchComplete(false);
        setPropertyBriefReviewState('missing');
        if (selectedAddress && value.trim() !== selectedAddress.label) {
            setSelectedAddress(null);
            clearFetchedPropertyContext();
        }
    };

    const handleDetailChange = (field: keyof PropertyDetails, value: any) => {
        setPropertyDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleContextChange = (field: keyof CopyContext, value: any) => {
        setCopyContext(prev => ({ ...prev, [field]: value }));
    };

    const handleConfirmPropertyBrief = () => {
        if (!hasFetchedPropertyBrief) {
            setNotification('Fetch property details before confirming the brief.');
            return;
        }
        setPropertyBriefReviewState('confirmed');
        setNotification('Property brief confirmed.');
    };

    const handleWritingStyleToggle = (style: string) => {
        setCopyContext(prev => {
            const currentStyles = prev.writingStyle;
            if (currentStyles.includes(style)) {
                if (currentStyles.length === 1) return prev;
                return { ...prev, writingStyle: currentStyles.filter(s => s !== style) };
            } else {
                // Strictly cap at 2 selections
                if (currentStyles.length >= 2) return prev;
                return { ...prev, writingStyle: [...currentStyles, style] };
            }
        });
    };

    const processFiles = (files: FileList | null) => {
        if (files) {
            if (imageFiles.length + files.length > IMAGE_UPLOAD_LIMIT) {
                setNotification(`Maximum ${IMAGE_UPLOAD_LIMIT} images allowed. Only the first valid photos were added.`);
            }

            const remainingSlots = IMAGE_UPLOAD_LIMIT - imageFiles.length;
            if (remainingSlots <= 0) return;

            const fileArray = Array.from(files).slice(0, remainingSlots).map((file: File): ImageFile => ({
                file,
                url: URL.createObjectURL(file),
                status: 'idle',
            }));

            setImageFiles(prev => [...prev, ...fileArray]);
            setImageAnalysis(null);
            setImageAnalysisError(null);
            setExpandedVisualHighlights({});

            addLog({
                stepName: 'Upload Photos',
                status: 'success',
                message: `${fileArray.length} photos added to queue`
            });
        }
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        processFiles(e.target.files);
    };

    const handleImageDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
        processFiles(e.dataTransfer.files);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDraggingOver(false);
    };

    const handleImageDelete = (index: number) => {
        setImageFiles(prev => {
            const newFiles = prev.filter((_, i) => i !== index);
            if (newFiles.length === 0) {
                setImageAnalysis(null);
                setImageAnalysisError(null);
            }
            setExpandedVisualHighlights({});
            return newFiles;
        });
    };

    const handleAnalyzeImages = async () => {
        if (imageFiles.length === 0) return;
        if (!beginCampaignOperation('imageAnalysis', 'Photo analysis')) return;

        setIsAnalyzingImages(true);
        setImageAnalysis(null);
        setImageAnalysisError(null);

        const pendingFiles = [...imageFiles];
        const logId = addLog({ stepName: 'Analyze Photos Sequence', status: 'pending', inputs: `Starting sequential analysis of ${imageFiles.length} images...` });

        const results: string[] = [];
        let errorCount = 0;
        const childUsages: Array<UsageStats | undefined> = [];

        try {
            for (let i = 0; i < pendingFiles.length; i++) {
                setImageFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'processing' } : f));

                try {
                    const base64 = await fileToBase64(pendingFiles[i].file);
                    const result = await geminiService.analyzeSingleImage({
                        base64,
                        mimeType: pendingFiles[i].file.type
                    });

                    results.push(`Image ${i + 1}: ${result.data}`);

                    childUsages.push(result.usage);

                    setImageFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'success' } : f));
                } catch (err) {
                    console.error(`Error analyzing image ${i}:`, err);
                    errorCount++;
                    childUsages.push(undefined);
                    setImageFiles(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'error', error: 'Failed' } : f));
                }
            }

            if (results.length > 0) {
                const combinedAnalysis = results.join('\n\n');
                setImageAnalysis(combinedAnalysis);
                setExpandedVisualHighlights({});
                updateLog(logId, {
                    status: 'success',
                    outputs: `Analyzed ${results.length} images using the configured Gemini Flash model.`,
                    message: errorCount > 0 ? `${errorCount} failures` : undefined,
                    usage: aggregateUsage('Analyze Photos Sequence', childUsages, geminiService.MODEL_VISION)
                });
            } else {
                setImageAnalysisError("Failed to analyze any images.");
                updateLog(logId, { status: 'error', message: 'All image analyses failed.' });
            }
        } finally {
            setIsAnalyzingImages(false);
            endCampaignOperation('imageAnalysis');
        }
    };

    const parseKeyFeatures = (featuresText: string) => {
        if (!featuresText) return;
        const details: Partial<PropertyDetails> = {};
        let price: string | null = null;
        let sold: string | null = null;
        const otherFeatures: string[] = [];
        const lines = featuresText.split('\n').map(l => l.trim());
        lines.forEach(line => {
            const cleanedLine = line.replace(/^- /, '');
            const parts = cleanedLine.split(':');
            if (parts.length < 2) return;
            const key = parts[0].replace(/\*\*/g, '').trim();
            const value = parts.slice(1).join(':').replace(/\*\*/g, '').trim();
            const lowerKey = key.toLowerCase();
            if (lowerKey.includes('bedrooms')) details.beds = parseInt(value, 10) || null;
            else if (lowerKey.includes('bathrooms')) details.baths = parseInt(value, 10) || null;
            else if (lowerKey.includes('car spaces')) details.cars = parseInt(value, 10) || null;
            else if (lowerKey.includes('land size')) {
                let sizeInSqm: number | null = null;
                const valueLower = value.toLowerCase();
                const numberMatch = value.match(/([\d,.]+)/);
                if (numberMatch) {
                    let numericValue = parseFloat(numberMatch[0].replace(/,/g, ''));
                    if (!isNaN(numericValue)) {
                        const isHectares = /\b(ha|hectare|hectares)\b/.test(valueLower);
                        if (isHectares) sizeInSqm = Math.round(numericValue * 10000);
                        else sizeInSqm = Math.round(numericValue);
                        if (sizeInSqm > 100000000) sizeInSqm = Math.round(numericValue);
                    }
                }
                details.landSize = sizeInSqm;
            } else if (lowerKey.includes('property type')) {
                const matchedType = PROPERTY_TYPES.find(pt => pt.toLowerCase() === value.toLowerCase().trim());
                if (matchedType) details.propertyType = matchedType;
            } else if (lowerKey.includes('price guide')) price = value;
            else if (lowerKey.includes('last sold')) sold = value;
            else if (key && value && value !== 'N/A') otherFeatures.push(`${key}: ${value}`);
        });
        setPropertyDetails(prev => ({ ...prev, ...details }));
        setPriceGuide(price);
        setLastSoldDetails(sold);
        setKeyFeatures(otherFeatures.length > 0 ? otherFeatures : null);
    };

    const requestLocation = (): Promise<{latitude: number; longitude: number} | undefined> => {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                setLocationStatus('denied');
                resolve(undefined);
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const location = { latitude: position.coords.latitude, longitude: position.coords.longitude };
                    setUserLocation(location);
                    setLocationStatus('granted');
                    resolve(location);
                },
                () => {
                    console.warn('Geolocation access was denied.');
                    setLocationStatus('denied');
                    resolve(undefined);
                }
            );
        });
    };

    const handleFetchDetails = async () => {
        const typedAddressSnapshot = address.trim();
        const selectedAddressSnapshot = selectedAddress &&
            normalizeAddressLookupQuery(selectedAddress.label) === normalizeAddressLookupQuery(typedAddressSnapshot)
            ? selectedAddress.label.trim()
            : null;

        if (!typedAddressSnapshot) {
            setResearchError("Start typing a property address, then select a suggested address before fetching details.");
            return;
        }

        if (!selectedAddressSnapshot) {
            setResearchError(fetchDetailsRequirementText);
            setNotification(fetchDetailsRequirementText);
            return;
        }

        const addressForResearch = selectedAddressSnapshot;
        addressLookupRequestRef.current += 1;
        activeAddressLookupAbortRef.current?.abort();
        activeAddressLookupAbortRef.current = null;
        lastAddressLookupQueryRef.current = normalizeAddressLookupQuery(addressForResearch);
        setAddress(addressForResearch);
        setAddressSuggestions([]);
        setShowSuggestions(false);
        setIsSuggesting(false);
        setIsAddressLookupQueued(false);
        if (!beginCampaignOperation('propertyResearch', 'Property research')) return;
        const logId = addLog({ stepName: 'Fetch Property Details', status: 'pending', inputs: addressForResearch });
        let location = userLocation;
        setIsResearching(true);
        setResearchError(null);
        setIsFetchComplete(false);
        setPropertyBriefReviewState('missing');
        setCopyContextAnalysisStatus('idle');
        setPropertyFeaturesAnalysisStatus('idle');
        setCopyContextAnalysisError(null);
        setPropertyFeaturesAnalysisError(null);
        try {
            if (locationStatus === 'pending') {
                location = await requestLocation();
            }
            const result = await geminiService.researchProperty(addressForResearch, location);
            const researchResult = result.data;

            setResearchData(researchResult.summary);
            setGroundingSources(researchResult.sources ?? []);

            if (researchResult.suburbProfile || researchResult.regionalProfile) {
                setProfileData({ suburb: researchResult.suburbProfile, area: researchResult.regionalProfile });
                // Automatically set profile inclusion to 'both' after fetching details
                setProfileInclusion('both');
            }

            if (researchResult.keyFeatures) {
                const featuresArray = researchResult.keyFeatures.split('\n').filter(f => f.trim().length > 0);
                setKeyFeatures(featuresArray.length > 0 ? featuresArray : null);
            }

            if (researchResult.specs) {
                setPropertyDetails(prev => ({
                    ...prev,
                    beds: researchResult.specs?.beds ?? prev.beds,
                    baths: researchResult.specs?.baths ?? prev.baths,
                    cars: researchResult.specs?.cars ?? prev.cars,
                    landSize: researchResult.specs?.landSize ?? prev.landSize,
                    propertyType: researchResult.specs?.propertyType && PROPERTY_TYPES.includes(researchResult.specs.propertyType as any)
                        ? researchResult.specs.propertyType
                        : prev.propertyType
                }));
                if (researchResult.specs.priceGuide) setPriceGuide(researchResult.specs.priceGuide);
                if (researchResult.specs.lastSold) setLastSoldDetails(researchResult.specs.lastSold);
            } else {
                 parseKeyFeatures(researchResult.keyFeatures);
            }

            setIsFetchComplete(true);
            setPropertyBriefReviewState('review');
            setIsPropertyOverviewExpanded(false);
            setIsSuburbProfileExpanded(false);
            updateLog(logId, { status: 'success', outputs: `Specs: ${JSON.stringify(researchResult.specs)}`, usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "An unknown error occurred during research.";
            setResearchError(msg);
            setIsFetchComplete(false);
            setPropertyBriefReviewState('missing');
            updateLog(logId, { status: 'error', message: msg });
            setNotification("Research failed. Existing property details were kept.");
        } finally {
            setIsResearching(false);
            endCampaignOperation('propertyResearch');
        }
    };

    const handleStrategyAnalysis = async () => {
        if (!researchData) return;
        if (!beginCampaignOperation('copyContextAnalysis', 'Campaign Direction analysis')) return;
        setIsAnalyzingStrategy(true);
        setCopyContextAnalysisError(null);
        const logId = addLog({ stepName: 'AI Strategy Analysis', status: 'pending', inputs: 'Analyzing research for campaign direction' });
        try {
            const profileStr = profileData ? `Suburb: ${profileData.suburb}\nArea: ${profileData.area}` : null;
            const result = await geminiService.analyzeStrategy(researchData, profileStr, imageAnalysis);
            const analysis = result.data;
            setCopyContext({
                primaryTargetMarket: analysis.primaryTargetMarket,
                secondaryTargetMarket: analysis.secondaryTargetMarket || '',
                // Strictly cap to 2 items if the AI somehow returns more
                writingStyle: analysis.writingStyles.slice(0, 2),
                featuresToHighlight: analysis.featuresToHighlight,
                thingsToAvoid: analysis.thingsToAvoid
            });
            setCopyContextAnalysisStatus('success');
            updateLog(logId, { status: 'success', outputs: JSON.stringify(analysis), usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "Failed to analyze strategy.";
            setCopyContextAnalysisStatus('error');
            setCopyContextAnalysisError(msg);
            updateLog(logId, { status: 'error', message: msg });
            setNotification("Strategy analysis failed. Prior strategy settings were kept.");
        } finally {
            setIsAnalyzingStrategy(false);
            endCampaignOperation('copyContextAnalysis');
        }
    };

    const handleFeatureAnalysis = async () => {
        if (!researchData) return;
        if (!beginCampaignOperation('propertyFeaturesAnalysis', 'Property Features AI Analysis')) return;
        setIsAnalyzingFeatures(true);
        setPropertyFeaturesAnalysisError(null);
        const logId = addLog({ stepName: 'AI Feature Extraction', status: 'pending', inputs: 'Extracting property features' });
        try {
            const result = await geminiService.analyzeFeatures(researchData, profileData ? `Suburb: ${profileData.suburb}\nArea: ${profileData.area}` : null, imageAnalysis);
            const analysis = result.data;
            setPropertyFeatures(prev => {
                return prev ? `${prev}\n${analysis.propertyFeatures}` : analysis.propertyFeatures;
            });
            setPropertyFeaturesAnalysisStatus('success');
            updateLog(logId, { status: 'success', outputs: JSON.stringify(analysis), usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "Failed to extract features.";
            setPropertyFeaturesAnalysisStatus('error');
            setPropertyFeaturesAnalysisError(msg);
            updateLog(logId, { status: 'error', message: msg });
            setNotification("Failed to extract property features.");
        } finally {
            setIsAnalyzingFeatures(false);
            endCampaignOperation('propertyFeaturesAnalysis');
        }
    };

    const createNewVersion = (newCopy: string, copyType: PreviewTab, listingBriefSnapshot: string | null = null) => {
        const newVersion: VersionSet = { [copyType]: newCopy };
        const updatedVersionSets = [...versionSets, newVersion].slice(-3);
        setVersionSets(updatedVersionSets);
        setListingCopyBriefSnapshots(prev => {
            const nextSnapshots = [...prev, copyType === LISTING_COPY_TAB ? listingBriefSnapshot : null].slice(-3);
            return nextSnapshots;
        });
        setActiveVersionIndex(updatedVersionSets.length - 1);
        setIncludeContactDetails(false);
    };

    const updateCurrentVersion = (newCopy: string, copyType: PreviewTab) => {
        const updatedVersionSets = [...versionSets];
        const currentVersion = { ...updatedVersionSets[activeVersionIndex] };
        currentVersion[copyType] = newCopy;
        updatedVersionSets[activeVersionIndex] = currentVersion;
        setVersionSets(updatedVersionSets);
    };

    const setListingCopyBriefSnapshotForActiveVersion = (snapshot: string) => {
        setListingCopyBriefSnapshots(prev => {
            const nextSnapshots = [...prev];
            while (nextSnapshots.length < versionSets.length) nextSnapshots.push(null);
            nextSnapshots[activeVersionIndex] = snapshot;
            return nextSnapshots;
        });
    };

    const generateCopyForTab = async (tab: PreviewTab, isRegeneration = false) => {
        const outputLabel = getOutputDisplayLabel(tab);
        if (tab === LISTING_COPY_TAB && !isPropertyBriefReady) {
            const msg = hasFetchedPropertyBrief && propertyBriefReviewState === 'review'
                ? 'Confirm the property brief before generating Listing Copy.'
                : 'Prepare a property brief before generating Listing Copy.';
            setGenerationError(msg);
            setNotification(msg);
            return;
        }
        if (!beginCampaignOperation('generateFullCopy', tab === LISTING_COPY_TAB ? 'Listing copy generation' : `${outputLabel} generation`)) return;
        setIsGenerating(true);
        setGeneratingTab(tab);
        setGenerationError(null);
        scrollToOutputWorkspace();

        const logId = addLog({
            stepName: `Generate Copy (${outputLabel})`,
            status: 'pending',
            inputs: `Generating for ${outputLabel}. Context: ${copyContext.primaryTargetMarket}, ${copyContext.writingStyle.join('+')}`
        });

        const currentVersion = versionSets[activeVersionIndex];
        const isVariant = tab !== LISTING_COPY_TAB;
        const baseCopy = currentVersion ? currentVersion[LISTING_COPY_TAB] : undefined;
        const generationParams: GenerationParams = {
            address,
            includeAddress,
            details: propertyDetails,
            context: copyContext,
            features: propertyFeatures,
            output: outputSettings,
            imageAnalysis,
            researchData,
            profileData,
            profileInclusion,
            agentProfile,
            openHouse
        };
        const listingBriefSnapshot = tab === LISTING_COPY_TAB
            ? buildListingBriefSnapshot(generationParams, propertyBriefReviewState)
            : null;

        if (isVariant && !baseCopy) {
            const msg = `Please generate Listing Copy first for this version before creating a campaign output.`;
            setGenerationError(msg);
            updateLog(logId, { status: 'error', message: msg });
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generateFullCopy');
            return;
        }

        try {
            let copy = '';
            let usage: UsageStats | undefined;

            if (isVariant) {
                const result = await geminiService.generateCopyVariant(baseCopy!, tab, generationParams);
                copy = result.data;
                usage = result.usage;
                updateCurrentVersion(copy, tab);
            } else {
                const result = await geminiService.generateCopy(generationParams, 'Listing Copy');
                copy = result.data;
                usage = result.usage;

                if (isRegeneration) {
                    // When regenerating the master copy, we clear sibling tabs
                    // so the user knows they need to regenerate the rest.
                    // This fixes the "instant download" issue for stale content.
                    const updatedVersionSets = [...versionSets];
                    updatedVersionSets[activeVersionIndex] = { [tab]: copy };
                    setVersionSets(updatedVersionSets);
                    if (listingBriefSnapshot) setListingCopyBriefSnapshotForActiveVersion(listingBriefSnapshot);
                } else if (versionSets.length === 0) {
                    createNewVersion(copy, tab, listingBriefSnapshot);
                } else {
                    updateCurrentVersion(copy, tab);
                    if (listingBriefSnapshot) setListingCopyBriefSnapshotForActiveVersion(listingBriefSnapshot);
                }
            }
            setActiveSubTab(tab);
            setQueuedOutputTabs(prev => prev.filter(queuedTab => queuedTab !== tab));
            if (!isVariant) {
                setCampaignPackBatch(INITIAL_CAMPAIGN_PACK_BATCH_STATE);
            } else {
                setCampaignPackBatch(prev => {
                    if (prev.status !== 'partial_failed' || prev.failedOutputId !== tab) return prev;
                    const remainingOutputIds = prev.remainingOutputIds.filter(outputId => outputId !== tab);
                    return {
                        ...prev,
                        status: remainingOutputIds.length === 0 ? 'complete' : 'idle',
                        currentOutputId: null,
                        currentOutputTitle: null,
                        currentCategory: null,
                        currentIndex: null,
                        failedOutputId: null,
                        remainingOutputIds,
                        userMessage: null,
                        diagnostic: null,
                    };
                });
            }
            updateLog(logId, { status: 'success', outputs: copy.substring(0, 100) + '...', usage });
            focusSelectedOutput();
            if (tab === LISTING_COPY_TAB) {
                setNotification('Listing Copy is ready. Review it below, then generate Campaign Pack if needed.');
            }

        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : `An error occurred while generating copy for ${outputLabel}.`;
            setGenerationError(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generateFullCopy');
        }
    };

    const handleGenerateAllMissing = async () => {
        const currentVersion = versionSets[activeVersionIndex];
        if (!currentVersion || !currentVersion[LISTING_COPY_TAB]) {
            setNotification("Generate Listing Copy before creating the Campaign Pack.");
            return;
        }
        if (!beginCampaignOperation('generateAllVariations', 'Campaign Pack generation')) return;

        setIsCampaignLibraryExpanded(true);
        scrollToOutputWorkspace();
        const missingTabs = DOWNSTREAM_CAMPAIGN_TABS.filter(tab => !currentVersion[tab]);
        if (missingTabs.length === 0) {
            setNotification("Campaign Pack is already ready.");
            setCampaignPackBatch({
                ...INITIAL_CAMPAIGN_PACK_BATCH_STATE,
                status: 'complete',
                succeededOutputIds: DOWNSTREAM_CAMPAIGN_TABS,
            });
            endCampaignOperation('generateAllVariations');
            return;
        }
        const generationParams: GenerationParams = {
            address,
            includeAddress,
            details: propertyDetails,
            context: copyContext,
            features: propertyFeatures,
            output: outputSettings,
            imageAnalysis,
            researchData,
            profileData,
            profileInclusion,
            agentProfile,
            openHouse
        };

        setIsGenerating(true);
        const logId = addLog({ stepName: 'Generate Campaign Pack', status: 'pending', inputs: `Generating ${missingTabs.length} missing campaign output(s) from Listing Copy.` });
        const childUsages: Array<UsageStats | undefined> = [];
        const succeededOutputIds: PreviewTab[] = [];
        let currentOutputId: PreviewTab | null = null;
        let currentOutputTitle: string | null = null;
        let currentOutputCategory: string | null = null;
        let currentIndex = 0;

        try {
            const targetVersionIndex = activeVersionIndex;
            const listingCopy = currentVersion[LISTING_COPY_TAB]!;

            setCampaignPackBatch({
                status: 'generating',
                startedCount: missingTabs.length,
                requestedOutputIds: missingTabs,
                currentOutputId: null,
                currentOutputTitle: null,
                currentCategory: null,
                currentIndex: null,
                succeededOutputIds: [],
                failedOutputId: null,
                remainingOutputIds: missingTabs,
                userMessage: null,
                diagnostic: null,
            });

            for (const [index, tab] of missingTabs.entries()) {
                currentIndex = index + 1;
                currentOutputId = tab;
                currentOutputTitle = getCampaignPackOutputTitle(tab);
                currentOutputCategory = getCampaignOutputCategory(tab);
                setActiveMainTab(currentOutputCategory);
                setActiveSubTab(tab);
                setGeneratingTab(tab);
                setCampaignPackBatch(prev => ({
                    ...prev,
                    status: 'generating',
                    currentOutputId,
                    currentOutputTitle,
                    currentCategory: currentOutputCategory,
                    currentIndex,
                    succeededOutputIds: [...succeededOutputIds],
                    remainingOutputIds: missingTabs.slice(index),
                    userMessage: null,
                    diagnostic: null,
                }));
                updateLog(logId, {
                    inputs: [
                        `Generating ${missingTabs.length} missing campaign output(s) from Listing Copy.`,
                        `Current output: ${currentOutputTitle}`,
                        `Current output id: ${tab}`,
                        `Category: ${currentOutputCategory}`,
                        `Sequence position: ${currentIndex}/${missingTabs.length}`,
                        `Succeeded so far: ${succeededOutputIds.length}`,
                    ].join('\n'),
                });

                const result = await geminiService.generateCopyVariant(listingCopy, tab, generationParams);
                childUsages.push(result.usage);
                succeededOutputIds.push(tab);

                setVersionSets(prev => {
                    const newSets = [...prev];
                    const current = { ...newSets[targetVersionIndex] };
                    current[tab] = result.data;
                    newSets[targetVersionIndex] = current;
                    return newSets;
                });
                setCampaignPackBatch(prev => ({
                    ...prev,
                    succeededOutputIds: [...succeededOutputIds],
                    remainingOutputIds: missingTabs.slice(index + 1),
                }));
            }
            setCampaignPackBatch({
                status: 'complete',
                startedCount: missingTabs.length,
                requestedOutputIds: missingTabs,
                currentOutputId: null,
                currentOutputTitle: null,
                currentCategory: null,
                currentIndex: null,
                succeededOutputIds: [...succeededOutputIds],
                failedOutputId: null,
                remainingOutputIds: [],
                userMessage: null,
                diagnostic: null,
            });
            updateLog(logId, {
                status: 'success',
                message: 'Campaign Pack processed',
                outputs: [
                    `Requested outputs: ${missingTabs.length}`,
                    `Succeeded outputs: ${succeededOutputIds.length}`,
                    `Remaining outputs: 0`,
                    `Generated output ids: ${formatCampaignPackOutputList(succeededOutputIds)}`,
                ].join('\n'),
                usage: aggregateUsage('Generate Campaign Pack', childUsages, 'mixed variant models')
            });
            setSelectedOutputCategory('All');
            focusSelectedOutput();
            setNotification("Campaign Pack is ready. Review the Campaign Library or download generated outputs.");
        } catch (error) {
            console.error("Error generating Campaign Pack:", error);
            const attemptedCount = currentIndex;
            const failedOutputId = currentOutputId;
            const failedTitle = currentOutputTitle;
            const remainingOutputIds = failedOutputId
                ? missingTabs.slice(Math.max(0, attemptedCount - 1))
                : missingTabs.filter(tab => !succeededOutputIds.includes(tab));
            const diagnostic = normalizeSafeError(error, 'Campaign Pack generation stopped before finishing.');
            const userMessage = buildCampaignPackPausedMessage(failedTitle, succeededOutputIds.length, remainingOutputIds.length);
            if (failedOutputId) {
                setActiveMainTab(getCampaignOutputCategory(failedOutputId));
                setActiveSubTab(failedOutputId);
            }

            setCampaignPackBatch({
                status: 'partial_failed',
                startedCount: missingTabs.length,
                requestedOutputIds: missingTabs,
                currentOutputId: failedOutputId,
                currentOutputTitle: failedTitle,
                currentCategory: currentOutputCategory,
                currentIndex: attemptedCount || null,
                succeededOutputIds: [...succeededOutputIds],
                failedOutputId,
                remainingOutputIds,
                userMessage,
                diagnostic,
            });
            setNotification(userMessage);
            updateLog(logId, {
                status: 'error',
                message: userMessage,
                outputs: buildCampaignPackFailureDiagnostics({
                    requestedCount: missingTabs.length,
                    attemptedCount: attemptedCount || succeededOutputIds.length,
                    succeededOutputIds,
                    failedOutputId,
                    remainingOutputIds,
                    diagnostic,
                }),
                usage: childUsages.length > 0 ? aggregateUsage('Generate Campaign Pack partial', childUsages, 'mixed variant models') : undefined,
            });
        } finally {
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generateAllVariations');
        }
    };

    const handleGenerateThisOutput = (tab: PreviewTab) => {
        const currentVersion = versionSets[activeVersionIndex];
        if (currentVersion?.[tab] || generatingTab === tab) return;

        if (tab !== LISTING_COPY_TAB && !currentVersion?.[LISTING_COPY_TAB]) {
            setNotification("Generate Listing Copy before creating this campaign output.");
            return;
        }

        const activeOutputOperation = Array.from<ActiveCampaignOperation>(activeCampaignOperationsRef.current.values()).find(operation => (
            campaignOperationsConflict('generateFullCopy', operation.id)
        ));

        if (activeOutputOperation) {
            setQueuedOutputTabs(prev => prev.includes(tab) ? prev : [...prev, tab]);
            setNotification(`${getOutputDisplayLabel(tab)} queued after ${activeOutputOperation.label}.`);
            return;
        }

        generateCopyForTab(tab);
    };

    const handleTabClick = (mainTab: string, subTab: PreviewTab) => {
        setActiveMainTab(mainTab);
        setActiveSubTab(subTab);
        setIncludeContactDetails(false);
        const currentVersion = versionSets[activeVersionIndex];
        if (currentVersion && !currentVersion[subTab]) {
            handleGenerateThisOutput(subTab);
        }
    };

    const handleCategoryFilterClick = (category: CampaignOutputCategoryFilter) => {
        setSelectedOutputCategory(category);
    };

    const contactCard = `\n\n---\nFor more information or to arrange a private inspection, please contact:\n\n${agentProfile.name || '[Agent Name]'}\n${agentProfile.agency || '[Agency Name]'}\n${agentProfile.phone || '[Phone]'}\n${agentProfile.email || '[Email]'}`;
    const contactCardRegex = new RegExp(`\\s*---\\s*For more information.*`, 's');

    const handleToggleContactDetails = (shouldInclude: boolean) => {
        setIncludeContactDetails(shouldInclude);
        const currentCopy = versionSets[activeVersionIndex]?.[activeSubTab] || '';
        let newCopy = currentCopy;

        if (shouldInclude) {
            if (!contactCardRegex.test(newCopy)) {
                newCopy = newCopy.trim() + contactCard;
            }
        } else {
            newCopy = newCopy.replace(contactCardRegex, '').trim();
        }

        updateCurrentVersion(newCopy, activeSubTab);
    };

    const handleCopyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setNotification('Copied to clipboard!');
    };

    const handleExportWord = (text: string, title: string) => {
        const formattedText = text.replace(/\n/g, '<br />');
        const htmlContent = `
            <!DOCTYPE html>
            <html>
                <head>
                    <meta charset="UTF-8">
                    <title>${title}</title>
                </head>
                <body>
                    ${formattedText}
                </body>
            </html>
        `;
        const blob = new Blob([htmlContent], { type: 'application/vnd.ms-word' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizeFileNamePart(title)}.doc`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportTxt = (text: string, title: string) => {
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${sanitizeFileNamePart(title)}.txt`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = (text: string) => {
        const printArea = document.getElementById('print-render-area');
        if (printArea) {
            printArea.innerText = text;
            window.print();
        }
    };

    const downloadExportDocument = (document: CampaignExportDocument, format: 'pdf' | 'word' | 'txt') => {
        if (format === 'word') handleExportWord(document.content, document.fileBaseName);
        else if (format === 'txt') handleExportTxt(document.content, document.fileBaseName);
        else handleExportPdf(document.content);
    };

    const buildInputSnapshotSummary = (): CampaignExportInputSnapshotSummary => ({
        includeAddress,
        propertyType: propertyDetails.propertyType,
        bedrooms: propertyDetails.beds,
        bathrooms: propertyDetails.baths,
        carSpaces: propertyDetails.cars,
        landSize: propertyDetails.landSize,
        primaryTargetMarket: copyContext.primaryTargetMarket,
        secondaryTargetMarket: copyContext.secondaryTargetMarket || undefined,
        writingStyles: copyContext.writingStyle,
        wordCount: outputSettings.wordCount,
        propertyFeaturesProvided: Boolean(propertyFeatures.trim()),
        imageAnalysisProvided: Boolean(imageAnalysis?.trim()),
        researchProvided: Boolean(researchData?.trim()),
        suburbOrAreaProfileIncluded: profileInclusion !== 'none' && Boolean(profileData),
        openHouseProvided: Boolean(openHouse.date || openHouse.time || openHouse.url),
        agentProfileProvided: Boolean(agentProfile.name || agentProfile.agency || agentProfile.phone || agentProfile.email),
    });

    const buildUsageCostSummary = (): CampaignExportUsageCostSummary => {
        const costValues = debugLogs
            .map(log => log.usage?.estimatedCost)
            .filter((cost): cost is number => typeof cost === 'number');
        return {
            operationCount: debugLogs.length,
            successfulOperationCount: debugLogs.filter(log => log.status === 'success').length,
            errorOperationCount: debugLogs.filter(log => log.status === 'error').length,
            pendingOperationCount: debugLogs.filter(log => log.status === 'pending').length,
            models: Array.from(new Set(debugLogs.map(log => log.usage?.model).filter((model): model is string => Boolean(model)))),
            tokenOnlyEstimatedCost: costValues.length > 0 ? costValues.reduce((sum, cost) => sum + cost, 0) : null,
            usageUnavailableCount: debugLogs.filter(log => log.usage?.usageStatus === 'unavailable').length,
            unknownCostCount: debugLogs.filter(log => log.usage?.pricingStatus === 'unknown' || log.usage?.unknownCostOperationCount).length,
        };
    };

    const buildGenerationLogSummary = (): CampaignExportGenerationLogSummary => ({
        totalEntries: debugLogs.length,
        recentSteps: debugLogs.slice(0, 8).map(log => `${log.status}: ${log.stepName}`),
    });

    const buildPropertyContextSummary = (): string => {
        const summaryParts = [
            researchData?.trim() ? 'Research summary available' : 'No research summary',
            propertyFeatures.trim() ? 'property features provided' : 'no extra property features',
            imageAnalysis?.trim() ? 'photo analysis available' : 'no photo analysis',
            profileData && profileInclusion !== 'none' ? `profile inclusion: ${profileInclusion}` : 'no profile inclusion',
        ];
        return summaryParts.join('; ');
    };

    const buildCurrentExportPlan = (exportScope?: CampaignExportScope) => buildCampaignExportPlan({
        address,
        versionNumber: activeVersionIndex + 1,
        sections: currentVersionSet,
        orderedTabs: ALL_CONTENT_TABS,
        categories: campaignExportCategories,
        selectedTab: activeSubTab,
        selectedCategory: selectedOutputCategory,
        exportScope,
        includeContactDetails,
        contactCard,
        generatedAt: new Date(),
        propertyContextSummary: buildPropertyContextSummary(),
        inputSnapshotSummary: buildInputSnapshotSummary(),
        usageCostSummary: buildUsageCostSummary(),
        generationLogSummary: buildGenerationLogSummary(),
    });

    const handleDownloadCurrentOutput = (format: 'pdf' | 'word' | 'txt') => {
        const exportPlan = buildCurrentExportPlan('current_output');
        const outputDocument = exportPlan.individualOutputDocuments.find(document => document.outputIds.includes(activeSubTab));

        if (!outputDocument) {
            setNotification('No generated output selected.');
            return;
        }

        downloadExportDocument(outputDocument, format);
        setIsExportMenuOpen(false);
    };

    const handleDownloadCurrentCategory = (format: 'pdf' | 'word' | 'txt') => {
        if (selectedOutputCategory === 'All') {
            setNotification('Choose a category before downloading the current category.');
            return;
        }

        const exportPlan = buildCurrentExportPlan('current_category');
        const categoryDocument = exportPlan.selectedCategoryDocument;

        if (!categoryDocument || categoryDocument.outputIds.length === 0) {
            setNotification(`No generated outputs in ${selectedOutputCategory} yet.`);
            return;
        }

        downloadExportDocument(categoryDocument, format);
        setIsCategoryExportMenuOpen(false);
    };

    const handleDownloadAll = (format: 'pdf' | 'word' | 'txt') => {
        const exportPlan = buildCurrentExportPlan('campaign_document');
        if (exportPlan.generatedSections.length === 0) {
            setNotification('No generated outputs in this campaign yet.');
            return;
        }
        if (!beginCampaignOperation('exportFullCampaign', 'Full campaign document download')) return;
        setIsDownloadingAll(true);
        setIsDownloadAllMenuOpen(false);
        setNotification("Preparing full campaign document...");
        const logId = addLog({
            stepName: 'Download Full Campaign Document',
            status: 'pending',
            inputs: 'Exporting generated sections only; no missing outputs are generated during download.'
        });

        try {
            downloadExportDocument(exportPlan.masterDocument, format);
            setNotification("Full campaign document downloaded.");
            updateLog(logId, {
                status: 'success',
                message: `Full campaign document exported with ${exportPlan.generatedSections.length} generated section(s) and ${exportPlan.missingSections.length} missing section(s) noted.`,
                outputs: `Manifest scope: ${exportPlan.manifest.exportScope}; included outputs: ${exportPlan.manifest.includedOutputIds.length}; missing outputs: ${exportPlan.manifest.missingOutputIds.length}.`
            });
        } catch (error) {
            console.error("Error during 'Download All':", error);
            const msg = error instanceof Error ? error.message : "An error occurred while exporting campaign copy.";
            setNotification(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsDownloadingAll(false);
            endCampaignOperation('exportFullCampaign');
        }
    };

    const handleBetaAccessSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const enteredCode = betaCodeInput.trim();
        if (!enteredCode) {
            setBetaAccessError('Enter the beta access code to continue.');
            return;
        }

        setIsVerifyingBetaAccess(true);
        setBetaAccessError(null);
        try {
            await geminiService.verifyBetaAccess(enteredCode);
            setBetaCodeInput('');
            setIsBetaVerified(true);
        } catch (error) {
            geminiService.clearBetaAccess();
            setBetaAccessError(error instanceof Error ? error.message : 'Beta access was rejected.');
        } finally {
            setIsVerifyingBetaAccess(false);
        }
    };

    const currentVersionSet = versionSets[activeVersionIndex] || {};
    const currentCopy = currentVersionSet[activeSubTab] || '';
    const getCampaignOperationBlocker = (id: CampaignOperationId): ActiveCampaignOperation | null => {
        return activeCampaignOperations.find(operation => campaignOperationsConflict(id, operation.id)) ?? null;
    };
    const getCampaignOperationTitle = (id: CampaignOperationId, fallback?: string): string | undefined => {
        const blocker = getCampaignOperationBlocker(id);
        if (blocker) return blocker.id === id ? `${blocker.label} is already running.` : `${blocker.label} is running. Try again when it finishes.`;
        return fallback;
    };
    const getAnalysisButtonLabel = (isRunning: boolean, status: AnalysisRunStatus): string => {
        if (isRunning) return 'Analyzing...';
        if (status === 'error') return 'Retry AI Analysis';
        if (status === 'success') return 'Redo AI Analysis';
        return 'AI Analysis';
    };
    const copyContextAnalysisBlocker = getCampaignOperationBlocker('copyContextAnalysis');
    const propertyFeaturesAnalysisBlocker = getCampaignOperationBlocker('propertyFeaturesAnalysis');
    const imageAnalysisBlocker = getCampaignOperationBlocker('imageAnalysis');
    const propertyResearchBlocker = getCampaignOperationBlocker('propertyResearch');
    const generateCopyBlocker = getCampaignOperationBlocker('generateFullCopy');
    const generateAllBlocker = getCampaignOperationBlocker('generateAllVariations');
    const exportFullCampaignBlocker = getCampaignOperationBlocker('exportFullCampaign');

    useEffect(() => {
        if (queuedOutputTabs.length === 0 || isGenerating || getCampaignOperationBlocker('generateFullCopy')) return;

        const [nextTab, ...remainingTabs] = queuedOutputTabs;
        if (!nextTab) return;

        setQueuedOutputTabs(remainingTabs);
        if (!currentVersionSet[nextTab] && (nextTab === LISTING_COPY_TAB || currentVersionSet[LISTING_COPY_TAB])) {
            generateCopyForTab(nextTab);
        }
    }, [queuedOutputTabs, isGenerating, activeCampaignOperations, currentVersionSet]);

    const allTabsGenerated = useMemo(() => {
        return ALL_CONTENT_TABS.every(tab => !!currentVersionSet[tab]);
    }, [currentVersionSet]);
    const listingCopyReady = Boolean(currentVersionSet[LISTING_COPY_TAB]);
    const isListingCopyGenerating = isGenerating && generatingTab === LISTING_COPY_TAB;
    const campaignPackReadyCount = DOWNSTREAM_CAMPAIGN_TABS.filter(tab => Boolean(currentVersionSet[tab])).length;
    const campaignPackMissingCount = TOTAL_DOWNSTREAM_CAMPAIGN_OUTPUTS - campaignPackReadyCount;
    const isCampaignPackGenerating = isGenerating && generatingTab !== LISTING_COPY_TAB;
    const isCampaignPackReady = listingCopyReady && campaignPackMissingCount === 0;
    const hasCampaignPackStarted = campaignPackReadyCount > 0 || DOWNSTREAM_CAMPAIGN_TABS.some(tab => queuedOutputTabs.includes(tab)) || isCampaignPackGenerating;
    const currentListingBriefSnapshot = useMemo(() => buildListingBriefSnapshot({
        address,
        includeAddress,
        details: propertyDetails,
        context: copyContext,
        features: propertyFeatures,
        output: outputSettings,
        imageAnalysis,
        researchData,
        profileData,
        profileInclusion,
        agentProfile,
        openHouse
    }, propertyBriefReviewState), [address, includeAddress, propertyDetails, copyContext, propertyFeatures, outputSettings, imageAnalysis, researchData, profileData, profileInclusion, agentProfile, openHouse, propertyBriefReviewState]);
    const storedListingBriefSnapshot = listingCopyBriefSnapshots[activeVersionIndex] ?? null;
    const briefChangedSinceListingGeneration = listingCopyReady && Boolean(storedListingBriefSnapshot) && currentListingBriefSnapshot !== storedListingBriefSnapshot;
    const regenerateListingCopyDisabledReason = !isPropertyBriefReady
        ? propertyBriefReadinessHint
        : !briefChangedSinceListingGeneration
            ? 'Make a change to the property brief, Campaign Direction, features or photos before regenerating.'
            : undefined;
    const handleRegenerateListingCopy = () => {
        if (!briefChangedSinceListingGeneration) {
            setNotification('Update the Brief Builder inputs before regenerating Listing Copy.');
            return;
        }
        if (campaignPackReadyCount > 0) {
            const confirmed = window.confirm('Regenerating Listing Copy will clear the Campaign Pack outputs because they are based on the current listing. Download the campaign first if you want to keep it.');
            if (!confirmed) return;
        }
        generateCopyForTab(LISTING_COPY_TAB, true);
    };

    const currentCampaignExportPlan = useMemo(() => buildCampaignExportPlan({
        address,
        versionNumber: activeVersionIndex + 1,
        sections: currentVersionSet,
        orderedTabs: ALL_CONTENT_TABS,
        categories: campaignExportCategories,
        selectedTab: activeSubTab,
        selectedCategory: selectedOutputCategory,
        includeContactDetails,
        contactCard,
        propertyContextSummary: buildPropertyContextSummary(),
        inputSnapshotSummary: buildInputSnapshotSummary(),
        usageCostSummary: buildUsageCostSummary(),
        generationLogSummary: buildGenerationLogSummary(),
    }), [address, activeVersionIndex, currentVersionSet, activeSubTab, selectedOutputCategory, includeContactDetails, contactCard, researchData, propertyFeatures, imageAnalysis, profileData, profileInclusion, includeAddress, propertyDetails, copyContext, outputSettings, openHouse, agentProfile, debugLogs]);
    const campaignOutputSections = useMemo(() => {
        return currentCampaignExportPlan.sectionDocuments.map(section => {
            const group = mainTabs.find(tabGroup => previewTabConfig[tabGroup].includes(section.tab)) || 'Campaign';
            const configuredMeta = CAMPAIGN_OUTPUT_SECTION_META[section.tab];
            const status: CampaignOutputStatus = generatingTab === section.tab
                ? 'generating'
                : queuedOutputTabs.includes(section.tab)
                    ? 'queued'
                : campaignPackBatch.status === 'partial_failed' && campaignPackBatch.failedOutputId === section.tab
                    ? 'retry-needed'
                : section.generated
                    ? 'ready'
                    : section.tab === LISTING_COPY_TAB || !currentVersionSet[LISTING_COPY_TAB]
                        ? 'needs-generation'
                        : 'missing';

            return {
                id: section.tab,
                label: section.tab,
                displayLabel: configuredMeta.displayLabel || getOutputDisplayLabel(section.tab),
                group,
                slug: section.slug,
                ...configuredMeta,
                generated: section.generated,
                selected: activeSubTab === section.tab,
                status,
            };
        });
    }, [activeSubTab, currentCampaignExportPlan.sectionDocuments, currentVersionSet, generatingTab, queuedOutputTabs, campaignPackBatch.status, campaignPackBatch.failedOutputId]);
    const selectedCampaignOutput = campaignOutputSections.find(section => section.id === activeSubTab);
    const isSelectedOutputRetryNeeded = selectedCampaignOutput?.status === 'retry-needed';
    const readyOutputCount = currentCampaignExportPlan.generatedSections.length;
    const missingOutputCount = currentCampaignExportPlan.missingSections.length;
    const filteredCampaignOutputSections = useMemo(() => {
        if (selectedOutputCategory === 'All') return campaignOutputSections;
        return campaignOutputSections.filter(section => section.group === selectedOutputCategory);
    }, [campaignOutputSections, selectedOutputCategory]);
    const selectedCategoryStats = useMemo(() => {
        const sections = selectedOutputCategory === 'All'
            ? campaignOutputSections
            : campaignOutputSections.filter(section => section.group === selectedOutputCategory);
        const ready = sections.filter(section => section.status === 'ready').length;
        const generating = sections.filter(section => section.status === 'generating' || section.status === 'queued').length;
        const missing = sections.length - ready - generating;
        return {
            total: sections.length,
            ready,
            missing,
            generating,
            complete: sections.length > 0 && ready === sections.length,
        };
    }, [campaignOutputSections, selectedOutputCategory]);
    const getCategoryStats = (category: CampaignOutputCategoryFilter) => {
        const sections = category === 'All'
            ? campaignOutputSections
            : campaignOutputSections.filter(section => section.group === category);
        const ready = sections.filter(section => section.status === 'ready').length;
        const generating = sections.filter(section => section.status === 'generating' || section.status === 'queued').length;
        const missing = sections.length - ready - generating;
        return { total: sections.length, ready, missing, generating };
    };
    const hasGeneratedOutputsInSelectedCategory = selectedOutputCategory !== 'All' && filteredCampaignOutputSections.some(section => section.generated);
    const isCampaignOutputsActive = isGenerating || isDownloadingAll;
    const getCampaignOutputStatusLabel = (status: CampaignOutputStatus): string => {
        if (status === 'ready') return 'Ready';
        if (status === 'generating') return 'Generating';
        if (status === 'queued') return 'Queued';
        if (status === 'retry-needed') return 'Retry needed';
        if (status === 'missing') return 'Missing';
        return 'Needs generation';
    };
    const getCampaignOutputStatusClass = (status: CampaignOutputStatus): string => {
        if (status === 'ready') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
        if (status === 'generating') return 'bg-amber-50 text-amber-800 border-amber-200';
        if (status === 'queued') return 'bg-amber-50 text-amber-800 border-amber-200';
        if (status === 'retry-needed') return 'bg-amber-50 text-amber-800 border-amber-200';
        if (status === 'missing') return 'bg-stone-100 text-stone-600 border-stone-200';
        return 'bg-amber-50 text-amber-800 border-amber-200';
    };
    const campaignStatusSteps = [
        {
            number: 1,
            label: 'Property Brief',
            anchor: 'property-brief',
            state: isResearching ? 'current' : isPropertyBriefReady ? 'complete' : hasFetchedPropertyBrief || address.trim() ? 'current' : 'missing',
        },
        {
            number: 2,
            label: 'Agent and Open Home',
            anchor: 'agent-open-home',
            state: agentProfile.name || agentProfile.agency || agentProfile.phone || agentProfile.email || openHouse.date || openHouse.time || openHouse.url ? 'complete' : 'missing',
        },
        {
            number: 3,
            label: 'Campaign Direction',
            anchor: 'copy-context',
            state: isAnalyzingStrategy ? 'current' : copyContextAnalysisStatus === 'success' || copyContext.primaryTargetMarket || copyContext.writingStyle.length > 0 ? 'complete' : 'missing',
        },
        {
            number: 4,
            label: 'Features and Photos',
            anchor: 'features-photos',
            state: isAnalyzingFeatures || isAnalyzingImages ? 'current' : propertyFeatures.trim() || imageAnalysis || imageFiles.length > 0 ? 'complete' : 'missing',
        },
        {
            number: 5,
            label: 'Outputs and Downloads',
            anchor: 'campaign-outputs',
            state: isCampaignOutputsActive ? 'current' : readyOutputCount > 0 ? 'complete' : 'missing',
        },
    ] as const;
    const campaignStatusLabel = activeCampaignOperations.length > 0
        ? 'Working'
        : readyOutputCount > 0
            ? allTabsGenerated ? 'Ready for review' : 'Draft in progress'
            : 'Idle';
    const plainCampaignProgress = useMemo(() => {
        if (isAddressLookupQueued || isSuggesting) {
            return {
                label: 'Looking up property',
                description: 'Matching the address so you can choose the right property.',
                tone: 'working' as const,
            };
        }
        if (isResearching) {
            return {
                label: 'Reviewing property context',
                description: 'Collecting property and local context for the campaign draft.',
                tone: 'working' as const,
            };
        }
        if (isAnalyzingStrategy) {
            return {
                label: 'Creating campaign strategy',
                description: 'Choosing audience and style guidance from the approved context.',
                tone: 'working' as const,
            };
        }
        if (isAnalyzingFeatures) {
            return {
                label: 'Extracting features',
                description: 'Pulling likely selling points into the property features.',
                tone: 'working' as const,
            };
        }
        if (isAnalyzingImages) {
            return {
                label: 'Reviewing property photos',
                description: 'Finding visual features that may support the campaign copy.',
                tone: 'working' as const,
            };
        }
        if (isGenerating) {
            return {
                label: isCampaignPackGenerating ? 'Generating Campaign Pack' : 'Generating outputs',
                description: generatingTab ? `Creating ${getOutputDisplayLabel(generatingTab)}.` : 'Creating campaign drafts.',
                tone: 'working' as const,
            };
        }
        if (isDownloadingAll) {
            return {
                label: 'Packaging downloads',
                description: 'Preparing generated outputs only. Missing outputs are not generated silently.',
                tone: 'working' as const,
            };
        }
        if (campaignPackBatch.status === 'partial_failed' && campaignPackBatch.userMessage) {
            return {
                label: 'Campaign Pack paused',
                description: campaignPackBatch.userMessage,
                tone: 'attention' as const,
            };
        }
        if (allTabsGenerated) {
            return {
                label: 'Campaign ready',
                description: 'All configured outputs are ready for review, copy or download.',
                tone: 'ready' as const,
            };
        }
        if (readyOutputCount > 0 && missingOutputCount > 0) {
            return {
                label: listingCopyReady ? 'Listing Copy ready' : 'Some outputs missing',
                description: listingCopyReady
                    ? 'Generate Campaign Pack to create the remaining campaign outputs.'
                    : 'Review ready drafts now, or generate Listing Copy to continue.',
                tone: 'attention' as const,
            };
        }
        if (readyOutputCount > 0) {
            return {
                label: 'Ready for review',
                description: 'Generated drafts are available for review, copy or download.',
                tone: 'ready' as const,
            };
        }
        if (hasFetchedPropertyBrief && propertyBriefReviewState === 'review') {
            return {
                label: 'Review property brief',
                description: 'Review and confirm the property facts before generating Listing Copy.',
                tone: 'attention' as const,
            };
        }
        if (isPropertyBriefReady) {
            return {
                label: propertyBriefStatusLabel,
                description: 'Generate Listing Copy from the approved property brief, then continue to Campaign Pack.',
                tone: 'ready' as const,
            };
        }
        if (address.trim()) {
            if (!hasSelectedAddressForFetch && !hasFetchedPropertyBrief) {
                return {
                    label: 'Select an address',
                    description: fetchDetailsRequirementText,
                    tone: 'attention' as const,
                };
            }
            return {
                label: hasSelectedAddressForFetch ? 'Ready to fetch details' : 'Review property brief',
                description: hasSelectedAddressForFetch ? 'Fetch details to build the property brief.' : 'Review and confirm the property facts before generating copy.',
                tone: 'idle' as const,
            };
        }
        return {
            label: 'Ready to start',
            description: 'Start with a property address and select one of the suggestions.',
            tone: 'idle' as const,
        };
    }, [isAddressLookupQueued, isSuggesting, isResearching, isAnalyzingStrategy, isAnalyzingFeatures, isAnalyzingImages, isGenerating, isDownloadingAll, generatingTab, campaignPackBatch.status, campaignPackBatch.userMessage, allTabsGenerated, readyOutputCount, missingOutputCount, hasFetchedPropertyBrief, isPropertyBriefReady, propertyBriefStatusLabel, propertyBriefReviewState, address, hasSelectedAddressForFetch]);
    const plainCampaignProgressClass = plainCampaignProgress.tone === 'working'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : plainCampaignProgress.tone === 'ready'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
            : plainCampaignProgress.tone === 'attention'
                ? 'border-amber-200 bg-amber-50 text-amber-900'
                : 'border-stone-200 bg-white text-slate-700';
    const getCampaignStepClass = (state: 'complete' | 'current' | 'missing') => {
        if (state === 'complete') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
        if (state === 'current') return 'border-amber-200 bg-amber-50 text-amber-800';
        return 'border-stone-200 bg-white text-slate-500';
    };
    const scrollToCampaignStatusStep = (anchor: string) => {
        document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const scrollToOutputWorkspace = () => {
        outputWorkspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    const focusSelectedOutput = () => {
        window.setTimeout(() => {
            selectedOutputCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            generatedOutputRef.current?.focus({ preventScroll: true });
        }, 80);
    };
    const visualHighlightEntries = useMemo(() => imageAnalysis ? parseVisualHighlights(imageAnalysis) : [], [imageAnalysis]);

    const renderVisualHighlights = () => {
        if (visualHighlightEntries.length === 0) return null;

        return (
            <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-700">{visualHighlightEntries.length} image highlight{visualHighlightEntries.length === 1 ? '' : 's'} analyzed</p>
                    <p className="text-[11px] text-slate-500">Expand a row for detail.</p>
                </div>
                {visualHighlightEntries.map(highlight => {
                    const isExpanded = Boolean(expandedVisualHighlights[highlight.imageNumber]);
                    const details = highlight.details.length > 0 ? highlight.details : [highlight.rawDetail].filter(Boolean);

                    return (
                        <div key={highlight.imageNumber} className="overflow-hidden rounded-md border border-stone-200 bg-white">
                            <button
                                type="button"
                                onClick={() => setExpandedVisualHighlights(prev => ({
                                    ...prev,
                                    [highlight.imageNumber]: !prev[highlight.imageNumber],
                                }))}
                                className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-50"
                                aria-expanded={isExpanded}
                            >
                                <div className="flex min-w-0 gap-3">
                                    <span className="flex h-7 min-w-7 items-center justify-center rounded-full border border-red-100 bg-red-50 text-[11px] font-bold text-red-700">
                                        {highlight.imageNumber}
                                    </span>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Image highlight</p>
                                        <p className="mt-0.5 text-sm font-semibold leading-snug text-slate-900">{highlight.summary}</p>
                                    </div>
                                </div>
                                <IconChevronDown className={`mt-0.5 h-4 w-4 shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </button>
                            {isExpanded && (
                                <div className="border-t border-stone-100 bg-stone-50/50 px-3 py-2.5">
                                    {details.length > 0 ? (
                                        <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                                            {details.map((detail, detailIndex) => (
                                                <li key={detailIndex} className="flex gap-2">
                                                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">{highlight.rawDetail}</p>
                                    )}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const renderProfileContent = (content: string | null) => {
        if (!content) return null;

        // Simple heuristic to check if content looks like raw JSON
        if (content.trim().startsWith('{') && content.trim().endsWith('}')) {
            try {
                const parsed = JSON.parse(content);
                return (
                    <div className="space-y-2">
                        {Object.entries(parsed).map(([key, value]) => (
                            <div key={key}>
                                <span className="font-bold capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}:</span>
                                <span className="ml-2 text-slate-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                        ))}
                    </div>
                );
            } catch (e) {
                // Not valid JSON or failed to parse, fallback to raw text
            }
        }

        return <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{content}</p>;
    };

    if (isCheckingBetaAccess) {
        return (
            <div className={`${aimUi.pageShell} flex items-center justify-center px-4`}>
                <div className="inline-flex items-center text-sm text-slate-600">
                    <Spinner className="mr-2" />
                    Checking beta access...
                </div>
            </div>
        );
    }

    if (!isBetaVerified) {
        return (
            <div className={`${aimUi.pageShell} flex items-center justify-center px-4`}>
                <div className={`w-full max-w-md p-6 ${aimUi.card}`}>
                    <div className="mb-6">
                        <h1 className="text-2xl text-slate-900">
                            <span className="font-bold">Real Estate AIM</span>
                            <span className="font-light text-slate-600"> | Copywriting Agent</span>
                        </h1>
                        <p className="text-sm text-slate-600 mt-2">Private beta access is required before using the copywriting workspace.</p>
                        <p className="text-xs leading-relaxed text-slate-500 mt-2">AIM creates campaign drafts from the property information you provide or approve. Review generated copy before use.</p>
                    </div>
                    <form onSubmit={handleBetaAccessSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="beta-access-code" className="block text-sm font-medium text-slate-700 mb-1">Beta access code</label>
                            <input
                                id="beta-access-code"
                                type="password"
                                value={betaCodeInput}
                                onChange={(event) => setBetaCodeInput(event.target.value)}
                                className={aimUi.input}
                                autoComplete="off"
                            />
                        </div>
                        {betaAccessError && <p className="text-sm text-red-500">{betaAccessError}</p>}
                        <button
                            type="submit"
                            disabled={isVerifyingBetaAccess}
                            className={`w-full ${aimUi.primaryButton}`}
                        >
                            {isVerifyingBetaAccess ? <Spinner className="mr-2" /> : <IconCheckCircle className="mr-2" />}
                            {isVerifyingBetaAccess ? 'Checking...' : 'Unlock workspace'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className={aimUi.pageShell}>
            {notification && (
                 <div className="fixed top-5 right-5 z-50 rounded-lg border border-emerald-200 bg-emerald-600 px-4 py-2 text-white shadow-lg animate-fade-in-out">
                    {notification}
                 </div>
            )}
            <header className="border-b border-stone-200 bg-white/95">
                <div className="mx-auto flex max-w-[1800px] flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <div className="mb-1 inline-flex rounded-full border border-red-200 bg-white px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-700">
                            Private beta
                        </div>
                        <h1 className="text-2xl text-slate-900">
                            <span className="font-bold">Real Estate AIM</span>
                            <span className="font-light text-slate-600"> | Copywriting Agent</span>
                        </h1>
                        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">
                            AIM creates campaign drafts from the property information you provide or approve. Review generated copy before use.
                        </p>
                    </div>
                    <div className="max-w-md rounded-md border border-stone-200 bg-stone-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
                        Beta feedback: note the property, action and output type when something needs review.
                    </div>
                </div>
            </header>
            <div className="border-b border-stone-200 bg-white/90 px-6 py-3 text-sm">
                <div className="mx-auto flex max-w-[1800px] flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900">Campaign Status</span>
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${activeCampaignOperations.length > 0 ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-stone-200 bg-stone-50 text-slate-700'}`}>
                            {activeCampaignOperations.length > 0 && <IconLoader className="w-3 h-3 animate-spin" />}
                            {campaignStatusLabel}
                        </span>
                        {activeCampaignOperations.map(operation => (
                            <span key={operation.id} className="rounded-full border border-amber-200 bg-white px-2.5 py-1 text-xs font-medium text-amber-900">
                                {operation.label}
                            </span>
                        ))}
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${plainCampaignProgressClass}`}>
                            {plainCampaignProgress.tone === 'working' && <IconLoader className="w-3 h-3 animate-spin" />}
                            {plainCampaignProgress.label}
                        </span>
                        <span className="text-xs text-slate-500">{plainCampaignProgress.description}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {campaignStatusSteps.map(step => (
                            <button
                                key={step.label}
                                type="button"
                                onClick={() => scrollToCampaignStatusStep(step.anchor)}
                                className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors hover:border-stone-400 ${getCampaignStepClass(step.state)}`}
                                title={`Scroll to ${step.label}`}
                            >
                                <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/70 text-[10px]">{step.number}</span>
                                {step.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <main id="app-main" className="mx-auto max-w-[1800px] px-4 py-4 2xl:px-6">
                 <div className="grid grid-cols-1 gap-4 items-start 2xl:h-[calc(100vh-132px)] 2xl:grid-cols-[minmax(420px,0.95fr)_minmax(700px,1.35fr)_280px]">

                    <div className="order-3 flex flex-col 2xl:sticky 2xl:top-4 2xl:order-3 2xl:h-[calc(100vh-132px)]">
                        <ActiveTaskMonitor imageFiles={imageFiles} isAnalyzing={isAnalyzingImages} />
                        <div className={`mb-3 rounded-lg border p-3 shadow-[0_1px_2px_rgba(15,23,42,0.05)] ${plainCampaignProgressClass}`}>
                            <div className="flex items-start gap-2">
                                {plainCampaignProgress.tone === 'working' ? <IconLoader className="mt-0.5 h-4 w-4 animate-spin" /> : <IconCheckCircle className="mt-0.5 h-4 w-4" />}
                                <div>
                                    <p className="text-sm font-bold">{plainCampaignProgress.label}</p>
                                    <p className="mt-0.5 text-xs leading-snug">{plainCampaignProgress.description}</p>
                                </div>
                            </div>
                        </div>
                        <div className={`mb-3 p-3 text-xs leading-snug text-slate-600 ${aimUi.card}`}>
                            <p className="font-semibold text-slate-900">Review and export</p>
                            <p className="mt-1">Final wording can be polished in CRM, email, Word, Google Docs or a publishing system.</p>
                            <p className="mt-1">Downloads include generated outputs only. Missing outputs are not generated silently.</p>
                        </div>
                        <DebugPanel
                            logs={debugLogs}
                            isExpanded={isBuildLogExpanded}
                            onToggleExpanded={() => setIsBuildLogExpanded(value => !value)}
                        />
                    </div>

                    <div className="order-1 flex flex-col space-y-4 pb-8 2xl:order-1 2xl:h-[calc(100vh-132px)] 2xl:overflow-y-auto 2xl:pr-2">
                        <div className={`p-3 ${aimUi.card}`}>
                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Steps 1-4</p>
                            <h2 className="mt-0.5 text-lg font-bold text-slate-900">Prepare the property brief</h2>
                            <p className="mt-0.5 max-w-2xl text-xs leading-snug text-slate-600">
                                Confirm the property, review the brief, set the campaign direction, then add feature notes or photos if useful.
                            </p>
                        </div>

                        <Section id="property-brief" title="Property Brief">
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => handleAddressChange(e.target.value)}
                                        onFocus={() => { if (normalizeAddressLookupQuery(address).length >= ADDRESS_LOOKUP_MIN_CHARS) setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Start typing a property address..."
                                        className={aimUi.input}
                                        autoComplete="off"
                                    />
                                    {(isAddressLookupQueued || isSuggesting) && <Spinner className="absolute top-2.5 right-3 text-stone-400" />}
                                    {showSuggestions && addressSuggestions.length > 0 && (
                                        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-stone-200 bg-white shadow-lg">
                                            {addressSuggestions.map((s, i) => (
                                                <li
                                                    key={i}
                                                    onMouseDown={() => handleSuggestionClick(s)}
                                                    className="cursor-pointer p-2 text-sm hover:bg-stone-50"
                                                >
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                    {showSuggestions && normalizeAddressLookupQuery(address).length >= ADDRESS_LOOKUP_MIN_CHARS && addressSuggestions.length === 0 && (isAddressLookupQueued || isSuggesting) && (
                                        <div className="absolute z-10 mt-1 w-full rounded-md border border-stone-200 bg-white p-2 text-sm text-slate-500 shadow-lg">
                                            Looking up address...
                                        </div>
                                    )}
                                </div>
                                <div className={`rounded-md border px-3 py-2 text-xs leading-snug ${hasSelectedAddressForFetch ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}>
                                    {hasSelectedAddressForFetch
                                        ? `Selected address: ${selectedAddress?.label}`
                                        : address.trim()
                                            ? fetchDetailsRequirementText
                                            : 'Start typing, then choose one of the suggested addresses.'}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                         <input
                                            type="checkbox"
                                            id="include-address"
                                            checked={includeAddress}
                                            onChange={(e) => setIncludeAddress(e.target.checked)}
                                            className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500"
                                        />
                                        <label htmlFor="include-address" className="ml-2 block text-sm text-slate-900">
                                            Include property address in copy
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleFetchDetails}
                                        disabled={isResearching || Boolean(propertyResearchBlocker) || !hasSelectedAddressForFetch}
                                        title={getCampaignOperationTitle('propertyResearch', fetchDetailsDisabledReason)}
                                        className={aimUi.darkButton}
                                    >
                                        {isResearching ? <Spinner className="mr-2" /> : <IconFileText className="mr-2"/>}
                                        {isResearching ? 'Fetching...' : 'Fetch Details'}
                                    </button>
                                </div>
                                {researchError && <p className="text-sm text-red-500 mt-2">{researchError}</p>}
                            </div>
                        </Section>

                        <Section id="agent-open-home" title="Agent and Open Home (optional)">
                            <div className="space-y-3">
                                <div>
                                    <p className="text-sm font-semibold text-slate-800">Agent details</p>
                                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Add contact details only if they should appear in generated copy or downloads.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Agent Name</label>
                                        <input
                                            type="text"
                                            value={agentProfile.name}
                                            onChange={(e) => handleAgentChange('name', e.target.value)}
                                            placeholder="e.g. Dean Jones"
                                            className={aimUi.input}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Agency</label>
                                        <input
                                            type="text"
                                            value={agentProfile.agency}
                                            onChange={(e) => handleAgentChange('agency', e.target.value)}
                                            placeholder="e.g. One Lifestyle Real Estate"
                                            className={aimUi.input}
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                                        <input
                                            type="text"
                                            value={agentProfile.phone}
                                            onChange={(e) => handleAgentChange('phone', e.target.value)}
                                            placeholder="04XX XXX XXX"
                                            className={aimUi.input}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={agentProfile.email}
                                            onChange={(e) => handleAgentChange('email', e.target.value)}
                                            placeholder="dean@example.com"
                                            className={aimUi.input}
                                        />
                                    </div>
                                </div>

                                <div className="pt-3 border-t border-stone-100">
                                    <p className="text-xs font-semibold text-slate-700 mb-2">Inclusion method</p>
                                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                                        <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors ${agentProfile.inclusionMode === 'append' ? 'border-red-200 bg-red-50/70' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                                            <input
                                                type="radio"
                                                name="agentMode"
                                                checked={agentProfile.inclusionMode === 'append'}
                                                onChange={() => handleAgentChange('inclusionMode', 'append')}
                                                className="mt-0.5 text-red-600 focus:ring-red-500"
                                            />
                                            <div className="text-xs leading-snug">
                                                <span className="font-medium text-slate-800">Append Only</span>
                                                <p className="mt-0.5 text-slate-500">Use the Contact card checkbox to append details.</p>
                                            </div>
                                        </label>
                                        <label className={`flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors ${agentProfile.inclusionMode === 'integrate' ? 'border-red-200 bg-red-50/70' : 'border-stone-200 bg-white hover:bg-stone-50'}`}>
                                            <input
                                                type="radio"
                                                name="agentMode"
                                                checked={agentProfile.inclusionMode === 'integrate'}
                                                onChange={() => handleAgentChange('inclusionMode', 'integrate')}
                                                className="mt-0.5 text-red-600 focus:ring-red-500"
                                            />
                                            <div className="text-xs leading-snug">
                                                <span className="font-medium text-slate-800">Integrate into Copy</span>
                                                <p className="mt-0.5 text-slate-500">Weave agent details into generated copy.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                                <div className="border-t border-stone-100 pt-3">
                                    <p className="text-sm font-semibold text-slate-800">Open home</p>
                                    <p className="mt-0.5 text-xs leading-snug text-slate-500">Optional event details for open-home copy.</p>
                                </div>
                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
                                        <input
                                            type="text"
                                            value={openHouse.date}
                                            onChange={(e) => handleOpenHouseChange('date', e.target.value)}
                                            placeholder="e.g. Tuesday December 30"
                                            className={aimUi.input}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
                                        <input
                                            type="text"
                                            value={openHouse.time}
                                            onChange={(e) => handleOpenHouseChange('time', e.target.value)}
                                            placeholder="e.g. 4 PM - 4:45 PM"
                                            className={aimUi.input}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Listing URL</label>
                                    <input
                                        type="url"
                                        value={openHouse.url}
                                        onChange={(e) => handleOpenHouseChange('url', e.target.value)}
                                        placeholder="e.g. https://www.realestate.com.au/..."
                                        className={aimUi.input}
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section id="property-details" title="Review Brief" isActive={isResearching} activeLabel="Fetching...">
                            <div className={`mb-4 rounded-md border p-3 ${isPropertyBriefReady ? 'border-emerald-200 bg-emerald-50' : hasFetchedPropertyBrief ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-stone-50'}`}>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                    <div>
                                        <p className={`text-sm font-bold ${isPropertyBriefReady ? 'text-emerald-800' : hasFetchedPropertyBrief ? 'text-amber-900' : 'text-slate-800'}`}>
                                            {propertyBriefStatusLabel}
                                        </p>
                                        <p className={`mt-1 text-xs leading-relaxed ${isPropertyBriefReady ? 'text-emerald-700' : hasFetchedPropertyBrief ? 'text-amber-800' : 'text-slate-600'}`}>
                                            {propertyBriefReadinessHint}
                                        </p>
                                        {hasFetchedPropertyBrief && propertyBriefReviewState === 'review' && (
                                            <p className="mt-1 text-xs leading-relaxed text-amber-800">
                                                If this is the wrong property, refetch from the address field before confirming.
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 sm:justify-end">
                                        {hasFetchedPropertyBrief && propertyBriefReviewState !== 'confirmed' && (
                                            <button
                                                type="button"
                                                onClick={handleConfirmPropertyBrief}
                                                className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
                                            >
                                                <IconCheckCircle className="h-3.5 w-3.5" />
                                                Confirm brief
                                            </button>
                                        )}
                                        {hasFetchedPropertyBrief && (
                                            <button
                                                type="button"
                                                onClick={() => document.getElementById('property-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                                                className={compactActionButtonClass}
                                            >
                                                Correct details
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleFetchDetails}
                                            disabled={isResearching || Boolean(propertyResearchBlocker) || !hasSelectedAddressForFetch}
                                            title={getCampaignOperationTitle('propertyResearch', fetchDetailsDisabledReason)}
                                            className={compactActionButtonClass}
                                        >
                                            Refetch
                                        </button>
                                    </div>
                                </div>
                            </div>
                            {isFetchComplete && address && (
                                <div className="mb-4 rounded-md border border-stone-200 bg-stone-50 p-3">
                                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Confirmed address</p>
                                    <p className="mt-1 font-semibold text-slate-800 text-sm">{address}</p>
                                    {(priceGuide || lastSoldDetails) && (
                                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                            {priceGuide && <span className={aimUi.chipNeutral}>Price guide: {priceGuide}</span>}
                                            {lastSoldDetails && <span className={aimUi.chipNeutral}>Last sold: {lastSoldDetails}</span>}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="mb-6 border-b border-stone-200 pb-4">
                                    <h4 className="font-semibold text-slate-700 mb-2">Fetched property facts and features</h4>
                                    {isResearching ? (
                                        <div className="flex justify-center items-center p-4"><Spinner /></div>
                                    ) : keyFeatures && keyFeatures.length > 0 ? (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                            {keyFeatures.map((line, index) => {
                                                const normalizedLine = normalizeFeatureDisplayText(line);
                                                const parts = normalizedLine.split(':');
                                                const key = normalizeFeatureDisplayText(parts[0] || normalizedLine);
                                                const value = normalizeFeatureDisplayText(parts.slice(1).join(':'));
                                                if (!value) {
                                                    return (
                                                         <li key={index} className="flex justify-between border-b border-stone-100 py-1.5">
                                                             <span className="text-slate-800">• {key}</span>
                                                         </li>
                                                    )
                                                }
                                                return (
                                                    <li key={index} className="flex justify-between border-b border-stone-100 py-1.5">
                                                        <span className="font-semibold text-slate-800">{key}</span>
                                                        <span className="text-slate-600 text-right">{value}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-slate-500 italic">
                                            {researchData === null
                                                ? "Fetched property facts and features will appear here after Fetch Details."
                                                : "No additional features found."
                                            }
                                        </p>
                                    )}
                                </div>
                        <div className="grid grid-cols-2 gap-4">
                            <NumberInput label="Bedrooms" value={propertyDetails.beds} onChange={(v) => handleDetailChange('beds', v)} />
                            <NumberInput label="Bathrooms" value={propertyDetails.baths} onChange={(v) => handleDetailChange('baths', v)} />
                            <NumberInput label="Car Spaces" value={propertyDetails.cars} onChange={(v) => handleDetailChange('cars', v)} />
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Land Size (m²)</label>
                                <input type="number" value={propertyDetails.landSize ?? ''} onChange={(e) => handleDetailChange('landSize', e.target.value ? parseInt(e.target.value) : null)} className={aimUi.input} />
                            </div>
                        </div>
                        <div className="mt-4">
                                <SelectInput label="Property Type" value={propertyDetails.propertyType} onChange={(v) => handleDetailChange('propertyType', v)} options={PROPERTY_TYPES} />
                        </div>
                        </Section>

                        <Section
                            id="property-overview"
                            title="Property Brief: Overview"
                            isActive={isResearching}
                            activeLabel="Fetching..."
                            rightElement={researchData && (
                                <button
                                    type="button"
                                    onClick={() => setIsPropertyOverviewExpanded(value => !value)}
                                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                                    aria-expanded={isPropertyOverviewExpanded}
                                >
                                    {isPropertyOverviewExpanded ? 'Collapse' : 'Expand'}
                                    <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${isPropertyOverviewExpanded ? 'rotate-180' : ''}`} />
                                </button>
                            )}
                        >
                             {researchData ? (
                                 <div>
                                     {isPropertyOverviewExpanded ? (
                                         <>
                                             <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{researchData}</p>
                                             {groundingSources.length > 0 && (
                                                 <div className="mt-3 flex flex-wrap gap-2 border-t border-stone-100 pt-3">
                                                     {groundingSources.map((source, idx) => (
                                                         <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="inline-flex max-w-[150px] items-center truncate rounded-full border border-red-100 bg-white px-3 py-1 text-xs text-red-700 hover:bg-red-50">
                                                             {source.type === 'maps' ? <IconMapPin className="w-3 h-3 mr-1" /> : <IconWorld className="w-3 h-3 mr-1" />}
                                                             {source.title}
                                                         </a>
                                                     ))}
                                                 </div>
                                             )}
                                         </>
                                     ) : (
                                         <div className="rounded-md border border-stone-200 bg-stone-50 px-3 py-2">
                                             <p className="text-sm leading-snug text-slate-700">{getCompactSummary(researchData, 'Property overview available.')}</p>
                                             {groundingSources.length > 0 && (
                                                 <p className="mt-1 text-[11px] font-semibold text-slate-500">{groundingSources.length} source{groundingSources.length === 1 ? '' : 's'} available when expanded.</p>
                                             )}
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <Placeholder icon={<IconFileText />} title="Property Overview" description="Fetch details to gather information." />
                             )}
                         </Section>

                         <Section
                             title="Property Brief: Suburb & Area Profile"
                             isActive={isResearching}
                             activeLabel="Fetching..."
                             rightElement={profileData && (
                                <button
                                    type="button"
                                    onClick={() => setIsSuburbProfileExpanded(value => !value)}
                                    className="inline-flex items-center gap-1 rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-stone-50"
                                    aria-expanded={isSuburbProfileExpanded}
                                >
                                    {isSuburbProfileExpanded ? 'Collapse' : 'Expand'}
                                    <IconChevronDown className={`h-3.5 w-3.5 transition-transform ${isSuburbProfileExpanded ? 'rotate-180' : ''}`} />
                                </button>
                             )}
                         >
                             {profileData ? (
                                 <div>
                                    <div className="mb-3 rounded-md border border-stone-200 bg-stone-50 p-3">
                                        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Copywriting inclusion</p>
                                            <span className="rounded-full border border-stone-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                                {profileInclusionLabels[profileInclusion]}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-3 text-xs">
                                            {['none', 'suburb', 'area', 'both'].map(m => (
                                                <label key={m} className="flex items-center cursor-pointer capitalize font-medium">
                                                    <input type="radio" checked={profileInclusion === m} onChange={() => setProfileInclusion(m as any)} className="mr-1.5 text-red-600 focus:ring-red-500" />
                                                    {profileInclusionLabels[m as keyof typeof profileInclusionLabels]}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    {isSuburbProfileExpanded ? (
                                        <div className="space-y-4">
                                            {profileData.suburb && (
                                                <div>
                                                    <h4 className={`mb-2 border-b border-stone-100 pb-1 text-sm font-bold uppercase tracking-wider ${(profileInclusion === 'suburb' || profileInclusion === 'both') ? 'text-slate-900' : 'text-slate-500 opacity-70'}`}>
                                                        Suburb Insight {(profileInclusion === 'suburb' || profileInclusion === 'both') ? '' : '(Preview)'}
                                                    </h4>
                                                    <div className={(profileInclusion === 'suburb' || profileInclusion === 'both') ? '' : 'opacity-70'}>
                                                        {renderProfileContent(profileData.suburb)}
                                                    </div>
                                                </div>
                                            )}
                                            {profileData.area && (
                                                <div>
                                                    <h4 className={`mb-2 border-b border-stone-100 pb-1 text-sm font-bold uppercase tracking-wider ${(profileInclusion === 'area' || profileInclusion === 'both') ? 'text-slate-900' : 'text-slate-500 opacity-70'}`}>
                                                        Regional Context {(profileInclusion === 'area' || profileInclusion === 'both') ? '' : '(Preview)'}
                                                    </h4>
                                                    <div className={(profileInclusion === 'area' || profileInclusion === 'both') ? '' : 'opacity-70'}>
                                                        {renderProfileContent(profileData.area)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-2 rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-slate-700">
                                            {profileData.suburb && <p><span className="font-semibold text-slate-900">Suburb:</span> {getCompactSummary(profileData.suburb, 'Suburb insight available.')}</p>}
                                            {profileData.area && <p><span className="font-semibold text-slate-900">Area:</span> {getCompactSummary(profileData.area, 'Area profile available.')}</p>}
                                        </div>
                                    )}
                                 </div>
                             ) : (
                                 <Placeholder icon={<IconMapPin />} title="Suburb & Area Profile" description="Local insights appear here." />
                             )}
                         </Section>

                        <Section
                            id="copy-context"
                            title="Campaign Direction"
                            isActive={isAnalyzingStrategy}
                            activeLabel="Analyzing..."
                            showActiveChip={false}
                            rightElement={
                                <div className="flex flex-col items-end gap-1">
                                    <button
                                        onClick={handleStrategyAnalysis}
                                        disabled={!isFetchComplete || isAnalyzingStrategy || Boolean(copyContextAnalysisBlocker)}
                                        title={getCampaignOperationTitle('copyContextAnalysis', !isFetchComplete ? 'Fetch property details before running analysis.' : undefined)}
                                        className={aimUi.analysisButton}
                                    >
                                        {isAnalyzingStrategy ? <Spinner className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
                                        {getAnalysisButtonLabel(isAnalyzingStrategy, copyContextAnalysisStatus)}
                                    </button>
                                </div>
                            }
                        >
                            <div className="space-y-4">
                                <p className="text-sm leading-relaxed text-slate-600">
                                    Set the audience, tone and copy lens before generating drafts.
                                </p>
                                <div>
                                    <h3 className="block text-sm font-medium text-slate-700 mb-1">Target market</h3>
                                    <div className="grid grid-cols-2 gap-4">
                                        <SelectInput
                                            label="Primary"
                                            value={copyContext.primaryTargetMarket}
                                            onChange={v => handleContextChange('primaryTargetMarket', v)}
                                            options={TARGET_MARKETS}
                                        />
                                        <SelectInput
                                            label="Secondary"
                                            value={copyContext.secondaryTargetMarket}
                                            onChange={v => handleContextChange('secondaryTargetMarket', v)}
                                            options={TARGET_MARKETS}
                                            placeholder="None"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <h3 className="block text-sm font-medium text-slate-700 mb-2">Writing style <span className="text-xs font-normal text-slate-500">(Max 2)</span></h3>
                                    <div className="flex flex-wrap gap-2">
                                        {WRITING_STYLES.map(style => {
                                            const isSelected = copyContext.writingStyle.includes(style);
                                            const isDisabled = !isSelected && copyContext.writingStyle.length >= 2;
                                            return (
                                                <button
                                                    key={style}
                                                    onClick={() => handleWritingStyleToggle(style)}
                                                    disabled={isDisabled}
                                                    className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all ${
                                                        isSelected
                                                            ? 'border-red-200 bg-red-600 text-white shadow-sm'
                                                            : 'border-stone-300 bg-white text-slate-600 hover:border-red-300 hover:bg-red-50'
                                                    } ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                >
                                                    {style}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-4 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Key features to highlight</label>
                                    <textarea
                                        rows={3}
                                        value={copyContext.featuresToHighlight}
                                        onChange={e => handleContextChange('featuresToHighlight', e.target.value)}
                                        placeholder="Key features to highlight..."
                                        className={aimUi.input}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Avoid in copy</label>
                                    <textarea
                                        rows={2}
                                        value={copyContext.thingsToAvoid}
                                        onChange={e => handleContextChange('thingsToAvoid', e.target.value)}
                                        placeholder="Clichés or words to avoid..."
                                        className={aimUi.input}
                                    />
                                </div>
                            </div>
                            {copyContextAnalysisError && (
                                <p className="mt-3 text-sm text-red-600">{copyContextAnalysisError}</p>
                            )}
                        </Section>

                        <Section
                            id="features-photos"
                            title="Key Selling Points"
                            isActive={isAnalyzingFeatures}
                            activeLabel="Analyzing..."
                            showActiveChip={false}
                            rightElement={
                                <div className="flex flex-col items-end gap-1">
                                    <button
                                        onClick={handleFeatureAnalysis}
                                        disabled={!isFetchComplete || isAnalyzingFeatures || Boolean(propertyFeaturesAnalysisBlocker)}
                                        title={getCampaignOperationTitle('propertyFeaturesAnalysis', !isFetchComplete ? 'Fetch property details before running analysis.' : undefined)}
                                        className={aimUi.analysisButton}
                                    >
                                        {isAnalyzingFeatures ? <Spinner className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
                                        {getAnalysisButtonLabel(isAnalyzingFeatures, propertyFeaturesAnalysisStatus)}
                                    </button>
                                </div>
                            }
                        >
                            <p className="mb-2 text-sm leading-relaxed text-slate-600">
                                Use this as the buyer-facing feature focus for the generated copy.
                            </p>
                            <textarea
                                rows={5}
                                value={propertyFeatures}
                                onChange={(e) => setPropertyFeatures(e.target.value)}
                                placeholder="List selling points, upgrades, lifestyle notes and must-mention details..."
                                className={aimUi.input}
                            />
                            {propertyFeaturesAnalysisError && (
                                <p className="mt-3 text-sm text-red-600">{propertyFeaturesAnalysisError}</p>
                            )}
                        </Section>

                        <Section
                            id="property-photos"
                            title="Property Photos"
                            isActive={isAnalyzingImages}
                            activeLabel="Analyzing..."
                            rightElement={<span className={aimUi.chipNeutral}>{imageFiles.length}/{IMAGE_UPLOAD_LIMIT} photos</span>}
                        >
                            <div
                                onDrop={handleImageDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`flex flex-col items-center justify-center rounded-lg border border-dashed p-6 text-center transition-colors ${imageFiles.length >= IMAGE_UPLOAD_LIMIT ? 'border-stone-200 bg-stone-50' : isDraggingOver ? 'border-red-300 bg-red-50' : 'border-stone-300 bg-stone-50/50 hover:bg-white'}`}
                            >
                                <input id="image-upload" type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" disabled={imageFiles.length >= IMAGE_UPLOAD_LIMIT} />
                                <label htmlFor="image-upload" className={`flex flex-col items-center ${imageFiles.length >= IMAGE_UPLOAD_LIMIT ? 'cursor-not-allowed' : 'cursor-pointer'}`}>
                                    <IconUpload className="w-8 h-8 text-stone-400 mb-2" />
                                    <span className="text-sm font-medium text-slate-700">{imageFiles.length >= IMAGE_UPLOAD_LIMIT ? 'Photo limit reached' : 'Click to upload or drag and drop'}</span>
                                    <span className="mt-1 text-xs text-slate-500">Up to {IMAGE_UPLOAD_LIMIT} photos. Image numbers match Visual Highlights.</span>
                                </label>
                            </div>

                            {imageFiles.length > 0 && (
                                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
                                    {imageFiles.map((img, idx) => (
                                        <div key={idx} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-50">
                                            <img src={img.url} alt={`Image ${idx + 1} upload preview`} className="w-full h-full object-cover" />
                                            <span className="absolute left-2 top-2 rounded-full bg-black/65 px-2 py-0.5 text-[11px] font-bold text-white shadow-sm">
                                                Image {idx + 1}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleImageDelete(idx)}
                                                className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-600 transition-colors hover:text-red-700"
                                                aria-label={`Remove Image ${idx + 1}`}
                                            >
                                                <IconTrash className="w-4 h-4" />
                                            </button>
                                            {img.status === 'processing' && (
                                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                                                    <CircularProgress percent={((idx + 1) / imageFiles.length) * 100} className="w-10 h-10 text-white" />
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-4 flex justify-between items-center">
                                <div className="flex items-center">
                                     <input type="checkbox" id="include-visuals" checked={includeVisualHighlights} onChange={(e) => setIncludeVisualHighlights(e.target.checked)} className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500" />
                                     <label htmlFor="include-visuals" className="ml-2 block text-sm text-slate-900">Include visual analysis</label>
                                </div>
                                <button
                                    onClick={handleAnalyzeImages}
                                    disabled={imageFiles.length === 0 || isAnalyzingImages || Boolean(imageAnalysisBlocker)}
                                    title={getCampaignOperationTitle('imageAnalysis', imageFiles.length === 0 ? 'Upload photos before analysis.' : undefined)}
                                    className={aimUi.darkButton}
                                >
                                    {isAnalyzingImages ? 'Analyzing...' : imageAnalysisError ? 'Retry Photo Analysis' : imageAnalysis ? 'Redo Photo Analysis' : 'Analyze Photos'}
                                </button>
                            </div>
                            {imageAnalysisError && (
                                <p className="mt-3 text-sm text-red-600">{imageAnalysisError}</p>
                            )}
                        </Section>

                        <Section
                            title="Visual Highlights"
                            isActive={isAnalyzingImages}
                            activeLabel="Analyzing..."
                            rightElement={imageAnalysis && (
                                <span className={aimUi.chipNeutral}>
                                    {visualHighlightEntries.length} summar{visualHighlightEntries.length === 1 ? 'y' : 'ies'}
                                </span>
                            )}
                        >
                            {imageAnalysis ? renderVisualHighlights() : <Placeholder icon={<IconCamera />} title="Visual Analysis" description="Analyze photos to see features." />}
                        </Section>
                    </div>

                    <div ref={outputWorkspaceRef} className="order-2 flex flex-col space-y-4 pb-8 2xl:order-2 2xl:h-[calc(100vh-132px)] 2xl:overflow-y-auto 2xl:pr-2">
                         <div className={`p-3 ${aimUi.card}`}>
                             <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Step 5</p>
                             <h2 className="mt-0.5 text-lg font-bold text-slate-900">Generate outputs and downloads</h2>
                             <p className="mt-0.5 max-w-2xl text-xs leading-snug text-slate-600">
                                 Listing Copy starts the campaign. Campaign Pack adapts it for the remaining channels.
                             </p>
                         </div>

                         <Section id="campaign-outputs" title="Campaign Outputs" isActive={isCampaignOutputsActive} activeLabel={isDownloadingAll ? 'Preparing...' : 'Generating...'}>
                             <div className="flex flex-col gap-4">
                                 <div className="rounded-lg border border-stone-200 bg-stone-50/80 p-3">
                                     <div className="mb-3 flex flex-col gap-3 2xl:flex-row 2xl:items-start 2xl:justify-between">
                                         <div>
                                             <p className="text-sm font-semibold text-slate-900">Choose the next campaign step.</p>
                                             <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600">
                                                 Start with Listing Copy, then create Campaign Pack when the channel set is needed.
                                             </p>
                                             <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                 <span className={`rounded-full border px-2.5 py-1 font-semibold ${isPropertyBriefReady ? 'border-emerald-200 bg-white text-emerald-700' : 'border-amber-200 bg-white text-amber-800'}`}>
                                                     {propertyBriefStatusLabel}
                                                 </span>
                                                 <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 font-semibold text-slate-600">
                                                     {listingCopyReady ? 'Listing Copy ready' : 'Listing Copy not generated'}
                                                 </span>
                                             </div>
                                         </div>
                                         <div className="min-w-[220px] rounded-md border border-stone-200 bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                                             <div className="flex items-center justify-between gap-3">
                                                 <span className="text-xs font-semibold text-slate-700">Listing length</span>
                                                 <span className="text-sm font-bold text-slate-800">~{outputSettings.wordCount} words</span>
                                             </div>
                                             <input
                                                type="range"
                                                min="50"
                                                max="1000"
                                                step="50"
                                                value={outputSettings.wordCount}
                                                onChange={(e) => setOutputSettings(prev => ({ ...prev, wordCount: parseInt(e.target.value) }))}
                                                className="mt-2 h-1 w-full cursor-pointer appearance-none rounded-lg bg-stone-300 accent-red-600"
                                             />
                                         </div>
                                     </div>
                                     <div className="grid grid-cols-1 gap-2 2xl:grid-cols-3">
                                         {COPYWRITING_OFFERS.map(offer => {
                                             const isListingOffer = offer.id === 'listing-copy';
                                             const isCampaignPackOffer = offer.id === 'campaign-pack';
                                             const isBlueprintOffer = offer.id === 'campaign-blueprint';
                                             const isCampaignPackPaused = isCampaignPackOffer && campaignPackBatch.status === 'partial_failed';
                                             const stateLabel = isListingOffer
                                                ? isListingCopyGenerating ? 'Generating' : listingCopyReady ? 'Ready' : isPropertyBriefReady ? 'Ready to generate' : hasFetchedPropertyBrief ? 'Confirm brief first' : 'Brief required'
                                                : isCampaignPackOffer
                                                    ? isCampaignPackGenerating ? 'Generating' : !listingCopyReady ? 'Available after Listing Copy' : isCampaignPackReady ? 'Ready' : isCampaignPackPaused ? 'Paused' : `${campaignPackMissingCount} outputs remaining`
                                                    : 'Not available yet';
                                             const stateClass = isBlueprintOffer
                                                ? 'border-stone-200 bg-stone-100 text-stone-600'
                                                : stateLabel === 'Ready' || stateLabel === 'Ready to generate'
                                                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                                : stateLabel === 'Generating' || stateLabel === 'Paused'
                                                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                : stateLabel === 'Brief required' || stateLabel === 'Confirm brief first'
                                                            ? 'border-amber-200 bg-amber-50 text-amber-800'
                                                            : 'border-stone-200 bg-white text-slate-600';
                                             const statusLabel = offer.status === 'recommended'
                                                ? 'Recommended'
                                                : offer.status === 'planned'
                                                    ? 'Planned beta'
                                                    : 'Active';
                                             const statusClass = offer.status === 'recommended'
                                                ? 'border-red-200 bg-white text-red-700'
                                                : offer.status === 'planned'
                                                    ? 'border-stone-200 bg-stone-100 text-stone-600'
                                                    : 'border-emerald-200 bg-emerald-50 text-emerald-700';
                                             const actionLabel = isListingOffer
                                                ? isPropertyBriefReady ? offer.primaryActionLabel : 'Brief required'
                                                : isCampaignPackOffer
                                                    ? !listingCopyReady ? 'Listing Copy required' : isCampaignPackReady ? 'Review Campaign Pack' : isCampaignPackPaused ? 'Retry remaining outputs' : offer.primaryActionLabel
                                                    : offer.primaryActionLabel;
                                             const disabled = isBlueprintOffer || isGenerating || (isListingOffer && !isPropertyBriefReady) || (isCampaignPackOffer && !listingCopyReady);
                                             const showOfferAction = !(isListingOffer && listingCopyReady);
                                             const onOfferAction = () => {
                                                if (isListingOffer) {
                                                    generateCopyForTab(LISTING_COPY_TAB);
                                                    return;
                                                }
                                                if (isCampaignPackOffer) {
                                                    if (isCampaignPackReady) {
                                                        setIsCampaignLibraryExpanded(true);
                                                        setSelectedOutputCategory('All');
                                                    } else {
                                                        handleGenerateAllMissing();
                                                    }
                                                }
                                             };

                                             return (
                                                <div key={offer.id} className={`flex min-h-[160px] flex-col justify-between rounded-lg border bg-white p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${offer.status === 'recommended' ? 'border-red-200 ring-1 ring-red-100' : isBlueprintOffer ? 'border-stone-200 bg-stone-50/80' : 'border-stone-200'}`}>
                                                    <div>
                                                        <div className="mb-2 flex flex-wrap items-center gap-1.5">
                                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusClass}`}>{statusLabel}</span>
                                                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${stateClass}`}>{stateLabel}</span>
                                                        </div>
                                                        <h3 className="text-sm font-bold text-slate-900">{offer.title}</h3>
                                                        <p className="mt-0.5 text-xs font-medium text-slate-700">{offer.shortDescription}</p>
                                                        <p className="mt-2 text-xs leading-snug text-slate-500">{offer.includedSummary}</p>
                                                        {isCampaignPackOffer && listingCopyReady && !isCampaignPackReady && (
                                                            <p className={`mt-1.5 text-xs font-semibold ${isCampaignPackPaused ? 'text-amber-800' : 'text-red-700'}`}>
                                                                {isCampaignPackPaused ? 'Campaign Pack paused. Retry remaining outputs.' : 'Campaign outputs still need generation.'}
                                                            </p>
                                                        )}
                                                        {isListingOffer && listingCopyReady && (
                                                            <p className="mt-1.5 text-xs font-semibold text-emerald-700">Listing Copy is ready in the output area.</p>
                                                        )}
                                                        {offer.disabledReason && (
                                                            <p className="mt-1.5 text-xs leading-snug text-stone-500">{offer.disabledReason}</p>
                                                        )}
                                                    </div>
                                                    <div className="mt-3 flex flex-wrap gap-2">
                                                        {showOfferAction && (
                                                            <button
                                                                type="button"
                                                                onClick={onOfferAction}
                                                                disabled={disabled}
                                                                title={isListingOffer && !isPropertyBriefReady ? propertyBriefReadinessHint : isCampaignPackOffer && !listingCopyReady ? 'Generate Listing Copy before Campaign Pack.' : offer.disabledReason}
                                                                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${isListingOffer || isCampaignPackOffer ? 'bg-red-600 text-white shadow-sm hover:bg-red-700 disabled:bg-red-300' : 'border border-stone-200 bg-stone-100 text-stone-500'}`}
                                                            >
                                                                {(isListingCopyGenerating && isListingOffer) || (isCampaignPackGenerating && isCampaignPackOffer) ? <Spinner className="w-4 h-4" /> : <IconSparkles className="w-4 h-4" />}
                                                                {actionLabel}
                                                            </button>
                                                        )}
                                                        {isListingOffer && listingCopyReady && (
                                                            <button
                                                                type="button"
                                                                onClick={handleRegenerateListingCopy}
                                                                disabled={isGenerating || Boolean(generateCopyBlocker) || !isPropertyBriefReady || !briefChangedSinceListingGeneration}
                                                                title={getCampaignOperationTitle('generateFullCopy', regenerateListingCopyDisabledReason)}
                                                                className={compactActionButtonClass}
                                                            >
                                                                Regenerate Listing Copy
                                                            </button>
                                                        )}
                                                    </div>
                                                </div>
                                             );
                                         })}
                                     </div>
                                     {campaignPackBatch.status === 'generating' && (
                                         <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                                             <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                                 <div>
                                                     <p className="text-sm font-semibold text-amber-950">Generating Campaign Pack</p>
                                                     <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-900">
                                                         {campaignPackBatch.currentOutputTitle
                                                            ? `Creating ${campaignPackBatch.currentOutputTitle}${campaignPackBatch.currentCategory ? ` for ${campaignPackBatch.currentCategory}` : ''}.`
                                                            : 'Preparing the next campaign output.'}
                                                     </p>
                                                     <p className="mt-1 text-[11px] font-semibold text-amber-800">
                                                         {campaignPackBatch.currentIndex && campaignPackBatch.startedCount
                                                            ? `${campaignPackBatch.currentIndex}/${campaignPackBatch.startedCount} in progress`
                                                            : 'Generation in progress'}
                                                         {` · ${campaignPackBatch.succeededOutputIds.length} ready · ${campaignPackBatch.remainingOutputIds.length} remaining`}
                                                     </p>
                                                 </div>
                                                 <IconLoader className="h-5 w-5 shrink-0 animate-spin text-amber-800" />
                                             </div>
                                         </div>
                                     )}
                                     {campaignPackBatch.status === 'partial_failed' && campaignPackBatch.userMessage && (
                                         <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5">
                                             <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                                 <div>
                                                     <p className="text-sm font-semibold text-amber-950">Campaign Pack paused</p>
                                                     <p className="mt-1 max-w-3xl text-xs leading-relaxed text-amber-900">{campaignPackBatch.userMessage}</p>
                                                     {campaignPackBatch.failedOutputId && (
                                                         <p className="mt-1 text-[11px] leading-snug text-amber-800">
                                                             Paused output: {getCampaignPackOutputTitle(campaignPackBatch.failedOutputId)} ({campaignPackBatch.failedOutputId}), {getCampaignOutputCategory(campaignPackBatch.failedOutputId)}.
                                                         </p>
                                                     )}
                                                 </div>
                                                 <button
                                                    type="button"
                                                    onClick={handleGenerateAllMissing}
                                                    disabled={isGenerating || Boolean(generateAllBlocker)}
                                                    title={getCampaignOperationTitle('generateAllVariations', 'Retry missing Campaign Pack outputs.')}
                                                    className="inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-amber-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-amber-950 disabled:cursor-not-allowed disabled:bg-amber-300"
                                                 >
                                                    {isCampaignPackGenerating ? <Spinner className="w-4 h-4" /> : <IconSparkles className="w-4 h-4" />}
                                                    Retry remaining outputs
                                                 </button>
                                             </div>
                                         </div>
                                     )}
                                 </div>

                                 {!isCampaignPackReady && (
                                     <div className="rounded-lg border border-stone-200 bg-white p-3">
                                         <p className="text-sm font-semibold text-slate-900">Campaign Pack includes</p>
                                         <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600">
                                             Step 2 adapts the approved Listing Copy into the channel pack.
                                         </p>
                                         <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                             {['Listing', 'Coming Soon', 'Social Media', 'Events', 'Blog', 'Video'].map(category => (
                                                 <span key={category} className="rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 font-semibold text-slate-700">
                                                     {category}
                                                 </span>
                                             ))}
                                         </div>
                                     </div>
                                 )}

                                 <div className="rounded-lg border border-stone-200 bg-white p-3">
                                     <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center 2xl:justify-between">
                                         <div>
                                             <p className="text-sm font-semibold text-slate-900">Campaign Library</p>
                                             <p className="mt-1 max-w-2xl text-xs leading-snug text-slate-600">
                                                 {listingCopyReady
                                                    ? `${campaignPackReadyCount}/${TOTAL_DOWNSTREAM_CAMPAIGN_OUTPUTS} Campaign Pack outputs ready.`
                                                    : `Generate Listing Copy first to unlock Campaign Pack outputs.`}
                                             </p>
                                             <div className="mt-2 flex flex-wrap gap-2 text-xs">
                                                 <span className={listingCopyReady ? aimUi.chipReady : aimUi.chipWorking}>{listingCopyReady ? 'Listing Copy ready' : 'Listing Copy missing'}</span>
                                                 <span className={aimUi.chipNeutral}>{campaignPackReadyCount}/{TOTAL_DOWNSTREAM_CAMPAIGN_OUTPUTS} campaign outputs ready</span>
                                                 {queuedOutputTabs.length > 0 && <span className="rounded-full border border-amber-200 bg-white px-2.5 py-1 font-semibold text-amber-800">{queuedOutputTabs.length} queued</span>}
                                             </div>
                                         </div>
                                         <div className="flex flex-wrap items-center gap-2 2xl:justify-end">
                                             <button
                                                type="button"
                                                onClick={() => setIsCampaignLibraryExpanded(value => !value)}
                                                disabled={!listingCopyReady && !hasCampaignPackStarted}
                                                className={compactActionButtonClass}
                                             >
                                                {isCampaignLibraryExpanded ? 'Hide library' : 'Review library'}
                                             </button>
                                             <div className="relative" ref={downloadAllMenuRef}>
                                                 <button
                                                    onClick={() => setIsDownloadAllMenuOpen(!isDownloadAllMenuOpen)}
                                                    disabled={isDownloadingAll || Boolean(exportFullCampaignBlocker) || readyOutputCount === 0}
                                                    title={getCampaignOperationTitle('exportFullCampaign', readyOutputCount === 0 ? 'No generated outputs in this campaign yet.' : undefined)}
                                                    aria-label="Download campaign document"
                                                    className={aimUi.darkButton}
                                                 >
                                                     {isDownloadingAll ? <Spinner className="w-4 h-4" /> : <IconDownload className="w-4 h-4" />}
                                                     Download campaign
                                                 </button>
                                                 {isDownloadAllMenuOpen && (
                                                     <div className="absolute right-0 top-full z-50 mt-2 w-64 rounded-md border border-stone-200 bg-white py-1.5 shadow-xl">
                                                         <p className="mb-1 border-b border-stone-100 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">One combined document</p>
                                                         <p className="px-4 pb-2 text-[11px] leading-snug text-slate-500">Full campaign includes generated outputs only. Missing outputs are noted but not generated during download.</p>
                                                         <button onClick={() => handleDownloadAll('word')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileWord className="w-4 h-4 mr-2 text-blue-600" /> Word (.doc)</button>
                                                         <button onClick={() => handleDownloadAll('txt')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileTxt className="w-4 h-4 mr-2 text-slate-600" /> Text (.txt)</button>
                                                         <button onClick={() => handleDownloadAll('pdf')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFilePdf className="w-4 h-4 mr-2 text-red-600" /> Print / PDF</button>
                                                     </div>
                                                 )}
                                             </div>
                                         </div>
                                     </div>
                                 </div>

                                 {isCampaignLibraryExpanded ? (
                                 <div className="space-y-3">
                                     <div className="flex flex-wrap gap-2">
                                         {categoryFilters.map(category => {
                                             const stats = getCategoryStats(category);
                                             const isSelected = selectedOutputCategory === category;
                                             return (
                                                 <button
                                                    key={category}
                                                    onClick={() => handleCategoryFilterClick(category)}
                                                    className={`rounded-full border px-2.5 py-1.5 text-left text-xs font-semibold transition-colors ${isSelected ? 'border-slate-300 bg-slate-900 text-white' : 'border-stone-200 bg-white text-slate-600 hover:border-stone-300 hover:bg-stone-50'}`}
                                                 >
                                                     <span>{category}</span>
                                                     <span className={`ml-2 font-medium ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>{stats.ready}/{stats.total} ready</span>
                                                     {stats.generating > 0 && <span className="ml-1 text-amber-700">Generating</span>}
                                                 </button>
                                             );
                                         })}
                                     </div>

                                     <div className="rounded-lg border border-stone-200 bg-white p-3">
                                         <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
                                             <div>
                                                 <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{selectedOutputCategory === 'All' ? 'All output items' : `${selectedOutputCategory} outputs`}</p>
                                                 <p className="mt-0.5 text-xs text-slate-500">
                                                     {selectedCategoryStats.complete
                                                        ? 'All outputs in this view are ready.'
                                                        : `${selectedCategoryStats.ready} ready, ${selectedCategoryStats.missing} missing${selectedCategoryStats.generating ? `, ${selectedCategoryStats.generating} generating` : ''}.`}
                                                 </p>
                                             </div>
                                             <div className="flex flex-wrap items-center gap-2">
                                                 <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${selectedCategoryStats.complete ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-stone-200 bg-stone-50 text-slate-600'}`}>
                                                     {selectedCategoryStats.complete ? 'Category ready' : 'In progress'}
                                                 </span>
                                                 {selectedOutputCategory !== 'All' && (
                                                     <div className="relative" ref={categoryExportMenuRef}>
                                                         <button
                                                            onClick={() => setIsCategoryExportMenuOpen(!isCategoryExportMenuOpen)}
                                                            disabled={!hasGeneratedOutputsInSelectedCategory}
                                                            title={!hasGeneratedOutputsInSelectedCategory ? `No generated ${selectedOutputCategory} outputs yet.` : `Download generated ${selectedOutputCategory} outputs.`}
                                                            aria-label="Download current category"
                                                            className={compactActionButtonClass}
                                                         >
                                                             <IconDownload className="w-4 h-4" />
                                                             Download category
                                                         </button>
                                                         {isCategoryExportMenuOpen && (
                                                             <div className="absolute right-0 top-full z-20 mt-2 w-60 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
                                                                 <p className="mb-1 border-b border-stone-100 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">{selectedOutputCategory} category</p>
                                                                 <p className="px-4 pb-2 text-[11px] leading-snug text-slate-500">Exports generated outputs in this category only. Missing outputs are not generated during download.</p>
                                                                 <button onClick={() => handleDownloadCurrentCategory('word')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileWord className="w-4 h-4 mr-2" /> Word (.doc)</button>
                                                                 <button onClick={() => handleDownloadCurrentCategory('txt')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileTxt className="w-4 h-4 mr-2" /> Text (.txt)</button>
                                                                 <button onClick={() => handleDownloadCurrentCategory('pdf')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFilePdf className="w-4 h-4 mr-2" /> Print / PDF</button>
                                                             </div>
                                                         )}
                                                     </div>
                                                 )}
                                             </div>
                                         </div>

                                         <div className="grid grid-cols-1 gap-2 xl:grid-cols-2 2xl:grid-cols-3">
                                             {filteredCampaignOutputSections.map(section => (
                                                 <button
                                                    key={section.id}
                                                    onClick={() => handleTabClick(section.group, section.id)}
                                                    className={`min-h-[72px] rounded-md border p-2.5 text-left transition-colors ${section.selected ? 'border-slate-300 bg-slate-50 shadow-[inset_3px_0_0_#dc2626]' : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'}`}
                                                 >
                                                     <div className="flex items-start justify-between gap-2">
                                                         <div>
                                                             <div className={`text-sm font-semibold ${section.selected ? 'text-slate-900' : 'text-slate-800'}`}>{section.shortLabel}</div>
                                                             <div className="mt-0.5 text-[11px] text-slate-500">{section.group}</div>
                                                         </div>
                                                         <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCampaignOutputStatusClass(section.status)}`}>
                                                             {getCampaignOutputStatusLabel(section.status)}
                                                         </span>
                                                     </div>
                                                     <p className="mt-1.5 line-clamp-2 text-xs leading-snug text-slate-600">{section.description}</p>
                                                 </button>
                                         ))}
                                     </div>
                                     </div>
                                 </div>
                                 ) : (
                                     <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-4 text-center">
                                         <IconFileText className="mx-auto mb-2 h-8 w-8 text-stone-400" />
                                         <h3 className="text-sm font-bold text-slate-900">Campaign Library is ready for review after Campaign Pack</h3>
                                         <p className="mx-auto mt-1 max-w-lg text-xs leading-snug text-slate-500">
                                             {listingCopyReady
                                                ? 'Generate Campaign Pack to review channel outputs here.'
                                                : 'Generate Listing Copy above to create the campaign baseline.'}
                                         </p>
                                         {listingCopyReady && (
                                             <button
                                                type="button"
                                                onClick={isCampaignPackReady ? () => setIsCampaignLibraryExpanded(true) : handleGenerateAllMissing}
                                                disabled={isGenerating || Boolean(generateAllBlocker)}
                                                className={`mt-3 ${aimUi.primaryButton}`}
                                             >
                                                {isGenerating ? <Spinner className="w-4 h-4" /> : <IconSparkles className="w-4 h-4" />}
                                                {isCampaignPackReady ? 'Review Campaign Pack' : 'Generate Campaign Pack'}
                                             </button>
                                         )}
                                     </div>
                                 )}

                                 <div ref={selectedOutputCardRef} id="selected-output-card" className="rounded-lg border border-stone-200 bg-white scroll-mt-24">
                                     <div className="border-b border-stone-100 p-4">
                                         <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                             <div className="flex flex-wrap items-center gap-2">
                                                 <h3 className="text-base font-semibold text-slate-900">{selectedCampaignOutput?.displayLabel || getOutputDisplayLabel(activeSubTab)}</h3>
                                                 {selectedCampaignOutput && (
                                                     <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${getCampaignOutputStatusClass(selectedCampaignOutput.status)}`}>
                                                         {getCampaignOutputStatusLabel(selectedCampaignOutput.status)}
                                                     </span>
                                                 )}
                                             </div>
                                             <div className="flex items-center gap-2 text-xs text-slate-600">
                                                 <button onClick={() => setActiveVersionIndex(v => Math.max(0, v - 1))} disabled={activeVersionIndex === 0} className="rounded p-1 hover:bg-stone-100 disabled:opacity-20" title="Previous version" aria-label="Previous version"><IconChevronLeft className="w-4 h-4" /></button>
                                                 <span className="min-w-[78px] text-center font-bold text-slate-700">Version {activeVersionIndex + 1} / {Math.max(1, versionSets.length)}</span>
                                                 <button onClick={() => setActiveVersionIndex(v => Math.min(versionSets.length - 1, v + 1))} disabled={activeVersionIndex >= versionSets.length - 1} className="rounded p-1 hover:bg-stone-100 disabled:opacity-20" title="Next version" aria-label="Next version"><IconChevronRight className="w-4 h-4" /></button>
                                             </div>
                                         </div>
                                     </div>

                                     <div className="p-4">
                                         {currentCopy && activeSubTab === LISTING_COPY_TAB && (
                                             <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                                 <span className="font-semibold">Listing Copy is ready.</span> Review the draft here, then generate Campaign Pack if you need channel outputs.
                                             </div>
                                         )}
                                         {currentCopy && activeSubTab !== LISTING_COPY_TAB && isCampaignPackReady && (
                                             <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                                                 <span className="font-semibold">Campaign Pack is ready.</span> Use Campaign Library filters or download options when ready.
                                             </div>
                                         )}
                                         {generatingTab && generatingTab === activeSubTab ? (
                                             <div className="h-64 flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-300 bg-stone-50">
                                                 <Spinner className="w-8 h-8 text-red-600 mb-3" />
                                                 <p className="text-slate-500 text-sm">Generating {getOutputDisplayLabel(generatingTab)}...</p>
                                             </div>
                                         ) : currentCopy ? (
                                             <>
                                                 <div className="mb-3 flex flex-col gap-1 rounded-md border border-stone-200 bg-stone-50 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                                                     <label
                                                        className={`inline-flex min-h-8 items-center gap-2 text-sm font-semibold ${currentCopy ? 'cursor-pointer text-slate-800' : 'cursor-not-allowed text-stone-400'}`}
                                                        title="When enabled, agent profile details are included with this output."
                                                     >
                                                         <input
                                                            type="checkbox"
                                                            checked={includeContactDetails}
                                                            disabled={!currentCopy}
                                                            onChange={event => handleToggleContactDetails(event.target.checked)}
                                                            aria-describedby="contact-card-helper"
                                                            className="h-4 w-4 rounded border-stone-300 text-red-600 focus:ring-red-500 disabled:cursor-not-allowed"
                                                         />
                                                         Contact card
                                                     </label>
                                                     <p id="contact-card-helper" className="text-[11px] leading-snug text-slate-500">Include the agent profile/contact details with this output.</p>
                                                 </div>
                                                 <div
                                                    ref={generatedOutputRef}
                                                    role="region"
                                                    aria-label={`${getOutputDisplayLabel(activeSubTab)} generated output`}
                                                    tabIndex={0}
                                                    className="min-h-[520px] w-full whitespace-pre-wrap rounded-lg border border-stone-200 bg-stone-50 p-4 font-sans text-sm leading-relaxed text-slate-800 shadow-inner focus:outline-none focus:ring-2 focus:ring-slate-300"
                                                 >
                                                    {currentCopy}
                                                 </div>
                                             </>
                                         ) : (
                                             <div className="rounded-lg border border-dashed border-stone-300 bg-stone-50 p-6 text-center">
                                                 <IconSparkles className="mx-auto mb-3 h-10 w-10 text-stone-400" />
                                                 <h3 className="text-sm font-bold text-slate-900">No output for this item yet</h3>
                                                 <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
                                                     {isSelectedOutputRetryNeeded
                                                        ? 'Campaign Pack paused on this output. Retry this output, or retry the remaining Campaign Pack outputs above.'
                                                        : activeSubTab === LISTING_COPY_TAB
                                                            ? isPropertyBriefReady ? 'Generate Listing Copy from the offer card above to create the campaign baseline.' : propertyBriefReadinessHint
                                                            : currentVersionSet[LISTING_COPY_TAB] ? 'Generate this output from the current Listing Copy.' : 'Generate Listing Copy first, then create this campaign output.'}
                                                 </p>
                                                 {activeSubTab !== LISTING_COPY_TAB && (
                                                     <button
                                                        onClick={() => handleGenerateThisOutput(activeSubTab)}
                                                        disabled={Boolean(generateCopyBlocker) || !currentVersionSet[LISTING_COPY_TAB] || generatingTab === activeSubTab || queuedOutputTabs.includes(activeSubTab)}
                                                        title={getCampaignOperationTitle('generateFullCopy', !currentVersionSet[LISTING_COPY_TAB] ? 'Generate Listing Copy before creating this output.' : undefined)}
                                                        className={`mt-4 ${aimUi.primaryButton}`}
                                                     >
                                                        {generatingTab === activeSubTab ? <Spinner className="w-4 h-4" /> : <IconSparkles className="w-4 h-4" />}
                                                        {queuedOutputTabs.includes(activeSubTab) ? 'Queued' : isSelectedOutputRetryNeeded ? 'Retry this output' : 'Generate this output'}
                                                     </button>
                                                 )}
                                             </div>
                                         )}
                                     </div>

                                     <div className="border-t border-stone-100 bg-stone-50/80 px-4 py-3">
                                         <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                             <div className="flex flex-wrap items-center gap-2">
                                                 <button onClick={() => handleCopyToClipboard(currentCopy)} disabled={!currentCopy} title={currentCopy ? 'Copy current output' : 'No generated output selected.'} aria-label="Copy current output" className={compactActionButtonClass}><IconClipboard className="w-4 h-4" /> Copy</button>
                                                 <div className="relative" ref={exportMenuRef}>
                                                     <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} disabled={!currentCopy} title={currentCopy ? 'Download current output' : 'No generated output selected.'} aria-label="Download current output" className={compactActionButtonClass}>
                                                         <IconDownload className="w-4 h-4" />
                                                         Download
                                                     </button>
                                                     {isExportMenuOpen && (
                                                         <div className="absolute left-0 top-full z-20 mt-2 w-56 rounded-md border border-stone-200 bg-white py-1 shadow-lg">
                                                             <p className="mb-1 border-b border-stone-100 px-4 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Current output only</p>
                                                             <p className="px-4 pb-2 text-[11px] leading-snug text-slate-500">Exports this generated draft only.</p>
                                                             <button onClick={() => handleDownloadCurrentOutput('word')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileWord className="w-4 h-4 mr-2" /> Word (.doc)</button>
                                                             <button onClick={() => handleDownloadCurrentOutput('txt')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFileTxt className="w-4 h-4 mr-2" /> Text (.txt)</button>
                                                             <button onClick={() => handleDownloadCurrentOutput('pdf')} className="flex w-full items-center px-4 py-2 text-left text-sm text-slate-700 hover:bg-stone-50"><IconFilePdf className="w-4 h-4 mr-2" /> Print / PDF</button>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                         <p className="mt-2 max-w-3xl text-[11px] leading-snug text-slate-500">
                                             Generated draft. Update campaign inputs and regenerate for changes; final edits happen outside Real Estate AIM.
                                         </p>
                                     </div>
                                 </div>
                             </div>
                         </Section>
                    </div>
                 </div>

                 <div className="mt-4 rounded-lg border border-amber-200 bg-white px-4 py-3 text-xs leading-relaxed text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
                    <span className="font-semibold text-amber-900">Generated draft review:</span> AI-generated copy must be reviewed before publication. Check property claims against source material, review public web research and attribution, and do not rely on AI output for legal, valuation or compliance advice. Users are responsible for rights, accuracy and publication decisions.
                 </div>

                 <div id="print-render-area" className="hidden"></div>
            </main>
        </div>
    );
};

export default App;
