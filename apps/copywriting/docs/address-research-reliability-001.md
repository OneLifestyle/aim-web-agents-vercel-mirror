# Copywriting Address Research Reliability 001

Goal ID: `WEBAGENTS-COPYWRITING-ADDRESS-RESEARCH-RELIABILITY-001`

Date: 2026-06-23

Scope: targeted address lookup and Fetch Details reliability fix inside `apps/copywriting`. This goal did not add provider integrations, dependencies, environment files, platform services, Hub/auth/billing work, database schema, ZIP export, or the larger Campaign Outputs layout redesign.

## Address Lookup Architecture Finding

- The address input and suggestion UI are owned by `App.tsx`.
- Suggestions call `geminiService.suggestAddresses(...)`, which posts to the same-origin `/api/copywriting` endpoint.
- The server operation is `suggestAddresses` in `api/copywriting.ts`.
- The operation is Gemini-backed through the server-configured Flash model route, currently surfaced from provider metadata as values such as `gemini-3-flash-preview` when configured that way.
- The server suggestion prompt uses Gemini with Google Search grounding. It is not Google Maps JavaScript, Google Places Autocomplete, Places Details, Geocoding, or a deterministic address validation provider.

## Why It Is Not Google Maps-Style Autocomplete Yet

The current implementation asks a model to search and generate likely Australian street-address matches. That can be useful, but it has model latency, serverless cold-start risk, and variable provider usage metadata. It should not be described as true Places-style instant autocomplete until a deliberate Places-style provider decision is made in a future goal.

## Call-Volume Changes

- Minimum normalized query length increased from 3 to 5 characters.
- Debounce is now 450 ms, with immediate queued UI feedback.
- Exact normalized duplicate queries are not sent again.
- Recent suggestion results are cached in-session by normalized query.
- In-flight browser requests are aborted when typing continues, a suggestion is selected, or Fetch Details starts.
- Stale responses are ignored by request sequence ID before they can update visible suggestions or logs.

## Selected Address Handoff Rule

Fetch Details snapshots the selected suggestion only when it still matches the current typed field after normalization. Otherwise it snapshots the typed address. Starting Fetch Details invalidates address lookup requests, hides suggestions, and uses that stable snapshot for property research.

## Campaign Build Log Rule

Address suggestions now use a single collapsed `Address Suggestions` log entry that is updated for the latest lookup or selected address. Intermediate partial lookups no longer flood the main Campaign Build Log. Provider model, usage, token-only cost, and the `Grounding/tool charges not included` caveat remain available when the latest completed lookup returned usage metadata.

## Fetch Details JSON Reliability

- Research JSON is extracted with the existing robust JSON parser.
- The parsed response is validated before client-visible fields are applied.
- Required fields are checked: `summary`, `keyFeatures`, `suburbProfile`, `regionalProfile`, and `specs`.
- Numeric spec values are narrowed to numbers or `null`.
- If the first research response is empty, malformed, wrapped in prose, or invalid by shape, the server performs one repair retry using the same resolved Pro model.
- If repair fails, Fetch Details returns a clear failure and does not apply partial data.
- The client no longer clears prior successful research/property detail state before a new Fetch Details run succeeds, so a malformed response does not corrupt the existing form.

## Preserved Behaviour

- AI Strategy Analysis remains routed to Pro.
- Image Analysis remains routed to Flash.
- Copy Context AI Analysis and Property Features AI Analysis remain independently runnable.
- Duplicate clicks of the same guarded operation remain blocked.
- Generate Missing Tabs remains independent from unrelated analysis buttons.
- Export labels remain as `Download current section` and `Download full campaign document`.
- The Campaign Build Log and token-only cost caveats remain visible.

## Deferred

- True Google Places-style autocomplete remains a future product/provider decision.
- Deterministic place IDs, geocoding, address validation, and canonical property records remain deferred.
- The larger single-column Campaign Outputs redesign remains deferred.
- The Campaign action progress strip visual redesign remains deferred.
- ZIP export remains deferred.
- Hub-owned durable jobs, state, assets, storage, identity, wallet, credits, ledger, and workspace workflows remain deferred.
