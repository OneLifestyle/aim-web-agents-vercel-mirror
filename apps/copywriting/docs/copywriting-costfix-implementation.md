# Copywriting Costfix Implementation

Task: `COPYWEB-COSTFIX-001`

## What changed

- Added explicit server-side Gemini token pricing for current configured model IDs.
- Removed silent cheap pricing fallback for unknown model names.
- Added a central operation-to-model-tier map in `api/copywriting.ts`.
- Routed photo analysis, feature extraction, refinement, chat, address suggestions and most short variants to the Flash tier.
- Kept property research, strategy analysis, full listing copy, brochure copy and long-form/blog copy on the Pro tier.
- Normalized usage responses with operation, model, token counts, optional thinking/cached tokens, pricing status, usage status and cost disclaimer flags.
- Returned usage for address suggestions and chat when Gemini exposes `usageMetadata`.
- Aggregated child usage for photo analysis, generate-all variants and download-all missing variant generation.
- Updated the Analysis Stream labels from exact-cost language to token-only estimate language.

## Model routing map

| Operation | Tier |
|---|---|
| `verifyBetaAccess` | No model |
| `suggestAddresses` | `GEMINI_FLASH_MODEL` |
| `researchProperty` | `GEMINI_PRO_MODEL` |
| `analyzeStrategy` | `GEMINI_PRO_MODEL` |
| `analyzeFeatures` | `GEMINI_FLASH_MODEL` |
| `analyzeSingleImage` | `GEMINI_FLASH_MODEL` |
| `generateCopy` | `GEMINI_PRO_MODEL` |
| `generateCopyVariant` | `GEMINI_FLASH_MODEL` by default |
| `generateCopyVariant` for `Brochure Copy` and `Long-form / Blog` | `GEMINI_PRO_MODEL` |
| `refineCopy` | `GEMINI_FLASH_MODEL` |
| `getChatbotResponse` | `GEMINI_FLASH_MODEL` |

## Pricing table

Static token-only USD references per 1M tokens:

| Model ID | Input | Output |
|---|---:|---:|
| `gemini-3.1-pro-preview` | `$2.00` | `$12.00` |
| `gemini-3-flash-preview` | `$0.50` | `$3.00` |
| `gemini-3.1-flash-lite` | `$0.25` | `$1.50` |
| `gemini-2.5-flash-lite` | `$0.10` | `$0.40` |

Legacy 2.5 Pro/Flash IDs remain explicitly priced only for backwards compatibility with existing server environment values. They are not used as fallback pricing.

## What remains token-only

The visible estimate includes only prompt and candidate token counts returned by Gemini `usageMetadata`. Thinking and cached token counts are recorded when present, but no separate cached-token discount or thinking-token billing policy is applied yet.

## What is not billing-grade yet

The UI does not present final billing. It shows `Token-only est. cost` per operation and `Token-only session estimate` for the Analysis Stream total. Unknown model pricing returns `pricingStatus: unknown` and `estimatedCost: null`, so it is excluded from the numeric total and surfaced as an unknown cost item.

## Grounding/tool cost limitation

Google Search grounding is still used for address suggestions and property research. Search and future Maps grounding charges are not included unless the provider response exposes reliable query counts. The UI states that grounding/tool charges are not included.

## Remaining private-beta limitations

- No durable usage ledger.
- No user/account attribution.
- No billing or credits.
- No durable quota reconciliation.
- No database-backed audit trail.
- Beta access is still a lightweight preview gate, not full product auth.

## Recommended next task

Add mocked regression tests for the usage-normalization contract and the batch aggregation paths, then run a quality comparison for Flash photo analysis against the previous Pro route before widening beta usage.
