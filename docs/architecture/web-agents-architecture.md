# Web Agents Architecture

## Purpose

`aim-web-agents` is the Real Estate AIM Web Agents orchestration monorepo for web-based agent and tool surfaces. It exists for web-first production workstations, prototype lanes, source lanes, reusable packages, and app-lane coordination that support web agent experiences.

Product code should be imported or expanded only through explicit scoped tasks. This architecture document is planning guidance, not approval to add integrations or source.

## Relationship To aim-docs

`aim-docs` is the canonical planning and source-of-truth repository.

This repository may contain local copied context and implementation-facing notes, but those notes must remain subordinate to `aim-docs`. If any local document conflicts with `aim-docs`, `aim-docs` wins.

Completion reports and cross-repo planning updates should return to the Orchestrator and `aim-docs`.

## Relationship To aim-hub

`aim-web-agents` is not a replacement for AIM Hub.

AIM Hub owns durable workspace and business state, including identity, wallet, credits, profile, properties, jobs, assets, ledger records, storage, sharing, timeline, and workspace state.

Web agents should generate, edit, review, preview, export, and prepare outputs. They should save durable outcomes through Hub-owned integration patterns rather than becoming a second source of truth.

## Relationship To aim-mobile-agents

`aim-web-agents` mirrors the intent of `aim-mobile-agents` for web-based surfaces.

The mobile repo is for mobile-first agent experiences. This repo is for web-first agent experiences. Web-first interfaces may later inform mobile apps, including iOS agent implementations, but this repo should not own mobile app source.

## Relationship To Future aim-services

Future `aim-services` may own backend services, long-running workers, provider routing, secure model orchestration, and production service responsibilities.

`aim-web-agents` should not become the long-running backend worker layer or production model routing backend. It may contain clients and interface code that connect to service-owned APIs when those services exist.

## Root And App-Scoped Ownership

The root `aim-web-agents` project owns:

- Web Agents architecture;
- source-lift sequencing;
- shared package planning;
- shared design and system conventions;
- app worktree and lane registry;
- root docs and guardrails;
- Hub boundary docs;
- model-router boundary docs;
- app import and source-lift policy;
- cross-app consistency.

App-scoped Codex projects or worktrees own app UI, app logic, app-local docs, app-specific scripts, app-specific deployment or preview work, and app-specific provider/use-case testing.

Root-level tasks must not double up on work already underway in app-scoped worktrees.

## Current And Planned Apps

Current app worktree ownership is recorded in [App Worktree Registry](../workflow/app-worktree-registry.md).

| App | Folder | Codex project/worktree | Status |
| --- | --- | --- | --- |
| Copywriting Web | `apps/copywriting` | `aim-web-agents-copywriting` | Active app-scoped product lane; operational and Vercel-hosted. |
| Photo AI Web | `apps/photo-ai` | `aim-web-agents-photo-ai` | Active app-scoped product lane. |
| Appraisal Web | `apps/appraisal` | Future app-scoped lane. | Planned after Copywriting and Photo AI unless orchestration changes the sequence; private/internal first. |
| Website Web | `apps/website` | Future app-scoped lane. | Later web-first property site builder lane. |
| Video Web | `apps/video` | Future app-scoped lane. | Later video production workstation lane. |
| Measure Web | `apps/measure` | Future app-scoped lane. | Later editing, cleanup, reporting, and export lane. |

## Expected Packages

Planned package folders:

- `packages/ui`
- `packages/design-tokens`
- `packages/auth-client`
- `packages/hub-client`
- `packages/model-router-client`
- `packages/prompt-kits`
- `packages/retrieval`
- `packages/env`
- `packages/analytics`

For `WEBAGENTS-001`, these folders are placeholders only.

## What Belongs Here

This repo may contain:

- web-based agent and tool surfaces;
- source and prototype lanes;
- reusable web agent packages;
- future Copywriting, Appraisal, Website Agent, Photo AI, Video, Measure, and related web tools;
- web-first interfaces that may later inform mobile apps;
- standalone web tools that connect to Hub without being part of Hub.

## What Must Not Belong Here

This repo must not own:

- wallet source of truth;
- billing source of truth;
- property database source of truth;
- asset storage source of truth;
- job ledger source of truth;
- user or team source of truth;
- Hub Pro workspace state;
- long-running backend workers;
- model provider secrets;
- provider administration;
- production model routing backend.

## Production Workstation Model

The current product model is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Web Agents are workstations. Hub is the system of record.

## Copywriting Lane

Copywriting Web exists in `apps/copywriting` and is developed through the `aim-web-agents-copywriting` app-scoped project/worktree.

Copywriting is an active app-scoped product lane and is operational and Vercel-hosted. It works outside AI Studio, runs through Vercel, has beta gate protection, uses server-side Gemini calls, shows private-beta token and cost data, has been merged, tagged, and recorded, and is not public yet.

Root `aim-web-agents` should not run Copywriting import/readiness work unless explicitly requested. Any root-level Copywriting task should be boundary, shared architecture, and integration planning only unless the task explicitly expands scope. It should not add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, environment files, or secrets.

Copywriting may become both a standalone web product and a source lane for a future iOS Copywriting Agent.

## Source-Lift Sequence

Source-lift one app at a time. Do not import all existing web apps immediately and do not build a giant shared root stack first.

Current orchestration recommendation:

1. Copywriting Web, active app-scoped product lane in `apps/copywriting` through `aim-web-agents-copywriting`; operational and Vercel-hosted.
2. Photo AI Web, active app-scoped product lane in `apps/photo-ai` through `aim-web-agents-photo-ai`.
3. Appraisal Web, planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence; private/internal first with strict appraisal guardrails.
4. Website Web, web-first property site builder, likely from Vercel or v0 source.
5. Video Web, later, using existing web source and old Vision Ken Burns logic as source mines.
6. Measure Web, likely last, mostly editing, cleanup, export, report, and Hub packaging after mobile capture.

Appraisal Web should remain private/internal first because it is evidence-sensitive, can be mistaken for valuation advice, depends on attribution and source quality, must avoid AVM framing, must avoid portal scraping and unapproved licensed Australian property data dependencies, and requires human review.
