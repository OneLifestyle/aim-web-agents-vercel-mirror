# Copywriting Brief Output Workspace 001

Goal ID: `WEBAGENTS-COPYWRITING-BRIEF-OUTPUT-WORKSPACE-001`

Date: 2026-06-27

Scope: restructure the Copywriting private-beta workspace around two user jobs: build the property brief, then generate and review outputs. This goal does not add Hub integration, auth, billing, storage, provider routing changes, provider integrations, dependencies, public pricing, Campaign Blueprint generation, SEO tooling, AI search tooling, or connected beta logging.

## Layout Decision

Chosen direction: hybrid of Option A and Option B.

- Kept one workspace instead of a multi-step wizard.
- Kept the desktop-oriented workspace, but made the centre column the `Brief Builder` and the right column the `Output Workspace`.
- Kept the top status chips and anchors so the flow can still behave like a single scrollable page on narrower screens.
- Did not implement a hard multi-page wizard because the current app already has working generation, review, filtering and export state in one component. A wizard would add more state risk before Kevin testing.
- Did not do a final single-column redesign or Hub-style polish because this goal is a structural cleanup, not a design-system migration.

## What Changed

- Added a visible `Brief Builder` header around address, agent, open-house, property facts, research review, local profile, campaign direction, property features, photos and visual highlights.
- Added a visible `Output Workspace` header around Listing Copy, Campaign Pack, planned Campaign Blueprint, Campaign Library, output review and downloads.
- Moved Property Overview, Suburb & Area Profile, and Visual Highlights into Brief Builder so the right column is no longer a mixed research/output surface.
- Removed the sticky/floating `Generate Listing Copy` bar from the Brief Builder column.
- Moved the listing word-count control into Output Workspace beside the offer cards.
- Kept generation actions inside Output Workspace.

## Floating Generate Button

The legacy sticky generate control sat at the bottom of the input column and competed with the offer-led Output Workspace. It was removed so the primary generation actions are:

- `Generate Listing Copy`;
- `Generate Campaign Pack`.

Both now live in Output Workspace.

## Property Brief Readiness

Listing Copy generation is gated by property brief readiness.

Ready states:

- `Property brief ready`: fetched details exist and the user confirmed the brief.
- `Manual brief`: the user has entered an address, at least one manual property fact, and manual feature/context detail.

Not-ready states:

- `Property brief missing`;
- `Fetch details to start`;
- `Review property brief`.

The manual brief path is deliberately simple. It avoids blocking future manual workflows, while the UI still states that AI research and suburb analysis depend on Fetch Details.

## Property Brief Review

After Fetch Details succeeds, the app marks the fetched facts as a brief candidate and shows:

- `Review property brief`;
- helper text: `Review and adjust the property facts before generating copy.`;
- `Confirm brief`;
- `Correct details`;
- `Refetch`;
- a lightweight wrong-property note that tells the user to refetch before confirming.

No wrong-property recovery flow, correction prompt, provider-call change, or model prompt change was added.

## Output Workspace Structure

Output Workspace now follows the product model:

1. Listing Copy: the master narrative from the approved property brief.
2. Campaign Pack: channel-specific adaptations from Listing Copy and the approved brief.
3. Campaign Blueprint: planned beta only.

Campaign Blueprint remains visible as planned/future only with no live generation button.

## Campaign Library

The 17-output tile grid was not deleted.

Before Campaign Pack is ready, the app shows a compact `Campaign Pack includes` summary with categories:

- Listing;
- Coming Soon;
- Social Media;
- Events;
- Blog;
- Video.

The detailed tiles remain secondary and expandable as `Campaign Library`. After Campaign Pack is generated or partly generated, Campaign Library remains the review navigator with category filters, ready/missing/generating states, current selection, current-output downloads, category downloads, campaign download, and secondary on-demand missing-output generation.

Follow-up note: `WEBAGENTS-COPYWRITING-WORKSPACE-DENSITY-VISUALS-001` tightened spacing, compacted offer cards, made Property Overview and Suburb & Area Profile collapsible, renamed the visible `Copy Context` section to `Campaign Direction`, added visible 20-photo numbering, and changed Visual Highlights to summary-first expandable rows.

Follow-up note: `WEBAGENTS-COPYWRITING-PRE-KEVIN-UX-FIXES-001` removed duplicate pre-generation Listing Copy buttons from Campaign Library and the selected Listing Copy empty state. The Listing Copy offer card remains the single primary pre-generation entry point, while downstream on-demand generation remains available for campaign outputs.

Follow-up note: `WEBAGENTS-COPYWRITING-LAPTOP-FIRST-FLOW-001` preserved the one-page workspace but changed the visible navigation to five product steps, required a selected address suggestion before Fetch Details, stacked the main workflow before diagnostics on laptop, compacted Property Brief context, and scrolls/focuses generated outputs after generation.

## Campaign Pack Behaviour

Campaign Pack continues to wrap the existing downstream generation behavior:

- requires Listing Copy;
- generates missing downstream outputs;
- does not regenerate Listing Copy;
- skips already-generated downstream outputs where the existing logic does;
- preserves queued generation, status chips, category filters, current output selection, category downloads and campaign downloads.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Floating AI Assistant remains disabled from the primary UI.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Listing Copy generation remains on the existing master generation path, now gated by brief readiness.
- Campaign Pack generation remains on the existing downstream variant path.
- Category filters remain in Campaign Library.
- Download current output remains generated-only.
- Download current category remains generated-only.
- Download campaign remains generated-only.
- Downloads do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available after expanding Beta diagnostics.

## Deferred

- Full multi-page wizard.
- Single-column final redesign.
- Full AIM shared design-system or design-token package.
- Tailwind/shadcn migration.
- Connected beta auth/logging.
- `inputFingerprint` stale dependency engine.
- Campaign Blueprint generation.
- Hub save.
- Public pricing.
- Full wrong-property recovery.

## Follow-Up

`WEBAGENTS-COPYWRITING-HUB-STYLE-DESIGN-POLISH-001` preserved this Brief Builder / Output Workspace structure while applying local visual polish to the page shell, cards, buttons, status chips, Campaign Library, Visual Highlights, beta diagnostics and generated-draft warning.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, pricing, telemetry, database, environment, dependency, or provider-integration work was added.

Layout Auditor: the app now has a visible Brief Builder and Output Workspace structure.

Generate Button Auditor: the sticky/floating Generate Listing Copy control was removed from Brief Builder; generation actions live in Output Workspace.

Property Brief Auditor: Listing Copy generation is gated by a confirmed fetched brief or a simple manual brief.

Offer UI Auditor: Listing Copy, Campaign Pack and planned Campaign Blueprint remain visible and clear.

Choice Load Auditor: the user is guided through Listing Copy and Campaign Pack instead of being pushed into choosing from 17 outputs before generation.

Campaign Library Auditor: the tile grid remains as Campaign Library review/navigation and was not deleted.

Export Auditor: current output, category and campaign downloads remain generated-only and do not generate missing outputs.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Campaign Build Log, technical details, category filters, output selection and downloads remain on existing paths.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots or Vercel config should be staged.
