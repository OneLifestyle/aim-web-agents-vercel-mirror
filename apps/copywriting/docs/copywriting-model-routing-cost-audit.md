# Copywriting Model Routing and Cost Audit

Task: `COPYWEB-COSTAUDIT-001`

Branch audited: `launch/copywriting-web-hardening`

Latest required commit present: `095cae8 Trigger Copywriting web preview redeploy`

## 1. Executive summary

The preview app is routing model calls through `api/copywriting.ts` as intended, with provider credentials kept server-side. The current routing is simple:

- `verifyBetaAccess` does not call Gemini.
- `suggestAddresses` uses `GEMINI_FLASH_MODEL`.
- Every other model-backed operation uses `GEMINI_PRO_MODEL`.

Audit-time finding: the observed low cost display was explained by stale pricing logic. The server calculated cost from the resolved model string, but `PRICING` only contained older 2.5 model IDs, so currently configured preview model names missed the table and were priced too low. `COPYWEB-COSTFIX-001` replaced that behavior with explicit pricing for current model IDs and `pricingStatus: unknown` for unpriced models.

The token counts shown in the Analysis Stream are not hard-coded estimates. For operations that return `ServiceResponse<T>`, they come from Gemini `response.usageMetadata`, specifically `promptTokenCount`, `candidatesTokenCount`, and `totalTokenCount`. The app does not read or display `thoughtsTokenCount` or `cachedContentTokenCount`, and it does not count Google Search or Maps grounding charges.

The original AI Studio-era version already used Flash only for address suggestions and Pro for research, strategy, feature extraction, image analysis, final copy, variants, refinement, and chat. The hardening work did not newly move photo analysis from Flash to Pro. However, the original comments show address suggestions had been intentionally switched back to `googleSearch` + Flash after Maps grounding caused poor autocomplete responses.

Recommended next task: `COPYWEB-COSTFIX-001`, limited to pricing accuracy, usage metadata completeness, operation usage coverage, and optional direct-Gemini routing changes after a quality check. Do not mix that with OpenRouter, Clerk, Hub, or Agent SDK work.

## 2. Current operation-to-model map

Current source locations:

- Client wrapper: `services/geminiService.ts`
- UI calls and Analysis Stream: `App.tsx`, `components/ChatBot.tsx`
- Server model execution: `api/copywriting.ts`
- Env placeholders: `.env.example`

Environment model variables:

| Variable | Current code use |
|---|---|
| `GEMINI_PRO_MODEL` | `getProModel()` in `api/copywriting.ts`; used for research, strategy, features, image analysis, copy, variants, refinement, chat |
| `GEMINI_FLASH_MODEL` | `getFlashModel()` in `api/copywriting.ts`; used for address suggestions only |

Current code cannot reveal the deployed model IDs from local files because they are server environment values. Manual smoke observed `Fetch Property Details` using `gemini-3.1-pro-preview`, so the preview `GEMINI_PRO_MODEL` appeared to resolve to that model at audit time. `COPYWEB-COSTFIX-001` changed photo analysis to the Flash tier and corrected the Analysis Stream wording.

