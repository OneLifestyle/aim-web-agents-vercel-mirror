import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  CampaignOutputDocument,
  CampaignStageId,
  CampaignSuggestion,
  CopywritingProductId,
  ImageContent,
  LandUnit,
  PreviewTab,
  ReviewedClaim,
  ReviewedFact,
  ReviewedPhotoHighlight,
  SuggestionGovernanceContext,
} from './types';
import {
  analyzeFeatures,
  analyzeSingleImage,
  analyzeStrategy,
  CopywritingRequestError,
  generateCopy,
  generateCopyVariant,
  hasVerifiedBetaAccess,
  researchProperty,
  suggestAddresses,
  verifyBetaAccess,
} from './services/geminiService';
import {
  assembleGenerationParamsFromApprovedSnapshot,
  buildApprovedBriefSnapshot,
  CAMPAIGN_PACK_OUTPUT_ORDER,
  CANONICAL_OUTPUT_GROUPS,
  CANONICAL_OUTPUT_ORDER,
  createInitialCampaignSessionState,
  deriveBriefApprovalPresentation,
  deriveCampaignPackState,
  getApprovedBriefBlockers,
  getOutputGroup,
  governSuggestions,
  markOutputsNeedsRegeneration,
  markPackChildrenNeedsRegenerationForFoundation,
  OUTPUT_PRESENTATION_BY_ID,
  sanitizeCorrectedClaimContext,
  stripPhotoDependentDirection,
  validateReturnedOutput,
  type CampaignSessionState,
} from './domain';
import {
  assertNetworkAllowed,
  FIXTURE_CATALOGUE,
  getFixtureState,
  REQUIRED_FIXTURE_IDS,
  resolveDevelopmentFixture,
  runDevelopmentFixtureAssertions,
  type FixtureId,
} from './fixtures';
import {
  buildGuidedExportPlan,
  buildGuidedExportReceipt,
  type GuidedExportFormat,
  type GuidedExportReceipt,
  type GuidedExportScope,
} from './utils/guidedExport';
import { fileToBase64 } from './utils/fileUtils';
import { BetaGate } from './components/BetaGate';
import { CampaignBar } from './components/CampaignBar';
import { ExportPanel } from './components/ExportPanel';
import { Overlay } from './components/Overlay';
import { OutputWorkspace, DocumentNavigatorList } from './components/OutputWorkspace';
import { ReviewedBriefProof } from './components/ReviewedBriefProof';
import { StageNavigation, type StageNavigationState } from './components/StageNavigation';
import { BriefStage } from './components/stages/BriefStage';
import { CampaignStage } from './components/stages/CampaignStage';
import { PhotosStage } from './components/stages/PhotosStage';
import { PropertyStage } from './components/stages/PropertyStage';

const IS_DEVELOPMENT = Boolean((import.meta as ImportMeta & { env?: { DEV?: boolean } }).env?.DEV);
const FIXTURE_ASSERTIONS = runDevelopmentFixtureAssertions(IS_DEVELOPMENT);
const TEMPORARY_SESSION_MARKER = 'copywritingTemporaryCampaignStarted.v2';

const formatError = (error: unknown, fallback: string): string => {
  if (error instanceof CopywritingRequestError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return fallback;
};

const createSessionId = (): string => `session-${Date.now().toString(36)}`;

const createInitialSession = (): CampaignSessionState => {
  const fixture = typeof window === 'undefined'
    ? null
    : resolveDevelopmentFixture(window.location.search, IS_DEVELOPMENT);
  if (fixture) return fixture;
  return createInitialCampaignSessionState({
    sessionId: createSessionId(),
    gateState: hasVerifiedBetaAccess() ? 'verified' : 'locked',
  });
};

const reconcilePackState = (state: CampaignSessionState): CampaignSessionState => {
  const derived = deriveCampaignPackState(state.outputs);
  return {
    ...state,
    pack: {
      ...state.pack,
      state: derived.state,
      succeededOutputIds: derived.readyOutputIds,
      failedOutputIds: derived.failedOutputIds,
      remainingOutputIds: derived.remainingOutputIds,
      retryOutputIds: derived.retryOutputIds,
    },
  };
};

type GovernedStage = 'property' | 'campaign' | 'photos' | 'people' | 'settings';

const invalidateGovernedState = (
  state: CampaignSessionState,
  stage: GovernedStage,
): CampaignSessionState => {
  const invalidatedOutputs = markOutputsNeedsRegeneration(state.outputs, 'brief.pending-reapproval');
  return reconcilePackState({
    ...state,
    property: {
      ...state.property,
      approved: stage === 'property' ? false : state.property.approved,
    },
    campaign: {
      ...state.campaign,
      approved: stage === 'property' || stage === 'campaign' ? false : state.campaign.approved,
    },
    photos: {
      ...state.photos,
      approved: stage === 'photos' ? false : state.photos.approved,
    },
    brief: {
      ...state.brief,
      approved: false,
    },
    outputs: invalidatedOutputs,
  });
};

const splitProposalText = (value: string): string[] => value
  .replace(/\r/g, '')
  .split(/\n|;|•/)
  .map(item => item.replace(/^[-*\d.)\s]+/, '').trim())
  .filter(Boolean)
  .slice(0, 8);

const releaseAppliedSuggestion = (suggestion: CampaignSuggestion): CampaignSuggestion => {
  const { application: _application, ...released } = suggestion;
  return { ...released, state: 'suggested' };
};

const claimAliases = (sourceText: string, approvedText = sourceText): string[] => {
  const values = [sourceText, approvedText];
  values.forEach(value => {
    values.push(value.replace(/-/g, ' '));
    values.push(value.replace(/\bsix\b/gi, '6'));
  });
  const normalizedValues = values.map(value => value.toLocaleLowerCase('en-AU').replace(/[^a-z0-9]+/g, ' ').trim());
  if (normalizedValues.some(value => (
    value === 'six car garage'
    || value === '6 car garage'
    || value === 'six vehicle garage'
    || value === 'parking for six'
  ))) {
    values.push('six-car garage', 'six car garage', '6-car garage', 'six vehicle garage', 'parking for six');
  }
  return Array.from(new Set(values.map(value => value.trim()).filter(Boolean)));
};

type GovernedReviewDraft =
  | {
    kind: 'fact';
    factKey: ReviewedFact['key'];
    label: string;
    provenance: string;
    sourceValue: string | number | null;
    sourceUnit?: LandUnit;
    value: string;
    unit?: LandUnit;
  }
  | {
    kind: 'claim' | 'highlight';
    action: 'correct' | 'exclude';
    id: string;
    label: string;
    provenance: string;
    sourceText: string;
    value: string;
    reason: string;
  };

const getCampaignAnalysisRevision = (state: CampaignSessionState): string => JSON.stringify({
  sessionId: state.sessionId,
  address: state.address.selectedLabel,
  propertyApproved: state.property.approved,
  facts: state.property.facts.map(fact => [fact.key, fact.approvedValue, fact.unit, fact.state]),
  claims: state.property.claims.map(claim => [claim.id, claim.approvedText, claim.state]),
  overview: state.property.overview,
  overviewState: state.property.overviewState,
  suburbContext: state.property.suburbContext,
  areaContext: state.property.areaContext,
  profileInclusion: state.property.profileInclusion,
  photoPolicy: state.photos.policy,
  photosApproved: state.photos.approved,
  selectedPhotos: state.photos.items.filter(photo => photo.selected).map(photo => [photo.id, photo.analysisState]),
  highlights: state.photos.highlights.map(highlight => [highlight.id, highlight.approvedText, highlight.state]),
});

const createGovernanceContext = (state: CampaignSessionState): SuggestionGovernanceContext => ({
  approvedFacts: {
    bedrooms: state.property.facts.find(fact => fact.key === 'bedrooms')?.approvedValue as number | null,
    bathrooms: state.property.facts.find(fact => fact.key === 'bathrooms')?.approvedValue as number | null,
    carSpaces: state.property.facts.find(fact => fact.key === 'carSpaces')?.approvedValue as number | null,
    landValue: state.property.facts.find(fact => fact.key === 'landValue')?.approvedValue as number | null,
    landUnit: state.property.facts.find(fact => fact.key === 'landValue')?.unit ?? 'm²',
    propertyType: String(state.property.facts.find(fact => fact.key === 'propertyType')?.approvedValue ?? ''),
  },
  factProvenance: state.property.facts.map(fact => ({
    key: fact.key,
    sourceValue: fact.sourceValue,
    approvedValue: fact.approvedValue,
    sourceUnit: fact.sourceUnit,
    unit: fact.unit,
    provenance: fact.provenance,
    state: fact.state,
  })),
  hardExclusions: state.property.claims
    .filter(claim => claim.state === 'excluded')
    .map(claim => ({
      id: claim.id,
      text: claim.approvedText || claim.sourceText,
      aliases: claimAliases(claim.sourceText, claim.approvedText),
      provenance: claim.provenance,
      reason: claim.reason,
    })),
  photoContextPolicy: state.photos.policy,
});

const stateLabel = (state: CampaignOutputDocument['state']): string => {
  if (state === 'not-generated') return 'Not generated';
  if (state === 'queued') return 'Queued';
  if (state === 'generating') return 'Generating';
  if (state === 'ready') return 'Ready';
  if (state === 'needs-review') return 'Integrity conflict';
  if (state === 'needs-regeneration') return 'Needs regeneration';
  return 'Failed';
};

