# Copywriting Web Audit Sprint Report

Audit task: `COPYWEB-AUDITSPRINT-001B`
Audit branch: `audit/copywriting-web-product-review`
Base commit verified in history: `950b7000883ec78b612a82230603a4b0b8ab67c1`
Audit date: 2026-06-18
Scope: product, architecture, security, UX, model, cost, legal, commercial, Hub, web-agent and mobile-transfer readiness. Product code, prompts, routing, UI and environment files were not changed.

## 1. Executive summary

The standalone Copywriting web app is now a credible private-beta candidate after the cost/model attribution fix. The latest manual smoke report is strong: the Vercel Preview works, the page-level beta gate appears before workspace access, the correct beta code unlocks the app, address lookup works, property details and suburb/area analysis were accurate, 10 property photos uploaded and analyzed successfully, generated listing copy was high quality and accurate, and the Analysis Stream is visually working.

The main blocker is not product capability. It is launch control. At audit time the displayed total cost was too low because unknown model pricing was undercounted and several model operations were missing from the session total. `COPYWEB-COSTFIX-001` fixes the attribution issue for token-only estimates. Public beta still needs care because there is no durable auth, durable rate limiting, quota/cost ledger, privacy/terms layer, source-claim review workflow, or billing-grade telemetry.

Direct answers:

1. Is the current app safe enough to merge to `main` after the cost/model fix? Yes, conditionally, for a standalone private-beta-ready codebase if `BETA_ACCESS_CODE` is enforced in deployment and no production/public launch is implied.
2. Is it safe enough for a private beta after cost/model fix? Yes, for a small trusted tester group, with explicit draft-review language, no billing/credits, and monitored usage.
3. Is it safe enough for a public beta? No.
4. Should it stay standalone for now? Yes.
5. Should it be imported into `aim-web-agents` soon or later? Later.
6. Should it be embedded in Hub soon or later? Later, after standalone telemetry, claim review, and model routing stabilize.
7. Which features are most valuable commercially? Photo-aware listing copy, full campaign packs, agency tone presets, brand voice memory, vendor-safe and portal-safe modes, buyer-angle variants, open-home copy, source-backed property/suburb confidence, and one-click social/email/SMS outputs.
8. Which features are most confusing or clunky? Generate-all/download-all cost behavior, contact-card versus agent inclusion settings, open-house URL expectations, dense three-column layout, and the developer-like Analysis Stream.
9. Which code areas are most fragile? `App.tsx` state/orchestration, async batch generation, cost logging, model routing/pricing in `api/copywriting.ts`, object URL lifecycle, and localStorage timeline parsing.
10. Which UI areas should be redesigned first? Review/export gate, property fact editor, output/variant workspace, photo analysis workflow, and Analysis Stream treatment.
11. Which model operations should be cheaper/faster? Address suggestions, feature extraction, photo analysis by default, social/SMS/open-house variants, simple refinement, and default chat.
12. Which operations justify a premium model? Final listing copy, premium brochure copy, long-form/blog, complex strategy, Pro fallback for weak research confidence, and high-value image interpretation when cheaper vision misses detail.
13. What is the minimum model-router structure needed before broader launch? A central operation-to-model map, explicit tier names, pricing keyed to configured model IDs, complete usage returns, no silent fallback, batch aggregation, and normalized operation telemetry.
14. What telemetry must exist before billing/credits? Server-side durable records for user/session, property/job, operation, provider, model, tokens, image count, grounding/tool usage where available, latency, retries, success/failure, raw usage metadata, estimated provider cost, billable cost, quota/credit impact, and idempotency/reconciliation IDs.
15. What privacy/legal language is missing? Privacy policy, terms, AI-use disclosure, image-upload notice, geolocation/address/model-submission notice, retention statement, source policy, publication responsibility, and confidential/vendor-private upload warning.
16. What should the future mobile version preserve? One shared stateful workspace, editable intermediate facts, source review, photo-derived highlights, generated variants, copy editor, cost/progress visibility, and review-before-export flow.
17. What should the future mobile version not copy? The three-column desktop layout, developer-console Analysis Stream, dense tab nesting, detached chat surface, hidden batch costs, and export controls without a review checkpoint.

