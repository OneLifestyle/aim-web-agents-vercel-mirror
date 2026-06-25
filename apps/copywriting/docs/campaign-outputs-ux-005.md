# Campaign Outputs UX 005

Goal ID: `WEBAGENTS-COPYWRITING-CAMPAIGN-OUTPUTS-UX-005`

Date: 2026-06-25

Scope: focused UX refinement for the Copywriting Web Agent selected output card and nearby action controls. This goal changed only Copywriting UI and documentation. It did not add dependencies, platform integrations, auth, Hub, billing, storage, database schema, provider routing, environment files, secrets, ZIP packaging, or a redesigned export model.

## Selected Output Contact Card

The `Contact card` control now sits inside the selected output card content area, above the generated copy field. It behaves like an inclusion option for the current output instead of a peer action beside copy and download controls.

The underlying contact-card behavior is preserved:

- enabling the control appends the existing agent profile/contact card to the selected output;
- disabling the control removes that appended contact card;
- switching selected outputs resets the inclusion state as before.

The control is a compact checkbox with helper text: `Include the agent profile/contact details with this output.`

## Output Action Row

The current-output action row remains below the selected output card body. The core action order now reads:

- `Edit`
- `Copy`
- `Download`
- `Save`

`Refine beta` remains available but is visually secondary. Local edited/saved status stays in the same compact support area.

## Helper Area Cleanup

The lower helper copy was shortened to keep the footer lightweight while preserving the important safety model:

- generated output remains read-only until `Edit` is enabled;
- `Save` remains local;
- `Refine beta` still sends the current output and instruction back through the model.

No large settings panel or second workspace was introduced.

## Preserved Behaviour

- Category filtering is preserved.
- Current output selection is preserved.
- Missing output generation from the selected output card is preserved.
- Queued missing output generation is preserved.
- `Generate missing` is preserved.
- `Download current category` is preserved and still exports generated outputs in the selected category.
- `Download campaign` is preserved on the existing combined campaign document path.
- Status chips and output tiles are preserved.
- Campaign Build Log remains visible.
- AI Strategy Analysis remains routed to Pro.
- Image analysis remains routed to Flash.

## Deferred Product Decision

The campaign export model needs a later deliberate design pass. This goal intentionally did not implement a selected-output download model or redesign the full campaign export flow.

Open questions for a future goal:

- Should `Download campaign` become `download selected generated outputs`, or should that be a separate export mode?
- Should V1 bias harder toward a simple appliance-like workflow with fewer editing, refining, and selection controls?
- Should generated output retrieval from future Hub jobs make selection feel more natural than it does in the current local-only workflow?
- How should future Hub retrieval, prior jobs, timeline state, and asset-based re-entry affect what is considered part of a campaign export?

V1 may benefit from simplicity over flexibility. Too many controls can make the output surface feel like an editor instead of a campaign appliance. Export semantics should be revisited with Hub persistence and prior-job retrieval in mind, rather than solved ad hoc in the current local UI.

## Internal Audit

Scope Auditor: no platform integrations, auth, billing, Hub integration, provider integration, environment file, dependency, Vercel config, ZIP packaging, or export-pack redesign was added.

UX Auditor: `Contact card` is now a checkbox inside the selected output card; bottom controls are cleaner; `Edit`, `Copy`, and `Download` are ordered as the core current-output actions; `Refine beta` remains available but secondary.

Regression Auditor: category filtering, selected output behavior, on-demand missing output generation, queued generation, category download, campaign download, status anchors, output tiles, and Campaign Build Log remain on their existing paths.

Model Routing Auditor: model routing code was not changed. AI Strategy Analysis remains Pro and image analysis remains Flash.

Git Hygiene Auditor: no secrets, environment files, dependency folders, build output, screenshots, or Vercel config should be staged.
