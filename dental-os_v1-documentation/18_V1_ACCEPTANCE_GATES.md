# Dental OS — Acceptance Gates

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Final product release requires all applicable gates on the explicitly supported Windows/Linux matrix, including the physical Windows gate deferred until after M11 below. Documentation completion is not production acceptance.

| Gate | Invariants | Minimum evidence | Owner |
| --- | --- | --- | --- |
| G01 Scope/authority | INV-01..05,13 | links, decisions, ownership, current-state/gap review | M01 |
| G02 Host/state safety | INV-05,09,12 | activation, lock/exit states, corrupt journal, low-space, interrupted migration | M02 |
| G03 Isolation/composition | INV-05,07,09 | two apps, denied navigation/storage/privilege, crash behavior, shell/Genie regression | M03 |
| G04 SDK/transport | INV-03,07,08,10 | forged caller/frame/payload rejection, bounded destinations, conflict/idempotency | M04 |
| G05 Identity/privacy | INV-03,08,11 | actual login/refresh/logout/switch/revocation, secret-provider failure, stale-response rejection | M05 |
| G06 Verified packages | INV-02,04,06,12 | altered manifest/assets, traversal, archive limits, restart/uninstall failures | M06 |
| G07 Distribution | INV-02,06,10,12 | actual approved catalogue/R2 fixture, unauthorized/replayed/expired release refusal | M07 |
| G08 Updates | INV-04,06,09,12 | pinned running version, interruption matrix, dirty state, revocation, compatible rollback | M08 |
| G09 Integrated OS | INV-03..11 | two real delivered sample apps, shared session, representative existing SaaS read/write, uncertain outcome | M09 |
| G10 Hardening | INV-07..14 | security negatives, disk/cache privacy, keyboard/contrast, crash/resource soak | M10 |
| G11 Release/operations | INV-01,04,12..14 | signed installers, clean install/upgrade/uninstall, platform update/recovery, named-host evidence | M11 |

Evidence records source/tree identity, dependency versions, platform/display/profile, exact commands, outcomes, logs and limitations. Use synthetic/staging data and protect credentials. Preserve failed/interrupted runs with superseding successful runs, not rewritten history.

User visual acceptance and technical verification are separate fields. A test count without case references/outcomes cannot close a gate. Tests and commands proposed in plans are not executed evidence. Code-only or Linux-only results never imply cross-platform certification.

## Staging-only evidence requirement

For G04/G05/G07/G08/G09 and any other remote-dependent gate, record the verified `fewa_demo` branch, GitHub environment/workflow and Cloudflare/Firebase resource mapping without secrets. Prove the test/build targets staging, with no production fallback or mutation. For backend/shared configuration changes, retain regression evidence for the existing Dental SaaS and Super Admin staging clients.

G07 requires `/v1/dental-os/...` for new OS services and unchanged existing business routes. G08 requires staging-only release/channel/revocation metadata. G11 platform certification must explicitly distinguish tested artifacts/staging feeds from separately authorized production publication. A successful staging test never proves a production deployment occurred or authorizes one. [Canonical policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## Verification policy revision — deferred physical Windows testing

User decision, 2026-10-15: during M02–M11, Windows acceptance uses GitHub Actions automated build/typecheck, filesystem tests and applicable hosted-runner smoke checks. Physical Windows-device interaction/visual acceptance is deferred until after M11 and remains a mandatory final product release gate. Missing physical evidence does not block starting the next milestone once its applicable Linux and Windows CI gates pass, but must not be described as physical-device certification or final release approval. If a CI check cannot cover a required behavior, record the remaining risk explicitly. M11 implementation/CI completion is distinct from final product release acceptance.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
