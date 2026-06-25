import { GoogleGenAI, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import { createHmac, randomBytes, timingSafeEqual } from 'crypto';
import type { GenerationParams, ChatMessage, ImageContent, GroundingSource, ResearchResult, PreviewTab, UsageStats, ServiceResponse, StrategyAnalysisResult } from '../types';

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
    }
}

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

    const wordCount = Number(output.wordCount);
    if (!Number.isFinite(wordCount) || wordCount < 50 || wordCount > 1000) {
        throw new ApiError(400, 'params.output.wordCount must be between 50 and 1000.');
    }

    return {
        address: requireString(params.address, 'params.address', 500, 0),
        includeAddress: requireBoolean(params.includeAddress, 'params.includeAddress'),
        details: validatePropertyDetails(params.details),
        context: validateCopyContext(params.context),
        features: optionalString(params.features, 'params.features', 20000) || '',
        output: { wordCount },
        imageAnalysis: optionalString(params.imageAnalysis, 'params.imageAnalysis', 50000),
        researchData: optionalString(params.researchData, 'params.researchData', 80000),
        profileData: profileData ? {
            suburb: optionalString(profileData.suburb, 'params.profileData.suburb', 50000) || '',
            area: optionalString(profileData.area, 'params.profileData.area', 50000) || '',
        } : null,
        profileInclusion: inclusion,
        agentProfile: {
            name: optionalString(agentProfile.name, 'params.agentProfile.name', 200) || '',
            agency: optionalString(agentProfile.agency, 'params.agentProfile.agency', 200) || '',
            phone: optionalString(agentProfile.phone, 'params.agentProfile.phone', 80) || '',
            email: optionalString(agentProfile.email, 'params.agentProfile.email', 200) || '',
            inclusionMode,
        },
        openHouse: {
            date: optionalString(openHouse.date, 'params.openHouse.date', 200) || '',
            time: optionalString(openHouse.time, 'params.openHouse.time', 200) || '',
            url: optionalString(openHouse.url, 'params.openHouse.url', 1000) || '',
        },
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
    const requiredCode = process.env.BETA_ACCESS_CODE;
    if (!requiredCode) return;

    const providedCode = req.headers?.['x-beta-access-code'];
    if (
        typeof providedCode !== 'string' ||
        (providedCode !== requiredCode && !isValidBetaSessionToken(providedCode, requiredCode))
    ) {
        throw new ApiError(401, 'Valid beta access code is required.');
    }
};

