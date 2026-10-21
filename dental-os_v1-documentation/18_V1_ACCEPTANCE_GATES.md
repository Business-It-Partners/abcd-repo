# Dental OS — Acceptance Gates

**Baseline:** V1, 2026-10-15; milestone ownership updated 2026-10-21. Target architecture; implementation status is tracked separately.

Final product release requires applicable G01–G15, G20 and G21 evidence for the explicitly supported Windows/Linux matrix. M14 app implementation may proceed in parallel with M15, but final functional G14 integration and acceptance require a verified M15/G15 platform baseline. G21 is a separate post-M20 physical-device and user/product acceptance gate. Documentation completion is not production acceptance.

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
| G14 Functional Dental OS apps | INV-03,05,07,08,10,11 | app-level UI/workflows, capability-scoped brokered APIs, staging acceptance and safe app-only updates on the verified M15/G15 platform baseline | M14, after M15/G15 |
| G15 Platform Closeout and Integration | INV-01..14 | exact combined source and required checks; explicitly approved, independently evolving API authority with positive/negative enforcement; ADR-025 staged/next-full-launch app updates and eligible recovery; required bounded host contracts and payload limits; G12/G13 residual evidence or explicit reviewed scope decisions; representative workload/failure/resource evidence; named metadata-renewal operator and higher-sequence metadata-only renewal/expiry-recovery drill; M14 handoff and remaining M20/G20/G21 gates | M15 |
| G20 Windows/Linux release and operations | INV-01,04,12..14 | named support matrix, signed installers, clean install/upgrade/uninstall, platform update/recovery, host CI/evidence and runbooks | M20 |
| G21 Final device/user acceptance | INV-01,05,09,13,14 | physical Windows-device interaction/visual checks, supported-device review, user acceptance, remaining-risk decision after M20 | Final release decision, post-M20 |

Evidence records source/tree identity, dependency versions, platform/display/profile, exact commands, outcomes, logs and limitations. Use synthetic/staging data and protect credentials. Preserve failed/interrupted runs with superseding successful runs, not rewritten history.

User visual acceptance and technical verification are separate fields. A test count without case references/outcomes cannot close a gate. Tests and commands proposed in plans are not executed evidence. Code-only or Linux-only results never imply cross-platform certification.

G12 and G13 remain independent acceptance gates. G15 must carry forward and close their applicable residual requirements in their owning records, or cite an explicit user-reviewed scope/gate decision; G15 does not silently waive or replace either gate. G15's host evidence identifies actual development/automation environments and is not a customer support matrix. Its bounded host-contract evidence covers host-mediated private-media transfers when required (P09) and synthetic measurements against existing request/response/blob limits (P11). P10 is a bounded OS-owned navigation design assessment only. For R07, G15 requires a separately reviewed versioned first-party authority contract, exact route/method/parameter allow/deny evidence, and a genuinely new approved API-enabled company app plus a compatible API extension on unchanged desktop source. This architecture update selects no grant format. G15 approves no general cross-app messaging/intents system; any navigation implementation requires a later explicit contract/ADR. G15 does not close R14, M20/G20, or G21.

## Staging-only evidence requirement

For G04/G05/G07/G08/G09/G11 and any other remote-dependent gate, record the verified `fewa_demo` branch, GitHub environment/workflow and Cloudflare/Firebase resource mapping without secrets. Prove the test/build targets staging, with no production fallback or mutation. For backend/shared configuration changes, retain regression evidence for existing Dental SaaS and Super Admin staging clients.

G07 requires `/v1/dental-os/...` for new OS services and unchanged existing business routes. G08 requires staging-only release/channel/revocation metadata. G11 proves generic first-party app authorization/update and does not reopen M07/M08's original sample gates. G13/G14 app releases and G20/G21 host/final acceptance must distinguish local/staging evidence from separately authorized production publication. For G15, metadata-renewal drills use the existing staging feed and a higher sequence while preserving expiry/freshness rules; automation is a separate explicit operations decision. Successful staging never proves production deployment or authorizes one. [Canonical policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## Verification policy — deferred physical Windows testing

The 2026-10-15 user decision deferred physical Windows interaction/visual acceptance until after the then-final M11 milestone. The 2026-10-19 amendment assigned platform release/operations to M13. The 2026-10-20 amendment assigns app shells to M13, functional apps to M14, and platform release/operations to M20. The physical-device deadline therefore moves to **after M20**, remaining mandatory under G21 before a final product release decision. During M02–M20, applicable Windows GitHub Actions provide automated build/typecheck, filesystem and hosted-runner smoke evidence; CI must not be called physical-device certification. These amendments change future milestone ownership, not prior milestone outcomes or test records.

Preserve exact checkpoint commits, workflow run URLs and outcomes. `main` carries the integrated snapshot; `codex/milestone-NN` records each started milestone. Never claim a later milestone started because its branch name exists. Create future branches only when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
