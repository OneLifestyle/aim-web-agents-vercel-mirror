# Client-alpha operator guide

1. Open AIM Video and choose **Create local project**, or open a project already
   saved in this browser.
2. Name the project and optionally add the property address in the header.
3. Confirm photograph permission, then use **Choose photos** to add 15–30 JPEG,
   PNG or WebP property photographs. File problems appear beside intake.
4. In **Arrange video**, drag shot handles or use **Move Up** and **Move Down**.
5. Choose **Single Image** with Still, Zoom In, Zoom Out, Pan Left or Pan Right,
   or choose **Image Pair** and select a real end photograph. Image Pair exports
   a deterministic cross-dissolve proxy; AI Motion Pair is not connected.
6. Set each shot duration. Use **Replace** or **Replace end** to change one
   source without changing other shot settings. Use **Preview** on a card to
   seek the complete preview to that shot.
7. Add the title/address, authorised music or optional voiceover, volume/fades,
   optional logo/watermark and closing details under **Production settings**.
   **Reduce music while speech is detected** lowers music during likely spoken
   regions, holds through short pauses and recovers smoothly during meaningful
   silence inside the voiceover file. Analysis happens locally when voiceover
   is added and is reused after save/reopen.
8. Choose **Unbranded 16:9** or **Branded 16:9**. Unbranded is a portal-safe
   candidate, not a universal compliance certification.
9. Use the complete preview to play, pause and seek through shots, overlays,
   audio and the end card.
10. Choose **Render MP4**. Keep the tab open while local encoding runs. The
    editing controls lock to the exact project snapshot while the control
    reports progress and may be cancelled. A successful render is
    inspected, downloaded and saved to the local project record.
11. Use **Save locally** before **Close**. Open the project again from the home
    screen to continue working. The header shows **Unsaved changes** after an
    edit, locks editing while a save is running and asks before discarding
    unsaved work. There is no cloud sync.

Current Chrome with WebCodecs H.264 and AAC encoder support is required for
export. A visible capability error is shown when the browser cannot provide it.
An undecodable voiceover also returns a visible local-analysis error; no audio
is uploaded or transcribed.

`WEBVIDEO-FAT-001` is technically repaired by synthetic preview/export evidence,
but founder acceptance is not complete. The next founder check is
`WEBVIDEO-FOUNDER-VOICEOVER-RETEST-001`, repeating only tap-through Sections 8
and 12 with authorised real-world media. Findings FAT-002 through FAT-011 remain
open for a later accepted-alpha refinement goal.
