# Copywriting Pre-Kevin UX Fixes 001

Goal ID: `WEBAGENTS-COPYWRITING-PRE-KEVIN-UX-FIXES-001`

Date: 2026-06-27

Scope: focused pre-Kevin polish for the Copywriting workspace after Hub-style visual polish. This goal fixes duplicate Listing Copy actions, Additional Property Features bullet rendering, and same-input Listing Copy regeneration risk. It does not add Hub integration, auth, billing, storage, provider integrations, provider routing changes, dependencies, Tailwind/shadcn migration, Campaign Blueprint generation, SEO tooling, AI search tooling, or connected beta logging.

## What Changed

- Additional Property Features now strip leading list markers before rendering in the existing bullet/list UI, preventing double bullets such as `• • Tuscan-inspired`.
- The Listing Copy offer card remains the single primary visible place to generate Listing Copy before it exists.
- The primary Generate Listing Copy action now uses the same AIM red primary generation style as the Campaign Pack action.
- The Campaign Library empty state no longer repeats a Generate Listing Copy button. Before Listing Copy exists, it directs the user to generate Listing Copy above.
- The selected Listing Copy empty state no longer repeats a Generate this output button. It shows informational copy pointing to the offer card.
- Downstream on-demand generation remains available for non-Listing Copy campaign outputs where Listing Copy exists.
- The Listing Copy offer card no longer shows a redundant Review Listing Copy button after generation. It shows a Ready state and a quiet ready message instead.

## Regenerate Guard

Regenerate Listing Copy now uses a small per-version snapshot of the brief inputs used when Listing Copy was generated. The snapshot includes the approved address state, property details, Campaign Direction, property features, word count, research/profile/photo analysis inputs, agent profile, and open-house fields.

Regenerate Listing Copy is disabled unless the current snapshot differs from the stored Listing Copy snapshot. The disabled title tells users to make a change to the property brief, Campaign Direction, features or photos before regenerating.

This is intentionally a first-pass guard. It is not a full reusable `inputFingerprint` engine and does not introduce hashing or dependencies.

## Campaign Pack Warning

When downstream Campaign Pack outputs exist, clicking Regenerate Listing Copy shows a browser confirmation warning that regenerating Listing Copy will clear Campaign Pack outputs because they are based on the current listing. The warning suggests downloading the campaign first if the user wants to keep it.

The existing stale-output behavior is preserved: successful Listing Copy regeneration replaces the active version with the new Listing Copy and clears downstream campaign outputs for that version.

## Land Size

Land Size remains visible in the editable property details area as `Land Size (m²)`.

The existing parsing path converts detected hectare values to square metres before storing them in `propertyDetails.landSize`, so the current `m²` label remains safe for the stored editable value. A full land-size unit review remains deferred.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Floating AI Assistant remains disabled from the primary UI.
- Floating Generate Listing Copy button remains removed.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Property Brief readiness remains on the existing confirmed/manual logic.
- Listing Copy generation remains gated by property brief readiness.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Campaign Pack generation remains on the existing downstream variant path.
- Category filters and output selection remain in Campaign Library.
- Current output, current category and campaign downloads remain generated-only.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available when expanded.
- Visual Highlights remain summary-first and collapsible.

## Deferred

- Better true progress animation for generating pills.
- Agent Profile save/edit state.
- Stronger image-analysis activity treatment.
- Full reusable `inputFingerprint` stale dependency engine.
- Separate Create Another Version action for same-input alternatives.
- Full land-size unit review if a value/unit mismatch is found.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, provider integration, environment file, dependency, database, pricing, SEO, AI search, or Campaign Blueprint implementation was added.

Bullet Rendering Auditor: Additional Property Features strip leading bullet/list markers before rendering the UI bullet.

Generation Action Auditor: Listing Copy has one primary obvious pre-generation entry point in the Listing Copy offer card. Campaign Library and selected-output duplicate Listing Copy generation buttons were removed.

Regenerate Guard Auditor: Regenerate Listing Copy is disabled unless the current brief snapshot differs from the stored snapshot for the generated Listing Copy version.

Warning Auditor: regenerating Listing Copy warns when downstream Campaign Pack outputs already exist.

Land Size Auditor: editable Land Size remains present and labelled `m²`; existing hectare-to-square-metre parsing remains unchanged.

Export Auditor: current output, current category and campaign downloads remain generated-only and do not generate missing outputs.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Visual Highlights, Campaign Build Log, technical details and downloads remain on existing handlers.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots or Vercel config should be staged.
