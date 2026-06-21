# Copywriting Web Improvement Roadmap

Audit task: `COPYWEB-AUDITSPRINT-001B`
Scope: roadmap only. No product code, prompts, routing, UI, provider integrations, Hub integration or `aim-web-agents` import were performed.

## Phase 0, Before merge/freeze

Only critical blockers.

1. Fix cost/model attribution:
   - Implemented in `COPYWEB-COSTFIX-001`.
   - Pricing is keyed to configured model IDs and unknown model costs are excluded instead of undercounted.
   - Address suggestions, chat and batch flows now return or aggregate usage where provider metadata is available.
   - Visible costs are labelled as token-only estimates until grounding/tool costs are complete.
2. Confirm deployment gates:
   - `BETA_ACCESS_CODE` configured.
   - Deployment protection enabled for preview sharing.
   - No provider secret exposed to browser.
3. Keep standalone:
   - No Hub integration.
   - No Clerk unless explicitly required later.
   - No OpenRouter, Agent SDK, database, wallet, credits or provider integrations.
4. Add minimal launch copy:
   - Draft output must be reviewed before publication.
   - Users must verify property facts, sources and photo-derived claims.
   - Do not upload confidential/vendor-private material unless authorised.

Exit criteria:

- Build passes.
- Typecheck passes.
- Safe secret/client-provider searches pass.
- Audit docs are committed.
- Cost/model fix is committed before merge/freeze.

## Phase 1, Controlled beta

Small improvements, no Hub, no Clerk unless required.

1. Improve review workflow:
   - Add review/export checkpoint.
   - Add source/fact acknowledgement before download.
   - Show estimated full campaign cost before missing variants are generated.
2. Improve workflow clarity:
   - Stage the UI as Research, Review Facts, Strategy, Photos, Generate, Review and Export.
   - Demote Analysis Stream to collapsible run details.
   - Keep compact cost/progress visible.
3. Improve photo workflow:
   - Show size/type/count guidance.
   - Add per-image result review.
   - Let users accept/reject image-derived highlights into the feature bank.
4. Improve generated output UX:
   - Add generated, edited, stale, needs-review and exported states.
   - Add before/after comparison for refinement.
   - Clarify contact-card and agent inclusion behavior.
5. Add test foundation:
   - Mocked browser smoke tests for beta unlock, research, image queue, full copy, variants, refine and export.

Exit criteria:

- Trusted testers can complete the workflow with clear review and cost expectations.
- No billing or credits.
- Usage remains monitored manually or through a temporary internal log.

## Phase 2, Public beta

Auth, durable rate limits, proper model telemetry, better design polish.

1. Add durable access control:
   - Auth or equivalent account identity.
   - Durable rate limits.
   - Per-user/account quotas.
   - Deployment and bot protection.
2. Add billing-grade telemetry before any billing:
   - Durable operation ledger.
   - User/session/account attribution.
   - Property/job attribution.
   - Provider/model/operation/tokens/image count/grounding usage/latency/retry/success/failure fields.
   - Estimated provider cost and billable AIM cost.
3. Add source and output integrity:
   - Claim Review panel.
   - Source freshness.
   - Confidence labels.
   - Vendor-safe mode.
   - Portal-safe mode.
4. Add privacy/legal surface:
   - Terms of use.
   - Privacy policy.
   - AI-use disclosure.
   - Image upload and retention notice.
   - Model-provider submission notice.
5. Polish design:
   - Redesign variant/editor/export area.
   - Improve tablet and mobile behavior.
   - Convert Analysis Stream into product-facing activity/cost panel.

Exit criteria:

- Public users can be identified, limited, monitored and warned.
- Costs can be reconciled.
- Claims can be reviewed before publication.

## Phase 3, AIM Hub connected

Save/retrieve, property/job/asset/ledger records.

1. Define Hub entities:
   - Property record.
   - Copywriting job.
   - Uploaded/derived asset record.
   - Source/citation record.
   - Usage ledger record.
   - Output variant record.
2. Add save/retrieve:
   - Save property facts and feature bank.
   - Save generated variants and review states.
   - Save source appendix and claim review outcomes.
3. Add Hub visual alignment:
   - Entity headers.
   - Job status.
   - Activity timeline.
   - Ledger/cost summaries.
   - Source panels.
4. Preserve standalone boundaries:
   - Avoid warehousing portal-derived data without rights.
   - Keep source retention policy explicit.

Exit criteria:

- Hub records have clear ownership, retention and usage accounting.
- Copywriting jobs can be reopened and audited.

## Phase 4, AIM Web Agents import

Move into `aim-web-agents/apps/copywriting` or keep as separate deployed app with shared packages.

Recommended timing: later, after standalone beta evidence.

Decision options:

1. Keep as separate deployed app:
   - Best if launch speed and deployment isolation matter.
   - Share contracts/router packages later.
2. Import into `aim-web-agents/apps/copywriting`:
   - Best if shared auth, UI shell, telemetry and deployment become more valuable than isolation.
   - Requires modular frontend and clean package boundaries first.

Prerequisites:

- `App.tsx` split into feature modules.
- Operation model router extracted.
- Durable telemetry contract exists.
- Hub entity boundaries defined.
- Tests cover critical workflows.

Exit criteria:

- Import does not bring unstable state, local-only assumptions or unclear data ownership into `aim-web-agents`.

## Phase 5, Mobile Copywriting Agent source transfer

Use web app as source, but redesign for iPhone.

Preserve:

- Shared stateful workspace.
- Address research and editable facts.
- Photo analysis feeding a feature bank.
- Strategy and buyer-angle controls.
- Generated variants.
- Source/confidence review.
- Cost/progress visibility.
- Review before share/export.

Do not copy:

- Three-column desktop layout.
- Dense nested tabs.
- Developer-console Analysis Stream.
- Detached chat.
- Hidden generate-all costs.
- Export controls without review.

Mobile direction:

- One scrollable workspace.
- Sticky section navigation.
- Collapsible run details.
- Thumb-friendly review/accept/reject controls.
- Camera/photo-library upload with size guidance.
- Short, clear copy preview with variant switcher.
- Share/export only after review acknowledgement.
