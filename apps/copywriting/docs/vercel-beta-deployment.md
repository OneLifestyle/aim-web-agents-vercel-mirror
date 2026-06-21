# Vercel Beta Deployment Notes

Target future domain: `copywriting.realestateaim.com`.

This task prepares the repository only. It does not deploy or configure the domain.

## Project settings

- Framework preset: Vite.
- Install command: `npm install`.
- Build command: `npm run build`.
- Output directory: `dist`.
- API route: `api/copywriting.ts`.

No `vercel.json` is required for the current Vite + Vercel Functions layout.

## Required environment variables

Set these in Vercel Project Settings for Preview and Production:

- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`
- `GEMINI_FLASH_MODEL`
- `BETA_ACCESS_CODE`

Optional fallback:

- `GOOGLE_GENERATIVE_AI_API_KEY`

Do not configure Gemini provider secrets as `VITE_*`. Vite exposes `VITE_*` values to browser JavaScript.

`GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL` must be set to currently supported Gemini model IDs in Vercel. The serverless route reads these names only from server-side environment variables so model upgrades can happen without a code change.

## Beta gate behaviour

When `BETA_ACCESS_CODE` is configured, `/api/copywriting` requires beta verification before the main app is usable. The client verifies the entered code through a lightweight same-origin operation that does not call Gemini, then stores only a beta session marker in `sessionStorage` for the tab session. Model operations still send the beta session marker in `x-beta-access-code` and the server rejects missing or invalid credentials.

When `BETA_ACCESS_CODE` is absent, the API route does not require a beta code. That is acceptable for local development only.

## Local API testing

Use Vercel's runtime for the serverless route:

```bash
vercel dev
```

The plain Vite dev server is still useful for UI work, but it does not run Vercel serverless functions.

## Wider launch requirements

Before a broad public launch, add:

- Vercel Deployment Protection for preview environments;
- Vercel Firewall or an external durable rate limiter;
- durable auth, ideally future Clerk/Hub integration;
- usage ledger and cost controls;
- formal legal/trust copy and source review workflow;
- monitoring for provider errors, latency and timeout rates.

## Future migration notes

OpenRouter or an AIM-owned model router can be introduced after beta if the product needs provider routing, fallback models, observability or central cost controls. That migration should preserve the current operation-specific API shape and avoid exposing arbitrary prompt endpoints.
