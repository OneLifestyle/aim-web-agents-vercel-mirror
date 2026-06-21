# Copywriting Web Vercel Preview Setup Handoff

This handoff covers the controlled beta preview for the standalone Copywriting web app on branch `launch/copywriting-web-hardening`.

Do not merge this branch to `main`, configure the production domain, or share an unrestricted public deployment until the preview smoke test passes and deployment protection is enabled.

## Repository

- GitHub repo: `OneLifestyle/RE-AIM-Copywriter-Agent`
- Branch to deploy: `launch/copywriting-web-hardening`
- Recommended Vercel project name: `re-aim-copywriter-agent-beta`
- Future production domain: `copywriting.realestateaim.com`
- Current task target: Vercel Preview URL only

## Project Import

1. In Vercel, import the GitHub repository `OneLifestyle/RE-AIM-Copywriter-Agent`.
2. Select the project root as the repository root.
3. Keep the preview deployment tied to `launch/copywriting-web-hardening`.
4. Do not configure `copywriting.realestateaim.com` until the preview smoke test passes.
5. Do not create or promote a production deployment during this setup task.

## Build Settings

- Framework preset: `Vite`
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Serverless API route: `api/copywriting.ts`

No `vercel.json` is currently required for this Vite app plus Vercel Functions layout.

## Environment Variables

Configure these by name only in Vercel Project Settings.

Required for model calls:

- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`
- `GEMINI_FLASH_MODEL`

Required for beta access:

- `BETA_ACCESS_CODE`

Supported fallback provider key name:

- `GOOGLE_GENERATIVE_AI_API_KEY`

Do not configure provider keys with `VITE_` names. Vite exposes `VITE_*` values to the browser bundle.

## Environment Scope

Preview environment:

- Set `GEMINI_API_KEY`.
- Set `GEMINI_PRO_MODEL` to a currently supported Gemini model ID for reasoning, image and grounded research operations.
- Set `GEMINI_FLASH_MODEL` to a currently supported Gemini model ID for address suggestions.
- Set `BETA_ACCESS_CODE`.
- Optionally set `GOOGLE_GENERATIVE_AI_API_KEY` only if using the supported fallback instead of `GEMINI_API_KEY`.
- Enable deployment protection or equivalent access control before sharing the preview outside the immediate beta testers.

Production environment:

- Prepare the same variable names, but do not deploy or promote production for this task.
- Do not attach `copywriting.realestateaim.com` until preview smoke testing passes.
- Recheck protection, rate limiting, trust/legal copy, and launch approval before production exposure.

## Access Control

Before sharing the preview widely:

- Enable Vercel Deployment Protection for preview deployments, or an equivalent Vercel access-control option.
- Keep the in-app `BETA_ACCESS_CODE` gate enabled.
- Share the preview URL only with intended beta testers.
- Do not publish the URL in public channels.

The app's beta code is a launch gate, not durable authentication. It should be replaced or supplemented later by product auth and a usage ledger.

## Deploy Preview

After project import, env vars, and deployment protection are configured:

1. Trigger a preview deployment for `launch/copywriting-web-hardening`.
2. Confirm Vercel builds the `dist` output.
3. Confirm Vercel compiles the `api/copywriting.ts` serverless function.
4. Record the preview URL in the launch tracker.
5. Run `docs/copywriting-beta-smoke-test-plan.md`.

## Current Local CLI Status

The local repository is not linked to a Vercel project because `.vercel/project.json` is absent. Do not guess the team or project name from the CLI. Link/import the project manually through Vercel, then rerun the CLI checks if a CLI-based preview deployment is still desired.

## Preview Record

- Preview URL: pending
- Deployment protection enabled: pending
- Preview smoke test completed: pending
- Production domain configured: no
- Production deployment created: no
