# Copywriting Product QA 001

Goal ID: `WEBAGENTS-COPYWRITING-PRODUCT-QA-001`

Date: 2026-06-22

Scope: focused product QA and architecture review of the imported Copywriting Web app in `aim-web-agents/apps/copywriting`. This review is docs-only. It did not call provider APIs, inspect environment values, add integrations, change routing, change product behavior, or modify sibling repositories.

## Executive Summary

The imported app is broadly aligned with the private beta architecture: Vite/React client, same-origin `/api/copywriting` serverless route, Gemini credentials on the server, no Hub/Clerk/Stripe/OpenRouter/Firebase/Cloudflare/database integration.

Current model routing is no longer the older "Flash only for address suggestions, Pro for everything else" split. The current server tier map routes image analysis, feature extraction, refinement, chat, address suggestions, and most variants through `GEMINI_FLASH_MODEL`; it keeps property research, AI Strategy Analysis, full listing copy, brochure copy, and long-form/blog variants on `GEMINI_PRO_MODEL`.

The next safe implementation sprint should not be a broad UI rewrite. It should focus on reliability and clarity:

1. Add operation-level concurrency guards and clearer retry/error copy for strategy analysis.
2. Add a lightweight model-routing quality comparison before moving AI Strategy Analysis from Pro to Flash.
3. Keep costs labelled as token-only estimates, and add regression tests for usage aggregation and unknown-pricing paths.
4. Evolve the Analysis Stream into a public-facing Campaign Build Log with developer telemetry behind collapsed details.
5. Improve the output area as a structured single-column campaign output flow with anchored section navigation and refine actions, instead of investing first in a full mini word processor.
6. Add export packaging in stages: selected section, full campaign document, then a ZIP containing the master document plus individual section documents.

## Source Files Reviewed

- `apps/copywriting/api/copywriting.ts`
- `apps/copywriting/services/geminiService.ts`
- `apps/copywriting/App.tsx`
- `apps/copywriting/components/ChatBot.tsx`
- `apps/copywriting/types.ts`
- `apps/copywriting/README.md`
- `apps/copywriting/WEBAGENTS_IMPORT.md`
- `apps/copywriting/docs/copywriting-costfix-implementation.md`
- `apps/copywriting/docs/copywriting-model-routing-cost-audit.md`
- `apps/copywriting/docs/copywriting-preview-fix-plan.md`

Official pricing page checked for public pricing context only: `https://ai.google.dev/gemini-api/docs/pricing`.

## Model Routing Findings

Server model routing is centralized in `OPERATION_MODEL_TIER` and `resolveModelForOperation` in `api/copywriting.ts`.

| Operation | Current route | Notes |
|---|---|---|
| `verifyBetaAccess` | No model | Access check only. |
| `suggestAddresses` | `GEMINI_FLASH_MODEL` | Uses Google Search grounding. Usage is now returned when provider metadata exists. |
| `researchProperty` | `GEMINI_PRO_MODEL` | Uses Google Search grounding. Pro remains defensible until quality/cost testing proves Flash is sufficient. |
| `analyzeStrategy` | `GEMINI_PRO_MODEL` | Hard routed to Pro by the tier map. |
| `analyzeFeatures` | `GEMINI_FLASH_MODEL` | Extraction task; current route is cost-aware. |
| `analyzeSingleImage` | `GEMINI_FLASH_MODEL` | Image analysis route matches observed acceptable cost direction. |
| `generateCopy` | `GEMINI_PRO_MODEL` | Full listing copy remains Pro. |
| `generateCopyVariant` | `GEMINI_FLASH_MODEL` by default | Mixed route. |
| `generateCopyVariant` for `Brochure Copy` and `Long-form / Blog` | `GEMINI_PRO_MODEL` | Higher-quality long-form routes remain Pro. |
| `refineCopy` | `GEMINI_FLASH_MODEL` | Simple edit path is cost-aware. |
| `getChatbotResponse` | `GEMINI_FLASH_MODEL` | Usage is returned to the Analysis Stream when metadata exists. |

Model names shown in the Analysis Stream come from provider responses normalized by `extractUsage`, so successful calls display the actual server-resolved model string. Client-side constants in `services/geminiService.ts` are descriptive placeholders, not concrete runtime model names.

Fallback behavior exists for provider API failures through `withRetry`, which retries up to 3 times with exponential backoff. There is no model fallback from Pro to Flash or Flash to Pro. Unknown pricing no longer silently falls back to a cheap model price; it returns `estimatedCost: null` and `pricingStatus: unknown`.

## AI Strategy Analysis Finding

AI Strategy Analysis is currently hard-coded to the Pro tier through `OPERATION_MODEL_TIER.analyzeStrategy = 'pro'`.

