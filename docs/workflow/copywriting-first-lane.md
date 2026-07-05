# Copywriting First Lane

Copywriting is the first active app-scoped product lane for `aim-web-agents`.

## Current Position

Copywriting Web exists in `apps/copywriting` and is developed through the `aim-web-agents-copywriting` app-scoped project/worktree.

Status: active app-scoped product lane; operational and Vercel-hosted.

Current baseline:

- works outside AI Studio;
- runs through Vercel;
- has beta gate protection;
- uses server-side Gemini calls;
- has private-beta token and cost display;
- has been merged, tagged, and recorded;
- is not public yet;
- no root-level import/readiness or app implementation work is approved by this plan.

Root `aim-web-agents` should not run Copywriting import/readiness work unless explicitly requested.

Do not expand any repo-local Copywriting material from the root lane without an explicit task.

Do not move it into AIM Hub during this lane.

Keep the Gemini/direct grounded research path valid until an OpenRouter or Vercel AI SDK replacement is proven.

## Workflow

1. Keep Copywriting app UI, app logic, app-local docs, app-specific scripts, preview/deployment work, and provider/use-case testing in `aim-web-agents-copywriting`.
2. Keep root `aim-web-agents` focused on boundary, shared architecture, and integration planning only.
3. Preserve the Hub boundary and do not duplicate Hub-owned durable state.
4. Keep model-router and provider-routing boundaries documented without implementing them from the root lane.
5. Create an explicit root task before doing any Copywriting import/readiness or app implementation work from this lane.

## Product Direction

Copywriting may become both:

- a standalone web product;
- a source lane for the future iOS Copywriting Agent.

The web implementation should remain useful as a web-first tool surface and as a reference for mobile agent behavior.

## Boundaries

The Copywriting lane should not duplicate Hub responsibilities. Durable outputs should flow back to Hub when integration exists.

Do not use Copywriting work to add Clerk, Hub integration, Stripe, Firebase, Cloudflare, OpenRouter, Vercel AI SDK, shared packages, production-domain work, auth, billing, provider routes, database integration, environment files, or secrets unless a later task explicitly approves that scope.

The correct long-term pattern is:

```text
tool output -> save to Hub property -> Hub records job/asset/ledger/timeline -> other tools retrieve from Hub
```

Future Hub records may include copy assets, source/citation records, job records, timeline events, and possibly Asset Inbox items.
