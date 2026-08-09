# Client-alpha verification evidence

Client-alpha evidence date: 2026-08-06
Speech-aware ducking repair evidence date: 2026-08-09
Audio timeline/resumed-speech repair evidence date: 2026-08-09

Browser: Google Chrome 151.0.7922.108 for the repair evidence
Media: locally generated synthetic PNGs and self-created WAV music/voice only

## Commands

```bash
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run test:render
npm run verify:voiceover
npm run verify:audio-repair
npm run verify:fixtures
```

Repair unit suite: 96 tests passed across 13 files covering project validation, hashes/migrations,
motion/crops/easing/pair dissolve, media signatures/object-URL lifecycle,
bounded encoded-dimension parsing, negative intake, media-rights records, audio
timing/envelopes, adaptive voice activity, controlled render errors and synthetic fixture construction. Browser workflow verification
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
| Canonical 6-shot | Branded | 11.500 s | 11.584 s | 3,765,694 B | 2.959 s | 45,561,384 B |
| Voiceover speech/silence/speech 6-shot | Branded | 11.500 s | 11.584 s | 3,773,307 B | 2.756 s | 40,944,385 B |
| Edited 15-shot | Branded | 18.500 s | 18.581 s | 5,915,539 B | 5.015 s | 90,481,390 B |
| 15-shot | Unbranded | 17.500 s | 17.579 s | 5,564,973 B | 4.508 s | 72,172,058 B |
| 30-shot | Branded | 32.500 s | 32.576 s | 10,789,878 B | 11.974 s | 115,630,727 B |

Final SHA-256 checksums:

- canonical: `bb4091e45ddf00879c6ae68fe3805e58e04e2201c7b72b0321bfcaca1ac6211b`;
- voiceover speech/silence/speech: `9c9e094b90d06486c33a8d0193611cd5b6dcd6d478f19cb39ada58b6f1b40ed6`;
- edited 15-shot branded: `840bc28132c2204132c37f1384186c10a3ce51352fb45ec928ad6df10eb71511`;
- 15-shot unbranded: `0ef90c680b7241586a9770e3d5254a7d509a6f8ce6445fe742ad8589523546cd`;
- 30-shot branded: `6c847970526832e581faf735bc65d3018848abd9d4f63ddd80b447b8b8aa5d24`.

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

## WEBVIDEO-FAT-001 speech-aware evidence

The prior gain evaluator treated the complete placed voiceover file as active,
so music stayed at 28% through internal silence. The repair analyses decoded
PCM locally into one `energy-rms-v1` envelope, then gives both preview and
export the same activity segments and gain evaluator. The envelope is persisted
as small derived metadata and safely recalculated if absent or stale; PCM is not
persisted.

Five deterministic fixtures cover short pause, five-second silence,
initial/ending silence, deterministic low-level background noise and an isolated spike. Unit tests
prove RMS windows, adaptive thresholds, hysteresis, short-gap joining,
quiet clean speech after strong attenuation, long-silence preservation, spike rejection, attack/release, replacement,
removal, no-voiceover, ducking-off, save/reopen and exact preview/export knot
parity.

The real branded voiceover MP4 uses left-only synthetic voice so exported right
channel RMS isolates music. A 0.4 s sample measured `0.0085886` during first
speech, `0.0322955` in the long silence (3.76× recovery), and `0.0090318` after
speech resumed (3.58× below silence). Intended shared gains at those times were
`0.0896`, `0.32` and `0.0896`. Independent atom inspection found `isom`/`mp41`,
`avc1`, `mp4a`, 1920 × 1080, exactly 30 fps, stereo 48 kHz and the expected
durations. All seven decoded video-frame parity samples passed.

The same browser run proved the gain applied by the actual preview audio
element was exactly `0.0896`, `0.32`, `0.0896`, matching the common contract
used to schedule export. It also proved envelope save/reopen, source-hash change on
voiceover replacement with fresh analysis, removal invalidation, equal speech/
silence gain when ducking is disabled, audio-mix cancellation and zero console
problems. A missing derived envelope was also recalculated when an unrelated
saved photograph was deliberately corrupted: the project still opened with
two activity segments and a visible photograph-integrity error even though
cache persistence could not complete. Decode plus analysis of the 10.5 s WAV
took 343.9 ms. Pure 48 kHz sample analysis took 10.4 ms for 30 s and 49.6 ms for
120 s. A complete local reopen with a deliberately missing derived envelope
took 123 ms to load, recalculate and persist it; a complete reopen with a cached
matching envelope took 33 ms. The complete fixture load increased measured JS
heap by approximately 16,706,585 bytes, although
decoded audio may also occupy native memory outside that counter. The normal
intake path reuses the already decoded buffer, and a matching source envelope
avoids reanalysis during preview and export. The 30-minute allowed input bound
was not stress-tested on every target device.

