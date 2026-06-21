# Source-Lift And Import Sequence

Status: planning guidance only.

This document defines the source-lift and import order for existing or candidate web apps that may later belong in `aim-web-agents`.

## Principle

Source-lift one app at a time.

Do not import every existing web app immediately. Do not build a large shared root stack before a real app proves what the monorepo needs.

Each app should first be made understandable, runnable, protected, and frozen in its current source location. Only then should the team decide whether to import it into `aim-web-agents`.

## Recommended Sequence

1. Copywriting Web, first import candidate into `apps/copywriting`.
2. Appraisal Web, first new source-lift candidate after Copywriting.
3. Photo Web, later AI upgrade and batch-production workstation.
4. Website Agent Web, web-first by nature, likely from Vercel or v0 source.
5. Video Web, later, using existing web source and old Vision Ken Burns logic as source mines.
6. Measure Web, last, mostly editing, export, and report layer after mobile capture.

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

## Current Import Candidate

Copywriting Web is the first real import candidate.

The first Copywriting import task should be a monorepo landing task only. It should not add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integrations, environment files, or secrets.

## First New Source-Lift Candidate

Appraisal Web is the first new source-lift candidate after Copywriting.

Appraisal Web must remain standalone during source mining and hardening. It should be imported later only after risk guardrails are documented, valuation-adjacent framing is removed, source and attribution quality are clear, and a frozen baseline exists.

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
