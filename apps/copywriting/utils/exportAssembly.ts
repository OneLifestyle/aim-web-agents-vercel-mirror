import type { PreviewTab } from '../types';

export interface CampaignExportSection {
    tab: PreviewTab;
    title: string;
    slug: string;
    fileBaseName: string;
    content: string;
    generated: boolean;
}

export interface CampaignExportDocument {
    title: string;
    fileBaseName: string;
    content: string;
}

export interface CampaignZipManifestItem {
    role: 'master' | 'section';
    title: string;
    fileBaseName: string;
    generated?: boolean;
}

export interface CampaignExportPlan {
    masterDocument: CampaignExportDocument;
    sectionDocuments: CampaignExportSection[];
    selectedSectionDocument: CampaignExportSection | null;
    generatedSections: CampaignExportSection[];
    missingSections: CampaignExportSection[];
    zipManifest: CampaignZipManifestItem[];
}

export interface BuildCampaignExportPlanInput {
    address: string;
    versionNumber: number;
    sections: Partial<Record<PreviewTab, string>>;
    orderedTabs: PreviewTab[];
    selectedTab: PreviewTab;
    includeContactDetails?: boolean;
    contactCard?: string;
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

export const buildCampaignExportPlan = ({
    address,
    versionNumber,
    sections,
    orderedTabs,
    selectedTab,
    includeContactDetails = false,
    contactCard,
}: BuildCampaignExportPlanInput): CampaignExportPlan => {
    const propertyName = address.trim() || 'Untitled Property';
    const propertySlug = sanitizeFileNamePart(address || 'property');
    const sectionDocuments = orderedTabs.map((tab): CampaignExportSection => {
        const rawContent = sections[tab] || '';
        const content = includeContactDetails && rawContent
            ? appendContactCard(rawContent, contactCard)
            : rawContent;
        const slug = sanitizeFileNamePart(tab);

        return {
            tab,
            title: tab,
            slug,
            fileBaseName: `${propertySlug}-v${versionNumber}-${slug}`,
            content,
            generated: Boolean(rawContent.trim()),
        };
    });

    const generatedSections = sectionDocuments.filter(section => section.generated);
    const missingSections = sectionDocuments.filter(section => !section.generated);
    const selectedSectionDocument = sectionDocuments.find(section => section.tab === selectedTab) || null;

    let masterContent = `Real Estate Copy for: ${propertyName}\nVersion: ${versionNumber}\n\n`;
    masterContent += '====================================\n\n';
    generatedSections.forEach(section => {
        masterContent += `--- ${section.title} ---\n\n`;
        masterContent += `${section.content}\n\n`;
        masterContent += '====================================\n\n';
    });

    const masterDocument = {
        title: `${propertyName} full campaign`,
        fileBaseName: `${propertySlug}-full-campaign-v${versionNumber}`,
        content: masterContent,
    };

    return {
        masterDocument,
        sectionDocuments,
        selectedSectionDocument,
        generatedSections,
        missingSections,
        zipManifest: [
            {
                role: 'master',
                title: masterDocument.title,
                fileBaseName: masterDocument.fileBaseName,
            },
            ...sectionDocuments.map(section => ({
                role: 'section' as const,
                title: section.title,
                fileBaseName: section.fileBaseName,
                generated: section.generated,
            })),
        ],
    };
};
