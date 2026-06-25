import type { PreviewTab } from '../types';

export type CampaignExportScope = 'current_output' | 'current_category' | 'campaign_document';

export interface CampaignExportCategoryDefinition {
    title: string;
    tabs: PreviewTab[];
}

export interface CampaignExportUsageCostSummary {
    operationCount: number;
    successfulOperationCount: number;
    errorOperationCount: number;
    pendingOperationCount: number;
    models: string[];
    tokenOnlyEstimatedCost: number | null;
    usageUnavailableCount: number;
    unknownCostCount: number;
}

export interface CampaignExportGenerationLogSummary {
    totalEntries: number;
    recentSteps: string[];
}

export interface CampaignExportInputSnapshotSummary {
    includeAddress: boolean;
    propertyType?: string;
    bedrooms?: number | null;
    bathrooms?: number | null;
    carSpaces?: number | null;
    landSize?: number | null;
    primaryTargetMarket?: string;
    secondaryTargetMarket?: string;
    writingStyles?: string[];
    wordCount?: number;
    propertyFeaturesProvided?: boolean;
    imageAnalysisProvided?: boolean;
    researchProvided?: boolean;
    suburbOrAreaProfileIncluded?: boolean;
    openHouseProvided?: boolean;
    agentProfileProvided?: boolean;
}

export interface CampaignExportSection {
    tab: PreviewTab;
    title: string;
    category: string;
    slug: string;
    fileBaseName: string;
    content: string;
    generated: boolean;
}

export interface CampaignExportDocument {
    scope: CampaignExportScope;
    title: string;
    fileBaseName: string;
    content: string;
    outputIds: PreviewTab[];
    category?: string;
}

export interface CampaignZipManifestItem {
    role: 'master' | 'category' | 'output' | 'manifest';
    scope: CampaignExportScope | 'future_package_manifest';
    title: string;
    fileBaseName: string;
    outputIds: PreviewTab[];
    category?: string;
    generated?: boolean;
}

export interface CampaignExportManifest {
    schemaVersion: 'copywriting-export-pack.v1';
    app: {
        id: 'real-estate-aim-copywriting';
        name: 'Real Estate AIM Copywriting Agent';
        version: 'v1';
    };
    generatedAt: string;
    exportScope: CampaignExportScope;
    exportLabel: string;
    fileSafeSlug: string;
    propertyAddress: string;
    propertyContextSummary?: string;
    selectedCategory?: string;
    selectedOutputId?: PreviewTab;
    includedOutputIds: PreviewTab[];
    missingOutputIds: PreviewTab[];
    contactCardIncluded: boolean;
    inputSnapshotSummary?: CampaignExportInputSnapshotSummary;
    usageCostSummary?: CampaignExportUsageCostSummary;
    generationLogSummary?: CampaignExportGenerationLogSummary;
    documents: CampaignZipManifestItem[];
}

export interface CampaignExportPlan {
    masterDocument: CampaignExportDocument;
    categoryDocuments: CampaignExportDocument[];
    individualOutputDocuments: CampaignExportDocument[];
    selectedCategoryDocument: CampaignExportDocument | null;
    sectionDocuments: CampaignExportSection[];
    selectedSectionDocument: CampaignExportSection | null;
    generatedSections: CampaignExportSection[];
    missingSections: CampaignExportSection[];
    manifest: CampaignExportManifest;
    zipManifest: CampaignZipManifestItem[];
}

export interface BuildCampaignExportPlanInput {
    address: string;
    versionNumber: number;
    sections: Partial<Record<PreviewTab, string>>;
    orderedTabs: PreviewTab[];
    categories: CampaignExportCategoryDefinition[];
    selectedTab: PreviewTab;
    selectedCategory?: string;
    exportScope?: CampaignExportScope;
    includeContactDetails?: boolean;
    contactCard?: string;
    generatedAt?: Date;
    propertyContextSummary?: string;
    inputSnapshotSummary?: CampaignExportInputSnapshotSummary;
    usageCostSummary?: CampaignExportUsageCostSummary;
    generationLogSummary?: CampaignExportGenerationLogSummary;
}

