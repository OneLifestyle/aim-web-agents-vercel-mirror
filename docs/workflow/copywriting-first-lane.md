# Copywriting First Lane

Copywriting is the first intended app lane for `aim-web-agents`.

## Current Position

The existing Copywriting web app remains in its current repository for now and is already complete as a frozen standalone private-beta baseline.

Current baseline:

- works outside AI Studio;
- runs through Vercel;
- has beta gate protection;
- uses server-side Gemini calls;
- has private-beta token and cost display;
- has been merged, tagged, and recorded;
- is not public yet;
- is not yet imported into `aim-web-agents`.

Copywriting Web is the first likely import candidate into:

```text
apps/copywriting
```

Do not import it into `aim-web-agents` without an explicit import task.

Do not move it into AIM Hub during this lane.

## Workflow

1. Audit the existing Copywriting web app in its current repo.
2. Identify gaps, dependencies, deployment state, provider usage, and Hub integration assumptions.
3. Launch, freeze, and tag the existing app if appropriate.
4. Create an explicit import task before copying or moving code.
5. Import or copy into `apps/copywriting` only after that explicit task exists.
6. Prove the imported app runs from the monorepo location before expanding scope.

## Product Direction

Copywriting may become both:

- a standalone web product;
- a source lane for the future iOS Copywriting Agent.

The web implementation should remain useful as a web-first tool surface and as a reference for mobile agent behavior.

## Boundaries

The Copywriting lane should not duplicate Hub responsibilities. Durable outputs should flow back to Hub when integration exists.

The first import should be a monorepo landing task only. Do not use it to add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, environment files, or secrets.

The correct long-term pattern is:

```text
tool output -> save to Hub property -> Hub records job/asset/ledger/timeline -> other tools retrieve from Hub
```
