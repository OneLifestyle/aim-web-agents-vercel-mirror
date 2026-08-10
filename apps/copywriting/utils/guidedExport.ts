import type {
    CampaignOutputDocument,
    OutputIntegrityIssue,
    PreviewTab,
} from '../types';
import {
    buildCampaignExportPlan,
    sanitizeFileNamePart,
    type CampaignExportCategoryDefinition,
    type CampaignExportDocument,
    type CampaignExportScope,
} from './exportAssembly';

export type GuidedExportScope = 'current_output' | 'current_group' | 'campaign_pack';
export type GuidedExportFormat = 'word' | 'txt' | 'pdf';
export type GuidedExportOmissionKind = 'missing' | 'stale' | 'blocked' | 'failed';
export type GuidedExportEligibilityStatus = 'included' | GuidedExportOmissionKind;

export interface GuidedExportFormatDefinition {
    id: GuidedExportFormat;
    label: string;
    extension: '.doc' | '.txt' | '.pdf';
    delivery: 'download' | 'print';
    filenameIsSuggested: boolean;
}

export const GUIDED_EXPORT_FORMATS: Readonly<Record<GuidedExportFormat, GuidedExportFormatDefinition>> = {
    word: {
        id: 'word',
        label: 'Word-compatible document (.doc)',
        extension: '.doc',
        delivery: 'download',
        filenameIsSuggested: false,
    },
    txt: {
        id: 'txt',
        label: 'Plain text (.txt)',
        extension: '.txt',
        delivery: 'download',
        filenameIsSuggested: false,
    },
    pdf: {
        id: 'pdf',
        label: 'Print / Save as PDF',
        extension: '.pdf',
        delivery: 'print',
        filenameIsSuggested: true,
    },
};

export const GUIDED_EXPORT_OUTPUT_LABELS: Readonly<Record<PreviewTab, string>> = {
    'Full Copy': 'Listing Copy',
    'Just Listed': 'Just Listed',
    'Brochure Copy': 'Brochure',
    Email: 'Email',
    Flyer: 'Flyer',
    Facebook: 'Facebook',
    'Facebook Marketplace': 'Facebook Marketplace',
    Instagram: 'Instagram',
    'X (Twitter)': 'X',
    'Google Business': 'Google Business Profile',
    TikTok: 'TikTok',
    'Open House': 'Open House',
    'Long-form / Blog': 'Blog',
    'Video Script': 'Video Script',
    'Coming Soon Teaser': 'Teaser',
    'Coming Soon Email': 'Coming Soon Email',
    'Coming Soon SMS': 'SMS',
};

export const GUIDED_CAMPAIGN_PACK_OUTPUT_IDS = [
    'Just Listed',
    'Brochure Copy',
    'Email',
    'Flyer',
    'Coming Soon Teaser',
    'Coming Soon Email',
    'Coming Soon SMS',
    'Facebook',
    'Facebook Marketplace',
    'Instagram',
    'X (Twitter)',
    'Google Business',
    'TikTok',
    'Open House',
    'Long-form / Blog',
    'Video Script',
] as const satisfies readonly PreviewTab[];

export interface GuidedExportEligibility {
    eligible: boolean;
    status: GuidedExportEligibilityStatus;
    reason: string | null;
    governingBriefItems: string[];
}

export interface GuidedExportCounts {
    total: number;
    included: number;
    missing: number;
    stale: number;
    blocked: number;
    failed: number;
}

export interface GuidedExportIncludedDocument {
    id: PreviewTab;
    name: string;
    group: string;
}

export interface GuidedExportOmission {
    id: PreviewTab;
    name: string;
    group: string;
    kind: GuidedExportOmissionKind;
    reason: string;
    governingBriefItems: string[];
}

export interface GuidedExportPresentation {
    contactSignatureIncluded: boolean;
    contactSignatureAvailable: boolean;
    contactSignatureLabel: string;
    addressIncludedInCopy: boolean;
    addressPolicyLabel: string;
}