It can probably be tested on Flash because the task is structured classification and summarization over already-collected research/profile/image-analysis text. It should not be switched yet without a small quality comparison on the same property inputs because the selected target market and writing style influence the full campaign.

Recommendation: keep AI Strategy Analysis on Pro for the next deploy, but create a narrow quality and reliability experiment that compares Pro and Flash outputs for:

- correct JSON shape;
- exactly 1 or 2 writing styles;
- useful buyer angle;
- non-generic features to highlight;
- no invented claims;
- latency and retry rate.

If Flash matches quality on the smoke-test property set, route strategy to Flash with Pro fallback for malformed JSON or low-confidence validation.

## Strategy Reliability And Concurrency

The observed one-off strategy failure is most likely one of these implementation-level causes:

- a transient Gemini/API failure that exhausted retries;
- malformed or empty JSON from the model, because `analyzeStrategy` uses direct `JSON.parse(response.text || '{}')`;
- overlapping user actions causing shared state to change while a long-running call is in flight.

Current UI disables the strategy button while `isAnalyzingStrategy` is true, but other AI actions can still run near the same time. Fetch details, feature extraction, image analysis, generation, and chat have separate loading states and can overlap. The server also has only best-effort in-memory throttling, not per-session operation serialization.

Recommendation for the next sprint:

- add an operation-level "campaign is busy" guard for conflicting actions that mutate campaign context;
- keep chat independent, but do not let strategy, feature extraction, image analysis completion, and full-copy generation overwrite each other's context silently;
- add request IDs or started-at snapshots so stale responses are ignored if the underlying research/image/profile inputs changed;
- replace the generic "Strategy analysis failed" path with a user-facing retry affordance and a developer detail in the future debug drawer;
- validate strategy JSON shape before applying it, and retry once with a "return valid JSON only" repair prompt if parsing fails.

## Cost Display Findings

Usage capture reads `response.usageMetadata` and normalizes:

- prompt tokens;
- candidate/output tokens;
- total tokens;
- thinking tokens when present;
- cached tokens when present;
- best-effort grounding query indicators.

Cost calculation uses static per-1M-token pricing constants in `api/copywriting.ts`. The current table includes the observed preview model IDs `gemini-3.1-pro-preview` and `gemini-3-flash-preview`, plus Flash Lite and 2.5 fallback-compatible IDs. The code now surfaces unknown pricing as unknown rather than undercounting with a silent cheap fallback.

The Analysis Stream is labelled honestly as `Token-only est. cost` and `Token-only session estimate`. It also states that grounding/tool charges are not included.

Limitations:

- token pricing constants can drift as preview models change;
- Pro pricing has prompt-size tiers above 200k tokens, while the current local calculation does not branch on prompt-size tiers;
- output pricing includes thinking tokens in the public pricing page, but the local calculation uses candidate tokens for cost and records thinking tokens separately;
- cached-token discounts are not applied;
- Google Search and Google Maps grounding charges are explicitly excluded;
- provider raw billing cost is not available in the app;
- no durable usage ledger exists.

Recommendation: keep visible cost language as token-only estimate, add tests for `extractUsage` and `aggregateUsage`, and treat static pricing as an operational risk until model IDs and pricing are either server-configured or pulled from a reviewed billing config.

## Analysis Stream Public UI Direction

Recommended public-facing name: Campaign Build Log.

Rationale: it sounds useful to agents, describes the actual campaign assembly process, and avoids the developer/debug tone of "Analysis Stream".

Future public log behavior should show plain-language steps first:

- Reviewing property context
- Reviewing target buyer angle
- Creating campaign strategy
- Generating full listing copy
- Creating social and email variants
- Analyzing uploaded images
- Preparing campaign download

Developer telemetry should move behind a collapsed details area per step:

- model;
- usage status;
- pricing status;
- input/output token counts;
- thinking/cached tokens;
- token-only cost;
- excluded grounding/tool charge note;
- compact inputs/outputs preview.

Do not remove the current developer stream until the public log exists. It remains useful for beta diagnosis.

## Output Preview And Editing UX

Current state:

- preview/output is a right-column `Section` titled `Preview`;
- generated copy is editable in a large textarea;
- main tabs group sections such as Listing, Social Media, Blog, and Video;
- sub-tabs select individual outputs;
- selecting an empty variant can auto-generate it after Full Copy exists;
- users can refine the selected tab with a free-text instruction;
- editing a tab updates local version state and marks save status locally;
- regenerating Full Copy clears sibling tabs in that version to avoid stale campaign downloads.

Options reviewed:

