# Copywriting Offer Architecture 001

Goal ID: `WEBAGENTS-COPYWRITING-OFFER-ARCHITECTURE-001`

Date: 2026-06-26

Scope: define a simpler Copywriting offer and product architecture before connected beta. This is a product architecture decision note only. It does not implement UI, change provider routing, change pricing, add billing, add Hub sync, add auth, add storage, or create Campaign Blueprint generation.

## Recommendation

Reframe AIM Copywriting externally around three outcome-led offers:

1. Listing Copy
2. Campaign Pack
3. Campaign Blueprint

Campaign Pack should be the recommended middle offer for connected beta. Use `Recommended` or `Best value`, not `Most popular`, until real usage supports that claim.

The core product framing is:

`The listing copy is the master narrative. The approved property brief remains the factual source. The campaign outputs are channel-specific adaptations of both.`

This reduces chooser's dilemma by asking the user which campaign outcome they need, not which of 17 internal output types they understand.

## Current-State Dependency Findings

Current output architecture:

- The configured output set has 17 total `PreviewTab` IDs in `apps/copywriting/types.ts:72`.
- `Full Copy` is the only master listing output.
- The 16 downstream campaign outputs are `Just Listed`, `Brochure Copy`, `Email`, `Flyer`, `Coming Soon Teaser`, `Coming Soon Email`, `Coming Soon SMS`, `Facebook`, `Facebook Marketplace`, `Instagram`, `X (Twitter)`, `Google Business`, `TikTok`, `Open House`, `Long-form / Blog`, and `Video Script`.
- Categories are defined in `apps/copywriting/App.tsx:38`: Listing, Coming Soon, Social Media, Events, Blog, and Video.
- `Full Copy` is described in the UI metadata as primary listing copy and the source for campaign variations in `apps/copywriting/App.tsx:54`.
- `generateCopyForTab` treats `tab !== 'Full Copy'` as a variant and blocks variant generation if the active version has no `Full Copy` in `apps/copywriting/App.tsx:1245`.
- `Generate missing` is disabled until `Full Copy` exists in `apps/copywriting/App.tsx:2608`.
- On-demand output tile clicks can generate the clicked missing output only when `Full Copy` exists in `apps/copywriting/App.tsx:1390` and `apps/copywriting/App.tsx:2786`.
- Current output, category, and campaign exports are assembled by `buildCampaignExportPlan` in `apps/copywriting/utils/exportAssembly.ts:180`.
- Download actions export generated outputs only and do not silently call generation, as documented in `apps/copywriting/docs/export-pack-001.md:19` and `apps/copywriting/docs/export-assembly-contract.md:55`.
- Generated outputs are read-only drafts in the primary v1 UI, with changes made by adjusting inputs and regenerating, as documented in `apps/copywriting/docs/v1-output-simplification-001.md:9`.

Current dependency model:

- Yes, `Full Copy` / Listing Copy is the primary generated narrative.
- Yes, campaign variants are blocked until `Full Copy` exists.
- Yes, variants are generated from the master listing plus the structured campaign context. The client passes `baseCopy` and `GenerationParams` to `generateCopyVariant` in `apps/copywriting/services/geminiService.ts:132`; the server validates property, context, image, profile, agent, and open-house inputs in `apps/copywriting/api/copywriting.ts:585`.
- When `Full Copy` is regenerated through the explicit regeneration path, sibling tabs are cleared so stale campaign variants cannot be instantly downloaded as if they still matched the new master in `apps/copywriting/App.tsx:1299`.
- Specialist variant fields are currently added for `Open House`: date, time, URL, and agent contact fields are used directly in `apps/copywriting/api/copywriting.ts:1018`.
- `Coming Soon Email` directly references agent name and agency in `apps/copywriting/api/copywriting.ts:1092`.
- Agent contact details can also be integrated into generation context or appended by the selected-output Contact card control through `apps/copywriting/App.tsx:1426`.

Implication: the current product already behaves like a two-step system internally. Step one creates the master listing narrative. Step two adapts that narrative into channel-specific outputs. A third offer should not be "better copy"; it should add a planning and discovery layer after the campaign asset bundle exists.

## Product Principles

