import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type {
    GenerationParams,
    ChatMessage,
    ImageContent,
    GroundingSource,
    ResearchResult,
    PreviewTab,
    UsageStats,
    ServiceResponse,
    StrategyAnalysisResult,
    ApprovedBriefSnapshot,
    HardExcludedClaim,
    ReviewedClaim,
    ReviewedPhotoHighlight,
    SuggestionGovernanceContext,
} from '../types';
import { computeApprovedBriefSnapshotId } from '../domain/approvedBrief.js';
import {
    findGovernanceConflicts,
    sanitizeCorrectedClaimContext,
    sanitizeLowerAuthorityText,
    splitGovernanceListItems,
} from '../domain/governance.js';
import { areLandMeasurementsEquivalent } from '../domain/structuredFacts.js';

const BETA_SESSION_TTL_MS = 12 * 60 * 60 * 1000;

const TARGET_MARKETS = [
  'Young Families',
  'Established Families',
  'First Home Buyers',
  'Investors',
  'Empty Nesters / Downsizers',
  'Early Retirees',
  'Luxury Buyers',
  'Young Professionals',
  'Sea Changer',
  'Tree Changer',
] as const;

const WRITING_STYLES = [
  'Professional',
  'Casual',
  'Luxury',
  'Friendly',
  'Urgent',
  'Descriptive',
  'Emotive (not emotional)',
  'Aspirational',
  'Inventory / Fact-Based',
] as const;

const PREVIEW_TABS: PreviewTab[] = [
    'Full Copy',
    'Just Listed',
    'Brochure Copy',
    'Email',
    'Flyer',
    'Facebook',
    'Facebook Marketplace',
    'Instagram',
    'X (Twitter)',
    'Google Business',
    'TikTok',
    'Open House',
    'Long-form / Blog',
    'Video Script',
    'Coming Soon Teaser',
    'Coming Soon Email',
    'Coming Soon SMS',
];

const MAX_BODY_BYTES = 6 * 1024 * 1024;
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_HISTORY_MESSAGES = 20;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 80;
const SUPPORTED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

const TOKEN_COST_DISCLAIMER_FLAGS = [
    'token_only_estimate',
    'grounding_tool_charges_not_included',
    'provider_usage_required'
];

const PRICING: Record<string, { input: number; output: number }> = {
    'gemini-3.1-pro-preview': { input: 2.00, output: 12.00 },
    'gemini-3-flash-preview': { input: 0.50, output: 3.00 },
    'gemini-3.1-flash-lite': { input: 0.25, output: 1.50 },
    'gemini-2.5-flash-lite': { input: 0.10, output: 0.40 },
    'gemini-2.5-pro': { input: 1.25, output: 10.00 },
    'gemini-2.5-flash': { input: 0.10, output: 0.40 },
};

const PROMPT_DEFINITIONS = `
# AI Real Estate Copywriter Prompt Definitions

CRITICAL: Return ONLY requested copy. NO em-dashes (—). No commentary.
`;

type CopywritingOperation =
    | 'verifyBetaAccess'
    | 'suggestAddresses'
    | 'researchProperty'
    | 'analyzeStrategy'
    | 'analyzeFeatures'
    | 'analyzeSingleImage'
    | 'generateCopy'
    | 'generateCopyVariant'
    | 'refineCopy'
    | 'getChatbotResponse';

const ALLOWED_OPERATIONS = new Set<CopywritingOperation>([
    'verifyBetaAccess',
    'suggestAddresses',
    'researchProperty',
    'analyzeStrategy',
    'analyzeFeatures',
    'analyzeSingleImage',
    'generateCopy',
    'generateCopyVariant',
    'refineCopy',
    'getChatbotResponse',
]);

type ModelTier = 'none' | 'flash' | 'pro';

const OPERATION_MODEL_TIER: Record<CopywritingOperation, ModelTier> = {
    verifyBetaAccess: 'none',
    suggestAddresses: 'flash',
    researchProperty: 'pro',
    analyzeStrategy: 'pro',
    analyzeFeatures: 'flash',
    analyzeSingleImage: 'flash',
    generateCopy: 'pro',
    generateCopyVariant: 'flash',
    refineCopy: 'flash',
    getChatbotResponse: 'flash',
};

const PRO_VARIANT_TABS = new Set<PreviewTab>(['Brochure Copy', 'Long-form / Blog']);

const throttleStore = new Map<string, { windowStart: number; count: number }>();
let cachedAi: GoogleGenAI | null = null;

class ApiError extends Error {
    constructor(public statusCode: number, message: string) {
        super(message);
        this.name = 'ApiError';
    }
}

const isRetryableHttpStatus = (statusCode: number): boolean => (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
);

const getApiKey = (): string => {
    const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!key) {
        throw new ApiError(500, 'Gemini API key is not configured on the server.');
    }
    return key;
};

const getAiClient = (): GoogleGenAI => {
    if (!cachedAi) cachedAi = new GoogleGenAI({ apiKey: getApiKey() });
    return cachedAi;
};

const requireEnvString = (name: string): string => {
    const value = process.env[name];
    if (!value || !value.trim()) {
        throw new ApiError(500, `${name} is not configured on the server.`);
    }
    return value.trim();
};

const getProModel = (): string => requireEnvString('GEMINI_PRO_MODEL');
const getFlashModel = (): string => requireEnvString('GEMINI_FLASH_MODEL');

const parseBetaAccessCodeList = (value: string | undefined): string[] => {
    if (!value) return [];
    return value
        .split(/[,;\s]+/)
        .map(code => code.trim())
        .filter(Boolean);
};

const getConfiguredBetaAccessCodes = (): string[] => {
    const primaryCode = process.env.BETA_ACCESS_CODE?.trim();
    const secondaryCodes = parseBetaAccessCodeList(process.env.BETA_ACCESS_CODES);
    return Array.from(new Set([
        ...(primaryCode ? [primaryCode] : []),
        ...secondaryCodes,
    ]));
};

const resolveModelForOperation = (operation: CopywritingOperation, variantType?: PreviewTab): string | null => {
    let tier = OPERATION_MODEL_TIER[operation];
    if (operation === 'generateCopyVariant' && variantType && PRO_VARIANT_TABS.has(variantType)) {
        tier = 'pro';
    }

    if (tier === 'none') return null;
    return tier === 'flash' ? getFlashModel() : getProModel();
};

const calculateCost = (model: string, promptTokens: number, responseTokens: number): number | null => {
    const rates = PRICING[model];
    if (!rates) return null;
    return (promptTokens / 1000000 * rates.input) + (responseTokens / 1000000 * rates.output);
};

const extractGroundingQueryCount = (response: any): number | null => {
    const metadata = response?.candidates?.[0]?.groundingMetadata;
    const candidates = [
        metadata?.searchEntryPoint?.renderedContent ? undefined : undefined,
        metadata?.webSearchQueries,
        metadata?.googleSearchDynamicRetrievalScore,
        metadata?.groundingChunks,
    ];

    if (Array.isArray(metadata?.webSearchQueries)) return metadata.webSearchQueries.length;
    if (Array.isArray(metadata?.groundingChunks)) return metadata.groundingChunks.length > 0 ? null : 0;
    return candidates.some(value => value !== undefined) ? null : null;
};

const extractUsage = (response: any, model: string, operation: CopywritingOperation): UsageStats => {
    const usage = response.usageMetadata;
    if (!usage) {
        return {
            operation,
            usageStatus: 'unavailable',
            pricingStatus: PRICING[model] ? 'priced' : 'unknown',
            promptTokens: null,
            candidatesTokens: null,
            totalTokens: null,
            thinkingTokens: null,
            cachedTokens: null,
            groundingQueries: extractGroundingQueryCount(response),
            mapsGroundingQueries: null,
            estimatedCost: null,
            model,
            costDisclaimerFlags: TOKEN_COST_DISCLAIMER_FLAGS
        };
    }

    const promptTokens = Number.isFinite(usage.promptTokenCount) ? usage.promptTokenCount : null;
    const candidatesTokens = Number.isFinite(usage.candidatesTokenCount) ? usage.candidatesTokenCount : null;
    const totalTokens = Number.isFinite(usage.totalTokenCount) ? usage.totalTokenCount : null;
    const thinkingTokens = Number.isFinite(usage.thoughtsTokenCount) ? usage.thoughtsTokenCount : null;
    const cachedTokens = Number.isFinite(usage.cachedContentTokenCount) ? usage.cachedContentTokenCount : null;
    const estimatedCost = promptTokens !== null && candidatesTokens !== null
        ? calculateCost(model, promptTokens, candidatesTokens)
        : null;

    return {
        operation,
        usageStatus: estimatedCost === null ? 'partial' : 'available',
        pricingStatus: PRICING[model] ? 'priced' : 'unknown',
        promptTokens,
        candidatesTokens,
        totalTokens,
        thinkingTokens,
        cachedTokens,
        groundingQueries: extractGroundingQueryCount(response),
        mapsGroundingQueries: null,
        estimatedCost,
        model,
        costDisclaimerFlags: TOKEN_COST_DISCLAIMER_FLAGS
    };
};

const addNullableUsageValue = (current: number | null, next: number | null | undefined): number | null => {
    if (next === null || next === undefined) return current;
    return (current ?? 0) + next;
};

const aggregateServerUsage = (operation: CopywritingOperation, usages: UsageStats[], fallbackModel: string): UsageStats => {
    const models = Array.from(new Set(usages.map(usage => usage.model).filter(Boolean)));
    const excludedOperationCount = usages.filter(usage => usage.usageStatus === 'unavailable').length;
    const unknownCostOperationCount = usages.filter(usage => (
        usage.pricingStatus === 'unknown' ||
        (usage.usageStatus !== 'unavailable' && usage.estimatedCost === null)
    )).length;
    const costValues = usages
        .map(usage => usage.estimatedCost)
        .filter((cost): cost is number => typeof cost === 'number');

    return {
        operation,
        usageStatus: excludedOperationCount > 0 || unknownCostOperationCount > 0 ? 'partial' : 'available',
        pricingStatus: unknownCostOperationCount > 0 ? 'unknown' : 'priced',
        promptTokens: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.promptTokens), null as number | null),
        candidatesTokens: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.candidatesTokens), null as number | null),
        totalTokens: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.totalTokens), null as number | null),
        thinkingTokens: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.thinkingTokens), null as number | null),
        cachedTokens: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.cachedTokens), null as number | null),
        groundingQueries: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.groundingQueries), null as number | null),
        mapsGroundingQueries: usages.reduce((sum, usage) => addNullableUsageValue(sum, usage.mapsGroundingQueries), null as number | null),
        estimatedCost: costValues.length > 0 ? costValues.reduce((sum, cost) => sum + cost, 0) : null,
        model: models.length === 0 ? fallbackModel : models.length === 1 ? models[0] : `mixed: ${models.join(', ')}`,
        costDisclaimerFlags: TOKEN_COST_DISCLAIMER_FLAGS,
        excludedOperationCount,
        unknownCostOperationCount
    };
};

