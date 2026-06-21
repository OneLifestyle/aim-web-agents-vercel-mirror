# Source App Inventory

Status: planning inventory only.

| App | Current Position | Intended Web Agents Position | Sequence |
| --- | --- | --- | --- |
| Copywriting Web | Frozen standalone private-beta baseline; not yet imported. | First import candidate into `apps/copywriting`. | 1 |
| Appraisal Web | Next likely new source-lift candidate; not ready for first import. | Later import after standalone audit, hardening, guardrails, and frozen baseline. | 2 |
| Photo Web | Later source-lift or upgrade candidate. | AI upgrade and batch-production workstation. | 3 |
| Website Agent Web | Web-first candidate, likely from Vercel or v0 source. | Web-first website production agent. | 4 |
| Video Web | Later candidate using existing web source and old Vision Ken Burns logic as source mines. | Video production workstation. | 5 |
| Measure Web | Last candidate after mobile capture is established. | Editing, export, and report layer after mobile capture. | 6 |

## Inventory Notes

Copywriting Web should be imported first because it is already a complete, frozen, private-beta web app and is lower risk than Appraisal.

Appraisal Web should be source-mined and hardened next, but should not be the first monorepo proof because evidence, attribution, and valuation-adjacent framing require stronger guardrails.

No inventory item should be bulk-imported into `aim-web-agents` without its own source-lift record and explicit import task.
