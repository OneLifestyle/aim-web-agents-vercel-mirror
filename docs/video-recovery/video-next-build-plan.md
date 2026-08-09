# AIM Video next build plan

## Completed technical repair

`WEBVIDEO-VOICEOVER-EXPORT-REPAIR-001 — Add speech-aware music ducking and prove preview/export parity`

`WEBVIDEO-FAT-001` is technically repaired. Local energy analysis now creates a
reusable source-hash-bound voice-activity envelope; preview and export share its
smoothed 28% ducking gain. A real branded synthetic MP4 proves first-speech
duck, five-second-silence recovery and resumed-speech duck. Founder acceptance
is not complete.

## Exact next goal

**`WEBVIDEO-FOUNDER-VOICEOVER-RETEST-001 — Founder voiceover silence-recovery retest.`**

Repeat only founder tap-through Sections 8 and 12 on the intended operator Mac
and current Chrome:

1. use authorised representative photographs, music, voiceover and branding;
2. listen through a meaningful silent passage inside the voiceover in preview;
3. render and download the branded MP4;
4. confirm music recovers smoothly in that silence and ducks again on resumed
   speech in the downloaded file;
5. record pass/fail for Sections 8 and 12 only.

## Acceptance focus

- short natural pauses do not cause audible pumping;
- meaningful silence inside the file restores music smoothly;
- resumed speech lowers music smoothly;
- preview and downloaded MP4 behave consistently;
- no provider, Hub, deployment or unrelated refinement is inferred.

## Repair threshold

Do not merge on technical evidence alone. Merge is not recommended until the
founder confirms downloaded branded-MP4 silence recovery. If the bounded retest
still fails, open a new narrow blocker with the exact authorised-media behavior;
do not roll FAT-002 through FAT-011 into it.

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
