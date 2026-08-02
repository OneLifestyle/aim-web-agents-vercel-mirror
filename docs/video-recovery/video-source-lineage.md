# AIM Video Web source lineage

Task: `WEBVIDEO-IMPORT-001`
Frozen: 2026-08-02

## Frozen sources

| Source | Repository | Local path | Branch/tag | Frozen SHA | Custody and licence position |
| --- | --- | --- | --- | --- | --- |
| OneLifestyle Video | `https://github.com/OneLifestyle/RE-AIM-Video-Agent-1-1-26.git` | `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/RE-AIM-Video-Agent-1-1-26` | `main` | `0fa6ddbb0836965d6ab2d982680e64e6d9a081ad` | OneLifestyle custody; no licence or notice found; not copied into AIM |
| Vision Web | `https://github.com/Singularealty/Real-Estate-AIM-Vision-Web.git` | `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/Real-Estate-AIM-Vision-Web` | `main` | `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5` | Singularealty custody; no repository-wide licence found |
| Vision Mobile | `https://github.com/Singularealty/Real-Estate-AIM-Vision-Mobile.git` | `/Users/sgbcproperty/Developer/RealEstateAIM/vision-agent-mobile-source` | `reaim-v2-freeze-vision-mobile-2026-05-06` | `02e2925a0ecd2ffb8682db79f980447b913e845b` | Singularealty custody and canonical AIM freeze; no standalone licence found |
| Legacy master | `https://github.com/Singularealty/Real_Estate_AIM_PROJECT.git` | `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/video-agent-recovery/Real_Estate_AIM_PROJECT` | `main` / `reaim-v2-freeze-timeline-crm-2026-05-06` | `dde8236a2c3211db3216df81f3b123f1811b6f98` | Singularealty custody; scoped AI Studio import has no upstream SHA or licence record |
| Active Photo AI donor | `Singularealty/aim-web-agents` | `/Users/sgbcproperty/.codex/worktrees/609e/aim-web-agents/apps/photo-ai` | `codex/photo-ai-standalone-vercel-001` | `c08235e5` at inspection start | AIM-owned lane; inspected read-only while active work continued |

## OneLifestyle lineage

The OneLifestyle repository is explicitly descended from a Google AI Studio Photo Agent rather than being an independently designed Video editor:

- its npm name remains `real-estate-photo-enhancer`;
- its README describes a Gemini Photo Agent and photo persistence pipeline;
- Photo-specific components, services, types and prompt manuals remain;
- migrated AI Studio prompt history records the transformation into a Video shot generator;
- the Video delta consists mainly of per-shot data, prompt options, start/end pairing and browser-side Veo calls.

No licence, notice or transfer record was found. That source is retained only as an external source mine and provenance record. No OneLifestyle code, Git metadata, prompt-history attachment or sample media was imported into `apps/video`.

## Vision Web lineage

Vision Web is in a Singularealty repository, but its relevant feature history has an unusual shape:

- merge commit `e252df9` has parents from the previous main line and feature tip `95943d3`;
- the merge tree is byte-identical to `95943d3`;
- that feature history begins at orphan root `64aeb25`, authored using a OneLifestyle email address;
- no repository-wide licence, notice or upstream source SHA is recorded.

For this task, Singularealty repository custody plus the founder-authorised internal recovery task was treated as sufficient authority for a bounded internal lift of provider-free editor files. It is not treated as proof of an open-source licence or a right to redistribute the original repository externally. Source-authority confirmation remains a public-release gate.

## Vision Mobile and legacy lineage

Canonical AIM freeze records identify the Vision Mobile and legacy SHAs above. Vision Mobile supplies design and algorithm evidence only; no Swift or React Native source was copied. The legacy AI Studio source arrived in a single squash-like import, so its exact upstream revision cannot be reconstructed. Its CRM routes and provider code were not imported.

## Imported-file provenance

The following files were copied from Vision Web SHA `e252df906a7b2ff62f8e99ff5ef99c9b7669b0e5`:

- `apps/video/src/pages/VideoEditorPage.tsx` from `RealtorAIMVisionWeb/src/pages/VideoEditorPage.tsx`;
- `apps/video/src/components/PositionRect.tsx` from `RealtorAIMVisionWeb/src/components/PositionRect.tsx`;
- `apps/video/src/index.css` from `RealtorAIMVisionWeb/src/index.css`;
- `apps/video/src/theme/colors.ts` from `RealtorAIMVisionWeb/src/theme/colors.ts`;
- `apps/video/src/theme/typography.ts` from `RealtorAIMVisionWeb/src/theme/typography.ts`;
- `apps/video/src/theme/index.ts` from `RealtorAIMVisionWeb/src/theme/index.ts`.

Narrow compatibility and honesty changes were then applied:

- a minimal standalone Vite/React/TypeScript shell and lockfile;
- removal of unused imports and an explicit `any` build/lint violation;
- timeline selection now aligns the preview/playhead with the selected shot;
- the handlerless MP4 control is disabled and labelled as unconnected;
- the preview is labelled 16:9 rather than claiming a rendered resolution;
- Vite was updated to the patched 7.3.6 development toolchain.

## Explicit exclusions

The lift excludes:

- every `.git` directory and nested repository;
- OneLifestyle source code and prompt history;
- Vision Web mobile and backend trees;
- auth, credits, IAP, database, provider, Firebase, Clerk, Stripe and storage code;
- every environment file and credential surface;
- sample property media, screenshots and mutable databases;
- generated videos, logs, caches, build output and dependencies;
- all protected Copywriting, Photo AI and Appraisal source.

## Authority conclusion

The internal source-lift gate passes for this bounded Singularealty-to-Singularealty recovery. The unresolved repository-wide licence and orphan-history provenance must be resolved before treating the donor as externally redistributable or launching publicly. That release caveat does not authorise importing the OneLifestyle repository later without a separate authority decision.