export interface GuidedExportPlan {
    scope: GuidedExportScope;
    scopeLabel: string;
    format: GuidedExportFormatDefinition;
    filenamePreview: string;
    filenamePreviewLabel: string;
    counts: GuidedExportCounts;
    includedDocuments: GuidedExportIncludedDocument[];
    omissions: GuidedExportOmission[];
    presentation: GuidedExportPresentation;
    document: CampaignExportDocument | null;
    canExport: boolean;
    disabledReason: string | null;
}

export interface BuildGuidedExportPlanInput {
    address: string;
    documents: readonly CampaignOutputDocument[];
    orderedTabs: readonly PreviewTab[];
    categories: readonly CampaignExportCategoryDefinition[];
    selectedTab: PreviewTab;
    selectedGroup?: string;
    scope: GuidedExportScope;
    format: GuidedExportFormat;
    activeSnapshotId: string | null;
    generatedAt: Date;
    includeContactDetails: boolean;
    contactCard?: string;
    includeAddressInCopy: boolean;
    listingCopyId?: PreviewTab;
    campaignPackOutputIds?: readonly PreviewTab[];
    outputLabels?: Partial<Record<PreviewTab, string>>;
}

export type GuidedExportReceiptOutcome = 'completed' | 'failed';

export interface GuidedExportReceipt {
    status: 'success' | 'error';
    role: 'status' | 'alert';
    title: string;
    message: string;
    filename: string;
    includedCount: number;
}

const unique = <T,>(values: readonly T[]): T[] => Array.from(new Set(values));

const formatList = (values: readonly string[]): string => {
    if (values.length === 0) return '';
    if (values.length === 1) return values[0];
    if (values.length === 2) return `${values[0]} and ${values[1]}`;
    return `${values.slice(0, -1).join(', ')}, and ${values[values.length - 1]}`;
};

const getBlockingIssues = (issues: readonly OutputIntegrityIssue[]): OutputIntegrityIssue[] => (
    issues.filter(issue => issue.code !== 'snapshot-mismatch' && issue.code !== 'foundation-mismatch')
);

const getIntegrityBlockedReason = (issues: readonly OutputIntegrityIssue[]): {
    reason: string;
    governingBriefItems: string[];
} => {
    const governingBriefItems = unique(
        issues
            .map(issue => issue.governingBriefItem.trim())
            .filter(Boolean),
    );
    const scope = governingBriefItems.length > 0
        ? ` by ${formatList(governingBriefItems)}`
        : '';

    return {
        reason: `Integrity blocked${scope}. Review the governing brief item and regenerate this document before exporting.`,
        governingBriefItems,
    };
};

/**
 * Resolves one document into exactly one export bucket. This helper never mutates
 * output state and never starts generation.
 */
export const getGuidedExportEligibility = (
    document: CampaignOutputDocument | undefined,
    activeSnapshotId: string | null,
): GuidedExportEligibility => {
    if (!document) {
        return {
            eligible: false,
            status: 'missing',
            reason: 'This document has not been generated.',
            governingBriefItems: [],
        };
    }

    if (document.state === 'failed') {
        return {
            eligible: false,
            status: 'failed',
            reason: 'Generation failed. Retry this document before exporting.',
            governingBriefItems: [],
        };
    }

    const blockingIssues = getBlockingIssues(document.integrityIssues);
    if (blockingIssues.length > 0 || document.state === 'needs-review') {
        const integrity = getIntegrityBlockedReason(blockingIssues);
        return {
            eligible: false,
            status: 'blocked',
            reason: blockingIssues.length > 0
                ? integrity.reason
                : 'Integrity review is required. Resolve the governing brief issue and regenerate this document before exporting.',
            governingBriefItems: integrity.governingBriefItems,
        };
    }

    if (
        document.state === 'not-generated'
        || document.state === 'queued'
        || document.state === 'generating'
        || (document.state === 'ready' && !document.content.trim())
    ) {
        const reason = document.state === 'generating'
            ? 'Generation is still in progress.'
            : document.state === 'queued'
                ? 'Generation is queued and has not completed.'
                : 'This document has not been generated.';
        return {
            eligible: false,
            status: 'missing',
            reason,
            governingBriefItems: [],
        };
    }

    const hasSnapshotMismatch = document.integrityIssues.some(issue => issue.code === 'snapshot-mismatch');
    const isBoundToActiveBrief = Boolean(activeSnapshotId)
        && document.boundSnapshotId === activeSnapshotId;
    if (document.state === 'needs-regeneration' || hasSnapshotMismatch || !isBoundToActiveBrief) {
        return {
            eligible: false,
            status: 'stale',
            reason: activeSnapshotId
                ? 'The approved brief changed after this document was generated. Regenerate it before exporting.'
                : 'No approved brief is active for this document. Approve the brief and regenerate before exporting.',
            governingBriefItems: [],
        };
    }

    return {
        eligible: true,
        status: 'included',
        reason: null,
        governingBriefItems: [],
    };
};

