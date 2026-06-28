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

## Reliability And Export UX Status

Status date: `2026-06-22`

- Goal: `WEBAGENTS-COPYWRITING-RELIABILITY-EXPORT-UX-001`
- Review artifact: `docs/reliability-export-ux-001.md`
- Export contract artifact: `docs/export-assembly-contract.md`
- Runtime behavior changed: yes
- Product code changed: yes
- AI Strategy Analysis model changed: no. It remains on the server-configured Gemini Pro model.
- Image analysis model changed: no. It remains on the server-configured Gemini Flash model.
- Current reliability summary: strategy JSON is parsed robustly, validated by shape, repaired once on malformed/invalid output, and never applied on invalid final output.
- Current concurrency summary: campaign-mutating actions are guarded so one protected operation can run at a time; chat and address suggestions remain independent.
- Current build log summary: the visible shell is now `Campaign Build Log`, with plain-language labels and technical beta details retained.
- Current export summary: selected-section download and full-campaign document download are labelled separately; full campaign still exports one combined document and does not create a ZIP.
- Future recommended sprint: single-column Campaign Outputs layout direction, export assembly tests, usage aggregation tests, and staged ZIP export if a packaging dependency or endpoint is approved.

## Campaign Outputs UX Status

Status date: `2026-06-23`

- Goal: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-001`
- Review artifact: `docs/campaign-outputs-ux-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current output summary: the former generated-output `Preview` panel is now a `Campaign Outputs` workspace with section navigation, ready/missing/generating/needs-generation states, selected-section description, clearer refine controls, and separated current-section versus full-campaign download actions.
- Current action summary: active campaign operations now appear as clearer status chips in the top status strip.
- Current export summary: selected-section and full-campaign document exports are preserved; ZIP export remains deferred.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Campaign Outputs UX 002 Status

Status date: `2026-06-23`

- Goal: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-002`
- Review artifact: `docs/campaign-outputs-ux-002.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current output summary: Campaign Outputs now has an All/category filter that controls the tile grid, larger wrap-grid navigation, clearer current output/current category/full campaign terminology, and a grouped output action panel.
- Current duplicate-output summary: the single `Open House` output item is now owned by Events only; the Social Media duplicate mapping was removed.
- Current edit/refine summary: generated outputs are read-only by default, local editing is explicit, and free-form refine is demoted behind `Advanced refine (beta)` with user-content risk documented.
- Current status/activity summary: Campaign Status now shows compact stage chips, and affected panels show lightweight activity states during research, analysis, image, output generation, refine and export work.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Campaign Outputs UX 003 Status

Status date: `2026-06-23`

- Goal: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-003`
- Review artifact: `docs/campaign-outputs-ux-003.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current action summary: current-output actions now sit in the selected output card header, category download sits beside the selected category summary, and full-campaign actions sit in the Campaign Outputs summary.
- Current generation summary: missing outputs can be generated from the selected output card, and additional clicked missing outputs queue safely behind the active output mutation.
- Current activity summary: Copy Context and Property Features keep affected-card active styling while the button itself owns the only visible `Analyzing...` state.
- Current layout summary: the desktop workspace uses a wider max width and safer `xl` three-column breakpoints, with lightweight Campaign Status scroll anchors.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Campaign Outputs UX 005 Status

Status date: `2026-06-25`

- Goal: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-005`
- Review artifact: `docs/campaign-outputs-ux-005.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current output summary: the `Contact card` control now sits inside the selected output card as a compact checkbox above the generated copy area, preserving the existing append/remove behavior while making the control feel tied to the selected output.
- Current action summary: current-output controls remain below the selected output body, now ordered as `Edit`, `Copy`, `Download`, and `Save`, with `Refine beta` kept available as a secondary action.
- Current helper summary: the lower support copy was shortened to preserve the read-only-by-default model without turning the footer into a second workspace.
- Current export summary: `Download current category` and `Download campaign` remain on their existing behavior. A future selected-generated-output download model is deferred.
- Deferred product decision: later design work should decide whether campaign export should become a selected-output model, whether V1 should bias harder toward a simple appliance-like workflow, and how Hub retrieval, prior jobs, timeline state, and asset-based re-entry should affect export semantics.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## V1 Output Simplification 001 Status

