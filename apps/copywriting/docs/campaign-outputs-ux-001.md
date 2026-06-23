# Campaign Outputs UX 001

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-001`

Date: 2026-06-23

Scope: first product UI pass to make generated campaign material feel like a workspace rather than a final preview panel. This changed only the Copywriting Web app UI and docs inside `apps/copywriting`. It did not add provider integrations, dependencies, auth, Hub, billing, storage, database schema, environment files, secrets, Google Places, ZIP packaging, or new AI routes.

## What Changed

- Renamed the main generated-output panel from `Preview` to `Campaign Outputs`.
- Added a Campaign Outputs header explaining that outputs can be reviewed, refined and downloaded.
- Added ready and missing output counts derived from the existing export plan.
- Added an explicit section metadata structure in `App.tsx` for labels, short labels, descriptions, slugs, download capability and refine capability.
- Added section navigation cards across all generated campaign sections.
- Added section state indicators: `Ready`, `Missing`, `Generating`, and `Needs generation`.
- Made the selected section easier to read with a dedicated selected-section header, description, status badge, version controls and larger editor area.
- Repositioned refine controls under a clear `Refine this section` label.
- Kept section text editable, but framed the app as structured review and refinement rather than a mini word processor.
- Separated `Download current section` from `Download full campaign document` in the action area.
- Improved the current campaign action strip so active operations show as clear status chips.

## Campaign Outputs Structure

The current section structure is still based on the existing `PreviewTab` tabs and `previewTabConfig` groups:

- Listing;
- Coming Soon;
- Social Media;
- Events;
- Blog;
- Video.

Each campaign output section now has UI metadata:

- section id;
- label;
- short label;
- group;
- description;
- file-safe slug from the export assembly helper;
- selected state;
- generated state;
- status;
- download capability;
- refine capability.

This remains client-local UI structure only. No database, Hub object, durable asset or persistence contract was added.

## Section Navigation Behaviour

The first pass keeps the current tab/section model and adds safer anchor-style section buttons that switch the selected section. True scroll anchoring was deferred because the current app stores output as one active editable section, not a rendered multi-section document flow.

Selecting a section still uses the existing `handleTabClick` behaviour. If a missing section is selected after Full Copy exists, the existing auto-generation path is preserved.

## Output State Rules

Section status is derived from existing local state:

- `Generating`: the section matches the active `generatingTab`.
- `Ready`: the export plan says the section has generated content.
- `Missing`: Full Copy exists, but this section has not been generated.
- `Needs generation`: Full Copy is missing, or the Full Copy section itself is not generated.

These states are display-only and do not introduce durable workflow state.

## Refine And Export Behaviour

Refinement remains section-level through the existing `refineCopy` operation. The UI now labels the control as `Refine this section` and explains that heavier editing should continue in Word, Google Docs, CRM, email or agent systems after download.

Current export behaviour is preserved:

- `Download current section` exports only the selected section as Word, text or Print/PDF.
- `Download full campaign document` prepares one combined full-campaign document as Word, text or Print/PDF.
- The full-campaign export can still generate missing sections before export through the existing flow.

## Deferred

- Full mini word processor editing is deferred because this beta app should remain an AI review/refine workspace, while polished document editing can happen in Word, Google Docs, CRM, email or future agent systems.
- True single-column anchored Campaign Outputs is deferred because the current state model renders one selected editable section at a time. A later goal can render all sections in sequence once interaction and performance risks are reviewed.
- ZIP export remains deferred because it requires either an approved client ZIP dependency or a server packaging endpoint, plus tests for deterministic filenames and generated/missing section handling.
- Live Hub save remains deferred. Future Hub-owned assets should receive generated campaign outputs through Hub-owned workflows for assets, jobs, storage, sharing, timeline, ledger and workspace state.

## Internal Audit

Scope Auditor: no platform integration, provider change, auth, billing, Hub, storage, database, Google Places, ZIP implementation, dependency or framework change was added.

Output UX Auditor: the generated material now has a named Campaign Outputs workspace, section counts, navigation, statuses and clearer action grouping.

Section Navigation Auditor: navigation is safe because it reuses existing tab selection and generation behaviour.

Refine Auditor: refinement is clearer and remains section-level. No mini word processor was introduced.

Export Auditor: selected-section and full-campaign document exports remain separate and visible.

Build Log Auditor: Campaign Build Log remains persistent in the left column with beta technical details intact.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: address lookup, Fetch Details, Copy Context AI Analysis, Property Features AI Analysis, Generate Listing Copy and Generate Missing Tabs handlers were preserved.

Git Hygiene Auditor: no secrets, environment files, dependency folders, build output, screenshots or Vercel config are part of this goal.