const getGroupByTab = (
    categories: readonly CampaignExportCategoryDefinition[],
): Map<PreviewTab, string> => {
    const groupByTab = new Map<PreviewTab, string>();
    categories.forEach(category => {
        category.tabs.forEach(tab => groupByTab.set(tab, category.title));
    });
    return groupByTab;
};

const getScopeIds = (
    input: BuildGuidedExportPlanInput,
    currentGroup: string | undefined,
): PreviewTab[] => {
    if (input.scope === 'current_output') return [input.selectedTab];

    const listingCopyId = input.listingCopyId ?? 'Full Copy';
    const configuredCampaignIds = unique([
        listingCopyId,
        ...(input.campaignPackOutputIds ?? GUIDED_CAMPAIGN_PACK_OUTPUT_IDS),
    ]);

    if (input.scope === 'current_group') {
        const group = input.categories.find(category => category.title === currentGroup);
        return group
            ? unique(group.tabs)
            : [];
    }

    const orderedCampaignIds = input.orderedTabs.filter(tab => configuredCampaignIds.includes(tab));
    const idsMissingFromOrder = configuredCampaignIds.filter(tab => !orderedCampaignIds.includes(tab));
    return [...orderedCampaignIds, ...idsMissingFromOrder];
};

const getScopeLabel = (
    scope: GuidedExportScope,
    selectedTab: PreviewTab,
    currentGroup: string | undefined,
    labels: Readonly<Record<PreviewTab, string>>,
): string => {
    if (scope === 'current_output') return `Current document · ${labels[selectedTab]}`;
    if (scope === 'current_group') return currentGroup ? `Current group · ${currentGroup}` : 'Current group';
    return 'Full campaign document';
};

const buildFallbackFileBaseName = (
    input: BuildGuidedExportPlanInput,
    currentGroup: string | undefined,
): string => {
    const propertySlug = sanitizeFileNamePart(input.address || 'property');
    const dateSlug = input.generatedAt.toISOString().slice(0, 10);

    if (input.scope === 'current_output') {
        return `real-estate-aim-copywriting-current-output-${propertySlug}-${sanitizeFileNamePart(input.selectedTab)}-${dateSlug}`;
    }
    if (input.scope === 'current_group') {
        return `real-estate-aim-copywriting-category-${propertySlug}-${sanitizeFileNamePart(currentGroup || 'group')}-${dateSlug}`;
    }
    return `real-estate-aim-copywriting-campaign-${propertySlug}-${dateSlug}`;
};

const removeLegacyVersionLine = (content: string): string => (
    content
        .split('\n')
        .filter(line => !/^Version:\s*/i.test(line.trim()))
        .join('\n')
        .replace(/\n{4,}/g, '\n\n\n')
        .trim()
);

const buildOmissionAppendix = (omissions: readonly GuidedExportOmission[]): string => {
    if (omissions.length === 0) return '';
    return [
        'Omitted documents',
        '',
        ...omissions.map(omission => `- ${omission.name} — ${omission.reason}`),
    ].join('\n');
};

