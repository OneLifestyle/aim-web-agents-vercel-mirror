# Web Agents Architecture

## Purpose

`aim-web-agents` is the future Real Estate AIM monorepo for web-based agent and tool surfaces. It exists for web-first interfaces, prototype lanes, source lanes, and reusable packages that support web agent experiences.

This repository is scaffold-only for `WEBAGENTS-001`.

## Relationship To aim-docs

`aim-docs` is the canonical planning and source-of-truth repository.

This repository may contain local copied context and implementation-facing notes, but those notes must remain subordinate to `aim-docs`. If any local document conflicts with `aim-docs`, `aim-docs` wins.

Completion reports and cross-repo planning updates should return to the Orchestrator and `aim-docs`.

## Relationship To aim-hub

`aim-web-agents` is not a replacement for AIM Hub.

AIM Hub owns durable workspace and business state, including identity, wallet, credits, profile, properties, jobs, assets, ledger records, storage, sharing, timeline, and workspace state.

Web agents should generate, edit, and preview outputs. They should save durable outcomes through Hub-owned integration patterns rather than becoming a second source of truth.

## Relationship To aim-mobile-agents

`aim-web-agents` mirrors the intent of `aim-mobile-agents` for web-based surfaces.

The mobile repo is for mobile-first agent experiences. This repo is for web-first agent experiences. Web-first interfaces may later inform mobile apps, including iOS agent implementations, but this repo should not own mobile app source.

## Relationship To Future aim-services

Future `aim-services` may own backend services, long-running workers, provider routing, secure model orchestration, and production service responsibilities.

`aim-web-agents` should not become the long-running backend worker layer or production model routing backend. It may contain clients and interface code that connect to service-owned APIs when those services exist.

## Expected Apps

Planned app folders:

- `apps/copywriting`
- `apps/appraisal`
- `apps/website`
- `apps/photo-ai`
- `apps/video`
- `apps/measure`

For `WEBAGENTS-001`, these folders are placeholders only.

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

## Copywriting First-Lane Plan

Copywriting is the first intended app lane.

The existing Copywriting web app remains in its current repository for now. The first step is an audit of the existing app and its readiness. If appropriate, the current app should be launched, frozen, and tagged before any import.

A later explicit import task may copy or move the Copywriting surface into `apps/copywriting`. It should not be moved into AIM Hub at this stage.

Copywriting may become both a standalone web product and a source lane for a future iOS Copywriting Agent.