export const sanitizeFileNamePart = (value: string): string => {
    const cleaned = value
        .trim()
        .replace(/&/g, ' and ')
        .replace(/[^a-zA-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/-{2,}/g, '-');
    return cleaned || 'untitled';
};

const appendContactCard = (content: string, contactCard?: string): string => {
    const trimmedCard = contactCard?.trim();
    if (!trimmedCard || content.includes(trimmedCard)) return content;
    return `${content.trim()}\n\n${trimmedCard}`;
};

const formatDateSlug = (date: Date): string => date.toISOString().slice(0, 10);

const formatGeneratedAt = (date: Date): string => date.toISOString();

const buildHeader = (lines: string[]): string => {
    return [
        ...lines.filter(line => line.trim().length > 0),
        '',
        '====================================',
        '',
    ].join('\n');
};

const buildMissingOutputNotice = (missingSections: CampaignExportSection[]): string[] => {
    if (missingSections.length === 0) return [];
    return [
        'Missing outputs not included:',
        missingSections.map(section => `- ${section.title}`).join('\n'),
        '',
        'Download actions export generated outputs only. Use Generate missing to create additional outputs before exporting again.',
        '',
        '====================================',
        '',
    ];
};

const buildSectionBlock = (section: CampaignExportSection): string[] => [
    `--- ${section.title} ---`,
    '',
    section.content,
    '',
    '====================================',
    '',
];

export const buildCampaignExportPlan = ({
    address,
    versionNumber,
    sections,
    orderedTabs,
    categories,
    selectedTab,
    selectedCategory,
    exportScope,
    includeContactDetails = false,
    contactCard,
    generatedAt = new Date(),
    propertyContextSummary,
    inputSnapshotSummary,
    usageCostSummary,
    generationLogSummary,
}: BuildCampaignExportPlanInput): CampaignExportPlan => {
    const propertyName = address.trim() || 'Untitled Property';
    const propertySlug = sanitizeFileNamePart(address || 'property');
    const dateSlug = formatDateSlug(generatedAt);
    const categoryByTab = categories.reduce<Record<string, string>>((acc, category) => {
        category.tabs.forEach(tab => {
            acc[tab] = category.title;
        });
        return acc;
    }, {});

    const sectionDocuments = orderedTabs.map((tab): CampaignExportSection => {
        const rawContent = sections[tab] || '';
        const content = includeContactDetails && rawContent
            ? appendContactCard(rawContent, contactCard)
            : rawContent;
        const slug = sanitizeFileNamePart(tab);

        return {
            tab,
            title: tab,
            category: categoryByTab[tab] || 'Campaign',
            slug,
            fileBaseName: `real-estate-aim-copywriting-current-output-${propertySlug}-${slug}-${dateSlug}`,
            content,
            generated: Boolean(rawContent.trim()),
        };
    });

    const generatedSections = sectionDocuments.filter(section => section.generated);
    const missingSections = sectionDocuments.filter(section => !section.generated);
    const selectedSectionDocument = sectionDocuments.find(section => section.tab === selectedTab) || null;
    const selectedOutputCategory = selectedSectionDocument?.category;
    const manifestScope: CampaignExportScope = exportScope ?? (
        selectedCategory && selectedCategory !== 'All'
            ? 'current_category'
            : selectedSectionDocument
                ? 'current_output'
                : 'campaign_document'
    );
    const exportLabel = manifestScope === 'campaign_document'
        ? 'Campaign document'
        : manifestScope === 'current_category' && selectedCategory && selectedCategory !== 'All'
            ? `${selectedCategory} category`
            : selectedSectionDocument
                ? `${selectedSectionDocument.title} output`
                : 'Current output';

    const individualOutputDocuments = sectionDocuments
        .filter(section => section.generated)
        .map((section): CampaignExportDocument => ({
            scope: 'current_output',
            title: `${section.title} output`,
            fileBaseName: section.fileBaseName,
            outputIds: [section.tab],
            category: section.category,
            content: [
                buildHeader([
                    `Real Estate AIM Copywriting Export`,
                    `Export scope: Current output`,
                    `Output: ${section.title}`,
                    `Category: ${section.category}`,
                    `Property: ${propertyName}`,
                    `Version: ${versionNumber}`,
                    `Generated: ${formatGeneratedAt(generatedAt)}`,
                ]),
                section.content,
                '',
                '====================================',
                '',
                'Generated output only. To change the copy, update the campaign inputs and regenerate.',
                '',
            ].join('\n'),
        }));

    const categoryDocuments = categories.map((category): CampaignExportDocument => {
        const categorySections = sectionDocuments.filter(section => category.tabs.includes(section.tab));
        const generatedCategorySections = categorySections.filter(section => section.generated);
        const missingCategorySections = categorySections.filter(section => !section.generated);
        const categorySlug = sanitizeFileNamePart(category.title);

        return {
            scope: 'current_category',
            title: `${category.title} category`,
            fileBaseName: `real-estate-aim-copywriting-category-${propertySlug}-${categorySlug}-${dateSlug}`,
            outputIds: generatedCategorySections.map(section => section.tab),
            category: category.title,
            content: [
                buildHeader([
                    `Real Estate AIM Copywriting Export`,
                    `Export scope: Current category`,
                    `Category: ${category.title}`,
                    `Property: ${propertyName}`,
                    `Version: ${versionNumber}`,
                    `Generated: ${formatGeneratedAt(generatedAt)}`,
                ]),
                ...generatedCategorySections.flatMap(buildSectionBlock),
                ...buildMissingOutputNotice(missingCategorySections),
            ].join('\n'),
        };
    });
    const selectedCategoryDocument = selectedCategory && selectedCategory !== 'All'
        ? categoryDocuments.find(document => document.category === selectedCategory) || null
        : null;

    const masterDocument: CampaignExportDocument = {
        scope: 'campaign_document',
        title: `${propertyName} full campaign`,
        fileBaseName: `real-estate-aim-copywriting-campaign-${propertySlug}-${dateSlug}`,
        outputIds: generatedSections.map(section => section.tab),
        content: [
            buildHeader([
                `Real Estate AIM Copywriting Export`,
                `Export scope: Campaign document`,
                `Property: ${propertyName}`,
                `Version: ${versionNumber}`,
                `Generated: ${formatGeneratedAt(generatedAt)}`,
            ]),
            ...categories.flatMap(category => {
                const categorySections = generatedSections.filter(section => section.category === category.title);
                if (categorySections.length === 0) return [];
                return [
                    `### ${category.title}`,
                    '',
                    ...categorySections.flatMap(buildSectionBlock),
                ];
            }),
            ...buildMissingOutputNotice(missingSections),
        ].join('\n'),
    };
    const zipManifest: CampaignZipManifestItem[] = [
        {
            role: 'master',
            scope: 'campaign_document',
            title: masterDocument.title,
            fileBaseName: masterDocument.fileBaseName,
            outputIds: masterDocument.outputIds,
            generated: masterDocument.outputIds.length > 0,
        },
        ...categoryDocuments.map(document => ({
            role: 'category' as const,
            scope: 'current_category' as const,
            title: document.title,
            fileBaseName: document.fileBaseName,
            outputIds: document.outputIds,
            category: document.category,
            generated: document.outputIds.length > 0,
        })),
        ...sectionDocuments.map(section => ({
            role: 'output' as const,
            scope: 'current_output' as const,
            title: section.title,
            fileBaseName: section.fileBaseName,
            outputIds: [section.tab],
            category: section.category,
            generated: section.generated,
        })),
    ];
    const manifest: CampaignExportManifest = {
        schemaVersion: 'copywriting-export-pack.v1',
        app: {
            id: 'real-estate-aim-copywriting',
            name: 'Real Estate AIM Copywriting Agent',
            version: 'v1',
        },
        generatedAt: formatGeneratedAt(generatedAt),
        exportScope: manifestScope,
        exportLabel,
        fileSafeSlug: sanitizeFileNamePart(`${propertySlug}-${exportLabel}-${dateSlug}`),
        propertyAddress: propertyName,
        propertyContextSummary,
        selectedCategory: selectedCategory && selectedCategory !== 'All' ? selectedCategory : selectedOutputCategory,
        selectedOutputId: selectedTab,
        includedOutputIds: generatedSections.map(section => section.tab),
        missingOutputIds: missingSections.map(section => section.tab),
        contactCardIncluded: includeContactDetails && Boolean(contactCard?.trim()),
        inputSnapshotSummary,
        usageCostSummary,
        generationLogSummary,
        documents: [
            ...zipManifest,
            {
                role: 'manifest',
                scope: 'future_package_manifest',
                title: 'Export package manifest',
                fileBaseName: `real-estate-aim-copywriting-manifest-${propertySlug}-${dateSlug}`,
                outputIds: generatedSections.map(section => section.tab),
                generated: true,
            },
        ],
    };

    return {
        masterDocument,
        categoryDocuments,
        individualOutputDocuments,
        selectedCategoryDocument,
        sectionDocuments,
        selectedSectionDocument,
        generatedSections,
        missingSections,
        manifest,
        zipManifest,
    };
};
