# App-Scoped Source-Lift Worktrees

Status: workflow convention for focused source-lift, import, and app-scoped product lanes inside `aim-web-agents`.

Canonical source of truth: `aim-docs`. If this repository conflicts with `aim-docs`, `aim-docs` wins.

## Definition

An app-scoped source-lift worktree, import lane, or product lane is a focused Codex working lane for one Web Agent app under `apps/<agent>`.

The lane may inspect a source app, document its current state, prepare import readiness, implement app-specific work, and land explicitly approved files into the matching monorepo app folder. Its scope is one app at a time, plus the app-local docs, scripts, previews, and use-case testing needed for that app.

App-specific Codex projects or Git worktrees are allowed when they help isolate focused work on one app folder, such as:

- `apps/copywriting`
- `apps/photo-ai`
- `apps/appraisal`
- `apps/website`
- `apps/video`
- `apps/measure`

## Terms

Git fork:
A separate repository lineage, usually remote, used to diverge from or propose changes back to another repository. A fork is not the normal destination for final Web Agents app code.

Git worktree:
An additional checkout of this same repository, usually on a separate branch, sharing the same Git object database. A worktree can be useful for an app-scoped Codex lane, but final changes still belong to the root `aim-web-agents` repository history.

Source mine:
An existing app, spike, export, AI Studio project, v0 output, or older codebase used as input evidence for source-lift. A source mine is not automatically production code and must not be copied wholesale without an explicit import task.

Monorepo app folder:
The normal tracked destination for approved app code inside `aim-web-agents`, for example `apps/copywriting` or `apps/photo-ai`. Once imported, files are ordinary monorepo files owned by the root repository.

## Convention

Permanent nested Git repositories inside `apps/*` are not allowed.

Do not leave a durable `.git` directory inside an app folder. If a source app arrives with its own Git history, treat that source as a source mine or use a temporary external working location. The final import must remove nested repository metadata before landing files in this monorepo.

Final app code must be committed as ordinary files in the root `aim-web-agents` repository.

The root repo remains the orchestration layer. It owns Web Agents architecture, source-lift sequencing, shared package planning, shared design and system conventions, the app worktree and lane registry, root docs and guardrails, Hub boundary docs, model-router boundary docs, app import and source-lift policy, and cross-app consistency. Individual app lanes should not redefine the monorepo architecture or create direct app-to-app state sharing.

App-scoped projects own app UI, app logic, app-local docs, app-specific scripts, app-specific deployment or preview work, and app-specific provider or use-case testing.

Root-level tasks must not double up on work already underway in app-scoped worktrees.

Web Agents own tool experiences. AIM Hub owns the system of record.

## Current App Lanes

The app worktree registry is maintained in [App Worktree Registry](app-worktree-registry.md).

Current and planned lanes:

1. Copywriting Web: `apps/copywriting`, `aim-web-agents-copywriting`, active app-scoped product lane, operational and Vercel-hosted.
2. Photo AI Web: `apps/photo-ai`, `aim-web-agents-photo-ai`, active app-scoped product lane.
3. Appraisal Web: `apps/appraisal`, future app-scoped lane, planned after Copywriting and Photo AI unless orchestration changes the sequence.

The root `aim-web-agents` lane should not run Copywriting import/readiness work or Photo AI implementation work unless explicitly requested.

## Hub Boundary

AIM Hub owns identity, wallet, credits, profile, properties, jobs, assets, ledger, storage, sharing, timeline, and workspace state.

Web Agents may generate, edit, review, preview, export, and prepare outputs. Durable state should flow back through Hub-owned workflows. App-scoped source-lift lanes must not duplicate Hub-owned responsibilities or create direct app-to-app state sharing.
