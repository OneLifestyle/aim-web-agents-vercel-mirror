# Copywriting Interaction Regression 001

Goal ID: `WEBAGENTS-COPYWRITING-INTERACTION-REGRESSION-001`

Date: 2026-06-23

Scope: targeted regression fix for `apps/copywriting` after the reliability and export UX sprint. This goal preserved Campaign Build Log, model routing, strategy JSON validation and repair, export labels, and export assembly helpers. It did not add dependencies, provider integrations, platform services, environment files, secrets, Hub/auth/billing work, broad redesign, ZIP export, or single-column Campaign Outputs.

## Regression Found

- The prior campaign operation guard used one global client lock for every protected campaign action.
- Copy Context AI Analysis and Property Features AI Analysis shared that lock, so starting one made the other unavailable until completion.
- Generate Missing Tabs and other output actions also made analysis buttons unavailable because button disabled state used the same global busy flag.
- The buttons were still rendered in code, but the broad disabled state made them feel unavailable and inconsistent.
- The Copy Context redo label depended on the current target market value, so a successful analysis returning the default market could still appear as first-run `AI Analysis`.

## Operation Guard Rules After Fix

The client now tracks scoped active operations:

- `propertyResearch`
- `copyContextAnalysis`
- `propertyFeaturesAnalysis`
- `imageAnalysis`
- `generateFullCopy`
- `generateAllVariations`
- `refineCopy`
- `exportFullCampaign`

Guard rules:

- Duplicate clicks of the same operation are blocked.
- Property research blocks other guarded campaign actions because it resets source property context.
- Output-mutating actions block each other: full copy generation, all-variation generation, refinement, and full-campaign export.
- Copy Context AI Analysis and Property Features AI Analysis may run independently and near-simultaneously.
- Analysis and image actions remain visible while unrelated output actions run.
- Generate Missing Tabs snapshots its generation inputs at start, so a concurrent analysis completion cannot partially change inputs mid-batch.
- Address lookup is not part of the campaign operation guard.

## Analysis Button State Rules

- Before first run, analysis buttons show `AI Analysis`.
- During that specific operation, the button stays visible and shows `Analyzing...`.
- After success, the button stays visible and shows `Redo AI Analysis`.
- After failure, the button stays visible and shows `Retry AI Analysis`, with an inline failure message where applicable.
- Photo analysis follows the same visible-state pattern with `Analyze Photos`, `Analyzing...`, `Redo Photo Analysis`, and `Retry Photo Analysis`.

## Address Lookup Finding

Address suggestions were not blocked by the campaign operation guard. The observed delay is consistent with the model-backed server lookup, debounce, and possible first-request cold start rather than a direct guard regression.

Safe responsiveness changes:

- Reduced the debounce from 500ms to 350ms.
- Added immediate queued lookup feedback once the input is eligible.
- Added request sequencing so stale responses cannot overwrite newer address suggestions.
- Kept the existing server-side provider path and did not call live provider APIs in automated checks.

## TypeScript Cleanup

The Vercel `TS2345` issue was reproducible with `npx tsc --noEmit`:

- `api/copywriting.ts` passed `unknown` parsed JSON fields into a formatter typed for `string | string[]`.

Fix:

- `formatAIResponseList` now accepts `unknown` and narrows arrays, strings, nullish values, and fallback scalars safely.
- `parseRobustJSON` returns `unknown`.
- The research JSON response is narrowed with the existing object validator before fields are read.
- The scoped operation Map copy is explicitly typed on the client.

## Preserved From Prior Sprint

- Campaign Build Log remains in place.
- Technical beta details remain visible.
- AI Strategy Analysis remains routed to Pro.
- Image Analysis remains routed to Flash.
- Token-only cost caveat remains visible.
- Grounding/tool charges caveat remains visible.
- `Download current section` remains clear.
- `Download full campaign document` remains clear.
- Export assembly helper remains in place.

## Deferred Work

- Future single-column Campaign Outputs redesign remains deferred.
- Future ZIP export remains deferred.
- Live provider quality testing remains deferred.
- Durable Hub-owned jobs, state, assets, usage ledger, auth, billing, and workspace workflows remain deferred.

## Internal Audit

Scope Auditor: no platform integration, broad redesign, provider abstraction, Hub/auth/billing work, database schema, environment file, or dependency was added.

Interaction Auditor: analysis buttons remain visible across idle, loading, success/redo, and failure/retry states.

Operation Guard Auditor: operation locks prevent duplicate and shared-output overlaps without blocking independent analysis actions.

Address Lookup Auditor: address lookup is independent of campaign generation state and now has clearer feedback plus stale-response protection.

Model Routing Auditor: AI Strategy Analysis remains on Pro. Image Analysis remains on Flash.

TypeScript Auditor: the local `unknown` issue is fixed under `npx tsc --noEmit`.

Git Hygiene Auditor: no secrets, env files, dependency changes, build output, screenshots, Vercel config, or generated dependency folders should be staged.