const prepareDocumentForGuidedExport = (
    document: CampaignExportDocument,
    scope: GuidedExportScope,
    scopeLabel: string,
    omissions: readonly GuidedExportOmission[],
): CampaignExportDocument => {
    const omissionAppendix = scope === 'current_output' ? '' : buildOmissionAppendix(omissions);
    const content = removeLegacyVersionLine(document.content)
        .replace('Export scope: Current category', `Export scope: ${scopeLabel}`)
        .replace('Export scope: Campaign document', `Export scope: ${scopeLabel}`);

    return {
        ...document,
        title: scope === 'current_group'
                ? `${scopeLabel.replace(/^Current group ·\s*/, '')} group`
                : document.title,
        content: omissionAppendix ? `${content}\n\n${omissionAppendix}\n` : `${content}\n`,
    };
};

const buildEligibleDocument = (
    input: BuildGuidedExportPlanInput,
    currentGroup: string | undefined,
    includedIds: readonly PreviewTab[],
    eligibleSections: Partial<Record<PreviewTab, string>>,
    omissions: readonly GuidedExportOmission[],
    scopeLabel: string,
): CampaignExportDocument | null => {
    if (includedIds.length === 0) return null;

    const includedIdSet = new Set(includedIds);
    const categories = input.categories
        .map(category => ({
            title: category.title,
            tabs: category.tabs.filter(tab => includedIdSet.has(tab)),
        }))
        .filter(category => category.tabs.length > 0);
    const legacyScope: CampaignExportScope = input.scope === 'current_output'
        ? 'current_output'
        : input.scope === 'current_group'
            ? 'current_category'
            : 'campaign_document';
    const selectedTab = input.scope === 'current_output' ? input.selectedTab : includedIds[0];
    const plan = buildCampaignExportPlan({
        address: input.address,
        versionNumber: 1,
        sections: eligibleSections,
        orderedTabs: [...includedIds],
        categories,
        selectedTab,
        selectedCategory: input.scope === 'current_group' ? currentGroup : undefined,
        exportScope: legacyScope,
        includeContactDetails: input.includeContactDetails,
        contactCard: input.contactCard,
        generatedAt: input.generatedAt,
    });

    const document = input.scope === 'current_output'
        ? plan.individualOutputDocuments.find(candidate => candidate.outputIds.includes(input.selectedTab)) ?? null
        : input.scope === 'current_group'
            ? plan.selectedCategoryDocument
            : plan.masterDocument;

    return document
        ? prepareDocumentForGuidedExport(document, input.scope, scopeLabel, omissions)
        : null;
};

/**
 * Builds a user-facing export plan around the existing document assembler.
 * Only ready documents bound to the active approved brief reach the assembler.
 */
