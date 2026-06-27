# Copywriting Workspace Density Visuals 001

Goal ID: `WEBAGENTS-COPYWRITING-WORKSPACE-DENSITY-VISUALS-001`

Date: 2026-06-27

Scope: tighten the Copywriting private-beta workspace density and improve the Property Photos / Visual Highlights relationship. This goal does not add Hub integration, auth, billing, storage, provider integrations, provider routing changes, dependencies, Tailwind/shadcn migration, Campaign Blueprint generation, or full Hub-style visual polish.

## Density Changes

- Reduced shared section padding from the larger previous card treatment to a tighter card body and header gap.
- Reduced workspace grid gaps, column vertical spacing, sticky rail spacing, and placeholder height.
- Kept the three-column desktop workspace and responsive single-column fallback.
- Shortened several Output Workspace helper lines so the right side reads more like product guidance and less like internal commentary.

## Card And Output Density

- Compacted the Output Workspace offer cards by reducing minimum height, padding, chip size, title size, description length, and internal gaps.
- Shortened Campaign Pack and Campaign Library helper copy.
- Reduced Campaign Library filter and output-tile padding and tile minimum height.
- Preserved the three-offer model: Listing Copy, Campaign Pack, and planned-only Campaign Blueprint.

## Agent Profile

- Agent name and agency now share a responsive compact grid.
- The `Append Only` and `Integrate into Copy` options are compact radio cards and can sit side by side when viewport width allows.
- Contact Card behaviour and export behaviour were not changed.

## Collapsible Sections

- Property Overview is collapsible after Fetch Details. It starts expanded after generation and shows a compact summary plus source count when collapsed.
- Suburb & Area Profile is collapsible after Fetch Details. It starts expanded after generation.
- Suburb & Area Profile copywriting inclusion settings remain visible and editable even when the profile text is collapsed.
- Collapsed Suburb & Area Profile shows the active inclusion setting and compact suburb/area summaries.

## Campaign Direction Naming

Visible `Copy Context` section naming was changed to `Campaign Direction`.

The internal `copyContext` state, `copyContextAnalysis` operation id, and `copy-context` anchor were left in place to avoid unnecessary contract churn. The visible analysis operation label now says `Campaign Direction analysis`, while the technical step continues to record `AI Strategy Analysis`.

## Property Photos

- Added a visible `0/20 photos` count to the Property Photos card.
- Added upload copy stating `Up to 20 photos`.
- Centralised the existing hard cap as `IMAGE_UPLOAD_LIMIT = 20`.
- The upload input is disabled after 20 photos.
- Uploaded previews now show `Image 1`, `Image 2`, and so on.
- The image numbers are designed to match Visual Highlights entries.

## Visual Highlights

- The image-analysis prompt now requests a structured response with `Summary` and `Details` fields.
- The prompt explicitly asks the model not to start with generic phrasing such as `Based on the image`.
- Existing/generated text is normalised into per-image highlight rows where possible.
- Each image entry shows image number plus concise summary by default.
- Detail bullets are preserved behind expandable rows.
- Visual Highlights reset to collapsed summary rows after analysis or photo changes.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Floating AI Assistant remains disabled from the primary UI.
- Floating Generate Listing Copy button remains removed.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Listing Copy generation remains gated by property brief readiness.
- Campaign Pack generation remains on the existing downstream variant path.
- Campaign Blueprint remains planned beta only and cannot trigger generation.
- Category filters remain in Campaign Library.
- Current output, current category, and campaign downloads remain generated-only.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available after expanding Beta diagnostics.

## Deferred

- Full AIM shared design-system or design-token package.
- Tailwind/shadcn migration.
- Full single-column redesign.
- Multi-page wizard.
- Connected beta auth/logging.
- `inputFingerprint` stale dependency engine.
- Campaign Blueprint generation.
- Hub save.
- Public pricing.

## Follow-Up

`WEBAGENTS-COPYWRITING-HUB-STYLE-DESIGN-POLISH-001` applied Hub-adjacent visual polish on top of this density work, using local `aimUi` class tokens for calmer cards, buttons, chips, forms, Campaign Library, Visual Highlights, diagnostics and warning treatment without changing the compact workflow.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, dependency, environment, pricing, database, or provider-integration work was added.

Density Auditor: card padding, workspace gaps, offer cards, Campaign Library, and support copy were tightened without changing the workflow.

Collapsible Section Auditor: Property Overview and Suburb & Area Profile can collapse while preserving summary context. Suburb inclusion settings remain visible and editable.

Naming Auditor: the visible section is now `Campaign Direction`; internal names were left stable.

Photos Auditor: the 20-photo cap is visible and enforced, and uploaded images are numbered.

Visual Highlights Auditor: output is summary-first, connected to image numbers, less text-heavy by default, and expandable for detail.

Offer Card Auditor: Listing Copy, Campaign Pack, and planned Campaign Blueprint cards are more compact while preserving the offer model.

Export Auditor: current output, current category, and campaign downloads remain generated-only and do not generate missing outputs.

Model Routing Auditor: AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Campaign Build Log, technical details, category filters, output selection and downloads remain on existing paths.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots or Vercel config should be staged.
