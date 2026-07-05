# Web Agents Source Context

Status: local copied context only. `aim-docs` remains canonical.

## Product Model

The operating model is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Web Agents are professional AI production workstations. They help agents prepare campaign outputs from property memory, media, evidence, prompts, and review workflows.

## Ownership Boundary

`aim-web-agents` owns tool experiences.

AIM Hub owns the system of record.

Web Agents may generate, edit, review, preview, and prepare outputs. Hub stores durable property, job, asset, ledger, timeline, account, profile, workspace, and sharing records.

## Source-Lift Direction

The Web Agents monorepo should source-lift one app at a time and avoid building a giant shared root stack before each app is independently understood.

Current app-scoped product lanes are recorded in `docs/workflow/app-worktree-registry.md`.

Copywriting Web exists in `apps/copywriting`, is developed through `aim-web-agents-copywriting`, and is operational and Vercel-hosted.

Photo AI Web exists in `apps/photo-ai` and is developed through `aim-web-agents-photo-ai`.

Root `aim-web-agents` should not run Copywriting import/readiness work or Photo AI implementation work unless explicitly requested. Root work should focus on shared packages, Hub boundary, model-router boundary, app-lane registry, source-lift sequencing, integration strategy, and cross-app consistency.

Appraisal Web remains the next planned web-app lane after Copywriting and Photo AI unless orchestration changes the sequence. It requires careful risk handling before import or implementation.

## Avoided Mistake

The next public proof of `aim-web-agents` should not be Appraisal Web.

Appraisal is evidence-sensitive, attribution-sensitive, and valuation-adjacent. It can be mistaken for valuation advice if framed poorly. It must not rely on licensed Australian property data dependencies unless those permissions and contracts are explicit outside this repo, must not scrape portals, and must require human review.
