# Copywriting V2 Structured Fact Integrity Stabilisation

Task: `COPYWRITING-V2-INTEGRITY-GOVERNANCE-STABILISATION-001`

This note records the provider-free architecture audit and the deterministic comparison policy introduced after the Flyer land false positive. It does not change the Approved Brief schema, provider routing, models, persistence, or the Hub boundary.

## Canonicalisation boundary

Canonicalisation occurs at governance comparison time in `domain/structuredFacts.ts`. A one-to-one surface-normalisation pass also canonicalises Unicode grouping spaces, compound hyphens, and the mathematical minus sign before parsing while retaining the original matched surface for diagnostics.

The Approved Brief Snapshot remains the durable in-session truth and continues to retain:

- source value and unit;
- approved value and unit;
- provenance;
- review state;
- the human-approved display representation.

Snapshot construction does not rewrite values into canonical units. Governance, lower-authority sanitation, suggestion filtering, API validation, and returned-output integrity share the same semantic comparator. This prevents the browser and server paths from interpreting the same fact differently.

## Pre-change reproduction

Given:

- source: `20200 m²`;
- approved: `2.02 ha`;
- review state: `Corrected`;
- Flyer: `approximately 2.02 hectares` plus `20,200 m²` elsewhere in the document;

the pre-change validator returned `superseded landValue` with exact stored `matchedText` `20200`.

`approximately 2.02 hectares` alone was Ready. The false positive came from `findContradictoryNumericMention`, which normalised `20,200` to `20200` and compared that dimensionless number directly with approved `2.02` before interpreting either unit.

The same defect had a false-negative mirror: approved `2.02 ha` accepted `2.02 acres` and `2.02 m²` because the raw numbers matched.

## Audit matrix

| Domain | Pre-change comparison | Equivalent representation | False-positive risk | False-negative risk | Stabilised rule |
| --- | --- | --- | --- | --- | --- |
| Bedrooms | Exact number or zero-to-twelve word plus bedroom cue | Digits and supported number words | A construction year beside `bedroom renovation` could be consumed | Approved `null` allowed invented counts | Compare explicit bedroom counts exactly at any magnitude; exclude only a four-digit year directly governing renovation wording |
| Bathrooms | Exact numeric/word value plus bathroom cue | Digits, decimals, supported number words | A construction year beside `bathroom renovation` could be consumed | Approved `null` allowed invented counts | Compare explicit bathroom counts exactly; do not infer compound arithmetic or consume a directly scoped renovation year |
| Car spaces | Broad number plus car, vehicle, garage, or parking wording | Digits and supported number words | Generic vehicle wording and inspection dates after `parking for` could be consumed | `double garage` is intentionally not inferred; `vehicle spaces` could escape | Accept explicit capacity forms such as `N car spaces`, `N vehicle spaces`, `N-car garage`, or `parking for N`; reject date continuations and do not infer `double garage` |
| Land size/value | Raw numeric equality, then raw source-unit rejection | Not supported | Equivalent unit conversions, grouped numbers, rounding, and room areas could block | Same number in a wrong unit passed | Parse value plus unit, classify land ownership, convert to m², then apply bounded precision/approximation rules |
| Property type | Exact normalised source phrase; approved phrase and `Open House` protected | Exact approved phrase only | Addresses (`Unit 5`), named houses, guest structures and ordinary land/rural nouns could collide | An arbitrary third property type is not inferred | Compare the exact superseded type by role, protecting deterministic address/feature/proper-name contexts; add no general synonym engine |
| Corrected free-text claims | Exact normalised source/alias matching after protecting approved phrase | Exact approved wording | Authorised aliases can still be broad | Paraphrased superseded meaning is not inferred | Keep deterministic human-authored phrase and alias governance |
| Hard exclusions | Exact normalised text and aliases; six-car alias expansion | Not applicable | Broad human aliases remain an authoring risk | Unlisted paraphrases are not inferred | Preserve independent fail-closed exclusion precedence; never apply land tolerance to exclusions |
| Photo highlights | Exact known source/approved highlight surfaces and reviewed IDs | Exact approved surface | A common phrase can have mixed provenance | Unknown paraphrases are not inferred | Preserve selected-photo and reviewed-highlight checks independently of structured facts |
| Open Home optional context | Independent date, time, and URL checks | Approved ISO/common display forms | Whole-document date/time scanning is intentionally conservative for Open House | An additional invented value could follow an approved value | Preserve optional blank/date-only/time-only/URL-only/full behavior, reject extra schedule values, and preserve the decimal-as-time repair |
| Snapshot binding/staleness | Exact stable snapshot ID and output state | Not semantic | Reverting to an identical snapshot can leave an already-stale document stale | Pack derivation trusts document state | Preserve fail-closed staleness; do not canonicalise or mutate snapshot identity |

## Land units and aliases

Canonical unit: square metres (`m²`).

Exact conversion constants:

