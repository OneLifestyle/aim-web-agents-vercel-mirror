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
4. Copywriting Web exists in `apps/copywriting`, is developed through `aim-web-agents-copywriting`, and is operational and Vercel-hosted in its app-scoped lane.
5. Photo AI Web exists in `apps/photo-ai` and is developed through `aim-web-agents-photo-ai`.
6. Root `aim-web-agents` should not run Copywriting import/readiness work or Photo AI implementation work unless explicitly requested.
7. Source-lift should happen one app at a time.
8. Do not build a giant shared root stack before each app is independently understood.
9. Do not add Clerk, Stripe, OpenRouter, Hub integration, provider routing, environment files, or shared AIM model-router integration in this repo until separately approved.
10. Provider calls that require secrets must eventually be server-side only.
11. Each web agent needs a private-beta hardening path before public launch.
12. Each web agent needs a cost and model-routing review before integration with the shared AIM model router.

## Current Source-Lift Sequence

This is the current orchestration recommendation, updated for the app-scoped worktree structure. Earlier repo-local planning placed Appraisal Web before Photo Web. Keep that earlier sequence as historical context, but use this order for root-level planning unless `aim-docs` or a later task supersedes it.

1. Copywriting Web: active app-scoped product lane in `apps/copywriting` through `aim-web-agents-copywriting`; operational and Vercel-hosted.
2. Photo AI Web: active app-scoped product lane in `apps/photo-ai` through `aim-web-agents-photo-ai`.
3. Appraisal Web: planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence; private/internal first with strict appraisal guardrails.
4. Website Web: web-first property site builder.
5. Video Web: later workstation using existing web source and old Vision Ken Burns logic as source mines.
6. Measure Web: mostly editing, cleanup, report, export, and Hub packaging after mobile capture.

## App-Scoped Worktree Convention

Focused Codex projects or Git worktrees may be used for one app-specific lane at a time, targeting a single `apps/<agent>` folder. Final app code must land as ordinary files in the root `aim-web-agents` monorepo, not as permanent nested Git repositories inside `apps/*`.

See [App-Scoped Source-Lift Worktrees](../workflow/app-scoped-source-lift-worktrees.md) for the working convention.

See [App Worktree Registry](../workflow/app-worktree-registry.md) for the current lane registry.

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
- explicit source-lift task created for that one app;
- root-level tasks avoid duplicating active app-scoped work.

## Non-Goals For This Plan

This plan does not import app source, copy source-mine repositories, install dependencies, create API routes, create environment files, implement Clerk, implement Stripe, implement OpenRouter, implement Hub save/retrieve, or add provider integrations.
