# Client-alpha verification evidence

Evidence date: 2026-08-06

Browser: Google Chrome 150.0.7871.187
Media: locally generated synthetic PNGs and self-created WAV only

## Commands

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run test:render
npm run verify:fixtures
```

Unit suite: 70 tests passed across 11 files covering project validation, hashes/migrations,
motion/crops/easing/pair dissolve, media signatures/object-URL lifecycle,
bounded encoded-dimension parsing, negative intake, media-rights records, audio
timing/envelopes, controlled render errors and synthetic fixture construction. Browser workflow verification
passed with no console warning/error and exercised fresh-origin UI
create/rename/save/close/open/delete, dirty-close protection, 15-shot loading,
HTML drag/drop, Move Up/Down, remove, clear-unused, complete preview playback,
replacement, retiming, full stable shot-signature retention, reachable Export
controls, plain operator language and accessible branded/unbranded selectors.
The visible multiple-file input accepted 15 synthetic PNGs deliberately labelled
with the wrong browser MIME after signature/dimension validation, and a bounded
validation delay proved Save and Close stayed locked during pending intake.
It also safely listed/deleted malformed and unsupported records and proved both
IndexedDB stores empty after deletion. A delayed-open regression proved that a
late load cannot replace a newer local project selection.

## Real MP4 results

| Project | Variant | Video duration | Container duration | Size | Render time | Peak JS heap |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Canonical 6-shot | Branded | 11.500 s | 11.584 s | 3,765,694 B | 4.515 s | 53,316,182 B |
| Edited 15-shot | Branded | 18.500 s | 18.581 s | 5,915,539 B | 7.136 s | 71,985,429 B |
| 15-shot | Unbranded | 17.500 s | 17.579 s | 5,564,973 B | 6.045 s | 86,179,974 B |
| 30-shot | Branded | 32.500 s | 32.576 s | 10,789,878 B | 17.237 s | 122,179,006 B |

Final SHA-256 checksums:

- canonical: `b5f95afe094ecdde64d7edd93d8f8210d2156aef9913c941e8b553a7963eaedc`;
- edited 15-shot branded: `25709131f86443276f5d0d44b3f4a9314da5ff54de8b148fe1c96a3d5c21342a`;
- 15-shot unbranded: `1ab459b318bc2ab16f07d6fee6451b9b9bc3ea41a1b32299c1f788595ff68566`;
- 30-shot branded: `38ddb90feb19866287efbd75b42e7ffcd4eaa31430823064fd5ee017803d241e`.

Every file inspected as MP4 with a 1920 × 1080 H.264/AVC video track at exactly
30 fps and stereo 48 kHz AAC audio. The small container/audio overhang is AAC
priming/padding and stays within the asserted 100 ms tolerance; video-track
duration and frame count are exact. A dependency-free Node ISO-BMFF parser
independently found `isom`/`mp41`, `avc1`, `mp4a`, the dimensions, durations,
sample counts, 30 fps, two channels and 48 kHz. macOS `file` independently
identified ISO MP4 Base Media and `afinfo` independently reported AAC, two
channels, 48 kHz and compatible durations.

The canonical proof decodes one exported midpoint for each of the five Single
Image treatments, the Image Pair dissolve midpoint and the first end-card
frame. The expected frame is evaluated at the decoder's actual timestamp.
All seven mean absolute RGB channel errors stayed between 0.19 and 0.42 on a
0–255 scale, below the lossy-codec tolerance of 12. The 15/30-shot outputs also
passed representative opening, midpoint and closing comparisons.

The 15-shot test saved and reopened with no missing/corrupt blobs, rejected an
incomplete attempted save without damaging the prior record, detected a
deliberately corrupted stored blob by SHA-256, replaced one source
while retaining the stable shot ID/treatment/duration/easing and every
unaffected shot hash, retimed the same shot without changing other shots, then
rerendered. The renderer re-encodes the complete final MP4; no shot-cache reuse
is claimed. The unbranded MP4 also passed a byte-level check that the product
brand was absent from embedded metadata.

The 30-shot test also passed controlled cancellation after frame 12 and a
deliberately missing-photo failure. A second canonical run cancelled at the
finalization stage. Neither cancellation returned a partial/completed output.

Generated evidence is intentionally gitignored under `verification-output/`.
The JSON evidence files record exact inspection, parity and memory readings.
Measurements describe this workstation and synthetic low-detail media; they
are not a performance guarantee for every operator device or photograph set.
