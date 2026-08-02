# AIM Video capability matrix

Task: `WEBVIDEO-IMPORT-001`
Evidence date: 2026-08-02

## Classification rules

- **Working and verified**: exercised locally on a credential-free path during this audit.
- **Implemented but unverified**: substantive code exists, but its complete behavior was not exercised.
- **UI only**: a control or lane exists without the underlying media behavior.
- **Mock**: simulated values, progress, pricing or output.
- **Planned**: described by documentation but not implemented.
- **Missing**: no material implementation found.
- **Broken**: implementation exists but static or runtime evidence shows it cannot meet its claim.

Buttons and labels are not proof. No paid provider generation was run. No source or imported app produced a real MP4 during this task.

## Project intake

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Single-image upload | Working and verified | Working and verified | Synthetic local image rendered in both browser sessions |
| Multiple-image upload | Implemented but unverified | Implemented but unverified | Both file inputs accept multiple files; multi-file batch not exercised |
| Drag-and-drop | Implemented but unverified | Implemented but unverified | Drop handlers exist; chooser path was exercised instead |
| Image ordering | Implemented but unverified | Missing | OneLifestyle has in-memory reorder controls; Vision-derived cards have no reorder handler |
| Batch selection | Implemented but unverified | Missing | OneLifestyle selection state exists; imported baseline has one selected shot only |
| Property/project state | Missing | Missing | Imported editor has volatile page-local arrays, not a property or project model |
| Saved project state | Missing | Missing | No serialization or durable store |
| Local reopen | Missing | Missing | No IndexedDB/localStorage/file project contract |

## Storyboard and timeline

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Shot cards | Working and verified | Working and verified | A synthetic image produced a visible shot card |
| Timeline | Missing | UI only | Imported duration-proportional image lane is not a renderer-neutral timeline engine |
| Multiple tracks | Missing | UI only | Image, chyron and audio-shaped lanes exist; timing/composition is not shared |
| Shot ordering | Implemented but unverified | Missing | Imported grab styling has no reorder behavior |
| Shot duration | UI only | Implemented but unverified | OneLifestyle duration is not sent to Veo; imported duration drives CSS preview/timeline width |
| Trimming | Missing | Missing | No clip-edge or source trimming |
| Shot replacement | Missing | Missing | Delete/re-upload loses shot identity/settings |
| Transitions | Missing | Missing | No transition model or renderer |
| Complete-project timing | Missing | Broken | Imported total omits end-card time and uses synthetic interval timing |

## Deterministic motion

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Still treatment | Missing | Missing | `none` exists in a type/default map but has no exposed control |
| Zoom in | Missing | Broken | Imported preset uses 100→95 CSS scale, visibly reversing the label |
| Zoom out | Missing | Broken | Imported preset uses 95→100 CSS scale, visibly reversing the label |
| Pan left | Missing | Broken | Imported 100% scale plus translation can reveal empty frame edges |
| Pan right | Missing | Broken | Same edge-exposure issue |
| Ken Burns interpolation | Missing | Broken | CSS-only interpolation is not shared with export and has incorrect crop/scale semantics |
| Start framing | Missing | Implemented but unverified | Imported start scale/offset state and rectangle exist |
| End framing | Missing | Implemented but unverified | Imported end scale/offset state and rectangle exist |
| Draggable start/end rectangles | Missing | Broken | Mouse drag exists; resize sign is derived from corner rather than drag direction |
| Movement preview | Missing | Implemented but unverified | Imported CSS animation exists but cannot seek/pause with frame accuracy |

## Production elements

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Music upload | Missing | Implemented but unverified | Imported file chooser/object URL exists |
| Included music | Missing | Missing | No licensed music pack or rights metadata |
| Audio track | Missing | UI only | Imported records/cards exist without playback, timing or mixing |
| Voiceover upload | Missing | UI only | UI says voiceover, but every imported audio file is typed `music` |
| Narration generation | Missing | Missing | Generative audio is out of scope |
| Captions | Missing | Missing | No caption model or renderer |
| Title overlay | Missing | Missing | A `custom` type exists, but no reachable title/custom-overlay control exists |
| Address overlay | Missing | Implemented but unverified | Form and DOM preview exist |
| Price overlay | Missing | Implemented but unverified | Form and DOM preview exist |
| Logo | Missing | Implemented but unverified | Imported end-card logo object URL and DOM preview exist |
| Watermark | Missing | Missing | No project-level watermark |
| End card | Missing | Broken | Form/DOM preview exists; timing is omitted from total and timeout handling is unsafe |
| Branded variant | Missing | Missing | No variant contract or render path |
| Portal-safe variant | Missing | Missing | No safe-area/output-policy contract |

