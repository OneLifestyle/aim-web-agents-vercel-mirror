
# Real Estate AIM - Copywriter Agent

## Web Agents Import Status

This app was imported into `aim-web-agents/apps/copywriting` from the frozen standalone Copywriting Web baseline.
Import provenance, safety notes, required environment variable names, runtime proof, deployment notes, and non-goals are recorded in `WEBAGENTS_IMPORT.md`.

After import, the app was proven locally with `npm ci`, `npm run build`, a dev server, and a preview server. It was pushed to `main`, mirrored to `OneLifestyle/aim-web-agents-vercel-mirror` for temporary Vercel Hobby deployment, and deployed in Vercel as `aim-web-agents-copywriting`.

The next connected-beta offer direction is documented in `docs/offer-architecture-001.md`: Listing Copy, Campaign Pack, and Campaign Blueprint. That document is architecture-only and does not implement the new UI, billing, Hub sync, provider routing changes, or Campaign Blueprint generation.

## Project Overview

**Real Estate AIM** is an advanced, AI-powered copywriting application designed specifically for the Australian real estate market. It leverages Google's Gemini API to act as an intelligent assistant for real estate agents, automating the research, strategy, and content creation process for property listings.

Unlike generic AI writing tools, this application is context-aware, incorporating real-time web research, visual analysis of property photos, and specific real estate marketing strategies (Target Markets, Writing Styles) to generate highly tailored content.

## Key Features

### 1. Property Research & Data Gathering
*   **Address Suggestions:** Gemini-backed Australian address suggestions through the server endpoint. This is not Google Maps or Google Places autocomplete yet.
*   **Automated Research:** Fetches property details, sales history, and local insights using the server-configured Gemini Pro model with Google Search Grounding.
*   **Suburb & Area Profiles:** Automatically extracts and summarizes suburb and regional lifestyle data.

### 2. Intelligent Context & Strategy
*   **AI Strategy Analysis:** Analyzes research data to automatically suggest the best "Target Market" (e.g., Young Families, Downsizers) and "Writing Style" (e.g., Aspirational, Professional).
*   **Feature Extraction:** Automatically populates property features based on online data and image analysis.
*   **Voice-to-Text:** Integrated dictation for hands-free input of specific highlights or things to avoid.

### 3. Visual Analysis
*   **Gemini Vision Integration:** Users can drag and drop property photos. The AI analyzes these images to identify architectural features, finishes, and selling points (e.g., "stone benchtops", "raked ceilings"), integrating them into the copy.

### 4. Content Generation Suite
*   **Multi-Format Output:** Generates content for various channels:
    *   **Listing Copy:** Full real estate listing text.
    *   **Social Media:** Facebook, Instagram, X (Twitter), TikTok, Google Business, Facebook Marketplace.
    *   **Marketing Materials:** Brochure copy, Flyers, Email blasts.
    *   **Content Marketing:** Long-form blog posts.
    *   **Video:** Scripts for property tour videos with director notes.
*   **Versioning:** Maintains multiple versions of copy for A/B testing or revisions.

### 5. V1 Review Workflow
*   **Generated Drafts:** Campaign outputs are read-only drafts in the primary v1 UI.
*   **Regeneration-Led Changes:** Users adjust property details, features, audience or style, then regenerate.
*   **Contact Card Injection:** The selected output includes a compact checkbox to append agent details.
*   **External Final Editing:** Final wording changes are made in the user's CRM, email, Word, Google Docs or publishing system.

### 6. Workflow & Export
*   **Campaign Status:** Plain-language progress and output state labels for trusted beta testers.
*   **Campaign Build Log:** Collapsed beta diagnostics with public-facing step names plus expandable technical details, token usage, and token-only cost estimates.
*   **Export Options:** Current output, current category, and full campaign document downloads in Word-compatible `.doc`, plain text, and print/PDF pathways.
*   **Generated-Only Downloads:** Download actions export generated outputs only. Missing outputs are not generated silently.

## Technology Stack

*   **Frontend:** React (v19), TypeScript, Vite.
*   **Styling:** Tailwind CSS.
*   **AI/LLM:** Google Gemini API (`@google/genai` SDK).
    *   *Models:* server-configured through `GEMINI_FLASH_MODEL` and `GEMINI_PRO_MODEL`.
    *   *Current routing:* Flash is used for address suggestions, image analysis, feature extraction, refinement, chat and most copy variants. Pro is used for property research, AI Strategy Analysis, full listing copy, brochure copy and long-form/blog copy.
*   **State Management:** React Hooks.

## Project Structure

*   `index.tsx`: Entry point.
*   `App.tsx`: Main application controller and UI layout.
*   `services/geminiService.ts`: Browser-side API wrapper for copywriting operations.
*   `api/copywriting.ts`: Server-side Gemini execution, beta gate, model routing, input validation, retry, and token-only usage estimates.
*   `types.ts`: TypeScript interfaces for robust type safety.
*   `constants.tsx`: UI constants, icons, and configuration lists.
