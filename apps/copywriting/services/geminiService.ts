import type { GenerationParams, ChatMessage, ImageContent, ResearchResult, PreviewTab, ServiceResponse } from '../types';

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

const parseErrorMessage = async (response: Response): Promise<string> => {
    try {
        const body = await response.json();
        if (body && typeof body.error === 'string') return body.error;
    } catch {
        // Fall back to status text below.
    }
    return response.statusText || 'Copywriting request failed.';
};

const postCopywritingOperation = async <T>(operation: CopywritingOperation, payload: unknown): Promise<T> => {
    const betaToken = getStoredBetaToken();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (betaToken) headers['x-beta-access-code'] = betaToken;

    const response = await fetch(API_PATH, {
        method: 'POST',
        headers,
        body: JSON.stringify({ operation, payload }),
    });

    if (!response.ok) {
        if (response.status === 401) clearBetaAccess();
        throw new Error(await parseErrorMessage(response));
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
        throw new Error(await parseErrorMessage(response));
    }

    const body = await response.json();
    const token = typeof body?.token === 'string' && body.token ? body.token : 'verified-local-session';
    setStoredBetaToken(token);
};

export const suggestAddresses = async (query: string, userLocation?: {latitude: number, longitude: number}): Promise<ServiceResponse<string[]>> => {
    return postCopywritingOperation<ServiceResponse<string[]>>('suggestAddresses', { query, userLocation });
};

export const researchProperty = async (address: string, userLocation?: {latitude: number, longitude: number}): Promise<ServiceResponse<ResearchResult>> => {
    return postCopywritingOperation<ServiceResponse<ResearchResult>>('researchProperty', { address, userLocation });
};

export const analyzeStrategy = async (
    researchData: string,
    profileData: string | null,
    imageAnalysis: string | null
): Promise<ServiceResponse<{
    primaryTargetMarket: string;
    secondaryTargetMarket: string | null;
    writingStyles: string[];
    featuresToHighlight: string;
    thingsToAvoid: string;
}>> => {
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
