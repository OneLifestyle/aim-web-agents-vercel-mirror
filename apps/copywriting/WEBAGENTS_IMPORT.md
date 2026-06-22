# Copywriting Web Web Agents Import

## Source

- Source repo path: `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/copywriting-web-source`
- Source remote: `https://github.com/OneLifestyle/RE-AIM-Copywriter-Agent`
- Source branch: `main`
- Source commit: `88105194d6569cf9f38fe7dd7889491060c1cef1`
- Source tag: `copywriting-web-private-beta-baseline-2026-06-20`
- Archive path: `/Users/sgbcproperty/Developer/RealEstateAIM/_transfers/copywriting-web-frozen-before-webagents-import.tar.gz`
- Import date: `2026-06-21`

## Import Method

The Web Agents import used the frozen archive at the path above and extracted it directly into `apps/copywriting`.
The archive was inspected before extraction for nested Git metadata, dependency folders, build output, cache folders, local environment files, and Vercel local config.
After extraction, a whitespace-only cleanup removed trailing whitespace from imported text files so `git diff --check` passes in this repository.

This is a clean tracked-file snapshot from the frozen standalone baseline. The original standalone repo remains the frozen baseline and was not modified by this import.

## Secrets And Environment

Secret values were not imported. Local `.env` and `.env.local` files were not imported.

Required environment variable names:

- `BETA_ACCESS_CODE`
- `GEMINI_FLASH_MODEL`
- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`

Optional supported fallback environment variable name:

- `GOOGLE_GENERATIVE_AI_API_KEY`

## Known Next Steps

- `WEBAGENTS-COPYWRITING-RUNTIME-001`: install dependencies in the appropriate Web Agents workflow and run runtime proof.
- Decide whether package metadata should be adapted for monorepo workspace conventions.
- Review standalone deployment notes before any future Web Agents deployment work.

## Runtime Status

Status date: `2026-06-21`

- Package manager: `npm`
- Framework: Vite with React
- App package file: `apps/copywriting/package.json`
- Root workspace configuration: none present in `aim-web-agents` at runtime proof time
- Installed dependencies: yes, via `npm ci` from `apps/copywriting`
- Scripts found: `dev`, `build`, `preview`
- Scripts checked:
  - `npm run build`: passed
  - `npm run dev -- --host 127.0.0.1`: passed, served `http://127.0.0.1:3000/` with HTTP 200
  - `npm run preview -- --host 127.0.0.1`: passed, served `http://127.0.0.1:4173/` with HTTP 200 after local sandbox port binding was elevated
- Build status: passed; Vite output directory is `dist`
- Dev server status: passed locally without secret values for static app serving
- Known blockers: none for install, build, dev server, or preview server from `apps/copywriting`

Required environment variable names:

- `BETA_ACCESS_CODE`
- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`
- `GEMINI_FLASH_MODEL`

Optional supported fallback environment variable name:

- `GOOGLE_GENERATIVE_AI_API_KEY`

## Vercel Preview Recommendation

- Repository: `Singularealty/aim-web-agents`
- Root Directory: `apps/copywriting`
- Framework preset: Vite
- Install command: `npm ci`
- Build command: `npm run build`
- Output directory: `dist`
- Production domain: none for now
- Beta gate: keep enabled

Configure environment variables manually from the existing standalone Copywriting Vercel project in the Vercel dashboard. Do not commit values.

Required variable names to configure in Vercel:

- `BETA_ACCESS_CODE`
- `GEMINI_API_KEY`
- `GEMINI_PRO_MODEL`
- `GEMINI_FLASH_MODEL`

Optional supported fallback variable name:

- `GOOGLE_GENERATIVE_AI_API_KEY`

## Product QA Status

Status date: `2026-06-22`

- Goal: `WEBAGENTS-COPYWRITING-PRODUCT-QA-001`
- Review artifact: `docs/copywriting-product-qa-001.md`
- Runtime behavior changed: no
- Product code changed: no
- Current model routing summary: Flash for address suggestions, image analysis, feature extraction, refinement, chat and most variants; Pro for property research, AI Strategy Analysis, full listing copy, brochure copy and long-form/blog copy.
- Current cost display summary: Analysis Stream shows token-only estimates from provider usage metadata where available and explicitly excludes grounding/tool charges.
- Next recommended sprint: strategy-analysis reliability, campaign-mutating action concurrency guards, usage aggregation tests, Campaign Build Log direction, and export assembly helpers.

## Non-Goals

- No Clerk integration.
- No Hub integration.
- No Stripe integration.
- No OpenRouter integration.
- No Vercel AI SDK integration.
- No Firebase or Cloudflare integration.
- No database schema creation.
- No provider integration changes.
- No production deployment.
- No domain assignment.
