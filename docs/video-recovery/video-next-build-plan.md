# AIM Video next build plan

## Completed automated technical repair

`WEBVIDEO-AUDIO-REPAIR-002 — Repair project-following music, quieter resumed speech and add the operator audio timeline`

Automated evidence proves 63→68-second music/fade endpoint movement,
60-second source-bounded voiceover, materially quieter speech after long
silence, compact timeline/playhead accuracy, save/reopen, post-reopen retiming
and a measured real 68-second branded MP4.

## Founder audio retest completed

`WEBVIDEO-FOUNDER-AUDIO-RETEST-002 — Focused founder audio timeline retest`
was completed on 2026-08-09. The founder reported being extremely happy with
the result and described it as “Perfection.” `WEBVIDEO-FAT-001` is closed.

The accepted focus was:

1. use authorised representative photographs, music, voiceover and branding;
2. extend the project after music is added and confirm music/timeline/final fade
   move to the new endpoint;
3. confirm the compact timeline shows the source/used relationship and shared
   playhead;
4. listen through meaningful voice silence and materially quieter resumed
   speech in preview;
5. render and download the branded MP4 with voiceover;
6. confirm music recovers in silence, re-ducks on resumed quieter speech,
   returns after voiceover and continues to the relocated final fade; and
7. record focused pass/fail without reopening unrelated FAT findings.

## Acceptance focus

- short natural pauses do not cause audible pumping;
- meaningful silence inside the file restores music smoothly;
- resumed speech lowers music smoothly;
- preview and downloaded MP4 behave consistently;
- music follows project extension and continues/fades after voiceover ends;
- the timeline explains the current automatic placement without edit controls;
- no provider, Hub, deployment or unrelated refinement is inferred.

## Post-acceptance boundary

The focused technical and founder audio acceptance gates are complete. Merge,
pull request and deployment remain separate actions requiring explicit
authority; none is implied by this acceptance update. Do not roll FAT-002
through FAT-011 into the completed audio repair.

FAT-002 through FAT-011 remain open for a later accepted-alpha refinement goal:
pan labels, production-text spaces, preview workflow separation, Image Pair
selector, drag feedback, replacement-rights timing, project/title explanation,
end-card icon, stale cancellation progress and visual-design refinement.

After acceptance, a separate planning-only
`WEBVIDEO-AI-MOTION-SOURCE-PLAN-001` may assess Motion Pair inputs, provider
boundaries, rights, cost, security and fallback behavior. It must not be treated
as implementation authority.

Deployment remains a separate future `WEBVIDEO-STANDALONE-DEPLOYMENT-001`
decision and is not implied by this client alpha.
