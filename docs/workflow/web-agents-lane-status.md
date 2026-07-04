# Web Agents Lane Status

Status: planning and audit layer only.

Canonical source of truth: `aim-docs`. If this repository conflicts with `aim-docs`, `aim-docs` wins.

## Strategic Position

The current product architecture is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Web Agents are professional AI production workstations. They are not Hub.

`aim-web-agents` owns tool experiences for web-first production work. AIM Hub owns the system of record.

## Hub Boundary

AIM Hub owns:

- identity;
- wallet;
- credits;
- profile;
- properties;
- jobs;
- assets;
- ledger;
- storage;
- sharing;
- timeline;
- workspace state.

Web Agents may create, edit, review, preview, or prepare assets. Durable property, job, asset, ledger, timeline, account, and workspace records must flow back through Hub-owned workflows.

## Current Baseline

Copywriting Web is already operational as a standalone private-beta baseline and remains frozen until a separate task approves import or maintenance. Its future import target is likely:

```text
apps/copywriting
```

Do not import or expand Copywriting Web in this repo without an explicit task.

Photo Web is the current likely next source-lift candidate because AI photo upgrades, batch production, before/after review, and output-integrity workflows are more natural on web than on the initial mobile Photo Agent.

Appraisal Web remains a strong source-lift candidate after or alongside Photo Web. It should stay private/internal first because it is evidence-sensitive and carries valuation-adjacent risk.

## Working Sequence

1. Keep Copywriting Web frozen as the standalone private-beta baseline until separately approved.
2. Source-mine Photo Web as the likely next AI upgrade and batch-production workstation.
3. Source-mine Appraisal Web after or alongside Photo Web, private/internal first.
4. Source-mine Website Web as the web-first property site builder.
5. Source-mine Video Web later from existing web source and old Vision Ken Burns source.
6. Source-mine Measure Web last as editing, cleanup, report/export, and Hub packaging after mobile capture.

## App-Scoped Lanes

The next app-specific lanes are:

1. Copywriting app-scoped import/readiness lane.
2. Photo AI source-lift lane.
3. Appraisal source-lift lane after or alongside Photo AI.

These lanes may use focused Codex projects or Git worktrees scoped to one `apps/<agent>` folder. Final app code must land as ordinary files in the root monorepo, with no permanent nested Git repositories inside `apps/*`.

See [App-Scoped Source-Lift Worktrees](app-scoped-source-lift-worktrees.md).

## Explicit Non-Goals

Do not import all existing web apps into `aim-web-agents` immediately.

Do not build a giant shared root stack first.

Do not use the Copywriting import to add Clerk, Hub, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, or secrets.

Do not implement provider routing or shared AIM model-router integration before each app has a cost and model-routing review.

Do not use Appraisal Web as a public or consumer-facing valuation product.

## Next Recommended Task

Create the Photo Web source-mine and workstation-planning task. It should identify the source location, current working state, batch-production needs, before/after review model, output-integrity guardrails, provider benchmark candidates, and private-beta hardening path. It should not implement provider routing or import source without explicit approval.
