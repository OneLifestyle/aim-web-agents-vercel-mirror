# AIM Web Agents

`aim-web-agents` is the future monorepo for Real Estate AIM web-based agent and tool surfaces.

Status: source-lift planning and web-agent workstation lane. Product code, provider integrations, environment files, and shared platform abstractions should be added only through explicit scoped tasks.

Current lane: `WEB AGENTS`

Canonical planning docs: `aim-docs`

If anything in this repository conflicts with `aim-docs`, `aim-docs` wins.

## Purpose

This repository is intended for web-first production workstations, prototype lanes, source-lift planning, and reusable web agent packages. It is expected to hold future web tools such as Copywriting, Photo, Appraisal, Website, Video, Measure, and related web-first interfaces.

The operating model is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Copywriting Web is already operational as a standalone private-beta baseline and remains frozen until a separate task approves import or maintenance. Photo Web is the current likely next source-lift candidate for AI upgrade and batch-production workstation planning. Appraisal Web remains a strong candidate, but should stay private/internal first with strict evidence and appraisal guardrails.

## Relationship To Hub

`aim-web-agents` is not a replacement for AIM Hub.

AIM Hub remains the source of truth for identity, wallet, credits, user and team profile, properties, jobs, assets, ledger records, storage, sharing, timeline, and workspace state.

Web agents should generate, edit, and preview outputs. Durable records and cross-tool state should be saved through Hub-owned workflows.

## Current Scope

This repository currently contains:

- repository instructions;
- architecture, workflow, and source-lift planning documentation.

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
- `docs/workflow/source-lift-and-import-sequence.md`
- `docs/workflow/copywriting-first-lane.md`
- `docs/workflow/backlog.md`
- `docs/source-of-truth/source-of-truth-sync-note.md`
- `docs/source-of-truth/web-agents-source-context.md`
- `docs/source-lift/web-agents-source-lift-plan.md`
- `docs/source-lift/app-source-inventory.md`
- `docs/source-lift/source-lift-pattern.md`
- `docs/source-lift/source-app-inventory.md`
