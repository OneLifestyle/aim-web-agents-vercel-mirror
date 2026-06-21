# Copywriting Current Architecture Audit

Audit date: 2026-06-08

Source repository observed locally: `/Users/sgbcproperty/Developer/RealEstateAIM/source-mines/copywriting-web-source`

Scope: source and launch audit only. No product behaviour, prompts, routes, dependencies, application code, environment files, or external repositories were changed.

## 1. Repo and stack

### Framework and runtime

- Framework: React 19 with TypeScript and Vite.
- Rendering model: browser-only single-page application.
- Styling: Tailwind CSS loaded from CDN in `index.html`.
- AI SDK: `@google/genai`.
- Server framework: none found.
- API routes/functions: none found.

### Package manager and commands

- Package manager assumption: npm, based on `package.json` scripts and no lockfile.
- Lockfile: none found (`package-lock.json`, `pnpm-lock.yaml`, `yarn.lock`, and `bun.lockb` were not present).
- Dev command: `npm run dev`, which runs `vite`.
- Build command: `npm run build`, which runs `vite build`.
- Start/preview command: `npm run preview`, which runs `vite preview`.
- Vite dev server config: `host: '0.0.0.0'`, `port: 3000`.

### Build status

- `npm run build` was attempted locally on 2026-06-08.
- Result: failed before compilation because dependencies are not installed in this checkout: `sh: vite: command not found`.
- No dependency install was performed because this audit must not change dependencies or create lockfile churn.

### Deployment assumptions

- This is a Vite app with a Vercel serverless API route for copywriting operations.
- It has no database, durable auth service or long-lived backend process.
- Provider credentials and model execution are behind `api/copywriting.ts`.
- The current source does not require `GEMINI_API_KEY` in the browser bundle.

### Vercel readiness

- Vercel can generally build Vite static apps, but this app is not production Vercel-ready as-is.
- No `vercel.json` was found.
- No serverless functions were found for provider key protection, rate limiting, abuse controls, logging, or Hub integration.
- Required env example documentation is missing.

### AI Studio-derived indicators

- The app appears Google AI Studio-derived or AI Studio-export-like:
  - root-level `App.tsx`, `index.tsx`, and `metadata.json`;
  - direct browser-side Gemini calls;
  - `metadata.json` with `requestFramePermissions`;
  - import map in `index.html` pointing to `https://aistudiocdn.com/...`.

### Git status

- Branch: `main`.
- Tracking: `main...origin/main`.
- Status before audit edit: `docs/` was untracked.
- The requested audit file existed under the untracked `docs/` directory before this update.

## 2. App architecture

### Major files

- `index.html`: browser shell, Tailwind CDN, import map, print styles, root DOM nodes, and module entry.
- `index.tsx`: mounts `<App />` into `#root`.
- `App.tsx`: main UI, state, workflow orchestration, address suggestions, geolocation permission request, research trigger, image upload/analysis queue, strategy/feature analysis trigger, output tabs, version sets, exports, timeline, and debug stream.
- `services/geminiService.ts`: Gemini client setup, model constants, inline prompts, model calls, retries, JSON parsing, markdown cleanup, grounding source extraction, and cost estimation.
- `components/ChatBot.tsx`: floating AI assistant with optional image upload.
- `utils/fileUtils.ts`: browser file-to-base64 conversion for images.
- `constants.tsx`: target markets, writing styles, content-type labels, property types, and inline SVG icons.
- `types.ts`: app state and service response types.
- `prompts.md`: present but empty.

### Routes/pages

- No routing library is used.
- No route files are present.
- The app has one SPA screen with:
  - property address;
  - agent profile;
  - open house details;
  - property details;
  - copy context;
  - property features;
  - property photos;
  - property overview;
  - suburb and area profile;
  - visual highlights;
  - preview/output editor;
  - timeline modal;
  - debug/analysis stream;
  - floating chat assistant.

### API routes/functions

- `api/copywriting.ts` provides the same-origin serverless endpoint used by browser code.
- Gemini SDK calls are initiated from the serverless route through `@google/genai`.

### Server/client split

