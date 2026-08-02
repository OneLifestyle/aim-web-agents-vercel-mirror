# AIM Video Web source audit

Task: `WEBVIDEO-IMPORT-001`
Audit date: 2026-08-02
Destination: `apps/video`

## Executive result

The recoverable sources split into two different product ideas:

- the OneLifestyle and legacy AI Studio sources are paid, per-shot generative-video workbenches;
- Vision Web and Vision Mobile contain the beginning of a deterministic complete-property-video editor.

No donor already delivers the requested client-alpha. The selected foundation is **D — a composite source lift**. The provider-free Vision Web editor surface is the buildable baseline; Vision Mobile's normalized crop/timeline contract is a translation reference for the next build; Photo AI contributes later intake/status/review patterns. All generative-provider code is deferred.

## Worktree stop-gate evidence

Before mutation, the dedicated worktree was confirmed as:

- root: `/Users/sgbcproperty/.codex/worktrees/faac/aim-web-agents`;
- branch: `codex/webagents-video-import-001`;
- HEAD/base: `c1bcf3460b0f2f2e60d836b70d9dbf208dfc719b`;
- live `origin/main`: the same SHA, checked with `git ls-remote` and without fetch or pull;
- clean working tree;
- distinct from `/Users/sgbcproperty/Developer/RealEstateAIM/aim-web-agents`;
- no other Video branch or worktree collision;
- `apps/video` contained only `.gitkeep`.

Copywriting, Photo AI, and Appraisal were separate worktrees. They were not modified. Photo AI already had active, changing work from its owning lane during this read-only inspection; that state was not created or altered here.

## Source summary

| Source | Frozen SHA | What it actually is | Runtime result | Foundation value |
| --- | --- | --- | --- | --- |
| OneLifestyle Video | `0fa6ddbb0836965d6ab2d982680e64e6d9a081ad` | Google AI Studio Photo Agent clone adapted into a Veo single/pair-shot generator | Rendered after legacy peer install; typecheck and Vite build passed; provider path not invoked | Provenance and generative-workflow evidence only; reject direct continuation |
| Photo AI worktree | `c08235e5` at inspection start | Active AIM Photo production lane | Read-only pattern audit only | Intake, batch/status, before/after, retry and download patterns for later recreation |
| Vision Web | `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5` | Mixed web/mobile/backend repository with an in-memory deterministic Video Editor prototype | Web editor route rendered; repository lint/build failed outside the isolated editor | Editor vocabulary, framing UI, timeline-shaped lanes and overlays |
| Vision Mobile | `02e2925a0ecd2ffb8682db79f980447b913e845b` | Combined mobile Vision app with a native Ken Burns workflow/exporter | Static audit only; physical-device proof remains absent | Normalized crop/timeline contracts and frame-calculation lessons |
| Legacy project | `dde8236a2c3211db3216df81f3b123f1811b6f98` | Placeholder Video shell plus AI Studio generative-video source and CRM provider routes | AI Studio UI rendered and built; typecheck failed | Historical lineage and provider-risk evidence only |
| Imported AIM Video | repository commit created by this task | Minimal Vite/React shell around approved provider-free Vision editor files | Install, typecheck, lint, build, dev render and synthetic upload passed | Reproducible local baseline, not a client-alpha |

## OneLifestyle source audit

### Identity and framework

- Repository: `https://github.com/OneLifestyle/RE-AIM-Video-Agent-1-1-26.git`
- Local source mine: `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/RE-AIM-Video-Agent-1-1-26`
- Default/current branch: `main`
- Frozen HEAD: `0fa6ddbb0836965d6ab2d982680e64e6d9a081ad`
- Working tree: clean
- History: two commits, `0fa6ddb` and `5e4d60b`
- Stack: Vite, React, TypeScript, `@google/genai`
- Package manager: npm by package metadata, but no lockfile
- Package scripts: none; runtime commands had to be supplied explicitly
- Documented environment surface: `process.env.API_KEY`; no environment file was committed

