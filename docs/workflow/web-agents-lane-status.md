# Web Agents Lane Status

Status: root-level planning, audit, and app-lane registry layer only.

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

## Current App-Scoped Lanes

Current app worktree ownership is recorded in [App Worktree Registry](app-worktree-registry.md).

| App | Folder | Codex project/worktree | Status | Root responsibility |
| --- | --- | --- | --- | --- |
| Copywriting Web | `apps/copywriting` | `aim-web-agents-copywriting` | Active app-scoped product lane; operational and Vercel-hosted. | Boundary, shared architecture, and integration planning only. |
| Photo AI Web | `apps/photo-ai` | `aim-web-agents-photo-ai` | Active app-scoped product lane. | Boundary, shared architecture, and integration planning only. |
| Appraisal Web | `apps/appraisal` | Future app-scoped lane. | Planned after Copywriting and Photo AI unless orchestration changes the sequence. | Private/internal lane policy and appraisal guardrails only until implementation is explicitly requested. |
| Video Web | apps/video | aim-web-agents-video | Active app-scoped source-recovery and implementation lane. Not yet public-launch ready. | Root owns shared architecture and integration planning only. Video implementation belongs to the dedicated Video worktree. |

Root-level tasks must not double up on work already underway in app-scoped worktrees. Do not run Copywriting import/readiness work or Photo AI implementation work from the root lane unless explicitly requested.

## Root Working Sequence

1. Maintain the app worktree and lane registry.
2. Keep Hub boundary, model-router boundary, source-lift policy, and cross-app consistency clear.
3. Plan shared packages and shared design/system conventions only when active app lanes prove the need.
4. Prepare the future Appraisal Web lane brief when requested, with private/internal guardrails first.
5. Keep Website and Measure sequencing documented for later lanes, while Video implementation remains in its dedicated active worktree.

## App-Scoped Lanes

Current app-specific lanes are:

1. Copywriting Web in `aim-web-agents-copywriting`.
2. Photo AI Web in `aim-web-agents-photo-ai`.
3. Appraisal Web as the next planned future app-scoped lane.
4. Video Web in `aim-web-agents-video`, with a provider-free recovery baseline and deterministic client-alpha next.

These lanes may use focused Codex projects or Git worktrees scoped to one `apps/<agent>` folder. Final app code must land as ordinary files in the root monorepo, with no permanent nested Git repositories inside `apps/*`.

See [App-Scoped Source-Lift Worktrees](app-scoped-source-lift-worktrees.md).

## Explicit Non-Goals

Do not import all existing web apps into `aim-web-agents` immediately.

Do not build a giant shared root stack first.

Do not use root-level work to duplicate Copywriting or Photo AI app-scoped implementation.

Do not use Copywriting, Photo AI, or Appraisal lane work to add Clerk, Hub, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, or secrets unless a later task explicitly approves that scope.

Do not implement provider routing or shared AIM model-router integration before each app has a cost and model-routing review.

Do not use Appraisal Web as a public or consumer-facing valuation product.

## Next Recommended Root Task

Create a shared boundary and integration strategy note for active app-scoped lanes. It should define shared package candidates, Hub handoff expectations, model-router boundaries, and cross-app design/system conventions without implementing app product code or provider integrations.