## Preview and export

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Full-project preview | Missing | Broken | Imported sequence is interval/CSS based and excludes real audio/render parity |
| Frame-accurate preview | Missing | Missing | No frame-rate or shared frame evaluator |
| MP4 export | Missing | Missing | Imported control is intentionally disabled; donor control had no handler |
| Export codec | Missing | Missing | No encoder or codec contract |
| Output resolution | UI only | Missing | OneLifestyle labels 720p/1080p; imported preview makes no output claim |
| 16:9 output | Implemented but unverified | Missing | OneLifestyle requests 16:9 from Veo; no project file was produced |
| Vertical output | Missing | Missing | No vertical project/output contract |
| Download | Implemented but unverified | Missing | OneLifestyle links a provider response without validating container/codec |
| Export progress | Mock | Missing | OneLifestyle shimmer/status is generation progress, not compositor progress |
| Failed export handling | Missing | Missing | No export job exists |

## AI video

| Capability | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| Single-image animation | Implemented but unverified | Missing | Browser-side Veo call exists; paid call not run |
| Image-to-video model calls | Implemented but unverified | Missing | `@google/genai` browser code was excluded |
| Start/end-frame generation | Implemented but unverified | Missing | Optional last-frame payload exists; not exercised |
| Two-image motion | Implemented but unverified | Missing | In-memory pairing plus provider last frame; no deterministic composition |
| Prompt templates | Implemented but unverified | Missing | Movement/atmosphere prompt strings exist only in source mine |
| Model selection | Missing | Missing | OneLifestyle active path is fixed to its configured Google model |
| Provider routes | Missing | Missing | OneLifestyle calls provider from browser; imported app has no API routes |
| Retry handling | Missing | Missing | No bounded retry, cancellation or idempotency |
| Failed generation handling | Implemented but unverified | Missing | OneLifestyle has rudimentary thrown/status failure only |
| Generation costs | Mock | Missing | OneLifestyle uses hard-coded estimates, not actual reconciled usage |
| Displayed credits or pricing | Mock | Missing | Displayed pricing is not a wallet/ledger or provider invoice |

## Platform concerns

| Capability or concern | OneLifestyle `0fa6ddb` | Imported `apps/video` | Evidence |
| --- | --- | --- | --- |
| API routes | Missing | Missing | Neither folder has a server route |
| Server-side provider calls | Missing | Missing | No server/provider boundary in either app |
| Client-side provider calls | Implemented but unverified | Missing | OneLifestyle constructs Google client with browser-injected key; excluded |
| Vercel configuration | Missing | Missing | No deployment configuration imported or created |
| Environment-variable names | Implemented but unverified | Missing | OneLifestyle references `API_KEY`; imported app has no environment dependency |
| Authentication | Missing | Missing | Explicitly out of scope |
| Hub integration | Missing | Missing | Explicitly out of scope; Hub remains durable-state owner |
| Storage | Missing | Missing | Imported editor uses only page memory/object URLs |
| Downloads | Implemented but unverified | Missing | OneLifestyle remote response link only; no AIM output contract |
| Unsafe HTML | Missing | Missing | No `dangerouslySetInnerHTML` found; React text interpolation escapes overlays |
| Upload hardening | Broken | Broken | Both trust browser MIME and lack count/size/dimension/decode limits |

## Additional AIM donor capability

### Vision Web at `e252df9`

Vision Web is the direct source of the imported editor surface. It has the same editor classifications above before the narrow import fixes, except its handlerless MP4 control was **UI only** rather than intentionally disabled. The full source repository is not buildable without unrelated repairs and carries obsolete or unused auth/provider dependencies.

### Vision Mobile at `02e2925`

Static classification:

- multiple-photo intake, ordering, duration, four motion presets, per-shot preview, sequential preview and native MOV export: **Implemented but unverified**;
- normalized crop/timeline contract and frame interpolation: **Implemented but unverified**;
- real MP4, audio, overlays, end card, watermark, persistence, replacement and partial rerender: **Missing**;
- 4:3 dimensions, preview/export parity and ignored easing/transitions: **Broken**;
- physical-device export proof: **Missing**.

### Legacy AI Studio at `dde8236`

Static/runtime classification is close to OneLifestyle: upload and one synthetic shot card were **Working and verified**; selection, ordering, pairing, provider controls and per-clip playback were **Implemented but unverified**; generation cost/progress was **Mock**; deterministic timeline, full preview, audio/overlay composition, project persistence and project MP4 were **Missing**.

## Capability conclusion

The imported surface honestly proves a local editor can be installed, built, rendered and fed local media. It does not prove the core product outcome. Timeline semantics, deterministic crop math, audio, persistence and real MP4 export remain the client-alpha production spine.