- The React app calls the same-origin `/api/copywriting` route.
- `vite.config.ts` does not inject provider secrets into the client bundle.
- `services/geminiService.ts` contains browser fetch wrappers only.
- The serverless boundary hides provider credentials, enforces the beta gate, validates payloads and applies best-effort in-memory throttling.

### Prompts

- Prompts live inline in `services/geminiService.ts`.
- `PROMPT_DEFINITIONS` is a small inline constant.
- Each workflow function builds its own prompt string inline.
- `prompts.md` is empty and does not appear to be used.

### Model calls

- Model calls happen in `services/geminiService.ts` via `ai.models.generateContent(...)`.
- `App.tsx` calls service functions and updates React state.
- Generated outputs are assembled in `services/geminiService.ts` from `GenerationParams`, research data, image analysis, profile data, user settings, property details, and agent profile.
- Campaign packs are assembled client-side in `App.tsx` by combining generated tab outputs.

## 3. Address and maps

### Current address flow

- The address input is a plain React text input.
- Address suggestions are debounced in `App.tsx`.
- Suggestions come from `geminiService.suggestAddresses(...)`.
- `suggestAddresses` uses `GEMINI_FLASH_MODEL` with `googleSearch` grounding and asks for five Australian street addresses matching the partial query.

### Google Maps

- README claims "Google Maps-integrated address search".
- Source code did not show Google Maps JavaScript API, Places Autocomplete, Places Details, Geocoding API, or a Maps SDK.
- No dedicated maps model constant is used by the current address flow.
- `GroundingSource` supports `type: 'web' | 'maps'`, and the UI can render a map pin for maps sources. Current source extraction only maps web grounding chunks to `type: 'web'`.

### Validation/geocoding

- No deterministic address validation was found.
- No canonical Place ID, geocode, validation status, or normalized address record is stored.
- Selecting an address suggestion only fills a string.

### Coordinates

- `App.tsx` can request browser geolocation through `navigator.geolocation`.
- Coordinates are stored temporarily in React state as `{ latitude, longitude }`.
- `userLocation` is passed into `suggestAddresses` and `researchProperty`, but the audited service code does not use those coordinates in prompts or request payloads.
- Coordinates are not stored in localStorage and do not become part of a durable property record.

### Property anchor

- Address is the main property anchor in the UI and timeline.
- There is no durable property ID, canonical address object, source-linked property record, or Hub entity.

## 4. Search and retrieval

### Search mechanism

- Web search is performed through Gemini Grounding with Google Search using `config: { tools: [{ googleSearch: {} }] }`.
- This should be described as rights-safe public web retrieval only in the sense that the app uses a provider search/grounding tool rather than custom scraping. It still needs terms, attribution, retention, and claims-review work before production.
- Current retrieval is not direct crawling and not a custom scraper.

### Query generation

- Address suggestions: prompt asks for five real-world Australian street addresses matching a partial search.
- Property research: prompt asks for a comprehensive Australian real estate research report for the supplied address, including overview, key features, suburb profile, regional profile, specs, price guide, and last sold.
- There is no explicit query planning pipeline. Query construction is delegated to Gemini grounding from prompt text.

### URL extraction

- User-provided URL extraction: not implemented. The Open House listing URL field is inserted into generated Open House copy; it is not fetched, parsed, summarized, or validated.
- Agency-owned URL extraction: not implemented.
- Listing URL extraction: not implemented.
- The placeholder example mentions `realestate.com.au`, but the URL is not fetched.
- Source-attributed hosted research: partially present. The app preserves `uri` and `title` from Gemini grounding chunks and displays them as clickable source chips.

### Page extraction and cleaning

- No direct page text extraction was found.
- No `fetch(...)`, Axios, Cheerio, DOMParser, Playwright, Puppeteer, crawler, or custom HTML parser was found.
- Browser `URL.createObjectURL(...)` is used for local image previews and downloads, not network retrieval.
- Cleaning is applied to Gemini response text through JSON extraction and markdown cleanup.

### Portal/data risk flags