1. Complexity belongs inside the system, not in the customer's decision.
2. The user should choose an outcome, not implementation details.
3. The current 17-tile system is useful as a review navigator after generation, but may be too much as a pre-generation selector.
4. Listing Copy should not be lower quality than Campaign Pack.
5. Campaign Pack should be more of the same campaign asset system, not better writing.
6. Campaign Blueprint should be a planning and strategy layer, not just extra words.
7. Search / AI discovery advice should follow people-first content and realistic SEO guidance. Do not promise ranking or AI answer inclusion.
8. Photo analysis is probably an input enhancement, not a third product.
9. AI Strategy Analysis and AI Feature Extraction should not become little ten-cent product buttons.
10. Regeneration should not become a lottery. Regeneration should depend on changed inputs, or be explicitly labelled as `Create another version` with allowance implications.
11. Downloads should not generate missing outputs.
12. Users should be able to progressively upgrade: Listing Copy to Campaign Pack, and Campaign Pack to Campaign Blueprint, paying only the difference in the future credit model.

## Rationale For Simplifying Choices

The current 17-output architecture is powerful but asks beta users to understand implementation structure before they know the outcome they want. Real estate agents are usually not buying "a Facebook output" or "a flyer output" in isolation. They are trying to prepare a property campaign.

Light desk research supports this direction:

- Choice overload is most likely when the decision is complex, preferences are uncertain, and options look similar.
- Three-option packaging can help when each option represents a different outcome, but it becomes manipulative or confusing when the third option is only a decoy.
- Google Search guidance continues to reward useful, original, people-first content and warns against automation used primarily to manipulate rankings.
- Google SEO guidance does not support promises that specific work will guarantee first rankings or inclusion in AI answers.

Therefore the offer should narrow the decision to three meaningful outcomes and keep the 17 outputs as internal work units and post-generation review objects.

## Three-Product Architecture

### 1. Listing Copy

Product promise: write the core property listing narrative and headline from the approved property brief.

Included outputs:

- master listing copy, currently `Full Copy`;
- headline or title treatment when the future UI separates it;
- approved property facts;
- target market;
- writing style;
- things to avoid;
- optional suburb, area, research, and photo-analysis context where already part of the workflow;
- current output download.

Excluded outputs:

- the 16 downstream campaign outputs;
- category downloads for downstream categories;
- full campaign document unless only the generated listing output exists;
- Campaign Blueprint planning sections;
- live publishing, CRM action, scheduling, or Hub sync.

Generation flow:

1. Prepare property brief.
2. Confirm audience, style, facts, features, things to avoid, and optional photo/local context.
3. Generate `Full Copy`.
4. Review and download the current output.

Export behaviour:

- Enable current-output export for the generated listing.
- Do not generate downstream outputs during download.
- If the campaign document export remains visible in an interim build, it should include only generated sections and label missing sections clearly.

Likely beta credit unit:

- Hypothesis only: 1 beta credit.
- Not final pricing, not public pricing, and not a billing implementation.

Upgrade path:

- Upgrade from Listing Copy to Campaign Pack by reusing the approved property brief and current master listing.
- Charge only the future credit difference if connected beta entitlements support differential upgrades.

Telemetry events needed later:

- `offer_cards_viewed`
- `listing_offer_selected`
- `listing_generated`
- `listing_downloaded`
- `campaign_upgrade_viewed`

Hub asset implications:

- `ApprovedCampaignBrief`
- `MasterListingCopy`
- `UsageSnapshot`
- `ExportManifest`

User-facing wording:

`Create the core property listing and headline from the approved property brief. Best when you only need the main listing narrative.`

### 2. Campaign Pack

Product promise: turn the master listing into the complete channel-ready property campaign pack.

Included outputs:

- everything in Listing Copy;
- all 16 downstream campaign outputs;
- current output downloads;
- category downloads;
- full campaign document;
- output review tiles after generation.

Downstream output IDs:

- Listing category: `Just Listed`, `Brochure Copy`, `Email`, `Flyer`
- Coming Soon category: `Coming Soon Teaser`, `Coming Soon Email`, `Coming Soon SMS`
- Social Media category: `Facebook`, `Facebook Marketplace`, `Instagram`, `X (Twitter)`, `Google Business`, `TikTok`
- Events category: `Open House`
- Blog category: `Long-form / Blog`
- Video category: `Video Script`

Excluded outputs:

- Campaign Blueprint planning sections;
- live scheduling or posting;
- analytics integration;
- Hub Campaign Studio;
- guaranteed SEO outcomes or AI-answer inclusion.

Generation flow:

1. Prepare property brief.
2. Choose Campaign Pack.
3. Generate and review the master listing.
4. Generate missing downstream campaign outputs from the master listing plus structured context.
5. Review outputs through the existing tile grid.
6. Download current output, category, or campaign document.

Export behaviour:

- Keep generated-only downloads.
- Keep `Download campaign` as one combined generated-output campaign document.
- Keep category downloads for generated outputs in the selected category only.
- Missing outputs should be omitted from export bodies and noted where useful.

Likely beta credit unit:

- Hypothesis only: 2 beta credits.
- Not final pricing, not public pricing, and not a billing implementation.

Upgrade path:

- Upgrade from Listing Copy by generating the missing downstream outputs from the already-approved master listing where the input fingerprint still matches.
- Upgrade to Campaign Blueprint by using the campaign pack as input to the planning layer.

Telemetry events needed later:

- `campaign_pack_selected`
- `campaign_pack_generated`
- `output_opened`
- `category_downloaded`
- `campaign_downloaded`
- `campaign_upgraded`
- `generate_missing_clicked`

Hub asset implications:

- all Listing Copy records;
- `CampaignOutputBundle`;
- `CampaignOutputItems`;
- `CategoryDocuments`;
- `CampaignDocument`;
- `ExportManifest`.

User-facing wording:

`Recommended. Create the listing plus the complete campaign pack for social, email, print, events, blog, and video review.`

### 3. Campaign Blueprint

Product promise: turn the campaign pack into a practical marketing plan and discovery strategy for launching the property campaign.

Included outputs:

- everything in Campaign Pack;
- campaign objective;
- positioning summary;
- target buyer summary;
- likely objections and response themes;
- channel-use plan;
- rollout calendar;
- asset-use map;
- SEO / AI discovery brief;
- search intent themes;
- editorial angle set;
- blog/article briefs;
- optional six-week content calendar;
- measurement checklist;
- assistant or marketing coordinator handoff notes.

Excluded outputs:

- better-quality listing copy as the differentiator;
- provider/model upgrade positioning;
- live scheduling;
- direct posting;
- analytics integration;
- Search Console integration;
- Hub Campaign Studio;
- guaranteed SEO outcomes;
- generated website pages;
- direct CRM actions.

Generation flow:

1. Prepare property brief.
2. Choose Campaign Blueprint.
3. Generate and review the master listing.
4. Generate Campaign Pack outputs.
5. Generate the Campaign Blueprint from the approved property brief, master listing, generated campaign outputs, and structured campaign context.
6. Review/download the campaign assets and the planning document separately.

Export behaviour:

- Keep Campaign Pack exports unchanged.
- Add a future blueprint document export when implemented.
- Blueprint export should be separate from the generated copy bundle so strategy is not confused with channel copy.
- Downloads must not generate missing campaign or blueprint sections silently.

Likely beta credit unit:

- Hypothesis only: 8 to 10 beta credits.
- Not final pricing, not public pricing, and not a billing implementation.

Upgrade path:

- Upgrade from Campaign Pack by generating only the planning layer when the input fingerprint still matches.
- If campaign outputs are stale, warn the user and require regeneration or explicit acceptance of using the previous pack as the planning basis.

Telemetry events needed later:

- `blueprint_interest_selected`
- `blueprint_generated`
- `blueprint_downloaded`
- `blueprint_upgrade_viewed`
- `blueprint_upgraded`
- `tester_confusion_reported`

Hub asset implications:

- all Campaign Pack records;
- `CampaignBlueprint`;
- `ChannelSequence`;
- `ContentCalendar`;
- `SearchDiscoveryBrief`;
- `EditorialAngleSet`;
- `MeasurementChecklist`.

User-facing wording:

`Create the campaign pack plus a practical launch plan, asset map, search/discovery brief, editorial angles, and measurement checklist.`

## Pricing And Credit Hypotheses

Credit units are beta entitlement hypotheses only:

- Listing Copy: 1 beta credit.
- Campaign Pack: 2 beta credits.
- Campaign Blueprint: 8 to 10 beta credits.

These are not public prices, production prices, billing rules, payment terms, or wallet logic. They are placeholders for connected beta entitlement testing.

Future entitlement design should support:

- differential upgrades from Listing Copy to Campaign Pack;
- differential upgrades from Campaign Pack to Campaign Blueprint;
- refund or non-consumption for provider failures;
- clear consumption for `Create another version` when inputs have not changed;
- no hidden credit consumption from downloads.

## Interface Implications

Do not implement this UI in this goal. Recommended future UI:

### Step 1: Prepare Property Brief

User enters address, confirms property facts, shapes audience/style, adds things to avoid, and optionally uses research/photo analysis where already part of the workflow.

The approved property brief is the factual source for later generation and export manifests.

### Step 2: Choose Outcome

Show three cards:

- Listing Copy
- Campaign Pack, labelled `Recommended` or `Best value`
- Campaign Blueprint

Each card should describe the outcome, not model tier, token use, or internal output count. Avoid asking the user to choose from 17 output tiles before generation.

### Step 3: Generate Master Listing

Generate the master listing first for all offers. The listing must be reviewable before downstream work continues.

### Step 4: Continue Based On Selected Outcome

- Listing Copy stops at the reviewed master listing and current-output download.
- Campaign Pack generates downstream campaign outputs.
- Campaign Blueprint generates campaign strategy and discovery planning after Campaign Pack exists.

### Step 5: Review And Download

Keep the current tile grid as a post-generation review navigator. The tile grid remains useful for opening outputs, seeing ready/missing states, generating missing outputs, and downloading current output/category/campaign documents.

## Minimum Credible Campaign Blueprint

Campaign Blueprint must add a different outcome, not merely extra copy. The minimum credible scope is one practical plan document with these sections:

- campaign objective;
- positioning summary;
- target buyer summary;
- likely objections and response themes;
- channel-use plan;
- rollout calendar;
- asset map;
- SEO / AI discovery brief;
- search intent themes;
- editorial angle set;
- blog/article briefs or a small number of distinct long-form ideas;
- optional six-week content calendar;
- measurement checklist;
- assistant / marketing coordinator handoff notes.

Search and AI discovery guidance must be realistic:

- prioritize people-first, useful, original content;
- connect discovery advice to the actual property, suburb, buyer intent, and campaign assets;
- avoid spammy mass-page tactics;
- avoid ranking guarantees;
- avoid promises of AI-answer inclusion;
- explain that SEO and AI discovery work can improve clarity, crawlability, usefulness, and promotion readiness, but cannot control search or AI-system outcomes.

Not included yet:

- live scheduling;
- direct posting;
- analytics integration;
- Search Console integration;
- Hub Campaign Studio;
- guaranteed SEO outcomes;
- generated website pages;
- direct CRM actions;
- paid ad management;
- compliance approval workflow.

## Regeneration And Stale-State Rules

Future builds should define an `inputFingerprint` for each generated artifact. It should be a deterministic snapshot of the approved property brief, structured facts, copy context, image-analysis summary, profile inclusion, agent/open-house fields used by the artifact, master listing dependency, and offer/version metadata.

Conceptual rules:

- Retry failed operation: enabled after a failed operation. It should reuse the same input fingerprint and not consume a new allowance if the provider failed before a usable output was returned.
- Regenerate after input change: enabled when the current approved input fingerprint differs from the artifact fingerprint. It should consume the relevant allowance because the user is asking for a new output based on changed inputs.
- Create another version: enabled when inputs have not changed and the user wants an alternative. It should be explicitly labelled as creating another version and should consume an allowance if the future credit model treats alternates as billable.
- Generate missing output: enabled only when the prerequisite master listing exists and the missing output has no generated artifact for the current input fingerprint.
- Upgrade from Listing Copy to Campaign Pack: enabled when the master listing exists and matches the current approved brief fingerprint. It should generate the downstream outputs and consume only the future credit difference.
- Upgrade from Campaign Pack to Campaign Blueprint: enabled when Campaign Pack exists and matches the current approved brief/master/outputs fingerprint. It should generate only the planning layer and consume only the future credit difference.

Stale warnings:

- If property facts, features, audience, style, things to avoid, photo analysis, profile inclusion, agent details, or open-house fields change after generation, affected outputs become stale.
- If the master listing changes, downstream campaign outputs become stale.
- If downstream campaign outputs change, Campaign Blueprint becomes stale.
- Stale artifacts remain visible for review/export only if clearly labelled as generated from earlier inputs.
- Downloads must not silently regenerate stale or missing outputs.

Button enablement:

- `Generate Listing Copy`: enabled when required property brief inputs are sufficient and no conflicting operation is running.
- `Generate missing`: enabled when the master listing exists and at least one downstream output is missing or stale for the current input fingerprint.
- `Retry`: enabled on failed operations.
- `Regenerate after input change`: enabled when an artifact is stale.
- `Create another version`: enabled when no relevant input changed but the user wants an alternative.
- `Upgrade`: enabled when the lower-tier prerequisite exists, or enabled with clear messaging that prerequisites will be generated first.

Credits and allowances:

- Provider/system failures should not consume credits if no usable output is returned.
- User-cancelled operations should consume credits only if a usable output was returned and saved to the campaign state.
- Downloads should never consume generation credits.
- `Create another version` should be treated separately from failure retry.

