# AIM Video security and provider risks

Task: `WEBVIDEO-CLIENT-ALPHA-001`
Review date: 2026-08-06

## Current alpha posture

- Live secrets found/exposed: **No**
- Environment files or variables added: **No**
- Provider SDK, route or model call: **No**
- Paid API or generative-video call: **No**
- Auth, Hub, wallet, credits, server/production database, R2 or production storage: **No**
- Deployment/Vercel project change: **No**
- Customer media used in tests: **No**
- System/global binary installation: **No**

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

## Media-rights controls

Every media asset requires source, owner, licence/permission and permitted-use
metadata. Photograph and production-media import are separately gated by an
operator permission confirmation. Automated fixtures are locally drawn images
and a locally synthesised WAV only. No commercial music is bundled.

Common founder/company control of OneLifestyle and Singularealty resolves the
previous source-account identity mismatch, but it does not clear third-party
packages, fonts, music, logos, photographs or external-source material. Their
normal licence/permission requirements remain. This is not legal advice.

## Renderer and memory risks

The browser holds decoded images, a 1920 × 1080 canvas, offline audio and an
in-memory MP4 buffer during export. The final synthetic 30-shot proof took
17.237 s and peaked at 122,179,006 bytes of measured JS heap on the verification workstation.
Real high-detail photographs and different hardware can increase time and
memory. Input bounds, progress, cancellation and controlled failure limit this
risk, but the alpha should remain an attended operator workflow.

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

- founder tap-through with authorised representative media;
- destination-specific portal review for unbranded output;
- current browser/hardware acceptance;
- complete third-party package/font/music/logo/media licence review;
- product decision for durable Hub handoff before multi-user or production use.