- Portal scraping: no direct portal scraping was found.
- Licensed property data dependency: possible indirect risk if Gemini grounded summaries cite or summarize property portals, but no explicit licensed feed or portal API dependency was found.
- Uncontrolled public research: risk exists because Gemini Grounding can search the public web based only on the entered address, and there is no allowlist, source policy, claim verification gate, or retention policy.
- Cached property database creation: not currently present beyond localStorage timeline copies. Future Hub storage must avoid accidentally warehousing portal-derived property data without rights.

### Required terminology for future planning

- Rights-safe public web retrieval should mean provider-mediated public web evidence with citations, source policy, review flow, and storage limits.
- Agency-owned URL extraction should be a separate, consent-based feature for pages an agency controls or is authorized to use.
- User-provided URL extraction should be separate from public research and should preserve user intent, source URL, and extraction boundaries.
- Source-attributed hosted research should be implemented server-side or through AIM infrastructure, not in a public browser bundle.

## 5. AI models

### Model constants

| Constant | Model | Current use |
| --- | --- | --- |
| `GEMINI_PRO_MODEL` | server environment variable | Property research, strategy, feature extraction, final copy, variants, refinement, chat and image analysis |
| `GEMINI_FLASH_MODEL` | server environment variable | Address suggestions with Google Search grounding |

### Model usage by step

- Address suggestion: `GEMINI_FLASH_MODEL`, search-grounded, autocomplete-like generation.
- Property research: `GEMINI_PRO_MODEL`, search-grounded, extraction plus summarisation into JSON.
- Strategy analysis: `GEMINI_PRO_MODEL`, classification/summarisation into target market, writing styles, features to highlight, and things to avoid.
- Feature extraction: `GEMINI_PRO_MODEL`, extraction of property features from research/profile/image analysis.
- Image analysis: `GEMINI_PRO_MODEL`, vision extraction of concise visual selling points.
- Final listing copy: `GEMINI_PRO_MODEL`, final writing from structured inputs.
- Variants: `GEMINI_PRO_MODEL`, channel-specific rewriting from the current Full Copy.
- Refinement: `GEMINI_PRO_MODEL`, edits current output based on user instruction.
- Chat assistant: `GEMINI_PRO_MODEL`, optional image-aware assistant response.

### Routing and OpenRouter

- OpenRouter is not used.
- No other model provider was found.
- Model selection is hard-coded in `services/geminiService.ts`.
- There is no model-router abstraction, provider abstraction, policy layer, feature flag, fallback chain, or server-side routing control.

### Usage/cost logging

- `usageMetadata` is read from Gemini responses where available.
- A static local pricing table estimates cost per model.
- The debug stream shows model, input/output tokens, estimated step cost, and total session cost.
- Usage/cost is not persisted server-side and is not associated with authenticated users, jobs, properties, or a ledger.

## 6. Image analysis

### Current capability

- Image analysis exists.
- Main app users can upload or drag and drop property images.
- The main app caps queued photos at 20.
- ChatBot supports one optional image upload in a chat message.

### Upload/passing mechanism

- Images stay in browser memory until sent.
- `FileReader.readAsDataURL(...)` converts files to base64.
- The data URL prefix is removed before sending to Gemini.
- Gemini receives image data as `inlineData` with MIME type and base64 content.
- Main app image analysis runs sequentially and aggregates per-image results.

### Extracted data

- The image prompt asks for concise bullet selling points.
- Results are combined as `Image 1: ...`, `Image 2: ...`, and so on.
- Combined visual analysis can feed strategy, feature extraction, and final copy prompts.

### Cost/logging

- Image-analysis cost is estimated through `usageMetadata` and the local pricing table.
- The image sequence aggregates prompt tokens, candidate tokens, total tokens, and estimated cost into the debug log.
- There is no server-side budget cap, per-user quota, image count billing rule, compression policy, EXIF stripping policy, or persistent ledger.

### Paid hosted upgrade fit

- Image-aware copy is a strong candidate for a paid hosted upgrade later because it has clear agent value and meaningful hosted inference cost.
- A production/mobile version should add image compression, privacy/EXIF handling, claim review, cancellation, retry, and server-side quota/cost control.

## 7. Output types

### Active preview/output tabs

