# AIM Video capability matrix

Task: `WEBVIDEO-CLIENT-ALPHA-001`
Evidence date: 2026-08-06

Classification is based on commands and browser/MP4 evidence that actually ran.
“Working and verified” does not mean public-launch or universal portal
certification.

## Project and intake

| Capability | Status | Evidence |
| --- | --- | --- |
| Create/open/rename/delete local project | Working and verified | Fresh-origin Chrome flow created, renamed, saved, closed, reopened and deleted a project; both stores ended empty |
| 15–30 bulk photographs | Working and verified | Actual file input accepted 15 wrong-MIME/signed synthetic PNGs; 15- and 30-shot render fixtures proved scale |
| Actual signature validation | Working and verified | JPEG/PNG/WebP fixtures and unit tests; MIME labels not trusted |
| Count/size/dimension/decode bounds | Working and verified | Negative intake tests; bounded header-dimension preflight before bitmap decode |
| Duplicate/zero-byte/corrupt errors | Working and verified | Direct negative intake tests and operator errors |
| Media-rights record | Working and verified | Source, actual owner, permission basis/reference, permitted use and separate confirmation timestamp are validated; generic placeholders fail preflight |
| Customer-media upload | Missing by design | All media remains in local browser memory/IndexedDB |
| Clear unused media | Working and verified | Replaced source was removed while referenced local blobs remained |

## Storyboard

| Capability | Status | Evidence |
| --- | --- | --- |
| Stable shot IDs/order | Working and verified | Strict contract, reorder/replace/retime evidence |
| Drag reorder | Working and verified | Browser HTML drag/drop event path exercised with the transferred stable shot ID and order retained |
| Move Up/Down | Working and verified | Both controls exercised in Chrome; shared reorder mutation tested |
| Replace start/end | Working and verified | Synthetic replacement retained shot identity/primary settings and all unaffected hashes |
| Remove/add shots | Working and verified | Actual 15-file chooser path and single-card removal exercised in Chrome |
| Duration | Working and verified | Retime browser evidence and rerender |
| Single Image / Image Pair | Working and verified | 15/30/canonical fixtures include both |
| Pair dissolve proxy | Working and verified | Real two-image dissolve in MP4; disclosure visible |
| Future generated Motion Pair fields | Implemented but unverified | Validated optional contract fields; no provider connected |

## Motion and composition

| Capability | Status | Evidence |
| --- | --- | --- |
| Source-aware 16:9 cover crop | Working and verified | Landscape/portrait/square fixtures and no-edge tests |
| Still | Working and verified | Motion tests and real fixture export |
| Zoom In | Working and verified | Corrected label semantics, endpoint/easing tests and export |
| Zoom Out | Working and verified | Corrected label semantics, endpoint/easing tests and export |
| Pan Left | Working and verified | Cover-safe crop travel tests and export |
| Pan Right | Working and verified | Cover-safe crop travel tests and export |
| Freeform crop editor | Deferred | Donor `PositionRect` surface was removed from the alpha; normalized crop fields remain in the contract for a future Advanced boundary |
| Title/address | Working and verified | Shared canvas overlays and parity evidence |
| Logo/watermark/end card | Working and verified | Branded canonical/15/30 outputs |
| Unbranded neutral close | Working and verified | Unbranded real MP4 |

## Preview, audio and export

| Capability | Status | Evidence |
| --- | --- | --- |
| Complete play/pause/seek preview | Working and verified | Chrome browser test advanced playhead |
| Current time/current shot/end card | Working and verified | Timeline UI and canvas preview |
| Shared preview/export evaluator | Working and verified | `drawProjectFrame` single path plus decoded MP4 frame comparisons |
| Music upload/volume/fades | Working and verified | Self-created WAV fixture, AAC output and timing tests |
| Voiceover/independent volume | Implemented but unverified | Local track UI/decoder/mixer implemented; no separate voice file in export fixture |
| Music reduction under voice | Working and verified | Shared gain evaluator unit tests; production control |
| Export progress | Working and verified | Frame-based progress used by fixture harness/UI |
| Cancellation | Working and verified | 30-shot frame-12 and canonical finalization-stage cancellation; no output returned |
| Controlled failure | Working and verified | Missing local photo returned visible deterministic error |
| Real MP4 download | Working and verified | Four real MP4 files generated and inspected |
| H.264/AAC/1080p/30 fps | Working and verified | Track inspection plus macOS `file`/`afinfo` corroboration |
| Branded 16:9 | Working and verified | Canonical, edited 15-shot and 30-shot MP4s |
| Unbranded 16:9 | Working and verified | 15-shot unbranded MP4 |
| 9:16/square | Deferred by scope | Not implemented |

## Persistence and rebuild

| Capability | Status | Evidence |
| --- | --- | --- |
| Versioned validated manifest | Working and verified | Zod `1.0.0`, strict cross-field tests |
| Local blob persistence | Working and verified | 15-shot save/reopen with zero missing assets |
| Missing/corrupt/unsupported handling | Working and verified | Missing-on-save rejection, MIME/size/SHA-256 corrupt-blob detection, safe corrupt/unsupported list entries and controlled render failure |
| Stable content/settings hashes | Working and verified | Mutation/unit/browser evidence |
| Preserve unaffected shot configuration | Working and verified | All unaffected shot hashes unchanged after replace/retime |
| Shot-level encoded render cache | Deferred | Final MP4 is fully re-encoded; no cache promise |

## Platform boundaries

| Concern | Status |
| --- | --- |
| Generative-video provider | Absent by design |
| Paid API/provider call | None |
| Secret/environment dependency | None |
| Auth/wallet/credits/Hub | Absent by design |
| Server/production database, R2 and server storage | Absent by design; browser-local IndexedDB only |
| Vercel/deployment | Not created or changed |
| Customer media in tests | None |
| Protected app changes | None |

The recovery-era donor classifications remain documented in the import commit
and source-lineage records. This matrix describes the current client-alpha
branch, not the frozen import checkpoint.
