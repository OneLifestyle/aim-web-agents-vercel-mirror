# Copywriting Preview Fix Plan

Date: 2026-06-11

## Blocker

The hardened Copywriting web branch cannot be merged or frozen because the
required Vercel preview smoke result was not supplied in the task payload.

The provided smoke result fields were blank:

- Vercel project name: Not provided
- Preview URL: Not provided
- Deployment protection enabled: Not provided
- Preview build passed: Not provided
- Beta gate passed: Not provided
- Model route passed: Not provided
- Direct Gemini browser call found: Not provided
- Provider key exposure found: Not provided
- Product behaviour looked unchanged: Not provided
- Issues found: Not provided

## Local Repo Checks Completed

- `npm run build`: passed
- `npx tsc --noEmit`: passed
- Client-side `@google/genai` imports: none found in app/client source
- Client model calls: same-origin `/api/copywriting`
- Provider key usage for model calls: server-side environment variables only
- Staged `.env` or `.env.local`: none

## Likely Cause

This is a release-readiness evidence gap, not a confirmed application failure.
The merge criteria require a clean Vercel preview smoke result before `main` can
be updated and tagged.

## Files Likely Affected

- `docs/copywriting-vercel-preview-smoke-result.md`
- Vercel preview deployment settings and runtime environment

No source-code files should be changed unless a rerun of the preview smoke test
identifies a concrete failure.

## Recommended Narrow Fix Task

Run the Vercel preview smoke test and provide the non-secret result fields:

- Vercel project name
- Preview URL
- Deployment protection enabled
- Preview build passed
- Beta gate passed
- Model route passed
- Direct Gemini browser call found
- Provider key exposure found
- Product behaviour looked unchanged
- Issues found

If every release gate passes, record the result in
`docs/copywriting-vercel-preview-smoke-result.md`, commit the doc, merge
`launch/copywriting-web-hardening` into `main`, push `main`, create
`copywriting-web-standalone-beta-hardened-2026-06-11`, and push the tag.
