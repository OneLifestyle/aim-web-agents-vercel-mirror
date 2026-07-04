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

The Web Agents monorepo should source-lift one app at a time and avoid building a giant shared root stack before each app is independently understood.

Copywriting Web is already completed and frozen as a standalone private-beta baseline. It remains standalone until a separate task explicitly approves import or maintenance.

Photo Web is the current likely next source-lift candidate because mobile Photo Agent should focus first on capture/import/adjust/export, while AI upgrades and batch production are more natural on web.

Appraisal Web is a strong source-lift candidate after or alongside Photo Web because it appears technically liftable, but it requires more careful risk handling before import.

## Avoided Mistake

The next public proof of `aim-web-agents` should not be Appraisal Web.

Appraisal is evidence-sensitive, attribution-sensitive, and valuation-adjacent. It can be mistaken for valuation advice if framed poorly. It must not rely on licensed Australian property data dependencies unless those permissions and contracts are explicit outside this repo, must not scrape portals, and must require human review.