| Operation | Client function / UI trigger | Server operation | Model variable used | Resolved model in current code | Uses Pro | Uses Flash | Hard-coded model | Google Search | Google Maps | Images | Should be | Risk if current model is overpowered or underpowered |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Beta verification | `verifyBetaAccess` | `verifyBetaAccess` | None | None | No | No | No | No | No | No | No model | No model cost. Risk is access/session behavior only. |
| Address suggestions | `suggestAddresses` | `suggestAddresses` | `GEMINI_FLASH_MODEL` | Server env; likely Flash-class | No | Yes | No | Yes, `googleSearch` | No | No | Flash or Flash-Lite | Pro would be wasteful; underpowered routing may return weak or fake addresses. Search grounding cost is not counted. |
| Fetch Property Details | `researchProperty` / `handleFetchDetails` | `researchProperty` | `GEMINI_PRO_MODEL` | Server env; smoke observed `gemini-3.1-pro-preview` | Yes | No | No | Yes, `googleSearch` | No | No | Flash, Flash-Lite, or Pro after quality test | Pro may be expensive for every lookup. Flash/Lite may miss nuance or produce weaker suburb/profile synthesis. Search grounding cost is not counted. |
| AI Strategy Analysis | `analyzeStrategy` | `analyzeStrategy` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No, but text may include prior image analysis | Pro or Flash after quality test | Pro may be wasteful for structured classification; Flash/Lite may reduce strategic quality. |
| AI Feature Extraction | `analyzeFeatures` | `analyzeFeatures` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No, but text may include prior image analysis | Flash or Flash-Lite | Pro likely overpowered for extraction. Underpowered model could miss important features or over-normalise details. |
| Analyze Photos Sequence | `analyzeSingleImage` in a client loop | `analyzeSingleImage` per image | `GEMINI_PRO_MODEL` | Server env; UI copy says configured Gemini Pro | Yes | No | No | No | No | Yes | Flash or Flash-Lite unless quality proves Pro is required | Pro cost scales by image count. Lower models could miss visual selling points, room details, condition, or style cues. |
| Generate Copy / Full Copy | `generateCopy` | `generateCopy` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No direct images, but image analysis text may be included | Pro | Lower model may reduce final copy quality and brand tone. Pro is defensible for the premium final output. |
| Just Listed | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash, Pro, or routed | Pro may be overpowered for short social rewrite; Flash/Lite may be sufficient. |
| Brochure Copy | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Pro or routed | Quality may justify Pro for premium brochure tone; Pro increases campaign-pack cost. |
| Email | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or Pro depending quality | Pro may be overpowered for many email variants. |
| Flyer | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or Pro depending quality | Pro may be overpowered for short format. |
| Facebook | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Pro may be overpowered for social adaptation. |
| Facebook Marketplace | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Same as Facebook. |
| Instagram | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Same as social variants. |
| X / Twitter | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash-Lite or Flash | Pro is likely overpowered for 280-character adaptation. |
| Google Business | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Pro may be overpowered; lower model may still be acceptable. |
| TikTok | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Pro may be overpowered for script adaptation unless tone quality matters. |
| Open House | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Template-like output probably does not need Pro. |
| Long-form / Blog | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Pro or routed | Pro may be justified for long-form quality. |
| Video Script | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or Pro depending quality | Pro may be overpowered for short script; quality should be tested. |
| Coming Soon Teaser | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or routed | Pro likely overpowered for short teaser. |
| Coming Soon Email | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or Pro depending quality | Pro may be overpowered. |
| Coming Soon SMS | `generateCopyVariant` | `generateCopyVariant` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash-Lite | Pro is likely overpowered for under-160-character SMS. |
| Generate All Variations | client loops `generateCopyVariant` | multiple `generateCopyVariant` calls | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Router by variant | Current summary log does not include summed usage, so campaign-pack cost is underreported. |
| Download Full Campaign missing variants | client loops `generateCopyVariant` | multiple `generateCopyVariant` calls | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Router by variant | Generated missing variants are not added to the Download All log usage total. |
| Refinement | `refineCopy` | `refineCopy` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | No | Flash or Pro depending user intent | Pro may be useful for substantial rewrite, but overpowered for simple edits. |
| Chat | `getChatbotResponse` in `ChatBot.tsx` | `getChatbotResponse` | `GEMINI_PRO_MODEL` | Server env | Yes | No | No | No | No | Optional image | Flash, Pro, or routed | Chat has no usage return, so cost is invisible. Image chat may require stronger vision model. |

## 3. Original AI Studio-era model-selection comparison

Commits inspected:

- `836ff62 Audit existing web Copywriting tool architecture`
- `47345ad Harden Copywriting web beta model access`
- `4849493 Fix Copywriting beta gate and Gemini model config`
- Current `HEAD` / `095cae8`

Original model constants at `836ff62`:

