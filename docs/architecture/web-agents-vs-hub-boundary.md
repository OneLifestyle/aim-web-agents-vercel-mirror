# Web Agents Vs Hub Boundary

Status: architecture boundary for `WEBAGENTS-SOURCE-LIFT-PLAN-001`.

`aim-web-agents` owns production workstation experiences. AIM Hub owns durable business and workspace state.

## Hub Owns

Hub owns:

- identity;
- account and profile;
- Asset Inbox;
- wallet and credits;
- property records;
- job records;
- asset storage;
- ledger;
- timeline;
- sharing;
- workspace state.

## Web Agents Own

Web Agents own tool experiences for creating, reviewing, editing, previewing, exporting, and preparing campaign outputs.

Examples:

- copywriting workspaces;
- photo upgrade and batch-production workstations;
- appraisal evidence and report preparation workstations;
- website build workspaces;
- video production workstations;
- measure cleanup, reporting, and export tools.

## Correct Long-Term Pattern

```text
Hub asset or property context -> Web Agent workstation -> reviewed output -> Hub-owned save or routing workflow -> Hub records asset/job/ledger/timeline
```

The web app may provide the working surface. Hub must remain the durable system of record.

## Blocked Ownership

`aim-web-agents` must not become the owner of:

- user identity;
- billing or wallet state;
- property database state;
- job ledger state;
- asset storage source of truth;
- sharing records;
- workspace memory;
- production model-router backend;
- provider secrets;
- licensed data administration.

## Current Integration Boundary

Do not add Clerk, Stripe, OpenRouter, Hub save/retrieve, provider integrations, shared AIM model-router integration, live API routes, or environment files until a later task explicitly approves them.
