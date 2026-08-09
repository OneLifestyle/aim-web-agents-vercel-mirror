# AIM Video capability matrix

Base task: `WEBVIDEO-CLIENT-ALPHA-001`
Repair task: `WEBVIDEO-VOICEOVER-EXPORT-REPAIR-001`
Second repair: `WEBVIDEO-AUDIO-REPAIR-002`
Latest evidence date: 2026-08-09

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
| Pan Left | Founder finding open | Existing cover-safe crop/export tests pass, but FAT-002 reports the operator labels are reversed; unchanged in this repair |
| Pan Right | Founder finding open | Existing cover-safe crop/export tests pass, but FAT-002 reports the operator labels are reversed; unchanged in this repair |
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
| Project-following music endpoint | Working and verified | Actual 63→68→66→68 runtime/persistence regression; music and final fade followed each endpoint with a 75-second source |
| Voiceover/independent volume | Working and verified | Separate synthetic voiceover in a real H.264/AAC MP4; save/reopen, replacement, removal and cancellation evidence |
| Speech-aware music reduction | Working and verified | Shared `energy-rms-v2` envelope; short-pause hold, long-silence recovery, materially quieter resumed-speech duck and exported right-channel RMS proof |
| Preview/export audio parity | Working and verified | Preview samples and export schedule use one activity envelope/gain evaluator; rendered audio measured speech/silence/speech |
| Compact operator audio timeline | Working and verified | Music/Voiceover source-used placement, fades, speech/silence, gain curve and shared preview playhead verified on the 68-second fixture; no edit controls |
| Export progress | Working and verified | Frame-based progress used by fixture harness/UI |
| Cancellation | Working and verified | 30-shot frame-12 and canonical finalization-stage cancellation; no output returned |
| Controlled failure | Working and verified | Missing local photo returned visible deterministic error |
| Real MP4 download | Working and verified | Five real MP4 files generated and inspected |
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

## Founder finding status

`WEBVIDEO-FAT-001` remains open pending
`WEBVIDEO-FOUNDER-AUDIO-RETEST-002`. Automated evidence repairs the clarified
music-endpoint and quieter-resumption defects but is not founder acceptance.
These out-of-scope findings remain open and unchanged:

- FAT-002 — Pan Left/Right labels reversed;
- FAT-003 — trailing spaces removed during production-text entry;
- FAT-004 — preview workflow separation;
- FAT-005 — Image Pair filename-only selector;
- FAT-006 — drag feedback;
- FAT-007 — replacement rights timing;
- FAT-008 — project identity versus rendered title explanation;
- FAT-009 — end-card icon;
- FAT-010 — stale cancellation progress;
- FAT-011 — visual-design refinement.