- Listing headline: not a dedicated active output tab.
- Listing description/listing copy: `Full Copy`.
- Just listed social copy: `Just Listed`.
- Brochure copy: `Brochure Copy`.
- Email copy: `Email`.
- Flyer copy: `Flyer`.
- Facebook caption: `Facebook`.
- Facebook Marketplace copy: `Facebook Marketplace`.
- Instagram caption: `Instagram`.
- X/Twitter copy: `X (Twitter)`.
- Google Business copy: `Google Business`.
- TikTok caption/script copy: `TikTok`.
- Open house copy: `Open House`.
- Long-form/blog copy: `Long-form / Blog`.
- Video copy/script: `Video Script`.
- Coming soon teaser: `Coming Soon Teaser`.
- Coming soon email: `Coming Soon Email`.
- Coming soon SMS: `Coming Soon SMS`.

### Other output-related constants/docs

- `CONTENT_TYPES` includes `Listing Copy`, `Social Media Caption`, `Email Blast`, `Flyer Headline`, `Press Release`, and `Long-form Blog Post`, but the active tab configuration is the source of the current UI output set.
- SEO / AI-discovery copy: no dedicated active output type found. Docs mention an "Add SEO Keywords" refinement idea/capability, but source shows generic typed refinement rather than a dedicated SEO tab.
- Website copy: not found as a dedicated output type.
- Full campaign pack: supported through `Generate Missing Tabs` and `Download Full Campaign`.

### Editing/export

- Outputs are editable in textareas.
- The current tab can be copied to clipboard, exported as Word `.doc`, exported as `.txt`, or printed/saved as PDF through `window.print()`.
- Full campaigns can be assembled and exported as Word `.doc`, `.txt`, or print/PDF.

## 8. Storage and user state

### Storage

- Timeline items are saved in browser `localStorage` under `copywritingTimeline`.
- Timeline entries include `id`, `date`, `address`, `copyType`, and `copy`.
- Version sets, research state, property state, image analysis, debug logs, and active UI state are React memory only.

### Auth/user state

- No authentication was found.
- No user accounts, sessions, roles, agency tenancy, or permissions were found.

### Property/job state

- There is no durable property record.
- There is no canonical property ID.
- There is no job history outside browser localStorage timeline.
- There is no queue, background job, retry record, or server-side state.

### Ledger/Hub

- No ledger was found.
- No database connection was found.
- No AIM Hub integration or Hub-like save/retrieve API was found.

### Downloads/exports

- Download/export is client-side only.
- Word exports are simple HTML blobs with `.doc` filenames.
- Text exports are plain text blobs.
- PDF export uses browser print flow.

## 9. Secrets and env vars

Environment variable names only:

- `GEMINI_API_KEY`: read by `api/copywriting.ts` on the server.
- `GOOGLE_GENERATIVE_AI_API_KEY`: optional server-side fallback key.
- `GEMINI_PRO_MODEL`: server-side model name for reasoning, image and grounded research operations.
- `GEMINI_FLASH_MODEL`: server-side model name for address suggestions.
- `BETA_ACCESS_CODE`: optional server-side beta gate code.

Provider-specific observations:

- AI/model providers: Gemini via `GEMINI_API_KEY`.
- Search providers: Gemini Google Search grounding through the Gemini API; no separate search API key found.
- Map/address providers: no Google Maps/Places env var found.
- Storage providers: none found.
- Auth providers: none found.
- Deployment variables: `GEMINI_API_KEY`, `GOOGLE_GENERATIVE_AI_API_KEY`, `GEMINI_PRO_MODEL`, `GEMINI_FLASH_MODEL` and `BETA_ACCESS_CODE`.

No env values were opened, listed, copied, or documented.

## 10. Standalone launch readiness

### Build/dependency readiness

- Current build status: not verified successfully.
- Local `npm run build` fails because `vite` is not installed in this checkout.
- No lockfile exists, so dependency install needs a deliberate package manager decision.
- No `.env.example` or `.env.sample` exists.

### Public launch blockers for `copywriting.realestateaim.com`

- Provider key is injected into browser-side JavaScript.
- No backend model proxy or AIM model router.
- No auth.
- No rate limiting.
- No abuse protection.
- No quota/budget controls.
- No server-side usage ledger.
- No privacy policy, terms, download disclaimer, or trust/legal copy in the app.
- No source policy for public web research.
- No claim verification gate for research-derived specs or property claims.
- No image privacy policy, resizing/compression policy, EXIF stripping, or upload retention statement.
- No durable save/retrieve flow.
- No canonical address validation.
- No production monitoring/logging.

