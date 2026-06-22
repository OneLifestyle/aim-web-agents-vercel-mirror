
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import type { PropertyDetails, AgentProfile, CopyContext, OutputSettings, ImageFile, PreviewTab, GroundingSource, ImageContent, TimelineItem, ResearchResult, GenerationParams, DebugLogEntry, UsageStats, OpenHouseDetails } from './types';
import { TARGET_MARKETS, WRITING_STYLES, PROPERTY_TYPES, IconFileWord, IconFilePdf, IconClock, IconFileTxt } from './constants';
import { IconBuilding, IconCamera, IconChevronDown, IconClipboard, IconDownload, IconFileText, IconHome, IconLoader, IconMessage, IconMinus, IconPlus, IconSend, IconSparkles, IconTrash, IconUpload, IconX, IconWorld, IconMapPin, IconCheckCircle, IconExclamationCircle, IconChevronLeft, IconChevronRight } from './constants';
import * as geminiService from './services/geminiService';
import { fileToBase64 } from './utils/fileUtils';
import { buildCampaignExportPlan, sanitizeFileNamePart } from './utils/exportAssembly';
import { Spinner } from './components/Spinner';
import { ChatBot } from './components/ChatBot';

type VersionSet = Partial<Record<PreviewTab, string>>;
type SelectedAddress = {
    label: string;
};
type CampaignOperationId = 'research' | 'strategy' | 'features' | 'images' | 'generate' | 'generate-all' | 'refine' | 'download-full';
type ActiveCampaignOperation = {
    id: CampaignOperationId;
    label: string;
};

const previewTabConfig: Record<string, PreviewTab[]> = {
    'Listing': ['Full Copy', 'Just Listed', 'Brochure Copy', 'Email', 'Flyer'],
    'Coming Soon': ['Coming Soon Teaser', 'Coming Soon Email', 'Coming Soon SMS'],
    'Social Media': ['Facebook', 'Facebook Marketplace', 'Instagram', 'X (Twitter)', 'Google Business', 'TikTok', 'Open House'],
    'Events': ['Open House'],
    'Blog': ['Long-form / Blog'],
    'Video': ['Video Script']
};
const mainTabs = Object.keys(previewTabConfig);
const ALL_CONTENT_TABS = Object.values(previewTabConfig).flat();

const Section: React.FC<{ title: string; children: React.ReactNode; className?: string; rightElement?: React.ReactNode }> = ({ title, children, className, rightElement }) => (
  <div className={`bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex flex-col ${className || ''}`}>
    <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold text-gray-800">{title}</h2>
        {rightElement}
    </div>
    {children}
  </div>
);

const Placeholder: React.FC<{ icon: React.ReactNode; title: string; description: string }> = ({ icon, title, description }) => (
    <div className="flex flex-col items-center justify-center text-center p-8 bg-gray-50 border-2 border-dashed border-gray-200 rounded-lg min-h-[160px]">
        <div className="mb-3 text-gray-400">
            {React.cloneElement(icon as React.ReactElement, { className: "w-10 h-10" })}
        </div>
        <h3 className="text-sm font-bold text-gray-900 mb-1">{title}</h3>
        <p className="text-xs text-gray-500 max-w-xs leading-relaxed">{description}</p>
    </div>
);

