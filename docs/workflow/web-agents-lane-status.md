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

Copywriting Web is the first likely import candidate for this monorepo. It is expected to land later in:

```text
apps/copywriting
```

Copywriting Web is already complete as a frozen standalone private-beta baseline. It is not yet imported into `aim-web-agents`.

Appraisal Web remains the next likely new source-lift candidate after Copywriting. It should not be the first proof of the Web Agents monorepo structure because it is evidence-sensitive and carries valuation-adjacent risk.

## Working Sequence

1. Copywriting Web import into `apps/copywriting`.
2. Copywriting Web runtime proof from the monorepo location.
3. Appraisal Web standalone source-mine audit and hardening.
4. Appraisal Web import later, only after risk guardrails and a frozen baseline.

## Explicit Non-Goals

Do not import all existing web apps into `aim-web-agents` immediately.

Do not build a giant shared root stack first.

Do not use the Copywriting import to add Clerk, Hub, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, or secrets.

Do not use Appraisal Web as the first proof of the monorepo shape.

## Next Recommended Task

Create the Copywriting Web monorepo landing task for `apps/copywriting`, limited to source import, local run proof, and documentation of any monorepo-specific adjustments. That task should not add new platform integrations or shared package abstractions.
