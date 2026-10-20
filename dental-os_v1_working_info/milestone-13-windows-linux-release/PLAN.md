# M13 Plan — Windows/Linux release and operations

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M12](../milestone-12-os-ui-experience/PLAN.md); builds on M02 host state and all verified runtime/distribution/security work.
**Requirements:** R01, R14, R15.
**Exit gate:** G13. Final device/user acceptance is G14 after M13.
**Architecture:** [host platforms](../../dental-os_v1-documentation/16_V1_TECHNOLOGY_AND_HOST_PLATFORMS.md), [acceptance gates](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md), [recovery contract](../../dental-os_v1-documentation/15_V1_FAILURE_RECOVERY_AND_DIAGNOSTICS.md).

## Outcome

Produce an installable, maintainable Dental OS platform release for an explicitly named Windows/Linux support matrix, with trusted platform update, recovery, diagnostics, provenance and support procedures. An app-bundle update from M11 remains separate from an Electron/platform update.

## Deliverables and scope

- Freeze named Windows versions, Linux distribution/display targets, CPU architectures, installer formats, permissions and supported upgrade paths.
- Select and prove signed installers, platform updater/restart behavior, key custody, release provenance and rollback/recovery policy.
- Test clean install, upgrade, interruption, repair/recovery and uninstall on named hosts; preserve installed app compatibility and unfinished-work safety.
- Publish version/support diagnostics and operator runbooks for compatibility, revocation, incident response and retirement.
- Bind requirement coverage to exact source, package, CI runs, host evidence and a separate user/release decision.
- Preserve the staging/production boundary: Cloudflare staging is used for sample feeds; production changes/promotion require separate explicit authorization.

## Execution sequence

1. Freeze the host/support matrix and resolve installer/updater ADRs before implementation.
2. Build and inspect signed candidate artifacts with reproducible provenance and protected signing custody.
3. Run bounded Linux checks and applicable Windows GitHub Actions sequentially; test install, upgrade, interruption, restart, recovery and uninstall.
4. Verify upgrade compatibility with M11 app packages and M12 shell/UI state; retain failed and repaired runs.
5. Complete G13 only for the declared automated/hosted scope. Schedule physical Windows-device and user acceptance as G14 after M13 and before any final release decision.

## Exit criteria

- [ ] Supported Windows/Linux versions, architectures, display targets, installer formats, permissions and upgrade policy are explicit.
- [ ] Signed release artifacts and signing-key custody/provenance are verified; no production key or promotion is inferred from staging.
- [ ] Clean install, upgrade, interrupted platform update, restart, recovery/rollback and uninstall pass on named automated/host targets.
- [ ] Existing M11 app packages and M12 shell/session state remain compatible through platform upgrade/recovery.
- [ ] Diagnostics/runbooks support version identification, safe rollback/recovery, compatibility retirement and incident handling without patient payloads or secrets.
- [ ] Required Linux checks and applicable Windows CI pass and are tied to exact source/artifact identity.
- [ ] G13/R01/R14/R15 evidence is complete. G14 physical Windows/user/product acceptance remains open until actually performed after M13.

## Boundaries

No macOS/mobile certification, unspecified “all Linux” promise, automatic public publishing, clinical workflow implementation or production backend promotion. A successful G13 does not close G14 or authorize a production release. Physical Windows interaction/visual acceptance remains mandatory after M13; hosted CI is not physical-device certification.

Reuse existing `fewa_demo` resources and staging-only backend policy if a remote sample-feed check is needed. This plan itself authorizes no remote provisioning, deployment, production changes or publication. Keep one active milestone and create the `codex/milestone-13` branch only when M13 work begins.
