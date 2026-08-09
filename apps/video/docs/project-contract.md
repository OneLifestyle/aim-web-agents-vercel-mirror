# AIM Video project contract

The client alpha stores one renderer-neutral `VideoProject` manifest at version
`1.0.0`. The contract is implemented with strict Zod runtime schemas in
`src/project/schemas.ts`; TypeScript types are inferred from those schemas.
Unknown keys, stale hashes, missing cross-references, duplicate local blob keys,
source-aspect-invalid crops, inconsistent render transitions, altered alpha
profiles, invalid timing and unsupported project versions are rejected.

## Main records

- `VideoProject` owns metadata, canvas/frame rate, ordered shot IDs, media,
  overlays, audio, end card, output profile and render jobs.
- `MediaAsset` records the unique local blob key, actual decoded metadata,
  SHA-256 content hash, supplied source/owner/permission/permitted-use fields
  and an optional separate operator-confirmation timestamp.
- `VideoShot` is a stable-ID union of Single Image and Image Pair.
- `AudioTrack` retains schema-compatible placement fields; current-alpha music
  used duration is canonically derived from complete project duration and
  voiceover used duration from its decoded source/project bound. `Overlay` and
  `EndCard` hold explicit timeline placement.
- `OutputProfile` freezes the technical encoder target.
- `RenderJob`, `RenderStatus` and `RenderError` make progress, cancellation and
  controlled failure persistent project state.

`orderedShotIds` must contain every shot exactly once. Each referenced asset
must exist and have the correct media kind. Canvas and frame rate must match the
selected output profile. Audio and overlays must remain inside the complete
shot-plus-end-card duration. The shared placement resolver and
mutation/persistence normalizer move music and its fade with project extension
or shortening, and re-derive source-bounded voiceover without reanalysing it.

## Shot sources

Single Image stores one image asset, duration, easing, a named motion preset and
normalised start/end crop rectangles. The supported presets are Still, Zoom In,
Zoom Out, Pan Left and Pan Right.

Image Pair stores real `startAssetId` and `endAssetId` references plus the
`dissolve` pair treatment. It also reserves optional `generatedClipRef`,
`generationStatus`, `generationProvider` and `generationMetadata` fields so a
future Motion Pair clip can be represented without redesigning the project.
No generation provider is connected in this alpha.

## Identity and invalidation

- Media bytes use SHA-256 for source identity.
- Shots keep stable IDs through reorder, replacement and retiming.
- `contentHash` changes when referenced source bytes change.
- `settingsHash` changes when duration, crops, easing, source mode or treatment
  changes.
- Shot hashes are labelled `fnv1a64:` deterministic invalidation keys. They are
  not cryptographic hashes and do not promise a renderer cache.

Replacing a source with a different aspect ratio deliberately regenerates the
affected shot's cover crop. Unaffected shot IDs, sources, treatments, durations,
pair settings and hashes remain unchanged.

## Ownership boundary

This manifest is browser-local workstation state. It is not a database schema,
Hub contract or durable AIM business record. Hub continues to own identity,
properties, jobs, assets, storage, timeline and workspace state.
