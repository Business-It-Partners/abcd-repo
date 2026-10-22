# Dental OS — Platform Reconciliation and Closeout Checklist

**Created:** 2026-10-21. **Updated:** 2026-10-22.
**Status:** P01–P09 technical work and required automated checks are complete for the agreed non-upload platform scope. Final Linux and exact-source Windows evidence is recorded. Independent verification remains before checklist completion. User/profile G12 and G13 acceptance and formal G15 closure remain open; media upload is deferred.
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

## Platform readiness scope clarification — 2026-10-22

The user clarified that M14 app implementation and each app's coding/payload/UI acceptance are separate. M15 must implement, document and verify the declared host capabilities against existing Dental SaaS Worker/D1/R2 contracts and representative first-party platform fixtures. Follow-ups may demonstrate the contract; no individual M14 app completion is a prerequisite to technical platform readiness. Retain the exact platform handoff and app-specific acceptance gates. User manual/physical review follows technical verification and must not block remaining implementation or be silently marked passed.

All work remains sequential in this chat and the existing M15 worktree. The supplied account is authorized for staging only; production is excluded. No password, token, clinical payload or live profile is retained in evidence.

## Work order and status

Dependencies below order the work. P03 adopts responsibility/scope, not a specific new API grant format or host adapter design; implementation decisions remain explicit in their owning phase.

| ID | Work area | Status | Owner | Depends on | Completion evidence |
| --- | --- | --- | --- | --- | --- |
| P01 | Establish source baseline | VERIFIED (source audit only) | Platform track | None | Source/branch/local-change inventory and proposed disposition |
| P02 | Reconcile milestones and capabilities | VERIFIED (audit only) | Platform track | P01 | Responsibility-to-source/evidence map and verified gap list |
| P03 | Define platform closeout scope | VERIFIED (planning/documentation only) | Platform track; Abhishek reviews scope | P02 | Reviewed scope, acceptance criteria and aligned roadmap/status/gates |
| P04 | Resolve independent API-permission evolution | TECHNICAL PROOF PASSES — signed authority/unchanged-desktop extension, exact JSON contract, 25 live staging JSON/role/revocation checks and 10 crypto/two-SQLite tenant checks; upload deferred | Lead in this chat/worktree; prior proposal retained | M15.1; signed company authority; existing Worker contracts | Current progress/evidence below; final Windows/source review belongs to P09 |
| P05 | Align staged app updates with ADR-025 | LINUX TECHNICAL PROOF PASSES — 70 unit, 17 private staged-update, 26 integrated and 12 process-exit cases | Lead; prior worker source retained | M15.1; ADR-025 | Running pinning/next-launch trial/health/fallback/interruption/races verified; final Windows/source review P09 |
| P06 | Close integrated shell usability | TECHNICAL DISPOSITION COMPLETE — Linux/local/live-staging scopes and exact-source Windows workflow pass; final review retained under P09; user/device gates separate | Lead; user manual visual acceptance follows technical verification | M15.1; existing G12/G13 obligations | Final Windows proof and review P09; manual/module/device acceptance retained separately |
| P07 | Validate representative platform workloads | TECHNICAL DISPOSITION COMPLETE — Linux/local/live-staging scopes and exact-source Windows workflow pass; final review retained under P09; user/device gates separate | Lead owns fixtures/runs/evidence; no M14 app edits | P04–P06; declared supported capability inventory | Current live/private/source-bound reports; media upload explicitly deferred and real-session denied |
| P08 | Reconcile release and operations requirements | VERIFIED for staging feed continuity — signed metadata-only sequence 21→22 renewal and actual expiry recovery pass on `d5504845`; all 14 package objects and registry pointers unchanged; temporary publisher removed; no authenticated Store/native UI or production acceptance inferred | M15 lead owns preparation, technical review, authorized staging execution and evidence in this chat; user manual acceptance follows technical completion | P03; P07 workload constraints; staging signer/publisher controls | M15 vs M20 scope, user-authorized lead execution, reviewed metadata-only tool, real renewal/recovery report `P08_METADATA_RENEWAL_2026-10-22.json`, cleanup inventory and operating/support procedure |
| P09 | Integrate and verify platform baseline | TECHNICAL DISPOSITION COMPLETE — Linux/local/live-staging scopes and exact-source Windows workflow pass; independent review remains; packet ready | Lead | P04–P08; M14 handoff | Exact final source identity, required build/unit/private UI and applicable CI checks, M14 dependency handoff, retained release/device gates |