export const buildGuidedExportPlan = (input: BuildGuidedExportPlanInput): GuidedExportPlan => {
    const labels: Readonly<Record<PreviewTab, string>> = {
        ...GUIDED_EXPORT_OUTPUT_LABELS,
        ...input.outputLabels,
    };
    const groupByTab = getGroupByTab(input.categories);
    const currentGroup = input.selectedGroup ?? groupByTab.get(input.selectedTab);
    const scopeIds = getScopeIds(input, currentGroup);
    const documentById = new Map<PreviewTab, CampaignOutputDocument>();
    input.documents.forEach(document => documentById.set(document.id, document));

    const includedDocuments: GuidedExportIncludedDocument[] = [];
    const omissions: GuidedExportOmission[] = [];
    const eligibleSections: Partial<Record<PreviewTab, string>> = {};
    const counts: GuidedExportCounts = {
        total: scopeIds.length,
        included: 0,
        missing: 0,
        stale: 0,
        blocked: 0,
        failed: 0,
    };

    scopeIds.forEach(id => {
        const sourceDocument = documentById.get(id);
        const eligibility = getGuidedExportEligibility(sourceDocument, input.activeSnapshotId);
        const name = labels[id];
        const group = groupByTab.get(id) ?? 'Campaign Pack';

        if (eligibility.eligible && sourceDocument) {
            counts.included += 1;
            includedDocuments.push({ id, name, group });
            eligibleSections[id] = sourceDocument.content;
            return;
        }

        const kind = eligibility.status as GuidedExportOmissionKind;
        counts[kind] += 1;
        omissions.push({
            id,
            name,
            group,
            kind,
            reason: eligibility.reason ?? 'This document is not eligible for export.',
            governingBriefItems: eligibility.governingBriefItems,
        });
    });

    const scopeLabel = getScopeLabel(input.scope, input.selectedTab, currentGroup, labels);
    const contactSignatureAvailable = Boolean(input.contactCard?.trim());
    const effectiveInput = {
        ...input,
        includeContactDetails: input.includeContactDetails && contactSignatureAvailable,
    };
    const document = buildEligibleDocument(
        effectiveInput,
        currentGroup,
        includedDocuments.map(included => included.id),
        eligibleSections,
        omissions,
        scopeLabel,
    );
    const format = GUIDED_EXPORT_FORMATS[input.format];
    const fileBaseName = document?.fileBaseName ?? buildFallbackFileBaseName(input, currentGroup);
    const filenamePreview = `${fileBaseName}${format.extension}`;
    const hasCurrentGroup = Boolean(
        currentGroup && input.categories.some(category => category.title === currentGroup),
    );
    const missingGroupReason = input.scope === 'current_group' && !hasCurrentGroup
        ? 'Choose a navigator group before exporting.'
        : null;
    const disabledReason = missingGroupReason ?? (
        counts.included === 0
            ? input.scope === 'current_output' && omissions[0]
                ? omissions[0].reason
                : 'No generated, current documents are available in this scope.'
            : null
    );

    return {
        scope: input.scope,
        scopeLabel,
        format,
        filenamePreview,
        filenamePreviewLabel: format.filenameIsSuggested
            ? `Suggested filename: ${filenamePreview}`
            : `Filename: ${filenamePreview}`,
        counts,
        includedDocuments,
        omissions,
        presentation: {
            contactSignatureIncluded: effectiveInput.includeContactDetails,
            contactSignatureAvailable,
            contactSignatureLabel: !contactSignatureAvailable
                ? 'Add agent or agency details in the Reviewed Brief to include a signature'
                : effectiveInput.includeContactDetails
                    ? 'Contact/signature included'
                    : 'Contact/signature not included',
            addressIncludedInCopy: input.includeAddressInCopy,
            addressPolicyLabel: input.includeAddressInCopy
                ? 'Property address included in copy'
                : 'Property address omitted from copy',
        },
        document,
        canExport: Boolean(document) && !missingGroupReason,
        disabledReason,
    };
};

/** Builds a deterministic, user-safe completion or failure receipt. */
export const buildGuidedExportReceipt = (
    plan: GuidedExportPlan,
    outcome: GuidedExportReceiptOutcome,
): GuidedExportReceipt => {
    const includedLabel = `${plan.counts.included} ${plan.counts.included === 1 ? 'document' : 'documents'}`;
    const completed = outcome === 'completed' && plan.canExport;

    if (!completed) {
        const action = plan.format.delivery === 'print'
            ? 'open Print / Save as PDF'
            : `create ${plan.filenamePreview}`;
        return {
            status: 'error',
            role: 'alert',
            title: 'Export failed',
            message: `Could not ${action}. Your export scope and settings are unchanged. Try again.`,
            filename: plan.filenamePreview,
            includedCount: plan.counts.included,
        };
    }

    if (plan.format.delivery === 'print') {
        return {
            status: 'success',
            role: 'status',
            title: 'Print dialog opened',
            message: `Opened Print / Save as PDF for ${includedLabel}. Suggested filename: ${plan.filenamePreview}.`,
            filename: plan.filenamePreview,
            includedCount: plan.counts.included,
        };
    }

    return {
        status: 'success',
        role: 'status',
        title: 'Export complete',
        message: `Downloaded ${plan.filenamePreview} · ${includedLabel}.`,
        filename: plan.filenamePreview,
        includedCount: plan.counts.included,
    };
};
