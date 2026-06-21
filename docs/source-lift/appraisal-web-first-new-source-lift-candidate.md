# Appraisal Web First New Source-Lift Candidate

Status: first new source-lift candidate after Copywriting.

## Position

Appraisal Web remains the next likely new source-lift candidate after Copywriting Web.

It should not be the first app imported into `aim-web-agents`.

The safer working path is:

1. Copywriting Web import into `apps/copywriting`.
2. Copywriting Web runtime proof from the monorepo location.
3. Appraisal Web standalone source-mine audit and hardening.
4. Appraisal Web import later, only after risk guardrails and a frozen baseline.

## Why It Comes After Copywriting

Appraisal Web carries more product and compliance risk than Copywriting Web because:

- it is evidence-sensitive;
- it can be mistaken for valuation advice;
- attribution and source quality matter;
- it must avoid AVM framing;
- it must avoid licensed Australian property data dependencies unless those rights are explicit;
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
- add or confirm private/internal preview protection;
- correct model and cost assumptions;
- tag or freeze a hardened standalone baseline.

## Import Gate

Appraisal Web should be imported only after the standalone source-mine audit has produced a hardened baseline and a specific import task.

The import should not add Hub integration, auth, billing, provider routing, database integrations, production domains, or shared package abstractions unless later tasks explicitly authorize them.
