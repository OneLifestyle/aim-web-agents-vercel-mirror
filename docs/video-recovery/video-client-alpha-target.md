# AIM Video client-alpha target assessment

Task: `WEBVIDEO-IMPORT-001`
Target next goal: `WEBVIDEO-CLIENT-ALPHA-001`

## Feasibility

The deterministic client-alpha is feasible from the selected composite foundation, but the imported app is not yet close to an operator deliverable. The UI vocabulary exists; the production spine does not. The gating architecture is one renderer-neutral project/timeline contract shared by preview and export, plus an encoder that proves a real portal-safe 16:9 MP4.

## Target-by-target assessment

| Client-alpha target | Current assessment | Basis |
| --- | --- | --- |
| 15–30 photographs | Partially present | Multi-file input exists, but no 15–30 validation, decoded-media limits or batch UX proof |
| Manual ordering | Major missing architecture | Imported cards are not reorderable; stable shot IDs/order must be part of project state |
| Duration per shot | Partially present | Per-shot integer duration drives preview/timeline width, not a shared frame evaluator |
| Still treatment | Straightforward next build | Add an explicit identity crop path to the new tested motion contract |
| Zoom in | Partially present | UI exists but donor semantics are reversed and not exportable |
| Zoom out | Partially present | Same issue |
| Pan left | Partially present | UI exists but frame-edge protection and export parity are missing |
| Pan right | Partially present | Same issue |
| Full preview | Major missing architecture | Existing CSS/timer preview is neither frame-accurate nor shared with export |
| Licensed background music | Major missing architecture | Upload card only; rights metadata, decode, trim/loop/fade and mix are missing |
| Property title/address | Partially present | Address text overlay exists only in volatile DOM state |
| End card | Partially present | Form and DOM preview exist; timing/composition are broken |
| Optional watermark | Straightforward next build after renderer | Requires a safe-area overlay contract and renderer support |
| Branded output | Major missing architecture | Needs deterministic overlay/end-card/theme variant composition |
| Portal-safe output | Blocked by renderer decision | Needs output specs, safe areas, bitrate/profile/audio validation and real portal test |
| Real downloadable 16:9 MP4 | Blocked by renderer decision | No encoder/compositor/download path exists |
| Local project reopen | Major missing architecture | Needs versioned project schema, local asset references, validation and migrations |
| Replace one shot | Major missing architecture | Stable shot IDs/assets and cache invalidation do not exist |
| Retime one shot without rebuilding everything | Major missing architecture | Requires per-shot render artifacts or incremental composition strategy |

## Already working

- isolated Video package installation, typecheck, lint, production build and local runtime;
- provider-free local single-image intake;
- visible 16:9 editor preview and shot card;
- in-memory duration, overlay, end-card and start/end framing concepts;
- no dependency on protected app lanes or Hub-owned durable state.

## Straightforward next-build items

- enforce a 15–30 image operator intake contract;
- implement accessible drag/keyboard ordering;
- add the still preset;
- model watermark, brand and portal-safe variants as deterministic project options;
- add structured errors, cancellation and progress states once the renderer contract exists.

## Major missing architecture

- versioned project, asset, shot, track, overlay and output contracts;
- one deterministic crop/frame evaluator used by preview and export;
- real image/audio/text/logo composition;
- MP4 encoder and verified download;
- local project bundle/reopen and asset relinking;
- shot-level cache/invalidation for replacement and retiming;
- robust upload, rights and temporary-output handling.

## Renderer decision

The next task must make an evidence-based compositor choice. Remotion is not added by this recovery goal. The choice may be Remotion, WebCodecs, FFmpeg/WASM or a bounded local/server renderer, but it must be selected by proving:

- deterministic 1920×1080 frame output;
- preview/export parity from the same project evaluator;
- licensed audio mix and overlay composition;
- a real downloadable MP4 with recorded codec/container evidence;
- acceptable operator-device performance for 15–30 photographs;
- cancellation, progress, failure and temporary-file behavior.

## Product conclusion

The imported baseline is a useful editor seed, not a finished video maker. A focused deterministic build can reach the client-alpha without any generative-video provider. Generative motion should remain out of scope until the complete-property production spine is proven.
