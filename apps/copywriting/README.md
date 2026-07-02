
# Real Estate AIM - Copywriter Agent

## Web Agents Import Status

This app was imported into `aim-web-agents/apps/copywriting` from the frozen standalone Copywriting Web baseline.
Import provenance, safety notes, required environment variable names, runtime proof, deployment notes, and non-goals are recorded in `WEBAGENTS_IMPORT.md`.

After import, the app was proven locally with `npm ci`, `npm run build`, a dev server, and a preview server. It was pushed to `main`, mirrored to `OneLifestyle/aim-web-agents-vercel-mirror` for temporary Vercel Hobby deployment, and deployed in Vercel as `aim-web-agents-copywriting`.

The connected-beta offer direction is documented in `docs/offer-architecture-001.md`: Listing Copy, Campaign Pack, and Campaign Blueprint. The first UI pass is documented in `docs/offer-ui-001.md`; it implements the offer-led interface without billing, Hub sync, provider routing changes, or Campaign Blueprint generation.

The current private-beta structure is documented in `docs/brief-output-workspace-001.md`. It separates the app into `Brief Builder` and `Output Workspace`, removes the legacy sticky Generate Listing Copy bar, gates Listing Copy generation behind a ready property brief, and keeps the 17-output tile grid as Campaign Library review navigation rather than the primary pre-generation choice.

The workspace density and photo-analysis follow-up is documented in `docs/workspace-density-visuals-001.md`. It tightens card spacing, adds collapsible Property Overview and Suburb & Area Profile sections, renames the visible `Copy Context` section to `Campaign Direction`, makes the 20-photo cap visible, numbers uploaded images, and renders Visual Highlights as summary-first expandable rows.

The Hub-style visual polish pass is documented in `docs/hub-style-design-polish-001.md`. It introduces lightweight local visual class tokens in `App.tsx`, calms the page shell, cards, buttons, chips, Campaign Library, Visual Highlights, diagnostics and generated-draft warning without changing workflow behaviour or adding dependencies.

The pre-Kevin UX polish pass is documented in `docs/pre-kevin-ux-fixes-001.md`. It fixes Additional Property Features double-bullet rendering, removes duplicate Listing Copy generation buttons, keeps the primary Listing Copy action red, guards same-input regeneration, and warns before clearing Campaign Pack outputs during Listing Copy regeneration.

The Campaign Pack error-handling pass is documented in `docs/campaign-pack-errors-001.md`. It keeps successful downstream outputs after a mid-run failure, marks the failed output where available, shows a recoverable retry message, and expands Campaign Build Log diagnostics without adding provider routing, billing, storage, Hub sync, or dependencies.

The secondary beta-access-code pass is documented in `docs/beta-access-codes-001.md`. `BETA_ACCESS_CODE` remains supported, and optional `BETA_ACCESS_CODES` can be configured in deployment environment variables for additional private beta testers without committing code values.

The laptop-first flow pass is documented in `docs/laptop-first-flow-001.md`. It requires a selected address suggestion before Fetch Details, introduces the five-step Property Brief to Outputs workflow, collapses the layout to a main stacked flow on laptop, demotes beta diagnostics, groups fetched context under Property Brief, and scrolls/focuses generated outputs after generation.

The floating general `AI Assistant` chat surface is disabled for the private beta. The decision and deferred contextual-assistant/export-settings ideas are recorded in `docs/chat-assistant-disabled-001.md`.

## Project Overview

**Real Estate AIM** is an advanced, AI-powered copywriting application designed specifically for the Australian real estate market. It leverages Google's Gemini API to act as an intelligent assistant for real estate agents, automating the research, strategy, and content creation process for property listings.

Unlike generic AI writing tools, this application is context-aware, incorporating real-time web research, visual analysis of property photos, and specific real estate marketing strategies (Target Markets, Writing Styles) to generate highly tailored content.

## Key Features

### 1. Property Research & Data Gathering
*   **Address Suggestions:** Gemini-backed Australian address suggestions through the server endpoint. This is not Google Maps or Google Places autocomplete yet.
*   **Automated Research:** Fetches property details, sales history, and local insights using the server-configured Gemini Pro model with Google Search Grounding.
*   **Suburb & Area Profiles:** Automatically extracts and summarizes suburb and regional lifestyle data.

