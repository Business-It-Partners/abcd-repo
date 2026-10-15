# M11 Plan — Windows/Linux release and operations

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M10](../milestone-10-security-resilience-and-usability/PLAN.md)
**Requirements:** R01, R14, R15
**Exit gates:** G11
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Certify installable, maintainable Dental OS releases on explicitly named Windows/Linux targets.

## Deliverables and scope

- Frozen support matrix, signed installer formats, trusted platform-update paths and release provenance/key custody.
- Install/upgrade/uninstall/recovery runbooks, support/version diagnostics and compatibility retirement policy.
- Requirement coverage bound to exact source/build/host evidence and separate user acceptance/release decision.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [ ] Clean-device and upgrade tests on each supported Windows/Linux target; installation permissions and secret providers verified.
- [ ] Platform update interruption/restart/recovery with installed app compatibility and dirty-work protection.
- [ ] Complete G01–G11/R01–R15 evidence review, authentic release artifacts, rollback/revocation drill and operations handoff.

- [ ] Record that certification uses local/staging artifacts and feeds; production backend promotion or public production publishing remains a separately authorized task.

## Scope exclusions

No macOS/mobile certification, unspecified Linux-wide promise, automatic publishing, or physical printing claim without device-specific proof.

## Baseline to reconcile

Installer/updater formats and exact OS versions remain explicit decisions until frozen; Linux functional success never substitutes for Windows evidence.

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
