# Appraisal Web Risk Guardrails

Status: planning guardrails for future source-lift.

Appraisal Web must remain private/internal first until its evidence, attribution, and framing risks are controlled.

## Product Framing

Appraisal Web must not present itself as an automated valuation model or valuation advice product.

Allowed framing:

- appraisal preparation support;
- evidence review;
- comparable-property note preparation;
- market context drafting;
- agent-facing appraisal workflow assistance;
- private internal workstation.

Blocked framing:

- AVM;
- instant valuation;
- certified valuation;
- financial advice;
- consumer-facing price promise;
- public valuation authority;
- replacement for licensed professional judgement.

Blocked data behavior:

- portal scraping;
- unapproved licensed Australian property-data dependencies;
- hidden evidence sources;
- consumer-facing automated valuation claims.

## Evidence And Attribution

Appraisal outputs should make source quality visible.

Future hardening should record:

- which evidence was used;
- where evidence came from;
- whether the source is licensed, public, user-provided, or internal;
- when the evidence was accessed or supplied;
- confidence limits;
- known exclusions;
- whether any comparable sale or market data is incomplete.

## Data Dependency Guardrail

Do not add licensed Australian property data dependencies inside `aim-web-agents` unless rights, contracts, and usage boundaries are explicit outside this repo.

The first Appraisal source-lift should prefer user-supplied, public, or already-authorized internal evidence, with clear attribution and limitations.

Human review is mandatory. Appraisal Web may prepare evidence notes and report drafts, but it must not publish or present outputs as final valuation advice without professional review.

## Private/Internal First

Appraisal Web should stay protected during source mining and hardening.

Expected controls:

- beta gate or preview protection;
- no public indexing;
- no production consumer-facing claims;
- no committed credentials or provider keys;
- no exposed private data;
- no durable property or ledger state owned by the web app.

## Hub Boundary

If Appraisal Web later saves durable outputs, those records should flow through AIM Hub. Hub owns property, job, asset, ledger, timeline, account, profile, workspace, storage, and sharing records.

`aim-web-agents` may own the appraisal workstation experience. It must not become the appraisal system of record.