### 2. Intelligent Context & Strategy
*   **Campaign Direction:** Analyzes research data to automatically suggest the best "Target Market" (e.g., Young Families, Downsizers) and "Writing Style" (e.g., Aspirational, Professional).
*   **Feature Extraction:** Automatically populates property features based on online data and image analysis.
*   **Voice-to-Text:** Integrated dictation for hands-free input of specific highlights or things to avoid.

### 3. Visual Analysis
*   **Gemini Vision Integration:** Users can drag and drop up to 20 numbered property photos. The AI analyzes these images to identify architectural features, finishes, and selling points, then renders Visual Highlights as per-image summaries with expandable details.

### 4. Content Generation Suite
*   **Multi-Format Output:** Generates content for various channels:
    *   **Listing Copy:** Full real estate listing text.
    *   **Social Media:** Facebook, Instagram, X (Twitter), TikTok, Google Business, Facebook Marketplace.
    *   **Marketing Materials:** Brochure copy, Flyers, Email blasts.
    *   **Content Marketing:** Long-form blog posts.
    *   **Video:** Scripts for property tour videos with director notes.
*   **Versioning:** Maintains multiple versions of copy for A/B testing or revisions.
*   **Offer-Led Flow:** Guides users through Listing Copy first, then Campaign Pack for the full downstream output package. Campaign Blueprint is visible as planned beta only.
*   **Brief Builder / Output Workspace:** Input gathering, fetched-property review and context live in Brief Builder. Listing Copy, Campaign Pack, Campaign Library review and downloads live in Output Workspace.
*   **Guarded Regeneration:** Regenerate Listing Copy is available only after relevant brief inputs change, and warns before clearing existing Campaign Pack outputs.

### 5. V1 Review Workflow
*   **Generated Drafts:** Campaign outputs are read-only drafts in the primary v1 UI.
*   **Regeneration-Led Changes:** Users adjust property details, features, audience or style, then regenerate.
*   **Contact Card Injection:** The selected output includes a compact checkbox to append agent details.
*   **External Final Editing:** Final wording changes are made in the user's CRM, email, Word, Google Docs or publishing system.

### 6. Workflow & Export
*   **Campaign Status:** Plain-language progress and output state labels for trusted beta testers.
*   **Laptop-First Flow:** A five-step workflow anchors Property Brief, Agent and Open Home, Campaign Direction, Features and Photos, and Outputs and Downloads. Fetch Details requires a selected address suggestion before property research starts.
*   **Campaign Build Log:** Collapsed beta diagnostics with public-facing step names plus expandable technical details, token usage, token-only cost estimates, and recoverable Campaign Pack partial-failure detail.
*   **Export Options:** Current output, current category, and full campaign document downloads in Word-compatible `.doc`, plain text, and print/PDF pathways.
*   **Generated-Only Downloads:** Download actions export generated outputs only. Missing outputs are not generated silently.

## Technology Stack

*   **Frontend:** React (v19), TypeScript, Vite.
*   **Styling:** Tailwind CSS.
*   **AI/LLM:** Google Gemini API (`@google/genai` SDK).
    *   *Models:* server-configured through `GEMINI_FLASH_MODEL` and `GEMINI_PRO_MODEL`.
    *   *Current routing:* Flash is used for address suggestions, image analysis, feature extraction, refinement, dormant chat operation and most copy variants. Pro is used for property research, AI Strategy Analysis, full listing copy, brochure copy and long-form/blog copy.
*   **State Management:** React Hooks.

## Project Structure

*   `index.tsx`: Entry point.
*   `App.tsx`: Main application controller and UI layout.
*   `services/geminiService.ts`: Browser-side API wrapper for copywriting operations.
*   `api/copywriting.ts`: Server-side Gemini execution, beta gate, model routing, input validation, retry, and token-only usage estimates.
*   `types.ts`: TypeScript interfaces for robust type safety.
*   `constants.tsx`: UI constants, icons, and configuration lists.

## Beta Access Environment

The private beta gate reads beta code configuration on the server only.

*   `BETA_ACCESS_CODE`: existing primary beta access code.
*   `BETA_ACCESS_CODES`: optional additional beta access codes separated by comma, semicolon, newline, or whitespace.

Do not commit beta access code values. Tester-specific codes should be configured in Vercel environment variables and may require a redeploy after changes. This beta gate is not real user authentication and does not create user accounts or tenant logging.