### Photo Agent and Google AI Studio lineage

The lineage is explicit rather than inferred:

- package name remains `real-estate-photo-enhancer`;
- README, development history, implementation plan and prompt manual describe a Photo Agent;
- stale Photo components and services remain for geometry, comparison, upscaling, address verification and image processing;
- `metadata.json` and migrated prompt history retain Google AI Studio context;
- the only substantive Video addition is an in-memory shot/pair workflow that calls Google's video APIs directly from browser code.

The repository also contains about 8.4 MB of migrated prompt history with embedded attachments and an unused property JPEG. Those assets were excluded because their reuse authority is not established.

### Actual Video functionality

The active Video surface can ingest several images, select/reorder shot cards, pair start and end images, collect a movement/atmosphere prompt, select a nominal duration and resolution, estimate a hard-coded cost, request one paid Veo clip, preview that returned clip and expose a download action.

It is not a complete-property-video editor. There is no shared project timeline, deterministic still/zoom/pan compositor, audio track, overlays, end card, project reopen, full-project preview, project MP4 export or incremental shot rebuild.

The duration control is not sent to the provider. The ambient-audio toggle only affects displayed pricing. The downloaded response is labelled MP4 without validating its MIME type, container or codec.

### Runtime reproduction

Isolated runtime: `/private/tmp/webvideo-onelifestyle-runtime.VVVV8B`

- normal `npm install`: failed because `upscaler@1.0.0` expects TensorFlow.js `~4.11.0` while the app declares `^4.22.0`;
- legacy-peer install: passed, reporting one moderate and one high advisory;
- explicit TypeScript check: passed;
- Vite production build: passed, producing roughly 474 KB of JavaScript;
- Vite development runtime: rendered at port 41731;
- credential-free synthetic-image intake: rendered;
- browser evidence: stale Photo Enhancer title, Tailwind CDN production warning and invalid DOM nesting warning;
- paid generation: not invoked;
- real MP4: not produced.

## Photo AI donor audit

The exact active worktree was `/Users/sgbcproperty/.codex/worktrees/609e/aim-web-agents`, branch `codex/photo-ai-standalone-vercel-001`. It was inspected read-only and remained owned by its active lane.

Patterns worth recreating later:

- validated file intake and HEIC-aware error states;
- explicit focused-image, batch-selection and download-selection state;
- staged job/progress statuses;
- before/after review and results-gallery composition;
- intermediate review, retry/rerender controls and same-origin API client boundaries;
- AIM's more current workstation visual language.

It does not supply a timeline, shot ordering, project persistence or video renderer. Its active uncommitted Vercel work was not treated as frozen authority, and the app was not converted into Video.

## Vision Web audit

### Identity and structure

- Repository: `https://github.com/Singularealty/Real-Estate-AIM-Vision-Web.git`
- Local source mine: `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/Real-Estate-AIM-Vision-Web`
- Default/current branch: `main`
- Frozen HEAD: `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`
- Working tree: clean
- Web stack: Vite 7, React 19, TypeScript 5.9, npm lockfile
- Wider repository: React Native app plus Express/SQLite/auth/IAP/credits/Replicate backend

The relevant `VideoEditorPage` defines in-memory image slides, overlays, an end card and audio records. It renders image, chyron and audio-shaped lanes, duration-proportional shot cards, CSS Ken Burns preview state, start/end rectangles, address/price fields and end-card fields.

### Material limitations

- shot cards are not reorderable despite a grab cursor;
- Zoom In/Out preset values are reversed relative to the CSS transform;
- pan presets can expose empty frame edges;
- start/end resize direction is mathematically broken and mouse-only;
- selecting a timeline shot originally did not align the previewed shot;
- preview uses a synthetic 100 ms interval, not a frame-clock or shared renderer;
- audio files are represented but never decoded, played, timed or mixed;
- overlays all start at zero and occupy the same screen position;
- the end card is omitted from total duration and repeatedly schedules timeouts;
- the Export button has no handler; there is no encoder, file, progress or download;
- project state is component memory only.