P01–P09 are checklist identifiers, not renamed historical milestones or M14 dependency IDs.

## Final platform technical disposition — 2026-10-22 (supersedes older in-progress summaries)

| Area | Actual disposition | Owner / bounded scope | Remaining dependency / required evidence |
| --- | --- | --- | --- |
| P01–P03 / M15.1 | Complete audits, scope, and accepted source reconciliation. | Lead; audit records and accepted checkpoint. | Deferred/unaccepted source remains preserved as recorded. |
| P04 | Signed first-party API authority and declared JSON capability proof pass: new-app/app-only grants, 43 route cases, 25 live staging JSON/role/revocation checks, and 10 committed-backend crypto/two-database tenant checks. | Lead; signed authority, broker, staging verifier, and backend tenant harness. | M14 app-specific rollout/public grant acceptance is separate. Media upload is deferred and denied. |
| P05 | ADR-025 lifecycle proof passes, including staging, running-version preservation, next-full-app-launch trial, health/fallback, interruption/races, and Windows update/process-exit checks. | Lead; registry, Store, runtime, and update evidence. | No remaining P05 implementation or automated-check item; independent review is cross-cutting. |
| P06 | Shell/runtime/focus/overview/scaling and installed-app identity checks pass on the final Linux/Windows evidence. All 11 installed app receipts were checked read-only. | Lead; shared shell/runtime tests and read-only profile evidence. | User visual/module and profile acceptance remains under G12/G13; no live app/browser control was used. |
| P07 | Declared non-upload workloads pass, including live staging JSON write/retry, role denial, revocation, cleanup, package bounds, multiwindow, failures, and resource checks. | Lead; workload fixtures, staging evidence, and source-bound reports. | Media upload remains deferred/denied. M14 app release acceptance is separate. |
| P08 | Complete for staging signed-feed continuity and release/operations disposition; metadata sequence 21→22 renewal and expiry recovery pass with package/registry identity unchanged. | M15 lead role; reviewed metadata-only tool, runbook, and staging report. | M20 production signing/installer/updater/support and G21 device acceptance remain later gates. |
| P09 | Final-source handoff and required automated verification pass on `8a0b07a2`; full Linux and exact-source Windows results are retained. | Lead; final source manifest, platform handoff, and evidence records. | Independent GPT-6.1 Sol Medium review remains before checklist completion; G12/G13/G15 remain open. |

Capability inventory: [first-party platform handoff](../docs/PLATFORM_APP_CAPABILITIES.md). Native print/export and patient/case cross-app deep links are unavailable, with their existing explicit adapter/ADR gates; the current baseline grants neither. Same-app module discovery remains supported. M14 app implementation does not block platform verification. No general intents/messaging, third-party publishing, local authoritative business database or hidden offline write queue is introduced.

The live JSON fixture's synthetic appointment is cancelled, synthetic doctor inactive and test login disabled; ordinary audits/identity records remain. The earlier paused media probe's own Staff is also inactive, both active media lists are empty, and its labelled synthetic patient/audit history is intentionally retained because no supported patient archive action exists. No binary transfer occurred. All production resources remain untouched.

## Active work assignments and file boundaries

