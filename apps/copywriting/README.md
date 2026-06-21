
# Real Estate AIM - Copywriter Agent

## Web Agents Import Status

This app was imported into `aim-web-agents/apps/copywriting` from the frozen standalone Copywriting Web baseline.
Import provenance, safety notes, required environment variable names, known next steps, and non-goals are recorded in `WEBAGENTS_IMPORT.md`.

Dependencies were not installed and runtime verification was not attempted as part of the import task.

## Project Overview

**Real Estate AIM** is an advanced, AI-powered copywriting application designed specifically for the Australian real estate market. It leverages Google's Gemini API to act as an intelligent assistant for real estate agents, automating the research, strategy, and content creation process for property listings.

Unlike generic AI writing tools, this application is context-aware, incorporating real-time web research, visual analysis of property photos, and specific real estate marketing strategies (Target Markets, Writing Styles) to generate highly tailored content.

## Key Features

### 1. Property Research & Data Gathering
*   **Address Autocomplete & Validation:** Google Maps-integrated address search.
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

### 5. Editing & Refinement Tools
*   **In-Place Editor:** Full rich-text editing capabilities.
*   **One-Click Refinements:** "Make Shorter", "More Luxury", "Add SEO Keywords".
*   **Contact Card Injection:** Toggle to automatically append agent details.
*   **Format Compliance:** Built-in rules to strictly avoid "AI-tells" like em-dashes.

### 6. Workflow & Export
*   **Analysis Stream (Debug Panel):** A real-time log of AI operations, token usage, and costs.
*   **Timeline:** Saves generation history locally for easy retrieval.
*   **Export Options:** PDF, Microsoft Word, Plain Text, and Copy to Clipboard.
*   **Download All:** Batch generation and download of all copy variants in a single document.

## Technology Stack

*   **Frontend:** React (v19), TypeScript, Vite.
*   **Styling:** Tailwind CSS.
*   **AI/LLM:** Google Gemini API (`@google/genai` SDK).
    *   *Models:* server-configured through `GEMINI_FLASH_MODEL` for address suggestions and `GEMINI_PRO_MODEL` for reasoning, vision and grounded research.
*   **State Management:** React Hooks.

## Project Structure

*   `index.tsx`: Entry point.
*   `App.tsx`: Main application controller and UI layout.
*   `services/geminiService.ts`: Core AI logic, prompt definitions, and API interaction.
*   `types.ts`: TypeScript interfaces for robust type safety.
*   `constants.tsx`: UI constants, icons, and configuration lists.
