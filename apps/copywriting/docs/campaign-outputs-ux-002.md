# Campaign Outputs UX 002

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-002`

Date: 2026-06-23

Scope: product UX refinement for the Copywriting Web Agent campaign outputs workspace. This goal changed only `apps/copywriting` product UI and documentation. It did not add provider integrations, dependencies, auth, Hub, billing, storage, database schema, environment files, secrets, Google Places, ZIP packaging, or new AI routes.

## Terminology

- Category: top-level output group, such as Listing, Coming Soon, Social Media, Events, Blog, and Video.
- Output item: a single generated deliverable, such as Full Copy, Just Listed, Facebook, Instagram, Flyer, Email, Blog Post, Open House, or Video Script.
- Current output: the single output item currently selected for review.
- Current category: the selected category filter, excluding All.
- Full campaign: all generated campaign output items in one combined campaign document.

Visible labels now prefer `current output`, `current category`, and `full campaign document` instead of using `section` ambiguously. Internal code still uses some section-oriented export helper names because the existing data model is section-based and did not need a risky rewrite.

## Category Filter Behaviour

Campaign Outputs now includes an `All` filter followed by category filters:

- All;
- Listing;
- Coming Soon;
- Social Media;
- Events;
- Blog;
- Video.

Selecting a category filters the visible output tiles below the row. Selecting `All` shows every output item. Category filters show ready totals, and the tile-grid summary shows whether the filtered view is complete or still has missing/generating outputs.

The category filter does not automatically call generation. Tile selection still uses the existing output selection behaviour, including the existing missing-output generation path when a specific missing tile is selected.

## Duplicate Open House Finding

Social Media and Events both mapped to the same `Open House` `PreviewTab`, so the UI could show two Open House tiles even though there was only one underlying output item. This was a label/mapping collision, not two distinct generated deliverables.

Decision: keep the single `Open House` output item under Events and remove it from Social Media. This avoids inventing a new provider-backed output type without prompt and regression coverage. The Open House details helper copy now refers to event collateral only.

## Tile Grid Layout

The tile area no longer uses the previous small internal scroll box. It uses a larger responsive wrap grid inside the Campaign Outputs workspace and lets the page area own scrolling. This makes output navigation feel deliberate and avoids the cramped table-like feel.

## Output Action Layout

The action area is grouped into:

- Output actions: Copy current output, Download current output, Download current category, Download full campaign document.
- Generation: Generate Missing Tabs / Regenerate Campaign and Contact Card.
- Local editing and beta refine: Edit local copy, Advanced refine (beta), Save to timeline.

`Download current category` is implemented for generated outputs in the selected category. It does not call providers or generate missing category outputs. The full campaign document flow remains the path that can generate missing outputs before export.

## Refine And Edit Beta Decision

Generated output is read-only by default. Inline editing is now explicit behind `Edit local copy`, and the Save control is labelled `Save to timeline` to avoid implying durable Hub or database persistence.

Free-form refinement is demoted behind `Advanced refine (beta)`. The underlying refine function remains available, but it is no longer a primary review path.

Prompt-injection/user-content caution: edited generated text and refine instructions are user-controlled content. If passed back to the model, they must be treated as untrusted input. Full chat-style refinement and rich editing remain deferred until a clearer prompt-control and persistence design exists.

## Affected-Area Activity Indicators

Running operations now visibly activate affected panels:

- Fetch Details: Property Details, Property Overview, and Suburb & Area Profile.
- Address Suggestions: Property Address field only, through the existing quiet spinner and suggestions state.
- AI Strategy Analysis: Copy Context.
- AI Feature Extraction: Property Features.
- Image Analysis: Property Photos and Visual Highlights.
- Generate Listing Copy, Generate Missing Tabs, Regenerate Campaign, full campaign export, and beta refine: Campaign Outputs and output tiles.

The indicator is a subtle amber border/ring plus a compact spinner label. Heavy animation was not added.

## Current Status Presentation

The transient action banner is replaced with a compact `Campaign Status` row. It shows the current state plus step chips:

- Address;
- Research;
- Strategy;
- Features;
- Images;
- Outputs;
- Review.

The status uses complete/current/missing states where safely derivable. It does not use fragile percentages or a full future multi-step progress system.

## Preserved Behaviour

- Address lookup remains Gemini-backed through the existing server endpoint.
- Fetch Details remains working through the existing property research path.
- Copy Context AI Analysis remains working.
- Property Features AI Analysis remains working.
- AI Strategy Analysis remains routed to Pro.
- Image Analysis remains routed to Flash.
- Generate Listing Copy remains working.
- Generate Missing Tabs remains working.
- Campaign Build Log remains visible with beta technical details.
- Download current output uses the existing selected-output export path.
- Download full campaign document uses the existing combined campaign export path.

## Deferred

- Full canvas-style focus mode.
- Full app-wide single-column anchored review flow.
- True rich editor.
- Full refinement/chat workflow.
- ZIP export.
- Hub asset persistence.
- Auth, billing, provider-router, and platform integration work.

## Internal Audit

Scope Auditor: no platform integration, Hub/auth/billing/provider work, full app rewrite, database schema, environment file, dependency, or ZIP export was added.

Output Terminology Auditor: visible labels distinguish current output, current category, and full campaign document.

Category Navigation Auditor: category filters control the tile grid and an All option exists.

Duplicate Output Auditor: duplicate Open House was a single-output mapping collision and is resolved by keeping Open House under Events only.

Action Layout Auditor: output actions are grouped with consistent button sizing and clearer labels.

Refine/Edit Safety Auditor: generated output is read-only by default, local editing is explicit, and beta refine is demoted with user-content caution documented.

Activity State Auditor: affected panels show lightweight activity state during relevant operations.

Status Auditor: Campaign Status is intentional and compact, with step chips that do not compete with category navigation.

Build Log Auditor: Campaign Build Log remains present and keeps beta technical details.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: address lookup, Fetch Details, analysis buttons, Generate Listing Copy, Generate Missing Tabs, current-output download and full-campaign download were preserved.

Git Hygiene Auditor: no secrets, environment files, dependency folders, build output, screenshots, or Vercel config should be staged.
