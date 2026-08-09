# AIM Video security and provider risks

Base task: `WEBVIDEO-CLIENT-ALPHA-001`
Repair task: `WEBVIDEO-VOICEOVER-EXPORT-REPAIR-001`
Second repair: `WEBVIDEO-AUDIO-REPAIR-002`
Review date: 2026-08-09

## Current alpha posture

- Live secrets found/exposed: **No**
- Environment files or variables added: **No**
- Provider SDK, route or model call: **No**
- Paid API or generative-video call: **No**
- Auth, Hub, wallet, credits, server/production database, R2 or production storage: **No**
- Deployment/Vercel project change: **No**
- Customer media used in tests: **No**
- System/global binary installation: **No**
- Audio uploaded or transcribed: **No**

The client performs deterministic production inside the current browser. Media
is not sent to a server. The selected compositor is exact-pinned
`mediabunny@1.52.3` (MPL-2.0) and uses Canvas, WebCodecs and Web Audio. Remotion
was not installed because its free commercial automation licence could not be
proven from repository evidence.

## Intake and local-file controls

- JPEG, PNG, WebP, WAV, MP3 and M4A are checked by actual signature.
- Images/audio must decode and remain inside count, byte, dimension, pixel and
  duration limits.
- SHA-256 detects duplicate photographs.
- Zero-byte, unsupported, corrupt and missing files return controlled messages.
- Runtime object URLs are replaced/revoked when a stable runtime entry changes,
  when **Clear unused media** removes an orphaned source, and on project close
  or project switch. Replacing or removing a storyboard shot deliberately keeps
  its old source available as unused media until that explicit cleanup action.
- MP4 output URLs are revoked after browser download handoff.
- Generated verification MP4s/reports and environment-shaped files are
  gitignored.

Browser-local IndexedDB is deliberately not a security or durability boundary
equivalent to Hub. A user with access to the browser profile can access local
project media; browser/storage clearing can remove it. Do not represent this as
cloud sync, archival storage or a multi-user permission system.

## Local voice-activity boundary

Voiceover speech activity is derived entirely in the browser from decoded PCM
energy. The `energy-rms-v2` analyser does not recognize words, identify
speakers, call a model or send bytes to a provider. Only a small source-ID/hash,
threshold and active-time envelope may be stored in the local project. Raw PCM
is not persisted and the envelope is safe to discard/recalculate. Replacing or
removing voiceover invalidates the old envelope; unrelated music edits reuse it.

This lightweight detector is an alpha heuristic, not a biometric or
studio-grade speech detector. Deterministic low-level background noise,
isolated spikes, short gaps, long silence and materially quieter resumed speech
are handled by a track-adaptive floor, capped dynamic thresholds, hysteresis and
duration/gap post-processing. Unusual changing noise or music embedded in
voiceover can still affect classification. Founder retest remains a release
gate.

## Media-rights controls

Every media asset requires source, owner, licence/permission and permitted-use
metadata. Photograph and production-media import are separately gated by an
operator permission confirmation. Automated fixtures are locally drawn images
and locally synthesised music and voiceover WAV fixtures only. No commercial
music is bundled.

Common founder/company control of OneLifestyle and Singularealty resolves the
previous source-account identity mismatch, but it does not clear third-party
packages, fonts, music, logos, photographs or external-source material. Their
normal licence/permission requirements remain. This is not legal advice.

## Renderer and memory risks

The browser holds decoded images, decoded voiceover during one-time analysis, a 1920 × 1080 canvas, offline audio and an
in-memory MP4 buffer during export. The final synthetic 30-shot proof took
11.974 s and peaked at 115,630,727 bytes of measured JS heap on the verification workstation.
Real high-detail photographs and different hardware can increase time and
memory. Input bounds, progress, cancellation and controlled failure limit this
risk, but the alpha should remain an attended operator workflow.

On the repair workstation, decode plus analysis of the 10.5 s WAV took 343.9
ms; isolated sample analysis took 10.4 ms for 30 s and 49.6 ms for 120 s. A
complete local reopen with deliberately missing derived analysis took 123 ms to
load, recalculate and persist it, while a complete reopen with a matching cached
envelope took 33 ms. The complete fixture load increased measured JS heap by
about 16.7 MB,
although decoded audio may also occupy native memory outside the JS heap
counter. The normal intake path reuses its decoded buffer and a matching
persisted envelope avoids reanalysis during preview and export. The 30-minute
input maximum remains an upper-bound risk and was not stress-tested on every
target device.

The final 68-second founder-equivalent verification render took 21.766 seconds,
produced a 20,829,969-byte MP4 and peaked at 126,058,518 bytes of measured JS heap. The
compact timeline memoizes placement/activity/gain data by project; playhead-only
updates do not repeat PCM analysis or rebuild the derived envelope.

The final file is re-encoded in full. No partial output survives a controlled
cancellation. H.264/AAC capability varies by browser/platform, so unsupported
encoders fail visibly before rendering.

## Deferred provider risk

Do not revive the donor patterns that placed provider keys or paid model calls
in the browser. Any later Motion Pair provider requires a separate goal covering
server-side secret custody, authenticated authorisation, quota/cost controls,
rights/consent, idempotent jobs, cancellation, output validation, storage/Hub
handoff and deterministic dissolve fallback. No current alpha field grants that
implementation authority.

## Remaining release gates

- `WEBVIDEO-FOUNDER-AUDIO-RETEST-002`, focused on project extension/music
  endpoint, compact timeline, quieter resumed speech, silence recovery and the
  branded downloaded MP4;
- destination-specific portal review for unbranded output;
- current browser/hardware acceptance;
- complete third-party package/font/music/logo/media licence review;
- product decision for durable Hub handoff before multi-user or production use.
