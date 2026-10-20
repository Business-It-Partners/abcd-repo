# Dental OS — Build Phases

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Milestone detail and execution authority live in [the master roadmap](../dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md).

1. M01: architecture and evidence baseline, including prototype gap map.
2. M02: trusted host lifecycle, local OS-state foundations and adapters.
3. M03: isolated app runtime and shared-shell composition proof.
4. M04: internal SDK, caller identity and API transport boundary.
5. M05: existing SaaS identity, single login and session isolation.
6. M06: package format, verifier and durable local lifecycle using fixtures.
7. M07: first-party store and existing Cloudflare distribution integration.
8. M08: safe independent updates, revocation and compatible rollback.
9. M09: complete OS integration and real SaaS connectivity proof.
10. M10: resilience, security, privacy, accessibility and resource hardening.
11. M11: generic first-party app onboarding and safe app-only updates beyond the original configured sample apps.
12. M12: Dental OS workspace, desktop navigation, shared-window usability, system feedback and integrated shell UI. M12.1–M12.5 are phases under one parent gate, not top-level milestone folders.
13. M13: first-party Dental OS app shells, one app submilestone per package, released to the staging Store.
14. M14: functional Dental OS apps and app-only updates, one app submilestone per package.
20. M20: named Windows/Linux installers, platform updates, release operations and host certification.

Sequence is dependency-driven, not copied from Flutter milestones. Lightweight two-app fixtures are introduced in M03, then replaced by governed packaged fixtures in M06; final app contents are outside this platform roadmap. M09 proves real authentication/API contracts without claiming all dental modules are implemented. M01–M10 history remains unchanged by the 2026-10-19 reassignment of the active/future scopes.

Only one milestone is active by default; complete its evidence before advancing. Cross-host fixtures/automation should be developed from the start. Missing host evidence remains explicit; physical Windows testing is a separate post-M20 final gate G21. This roadmap records scope and order; it does not by itself authorize production deployment or promotion.

## Delivery boundary across phases

Every phase that needs backend changes or remote testing reuses `fewa_demo` resources and is Cloudflare staging-only. M07 owns the verified environment/resource map and `/v1/dental-os/...` contracts; earlier API/login milestones must establish the relevant mapping before their own remote work. M08 extends OS update metadata; M09 verifies existing-client compatibility. M11 proves generic first-party app onboarding and app-only updates; M12 consumes that state in the UI; M13/M14 deliver Dental OS app shells and functional app updates; M20 certifies platform release behavior and does not implicitly promote the backend or publish production releases.

## Verification policy — deferred physical Windows testing

The 2026-10-15 user decision deferred physical Windows-device interaction/visual acceptance until after the final platform milestone. Following the 2026-10-20 sequence amendment, physical acceptance is after M20 under G21. During M02–M20, applicable Windows GitHub Actions provide automated build/typecheck, filesystem and hosted-runner smoke evidence; CI is not physical-device certification. Missing physical evidence does not block milestone progression after applicable CI gates pass, but it remains mandatory before final product release.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