const withRetry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
    try {
        return await fn();
    } catch (error: any) {
        if (retries > 0) {
            console.warn(`API call failed, retrying... (${retries} attempts left). Error: ${error?.message || 'Unknown'}`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
};

const formatAIResponseList = (input: unknown, separator: string = ', '): string => {
    if (input === null || input === undefined || input === '') return '';
    if (Array.isArray(input)) {
        return input
            .map(item => String(item).trim())
            .filter(Boolean)
            .join(separator);
    }
    if (typeof input === 'string') return input.replace(/,([^\s])/g, ', $1').trim();
    return String(input).trim();
};

const cleanMarkdown = (input: unknown): string => {
    if (input === null || input === undefined) return '';

    const text = typeof input === 'string' ? input :
                 (typeof input === 'object' ? JSON.stringify(input, null, 2) : String(input));

    return text
        .replace(/```(json|text)?/g, '')
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/^### (.*$)/gim, '$1')
        .replace(/^## (.*$)/gim, '$1')
        .replace(/^# (.*$)/gim, '$1')
        .replace(/^- /gm, '')
        .replace(/[\u2014\u2013]/g, ' - ')
        .trim();
};

const parseRobustJSON = (text: string): unknown => {
    try {
        return JSON.parse(text.trim());
    } catch {
        const firstBrace = text.indexOf('{');
        const firstBracket = text.indexOf('[');
        let start = -1;

        if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
            start = firstBrace;
        } else if (firstBracket !== -1) {
            start = firstBracket;
        }

        const lastBrace = text.lastIndexOf('}');
        const lastBracket = text.lastIndexOf(']');
        let end = -1;

        if (lastBrace !== -1 && lastBrace > lastBracket) {
            end = lastBrace;
        } else if (lastBracket !== -1) {
            end = lastBracket;
        }

        if (start !== -1 && end !== -1 && end > start) {
            const jsonPart = text.substring(start, end + 1);
            try {
                return JSON.parse(jsonPart);
            } catch {
                throw new Error('Could not parse valid JSON from AI response.');
            }
        }
        throw new Error('No JSON found in AI response.');
    }
};

const normalizeStringArray = (value: unknown, fieldName: string): string[] => {
    if (Array.isArray(value)) {
        const items = value.map(item => String(item).trim()).filter(Boolean);
        if (items.length > 0) return items;
    }
    if (typeof value === 'string' && value.trim()) return [value.trim()];
    throw new Error(`${fieldName} must contain at least one value.`);
};

const validateStrategyAnalysisResult = (value: unknown): StrategyAnalysisResult => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Strategy response must be a JSON object.');
    }

    const result = value as Record<string, unknown>;
    const primaryTargetMarket = typeof result.primaryTargetMarket === 'string'
        ? result.primaryTargetMarket.trim()
        : '';
    if (!TARGET_MARKETS.includes(primaryTargetMarket as any)) {
        throw new Error('Strategy response primaryTargetMarket is missing or invalid.');
    }

    let secondaryTargetMarket: string | null = null;
    if (typeof result.secondaryTargetMarket === 'string' && result.secondaryTargetMarket.trim()) {
        const candidate = result.secondaryTargetMarket.trim();
        if (!TARGET_MARKETS.includes(candidate as any)) {
            throw new Error('Strategy response secondaryTargetMarket is invalid.');
        }
        if (candidate !== primaryTargetMarket) secondaryTargetMarket = candidate;
    }

    const rawWritingStyles = normalizeStringArray(result.writingStyles, 'writingStyles');
    if (rawWritingStyles.length > 2) {
        throw new Error('Strategy response writingStyles must not include more than two styles.');
    }
    const writingStyles = rawWritingStyles.filter(style => WRITING_STYLES.includes(style as any));
    if (writingStyles.length !== rawWritingStyles.length) {
        throw new Error('Strategy response writingStyles includes unsupported styles.');
    }
    if (writingStyles.length < 1 || writingStyles.length > 2) {
        throw new Error('Strategy response writingStyles must include one or two supported styles.');
    }

    const featuresToHighlight = formatAIResponseList(result.featuresToHighlight);
    if (!featuresToHighlight) {
        throw new Error('Strategy response featuresToHighlight is required.');
    }

    return {
        primaryTargetMarket,
        secondaryTargetMarket,
        writingStyles,
        featuresToHighlight,
        thingsToAvoid: formatAIResponseList(result.thingsToAvoid)
    };
};

const parseStrategyAnalysisText = (text: string | undefined): StrategyAnalysisResult => {
    if (!text || !text.trim()) {
        throw new Error('Strategy response was empty.');
    }
    return validateStrategyAnalysisResult(parseRobustJSON(text));
};

const normalizeNullableNumber = (value: unknown): number | null => {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string') return null;
    const numeric = Number(value.replace(/,/g, '').trim());
    return Number.isFinite(numeric) ? numeric : null;
};

const normalizeNullableText = (value: unknown): string | null => {
    if (value === null || value === undefined) return null;
    const text = cleanMarkdown(value);
    return text || null;
};

const requireResearchTextField = (value: unknown, fieldName: string): string => {
    const text = cleanMarkdown(value);
    if (!text) throw new Error(`Research response ${fieldName} is missing or empty.`);
    return text;
};

const validateResearchPropertyResult = (value: unknown): Omit<ResearchResult, 'fullText' | 'sources'> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Research response must be a JSON object.');
    }

    const result = value as Record<string, unknown>;
    const specsInput = result.specs;
    if (!specsInput || typeof specsInput !== 'object' || Array.isArray(specsInput)) {
        throw new Error('Research response specs must be a JSON object.');
    }
    const specsRecord = specsInput as Record<string, unknown>;

    return {
        summary: requireResearchTextField(result.summary, 'summary'),
        keyFeatures: requireResearchTextField(
            Array.isArray(result.keyFeatures) ? result.keyFeatures.join('\n') : result.keyFeatures,
            'keyFeatures'
        ),
        suburbProfile: requireResearchTextField(result.suburbProfile, 'suburbProfile'),
        regionalProfile: requireResearchTextField(result.regionalProfile, 'regionalProfile'),
        specs: {
            beds: normalizeNullableNumber(specsRecord.beds),
            baths: normalizeNullableNumber(specsRecord.baths),
            cars: normalizeNullableNumber(specsRecord.cars),
            landSize: normalizeNullableNumber(specsRecord.landSize),
            propertyType: normalizeNullableText(specsRecord.propertyType) || 'House',
            priceGuide: normalizeNullableText(specsRecord.priceGuide),
            lastSold: normalizeNullableText(specsRecord.lastSold),
        }
    };
};

const parseResearchPropertyText = (text: string | undefined): Omit<ResearchResult, 'fullText' | 'sources'> => {
    if (!text || !text.trim()) {
        throw new Error('Research response was empty.');
    }
    return validateResearchPropertyResult(parseRobustJSON(text));
};

const readJsonBody = async (req: any): Promise<any> => {
    const lengthHeader = req.headers?.['content-length'];
    const declaredLength = typeof lengthHeader === 'string' ? Number(lengthHeader) : 0;
    if (declaredLength > MAX_BODY_BYTES) {
        throw new ApiError(413, 'Request payload is too large.');
    }

    if (req.body !== undefined && req.body !== null) {
        if (typeof req.body === 'object') return req.body;
        const raw = String(req.body);
        if (Buffer.byteLength(raw, 'utf8') > MAX_BODY_BYTES) {
            throw new ApiError(413, 'Request payload is too large.');
        }
        return JSON.parse(raw);
    }

    let size = 0;
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) {
            throw new ApiError(413, 'Request payload is too large.');
        }
        chunks.push(buffer);
    }
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) throw new ApiError(400, 'Missing JSON request body.');
    return JSON.parse(raw);
};

const requireObject = (value: unknown, fieldName: string): Record<string, any> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new ApiError(400, `${fieldName} must be an object.`);
    }
    return value as Record<string, any>;
};

const requireString = (value: unknown, fieldName: string, maxLength: number, minLength = 1): string => {
    if (typeof value !== 'string') throw new ApiError(400, `${fieldName} must be a string.`);
    const trimmed = value.trim();
    if (trimmed.length < minLength) throw new ApiError(400, `${fieldName} is required.`);
    if (trimmed.length > maxLength) throw new ApiError(400, `${fieldName} is too long.`);
    return trimmed;
};

const optionalString = (value: unknown, fieldName: string, maxLength: number): string | null => {
    if (value === null || value === undefined || value === '') return null;
    return requireString(value, fieldName, maxLength, 0);
};

const requireBoolean = (value: unknown, fieldName: string): boolean => {
    if (typeof value !== 'boolean') throw new ApiError(400, `${fieldName} must be a boolean.`);
    return value;
};

const optionalLocation = (value: unknown): { latitude: number; longitude: number } | undefined => {
    if (value === null || value === undefined) return undefined;
    const location = requireObject(value, 'userLocation');
    const latitude = Number(location.latitude);
    const longitude = Number(location.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new ApiError(400, 'userLocation must include numeric latitude and longitude.');
    }
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new ApiError(400, 'userLocation is outside valid latitude/longitude bounds.');
    }
    return { latitude, longitude };
};

const estimateBase64Bytes = (base64: string): number => {
    const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
    return Math.floor((base64.length * 3) / 4) - padding;
};

const validateImage = (value: unknown, fieldName: string): ImageContent => {
    const image = requireObject(value, fieldName);
    const mimeType = requireString(image.mimeType, `${fieldName}.mimeType`, 80);
    if (!SUPPORTED_IMAGE_TYPES.has(mimeType)) {
        throw new ApiError(400, `${fieldName}.mimeType is not supported.`);
    }

    const base64 = requireString(image.base64, `${fieldName}.base64`, Math.ceil(MAX_IMAGE_BYTES * 4 / 3) + 4);
    if (!/^[A-Za-z0-9+/=]+$/.test(base64)) {
        throw new ApiError(400, `${fieldName}.base64 must be base64 encoded image data.`);
    }
    if (estimateBase64Bytes(base64) > MAX_IMAGE_BYTES) {
        throw new ApiError(413, `${fieldName} exceeds the 4 MB per-image limit.`);
    }
    return { base64, mimeType };
};

const validatePropertyDetails = (value: unknown) => {
    const details = requireObject(value, 'params.details');
    return {
        beds: details.beds === null || details.beds === undefined || details.beds === '' ? null : Number(details.beds),
        baths: details.baths === null || details.baths === undefined || details.baths === '' ? null : Number(details.baths),
        cars: details.cars === null || details.cars === undefined || details.cars === '' ? null : Number(details.cars),
        landSize: details.landSize === null || details.landSize === undefined || details.landSize === '' ? null : Number(details.landSize),
        propertyType: requireString(details.propertyType, 'params.details.propertyType', 100),
    };
};

const validateCopyContext = (value: unknown) => {
    const context = requireObject(value, 'params.context');
    if (!Array.isArray(context.writingStyle) || context.writingStyle.length < 1 || context.writingStyle.length > 2) {
        throw new ApiError(400, 'params.context.writingStyle must contain one or two styles.');
    }
    return {
        primaryTargetMarket: requireString(context.primaryTargetMarket, 'params.context.primaryTargetMarket', 100),
        secondaryTargetMarket: optionalString(context.secondaryTargetMarket, 'params.context.secondaryTargetMarket', 100) || '',
        writingStyle: context.writingStyle.map((style: unknown) => requireString(style, 'params.context.writingStyle', 100)),
        featuresToHighlight: optionalString(context.featuresToHighlight, 'params.context.featuresToHighlight', 5000) || '',
        thingsToAvoid: optionalString(context.thingsToAvoid, 'params.context.thingsToAvoid', 5000) || '',
    };
};

const REVIEWED_FACT_KEYS = ['bedrooms', 'bathrooms', 'carSpaces', 'landValue', 'propertyType'] as const;
const LAND_UNITS = ['m²', 'ha', 'acres'] as const;

const requireStringArray = (
    value: unknown,
    fieldName: string,
    maxItems: number,
    maxItemLength: number,
    minItems = 0
): string[] => {
    if (!Array.isArray(value) || value.length < minItems || value.length > maxItems) {
        throw new ApiError(400, `${fieldName} must contain between ${minItems} and ${maxItems} values.`);
    }
    return value.map((item, index) => requireString(item, `${fieldName}[${index}]`, maxItemLength));
};

const requireNullableSnapshotNumber = (
    value: unknown,
    fieldName: string,
    options: { integer?: boolean; maximum?: number } = {}
): number | null => {
    if (value === null) return null;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
        throw new ApiError(400, `${fieldName} must be a non-negative finite number or null.`);
    }
    if (options.integer && !Number.isInteger(value)) {
        throw new ApiError(400, `${fieldName} must be a whole number or null.`);
    }
    if (options.maximum !== undefined && value > options.maximum) {
        throw new ApiError(400, `${fieldName} is outside the supported range.`);
    }
    return value;
};

const requireSnapshotFactValue = (value: unknown, fieldName: string): string | number | null => {
    if (value === null) return null;
    if (typeof value === 'number') {
        if (!Number.isFinite(value)) throw new ApiError(400, `${fieldName} must be finite.`);
        return value;
    }
    if (typeof value === 'string') return requireString(value, fieldName, 500, 0);
    throw new ApiError(400, `${fieldName} must be a string, number, or null.`);
};

const requireStableId = (value: unknown, fieldName: string, maxLength = 200): string => {
    const id = requireString(value, fieldName, maxLength);
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id)) {
        throw new ApiError(400, `${fieldName} must be a stable identifier.`);
    }
    return id;
};

const validateOptionalSnapshotString = (value: unknown, fieldName: string, maxLength: number): string | undefined => {
    if (value === undefined) return undefined;
    return requireString(value, fieldName, maxLength, 0);
};

const validateLandUnit = (value: unknown, fieldName: string): ApprovedBriefSnapshot['approvedFacts']['landUnit'] => {
    const unit = requireString(value, fieldName, 10) as ApprovedBriefSnapshot['approvedFacts']['landUnit'];
    if (!LAND_UNITS.includes(unit)) throw new ApiError(400, `${fieldName} is invalid.`);
    return unit;
};

const validateApprovedFacts = (
    value: unknown,
    fieldName: string
): ApprovedBriefSnapshot['approvedFacts'] => {
    const facts = requireObject(value, fieldName);
    return {
        bedrooms: requireNullableSnapshotNumber(facts.bedrooms, `${fieldName}.bedrooms`, { integer: true, maximum: 100 }),
        bathrooms: requireNullableSnapshotNumber(facts.bathrooms, `${fieldName}.bathrooms`, { maximum: 100 }),
        carSpaces: requireNullableSnapshotNumber(facts.carSpaces, `${fieldName}.carSpaces`, { integer: true, maximum: 100 }),
        landValue: requireNullableSnapshotNumber(facts.landValue, `${fieldName}.landValue`, { maximum: 100000000 }),
        landUnit: validateLandUnit(facts.landUnit, `${fieldName}.landUnit`),
        propertyType: requireString(facts.propertyType, `${fieldName}.propertyType`, 100),
    };
};

const validateHardExcludedClaim = (value: unknown, fieldName: string): HardExcludedClaim => {
    const claim = requireObject(value, fieldName);
    const text = requireString(claim.text, `${fieldName}.text`, 1000);
    const aliases = requireStringArray(claim.aliases, `${fieldName}.aliases`, 50, 1000);
    const reason = validateOptionalSnapshotString(claim.reason, `${fieldName}.reason`, 2000);
    return {
        id: requireStableId(claim.id, `${fieldName}.id`),
        text,
        aliases: Array.from(new Set(aliases.map(alias => alias.trim()).filter(Boolean))),
        provenance: requireString(claim.provenance, `${fieldName}.provenance`, 500),
        ...(reason === undefined ? {} : { reason }),
    };
};

const validateHardExcludedClaims = (value: unknown, fieldName: string): HardExcludedClaim[] => {
    if (!Array.isArray(value) || value.length > 100) {
        throw new ApiError(400, `${fieldName} must be an array with no more than 100 claims.`);
    }
    const claims = value.map((claim, index) => validateHardExcludedClaim(claim, `${fieldName}[${index}]`));
    const ids = new Set<string>();
    for (const claim of claims) {
        if (ids.has(claim.id)) throw new ApiError(400, `${fieldName} contains duplicate claim id ${claim.id}.`);
        ids.add(claim.id);
    }
    return claims;
};

const mergeHardExclusions = (...groups: HardExcludedClaim[][]): HardExcludedClaim[] => {
    const merged = new Map<string, HardExcludedClaim>();
    for (const claim of groups.flat()) {
        const current = merged.get(claim.id);
        if (!current) {
            merged.set(claim.id, claim);
            continue;
        }
        if (current.text.toLocaleLowerCase() !== claim.text.toLocaleLowerCase()) {
            throw new ApiError(400, `Hard exclusion ${claim.id} has conflicting canonical text.`);
        }
        merged.set(claim.id, {
            ...current,
            aliases: Array.from(new Set([...current.aliases, ...claim.aliases])),
            reason: current.reason ?? claim.reason,
        });
    }
    return Array.from(merged.values());
};

const validateReviewedClaim = (
    value: unknown,
    fieldName: string,
    expectedState: 'confirmed' | 'corrected'
): ReviewedClaim => {
    const claim = requireObject(value, fieldName);
    const state = requireString(claim.state, `${fieldName}.state`, 30);
    if (state !== expectedState) {
        throw new ApiError(400, `${fieldName}.state must be ${expectedState}.`);
    }
    const reason = validateOptionalSnapshotString(claim.reason, `${fieldName}.reason`, 2000);
    return {
        id: requireStableId(claim.id, `${fieldName}.id`),
        sourceText: requireString(claim.sourceText, `${fieldName}.sourceText`, 5000),
        approvedText: requireString(claim.approvedText, `${fieldName}.approvedText`, 5000),
        provenance: requireString(claim.provenance, `${fieldName}.provenance`, 500),
        state: expectedState,
        aliases: requireStringArray(claim.aliases, `${fieldName}.aliases`, 50, 1000),
        ...(reason === undefined ? {} : { reason }),
    };
};

const validateReviewedClaims = (
    value: unknown,
    fieldName: string,
    expectedState: 'confirmed' | 'corrected'
): ReviewedClaim[] => {
    if (!Array.isArray(value) || value.length > 100) {
        throw new ApiError(400, `${fieldName} must be an array with no more than 100 claims.`);
    }
    const claims = value.map((claim, index) => validateReviewedClaim(claim, `${fieldName}[${index}]`, expectedState));
    const ids = new Set<string>();
    for (const claim of claims) {
        if (ids.has(claim.id)) throw new ApiError(400, `${fieldName} contains duplicate claim id ${claim.id}.`);
        ids.add(claim.id);
    }
    return claims;
};

const validateFactProvenance = (
    value: unknown,
    fieldName: string,
    approvedFacts: ApprovedBriefSnapshot['approvedFacts']
): ApprovedBriefSnapshot['factProvenance'] => {
    if (!Array.isArray(value) || value.length !== REVIEWED_FACT_KEYS.length) {
        throw new ApiError(400, `${fieldName} must contain one entry for every approved structured fact.`);
    }
    const seen = new Set<string>();
    const entries = value.map((item, index) => {
        const entry = requireObject(item, `${fieldName}[${index}]`);
        const key = requireString(entry.key, `${fieldName}[${index}].key`, 30) as ApprovedBriefSnapshot['factProvenance'][number]['key'];
        if (!REVIEWED_FACT_KEYS.includes(key)) throw new ApiError(400, `${fieldName}[${index}].key is invalid.`);
        if (seen.has(key)) throw new ApiError(400, `${fieldName} contains duplicate key ${key}.`);
        seen.add(key);
        const state = requireString(entry.state, `${fieldName}[${index}].state`, 30);
        if (state !== 'confirmed' && state !== 'corrected') {
            throw new ApiError(400, `${fieldName}[${index}].state must be confirmed or corrected.`);
        }
        const sourceValue = requireSnapshotFactValue(entry.sourceValue, `${fieldName}[${index}].sourceValue`);
        const approvedValue = requireSnapshotFactValue(entry.approvedValue, `${fieldName}[${index}].approvedValue`);
        const sourceUnit = entry.sourceUnit === undefined
            ? undefined
            : validateLandUnit(entry.sourceUnit, `${fieldName}[${index}].sourceUnit`);
        const unit = entry.unit === undefined
            ? undefined
            : validateLandUnit(entry.unit, `${fieldName}[${index}].unit`);
        if (key === 'landValue' && (!sourceUnit || !unit)) {
            throw new ApiError(400, `${fieldName}[${index}] must preserve both sourceUnit and approved unit for land.`);
        }
        if (key !== 'landValue' && (sourceUnit !== undefined || unit !== undefined)) {
            throw new ApiError(400, `${fieldName}[${index}] units are only valid for landValue.`);
        }
        const valueChanged = sourceValue !== approvedValue;
        const unitChanged = sourceUnit !== unit;
        if (state === 'confirmed' && (valueChanged || unitChanged)) {
            throw new ApiError(400, `${fieldName}[${index}] must be marked corrected when source and approved values or units differ.`);
        }
        if (state === 'corrected' && !valueChanged && !unitChanged) {
            throw new ApiError(400, `${fieldName}[${index}] cannot be marked corrected without a changed approved value or unit.`);
        }
        return {
            key,
            sourceValue,
            approvedValue,
            ...(sourceUnit === undefined ? {} : { sourceUnit }),
            ...(unit === undefined ? {} : { unit }),
            provenance: requireString(entry.provenance, `${fieldName}[${index}].provenance`, 500),
            state: state as 'confirmed' | 'corrected',
        };
    });

    const approvedByKey: Record<(typeof REVIEWED_FACT_KEYS)[number], string | number | null> = {
        bedrooms: approvedFacts.bedrooms,
        bathrooms: approvedFacts.bathrooms,
        carSpaces: approvedFacts.carSpaces,
        landValue: approvedFacts.landValue,
        propertyType: approvedFacts.propertyType,
    };
    for (const entry of entries) {
        if (entry.approvedValue !== approvedByKey[entry.key]) {
            throw new ApiError(400, `${fieldName}.${entry.key}.approvedValue must match approvedFacts.`);
        }
        if (entry.key === 'landValue' && entry.unit !== approvedFacts.landUnit) {
            throw new ApiError(400, `${fieldName}.landValue.unit must match approvedFacts.landUnit.`);
        }
    }
    return entries;
};

const validateApprovedPhotoHighlight = (value: unknown, fieldName: string): ReviewedPhotoHighlight => {
    const highlight = requireObject(value, fieldName);
    const state = requireString(highlight.state, `${fieldName}.state`, 30);
    if (state !== 'approved' && state !== 'corrected') {
        throw new ApiError(400, `${fieldName}.state must be approved or corrected.`);
    }
    const imageNumber = highlight.imageNumber;
    if (typeof imageNumber !== 'number' || !Number.isInteger(imageNumber) || imageNumber < 1 || imageNumber > 100) {
        throw new ApiError(400, `${fieldName}.imageNumber is invalid.`);
    }
    return {
        id: requireStableId(highlight.id, `${fieldName}.id`),
        imageId: requireStableId(highlight.imageId, `${fieldName}.imageId`),
        imageNumber,
        sourceText: requireString(highlight.sourceText, `${fieldName}.sourceText`, 5000),
        approvedText: requireString(highlight.approvedText, `${fieldName}.approvedText`, 5000),
        state,
        provenance: requireString(highlight.provenance, `${fieldName}.provenance`, 500),
    };
};

const validateApprovedBriefSnapshot = (value: unknown): ApprovedBriefSnapshot => {
    const snapshot = requireObject(value, 'params.approvedBriefSnapshot');
    if (snapshot.schemaVersion !== 'copywriting-approved-brief.v2') {
        throw new ApiError(400, 'params.approvedBriefSnapshot.schemaVersion is invalid.');
    }
    const snapshotId = requireStableId(snapshot.snapshotId, 'params.approvedBriefSnapshot.snapshotId');
    const approvedAt = requireString(snapshot.approvedAt, 'params.approvedBriefSnapshot.approvedAt', 100);
    if (!Number.isFinite(Date.parse(approvedAt))) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.approvedAt must be a valid date-time.');
    }

    const product = requireString(snapshot.product, 'params.approvedBriefSnapshot.product', 30) as ApprovedBriefSnapshot['product'];
    if (product !== 'listing-copy' && product !== 'campaign-pack') {
        throw new ApiError(400, 'params.approvedBriefSnapshot.product is invalid.');
    }
    const listingGenerationSettings = requireObject(
        snapshot.listingGenerationSettings,
        'params.approvedBriefSnapshot.listingGenerationSettings'
    );
    const approximateWordCount = listingGenerationSettings.approximateWordCount;
    if (
        typeof approximateWordCount !== 'number'
        || !Number.isInteger(approximateWordCount)
        || approximateWordCount < 50
        || approximateWordCount > 1000
        || (approximateWordCount - 50) % 50 !== 0
    ) {
        throw new ApiError(
            400,
            'params.approvedBriefSnapshot.listingGenerationSettings.approximateWordCount must be from 50 to 1000 in steps of 50.'
        );
    }
    const profileInclusion = requireString(
        snapshot.profileInclusion,
        'params.approvedBriefSnapshot.profileInclusion',
        20,
    ) as ApprovedBriefSnapshot['profileInclusion'];
    if (!['none', 'suburb', 'area', 'both'].includes(profileInclusion)) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.profileInclusion is invalid.');
    }

    const approvedFacts = validateApprovedFacts(snapshot.approvedFacts, 'params.approvedBriefSnapshot.approvedFacts');
    const factProvenance = validateFactProvenance(
        snapshot.factProvenance,
        'params.approvedBriefSnapshot.factProvenance',
        approvedFacts
    );

    const claims = requireObject(snapshot.claims, 'params.approvedBriefSnapshot.claims');
    const confirmedClaims = validateReviewedClaims(claims.confirmed, 'params.approvedBriefSnapshot.claims.confirmed', 'confirmed');
    const correctedClaims = validateReviewedClaims(claims.corrected, 'params.approvedBriefSnapshot.claims.corrected', 'corrected');
    const claimIds = new Set(confirmedClaims.map(claim => claim.id));
    for (const claim of correctedClaims) {
        if (claimIds.has(claim.id)) throw new ApiError(400, `Approved claim id ${claim.id} is duplicated.`);
        claimIds.add(claim.id);
    }
    const excludedClaims = validateHardExcludedClaims(claims.excluded, 'params.approvedBriefSnapshot.claims.excluded');
    const hardExclusions = mergeHardExclusions(
        excludedClaims,
        validateHardExcludedClaims(snapshot.hardExclusions, 'params.approvedBriefSnapshot.hardExclusions')
    );
    for (const exclusion of hardExclusions) {
        if (claimIds.has(exclusion.id)) {
            throw new ApiError(400, `Claim ${exclusion.id} cannot be both approved and hard excluded.`);
        }
    }

    const agent = requireObject(snapshot.agentContext, 'params.approvedBriefSnapshot.agentContext');
    const inclusionMode = requireString(agent.inclusionMode, 'params.approvedBriefSnapshot.agentContext.inclusionMode', 20) as ApprovedBriefSnapshot['agentContext']['inclusionMode'];
    if (inclusionMode !== 'append' && inclusionMode !== 'integrate') {
        throw new ApiError(400, 'params.approvedBriefSnapshot.agentContext.inclusionMode is invalid.');
    }
    const agency = requireObject(snapshot.agencyContext, 'params.approvedBriefSnapshot.agencyContext');
    const openHome = requireObject(snapshot.openHomeContext, 'params.approvedBriefSnapshot.openHomeContext');
    const audience = requireObject(snapshot.audience, 'params.approvedBriefSnapshot.audience');
    const voice = requireObject(snapshot.voice, 'params.approvedBriefSnapshot.voice');

    const writingStyles = requireStringArray(voice.writingStyles, 'params.approvedBriefSnapshot.voice.writingStyles', 2, 100, 1);
    if (writingStyles.some(style => !WRITING_STYLES.includes(style as any))) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.voice.writingStyles contains an unsupported style.');
    }

    const photoContext = requireObject(snapshot.photoContext, 'params.approvedBriefSnapshot.photoContext');
    const photoPolicy = requireString(photoContext.policy, 'params.approvedBriefSnapshot.photoContext.policy', 20) as ApprovedBriefSnapshot['photoContext']['policy'];
    if (photoPolicy !== 'off' && photoPolicy !== 'included') {
        throw new ApiError(400, 'params.approvedBriefSnapshot.photoContext.policy is invalid.');
    }
    if (!Array.isArray(photoContext.selectedPhotos) || photoContext.selectedPhotos.length > 20) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.photoContext.selectedPhotos must contain no more than 20 photos.');
    }
    const selectedPhotos = photoContext.selectedPhotos.map((item: unknown, index: number) => {
        const photo = requireObject(item, `params.approvedBriefSnapshot.photoContext.selectedPhotos[${index}]`);
        const imageNumber = photo.imageNumber;
        if (typeof imageNumber !== 'number' || !Number.isInteger(imageNumber) || imageNumber < 1 || imageNumber > 100) {
            throw new ApiError(400, `params.approvedBriefSnapshot.photoContext.selectedPhotos[${index}].imageNumber is invalid.`);
        }
        return {
            id: requireStableId(photo.id, `params.approvedBriefSnapshot.photoContext.selectedPhotos[${index}].id`),
            name: requireString(photo.name, `params.approvedBriefSnapshot.photoContext.selectedPhotos[${index}].name`, 500),
            imageNumber,
        };
    });
    const selectedPhotoIds = new Set(selectedPhotos.map(photo => photo.id));
    const selectedPhotoNumbers = new Map(selectedPhotos.map(photo => [photo.id, photo.imageNumber]));
    if (selectedPhotoIds.size !== selectedPhotos.length) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.photoContext.selectedPhotos contains duplicate ids.');
    }
    if (!Array.isArray(photoContext.approvedHighlights) || photoContext.approvedHighlights.length > 200) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.photoContext.approvedHighlights must contain no more than 200 highlights.');
    }
    const approvedHighlights = photoContext.approvedHighlights.map((item: unknown, index: number) => (
        validateApprovedPhotoHighlight(item, `params.approvedBriefSnapshot.photoContext.approvedHighlights[${index}]`)
    ));
    const highlightIds = new Set<string>();
    for (const highlight of approvedHighlights) {
        if (highlightIds.has(highlight.id)) {
            throw new ApiError(400, `params.approvedBriefSnapshot.photoContext.approvedHighlights contains duplicate id ${highlight.id}.`);
        }
        highlightIds.add(highlight.id);
        if (!selectedPhotoIds.has(highlight.imageId)) {
            throw new ApiError(400, `Approved photo highlight ${highlight.id} is not linked to a selected photo.`);
        }
        if (selectedPhotoNumbers.get(highlight.imageId) !== highlight.imageNumber) {
            throw new ApiError(400, `Approved photo highlight ${highlight.id} has an inconsistent image number.`);
        }
    }
    if (photoPolicy === 'off' && (selectedPhotos.length > 0 || approvedHighlights.length > 0)) {
        throw new ApiError(400, 'Photo context marked off must not include selected photos or approved highlights.');
    }
    if (photoPolicy === 'included') {
        if (selectedPhotos.length === 0) {
            throw new ApiError(400, 'Included photo context requires at least one selected photo.');
        }
        for (const photo of selectedPhotos) {
            if (!approvedHighlights.some(highlight => highlight.imageId === photo.id)) {
                throw new ApiError(400, `Selected photo ${photo.imageNumber} requires an approved highlight.`);
            }
        }
    }

    const approval = requireObject(snapshot.humanApproval, 'params.approvedBriefSnapshot.humanApproval');
    if (approval.approved !== true) {
        throw new ApiError(400, 'params.approvedBriefSnapshot must be human-approved before generation.');
    }

    const validatedSnapshot: ApprovedBriefSnapshot = {
        schemaVersion: 'copywriting-approved-brief.v2',
        snapshotId,
        approvedAt,
        selectedAddress: requireString(snapshot.selectedAddress, 'params.approvedBriefSnapshot.selectedAddress', 500),
        includeAddressInCopy: requireBoolean(snapshot.includeAddressInCopy, 'params.approvedBriefSnapshot.includeAddressInCopy'),
        product,
        listingGenerationSettings: {
            approximateWordCount,
        },
        approvedFacts,
        factProvenance,
        propertyOverview: requireString(snapshot.propertyOverview, 'params.approvedBriefSnapshot.propertyOverview', 20000, 0),
        suburbContext: requireString(snapshot.suburbContext, 'params.approvedBriefSnapshot.suburbContext', 20000, 0),
        areaContext: requireString(snapshot.areaContext, 'params.approvedBriefSnapshot.areaContext', 20000, 0),
        profileInclusion,
        claims: {
            confirmed: confirmedClaims,
            corrected: correctedClaims,
            excluded: hardExclusions,
        },
        agentContext: {
            included: requireBoolean(agent.included, 'params.approvedBriefSnapshot.agentContext.included'),
            name: requireString(agent.name, 'params.approvedBriefSnapshot.agentContext.name', 200, 0),
            title: requireString(agent.title, 'params.approvedBriefSnapshot.agentContext.title', 200, 0),
            phone: requireString(agent.phone, 'params.approvedBriefSnapshot.agentContext.phone', 80, 0),
            email: requireString(agent.email, 'params.approvedBriefSnapshot.agentContext.email', 200, 0),
            inclusionMode,
        },
        agencyContext: {
            included: requireBoolean(agency.included, 'params.approvedBriefSnapshot.agencyContext.included'),
            name: requireString(agency.name, 'params.approvedBriefSnapshot.agencyContext.name', 200, 0),
        },
        openHomeContext: {
            included: requireBoolean(openHome.included, 'params.approvedBriefSnapshot.openHomeContext.included'),
            date: requireString(openHome.date, 'params.approvedBriefSnapshot.openHomeContext.date', 200, 0),
            time: requireString(openHome.time, 'params.approvedBriefSnapshot.openHomeContext.time', 200, 0),
            url: requireString(openHome.url, 'params.approvedBriefSnapshot.openHomeContext.url', 1000, 0),
        },
        audience: {
            primary: requireString(audience.primary, 'params.approvedBriefSnapshot.audience.primary', 100),
            secondary: requireString(audience.secondary, 'params.approvedBriefSnapshot.audience.secondary', 100, 0),
        },
        voice: {
            writingStyles,
            tone: requireString(voice.tone, 'params.approvedBriefSnapshot.voice.tone', 500),
        },
        campaignEmphasis: requireStringArray(snapshot.campaignEmphasis, 'params.approvedBriefSnapshot.campaignEmphasis', 100, 5000),
        styleAvoidances: requireStringArray(snapshot.styleAvoidances, 'params.approvedBriefSnapshot.styleAvoidances', 100, 5000),
        hardExclusions,
        photoContext: {
            policy: photoPolicy,
            selectedPhotos,
            approvedHighlights,
        },
        humanApproval: {
            approved: true,
            statement: requireString(approval.statement, 'params.approvedBriefSnapshot.humanApproval.statement', 2000),
        },
    };
    if (validatedSnapshot.agentContext.included && !validatedSnapshot.agentContext.name) {
        throw new ApiError(400, 'Included agent context requires an approved agent name.');
    }
    if (validatedSnapshot.agencyContext.included && !validatedSnapshot.agencyContext.name) {
        throw new ApiError(400, 'Included agency context requires an approved agency name.');
    }
    const suburbIncluded = profileInclusion === 'suburb' || profileInclusion === 'both';
    const areaIncluded = profileInclusion === 'area' || profileInclusion === 'both';
    if (suburbIncluded !== Boolean(validatedSnapshot.suburbContext)) {
        throw new ApiError(400, 'Approved suburb context must exactly match the selected location inclusion policy.');
    }
    if (areaIncluded !== Boolean(validatedSnapshot.areaContext)) {
        throw new ApiError(400, 'Approved area context must exactly match the selected location inclusion policy.');
    }
    const lowerAuthorityGovernance = {
        factProvenance: validatedSnapshot.factProvenance,
        hardExclusions: validatedSnapshot.hardExclusions,
    };
    for (const [fieldName, context] of [
        ['propertyOverview', validatedSnapshot.propertyOverview],
        ['suburbContext', validatedSnapshot.suburbContext],
        ['areaContext', validatedSnapshot.areaContext],
    ] as const) {
        const governedContext = sanitizeCorrectedClaimContext(
            sanitizeLowerAuthorityText(context, lowerAuthorityGovernance).text,
            validatedSnapshot.claims.corrected,
        );
        if (governedContext !== context) {
            throw new ApiError(400, `params.approvedBriefSnapshot.${fieldName} contains superseded or excluded lower-authority context.`);
        }
    }
    // This deterministic dependency marker detects a payload/ID mismatch. It
    // complements the beta gate; it is not an authentication signature.
    const expectedSnapshotId = computeApprovedBriefSnapshotId(validatedSnapshot);
    if (snapshotId !== expectedSnapshotId) {
        throw new ApiError(400, 'params.approvedBriefSnapshot.snapshotId does not match the approved brief content.');
    }
    return validatedSnapshot;
};

const getCanonicalProfileInclusion = (snapshot: ApprovedBriefSnapshot): GenerationParams['profileInclusion'] => {
    return snapshot.profileInclusion;
};

const validateGenerationParams = (value: unknown): GenerationParams => {
    const params = requireObject(value, 'params');
    const output = requireObject(params.output, 'params.output');
    const agentProfile = requireObject(params.agentProfile, 'params.agentProfile');
    const openHouse = requireObject(params.openHouse, 'params.openHouse');
    const profileData = params.profileData === null || params.profileData === undefined ? null : requireObject(params.profileData, 'params.profileData');
    const inclusion = requireString(params.profileInclusion, 'params.profileInclusion', 20) as GenerationParams['profileInclusion'];
    if (!['none', 'suburb', 'area', 'both'].includes(inclusion)) {
        throw new ApiError(400, 'params.profileInclusion is invalid.');
    }

    const inclusionMode = requireString(agentProfile.inclusionMode, 'params.agentProfile.inclusionMode', 20) as 'append' | 'integrate';
    if (!['append', 'integrate'].includes(inclusionMode)) {
        throw new ApiError(400, 'params.agentProfile.inclusionMode is invalid.');
    }

    const legacyWordCount = Number(output.wordCount);
    if (!Number.isFinite(legacyWordCount) || legacyWordCount < 50 || legacyWordCount > 1000) {
        throw new ApiError(400, 'params.output.wordCount must be between 50 and 1000.');
    }

    // Validate the legacy fields for shape/size, then deliberately replace their
    // factual content with the approved snapshot. This prevents fetched prose,
    // inferred features, or earlier photo analysis from outranking human review.
    requireString(params.address, 'params.address', 500, 0);
    requireBoolean(params.includeAddress, 'params.includeAddress');
    validatePropertyDetails(params.details);
    validateCopyContext(params.context);
    optionalString(params.features, 'params.features', 20000);
    optionalString(params.imageAnalysis, 'params.imageAnalysis', 50000);
    optionalString(params.researchData, 'params.researchData', 80000);
    if (profileData) {
        optionalString(profileData.suburb, 'params.profileData.suburb', 50000);
        optionalString(profileData.area, 'params.profileData.area', 50000);
    }
    optionalString(agentProfile.name, 'params.agentProfile.name', 200);
    optionalString(agentProfile.agency, 'params.agentProfile.agency', 200);
    optionalString(agentProfile.phone, 'params.agentProfile.phone', 80);
    optionalString(agentProfile.email, 'params.agentProfile.email', 200);
    optionalString(openHouse.date, 'params.openHouse.date', 200);
    optionalString(openHouse.time, 'params.openHouse.time', 200);
    optionalString(openHouse.url, 'params.openHouse.url', 1000);

    const approvedBriefSnapshot = validateApprovedBriefSnapshot(params.approvedBriefSnapshot);
    const approvedClaims = [
        ...approvedBriefSnapshot.claims.confirmed,
        ...approvedBriefSnapshot.claims.corrected,
    ].map(claim => claim.approvedText);
    const approvedFeatures = Array.from(new Set([
        ...approvedBriefSnapshot.campaignEmphasis,
        ...approvedClaims,
    ])).join('\n');
    const approvedPhotoContext = approvedBriefSnapshot.photoContext.policy === 'included'
        ? approvedBriefSnapshot.photoContext.approvedHighlights.map(highlight => highlight.approvedText).join('\n') || null
        : null;
    const canonicalProfileInclusion = getCanonicalProfileInclusion(approvedBriefSnapshot);

    return {
        address: approvedBriefSnapshot.selectedAddress,
        includeAddress: approvedBriefSnapshot.includeAddressInCopy,
        details: {
            beds: approvedBriefSnapshot.approvedFacts.bedrooms,
            baths: approvedBriefSnapshot.approvedFacts.bathrooms,
            cars: approvedBriefSnapshot.approvedFacts.carSpaces,
            landSize: approvedBriefSnapshot.approvedFacts.landValue,
            propertyType: approvedBriefSnapshot.approvedFacts.propertyType,
        },
        context: {
            primaryTargetMarket: approvedBriefSnapshot.audience.primary,
            secondaryTargetMarket: approvedBriefSnapshot.audience.secondary,
            writingStyle: approvedBriefSnapshot.voice.writingStyles,
            featuresToHighlight: approvedBriefSnapshot.campaignEmphasis.join('\n'),
            thingsToAvoid: approvedBriefSnapshot.styleAvoidances.join('\n'),
        },
        features: approvedFeatures,
        // The legacy output field remains shape-validated for compatibility, but
        // the human-approved snapshot is the sole authority for Listing length.
        output: { wordCount: approvedBriefSnapshot.listingGenerationSettings.approximateWordCount },
        imageAnalysis: approvedPhotoContext,
        researchData: approvedBriefSnapshot.propertyOverview || null,
        profileData: canonicalProfileInclusion === 'none' ? null : {
            suburb: approvedBriefSnapshot.suburbContext,
            area: approvedBriefSnapshot.areaContext,
        },
        profileInclusion: canonicalProfileInclusion,
        agentProfile: {
            name: approvedBriefSnapshot.agentContext.included ? approvedBriefSnapshot.agentContext.name : '',
            agency: approvedBriefSnapshot.agencyContext.included ? approvedBriefSnapshot.agencyContext.name : '',
            phone: approvedBriefSnapshot.agentContext.included ? approvedBriefSnapshot.agentContext.phone : '',
            email: approvedBriefSnapshot.agentContext.included ? approvedBriefSnapshot.agentContext.email : '',
            inclusionMode: approvedBriefSnapshot.agentContext.inclusionMode,
        },
        openHouse: {
            date: approvedBriefSnapshot.openHomeContext.included ? approvedBriefSnapshot.openHomeContext.date : '',
            time: approvedBriefSnapshot.openHomeContext.included ? approvedBriefSnapshot.openHomeContext.time : '',
            url: approvedBriefSnapshot.openHomeContext.included ? approvedBriefSnapshot.openHomeContext.url : '',
        },
        approvedBriefSnapshot,
    };
};

const getClientIp = (req: any): string => {
    const forwarded = req.headers?.['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
        return forwarded.split(',')[0].trim();
    }
    return req.socket?.remoteAddress || 'unknown';
};

const signBetaSession = (expiresAt: number, nonce: string, requiredCode: string): string => {
    return createHmac('sha256', requiredCode)
        .update(`${expiresAt}.${nonce}`)
        .digest('base64url');
};

const createBetaSessionToken = (requiredCode: string): string => {
    const expiresAt = Date.now() + BETA_SESSION_TTL_MS;
    const nonce = randomBytes(16).toString('base64url');
    const signature = signBetaSession(expiresAt, nonce, requiredCode);
    return `${expiresAt}.${nonce}.${signature}`;
};

const isValidBetaSessionToken = (credential: string, requiredCode: string): boolean => {
    const parts = credential.split('.');
    if (parts.length !== 3) return false;

    const [expiresAtText, nonce, signature] = parts;
    const expiresAt = Number(expiresAtText);
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now() || !nonce || !signature) return false;

    const expected = signBetaSession(expiresAt, nonce, requiredCode);
    const providedBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    return providedBuffer.length === expectedBuffer.length && timingSafeEqual(providedBuffer, expectedBuffer);
};

const enforceBetaAccess = (req: any): void => {
    const validCodes = getConfiguredBetaAccessCodes();
    if (validCodes.length === 0) return;

    const providedCode = req.headers?.['x-beta-access-code'];
    if (
        typeof providedCode !== 'string' ||
        !validCodes.some(validCode => providedCode === validCode || isValidBetaSessionToken(providedCode, validCode))
    ) {
        throw new ApiError(401, 'Valid beta access code is required.');
    }
};

const verifyBetaAccess = (req: any): { ok: true; token: string | null } => {
    const validCodes = getConfiguredBetaAccessCodes();
    if (validCodes.length === 0) return { ok: true, token: null };

    const providedCode = req.headers?.['x-beta-access-code'];
    const matchedCode = typeof providedCode === 'string'
        ? validCodes.find(validCode => providedCode === validCode)
        : undefined;
    if (!matchedCode) {
        throw new ApiError(401, 'Valid beta access code is required.');
    }

    return { ok: true, token: createBetaSessionToken(matchedCode) };
};

const enforceThrottle = (req: any): void => {
    const now = Date.now();
    const betaCode = typeof req.headers?.['x-beta-access-code'] === 'string' ? req.headers['x-beta-access-code'] : '';
    const key = betaCode ? `beta:${betaCode}` : `ip:${getClientIp(req)}`;

    for (const [storeKey, bucket] of throttleStore.entries()) {
        if (now - bucket.windowStart > RATE_WINDOW_MS) throttleStore.delete(storeKey);
    }

    const bucket = throttleStore.get(key);
    if (!bucket || now - bucket.windowStart > RATE_WINDOW_MS) {
        throttleStore.set(key, { windowStart: now, count: 1 });
        return;
    }
    bucket.count += 1;
    if (bucket.count > RATE_LIMIT) {
        throw new ApiError(429, 'Too many copywriting requests. Please wait and try again.');
    }
};

const sendJson = (res: any, statusCode: number, body: unknown): void => {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
};

const suggestAddresses = async (payload: Record<string, any>): Promise<ServiceResponse<string[]>> => {
    const query = requireString(payload.query, 'query', 300, 3);
    optionalLocation(payload.userLocation);

    const prompt = `List 5 real-world Australian street addresses that match or are similar to the partial search: "${query}".
    Return strictly as a plain text list, one address per line. No headers, no intro text, no formatting.`;

    const model = resolveModelForOperation('suggestAddresses');
    if (!model) throw new ApiError(500, 'No model configured for address suggestions.');

    const request: any = {
        model,
        contents: prompt,
        config: {
            tools: [{ googleSearch: {} }]
        },
    };

    try {
        const response: GenerateContentResponse = await getAiClient().models.generateContent(request);
        if (!response.text) {
            return { data: [], usage: extractUsage(response, model, 'suggestAddresses') };
        }

        return {
            data: response.text.split('\n')
            .map(line => line.replace(/^\s*(\d+\.|\*|\-|\u2022)\s*/, '').replace(/\[\d+\]/g, '').trim())
            .filter(line => line.length > 5 && /\d/.test(line)),
            usage: extractUsage(response, model, 'suggestAddresses')
        };
    } catch (e: any) {
        console.error('Suggest addresses error:', e?.message || e);
        return { data: [], usage: undefined };
    }
};

const researchProperty = async (payload: Record<string, any>): Promise<ServiceResponse<ResearchResult>> => {
    const address = requireString(payload.address, 'address', 500);
    optionalLocation(payload.userLocation);

    const prompt = `Research assistant for Australian real estate: "${address}".
    TASK: Provide a comprehensive and highly detailed research report.

    EXPECTED JSON FIELDS:
    - summary: A very long, descriptive, multi-paragraph narrative overview (approx 300-500 words). Describe the property's layout, architectural style, land quality, and lifestyle potential in depth. Do not use em-dashes.
    - keyFeatures: Detailed bulleted list of physical features.
    - suburbProfile: A very long, detailed narrative description (approx 300 words) of the suburb. Include lifestyle, demographics, local landmarks, public transport, and school quality. Synthesize the grounding data into human-readable prose. DO NOT return raw JSON objects or technical data structures.
    - regionalProfile: A detailed narrative description (approx 200 words) of the broader region, its economic drivers, and local geography.
    - specs: {beds, baths, cars, landSize, propertyType, priceGuide, lastSold}. YOU MUST provide numeric values for counts where possible. If a spec is not found, use null, but do not omit the keys.

    CRITICAL:
    - The output for "summary", "suburbProfile" and "regionalProfile" MUST be purely narrative text.
    - Ensure the descriptions are rich, sophisticated, and geared towards real estate marketing.
    - NO em-dashes.
    - Return strictly as valid JSON.`;

    const model = resolveModelForOperation('researchProperty');
    if (!model) throw new ApiError(500, 'No model configured for property research.');

    const request: GenerateContentParameters = {
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }] },
    };

    try {
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent(request));
        const firstUsage = extractUsage(response, model, 'researchProperty');
        let responseText = response.text;
        let data: Omit<ResearchResult, 'fullText' | 'sources'>;
        let usage = firstUsage;

        try {
            data = parseResearchPropertyText(responseText);
        } catch (parseError: any) {
            const repairPrompt = `The previous property research response was not valid for the app.

Validation error: ${parseError?.message || 'Invalid JSON shape.'}

Repair the response using the original task and source context below. Return only valid JSON with this exact shape:
{
  "summary": "multi-paragraph narrative text",
  "keyFeatures": "detailed bullet list text or array of strings",
  "suburbProfile": "narrative text",
  "regionalProfile": "narrative text",
  "specs": {
    "beds": number or null,
    "baths": number or null,
    "cars": number or null,
    "landSize": number or null,
    "propertyType": "string",
    "priceGuide": "string or null",
    "lastSold": "string or null"
  }
}

Original task:
${prompt}

Invalid response:
${responseText || '[empty response]'}`;

            try {
                const repairResponse: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
                    model,
                    contents: repairPrompt,
                    config: { responseMimeType: 'application/json' }
                }), 1);
                data = parseResearchPropertyText(repairResponse.text);
                responseText = repairResponse.text || responseText;
                usage = aggregateServerUsage('researchProperty', [firstUsage, extractUsage(repairResponse, model, 'researchProperty')], model);
            } catch (repairError: any) {
                throw new Error(`The AI research response could not be repaired into valid JSON. ${repairError?.message || 'Please retry Fetch Details.'}`);
            }
        }

        const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
        const sources: GroundingSource[] = groundingChunks
            ? groundingChunks.flatMap(c => c.web ? [{ uri: c.web.uri, title: c.web.title, type: 'web' as const }] : [])
            : [];

        return {
            data: {
                fullText: responseText || '',
                summary: data.summary,
                keyFeatures: data.keyFeatures,
                suburbProfile: data.suburbProfile,
                regionalProfile: data.regionalProfile,
                specs: data.specs,
                sources
            },
            usage
        };
    } catch (e: any) {
        console.error('Research property error:', e?.message || e);
        throw new Error(`Research failed: ${e instanceof Error ? e.message : 'Unknown error during research'}`);
    }
};

const validateSuggestionGovernanceContext = (value: unknown): SuggestionGovernanceContext | undefined => {
    if (value === undefined || value === null) return undefined;
    const context = requireObject(value, 'governanceContext');
    const approvedFacts = validateApprovedFacts(context.approvedFacts, 'governanceContext.approvedFacts');
    const photoContextPolicy = requireString(context.photoContextPolicy, 'governanceContext.photoContextPolicy', 20) as SuggestionGovernanceContext['photoContextPolicy'];
    if (photoContextPolicy !== 'off' && photoContextPolicy !== 'included') {
        throw new ApiError(400, 'governanceContext.photoContextPolicy is invalid.');
    }
    return {
        approvedFacts,
        factProvenance: validateFactProvenance(context.factProvenance, 'governanceContext.factProvenance', approvedFacts),
        hardExclusions: validateHardExcludedClaims(context.hardExclusions, 'governanceContext.hardExclusions'),
        photoContextPolicy,
    };
};

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const flexiblePhrasePattern = (value: string): string => (
    value
        .trim()
        .split(/[\s-]+/)
        .map(part => escapeRegExp(part))
        .join('[\\s-]+')
);

const boundedFlexiblePhraseRegExp = (value: string, flags = 'gi'): RegExp => (
    new RegExp(`(?<![A-Za-z0-9])${flexiblePhrasePattern(value)}(?![A-Za-z0-9])`, flags)
);

const sanitiseLowerAuthorityText = (
    value: string | null,
    governance: SuggestionGovernanceContext | undefined
): string | null => {
    if (!value || !governance) return value;
    return sanitizeLowerAuthorityText(value, governance).text;
};

const containsGovernanceConflict = (value: string, governance: SuggestionGovernanceContext): boolean => {
    return findGovernanceConflicts(value, governance).length > 0;
};

const filterGovernedSuggestionText = (value: string, governance: SuggestionGovernanceContext | undefined): string => {
    if (!governance || !value) return value;
    return splitGovernanceListItems(value)
        .map(item => item.trim())
        .filter(item => item && !containsGovernanceConflict(item, governance))
        .join(', ');
};

const describeCorrectedFactSemantics = (
    entry: ApprovedBriefSnapshot['factProvenance'][number]
): { semanticChange: 'representation-only' | 'substantive-correction'; rule: string } => {
    const equivalentLandRepresentation = entry.key === 'landValue'
        && typeof entry.sourceValue === 'number'
        && typeof entry.approvedValue === 'number'
        && Boolean(entry.sourceUnit)
        && Boolean(entry.unit)
        && areLandMeasurementsEquivalent(
            { value: entry.sourceValue as number, unit: entry.sourceUnit! },
            { value: entry.approvedValue as number, unit: entry.unit! },
        );
    return equivalentLandRepresentation
        ? {
            semanticChange: 'representation-only',
            rule: 'Source and approved land measurements are equivalent representations. Prefer the approved display, but do not treat an equivalent unit conversion as contradictory.',
        }
        : {
            semanticChange: 'substantive-correction',
            rule: 'This is the human-corrected value. Conflicting source meaning must not be used.',
        };
};

const buildSuggestionGovernanceContract = (governance: SuggestionGovernanceContext | undefined): string => {
    if (!governance) return 'No approved governance context was supplied.';
    return JSON.stringify({
        approvedFacts: governance.approvedFacts,
        correctedFacts: governance.factProvenance
            .filter(entry => entry.state === 'corrected')
            .map(entry => ({
                key: entry.key,
                sourceValue: entry.sourceValue,
                approvedValue: entry.approvedValue,
                sourceUnit: entry.sourceUnit,
                unit: entry.unit,
                ...describeCorrectedFactSemantics(entry),
            })),
        hardExclusions: governance.hardExclusions.map(claim => ({
            id: claim.id,
            text: claim.text,
            aliases: claim.aliases,
        })),
        photoContextPolicy: governance.photoContextPolicy,
    }, null, 2);
};

const analyzeStrategy = async (payload: Record<string, any>): Promise<ServiceResponse<StrategyAnalysisResult>> => {
    const researchData = requireString(payload.researchData, 'researchData', 80000);
    const profileData = optionalString(payload.profileData, 'profileData', 80000);
    const imageAnalysis = optionalString(payload.imageAnalysis, 'imageAnalysis', 50000);
    const governance = validateSuggestionGovernanceContext(payload.governanceContext);
    const governedResearchData = sanitiseLowerAuthorityText(researchData, governance);
    const governedProfileData = sanitiseLowerAuthorityText(profileData, governance);
    const governedImageAnalysis = governance?.photoContextPolicy === 'off'
        ? null
        : sanitiseLowerAuthorityText(imageAnalysis, governance);
    const prompt = `Analyze the lower-authority source context using the approved governance contract below.
    Approved governance contract (authoritative):
    ${buildSuggestionGovernanceContract(governance)}
    Sanitised source context:
    Research: ${governedResearchData}
    Profile: ${governedProfileData}
    Photo analysis: ${governedImageAnalysis ?? 'Not included by the approved photo policy'}.
    Governance rules: corrected approved facts replace source values; never propose a hard-excluded claim or alias; when photo context is off, do not infer from photo analysis. Hard exclusions are factual boundaries and must not be returned as style advice.
    Return JSON: primaryTargetMarket, secondaryTargetMarket, writingStyles, featuresToHighlight, thingsToAvoid.
    IMPORTANT: Pick EXACTLY 1 or 2 writing styles from this list: ${JSON.stringify(WRITING_STYLES)}. DO NOT pick more than 2.
    Markets: ${JSON.stringify(TARGET_MARKETS)}.
    featuresToHighlight and thingsToAvoid may be strings or arrays of strings.
    Return strictly valid JSON only.`;
    try {
        const model = resolveModelForOperation('analyzeStrategy');
        if (!model) throw new ApiError(500, 'No model configured for strategy analysis.');

        const request: GenerateContentParameters = {
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        };
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent(request));
        const firstUsage = extractUsage(response, model, 'analyzeStrategy');

        let analysis: StrategyAnalysisResult;
        let usage = firstUsage;
        try {
            analysis = parseStrategyAnalysisText(response.text);
        } catch (parseError: any) {
            const repairPrompt = `The previous AI Strategy Analysis response was invalid.

Validation error: ${parseError?.message || 'Invalid JSON shape.'}

Repair the response using the original task and source context below. Return only valid JSON with this exact shape:
{
  "primaryTargetMarket": one of ${JSON.stringify(TARGET_MARKETS)},
  "secondaryTargetMarket": one of ${JSON.stringify(TARGET_MARKETS)} or null,
  "writingStyles": one or two values from ${JSON.stringify(WRITING_STYLES)},
  "featuresToHighlight": "plain text or array of strings",
  "thingsToAvoid": "plain text or array of strings"
}

Original task:
${prompt}

Invalid response:
${response.text || '[empty response]'}`;

            const repairResponse: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
                model,
                contents: repairPrompt,
                config: { responseMimeType: 'application/json' }
            }), 1);
            analysis = parseStrategyAnalysisText(repairResponse.text);
            usage = aggregateServerUsage('analyzeStrategy', [firstUsage, extractUsage(repairResponse, model, 'analyzeStrategy')], model);
        }

        analysis = {
            ...analysis,
            featuresToHighlight: filterGovernedSuggestionText(analysis.featuresToHighlight, governance),
            thingsToAvoid: filterGovernedSuggestionText(analysis.thingsToAvoid, governance),
        };

        return {
            data: analysis,
            usage
        };
    } catch (e: any) {
        console.error('Strategy analysis error:', e?.message || e);
        throw new Error(`Strategy analysis failed: ${e instanceof Error ? e.message : 'The AI response could not be validated.'}`);
    }
};

const analyzeFeatures = async (payload: Record<string, any>): Promise<ServiceResponse<{ propertyFeatures: string; }>> => {
    const researchData = requireString(payload.researchData, 'researchData', 80000);
    const profileData = optionalString(payload.profileData, 'profileData', 80000);
    const imageAnalysis = optionalString(payload.imageAnalysis, 'imageAnalysis', 50000);
    const governance = validateSuggestionGovernanceContext(payload.governanceContext);
    const governedImageAnalysis = governance?.photoContextPolicy === 'off'
        ? null
        : sanitiseLowerAuthorityText(imageAnalysis, governance);
    const prompt = `Extract features as JSON { propertyFeatures: [string] }.
Approved governance contract (authoritative):
${buildSuggestionGovernanceContract(governance)}
Sanitised lower-authority context:
Research: ${sanitiseLowerAuthorityText(researchData, governance)}
Profile: ${sanitiseLowerAuthorityText(profileData, governance)}
Photo analysis: ${governedImageAnalysis ?? 'Not included by the approved photo policy'}.
Rules: corrected approved facts replace source values; omit every hard-excluded claim and alias; when photo context is off, do not infer any feature from photo analysis. Return only features that can enter human review.`;
    try {
        const model = resolveModelForOperation('analyzeFeatures');
        if (!model) throw new ApiError(500, 'No model configured for feature extraction.');
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
            model,
            contents: prompt,
            config: { responseMimeType: 'application/json' }
        }));
        const result = JSON.parse(response.text || '{}');
        return {
            data: {
                propertyFeatures: filterGovernedSuggestionText(
                    formatAIResponseList(result.propertyFeatures, '\n'),
                    governance
                ).replace(/, /g, '\n')
            },
            usage: extractUsage(response, model, 'analyzeFeatures')
        };
    } catch (e: any) {
        console.error('Feature analysis error:', e?.message || e);
        throw new Error('Feature analysis failed.');
    }
};

const analyzeSingleImage = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    const image = validateImage(payload.image, 'image');
    const prompt = `Analyze this real estate property photo for copywriting.
Return only this structure:
Summary: one concise sentence naming the visible selling point.
Details:
- 2 to 4 concise bullet points about visible features, buyer appeal, lifestyle positioning, or copy relevance.

Rules:
- Do not begin with generic phrases like "Based on the image" or "The image shows".
- Mention only visible or strongly implied details.
- Keep the language specific, scannable and useful for property marketing copy.`;
    try {
        const model = resolveModelForOperation('analyzeSingleImage');
        if (!model) throw new ApiError(500, 'No model configured for image analysis.');
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
            model,
            contents: { parts: [{ inlineData: { mimeType: image.mimeType, data: image.base64 } }, { text: prompt }] }
        }));
        return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'analyzeSingleImage') };
    } catch (e: any) {
        console.error('Single image analysis error:', e?.message || e);
        throw new Error('Image analysis failed.');
    }
};

const getSnapshotGovernanceContext = (snapshot: ApprovedBriefSnapshot): SuggestionGovernanceContext => ({
    approvedFacts: snapshot.approvedFacts,
    factProvenance: snapshot.factProvenance,
    hardExclusions: snapshot.hardExclusions,
    photoContextPolicy: snapshot.photoContext.policy,
});

const sanitiseBaseCopyForSnapshot = (baseCopy: string, snapshot: ApprovedBriefSnapshot): string => {
    let sanitised = sanitiseLowerAuthorityText(baseCopy, getSnapshotGovernanceContext(snapshot)) || '';
    const contextToOmit = [
        ...(!snapshot.includeAddressInCopy ? [snapshot.selectedAddress] : []),
        ...(!snapshot.agentContext.included ? [
            snapshot.agentContext.name,
            snapshot.agentContext.title,
            snapshot.agentContext.phone,
            snapshot.agentContext.email,
        ] : []),
        ...(!snapshot.agencyContext.included ? [snapshot.agencyContext.name] : []),
        ...(!snapshot.openHomeContext.included ? [
            snapshot.openHomeContext.date,
            snapshot.openHomeContext.time,
            snapshot.openHomeContext.url,
        ] : []),
    ].filter(value => value.trim().length > 0);
    for (const value of contextToOmit) {
        sanitised = sanitised.replace(boundedFlexiblePhraseRegExp(value), '[context omitted by approved brief]');
    }
    const approvedClaimPlaceholders = snapshot.claims.corrected.map((claim, index) => ({
        claim,
        token: `\uE000approved-claim-${index}\uE001`,
    }));

    for (const { claim, token } of approvedClaimPlaceholders) {
        sanitised = sanitised.replace(boundedFlexiblePhraseRegExp(claim.approvedText), token);
    }
    for (const { claim } of approvedClaimPlaceholders) {
        const supersededPhrases = Array.from(new Set([claim.sourceText, ...claim.aliases]))
            .filter(phrase => phrase.trim() && phrase.trim().toLocaleLowerCase() !== claim.approvedText.trim().toLocaleLowerCase());
        for (const phrase of supersededPhrases) {
            sanitised = sanitised.replace(boundedFlexiblePhraseRegExp(phrase), claim.approvedText);
        }
    }
    for (const { claim, token } of approvedClaimPlaceholders) {
        sanitised = sanitised.replaceAll(token, claim.approvedText);
    }
    return sanitised;
};

const buildApprovedGenerationContract = (snapshot: ApprovedBriefSnapshot): string => JSON.stringify({
    schemaVersion: snapshot.schemaVersion,
    snapshotId: snapshot.snapshotId,
    approvedAt: snapshot.approvedAt,
    product: snapshot.product,
    bindingRule: 'The output must be generated only against this exact approved snapshot ID.',
    property: {
        selectedAddress: snapshot.includeAddressInCopy ? snapshot.selectedAddress : null,
        includeAddressInCopy: snapshot.includeAddressInCopy,
        addressRule: snapshot.includeAddressInCopy
            ? 'The selected address may be used in copy.'
            : 'Do not state or imply the selected address in copy.',
        approvedFacts: snapshot.approvedFacts,
        correctedFacts: snapshot.factProvenance
            .filter(entry => entry.state === 'corrected')
            .map(entry => ({
                key: entry.key,
                sourceValue: entry.sourceValue,
                approvedValue: entry.approvedValue,
                sourceUnit: entry.sourceUnit,
                unit: entry.unit,
                ...describeCorrectedFactSemantics(entry),
            })),
        propertyOverview: snapshot.propertyOverview,
        profileInclusion: snapshot.profileInclusion,
        suburbContext: snapshot.suburbContext,
        areaContext: snapshot.areaContext,
        confirmedClaims: snapshot.claims.confirmed.map(claim => ({
            id: claim.id,
            text: claim.approvedText,
            provenance: claim.provenance,
        })),
        correctedClaims: snapshot.claims.corrected.map(claim => ({
            id: claim.id,
            approvedText: claim.approvedText,
            provenance: claim.provenance,
            rule: 'This human-corrected claim replaces every earlier wording for the same claim.',
        })),
    },
    campaign: {
        audience: snapshot.audience,
        voice: snapshot.voice,
        approvedEmphasis: snapshot.campaignEmphasis,
        advisoryStyleAvoidances: snapshot.styleAvoidances,
    },
    hardExclusions: snapshot.hardExclusions.map(claim => ({
        id: claim.id,
        text: claim.text,
        aliases: claim.aliases,
        rule: 'Never state, imply, paraphrase, or reintroduce this claim.',
    })),
    agentContext: snapshot.agentContext.included
        ? snapshot.agentContext
        : { included: false },
    agencyContext: snapshot.agencyContext.included
        ? snapshot.agencyContext
        : { included: false },
    openHomeContext: snapshot.openHomeContext.included
        ? snapshot.openHomeContext
        : { included: false },
    photoContext: {
        policy: snapshot.photoContext.policy,
        approvedHighlights: snapshot.photoContext.policy === 'included'
            ? snapshot.photoContext.approvedHighlights.map(highlight => ({
                id: highlight.id,
                imageId: highlight.imageId,
                imageNumber: highlight.imageNumber,
                text: highlight.approvedText,
            }))
            : [],
        rule: snapshot.photoContext.policy === 'included'
            ? 'Use only these reviewed photo highlights.'
            : 'Do not use, infer, or mention photo-derived context.',
    },
    humanApproval: snapshot.humanApproval,
}, null, 2);

const getPromptForContentType = (params: GenerationParams, contentType: string): string => `${PROMPT_DEFINITIONS}
Authoritative Approved Brief Snapshot:
${buildApprovedGenerationContract(params.approvedBriefSnapshot)}

Generation rules:
- The Approved Brief Snapshot is the sole factual and campaign contract.
- Corrected approved values replace every conflicting source value.
- Hard exclusions apply even when lower-authority source material or prior copy conflicts.
- Style avoidances are advisory writing guidance; do not treat them as factual exclusions.
- Respect the effective photo policy exactly.
- Do not reveal the snapshot identifier in user-facing copy.

Task: ${contentType}, approximately ${params.output.wordCount} words.
`;

const generateCopy = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    const params = validateGenerationParams(payload.params);
    const contentType = requireString(payload.contentType, 'contentType', 80);
    if (contentType !== 'Listing Copy') {
        throw new ApiError(400, 'contentType is not supported.');
    }
    const prompt = getPromptForContentType(params, contentType);
    try {
        const model = resolveModelForOperation('generateCopy');
        if (!model) throw new ApiError(500, 'No model configured for copy generation.');
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({
            model,
            contents: prompt,
            config: { systemInstruction: 'Real estate copywriter. Australian market. Return ONLY the copy, no extra chat.' }
        }));
        return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopy') };
    } catch (e: any) {
        console.error('Generate copy error:', e?.message || e);
        throw new Error('Generation failed.');
    }
};

const generateCopyVariant = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    const baseCopy = requireString(payload.baseCopy, 'baseCopy', 80000);
    const variantType = requireString(payload.variantType, 'variantType', 80) as PreviewTab;
    if (!PREVIEW_TABS.includes(variantType) || variantType === 'Full Copy') {
        throw new ApiError(400, 'variantType is not supported.');
    }
    const params = validateGenerationParams(payload.params);
    const governedBaseCopy = sanitiseBaseCopyForSnapshot(baseCopy, params.approvedBriefSnapshot);
    const variantGenerationContract = `
Authoritative Approved Brief Snapshot:
${buildApprovedGenerationContract(params.approvedBriefSnapshot)}

Contract rules for this variant:
- Bind this output to snapshot ID ${params.approvedBriefSnapshot.snapshotId}; do not reveal the ID in user-facing copy.
- Corrected facts and hard exclusions in the snapshot govern this variant independently of the base copy.
- The base copy is lower authority. Never repeat a conflicting or excluded claim from it.
- Respect the effective photo-context policy exactly.
`;
    const model = resolveModelForOperation('generateCopyVariant', variantType);
    if (!model) throw new ApiError(500, 'No model configured for copy variant generation.');

    if (variantType === 'Open House') {
        const prompt = `
Generate an "Open House" announcement based on this copy and details.
${variantGenerationContract}
Sanitised Base Copy: ${governedBaseCopy}
Address: ${params.includeAddress ? params.address : '[OMIT ADDRESS UNDER APPROVED BRIEF POLICY]'}
Approved date: ${params.openHouse.date}
Approved time: ${params.openHouse.time}
Approved URL: ${params.openHouse.url}
Agent: ${params.agentProfile.name}, ${params.agentProfile.phone}, ${params.agentProfile.email}

Template to follow. The Date, Time and URL values below are deliberately blank when the corresponding approved value above is blank:
🏡 Open House: [Address only when permitted by the approved brief] 🏖️
📅 Date: ${params.openHouse.date}
⏰ Time: ${params.openHouse.time}
📍 Location: [Address only when permitted by the approved brief]

[Hook sentence about the property]

What to Expect:
* [Bullet points of key features from copy]

[Experience/Lifestyle closing sentence]

📞 [Agent Name] – [Phone]
📧 [Email]
🔗 ${params.openHouse.url}

We look forward to seeing you there!

RULES:
- Date, time and URL are independently optional. Use only the exact non-blank approved values supplied above.
- When an approved date, time or URL is blank, leave that template value blank. Do not infer or invent a replacement.
- Never add a weekday, weekend day, calendar date, inspection time or URL that was not supplied.
- Never substitute TBC, TBD, [DATE], [TIME], [URL], template braces or any other placeholder token for a blank value.
- Use emojis as in the template. Bullet points must be concise. No em-dashes. Return ONLY this announcement.
`;
        try {
            const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
            return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
        } catch (e: any) {
            console.error('Generate variant error:', e?.message || e);
            throw new Error('Open House variant failed.');
        }
    }

    if (variantType === 'Just Listed') {
        const prompt = `Adapt this property listing into a high-impact, short, and punchy "JUST LISTED" social media post.
        ${variantGenerationContract}
        TASK: Create a catchy, early hook to grab attention.
        STYLE: Tailored for social media users with limited time. Concise and energetic.
        GOAL: Drive users to view the full listing.
        RULES: Include a clear placeholder for the URL (e.g., [VIEW FULL LISTING: https://...]).
        Return ONLY the post content. No extra variants or formatting like "X post".
        Sanitised Listing Data: ${governedBaseCopy}`;
        try {
            const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
            return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
        } catch (e: any) {
            console.error('Generate variant error:', e?.message || e);
            throw new Error(`Just Listed variant failed.`);
        }
    }

    if (variantType === 'Coming Soon Teaser') {
        const prompt = `Adapt this property listing into an exciting "COMING SOON" teaser post.
        ${variantGenerationContract}
        TASK: Create a short, high-impact 'tease'.
        LENGTH: Maximum 500 characters and no more than 2 short paragraphs.
        GOAL: Create a sense of exclusivity and anticipation. Focus on the core lifestyle hook.
        Include contact details if provided.
        Sanitised Listing Data: ${governedBaseCopy}
        RULES: Return ONLY the teaser content. No extra versions. Do NOT include an X post or extra formats at the end.`;
        try {
            const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
            return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
        } catch (e: any) {
            console.error('Generate variant error:', e?.message || e);
            throw new Error(`Coming Soon variant failed.`);
        }
    }

    if (variantType === 'Coming Soon Email') {
        const prompt = `Write a high-converting "COMING SOON" preview email to an agent's database.
        ${variantGenerationContract}
        Subject line should be punchy and professional. The body should build hype without revealing everything.
        LENGTH: Concise (max 150 words).
        Sanitised Base Copy: ${governedBaseCopy}
        Agent: ${params.agentProfile.name}, ${params.agentProfile.agency}
        RULES: Return ONLY the email subject and body. No extra chat. Do NOT include an X post or extra formats at the end.`;
        try {
            const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
            return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
        } catch (e: any) {
            console.error('Generate variant error:', e?.message || e);
            throw new Error(`Coming Soon Email failed.`);
        }
    }

    if (variantType === 'Coming Soon SMS') {
        const prompt = `Write a short, engaging "COMING SOON" SMS for potential buyers.
        ${variantGenerationContract}
        Must be under 160 characters. No em-dashes.
        Sanitised Base Copy: ${governedBaseCopy}
        RULES: Return ONLY the SMS content. Do NOT include an X post or extra formats at the end.`;
        try {
            const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
            return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
        } catch (e: any) {
            console.error('Generate variant error:', e?.message || e);
            throw new Error(`Coming Soon SMS failed.`);
        }
    }

    let extraRules = '';
    if (variantType === 'X (Twitter)') {
        extraRules = 'Max 280 characters. Use relevant hashtags.';
    } else {
        extraRules = 'Do NOT include an X post or additional formats. Return ONLY the content for this specific variant.';
    }

    const prompt = `Adapt this property listing for ${variantType}. No em-dashes. ${extraRules}
${variantGenerationContract}
Sanitised Base Copy: ${governedBaseCopy}`;
    try {
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents: prompt }));
        return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'generateCopyVariant') };
    } catch (e: any) {
        console.error('Generate variant error:', e?.message || e);
        throw new Error(`Variant ${variantType} failed.`);
    }
};

const refineCopy = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    requireString(payload.copy, 'copy', 80000);
    requireString(payload.instruction, 'instruction', 5000);
    throw new ApiError(410, 'Advanced refinement is not available in Copywriting v1. Update the campaign inputs and regenerate outputs instead.');
};

const getChatbotResponse = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    if (!Array.isArray(payload.history) || payload.history.length > MAX_HISTORY_MESSAGES) {
        throw new ApiError(400, 'history must be an array with no more than 20 messages.');
    }
    const history: ChatMessage[] = payload.history.map((message: unknown) => {
        const item = requireObject(message, 'history item');
        const role = requireString(item.role, 'history.role', 10) as ChatMessage['role'];
        if (!['user', 'model'].includes(role)) throw new ApiError(400, 'history.role is invalid.');
        return { role, text: requireString(item.text, 'history.text', 5000, 0) };
    });
    const newMessage = optionalString(payload.newMessage, 'newMessage', 5000) || '';
    const newImage = payload.newImage === null || payload.newImage === undefined ? undefined : validateImage(payload.newImage, 'newImage');
    if (!newMessage.trim() && !newImage) {
        throw new ApiError(400, 'newMessage or newImage is required.');
    }

    const contents: any[] = history.map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    const userPart: any[] = [{ text: newMessage }];
    if (newImage) userPart.unshift({ inlineData: { data: newImage.base64, mimeType: newImage.mimeType } });
    contents.push({ role: 'user', parts: userPart });
    try {
        const model = resolveModelForOperation('getChatbotResponse');
        if (!model) throw new ApiError(500, 'No model configured for chat.');
        const response: GenerateContentResponse = await withRetry<GenerateContentResponse>(() => getAiClient().models.generateContent({ model, contents }));
        return { data: cleanMarkdown(response.text), usage: extractUsage(response, model, 'getChatbotResponse') };
    } catch (e: any) {
        console.error('Chatbot response error:', e?.message || e);
        throw new Error('Chat failed.');
    }
};

const dispatchOperation = async (operation: CopywritingOperation, payload: Record<string, any>): Promise<unknown> => {
    switch (operation) {
        case 'suggestAddresses':
            return suggestAddresses(payload);
        case 'researchProperty':
            return researchProperty(payload);
        case 'analyzeStrategy':
            return analyzeStrategy(payload);
        case 'analyzeFeatures':
            return analyzeFeatures(payload);
        case 'analyzeSingleImage':
            return analyzeSingleImage(payload);
        case 'generateCopy':
            return generateCopy(payload);
        case 'generateCopyVariant':
            return generateCopyVariant(payload);
        case 'refineCopy':
            return refineCopy(payload);
        case 'getChatbotResponse':
            return getChatbotResponse(payload);
        default:
            throw new ApiError(400, 'Unsupported copywriting operation.');
    }
};

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        sendJson(res, 405, { error: 'Method not allowed.' });
        return;
    }

    try {
        enforceBetaAccess(req);
        enforceThrottle(req);

        const body = requireObject(await readJsonBody(req), 'request body');
        const operation = requireString(body.operation, 'operation', 80) as CopywritingOperation;
        if (!ALLOWED_OPERATIONS.has(operation)) {
            throw new ApiError(400, 'Unsupported copywriting operation.');
        }
        const payload = requireObject(body.payload, 'payload');
        const result = operation === 'verifyBetaAccess'
            ? verifyBetaAccess(req)
            : await dispatchOperation(operation, payload);
        sendJson(res, 200, result);
    } catch (error: any) {
        if (error instanceof SyntaxError) {
            sendJson(res, 400, {
                error: 'Invalid JSON request body.',
                statusCode: 400,
                errorName: 'SyntaxError',
                isRetryable: false,
            });
            return;
        }
        if (error instanceof ApiError) {
            const isServerFailure = error.statusCode >= 500;
            if (isServerFailure) console.error('Copywriting API server failure:', error.message);
            sendJson(res, error.statusCode, {
                error: isServerFailure
                    ? 'Copywriting service is temporarily unavailable. Retry when ready.'
                    : error.message,
                statusCode: error.statusCode,
                errorName: error.name,
                isRetryable: isRetryableHttpStatus(error.statusCode),
            });
            return;
        }
        console.error('Copywriting API error:', error?.message || error);
        sendJson(res, 500, {
            error: 'Copywriting service is temporarily unavailable. Retry when ready.',
            statusCode: 500,
            errorName: error instanceof Error ? error.name : 'Error',
            isRetryable: true,
        });
    }
}