- `1 hectare = 10,000 m²`;
- `1 acre = 4,046.8564224 m²`.

Supported parsed surfaces:

- `m²`, `m2`, `sqm`, `sq m`, `sq. m.`, `sq-m`, `square metre`, `square metres`, `square meter`, `square meters`, including number/unit and compound-adjective hyphenation;
- `ha`, `hectare`, `hectares`;
- `acre`, `acres`.

Numeric digits, comma- or Unicode-space-grouped thousands, leading decimals, and deterministic number words from zero to ninety-nine are supported for land measurements. Unicode compound hyphens are canonicalised; U+2212 remains a mathematical minus, while typographic dash bullets are separators rather than negative signs.

## Rounding and approximation policy

1. Parse the displayed numeric value, unit, decimal precision, and local approximation cue.
2. Convert both the mention and approved value to m².
3. Treat floating-point-equal canonical values as exact.
4. Otherwise derive a half-display-step allowance from each surface precision.
5. Cap normal, unqualified conversion rounding at `0.25%` of the larger canonical magnitude.
6. Only when the local phrase says `approximately`, `approx`, `about`, or `around`, allow a maximum `1%` relative difference.
7. Reject every value outside the applicable bound.

The cap prevents a whole-acre display from silently creating an unbounded half-acre tolerance. Five acres canonicalises to `20,234.282112 m²`, about `0.1697%` above `20,200 m²`, so `5 acres`, `approximately five acres`, and `about 5 acres` are legitimate representations of approved `2.02 ha`. `3.02 ha`, `30,200 m²`, `7.5 acres`, `2.02 acres`, and approximation beyond `1%` remain conflicts.

## Structured ownership

Land parsing requires an explicit area unit and assigns each mention one deterministic role:

- `total-land`: a site/land/property assertion compared directly with the approved total;
- `subordinate-land`: a garden, paddock, vineyard or other contained land component, ignored when safely within the approved total but blocked if negative or materially larger than the whole site;
- `building-area`: room, internal, footprint and multi-level floor areas, which are not compared with total land because floor area can legitimately exceed the site footprint;
- `external-area`: a nearby park, reserve, vineyard or other external measurement, excluded from the property land fact.

Direct role nouns, bounded adjective modifiers, clause boundaries, explicit containment, and external-relation cues establish ownership. This keeps room and floorplan-table dimensions, building areas, subordinate features, public reserves and neighbouring land out of the total-site validator without introducing fuzzy NLP, while still failing closed on an impossible subject-owned subordinate area.

Other numeric validators remain noun-scoped. Street numbers, years, dates, dollar figures, percentages, phone numbers, and linear room dimensions do not become bedroom, bathroom, car-space, or land facts merely because they contain digits.

## False-positive classes closed

- dimensionless cross-unit land comparison and raw source-unit rejection;
- suffix parsing of compound land number words such as `twenty-five acres`;
- Unicode grouping, compound-hyphen and sign surfaces losing their structured meaning;
- grouped-number splitting (`20,200`) in governed API suggestion lists;
- land decimals consumed as dot-separated Open Home times;
- building, accommodation, labelled room/table, garden, paddock and neighbouring/external-area measurements consumed as total land;
- an explicitly subject-owned nearby/adjoining property misclassified as external land;
- an explicitly external property, public reserve or neighbouring container misclassified as subject land;
- address `Unit`, secondary studio/house roles, named houses and ordinary land/rural wording consumed as the primary property type;
- sale headlines hiding a superseded primary type or crossing sentence/subject boundaries;
- construction and renovation years consumed as bedroom/bathroom counts;
- inspection dates, clock abbreviations, prices and parking durations consumed as parking capacity;
- signed negative counts losing their sign and matching an approved positive count;
- punctuated `sq. m.` sentence splitting bypassing lower-authority sanitation;
- unrelated street, date, price, percentage, phone and room-dimension numbers consumed by structured fact validators.

## Historical behavioural reference

At `bd9fa62da3521ba59b1ba59b0428d78aee413e3d`, V1 passed mutable structured facts into generation and stored returned copy without post-generation content validation. Its fallback ingest path converted hectares to integer square metres, which is direct behavioural precedent that units were representational.

V2 keeps the safer reviewed snapshot, exclusions, photo governance, integrity state, eligibility rules, sibling preservation, and staleness binding. Only the unintended raw-surface restriction has been replaced with canonical semantic comparison.

## Residual conservative limits

- Property type validation intentionally has no general synonym or paraphrase engine.
- Ambiguous unqualified area or property-type prose remains conservatively exact; only deterministic role cues are interpreted.
- Corrected claims, exclusions, and photo highlights remain deterministic phrase/alias checks rather than semantic NLP.
- Open House validation remains deliberately global within the Open House document.
- Snapshot-only stale state is not automatically cleared when a later approved snapshot recreates an earlier ID.

These limits are fail-closed or explicitly bounded and do not require a broader schema or validation rewrite for this stabilisation.