const NumberInput: React.FC<{ label: string; value: number | null; onChange: (value: number) => void; min?: number; }> = ({ label, value, onChange, min = 0 }) => (
    <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="flex items-center justify-between w-full border border-gray-300 rounded-md p-2">
            <button onClick={() => onChange(Math.max(min, (value ?? 0) - 1))} className="text-gray-600 hover:text-red-500 transition-colors rounded-full w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-red-100"><IconMinus /></button>
            <span className="font-medium text-gray-800">{value !== null ? value : '-'}</span>
            <button onClick={() => onChange((value ?? 0) + 1)} className="text-gray-600 hover:text-red-500 transition-colors rounded-full w-6 h-6 flex items-center justify-center bg-gray-100 hover:bg-red-100"><IconPlus /></button>
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
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <div className="relative w-full">
            <select
                value={value}
                onChange={(e) => onChange(e.target.value)}
                disabled={disabled}
                className="w-full appearance-none bg-white border border-gray-300 rounded-md p-2 pr-8 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:bg-gray-100 disabled:text-gray-400"
            >
                {placeholder && <option value="" disabled>{placeholder}</option>}
                {options.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
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
    if (stepName.startsWith('Generate All Variations')) return 'Creating campaign variations';
    if (stepName.startsWith('Download Full Campaign')) return 'Preparing full campaign document';
    if (stepName.startsWith('Download All')) return 'Preparing full campaign document';
    if (stepName.startsWith('Refine Copy')) return 'Refining selected section';
    if (stepName.startsWith('Address Suggestions')) return 'Finding matching addresses';
    if (stepName.startsWith('Chat')) return 'Assistant reply';
    return stepName;
};

const DebugPanel: React.FC<{ logs: DebugLogEntry[] }> = ({ logs }) => {
    const totalCost = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.estimatedCost ?? 0), 0), [logs]);
    const excludedCount = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.excludedOperationCount ?? (log.usage?.usageStatus === 'unavailable' ? 1 : 0)), 0), [logs]);
    const unknownCount = useMemo(() => logs.reduce((sum, log) => sum + (log.usage?.unknownCostOperationCount ?? (log.usage?.pricingStatus === 'unknown' ? 1 : 0)), 0), [logs]);

    return (
        <div className="flex-1 flex flex-col bg-slate-900 text-slate-300 text-xs font-mono overflow-hidden rounded-lg border border-slate-700">
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
                                <div className="flex justify-between"><span>Usage:</span> <span>{log.usage.usageStatus}</span></div>
                                <div className="flex justify-between"><span>Pricing:</span> <span className={log.usage.pricingStatus === 'unknown' ? 'text-yellow-400' : 'text-slate-300'}>{log.usage.pricingStatus}</span></div>
                                <div className="flex justify-between"><span>In/Out:</span> <span>{formatTokenCount(log.usage.promptTokens)} / {formatTokenCount(log.usage.candidatesTokens)}</span></div>
                                {(log.usage.thinkingTokens !== null && log.usage.thinkingTokens !== undefined) && (
                                    <div className="flex justify-between"><span>Thinking:</span> <span>{formatTokenCount(log.usage.thinkingTokens)}</span></div>
                                )}
                                {(log.usage.cachedTokens !== null && log.usage.cachedTokens !== undefined) && (
                                    <div className="flex justify-between"><span>Cached:</span> <span>{formatTokenCount(log.usage.cachedTokens)}</span></div>
                                )}
                                <div className="flex justify-between border-t border-slate-700 mt-1 pt-1">
                                    <span>Token-only est. cost:</span>
                                    <span className={log.usage.estimatedCost === null ? 'text-yellow-400' : 'text-green-400'}>
                                        {log.usage.estimatedCost === null ? 'unknown' : `$${log.usage.estimatedCost.toFixed(5)}`}
                                    </span>
                                </div>
                                <div className="mt-1 text-[10px] text-slate-400 leading-snug">Grounding/tool charges not included.</div>
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
                                <div className="bg-slate-800 p-1.5 rounded text-slate-400 whitespace-pre-wrap overflow-hidden text-[10px]">{log.inputs.substring(0, 150)}{log.inputs.length > 150 ? '...' : ''}</div>
                            </div>
                        )}
                        {log.outputs && (
                            <div>
                                <span className="block text-slate-500 mb-0.5">Outputs:</span>
                                <div className="bg-slate-800 p-1.5 rounded text-slate-200 whitespace-pre-wrap overflow-hidden text-[10px] border border-slate-700">{log.outputs.substring(0, 150)}{log.outputs.length > 150 ? '...' : ''}</div>
                            </div>
                        )}
                    </div>
                ))}
            </div>
            <div className="p-2 border-t border-slate-700 bg-slate-800 text-right">
                <span className="text-slate-400 mr-2">Token-only session estimate:</span>
                <span className="text-green-400 font-bold">${totalCost.toFixed(5)}</span>
                <div className="text-[10px] text-slate-500 mt-1">
                    Grounding/tool charges not included. Some operations excluded where provider usage is unavailable.
                    {(excludedCount > 0 || unknownCount > 0) && ` Excluded: ${excludedCount}. Unknown cost: ${unknownCount}.`}
                </div>
            </div>
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

    const [groundingSources, setGroundingSources] = useState<GroundingSource[]>([]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isRefining, setIsRefining] = useState(false);
    const [generationError, setGenerationError] = useState<string | null>(null);

    const [versionSets, setVersionSets] = useState<VersionSet[]>([]);
    const [activeVersionIndex, setActiveVersionIndex] = useState(0);

    const [activeMainTab, setActiveMainTab] = useState<string>('Listing');
    const [activeSubTab, setActiveSubTab] = useState<PreviewTab>('Full Copy');
    const [generatingTab, setGeneratingTab] = useState<PreviewTab | null>(null);
    const [editedStatus, setEditedStatus] = useState<Partial<Record<PreviewTab, boolean>>>({});

    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const saveTimeoutRef = useRef<number | null>(null);
    const hideSaveStatusTimeoutRef = useRef<number | null>(null);

    const [isAnalyzingStrategy, setIsAnalyzingStrategy] = useState(false);
    const [isAnalyzingFeatures, setIsAnalyzingFeatures] = useState(false);
    const [activeCampaignOperation, setActiveCampaignOperation] = useState<ActiveCampaignOperation | null>(null);
    const activeCampaignOperationRef = useRef<ActiveCampaignOperation | null>(null);


    const [notification, setNotification] = useState<string | null>(null);
    const [timeline, setTimeline] = useState<TimelineItem[]>([]);

    const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
    const [isDownloadAllMenuOpen, setIsDownloadAllMenuOpen] = useState(false);
    const [isTimelineModalOpen, setIsTimelineModalOpen] = useState(false);
    const [isDownloadingAll, setIsDownloadingAll] = useState(false);
    const exportMenuRef = useRef<HTMLDivElement>(null);
    const downloadAllMenuRef = useRef<HTMLDivElement>(null);

    const [includeContactDetails, setIncludeContactDetails] = useState(false);

    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
    const [isBetaVerified, setIsBetaVerified] = useState(() => geminiService.hasVerifiedBetaAccess());
    const [isCheckingBetaAccess, setIsCheckingBetaAccess] = useState(() => !geminiService.hasVerifiedBetaAccess());
    const [betaCodeInput, setBetaCodeInput] = useState('');
    const [betaAccessError, setBetaAccessError] = useState<string | null>(null);
    const [isVerifyingBetaAccess, setIsVerifyingBetaAccess] = useState(false);

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

    const beginCampaignOperation = (id: CampaignOperationId, label: string): boolean => {
        const activeOperation = activeCampaignOperationRef.current;
        if (activeOperation) {
            setNotification(`${activeOperation.label} is still running. Wait for it to finish before starting another campaign action.`);
            return false;
        }

        const nextOperation = { id, label };
        activeCampaignOperationRef.current = nextOperation;
        setActiveCampaignOperation(nextOperation);
        return true;
    };

    const endCampaignOperation = (id: CampaignOperationId): void => {
        if (activeCampaignOperationRef.current?.id !== id) return;
        activeCampaignOperationRef.current = null;
        setActiveCampaignOperation(null);
    };

    const handleChatUsage = (usage: UsageStats | undefined, prompt: string) => {
        addLog({
            stepName: 'Chat',
            status: 'success',
            inputs: prompt,
            outputs: usage ? 'Chat response returned with provider usage metadata.' : 'Chat response returned without provider usage metadata.',
            usage
        });
    };

    const handleAgentChange = (field: keyof AgentProfile, value: string) => {
        setAgentProfile(prev => ({ ...prev, [field]: value }));
    };

    const handleOpenHouseChange = (field: keyof OpenHouseDetails, value: string) => {
        setOpenHouse(prev => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        const storedTimeline = localStorage.getItem('copywritingTimeline');
        if (storedTimeline) {
            setTimeline(JSON.parse(storedTimeline));
        }
    }, []);

    useEffect(() => {
        localStorage.setItem('copywritingTimeline', JSON.stringify(timeline));
    }, [timeline]);

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
        // Reset suggestions and loading state if the query is too short
        if (!address.trim() || address.trim().length < 3) {
            setAddressSuggestions([]);
            setIsSuggesting(false);
            return;
        }

        if (selectedAddress?.label === address.trim()) {
            setAddressSuggestions([]);
            setIsSuggesting(false);
            return;
        }

        const handler = setTimeout(async () => {
            setIsSuggesting(true);
            setShowSuggestions(true);
            const logId = addLog({ stepName: 'Address Suggestions', status: 'pending', inputs: address.trim() });
            try {
                const result = await geminiService.suggestAddresses(address, userLocation);
                // Only update if the query hasn't changed or been cleared since the request started
                if (address.trim().length >= 3) {
                    setAddressSuggestions(result.data);
                }
                updateLog(logId, { status: 'success', outputs: `${result.data.length} suggestions returned`, usage: result.usage });
            } catch (error) {
                console.error("Address suggestions error:", error);
                setAddressSuggestions([]);
                updateLog(logId, { status: 'error', message: error instanceof Error ? error.message : 'Address suggestions failed.' });
            } finally {
                setIsSuggesting(false);
            }
        }, 500); // Debounce to prevent too many requests

        return () => {
            clearTimeout(handler);
        };
    }, [address, selectedAddress, userLocation]);

    const handleSuggestionClick = (suggestion: string) => {
        const confirmedAddress = suggestion.trim();
        setSelectedAddress({ label: confirmedAddress });
        setAddress(confirmedAddress);
        setAddressSuggestions([]);
        setShowSuggestions(false);
        setIsSuggesting(false);
        setIsFetchComplete(false);
    };

    const handleAddressChange = (value: string) => {
        setAddress(value);
        setShowSuggestions(true);
        setIsFetchComplete(false);
        if (selectedAddress && value.trim() !== selectedAddress.label) {
            setSelectedAddress(null);
        }
    };

    const handleDetailChange = (field: keyof PropertyDetails, value: any) => {
        setPropertyDetails(prev => ({ ...prev, [field]: value }));
    };

    const handleContextChange = (field: keyof CopyContext, value: any) => {
        setCopyContext(prev => ({ ...prev, [field]: value }));
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
            if (imageFiles.length + files.length > 20) {
                setNotification("Maximum 20 images allowed. Only the first few valid ones were added.");
            }

            const remainingSlots = 20 - imageFiles.length;
            if (remainingSlots <= 0) return;

            const fileArray = Array.from(files).slice(0, remainingSlots).map((file: File): ImageFile => ({
                file,
                url: URL.createObjectURL(file),
                status: 'idle',
            }));

            setImageFiles(prev => [...prev, ...fileArray]);
            setImageAnalysis(null);
            setImageAnalysisError(null);

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
            return newFiles;
        });
    };

    const handleAnalyzeImages = async () => {
        if (imageFiles.length === 0) return;
        if (!beginCampaignOperation('images', 'Photo analysis')) return;

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
            endCampaignOperation('images');
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
        const confirmedAddress = selectedAddress?.label;
        const addressForResearch = confirmedAddress || address.trim();

        if (!addressForResearch) {
            setResearchError("Please enter a property address to fetch details.");
            return;
        }
        if (!beginCampaignOperation('research', 'Property research')) return;
        const logId = addLog({ stepName: 'Fetch Property Details', status: 'pending', inputs: addressForResearch });
        let location = userLocation;
        setIsResearching(true);
        setResearchError(null);
        setResearchData(null);
        setKeyFeatures(null);
        setProfileData(null);
        setPriceGuide(null);
        setLastSoldDetails(null);
        setGroundingSources([]);
        setIsFetchComplete(false);
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
            updateLog(logId, { status: 'success', outputs: `Specs: ${JSON.stringify(researchResult.specs)}`, usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "An unknown error occurred during research.";
            setResearchError(msg);
            setIsFetchComplete(false);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsResearching(false);
            endCampaignOperation('research');
        }
    };

    const handleStrategyAnalysis = async () => {
        if (!researchData) return;
        if (!beginCampaignOperation('strategy', 'AI Strategy Analysis')) return;
        setIsAnalyzingStrategy(true);
        const logId = addLog({ stepName: 'AI Strategy Analysis', status: 'pending', inputs: 'Analyzing research for strategy' });
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
            updateLog(logId, { status: 'success', outputs: JSON.stringify(analysis), usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "Failed to analyze strategy.";
            updateLog(logId, { status: 'error', message: msg });
            setNotification("Strategy analysis failed. Prior strategy settings were kept.");
        } finally {
            setIsAnalyzingStrategy(false);
            endCampaignOperation('strategy');
        }
    };

    const handleFeatureAnalysis = async () => {
        if (!researchData) return;
        if (!beginCampaignOperation('features', 'Feature extraction')) return;
        setIsAnalyzingFeatures(true);
        const logId = addLog({ stepName: 'AI Feature Extraction', status: 'pending', inputs: 'Extracting property features' });
        try {
            const result = await geminiService.analyzeFeatures(researchData, profileData ? `Suburb: ${profileData.suburb}\nArea: ${profileData.area}` : null, imageAnalysis);
            const analysis = result.data;
            setPropertyFeatures(prev => {
                return prev ? `${prev}\n${analysis.propertyFeatures}` : analysis.propertyFeatures;
            });
            updateLog(logId, { status: 'success', outputs: JSON.stringify(analysis), usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "Failed to extract features.";
            updateLog(logId, { status: 'error', message: msg });
            setNotification("Failed to extract property features.");
        } finally {
            setIsAnalyzingFeatures(false);
            endCampaignOperation('features');
        }
    };

    const createNewVersion = (newCopy: string, copyType: PreviewTab) => {
        const newVersion: VersionSet = { [copyType]: newCopy };
        const updatedVersionSets = [...versionSets, newVersion].slice(-3);
        setVersionSets(updatedVersionSets);
        setActiveVersionIndex(updatedVersionSets.length - 1);
        setEditedStatus(prev => ({ ...prev, [copyType]: false }));
        setIncludeContactDetails(false);
    };

    const updateCurrentVersion = (newCopy: string, copyType: PreviewTab) => {
        const updatedVersionSets = [...versionSets];
        const currentVersion = { ...updatedVersionSets[activeVersionIndex] };
        currentVersion[copyType] = newCopy;
        updatedVersionSets[activeVersionIndex] = currentVersion;
        setVersionSets(updatedVersionSets);
        setEditedStatus(prev => ({ ...prev, [copyType]: false }));
    };

    const generateCopyForTab = async (tab: PreviewTab, isRegeneration = false) => {
        if (!beginCampaignOperation('generate', tab === 'Full Copy' ? 'Listing copy generation' : `${tab} generation`)) return;
        setIsGenerating(true);
        setGeneratingTab(tab);
        setGenerationError(null);

        const logId = addLog({
            stepName: `Generate Copy (${tab})`,
            status: 'pending',
            inputs: `Generating for ${tab}. Context: ${copyContext.primaryTargetMarket}, ${copyContext.writingStyle.join('+')}`
        });

        const currentVersion = versionSets[activeVersionIndex];
        const isVariant = tab !== 'Full Copy';
        const baseCopy = currentVersion ? currentVersion['Full Copy'] : undefined;

        if (isVariant && !baseCopy) {
            const msg = `Please generate the 'Full Copy' first for this version before creating a variation.`;
            setGenerationError(msg);
            updateLog(logId, { status: 'error', message: msg });
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generate');
            return;
        }

        try {
            let copy = '';
            let usage: UsageStats | undefined;

            if (isVariant) {
                const result = await geminiService.generateCopyVariant(baseCopy!, tab, {
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
                });
                copy = result.data;
                usage = result.usage;
                updateCurrentVersion(copy, tab);
            } else {
                const params: GenerationParams = {
                    address, includeAddress, details: propertyDetails, context: copyContext,
                    features: propertyFeatures, output: outputSettings,
                    imageAnalysis,
                    researchData, profileData, profileInclusion,
                    agentProfile,
                    openHouse
                };
                const result = await geminiService.generateCopy(params, 'Listing Copy');
                copy = result.data;
                usage = result.usage;

                if (isRegeneration) {
                    // When regenerating the master copy, we clear sibling tabs
                    // so the user knows they need to regenerate the rest.
                    // This fixes the "instant download" issue for stale content.
                    const updatedVersionSets = [...versionSets];
                    updatedVersionSets[activeVersionIndex] = { [tab]: copy };
                    setVersionSets(updatedVersionSets);
                } else if (versionSets.length === 0) {
                    createNewVersion(copy, tab);
                } else {
                    updateCurrentVersion(copy, tab);
                }
            }
            setActiveSubTab(tab);
            updateLog(logId, { status: 'success', outputs: copy.substring(0, 100) + '...', usage });

        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : `An error occurred while generating copy for ${tab}.`;
            setGenerationError(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generate');
        }
    };

    const handleGenerateAllMissing = async () => {
        const currentVersion = versionSets[activeVersionIndex];
        if (!currentVersion || !currentVersion['Full Copy']) {
            setNotification("Please generate the 'Full Copy' first.");
            return;
        }
        if (!beginCampaignOperation('generate-all', 'Campaign variation generation')) return;

        const missingTabs = ALL_CONTENT_TABS.filter(tab => !currentVersion[tab]);

        setIsGenerating(true);
        const logId = addLog({ stepName: 'Generate All Variations', status: 'pending', inputs: `Generating variations for ${missingTabs.length || 'all'} tabs` });

        try {
            const tabsToProcess = missingTabs.length > 0 ? missingTabs : ALL_CONTENT_TABS;
            const childUsages: Array<UsageStats | undefined> = [];

            for (const tab of tabsToProcess) {
                setGeneratingTab(tab);
                const result = await geminiService.generateCopyVariant(currentVersion['Full Copy']!, tab, {
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
                });
                childUsages.push(result.usage);

                setVersionSets(prev => {
                    const newSets = [...prev];
                    const current = { ...newSets[activeVersionIndex] };
                    current[tab] = result.data;
                    newSets[activeVersionIndex] = current;
                    return newSets;
                });
            }
            updateLog(logId, {
                status: 'success',
                message: 'All variations processed',
                usage: aggregateUsage('Generate All Variations', childUsages, 'mixed variant models')
            });
            setNotification("Campaign variations processed successfully!");
        } catch (error) {
            console.error("Error generating all variations:", error);
            const msg = error instanceof Error ? error.message : "Error generating variations.";
            setNotification(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsGenerating(false);
            setGeneratingTab(null);
            endCampaignOperation('generate-all');
        }
    };

    const handleTabClick = (mainTab: string, subTab: PreviewTab) => {
        setActiveMainTab(mainTab);
        setActiveSubTab(subTab);
        setIncludeContactDetails(false);
        const currentVersion = versionSets[activeVersionIndex];
        if (currentVersion && !currentVersion[subTab]) {
            generateCopyForTab(subTab);
        }
    };

    const contactCard = `\n\n---\nFor more information or to arrange a private inspection, please contact:\n\n${agentProfile.name || '[Agent Name]'}\n${agentProfile.agency || '[Agency Name]'}\n${agentProfile.phone || '[Phone]'}\n${agentProfile.email || '[Email]'}`;
    const contactCardRegex = new RegExp(`\\s*---\\s*For more information.*`, 's');

    const handleCopyEdit = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setVersionSets(prev => {
            const allVersions = [...prev];
            const currentVersion = { ...allVersions[activeVersionIndex] };
            currentVersion[activeSubTab] = newValue;
            allVersions[activeVersionIndex] = currentVersion;
            return allVersions;
        });
        setEditedStatus(prev => ({ ...prev, [activeSubTab]: true }));
        setSaveStatus('saving');
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
        if (hideSaveStatusTimeoutRef.current) clearTimeout(hideSaveStatusTimeoutRef.current);
        saveTimeoutRef.current = window.setTimeout(() => {
            setSaveStatus('saved');
            hideSaveStatusTimeoutRef.current = window.setTimeout(() => {
                setSaveStatus('idle');
            }, 2000);
        }, 750);
    };

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

    const handleRefineCopy = async (instruction: string) => {
        const currentVersion = versionSets[activeVersionIndex];
        const currentCopy = currentVersion ? currentVersion[activeSubTab] : undefined;
        if (!currentCopy) return;
        if (!beginCampaignOperation('refine', `${activeSubTab} refinement`)) return;
        setIsRefining(true);
        setGenerationError(null);
        const logId = addLog({ stepName: 'Refine Copy', status: 'pending', inputs: instruction });
        try {
            const result = await geminiService.refineCopy(currentCopy, instruction);
            const refinedCopy = result.data;
            if (activeSubTab === 'Full Copy') {
                // If master copy is refined, we effectively treat it like a new baseline
                const updatedVersionSets = [...versionSets];
                updatedVersionSets[activeVersionIndex] = { [activeSubTab]: refinedCopy };
                setVersionSets(updatedVersionSets);
            } else {
                updateCurrentVersion(refinedCopy, activeSubTab);
            }
            updateLog(logId, { status: 'success', outputs: refinedCopy.substring(0, 100) + '...', usage: result.usage });
        } catch (error) {
            console.error(error);
            const msg = error instanceof Error ? error.message : "An error occurred while refining copy.";
            setGenerationError(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsRefining(false);
            endCampaignOperation('refine');
        }
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

    const handleExportPdf = () => {
        const printArea = document.getElementById('print-render-area');
        if (printArea) {
            const currentCopy = versionSets[activeVersionIndex]?.[activeSubTab] || '';
            printArea.innerText = currentCopy;
            window.print();
        }
    };

    const handleSaveToTimeline = (copy: string) => {
        const newItem: TimelineItem = {
            id: new Date().toISOString(),
            date: new Date().toLocaleDateString(),
            address: address || 'Untitled',
            copyType: activeSubTab,
            copy: copy
        };
        setTimeline(prev => [newItem, ...prev]);
        setNotification('Saved to Timeline!');
    };

    const handleDeleteFromTimeline = (id: string) => {
        setTimeline(prev => prev.filter(item => item.id !== id));
        setNotification('Removed from Timeline.');
    };

    const handleDownloadAll = async (format: 'pdf' | 'word' | 'txt') => {
        const currentVersion = versionSets[activeVersionIndex];
        if (!currentVersion || !currentVersion['Full Copy']) {
            setNotification("Please generate the 'Full Copy' for the current version first.");
            return;
        }
        if (!beginCampaignOperation('download-full', 'Full campaign document download')) return;
        setIsDownloadingAll(true);
        setIsDownloadAllMenuOpen(false);
        setNotification("Preparing full campaign document...");
        const logId = addLog({ stepName: 'Download Full Campaign Document', status: 'pending', inputs: 'Generating missing sections for one combined document' });

        // Capture a snapshot for current state
        let updatedCopies = { ...versionSets[activeVersionIndex] };

        try {
            const childUsages: Array<UsageStats | undefined> = [];
            for (const tab of ALL_CONTENT_TABS) {
                if (!updatedCopies[tab]) {
                    setNotification(`Generating copy for ${tab}...`);
                    const result = await geminiService.generateCopyVariant(updatedCopies['Full Copy']!, tab, {
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
                    });
                    childUsages.push(result.usage);
                    updatedCopies[tab] = result.data;

                    // Update main state so UI is in sync
                    setVersionSets(prev => {
                        const newSets = [...prev];
                        const current = { ...newSets[activeVersionIndex] };
                        current[tab] = result.data;
                        newSets[activeVersionIndex] = current;
                        return newSets;
                    });
                }
            }

            const exportPlan = buildCampaignExportPlan({
                address,
                versionNumber: activeVersionIndex + 1,
                sections: updatedCopies,
                orderedTabs: ALL_CONTENT_TABS,
                selectedTab: activeSubTab,
                includeContactDetails,
                contactCard
            });

            if (format === 'word') handleExportWord(exportPlan.masterDocument.content, exportPlan.masterDocument.fileBaseName);
            else if (format === 'txt') handleExportTxt(exportPlan.masterDocument.content, exportPlan.masterDocument.fileBaseName);
            else if (format === 'pdf') {
                 const printArea = document.getElementById('print-render-area');
                 if (printArea) {
                     printArea.innerText = exportPlan.masterDocument.content;
                     window.print();
                 }
            }
            setNotification("Full campaign document downloaded.");
            updateLog(logId, {
                status: 'success',
                message: `Full campaign document ready with ${exportPlan.generatedSections.length} generated section(s).`,
                usage: aggregateUsage('Download All Missing Variants', childUsages, childUsages.length > 0 ? 'mixed variant models' : 'no model calls needed')
            });
        } catch (error) {
            console.error("Error during 'Download All':", error);
            const msg = error instanceof Error ? error.message : "An error occurred while generating all copy.";
            setNotification(msg);
            updateLog(logId, { status: 'error', message: msg });
        } finally {
            setIsDownloadingAll(false);
            endCampaignOperation('download-full');
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
    const isEdited = editedStatus[activeSubTab];
    const isCampaignBusy = activeCampaignOperation !== null;

    const allTabsGenerated = useMemo(() => {
        return ALL_CONTENT_TABS.every(tab => !!currentVersionSet[tab]);
    }, [currentVersionSet]);

    const currentCampaignExportPlan = useMemo(() => buildCampaignExportPlan({
        address,
        versionNumber: activeVersionIndex + 1,
        sections: currentVersionSet,
        orderedTabs: ALL_CONTENT_TABS,
        selectedTab: activeSubTab,
    }), [address, activeVersionIndex, currentVersionSet, activeSubTab]);
    const selectedSectionExportDocument = currentCampaignExportPlan.selectedSectionDocument;

    const renderVisualHighlights = () => {
        if (!imageAnalysis) return null;

        const parts = imageAnalysis.split(/(Image \d+:)/g).filter(p => p.trim());

        if (parts.length > 1) {
            const formatted = [];
            for (let i = 0; i < parts.length; i += 2) {
                const title = parts[i];
                const desc = parts[i + 1];
                if (desc) {
                    formatted.push(
                        <div key={i} className="mb-4">
                            <h4 className="font-bold text-gray-800 text-sm mb-1">{title}</h4>
                            <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{desc.trim()}</p>
                        </div>
                    );
                }
            }
            return <div>{formatted}</div>;
        }

        return <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-line">{imageAnalysis}</p>;
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
                                <span className="ml-2 text-gray-700">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</span>
                            </div>
                        ))}
                    </div>
                );
            } catch (e) {
                // Not valid JSON or failed to parse, fallback to raw text
            }
        }

        return <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-line">{content}</p>;
    };

    if (isCheckingBetaAccess) {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
                <div className="inline-flex items-center text-sm text-gray-600">
                    <Spinner className="mr-2" />
                    Checking beta access...
                </div>
            </div>
        );
    }

    if (!isBetaVerified) {
        return (
            <div className="min-h-screen bg-gray-50 text-gray-900 flex items-center justify-center px-4">
                <div className="w-full max-w-md bg-white border border-gray-200 rounded-lg shadow-sm p-6">
                    <div className="mb-6">
                        <h1 className="text-2xl text-gray-800">
                            <span className="font-bold">Real Estate AIM</span>
                            <span className="font-light text-gray-600"> | Copywriting Agent</span>
                        </h1>
                        <p className="text-sm text-gray-600 mt-2">Beta access is required before using the copywriting workspace.</p>
                    </div>
                    <form onSubmit={handleBetaAccessSubmit} className="space-y-4">
                        <div>
                            <label htmlFor="beta-access-code" className="block text-sm font-medium text-gray-700 mb-1">Beta access code</label>
                            <input
                                id="beta-access-code"
                                type="password"
                                value={betaCodeInput}
                                onChange={(event) => setBetaCodeInput(event.target.value)}
                                className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                autoComplete="off"
                            />
                        </div>
                        {betaAccessError && <p className="text-sm text-red-500">{betaAccessError}</p>}
                        <button
                            type="submit"
                            disabled={isVerifyingBetaAccess}
                            className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed"
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
        <div className="min-h-screen bg-gray-50 text-gray-900">
            {notification && (
                 <div className="fixed top-5 right-5 bg-green-500 text-white py-2 px-4 rounded-lg shadow-lg z-50 animate-fade-in-out">
                    {notification}
                 </div>
            )}
            <header className="bg-white border-b border-gray-200">
                <div className="container mx-auto px-6 py-4 flex justify-between items-center">
                    <div>
                        <h1 className="text-2xl text-gray-800">
                            <span className="font-bold">Real Estate AIM</span>
                            <span className="font-light text-gray-600"> | Copywriting Agent</span>
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => setIsTimelineModalOpen(true)} className="inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-red-600 transition-colors">
                           <IconClock />
                           <span>Timeline ({timeline.length})</span>
                        </button>
                    </div>
                </div>
            </header>
            {activeCampaignOperation && (
                <div className="bg-amber-50 border-b border-amber-200 px-6 py-2 text-sm text-amber-900">
                    <span className="font-semibold">Campaign action in progress:</span> {activeCampaignOperation.label}
                </div>
            )}

            <main id="app-main" className="container mx-auto px-4 py-6">
                 <div className="grid grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,1fr)] gap-6 h-[calc(100vh-120px)] items-start">

                    <div className="h-full lg:h-[calc(100vh-140px)] sticky top-6 flex flex-col">
                        <ActiveTaskMonitor imageFiles={imageFiles} isAnalyzing={isAnalyzingImages} />
                        <DebugPanel logs={debugLogs} />
                    </div>

                    <div className="space-y-8 h-full lg:overflow-y-auto lg:h-[calc(100vh-140px)] pr-2 pb-10 flex flex-col">

                        <Section title="Property Address">
                            <div className="space-y-4">
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={address}
                                        onChange={(e) => handleAddressChange(e.target.value)}
                                        onFocus={() => { if (address.length >= 3) setShowSuggestions(true); }}
                                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                                        placeholder="Start typing a property address..."
                                        className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                        autoComplete="off"
                                    />
                                    {isSuggesting && <Spinner className="absolute top-2.5 right-3 text-gray-400" />}
                                    {showSuggestions && addressSuggestions.length > 0 && (
                                        <ul className="absolute z-10 w-full bg-white border border-gray-300 rounded-md mt-1 shadow-lg max-h-60 overflow-y-auto">
                                            {addressSuggestions.map((s, i) => (
                                                <li
                                                    key={i}
                                                    onMouseDown={() => handleSuggestionClick(s)}
                                                    className="p-2 hover:bg-red-100 cursor-pointer text-sm"
                                                >
                                                    {s}
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                                <div className="flex justify-between items-center">
                                    <div className="flex items-center">
                                         <input
                                            type="checkbox"
                                            id="include-address"
                                            checked={includeAddress}
                                            onChange={(e) => setIncludeAddress(e.target.checked)}
                                            className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                                        />
                                        <label htmlFor="include-address" className="ml-2 block text-sm text-gray-900">
                                            Include property address in copy
                                        </label>
                                    </div>
                                    <button
                                        onClick={handleFetchDetails}
                                        disabled={isResearching || isCampaignBusy || !address.trim()}
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:bg-red-400 disabled:cursor-not-allowed w-auto justify-center"
                                    >
                                        {isResearching ? <Spinner className="mr-2" /> : <IconFileText className="mr-2"/>}
                                        {isResearching ? 'Fetching...' : 'Fetch Details'}
                                    </button>
                                </div>
                                {researchError && <p className="text-sm text-red-500 mt-2">{researchError}</p>}
                            </div>
                        </Section>

                        <Section title="Agent Profile">
                            <div className="space-y-3">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Agent Name</label>
                                    <input
                                        type="text"
                                        value={agentProfile.name}
                                        onChange={(e) => handleAgentChange('name', e.target.value)}
                                        placeholder="e.g. Dean Jones"
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Agency</label>
                                    <input
                                        type="text"
                                        value={agentProfile.agency}
                                        onChange={(e) => handleAgentChange('agency', e.target.value)}
                                        placeholder="e.g. One Lifestyle Real Estate"
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                                        <input
                                            type="text"
                                            value={agentProfile.phone}
                                            onChange={(e) => handleAgentChange('phone', e.target.value)}
                                            placeholder="04XX XXX XXX"
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                        <input
                                            type="email"
                                            value={agentProfile.email}
                                            onChange={(e) => handleAgentChange('email', e.target.value)}
                                            placeholder="dean@example.com"
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-xs font-semibold text-gray-700 mb-2">Inclusion Method:</p>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                            <input
                                                type="radio"
                                                name="agentMode"
                                                checked={agentProfile.inclusionMode === 'append'}
                                                onChange={() => handleAgentChange('inclusionMode', 'append')}
                                                className="mt-0.5 text-red-600 focus:ring-red-500"
                                            />
                                            <div className="text-sm">
                                                <span className="font-medium text-gray-800">Append Only</span>
                                                <p className="text-gray-500 text-xs">AI uses details for context. Toggle the "Contact Card" on the preview to append manually.</p>
                                            </div>
                                        </label>
                                        <label className="flex items-start gap-2 cursor-pointer p-2 rounded hover:bg-gray-50 border border-transparent hover:border-gray-200">
                                            <input
                                                type="radio"
                                                name="agentMode"
                                                checked={agentProfile.inclusionMode === 'integrate'}
                                                onChange={() => handleAgentChange('inclusionMode', 'integrate')}
                                                className="mt-0.5 text-red-600 focus:ring-red-500"
                                            />
                                            <div className="text-sm">
                                                <span className="font-medium text-gray-800">Integrate into Copy</span>
                                                <p className="text-gray-500 text-xs">AI weaves these details naturally into the generated copy.</p>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </Section>

                        <Section title="Open House Details">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                        <input
                                            type="text"
                                            value={openHouse.date}
                                            onChange={(e) => handleOpenHouseChange('date', e.target.value)}
                                            placeholder="e.g. Tuesday December 30"
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
                                        <input
                                            type="text"
                                            value={openHouse.time}
                                            onChange={(e) => handleOpenHouseChange('time', e.target.value)}
                                            placeholder="e.g. 4 PM - 4:45 PM"
                                            className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Listing URL</label>
                                    <input
                                        type="url"
                                        value={openHouse.url}
                                        onChange={(e) => handleOpenHouseChange('url', e.target.value)}
                                        placeholder="e.g. https://www.realestate.com.au/..."
                                        className="w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <p className="text-xs text-gray-500">Provide these to generate specific Open House social media and event collateral.</p>
                            </div>
                        </Section>

                        <Section title="Property Details">
                            {isFetchComplete && address && (
                                <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                    <p className="font-semibold text-gray-800 text-sm">{address}</p>
                                </div>
                            )}

                            <div className="mb-6 pb-4 border-b border-gray-200">
                                    <h4 className="font-semibold text-gray-700 mb-2">Additional Property Features:</h4>
                                    {isResearching ? (
                                        <div className="flex justify-center items-center p-4"><Spinner /></div>
                                    ) : keyFeatures && keyFeatures.length > 0 ? (
                                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-1 text-sm">
                                            {keyFeatures.map((line, index) => {
                                                const parts = line.split(':');
                                                const key = parts[0]?.trim() || line;
                                                const value = parts.slice(1).join(':').trim();
                                                if (!value) {
                                                    return (
                                                         <li key={index} className="flex justify-between border-b border-gray-100 py-1.5">
                                                             <span className="text-gray-800">• {key}</span>
                                                         </li>
                                                    )
                                                }
                                                return (
                                                    <li key={index} className="flex justify-between border-b border-gray-100 py-1.5">
                                                        <span className="font-semibold text-gray-800">{key}</span>
                                                        <span className="text-gray-600 text-right">{value}</span>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic">
                                            {researchData === null
                                                ? "Additional features discovered from online research will be listed here."
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
                                <label className="block text-sm font-medium text-gray-700 mb-1">Land Size (m²)</label>
                                <input type="number" value={propertyDetails.landSize ?? ''} onChange={(e) => handleDetailChange('landSize', e.target.value ? parseInt(e.target.value) : null)} className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500" />
                            </div>
                        </div>
                        <div className="mt-4">
                                <SelectInput label="Property Type" value={propertyDetails.propertyType} onChange={(v) => handleDetailChange('propertyType', v)} options={PROPERTY_TYPES} />
                        </div>
                        </Section>

                        <Section
                            title="Copy Context"
                            rightElement={
                                <div className="flex flex-col items-end gap-1">
                                    <button
                                        onClick={handleStrategyAnalysis}
                                        disabled={!isFetchComplete || isAnalyzingStrategy || isCampaignBusy}
                                        className="text-xs flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
                                    >
                                        {isAnalyzingStrategy ? <Spinner className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
                                        {copyContext.primaryTargetMarket !== 'Young Families' ? 'Redo AI Analysis' : 'AI Analysis'}
                                    </button>
                                </div>
                            }
                        >
                            <div className="space-y-4">
                                <div>
                                    <h3 className="block text-sm font-medium text-gray-700 mb-1">Target Market</h3>
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
                                    <h3 className="block text-sm font-medium text-gray-700 mb-2">Writing Style <span className="text-xs font-normal text-gray-500">(Max 2)</span></h3>
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
                                                            ? 'bg-red-600 text-white border-red-600'
                                                            : 'bg-white text-gray-600 border-gray-300 hover:border-red-400'
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
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Key features to highlight</label>
                                    <textarea
                                        rows={3}
                                        value={copyContext.featuresToHighlight}
                                        onChange={e => handleContextChange('featuresToHighlight', e.target.value)}
                                        placeholder="Key features to highlight..."
                                        className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Things to avoid / What not to write</label>
                                    <textarea
                                        rows={2}
                                        value={copyContext.thingsToAvoid}
                                        onChange={e => handleContextChange('thingsToAvoid', e.target.value)}
                                        placeholder="Clichés or words to avoid..."
                                        className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                                    />
                                </div>
                            </div>
                        </Section>

                        <Section
                            title="Property Features"
                            rightElement={
                                <div className="flex flex-col items-end gap-1">
                                    <button
                                        onClick={handleFeatureAnalysis}
                                        disabled={!isFetchComplete || isAnalyzingFeatures || isCampaignBusy}
                                        className="text-xs flex items-center gap-1 bg-red-50 text-red-600 px-2 py-1 rounded border border-red-200 hover:bg-red-100 disabled:opacity-50"
                                    >
                                        {isAnalyzingFeatures ? <Spinner className="w-3 h-3" /> : <IconSparkles className="w-3 h-3" />}
                                        {propertyFeatures ? 'Redo AI Analysis' : 'AI Analysis'}
                                    </button>
                                </div>
                            }
                        >
                            <textarea
                                rows={5}
                                value={propertyFeatures}
                                onChange={(e) => setPropertyFeatures(e.target.value)}
                                placeholder="List features, lifestyle aspects, upgrades..."
                                className="w-full border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-red-500"
                            />
                        </Section>

                        <Section title="Property Photos">
                            <div
                                onDrop={handleImageDrop}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                className={`flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-12 hover:bg-gray-50 transition-colors ${isDraggingOver ? 'bg-red-50 border-red-300' : 'border-gray-300'}`}
                            >
                                <input id="image-upload" type="file" multiple accept="image/*" onChange={handleImageUpload} className="hidden" />
                                <label htmlFor="image-upload" className="cursor-pointer flex flex-col items-center">
                                    <IconUpload className="w-10 h-10 text-gray-400 mb-2" />
                                    <span className="text-sm font-medium text-gray-700">Click to upload or drag and drop</span>
                                </label>
                            </div>

                            {imageFiles.length > 0 && (
                                <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {imageFiles.map((img, idx) => (
                                        <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-gray-200">
                                            <img src={img.url} alt={`Upload ${idx}`} className="w-full h-full object-cover" />
                                            <button onClick={() => handleImageDelete(idx)} className="absolute top-2 right-2 p-1.5 bg-white/80 rounded-full text-red-600 hover:text-red-700 transition-opacity">
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
                                     <input type="checkbox" id="include-visuals" checked={includeVisualHighlights} onChange={(e) => setIncludeVisualHighlights(e.target.checked)} className="h-4 w-4 text-red-600 border-gray-300 rounded focus:ring-red-500" />
                                     <label htmlFor="include-visuals" className="ml-2 block text-sm text-gray-900">Include visual analysis</label>
                                </div>
                                <button onClick={handleAnalyzeImages} disabled={imageFiles.length === 0 || isAnalyzingImages || isCampaignBusy} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-slate-800 hover:bg-slate-900 disabled:bg-slate-400">
                                    {isAnalyzingImages ? 'Analyzing...' : 'Analyze Photos'}
                                </button>
                            </div>
                        </Section>

                        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 sticky bottom-6 z-10">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-gray-700">~{outputSettings.wordCount} words</span>
                                <input type="range" min="50" max="1000" step="50" value={outputSettings.wordCount} onChange={(e) => setOutputSettings(prev => ({ ...prev, wordCount: parseInt(e.target.value) }))} className="w-1/2 h-1 bg-gray-300 rounded-lg appearance-none cursor-pointer accent-red-600" />
                            </div>
                            <button onClick={() => generateCopyForTab(activeSubTab, true)} disabled={isGenerating || isCampaignBusy} className="w-full inline-flex items-center justify-center px-4 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 transition-transform transform hover:scale-[1.01]">
                                {isGenerating && generatingTab === activeSubTab ? <Spinner className="mr-2" /> : <IconSparkles className="mr-2 w-5 h-5" />}
                                {currentCopy ? 'Regenerate Copy' : 'Generate Listing Copy'}
                            </button>
                        </div>
                    </div>

                    <div className="h-full flex flex-col space-y-6 overflow-y-auto pr-2">
                         <Section title="Property Overview">
                             {researchData ? (
                                 <div>
                                     <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">{researchData}</p>
                                     {groundingSources.length > 0 && (
                                         <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-2">
                                             {groundingSources.map((source, idx) => (
                                                 <a key={idx} href={source.uri} target="_blank" rel="noopener noreferrer" className="inline-flex items-center bg-red-50 text-red-700 hover:bg-red-100 rounded-full px-3 py-1 text-xs truncate max-w-[150px]">
                                                     {source.type === 'maps' ? <IconMapPin className="w-3 h-3 mr-1" /> : <IconWorld className="w-3 h-3 mr-1" />}
                                                     {source.title}
                                                 </a>
                                             ))}
                                         </div>
                                     )}
                                 </div>
                             ) : (
                                 <Placeholder icon={<IconFileText />} title="Property Overview" description="Fetch details to gather information." />
                             )}
                         </Section>

                         <Section title="Suburb & Area Profile">
                             {profileData ? (
                                 <div>
                                    <div className="flex flex-col gap-2 mb-4 p-3 bg-gray-50 border border-gray-200 rounded-md">
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">COPYWRITING INCLUSION SETTINGS:</p>
                                        <div className="flex flex-wrap gap-4 text-xs">
                                            {['none', 'suburb', 'area', 'both'].map(m => (
                                                <label key={m} className="flex items-center cursor-pointer capitalize font-medium">
                                                    <input type="radio" checked={profileInclusion === m} onChange={() => setProfileInclusion(m as any)} className="mr-1.5 text-red-600 focus:ring-red-500" />
                                                    {m}
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="space-y-6">
                                        {profileData.suburb && (
                                            <div>
                                                <h4 className={`font-bold text-gray-800 text-sm mb-2 uppercase tracking-wider border-b border-gray-100 pb-1 ${(profileInclusion === 'suburb' || profileInclusion === 'both') ? 'text-red-700' : 'opacity-60'}`}>
                                                    Suburb Insight {(profileInclusion === 'suburb' || profileInclusion === 'both') ? '' : '(Preview)'}
                                                </h4>
                                                <div className={(profileInclusion === 'suburb' || profileInclusion === 'both') ? '' : 'opacity-70'}>
                                                    {renderProfileContent(profileData.suburb)}
                                                </div>
                                            </div>
                                        )}
                                        {profileData.area && (
                                            <div>
                                                <h4 className={`font-bold text-gray-800 text-sm mb-2 uppercase tracking-wider border-b border-gray-100 pb-1 ${(profileInclusion === 'area' || profileInclusion === 'both') ? 'text-red-700' : 'opacity-60'}`}>
                                                    Regional Context {(profileInclusion === 'area' || profileInclusion === 'both') ? '' : '(Preview)'}
                                                </h4>
                                                <div className={(profileInclusion === 'area' || profileInclusion === 'both') ? '' : 'opacity-70'}>
                                                    {renderProfileContent(profileData.area)}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                 </div>
                             ) : (
                                 <Placeholder icon={<IconMapPin />} title="Suburb & Area Profile" description="Local insights appear here." />
                             )}
                         </Section>

                         <Section title="Visual Highlights">
                             {imageAnalysis ? renderVisualHighlights() : <Placeholder icon={<IconCamera />} title="Visual Analysis" description="Analyze photos to see features." />}
                         </Section>

                         <Section title="Preview">
                             {!currentCopy && !generatingTab ? (
                                 <Placeholder icon={<IconSparkles />} title="Generated Copy" description="Generated content will appear here." />
                             ) : (
                                 <div className="flex flex-col">
                                     <div className="border-b border-gray-200 mb-4 pb-4">
                                         <div className="flex overflow-x-auto no-scrollbar border-b border-gray-100 mb-2">
                                             {mainTabs.map(tab => (
                                                 <button key={tab} onClick={() => handleTabClick(tab, previewTabConfig[tab][0])} className={`px-4 py-2 text-sm font-medium border-b-2 ${activeMainTab === tab ? 'border-red-600 text-red-600' : 'border-transparent text-gray-500'}`}>{tab}</button>
                                             ))}
                                         </div>
                                         <div className="flex overflow-x-auto no-scrollbar py-2 gap-2 mb-2">
                                             {previewTabConfig[activeMainTab].map(subTab => (
                                                 <button key={subTab} onClick={() => handleTabClick(activeMainTab, subTab)} className={`px-3 py-1.5 text-xs font-medium rounded-full ${activeSubTab === subTab ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{subTab}</button>
                                             ))}
                                         </div>

                                         {/* Version & Campaign Control Bar */}
                                         <div className="flex flex-wrap justify-between items-center gap-3 text-xs text-gray-600 bg-gray-50 p-2.5 rounded border border-gray-100 mb-4">
                                             <div className="flex items-center gap-2">
                                                 <button onClick={() => setActiveVersionIndex(v => Math.max(0, v - 1))} disabled={activeVersionIndex === 0} className="p-1 rounded hover:bg-white disabled:opacity-20"><IconChevronLeft className="w-4 h-4" /></button>
                                                 <span className="font-bold text-gray-700 min-w-[70px] text-center">Version {activeVersionIndex + 1} / {Math.max(1, versionSets.length)}</span>
                                                 <button onClick={() => setActiveVersionIndex(v => Math.min(versionSets.length - 1, v + 1))} disabled={activeVersionIndex >= versionSets.length - 1} className="p-1 rounded hover:bg-white disabled:opacity-20"><IconChevronRight className="w-4 h-4" /></button>
                                             </div>

                                             <div className="flex items-center gap-2">
                                                 <button
                                                    onClick={handleGenerateAllMissing}
                                                    disabled={isGenerating || isCampaignBusy || !currentVersionSet['Full Copy']}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-bold transition-all border ${allTabsGenerated ? 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'} disabled:opacity-50`}
                                                 >
                                                    <IconSparkles className="w-3 h-3" />
                                                    {allTabsGenerated ? 'Regenerate Campaign' : 'Generate Missing Tabs'}
                                                 </button>

                                                 <div className="relative" ref={downloadAllMenuRef}>
                                                     <button
                                                        onClick={() => setIsDownloadAllMenuOpen(!isDownloadAllMenuOpen)}
                                                        disabled={isDownloadingAll || isCampaignBusy || !currentVersionSet['Full Copy']}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-md font-bold hover:bg-slate-900 disabled:bg-slate-400 transition-all"
                                                     >
                                                         {isDownloadingAll ? <Spinner className="w-3 h-3" /> : <IconDownload className="w-3 h-3" />}
                                                         Download full campaign document
                                                     </button>
                                                     {isDownloadAllMenuOpen && (
                                                         <div className="absolute top-full right-0 mt-2 w-60 bg-white rounded-md shadow-xl border border-gray-200 py-1.5 z-50">
                                                             <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">One combined document</p>
                                                             <p className="px-4 pb-2 text-[11px] leading-snug text-gray-500">Full campaign includes all generated sections in one document.</p>
                                                             <button onClick={() => handleDownloadAll('word')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><IconFileWord className="w-4 h-4 mr-2 text-blue-600" /> Word (.doc)</button>
                                                             <button onClick={() => handleDownloadAll('txt')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><IconFileTxt className="w-4 h-4 mr-2 text-gray-600" /> Text (.txt)</button>
                                                             <button onClick={() => handleDownloadAll('pdf')} className="flex items-center w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"><IconFilePdf className="w-4 h-4 mr-2 text-red-600" /> Print / PDF</button>
                                                         </div>
                                                     )}
                                                 </div>
                                             </div>
                                         </div>
                                     </div>

                                     {generatingTab && generatingTab === activeSubTab ? (
                                         <div className="h-64 flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300">
                                             <Spinner className="w-8 h-8 text-red-600 mb-3" />
                                             <p className="text-gray-500 text-sm">Generating {generatingTab}...</p>
                                         </div>
                                     ) : (
                                         <textarea className="w-full p-4 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 text-gray-800 leading-relaxed text-sm min-h-[400px] shadow-sm font-sans" value={currentCopy} onChange={handleCopyEdit} placeholder="Your copy will appear here..." />
                                     )}

                                     <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col space-y-3">
                                         <div className="flex items-center gap-2">
                                             <input type="text" placeholder={`Refine this ${activeSubTab}...`} className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-sm" onKeyDown={e => e.key === 'Enter' && (handleRefineCopy((e.target as any).value), (e.target as any).value = '')} />
                                             <button disabled={!currentCopy || isRefining || isCampaignBusy} onClick={e => (handleRefineCopy((e.currentTarget.previousElementSibling as any).value), (e.currentTarget.previousElementSibling as any).value = '')} className="bg-gray-200 text-gray-700 p-2 rounded-md disabled:opacity-50">{isRefining ? <Spinner /> : <IconSend className="w-4 h-4" />}</button>
                                         </div>

                                         <div className="flex justify-between items-center">
                                             <button onClick={() => handleToggleContactDetails(!includeContactDetails)} className={`px-3 py-2 border text-sm font-medium rounded-md ${includeContactDetails ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-gray-300 text-gray-700'}`}>Contact Card</button>
                                             <div className="flex gap-2">
                                                 <button onClick={() => handleCopyToClipboard(currentCopy)} title="Copy current to clipboard" className="p-2 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"><IconClipboard /></button>
                                                 <div className="relative" ref={exportMenuRef}>
                                                     <button onClick={() => setIsExportMenuOpen(!isExportMenuOpen)} title="Download current section" className="inline-flex items-center gap-1.5 px-3 py-2 text-gray-700 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors font-medium text-xs">
                                                         <IconDownload className="w-4 h-4" />
                                                         Download current section
                                                     </button>
                                                     {isExportMenuOpen && (
                                                         <div className="absolute bottom-full right-0 mb-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 py-1 z-20">
                                                             <p className="px-4 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-50 mb-1">Selected section only</p>
                                                             <button onClick={() => { handleExportWord(selectedSectionExportDocument?.content || currentCopy, selectedSectionExportDocument?.fileBaseName || `${activeSubTab}`); setIsExportMenuOpen(false); }} className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"><IconFileWord className="w-4 h-4 mr-2" /> Word (.doc)</button>
                                                             <button onClick={() => { handleExportTxt(selectedSectionExportDocument?.content || currentCopy, selectedSectionExportDocument?.fileBaseName || `${activeSubTab}`); setIsExportMenuOpen(false); }} className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"><IconFileTxt className="w-4 h-4 mr-2" /> Text (.txt)</button>
                                                             <button onClick={() => { handleExportPdf(); setIsExportMenuOpen(false); }} className="flex items-center w-full text-left px-4 py-2 text-sm hover:bg-gray-100 text-gray-700"><IconFilePdf className="w-4 h-4 mr-2" /> Print / PDF</button>
                                                         </div>
                                                     )}
                                                 </div>
                                                 <button onClick={() => handleSaveToTimeline(currentCopy)} title="Save current to timeline" className="p-2 text-gray-500 border border-gray-200 rounded-md hover:bg-gray-50 transition-colors"><IconClock /></button>
                                             </div>
                                         </div>
                                     </div>
                                 </div>
                             )}
                         </Section>
                    </div>
                 </div>

                 <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900">
                    AI-generated copy must be reviewed before publication. Check property claims against source material, review public web research and attribution, and do not rely on AI output for legal, valuation or compliance advice. Users are responsible for rights, accuracy and publication decisions.
                 </div>

                 <ChatBot onUsage={handleChatUsage} />

                 {isTimelineModalOpen && (
                     <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                         <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                             <div className="p-4 border-b flex justify-between items-center">
                                 <h3 className="text-lg font-bold">Timeline</h3>
                                 <button onClick={() => setIsTimelineModalOpen(false)}><IconX /></button>
                             </div>
                             <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                 {timeline.length === 0 ? <div className="text-center py-10">No saved items.</div> : timeline.map(item => (
                                     <div key={item.id} className="border rounded-lg p-4 hover:bg-gray-50">
                                         <div className="flex justify-between items-start mb-2">
                                             <div><h4 className="font-bold">{item.address}</h4><span className="text-xs">{item.copyType} • {item.date}</span></div>
                                             <button onClick={() => handleDeleteFromTimeline(item.id)} className="text-red-500"><IconTrash className="w-4 h-4" /></button>
                                         </div>
                                         <p className="text-sm line-clamp-3">{item.copy}</p>
                                     </div>
                                 ))}
                             </div>
                         </div>
                     </div>
                 )}
                 <div id="print-render-area" className="hidden"></div>
            </main>
        </div>
    );
};

export default App;
