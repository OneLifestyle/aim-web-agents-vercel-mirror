# AIM Video Web client alpha

`apps/video` is the operator-assisted deterministic property-video client built
by `WEBVIDEO-CLIENT-ALPHA-001`. It turns 15–30 local real-estate photographs
into a complete downloadable 1920 × 1080 MP4 without a generative-video model,
server upload, account, Hub, or server/cloud database and storage.

## Product workflow

- create, save, close, reopen, rename and delete browser-local projects, with
  honest saved/unsaved state and guarded close;
- signature/decode-validated photograph intake with visible file errors;
- stable-ID storyboard cards with drag, Move Up/Down, replace and remove;
- Single Image: Still, Zoom In, Zoom Out, Pan Left and Pan Right;
- Image Pair: two real photographs exported as a clearly labelled deterministic
  cross-dissolve proxy; AI Motion Pair generation is not connected;
- complete play/pause/seek preview from the same project/frame evaluator used by
  MP4 export;
- authorised music, optional voiceover, independent volume/fades and music
  reduction under voice;
- import-session source, rights owner, permission basis/reference, permitted use
  and confirmation time recorded for local media;
- title/address, optional logo/watermark and neutral or branded end card;
- unbranded 16:9 portal-safe candidate and branded 16:9 output;
- local H.264/AAC MP4 render, progress, cancellation, inspection and download.

The output profile is `client-alpha-1080p-v1`. It is a technical alpha profile,
not universal portal certification. Export requires a current browser with
WebCodecs H.264 and AAC encoder support.

## Local commands

Requires Node.js 20.19 or newer.

```bash
npm install
npm run typecheck
npm run lint
npm run test:unit
npm run test:e2e
npm run build
npm run dev
npm run test:render
npm run verify:fixtures
```

The browser suites use only synthetic local images and a self-created WAV. Real
MP4 and JSON evidence is written to the gitignored `verification-output/`
directory. No customer media or commercial music is used.

## Architecture and evidence

- [Project contract](docs/project-contract.md)
- [Output profile](docs/output-profile.md)
- [Renderer decision](docs/renderer-decision.md)
- [Local persistence](docs/local-persistence.md)
- [File limits](docs/file-limits.md)
- [Audio and media rights](docs/audio-media-rights.md)
- [Operator guide](docs/client-alpha-operator-guide.md)
- [Verification evidence](docs/verification-evidence.md)
- [Third-party notices](THIRD_PARTY_NOTICES.md)

The selected renderer is exact-pinned `mediabunny@1.52.3` under MPL-2.0. No
system/global renderer was installed. The renderer re-encodes the complete MP4;
stable content/settings hashes preserve unchanged shot setup but are not a
shot-level render-cache claim.

## Source authority and provenance

The original recovery surface was lifted from Singularealty Vision Web commit
`e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`; full donor SHAs and exclusions are
recorded in `docs/video-recovery/`. The alpha rewrites the production contract,
motion math, intake, preview/export, audio, persistence and operator workflow in
web TypeScript rather than copying Swift or React Native code.

The founder has clarified that OneLifestyle is a Singularealty-owned brand, the
OneLifestyle GitHub account is the founder's personal identity, and source under
OneLifestyle and Singularealty is under common founder/company control. The
earlier account-name mismatch is therefore not a special public-redistribution
gate. This does not clear third-party package, font, music, logo, photograph or
other external-source rights.

The founder reports that Vision Mobile preceded Vision Web as product lineage.
That is not a Git-ancestry claim unless source history independently proves it.
This provenance record is programme guidance, not legal advice.

## Boundaries

There is no provider integration, secret, environment file, API route, auth,
wallet, credit, Hub, server/production database, R2, Vercel project or deployment in this alpha.
Local IndexedDB state does not take ownership of future Hub business records.