### Runtime reproduction

Isolated runtime: `/private/tmp/webvideo-visionweb-runtime.w6oN82`

- `npm ci`: passed, reporting 23 advisories (including 15 high and 4 critical);
- lint: failed with six errors and one warning;
- full repository web build: failed on invalid JSX in an unrelated `CameraHome` file;
- development route `/video-editor`: rendered at port 41732;
- synthetic image: accepted and displayed in a three-second timeline;
- provider calls: none;
- real MP4: not produced.

The entire repository was therefore rejected as foundation C. Only the provider-free editor surface and theme were lifted into a minimal dependency shell.

## Vision Mobile audit

The active local source is `/Users/sgbcproperty/Developer/RealEstateAIM/vision-agent-mobile-source`, frozen at `02e2925a0ecd2ffb8682db79f980447b913e845b` and documented by tag `reaim-v2-freeze-vision-mobile-2026-05-06`. Its only working-tree change was a pre-existing `.DS_Store`; it was not modified.

Material Video findings:

- `kenBurnsSpecs.ts` defines versioned clip/timeline records, normalized start/end crop rectangles, cover-crop calculation, push/pull/pan presets, duration, aspect, easing, rotation and transition fields;
- `KenBurnsStudioScreen.tsx` has up to 20 imported images, discrete durations, manual ordering, per-shot and sequential preview, and export invocation;
- `KenBurnsExporter.swift` uses AVAssetWriter for local H.264 `.mov`, normally 1920×1080 at 30 fps, with per-frame linear crop interpolation.

The contract is a translation candidate, not code to copy blindly. Preview and export use different engines; easing and transitions are ignored; 4:3 maps incorrectly to 1920×1080; there is no MP4, audio, overlay, watermark, progress, persistence, replacement or partial rebuild; unreadable frames can be skipped. Existing AIM notes explicitly lack physical-device validation. No mobile build or paid path was run.

## Limited legacy audit

Sparse source mine: `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/Real_Estate_AIM_PROJECT`, clean at `dde8236a2c3211db3216df81f3b123f1811b6f98`.

Only `apps/video-web`, `apps/video-web-ai-studio`, and the CRM Video API routes were inspected. `apps/video-web` is a package/README placeholder. The AI Studio app is another Photo-derived per-shot generative UI. It adds multiple upload, selection, reordering, optional start/end pairing, provider/model controls and clip preview, but no deterministic timeline, audio/overlay composition, persistence or project export.

Its isolated runtime at `/private/tmp/webvideo-legacy-runtime.h8kRLB` installed and built, but typecheck failed because `@types/node` was undeclared. The UI rendered at port 41733 and accepted a synthetic image. No provider call or MP4 export was run.

## Imported baseline verification

Environment: Node `v20.19.6`, npm `11.9.0`.

| Check | Result |
| --- | --- |
| `npm install` | Passed; lockfile created |
| `npm audit --omit=dev` | Passed; zero production advisories |
| full `npm audit` after Vite update | Passed; zero advisories |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run build` | Passed with Vite 7.3.6; 220.00 KB JS before gzip |
| development runtime | Passed at `127.0.0.1:41734` |
| in-app browser render | Passed; title and editor shell visible |
| credential-free interaction | Synthetic image accepted; preview and three-second timeline visible |
| browser warnings/errors | None recorded |
| provider request | Not present and not invoked |
| real MP4 export | Not present; control intentionally disabled |

The first inherited Vite version produced one high-severity development-server advisory. It was narrowly updated from 7.1.7 to 7.3.6, after which the complete audit returned zero advisories.

## Audit conclusion

The imported app is a truthful, reproducible source-recovery baseline. Its strongest current functionality is the provider-free editor vocabulary and local image-preview/timeline surface. Its largest missing capability is a shared deterministic preview/export renderer that can produce a verified 16:9 MP4 with audio and overlays. The correct continuation is `WEBVIDEO-CLIENT-ALPHA-001`, not generative-video expansion.
