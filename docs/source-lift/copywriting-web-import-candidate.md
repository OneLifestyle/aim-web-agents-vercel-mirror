# Copywriting Web Import Candidate

Status: first likely import candidate.

Target path:

```text
apps/copywriting
```

## Frozen Standalone Baseline

Copywriting Web is already complete as a frozen standalone private-beta baseline.

Record of current baseline:

- works outside AI Studio;
- runs through Vercel;
- has beta gate protection;
- uses server-side Gemini calls;
- has private-beta token and cost display;
- has been merged, tagged, and recorded;
- is not public yet;
- is not yet imported into `aim-web-agents`.

## Import Position

Copywriting Web should become the first real import candidate for `aim-web-agents`.

The import should prove that a real working web agent can live in this monorepo without prematurely turning the repo into a platform rewrite.

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
