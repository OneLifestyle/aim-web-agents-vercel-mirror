# Copywriting Web Subagent Review Notes

Audit task: `COPYWEB-AUDITSPRINT-001B`
Branch: `audit/copywriting-web-product-review`
Mode: read-only review passes. Six Codex subagents were available. The seventh pass was performed locally because the subagent thread limit was reached. No product code was edited.

## 1. Product and UX Auditor

Working well:

- Manual smoke result is strong: beta gate, address lookup, research, suburb/area analysis, 10-photo analysis, generated copy and Analysis Stream reportedly work.
- The product workflow is commercially useful: research, editable facts/context, photo analysis, full copy, variants and export.
- Source chips provide a trust foundation.
- Editable strategy, feature, avoidance, profile inclusion and contact-card controls make the app more useful than a generic copy generator.

Blockers and risks:

- Cost display is not trustworthy.
- No clear pre-publication review checkpoint.
- Generate/download-all can silently run many missing variants before cost attribution is fixed.
- The desktop layout is powerful but cognitively dense.
- Property facts do not carry verified/source-backed/uncertain states.
- Chat feels detached from the property workflow.

Recommendations:

- Redesign around Research, Review Facts, Strategy, Photos, Generate, Review and Export.
- Move Analysis Stream into collapsible run details.
- Add claim/source confidence and a review/export gate.
- Combine photo analysis with the editable feature bank.
- Add variant status badges.

## 2. Frontend Architecture Auditor

Strengths:

- Client uses same-origin `/api/copywriting` and no longer directly imports `@google/genai`.
- The app covers the complete copywriting workflow in one surface.
- Core data contracts are typed in `types.ts`.

Fragility:

- `App.tsx` is roughly 1,900 lines and owns state, orchestration, rendering, beta gate, exports, localStorage and async model workflows.
- Many independent state slices represent one workflow without a reducer/state machine.
- Object URLs for uploaded photos and chat previews are not consistently revoked.
- Async batch generation can write based on captured active state.
- LocalStorage timeline parsing lacks error handling.
- Word export builds HTML from generated/user text without escaping.
- No test script or critical workflow tests exist.

Recommendations:

- Split `App.tsx` into feature components.
- Move generation/version state into a reducer or custom hook with immutable job IDs.
- Fix cost telemetry display and batch usage aggregation.
- Add object URL cleanup.
- Extract export helpers.
- Add mocked Playwright smoke tests.
- Redesign the preview/output area into variants, editor, sources and export zones.

## 3. Server/API and Model Auditor

Strengths:

- Gemini credentials are server-side.
- API dispatch is operation-based and allowlisted.
- Payload, image, body, history and beta access validation are in place.
- Model names are deployment-configured through `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL`.

Fragility:

- Pricing was stale and undercounted unknown model names at audit time; `COPYWEB-COSTFIX-001` now marks unpriced models as `pricingStatus: unknown`.
- Routing was too coarse at audit time; `COPYWEB-COSTFIX-001` adds a minimal operation-to-tier map.
- Address suggestions and chat now return provider usage when available.
- In-memory throttling is acceptable for preview/private beta only.
- Research facts need stronger source/confidence handling.

Recommendations:

- Cheaper/faster candidates: address suggestions, feature extraction, photo analysis by default, social/SMS/open-house variants, simple refinement and default chat.
- Premium candidates: final listing copy, premium brochure, long-form/blog, complex strategy, high-confidence research fallback and high-value image interpretation.
- Add a central router with tiers such as `fast`, `vision_fast`, `reasoning`, `premium_copy` and `grounded_research`.
- Return normalized usage for every model-backed operation.
- Add batch aggregation and no silent pricing fallback.

## 4. Cost, Telemetry and Commercial Auditor

Findings:

- Cost table only knows `gemini-2.5-pro` and `gemini-2.5-flash`.
- Unknown models silently fall back to old Flash pricing.
- Analysis Stream totals only logs with usage.
- Address suggestions and chat costs are invisible.
- Batch flows do not aggregate inner usage into parent logs.

Billing/credits requirements:

- Durable server-side usage by operation, model, provider, user/session, property/job, tokens, image count, grounding/search usage where available, latency, retry path, success/failure, raw provider metadata, estimated provider cost and billable AIM cost.
- Quota, credit balance, idempotency and reconciliation are required before charging.