const escapeHtml = (value: string): string => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const App: React.FC = () => {
  const [session, setSession] = useState<CampaignSessionState>(createInitialSession);
  const [isCheckingBetaAccess, setIsCheckingBetaAccess] = useState(() => (
    !session.fixture.id && session.gate.state === 'locked'
  ));
  const [betaCode, setBetaCode] = useState('');
  const [betaSubmitting, setBetaSubmitting] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | undefined>(undefined);
  const [locationStatus, setLocationStatus] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [isAnalysingCampaign, setIsAnalysingCampaign] = useState(false);
  const [campaignAnalysisError, setCampaignAnalysisError] = useState<string | null>(null);
  const [isAnalysingPhotos, setIsAnalysingPhotos] = useState(false);
  const [photoAnalysisProgress, setPhotoAnalysisProgress] = useState<{
    completed: number;
    total: number;
    currentPhotoId: string | null;
  } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [exportScope, setExportScope] = useState<GuidedExportScope>('current_output');
  const [exportFormat, setExportFormat] = useState<GuidedExportFormat>('word');
  const [includeContactDetails, setIncludeContactDetails] = useState(false);
  const [exportReceipt, setExportReceipt] = useState<GuidedExportReceipt | null>(null);
  const [exportPreparedAt, setExportPreparedAt] = useState(() => new Date());
  const [copyStatus, setCopyStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [governedReviewDraft, setGovernedReviewDraft] = useState<GovernedReviewDraft | null>(null);
  const [previousTemporarySession] = useState(() => (
    typeof window !== 'undefined'
    && !resolveDevelopmentFixture(window.location.search, IS_DEVELOPMENT)
    && window.sessionStorage.getItem(TEMPORARY_SESSION_MARKER) === 'started'
  ));

  const stageHeadingRef = useRef<HTMLHeadingElement>(null);
  const outputHeadingRef = useRef<HTMLHeadingElement>(null);
  const pendingStageFocusTargetRef = useRef<string | null>(null);
  const suggestionAbortRef = useRef<AbortController | null>(null);
  const researchAbortRef = useRef<AbortController | null>(null);
  const researchRequestRef = useRef(0);
  const suggestionCacheRef = useRef(new Map<string, string[]>());
  const suggestionRequestRef = useRef(0);
  const photoPayloadsRef = useRef(new Map<string, ImageContent>());
  const photoIngestingRef = useRef(false);
  const photoIngestRequestRef = useRef(0);
  const optionalGateChecksRef = useRef(new Set<string>());

  const updateSession = useCallback((updater: (current: CampaignSessionState) => CampaignSessionState) => {
    setSession(current => reconcilePackState(updater(current)));
  }, []);

  const focusResultById = useCallback((id: string) => {
    window.setTimeout(() => {
      const target = document.getElementById(id);
      if (!target) return;
      target.setAttribute('tabindex', '-1');
      target.focus();
    }, 0);
  }, []);

  const focusOutputHeading = useCallback(() => {
    window.setTimeout(() => outputHeadingRef.current?.focus(), 0);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || session.fixture.id) return;
    window.sessionStorage.setItem(TEMPORARY_SESSION_MARKER, 'started');
  }, [session.fixture.id]);

  useEffect(() => {
    if (session.fixture.id || session.fixture.networkPolicy === 'forbid') {
      setIsCheckingBetaAccess(false);
      return;
    }
    if (session.gate.state !== 'locked') {
      setIsCheckingBetaAccess(false);
      return;
    }
    if (optionalGateChecksRef.current.has(session.sessionId)) return;
    optionalGateChecksRef.current.add(session.sessionId);
    setIsCheckingBetaAccess(true);
    const checkedSessionId = session.sessionId;
    verifyBetaAccess('')
      .then(() => {
        updateSession(current => current.sessionId === checkedSessionId && !current.fixture.id
          ? { ...current, gate: { state: 'verified', error: null } }
          : current);
      })
      .catch(() => {
        updateSession(current => current.sessionId === checkedSessionId && !current.fixture.id
          ? { ...current, gate: { state: 'locked', error: null } }
          : current);
      })
      .finally(() => {
        setIsCheckingBetaAccess(false);
      });
  }, [session.fixture.id, session.fixture.networkPolicy, session.gate.state, session.sessionId, updateSession]);

  useEffect(() => {
    if (session.stage === 'outputs') return;
    window.scrollTo({ top: 0, behavior: 'auto' });
    const pendingTargetId = pendingStageFocusTargetRef.current;
    pendingStageFocusTargetRef.current = null;
    const timer = window.setTimeout(() => {
      const pendingTarget = pendingTargetId ? document.getElementById(pendingTargetId) : null;
      if (pendingTarget) {
        pendingTarget.setAttribute('tabindex', '-1');
        pendingTarget.focus();
        return;
      }
      stageHeadingRef.current?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [session.stage]);

  useEffect(() => {
    if (session.stage !== 'outputs') return;
    const timer = window.setTimeout(() => outputHeadingRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [session.activeOutputId, session.stage]);

  useEffect(() => {
    const query = session.address.query.trim();
    const selectedMatches = session.address.selectedLabel?.trim().toLocaleLowerCase('en-AU')
      === query.toLocaleLowerCase('en-AU');
    suggestionAbortRef.current?.abort();
    if (query.length < 5 || selectedMatches || session.gate.state !== 'verified') {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      setIsSuggesting(false);
      return;
    }

    const cached = suggestionCacheRef.current.get(query.toLocaleLowerCase('en-AU'));
    if (cached) {
      setSuggestions(cached);
      setActiveSuggestionIndex(cached.length > 0 ? 0 : -1);
      return;
    }

    const requestId = suggestionRequestRef.current + 1;
    suggestionRequestRef.current = requestId;
    const controller = new AbortController();
    suggestionAbortRef.current = controller;
    const timer = window.setTimeout(async () => {
      setIsSuggesting(true);
      try {
        assertNetworkAllowed(session, 'suggestAddresses');
        const response = await suggestAddresses(query, userLocation, controller.signal);
        if (suggestionRequestRef.current !== requestId || controller.signal.aborted) return;
        const nextSuggestions = response.data.filter(Boolean).slice(0, 8);
        suggestionCacheRef.current.set(query.toLocaleLowerCase('en-AU'), nextSuggestions);
        setSuggestions(nextSuggestions);
        setActiveSuggestionIndex(nextSuggestions.length > 0 ? 0 : -1);
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setFetchError(formatError(error, 'Address suggestions are unavailable.'));
        setSuggestions([]);
      } finally {
        if (suggestionRequestRef.current === requestId) setIsSuggesting(false);
      }
    }, 450);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [session.address.query, session.address.selectedLabel, session.fixture.activationMarker, session.fixture.networkPolicy, session.gate.state, userLocation]);

  const activeOutputId = session.activeOutputId ?? 'Full Copy';
  const packState = useMemo(() => deriveCampaignPackState(session.outputs), [session.outputs]);
  const briefBlockers = useMemo(() => getApprovedBriefBlockers(session), [session]);
  const briefApprovalPresentation = useMemo(
    () => deriveBriefApprovalPresentation(session, briefBlockers),
    [briefBlockers, session],
  );
  const campaignApprovalIssues = useMemo(() => getApprovedBriefBlockers({
    ...session,
    campaign: { ...session.campaign, approved: true },
  })
    .filter(blocker => blocker.governingStage === 'campaign')
    .map(blocker => blocker.message), [session]);
  const exportCategories = useMemo(() => CANONICAL_OUTPUT_GROUPS.map(group => ({
    title: group.label,
    tabs: [...group.outputIds],
  })), []);
  const selectedOutputGroup = getOutputGroup(activeOutputId).label;
  const contactCard = useMemo(() => {
    return [
      session.people.agentIncluded ? session.people.agent.name : '',
      session.people.agentIncluded ? session.people.agent.title : '',
      session.people.agencyIncluded ? session.people.agencyName : '',
      session.people.agentIncluded ? session.people.agent.phone : '',
      session.people.agentIncluded ? session.people.agent.email : '',
    ].filter(Boolean).join('\n');
  }, [session.people]);
  const exportPlan = useMemo(() => buildGuidedExportPlan({
    address: session.address.selectedLabel ?? session.address.query,
    documents: CANONICAL_OUTPUT_ORDER.map(outputId => session.outputs[outputId]),
    orderedTabs: CANONICAL_OUTPUT_ORDER,
    categories: exportCategories,
    selectedTab: activeOutputId,
    selectedGroup: selectedOutputGroup,
    scope: exportScope,
    format: exportFormat,
    activeSnapshotId: session.brief.snapshot?.snapshotId ?? null,
    generatedAt: exportPreparedAt,
    includeContactDetails,
    contactCard,
    includeAddressInCopy: session.address.includeInCopy,
    campaignPackOutputIds: CAMPAIGN_PACK_OUTPUT_ORDER,
    outputLabels: Object.fromEntries(CANONICAL_OUTPUT_ORDER.map(outputId => [outputId, OUTPUT_PRESENTATION_BY_ID[outputId].label])),
  }), [
    activeOutputId,
    contactCard,
    exportCategories,
    exportFormat,
    exportPreparedAt,
    exportScope,
    includeContactDetails,
    selectedOutputGroup,
    session.address.includeInCopy,
    session.address.query,
    session.address.selectedLabel,
    session.brief.snapshot?.snapshotId,
    session.outputs,
  ]);

  const handleBetaSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!betaCode.trim() || betaSubmitting) return;
    setBetaSubmitting(true);
    updateSession(current => ({ ...current, gate: { state: 'locked', error: null } }));
    try {
      assertNetworkAllowed(session, 'verifyBetaAccess');
      await verifyBetaAccess(betaCode);
      setBetaCode('');
      updateSession(current => ({ ...current, gate: { state: 'verified', error: null } }));
    } catch (error) {
      updateSession(current => ({
        ...current,
        gate: { state: 'error', error: formatError(error, 'Access could not be verified.') },
      }));
    } finally {
      setBetaSubmitting(false);
    }
  };

  const handleStageSelect = (stage: CampaignStageId, targetId?: string) => {
    const stageChanged = stage !== session.stage;
    if (stage === 'outputs' && briefApprovalPresentation.state !== 'APPROVED') {
      updateSession(current => ({ ...current, stage: 'brief' }));
      setNotice('Approve the Reviewed Campaign Brief before opening Outputs.');
      return;
    }
    if (stage !== 'outputs' && briefApprovalPresentation.state === 'APPROVED') {
      setNotice('You are reviewing an approved value. Any applied change will reopen brief approval and mark existing outputs Needs regeneration; no generation starts automatically.');
    }
    updateSession(current => ({
      ...current,
      stage,
      activeOutputId: stage === 'outputs' ? current.activeOutputId ?? 'Full Copy' : current.activeOutputId,
    }));
    if (targetId && stageChanged) pendingStageFocusTargetRef.current = targetId;
    if (targetId && !stageChanged) focusResultById(targetId);
  };

  const handleProductChange = (product: CopywritingProductId) => {
    updateSession(current => {
      if (current.product === product) return current;
      return invalidateGovernedState({
        ...current,
        product,
        activeOutputId: product === 'listing-copy' ? 'Full Copy' : current.activeOutputId,
      }, 'property');
    });
    if (product === 'listing-copy' && exportScope === 'campaign_pack') setExportScope('current_output');
  };

  const handleAddressChange = (value: string) => {
    researchRequestRef.current += 1;
    researchAbortRef.current?.abort();
    setIsFetching(false);
    photoIngestRequestRef.current += 1;
    setFetchError(null);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    updateSession(current => {
      const selectedStillMatches = current.address.selectedLabel?.trim().toLocaleLowerCase('en-AU')
        === value.trim().toLocaleLowerCase('en-AU');
      if (selectedStillMatches) return { ...current, address: { ...current.address, query: value } };
      const hadSelectedAddress = Boolean(current.address.selectedLabel);
      const empty = createInitialCampaignSessionState();
      const next = {
        ...current,
        address: { ...current.address, query: value, selectedLabel: null },
        property: hadSelectedAddress ? empty.property : current.property,
        campaign: hadSelectedAddress ? empty.campaign : current.campaign,
        photos: hadSelectedAddress ? empty.photos : current.photos,
      };
      return invalidateGovernedState(next, 'property');
    });
  };

  const handleSelectAddress = (address: string) => {
    researchRequestRef.current += 1;
    researchAbortRef.current?.abort();
    setIsFetching(false);
    photoIngestRequestRef.current += 1;
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    setFetchError(null);
    updateSession(current => invalidateGovernedState({
      ...current,
      address: { ...current.address, query: address, selectedLabel: address },
    }, 'property'));
  };

  const handleAddressKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveSuggestionIndex(index => Math.min(suggestions.length - 1, index + 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveSuggestionIndex(index => Math.max(0, index - 1));
    } else if (event.key === 'Enter' && activeSuggestionIndex >= 0) {
      event.preventDefault();
      handleSelectAddress(suggestions[activeSuggestionIndex]);
    } else if (event.key === 'Escape') {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const requestLocation = (): Promise<{ latitude: number; longitude: number } | undefined> => (
    new Promise(resolve => {
      if (!navigator.geolocation) {
        setLocationStatus('denied');
        resolve(undefined);
        return;
      }
      navigator.geolocation.getCurrentPosition(
        position => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          setUserLocation(location);
          setLocationStatus('granted');
          resolve(location);
        },
        () => {
          setLocationStatus('denied');
          resolve(undefined);
        },
      );
    })
  );

  const handleFetchProperty = async () => {
    const selectedAddress = session.address.selectedLabel;
    if (!session.product || !selectedAddress || isFetching) return;
    setIsFetching(true);
    setFetchError(null);
    researchAbortRef.current?.abort();
    const requestId = researchRequestRef.current + 1;
    researchRequestRef.current = requestId;
    const controller = new AbortController();
    researchAbortRef.current = controller;
    try {
      assertNetworkAllowed(session, 'researchProperty');
      let location = userLocation;
      if (locationStatus === 'pending') location = await requestLocation();
      if (controller.signal.aborted || researchRequestRef.current !== requestId) return;
      const response = await researchProperty(selectedAddress, location, controller.signal);
      if (controller.signal.aborted || researchRequestRef.current !== requestId) return;
      const research = response.data;
      const specs = research.specs;
      const factValues: Record<ReviewedFact['key'], string | number | null> = {
        bedrooms: specs?.beds ?? null,
        bathrooms: specs?.baths ?? null,
        carSpaces: specs?.cars ?? null,
        landValue: specs?.landSize ?? null,
        propertyType: specs?.propertyType ?? '',
      };
      const labels: Record<ReviewedFact['key'], string> = {
        bedrooms: 'Bedrooms',
        bathrooms: 'Bathrooms',
        carSpaces: 'Car spaces',
        landValue: 'Land',
        propertyType: 'Property type',
      };
      const factKeys: ReviewedFact['key'][] = ['bedrooms', 'bathrooms', 'carSpaces', 'landValue', 'propertyType'];
      const facts: ReviewedFact[] = factKeys.map((key): ReviewedFact => ({
        key,
        label: labels[key],
        sourceValue: factValues[key],
        approvedValue: factValues[key],
        ...(key === 'landValue' ? { sourceUnit: 'm²' as const, unit: 'm²' as const } : {}),
        provenance: `Property research · ${selectedAddress}`,
        state: 'needs-review',
      }));
      const claims = splitProposalText(research.keyFeatures).map((text, index): ReviewedClaim => ({
        id: `claim.research.${index + 1}`,
        sourceText: text,
        approvedText: text,
        provenance: `Property research · ${selectedAddress}`,
        state: 'needs-review',
        aliases: claimAliases(text),
      }));
      updateSession(current => invalidateGovernedState({
        ...current,
        property: {
          facts,
          overview: research.summary,
          overviewState: research.summary.trim() ? 'needs-review' : 'excluded',
          suburbContext: research.suburbProfile,
          areaContext: research.regionalProfile,
          profileInclusion: research.suburbProfile && research.regionalProfile
            ? 'both'
            : research.suburbProfile
              ? 'suburb'
              : research.regionalProfile
                ? 'area'
                : 'none',
          claims,
          approved: false,
        },
      }, 'property'));
      setSuggestions([]);
      focusResultById('core-facts-title');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      if (researchRequestRef.current !== requestId) return;
      const message = formatError(error, 'Property details could not be fetched.');
      setFetchError(message);
      if (error instanceof CopywritingRequestError && error.statusCode === 401) {
        updateSession(current => ({ ...current, gate: { state: 'locked', error: message } }));
      }
    } finally {
      if (researchRequestRef.current === requestId) setIsFetching(false);
    }
  };

  const handleConfirmFact = (fact: ReviewedFact) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      property: {
        ...current.property,
        facts: current.property.facts.map(candidate => candidate.key === fact.key
          ? {
            ...candidate,
            approvedValue: candidate.sourceValue,
            ...(candidate.key === 'landValue' ? { unit: candidate.sourceUnit ?? 'm²' } : {}),
            state: 'confirmed',
          }
          : candidate),
      },
    }, 'property'));
  };

  const handleCorrectFact = (fact: ReviewedFact) => {
    setGovernedReviewDraft({
      kind: 'fact',
      factKey: fact.key,
      label: fact.label,
      provenance: fact.provenance,
      sourceValue: fact.sourceValue,
      sourceUnit: fact.sourceUnit,
      value: String(fact.approvedValue ?? ''),
      ...(fact.key === 'landValue' ? { unit: fact.unit ?? 'm²' } : {}),
    });
  };

  const handleConfirmClaim = (claim: ReviewedClaim) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      property: {
        ...current.property,
        claims: current.property.claims.map(candidate => candidate.id === claim.id
          ? { ...candidate, approvedText: candidate.sourceText, state: 'confirmed' }
          : candidate),
      },
    }, 'property'));
  };

  const handleCorrectClaim = (claim: ReviewedClaim) => {
    setGovernedReviewDraft({
      kind: 'claim',
      action: 'correct',
      id: claim.id,
      label: 'Correct material claim',
      provenance: claim.provenance,
      sourceText: claim.sourceText,
      value: claim.approvedText || claim.sourceText,
      reason: '',
    });
  };

  const handleExcludeClaim = (claim: ReviewedClaim) => {
    setGovernedReviewDraft({
      kind: 'claim',
      action: 'exclude',
      id: claim.id,
      label: 'Exclude material claim',
      provenance: claim.provenance,
      sourceText: claim.sourceText,
      value: claim.approvedText || claim.sourceText,
      reason: claim.reason ?? 'Excluded during human property review.',
    });
  };

  const handleSaveGovernedReview = () => {
    const draft = governedReviewDraft;
    if (!draft) return;

    if (draft.kind === 'fact') {
      let approvedValue: string | number | null = draft.value.trim();
      if (draft.factKey !== 'propertyType') {
        if (!draft.value.trim()) {
          setNotice(`${draft.label} requires an approved numeric value.`);
          return;
        }
        const parsed = Number(draft.value);
        if (!Number.isFinite(parsed) || parsed < 0) {
          setNotice(`${draft.label} must be a non-negative number.`);
          return;
        }
        if ((draft.factKey === 'bedrooms' || draft.factKey === 'carSpaces') && !Number.isInteger(parsed)) {
          setNotice(`${draft.label} must be a whole number.`);
          return;
        }
        const maximum = draft.factKey === 'landValue' ? 100_000_000 : 100;
        if (parsed > maximum) {
          setNotice(`${draft.label} is outside the supported range.`);
          return;
        }
        approvedValue = parsed;
      } else if (!approvedValue) {
        setNotice('Property type cannot be empty.');
        return;
      }
      updateSession(current => invalidateGovernedState({
        ...current,
        property: {
          ...current.property,
          facts: current.property.facts.map(candidate => {
            if (candidate.key !== draft.factKey) return candidate;
            const approvedUnit = candidate.key === 'landValue' ? draft.unit ?? 'm²' : undefined;
            const sourceUnit = candidate.key === 'landValue' ? candidate.sourceUnit ?? 'm²' : undefined;
            const valueChanged = approvedValue !== candidate.sourceValue;
            const unitChanged = approvedUnit !== sourceUnit;
            return {
              ...candidate,
              approvedValue,
              ...(candidate.key === 'landValue' ? { sourceUnit, unit: approvedUnit } : {}),
              state: valueChanged || unitChanged ? 'corrected' : 'confirmed',
            };
          }),
        },
      }, 'property'));
      setGovernedReviewDraft(null);
      setNotice(`${draft.label} review decision applied. Existing outputs, if any, now require regeneration.`);
      return;
    }

    if (draft.action === 'correct' && !draft.value.trim()) {
      setNotice('Approved wording cannot be empty.');
      return;
    }
    if (draft.kind === 'claim') {
      updateSession(current => invalidateGovernedState({
        ...current,
        property: {
          ...current.property,
          claims: current.property.claims.map(candidate => {
            if (candidate.id !== draft.id) return candidate;
            if (draft.action === 'exclude') {
              return {
                ...candidate,
                approvedText: draft.value.trim() || candidate.sourceText,
                aliases: claimAliases(candidate.sourceText, draft.value),
                state: 'excluded',
                reason: draft.reason.trim() || 'Excluded during human property review.',
              };
            }
            const approvedText = draft.value.trim();
            const { reason: _previousReason, ...claimWithoutReason } = candidate;
            return {
              ...claimWithoutReason,
              approvedText,
              aliases: claimAliases(candidate.sourceText, approvedText),
              state: approvedText === candidate.sourceText.trim() ? 'confirmed' : 'corrected',
            };
          }),
        },
      }, 'property'));
    } else {
      updateSession(current => {
        const stripped = stripPhotoDependentDirection(current);
        const next = {
          ...stripped,
          photos: {
            ...stripped.photos,
            highlights: stripped.photos.highlights.map(candidate => {
              if (candidate.id !== draft.id) return candidate;
              const approvedText = draft.value.trim() || candidate.sourceText;
              return {
                ...candidate,
                approvedText,
                state: draft.action === 'exclude'
                  ? 'excluded' as const
                  : approvedText === candidate.sourceText.trim()
                    ? 'approved' as const
                    : 'corrected' as const,
              };
            }),
          },
        };
        return stripped.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
      });
    }
    setGovernedReviewDraft(null);
    setNotice('Governed review decision applied. Existing outputs, if any, now require regeneration.');
  };

  const handleApproveProperty = () => {
    const issues = getApprovedBriefBlockers({
      ...session,
      property: { ...session.property, approved: true },
    }).filter(blocker => blocker.governingStage === 'property');
    if (issues.length > 0) {
      setNotice(issues[0].message);
      return;
    }
    updateSession(current => ({
      ...current,
      property: { ...current.property, approved: true },
      stage: 'campaign',
    }));
    setNotice('Property facts approved for this temporary session.');
  };

  const handleOverviewDecision = (state: CampaignSessionState['property']['overviewState']) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      property: { ...current.property, overviewState: state },
    }, 'property'));
  };

  const handleProfileInclusionChange = (profileInclusion: CampaignSessionState['property']['profileInclusion']) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      property: { ...current.property, profileInclusion },
    }, 'property'));
  };

  const handleCampaignFieldChange = (field: 'primaryAudience' | 'secondaryAudience' | 'tone', value: string) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      campaign: {
        ...current.campaign,
        [field]: value,
        suggestions: current.campaign.suggestions.map(suggestion => (
          suggestion.state === 'applied'
          && suggestion.kind === 'audience'
          && (
            (field === 'primaryAudience' && suggestion.audienceTarget !== 'secondary')
            || (field === 'secondaryAudience' && suggestion.audienceTarget === 'secondary')
          )
            ? releaseAppliedSuggestion(suggestion)
            : suggestion
        )),
      },
    }, 'campaign'));
  };

  const handleWritingStyleToggle = (style: string) => {
    updateSession(current => {
      const selected = current.campaign.writingStyles.includes(style);
      const writingStyles = selected
        ? current.campaign.writingStyles.filter(candidate => candidate !== style)
        : current.campaign.writingStyles.length < 2
          ? [...current.campaign.writingStyles, style]
          : current.campaign.writingStyles;
      return invalidateGovernedState({
        ...current,
        campaign: {
          ...current.campaign,
          writingStyles,
          suggestions: current.campaign.suggestions.map(suggestion => (
            suggestion.state === 'applied' && suggestion.kind === 'voice' && suggestion.text === style
              ? releaseAppliedSuggestion(suggestion)
              : suggestion
          )),
        },
      }, 'campaign');
    });
  };

  const handleCampaignListChange = (field: 'emphasis' | 'styleAvoidances', value: string) => {
    const suggestionKind = field === 'emphasis' ? 'selling-point' : 'boundary';
    updateSession(current => invalidateGovernedState({
      ...current,
      campaign: {
        ...current.campaign,
        [field]: splitProposalText(value),
        suggestions: current.campaign.suggestions.map(suggestion => (
          suggestion.state === 'applied' && suggestion.kind === suggestionKind
            ? releaseAppliedSuggestion(suggestion)
            : suggestion
        )),
      },
    }, 'campaign'));
  };

  const handleAnalyseCampaign = async () => {
    if (!session.property.approved || isAnalysingCampaign) return;
    setIsAnalysingCampaign(true);
    setCampaignAnalysisError(null);
    const analysisRevision = getCampaignAnalysisRevision(session);
    try {
      assertNetworkAllowed(session, 'analyzeStrategy + analyzeFeatures');
      const governance = createGovernanceContext(session);
      const approvedClaimText = session.property.claims
        .filter(claim => claim.state === 'confirmed' || claim.state === 'corrected')
        .map(claim => claim.approvedText)
        .filter(Boolean);
      const correctedClaims = session.property.claims.filter(claim => claim.state === 'corrected');
      const governedOverview = session.property.overviewState === 'confirmed'
        ? sanitizeCorrectedClaimContext(session.property.overview, correctedClaims)
        : '';
      const researchData = [
        governedOverview,
        ...approvedClaimText,
      ].filter(Boolean).join('\n\n');
      const includedProfileContexts = [
        session.property.profileInclusion === 'suburb' || session.property.profileInclusion === 'both'
          ? session.property.suburbContext
          : '',
        session.property.profileInclusion === 'area' || session.property.profileInclusion === 'both'
          ? session.property.areaContext
          : '',
      ];
      const profileData = includedProfileContexts
        .map(context => sanitizeCorrectedClaimContext(context, correctedClaims))
        .filter(Boolean)
        .join('\n\n') || null;
      const selectedPhotoIds = new Set(session.photos.items.filter(photo => photo.selected).map(photo => photo.id));
      const imageAnalysis = session.photos.policy === 'included' && session.photos.approved
        ? session.photos.highlights
          .filter(highlight => (
            selectedPhotoIds.has(highlight.imageId)
            && (highlight.state === 'approved' || highlight.state === 'corrected')
          ))
          .map(highlight => highlight.approvedText)
          .join('\n') || null
        : null;
      const [strategyResult, featuresResult] = await Promise.allSettled([
        analyzeStrategy(researchData, profileData, null, governance),
        analyzeFeatures(researchData, profileData, imageAnalysis, governance),
      ]);
      if (strategyResult.status === 'rejected' && featuresResult.status === 'rejected') {
        throw new Error('Campaign Direction and Property Features analysis could not complete.');
      }
      const proposals: CampaignSuggestion[] = [];
      if (strategyResult.status === 'fulfilled') {
        const strategy = strategyResult.value.data;
        if (strategy.primaryTargetMarket) proposals.push({ id: 'suggestion.audience.primary', kind: 'audience', text: strategy.primaryTargetMarket, state: 'suggested', audienceTarget: 'primary' });
        if (strategy.secondaryTargetMarket) proposals.push({ id: 'suggestion.audience.secondary', kind: 'audience', text: strategy.secondaryTargetMarket, state: 'suggested', audienceTarget: 'secondary' });
        strategy.writingStyles.slice(0, 2).forEach((style, index) => proposals.push({ id: `suggestion.voice.${index + 1}`, kind: 'voice', text: style, state: 'suggested' }));
        splitProposalText(strategy.featuresToHighlight).forEach((text, index) => proposals.push({
          id: `suggestion.emphasis.research.${index + 1}`,
          kind: 'selling-point',
          text,
          state: 'suggested',
        }));
        splitProposalText(strategy.thingsToAvoid).forEach((text, index) => proposals.push({ id: `suggestion.boundary.${index + 1}`, kind: 'boundary', text, state: 'suggested' }));
      }
      if (featuresResult.status === 'fulfilled') {
        splitProposalText(featuresResult.value.data.propertyFeatures).forEach((text, index) => proposals.push({
          id: `suggestion.emphasis.features.${index + 1}`,
          kind: 'selling-point',
          text,
          state: 'suggested',
          ...(imageAnalysis ? { dependsOnPhotoContext: true } : {}),
        }));
      }
      const governed = governSuggestions(proposals, governance);
      updateSession(current => ({
        ...(getCampaignAnalysisRevision(current) === analysisRevision
          ? {
            ...current,
            campaign: {
              ...current.campaign,
              suggestions: governed.filter(suggestion => (
                !suggestion.dependsOnPhotoContext
                || (current.photos.policy === 'included' && current.photos.approved)
              )),
            },
          }
          : current),
      }));
      if (strategyResult.status === 'rejected') {
        setCampaignAnalysisError('Campaign Direction analysis did not complete. Property Features proposals were preserved.');
      } else if (featuresResult.status === 'rejected') {
        setCampaignAnalysisError('Property Features analysis did not complete. Campaign Direction proposals were preserved.');
      }
      focusResultById('campaign-proposals-title');
    } catch (error) {
      setCampaignAnalysisError(formatError(error, 'Campaign Direction and Property Features analysis could not complete.'));
    } finally {
      setIsAnalysingCampaign(false);
    }
  };

  const handleSuggestionAction = (suggestion: CampaignSuggestion, action: 'apply' | 'dismiss') => {
    if (
      action === 'apply'
      && suggestion.kind === 'voice'
      && !session.campaign.writingStyles.includes(suggestion.text)
      && session.campaign.writingStyles.length >= 2
    ) {
      setNotice('Campaign voice supports up to two writing styles. Remove one before applying this proposal.');
      return;
    }
    if (
      suggestion.dependsOnPhotoContext
      && (session.photos.policy !== 'included' || !session.photos.approved)
    ) {
      updateSession(current => ({
        ...current,
        campaign: {
          ...current.campaign,
          suggestions: current.campaign.suggestions.filter(candidate => candidate.id !== suggestion.id),
        },
      }));
      setNotice('That proposal depended on photo context that is no longer approved. Analyse Campaign Direction again if needed.');
      return;
    }
    updateSession(current => {
      if (suggestion.state === 'blocked') return current;
      if (
        suggestion.dependsOnPhotoContext
        && (current.photos.policy !== 'included' || !current.photos.approved)
      ) {
        return {
          ...current,
          campaign: {
            ...current.campaign,
            suggestions: current.campaign.suggestions.filter(candidate => candidate.id !== suggestion.id),
          },
        };
      }
      let campaign = { ...current.campaign };
      let application = suggestion.application;
      if (action === 'apply') {
        if (suggestion.kind === 'audience') {
          const field = suggestion.audienceTarget === 'secondary' ? 'secondaryAudience' : 'primaryAudience';
          const previousValue = campaign[field];
          const changedGoverningValue = previousValue !== suggestion.text;
          campaign[field] = suggestion.text;
          application = { changedGoverningValue, previousValue };
        }
        if (suggestion.kind === 'voice') {
          const changedGoverningValue = !campaign.writingStyles.includes(suggestion.text);
          if (changedGoverningValue && campaign.writingStyles.length < 2) campaign.writingStyles = [...campaign.writingStyles, suggestion.text];
          application = { changedGoverningValue };
        }
        if (suggestion.kind === 'selling-point') {
          const changedGoverningValue = !campaign.emphasis.includes(suggestion.text);
          if (changedGoverningValue) campaign.emphasis = [...campaign.emphasis, suggestion.text];
          application = { changedGoverningValue };
        }
        if (suggestion.kind === 'boundary') {
          const changedGoverningValue = !campaign.styleAvoidances.includes(suggestion.text);
          if (changedGoverningValue) campaign.styleAvoidances = [...campaign.styleAvoidances, suggestion.text];
          application = { changedGoverningValue };
        }
      } else if (suggestion.state === 'applied') {
        const changedGoverningValue = suggestion.application?.changedGoverningValue ?? true;
        if (changedGoverningValue && suggestion.kind === 'audience') {
          const field = suggestion.audienceTarget === 'secondary' ? 'secondaryAudience' : 'primaryAudience';
          if (campaign[field] === suggestion.text) campaign[field] = suggestion.application?.previousValue ?? '';
        }
        if (changedGoverningValue && suggestion.kind === 'voice') campaign.writingStyles = campaign.writingStyles.filter(style => style !== suggestion.text);
        if (changedGoverningValue && suggestion.kind === 'selling-point') campaign.emphasis = campaign.emphasis.filter(item => item !== suggestion.text);
        if (changedGoverningValue && suggestion.kind === 'boundary') campaign.styleAvoidances = campaign.styleAvoidances.filter(item => item !== suggestion.text);
      }
      campaign = {
        ...campaign,
        suggestions: action === 'dismiss'
          ? campaign.suggestions.filter(candidate => candidate.id !== suggestion.id)
          : campaign.suggestions.map(candidate => candidate.id === suggestion.id
            ? { ...candidate, state: 'applied' as const, ...(application ? { application } : {}) }
            : candidate),
      };
      return (action === 'dismiss' && suggestion.state === 'suggested')
        || (action === 'dismiss' && suggestion.state === 'applied' && suggestion.application?.changedGoverningValue === false)
        || (action === 'apply' && application?.changedGoverningValue === false)
        ? { ...current, campaign }
        : invalidateGovernedState({ ...current, campaign }, 'campaign');
    });
  };

  const handleApproveCampaign = () => {
    if (
      !session.property.approved
      || !session.campaign.primaryAudience.trim()
      || session.campaign.writingStyles.length === 0
      || !session.campaign.tone.trim()
      || campaignApprovalIssues.length > 0
    ) return;
    updateSession(current => ({
      ...current,
      campaign: { ...current.campaign, approved: true },
      stage: 'photos',
    }));
    setNotice('Campaign direction approved for this temporary session.');
  };

  const handlePhotoPolicyChange = (policy: CampaignSessionState['photos']['policy']) => {
    updateSession(current => {
      if (current.photos.policy === policy) return current;
      const governed = stripPhotoDependentDirection(current);
      return invalidateGovernedState({
        ...governed,
        photos: { ...governed.photos, policy, approved: false },
      }, 'photos');
    });
  };

  const handleFilesSelected = async (fileList: FileList | readonly File[]) => {
    if (photoIngestingRef.current) {
      setNotice('Finish adding the current photo selection before choosing more images.');
      return;
    }
    const mimeTypeByExtension: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      heic: 'image/heic',
      heif: 'image/heif',
    };
    const supportedMimeTypes = new Set(Object.values(mimeTypeByExtension));
    const available = Math.max(0, 20 - session.photos.items.length);
    const files = Array.from(fileList)
      .map(file => {
        const browserMimeType = file.type.trim().toLocaleLowerCase('en-AU');
        const extension = file.name.split('.').pop()?.toLocaleLowerCase('en-AU') ?? '';
        const mimeType = supportedMimeTypes.has(browserMimeType)
          ? browserMimeType
          : mimeTypeByExtension[extension];
        return mimeType ? { file, mimeType } : null;
      })
      .filter((candidate): candidate is { file: File; mimeType: string } => candidate !== null)
      .slice(0, available);
    if (files.length === 0) {
      setNotice(available === 0 ? 'The 20-photo limit has been reached.' : 'Choose JPG, PNG, WebP, HEIC or HEIF images.');
      return;
    }
    photoIngestingRef.current = true;
    const ingestRequestId = photoIngestRequestRef.current + 1;
    photoIngestRequestRef.current = ingestRequestId;
    const startNumber = Math.max(0, ...session.photos.items.map(photo => photo.imageNumber)) + 1;
    try {
      const items = await Promise.all(files.map(async ({ file, mimeType }, index) => {
        const id = `photo.${session.sessionId}.${startNumber + index}`;
        try {
          const base64 = await fileToBase64(file);
          photoPayloadsRef.current.set(id, { base64, mimeType });
          return {
            id,
            name: file.name,
            imageNumber: startNumber + index,
            selected: true,
            analysisState: 'not-analysed' as const,
            previewUrl: URL.createObjectURL(file),
          };
        } catch (error) {
          return {
            id,
            name: file.name,
            imageNumber: startNumber + index,
            selected: false,
            analysisState: 'failed' as const,
            error: formatError(error, 'This image could not be read.'),
          };
        }
      }));
      if (photoIngestRequestRef.current !== ingestRequestId) {
        items.forEach(item => {
          if ('previewUrl' in item && item.previewUrl) URL.revokeObjectURL(item.previewUrl);
          photoPayloadsRef.current.delete(item.id);
        });
        return;
      }
      updateSession(current => {
        const acceptedItems = items.slice(0, Math.max(0, 20 - current.photos.items.length));
        const next = {
          ...current,
          photos: { ...current.photos, items: [...current.photos.items, ...acceptedItems] },
        };
        return current.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
      });
    } finally {
      photoIngestingRef.current = false;
    }
  };

  const handlePhotoSelected = (id: string, selected: boolean) => {
    updateSession(current => {
      const governed = stripPhotoDependentDirection(current);
      const next = {
        ...governed,
        photos: {
          ...governed.photos,
          items: governed.photos.items.map(photo => photo.id === id ? { ...photo, selected } : photo),
        },
      };
      return governed.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
    });
  };

  const handleRemovePhoto = (id: string) => {
    const photo = session.photos.items.find(candidate => candidate.id === id);
    if (photo?.previewUrl) URL.revokeObjectURL(photo.previewUrl);
    photoPayloadsRef.current.delete(id);
    updateSession(current => {
      const governed = stripPhotoDependentDirection(current);
      const next = {
        ...governed,
        photos: {
          ...governed.photos,
          items: governed.photos.items.filter(candidate => candidate.id !== id),
          highlights: governed.photos.highlights.filter(highlight => highlight.imageId !== id),
        },
      };
      return governed.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
    });
  };

  const handleAnalysePhotos = async (photoId?: string) => {
    if (isAnalysingPhotos) return;
    const selectedPhotos = session.photos.items.filter(photo => (
      photo.selected
      && photo.analysisState !== 'ready'
      && (!photoId || photo.id === photoId)
    ));
    if (selectedPhotos.length === 0) return;
    try {
      assertNetworkAllowed(session, 'analyzeSingleImage');
    } catch (error) {
      setNotice(formatError(error, 'Photo analysis is unavailable.'));
      return;
    }
    updateSession(current => stripPhotoDependentDirection(current));
    const updatePhotoAnalysisProgress = (completed: number) => {
      const currentPhoto = selectedPhotos[completed] ?? null;
      setPhotoAnalysisProgress({
        completed,
        total: selectedPhotos.length,
        currentPhotoId: currentPhoto?.id ?? null,
      });
    };
    updatePhotoAnalysisProgress(0);
    setIsAnalysingPhotos(true);
    try {
      for (const [index, photo] of selectedPhotos.entries()) {
        const payload = photoPayloadsRef.current.get(photo.id);
        if (!payload) {
          updateSession(current => ({
            ...current,
            photos: {
              ...current.photos,
              items: current.photos.items.map(candidate => candidate.id === photo.id
                ? { ...candidate, analysisState: 'failed', error: 'The temporary image payload is unavailable. Upload this photo again.' }
                : candidate),
            },
          }));
          updatePhotoAnalysisProgress(index + 1);
          continue;
        }
        updateSession(current => ({
          ...current,
          photos: {
            ...current.photos,
            items: current.photos.items.map(candidate => {
              if (candidate.id !== photo.id) return candidate;
              const { error: _previousError, ...serialisablePhoto } = candidate;
              return { ...serialisablePhoto, analysisState: 'analysing' };
            }),
          },
        }));
        try {
          const response = await analyzeSingleImage(payload);
          const sourceText = response.data.trim();
          const highlight: ReviewedPhotoHighlight = {
            id: `highlight.${photo.id}`,
            imageId: photo.id,
            imageNumber: photo.imageNumber,
            sourceText,
            approvedText: sourceText,
            state: sourceText ? 'needs-review' : 'failed',
            provenance: `Photo ${photo.imageNumber} analysis`,
          };
          updateSession(current => {
            if (!current.photos.items.some(candidate => candidate.id === photo.id)) return current;
            const next = {
              ...current,
              photos: {
                ...current.photos,
                items: current.photos.items.map(candidate => {
                  if (candidate.id !== photo.id) return candidate;
                  const { error: _previousError, ...serialisablePhoto } = candidate;
                  return sourceText
                    ? { ...serialisablePhoto, analysisState: 'ready' as const }
                    : { ...serialisablePhoto, analysisState: 'failed' as const, error: 'Analysis returned no highlight.' };
                }),
                highlights: [
                  ...current.photos.highlights.filter(candidate => candidate.id !== highlight.id),
                  highlight,
                ],
              },
            };
            return current.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
          });
        } catch (error) {
          const message = formatError(error, `Photo ${photo.imageNumber} analysis failed.`);
          updateSession(current => {
            if (!current.photos.items.some(candidate => candidate.id === photo.id)) return current;
            const failedHighlight: ReviewedPhotoHighlight = {
              id: `highlight.${photo.id}`,
              imageId: photo.id,
              imageNumber: photo.imageNumber,
              sourceText: '',
              approvedText: '',
              state: 'failed',
              provenance: `Photo ${photo.imageNumber} analysis`,
            };
            const next = {
              ...current,
              photos: {
                ...current.photos,
                items: current.photos.items.map(candidate => candidate.id === photo.id
                  ? { ...candidate, analysisState: 'failed' as const, error: message }
                  : candidate),
                highlights: [
                  ...current.photos.highlights.filter(candidate => candidate.id !== failedHighlight.id),
                  failedHighlight,
                ],
              },
            };
            return current.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
          });
        }
        updatePhotoAnalysisProgress(index + 1);
      }
    } finally {
      setPhotoAnalysisProgress(null);
      setIsAnalysingPhotos(false);
    }
    focusResultById('visual-highlights-title');
  };

  const handleHighlightAction = (
    highlight: ReviewedPhotoHighlight,
    action: 'approve' | 'correct' | 'exclude',
  ) => {
    if (action === 'approve') {
      updateSession(current => {
        const governed = stripPhotoDependentDirection(current);
        const next = {
          ...governed,
          photos: {
            ...governed.photos,
            highlights: governed.photos.highlights.map(candidate => candidate.id === highlight.id
              ? { ...candidate, approvedText: candidate.sourceText, state: 'approved' as const }
              : candidate),
          },
        };
        return governed.photos.policy === 'included' ? invalidateGovernedState(next, 'photos') : next;
      });
      return;
    }
    setGovernedReviewDraft({
      kind: 'highlight',
      action,
      id: highlight.id,
      label: action === 'correct' ? `Correct Photo ${highlight.imageNumber} highlight` : `Exclude Photo ${highlight.imageNumber} highlight`,
      provenance: highlight.provenance,
      sourceText: highlight.sourceText,
      value: highlight.approvedText || highlight.sourceText,
      reason: 'Excluded during human photo review.',
    });
  };

  const handleApprovePhotos = () => {
    if (session.photos.policy === 'included') {
      const selectedIds = new Set(session.photos.items.filter(photo => photo.selected).map(photo => photo.id));
      const selectedPhotos = session.photos.items.filter(photo => photo.selected);
      const unresolved = selectedIds.size === 0
        || selectedPhotos.some(photo => photo.analysisState !== 'ready')
        || selectedPhotos.some(photo => !session.photos.highlights.some(highlight => (
          highlight.imageId === photo.id
          && (highlight.state === 'approved' || highlight.state === 'corrected')
        )))
        || session.photos.highlights.some(highlight => (
          selectedIds.has(highlight.imageId) && (highlight.state === 'needs-review' || highlight.state === 'failed')
        ));
      if (unresolved) return;
    }
    updateSession(current => ({
      ...current,
      photos: { ...current.photos, approved: true },
      stage: 'brief',
    }));
    setNotice(session.photos.policy === 'off'
      ? 'Photo context is off. No analysed photo content will enter generation.'
      : 'Reviewed photo context approved for the brief.');
  };

  const handlePeopleBooleanChange = (
    field: 'agentIncluded' | 'agencyIncluded' | 'openHomeIncluded',
    value: boolean,
  ) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      people: { ...current.people, [field]: value },
    }, 'people'));
  };

  const handleAgentChange = (
    field: 'name' | 'title' | 'phone' | 'email' | 'inclusionMode',
    value: string,
  ) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      people: { ...current.people, agent: { ...current.people.agent, [field]: value } },
    }, 'people'));
  };

  const handleAgencyChange = (value: string) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      people: { ...current.people, agencyName: value },
    }, 'people'));
  };

  const handleOpenHomeChange = (field: 'date' | 'time' | 'url', value: string) => {
    updateSession(current => invalidateGovernedState({
      ...current,
      people: { ...current.people, openHome: { ...current.people.openHome, [field]: value } },
    }, 'people'));
  };

  const handleListingApproximateWordCountChange = (wordCount: number) => {
    if (
      !Number.isInteger(wordCount)
      || wordCount < 50
      || wordCount > 1000
      || (wordCount - 50) % 50 !== 0
    ) {
      setNotice('Choose an approximate Listing Copy length from 50 to 1,000 words in 50-word steps.');
      return;
    }
    updateSession(current => {
      if (current.listingGenerationSettings.approximateWordCount === wordCount) return current;
      return invalidateGovernedState({
        ...current,
        listingGenerationSettings: { approximateWordCount: wordCount },
      }, 'settings');
    });
    setNotice('Approximate Listing Copy length changed. Reapprove the brief before deliberately regenerating affected outputs.');
  };

  const handleApproveBrief = () => {
    try {
      const snapshot = buildApprovedBriefSnapshot(session, {
        approvedAt: new Date().toISOString(),
        statement: 'Human approved for generation in this temporary session.',
      });
      updateSession(current => ({
        ...current,
        brief: { snapshot, approved: true },
        outputs: markOutputsNeedsRegeneration(current.outputs, snapshot.snapshotId),
        stage: 'outputs',
        activeOutputId: 'Full Copy',
      }));
      setBriefOpen(false);
      setNotice('Approved Brief Snapshot created for this temporary session.');
    } catch (error) {
      setNotice(formatError(error, 'The Reviewed Campaign Brief could not be approved.'));
    }
  };

  const generateOutputDocument = async (
    outputId: PreviewTab,
    snapshot: NonNullable<CampaignSessionState['brief']['snapshot']>,
    listingCopy: string,
  ): Promise<'ready' | 'integrity-blocked' | 'failed'> => {
    try {
      assertNetworkAllowed(session, outputId === 'Full Copy' ? 'generateCopy' : `generateCopyVariant:${outputId}`);
    } catch (error) {
      setNotice(formatError(error, 'Generation is unavailable.'));
      return 'failed';
    }

    const params = assembleGenerationParamsFromApprovedSnapshot(snapshot);
    updateSession(current => {
      const { error: _previousError, ...serialisableOutput } = current.outputs[outputId];
      return {
        ...current,
        outputs: {
          ...current.outputs,
          [outputId]: {
            ...serialisableOutput,
            state: 'generating',
            boundSnapshotId: snapshot.snapshotId,
            integrityIssues: [],
          },
        },
      };
    });
    try {
      const response = outputId === 'Full Copy'
        ? await generateCopy(params, 'Listing Copy')
        : await generateCopyVariant(listingCopy, outputId, params);
      const generatedAt = new Date().toISOString();
      const validated = validateReturnedOutput({
        id: outputId,
        content: response.data,
        snapshot,
        boundSnapshotId: snapshot.snapshotId,
        usedPhotoContext: snapshot.photoContext.policy === 'included' && snapshot.photoContext.approvedHighlights.length > 0,
        knownPhotoHighlights: session.photos.highlights,
        generatedAt,
      });
      updateSession(current => {
        let outputs = { ...current.outputs, [outputId]: validated };
        const activeSnapshotId = current.brief.approved
          ? current.brief.snapshot?.snapshotId ?? 'brief.missing'
          : 'brief.pending-reapproval';
        if (activeSnapshotId !== snapshot.snapshotId) {
          outputs = markOutputsNeedsRegeneration(outputs, activeSnapshotId);
        }
        return { ...current, outputs };
      });
      return validated.state === 'ready' ? 'ready' : 'integrity-blocked';
    } catch (error) {
      const message = formatError(error, `${OUTPUT_PRESENTATION_BY_ID[outputId].label} generation failed.`);
      updateSession(current => ({
        ...current,
        outputs: {
          ...current.outputs,
          [outputId]: {
            ...current.outputs[outputId],
            state: 'failed',
            boundSnapshotId: snapshot.snapshotId,
            generatedAt: new Date().toISOString(),
            integrityIssues: [],
            usedPhotoContext: snapshot.photoContext.policy === 'included' && snapshot.photoContext.approvedHighlights.length > 0,
            error: message,
          },
        },
      }));
      if (error instanceof CopywritingRequestError && error.statusCode === 401) {
        updateSession(current => ({ ...current, gate: { state: 'locked', error: message } }));
      }
      return 'failed';
    }
  };

  const handleGenerateListing = async () => {
    const snapshot = session.brief.snapshot;
    if (!snapshot || !session.brief.approved) {
      setNotice('Approve the Reviewed Campaign Brief before generating Listing Copy.');
      return;
    }
    const isFoundationRegeneration = Boolean(
      session.outputs['Full Copy'].content.trim() || session.outputs['Full Copy'].generatedAt,
    );
    const outcome = await generateOutputDocument('Full Copy', snapshot, '');
    if (outcome !== 'failed' && isFoundationRegeneration) {
      updateSession(current => ({
        ...current,
        outputs: markPackChildrenNeedsRegenerationForFoundation(current.outputs),
      }));
    }
    setNotice(outcome === 'ready'
      ? 'Listing Copy foundation is ready for review.'
      : 'Listing Copy did not reach Ready. Review the named generation or integrity issue.');
    focusOutputHeading();
  };

  const handleGeneratePackOutputs = async (requestedIds: readonly PreviewTab[]) => {
    const snapshot = session.brief.snapshot;
    const listing = session.outputs['Full Copy'];
    if (packState.state === 'generating') {
      setNotice('Campaign Pack generation is already in progress.');
      return;
    }
    if (session.product !== 'campaign-pack') {
      setNotice('Campaign Pack generation is available only when Campaign Pack is the selected product.');
      return;
    }
    if (!snapshot || !session.brief.approved || listing.state !== 'ready' || listing.boundSnapshotId !== snapshot.snapshotId) {
      setNotice('A current, Ready Listing Copy foundation is required before Campaign Pack generation.');
      return;
    }
    const ids = requestedIds.filter(outputId => outputId !== 'Full Copy' && (
      session.outputs[outputId].state !== 'ready'
      || session.outputs[outputId].boundSnapshotId !== snapshot.snapshotId
      || session.outputs[outputId].integrityIssues.length > 0
    ));
    if (ids.length === 0) return;
    try {
      assertNetworkAllowed(session, `generateCampaignPack:${ids.length}`);
    } catch (error) {
      setNotice(formatError(error, 'Campaign Pack generation is unavailable.'));
      return;
    }

    const originals = new Map(ids.map(outputId => [outputId, { ...session.outputs[outputId] }]));
    updateSession(current => ({
      ...current,
      pack: {
        ...current.pack,
        state: 'generating',
        currentOutputId: ids[0],
        requestedOutputIds: [...ids],
      },
      outputs: {
        ...current.outputs,
        ...Object.fromEntries(ids.map(outputId => {
          const { error: _previousError, ...serialisableOutput } = current.outputs[outputId];
          return [outputId, {
            ...serialisableOutput,
            state: 'queued' as const,
            boundSnapshotId: snapshot.snapshotId,
          }];
        })),
      },
    }));

    let completed = 0;
    let failedOutputId: PreviewTab | null = null;
    for (let index = 0; index < ids.length; index += 1) {
      const outputId = ids[index];
      updateSession(current => ({
        ...current,
        activeOutputId: current.activeOutputId ?? outputId,
        pack: { ...current.pack, currentOutputId: outputId },
      }));
      const outcome = await generateOutputDocument(outputId, snapshot, listing.content);
      if (outcome !== 'ready') {
        failedOutputId = outputId;
        const remaining = ids.slice(index + 1);
        updateSession(current => ({
          ...current,
          outputs: {
            ...current.outputs,
            ...Object.fromEntries(remaining.map(remainingId => [remainingId, originals.get(remainingId)!])),
          },
        }));
        break;
      }
      completed += 1;
    }
    updateSession(current => ({ ...current, pack: { ...current.pack, currentOutputId: null } }));
    setNotice(failedOutputId
      ? `${OUTPUT_PRESENTATION_BY_ID[failedOutputId].label} did not reach Ready. ${completed} successful sibling${completed === 1 ? '' : 's'} were preserved.`
      : `${completed} Campaign Pack output${completed === 1 ? '' : 's'} generated and validated.`);
    focusOutputHeading();
  };

  const handleGeneratePack = () => handleGeneratePackOutputs(CAMPAIGN_PACK_OUTPUT_ORDER);
  const handleRetryPack = () => handleGeneratePackOutputs(packState.retryOutputIds);

  const handleRegenerate = async () => {
    if (packState.state === 'generating') {
      setNotice('Wait for the current Campaign Pack run to finish before regenerating any document.');
      return;
    }
    if (session.product === 'listing-copy' && activeOutputId !== 'Full Copy') {
      setNotice('Select Campaign Pack before regenerating campaign outputs.');
      return;
    }
    if (activeOutputId === 'Full Copy') {
      await handleGenerateListing();
      return;
    }
    const snapshot = session.brief.snapshot;
    const listing = session.outputs['Full Copy'];
    if (!snapshot || !session.brief.approved || listing.state !== 'ready' || listing.boundSnapshotId !== snapshot.snapshotId) {
      setNotice('Regenerate the Listing Copy foundation from the active brief before regenerating this campaign output.');
      return;
    }
    const outcome = await generateOutputDocument(activeOutputId, snapshot, listing.content);
    setNotice(outcome === 'ready'
      ? `${OUTPUT_PRESENTATION_BY_ID[activeOutputId].label} is ready for review.`
      : `${OUTPUT_PRESENTATION_BY_ID[activeOutputId].label} did not reach Ready.`);
    focusOutputHeading();
  };

  const handleSelectOutput = (outputId: PreviewTab) => {
    if (session.product === 'listing-copy' && outputId !== 'Full Copy') {
      setNotice('Listing Copy contains one foundation document. Select Campaign Pack to review campaign outputs.');
      return;
    }
    updateSession(current => ({ ...current, activeOutputId: outputId, stage: 'outputs' }));
    setNavigatorOpen(false);
    setCopyStatus(null);
    window.setTimeout(focusOutputHeading, 0);
  };

  const handleCopy = async () => {
    const output = session.outputs[activeOutputId];
    const canCopy = output.state === 'ready'
      && session.brief.approved
      && output.boundSnapshotId === session.brief.snapshot?.snapshotId
      && output.integrityIssues.length === 0;
    if (!canCopy) {
      setCopyStatus('Copy is unavailable until this document is Ready and bound to the active Approved Brief Snapshot.');
      return;
    }
    try {
      await navigator.clipboard.writeText(output.content);
      setCopyStatus(`${OUTPUT_PRESENTATION_BY_ID[activeOutputId].label} copied to clipboard.`);
      setNotice(`${OUTPUT_PRESENTATION_BY_ID[activeOutputId].label} copied to clipboard.`);
    } catch (error) {
      const message = formatError(error, 'Copy could not access the clipboard.');
      setCopyStatus(message);
      setNotice(message);
    }
  };

  const handleOpenExport = () => {
    setExportPreparedAt(new Date());
    setExportReceipt(null);
    setExportOpen(true);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleExport = () => {
    try {
      if (!exportPlan.canExport || !exportPlan.document) throw new Error(exportPlan.disabledReason ?? 'No eligible document is available.');
      const content = exportPlan.document.content;
      if (exportFormat === 'word') {
        const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(exportPlan.document.title)}</title></head><body style="font-family:Georgia,serif;line-height:1.6;white-space:pre-wrap">${escapeHtml(content).replaceAll('\n', '<br>')}</body></html>`;
        downloadBlob(new Blob([html], { type: 'application/vnd.ms-word;charset=utf-8' }), exportPlan.filenamePreview);
      } else if (exportFormat === 'txt') {
        downloadBlob(new Blob([content], { type: 'text/plain;charset=utf-8' }), exportPlan.filenamePreview);
      } else {
        const printArea = document.getElementById('print-render-area');
        if (!printArea) throw new Error('The print area is unavailable.');
        printArea.textContent = content;
        window.print();
      }
      setExportReceipt(buildGuidedExportReceipt(exportPlan, 'completed'));
    } catch {
      setExportReceipt(buildGuidedExportReceipt(exportPlan, 'failed'));
    }
  };

  const resetTransientUi = () => {
    researchRequestRef.current += 1;
    researchAbortRef.current?.abort();
    photoIngestRequestRef.current += 1;
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
    setFetchError(null);
    setCampaignAnalysisError(null);
    setNotice(null);
    setBriefOpen(false);
    setExportOpen(false);
    setNavigatorOpen(false);
    setExportReceipt(null);
    setCopyStatus(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const handleFixtureChange = (fixtureId: string) => {
    if (!IS_DEVELOPMENT) return;
    session.photos.items.forEach(photo => {
      if (photo.previewUrl?.startsWith('blob:')) URL.revokeObjectURL(photo.previewUrl);
    });
    photoPayloadsRef.current.clear();
    const url = new URL(window.location.href);
    if (!fixtureId) {
      url.searchParams.delete('fixture');
      url.searchParams.delete('product');
      url.searchParams.delete('conflictOutput');
      window.history.replaceState({}, '', url);
      setSession(createInitialCampaignSessionState({
        sessionId: createSessionId(),
        gateState: hasVerifiedBetaAccess() ? 'verified' : 'locked',
      }));
    } else {
      url.searchParams.set('fixture', fixtureId);
      window.history.replaceState({}, '', url);
      setSession(getFixtureState(fixtureId as FixtureId));
    }
    resetTransientUi();
  };

  const openBriefAndReset = () => setBriefOpen(true);
  const navigateFromBrief = (
    stage: 'property' | 'campaign' | 'photos' | 'brief',
    targetId?: string,
  ) => {
    setBriefOpen(false);
    handleStageSelect(stage);
    if (targetId) {
      window.setTimeout(() => focusResultById(targetId), 0);
    }
  };

  const stageItems = useMemo(() => {
    const propertyStarted = Boolean(session.product || session.address.query || session.property.overview);
    const campaignStarted = Boolean(session.campaign.primaryAudience || session.campaign.writingStyles.length || session.campaign.suggestions.length);
    const photoStarted = session.photos.items.length > 0 || session.photos.policy === 'included';
    const outputAttention = CANONICAL_OUTPUT_ORDER.some(outputId => (
      session.outputs[outputId].state === 'failed'
      || session.outputs[outputId].state === 'needs-review'
      || session.outputs[outputId].state === 'needs-regeneration'
    ));
    const item = (
      id: CampaignStageId,
      label: string,
      state: StageNavigationState,
      labelText: string,
    ) => ({ id, label, state, stateLabel: labelText });
    const briefStageState: StageNavigationState = briefApprovalPresentation.state === 'APPROVED'
      ? 'approved'
      : briefApprovalPresentation.state === 'NEEDS_ATTENTION'
        ? 'needs-attention'
        : 'in-review';
    return [
      item('property', 'Property', session.property.approved ? 'approved' : propertyStarted ? 'in-review' : 'not-started', session.property.approved ? 'Approved' : propertyStarted ? 'In review' : 'Not started'),
      item('campaign', 'Campaign', session.campaign.approved ? 'approved' : campaignStarted ? 'in-review' : 'not-started', session.campaign.approved ? 'Approved' : campaignStarted ? 'In review' : 'Not started'),
      item('photos', 'Photos', session.photos.policy === 'off' && !photoStarted ? 'optional-off' : session.photos.approved ? 'approved' : 'in-review', session.photos.policy === 'off' && !photoStarted ? 'Optional · Off' : session.photos.approved ? 'Approved' : 'In review'),
      item('brief', 'Reviewed Brief', briefStageState, briefApprovalPresentation.statusLabel),
      item('outputs', 'Outputs', outputAttention ? 'needs-attention' : session.outputs['Full Copy'].state === 'ready' ? 'ready' : 'not-started', outputAttention ? 'Needs attention' : session.outputs['Full Copy'].state === 'ready' ? 'Ready' : 'Not generated'),
    ];
  }, [briefApprovalPresentation, session]);

  const stageLabel = session.stage === 'outputs'
    ? OUTPUT_PRESENTATION_BY_ID[activeOutputId].label
    : stageItems.find(item => item.id === session.stage)?.label ?? 'Property';
  const productLabel = session.product === 'campaign-pack'
    ? 'Campaign Pack'
    : session.product === 'listing-copy'
      ? 'Listing Copy'
      : 'Choose product';
  const campaignBarState = session.stage === 'outputs'
    ? stateLabel(session.outputs[activeOutputId].state)
    : stageItems.find(item => item.id === session.stage)?.stateLabel ?? 'Not started';
  const propertyApprovalIssues = getApprovedBriefBlockers({
    ...session,
    property: { ...session.property, approved: true },
  }).filter(blocker => blocker.governingStage === 'property');
  const photoApprovalIssues = getApprovedBriefBlockers({
    ...session,
    photos: { ...session.photos, approved: true },
  }).filter(blocker => blocker.governingStage === 'photos');
  let nextAction: React.ReactNode = null;
  if (session.stage === 'property') nextAction = session.property.approved
    ? <button className="button button--primary" type="button" onClick={() => handleStageSelect('campaign')}>Continue</button>
    : <button className="button button--primary" type="button" onClick={handleApproveProperty} disabled={propertyApprovalIssues.length > 0} title={propertyApprovalIssues[0]?.message}>Approve facts</button>;
  if (session.stage === 'campaign') nextAction = session.campaign.approved
    ? <button className="button button--primary" type="button" onClick={() => handleStageSelect('photos')}>Continue</button>
    : (
      <button
        className="button button--primary"
        type="button"
        aria-label="Approve campaign direction"
        onClick={handleApproveCampaign}
        disabled={campaignApprovalIssues.length > 0 || !session.property.approved || !session.campaign.primaryAudience.trim() || session.campaign.writingStyles.length === 0 || !session.campaign.tone.trim()}
        title={campaignApprovalIssues[0]}
      >
        <span className="button__full-label">Approve direction</span>
        <span className="button__compact-label" aria-hidden="true">Approve</span>
      </button>
    );
  if (session.stage === 'photos') nextAction = session.photos.approved
    ? <button className="button button--primary" type="button" onClick={() => handleStageSelect('brief')}>Review brief</button>
    : <button className="button button--primary" type="button" onClick={handleApprovePhotos} disabled={photoApprovalIssues.length > 0} title={photoApprovalIssues[0]?.message}>Approve policy</button>;
  if (session.stage === 'brief') nextAction = briefApprovalPresentation.primaryAction === 'open-outputs'
    ? <button className="button button--primary" type="button" onClick={() => handleStageSelect('outputs')}>{briefApprovalPresentation.primaryActionLabel}</button>
    : (
      <button
        className="button button--primary"
        type="button"
        aria-label={briefApprovalPresentation.primaryActionLabel}
        onClick={handleApproveBrief}
        disabled={briefBlockers.length > 0}
        title={briefBlockers[0]?.message}
      >
        <span className="button__full-label">{briefApprovalPresentation.primaryActionLabel}</span>
        <span className="button__compact-label" aria-hidden="true">Approve brief</span>
      </button>
    );
  const briefSnapshotForDrawer = briefApprovalPresentation.state === 'APPROVED' ? session.brief.snapshot : null;
  const briefButtonLabel = briefApprovalPresentation.state === 'APPROVED'
    ? 'Brief Snapshot'
    : session.brief.snapshot
      ? 'Reviewed Brief · Reapproval needed'
      : 'Reviewed Brief';

  const fixtureControl = IS_DEVELOPMENT ? (
    <details className="fixture-bar">
      <summary>Fixtures · {FIXTURE_ASSERTIONS?.assertionCount ?? 0} checks</summary>
      <div className="fixture-bar__body" role="region" aria-label="Development fixture selector">
        <label htmlFor="fixture-selector">Fixture</label>
        <select id="fixture-selector" value={session.fixture.id ?? ''} onChange={event => handleFixtureChange(event.target.value)}>
          <option value="">Live development state</option>
          {REQUIRED_FIXTURE_IDS.map(fixtureId => <option value={fixtureId} key={fixtureId}>{FIXTURE_CATALOGUE[fixtureId].title}</option>)}
        </select>
      </div>
    </details>
  ) : null;

  if (session.gate.state !== 'verified') {
    return (
      <>
        <BetaGate
          checking={isCheckingBetaAccess}
          submitting={betaSubmitting}
          value={betaCode}
          error={session.gate.error}
          onValueChange={setBetaCode}
          onSubmit={handleBetaSubmit}
        />
        {fixtureControl}
      </>
    );
  }

  let activeStage: React.ReactNode;
  if (session.stage === 'property') {
    activeStage = (
      <PropertyStage
        session={session}
        suggestions={suggestions}
        activeSuggestionIndex={activeSuggestionIndex}
        isSuggesting={isSuggesting}
        isFetching={isFetching}
        fetchError={fetchError}
        headingRef={stageHeadingRef}
        onProductChange={handleProductChange}
        onAddressChange={handleAddressChange}
        onAddressKeyDown={handleAddressKeyDown}
        onSelectAddress={handleSelectAddress}
        onFetch={handleFetchProperty}
        onIncludeAddressChange={included => updateSession(current => invalidateGovernedState({ ...current, address: { ...current.address, includeInCopy: included } }, 'property'))}
        onConfirmFact={handleConfirmFact}
        onCorrectFact={handleCorrectFact}
        onConfirmClaim={handleConfirmClaim}
        onCorrectClaim={handleCorrectClaim}
        onExcludeClaim={handleExcludeClaim}
        onOverviewDecision={handleOverviewDecision}
        onProfileInclusionChange={handleProfileInclusionChange}
        onApprove={handleApproveProperty}
      />
    );
  } else if (session.stage === 'campaign') {
    activeStage = (
      <CampaignStage
        session={session}
        headingRef={stageHeadingRef}
        isAnalysing={isAnalysingCampaign}
        analysisError={campaignAnalysisError}
        approvalIssues={campaignApprovalIssues}
        onFieldChange={handleCampaignFieldChange}
        onWritingStyleToggle={handleWritingStyleToggle}
        onListChange={handleCampaignListChange}
        onAnalyse={handleAnalyseCampaign}
        onSuggestionAction={handleSuggestionAction}
        onApprove={handleApproveCampaign}
      />
    );
  } else if (session.stage === 'photos') {
    activeStage = (
      <PhotosStage
        session={session}
        headingRef={stageHeadingRef}
        isAnalysing={isAnalysingPhotos}
        analysisProgress={photoAnalysisProgress}
        onPolicyChange={handlePhotoPolicyChange}
        onFilesSelected={handleFilesSelected}
        onPhotoSelected={handlePhotoSelected}
        onRemovePhoto={handleRemovePhoto}
        onAnalyse={handleAnalysePhotos}
        onHighlightAction={handleHighlightAction}
        onApprove={handleApprovePhotos}
      />
    );
  } else {
    activeStage = (
      <BriefStage
        session={session}
        blockers={briefBlockers}
        approvalPresentation={briefApprovalPresentation}
        headingRef={stageHeadingRef}
        onBooleanChange={handlePeopleBooleanChange}
        onAgentChange={handleAgentChange}
        onAgencyChange={handleAgencyChange}
        onOpenHomeChange={handleOpenHomeChange}
        onListingApproximateWordCountChange={handleListingApproximateWordCountChange}
        onNavigate={handleStageSelect}
        onApprove={handleApproveBrief}
        onOpenOutputs={() => handleStageSelect('outputs')}
      />
    );
  }

  return (
    <div className="app-shell">
      <a className="sr-only" href="#main-content">Skip to main content</a>
      <CampaignBar
        address={session.address.selectedLabel ?? session.address.query}
        productLabel={productLabel}
        locationLabel={stageLabel}
        stateLabel={campaignBarState}
        onOpenBrief={openBriefAndReset}
        briefLabel={briefButtonLabel}
        nextAction={nextAction}
      />

      {session.stage === 'outputs' ? (
        <OutputWorkspace
          session={session}
          activeOutputId={activeOutputId}
          packState={packState}
          copyStatus={copyStatus}
          notice={notice}
          onDismissNotice={() => setNotice(null)}
          headingRef={outputHeadingRef}
          onSelectOutput={handleSelectOutput}
          onOpenNavigator={() => setNavigatorOpen(true)}
          onOpenBrief={openBriefAndReset}
          onOpenExport={handleOpenExport}
          onGenerateListing={handleGenerateListing}
          onGeneratePack={handleGeneratePack}
          onRetryPack={handleRetryPack}
          onRegenerate={handleRegenerate}
          onCopy={handleCopy}
        />
      ) : (
        <div className="workspace preparation-layout">
          <StageNavigation activeStage={session.stage} stages={stageItems} onSelect={handleStageSelect} />
          <main className="work-pane" id="main-content">
            {previousTemporarySession && session.stage === 'property' && !session.fixture.id ? (
              <div className="notice" data-tone="review"><div><strong>Your previous temporary session ended</strong><p>Start a new campaign. No campaign content was restored after reload.</p></div></div>
            ) : null}
            {notice ? (
              <div className="notice" role="status">
                <div><strong>Campaign update</strong><p>{notice}</p></div>
                <button className="row-action" type="button" onClick={() => setNotice(null)}>Dismiss</button>
              </div>
            ) : null}
            {activeStage}
          </main>
        </div>
      )}

      <Overlay
        open={Boolean(governedReviewDraft)}
        title={governedReviewDraft?.kind === 'fact'
          ? `Correct ${governedReviewDraft.label}`
          : governedReviewDraft?.label ?? 'Review governed detail'}
        description="Review the source, provenance and downstream consequence before applying this decision."
        kind="sheet"
        onClose={() => setGovernedReviewDraft(null)}
        footer={(
          <>
            <button className="button button--secondary" type="button" onClick={() => setGovernedReviewDraft(null)}>Cancel</button>
            <button className="button button--primary" type="button" onClick={handleSaveGovernedReview}>Apply decision</button>
          </>
        )}
      >
        {governedReviewDraft ? (
          <div className="section-stack">
            <section className="surface surface--compact" aria-labelledby="governed-source-title">
              <div className="surface__header">
                <div><h3 id="governed-source-title">Source context</h3><p>{governedReviewDraft.provenance}</p></div>
              </div>
              <div className="surface__body">
                <p><strong>Source.</strong> {governedReviewDraft.kind === 'fact'
                  ? `${governedReviewDraft.sourceValue ?? 'Not supplied'}${governedReviewDraft.factKey === 'landValue' ? ` ${governedReviewDraft.sourceUnit ?? 'm²'}` : ''}`
                  : governedReviewDraft.sourceText}</p>
              </div>
            </section>

            {governedReviewDraft.kind === 'fact' ? (
              <div className="field-grid field-grid--two">
                <label className="field" htmlFor="governed-approved-value">
                  <span>Approved value</span>
                  <input
                    id="governed-approved-value"
                    type={governedReviewDraft.factKey === 'propertyType' ? 'text' : 'number'}
                    min={governedReviewDraft.factKey === 'propertyType' ? undefined : 0}
                    max={governedReviewDraft.factKey === 'landValue' ? 100000000 : governedReviewDraft.factKey === 'propertyType' ? undefined : 100}
                    step={governedReviewDraft.factKey === 'bedrooms' || governedReviewDraft.factKey === 'carSpaces' ? 1 : 'any'}
                    value={governedReviewDraft.value}
                    onChange={event => setGovernedReviewDraft(current => current?.kind === 'fact'
                      ? { ...current, value: event.target.value }
                      : current)}
                  />
                </label>
                {governedReviewDraft.factKey === 'landValue' ? (
                  <label className="field" htmlFor="governed-land-unit">
                    <span>Approved land unit</span>
                    <select
                      className="select-input"
                      id="governed-land-unit"
                      value={governedReviewDraft.unit ?? 'm²'}
                      onChange={event => setGovernedReviewDraft(current => current?.kind === 'fact'
                        ? { ...current, unit: event.target.value as LandUnit }
                        : current)}
                    >
                      <option value="m²">m²</option>
                      <option value="ha">ha</option>
                      <option value="acres">acres</option>
                    </select>
                  </label>
                ) : null}
              </div>
            ) : governedReviewDraft.action === 'correct' ? (
              <label className="field" htmlFor="governed-approved-wording">
                <span>Approved wording</span>
                <textarea
                  id="governed-approved-wording"
                  rows={5}
                  value={governedReviewDraft.value}
                  onChange={event => setGovernedReviewDraft(current => current && current.kind !== 'fact'
                    ? { ...current, value: event.target.value }
                    : current)}
                />
              </label>
            ) : (
              <label className="field" htmlFor="governed-exclusion-reason">
                <span>Exclusion reason</span>
                <textarea
                  id="governed-exclusion-reason"
                  rows={4}
                  value={governedReviewDraft.reason}
                  onChange={event => setGovernedReviewDraft(current => current && current.kind !== 'fact'
                    ? { ...current, reason: event.target.value }
                    : current)}
                />
              </label>
            )}

            <div className="notice" data-tone="review">
              <div>
                <strong>Downstream scope</strong>
                <p>This changes the governed brief. Any existing Listing Copy and Campaign Pack outputs will be marked Needs regeneration; no regeneration starts automatically.</p>
              </div>
            </div>
          </div>
        ) : null}
      </Overlay>

      <Overlay
        open={briefOpen}
        title={briefSnapshotForDrawer ? 'Approved Brief Snapshot' : 'Reviewed Campaign Brief'}
        description={briefSnapshotForDrawer
          ? 'Read-only approved decision context. Return to the governing stage to make changes.'
          : 'Current draft decision context. Reapproval is required before generation.'}
        kind="drawer"
        onClose={() => setBriefOpen(false)}
      >
        <ReviewedBriefProof session={session} snapshot={briefSnapshotForDrawer} compact onNavigate={navigateFromBrief} />
      </Overlay>

      <Overlay
        open={navigatorOpen}
        title="Campaign documents"
        description="Selecting a document reveals it immediately and never starts generation."
        kind="sheet"
        onClose={() => setNavigatorOpen(false)}
      >
        <div className="document-nav__header">
          <h2>{session.product === 'listing-copy' ? 'Listing document' : 'Listing foundation + Campaign Pack'}</h2>
          <p>{session.product === 'listing-copy' ? 'One read-only Listing Copy foundation.' : '17 capabilities, presented as one foundation and one 16-output campaign product.'}</p>
        </div>
        <DocumentNavigatorList outputs={session.outputs} activeOutputId={activeOutputId} product={session.product} onSelect={handleSelectOutput} />
      </Overlay>

      <Overlay
        open={exportOpen}
        title="Export"
        description="Generated-only export. Missing, stale or integrity-blocked documents are omitted."
        kind="sheet"
        onClose={() => setExportOpen(false)}
      >
        <ExportPanel
          plan={exportPlan}
          scope={exportScope}
          format={exportFormat}
          includeContactDetails={includeContactDetails}
          receipt={exportReceipt}
          campaignPackAvailable={session.product === 'campaign-pack'}
          onScopeChange={scope => { setExportScope(scope); setExportReceipt(null); }}
          onFormatChange={format => { setExportFormat(format); setExportReceipt(null); }}
          onContactDetailsChange={included => { setIncludeContactDetails(included); setExportReceipt(null); }}
          onExport={handleExport}
        />
      </Overlay>

      {fixtureControl}
    </div>
  );
};

export default App;
