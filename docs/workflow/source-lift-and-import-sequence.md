# Source-Lift And Import Sequence

Status: planning guidance only.

This document defines source-lift, import, and app-lane sequencing for web apps that belong in `aim-web-agents`.

## Principle

Source-lift one app at a time.

Do not import every existing web app immediately. Do not build a large shared root stack before a real app proves what the monorepo needs.

Each future app should first be made understandable, runnable, protected, and frozen in its current source location. Only then should the team decide whether to import it into `aim-web-agents`.

For apps already active in app-scoped lanes, use [App Worktree Registry](app-worktree-registry.md) as the current ownership record.

## Current Orchestration Recommendation

This is the current recommendation from `WEBAGENTS-SOURCE-LIFT-PLAN-001`, updated for the app-scoped worktree structure. Earlier repo-local planning placed Appraisal Web before Photo Web. Do not erase that context, but use this order for root-level planning unless `aim-docs` or a later task supersedes it.

1. Copywriting Web, active in `apps/copywriting` through `aim-web-agents-copywriting`; operational and Vercel-hosted.
2. Photo AI Web, active in `apps/photo-ai` through `aim-web-agents-photo-ai`.
3. Appraisal Web, planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence.
4. Website Web, web-first property site builder, likely from Vercel or v0 source.
5. Video Web, later, using existing web source and old Vision Ken Burns logic as source mines.
6. Measure Web, likely last, mostly editing, cleanup, export, report, and Hub packaging after mobile capture.

## Earlier Repo-Local Sequence

Previous planning docs recommended:

1. Copywriting Web.
2. Appraisal Web.
3. Photo Web.
4. Website Agent Web.
5. Video Web.
6. Measure Web.

That order is retained as historical context. The current orchestration recommendation moves Photo Web ahead of Appraisal Web because mobile Photo Agent should focus first on capture/import/adjust/export, while AI upgrades and batch production are more natural on web.

## Import Readiness Gate

An app is not ready to import merely because source exists. This gate applies to future app imports or reimports, not to root-level duplication of active app-scoped work.

Before import, confirm:

- the source location is identified;
- the current working state is recorded;
- the app runs outside AI Studio or v0;
- provider calls are server-side when provider keys are involved;
- provider keys are protected;
- beta gate or preview protection exists where appropriate;
- model and cost assumptions are correct;
- a Vercel preview exists if safe;
- the standalone baseline has been tagged or otherwise frozen;
- the import task is explicit and scoped.

## Copywriting Position

Copywriting Web already exists in `apps/copywriting` and is developed through the `aim-web-agents-copywriting` app-scoped project/worktree.

It is an active app-scoped product lane and is operational and Vercel-hosted. Root `aim-web-agents` should not run Copywriting import/readiness work unless explicitly requested.

Any future Copywriting root task should be boundary, shared architecture, and integration planning only unless the task explicitly expands scope. It should not add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integrations, environment files, or secrets.

The Gemini/direct grounded research path must remain valid until an OpenRouter or Vercel AI SDK replacement is proven.

## Photo Position

Photo AI Web already exists in `apps/photo-ai` and is developed through the `aim-web-agents-photo-ai` app-scoped project/worktree.

It is an active app-scoped product lane. Root `aim-web-agents` should not run Photo AI implementation work unless explicitly requested.

Photo AI Web remains the web lane for AI upgrade and batch-production workstation planning that can eventually receive photos from upload, Hub, or future Photo Agent mobile capture.

Photo provider benchmarking can include OpenRouter Image API, Reve, OpenAI image editing, Gemini/Nano Banana, FLUX, Adobe/Firefly, and Stability later. Do not implement provider routing yet.

## Appraisal Position

Appraisal Web remains the next planned web-app lane after Copywriting and Photo AI unless orchestration changes the sequence. It must remain private/internal during source mining and hardening. It should be imported later only after risk guardrails are documented, AVM and valuation-adjacent framing are blocked, source and attribution quality are clear, human review is mandatory, portal scraping is blocked, and a frozen baseline exists.

## Blocked Platform Moves

The following moves are blocked at this planning stage:

- importing all web apps at once;
- creating a root Next.js app without an explicit task;
- creating shared packages before an imported app proves the need;
- adding authentication;
- adding billing;
- adding Hub integration;
- adding provider routing;
- adding OpenRouter;
- adding Vercel AI SDK;
- adding Firebase, Cloudflare, or database integrations;
- adding committed environment files or secrets.