### Hard-coded/local assumptions

- Dev server hard-coded to port `3000` and host `0.0.0.0`.
- Import map and Tailwind are CDN-backed in `index.html`.
- The app title is hard-coded as `AI Real Estate Copywriter`.
- No hard-coded local API URL was found because there is no API layer.

### Endpoint risk

- There are no public API endpoints in this repo.
- The risky public surface is the static browser app itself because it would expose the Gemini key and allow direct model/search calls from users' browsers.

### Vercel gap

- No `vercel.json`.
- No serverless function for AI calls.
- No middleware.
- No edge/runtime configuration.
- No env documentation.

## 11. Future `aim-web-agents` import assessment

### What would need to move into `apps/copywriting`

- SPA entry: `index.html`, `index.tsx`, `App.tsx`.
- Components: `components/ChatBot.tsx`, `components/Spinner.tsx`.
- Service layer: `services/geminiService.ts`, after replacing direct browser-side credentials with a server or shared AI client boundary.
- Types/constants/utils: `types.ts`, `constants.tsx`, `utils/fileUtils.ts`.
- Docs that remain relevant: this audit and selected README context.

### Shared package candidates later

- Copywriting domain types: property details, agent profile, output tabs, usage stats, timeline/job records.
- Prompt templates and model task definitions, after separating prompts from UI code.
- Source/citation data model.
- Export helpers if used across apps.
- Address/property canonicalization types.
- Model-router client/server contracts.
- Hub save/retrieve contracts.

### Monorepo compatibility

- The current app can fit into a monorepo as a Vite app, but it assumes root-level files and no workspace package conventions.
- Import aliases use `@` mapped to the app root.
- Package name contains spaces/punctuation: `real-estate-aim-|-copywriter-agent`; this may need normalization for a workspace package.
- No tests or workspace scripts exist.
- No lockfile means package manager alignment must be decided before import.

### Import risks

- Direct client-side Gemini key handling must not be imported into a public monorepo app unchanged.
- Inline prompts and hard-coded model constants make future routing harder.
- External CDN dependencies in `index.html` may conflict with monorepo build/security standards.
- README structure references `src/...` paths that do not match this repo.
- No backend boundary exists for search, citations, image analysis, rate limiting, cost logging, or Hub save/retrieve.
- Static localStorage timeline will not satisfy Hub-backed workflow needs.

### Fastest safe import path

1. Launch-readiness work should happen before import, at least enough to move Gemini calls behind a server-side boundary.
2. Create `apps/copywriting` as a Vite app or convert deliberately to the target web-agent framework if that is already standardized.
3. Move UI files with minimal behavioral change.
4. Replace `services/geminiService.ts` direct provider calls with typed calls to an AIM model-router/API boundary.
5. Add env examples and workspace package naming.
6. Add Hub-compatible save/retrieve interfaces without changing the copy workflow until the import is stable.

### Standalone before import

- A limited standalone hardening pass should happen before importing into `aim-web-agents`.
- The current repo is useful as a source mine, but importing it unchanged would carry credential, routing, storage, legal, and dependency assumptions into the monorepo.

## 12. Mobile migration assessment

