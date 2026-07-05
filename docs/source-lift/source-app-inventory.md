# Source App Inventory

Status: root-level app inventory retained for compatibility.

For the current detailed inventory, see `docs/source-lift/app-source-inventory.md` and `docs/workflow/app-worktree-registry.md`.

## Current Orchestration Recommendation

| App | Current Position | Intended Web Agents Position | Sequence |
| --- | --- | --- | --- |
| Copywriting Web | Active app-scoped product lane in `apps/copywriting` through `aim-web-agents-copywriting`; operational and Vercel-hosted. | Copy asset and citation preparation workstation; root owns boundary and integration planning only. | 1 |
| Photo AI Web | Active app-scoped product lane in `apps/photo-ai` through `aim-web-agents-photo-ai`. | AI upgrade and batch-production workstation; root owns boundary and integration planning only. | 2 |
| Appraisal Web | Planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence. | Private/internal evidence review and report preparation workstation with strict guardrails. | 3 |
| Website Web | Web-first candidate, likely from Vercel or v0 source. | Web-first property site builder. | 4 |
| Video Web | Later candidate using existing web source and old Vision Ken Burns logic as source mines. | Video production workstation. | 5 |
| Measure Web | Likely last candidate after mobile capture is established. | Editing, cleanup, export, report, and Hub packaging after mobile capture. | 6 |

## Inventory Notes

Copywriting Web already exists in `apps/copywriting` and is handled through the `aim-web-agents-copywriting` app-scoped lane. Root `aim-web-agents` should not run Copywriting import/readiness work unless explicitly requested.

Photo AI Web already exists in `apps/photo-ai` and is handled through the `aim-web-agents-photo-ai` app-scoped lane. Root `aim-web-agents` should not run Photo AI implementation work unless explicitly requested.

Appraisal Web remains the next planned web-app lane after Copywriting and Photo AI unless orchestration changes the sequence. It should remain private/internal first because evidence, attribution, human review, and valuation-adjacent framing require stronger guardrails.

No inventory item should be bulk-imported into `aim-web-agents` without its own source-lift record and explicit import task.
