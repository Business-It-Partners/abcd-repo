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
11. M11: Windows/Linux installers, platform updates, operations and release certification.

Sequence is dependency-driven, not copied from Flutter milestones. Lightweight two-app fixtures are introduced in M03, then replaced by governed packaged fixtures in M06; final app contents are outside this platform roadmap. M09 proves real authentication/API contracts without claiming all dental modules are implemented.

Only one milestone is active by default; complete its evidence before advancing. Cross-host fixtures/automation should be developed from the start. Missing host evidence remains explicit; the approved physical-Windows deferral below distinguishes CI verification from device acceptance. No implementation milestone is authorized merely because this roadmap exists; the current task is documentation creation.

## Delivery boundary across phases

Every phase that needs backend changes or remote testing reuses `fewa_demo` resources and is Cloudflare staging-only. M07 owns the verified environment/resource map and `/v1/dental-os/...` contracts; earlier API/login milestones must establish the relevant mapping before their own remote work. M08 extends OS update metadata; M09 verifies existing-client compatibility. M11 certifies local/staging release behavior and does not implicitly promote the backend or publish production releases. Complete dental app UI/workflow delivery remains separate from these platform milestones.

## Verification policy revision — deferred physical Windows testing

User decision, 2026-10-15: during M02–M11, Windows acceptance uses GitHub Actions automated build/typecheck, filesystem tests and applicable hosted-runner smoke checks. Physical Windows-device interaction/visual acceptance is deferred until after M11 and remains a mandatory final product release gate. Missing physical evidence does not block starting the next milestone once its applicable Linux and Windows CI gates pass, but must not be described as physical-device certification or final release approval. If a CI check cannot cover a required behavior, record the remaining risk explicitly. M11 implementation/CI completion is distinct from final product release acceptance.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