## 2. Current status

The app is a React 19, TypeScript and Vite standalone SPA with a Vercel serverless route at `api/copywriting.ts`. The browser calls same-origin `/api/copywriting`; Gemini execution and provider credentials are server-side. The app has no database, no durable auth, no Hub records, no wallet/credits, no OpenRouter or Agent SDK integration, and no provider abstraction beyond `GEMINI_PRO_MODEL` and `GEMINI_FLASH_MODEL`.

Current launch status:

- Preview smoke context is positive and materially changes the prior preview evidence gap.
- The server-side beta gate and proxy boundary are in place.
- Build and typecheck are required in this sprint and should pass before push.
- Cost/model fix remains the next merge/freeze gate.
- Public beta is blocked by durable control and legal/privacy gaps.

## 3. What is working well

- End-to-end workflow is valuable: address research, editable facts/context, photo analysis, full listing copy, variants, refinement and export.
- Provider key exposure has been removed from browser model calls.
- `api/copywriting.ts` validates operation names, payload shape, body size, image MIME types and image size.
- The page-level beta gate is working in the reported Vercel Preview.
- Manual smoke confirmed accurate research and high-quality generated copy.
- Source chips and the Analysis Stream create a foundation for transparency.
- The product already supports commercial output breadth: listing, social, email, flyer, brochure, blog, video, coming soon, open house and download-all workflows.

## 4. What is production-blocking

- Cost display is materially unreliable.
- Model routing is too coarse for margin control.
- There is no durable auth, durable rate limit, quota ledger, abuse ledger, cost cap, or per-user/account usage record.
- No formal privacy policy, terms, AI-use disclosure or image-upload/retention language.
- No claim-level source/confidence review workflow.
- No production monitoring for provider errors, latency, retry spikes, abuse or spend.
- No automated workflow tests for beta gate, research, image queue, generation, variants, refinement, export or mobile layout.

## 5. What is beta-blocking

Private beta after cost/model fix is acceptable with constraints. The remaining private-beta blockers are operational rather than product-fatal:

- Correct stale pricing and unknown-model fallback.
- Return or explicitly exclude usage for address suggestions and chat.
- Aggregate usage for generate-all and download-all variant loops.
- Label visible costs as token-only estimates until grounding/tool charges are included.
- Confirm `BETA_ACCESS_CODE` is configured in Preview and any Production-like deployment.
- Add clear in-app wording that outputs are drafts requiring agent/vendor review.

Public beta is blocked until durable rate limits, quotas/cost caps, privacy/legal copy, abuse monitoring and claim review exist.

## 6. What is polish or product-quality work

- Convert the dense workspace into clearer stages: Research, Review Facts, Strategy, Photos, Generate, Review and Export.
- Move the Analysis Stream from primary rail to collapsible run details with a compact cost/progress pill.
- Add a source/citation panel with claim confidence and source freshness.
- Let users accept/reject photo-derived highlights into an editable feature bank.
- Add generated, edited, stale, needs-review and exported states to variants.
- Make export/download actions show estimated cost and review requirements before running missing variants.
- Clarify that the open-house URL is inserted into copy and is not fetched/extracted.

## 7. Codebase architecture review

Strengths:

- Small standalone codebase with easy deployment shape.
- Clear server/client boundary after hardening.
- Strong typed domain contracts in `types.ts`.
- Operation-based API avoids exposing an arbitrary prompt endpoint.

Fragility:

- `App.tsx` is approximately 1,900 lines and owns beta gate, state, orchestration, rendering, exports, localStorage, async model workflows and UI layout.
- Many independent `useState` values form one workflow without a reducer/state machine.
- Async batch operations use active UI state and can be fragile if the user switches versions/tabs during long runs.
- Timeline localStorage parsing has no corruption guard.
- Word export builds HTML from generated/user-edited text without escaping.
- Object URLs for image previews are not consistently revoked.

Recommended architecture direction:

- Extract `BetaGate`, `AnalysisStream`, `PropertyResearchPanel`, `PhotoAnalysisPanel`, `CopyContextPanel`, `OutputPreview`, `CampaignControls` and `TimelineModal`.
- Move workflow state into a reducer or `useCopywritingWorkspace` hook with immutable job IDs.
- Separate export helpers from UI.
- Add mockable service boundaries before workflow tests.

## 8. Frontend architecture review

The frontend has the right product surface but needs structure before public use. The three-column desktop layout gives power users context, but on smaller screens it becomes cognitively dense. The right-hand preview area has nested main tabs, sub-tabs, version controls, generate-all, download-all, textarea editing, refine controls, contact-card controls and export controls in one space.

Priority frontend fixes:

- Stabilize generation/version state with job snapshots.
- Fix object URL cleanup for property photos and chat images.
- Guard localStorage timeline parsing.
- Add a full campaign cost preview before batch generation.
- Add Playwright smoke tests with mocked API responses.
- Redesign preview into zones: Variants, Editor, Review Sources, Export.

## 9. Server/API architecture review

`api/copywriting.ts` is the correct place for provider execution. It already enforces server-side secrets, operation allowlisting, payload validation, body size limits, image validation, beta access and best-effort throttling.

The API is still not production-grade:

- Throttle storage is process memory only.
- Model routing is scattered through `getProModel()` and `getFlashModel()` calls.
- There is no central model policy or per-operation budget.
- Usage is not returned for all model-backed operations.
- Provider errors and usage are not persisted.
- Grounded research source metadata is collected generally, not mapped to claims.

Minimum next server shape:

- Central router such as `routeModel(operation, flags)` returning provider, model, tier, price and budget.
- Normalized `ServiceResponse<T>` for every model-backed operation.
- Server-side usage event recording, even before a database exists, behind an interface.
- Explicit unknown-pricing state instead of cheap fallback.

## 10. Model routing and provider strategy

Current routing:

- `verifyBetaAccess`: no model.
- `suggestAddresses`: `GEMINI_FLASH_MODEL`.
- All other model-backed operations: `GEMINI_PRO_MODEL`.

This is too coarse. It preserves quality, but it makes photo analysis, short variants, SMS, open-house copy, chat and simple refinements unnecessarily expensive.

Recommended direct-Gemini routing:

- Fast tier: address suggestions, short variants, SMS, open-house, basic social, simple refinement, default chat.
- Vision-fast tier: photo analysis by default, with Pro fallback only after quality testing.
- Reasoning tier: strategy and property research when confidence matters.
- Premium-copy tier: final listing copy, premium brochure, long-form/blog, complex brand voice or high-value campaign copy.
- Grounded-research tier: property/suburb research with search-grounding and explicit source/confidence handling.

OpenRouter or Vercel model routing should be future work, not immediate beta work. The current operation API shape can support it later.

## 11. Cost and telemetry review

The displayed total is too low because:

- Pricing knows only `gemini-2.5-pro` and `gemini-2.5-flash`.
- Unknown model names fall back to old Flash pricing.
- Address suggestions make model/search calls but return no usage.
- Chat makes model calls but returns no usage.
- Generate-all and download-all loops do not aggregate inner usage into the parent log.
- Search grounding, Maps/tool costs, thinking tokens and cached token handling are not represented.

Before billing or credits, telemetry must be durable and server-side. UI-only Analysis Stream totals are useful for transparency but are not a ledger.

Immediate cost fix requirements:

- Key pricing to actual configured model IDs.
- Remove silent cheap fallback.
- Return usage for every operation or mark excluded costs explicitly.
- Aggregate batch usage.
- Label costs as token-only USD estimates until provider/tool costs are complete.

## 12. Security, privacy and abuse review

What looks safe:

- No client-side `@google/genai` import in the app/client source.
- `vite.config.ts` does not inject provider keys.
- `.env` and `.env.local` are not tracked in the repo.
- `.env.example` contains names only.
- Server validates method, operations, payloads and images.

Risks:

- Shared beta code is not auth.
- If `BETA_ACCESS_CODE` is absent, the API allows access.
- In-memory throttling is not durable across serverless instances.
- No quota, spend cap or abuse ledger.
- Property photos, addresses, geolocation, agent contact details and generated copy are sent to a model provider without sufficient user-facing privacy/retention language.
- Timeline stores generated copy/address in localStorage on the device.
- Chat image upload lacks client-side size/type UX guard before base64 conversion.

Private beta can proceed with deployment protection and small trusted users. Public beta cannot.

## 13. Legal/output-integrity review

The current trust notice is useful but insufficient for public beta. Missing:

- Terms of use.
- Privacy policy.
- AI-use disclosure.
- Photo upload and model-provider submission notice.
- Retention policy.
- Source policy.
- Publication responsibility workflow.
- Vendor/private-material upload warning.

Output risks:

- Research asks for rich marketing narrative, demographics, schools, price guide, last sold and specs without claim-level source mapping.
- Final copy prompt can convert research and image impressions into claims without a confirmation gate.
- Source chips are general sources, not claim citations.
- Image analysis can infer materials, condition, renovation quality, views or inclusions without user confirmation.

Needed controls:

- Claim Review panel before generation/export.
- Confidence labels: user-verified, sourced, image-inferred, AI-inferred, unknown.
- Vendor-safe mode.
- Portal-safe mode.
- Protected rules for bedrooms, bathrooms, land size, zoning, renovation quality, inclusions, views, school zones, travel times, price, yield and sale history.

## 14. UX and visual-design review

The current UI is functional but dense. It feels like a powerful internal tool rather than a polished beta product.

Practical recommendations:

- Layout restructuring: use a staged workspace with sticky step navigation and clear left-to-right or top-to-bottom progression.
- Visual hierarchy: make the current job, property identity, review status and cost status more prominent than raw logs.
- Component grouping: group research/facts, strategy, photos, generation, review and export as distinct zones.
- Section navigation: add sticky section chips or a stepper for desktop and mobile.
- Sticky controls: keep primary next action, estimated cost and review status visible; avoid burying export controls at the bottom.
- Analysis Stream treatment: convert from developer console into collapsible activity, model, cost and source details.
- Property details editing flow: show fetched facts with source/confidence badges and editable override states.
- Photo upload/analysis UX: show file count, size limits, per-image status, estimated cost, and accept/reject controls for extracted features.
- Generated-copy preview and variants UX: show generated/edited/stale/needs-review/exported statuses, plus before/after refinement comparison.
- Source/citation display: replace source chips alone with a claim/source panel and optional internal source appendix.
- Progress and cost display: show current operation, batch progress, estimated cost range and token-only disclaimer.
- Export/download/refinement controls: require review acknowledgement before export and preview missing-variant generation cost.
- Desktop/tablet/mobile: desktop can keep multi-pane workspace; tablet should collapse Analysis Stream; mobile should be one shared scrollable workspace with sticky navigation.
- AIM Hub visual alignment: keep the restrained operational style, but use Hub-like job status, entity cards, source panels and ledger-ready activity rows later.

## 15. Product and commercial opportunity review

The most useful improvements are product improvements, not just technical hardening:

- Brand voice/profile memory.
- Agency tone presets.
- Campaign pack outputs.
- Before/after copy comparison.
- Proof/citation/source panel.
- Vendor-safe copy mode.
- Portal-safe copy mode.
- Luxury, family, investor, rural and downsizer buyer angles.
- Suburb/area fact confidence.
- Editable property feature bank.
- Reusable property narrative summary.
- One-click social, email and SMS variants.
- Open-home campaign copy.
- Vendor update draft.
- AI search/SEO/LLM-discovery copy.
- Free demo wedge.
- Paid/pro differentiation.

Best commercial packaging:

- Free demo: manual-fact listing preview, capped photos, no saved history, no full campaign.
- Private beta/pro: photo-aware listing, campaign packs, review/source panel, exports.
- Team/agency: brand memory, tone presets, saved property narratives, Hub records, usage ledger.

## 16. Hub integration boundary

Do not embed in Hub yet. The app should remain standalone until:

