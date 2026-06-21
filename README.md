# AIM Web Agents

`aim-web-agents` is the future monorepo for Real Estate AIM web-based agent and tool surfaces.

Status: scaffold only. No product code has been created in this repository yet.

Current lane: `WEB AGENTS`

Canonical planning docs: `aim-docs`

If anything in this repository conflicts with `aim-docs`, `aim-docs` wins.

## Purpose

This repository is intended for web-first agent surfaces, prototype lanes, and reusable web agent packages. It is expected to hold future web tools such as Copywriting, Appraisal, Website Agent, Photo AI, Video, Measure, and related web-first interfaces.

The first intended app lane is Copywriting.

Copywriting Web is the first likely import candidate into `apps/copywriting`. Appraisal Web is the first likely new source-lift candidate after Copywriting, but it should not be the first proof of the monorepo structure.

## Relationship To Hub

`aim-web-agents` is not a replacement for AIM Hub.

AIM Hub remains the source of truth for identity, wallet, credits, user and team profile, properties, jobs, assets, ledger records, storage, sharing, timeline, and workspace state.

Web agents should generate, edit, and preview outputs. Durable records and cross-tool state should be saved through Hub-owned workflows.

## Current Scope

This repository currently contains:

- repository instructions;
- placeholder app folders;
- placeholder package folders;
- architecture, workflow, and source-lift planning documentation.

This repository currently does not contain:

- product application code;
- a Next.js app;
- package dependencies;
- provider integrations;
- API routes;
- environment files;
- secrets.

## Secrets

Do not place secrets in this repository. Model provider keys, Hub credentials, Clerk secrets, OpenRouter keys, storage credentials, and deployment secrets must not be committed here.

## Documentation

Start with:

- `docs/architecture/web-agents-architecture.md`
- `docs/architecture/hub-boundary.md`
- `docs/workflow/web-agents-lane-status.md`
- `docs/workflow/source-lift-and-import-sequence.md`
- `docs/workflow/copywriting-first-lane.md`
- `docs/workflow/backlog.md`
- `docs/source-of-truth/source-of-truth-sync-note.md`
- `docs/source-of-truth/web-agents-source-context.md`
- `docs/source-lift/source-lift-pattern.md`
- `docs/source-lift/source-app-inventory.md`