const verifyBetaAccess = (req: any): { ok: true; token: string | null } => {
    const requiredCode = process.env.BETA_ACCESS_CODE;
    if (!requiredCode) return { ok: true, token: null };

    const providedCode = req.headers?.['x-beta-access-code'];
    if (typeof providedCode !== 'string' || providedCode !== requiredCode) {
        throw new ApiError(401, 'Valid beta access code is required.');
    }

    return { ok: true, token: createBetaSessionToken(requiredCode) };
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

const analyzeStrategy = async (payload: Record<string, any>): Promise<ServiceResponse<StrategyAnalysisResult>> => {
    const researchData = requireString(payload.researchData, 'researchData', 80000);
    const profileData = optionalString(payload.profileData, 'profileData', 80000);
    const imageAnalysis = optionalString(payload.imageAnalysis, 'imageAnalysis', 50000);
    const prompt = `Analyze: Research: ${researchData}, Profile: ${profileData}, Images: ${imageAnalysis}.
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
    const prompt = `Extract features JSON { propertyFeatures: [string] }. Research: ${researchData}, Profile: ${profileData}, Images: ${imageAnalysis}.`;
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
            data: { propertyFeatures: formatAIResponseList(result.propertyFeatures, '\n') },
            usage: extractUsage(response, model, 'analyzeFeatures')
        };
    } catch (e: any) {
        console.error('Feature analysis error:', e?.message || e);
        throw new Error('Feature analysis failed.');
    }
};

const analyzeSingleImage = async (payload: Record<string, any>): Promise<ServiceResponse<string>> => {
    const image = validateImage(payload.image, 'image');
    const prompt = `Analyze image: concise bullet selling points.`;
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

const getPromptForContentType = (params: GenerationParams, contentType: string): string => {
    const { address, includeAddress, details, context, features, researchData, profileData, profileInclusion, imageAnalysis, agentProfile } = params;
    let prompt = PROMPT_DEFINITIONS;
    let profiles = '';
    if (profileData && profileInclusion !== 'none') {
        if (['suburb', 'both'].includes(profileInclusion)) profiles += `\nSuburb: ${profileData.suburb}`;
        if (['area', 'both'].includes(profileInclusion)) profiles += `\nArea: ${profileData.area}`;
    }
    prompt += `
Brief:
Address: ${includeAddress ? address : 'Do not include'}
Property: ${details.beds}b/${details.baths}b, ${details.propertyType}
Strategy: Market: ${context.primaryTargetMarket}, Style: ${context.writingStyle.join(', ')}
Data: Features: ${features}. Research: ${researchData}. Images: ${imageAnalysis}. ${profiles}
Agent: ${agentProfile.inclusionMode === 'integrate' ? `Name: ${agentProfile.name}, Agency: ${agentProfile.agency}, Phone: ${agentProfile.phone}, Email: ${agentProfile.email}` : `Name: ${agentProfile.name}`}
Task: ${contentType}, ~${params.output.wordCount} words.
`;
    return prompt;
};

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
    const model = resolveModelForOperation('generateCopyVariant', variantType);
    if (!model) throw new ApiError(500, 'No model configured for copy variant generation.');

    if (variantType === 'Open House') {
        const prompt = `
Generate an "Open House" announcement based on this copy and details.
Base Copy: ${baseCopy}
Address: ${params.address}
Date: ${params.openHouse.date || '[DATE]'}
Time: ${params.openHouse.time || '[TIME]'}
URL: ${params.openHouse.url || '[PROPERTY LISTING URL]'}
Agent: ${params.agentProfile.name}, ${params.agentProfile.phone}, ${params.agentProfile.email}

Template to follow:
🏡 Open House: [Address] 🏖️
📅 Date: [Date]
⏰ Time: [Time]
📍 Location: [Address]

[Hook sentence about the property]

What to Expect:
* [Bullet points of key features from copy]

[Experience/Lifestyle closing sentence]

📞 [Agent Name] – [Phone]
📧 [Email]
🔗 [URL]

We look forward to seeing you there!

RULES: Use emojis as in template. Bullet points must be concise. No em-dashes. Return ONLY this announcement.
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
        TASK: Create a catchy, early hook to grab attention.
        STYLE: Tailored for social media users with limited time. Concise and energetic.
        GOAL: Drive users to view the full listing.
        RULES: Include a clear placeholder for the URL (e.g., [VIEW FULL LISTING: https://...]).
        Return ONLY the post content. No extra variants or formatting like "X post".
        Listing Data: ${baseCopy}`;
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
        TASK: Create a short, high-impact 'tease'.
        LENGTH: Maximum 500 characters and no more than 2 short paragraphs.
        GOAL: Create a sense of exclusivity and anticipation. Focus on the core lifestyle hook.
        Include contact details if provided.
        Listing Data: ${baseCopy}
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
        Subject line should be punchy and professional. The body should build hype without revealing everything.
        LENGTH: Concise (max 150 words).
        Base Copy: ${baseCopy}
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
        Must be under 160 characters. No em-dashes.
        Base Copy: ${baseCopy}
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

    const prompt = `Adapt this property listing for ${variantType}. No em-dashes. ${extraRules}\n\nBase Copy: ${baseCopy}`;
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
            sendJson(res, 400, { error: 'Invalid JSON request body.' });
            return;
        }
        if (error instanceof ApiError) {
            sendJson(res, error.statusCode, { error: error.message });
            return;
        }
        console.error('Copywriting API error:', error?.message || error);
        sendJson(res, 500, { error: error instanceof Error ? error.message : 'Copywriting request failed.' });
    }
}
