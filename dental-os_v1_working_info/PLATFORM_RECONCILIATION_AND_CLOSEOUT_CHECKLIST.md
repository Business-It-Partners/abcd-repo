# Dental OS — Platform Reconciliation and Closeout Checklist

**Created:** 2026-10-21. **Updated:** 2026-10-22.
**Status:** IMPLEMENTING — P01–P03 and M15.1 complete. P04–P06 have reviewed implementation candidates and focused evidence; P07 execution is underway; P08 scope is dispositioned but its renewal ownership/drill remain open; P09 final-source integration/verification remains open. G12, G13 and G15 remain open.
**Owner:** Local OS platform track, with product decisions reviewed by Abhishek.
**Milestone assignment:** [M15 — Platform Closeout and Integration](milestone-15-platform-closeout-and-integration/PLAN.md), gate G15, adopted by the user on 2026-10-21. P01–P09 remain task identifiers; M15.1–M15.6 are the milestone slices.

## End goal and authority

Deliver one integrated, verified Dental OS platform baseline that independently delivered first-party dental apps can reliably use. Establish the supported capabilities, exact source, evidence and outstanding release requirements. Functional dental apps remain the parallel M14 track; final app integration and acceptance must use the verified platform baseline.

This file is the central progress tracker for platform reconciliation and closeout. Keep task status, scope decisions and the reconciliation map here; link detailed implementation notes and evidence from their owning milestone records. The root [work contract](../WORK_CHECKLIST.md) remains authoritative for session scope/history; the [architecture](../dental-os_v1-documentation/00_V1_README.md) defines product behavior, the [roadmap](00_V1_MASTER_ROADMAP.md) defines milestone order, and [global status](00_V1_STATUS.md) records milestone progress. This checklist does not itself change their gates or declare existing work complete.

The user subsequently authorized starting the work with this chat as lead and separate sidebar worker chats/worktrees. The evidence map and concrete proposal were presented first; the user then authorized P03 to adopt the scope and align milestone records before runtime implementation. Preserve M01–M11 results for the exact source and scope tested. Assess existing work before scheduling new implementation; reference completed capabilities instead of repeating them.

## Tracking rules and boundaries

