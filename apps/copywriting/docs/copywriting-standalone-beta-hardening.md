# Copywriting Standalone Beta Hardening

This repository remains the standalone React 19 + TypeScript + Vite Copywriting app. The beta hardening keeps the product flow intact while moving Gemini execution behind a server-side route.

## What changed

- Browser code now calls the same-origin `/api/copywriting` route.
- Gemini SDK usage and model prompts execute in `api/copywriting.ts`.
- Provider keys are read only from server-side environment variables.
- `vite.config.ts` no longer injects `GEMINI_API_KEY` into the browser bundle.
- `/api/copywriting` accepts only known operation names with structured payloads.
- The staged flow is preserved: address suggestions, research, strategy, feature extraction, image analysis, final copy, variants, refinement and chat remain separate requests.
- A compact review/trust notice appears in the app.

## Environment

Required for model calls:

- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`
- `GEMINI_FLASH_MODEL`

Optional fallback key name:

- `GOOGLE_GENERATIVE_AI_API_KEY`

Optional beta gate:

- `BETA_ACCESS_CODE`

Provider keys must not use `VITE_` names. `VITE_` variables are intentionally exposed to the browser by Vite and are not suitable for Gemini or other provider secrets.

Model names are server configuration. Set `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL` to currently supported Gemini model IDs in the deployment environment.

## Local development

Install dependencies:

```bash
npm install
```

Run the Vite-only UI:

```bash
npm run dev
```

Use Vercel's local runtime when testing `/api/copywriting` end to end:

```bash
vercel dev
```

If `BETA_ACCESS_CODE` is not configured locally, the API route allows requests without a beta code. If it is configured, the page-level gate verifies the code with `/api/copywriting` before rendering the main workspace. The verification operation does not call Gemini and stores only a beta session marker in `sessionStorage`.

## Build

```bash
npm run build
```

The Vite build verifies the static app bundle. Vercel compiles the `api/` serverless function during deployment or `vercel dev`.

## Server-side validation

The API route rejects unsupported methods, unknown operation names, oversized JSON payloads, unsupported image MIME types and images over 4 MB per request. It does not fetch arbitrary external URLs, add portal scraping or cache public property data.

## Abuse controls

The beta route has three layers:

- optional `BETA_ACCESS_CODE`;
- strict payload and image limits;
- best-effort in-memory throttling per beta code or IP.

The in-memory throttle is not durable across serverless instances. Before a wider public launch, add Vercel Deployment Protection, Vercel Firewall/rate limiting, or a durable usage ledger.

## Product behaviour

The current prompts remain server-side without intentional copywriting changes. Research, strategy, feature extraction, image analysis, final copy, variants, refinement and chat use `GEMINI_PRO_MODEL`. Address suggestions use `GEMINI_FLASH_MODEL`.

Remaining timeout risk: image analysis remains one image per API request and the client still processes images sequentially. Long research or large campaign generation batches can still hit provider or Vercel duration limits under load.

## Remaining blockers

- No durable auth, user accounts or Hub integration.
- No database-backed usage ledger.
- No durable rate limiting.
- No formal source policy, terms page or publication workflow.
- Gemini model names and grounding metadata may change.

## Post-beta hardening

- Add Clerk and Hub integration when this app is ready to join the main product surface.
- Add a durable usage ledger and per-user quotas.
- Add source review and claims-check workflow.
- Add broader legal/terms copy before public launch.
- Consider future OpenRouter/model-router migration after beta, without changing prompts blindly.
