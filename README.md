# AIM Web Agents

`aim-web-agents` is the Web Agents orchestration monorepo for Real Estate AIM web-based agent and tool surfaces.

Status: root-level architecture, workflow, source-lift sequencing, app-lane registry, and shared planning. Product code, provider integrations, environment files, and shared platform abstractions should be added only through explicit scoped tasks.

Current lane: `WEB AGENTS`

Canonical planning docs: `aim-docs`

If anything in this repository conflicts with `aim-docs`, `aim-docs` wins.

## Purpose

This repository is intended for web-first production workstations, prototype lanes, source-lift planning, and reusable web agent packages. It is expected to hold web tools such as Copywriting, Photo AI, Appraisal, Website, Video, Measure, and related web-first interfaces.

The operating model is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Current app-scoped product lanes are recorded in [App Worktree Registry](docs/workflow/app-worktree-registry.md):

- Copywriting Web: `apps/copywriting`, developed through `aim-web-agents-copywriting`, active app-scoped product lane, operational and Vercel-hosted.
- Photo AI Web: `apps/photo-ai`, developed through `aim-web-agents-photo-ai`, active app-scoped product lane.
- Appraisal Web: `apps/appraisal`, future app-scoped lane, planned after Copywriting and Photo AI unless orchestration changes the sequence.

Root-level tasks must not double up on app work already underway in app-scoped worktrees. The root project owns boundaries, shared architecture, sequencing, and integration planning unless app implementation work is explicitly requested.

## Relationship To Hub

`aim-web-agents` is not a replacement for AIM Hub.

AIM Hub remains the source of truth for identity, wallet, credits, user and team profile, properties, jobs, assets, ledger records, storage, sharing, timeline, and workspace state.

Web agents should generate, edit, and preview outputs. Durable records and cross-tool state should be saved through Hub-owned workflows.

## Current Scope

This root lane owns:

- repository instructions;
- architecture, workflow, and source-lift planning documentation;
- app worktree and lane registry;
- Hub and model-router boundary planning;
- shared package and design/system convention planning;
- cross-app consistency guardrails.

This planning lane does not approve:

- provider integrations;
- live API routes;
- Clerk;
- Stripe;
- OpenRouter;
- Hub save/retrieve integration;
- environment files;
- secrets.

## Secrets

Do not place secrets in this repository. Model provider keys, Hub credentials, Clerk secrets, OpenRouter keys, storage credentials, and deployment secrets must not be committed here.

## Documentation

Start with:

- `docs/architecture/web-agents-architecture.md`
- `docs/architecture/hub-boundary.md`
- `docs/architecture/web-agents-vs-hub-boundary.md`
- `docs/architecture/web-agent-risk-guardrails.md`
- `docs/workflow/web-agents-lane-status.md`
- `docs/workflow/app-worktree-registry.md`
- `docs/workflow/source-lift-and-import-sequence.md`
- `docs/workflow/copywriting-first-lane.md`
- `docs/workflow/backlog.md`
- `docs/source-of-truth/source-of-truth-sync-note.md`
- `docs/source-of-truth/web-agents-source-context.md`
- `docs/source-lift/web-agents-source-lift-plan.md`
- `docs/source-lift/app-source-inventory.md`
- `docs/source-lift/source-lift-pattern.md`
- `docs/source-lift/source-app-inventory.md`