## Beta Telemetry Implications

Do not implement telemetry in this goal. Connected beta should later track:

- `offer_cards_viewed`
- `listing_offer_selected`
- `campaign_pack_selected`
- `blueprint_interest_selected`
- `listing_generated`
- `campaign_pack_generated`
- `campaign_upgrade_viewed`
- `campaign_upgraded`
- `blueprint_upgrade_viewed`
- `blueprint_upgraded`
- `blueprint_generated`
- `output_opened`
- `current_output_downloaded`
- `category_downloaded`
- `campaign_downloaded`
- `blueprint_downloaded`
- `generate_missing_clicked`
- `create_another_version_clicked`
- `regenerate_after_input_change_clicked`
- `retry_failed_operation_clicked`
- `stale_output_warning_viewed`
- `upgrade_difference_shown`
- `tester_confusion_reported`

Telemetry should capture offer selection, upgrade friction, stale-state confusion, download intent, and which outputs are actually opened after generation. It should not log secrets, raw provider prompts, private contact details, or full generated copy unless a later privacy review explicitly approves that.

## Hub And Asset Implications

Do not implement Hub sync in this goal. Future Hub mapping should remain contract-level until a Hub-owned integration goal exists.

Listing Copy creates:

- `ApprovedCampaignBrief`
- `MasterListingCopy`
- `UsageSnapshot`
- `ExportManifest`

Campaign Pack adds:

- `CampaignOutputBundle`
- `CampaignOutputItems`
- `CategoryDocuments`
- `CampaignDocument`

Campaign Blueprint adds:

- `CampaignBlueprint`
- `ChannelSequence`
- `ContentCalendar`
- `SearchDiscoveryBrief`
- `EditorialAngleSet`
- `MeasurementChecklist`

Hub boundary:

- AIM Hub owns identity, wallet, credits, profile, properties, jobs, assets, ledger, storage, sharing, timeline, and workspace state.
- Copywriting should generate, edit, preview, and package outputs.
- Durable state should flow back through Hub-owned workflows when a future explicit Hub integration is approved.

## Open Questions

- Should Campaign Pack generate all 16 downstream outputs automatically after master review, or offer a single "Generate complete pack" confirmation?
- Should Listing Copy expose the existing `Full Copy` label anywhere, or fully rename it to `Listing Copy` in user-facing UI?
- Should Campaign Blueprint require all Campaign Pack outputs, or allow a planning layer based on a partial pack with explicit limitations?
- Should Blog and Long-form outputs remain in Campaign Pack once Blueprint introduces editorial planning?
- How should future Hub credit differences be represented when a user upgrades after using `Create another version`?
- Which fields should be included in the first implementation of `inputFingerprint`, and which optional fields should affect only specific outputs?

## Recommended Next Implementation Goal

Recommended next goal: `WEBAGENTS-COPYWRITING-OFFER-UI-001`.

Scope for that future goal:

- implement the three-card outcome selection after property brief preparation;
- keep Campaign Pack as `Recommended` or `Best value`;
- generate the master listing first for all offers;
- preserve current tile grid as post-generation review navigation;
- preserve generated-only downloads;
- introduce conceptual stale-state labels only if they can be backed by an implemented input fingerprint;
- do not add billing, Hub sync, provider routing changes, or Campaign Blueprint generation unless separately approved.

## Internal Review

Scope Auditor: this goal is documentation-only. No product implementation, provider routing, Hub, auth, billing, production pricing, SEO tooling, AI-search tooling, dependencies, environment files, storage, or database schema were added.

Product Architecture Auditor: the recommendation distinguishes the approved property brief as factual source, Listing Copy / `Full Copy` as master narrative, Campaign Pack outputs as channel-specific adaptations, and Campaign Blueprint as planning/discovery strategy.

Choice Load Auditor: the proposal reduces the pre-generation decision from 17 output choices to three outcome cards, while preserving the current 17-tile system as a post-generation review navigator.

Pricing/Entitlement Auditor: all credit references are explicitly beta hypotheses and not public pricing or billing logic.

SEO/AI Discovery Auditor: the proposal does not promise rankings, traffic, Search indexing, or AI-answer inclusion. It requires people-first content and rejects spammy search-first tactics.

Hub Boundary Auditor: Hub implications are contract-level only. No Hub records, sync, auth, wallet, ledger, asset storage, sharing, workspace, or timeline implementation is added.

Git Hygiene Auditor: no secrets, environment files, build outputs, screenshots, dependency folders, Vercel config, or generated provider output should be staged.