That checkpoint passed its synthetic evidence, but the subsequent founder test
failed: music faded near the prior approximately 63-second project endpoint
after extension to approximately 68 seconds, and quieter speech resumed near
the end of a 60-second voiceover without re-ducking music. It is retained as
historical first-repair evidence, not founder acceptance.

## WEBVIDEO-AUDIO-REPAIR-002 evidence

The repair reproduced both defects before implementation. A valid 68-second
project carrying a stale 63-second persisted music duration returned zero music
gain at 64 seconds despite a 90-second source. A deterministic 60-second
voiceover fixture with normal speech, short internal gaps, long silence,
low background noise, an isolated spike and materially quieter speech from
54.99–59.52 seconds produced only the first active segment with the v1
whole-track threshold.

Current-alpha placement is now resolved canonically before preview, operator
display, persistence normalization and offline export. Music begins at project
start and covers the complete project; its final fade is relative to the current
endpoint. Short sources loop without stretching. Voiceover remains bounded by
its decoded source/project intersection. The disposable local analysis cache is
`energy-rms-v2`; narrower percentile-relative dynamic entry/continue thresholds detect the quieter
resumption while existing hysteresis, 0.15-second active minimum, 0.8-second
gap rule, 0.18-second attack and 0.65-second release remain unchanged.

The browser regression began with a 63-second project, 75-second music source
and 60-second voiceover. Music used duration/end were 63 seconds and fade-out
began at 61.5 seconds. Retiming one shot extended the project to 68 seconds;
music used duration/end became 68 seconds and fade-out began at 66.5 seconds,
while voiceover stayed at 60 seconds. Save/reopen retained those values. A
post-reopen shortening moved project/music end to 66 seconds and fade start to
64.5 seconds; restoring the shot moved them back to 68/66.5 without voiceover
reanalysis.

The compact non-editing timeline displayed:

- Music source `1:15`, used `1:08`, full-project placement and both fades;
- Voiceover source/used `1:00`, speech regions `0.99–20.01` and
  `54.99–59.52`, with the meaningful silence visible between them;
- one music gain curve for duck, recovery, quieter resumed-speech re-duck,
  post-voiceover recovery and final fade;
- the preview playhead on the same 68-second axis; and
- no buttons, inputs, keyframes, dragging or other edit controls.

The combined real branded MP4 encoded 2,040 frames in 21.766 seconds and is
20,829,969 bytes. Inspection found MP4 (`isom`/`mp41`), 1920 × 1080 H.264/AVC,
exactly 30 fps, stereo 48 kHz AAC, 68.000-second video and 68.075-second
container/audio duration including AAC padding. Decoded right-channel RMS over
0.4-second windows measured:

- initial speech: `0.00902696`;
- meaningful voice silence: `0.03220115` (3.57× the first speech region);
- quieter resumed speech: `0.00902823` (3.57× below silence);
- after the 60-second voiceover endpoint: `0.03219514`; and
- near the relocated final fade: `0.01198112`.

The actual preview element gains at representative times were `0.0896`, `0.32`,
`0.0896`, `0.32` and `0.1066667`; they exactly matched the gain intent used by
the export schedule. Three decoded video-frame parity samples remained between
0.36 and 0.41 mean absolute channel error, below the tolerance of 12. Peak
measured JS heap during this long render was 126,058,518 bytes. Chrome reported
no console warnings/errors in the combined regression or in-app visual pass.

## Founder acceptance

On 2026-08-09, the founder completed `WEBVIDEO-FOUNDER-AUDIO-RETEST-002` against
the local repair build and reported being extremely happy with the result,
describing it as “Perfection.” This founder-reported acceptance complements,
but does not replace, the automated measurements above. `WEBVIDEO-FAT-001` is
closed. FAT-002 through FAT-011 remain open and unchanged. No merge, deployment
or pull request is implied by this acceptance record.

Generated evidence is intentionally gitignored under `verification-output/`.
The JSON evidence files record exact inspection, parity and memory readings.
Measurements describe this workstation and synthetic low-detail media; they
are not a performance guarantee for every operator device or photograph set.