| Constant | Original model | Original use |
|---|---|---|
| `MODEL_GROUNDING` | Legacy Pro preview model | Property research with Google Search |
| `MODEL_FAST` | `gemini-3-flash-preview` | Address suggestions with Google Search |
| `MODEL_SMART` | Legacy Pro preview model | Strategy, features, final copy, variants, refinement, chat |
| `MODEL_VISION` | Legacy Pro preview model | Image analysis |
| `MODEL_MAPS` | `gemini-2.5-flash` | Defined but not used |

Original Pro versus Flash split:

- Address/search autocomplete used Flash: `MODEL_FAST = 'gemini-3-flash-preview'`.
- Property research used Pro with `googleSearch`.
- Image analysis used Pro, not Flash.
- Final writing used Pro.
- Strategy, feature extraction, variants, refinement, and chat used Pro.
- `MODEL_MAPS` existed, with a comment that Maps grounding was only supported in the Gemini 2.5 series, but no audited call used it.

Hardening comparison:

- `47345ad` moved model execution from browser code into `api/copywriting.ts`.
- At `47345ad`, `services/geminiService.ts` became a client API wrapper but still exposed old descriptive constants.
- Server routing in `api/copywriting.ts` used `getFlashModel()` for `suggestAddresses` and `getProModel()` for all other model-backed operations.
- `4849493` changed client display constants from concrete model IDs to "server-configured" labels and added the page-level beta flow. It did not materially change server routing.

Finding at audit time: hardening did not accidentally move photo analysis from Flash to Pro. Photo analysis was already routed to the legacy Pro preview model in the original working version. The accidental drift was in pricing: the original service had newer preview pricing constants, while the audited server table only had older 2.5 model prices, so modern configured model names were undercounted.

## 4. Token usage source audit

The usage source is `extractUsage(response, model)` in `api/copywriting.ts`.

Current code reads:

- `response.usageMetadata`
- `usage.promptTokenCount`
- `usage.candidatesTokenCount`
- `usage.totalTokenCount`

Current code does not read:

- `thoughtsTokenCount`
- `cachedContentTokenCount`
- grounding query counts
- image count as a usage/cost dimension
- audio/video duration
- provider raw cost

Operations returning usage:

- `researchProperty`
- `analyzeStrategy`
- `analyzeFeatures`
- `analyzeSingleImage`
- `generateCopy`
- `generateCopyVariant`
- `refineCopy`

Operations not returning usage:

- `verifyBetaAccess`: correctly no model usage.
- `suggestAddresses`: makes a model call but returns `string[]`, so token and cost usage is discarded.
- `getChatbotResponse`: makes a model call but returns `string`, so token and cost usage is discarded.
- `Generate All Variations` and `Download Full Campaign`: each inner variant response has usage, but the UI summary log does not aggregate it.

The Analysis Stream uses real Gemini token metadata where available. It is not using a word or character approximation. It becomes incomplete because some operations discard usage and because campaign-batch wrapper logs do not sum inner operation usage.

## 5. Cost calculation audit

Cost calculation source: `calculateCost(model, promptTokens, responseTokens)` in `api/copywriting.ts`.

Current price constants:

| Model key in code | Input price | Output price | Unit |
|---|---:|---:|---|
| `gemini-2.5-pro` | `$1.25` | `$10.00` | per 1M tokens |
| `gemini-2.5-flash` | `$0.10` | `$0.40` | per 1M tokens |

Current calculation:

```text
(promptTokens / 1,000,000 * inputRate) + (responseTokens / 1,000,000 * outputRate)
```

Findings:

- The scaling is per 1M tokens and is mathematically correct for the table values.
- The table values are stale for the observed preview model names.
- Unknown model names fall back to `gemini-2.5-flash`, which materially undercounts any Pro model.
- Costs are displayed as USD assumptions, but the UI does not label them as USD.
- Thinking tokens are not included.
- Cached tokens are not included or discounted.
- Search grounding cost is not included.
- Maps grounding cost is not included.
- Per-image costs or image-unit charges are not included beyond whatever Gemini reports in token counts.
- Rounding uses `.toFixed(5)`, which can hide small individual calls but is not the main issue in the observed smoke test.
- Session total sums `log.usage.estimatedCost` for logs that have usage only. Address suggestions, chat, Generate All inner variants, and Download All missing variants may be absent from the total.

