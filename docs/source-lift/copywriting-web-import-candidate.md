# Copywriting Web Import Candidate

Status: standalone frozen private-beta baseline until separately approved.

Target path:

```text
apps/copywriting
```

## Frozen Standalone Baseline

Copywriting Web is already complete as a frozen standalone private-beta baseline. Do not import, expand, or replace it in this repo unless a later task explicitly approves that work.

Record of current baseline:

- works outside AI Studio;
- runs through Vercel;
- has beta gate protection;
- uses server-side Gemini calls;
- has private-beta token and cost display;
- has been merged, tagged, and recorded;
- is not public yet;
- no new import, expansion, or maintenance is approved by this plan.

## Import Position

Copywriting Web may become the first real import candidate for `aim-web-agents`, but `WEBAGENTS-SOURCE-LIFT-PLAN-001` records it as frozen for now.

The import should prove that a real working web agent can live in this monorepo without prematurely turning the repo into a platform rewrite.

The Gemini/direct grounded research path must remain valid until an OpenRouter or Vercel AI SDK replacement is proven.

## Import Scope

The first import task should be a monorepo landing task only.

Allowed scope:

- import the frozen standalone Copywriting Web source into `apps/copywriting`;
- preserve baseline behavior;
- prove it runs from the monorepo location;
- document any path, package, or runtime adjustments required by the monorepo.

Blocked scope:

- Clerk;
- Hub integration;
- Stripe;
- Firebase;
- Cloudflare;
- OpenRouter;
- Vercel AI SDK;
- shared packages;
- production-domain work;
- auth;
- billing;
- new provider routes;
- database integration;
- environment files;
- secrets.

## Runtime Proof

After import, the next proof should be that Copywriting Web runs from `apps/copywriting` with the same private-beta baseline behavior. Any later integration work should be split into separate explicit tasks.

## Future Hub Relationship

Copywriting output may later become:

- copy asset;
- source/citation record;
- job record;
- timeline event;
- possible Asset Inbox item.

Hub integration is not approved by this document.