| Option | Assessment |
|---|---|
| A. Read-only structured preview with refine actions | Best near-term direction. It clarifies what the AI produced and keeps refinement agentic. |
| B. Editable mini word-processor style area | Higher complexity and likely duplicate work users will do in Word, Google Docs, CRM, or portal tools. |
| C. Canvas-like selection/refine/edit workflow | Powerful later, but too much interaction design and state risk for the next sprint. |
| D. Single-column anchored output layout with top section navigation | Best layout direction for campaign clarity, especially once many tabs exist. |

Recommendation: next sprint should combine A and D. Build a structured Campaign Outputs flow where each section is readable, anchored, and has local actions: copy, export, refine, regenerate, and mark reviewed. Keep lightweight text editing available as an "Edit text" mode per section, but do not make a full word processor the first investment.

## Export And Download Behavior

Current selected tab export:

- `Export Current` exports the selected tab only;
- available formats are Word `.doc`, text `.txt`, and Print/PDF;
- Word export is HTML inside a `.doc` blob with `application/vnd.ms-word`;
- selected-tab filename is the tab name, for example `Full-Copy.doc` or `Instagram.txt`;
- PDF uses `window.print()` and the hidden `print-render-area`.

Current full campaign export:

- `Download Full Campaign` requires Full Copy for the active version;
- it generates any missing tabs before export;
- it creates one combined campaign document with section dividers;
- available formats are Word `.doc`, text `.txt`, and Print/PDF;
- filename shape is `{address-or-property}-full-campaign-v{version}`;
- individual tab documents are not created in the full campaign flow;
- no ZIP export exists.

What ZIP export would require:

- a client-side ZIP dependency or server-side packaging endpoint;
- deterministic filename sanitization for address, version, and tab names;
- a shared renderer that can produce the master document and each section document consistently;
- clear packaging labels in the UI;
- tests that missing-variant generation is complete before packaging.

Recommended export model:

1. Download selected section.
2. Download full campaign document.
3. Download full campaign ZIP containing one master document and each tab as a named separate document.

Implementation should start with shared export assembly helpers before adding ZIP packaging. That keeps the current full campaign behavior intact and reduces duplicate document-format logic.

## Layout And Navigation

Current layout is a three-column desktop grid:

- left: sticky Analysis Stream and photo analysis task monitor;
- middle: inputs and generation controls;
- right: research previews, visual highlights, and output preview.

The two-output-column behavior creates cognitive load because research preview, campaign output, logs, and controls compete in one viewport.

Future layout options:

- retained multi-column layout for desktop power use;
- wider single-column document flow for campaign outputs;
- sticky top section navigation across generated output sections;
- collapsible Campaign Build Log;
- section anchor jumps;
- right-side floating action controls for copy/export/refine;
- separate Campaign Outputs page/state once a Full Copy exists.

Recommendation: test a wider single-column Campaign Outputs state after generation, with sticky top section navigation and a collapsible Campaign Build Log. Keep the input workspace available, but avoid making the generated campaign compete visually with research cards and debug telemetry.

## Internal Auditor Passes

Scope Auditor: passed. This review added no platform integration, provider integration, runtime behavior, database schema, broad redesign, env files, or secrets.

Model Routing Auditor: passed. Current Pro/Flash usage is documented from `api/copywriting.ts`, including the Pro-only AI Strategy Analysis route and mixed variant routing.

Cost Auditor: passed. Token-only display limitations, unknown pricing behavior, thinking/cached token handling, and excluded grounding/tool charges are documented.

UX Auditor: passed. Preview/editing options are compared and the recommended next direction is a structured Campaign Outputs flow with refine actions.

Export Auditor: passed. Current selected-tab and full-campaign export behavior are documented, including file formats, naming, single-document full campaign behavior, and ZIP requirements.

Analysis Stream Auditor: passed. Recommended public direction is Campaign Build Log, while retaining developer telemetry behind future collapsed details.

Git Hygiene Auditor: passed. `git diff --check` passed, `npm run build` passed, and only docs/notes files were modified.

## Blocked Items

- No provider calls were made, so runtime model success/failure rates were not measured.
- No Vercel billing dashboard or provider billing dashboard was inspected.
- No live generation tests were run by design.
- Current deployed environment variable values were not inspected.
- Current Production/Preview Vercel deployment state was taken from task context only.

## Next Recommended Implementation Goal

`WEBAGENTS-COPYWRITING-RELIABILITY-EXPORT-UX-001`

Narrow scope:

1. Add operation-level concurrency guards for campaign-mutating AI actions.
2. Add strategy JSON validation and a parse-repair retry path.
3. Add tests for usage normalization and batch usage aggregation.
4. Rename and restructure the Analysis Stream as a Campaign Build Log with collapsed technical details.
5. Extract shared export assembly helpers.
6. Add clearer export labels for selected section versus full campaign document.

Do not include ZIP export, model-provider abstraction, Hub integration, auth, billing, or a full layout rewrite in that goal.
