# Project Features & Roadmap

This document tracks the features, work in progress, and future ideas for the AI Real Estate Copywriter application. It serves as a persistent context for development sessions.

---

## Work in Progress

- [x] **Implement Multi-level Tab System:**
  - [x] Rework the preview section to support main tabs (Listing, Social Media, Blog) and sub-tabs.
  - [x] **Listing Tab:** Add "Full Copy" and "Brochure Copy" sub-tabs.
  - [x] **Social Media Tab:** Add sub-tabs for Facebook, Instagram, X (Twitter), Google Business, and TikTok.
- [x] **Establish "Source of Truth" Logic:**
  - [x] The "Full Copy" is the primary source for all other generated text.
  - [x] When a variant (e.g., social media post) is generated, it uses the current "Full Copy" as its basis.
- [x] **In-place Editing:** Allow the user to directly edit the text within the preview `textarea`.
- [x] **Visual Stale/Edited Indicator:**
    - [x] When "Full Copy" is refined or edited, show a visual indicator on other tabs that are out of sync.
    - [x] Show a visual indicator when any copy has been manually edited by the user.

---

## Next Steps

- **Dynamic Prompt for Social Media:** The prompts for social media should be more dynamic, potentially taking into account whether an open house date has been provided (to create "Event" copy).
- **Refine Timeline UI:** Improve the layout and functionality of the "Timeline" modal for better usability.

---

## Future Features

- **Brochure Builder:** Integrate a simple brochure design tool that pulls in the generated "Brochure Copy" and allows users to add photos to create a printable PDF.
- **Full Social Media Scheduler:**
  - Expand the social media functionality into a full-fledged scheduler.
  - Allow users to connect their social media accounts (Facebook, Instagram, etc.).
  - Generate appropriate image thumbnails or previews for posts.
  - Schedule posts to be published at a later date.
- **Video Script Generator:**
  - A new content type for generating video scripts for property tours.
  - The script should be based on the listing copy but structured for spoken word (narrative style).
  - Include director-style notes in the script (e.g., `[Camera pans across the kitchen]`, `[Show wide shot of the backyard]`).
- **Facebook Marketplace Variant:** Add a specific copy variant tailored to the format and audience of Facebook Marketplace listings.
- **Legal & Compliance:**
    - **Privacy Policy:** Integrate a clear privacy policy explaining data usage.
    - **Terms of Use:** Require users to agree to Terms of Use before using the application.
    - **Download Disclaimer:** Show a disclaimer modal when a user exports copy, confirming they are responsible for the final content. The disclaimer should state that the tool's output is for suggestion purposes and should be verified for accuracy.