Status date: `2026-06-25`

- Goal: `WEBAGENTS-COPYWRITING-V1-OUTPUT-SIMPLIFICATION-001`
- Review artifact: `docs/v1-output-simplification-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current output summary: generated Campaign Outputs are read-only by design in the primary v1 UI. The selected output renders as review text rather than an editable generated-output textarea.
- Current action summary: `Edit local copy`, `Advanced refine beta`, `Run refine`, `Save local timeline`, and the local timeline viewer are no longer reachable from the primary UI. The selected output keeps `Copy`, `Download`, and the `Contact card` checkbox.
- Current guidance summary: the output footer now tells users to update property details, features, audience or style and regenerate, then copy/download drafts for final editing outside Real Estate AIM.
- Current refine summary: the dormant `refineCopy` API validates the old payload shape but returns a v1-unavailable response before any provider call.
- Current generation summary: Generate Listing Copy, Generate missing outputs, queued missing-output generation, on-demand missing output generation, category filters, output tiles, status chips, Campaign Build Log, current category download, and campaign download remain on existing paths.
- Deferred product decision: post-generation editing, advanced refine/chat-style editing, Canvas-style focus mode, Hub-based asset retrieval/re-entry, selected-output export bundles, provenance/versioning, and review/approval workflow are deferred to later v2/export-pack work.
- Current model routing summary: unchanged for required routes. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Export Pack 001 Status

Status date: `2026-06-25`

- Goal: `WEBAGENTS-COPYWRITING-EXPORT-PACK-001`
- Review artifact: `docs/export-pack-001.md`
- Export contract artifact: `docs/export-assembly-contract.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current export summary: current output, current category, and campaign document exports now use distinct export-pack documents, consistent safe filenames, and an internal manifest for future ZIP and Hub asset contract work.
- Generated-only download rule: download actions export generated outputs only and do not silently generate missing outputs. `Generate missing` remains the separate generation action.
- Current manifest summary: the internal manifest records export scope, file-safe slug, timestamp, app metadata, property/address summary, selected category/output, included and missing output ids, contact-card inclusion, input snapshot summary, usage/cost summary, and Campaign Build Log summary where available.
- Deferred product decision: ZIP export, manifest file download, PDF/DOCX generation, Hub asset persistence, live Hub save/sync, auth, billing, and provider-router work remain deferred.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Beta Presentation 001 Status

Status date: `2026-06-26`