**Current execution instruction — 2026-10-22:** the user directed completion of all remaining platform implementation and automated checks in the lead chat/worktree, with no further parallel sidebar tasks. The lead owns integration, API/media contracts, staging renewal preparation/execution and verification. Existing workers have delivered their assigned pieces; preserve their reports and worktrees. The previously queued sidebar review automation is paused. User manual acceptance follows technical completion and is tracked separately; do not wait for that review to finish implementation or silently close its acceptance gates. The user assigned the renewal work to the lead; do not keep asking the user to nominate people as a prerequisite to technical progress. Record actual signer custody/access and independent technical review evidence when the real publication is prepared.

P04/P05/P06 and P07/P08 were completed in separate GPT-6 Luna Extra High sidebar chats/worktrees earlier in M15; their reports and worktrees remain preserved. The user later directed that remaining implementation and integration continue in this chat and M15 worktree. The lead completed final integration and source-bound checks. The scoped platform API route/role proof passed; M14 app-specific rollout and public grant acceptance remain separate. One heavy local job runs at a time.

| Item / owner | Branch and worktree | Bounded files | Dependencies and required evidence |
| --- | --- | --- | --- |
| P04 — “M15 P04 API Authority Contract” | `codex/m15-p04-api-authority`, `/home/master-x/.codex/worktrees/5fdc/fewa_business_os`; sidebar chat `01a15fa3-6d51-7840-a43a-20a543796e73` | Proposal only; lead integrated and verified signed format-2 authority, exact grants, route/role enforcement, and staging JSON behavior | Platform proof is complete for the declared scope. M14 app-specific release/grant rollout remains separate. |
| P05 — “M15 P05 ADR-025 Update Lifecycle” | `codex/m15-p05-adr025-updates`, `/home/master-x/.codex/worktrees/92c1/fewa_business_os`; sidebar chat `01a15fa3-8b05-7712-b09a-3475e4d18ef5` | `electron/distribution/**`, package registry/runtime, Store UI and directly related update/store tests; lead integrated/reviewed candidate | Depends on M15.1 and ADR-025. Deliver staged bytes, running-version pinning, next full app launch, trial/health/recovery, truthful state, interruption and operation-race proof. |
| P06 — “M15 P06 Shell Usability and G12” | `codex/m15-p06-shell-usability`, `/home/master-x/.codex/worktrees/ae11/fewa_business_os`; sidebar chat `01a15fa3-aab7-71d2-a994-f61d2065ee54` | Shared shell/workspace/overview styles and scoped private UI tests; lead integrated/reviewed candidate | Depends on M15.1 and M12.6/G12. Automated private checks do not close user visual acceptance or device evidence. |
| P07 — “M15 P07 Representative Workloads” | `codex/m15-p07-sidebar`, `/home/master-x/.codex/worktrees/43e3/fewa_business_os`; sidebar chat `01a15fc5-dbe2-7490-92b3-d33ddf257b7b` | Worker: only `proposals/P07_WORKLOAD_MATRIX.md`. Lead: synthetic tests/evidence addendum and integration results | Depends on P04–P06 candidate source; M14 supplies app API/media needs. Worker proposal and lead execution are recorded separately. |
| P08 — “M15 P08 Release and Operations” | detached worktree `/home/master-x/.codex/worktrees/c54c/fewa_business_os` at `76c9251851a30daf8d2bed34de275cc9c0a4e3e2`; sidebar chat `01a15fc5-d9bf-73b2-aade-63e9e85225c4` | Worker: only `proposals/P08_RELEASE_OPERATIONS_DISPOSITION.md`; lead integrates checklist/M15 records and local synthetic renewal proof | Historical worker proposal delivered. Lead-owned user-authorized metadata tooling and actual staging renewal/recovery are now verified in the P08 operation report. |
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

