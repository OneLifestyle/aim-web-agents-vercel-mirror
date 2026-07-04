# Appraisal Web Source-Lift Candidate

Status: strong source-lift candidate, but no longer the sole next recommendation.

This document originally recorded Appraisal Web as the first new source-lift candidate after Copywriting. `WEBAGENTS-SOURCE-LIFT-PLAN-001` keeps that context but updates the current orchestration recommendation: Photo Web is likely next, and Appraisal Web should follow after or run alongside Photo Web as a private/internal evidence workstation.

## Position

Appraisal Web remains a strong source-lift candidate after Copywriting Web, but it should not be treated as the next public production lane.

It should not be the first app imported into `aim-web-agents`.

The safer working path is:

1. Keep Copywriting Web frozen as the standalone private-beta baseline until separately approved.
2. Source-mine Photo Web as the likely next AI upgrade and batch-production workstation.
3. Source-mine Appraisal Web after or alongside Photo Web, private/internal first.
4. Import Appraisal Web later only after risk guardrails, human-review rules, and a frozen baseline are in place.

## Why It Comes After Copywriting

Appraisal Web carries more product and compliance risk than Copywriting Web because:

- it is evidence-sensitive;
- it can be mistaken for valuation advice;
- attribution and source quality matter;
- it must avoid AVM framing;
- it must avoid licensed Australian property data dependencies unless those rights are explicit;
- it must not scrape portals;
- human review is mandatory;
- it must remain private/internal first.

## Source-Mine Scope

The Appraisal Web source-mine task should inspect and harden the existing source in place before import.

Minimum audit:

- identify source location;
- confirm current working state;
- confirm whether it runs outside AI Studio or v0;
- identify provider calls;
- confirm provider keys are protected;
- audit evidence, citations, and source quality;
- remove or block valuation-advice and AVM framing;
- block portal scraping;
- avoid licensed Australian property-data dependencies unless rights are explicit outside this repo;
- require human review;
- add or confirm private/internal preview protection;
- correct model and cost assumptions;
- tag or freeze a hardened standalone baseline.

## Import Gate

Appraisal Web should be imported only after the standalone source-mine audit has produced a hardened baseline and a specific import task.

The import should not add Hub integration, auth, billing, provider routing, database integrations, production domains, or shared package abstractions unless later tasks explicitly authorize them.
