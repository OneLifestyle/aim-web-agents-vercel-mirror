# Deterministic renderer decision

Selected renderer: `mediabunny@1.52.3`, MPL-2.0.

Mediabunny is used directly in the current browser with Canvas, WebCodecs and
Web Audio. It writes H.264 video and AAC audio into an in-memory MP4, reports
frame progress, supports cancellation and reads the finished tracks back for
inspection. No renderer service, system FFmpeg, Homebrew package, global npm
package, paid API or generative-video provider is involved.

## Remotion assessment

Remotion core/web renderer was evaluated first. Its React composition model is
a good technical fit, but the current Remotion licence classifies this render
workflow as automation. The free commercial allowance depends on organisation
headcount, which this repository cannot establish; larger teams require the
paid Automators licence. It was therefore not safe to claim that no paid
licence was required, and Remotion was not installed or adopted. Editor Starter
was not purchased.

Primary references:

- <https://www.remotion.dev/docs/license/pricing>
- <https://www.remotion.dev/docs/license/faq>
- <https://mediabunny.dev/guide/writing-media-files>
- <https://mediabunny.dev/guide/reading-media-files>

This is a technical dependency decision, not legal advice.

## Architecture

`drawProjectFrame()` is the only visual composition path for both complete
preview and MP4 export. The function resolves the same project timeline,
motion/pair evaluator, title/address overlays, branded watermark and end card.
The export renderer invokes it once per explicit 30-fps frame. Audio preview and
offline export use the same gain/fade/duck timing evaluator. Offline export
schedules exact fade knots and one-sample discontinuities at voiceover ducking
boundaries; preview forces audio position on play and seek, with a small drift
tolerance only during continuous playback. Preview, compact operator timeline
and offline mix first resolve the same automatic current-alpha placement: music
covers the complete current project and voiceover remains source-bounded.

Only visual assets that can affect the selected variant are decoded. Unused
media and branded-only visuals in an unbranded render are not preload failures
or memory costs. Cancellation is checked between image decodes, between audio
decodes/mix stages and on every video frame. A browser's individual in-flight
decode, `OfflineAudioContext.startRendering()` or encoder finalization operation
is not itself interruptible, so cancellation can wait for that single operation
to return. The abort state is rechecked immediately afterward and before/after
inspection, preventing a late-cancelled result from becoming a download.

Primary inspection uses Mediabunny's reader. Verification also uses a separate
dependency-free Node ISO-BMFF atom parser to assert container brands, `avc1`
and `mp4a` sample entries, dimensions, track durations, sample counts, frame
rate, channel count and sample rate. macOS `file` and `afinfo` provide an
additional native check.

The final MP4 is fully re-encoded on every export. Stable shot hashes prove
which inputs/settings changed and avoid re-import or reconfiguration of
unaffected shots, but this alpha does not claim shot-level encoded-media cache
reuse.

## Licence handling

Mediabunny's MPL-2.0 licence and source location are recorded in
`THIRD_PARTY_NOTICES.md`. Package files are unmodified. All other package,
font, music, logo and media rights remain independently applicable.