Commercial opportunities:

- Full campaign packs.
- Photo-aware listing copy.
- Premium brochure/blog/video scripts.
- Vendor-safe and portal-safe modes.
- Source-backed confidence panels.
- Brand voice memory and agency tone presets.
- Reusable feature bank.
- One-click social/email/SMS/open-home variants.

Top fixes:

1. Replace silent pricing fallback.
2. Label totals as token-only estimates.
3. Return usage for address and chat or explicitly exclude them.
4. Aggregate generate-all/download-all usage.
5. Add durable telemetry before billing.

## 5. Security, Privacy and Abuse Auditor

What looks safe:

- No client-side `@google/genai` import in app/client source.
- `vite.config.ts` does not inject provider keys.
- `.env` and `.env.local` are not present or tracked.
- Safe secret regex search found no real-looking secrets during the read-only pass.
- API validates method, operations, payload size, fields and image MIME types.

Blockers:

- Public beta blocker: rate limiting is in-memory and not durable across Vercel instances.
- Public beta blocker: no durable quota, cost cap, abuse ledger or per-operation spend controls.
- Privacy/legal blocker: uploaded photos, geolocation, addresses, agent contact details and generated copy go to the model provider without sufficient notice or consent framing.

Risks:

- Shared beta code is not auth.
- API allows access when `BETA_ACCESS_CODE` is absent.
- Main upload has client-side count cap but weak client-side MIME/size validation.
- Chat image upload lacks client-side size/type guard.
- Timeline stores generated copy and address in localStorage.

Go/no-go:

- Merge after cost/model fix: conditional go for private-preview state.
- Private beta: go with constraints.
- Public beta: no-go.

## 6. Legal and Output-Integrity Auditor

Missing language:

- Formal privacy policy.
- Terms of use.
- AI-use disclosure.
- Image-upload notice.
- Retention policy.
- Publication responsibility flow.

Output integrity risks:

- Research prompt asks for rich property/suburb facts without claim confidence, source-by-claim mapping, freshness dates or strict unknown handling.
- Source chips are general, not claim-specific.
- Final copy generation passes research, image analysis and profile data without requiring factual restraint or source preservation.
- Image analysis can turn visual impressions into unsupported claims.

Recommendations:

- Add Claim Review before generation/export.
- Store/display source title, URL, retrieval date and claim mapping.
- Add confidence labels: verified by user, sourced from web, inferred from image, AI inferred and unknown.
- Add vendor-safe and portal-safe modes.
- Protect sensitive claims: bedrooms, bathrooms, land size, zoning, renovation quality, inclusions, views, school zones, travel times, price, rental yield and sale history.

Readiness:

- Private beta acceptable with known testers, visible review notice and no billing/credits.
- Public beta not ready.
- Merge after cost/model fix is legally tolerable for controlled private beta, not production launch.

## 7. Web Agents / Hub / Mobile Transfer Auditor

This pass was performed locally because the subagent thread limit blocked the seventh spawned agent.

Hub boundary:

- Keep standalone for now.
- Do not embed in Hub until durable telemetry, claim review, source policy and entity records exist.
- Future Hub work should create property, job, asset, source, output and usage ledger records.
- Avoid storing portal-derived or provider-grounded property data without rights and retention rules.

`aim-web-agents` import:

- Import later, not soon.
- Current app is too monolithic and standalone-assumption-heavy.
- Extract shared contracts, router and telemetry first.
- Reassess whether to keep as a separate deployed app with shared packages or move under `aim-web-agents/apps/copywriting`.

OpenRouter / Vercel model-router:

- Add later behind the operation API.
- Start with a direct Gemini operation router and normalized telemetry.
- Avoid provider expansion before cost and quality baselines are known.

iOS Copywriting Agent transfer:

- Preserve shared workspace, editable facts, feature bank, photo analysis, source review, generated variants, cost/progress visibility and review-before-export.
- Do not copy three columns, nested tabs, developer-console Analysis Stream, detached chat or hidden batch costs.
- Mobile should be a guided single-workspace flow with sticky navigation and collapsible run details.