- Check an item only when its stated result has evidence. Use PLANNED, IMPLEMENTING, IMPLEMENTED, VERIFIED, BLOCKED or DEFERRED, with a concrete reason for blockers/deferrals. Historical evidence does not automatically verify the final combined source.
- Update this tracker when scope/status changes. Evidence records identify source SHA, relevant local changes, host/environment, command or manual procedure, result and limitations. Preserve failed attempts and their disposition.
- Keep app feature code/UI/API wiring with M14. Exchange required host capabilities through the [published M14 dependency register](https://github.com/Business-It-Partners/dental-os/blob/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality/PLATFORM_DEPENDENCIES.md). Preserve existing module IDs, signed module metadata, family explorer and same-window module switching.
- Apps remain company-controlled web packages, using mediated shared login and the existing SaaS Worker as business authority. No third-party publishing, local authoritative business DB or hidden offline write queue.
- Preserve unrelated changes, reference archives and the user's live application session. Follow root AGENTS.md for permissions, integration, bounded resource use and private-display testing. This document grants no additional deployment, production, merge or deletion authority.
- On completion of each worktree task, remove only its unnecessary task-generated build outputs after preserving needed verification evidence. Keep source, commits, reports, user/live builds and unrelated worktrees intact. Do not generate builds for documentation-only work.
- Documentation work uses the documentation checker. Later implementation uses checks appropriate to affected behavior, with one heavy local job at a time and required Linux/Windows evidence.

## Work order and status

Dependencies below order the work. P03 adopts responsibility/scope, not a specific new API grant format or host adapter design; implementation decisions remain explicit in their owning phase.

| ID | Work area | Status | Owner | Depends on | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| P01 | Establish source baseline | VERIFIED (source audit only) | Platform track | None | Source/branch/local-change inventory and proposed disposition |
| P02 | Reconcile milestones and capabilities | VERIFIED (audit only) | Platform track | P01 | Responsibility-to-source/evidence map and verified gap list |
| P03 | Define platform closeout scope | VERIFIED (planning/documentation only) | Platform track; Abhishek reviews scope | P02 | Reviewed scope, acceptance criteria and aligned roadmap/status/gates |
| P04 | Resolve independent API-permission evolution | IMPLEMENTED CANDIDATE — user selected existing signed company catalogue/update-policy authority; format-2 grants and synthetic positive/negative/API-only extension proof pass on `11cb1bc8`; M14 has submitted partial app route lists, but host reconciliation, role/tenant tests and live Worker compatibility remain | P04 sidebar worker delivered proposal; lead owns accepted contract, source integration and final review | M15.1; M14 dependency register; product decision received 2026-10-22 | ADR-026, exact signed grants, deny-before-credential checks and synthetic successor/fallback proof; M14-specific host compatibility still required |
| P05 | Align staged app updates with ADR-025 | IMPLEMENTED CANDIDATE — source, 310-test serial unit suite, SDK, update UI and Store-arrival checks pass on `11cb1bc8`; independent review remains | P05 sidebar worker delivered disjoint source/tests; lead owns integration and final serial checks | M15.1; canonical ADR-025 contract | Running-version preservation, next-full-app-launch trial, truthful version state, fallback/health/interruption/race cases; see P09 source manifest |
| P06 | Close integrated shell usability | IMPLEMENTED CANDIDATE — focus/reduced-motion, app-launch feedback, scaling and overview private checks pass on `11cb1bc8`; M12.6/G12 acceptance remains open | P06 sidebar worker delivered disjoint source/tests; lead owns integration; Abhishek remains owner of user visual acceptance | M15.1; M12.6/G12 obligations; P04/P05 parallel implementation completed | Source-bound keyboard/focus, scaling, reduced motion, recovery and multiwindow evidence; user/profile/device evidence stays explicit |
| P07 | Validate representative platform workloads | PARTIAL — supported signed-fixture API, update, session, package, multiwindow, failure and bounded-resource rows passed; M14 has supplied partial route and Patient Record package measurements, while host reconciliation, media, other-app payload and live Worker cases remain open | Lead owns fixtures, runs, evidence and M14 handoff; P07 sidebar worker authored only the workload proposal | P04–P06 integrated candidates; M14 P01–P03/P07/P09–P11 dependencies | Lead-run workload results and current M14 handoff findings are recorded in the P07 matrix and P09 manifest; unsupported media/navigation and real-service cases remain explicit |
| P08 | Reconcile release and operations requirements | DISPOSITION RECORDED — app-ready vs M20 scope and support procedure drafted; no named staging operator/reviewer, metadata-only tool or renewal/expiry drill yet | Lead owns disposition; Abhishek reviews scope/G21 only; named staging operator and independent reviewer are unresolved human assignments | P03; P07 workload constraints; staging signer/publisher controls | M15 vs M20 requirement table, named human assignments, reviewed metadata-only preparation path, higher-sequence renewal/expiry-recovery drill and support procedure |
| P09 | Integrate and verify platform baseline | IN PROGRESS — lead owns integration, record alignment and final verification; not yet verified | Lead | P04–P08; M14 handoff | Exact final source identity, required build/unit/private UI and applicable CI checks, M14 dependency handoff, retained release/device gates |

P01–P09 are checklist identifiers, not renamed historical milestones or M14 dependency IDs.

## Active work assignments and file boundaries

P04/P05/P06 were separate GPT-6 Luna Extra High sidebar chats with distinct worktrees; all returned and their worktrees remain preserved. P07 and P08 were also separate sidebar chats/worktrees; they delivered a workload proposal and a release/operations disposition. The lead has integrated and reviewed the candidate source/proposals. Worker worktrees and reports remain preserved; final acceptance is still lead-owned. P04 authority choice is resolved to the existing signed company catalogue/update-policy authority, but M14 route/role compatibility remains. One heavy local job runs at a time.

| Item / owner | Branch and worktree | Bounded files | Dependencies and required evidence |
| --- | --- | --- | --- |
| P04 — “M15 P04 API Authority Contract” | `codex/m15-p04-api-authority`, `/home/master-x/.codex/worktrees/5fdc/fewa_business_os`; sidebar chat `01a15fa3-6d51-7840-a43a-20a543796e73` | Proposal only; lead integrated the accepted signed format-2 authority into `electron/distribution/**`, package/runtime/API broker layers and focused tests | Depends on M15.1 and pinned M14 dependency register. Exact authority is accepted; M14 route/role inventory and real Worker proof remain external. |
| P05 — “M15 P05 ADR-025 Update Lifecycle” | `codex/m15-p05-adr025-updates`, `/home/master-x/.codex/worktrees/92c1/fewa_business_os`; sidebar chat `01a15fa3-8b05-7712-b09a-3475e4d18ef5` | `electron/distribution/**`, package registry/runtime, Store UI and directly related update/store tests; lead integrated/reviewed candidate | Depends on M15.1 and ADR-025. Deliver staged bytes, running-version pinning, next full app launch, trial/health/recovery, truthful state, interruption and operation-race proof. |
| P06 — “M15 P06 Shell Usability and G12” | `codex/m15-p06-shell-usability`, `/home/master-x/.codex/worktrees/ae11/fewa_business_os`; sidebar chat `01a15fa3-aab7-71d2-a994-f61d2065ee54` | Shared shell/workspace/overview styles and scoped private UI tests; lead integrated/reviewed candidate | Depends on M15.1 and M12.6/G12. Automated private checks do not close user visual acceptance or device evidence. |
| P07 — “M15 P07 Representative Workloads” | `codex/m15-p07-sidebar`, `/home/master-x/.codex/worktrees/43e3/fewa_business_os`; sidebar chat `01a15fc5-dbe2-7490-92b3-d33ddf257b7b` | Worker: only `proposals/P07_WORKLOAD_MATRIX.md`. Lead: synthetic tests/evidence addendum and integration results | Depends on P04–P06 candidate source; M14 supplies app API/media needs. Worker proposal and lead execution are recorded separately. |
| P08 — “M15 P08 Release and Operations” | detached worktree `/home/master-x/.codex/worktrees/c54c/fewa_business_os` at `76c9251851a30daf8d2bed34de275cc9c0a4e3e2`; sidebar chat `01a15fc5-d9bf-73b2-aade-63e9e85225c4` | Worker: only `proposals/P08_RELEASE_OPERATIONS_DISPOSITION.md`; lead integrates checklist/M15 records and local synthetic renewal proof | Depends on P03 and P07. A named operator and independent reviewer plus actual drill are required before P08 acceptance; no human is inferred from scope-review ownership. |
| P09 — lead | Lead M15 branch/worktree `/home/master-x/.codex/worktrees/platform-closeout/fewa_business_os` | Final integration, central/M15 records, M14 handoff, test manifest and review preparation | Depends on P04–P08; no M14 app-feature edits, main merge, production deployment or worktree deletion. |

## P01 — Establish source baseline

- [x] Inventory relevant local worktrees, local/remote branches and divergence; record when remote refs were checked and exact SHAs.
- [x] Classify uncommitted code, docs, tests and artifacts; identify ownership and preserve unrelated/user changes and local-only reference history.
- [x] Propose the platform integration baseline and disposition of side-branch work (integrate, preserve, superseded or deferred), without merging or deleting as part of the audit.

**Evidence / decisions:** [Source baseline](audit-reports/SOURCE_BASELINE.md) and [exact ref/local-input inventory](audit-reports/SOURCE_BASELINE.json). Dental OS origin fetched without pruning; main is M11-integrated, M13 candidate is `96363362`, and the 39 local inputs remain separate. Relevant ancestor branches need no duplicate merge; the old M12 patch needs only a semantic disposition. No code, branch integration or runtime verification was performed.

## P02 — Reconcile milestones and capabilities

- [x] Read M01–M11's recorded scope/evidence; identify what remains valid and what requires affected integration checks.
- [x] Separate M12/M13 shared platform mechanisms from app-shell delivery and M14 functional apps; assess relevant M20 release requirements individually.
- [x] Populate the map below with source paths/SHAs, exact verification scope, remaining gaps and owners; distinguish implemented, tested, user-reported and accepted behavior.

**Reconciliation map:** Lead-reviewed responsibility map from source inspection and the two completed sidebar reports. Evidence below means retained historical proof, not new runtime verification in this audit.

| Platform responsibility | Original milestone | Where actually implemented | Verification evidence / limits | Remaining work | Current owner |
| --- | --- | --- | --- | --- | --- |
| Product constitution and traceability | M01 | Architecture, roadmap, requirements/checker | Documentation evidence; reconstructed M01 checkpoint is not the original accepted tree | Dated status corrections; map new decisions after review | Lead |
| Trusted host / OS-only state / safe diagnostics | M02, M10 | `electron/host`, `storage`, `diagnostics`, main/preloads | Historical Linux/Windows and recovery evidence; v2 state behavior already present in M13 | Final affected regression; narrow support preview/cancel evidence review, no wholesale old-M12 merge | Platform |
| Isolated runtime and shared window lifecycle | M03, M10; expanded M12/M13 | Runtime manager, shared window manager/ManagedWindow, local M13.13 launch delta | Historical runtime/containment checks plus recorded dirty-source 132-case Linux launch fixture | Review/checkpoint local delta; final combined-source Linux/Windows checks and remaining user review | Platform |
| API authority and independent evolution | M04; expanded M13 clinic API support | SDK broker/contracts; compiled `appPolicy.ts`; format-2 signed update-policy release grants | M04/M09 mediated API proof; synthetic new-app, API-only extension and fallback proof | M14 per-app route/method/role map and service-backed authorization compatibility; media remains a separate contract | Platform; app supplies requirements |
| Shared identity/session | M05, M09 | Electron identity, broker session fences, session UI | Live staging sign-in/renewal and representative integration; fixture negatives remain labeled | Reuse foundation; check final affected session/workload transitions | Platform |
| Verified packages / local recovery | M06, M08, M11 | Package format/registry, immutable leases/journal/trust | Recorded package, process-exit and policy tests | Reuse; validate affected next-launch/tamper/retention paths | Platform |
| Store and signed delivery | M07, M11 | Distribution service, Store UI, separate SaaS staging service | Recorded actual staging feed/install/update acceptance | Finish integrated Store UX; assign metadata renewal owner and prove renewal/expiry recovery | Platform; staging operator |
| Safe staged app updates | M08, M11; ADR-025 target accepted later | Existing pending/trial/known-good registry; current immediate `updateNow` UI/runtime path | Prior pinning/trial/rollback proof covers its recorded behavior | Align default staged/next-full-launch flow; prove failures, races and original-key safety | Platform |
| Generic first-party onboarding | M11 | Generic package/runtime identity and company trust | Generic sample onboarding + app-only updates accepted | Preserve; distinguish package independence from still-compiled clinic API permission policy | Platform |
| Integrated shell and family module navigation | M12; related M13 platform work | Desktop chrome/explorer, package metadata, runtime module handoff | Scoped M12.1–.5 Linux evidence; G12 and integrated M12.6 remain open | Full journeys, keyboard/focus/scaling/reduced-motion/recovery; retain intermittent failure review | Platform |
| Eleven app-shell releases | M13 | Signed first-party shell packages, sequences 16–21 | User-reported 1.0.0 installs/run; newer Finance/Lab 1.0.1 release evidence | Narrow health receipt and 1.0.1 installed/module review; preserve separate G13 closure requirements | Platform closeout for shared proof; app track owns features |
| Required app-facing media/navigation/budgets | M14 dependencies feeding platform scope | Bounded JSON/blob read exists; upload adapter missing; M14 has partial routes and Patient Record test-signed package measurements; inter-app design remains gated | Source constraints + current M14 dependency register snapshot and blob identity in the [P09 manifest](milestone-15-platform-closeout-and-integration/evidence/P09_FINAL_SOURCE_MANIFEST.md); no new capability acceptance | Reconcile the submitted app routes against exact host grants; design/verify required private media and gated navigation; measure remaining app payloads before any limit change | Platform with M14 coordinator |
| Full dental app functionality | M14 | Separate published app branch and maintained SaaS feature source | Planning and baseline shell CI; functional acceptance pending | Remains parallel app work; final G14 uses verified platform baseline | External M14 app track |
| Installer / desktop updater / release operations | Original release work reassigned to M20 | Unsigned Windows preview tooling; package updater is a separate channel | Historical and newer local preview packaging, not real Windows installation; no platform updater proof | Named product host matrix, signed installers/updater, custody and support operations under M20 | Platform/release owner |
| Physical-device / final product acceptance | G21 after M20 | Acceptance contract | Explicitly outstanding | Required physical Windows/device/user acceptance before final release | Abhishek + platform/release |

**Evidence / decisions:** [Milestone evidence audit](audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](audit-reports/SHELL_RELEASE_AUDIT.md) and [lead API/update inspection](audit-reports/API_UPDATE_GAPS.md). Both sidebar workers completed; lead corroborated refs/tag translations, policy/update paths and metadata continuity, and added the newer local Windows-preview distinction. Preserve historical results; reconcile stale opening verdicts with dated addenda during closeout.

## P03 — Define platform closeout scope

- [x] Propose one closeout milestone containing unresolved platform work and final integration checks; reference completed work as dependencies. Identify any M20 requirements retained for later release work.
- [x] Present the reconciliation map and concrete scope/numbering/gate proposal for review before changing milestone assignments. Keep M14 app development parallel; retain its integrated acceptance dependencies.
- [x] After scope review, update roadmap, ownership, global status, acceptance gates and affected plans consistently, following the existing PLAN / STATUS / IMPLEMENTATION_NOTES / VERIFICATION_EVIDENCE pattern. Link detailed execution records from this checklist.

**Evidence / decisions:** The user authorized P03 and adopted the proposed closeout scope. The four [M15 milestone records](milestone-15-platform-closeout-and-integration/PLAN.md), G15 traceability, affected plans and aligned roadmap/status are integrated in `codex/milestone-15`. [P03 evidence](milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md) records passing documentation checks and worktree-output inspection. No runtime or G15 acceptance is claimed.

### Adopted closeout structure — P03

**M15: Platform Closeout and Integration**, with corresponding G15. The user approved formalization after reviewing the proposal; existing milestone numbers are preserved. Preserve M01–M11 history, the existing M12/G12 and M13/G13 obligations, M14 app ownership, M20 release scope and G21 device acceptance.

| Closeout slice | Deliverable / exit proof | Existing owner record |
| --- | --- | --- |
| M15.1 — Candidate source and record reconciliation | Review/checkpoint the M13 local delta, record semantic side-branch disposition, correct stale status headings with dated final dispositions; exact baseline and preserved evidence | P01–P03; M12/M13 records |
| M15.2 — Versioned app authority and required host contracts | Precise approved API evolution on an unchanged desktop; bounded required private media and a scoped OS-navigation design assessment; explicit disposition of print/export and payload constraints | P04; M14 dependency register |
| M15.3 — ADR-025 Store/update alignment | Prepare without disturbing running work; activate on next full launch; trial/health/eligible recovery, version truth, interruption/race/outcome proof | P05; M08/M11 foundations |
| M15.4 — Integrated shell closeout | Close applicable M12.6/G12 and remaining M13/G13 evidence using exact source/profile or user-review proof; preserve family explorer and shared window/dock/Genie behavior | P06; existing G12/G13 |
| M15.5 — Workload and operational continuity proof | Representative read/write/media/large-asset/multiwindow/failure tests; explicit supported test environments and measured budgets; named metadata renewal operator and renewal/expiry-recovery drill | P07 and app-ready subset of P08 |
| M15.6 — Integrated platform baseline | Required checks on final combined source, retained exact identities/evidence, app handoff and remaining release/device gate register | P09 |

**Integration order:** M15.1 first; freeze shared contracts for M15.2/M15.3 before overlapping edits. API, update and shell workers may then implement disjoint scopes with lead-owned shared-file coordination. M15.5 proves their combined behavior; M15.6 performs final integration. Heavy local builds/tests run one at a time. No worker edits the external M14 app branch.

**App-ready boundary:** M14 implementation continues now; its final functional integration uses the verified M15 baseline. G15 requires the retained G12/G13 residuals and new platform checks to be satisfied or any explicit user-reviewed gate/scope change documented; it cannot silently waive them. A green shell fixture alone cannot close functional G14.

**Release boundary:** M20 retains production installer formats/host certification, executable signing custody, platform updater/restart/recovery and final release support procedures. G21 remains physical/device/user/product acceptance after M20. Closeout must define the current development/automated environment inventory (observed local Ubuntu 22.04.5 x86_64 private GNOME/Wayland; hosted Ubuntu 24.04 and Windows Server 2022 evidence where applicable) without calling CI runners a customer-OS support promise. A final product support matrix is an explicit M20 decision.

**Operations subset needed earlier:** Signed app-feed expiry/rotation controls already exist, but ongoing renewal operations are not proven merely by those controls. Name an operator and verify higher-sequence metadata-only renewal plus safe expiry recovery before reliable continuing feed use. Automation is a separate explicit decision; preserve freshness checks and signing custody.

**P03 execution:** Create M15 PLAN/STATUS/IMPLEMENTATION_NOTES/VERIFICATION_EVIDENCE and G15 mappings; align roadmap, status, affected milestone plans and checker expectations. Existing general cross-app messaging/intents remain excluded under R13; any bounded navigation proposal must receive an explicit contract/ADR decision during implementation. No route-list manifest or new native power is approved merely by this scope document.

## P04 — Resolve independent API-permission evolution

- [ ] Audit compiled app/route coupling against the [SDK/API contract](../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md) and app requirements. Specify how app-only releases can evolve approved access with explicit authority boundaries.
- [ ] Record the accepted design, compatibility and approval mechanism before implementation; do not assume a route-list manifest is already approved. Preserve host-held credentials and authoritative Worker authorization.
- [ ] Prove a new signed API-enabled sample and a compatible app-only API extension on an unchanged desktop, including denied undeclared requests, role/session changes and incompatible contracts.

**Evidence / decisions:** The user selected the existing signed company catalogue/update-policy authority on 2026-10-22. [ADR-026](../dental-os_v1-documentation/20_V1_ADR_REGISTER.md) and the lead-integrated format-2 exact-release grants bind version, package wire hash, payload digest and typed API operation IDs to existing company trust ceilings. The synthetic `tests/apiAuthority.test.ts` covers a new signed app absent from `appPolicy`, an API-only v1.1 grant while v1 remains live, pre-credential denials, trial failure and v1-only fallback. This is not live Worker/M14 route-role compatibility proof; that inventory remains pending.

## P05 — Align staged app updates with ADR-025

- [ ] Compare registry, Store and runtime behavior with the [canonical install/update contract](../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md); implement only evidenced gaps.
- [ ] Verify separate immutable candidate preparation, truthful pending/version UI, unchanged running code/assets/work, existing-instance focus and candidate trial on the next full launch.
- [ ] Verify bounded startup health, eligible known-good fallback, no unsafe fallback under current policy, pending state across OS restart, interruption recovery, concurrent Update/Open/Close/uninstall and retention safety.

**Evidence / decisions:** The lead-integrated candidate stages immutable bytes while preserving the running lease, offers the candidate on the next full app launch, tracks active/pending/trial/known-good versions, performs health promotion and eligible fallback, and rejects the old relaunch action. Build, full serial unit and affected private UI evidence pass on `11cb1bc8`; see the P09 source manifest. Preserve prior M08/M11 evidence for its original behavior and scope; it does not certify ADR-025 automatically.

## P06 — Close integrated shell usability

- [ ] Reconcile outstanding [M12/G12 work](milestone-12-os-ui-experience/PLAN.md), relevant M13 platform follow-ups and intermittent failures against the chosen source.
- [ ] Verify complete installed-app journeys across launch, focus, windows, dock, explorer/module selection, minimize/restore, close, Store and lock/logout/session recovery; preserve the shared lifecycle and dock/Genie pipeline.
- [ ] Complete required keyboard/focus, scaling, reduced-motion, error/recovery and user-review evidence; separate private/hosted technical checks from physical-device/user acceptance.

**Evidence / decisions:** Integrated candidate includes focus trapping/restoration, scaling/reduced-motion adjustments and overview placement using actual managed-window bounds. Private usability, scaling and overview checks passed (10, 5 and 30 assertions respectively); the fixture setup and fullscreen geometry required corrections before pass. App-launch feedback also passed its 132-check suite on the P09 source. Broader journeys and user/profile/device evidence remain open; see M12/M15 records. G12/G13 are not closed.

## P07 — Validate representative platform workloads

- [ ] Define small first-party test apps covering reads/writes, stable operation/idempotency identity, unknown outcomes, cancellation, dirty/modal close protection and app/session transitions.
- [ ] Exercise needed media transport, larger assets within declared bounds, module handoff, multiple windows, failure containment and bounded resource behavior; record unsupported capabilities explicitly.
- [ ] Run the agreed matrix against the actual platform with synthetic data and appropriate fixtures/staging evidence. Distinguish fixture results from real broker/runtime/Store proof; coordinate any permitted remote work under existing authorization.

**Evidence / decisions:** [P07 workload matrix](milestone-15-platform-closeout-and-integration/proposals/P07_WORKLOAD_MATRIX.md) maps the read/write, unknown-outcome, cancellation, media, package-bound, malformed-response, multiwindow and resource cases. Focused synthetic broker, package, update and shell checks are evidence only for their listed cases. M14 has submitted partial route lists and Patient Record test-signed package sizes; exact host reconciliation, other-app payload sizes and role/tenant tests remain open. Media upload has no host adapter, the current host excludes Work Entry's patient-media read route, and blob-read checksum semantics are unresolved, so media success is not claimed. P09 records the current M14 handoff snapshot and Windows runtime failure report.

## P08 — Reconcile release and operations requirements

- [ ] Assess [M20](milestone-20-windows-linux-release/PLAN.md) requirement by requirement: named host/architecture support, installers, desktop updater, signing custody/provenance, catalogue/trust metadata renewal, diagnostics and support/recovery procedures.
- [ ] Assign each requirement to a prerequisite for the app-ready baseline, later production-release work, or an explicitly reviewed deferral; name owner, reason, dependency and acceptance gate. Implement/verify prerequisites in the agreed closeout scope.
- [ ] Preserve mandatory G21 physical Windows/device and user/product acceptance before final release. Identify production promotion and other separately authorized release actions explicitly.

**Evidence / decisions:** [P08 disposition](milestone-15-platform-closeout-and-integration/proposals/P08_RELEASE_OPERATIONS_DISPOSITION.md) separates staging app-feed continuity from M20 production installers/updater/signing/host/support and G21 device/user acceptance. It contains a redacted support/recovery procedure and a metadata-only renewal/expiry-recovery drill plan. No named operator or independent reviewer, approved metadata-only preparation tool, or completed staging drill is recorded. The synthetic local higher-sequence renewal regression passes on runtime source commit `11cb1bc8`; staging operational proof remains open. Abhishek is recorded as scope/G21 reviewer only, not assigned as signer/operator.

## P09 — Integrate and verify platform baseline

- [ ] Integrate reviewed platform work under the repository's authorization/integration policy; record exact final source, retained branches/evidence and any excluded changes. Coordinate app-track compatibility without absorbing unfinished M14 features.
- [ ] Run required build/unit, focused private Linux UI, applicable Windows CI and affected integrated checks against the final source. Rerun affected checks when integration changes behavior; preserve failures and repairs.
- [ ] Publish the supported capability inventory, handoff contracts, source/evidence identity and explicit residual release/device/app gates; align milestone status and document exactly what acceptance has been achieved.

**Evidence / decisions:** Lead owns exact-source integration, documentation consistency, required build/unit/focused private UI/applicable CI checks, M14 handoff and residual-gate register. This phase is underway; the final source identity, final check results and independent review have not yet been recorded.

## Completion and remaining acceptance

- [ ] Every work area has an evidence-backed disposition; deferred requirements have reviewed scope, owner and future gate. No required baseline capability remains unresolved.
- [ ] The final combined source supports the declared install/runtime/session/API/update/shell capabilities and passes its required checks.
- [ ] M14 receives the exact verified platform baseline and remaining app-specific dependencies; final functional app acceptance remains in its own records.
- [ ] The closeout report distinguishes platform readiness for app integration from production release readiness, including all remaining M20/G21 and operational requirements.

## Activity record

| Date | Change | Verification / limits |
| --- | --- | --- |
| 2026-10-21 | Completed user-authorized P03: M15/G15 formalized; separate sidebar worker outputs reviewed/integrated. | Documentation checker PASS (16 milestones/64 records/17 gates), lightweight review and output cleanup inspection; no runtime tests or gate closure. |
| 2026-10-21 | Completed worker turns for the P04/P05/P06 batch on distinct GPT-6 Luna Extra High sidebar chats/worktrees. | P04 delivered a proposal only; P05/P06 delivered uncommitted implementation candidates. `git diff --check` passed for each; P04 docs checker passed. No P05/P06 build/test ran. Lead review, integration and serial required checks remain. |
| 2026-10-21 | Completed P01/P02 audits and prepared the proposed M15 closeout structure. | Read-only source/evidence audit; no implementation, milestone reassignment, merge or gate closure. |
| 2026-10-21 | Started P01/P02 under lead/worker coordination; switched embedded workers to the explicitly requested sidebar chats. | Source inventory complete, worker reports under review; no implementation/gate closure. |
| 2026-10-21 | Created the user-requested nine-area tracker and navigation links. | `python3 tools/check-dental-docs.py` and `git diff --check` PASS. No source audit, implementation, roadmap reassignment or gate closure claimed. |

### P03 parallel review layout (historical)

| Role | Sidebar chat / worktree | Owned output |
| --- | --- | --- |
| Lead | `dental-os-sole`; original checkout plus `platform-closeout` on `codex/milestone-15` | This tracker, source baseline, API/update audit and final reconciliation |
| Evidence worker | `Platform audit - milestone evidence`; worktree `d585` | Milestone evidence audit only |
| Shell/release worker | `Platform audit - shell and release`; worktree `0b37` | Shell/release audit only |

The two sidebar workers used GPT-6 Luna Extra High. Earlier embedded workers stopped after the user clarified the intended UI arrangement; their partial reports/worktrees remain preserved. Both sidebar audits and the P03 milestone-record tasks completed in disjoint scopes. Their provenance remains in the audit reports; current P04–P08 worker paths and file boundaries are listed in Active work assignments above. The lead owns this checklist and all integration. No heavy job was required for P03.

### P03 completion and M15.1 reconciliation

The user approved the reviewed scope and P03 is complete for documentation. M15.1 reviewed the explicitly inventoried original-checkout source/artifact deltas and side-branch ancestry. Only the managed-app launch-feedback/native-frame handoff group was accepted, after the named checks in [M15 evidence](milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md), and checkpointed at `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. The staging package helper and Windows preview/report outputs are deferred to M20 review; older side branches were preserved and not merged. P01/P02 audit completion did not approve every candidate change. M15 remains IMPLEMENTING with G15 open. P04–P06 source candidates are integrated; P07 execution, P08 renewal ownership/drill and P09 final verification continue under the adopted plan. The P04 authority choice is recorded in ADR-026; no media adapter or general app-to-app navigation contract is inferred.

### M15.1 completion and next execution boundary

M15.1's accepted source checkpoint is source-bound to build, unit, private runtime and managed-app launch feedback evidence; its dated M12/M13 coordination addenda preserve the remaining G12/G13 obligations. The original dirty M13 checkout, P03 worker worktrees and unaccepted files remain intact. The user-provided staging preparation helper was not executed. P04–P06 sidebar implementation tasks have returned and their reviewed candidates are integrated in the lead worktree; their worker worktrees remain preserved. P07 and P08 proposals have also returned. The lead is running supported synthetic workload checks, keeping unsupported media/M14 contracts explicit, and owns P09 integration/final verification. Heavy checks remain serialized.
