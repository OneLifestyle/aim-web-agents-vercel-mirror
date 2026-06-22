# Copywriting Reliability And Export UX 001

Goal ID: `WEBAGENTS-COPYWRITING-RELIABILITY-EXPORT-UX-001`

Date: 2026-06-22

Scope: first safe reliability and output UX sprint for `apps/copywriting`. This sprint changed product code and docs only inside the Web Agents copywriting app. It did not call provider APIs, inspect secret values, add dependencies, add platform integrations, change framework, create API integrations, or perform a broad layout redesign.

## Changes Made

- Added typed server validation for AI Strategy Analysis JSON.
- Replaced the strategy path's direct `JSON.parse` with robust JSON extraction plus shape validation.
- Added one repair retry for malformed or invalid strategy JSON, using the same server-resolved Pro model route.
- Preserved prior successful client strategy settings when a later analysis fails.
- Added a client-side campaign operation guard around shared-state mutating actions.
- Renamed the visible `Analysis Stream` shell to `Campaign Build Log`.
- Added plain-language Campaign Build Log step labels while keeping the original technical step name visible.
- Preserved model, usage, token, pricing, token-only cost estimate, and grounding/tool charge caveats.
- Clarified selected-section download versus full-campaign download labels.
- Kept full-campaign download as one combined document, not separate files or ZIP.
- Added export assembly helpers for master campaign documents, individual section documents, file-safe section names, selected section state, missing/generated section state, and a future ZIP manifest.
- Tightened usage aggregation so unavailable usage and unknown-cost cases are not double-counted as the same failure mode.

## Strategy Analysis Reliability

AI Strategy Analysis remains routed to `GEMINI_PRO_MODEL` through `OPERATION_MODEL_TIER.analyzeStrategy = 'pro'`.

The server now validates:

- `primaryTargetMarket` is present and belongs to the supported target market list;
- `secondaryTargetMarket` is absent/null/empty or belongs to the supported target market list;
- `writingStyles` contains one or two supported styles;
- unsupported or more-than-two writing styles are rejected;
- `featuresToHighlight` is present after normalization;
- `thingsToAvoid` is normalized but may be empty.

If the first strategy response is empty, malformed, not parseable as JSON, or fails validation, the server makes one repair attempt with the same Pro model. If the repair response also fails validation, the operation fails and the client keeps the previous strategy settings.

## Concurrency Guard Behaviour

The client now allows only one campaign-mutating operation at a time for:

- property research;
- AI Strategy Analysis;
- feature extraction;
- uploaded photo analysis;
- single-section/full-copy generation;
- Generate Missing Tabs / Regenerate Campaign;
- selected-section refinement;
- full-campaign document download.

Address suggestions and chat remain independent because they do not mutate the shared campaign output state. When a protected operation is running, the app shows a campaign action banner and blocks new protected actions with a short message.

This is intentionally not a queue, background job system, durable lock, or Hub workflow integration.

## Campaign Build Log

The former developer-facing `Analysis Stream` is now presented as `Campaign Build Log`.

Plain-language operation names are shown first, for example:

- Reviewing property context;
- Creating campaign strategy;
- Analyzing uploaded photos;
- Generating campaign copy;
- Preparing full campaign document.

The original technical step remains visible as `Technical step: ...` where the public label differs. Token-only estimates, model strings, token counts, pricing status, missing usage indicators, and the `Grounding/tool charges not included` caveat remain visible for beta testing.

## Export And Download Labels

Selected-section export is labelled `Download current section`.

Full-campaign export is labelled `Download full campaign document`, and the format menu explains that the full campaign includes all generated sections in one combined document.

This goal did not implement ZIP export. The current full-campaign flow still generates missing sections if required, then exports one master document as Word, text, or Print/PDF.

## Usage Aggregation

The client and strategy repair path aggregate usage defensively:

- mixed Pro/Flash model names are reported as mixed;
- unavailable provider usage counts as excluded;
- unknown pricing or non-priced token estimates count as unknown cost;
- token-only cost caveats remain present;
- grounding/tool charges remain excluded.

This is still not billing-grade pricing and should not be treated as an invoice or ledger.

## Deferred Work

- Live provider quality testing for Strategy Analysis on Flash versus Pro.
- Strategy low-confidence scoring and Pro fallback experiments after Flash quality testing.
- Tests for usage aggregation and export assembly if/when a test framework is added.
- ZIP export containing one master document plus individual named section documents.
- Single-column Campaign Outputs layout with anchored section navigation, section actions, and a clearer review/refine workflow.
- Hub-owned durable state, usage ledger, jobs, assets, credits, storage, and workspace workflows.

## Internal Audit

Scope Auditor: no platform integration, Hub/auth/billing/provider abstraction, broad redesign, framework conversion, database schema, environment file, or dependency was added.

Model Routing Auditor: AI Strategy Analysis remains on Pro. Image analysis remains on Flash.

Reliability Auditor: strategy JSON validation, one repair retry, clearer failure handling, prior strategy preservation, and operation-level concurrency guards are implemented.

Cost Auditor: cost display remains token-only and preserves grounding/tool charge caveats.

Build Log Auditor: the public shell is clearer while beta technical details remain visible.

Export Auditor: selected-section and full-campaign document labels are distinct, and the future ZIP path is supported by helper structure and documented separately.

Git Hygiene Auditor: no secrets, env files, dependency changes, build output, screenshots, Vercel config, or generated dependency folders should be staged.
