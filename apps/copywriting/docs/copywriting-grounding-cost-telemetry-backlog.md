# Copywriting Grounding Cost Telemetry Backlog

Date recorded: 2026-06-20

## Why Token-Only Cost Is Not Final Billing-Grade Cost

The current Analysis Stream displays token-only estimates from provider token usage metadata. That is useful for private beta operator awareness, but it is not a final billing-grade cost because it does not include separate Google Search grounding, Maps grounding, other tool charges, cached-token policy differences, free allowance drawdown or durable reconciliation across jobs and users.

The current product wording correctly treats visible cost as token-only and states that grounding/tool charges are not included.

## Current Google Grounding Pricing Assumption

For future planning only, assume:

- 5,000 free Gemini 3 grounding prompts/requests per month, shared across Gemini 3 usage.
- After the free allowance, Google Search grounding is $14 per 1,000 search queries.
- That is about 1.4 cents USD per billable search query after the free allowance.

These assumptions must be rechecked against current provider billing documentation before implementation or customer billing.

## What Must Be Captured Later

Future telemetry should capture:

- operation name;
- model;
- whether grounding was enabled;
- `webSearchQueries` count where available;
- non-empty search query count;
- grounding chunk/source count;
- Maps grounding count where available;
- token cost;
- grounding/tool estimated cost;
- included/excluded status for each cost component;
- user, account, tenant, property and job identifiers later.

## Persistence and Reconciliation Requirements

Future billing-grade telemetry should support:

- project-wide monthly free grounding allowance tracking;
- user/account/tenant/property/job attribution;
- operation-level audit records;
- monthly admin usage aggregation;
- reconciliation after the free allowance is exhausted;
- provider metadata normalization for Gemini and any later provider candidates.

## Why This Is Not Implemented in This Merge/Freeze Task

This merge/freeze task is documentation and release-baseline preservation only. Grounding-cost telemetry is intentionally deferred because it requires a durable backend ledger, admin usage aggregation, provider-response metadata normalization and future model-router/telemetry work.

No provider routing, prompts, product behavior, database, billing, credits, account ledger, Hub integration, Clerk integration, OpenRouter integration, Agent SDK integration, Exa integration or public-beta launch should be added as part of this baseline freeze.
