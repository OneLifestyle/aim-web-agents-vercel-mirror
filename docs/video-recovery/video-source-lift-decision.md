# AIM Video source-lift decision

Task: `WEBVIDEO-IMPORT-001`
Decision: **D — create a composite source lift using selected donor components**

## Decision in plain English

The OneLifestyle source is not the product foundation: it makes isolated paid AI clips and exposes the provider boundary in the browser. Photo AI is a useful workflow-pattern donor but has no Video timeline. Vision Web is the closest editor surface, but its whole repository is mixed, insecurely configured and not buildable. Vision Mobile has stronger deterministic crop concepts but cannot be copied directly to web.

The best starting point is therefore a small, provider-free AIM Video app that lifts only the Vision Web editor surface and theme, freezes all donor SHAs, and treats the Mobile timeline/crop contract and Photo AI workflow patterns as references for a deliberate next build.

## Options considered

| Option | Result | Reason |
| --- | --- | --- |
| A. Convert Photo AI directly | Rejected | Strong intake/review patterns, but no timeline, audio, compositor or project-video model; would disrupt an active protected lane |
| B. Continue OneLifestyle directly | Rejected | Per-shot paid generation, browser-exposed key design, stale Photo code, no lock/scripts/licence and no complete-property renderer |
| C. Continue Vision Web directly | Rejected | Relevant editor exists, but whole repo mixes mobile/backend/auth/credits/IAP/provider/database code, has large dependency/security debt and fails build/lint |
| D. Composite selected donor lift | Selected | Preserves the closest provider-free editor surface while isolating dependencies and retaining stronger mobile/photo patterns as explicit translation references |
| E. Rebuild cleanly from patterns only | Deferred | Likely destination after refactoring, but unnecessary for establishing a reproducible recovery baseline in this task |

## Source-lift gates

| Gate | Result | Evidence |
| --- | --- | --- |
| Video worktree clean immediately before import | Passed | Dedicated branch/root/base were rechecked; only placeholder existed |
| Source authority sufficiently clear | Passed for bounded internal lift | Copied files came only from a Singularealty repository under a founder-authorised recovery goal; public redistribution remains gated |
| No live secret copied | Passed | No credential value found; all env/provider files excluded |
| Separation from Copywriting and Photo AI | Passed | Standalone `apps/video`; protected worktrees untouched |
| No nested Git repository | Passed | Only ordinary source files copied; donor `.git` stayed in source mine |
| Compatible narrow dependencies | Passed | Reduced to React, React DOM, Lucide and Vite/TypeScript/lint tooling |
| Buildable without provider mutation | Passed | Install, typecheck, lint, build, browser render and synthetic upload passed |
| No major architecture Red Gate required | Passed | Export/provider/storage/auth were disabled or omitted rather than improvised |

## Approved modules

Copied from Vision Web SHA `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`:

- `VideoEditorPage.tsx` as an honest editor-surface baseline;
- `PositionRect.tsx` as framing-UI evidence, with known math/accessibility debt recorded;
- theme tokens and global Ken Burns preview CSS.

Created locally:

- minimal Vite/React entry point;
- strict TypeScript and ESLint configuration;
- pinned package manifest and npm lockfile;
- source-provenance and limitation README;
- output/environment/media exclusions.

## Modules and patterns to translate next

- Vision Mobile `kenBurnsSpecs.ts`: versioned normalized crop rectangles, source-aware cover crop, preset generation and serialization, rewritten with schema validation and tests;
- Vision Mobile exporter timing/frame calculations, translated rather than copying Swift;
- Photo AI file intake, batch-selection separation, progress/error and before/after review patterns;
- Vision Web timeline width, overlay/end-card field vocabulary and start/end framing concept, rebuilt around one renderer-neutral project contract.

## Modules rejected

- entire OneLifestyle application and its migrated prompt history;
- OneLifestyle browser-side Google provider client and key-bearing download URL;
- Vision Web backend, mobile app, auth, credits, IAP, SQLite, Firebase, Clerk, Stripe, Replicate and upload/storage code;
- legacy CRM Video provider routes and `apps/video-web` placeholder;
- stale Photo enhancement modules in Video-derived sources;
- committed sample media, screenshots and databases;
- mock pricing/progress and unverified model constants;
- Swift source copied directly into web.

## Provider code deferred

All image-to-video, prompt-analysis, two-frame AI, narration and generative provider selection is deferred. No model SDK, provider route, key, price, credit display or retry loop exists in the imported app. Deterministic complete-property rendering comes first.

## Dependency and maintenance position

The imported package pins its direct versions and records Node `>=20.19.0`. Vite was moved to 7.3.6 to clear the inherited development-server advisory. The final audit is clean.

The main code-quality debt is the donor's monolithic editor component and DOM/CSS-only timeline logic. This task does not disguise that debt with a redesign. The next goal should split domain state, intake, timeline, preview and renderer deliberately, with tests around the shared frame evaluator.

## Unresolved questions

- confirm repository-wide reuse/distribution authority for the orphan-history Vision Web source before public launch;
- choose and prove the web compositor/encoder path using a real 16:9 MP4 fixture;
- define licensed music/font/logo rights metadata and portal-safe output rules;
- define a local project/asset bundle that can reopen without taking over Hub-owned durable state;
- decide how shot-level render caching will permit replacement/retiming without rebuilding unaffected shots.

## Final decision

`apps/video` is created as a buildable internal recovery baseline. It is not public-launch ready and is not represented as a video exporter. The next authorised goal is `WEBVIDEO-CLIENT-ALPHA-001`.
