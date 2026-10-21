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
15. M15: Platform Closeout and Integration — verify the app-ready platform baseline: independent API authority evolution; required bounded host contracts, including host-mediated private media (P09), measured payload limits (P11), and a design assessment only for cross-app navigation (P10); ADR-025 app-update behavior; M12/G12 and M13/G13 residuals; representative workloads and metadata-renewal operations; and the exact combined source. M15 is not a release-certification milestone.
20. M20: named Windows/Linux installers, platform updates, release operations and host certification.

Sequence is dependency-driven, not copied from Flutter milestones. Lightweight two-app fixtures are introduced in M03, then replaced by governed packaged fixtures in M06; final app contents are outside this platform roadmap. M09 proves real authentication/API contracts without claiming all dental modules are implemented. M01–M11 history and gates remain unchanged. M14 app implementation may proceed in parallel with M15; final functional G14 integration and acceptance require the verified M15/G15 platform baseline. M15 does not waive or replace G12/G13 residual requirements.

Keep one active platform milestone by default and complete its evidence before advancing. M14 app implementation is the separate parallel track through M15; its final G14 integration still waits for verified G15. Cross-host fixtures/automation should be developed from the start. Missing host evidence remains explicit; physical Windows testing is a separate post-M20 final gate G21. This roadmap records scope and order; it does not by itself authorize production deployment or promotion.

## Delivery boundary across phases

Every phase that needs backend changes or remote testing reuses `fewa_demo` resources and is Cloudflare staging-only. M07 owns the verified environment/resource map and `/v1/dental-os/...` contracts; earlier API/login milestones must establish the relevant mapping before their own remote work. M08 extends OS update metadata; M09 verifies existing-client compatibility. M11 proves generic first-party app onboarding and app-only updates; M12 consumes that state in the UI; M13/M14 deliver Dental OS app shells and functional app updates; M15 closes and verifies the app-ready platform integration baseline; M20 certifies platform release behavior and does not implicitly promote the backend or publish production releases.

M15 defines no new app-grant wire format by itself. Any independent API authority mechanism requires a later explicit reviewed contract and positive/negative enforcement evidence; this phase definition selects no format. The required app-ready host contracts include host-mediated private-media transfer (P09) and synthetic measurements against existing request/response/blob limits (P11), with no silent limit increase. The existing R13 boundary remains: no direct app-to-app messaging system or general-purpose cross-app intents. P10 is a bounded OS-owned navigation design assessment only; if an M14 workflow needs cross-app navigation, implementation requires a later explicit contract/ADR. M15/G15 does not silently approve that capability.

M15/G15 covers app-feed renewal operations only to the extent needed for reliable staging: a named operator and a repeatable higher-sequence metadata-only renewal and expiry-recovery drill. It does not weaken freshness checks or assume automated renewal. Production installers, platform updater/restart/recovery, executable signing custody/provenance and final supported-host certification remain M20/G20. Physical/device/user acceptance remains the separate post-M20 G21 gate.

## Verification policy — deferred physical Windows testing

The 2026-10-15 user decision deferred physical Windows-device interaction/visual acceptance until after the final platform milestone. Following the 2026-10-20 sequence amendment, physical acceptance is after M20 under G21. During M02–M20, applicable Windows GitHub Actions provide automated build/typecheck, filesystem and hosted-runner smoke evidence; CI is not physical-device certification. Missing physical evidence does not block milestone progression after applicable CI gates pass, but it remains mandatory before final product release.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
