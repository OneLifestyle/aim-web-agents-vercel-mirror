# AIM Video next build plan

## Exact next goal

**`WEBVIDEO-CLIENT-ALPHA-001 — Build and prove the deterministic complete-property-video production spine.`**

Deliver a local operator workflow for 15–30 property photographs with ordering, per-shot duration, still/zoom/pan motion, one full preview, licensed audio, address/title, end card, optional watermark, branded and portal-safe variants, a reopenable local project, shot replacement/retiming, and a real verified 16:9 MP4. Do this before any generative-video expansion.

## Starting point

- app: `apps/video`;
- source-recovery baseline: Vision Web editor surface frozen from `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`;
- algorithm reference: Vision Mobile `02e2925a0ecd2ffb8682db79f980447b913e845b`;
- workflow-pattern reference: active AIM Photo AI lane, read-only;
- provider state: none;
- renderer state: deliberately undecided;
- current output state: no MP4.

## Build sequence

### 1. Establish the minimum renderer-neutral contract and proof fixture

Create versioned, validated types for:

- project metadata and output variants;
- local asset references and media metadata;
- ordered shots with stable IDs and durations;
- normalized start/end crop rectangles and explicit still/zoom/pan presets;
- overlay, watermark, end-card and audio tracks;
- frame rate, canvas size, safe areas, codec/container target and render status.

Translate the useful Vision Mobile crop/preset math into web TypeScript with fixtures and tests. Correct its 4:3 bug, unchecked serialization and ignored easing/transition fields rather than copying them.

Before broad editor work, freeze one named `client-alpha-portal-1080p-v1` output profile with concrete container, video/audio codec, frame rate, pixel format, resolution, safe-area, bitrate and file-size requirements. Validate those values against the named target portals' current specifications during that goal.

### 2. Choose the compositor with the canonical proof fixture

Run a bounded renderer spike against the same canonical fixture for each viable option. Select one path only after it produces:

- 1920×1080, 16:9 frames from the shared evaluator;
- smooth deterministic crop interpolation;
- address/title, logo/end card and optional watermark;
- one licensed test audio track;
- a real downloadable MP4 whose container, video codec, audio codec, duration and resolution are verified;
- acceptable peak memory and elapsed time for a 30-shot representative project.

Do not purchase Remotion Editor Starter. Add Remotion only if the proof establishes it as the chosen compositor and the licence/deployment model is acceptable.

### 3. Harden intake and editing around the selected renderer

- accept and decode 15–30 supported photographs;
- enforce file count, size, dimension and type-signature bounds;
- provide accessible pointer/keyboard ordering;
- preserve per-shot settings during reorder and replacement;
- support duration and the five deterministic treatments;
- split project state, media intake, inspector, timeline and preview out of the monolithic recovery component.

Recreate Photo AI's clear file-error, progress and retry patterns without changing that protected app.

### 4. Make preview and export share one evaluator

- drive preview from a monotonic playhead and explicit frame rate;
- derive shot boundaries, overlays, audio and end-card timing from the project contract;
- use the same frame/crop/overlay evaluator in preview and render;
- add seek, pause/resume, progress, cancellation and actionable failures;
- compare representative preview frames with rendered frames.

### 5. Add local reopen and incremental rebuild

- save a versioned local project manifest and validated asset references/bundle;
- reopen with missing-asset relink guidance;
- cache shot-level render inputs/results by stable content/settings hash;
- invalidate only affected shots when replacing or retiming;
- reassemble the final project without regenerating unchanged shot media.

This remains local workstation state. It must not create Hub identity, asset, job, storage, timeline or workspace ownership.

### 6. Prove the operator milestone

Use synthetic or authorised fixtures only. Record:

- one 15-shot and one 30-shot project;
- every deterministic treatment;
- manual reorder, replace and retime;
- music, title/address, end card and watermark;
- branded and portal-safe variants;
- local save/close/reopen;
- successful MP4 download and media inspection;
- one cancelled export and one controlled failure;
- unchanged-shot cache reuse evidence.

## Acceptance criteria

- `npm install`, typecheck, lint and production build pass;
- app renders without browser console error at supported viewport sizes;
- no paid provider request, API key or browser secret exists;
- 15–30 images are supported within documented bounds;
- ordering and all five deterministic treatments are real, not labels;
- full preview and export use the same project/frame evaluator;
- audio and overlays are present in the exported file;
- a real 16:9 MP4 is downloaded and independently inspected;
- project reopen, shot replacement and retiming are demonstrated;
- unchanged shots are not rerendered unnecessarily;
- upload, temporary-output, cancellation and error paths are bounded;
- source/media/music/font/logo rights are recorded;
- Hub/auth/wallet/credits/billing/database/R2/deployment and generative video remain absent.

## Explicit non-goals

- Veo, Kling, Seedance or any other image-to-video provider;
- AIM Motion Pair or start/end-frame AI generation;
- narration generation;
- Hub, authentication, wallet, credits, billing, database, R2 or production storage;
- Vercel or any deployment;
- public-launch polish or a broad interface redesign.

## Stop gates

Stop for founder/architecture review if:

- no candidate renderer can prove the target MP4 on representative hardware;
- preview/export parity requires two unrelated rendering implementations;
- required music/font/media rights cannot be established;
- project reopen would require taking over Hub-owned durable business state;
- a provider, paid licence or production service becomes necessary to complete the deterministic milestone.
