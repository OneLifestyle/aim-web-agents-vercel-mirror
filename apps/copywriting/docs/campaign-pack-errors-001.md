# Copywriting Campaign Pack Errors 001

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-PACK-ERRORS-001`

Date: 2026-06-29

Scope: focused reliability and diagnostics pass for Campaign Pack mid-run failures. This goal improves local session state, visible recovery messaging, and beta diagnostics only. It does not add Hub integration, auth, billing, storage, provider integrations, provider routing changes, dependencies, environment files, telemetry, Campaign Blueprint generation, SEO tooling, AI search tooling, or connected beta logging.

## Observed Issue

During private beta testing, Listing Copy generated successfully and Campaign Pack started generating 16 missing downstream campaign outputs. After roughly two outputs, the Campaign Pack process stopped and the UI surfaced only `Load failed`.

The user clicked Generate Campaign Pack again and the second run generated the remaining outputs successfully. Existing generated outputs were preserved by the incremental output commit inside the Campaign Pack loop, but the UI and Campaign Build Log did not clearly identify the failed output, sequence position, safe error class, or retry path.

## Likely Failure Class

The observed `Load failed` message is most consistent with a browser `fetch` or network-level request failure before the app received a normal JSON error response from `/api/copywriting`.

This goal does not prove the underlying provider cause because no live provider calls were made. It treats the failure as recoverable when the request failed mid-batch and leaves provider-level retry policy, failover, and observability deferred.

## Batch Progress Tracking

Campaign Pack generation now tracks local in-session batch state:

- batch status: `idle`, `generating`, `partial_failed`, or `complete`;
- requested output ids;
- started count;
- current output id, title, category, and sequence position;
- succeeded output ids;
- failed output id where available;
- remaining output ids;
- safe error diagnostic.

This state is local UI state only. It is not persisted to a database or synced to Hub.

## User-Facing Error

When Campaign Pack pauses mid-run, the user now sees a plain-English recoverable message such as:

`Campaign Pack paused while generating Coming Soon Teaser. 2 outputs were created and 14 remain. Retry the remaining outputs when ready.`

If the failing output cannot be identified, the message falls back to:

`Campaign Pack paused before finishing. 2 outputs were created and 14 remain. Retry the remaining outputs when ready.`

The Campaign Status card, Campaign Pack offer, Campaign Outputs alert, selected failed output placeholder, and output tile status now communicate a recoverable paused state instead of relying on a short-lived generic notification.

## Campaign Build Log Diagnostics

Failed Campaign Pack log entries now include safe technical detail:

- operation: Generate Campaign Pack;
- attempted count;
- succeeded count;
- failed count;
- remaining count;
- current output title;
- current output id;
- current category;
- sequence position;
- succeeded outputs before failure;
- remaining output ids;
- safe error message;
- error class;
- HTTP/provider status if available;
- provider error code if available;
- retry guidance;
- failure timestamp;
- token/cost caveat.

Error log detail remains inside Beta diagnostics and Campaign Build Log. Raw provider payloads, secrets, request bodies, and environment values are not exposed.

## Retry Behaviour

Clicking Generate Campaign Pack after a partial failure still uses the existing missing-output calculation:

- already-ready downstream outputs are skipped;
- missing or failed outputs are attempted;
- Listing Copy is not regenerated;
- successful outputs from the earlier partial run remain in the Campaign Library;
- a successful retry clears the paused state.

No silent auto-retry, background retry, or exponential backoff was added.

## Export Behaviour

Download current output, Download current category, and Download campaign remain generated-only export actions. They assemble documents from current local output state and do not generate missing outputs.

Downloads include generated outputs only. Missing outputs are noted where the export plan already supports missing-output notices.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Floating AI Assistant remains disabled from the primary UI.
- Floating Generate Listing Copy button remains removed.
- Additional Property Features double-bullet rendering remains fixed.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Property Brief readiness remains on the existing confirmed/manual logic.
- Listing Copy generation remains gated by property brief readiness.
- Campaign Direction AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- Generate Listing Copy remains on the existing master generation path.
- Regenerate Listing Copy remains guarded unless the brief changed.
- Regenerate Listing Copy still warns when Campaign Pack outputs exist.
- Campaign Pack generation remains on the existing downstream variant path.
- Category filters remain working inside Campaign Library.
- Current output, current category, and campaign downloads remain generated-only.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Campaign Build Log remains collapsed/demoted by default through Beta diagnostics.
- Technical details remain available after expanding Beta diagnostics.
- Visual Highlights remain summary-first and collapsible.

## Deferred

- Provider-level retry policy.
- Background retry.
- Exponential backoff.
- Billing or credit refund logic.
- Connected beta telemetry.
- Server-side error logging beyond the existing server console path.
- Hub usage ledger.
- Sentry or observability integration.
- Model router failover.
- Campaign Blueprint generation.

## Internal Review

Scope Auditor: no Hub, auth, billing, storage, provider-router, provider integration, environment file, dependency, database, pricing, SEO, AI search, or Campaign Blueprint implementation was added.

Failure Detail Auditor: Campaign Pack failures no longer surface only `Load failed` when batch context is available. The user sees output/progress context and the build log keeps safe technical details.

Partial State Auditor: successful Campaign Pack outputs remain committed incrementally before a later output fails.

Retry Auditor: retry still targets missing or failed downstream outputs and skips already-ready outputs.

User Messaging Auditor: visible failure text is recoverable, non-scary, and action-oriented.

Diagnostics Auditor: Campaign Build Log includes output id, title, category, sequence, succeeded count, remaining count, safe error details, retry guidance, and token/cost caveats.

Export Auditor: current output, current category, and campaign downloads remain generated-only and do not call generation.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: beta gate, address lookup, Fetch Details, AI analysis buttons, Listing Copy generation, Campaign Pack generation, Campaign Build Log, technical details, output library navigation, category filters, and downloads remain on existing handlers.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
