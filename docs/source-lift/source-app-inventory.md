# Source App Inventory

Status: historical inventory retained for compatibility.

For the current detailed inventory, see `docs/source-lift/app-source-inventory.md`.

## Current Orchestration Recommendation

| App | Current Position | Intended Web Agents Position | Sequence |
| --- | --- | --- | --- |
| Copywriting Web | Operational standalone private-beta baseline; frozen until separately approved. | Future import target likely `apps/copywriting`; copy asset and citation preparation workstation. | 1 |
| Photo Web | Likely next source-lift candidate. | AI upgrade and batch-production workstation. | 2 |
| Appraisal Web | Strong source-lift candidate, but private/internal first due evidence and appraisal risk. | Evidence review and report preparation workstation with strict guardrails. | 3 |
| Website Web | Web-first candidate, likely from Vercel or v0 source. | Web-first property site builder. | 4 |
| Video Web | Later candidate using existing web source and old Vision Ken Burns logic as source mines. | Video production workstation. | 5 |
| Measure Web | Likely last candidate after mobile capture is established. | Editing, cleanup, export, report, and Hub packaging after mobile capture. | 6 |

## Inventory Notes

Copywriting Web should remain standalone and frozen until a separate task approves import or maintenance. The likely future import target remains `apps/copywriting`.

Photo Web is now the likely next production-workstation candidate because mobile Photo Agent should focus first on capture/import/adjust/export, while AI upgrades and batch production are more natural on web.

Appraisal Web should be source-mined and hardened after or alongside Photo Web, but should remain private/internal first because evidence, attribution, human review, and valuation-adjacent framing require stronger guardrails.

No inventory item should be bulk-imported into `aim-web-agents` without its own source-lift record and explicit import task.
