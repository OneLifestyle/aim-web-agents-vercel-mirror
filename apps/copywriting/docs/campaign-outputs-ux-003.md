# Campaign Outputs UX 003

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-003`

Date: 2026-06-23

Scope: focused product UX cleanup for the Copywriting Web Agent Campaign Outputs workspace. This goal changed only `apps/copywriting` product UI and documentation. It did not add provider integrations, dependencies, auth, Hub, billing, storage, database schema, environment files, secrets, Google Places, ZIP packaging, or new AI routes.

## Why Export-Pack Was Deferred

Export-pack work was deferred because the beta workspace still had unclear action placement. Current-output, category, and full-campaign actions were mixed in one lower grey panel, which made export packaging feel premature. This pass clarifies the review and download workflow before any ZIP or export bundle work.

## Action Placement

- Current output actions now sit in the selected output card header: `Copy current output`, `Download current output`, and `Contact Card`.
- Category action now sits beside the selected category summary: `Download current category`. It is hidden while `All` is selected and disabled when the selected category has no generated outputs.
- Full campaign actions now sit in the Campaign Outputs summary: `Generate missing outputs` and `Download full campaign document`.
- The old lower mixed action panel was removed. The lower area now contains only demoted local editing and beta refine controls.

## On-Demand Missing Output Generation

Selecting a missing output still selects it, and the empty output card now presents `Generate this output` close to the selected output. Missing-tile selection also routes through the same scoped generation path.

Per-output generation is queued, not parallel. If another output-mutating operation is already running, a clicked missing output is added to a local queue, shown as `Queued`, and generated after the active operation finishes. The same output is not queued twice, and generation still snapshots inputs at start through the existing `generateCopyForTab` path.

`Generate missing outputs` is preserved for batch completion.

## AI Analysis Loading Fix

Copy Context and Property Features cards keep the affected-card active border/ring while their buttons transform to the single visible `Analyzing...` state. The duplicate card chip plus button label pattern was removed for these two analysis actions.

## Edit And Refine Placement

Generated output remains read-only by default. `Edit local copy` remains explicit and demoted below the current output. `Advanced refine (beta)` remains secondary and collapsed until opened. The local timeline action is labelled `Save local timeline` to avoid implying Hub persistence.

## Desktop Width And Layout

The app shell now uses a wider `max-w-[1800px]` workspace instead of the narrower default container. The three-column desktop grid starts at `xl` and uses wider right-side output space at large widths, while mid-width screens avoid desktop scroll trapping. The Campaign Build Log remains in the left column and is not expanded into the primary output area.

## Status Chip Anchors

Campaign Status chips now provide simple scroll-to-section behaviour for Address, Research, Strategy, Features, Images, Outputs, and Review. This is intentionally lightweight and does not implement the future single-column anchored review flow.

## Preserved Behaviour

- Address lookup remains Gemini-backed through the existing server endpoint.
- Fetch Details remains on the existing property research path.
- Copy Context AI Analysis remains working.
- Property Features AI Analysis remains working.
- AI Strategy Analysis remains routed to Pro.
- Image Analysis remains routed to Flash.
- Generate Listing Copy remains working.
- Generate missing outputs remains working.
- Campaign Build Log remains visible.
- Copy current output remains working.
- Download current output remains working.
- Download current category remains working.
- Download full campaign document remains working.

## Deferred

- Full Canvas-style focus mode.
- Full single-column anchored review flow.
- True rich editor.
- Primary free-form refinement/chat workflow.
- ZIP export.
- Hub asset persistence.
- Auth, billing, provider-router, and platform integration work.

## Internal Audit

Scope Auditor: no platform integration, Hub/auth/billing/provider work, full app rewrite, database schema, environment file, dependency, or ZIP export was added.

Action Placement Auditor: current-output, category, and full-campaign actions are separated and placed near the things they affect.

Choice Load Auditor: the lower mixed action panel was removed, and actions now appear at the relevant level.

On-Demand Generation Auditor: missing output generation is scoped to one output, visible in the selected output card, queue-safe, and duplicate queue entries are blocked.

Edit/Refine Safety Auditor: output remains read-only by default, with local editing and advanced refine demoted and beta-labelled.

Activity State Auditor: duplicate AI analysis activity labels are removed while affected-card styling remains.

Layout Auditor: desktop width usage is improved without an app-wide redesign.

Export Auditor: current output, current category, and full campaign document downloads remain on existing handlers.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: address lookup, Fetch Details, AI analysis buttons, Generate Listing Copy, Generate missing outputs, Campaign Build Log, and downloads are preserved.

Git Hygiene Auditor: no secrets, environment files, dependency folders, build output, screenshots, or Vercel config should be staged.
