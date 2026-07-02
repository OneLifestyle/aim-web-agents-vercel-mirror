# Copywriting Laptop First Flow 001

Goal ID: `WEBAGENTS-COPYWRITING-LAPTOP-FIRST-FLOW-001`

Date: 2026-07-03

Scope: focused product UX pass for Kevin's small Mac laptop beta feedback. This goal simplifies the visible Copywriting workflow without adding Hub integration, auth, billing, storage, provider integrations, provider routing changes, dependencies, environment files, Campaign Blueprint generation, SEO tooling, AI search tooling, prompt-injection screening, or a full multi-page wizard.

## Kevin Laptop Feedback

Kevin's test found that the app was hard to understand on a small laptop:

- much of the app was below the fold;
- the interface was not obvious in intent;
- Campaign Outputs did not read as the natural destination for generated copy;
- Listing Copy generation did not make it clear where the output appeared;
- generated output was often hidden below the fold;
- the beta diagnostics column consumed useful width;
- developer-style explanatory text was too visible;
- property facts, overview, area profile, campaign direction and features felt disconnected;
- Fetch Details could be clicked from typed address text even when no suggestion had been selected.

## Why This Pass Was Needed

The app already had working beta access, address suggestions, Fetch Details, AI Strategy Analysis, Feature Extraction, Listing Copy, Campaign Pack, error handling and generated-only downloads. The next risk was not provider functionality; it was tester comprehension on laptop-sized screens.

This pass keeps the one-page workspace but makes it read as a simple journey:

1. Property Brief
2. Agent and Open Home
3. Campaign Direction
4. Features and Photos
5. Outputs and Downloads

## Fetch Details Selected Address Rule

Fetch Details now requires a selected address suggestion.

- Typed address text alone does not enable Fetch Details.
- Selecting a suggestion stores the confirmed address.
- Editing the address text after selection invalidates the selected-address state.
- The UI shows: `Select a suggested address before fetching property details.`
- If suggestions are slow or fail, the app does not silently fetch from unconfirmed typed text.

Manual property entry remains a future product decision and should be a separate manual brief path, not the same action as AI Fetch Details.

## Responsive And Laptop-First Layout

The main workspace now collapses to one stacked flow below the wide-desktop breakpoint:

- Property Brief and input sections appear first.
- Output Workspace appears next.
- Beta diagnostics appear after the main workflow on laptop.
- The three-column layout is reserved for very wide desktop only.
- The top sticky workflow controls use the five product steps above and act as anchors.

This reduces horizontal hunting on a small laptop and stops diagnostics from taking a prime column by default.

## Diagnostics Demotion

Beta diagnostics and Campaign Build Log remain available.

- The diagnostics panel stays collapsed by default.
- Campaign Build Log, model usage, token-only estimates and grounding/tool caveats remain inside the diagnostics area.
- On laptop, diagnostics are below the main workflow rather than the first visible column.
- On very wide desktop, diagnostics sit in a narrow support rail after the main work areas.

## Property Brief Grouping

Fetched property context now reads as part of Property Brief:

- the selected address is explicit before Fetch Details;
- fetched facts and features sit in the brief review section;
- price guide and last-sold details display when available;
- bedrooms, bathrooms, cars, land size and property type remain editable facts;
- Property Overview and Suburb & Area Profile are labelled as Property Brief context and start compact after fetch.

No fetched data was removed.

## Campaign Direction And Feature Wording

Campaign Direction is now described as the audience, tone and copy lens.

The former Property Features textarea is labelled `Key Selling Points` so it reads as campaign feature focus rather than duplicate property facts. It still uses the existing AI Feature Extraction behavior and editable textarea state.

## Output Visibility And Focus

Generating Listing Copy now visibly connects to the selected output card:

- generation scrolls to Output Workspace;
- after success, the selected output card scrolls into view;
- the generated draft receives focus;
- a ready message tells the user to review Listing Copy and generate Campaign Pack only if channel outputs are needed.

Campaign Pack generation now shows in-workspace progress with current output, category, sequence count, ready count and remaining count. During batch generation, the selected output follows the current channel item. After completion, Campaign Library and download options are visible in the same Output Workspace.

## Developer-Style Text Reduction

Visible copy was tightened toward beta-user guidance:

- the top feedback note now asks for property, action and output type only when something needs review;
- review/export helper copy is shorter;
- diagnostics caveats stay inside diagnostics;
- the generated draft legal/compliance warning remains visible.

## Deferred

- Full multi-page wizard.
- Full Canvas-style output drawer.
- Google Places.
- Connected beta auth/logging.
- Hub save.
- Prompt-injection screening.
- First-user onboarding.
- Tooltips/info icons.
- Formal mobile-responsive phone layout.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Multiple beta access codes remain server-side environment configuration and are not exposed.
- Floating AI Assistant remains disabled from the primary UI.
- Floating Generate Listing Copy remains removed.
- Additional Property Features double-bullet rendering remains fixed.
- Address lookup remains on the existing suggestion path.
- Fetch Details remains on the existing property research path after selected suggestion.
- Property Brief readiness remains on the existing confirmed/manual logic.
- Listing Copy generation remains gated by property brief readiness.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Key Selling Points AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Generate Listing Copy remains on the existing master generation path.
- Regenerate Listing Copy remains guarded unless the brief changed.
- Regenerate Listing Copy still warns when Campaign Pack outputs exist.
- Campaign Pack generation remains on the existing downstream variant path.
- Campaign Pack partial-failure handling remains preserved.
- Category filters remain working inside Campaign Library.
- Current output, current category and campaign downloads remain generated-only.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Technical details remain available inside Beta diagnostics.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, provider integration, environment file, dependency, database, pricing, SEO, AI search, or Campaign Blueprint implementation was added.

Laptop UX Auditor: the app now uses a five-step workflow, single-column laptop flow, output focus after generation, and diagnostics demotion.

Address Gate Auditor: Fetch Details requires a selected address suggestion, and text edits invalidate the selected address.

Output Visibility Auditor: Listing Copy generation scrolls and focuses the generated draft, while Campaign Pack progress appears inside Output Workspace.

Diagnostics Auditor: beta diagnostics remain available and collapsed, with technical details preserved.

Copy Auditor: visible helper text is shorter and less developer-facing while keeping generated-draft and legal warnings.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Campaign Build Log and downloads remain on existing handlers.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots or Vercel config should be staged.
