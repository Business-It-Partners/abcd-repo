# M02 Plan — Trusted host and OS state

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M01](../milestone-01-architecture-baseline/PLAN.md)
**Requirements:** R01, R10, R15
**Exit gates:** G02
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Establish a controlled Electron host lifecycle and durable OS-only state without introducing local business storage.

## Deliverables and scope

- Documented startup/ready/recovery/exit state model and existing-instance activation.
- Versioned OS state root, registry storage primitive/journal, atomic writes, migrations and bounded disk use.
- Host-adapter interfaces and named Windows/Linux development verification matrix.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Linux private display: repeated launch preserves native identity; minimize/restore preserves session and geometry. Windows remains pending.
- [x] Linux unit/private checks cover interrupted commits, migration, corrupt state and injected low-space failures; files are preserved on unsafe input. See evidence for limits.
- [x] Automated Linux/Windows CI state/path and startup checks passed; POSIX modes tested on Linux, Windows junction refusal and inherited-permission operation tested on hosted Windows. Physical native lifecycle/ACL/visual device scenarios remain deferred under the approved policy.

## Scope exclusions

No authentication rollout, real package catalogue, local business database or host OS replacement.

## Baseline to reconcile

Existing electron/main.ts, preload.ts and private native-session suite are candidates for reconciliation, not accepted production evidence.

## Ownership and integration rules

Platform changes stay in trusted Electron/SDK/runtime boundaries and shared shell ownership. Backend work belongs in the separate existing SaaS project with its own instructions and explicit change record. Do not perform remote provisioning, production mutations, commits/pushes or deployment through this plan alone.

Use synthetic or approved staging fixtures. UI automation must run through the private runner; never restart/focus the live OS for verification. Run relevant build/unit checks for code changes and only necessary focused UI suites. Documentation-only changes use link/structure/traceability validation; runtime checks cannot certify prose or unimplemented services.

## Evidence requirements

Record command, source/tree identity, build/dependencies, host/display/profile, actual outcome and redacted retained artifacts. Missing platform evidence remains explicit. Proposed commands and previous Flutter/prototype results are not milestone verification. Technical completion and user acceptance are separate.

## Mandatory backend/staging boundary

Reuse existing `fewa_demo` Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources under the [canonical backend policy](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). Any backend change or remote integration must target verified **Cloudflare staging-only** resources. Record the exact branch, GitHub environment/workflow, API base, Firebase project, Worker/D1/R2 bindings before that work; do not guess names or use production credentials/fallbacks.

New OS-specific services use `/v1/dental-os/...`; existing dental business and identity routes are reused unchanged. Changes must be additive, preserve existing Dental SaaS/Super Admin behavior, and include existing-client regression evidence when shared backend/configuration changes. Production changes/promotion require separate explicit authorization. This plan and documentation amendment authorize no backend edits, provisioning or deployments by themselves.

## Detailed execution plan — 2026-10-15

Inspection: main.ts already provides a sandboxed window, main-frame IPC checks, single-instance activation and native fullscreen/minimize continuity. It has no durable OS state, recovery presentation or boot phase contract; restore settling polls indefinitely if fullscreen never arrives. Keep existing source paths for this bounded slice rather than move the complete project while changing behavior.

1. Add a strict versioned OS-state store under Electron userData/state. Persist only an allowlisted overview-shortcut preference, never app records. Bound file sizes, enforce private permissions on Linux, reject links, check capacity through a host adapter.
2. Add a write-ahead journal and atomic same-directory replacement; recover old/new transaction states after interruption. Preserve corrupt/conflicting/future-version stores in place and fail to recovery. Migrate a defined legacy v0 preference format transactionally. Inject capacity and interruption faults in unit tests.
3. Integrate startup initializing -> ready/recovery, exit state and a narrowly validated preference/status IPC. On unsafe state, show a static recovery window without privileged preload, preserving files. Bound native restore polling. Keep startup fullscreen and existing instance behavior.
4. Connect the persisted overview-shortcut preference to existing shell behavior without adding a new settings UI. Expose only its typed read/update API; later Settings work can consume it.
5. Verify serially: constrained unit suite, build/typecheck, one private M02 boot/restart/recovery suite and the existing native-session suite. Capture outcomes and process cleanup. No live session restart or cloud work.

Host matrix: this Linux GNOME/Wayland private-display environment is executable here; Windows adapter/source behavior can be implemented but Windows device certification is unavailable and must remain pending. Applicable GitHub Windows CI can complete the automated milestone gate; physical Windows device checks are explicitly deferred until after M11 and before final product release.

## Windows verification scope

Use the [approved deferred-device policy](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md): Linux checks plus applicable Windows GitHub Actions evidence during milestones; physical Windows interaction/visual checks after M11, before final release. Record remaining device scenarios separately; CI success is not physical-device certification.
