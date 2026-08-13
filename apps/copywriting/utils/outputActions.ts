import type { CampaignOutputDocument } from '../types';
import { OUTPUT_PRESENTATION_BY_ID } from '../domain/outputInventory';

export interface OutputRegenerationActionPresentation {
  visible: boolean;
  accessibleName: string;
}

/**
 * One presentation contract for desktop and mobile regeneration controls.
 * The action always describes replacement because the current session does
 * not retain prior drafts as versions.
 */
export const deriveOutputRegenerationAction = (
  document: Pick<CampaignOutputDocument, 'id' | 'content' | 'state'>,
): OutputRegenerationActionPresentation => ({
  visible: Boolean(document.content.trim())
    || document.state === 'needs-regeneration'
    || document.state === 'failed'
    || document.state === 'needs-review',
  accessibleName: `Regenerate ${OUTPUT_PRESENTATION_BY_ID[document.id].label} and replace the current draft`,
});
