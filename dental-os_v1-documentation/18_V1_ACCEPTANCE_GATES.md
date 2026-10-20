# Dental OS — Acceptance Gates

**Baseline:** V1, 2026-10-15; milestone owners amended 2026-10-19. Target architecture; implementation status is tracked separately.

Final product release requires applicable G01–G14, G20 and G21 evidence for the explicitly supported Windows/Linux matrix. G21 is a separate post-M20 physical-device and user/product acceptance gate. Documentation completion is not production acceptance.

| Gate | Invariants | Minimum evidence | Owner |
| --- | --- | --- | --- |
| G01 Scope/authority | INV-01..05,13 | links, decisions, ownership, current-state/gap review | M01 |
| G02 Host/state safety | INV-05,09,12 | activation, lock/exit states, corrupt journal, low-space, interrupted migration | M02 |
| G03 Isolation/composition | INV-05,07,09 | two apps, denied navigation/storage/privilege, crash behavior, shell/Genie regression | M03 |
| G04 SDK/transport | INV-03,07,08,10 | forged caller/frame/payload rejection, bounded destinations, conflict/idempotency | M04 |
| G05 Identity/privacy | INV-03,08,11 | actual login/refresh/logout/switch/revocation, secret-provider failure, stale-response rejection | M05 |
| G06 Verified packages | INV-02,04,06,12 | altered manifest/assets, traversal, archive limits, restart/uninstall failures | M06 |
| G07 Distribution | INV-02,06,10,12 | actual approved catalogue/R2 fixture, unauthorized/replayed/expired release refusal | M07 |
| G08 Safe updates | INV-04,06,09,12 | pinned running version, interruption matrix, dirty state, revocation, compatible rollback | M08 |
| G09 Integrated OS | INV-03..11 | delivered sample apps, shared session, representative existing SaaS read/write, uncertain outcome | M09 |
| G10 Hardening | INV-07..14 | security negatives, disk/cache privacy, keyboard/contrast, crash/resource soak | M10 |
| G11 Flexible first-party app onboarding/updates | INV-02,04,06,09,12 | generic new-company-app install, signed app-only version sequence, no platform rebuild, safety/resource evidence | M11 |
| G12 OS workspace and shell experience | INV-01,05,09,11,14 | startup-to-work flows, app discovery/switching, shared windows, Store/system states, keyboard/fit/usability evidence | M12 |
| G13 First-party app-shell releases | INV-02,04,06,09,12 | one signed staging 1.0.0 shell per approved Dental OS app; correct app/module discovery labels; install/open evidence | M13 |
| G14 Functional Dental OS apps | INV-03,05,07,08,10,11 | app-level UI/workflows, capability-scoped brokered APIs, staging acceptance and safe app-only updates | M14 |
| G20 Windows/Linux release and operations | INV-01,04,12..14 | named support matrix, signed installers, clean install/upgrade/uninstall, platform update/recovery, host CI/evidence and runbooks | M20 |
| G21 Final device/user acceptance | INV-01,05,09,13,14 | physical Windows-device interaction/visual checks, supported-device review, user acceptance, remaining-risk decision after M20 | Final release decision, post-M20 |

Evidence records source/tree identity, dependency versions, platform/display/profile, exact commands, outcomes, logs and limitations. Use synthetic/staging data and protect credentials. Preserve failed/interrupted runs with superseding successful runs, not rewritten history.

User visual acceptance and technical verification are separate fields. A test count without case references/outcomes cannot close a gate. Tests and commands proposed in plans are not executed evidence. Code-only or Linux-only results never imply cross-platform certification.

## Staging-only evidence requirement

For G04/G05/G07/G08/G09/G11 and any other remote-dependent gate, record the verified `fewa_demo` branch, GitHub environment/workflow and Cloudflare/Firebase resource mapping without secrets. Prove the test/build targets staging, with no production fallback or mutation. For backend/shared configuration changes, retain regression evidence for existing Dental SaaS and Super Admin staging clients.

G07 requires `/v1/dental-os/...` for new OS services and unchanged existing business routes. G08 requires staging-only release/channel/revocation metadata. G11 proves generic first-party app authorization/update and does not reopen M07/M08's original sample gates. G13/G14 app releases and G20/G21 host/final acceptance must distinguish local/staging evidence from separately authorized production publication. Successful staging never proves production deployment or authorizes one. [Canonical policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## Verification policy — deferred physical Windows testing

The 2026-10-15 user decision deferred physical Windows interaction/visual acceptance until after the then-final M11 milestone. The 2026-10-19 amendment assigned platform release/operations to M13. The 2026-10-20 amendment assigns app shells to M13, functional apps to M14, and platform release/operations to M20. The physical-device deadline therefore moves to **after M20**, remaining mandatory under G21 before a final product release decision. During M02–M20, applicable Windows GitHub Actions provide automated build/typecheck, filesystem and hosted-runner smoke evidence; CI must not be called physical-device certification. These amendments change future milestone ownership, not prior milestone outcomes or test records.

Preserve exact checkpoint commits, workflow run URLs and outcomes. `main` carries the integrated snapshot; `codex/milestone-NN` records each started milestone. Never claim a later milestone started because its branch name exists. Create future branches only when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