- Cost/model telemetry is complete enough to create records.
- Source/claim review is implemented.
- Property/job/asset/user records are defined.
- Durable auth is chosen.
- Hub data-retention and rights boundaries are documented.

Future Hub integration should add save/retrieve, property/job/asset/ledger records and source appendices. It should not start as an iframe-like embed with unclear data ownership.

## 17. Future OpenRouter / Vercel model-router architecture

Future routing should be introduced behind the existing operation API, not by exposing arbitrary prompts.

Minimum architecture:

- Operation registry.
- Model tier registry.
- Provider adapter interface.
- Pricing registry with effective dates.
- Budget policy per operation.
- Fallback policy with reason logging.
- Usage normalization.
- Durable telemetry writer.
- Kill switches for expensive operations.

OpenRouter can be useful for provider flexibility. Vercel AI Gateway/model routing can be useful for observability and managed routing. Neither should be added before the direct Gemini router and telemetry contract are clear.

## 18. Future `aim-web-agents` import assessment

Import later, not soon. The app is still an AI Studio-derived standalone surface with a large single component and local workflow assumptions. Early import risks polluting `aim-web-agents` with unstable product state, incomplete telemetry, and unclear Hub boundaries.

Import when:

- Frontend is modular.
- Model router is operation-based.
- Durable telemetry and source review exist.
- The product decision is made: separate deployed app with shared packages, or app under `aim-web-agents/apps/copywriting`.

Recommended near-term path: keep separate deployed app, extract shared copywriting contracts and router later.

## 19. Future iOS Copywriting Agent transfer notes

Preserve:

- Shared stateful workspace concept.
- Editable intermediate facts and feature bank.
- Photo analysis feeding copy.
- Source/confidence review.
- Generated variants and refinement.
- Compact progress/cost state.
- Review before export/share.

Do not copy:

- Three-column layout.
- Dense nested tabs.
- Developer-console Analysis Stream.
- Detached chat assistant.
- Hidden batch costs.
- Export-first workflow without claim review.

Mobile should be a guided workspace with sticky section navigation, not separate pages that hide shared context.

## 20. Recommended roadmap

1. Fix cost/model attribution and complete usage coverage.
2. Add review/export gate and clearer token-only cost language.
3. Add source/claim confidence states.
4. Add durable rate limits, quotas and telemetry.
5. Modularize the frontend and stabilize async generation.
6. Add privacy/legal documents and in-app consent copy.
7. Add brand/tone/profile and campaign-pack product differentiators.
8. Decide Hub and `aim-web-agents` integration after standalone beta evidence.

## 21. Prioritized next tasks

1. `COPYWEB-COSTFIX-001`: pricing keyed to current model IDs, no silent fallback, usage for address/chat, batch aggregation, token-only labels.
2. Add private-beta review/export gate with fact/source acknowledgement.
3. Add durable operation telemetry interface and temporary log sink.
4. Add source/claim confidence model to research and UI.
5. Split `App.tsx` into feature components and a workflow reducer/hook.
6. Add mocked Playwright smoke tests for beta gate, research, 10-photo upload, generation, variants, refinement, export and mobile.
7. Draft privacy, terms, AI-use, image upload and retention language.
8. Add vendor-safe and portal-safe modes.
9. Add cost preview before generate-all/download-all.
10. Define Hub property/job/asset/ledger contracts before integration.

## 22. Stop conditions / Red Gates

Stop and do not merge, launch or widen access if any of these are true:

- Branch is not `audit/copywriting-web-product-review` for this sprint.
- Product code changes appear in the audit commit.
- `.env` or `.env.local` is staged.
- Real-looking secrets are staged.
- Client-side Gemini/provider SDK imports reappear.
- Provider keys are exposed through Vite or client bundle.
- `BETA_ACCESS_CODE` is missing in shared preview/production-like environments.
- Cost/model attribution remains wrong after the next fix task.
- Public access is proposed before durable rate limits, quotas, privacy/legal copy and abuse monitoring.
- Billing/credits are proposed before durable usage ledger and reconciliation.
- Hub import or `aim-web-agents` import is proposed before standalone telemetry and source review stabilize.
