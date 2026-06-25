# V1 Output Simplification 001

Goal ID: `WEBAGENTS-COPYWRITING-V1-OUTPUT-SIMPLIFICATION-001`

Date: 2026-06-25

Scope: Copywriting v1 output simplification for the Campaign Outputs workspace. This goal made generated outputs read-only in the primary UI, removed reachable local edit/refine/save timeline controls, preserved regeneration and download workflows, and documented deferred product decisions.

## V1 Output Model

Copywriting v1 treats generated outputs as read-only drafts by design.

Users change copy by changing upstream campaign inputs and regenerating:

- property facts;
- property features;
- target market;
- writing style;
- things to avoid;
- visual context;
- agent profile;
- open house details.

The primary workflow is:

1. enter or fetch property details;
2. adjust inputs;
3. generate or regenerate outputs;
4. review outputs;
5. copy or download outputs;
6. perform final editing outside Real Estate AIM if required.

The Campaign Outputs surface now explains this directly: to change copy, update the inputs and regenerate; outputs are generated drafts for copy/download into a CRM, Word, Google Docs, or email system.

## Deferred V1 Editing Decisions

Post-generation local editing is deferred. V1 should avoid blurring generated output with user-authored output.

Advanced refine and chat-style editing are deferred. Free-form refine instructions and edited generated text are user-controlled content and should not be casually passed back into a model without a clearer prompt-control and provenance design.

Canvas-style focus mode is deferred. It belongs with a richer output/versioning product surface, not the private-beta drafting calculator workflow.

Hub-based asset retrieval and re-entry are deferred. V1 remains standalone and does not create live Hub save or retrieval semantics.

The dormant `refineCopy` API path now returns a v1-unavailable response instead of calling the model. The operation can be reconsidered only with an explicit v2 refinement/versioning design.

## Future V2 Options

A later v2 may support:

- saved editable output versions;
- refinement history;
- generated versus user-edited provenance;
- Hub-backed versioning;
- explicit user-authored content labelling;
- selected-output export bundles;
- review and approval workflow.

## Export And Hub Implications

Export-pack remains the next recommended Copywriting goal after this simplification.

The current v1 download model remains unchanged:

- current output download;
- current category download;
- campaign download.

Selected-output export bundles are deferred until export-pack work or a later v2 output model.

Future Hub asset contracts should treat v1 outputs as generated output bundles with input snapshots and usage logs. If Hub later re-enters or retrieves these assets, it should preserve the generated-output provenance and avoid implying that local user edits were part of the generated source unless explicit versioning and labelling exist.

## Internal Audit

Scope Auditor: no platform integrations, auth, billing, Hub save, provider integrations, database schema, environment files, dependencies, ZIP export, or Vercel config were added.

V1 Simplicity Auditor: the primary workflow is inputs -> generate/regenerate -> review -> copy/download.

Edit/Refine Safety Auditor: local edit, advanced refine, run refine, save timeline, and the timeline viewer are no longer reachable from the primary UI. The refine API returns a v1-unavailable response without calling a provider.

Source-of-Truth Auditor: generated outputs are displayed as read-only draft text, so the app no longer invites casual typing into generated output.

Export Auditor: current output, current category, and campaign downloads remain on existing paths.

Generation Auditor: Generate Listing Copy, Generate missing outputs, queued missing-output generation, and on-demand missing-output generation remain on existing paths.

Model Routing Auditor: AI Strategy Analysis remains Pro. Image Analysis remains Flash. This goal did not change the strategy or image model routes.

Regression Auditor: address lookup, Fetch Details, Copy Context AI Analysis, Property Features AI Analysis, Campaign Build Log, output tiles, category filters, status chips, and contact-card checkbox behavior remain on existing paths.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
