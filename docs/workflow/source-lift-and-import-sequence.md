# Source-Lift And Import Sequence

Status: planning guidance only.

This document defines the source-lift and import order for existing or candidate web apps that may later belong in `aim-web-agents`.

## Principle

Source-lift one app at a time.

Do not import every existing web app immediately. Do not build a large shared root stack before a real app proves what the monorepo needs.

Each app should first be made understandable, runnable, protected, and frozen in its current source location. Only then should the team decide whether to import it into `aim-web-agents`.

## Current Orchestration Recommendation

This is the current recommendation from `WEBAGENTS-SOURCE-LIFT-PLAN-001`. Earlier repo-local planning placed Appraisal Web before Photo Web. Do not erase that context, but use this order for the next source-lift lane unless `aim-docs` or a later task supersedes it.

1. Copywriting Web, already operational as a standalone private-beta baseline and frozen until separately approved.
2. Photo Web, likely next AI upgrade and batch-production workstation.
3. Appraisal Web, private/internal evidence and report workstation after or alongside Photo Web, with strict appraisal guardrails.
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

An app is not ready to import merely because source exists.

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

Copywriting Web is already operational as a standalone private-beta baseline and remains frozen until a separate task explicitly approves import or maintenance.

Future import target is likely `apps/copywriting`. The first Copywriting import or maintenance task should be a monorepo landing task only. It should not add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integrations, environment files, or secrets.

The Gemini/direct grounded research path must remain valid until an OpenRouter or Vercel AI SDK replacement is proven.

## Photo Position

Photo Web is the likely next source-lift candidate. It should become an AI upgrade and batch-production workstation that can eventually receive photos from upload, Hub, or future Photo Agent mobile capture.

Photo provider benchmarking can include OpenRouter Image API, Reve, OpenAI image editing, Gemini/Nano Banana, FLUX, Adobe/Firefly, and Stability later. Do not implement provider routing yet.

## Appraisal Position

Appraisal Web remains a strong source-lift candidate and may run after or alongside Photo Web. It must remain private/internal during source mining and hardening. It should be imported later only after risk guardrails are documented, AVM and valuation-adjacent framing are blocked, source and attribution quality are clear, human review is mandatory, portal scraping is blocked, and a frozen baseline exists.

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
