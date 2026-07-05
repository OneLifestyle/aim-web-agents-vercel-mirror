# Web Agents Backlog

Status: planning backlog only.

## Next Root-Level Work

### Shared Boundaries And Lane Alignment

Goal: keep the root `aim-web-agents` lane focused on orchestration, shared boundaries, and integration strategy while Copywriting Web and Photo AI Web continue in their app-scoped worktrees.

Scope:

- maintain the app worktree and lane registry;
- define shared package candidates only when active app lanes prove the need;
- keep Hub handoff expectations clear;
- keep model-router boundaries clear;
- record shared design and system conventions;
- preserve app import and source-lift policy;
- maintain cross-app consistency guardrails.

Out of scope:

- Clerk;
- Hub integration;
- Stripe;
- Firebase;
- Cloudflare;
- OpenRouter;
- Vercel AI SDK;
- shared packages;
- production-domain work;
- new provider routes;
- new auth;
- new billing;
- database integration;
- environment files;
- secrets.

## Active App-Scoped Lanes

### Copywriting Web

Folder: `apps/copywriting`

Codex project/worktree: `aim-web-agents-copywriting`

Position: active app-scoped product lane; operational and Vercel-hosted.

Root responsibility: boundary, shared architecture, and integration planning only. Do not run Copywriting import/readiness work from the root lane unless explicitly requested.

Keep Gemini/direct grounded research valid until any OpenRouter or Vercel AI SDK replacement is proven.

### Photo AI Web

Folder: `apps/photo-ai`

Codex project/worktree: `aim-web-agents-photo-ai`

Position: active app-scoped product lane.

Root responsibility: boundary, shared architecture, and integration planning only. Do not run Photo AI implementation work from the root lane unless explicitly requested.

## Planned Next App Lane

### Appraisal Web Standalone Source-Mine Audit

Position: planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence.

Goal: prepare Appraisal Web as a private/internal evidence and report workstation lane when explicitly requested.

Scope:

- identify source location and working state;
- confirm whether it runs outside AI Studio or v0;
- identify provider calls and key handling;
- audit evidence, citation, and source quality;
- remove or block AVM and valuation-advice framing;
- block portal scraping;
- avoid licensed Australian property-data dependencies unless rights are explicit outside this repo;
- require human review;
- define private/internal preview protection;
- tag or freeze a hardened standalone baseline before import.

## Later

### Website Web

Position: web-first by nature, likely from Vercel or v0 source.

### Video Web

Position: later workstation using existing web source and old Vision Ken Burns logic as source mines.

### Measure Web

Position: last. Mostly editing, export, and report layer after mobile capture.