- Goal: `WEBAGENTS-COPYWRITING-BETA-PRESENTATION-001`
- Review artifact: `docs/beta-presentation-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current presentation summary: private-beta framing, generated-draft review wording, plain-language progress, tester feedback guidance, and a collapsed-by-default `Beta diagnostics` presentation were added.
- Current build log summary: Campaign Build Log remains available through `Show build log`; model, token, cost, usage, grounding/tool-charge caveats, input/output summaries, and errors remain inspectable when expanded.

## Hub Style Design Polish 001 Status

Status date: `2026-06-27`

- Goal: `WEBAGENTS-COPYWRITING-HUB-STYLE-DESIGN-POLISH-001`
- Review artifact: `docs/hub-style-design-polish-001.md`
- Runtime behavior changed: no intended workflow change; visual styling changed in `App.tsx`.
- Product code changed: yes.
- Dependencies changed: no.
- Current visual summary: the workspace now uses lightweight local `aimUi` class tokens for page shell, cards, sections, controls, buttons and chips; AIM red is concentrated on generation actions and brand accents; Brief Builder, Output Workspace, Campaign Library, Visual Highlights, beta diagnostics and the generated-draft warning received calmer Hub-adjacent visual treatment.
- Current preservation summary: Brief Builder / Output Workspace split, compact density, collapsible Property Overview and Suburb & Area Profile, summary-first Visual Highlights, generated-only exports, read-only outputs, collapsed Beta diagnostics, floating assistant disabled state, and removed floating Generate Listing Copy button are preserved.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and Image Analysis remains on the server-configured Gemini Flash model.
- Current export summary: generated-only current-output, current-category, and campaign downloads remain on existing handlers and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Offer Architecture 001 Status

Status date: `2026-06-26`

- Goal: `WEBAGENTS-COPYWRITING-OFFER-ARCHITECTURE-001`
- Review artifact: `docs/offer-architecture-001.md`
- Runtime behavior changed: no
- Product code changed: no
- Current dependency summary: `Full Copy` remains the master listing narrative; the approved property brief remains the factual source; the 16 downstream campaign outputs are channel-specific adaptations of both.
- Current offer recommendation: connected beta should frame Copywriting around Listing Copy, Campaign Pack, and Campaign Blueprint, with Campaign Pack labelled `Recommended` or `Best value` rather than `Most popular`.
- Current UI implication: keep the 17-output tile grid as a post-generation review navigator, not the primary pre-generation chooser.
- Current credit summary: Listing Copy 1 beta credit, Campaign Pack 2 beta credits, and Campaign Blueprint 8 to 10 beta credits are documented as testing hypotheses only, not final public pricing or billing logic.
- Current regeneration summary: future stale-state rules should use an `inputFingerprint`, distinguish failed-operation retry from regeneration after changed inputs, and label same-input alternatives as `Create another version`.
- Current Hub summary: future Hub assets are documented at contract level only. No Hub sync, auth, wallet, ledger, asset storage, or timeline implementation was added.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Chat Assistant Disabled 001 Status

Status date: `2026-06-26`

- Goal: `WEBAGENTS-COPYWRITING-CHAT-ASSISTANT-DISABLE-001`
- Review artifact: `docs/chat-assistant-disabled-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current assistant summary: the bottom-right floating `AI Assistant` is no longer mounted from the primary Copywriting UI, so the chat panel is unreachable for private-beta testers.
- Deferred assistant summary: a future contextual Copywriting screen guide, beta help widget, AIM Hub contextual assistant, or AIM Command helper is documented as deferred only.
- Deferred export/settings summary: Save with settings, input/settings snapshots, export metadata appendices, research-block copy controls, and future Hub asset audit-trail snapshots are documented as deferred only.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Offer UI 001 Status

Status date: `2026-06-27`

- Goal: `WEBAGENTS-COPYWRITING-OFFER-UI-001`
- Review artifact: `docs/offer-ui-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current offer summary: Campaign Outputs now leads with Listing Copy, Campaign Pack, and planned-only Campaign Blueprint offers.
- Current listing summary: the internal master output remains `Full Copy`, while user-facing UI and export titles prefer `Listing Copy` where safe.
- Current campaign pack summary: Campaign Pack wraps the existing downstream missing-output generation flow, skips already-generated downstream outputs, and does not regenerate Listing Copy.
- Current library summary: the 17-output tile grid remains available as Campaign Library review navigation rather than the primary pre-generation chooser.
- Current blueprint summary: Campaign Blueprint is visible as planned beta only and cannot trigger generation.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Brief Output Workspace 001 Status

Status date: `2026-06-27`

- Goal: `WEBAGENTS-COPYWRITING-BRIEF-OUTPUT-WORKSPACE-001`
- Review artifact: `docs/brief-output-workspace-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current layout summary: the workspace is now explicitly split into `Brief Builder` for property facts, fetched-property review, audience/context, features and photos, and `Output Workspace` for Listing Copy, Campaign Pack, Campaign Blueprint, Campaign Library, output review and downloads.
- Current brief-readiness summary: Listing Copy generation is gated behind either a confirmed fetched property brief or a simple manual brief with address, property facts and feature/context detail.
- Current review summary: successful Fetch Details now places the fetched information in a `Review property brief` state with Confirm brief, Correct details and Refetch actions.
- Current generate-button summary: the legacy sticky Generate Listing Copy bar was removed; generation actions live inside Output Workspace.
- Current campaign library summary: before Campaign Pack, the app shows a compact included-category summary; the detailed 17-output tile grid remains as Campaign Library review navigation and was not deleted.
- Current blueprint summary: Campaign Blueprint remains planned beta only and cannot trigger generation.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Workspace Density Visuals 001 Status

