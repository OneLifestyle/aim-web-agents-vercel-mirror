# Copywriting Offer UI 001

Goal ID: `WEBAGENTS-COPYWRITING-OFFER-UI-001`

Date: 2026-06-27

Scope: implement the first user-facing offer UI pass for Copywriting Web. This is a product UI change only. It does not add billing, Hub integration, storage, auth, provider routing, pricing, telemetry, or Campaign Blueprint generation.

## What Changed

- Campaign Outputs now leads with three outcome offers: `Listing Copy`, `Campaign Pack`, and `Campaign Blueprint`.
- `Listing Copy` is presented as step one: create the core property story from the approved property brief.
- `Campaign Pack` is presented as the recommended step two: generate the downstream campaign outputs from Listing Copy and the approved property context.
- `Campaign Blueprint` is visible as planned beta only and has no active generation path.
- The former pre-generation output tile grid is reframed as `Campaign Library`, a review navigator for generated or partially generated outputs.
- The visible `Full Copy` label is reduced in the app and export headers where safe, while the internal `PreviewTab` ID remains unchanged.

## Listing Copy Mapping

The existing internal master output remains `Full Copy`.

User-facing UI now prefers `Listing Copy` for that master output because it is the core listing narrative and source for campaign variations. The service contract, `PreviewTab` union, export input IDs, and generation dependency checks still use the existing internal ID to avoid breaking current behavior.

Listing Copy generation continues to call the existing `generateCopy` operation with `contentType: Listing Copy`.

## Campaign Pack Mapping

Campaign Pack wraps the existing downstream output generation flow.

The Campaign Pack action:

- requires Listing Copy to exist first;
- generates only missing downstream campaign outputs;
- skips already-generated downstream outputs;
- does not regenerate Listing Copy;
- uses the existing `generateCopyVariant` path for downstream outputs;
- preserves queued generation state, status chips, category filters, output selection, current output download, category download, and campaign download.

The 16 downstream campaign outputs remain reviewable through Campaign Library after the user opens the library or starts Campaign Pack.

## Campaign Blueprint

Campaign Blueprint is visible as planned beta only.

It does not call providers, does not create planning content, does not create a paid feature, and does not imply current purchase availability. Its purpose is documented as a future rollout, search/discovery, content-calendar, editorial-angle, and marketing-coordinator handoff layer.

## Campaign Library

The tile grid was not deleted.

It is now labelled as Campaign Library and is treated as a review/navigation surface rather than the primary pre-generation chooser. The library summary shows Listing Copy readiness and downstream Campaign Pack output progress, such as `0/16 campaign outputs ready`.

The library can still show category filters, output tiles, ready/missing/generating states, on-demand missing-output generation, current output download, current category download, and campaign download.

Follow-up note: `WEBAGENTS-COPYWRITING-BRIEF-OUTPUT-WORKSPACE-001` moved this offer model into a clearer `Brief Builder` and `Output Workspace` structure. Listing Copy generation is now gated by property brief readiness, the legacy sticky Generate Listing Copy bar was removed, and the Campaign Library is kept as review navigation after the output workflow starts.

Follow-up note: `WEBAGENTS-COPYWRITING-WORKSPACE-DENSITY-VISUALS-001` compacted the offer cards and Campaign Library while preserving Listing Copy, Campaign Pack, planned-only Campaign Blueprint, generated-only exports, and the existing generation paths.

Follow-up note: `WEBAGENTS-COPYWRITING-PRE-KEVIN-UX-FIXES-001` made the Listing Copy offer card the only primary pre-generation Listing Copy action, changed that action to the AIM red primary style, removed the redundant Review Listing Copy button, added a same-input regenerate guard, and warns before regeneration clears existing Campaign Pack outputs.

Follow-up note: `WEBAGENTS-COPYWRITING-LAPTOP-FIRST-FLOW-001` keeps Listing Copy and Campaign Pack as the output actions but connects them more directly to the generated output area through scroll/focus behavior and in-workspace Campaign Pack progress.

## Preserved Behavior

- Beta access gate remains on the existing path.
- Floating AI Assistant remains disabled from the primary UI.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Generate Listing Copy remains on the existing master generation path.
- Campaign Pack generation uses existing downstream output generation.
- On-demand individual missing output generation remains available inside the review library.
- Category filters remain working inside the review library.
- Download current output, current category, and campaign remain generated-only export actions.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available after expanding Beta diagnostics.

## Deferred

- Campaign Blueprint generation.
- Credit charging.
- Connected beta entitlement.
- `inputFingerprint` stale dependency engine.
- Hub save or sync.
- Offer UI telemetry.
- Public pricing.
- SEO tooling.
- AI discovery tooling.
- ZIP export.
- PDF/DOCX generation.
- Provider-router changes.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, pricing, telemetry, environment, dependency, or database work was added.

Offer UI Auditor: the UI now presents Listing Copy, Campaign Pack, and future Campaign Blueprint as outcome-led offers.

Choice Load Auditor: the user is guided through Listing Copy and Campaign Pack before using the 17-output library as a review navigator.

Campaign Pack Auditor: Campaign Pack generation uses the existing downstream `generateCopyVariant` path, skips generated downstream outputs, and does not regenerate Listing Copy.

Blueprint Auditor: Campaign Blueprint is planned-only and cannot trigger provider calls.

Export Auditor: current output, category, and campaign downloads remain generated-only and do not generate missing outputs.

Model Routing Auditor: AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Campaign Build Log, technical details, category filters, output selection, and downloads remain on existing paths.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
