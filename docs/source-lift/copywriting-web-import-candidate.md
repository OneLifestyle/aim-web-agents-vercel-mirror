# Copywriting Web App-Scoped Lane

Status: active app-scoped product lane; operational and Vercel-hosted.

Folder:

```text
apps/copywriting
```

Codex project/worktree:

```text
aim-web-agents-copywriting
```

## Current Baseline

Copywriting Web exists in `apps/copywriting` and is developed through the `aim-web-agents-copywriting` app-scoped project/worktree. Do not run Copywriting import/readiness work or app implementation work from the root lane unless a later task explicitly approves that work.

Record of current baseline:

- works outside AI Studio;
- runs through Vercel;
- has beta gate protection;
- uses server-side Gemini calls;
- has private-beta token and cost display;
- has been merged, tagged, and recorded;
- is not public yet;
- no root-level import/readiness or app implementation work is approved by this plan.

## Root Position

Copywriting Web has moved out of pending root import-candidate status and into an active app-scoped product lane.

Root `aim-web-agents` owns boundary, shared architecture, and integration planning only unless an explicit task expands scope.

The Gemini/direct grounded research path must remain valid until an OpenRouter or Vercel AI SDK replacement is proven.

## Root Scope

Allowed root scope:

- maintain app-lane registry entries;
- document Hub boundaries;
- document model-router boundaries;
- plan shared architecture and shared package candidates;
- maintain cross-app consistency guardrails.

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

## Future Hub Relationship

Copywriting output may later become:

- copy asset;
- source/citation record;
- job record;
- timeline event;
- possible Asset Inbox item.

Hub integration is not approved by this document.