Status date: `2026-06-27`

- Goal: `WEBAGENTS-COPYWRITING-WORKSPACE-DENSITY-VISUALS-001`
- Review artifact: `docs/workspace-density-visuals-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Current density summary: shared section padding, workspace gaps, left-rail cards, offer cards, Campaign Library controls, and secondary helper text are tighter while preserving the one-workspace Brief Builder / Output Workspace structure.
- Current collapsible summary: Property Overview and Suburb & Area Profile are collapsible after Fetch Details and start expanded after generation. Suburb & Area Profile inclusion settings remain visible and editable when collapsed.
- Current naming summary: the visible `Copy Context` card is now `Campaign Direction`; internal `copyContext` state and operation ids remain stable.
- Current photo summary: Property Photos shows a visible 20-photo cap, disables upload after 20 photos, and numbers thumbnails as Image 1, Image 2, and so on.
- Current visual highlights summary: Visual Highlights render as summary-first, per-image, collapsed rows with expandable details, using the same image numbers as uploaded thumbnails.
- Current output summary: Listing Copy, Campaign Pack, and planned-only Campaign Blueprint offer cards remain in place and are more compact.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Pre-Kevin UX Fixes 001 Status

Status date: `2026-06-27`

- Goal: `WEBAGENTS-COPYWRITING-PRE-KEVIN-UX-FIXES-001`
- Review artifact: `docs/pre-kevin-ux-fixes-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Dependencies changed: no
- Current bullet summary: Additional Property Features strip leading bullet/list markers at render time so the UI adds only one bullet marker.
- Current generation-action summary: the Listing Copy offer card is the single primary pre-generation Listing Copy entry point; duplicate Listing Copy generation buttons were removed from Campaign Library and the selected Listing Copy empty state.
- Current regenerate summary: Regenerate Listing Copy is disabled unless a stored per-version brief snapshot differs from current Brief Builder inputs.
- Current warning summary: if downstream Campaign Pack outputs exist, Listing Copy regeneration warns that those outputs will be cleared and suggests downloading the campaign first.
- Current land-size summary: editable Land Size remains visible as `Land Size (m²)` and the existing hectare-to-square-metre parsing path remains unchanged.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

## Campaign Pack Errors 001 Status

Status date: `2026-06-29`

- Goal: `WEBAGENTS-COPYWRITING-CAMPAIGN-PACK-ERRORS-001`
- Review artifact: `docs/campaign-pack-errors-001.md`
- Runtime behavior changed: yes
- Product code changed: yes
- Dependencies changed: no
- Current failure summary: Campaign Pack mid-run failures now show a recoverable paused state instead of only a generic `Load failed` message when batch context is available.
- Current progress summary: the app tracks requested output ids, current output id/title/category, sequence position, succeeded output ids, failed output id, remaining output ids, and batch status in local session state.
- Current retry summary: retrying Campaign Pack continues to generate only missing or failed downstream outputs, skips already-ready outputs, and does not regenerate Listing Copy.
- Current diagnostics summary: Campaign Build Log failure entries include safe output, batch, error, retry, and token/cost caveat details without raw provider payloads or secrets.
- Current export summary: current output, current category, and campaign downloads remain generated-only export actions and do not generate missing outputs.
- Current model routing summary: unchanged. AI Strategy Analysis remains on the server-configured Gemini Pro model, and image analysis remains on the server-configured Gemini Flash model.

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
