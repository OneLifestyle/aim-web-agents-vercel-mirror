# Web Agent Risk Guardrails

Status: planning guardrails for source-lift and private beta.

These guardrails apply before a web agent moves from source mining to production use.

## Global Guardrails

- Source-lift one app at a time.
- Keep each app independently understandable before extracting shared packages.
- Do not add a giant shared root stack before app needs are proven.
- Keep provider calls that require secrets server-side before production use.
- Do not commit secrets, provider keys, environment files, credentials, session data, or private configuration.
- Do not add Clerk, Stripe, OpenRouter, Hub integration, provider routing, database integrations, or live API routes unless separately approved.
- Require private-beta hardening before public launch.
- Require cost and model-routing review before shared AIM model-router integration.
- Preserve Hub ownership of durable account, property, job, asset, ledger, timeline, storage, sharing, and workspace records.

## Copywriting Web

Copywriting Web remains a standalone private-beta baseline until separately approved. Keep the Gemini/direct grounded research path valid until any OpenRouter or Vercel AI SDK replacement is proven.

Future Hub records may include copy assets, source/citation records, job records, timeline events, and possibly Asset Inbox items, but Hub integration is not approved here.

## Photo Web

Photo Web should focus on AI upgrade, batch production, and review workflows. Later guardrails should include before/after review, output-integrity checks, provenance of input images, and clear export handling.

OpenRouter Image API, Reve, OpenAI image editing, Gemini/Nano Banana, FLUX, Adobe/Firefly, and Stability may be benchmarked later. Do not implement provider routing in this planning task.

## Appraisal Web

Appraisal Web must remain private/internal first.

Blocked framing and behavior:

- AVM;
- instant valuation;
- valuation advice;
- licensed-data strategy without explicit rights;
- portal scraping;
- public consumer-facing price promises;
- replacement for professional judgement.

Allowed framing:

- appraisal preparation support;
- evidence review;
- comparable-property note preparation;
- market context drafting;
- agent-facing private workstation;
- report preparation requiring human review.

Human review is mandatory.

## Website Web

Website Web is web-first and should eventually build from Hub property and campaign assets. It must not become the durable property or campaign system of record.

## Video Web

Video Web may use existing web source and old Vision Ken Burns logic as source mines. Free deterministic mobile video remains separate. Heavier AI motion, voiceover, and branded variants belong on web after provider and cost review.

## Measure Web

Mobile remains the capture layer for LiDAR or room capture. Web should focus on editing, cleanup, report/export, and Hub packaging.
