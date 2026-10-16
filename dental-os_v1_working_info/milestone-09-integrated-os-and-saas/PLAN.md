# M09 Plan — Integrated OS and SaaS contract proof

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M08](../milestone-08-safe-app-updates/PLAN.md)
**Requirements:** R04, R07, R13
**Exit gates:** G09
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Prove the complete OS loop using two delivered first-party sample apps and representative existing SaaS APIs.

## Deliverables and scope

- Integrated login -> catalogue -> install -> open -> authorized API -> update -> uninstall flow.
- Existing SaaS operation mapping with backend idempotency/revision and meaningful denied-access behavior.
- Unified status, dirty-state/close policy, account-scoped preview cleanup and API-compatible sample packages.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [ ] Two installed isolated apps share one mediated session without shared credentials or direct communication.
- [ ] Approved staging data proves a representative authorized read and idempotent write, conflict and lost-response reconciliation.
- [ ] Repeat dock/overview/Genie/scoped-dialog/native minimize continuity; lock/logout cannot expose prior user views.

- [ ] Execute representative integration against mapped staging resources only; retain existing Dental SaaS and Super Admin regression evidence with isolated synthetic fixtures.

## Scope exclusions

Platform integration acceptance only. It does not implement or certify every dental module, production clinic data migration or offline business engine.

## Baseline to reconcile

Freeze sample operation and staging mutation/cleanup policy before executing; server results remain the business truth.

## Ownership and integration rules

Platform changes stay in trusted Electron/SDK/runtime boundaries and shared shell ownership. Backend work belongs in the separate existing SaaS project with its own instructions and explicit change record. Do not perform remote provisioning, production mutations, commits/pushes or deployment through this plan alone.

Use synthetic or approved staging fixtures. UI automation must run through the private runner; never restart/focus the live OS for verification. Run relevant build/unit checks for code changes and only necessary focused UI suites. Documentation-only changes use link/structure/traceability validation; runtime checks cannot certify prose or unimplemented services.

## Evidence requirements

Record command, source/tree identity, build/dependencies, host/display/profile, actual outcome and redacted retained artifacts. Missing platform evidence remains explicit. Proposed commands and previous Flutter/prototype results are not milestone verification. Technical completion and user acceptance are separate.

## Mandatory backend/staging boundary

Reuse existing `fewa_demo` Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources under the [canonical backend policy](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). Any backend change or remote integration must target verified **Cloudflare staging-only** resources. Record the exact branch, GitHub environment/workflow, API base, Firebase project, Worker/D1/R2 bindings before that work; do not guess names or use production credentials/fallbacks.

New OS-specific services use `/v1/dental-os/...`; existing dental business and identity routes are reused unchanged. Changes must be additive, preserve existing Dental SaaS/Super Admin behavior, and include existing-client regression evidence when shared backend/configuration changes. Production changes/promotion require separate explicit authorization. This plan and documentation amendment authorize no backend edits, provisioning or deployments by themselves.

## Windows verification scope

Use the [approved deferred-device policy](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md): Linux checks plus applicable Windows GitHub Actions evidence during milestones; physical Windows interaction/visual checks after M11, before final release. Record remaining device scenarios separately; CI success is not physical-device certification.

## Detailed execution plan and staging mutation policy — 2026-10-16

M08 verified/normal-merged at main dce9d589, branch codex/milestone-09. User explicitly authorizes necessary staging work through M10; continue without permission pause. Preserve first-party-only boundaries, approved physical-Windows deferral and controlled sequential checks.

1. Wire real production-path runtime broker transport to the existing mapped staging Worker. Private runtime/identity/distribution fixtures remain entirely synthetic; real staging acceptance uses explicit trusted staging mode, independently verified downloaded packages and real platform identity. No arbitrary authenticated fetch or credential bridge. Broaden only approved alpha read/write and beta read package capabilities; existing backend business routes stay unchanged.
2. Freeze representative operation: GET /v1/appointments?date=... and POST /v1/appointments/:id/status with original Idempotency-Key and expectedRowVersion. Extend sample SDK presentation with date selection, read projection, selected record/status/revision, named errors and an explicit same-key reconciliation action. Patient data stays memory-only, no app-to-app channel, cache or automatic retry. Read-only beta must fail write before dispatch.
3. Make pending/unknown write state a trusted broker/runtime projection, independent of app lifecycle reports. Update-now and ordinary app close must refuse unresolved writes. Keep existing shared window/dock/Genie/dialog ownership; preserve app dirty guard. Session reset intentionally destroys previous contexts and fences late results. Do not introduce a queue or persist patient payloads.
4. Backend operator ticket SYS-0007 owns synthetic staging fixtures only, using existing SaaS API and approved clinic account. Create one uniquely marked synthetic staff doctor (no email/phone/salary/login) and one uniquely marked future appointment (no real patient/contact). Use only returned owned IDs and a unique isolated date; never select or edit an existing clinic record. No D1 SQL mutation, new business API, Firebase user or production operation.
5. Freeze cleanup before writes: after proof, cancel only the created appointment through existing idempotent/revision API and mark only the created staff profile inactive. Preserve normal audit/command receipts; do not purge clinical tables. Keep an external protected operator fixture journal for crash-safe cleanup, containing synthetic IDs/input/idempotency keys only, never credentials. Remove it after verified cleanup. If a mutation outcome is unknown, reconcile using its original key before continuing; no blind new-key retries. Report retained audit-only synthetic records explicitly.
6. Publish signed sample 1.2.0/1.2.1 with current staging trust key and higher catalogue/control sequences, retaining M08 minimum/revocation constraints. First-party grants derive from verified manifest and session role. Existing staging Worker deployment/bindings/business code remain unchanged unless an actual compatibility defect requires a separate reviewed ticket update.
7. Private end-to-end proof: actual UI sign-in -> authenticated catalogue -> anonymous R2 install -> two isolated app runtimes -> same mediated session -> real representative read/write. Controlled private-only transport fault drops a real successful write response once; prove unknown state, close/update refusal, same-key reconciliation and unchanged server revision on replay, plus stale-revision conflict. Verify beta denial, update and uninstall, lock/logout preview/capture cleanup, no credential or patient disk cache. Existing SaaS/Super Admin health/access/reachability regressions remain explicit, never equated to positive privileged UI acceptance.
8. Run proportionate unit/build and focused private integration/shared-motion/session regressions, bounded process/resource checks and final Windows Actions (fixtures only). Retain actual source/byte/resource/cleanup identities and failures. Only after G09 passes: VERIFIED, checkpoint and normal merge; continue M10. Full dental application UI/workflows and M11 release remain separate.
