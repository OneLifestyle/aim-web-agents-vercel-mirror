# Hub Boundary

AIM Hub owns durable workspace and business state.

Hub owns:

- identity;
- wallet;
- credits;
- profile;
- properties;
- jobs;
- assets;
- ledger;
- storage;
- sharing;
- timeline;
- workspace state.

Web agents generate, edit, and preview outputs.

## Correct Integration Pattern

```text
tool output -> save to Hub property -> Hub records job/asset/ledger/timeline -> other tools retrieve from Hub
```

In this pattern, the web agent creates or edits an output, then the durable record is saved through Hub. Hub records the job, asset, ledger entry, timeline event, and property relationship. Other tools retrieve durable context from Hub.

## Incorrect Integration Pattern

```text
web agent directly controls other apps
```

Web agents should not become command centers for other applications or create competing sources of truth. Cross-tool state should be mediated by Hub-owned records and service-owned APIs.
