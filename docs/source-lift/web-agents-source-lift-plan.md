# Web Agents Source-Lift Plan

Status: current orchestration recommendation for `WEBAGENTS-SOURCE-LIFT-PLAN-001`.

Canonical planning source: `aim-docs`. If this document conflicts with `aim-docs`, `aim-docs` wins.

## Operating Model

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

`aim-web-agents` owns tool experiences. AIM Hub owns the system of record.

Web Agents are production workstations, not Hub. They may create, review, edit, preview, export, and prepare assets. Durable account, profile, property, job, asset, storage, wallet, ledger, timeline, sharing, and workspace state belongs to Hub.

## Planning Decisions

1. Web Agents are production workstations, not Hub.
2. Hub owns account, profile, Asset Inbox, wallet, property records, job records, asset storage, ledger, timeline, sharing, and workspace state.
3. Web Agents create, review, and prepare assets, then later save or route them through Hub-owned workflows.
4. Copywriting Web remains standalone and frozen until an explicit import or maintenance task separately approves changes.
5. Source-lift should happen one app at a time.
6. Do not build a giant shared root stack before each app is independently understood.
7. Do not add Clerk, Stripe, OpenRouter, Hub integration, provider routing, environment files, or shared AIM model-router integration in this repo until separately approved.
8. Provider calls that require secrets must eventually be server-side only.
9. Each web agent needs a private-beta hardening path before public launch.
10. Each web agent needs a cost and model-routing review before integration with the shared AIM model router.

## Current Source-Lift Sequence

This is the current orchestration recommendation. Earlier repo-local planning placed Appraisal Web before Photo Web. Keep that earlier sequence as historical context, but use this order for the next planning lane unless `aim-docs` or a later task supersedes it.

1. Copywriting Web: already operational as a standalone private-beta baseline and frozen for now.
2. Photo Web: likely next source-lift candidate for AI upgrades and batch-production workstation workflows.
3. Appraisal Web: private/internal evidence and report workstation after or alongside Photo Web, with strict appraisal guardrails.
4. Website Web: web-first property site builder.
5. Video Web: later workstation using existing web source and old Vision Ken Burns logic as source mines.
6. Measure Web: mostly editing, cleanup, report, export, and Hub packaging after mobile capture.

## Cross-App Gates

Every web agent should pass these gates before import, integration, or public launch:

- source location and current working state recorded;
- standalone baseline frozen or tagged where appropriate;
- app-specific private-beta hardening path documented;
- provider calls and key handling audited;
- provider calls that require secrets moved or kept server-side before production use;
- no committed secrets or environment files;
- no Hub-owned durable state duplicated in the web app;
- no Clerk, Stripe, OpenRouter, Hub, or shared model-router integration unless separately approved;
- cost, model-routing, and provider fallback assumptions reviewed;
- explicit source-lift task created for that one app.

## Non-Goals For This Plan

This plan does not import app source, copy source-mine repositories, install dependencies, create API routes, create environment files, implement Clerk, implement Stripe, implement OpenRouter, implement Hub save/retrieve, or add provider integrations.
