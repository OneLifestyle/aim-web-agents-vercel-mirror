# AIM Video client-alpha target result

Task: `WEBVIDEO-CLIENT-ALPHA-001`
Evidence date: 2026-08-06

## Result

The deterministic complete-property-video spine is implemented and verified as
an internal operator alpha. A local browser project can ingest 15–30 validated
photographs, build a guided storyboard, preview the complete composition, mix
local audio, render and download a real 16:9 MP4, save locally, reopen, replace
or retime a shot, and rerender without reconfiguring unaffected shots.

## Target assessment

| Target | Result | Evidence |
| --- | --- | --- |
| 15–30 photographs | Working and verified | Synthetic 15- and 30-shot browser projects; signature/count/size/dimension/decode validation |
| Guided manual ordering | Working and verified | Drag path implemented; Move Down exercised; Move Up/Down and stable order contract tested |
| Duration per shot | Working and verified | Validated 0.5–20 s contract; 15-shot retime retained stable ID and unaffected hashes |
| Five deterministic treatments | Working and verified | Still, Zoom In, Zoom Out, Pan Left and Pan Right fixtures/tests and real exports |
| Image Pair | Working and verified | Two real images, future-generation fields and deterministic dissolve proxy; no provider |
| Complete preview | Working and verified | Play, pause, seek, current shot and end card in Chrome |
| Preview/export parity | Working and verified | One canvas/evaluator path; canonical decoded MP4 comparisons cover all five presets, pair midpoint and end card, with representative 15/30-shot checks |
| Music | Working and verified | Self-created local WAV fixture exported with AAC; volume/fades implemented |
| Optional voiceover | Implemented but unverified | Local upload, independent volume/fades and exact duck-boundary mixing are implemented and unit-tested; no separate voice recording was included in an MP4 fixture |
| Title/address/end card/watermark | Working and verified | Canonical and 15/30 branded fixtures rendered and frame-compared |
| Unbranded 16:9 | Working and verified | Real 5,564,973-byte MP4; neutral closing frame and no product-brand metadata string |
| Branded 16:9 | Working and verified | Canonical, edited 15-shot and 30-shot real MP4s |
| Local save/reopen | Working and verified | Fresh-origin UI create/rename/save/close/reopen/delete; full shot signatures retained; Blob/envelope corruption and unsupported manifests handled |
| Replace and retime | Working and verified | Stable affected-shot ID/primary settings; all unaffected hashes unchanged; rerender passed |
| Progress/cancellation/failure | Working and verified | Frame progress; frame-12 cancellation; deliberate missing-asset failure |

## Renderer and profile

Remotion core was technically suitable but not adopted because this repository
could not prove that its commercial free-use headcount condition applied. The
selected renderer is exact-pinned `mediabunny@1.52.3` under MPL-2.0, running
locally with Canvas, WebCodecs and Web Audio. No global/system installation or
paid product was used.

`client-alpha-1080p-v1` defines MP4, 1920 × 1080, 30 fps, H.264/AVC, AAC-LC,
YUV 4:2:0, safe areas and a 6 Mbps video target. Unbranded is a portal-safe
candidate, not universal portal certification.

## Largest remaining limitation

Each final MP4 is fully re-encoded in the browser. Stable hashes prove input
invalidation and preserve unaffected setup, but shot-level encoded render cache
reuse is not implemented. Performance and codec support therefore depend on the
operator's current browser/hardware.

The appropriate next task after founder acceptance is
`WEBVIDEO-FOUNDER-TAP-THROUGH-001`. Generative motion remains deferred.
