# Appraisal Web Source-Lift Candidate

Status: planned future app-scoped lane after Copywriting and Photo AI unless orchestration changes the sequence.

This document originally recorded Appraisal Web as the first new source-lift candidate after Copywriting. `WEBAGENTS-SOURCE-LIFT-PLAN-001` keeps that context but updates the current orchestration recommendation: Copywriting Web and Photo AI Web are active app-scoped lanes, and Appraisal Web should follow as a private/internal evidence workstation unless orchestration changes the sequence.

## Position

Appraisal Web remains the next planned web-app lane after Copywriting and Photo AI unless orchestration changes the sequence, but it should not be treated as the next public production lane.

It should not be the first app imported into `aim-web-agents`.

The safer working path is:

1. Keep Copywriting Web in the `aim-web-agents-copywriting` app-scoped lane.
2. Keep Photo AI Web in the `aim-web-agents-photo-ai` app-scoped lane.
3. Prepare Appraisal Web as a future app-scoped lane, private/internal first.
4. Import or implement Appraisal Web later only after risk guardrails, human-review rules, and a frozen baseline are in place.

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

The Appraisal Web source-mine task should inspect and harden the existing source in place before import or implementation.

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
