# Web Agents Source Context

Status: local copied context only. `aim-docs` remains canonical.

## Product Model

The operating model is:

```text
Mobile captures the field reality.
Hub organises the asset memory.
Web workstations turn that memory into campaign outputs.
```

Web Agents are professional AI production workstations. They help agents prepare campaign outputs from property memory, media, evidence, prompts, and review workflows.

## Ownership Boundary

`aim-web-agents` owns tool experiences.

AIM Hub owns the system of record.

Web Agents may generate, edit, review, preview, and prepare outputs. Hub stores durable property, job, asset, ledger, timeline, account, profile, workspace, and sharing records.

## Source-Lift Direction

The Web Agents monorepo should prove itself with the lowest-risk complete app first.

Copywriting Web is that first likely import candidate because it has already been completed and frozen as a standalone private-beta baseline.

Appraisal Web is a better source-lift candidate after Copywriting because it requires more careful risk handling before import.

## Avoided Mistake

The first proof of `aim-web-agents` should not be Appraisal Web.

Appraisal is evidence-sensitive, attribution-sensitive, and valuation-adjacent. It can be mistaken for valuation advice if framed poorly. It must not rely on licensed Australian property data dependencies unless those permissions and contracts are explicit outside this repo.
