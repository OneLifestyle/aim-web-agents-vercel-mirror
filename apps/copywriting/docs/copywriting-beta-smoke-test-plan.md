# Copywriting Web Beta Smoke Test Plan

Use this checklist for the Vercel preview deployment of branch `launch/copywriting-web-hardening`.

This is a smoke test, not a full real-property validation. Use dummy property facts unless a specific approved test listing is supplied.

## Safe Test Input

Example dummy property:

- Address: `12 Sample Street, Leongatha VIC 3953`
- Property type: `House`
- Beds: `4`
- Baths: `2`
- Cars: `2`
- Land size: `800`
- Features: `north-facing living area, renovated kitchen, covered alfresco, established garden, walk to shops`
- Target market: `Young Families`
- Writing style: `Professional`
- Word count: `180`

Use a small non-sensitive JPEG or PNG under 1 MB for image testing if practical.

## Page And Gate

- [ ] Preview page loads without a fatal render error.
- [ ] The beta access gate appears before the Copywriting tool is usable when `BETA_ACCESS_CODE` is configured.
- [ ] A wrong beta code is rejected.
- [ ] The correct beta code unlocks the workspace for the current tab session.
- [ ] The verification request does not make a Gemini/model call.
- [ ] Refreshing the tab preserves the beta session marker through `sessionStorage`.
- [ ] Clearing session storage causes the beta gate to appear again on the next page load.
- [ ] The product flow is the Copywriting tool, not a landing page or unrelated app.
- [ ] Legal/trust copy is visible in the app before publication/export decisions.

## Core Product Flow

- [ ] Address suggestions work if the operation is available in the UI.
- [ ] Basic listing-copy generation works from the safe dummy property facts.
- [ ] Grounded research works if enabled for the selected test flow.
- [ ] Image analysis works with a small safe test image if practical.
- [ ] Refinement works on generated copy with a short instruction.
- [ ] Chat works if available in the preview.
- [ ] Generated copy remains in the expected preview/editor flow.
- [ ] Generated copy includes enough review/caveat context in the surrounding UI for claims, source review, and publication responsibility.
- [ ] Output tabs and variant generation still match the existing product flow.

## API And Network

- [ ] Browser network calls go to same-origin `/api/copywriting`.
- [ ] Browser network calls do not go directly to Gemini or Google Generative AI endpoints.
- [ ] Requests include `x-beta-access-code` only after the user enters the beta code.
- [ ] Server returns `401` JSON for missing or invalid beta code when `BETA_ACCESS_CODE` is configured.
- [ ] Model operations still require valid beta credentials server-side.
- [ ] Server returns controlled JSON errors for unsupported methods or unsupported operations.
- [ ] The provider key is not visible in request headers, request payloads, responses, browser storage, or console output.
- [ ] The browser console has no obvious secret leakage or fatal application errors.
- [ ] The client bundle does not include provider secret values.

## Deployment Checks

- [ ] Vercel build uses framework preset `Vite`.
- [ ] Install command is `npm install`.
- [ ] Build command is `npm run build`.
- [ ] Output directory is `dist`.
- [ ] Vercel compiles `api/copywriting.ts` as a serverless API route.
- [ ] Preview environment has `GEMINI_API_KEY` configured.
- [ ] Preview environment has `GEMINI_PRO_MODEL` configured to a currently supported Gemini model ID.
- [ ] Preview environment has `GEMINI_FLASH_MODEL` configured to a currently supported Gemini model ID.
- [ ] Preview environment has `BETA_ACCESS_CODE` configured.
- [ ] `GOOGLE_GENERATIVE_AI_API_KEY` is configured only if intentionally using the supported fallback.
- [ ] No provider secret uses a `VITE_` name.
- [ ] Vercel Deployment Protection or equivalent access control is enabled before wider preview sharing.

## Pass Criteria

The preview passes smoke testing when:

- the page loads;
- the page-level beta gate rejects wrong or missing codes and accepts the configured code;
- at least one model-backed generation reaches the server-side route and returns usable copy;
- network traffic stays same-origin through `/api/copywriting`;
- no provider key or secret value is visible to the browser;
- the UI still presents the expected copywriting workflow and review responsibility context.

## Current Status

- Preview URL: pending
- Deployment protection: pending
- Beta gate smoke tested: pending
- Model route smoke tested: pending
- Production deployment: not created
- Production domain: not configured
