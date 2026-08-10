import type { PreviewTab } from '../types';

export type OutputGroupId =
  | 'foundation'
  | 'listing-adaptations'
  | 'coming-soon'
  | 'social-media'
  | 'events'
  | 'editorial'
  | 'video';

export interface OutputPresentation {
  id: PreviewTab;
  label: string;
  shortLabel: string;
  groupId: OutputGroupId;
  isFoundation: boolean;
}

export interface OutputGroupDefinition {
  id: OutputGroupId;
  label: string;
  countLabel: string;
  outputIds: readonly PreviewTab[];
}

/**
 * Canonical engine order. These identifiers are persistence/provider/export
 * contracts and must not be changed to match presentation copy.
 */
export const CANONICAL_OUTPUT_GROUPS: readonly OutputGroupDefinition[] = [
  {
    id: 'foundation',
    label: 'Foundation',
    countLabel: '1',
    outputIds: ['Full Copy'],
  },
  {
    id: 'listing-adaptations',
    label: 'Listing adaptations',
    countLabel: '4',
    outputIds: ['Just Listed', 'Brochure Copy', 'Email', 'Flyer'],
  },
  {
    id: 'coming-soon',
    label: 'Coming Soon',
    countLabel: '3',
    outputIds: ['Coming Soon Teaser', 'Coming Soon Email', 'Coming Soon SMS'],
  },
  {
    id: 'social-media',
    label: 'Social Media',
    countLabel: '6',
    outputIds: [
      'Facebook',
      'Facebook Marketplace',
      'Instagram',
      'X (Twitter)',
      'Google Business',
      'TikTok',
    ],
  },
  {
    id: 'events',
    label: 'Events',
    countLabel: '1',
    outputIds: ['Open House'],
  },
  {
    id: 'editorial',
    label: 'Editorial',
    countLabel: '1',
    outputIds: ['Long-form / Blog'],
  },
  {
    id: 'video',
    label: 'Video',
    countLabel: '1',
    outputIds: ['Video Script'],
  },
] as const;

export const CANONICAL_OUTPUT_ORDER: readonly PreviewTab[] = CANONICAL_OUTPUT_GROUPS
  .flatMap(group => group.outputIds);

export const CAMPAIGN_PACK_OUTPUT_ORDER: readonly PreviewTab[] = CANONICAL_OUTPUT_ORDER
  .filter(outputId => outputId !== 'Full Copy');

export const OUTPUT_PRESENTATION_BY_ID: Readonly<Record<PreviewTab, OutputPresentation>> = {
  'Full Copy': {
    id: 'Full Copy',
    label: 'Listing Copy',
    shortLabel: 'Listing Copy',
    groupId: 'foundation',
    isFoundation: true,
  },
  'Just Listed': {
    id: 'Just Listed',
    label: 'Just Listed',
    shortLabel: 'Just Listed',
    groupId: 'listing-adaptations',
    isFoundation: false,
  },
  'Brochure Copy': {
    id: 'Brochure Copy',
    label: 'Brochure',
    shortLabel: 'Brochure',
    groupId: 'listing-adaptations',
    isFoundation: false,
  },
  Email: {
    id: 'Email',
    label: 'Email',
    shortLabel: 'Email',
    groupId: 'listing-adaptations',
    isFoundation: false,
  },
  Flyer: {
    id: 'Flyer',
    label: 'Flyer',
    shortLabel: 'Flyer',
    groupId: 'listing-adaptations',
    isFoundation: false,
  },
  'Coming Soon Teaser': {
    id: 'Coming Soon Teaser',
    label: 'Teaser',
    shortLabel: 'Teaser',
    groupId: 'coming-soon',
    isFoundation: false,
  },
  'Coming Soon Email': {
    id: 'Coming Soon Email',
    label: 'Coming Soon Email',
    shortLabel: 'Coming Soon Email',
    groupId: 'coming-soon',
    isFoundation: false,
  },
  'Coming Soon SMS': {
    id: 'Coming Soon SMS',
    label: 'SMS',
    shortLabel: 'SMS',
    groupId: 'coming-soon',
    isFoundation: false,
  },
  Facebook: {
    id: 'Facebook',
    label: 'Facebook',
    shortLabel: 'Facebook',
    groupId: 'social-media',
    isFoundation: false,
  },
  'Facebook Marketplace': {
    id: 'Facebook Marketplace',
    label: 'Facebook Marketplace',
    shortLabel: 'Marketplace',
    groupId: 'social-media',
    isFoundation: false,
  },
  Instagram: {
    id: 'Instagram',
    label: 'Instagram',
    shortLabel: 'Instagram',
    groupId: 'social-media',
    isFoundation: false,
  },
  'X (Twitter)': {
    id: 'X (Twitter)',
    label: 'X',
    shortLabel: 'X',
    groupId: 'social-media',
    isFoundation: false,
  },
  'Google Business': {
    id: 'Google Business',
    label: 'Google Business Profile',
    shortLabel: 'Google Business',
    groupId: 'social-media',
    isFoundation: false,
  },
  TikTok: {
    id: 'TikTok',
    label: 'TikTok',
    shortLabel: 'TikTok',
    groupId: 'social-media',
    isFoundation: false,
  },
  'Open House': {
    id: 'Open House',
    label: 'Open House',
    shortLabel: 'Open House',
    groupId: 'events',
    isFoundation: false,
  },
  'Long-form / Blog': {
    id: 'Long-form / Blog',
    label: 'Blog',
    shortLabel: 'Blog',
    groupId: 'editorial',
    isFoundation: false,
  },
  'Video Script': {
    id: 'Video Script',
    label: 'Video Script',
    shortLabel: 'Video Script',
    groupId: 'video',
    isFoundation: false,
  },
};

export const getOutputGroup = (outputId: PreviewTab): OutputGroupDefinition => {
  const group = CANONICAL_OUTPUT_GROUPS.find(candidate => candidate.outputIds.includes(outputId));
  if (!group) {
    throw new Error(`Canonical output group is missing for ${outputId}.`);
  }
  return group;
};

export const assertCanonicalOutputInventory = (): void => {
  const uniqueIds = new Set(CANONICAL_OUTPUT_ORDER);
  if (CANONICAL_OUTPUT_ORDER.length !== 17 || uniqueIds.size !== 17) {
    throw new Error('Canonical output inventory must contain exactly 17 unique engine identifiers.');
  }
  if (CAMPAIGN_PACK_OUTPUT_ORDER.length !== 16 || CAMPAIGN_PACK_OUTPUT_ORDER.includes('Full Copy')) {
    throw new Error('Campaign Pack inventory must contain exactly 16 downstream identifiers.');
  }
  for (const outputId of CANONICAL_OUTPUT_ORDER) {
    const presentation = OUTPUT_PRESENTATION_BY_ID[outputId];
    if (!presentation || presentation.id !== outputId) {
      throw new Error(`Missing stable presentation mapping for ${outputId}.`);
    }
    if (presentation.groupId !== getOutputGroup(outputId).id) {
      throw new Error(`Presentation group does not match canonical group for ${outputId}.`);
    }
  }
};