## 6. Sample recalculations from latest manual smoke screenshots

Observed screenshot example:

- Analyze Photos Sequence input tokens: `10,720`
- Analyze Photos Sequence output tokens: `1,395`
- Displayed cost: about `$0.00163`

Current code fallback calculation:

```text
10,720 / 1,000,000 * $0.10 = $0.001072
1,395 / 1,000,000 * $0.40 = $0.000558
Total = $0.001630
```

This exactly matches the observed cost, which means the model name used for the call was not found in `PRICING` and the code fell back to `gemini-2.5-flash`.

Reference recalculations using supplied audit assumptions:

| Assumption | Input cost | Output cost | Total |
|---|---:|---:|---:|
| Audit-time undercounted 2.5 Flash-rate table | `$0.00107` | `$0.00056` | `$0.00163` |
| `gemini-3.1-pro-preview` at `$2 / $12` | `$0.02144` | `$0.01674` | `$0.03818` |
| `gemini-3-flash-preview` at `$0.50 / $3` | `$0.00536` | `$0.00419` | `$0.00955` |
| `gemini-3.1-flash-lite` at `$0.25 / $1.50` | `$0.00268` | `$0.00209` | `$0.00477` |

If the photo analysis used the observed Pro model, the displayed `$0.00163` underreports the token-only reference cost by about `23.4x`. If it used `gemini-3-flash-preview`, it still underreports by about `5.9x`. These multipliers exclude any separate image, search, Maps, or cached/thinking-token billing effects.

The observed total session cost around `$0.00307` is likely incomplete for three reasons:

- Pro calls are being priced at fallback Flash rates.
- Address suggestion usage is discarded.
- Batch generation operations may make many variant calls without summing usage into the parent log.

## 7. Search/Maps grounding cost handling

Search grounding is used in:

- `suggestAddresses` with `tools: [{ googleSearch: {} }]`
- `researchProperty` with `tools: [{ googleSearch: {} }]`

Maps grounding is not used in current code. `GroundingSource` supports `type: 'web' | 'maps'`, and the UI can render maps sources, but current extraction only maps `groundingChunks` with `web` fields to `type: 'web'`.

No code counts:

- Google Search grounding query charges
- Google Maps grounding query charges
- grounding metadata query counts
- separate provider tool costs

Recommendation for `COPYWEB-COSTFIX-001`: keep token-cost fixes separate from search/maps cost implementation if provider billing detail is not available. At minimum, mark Analysis Stream costs as token-only estimated costs until separate grounding charges are recorded.

## 8. Recommended direct-Gemini routing map

This is a provisional recommendation only. Do not change routing without a quality check on the same property/image set used in the successful smoke test.

| Operation | Recommended current model | Reason | Cost risk | Quality risk |
|---|---|---|---|---|
| Beta verification | No model | Access gate only | None | None |
| Address suggestions | Flash-Lite or Flash | Short autocomplete-like task; search grounded | Search-query billing may dominate token cost | Weak address recall if too small |
| Fetch Property Details | Flash first, Pro fallback for low confidence | Grounded extraction and summary may not always need Pro | Pro on every lookup may be expensive | Flash/Lite may miss property/suburb nuance |
| AI Strategy Analysis | Pro for premium path, Flash for cost-sensitive path | Strategy quality can affect final copy | Pro may be overpowered for classification | Lower model may produce generic strategy |
| AI Feature Extraction | Flash-Lite or Flash | Structured extraction from available text | Pro likely wasteful | May miss subtle features |
| Analyze Photos Sequence | Flash or Flash-Lite first, Pro fallback if quality fails | Repeated per image; cost scales quickly | Pro on 10+ images can dominate session cost | Lower vision quality may miss high-value selling points |
| Generate Full Copy | Pro | Main paid-quality output | Higher token cost is defensible | Lower model may hurt brand quality |
| Listing variants | Flash by default, Pro for brochure/blog/premium long form | Most are adaptations from full copy | Pro campaign pack can multiply cost | Lower model may flatten tone |
| Open House | Flash-Lite or Flash | Template-like announcement | Pro wasteful | Low |
| Social posts | Flash-Lite or Flash | Short adaptations | Pro wasteful | Medium for brand voice |
| Email | Flash or Pro based on quality | Medium-form sales copy | Pro may be overpowered | Medium |
| Brochure Copy | Pro or routed | Premium collateral | Higher cost | Medium-high if downgraded |
| Long-form / Blog | Pro or routed | Longer composition | Higher cost | High if downgraded |
| Video Script | Flash or Pro based on quality | Adaptation with format constraints | Pro may be overpowered | Medium |
| Coming Soon SMS | Flash-Lite | Very short output | Pro wasteful | Low |
| Refinement | Router by instruction length/type | Simple edits need less model; rewrites may need Pro | Pro on all edits may be wasteful | Simple lower model edits may be fine |
| Chat | Flash default, Pro/vision route when image or high-value help | Optional assistant, currently invisible cost | Pro chat can leak session budget | Lower model may be less useful |

