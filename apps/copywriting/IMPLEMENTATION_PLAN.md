# Implementation Plan & Roadmap

## Current Status
The application is currently a fully functional **Minimum Viable Product (MVP)** with "Advanced" features. It successfully performs end-to-end copywriting workflows: from address input and research to strategy formulation and multi-format content generation.

## Immediate Next Steps (Polishing)

### 1. Dynamic Social Media Prompts
*   **Task:** Update social media prompts to be time-aware.
*   **Detail:** If an "Open House" date is detected in the research or inputs, the social media captions should automatically reference it (e.g., "Join us this Saturday!").

### 2. Timeline UI Improvements
*   **Task:** Refine the "Timeline" modal.
*   **Detail:** Add filtering by address or date. Allow users to "Restore" a previous version directly into the active editor, rather than just copying to clipboard.

### 3. Brochure Builder (Low Fidelity)
*   **Task:** Create a simple "Print Preview" mode.
*   **Detail:** Allow the user to select the "Brochure Copy" and 1-3 uploaded photos to generate a clean, printable PDF layout directly from the browser.

## Phase 2: User System & Integration (The "Larger Project")

### 1. Authentication & Persistence
*   **Goal:** Move from LocalStorage to a backend database.
*   **Features:**
    *   User Login/Sign-up.
    *   Cloud-based saving of properties and copy history.
    *   Agent Profiles (saving name, agency, phone, email permanently).

### 2. Integration with CRM/Portals
*   **Goal:** Connect the output directly to real estate platforms.
*   **Features:**
    *   API integration to push listing copy directly to CRM systems (e.g., Agentbox, Rex).
    *   "Email to myself" feature.

### 3. Advanced Customization
*   **Goal:** Allow agents to fine-tune the AI's "Voice".
*   **Features:**
    *   **Custom Prompting:** Allow users to save their own "Writing Style" definitions (e.g., "My Agency Style").
    *   **Template Library:** Users can define their own structure for listing copy.

## Phase 3: Future Vision

### 1. Video Generation
*   **Concept:** Use the Gemini Video generation capabilities (Veo) or slide-show generation.
*   **Feature:** Convert the "Video Script" output + uploaded images into a rough-cut video slideshow with AI voiceover.

### 2. Social Media Scheduler
*   **Concept:** Full social media management.
*   **Feature:** Connect Facebook/Instagram accounts. Allow users to schedule the generated posts directly from the app.

### 3. Mobile App / Responsive Redesign
*   **Concept:** Field tool for agents.
*   **Feature:** Optimize the UI for tablet/mobile so agents can generate copy while standing in the property during an appraisal.
