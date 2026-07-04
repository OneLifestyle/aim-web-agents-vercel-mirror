# Web Agents Backlog

Status: planning backlog only.

## Next

### Photo Web Source-Mine And Workstation Plan

Goal: define Photo Web as the likely next AI upgrade and batch-production workstation after the frozen Copywriting baseline.

Scope:

- identify source location and working state;
- define upload, Hub asset, and future mobile Photo Agent capture inputs;
- define batch-production, before/after review, and output-integrity needs;
- list provider benchmark candidates without implementing provider routing;
- define private-beta hardening path.

Out of scope:

- Clerk;
- Hub integration;
- Stripe;
- Firebase;
- Cloudflare;
- OpenRouter;
- Vercel AI SDK;
- shared packages;
- production-domain work;
- new provider routes;
- new auth;
- new billing;
- database integration;
- environment files;
- secrets.

## Frozen Baseline

### Copywriting Web

Position: operational standalone private-beta baseline. Keep frozen until a separate task approves import or maintenance.

Future import target likely:

```text
apps/copywriting
```

Keep Gemini/direct grounded research valid until any OpenRouter or Vercel AI SDK replacement is proven.

## After Or Alongside Photo

### Appraisal Web Standalone Source-Mine Audit

Goal: inspect Appraisal Web in its existing source location before any import.

Scope:

- identify source location and working state;
- confirm whether it runs outside AI Studio or v0;
- identify provider calls and key handling;
- audit evidence, citation, and source quality;
- remove or block AVM and valuation-advice framing;
- block portal scraping;
- avoid licensed Australian property-data dependencies unless rights are explicit outside this repo;
- require human review;
- define private/internal preview protection;
- tag or freeze a hardened standalone baseline before import.

## Later

### Website Web

Position: web-first by nature, likely from Vercel or v0 source.

### Video Web

Position: later workstation using existing web source and old Vision Ken Burns logic as source mines.

### Measure Web

Position: last. Mostly editing, export, and report layer after mobile capture.
