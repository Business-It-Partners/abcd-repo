# M08 Plan — Safe independent application updates

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M07](../milestone-07-store-and-distribution/PLAN.md)
**Requirements:** R03, R09
**Exit gates:** G08
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Deliver independent app improvements without replacing running code or losing unfinished work.

## Deliverables and scope

- Background checks/downloads, version pinning, staged verification and atomic next-launch activation.
- Update-now dirty-work flow, health failure handling and compatible known-good rollback.
- Minimum-safe-version/revocation, signed controlled downgrade, metadata freshness and bounded retention policies.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Run old app during new download: unchanged running assets/session; next permitted launch selects verified successor.
- [x] Inject interruption at every persistence/activation boundary, repeated operations and failed health checks.
- [x] Test dirty work, ambiguous in-flight writes, incompatible rollback, revoked versions, key rotation and storage exhaustion.

- [x] Prove channels, withdrawal/revocation and minimum-version metadata affect staging releases only and preserve existing clients; do not modify production feeds or pointers.

## Scope exclusions

App updates only; trusted Electron platform updates are M11. No silent reload of active work or compatibility-blind downgrade.

## Baseline to reconcile

Backend must preserve supported old clients. A passing launch health check is not evidence of correct business behavior.

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

## Detailed implementation plan — 2026-10-16

M07 is verified/normal-merged at main f2361db6; M08 branch codex/milestone-08. User authorized continuous staging work through M10.

1. Extend existing verified registry transactions, without source-folder migration: install updates into immutable pending versions; keep active/running leases unchanged. Atomic next-launch trial selection records previous known-good. Persist health acknowledgement or compatible rollback; an interrupted trial never silently becomes known-good. Retain at most active/pending/known-good (three), evict only unleased expendable versions under journal recovery. Preserve M06 format-1 profile migration and interruption safety.
2. Add a separately signed, bounded, monotonic staging update-policy document for digest/key revocation and explicit digest-paired rollback authority. Keep M07 catalogue bytes/routes compatible. Reuse release R2 and add only authenticated GET /v1/dental-os/update-policy in existing staging Worker; record SYS-0006. Trust anchors remain platform-owned; rotation accepts explicitly pinned old/new company keys, revocation rejects a removed key even for cached/rollback versions. Never accept keys supplied by apps.
3. Persist only verified public update/catalogue metadata and freshness in OS state, reverify on use. Expired/missing policy blocks new updated launches/operations safely; preserve running work and installed bytes. Fresh metadata enforces minimum version, app withdrawal and digest/key revocation at launch and before broker dispatch. Rollback requires current signature, SDK/API compatibility, platform grants and allowed minimum/revocation. All app state remains disposable/in-memory, so no hidden schema downgrade.
4. Extend trusted distribution for quiet bounded update checks/downloads, one operation at a time. Recheck current admin install authority and signed release identity before staging. Poll at conservative intervals only while session ready; cancel/clear on session reset/dispose. Store shows active/pending versions, release notes, update progress and safe recovery messages.
5. Coordinate explicit Update now through runtime ownership. Block dirty/modal state and pending/unknown write outcomes; require save/reconciliation or the existing explicit close/discard flow. Never reload a dirty app automatically. Clean update-now closes the old lease and starts the staged verified trial. Background work never replaces active renderer assets.
6. Prove pinned old app during download, next launch selection, health failure/restart rollback, interrupted persistence/activation, retention/disk exhaustion, duplicate/concurrent operations, dirty/modal/unknown writes, incompatible/minimum/revoked rollback and key rotation. Use unit/process-exit fixtures and focused private update UI; run build/full units once at final source plus applicable Windows CI.
7. Publish synthetic staging successor and policy using conditional writes; prove fresh control and rollback/revocation behavior with isolated profiles, preserve M07 feed and existing SaaS clients. Retain exact signed byte/deployment/check/source identities; mark VERIFIED/checkpoint/normal merge only after G08 passes. Physical Windows remains deferred; then proceed M09 without pause.

No Electron/platform installer update (M11), production key/feed, third-party publishing, patient cache or full dental app delivery. Checks are sequential with preflight and owned-process cleanup. A launch health check proves renderer/SDK responsiveness, never clinical correctness.