- [x] Audit compiled app/route coupling against the [SDK/API contract](../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md) and app requirements. Specify how app-only releases can evolve approved access with explicit authority boundaries.
- [x] Record the accepted design, compatibility and approval mechanism before implementation; do not assume a route-list manifest is already approved. Preserve host-held credentials and authoritative Worker authorization.
- [x] Prove a new signed API-enabled sample and a compatible app-only API extension on an unchanged desktop, including denied undeclared requests, role/session changes and incompatible contracts.

**Evidence / decisions:** The user selected the existing signed company catalogue/update-policy authority on 2026-10-22. [ADR-026](../dental-os_v1-documentation/20_V1_ADR_REGISTER.md) and the lead-integrated format-2 exact-release grants bind version, package wire hash, payload digest and typed API operation IDs to existing company trust ceilings. Synthetic new-app, app-only extension, pre-credential denial and fallback checks pass. Final scoped proof also includes 43 route cases, 25 live staging JSON/role/revocation checks and 10 committed-backend crypto/two-database tenant checks; see the final P04 status and evidence. M14 app-specific public release/grant rollout remains separate.

## P05 — Align staged app updates with ADR-025

- [x] Compare registry, Store and runtime behavior with the [canonical install/update contract](../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md); implement only evidenced gaps.
- [x] Verify separate immutable candidate preparation, truthful pending/version UI, unchanged running code/assets/work, existing-instance focus and candidate trial on the next full launch.
- [x] Verify bounded startup health, eligible known-good fallback, no unsafe fallback under current policy, pending state across OS restart, interruption recovery, concurrent Update/Open/Close/uninstall and retention safety.

**Evidence / decisions:** The lead-integrated candidate stages immutable bytes while preserving the running lease, offers the candidate on the next full app launch, tracks active/pending/trial/known-good versions, performs health promotion and eligible fallback, and rejects the old relaunch action. Build, full serial unit and affected private UI evidence pass on `11cb1bc8`; see the P09 source manifest. Preserve prior M08/M11 evidence for its original behavior and scope; it does not certify ADR-025 automatically.

## P06 — Close integrated shell usability

- [x] Reconcile outstanding [M12/G12 work](milestone-12-os-ui-experience/PLAN.md), relevant M13 platform follow-ups and intermittent failures against the chosen source.
- [x] Verify complete installed-app journeys across launch, focus, windows, dock, explorer/module selection, minimize/restore, close, Store and lock/logout/session recovery; preserve the shared lifecycle and dock/Genie pipeline.
- [x] Complete required automated keyboard/focus, scaling, reduced-motion and error/recovery evidence; record user visual/module review afterward and retain physical-device/user acceptance separately.

**Evidence / decisions:** Integrated candidate includes focus trapping/restoration, scaling/reduced-motion adjustments and overview placement using actual managed-window bounds. Private usability, scaling and overview checks passed (10, 5 and 30 assertions respectively); the fixture setup and fullscreen geometry required corrections before pass. App-launch feedback also passed its 132-check suite on the P09 source. Broader journeys and user/profile/device evidence remain open; see M12/M15 records. G12/G13 are not closed.

## P07 — Validate representative platform workloads

- [x] Define small first-party test apps covering reads/writes, stable operation/idempotency identity, unknown outcomes, cancellation, dirty/modal close protection and app/session transitions.
- [x] Exercise needed media transport, larger assets within declared bounds, module handoff, multiple windows, failure containment and bounded resource behavior; record unsupported capabilities explicitly.
- [x] Run the agreed matrix against the actual platform with synthetic data and appropriate fixtures/staging evidence. Distinguish fixture results from real broker/runtime/Store proof; coordinate any permitted remote work under existing authorization.

