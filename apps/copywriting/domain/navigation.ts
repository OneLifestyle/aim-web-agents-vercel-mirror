import type { CampaignStageId } from '../types';

const PREVIOUS_STAGE: Readonly<Partial<Record<CampaignStageId, CampaignStageId>>> = {
  campaign: 'property',
  photos: 'campaign',
  brief: 'photos',
  outputs: 'brief',
};

/** Returns the explicit in-app previous step without changing non-linear navigation. */
export const getPreviousCampaignStage = (stage: CampaignStageId): CampaignStageId | null => (
  PREVIOUS_STAGE[stage] ?? null
);
