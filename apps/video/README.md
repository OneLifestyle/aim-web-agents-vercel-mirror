# AIM Video Web baseline

This folder is the provider-free source-recovery baseline created by
`WEBVIDEO-IMPORT-001`. It is not a client-alpha release.

## Frozen provenance

The editor surface and theme were lifted from the Singularealty-hosted Vision Web
repository at commit `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`. The runtime shell was reduced to
the dependencies used by that surface. No Git metadata, environment file,
provider integration, database, sample media, generated output, authentication,
credits, billing, or storage code was imported.

The source-recovery decision and all donor SHAs are recorded under
`docs/video-recovery/`.

## Honest baseline

The app provides a buildable, local, in-memory editor prototype: local image and
audio selection, shot-duration controls, overlay fields, an end-card form, and
timeline-shaped lanes. Donor CSS motion-preview and visual framing controls are
preserved as non-production UI evidence; their known math and input defects are
recorded in the recovery audit.

It does **not** produce a video. Audio is not mixed or played, the preview is not
frame-accurate, projects cannot be reopened, and MP4 export is intentionally
disabled. No provider calls exist in this folder.

## Local checks

Requires Node.js 20.19 or newer.

```bash
npm install
npm run typecheck
npm run lint
npm run build
npm run dev
```
