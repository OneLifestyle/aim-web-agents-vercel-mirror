# Copywriting Chat Assistant Disabled 001

Goal ID: `WEBAGENTS-COPYWRITING-CHAT-ASSISTANT-DISABLE-001`

Date: 2026-06-26

Scope: disable the floating general AI Assistant entry point for the Copywriting Web private beta and preserve the idea as deferred product documentation only.

## Decision

The bottom-right floating `AI Assistant` button and chat panel are disabled for the current Copywriting Web private beta.

The primary beta UI should not expose:

- a floating general AI assistant;
- broad real-estate advice chat;
- open-ended legal, financial, appraisal or valuation-style assistant behavior;
- Hub/Command-style contextual assistant behavior inside this focused tool.

## Smoke-Test Finding

During trusted private-beta smoke testing, the floating `AI Assistant` control was found in the bottom-right of the app.

When opened, it displayed a chat-style assistant that could answer broad real-estate questions. This assistant was a future-looking idea, not part of the intended Copywriting private beta workflow.

## Reason

The floating assistant is too broad for the focused Copywriting private beta.

It could confuse testers by making the tool feel like a general real-estate advice assistant rather than a campaign copywriting workflow. It is also too close to future AIM Hub or AIM Command contextual assistant concepts, without the product boundaries, screen context, safety copy, provenance, or Hub integration required for that role.

The open-ended chat surface could also answer appraisal, legal, financial, compliance, or valuation-style questions outside the current product scope.

## Implementation

The primary `App.tsx` render path no longer mounts the floating chat assistant component.

The dormant component and API operation remain untouched for now, but they are not reachable from the primary Copywriting UI. No provider call, model routing change, Hub integration, auth, billing, storage, or dependency change was added.

## Deferred Assistant Ideas

A future assistant may return only after a separate product decision and implementation goal. Possible later forms:

- contextual Copywriting screen guide;
- beta help widget;
- screen-aware "what can I do here?" helper;
- AIM Hub contextual assistant;
- AIM Command helper.

Not implemented now:

- contextual assistant;
- Hub or Command integration;
- general advice assistant;
- legal, financial, appraisal or valuation assistant;
- support storage or support backend.

## Deferred Export And Settings Ideas

The user also raised future export/settings ideas that remain deferred only:

- Save with settings;
- include an input/settings snapshot with exported campaigns;
- include property overview, suburb/area profile, visual highlights, property details, copy context and property features as export metadata or an appendix;
- add copy controls to large research/context blocks such as Property Overview and Suburb & Area Profile;
- store settings/input snapshots for a future Hub asset audit trail.

These are not implemented in this goal. Current output, category, and campaign download behavior remains unchanged and generated-only.

## Preserved Behaviour

- Beta access gate remains on the existing path.
- Address lookup remains on the existing path.
- Fetch Details remains on the existing property research path.
- Copy Context AI Analysis remains on the existing strategy-analysis path.
- Property Features AI Analysis remains on the existing feature-analysis path.
- Image Analysis remains routed to the server-configured Gemini Flash model.
- AI Strategy Analysis remains routed to the server-configured Gemini Pro model.
- Generate Listing Copy remains on the existing generation path.
- Generate missing outputs remains on the existing generation path.
- Campaign Outputs remains on the existing path.
- Campaign Build Log remains available through the collapsed beta diagnostics presentation.
- Technical details remain available after expanding beta diagnostics.
- Download current output, current category, and campaign remain generated-only export actions.
- Download actions do not generate missing outputs.
- Outputs remain read-only in the primary v1 UI.
- Offer Architecture remains architecture-only and unchanged in intent.

## Internal Review

Scope Auditor: no Hub/auth/billing/storage/provider-router work was added.

Assistant Disable Auditor: the floating assistant button and panel are not mounted from the primary Copywriting UI.

Deferred-Idea Auditor: contextual assistant and Save with settings ideas are recorded as deferred only.

Regression Auditor: beta gate, Campaign Outputs, exports, generation controls, Campaign Build Log and technical details remain on existing paths.

Model Routing Auditor: AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Git Hygiene Auditor: no secrets, environment files, build outputs, dependency folders, screenshots, or Vercel config should be staged.
