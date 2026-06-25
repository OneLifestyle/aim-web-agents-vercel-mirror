# Campaign Outputs UX 004

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-004`

Date: 2026-06-25

Scope: compact UX polish for the Copywriting Web Agent Campaign Outputs action layer before export-pack work. This goal changed only `apps/copywriting` UI and documentation. It did not add platform integrations, dependencies, auth, Hub, billing, storage, database schema, environment files, secrets, Google Places, ZIP packaging, provider routing, or new AI routes.

## Why This Came Before Export-Pack

Export-pack work remains deferred until the review surface feels beta-ready. The previous layout had improved action placement, but current-output actions still competed with the selected-output header and made the card feel heavier than the task required.

This pass makes output review more direct before adding any larger packaging flow.

## Selected Output Header

The selected output card header now contains only the current output title, status chip, and version controls.

Repeated output description copy was removed from this header because each output tile already carries the item description.

## Current-Output Action Placement

Current-output actions now sit below the generated text area, close to the output they affect:

- `Copy`
- `Download`
- `Contact card`
- `Edit`
- `Refine beta`
- `Save`

The underlying handlers remain the existing copy, selected-output export, contact-card toggle, local edit, beta refine, and local timeline save paths.

## Compact Campaign And Category Actions

Campaign-level actions near the Campaign Outputs summary now use compact visible labels:

- `Generate missing`
- `Download campaign`

The category export action remains beside the selected category summary and now uses the compact visible label `Download category`.

Accessible labels preserve the fuller meanings:

- `Generate missing outputs`
- `Download full campaign document`
- `Download current category`

## Local Edit And Beta Refine Demotion

Generated output remains read-only by default. Local editing and beta refine stay secondary in the bottom action row, with a short local/beta note instead of a large explanatory panel.

The advanced refine input remains collapsed until opened and still warns, briefly, that the current output and instruction are sent back through the model.

## Accessibility

Compact controls use visible icons plus short labels, with `aria-label` and/or `title` text retained for the current-output, category, campaign, version, local edit, beta refine, and local timeline controls.

## Preserved Behaviour

- Missing output generation still routes through the selected output path.
- Queued missing output generation is preserved.
- Duplicate queued output entries remain blocked.
- Generate missing outputs remains on the existing campaign variation path.
- Copy current output remains on the existing clipboard path.
- Download current output remains on the selected-output export path.
- Download current category remains on the current-category export path.
- Download full campaign document remains on the combined campaign export path.
- Campaign Build Log remains visible.
- Address lookup and Fetch Details remain unchanged.
- AI Strategy Analysis remains routed to Pro.
- Image Analysis remains routed to Flash.

## Deferred

- Full Canvas-style focus mode.
- Full single-column anchored review flow.
- True rich editor.
- Primary free-form refinement/chat workflow.
- ZIP export.
- Hub asset persistence.
- Auth, billing, provider-router, and platform integration work.

## Internal Audit

Scope Auditor: no platform integration, Hub/auth/billing/provider work, full app rewrite, database schema, environment file, dependency, Vercel config, or ZIP export was added.

Header Auditor: selected output header is limited to title, status, and version controls; repeated tile descriptions were removed from the header.

Action Placement Auditor: current-output actions sit under the current output body; category download remains by category controls; campaign actions remain in the Campaign Outputs summary.

Choice Load Auditor: campaign, category, and current-output controls use shorter labels and a single compact action row.

Accessibility Auditor: compact controls retain accessible labels or title text.

Edit/Refine Safety Auditor: generated output remains read-only by default, local editing is explicit, and refine remains beta-labelled and collapsed.

Export Auditor: current output, current category, and full campaign document downloads remain on existing handlers.

On-Demand Generation Auditor: selected missing output generation and queued output behaviour remain on existing code paths.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and Image Analysis remains Flash.

Regression Auditor: address lookup, Fetch Details, AI analysis buttons, Generate Listing Copy, Generate missing outputs, Campaign Build Log, and downloads are preserved.

Git Hygiene Auditor: no secrets, environment files, dependency folders, build output, screenshots, or Vercel config should be staged.
