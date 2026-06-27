# Copywriting Hub Style Design Polish 001

Goal ID: `WEBAGENTS-COPYWRITING-HUB-STYLE-DESIGN-POLISH-001`

Date: 2026-06-27

Scope: focused visual polish for the Copywriting workspace so the private-beta app feels closer to the wider Real Estate AIM / AIM Hub product family. This goal did not change workflow structure, provider routing, generation behaviour, exports, auth, billing, storage, Hub integration, dependencies, Tailwind/shadcn usage, or Campaign Blueprint generation.

## Design Intent

- Move the workspace toward a calm, premium, warm-neutral workstation.
- Keep AIM red as a brand and primary-generation accent instead of the dominant surface colour.
- Preserve the existing Brief Builder / Output Workspace split and recent density improvements.
- Make generated outputs feel like work product while keeping diagnostics and warnings available but secondary.

## Local Visual Tokens

`App.tsx` now has a lightweight local `aimUi` class map for repeated visual roles:

- page shell;
- cards and sections;
- form controls;
- primary, secondary, dark and analysis buttons;
- neutral, ready, working and planned chips.

No package, shared design system, dependency, Tailwind migration, shadcn migration, or UI framework was added.

## Visual Changes

- Page shell moved to a warm stone workspace background with white product panels.
- Section cards now share consistent radius, border, shadow and active-ring treatment.
- Form controls use the same border, focus and placeholder styling across address, profile, open-house, property details, campaign direction and feature inputs.
- Top header, status strip and progress rail were softened while keeping private-beta framing visible.
- Beta diagnostics remain collapsed by default and now read as a secondary support panel.

## Button Hierarchy

- Generate actions keep the strongest hierarchy through AIM red where appropriate.
- Secondary review, copy, download, refetch, collapse and library controls use quieter bordered white buttons.
- AI Analysis actions use a lighter red-accent treatment.
- Photo analysis and campaign download use dark neutral buttons.
- Planned/disabled Campaign Blueprint remains visibly unavailable without looking broken.

## Card And Section Polish

- Brief Builder sections now feel like one coherent data-gathering flow.
- Property brief readiness, fetched-address context, additional features, Property Overview and Suburb & Area Profile received calmer borders and copy hierarchy.
- Collapsible Property Overview and Suburb & Area Profile behaviour was preserved.
- Suburb inclusion controls remain visible when the profile text is collapsed.

## Offer UI Polish

- Listing Copy, Campaign Pack and Campaign Blueprint cards share consistent compact card structure.
- Campaign Pack remains the recommended next step, with a red accent and ring rather than heavy red panels.
- Campaign Blueprint is a planned beta card with muted planned styling and no generation path.
- No public pricing or most-popular claim was added.

## Campaign Library Polish

- Campaign Library now reads more like an output review library.
- Category filters use integrated pill styling.
- Current selected output uses a slate surface with a slim red accent instead of a broad red fill.
- Ready, missing, queued, generating and needs-generation chips are more consistent.
- Current output, category and campaign download controls remain generated-only export actions.

## Visual Highlights Polish

- Visual Highlights remain summary-first and collapsible.
- Each highlight row now uses a small numbered badge aligned to uploaded image numbering.
- Expanded detail sits on a calmer inset surface so image analysis does not dominate the page.
- Image Analysis model routing was not changed.

## Diagnostics And Warning Treatment

- Campaign Build Log remains available through `Show build log`.
- Expanded diagnostics still expose model, token, token-only estimate and grounding/tool-charge caveats.
- The generated-draft/legal warning remains visible, but is styled as an integrated review notice rather than a loud warning slab.

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
- Category filters, output selection and Campaign Library tile grid remain.
- Current output, current category and campaign downloads remain generated-only.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available when expanded.

## Deferred

- Full Tailwind/shadcn migration.
- Shared AIM design-token package.
- Full single-column layout experiment.
- Multi-page wizard experiment.
- Connected beta auth/logging.
- Hub save.
- Public pricing.
- Campaign Blueprint generation.

## Follow-Up

`WEBAGENTS-COPYWRITING-PRE-KEVIN-UX-FIXES-001` fixed post-polish tester issues by normalising Additional Property Features bullet display, removing duplicate Listing Copy generation buttons, making the primary Listing Copy action red, demoting Review Listing Copy to a ready state, adding a same-input regenerate guard, and warning before Listing Copy regeneration clears Campaign Pack outputs.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, provider integration, environment file, dependency, database, pricing, SEO, AI search, or Campaign Blueprint implementation was added.

Visual Consistency Auditor: the workspace uses more consistent card, button, chip, form and warning treatments and is more Hub-adjacent.

Density Preservation Auditor: the existing compact spacing, collapsible sections, compact offer cards and Campaign Library density remain.

Offer UI Auditor: Listing Copy, Campaign Pack and planned Campaign Blueprint remain clear and distinct.

Button Hierarchy Auditor: primary generation, secondary review/export, AI analysis, dark neutral and disabled/planned actions are visually distinct.

Diagnostics Auditor: Campaign Build Log and technical details remain available but visually secondary.

Export Auditor: current output, current category and campaign downloads remain generated-only and do not generate missing outputs.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Visual Highlights, Campaign Build Log, technical details and downloads remain on existing handlers.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots or Vercel config should be staged.
