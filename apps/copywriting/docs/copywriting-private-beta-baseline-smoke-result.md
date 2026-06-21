# Copywriting Private Beta Baseline Smoke Result

Date recorded: 2026-06-20

## Branch and Commit

- Implementation branch: `launch/copywriting-web-hardening`
- Target branch: `main`
- Commit tested: `5ed14c4` (`Fix Copywriting model routing and cost attribution`)
- Environment tested: Vercel Preview
- Preview URL: not supplied. The user tested the latest Vercel Preview opened from the GitHub Draft PR deployment attached to commit `5ed14c4`.

## Smoke Result Summary

User-provided non-secret smoke result:

- Page-level beta gate appeared before workspace access: passed.
- Correct beta code unlocked the app: passed.
- Address lookup: passed.
- Fetch Details: passed.
- Photo upload and analysis: passed with 10 uploaded photos.
- Generate Listing Copy: passed, with strong generated copy quality.
- Generate Missing Tabs / Generate All Variations: passed. The flow generated 17 campaign tabs, including coming soon, social media, events, blog, video script, just listed, brochure copy, email and flyer.
- Provider key exposure: no manual evidence found; local safe checks also found no real-looking secrets.
- Direct browser-to-Gemini call: no manual evidence found; local safe checks found Gemini calls routed through the server-side API.

## Build and Typecheck Result

- `npm run build`: passed on `launch/copywriting-web-hardening`.
- `npx tsc --noEmit`: passed on `launch/copywriting-web-hardening`.

## Cost Display Result

- Analysis Stream shows `Token-only est. cost`.
- Analysis Stream states that grounding/tool charges are not included.
- Current visible cost is token-only and is not billing-grade.
- Google Search, Maps grounding or other tool charges are not yet included in the displayed total.
- User-observed cost range:
  - about 5 cents USD token-only for listing copy with property research, copy context, property features and 10-photo analysis;
  - about 9 cents USD token-only after generating all 17 campaign variation tabs.

## Security and Client Provider Check Result

Local safe checks completed:

- No staged `.env` or `.env.local` files.
- No real-looking secrets matched by safe secret-pattern scan.
- No client-side `@google/genai` import in React app/client source.
- Current provider SDK import is in `api/copywriting.ts`.
- Provider key reads are server-side environment variable reads in `api/copywriting.ts`.
- Current provider calls remain server-side through the same-origin `/api/copywriting` API route.
- No `gemini-3-pro-preview` references found.
- Pricing exists for current configured model IDs in source, including `gemini-3.1-pro-preview`, `gemini-3-flash-preview` and `gemini-3.1-flash-lite`.
- Token-only cost wording is present.
- Grounding/tool charge exclusion wording is present.
- Photo analysis is routed and labelled as Flash tier.

## Photo Analysis Route

Photo analysis used `gemini-3-flash-preview` in the tested preview and displayed the label `configured Gemini Flash model`.

## Remaining Private-Beta Limitations

- This is a standalone private-beta baseline, not a public beta.
- This is not billing-grade.
- There is no durable usage ledger.
- There is no database-backed user, account, tenant, property or job cost attribution.
- The visible cost excludes Google Search, Maps grounding and other tool charges.
- Fetch Details should later be disabled until a valid address is selected or confirmed.
- Analysis Stream labels should later rename `AI Feature Extraction` to something like `Property Feature Analysis`, and `AI Strategy Analysis` to something like `Copy Context Analysis`.

## Future UX Backlog

- Add copy button for Visual Highlights / image analysis text.
- Add thumbnail-to-analysis linking between uploaded image thumbnails and Image 1/Image 2 analysis sections.
- Add per-image include/exclude controls for Visual Highlights.
- Add Select all / Select none controls for visual highlights.
- Add visible photo count such as `10 / 20 photos uploaded`.
- Add hard cap at 20 photos.
- Disable upload area after 20 photos.
- Add visible thumbnail labels matching the analysis labels.

## Future Telemetry Requirement

- Count Google Search grounding queries from Gemini `groundingMetadata.webSearchQueries` where available.
- Record source counts where `groundingChunks` is available.
- Distinguish token-only cost from grounding/tool cost.
- Later persist grounding/tool usage across users, accounts, tenants, properties and jobs.
- Eventually track project-wide monthly free grounding allowance usage.
- Eventually support admin-level monthly cost reconciliation after the free allowance is exhausted.

## Future Provider Research Requirement

Later compare Google grounding against Exa or other rights-safe search providers, without changing current provider routing now.
