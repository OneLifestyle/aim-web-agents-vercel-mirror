# Copywriting Mobile Layout Carry-Forward

Task context: `COPYWEB-COSTAUDIT-001`

These notes capture mobile design constraints for a future Copywriting Agent mobile surface. They are not implementation instructions for the current web hardening branch.

## Current web pattern

The web app uses two independently scrolling columns. The left column acts as the working input/control surface. The right column holds generated context, visual highlights, preview copy, and the Analysis Stream.

This works on desktop because the user can see multiple related workspace regions at once. On phone, the same structure likely needs to become one long vertical workspace.

## Mobile direction

The first mobile design should remain one shared stateful workspace, not unrelated pages that hide shared context. Fetch Details, image analysis, strategy, feature extraction, and copy generation all populate or depend on multiple sections.

Preferred direction:

- Single scrollable workspace.
- Sticky section navigation.
- Shared state across all sections.
- Editable intermediate state preserved.
- Timeline / Analysis Stream secondary or collapsible.

The experience should feel like a guided workspace, not a form split into disconnected screens.

## Navigation options

Candidate mobile section navigation patterns:

- Numbered section rail.
- Named chips.
- Sticky top anchor bar.
- Sticky bottom anchor bar.
- Collapsible sections.
- Jump-to-section control.

The navigation should let users move quickly without losing the sense that all sections belong to one job.

## Candidate sections

- Property Address
- Property Overview
- Agent Profile
- Open House Details
- Property Details
- Suburb and Area Profile
- Copy Context
- Property Features
- Property Photos
- Visual Highlights
- Preview / Generated Copy
- Timeline / Analysis Stream, likely secondary or collapsible on mobile

## State preservation requirements

Preserve the ability for one section to update another:

- Fetch Details populates property details, overview, suburb/area profile, features, price guide, and last sold details.
- Image analysis populates Visual Highlights and can inform strategy, features, and generated copy.
- Strategy analysis updates Copy Context.
- Feature extraction updates Property Features.
- Generated copy and variants depend on address, details, context, features, research, profile inclusion, image analysis, agent profile, and open house details.

Preserve editable intermediate state, especially:

- Property features.
- Copy context.
- Property details.
- Suburb/area inclusion.
- Generated copy.
- Variant copy.

## Design cautions

- Avoid making Fetch Details, photos, strategy, and generated copy separate pages with hidden context.
- Avoid requiring users to navigate backwards to understand why a generated result changed.
- Avoid burying editable intermediate state behind final-output screens.
- Keep Analysis Stream available for transparency, but do not let it dominate the phone layout.
- Treat the final generated copy editor as part of the same workspace, not a detached export screen.
