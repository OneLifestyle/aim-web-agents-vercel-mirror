# App Worktree Registry

Status: root-level app lane registry for `aim-web-agents`.

Canonical source of truth: `aim-docs`. If this repository conflicts with `aim-docs`, `aim-docs` wins.

## Root Ownership

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

Future root-level work should focus on shared packages, Hub boundary, model-router boundary, app-lane registry, source-lift sequencing, and integration strategy.

## App-Scoped Ownership

Focused Codex projects or worktrees own app-specific work for their lane, including:

- app UI;
- app logic;
- app-local docs;
- app-specific scripts;
- app-specific deployment or preview work;
- app-specific provider and use-case testing.

Root-level tasks must not double up on work already underway in app-scoped worktrees. App implementation should happen in the matching app-scoped lane unless a later root task explicitly requests otherwise.

## Registry

| App | Monorepo folder | Codex project/worktree | Status | Root responsibility |
| --- | --- | --- | --- | --- |
| Copywriting Web | `apps/copywriting` | `aim-web-agents-copywriting` | Active app-scoped product lane; operational and Vercel-hosted. | Boundary, shared architecture, and integration planning only. Root should not run Copywriting import or readiness work unless explicitly requested. |
| Photo AI Web | `apps/photo-ai` | `aim-web-agents-photo-ai` | Active app-scoped product lane. | Boundary, shared architecture, and integration planning only. Root should not run Photo AI implementation work unless explicitly requested. |
| Appraisal Web | `apps/appraisal` | Future app-scoped lane. | Planned next web-app lane after Copywriting and Photo AI unless orchestration changes the sequence. | Prepare guardrails and lane policy only. Keep private/internal first; no AVM, no portal scraping, and human review required. |
| Video Web | `apps/video` | `aim-web-agents-video` | Deterministic local client alpha built and internally verified; founder tap-through pending; not deployed or public-launch ready. | Root owns shared architecture and integration planning only. Video implementation belongs to the dedicated Video worktree. |

## Git Ownership

Git ownership remains with `aim-web-agents`.

Do not create permanent nested Git repositories inside `apps/*`. Final app code must land as ordinary tracked files in the root repository history, even when focused Codex projects or Git worktrees are used for app-scoped work.
