# Copywriting First Lane

Copywriting is the first intended app lane for `aim-web-agents`.

## Current Position

The existing Copywriting web app remains in its current repository for now.

Do not import it into `aim-web-agents` during `WEBAGENTS-001`.

Do not move it into AIM Hub during this lane.

## Workflow

1. Audit the existing Copywriting web app in its current repo.
2. Identify gaps, dependencies, deployment state, provider usage, and Hub integration assumptions.
3. Launch, freeze, and tag the existing app if appropriate.
4. Create an explicit future import task before copying or moving code.
5. Import or copy into `apps/copywriting` only after that explicit task exists.

## Product Direction

Copywriting may become both:

- a standalone web product;
- a source lane for the future iOS Copywriting Agent.

The web implementation should remain useful as a web-first tool surface and as a reference for mobile agent behavior.

## Boundaries

The Copywriting lane should not duplicate Hub responsibilities. Durable outputs should flow back to Hub when integration exists.

The correct long-term pattern is:

```text
tool output -> save to Hub property -> Hub records job/asset/ledger/timeline -> other tools retrieve from Hub
```
