# Copywriting Beta Presentation 001

Goal ID: `WEBAGENTS-COPYWRITING-BETA-PRESENTATION-001`

Date: 2026-06-26

Scope: prepare the standalone Copywriting Web app for trusted external private-beta testers by softening developer-facing UI, preserving internal beta diagnostics, and documenting the v1 review/download model.

## What Changed

- The app header now clearly identifies the workspace as a private beta.
- Header and access-gate copy now frame AIM output as campaign drafts created from property information the user provides or approves.
- Campaign Status now includes a plain-language progress label and description, such as `Looking up property`, `Reviewing property context`, `Creating campaign strategy`, `Generating outputs`, `Some outputs missing`, and `Campaign ready`.
- The left rail now starts with a plain beta progress card and a short draft review workflow note.
- Campaign Outputs copy now describes generated outputs as review drafts and keeps final editing outside Real Estate AIM for v1.
- Download menus now reinforce that downloads include generated outputs only and do not generate missing outputs silently.
- A small tester affordance was added in the header: testers should record the address, action, and output type if something looks wrong.

## Campaign Build Log Presentation

The Campaign Build Log is no longer visually dominant by default.

Default view:

- a compact `Beta diagnostics` card;
- log-entry, running, and error counts;
- latest plain-language step;
- latest error summary when present;
- a note that expanded diagnostics are not billing statements.

Expanded view:

- the existing Campaign Build Log stream;
- public step name plus technical step name where different;
- model name;
- provider usage status;
- token pricing status;
- input/output tokens;
- thinking/cached tokens where available;
- token-only estimated cost;
- grounding/tool-charge caveat;
- unavailable usage and unknown-cost counts;
- input/output summaries;
- errors.

The log remains available through the explicit `Show build log` control.

## Technical Details Access Model

Trusted testers do not need to read model names or token counts to understand progress.

Technical details are still available for internal beta review after expanding `Beta diagnostics`. The token/cost labels remain conservative:

- costs are token-only estimates;
- grounding/tool charges are not included;
- provider usage may be unavailable for some operations;
- beta diagnostics are not billing statements.

No pricing math was changed in this goal.

## Generated-Draft Wording

New or improved v1 wording includes:

- `AIM creates campaign drafts from the property information you provide or approve. Review generated copy before use.`
- `Review generated campaign drafts for this property.`
- `Copy or download ready outputs, then make final wording changes in your CRM, email, Word, Google Docs or publishing system.`
- `For v1, edit final wording in your CRM, email, Word, Google Docs or publishing system.`
- `Downloads include generated outputs only. Missing outputs are not generated silently.`

## Tester Help Wording

The app now includes a compact header note:

`Testing notes: if something looks wrong, record the address, action and output type.`

This does not add chat, email sending, support storage, or a support backend.

Follow-up note: `WEBAGENTS-COPYWRITING-CHAT-ASSISTANT-DISABLE-001` removed the previously visible floating general `AI Assistant` from the primary private-beta UI. Future contextual assistant/help concepts remain deferred in `chat-assistant-disabled-001.md`.

## Preserved Behaviour

- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- Image analysis remains on the existing photo-analysis path.
- Generate Listing Copy remains on the existing generation path.
- On-demand missing output generation remains on the existing selected-output path.
- Queued output generation remains on the existing queue path.
- Category filters remain on the existing Campaign Outputs path.
- Current-output selection remains unchanged.
- Contact Card checkbox remains in the selected output card and preserves append/remove behavior.
- Download current output exports only the selected generated output.
- Download current category exports generated outputs in the selected category only.
- Download campaign exports generated campaign outputs only.
- Download actions do not generate missing outputs.
- Generate missing outputs remains a separate action.
- Export manifest logic remains intact.
- Outputs remain read-only in the primary v1 UI.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.

## Deferred

- Hub auth/save/retrieve.
- Connected AIM beta.
- Clerk/auth.
- Storage/database.
- Billing/wallet.
- OpenRouter, Vercel AI SDK, or provider-router integration.
- Custom domain.
- ZIP export.
- PDF export.
- DOCX export.
- Public launch terms/legal copy.
- Final support workflow.

## Internal Review

Scope Auditor: no Hub/auth/billing/storage/provider-router work was added.

Tester Presentation Auditor: default UI now leads with private-beta product framing, plain progress language, draft review workflow, and tester feedback guidance instead of a developer console.

Technical Detail Auditor: technical detail remains available through `Show build log`, but model, token and cost data are not visually dominant by default.

Export Auditor: current output, current category and campaign downloads remain generated-only export actions and do not call generation.

V1 Simplicity Auditor: outputs remain read-only and regeneration-led.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: address lookup, Fetch Details, AI analysis buttons, Generate Listing Copy, Generate missing outputs, Campaign Build Log and downloads remain on existing paths.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
