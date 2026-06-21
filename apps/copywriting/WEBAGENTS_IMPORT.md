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
- `GOOGLE_GENERATIVE_AI_API_KEY`

## Known Next Steps

- `WEBAGENTS-COPYWRITING-RUNTIME-001`: install dependencies in the appropriate Web Agents workflow and run runtime proof.
- Decide whether package metadata should be adapted for monorepo workspace conventions.
- Review standalone deployment notes before any future Web Agents deployment work.

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
