import type { GenerationParams, ChatMessage, ImageContent, ResearchResult, PreviewTab, ServiceResponse, StrategyAnalysisResult } from '../types';

export const MODEL_GROUNDING = 'server-configured Gemini Pro model';
export const MODEL_FAST = 'server-configured Gemini Flash model';
export const MODEL_SMART = 'server-configured Gemini Pro model';
export const MODEL_VISION = 'server-configured Gemini Flash model';

const API_PATH = '/api/copywriting';
const BETA_ACCESS_TOKEN_STORAGE_KEY = 'copywritingBetaAccessToken';

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

type CopywritingErrorPayload = {
    error?: unknown;
    statusCode?: unknown;
    providerErrorCode?: unknown;
    errorName?: unknown;
    isRetryable?: unknown;
};

type CopywritingRequestErrorOptions = {
    statusCode?: number;
    providerErrorCode?: string;
    errorName?: string;
    isRetryable?: boolean;
    technicalMessage?: string;
};

export class CopywritingRequestError extends Error {
    statusCode?: number;
    providerErrorCode?: string;
    errorName?: string;
    isRetryable?: boolean;
    technicalMessage?: string;

    constructor(message: string, options: CopywritingRequestErrorOptions = {}) {
        super(message);
        this.name = 'CopywritingRequestError';
        this.statusCode = options.statusCode;
        this.providerErrorCode = options.providerErrorCode;
        this.errorName = options.errorName;
        this.isRetryable = options.isRetryable;
        this.technicalMessage = options.technicalMessage;
    }
}

const getStoredBetaToken = (): string => {
    if (typeof window === 'undefined') return '';
    return window.sessionStorage.getItem(BETA_ACCESS_TOKEN_STORAGE_KEY) || '';
};

const setStoredBetaToken = (token: string): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(BETA_ACCESS_TOKEN_STORAGE_KEY, token);
};

export const clearBetaAccess = (): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(BETA_ACCESS_TOKEN_STORAGE_KEY);
};

export const hasVerifiedBetaAccess = (): boolean => {
    return Boolean(getStoredBetaToken());
};

const isRetryableStatus = (statusCode: number): boolean => (
    statusCode === 408 ||
    statusCode === 409 ||
    statusCode === 425 ||
    statusCode === 429 ||
    statusCode >= 500
);

const safeString = (value: unknown): string | undefined => {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
};

const parseErrorPayload = async (response: Response): Promise<CopywritingErrorPayload> => {
    try {
        const body = await response.json();
        if (body && typeof body === 'object') return body as CopywritingErrorPayload;
    } catch {
        // Fall back to status text below.
    }
    return {};
};

const postCopywritingOperation = async <T>(
    operation: CopywritingOperation,
    payload: unknown,
    options: { signal?: AbortSignal } = {}
): Promise<T> => {
    const betaToken = getStoredBetaToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (betaToken) headers['x-beta-access-code'] = betaToken;

    let response: Response;
    try {
        response = await fetch(API_PATH, {
            method: 'POST',
            headers,
            body: JSON.stringify({ operation, payload }),
            signal: options.signal,
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error;
        const technicalMessage = error instanceof Error ? error.message : 'Network request failed.';
        throw new CopywritingRequestError('Copywriting request could not reach the server. Retry when ready.', {
            errorName: error instanceof Error ? error.name : 'NetworkError',
            isRetryable: true,
            technicalMessage,
        });
    }

    if (!response.ok) {
        if (response.status === 401) clearBetaAccess();
        const body = await parseErrorPayload(response);
        const message = safeString(body.error) || response.statusText || 'Copywriting request failed.';
        const responseStatusCode = typeof body.statusCode === 'number' ? body.statusCode : response.status;
        throw new CopywritingRequestError(message, {
            statusCode: responseStatusCode,
            providerErrorCode: safeString(body.providerErrorCode),
            errorName: safeString(body.errorName),
            isRetryable: typeof body.isRetryable === 'boolean' ? body.isRetryable : isRetryableStatus(responseStatusCode),
            technicalMessage: message,
        });
    }

    return response.json() as Promise<T>;
};

export const verifyBetaAccess = async (code: string): Promise<void> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (code) headers['x-beta-access-code'] = code;

    const response = await fetch(API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ operation: 'verifyBetaAccess', payload: {} }),
    });

    if (!response.ok) {
        clearBetaAccess();
        const body = await parseErrorPayload(response);
        const message = safeString(body.error) || response.statusText || 'Beta access check failed.';
        const responseStatusCode = typeof body.statusCode === 'number' ? body.statusCode : response.status;
        throw new CopywritingRequestError(message, {
            statusCode: responseStatusCode,
            providerErrorCode: safeString(body.providerErrorCode),
            errorName: safeString(body.errorName),
            isRetryable: typeof body.isRetryable === 'boolean' ? body.isRetryable : isRetryableStatus(responseStatusCode),
            technicalMessage: message,
        });
    }

    const body = await response.json();
    const token = typeof body?.token === 'string' && body.token ? body.token : 'verified-local-session';
    setStoredBetaToken(token);
};

export const suggestAddresses = async (
    query: string,
    userLocation?: {latitude: number, longitude: number},
    signal?: AbortSignal
): Promise<ServiceResponse<string[]>> => {
    return postCopywritingOperation<ServiceResponse<string[]>>('suggestAddresses', { query, userLocation }, { signal });
};

export const researchProperty = async (address: string, userLocation?: {latitude: number, longitude: number}): Promise<ServiceResponse<ResearchResult>> => {
    return postCopywritingOperation<ServiceResponse<ResearchResult>>('researchProperty', { address, userLocation });
};

export const analyzeStrategy = async (
    researchData: string,
    profileData: string | null,
    imageAnalysis: string | null
): Promise<ServiceResponse<StrategyAnalysisResult>> => {
    return postCopywritingOperation('analyzeStrategy', { researchData, profileData, imageAnalysis });
};

export const analyzeFeatures = async (
    researchData: string,
    profileData: string | null,
    imageAnalysis: string | null
): Promise<ServiceResponse<{ propertyFeatures: string; }>> => {
    return postCopywritingOperation('analyzeFeatures', { researchData, profileData, imageAnalysis });
};

export const analyzeSingleImage = async (image: ImageContent): Promise<ServiceResponse<string>> => {
    return postCopywritingOperation<ServiceResponse<string>>('analyzeSingleImage', { image });
};

export const generateCopy = async (params: GenerationParams, contentType: string): Promise<ServiceResponse<string>> => {
    return postCopywritingOperation<ServiceResponse<string>>('generateCopy', { params, contentType });
};

export const generateCopyVariant = async (
    baseCopy: string,
    variantType: PreviewTab,
    params: GenerationParams
): Promise<ServiceResponse<string>> => {
    return postCopywritingOperation<ServiceResponse<string>>('generateCopyVariant', { baseCopy, variantType, params });
};

export const refineCopy = async (copy: string, instruction: string): Promise<ServiceResponse<string>> => {
    return postCopywritingOperation<ServiceResponse<string>>('refineCopy', { copy, instruction });
};

export const getChatbotResponse = async (history: ChatMessage[], newMessage: string, newImage?: ImageContent): Promise<ServiceResponse<string>> => {
    const sanitizedHistory = history.map(message => ({ role: message.role, text: message.text }));
    return postCopywritingOperation<ServiceResponse<string>>('getChatbotResponse', { history: sanitizedHistory, newMessage, newImage });
};
