# Proposed Shared Packages

These packages are planned only and not implemented in `WEBAGENTS-001`.

## ui

Status: planned only / not implemented in `WEBAGENTS-001`

Shared web UI components for agent tool surfaces.

## design-tokens

Status: planned only / not implemented in `WEBAGENTS-001`

Shared design tokens for web-agent surfaces, including color, spacing, typography, radius, and other interface primitives.

## auth-client

Status: planned only / not implemented in `WEBAGENTS-001`

Future client package for auth-facing web integration. It must not own identity source of truth.

## hub-client

Status: planned only / not implemented in `WEBAGENTS-001`

Future client package for connecting web agents to Hub-owned APIs and durable records.

## model-router-client

Status: planned only / not implemented in `WEBAGENTS-001`

Future client package for model routing APIs. It must not contain provider secrets or become the production routing backend.

## prompt-kits

Status: planned only / not implemented in `WEBAGENTS-001`

Shared prompt structures, prompt templates, evaluation notes, and task-specific agent prompt kits.

## retrieval

Status: planned only / not implemented in `WEBAGENTS-001`

Future retrieval helpers and client-side retrieval interface utilities where appropriate.

## env

Status: planned only / not implemented in `WEBAGENTS-001`

Future typed environment access helpers. This package must not introduce committed environment files or secrets.

## analytics

Status: planned only / not implemented in `WEBAGENTS-001`

Future analytics client helpers for web-agent events and product telemetry. It must not become the source of truth for Hub ledger, jobs, assets, or workspace state.