**Evidence / decisions:** The declared non-upload P07 workload is complete on the final platform source. The retained matrix covers JSON reads/writes, stable-key recovery after a lost response, role/session denial, owned-record cleanup, package-size boundaries, malformed responses, multiwindow behavior, failure containment and bounded resource observations; the P09 manifest records the exact-source Linux and Windows checks. The 25-check live staging JSON report and 10-check backend tenant-isolation report are linked in the M15 evidence record. Media upload is user-deferred and denied by the current SessionManager; no upload success is claimed. Earlier backend and upload experiments remain preserved as historical evidence, including their failures and limits: [expiry/recovery](milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_BACKEND_307A21B.json), [backend](milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_BACKEND_5FB1284.json), [media read](milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_READ_9CA018CC.json), and [media upload](milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_UPLOAD_EF4E0DCD.json). M14 app implementation and public grant rollout remain separate; M20/G21 and G12/G13 are not closed here.

## P08 — Reconcile release and operations requirements

- [x] Assess [M20](milestone-20-windows-linux-release/PLAN.md) requirement by requirement: named host/architecture support, installers, desktop updater, signing custody/provenance, catalogue/trust metadata renewal, diagnostics and support/recovery procedures.
- [x] Assign each requirement to a prerequisite for the app-ready baseline, later production-release work, or an explicitly reviewed deferral; name owner, reason, dependency and acceptance gate. Implement/verify prerequisites in the agreed closeout scope.
- [x] Preserve mandatory G21 physical Windows/device and user/product acceptance before final release. Identify production promotion and other separately authorized release actions explicitly.

**Evidence / decisions:** [P08 disposition](milestone-15-platform-closeout-and-integration/proposals/P08_RELEASE_OPERATIONS_DISPOSITION.md) separates M15 staging continuity from M20 production signing/installers/updater/support and G21 device acceptance. The lead completed reviewed metadata-only tooling and the real sequence 21→22 renewal/recovery drill on `d5504845`. All 14 package objects and registry pointers stayed unchanged; anonymous/replay refusal, publisher removal and existing staging client reachability pass. See [operation evidence](milestone-15-platform-closeout-and-integration/evidence/P08_METADATA_RENEWAL_2026-10-22.json) and [runbook](../docs/STAGING_METADATA_RENEWAL.md). Build and full serial tests pass (324/324). Actual signer custody and lead execution are recorded; no human/production custody certification or authenticated Store/native UI proof is inferred.

## P09 — Integrate and verify platform baseline

- [x] Integrate reviewed platform work under the repository's authorization/integration policy; record exact final source, retained branches/evidence and any excluded changes. Coordinate app-track compatibility without absorbing unfinished M14 features.
- [x] Run required build/unit, focused private Linux UI, applicable Windows CI and affected integrated checks against the final source. Rerun affected checks when integration changes behavior; preserve failures and repairs.
- [x] Publish the supported capability inventory, handoff contracts, source/evidence identity and explicit residual release/device/app gates; align milestone status and document exactly what acceptance has been achieved.

**Evidence / decisions:** Exact-source integration, required build/unit/focused private UI/applicable Windows checks, M14 capability handoff and residual-gate register are complete on `8a0b07a2`; see [P09 manifest](milestone-15-platform-closeout-and-integration/evidence/P09_FINAL_SOURCE_MANIFEST.md) and [final Windows report](milestone-15-platform-closeout-and-integration/evidence/P09_WINDOWS_8A0B07A2_SUCCESS.json). Independent GPT-6.1 Sol Medium review remains before checklist completion. This is not G15 closure.


- [ ] Complete independent GPT-6.1 Sol Medium review of actual final source/evidence, fix findings and rerun affected checks before declaring the checklist complete. Reviewer packet is prepared; this is not a completed independent review.

## Completion and remaining acceptance

- [x] Every work area has an evidence-backed technical disposition; media upload has user-reviewed deferral, owner and future acceptance gate. The declared non-upload implementation and automated checks have no unresolved failure.
- [x] The final combined source supports the declared install/runtime/session/API/update/shell capabilities and passes its required automated checks; independent verification remains below.
- [x] Record the exact verified platform baseline, supported contracts and remaining app-release dependencies for M14 consumption; functional app acceptance and public API-grant rollout remain separate. No message to another chat is claimed.
- [x] The closeout report distinguishes declared platform integration capabilities from production release readiness, retaining M20/G21 and operational requirements.
- [ ] Independent verification and finding fixes complete; only then declare the checklist complete. User manual review follows technical verification.

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