## 9. Future OpenRouter/Vercel model-router telemetry requirements

A future AIM model router should record at minimum:

- `app_id`
- `surface`: web, mobile, hub, services
- `tool_id` or `agent_id`
- `operation_name`
- `tenant_id`, later
- `workspace_id`, later
- `user_id`, later
- `property_id`, later
- `job_id`
- `asset_id`, if relevant
- `provider`
- `gateway`: direct Gemini, OpenRouter, Vercel AI Gateway, direct provider fallback
- `model_name`
- `model_version`
- `input_tokens`
- `output_tokens`
- `thinking_tokens`, where available
- `cached_tokens`, where available
- `image_count`
- `audio_video_duration`, where relevant
- `grounding_search_query_count`, where available
- `grounding_maps_query_count`, where available
- `raw_provider_cost_estimate`
- `aim_marked_up_cost`, later
- `latency_ms`
- `success`
- `failure_reason`, where applicable
- `retry_fallback_path`
- `trace_id`
- `created_at`

Implementation note for the future router: store raw provider usage metadata as a bounded JSON payload alongside normalized fields. Provider metadata changes often, and normalized-only ledgers lose auditability.

## 10. Risks

- Displayed cost is materially understated for configured Pro/Flash models because of stale pricing fallback.
- Session total is incomplete because several model-backed flows do not log or aggregate usage.
- Search grounding and Maps grounding cost are not represented.
- Image-analysis cost scales by image count and currently routes to Pro.
- The client has descriptive model constants that can diverge from real server env values.
- Pricing names and preview model names are unstable, so hard-coded model pricing will continue to drift.
- Chat usage is invisible in the Analysis Stream.
- The app does not persist usage, so there is no durable audit trail by user, job, property, or session.
- `GEMINI_FLASH_MODEL` may be set correctly but address suggestion usage is discarded, hiding both tokens and grounding cost.

## 11. Recommended next task

Recommended next task: `COPYWEB-COSTFIX-001`.

Suggested scope:

1. Update pricing lookup for the currently configured direct-Gemini models, or make pricing an explicit server-side configuration map.
2. Remove the silent fallback to old Flash pricing, or surface an "unknown model pricing" warning.
3. Label displayed costs as token-only USD estimates.
4. Return usage for `suggestAddresses` and `getChatbotResponse`, or intentionally exclude them with UI labels.
5. Aggregate usage for Generate All Variations and Download Full Campaign.
6. Add fields for `thoughtsTokenCount` and `cachedContentTokenCount` if present in provider metadata.
7. Count image count in usage summaries.
8. Add a visible note that Google Search/Maps grounding costs are not included until provider query-cost telemetry is available.
9. Consider direct-Gemini routing changes only after a small quality comparison across Pro, Flash, and Flash-Lite on the same smoke-test property/images.

Do not include Clerk, Hub integration, OpenRouter, Vercel AI Gateway, or Agent SDK work in that fix unless a separate routing/telemetry task is explicitly opened.
