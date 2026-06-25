# Copywriting Export Pack 001

Goal ID: `WEBAGENTS-COPYWRITING-EXPORT-PACK-001`

Date: 2026-06-25

Scope: formalise the Copywriting v1 export-pack model without adding Hub integration, ZIP export, PDF/DOCX generation, provider integrations, auth, billing, persistence, or dependencies.

## Export Scopes

Copywriting v1 now treats the export scopes as distinct internal concepts:

- Current output export: the single selected generated output, such as Facebook, Brochure Copy, or Full Copy.
- Current category export: generated outputs in the selected category only, such as Listing, Social Media, Events, Blog, or Video.
- Campaign document export: all generated outputs in the current campaign, grouped by category.

The `All` filter is not treated as a current category. Users should use Download campaign for an all-generated-output document.

## Generated-Only Download Rule

Download actions do not silently generate missing outputs.

- Download current output exports the selected generated output only.
- Download category exports generated outputs in the selected category only.
- Download campaign exports generated outputs in the campaign only.
- Generate missing remains a separate generation action.

Missing outputs are omitted from export content. Category and campaign documents may include a lightweight missing-output notice so the user understands why some configured outputs are absent.

## Current Output Export

Current output downloads include:

- export scope metadata;
- output title;
- output category;
- property address where available;
- active campaign version;
- generated timestamp;
- generated copy;
- contact card content when the existing Contact card control has included it;
- a lightweight footer reminding users to change inputs and regenerate rather than editing the generated source of truth in-app.

Current output export does not include unrelated categories or missing outputs.

## Category Export

Current category downloads include:

- export scope metadata;
- category title;
- property address where available;
- active campaign version;
- generated timestamp;
- all generated outputs in the selected category;
- clear output headings;
- contact card content when the existing Contact card option is enabled for export assembly;
- a lightweight missing-output notice for outputs in that category that have not been generated.

The existing category filter and category download behavior are preserved.

## Campaign Export

Campaign downloads include:

- export scope metadata;
- property address where available;
- active campaign version;
- generated timestamp;
- all generated campaign outputs;
- clear category headings;
- clear output headings;
- contact card content when the existing Contact card option is enabled for export assembly;
- a lightweight missing-output summary.

Campaign download no longer calls generation for missing outputs. It is a local export action only.

## Filename Conventions

Download base filenames are safe and descriptive:

- `real-estate-aim-copywriting-current-output-<property-slug>-<output-slug>-<date>`;
- `real-estate-aim-copywriting-category-<property-slug>-<category-slug>-<date>`;
- `real-estate-aim-copywriting-campaign-<property-slug>-<date>`.

The existing export helpers append `.txt` or `.doc`. The existing print pathway remains the only PDF-like path.

## Manifest Structure

`apps/copywriting/utils/exportAssembly.ts` now emits an internal manifest with schema version `copywriting-export-pack.v1`.

The manifest supports:

- export scope;
- export label;
- file-safe slug;
- generated timestamp;
- app id, app name, and app version;
- property address;
- property context summary;
- selected category, if applicable;
- selected output id, if applicable;
- included output ids;
- missing output ids;
- contact card included yes/no;
- input snapshot summary;
- usage/cost summary where available;
- Campaign Build Log summary where available;
- document entries for future package assembly.

The manifest is internal only in this goal. It is not downloaded as a separate file yet.

## Future ZIP Readiness

The export helper now assembles reusable structures for a future ZIP export:

- master campaign document;
- category documents;
- individual output documents;
- manifest;
- future package document metadata.

No ZIP file is generated. No ZIP dependency or server packaging endpoint was added.

## Future Hub Asset Implications

A later Hub asset contract can consume:

- input snapshot summary;
- generated output bundle;
- export manifest;
- usage/cost snapshot;
- Campaign Build Log summary.

This goal does not create Hub assets, upload files, sync records, add persistence, or create live Hub save/re-entry semantics.

## Deferred Work

Deferred selected-output bundle model: individual output documents exist internally, but a downloadable multi-file selected-output bundle is not implemented.

Deferred PDF/DOCX: no new PDF or DOCX generation was added. The app keeps the existing Word-compatible `.doc`, plain text, and print pathways.

Deferred Hub save/sync: no Hub integration, asset persistence, upload, sync, retrieval, workspace state, or timeline save was added.

Deferred auth/billing/provider-router work: no Clerk, Stripe, OpenRouter, Vercel AI SDK, provider router, or billing work was added.

## Internal Audit

Scope Auditor: no Hub/auth/billing/provider-router/ZIP/PDF/DOCX integration was added.

Export Scope Auditor: current output, current category, and campaign document exports are distinct.

No Silent Generation Auditor: download actions do not call providers or generate missing outputs.

Filename Auditor: filenames are safe, consistent, and descriptive.

Manifest Auditor: the internal manifest supports future ZIP and Hub asset contract work.

V1 Simplicity Auditor: outputs remain read-only and regeneration-led.

Contact Card Auditor: contact card inclusion remains tied to the existing Contact card behavior.

Regression Auditor: category filtering, output selection, generated/missing states, Generate missing outputs, on-demand generation, and Campaign Build Log remain on existing paths.

Model Routing Auditor: AI Strategy Analysis remains Pro. Image Analysis remains Flash.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