| Current web capability | Native deterministic mobile tool | Apple Foundation Models candidate | AIM-managed local model candidate | Cheap hosted fallback | Paid hosted AIM model-router flow | Hub save/retrieve integration | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Address entry | Yes | No | No | Optional | Yes for canonical lookup | Yes | Current web uses AI suggestions, not deterministic address validation. Mobile should prefer provider-backed address validation and canonical metadata. |
| Geolocation permission | Yes | No | No | No | No | Optional | Current coordinates are temporary and unused by service prompts. |
| Rights-safe public web retrieval | Review UI only | No | No | Limited summarisation of already-hosted research | Yes | Yes | Keep public-web evidence retrieval hosted, source-attributed, and policy-controlled. |
| Agency-owned URL extraction | URL entry and review UI | Possible extraction from fetched text only | Possible extraction from fetched text only | Yes | Yes | Yes | Not implemented now. Future version needs consent/authorization boundaries. |
| User-provided URL extraction | URL entry and review UI | Possible extraction from fetched text only | Possible extraction from fetched text only | Yes | Yes | Yes | Not implemented now. Should preserve source URL and extracted facts. |
| Research/source citations | Display and approval UI | No | No | No | Yes | Yes | Store source-attributed hosted research, not raw uncontrolled crawl caches. |
| Property details/specs | Forms, steppers, validation | Possible cleanup | Possible cleanup | Optional | Optional | Yes | Treat AI-extracted specs as review-required claims. |
| Agent notes/context | Dictation, forms, templates | Yes | Yes | Yes | Optional | Yes | Strong on-device candidate. |
| Strategy classification | UI plus deterministic choices | Yes | Yes | Yes | Yes | Yes | Lower-cost candidate than research/final writing. |
| Feature extraction | Forms plus local parsing | Yes | Yes | Yes | Yes | Yes | Good candidate for local first, hosted fallback. |
| Final listing copy | Editor/review/export shell | Possibly for drafts | Possibly for drafts | Yes | Yes | Yes | Premium quality should use hosted model-router flow with cost controls. |
| Social captions | Channel templates, counters, preview | Yes | Yes | Yes | Yes | Yes | Good cheap/local candidate with hosted upgrade. |
| SEO / AI-discovery copy | Deterministic checklist/schema UI | Possible | Possible | Yes | Yes | Yes | Not dedicated in current web app; define explicit output type first. |
| Full campaign pack | Local assembly/share/export | Possible sections | Possible sections | Yes | Yes | Yes | Current source-of-truth pattern maps well to mobile versions. |
| Image analysis | Picker, compression, privacy, progress | Unknown | Possible if local vision exists | Possibly low-res labels | Yes | Yes | Strong paid hosted upgrade candidate. Add image privacy and claim review. |
| Chat assistant | Native chat UI | Possible | Possible | Yes | Yes | Optional | Current chat is generic and not job/pipeline aware. |
| Timeline/history | Native list UI | No | No | No | No | Yes | Replace localStorage with Hub-backed property/job/output records. |

## 13. Risks and unknowns

### Legal/rights risks

- Current search-grounded public web evidence may include property portal material indirectly.
- Even without direct scraping, future storage and reuse of research-derived property facts needs terms, attribution, retention, and agent verification rules.
- Agency-owned URL extraction and user-provided URL extraction are not implemented now and should be reviewed before adding.
- Avoid portal scraping, licensed property data dependency, uncontrolled public research, and cached property database creation in future architecture.

### Security/abuse risks

- Provider key would be exposed in a public browser bundle.
- No auth, rate limiting, abuse protection, server-side quota, or usage ledger exists.
- Search-grounded and vision calls could be expensive if publicly exposed.

### Research/claims risks

- Grounded summaries can be incomplete, stale, source-biased, or wrong.
- Source URLs/titles are preserved, but users are not forced through a claim verification workflow.
- Beds, baths, cars, land size, price guide, and last sold are AI-extracted and should not be treated as authoritative records without review.

### Provider/model risks

- The app is tightly coupled to Gemini model names in source constants.
- Gemini preview model names, search grounding support, metadata shape, and pricing may change.
- The local pricing table can drift from actual provider billing.

### Image risks

- No image resizing/compression policy found.
- No EXIF stripping policy found.
- No image retention policy found.
- No image-specific budget guardrail found beyond estimated usage logging.
- No mandatory visual-claim approval gate before claims enter copy.

### Architecture gaps

- No backend.
- No env example.
- No tests.
- No successful build in this checkout because dependencies are missing.
- No Vercel config.
- No Hub integration.
- No deterministic maps/address integration despite README language.

## 14. Recommended next task

Recommended next task: create a standalone launch hardening plan for `copywriting.realestateaim.com` that moves Gemini/search/image calls behind an AIM-owned server/model-router boundary, adds `.env.example`, auth/rate-limit/abuse controls, legal/trust copy, source policy, and a minimal Hub-compatible save model, while preserving existing product behaviour until the architecture is safe to launch.
