# Copywriting Export Assembly Contract

Date: 2026-06-25

The export assembly helper lives at `apps/copywriting/utils/exportAssembly.ts`.

## Purpose

The helper provides one deterministic place to describe exportable campaign content before any specific download format is chosen. It now distinguishes current output, current category, and full campaign document exports, while preparing a future export package manifest for ZIP packaging and Hub asset persistence without adding those integrations.

## Inputs

`buildCampaignExportPlan` accepts:

- `address`: property/address label for document titles and file-safe names;
- `versionNumber`: active campaign version number;
- `sections`: generated copy keyed by `PreviewTab`;
- `orderedTabs`: canonical export order;
- `categories`: category definitions and their output order;
- `selectedTab`: current selected section;
- `selectedCategory`: current category filter, when applicable;
- `includeContactDetails`: optional full-campaign contact-card flag;
- `contactCard`: optional contact-card text.
- `generatedAt`: optional export timestamp;
- `propertyContextSummary`: lightweight property-context availability summary;
- `inputSnapshotSummary`: structured input-state summary;
- `usageCostSummary`: token-only usage/cost summary where available;
- `generationLogSummary`: Campaign Build Log summary where available.

## Outputs

The helper returns:

- `masterDocument`: one combined full-campaign document;
- `categoryDocuments`: one generated-only document per category;
- `individualOutputDocuments`: one document per generated output;
- `selectedCategoryDocument`: the current selected category document when the selected filter is not `All`;
- `sectionDocuments`: one record for every configured section;
- `selectedSectionDocument`: the current selected section document;
- `generatedSections`: sections with generated copy;
- `missingSections`: sections not yet generated;
- `manifest`: internal future-ready export package manifest;
- `zipManifest`: future bundle manifest containing the master, category, and output documents.

Each section document includes:

- `tab`;
- `title`;
- `category`;
- `slug`;
- `fileBaseName`;
- `content`;
- `generated`.

## Current Behaviour

Current output downloads use an individual output document with output title, category, property address, generated copy, contact card content when present, and lightweight export metadata.

Current category downloads use `selectedCategoryDocument`, which includes generated outputs in the selected category only. The `All` filter is not treated as a category export.

Current full-campaign downloads use `masterDocument`, which includes all generated sections in one combined document grouped by category.

Download actions do not generate missing outputs. Missing outputs are omitted from export bodies and noted in category/campaign documents where useful.

No ZIP file, Hub asset, PDF generator, or DOCX generator is produced in this goal.

## Filename Convention

The helper emits safe base filenames:

- `real-estate-aim-copywriting-current-output-<property-slug>-<output-slug>-<date>`;
- `real-estate-aim-copywriting-category-<property-slug>-<category-slug>-<date>`;
- `real-estate-aim-copywriting-campaign-<property-slug>-<date>`.

The existing export UI appends the current format extension (`.txt` or `.doc`) or uses the existing print pathway for PDF.

## Internal Manifest

The internal manifest uses schema version `copywriting-export-pack.v1` and records:

- export scope and label;
- file-safe slug;
- generated timestamp;
- app id, name, and version;
- property address and context summary;
- selected category and output id where applicable;
- included and missing output ids;
- contact card inclusion;
- input snapshot summary;
- usage/cost summary where available;
- Campaign Build Log summary where available;
- future package document entries.

## Future ZIP Path

A later ZIP export can use `manifest`, `zipManifest`, `masterDocument`, `categoryDocuments`, and `individualOutputDocuments` to create:

- one master campaign document;
- named category documents;
- individual named output documents;
- generated/missing section metadata;
- stable file-safe names.

That later goal will need either an approved client ZIP dependency or a server packaging endpoint. No dependency was added here.

## Future Hub Path

A later Hub asset contract can consume:

- input snapshot summary;
- generated output bundle;
- export manifest;
- usage/cost snapshot;
- Campaign Build Log summary.

This contract does not create Hub records, upload files, sync assets, or persist state.