**Historical status at the M15.1 checkpoint:** the user approved the reviewed scope and P03 was complete for documentation. M15.1 accepted only the managed-app launch-feedback/native-frame handoff group, recorded at `ad3fa6a10437bf58606631325d93f6b3cc0369b5`; other original-checkout inputs were preserved or deferred. At that point P04–P09 were still pending. The final 2026-10-22 disposition is recorded above and in [M15 status](milestone-15-platform-closeout-and-integration/STATUS.md).

### M15.1 completion and next execution boundary

M15.1's accepted source checkpoint is source-bound to build, unit, private runtime and managed-app launch feedback evidence; its dated M12/M13 coordination addenda preserve the remaining G12/G13 obligations. This paragraph records M15.1 provenance only; later implementation and final verification are recorded in the dated addenda and current status above. The original dirty M13 checkout, P03 worker worktrees and unaccepted files remain preserved.

## Approved media-upload deferral — 2026-10-22

The user explicitly paused media uploads and directed completion of the remaining platform baseline first. The lead owns this revised scope in the current chat/worktree. Retain ADR-029 implementation, local synthetic evidence, backend branch, failed live attempt and all worktrees. Media upload is excluded from the current app-ready capability inventory and denied by the real SessionManager even if a signed release requests it. No public upload grant was published. Re-enablement requires a later reviewed media capability task proving actual staging transfer, outcome/recovery, role/tenant boundaries and support cleanup. This deferral does not defer ordinary JSON writes, API authority, update safety, shell checks or final source verification.

The staging backend snapshot `af4faf3` was deployed as version `1d3ec32d-fe06-425f-9d14-6008fc17a9df`; health and existing bindings passed. The private probe created one labelled synthetic patient and Staff record. Intent creation returned 500 before binary transfer; null capture-date validation mismatched the existing NOT NULL schema. Candidate validation corrections and a new backend schema regression remain preserved, uncommitted and paused; they are not a deployed fix or acceptance. Synthetic-record reconciliation remains a bounded cleanup task. No production operation occurred.

At the time of the media deferral, the remaining sequence included staging JSON proof, final update/shell checks, Windows verification, and the capability handoff. The final automated result below supersedes that interim list. Media upload remains deferred; user/manual gates and M20/G21 remain separate.

**Final Linux workload batch:** all planned package/workspace/hardening/resource/recovery/onboarding/distribution/arrival/launch checks pass; retained manifest and M15 records list exact counts and limits. P09 now focuses on exact-source Windows validation and review/record alignment.

## Final automated result — 2026-10-22

Full Windows run [39729298294](https://github.com/Business-It-Partners/dental-os/actions/runs/39729298294) **PASSES** on exact source `8a0b07a2`: docs/build, 433 unit passes/four explicit platform skips, all first-party shell checks, runtime 48, hardening 22, recovery 3, resource 5/max-app resource 5, integration 26, update process exits 12, updates 18, distribution 10, package process exits 8/packages 8, host 4, SDK 16 and identity 44. Linux build/437 units and the full selected private workload matrix also pass. [Source-bound report](milestone-15-platform-closeout-and-integration/evidence/P09_WINDOWS_8A0B07A2_SUCCESS.json).

**P01–P08: evidence-backed technical dispositions complete for the declared non-upload scope. P09: implementation/automated verification/handoff complete; independent review pending.** The checklist and G15 are not declared complete until that review and finding fixes are recorded. User manual/module review follows technical verification; M20/G21 remain explicit. No public API-grant rollout or M14 functional-app acceptance is inferred.
