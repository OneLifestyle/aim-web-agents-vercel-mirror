# App Source Inventory

Status: current source-lift inventory for `WEBAGENTS-SOURCE-LIFT-PLAN-001`.

This inventory records the current orchestration recommendation. It does not import source and does not approve provider, auth, billing, or Hub integrations.

| Sequence | App | Current Position | Intended Web Agents Role | Required Guardrails |
| --- | --- | --- | --- | --- |
| 1 | Copywriting Web | Operational standalone private-beta baseline; frozen until separately approved. | Future import target likely `apps/copywriting`; copy asset and source/citation preparation workstation. | Keep grounded Gemini/direct research path valid until replacement is proven; no immediate import; no Hub integration without approval. |
| 2 | Photo Web | Likely next source-lift candidate. | AI upgrade and batch-production workstation receiving uploads, Hub assets, or future mobile Photo Agent captures. | Before/after review, output-integrity checks, private beta, provider benchmarking only, no provider routing yet. |
| 3 | Appraisal Web | Strong source-lift candidate, but higher risk. | Private/internal evidence review and appraisal-report preparation workstation. | No AVM framing, no licensed Australian property-data dependency, no portal scraping, human review mandatory. |
| 4 | Website Web | Web-first candidate, likely sourced from Vercel or v0 work. | Property site and campaign page builder. | Use Hub property and campaign assets later; avoid durable state ownership in the web app. |
| 5 | Video Web | Later source-lift candidate using existing web source and old Vision Ken Burns logic as source mines. | Heavier AI motion, voiceover, and branded video variants on web. | Keep free deterministic mobile video separate; benchmark providers later. |
| 6 | Measure Web | Likely last; depends on mobile capture maturity. | Editing, cleanup, report/export, and Hub packaging after mobile LiDAR or room capture. | Mobile remains capture layer; web must not become the capture source of truth. |

## Copywriting Web

Copywriting Web is currently the standalone private-beta baseline and should remain frozen until a separate task explicitly approves import or maintenance.

Future import target is likely:

```text
apps/copywriting
```

The Gemini/direct grounded research path must remain valid until an OpenRouter or Vercel AI SDK replacement is proven. Future Hub relationship: Copywriting output may become a copy asset, source/citation record, job record, timeline event, and possibly an Asset Inbox item.

## Photo Web

Photo Web is the likely next candidate because mobile Photo Agent should focus first on capture, import, adjust, and export. AI upgrade work, batch production, before/after review, and output-integrity workflows fit more naturally on web.

Future source inputs may include:

- direct upload;
- Hub asset selection;
- future Photo Agent mobile capture.

OpenRouter Image API, Reve, OpenAI image editing, Gemini/Nano Banana, FLUX, Adobe/Firefly, and Stability can be benchmarked later. This inventory does not approve provider routing or provider integration.

## Appraisal Web

Appraisal Web appears technically liftable, but it should remain private/internal first because evidence and report workflows carry appraisal risk.

It must not be framed as an AVM, instant valuation, valuation advice, licensed-data strategy, or portal-scraping workflow. It should avoid licensed Australian property-data dependencies unless rights and usage boundaries are explicit outside this repo. Human review is mandatory.

Appraisal Web may later be a useful OpenRouter Fusion, Advisor, or Subagent testbed, but that work is not approved by this inventory.

## Website Web

Website Web is web-first by nature and likely came from Vercel or v0 source. It should eventually use Hub property and campaign assets rather than owning those records itself.

## Video Web

Video Web may combine existing web source and old Vision Ken Burns source as source mines. Free deterministic mobile video remains separate. Heavier AI motion, voiceover, and branded variants belong on web.

## Measure Web

Measure Web should probably come last. Mobile is the capture layer through LiDAR, room capture, or related field workflows. Web is the editing, cleanup, report/export, and Hub-packaging layer.
