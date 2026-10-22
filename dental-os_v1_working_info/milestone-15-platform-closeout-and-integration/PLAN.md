# M15 Plan — Platform Closeout and Integration

**Status:** P01–P09 technical implementation and required automated checks are complete for the previously agreed baseline. The local candidate has a narrow normal SessionManager upload gate for the two approved first-party app/media-kind pairs, in addition to exact signed-grant and app-capability checks in the broker. Focused/full local checks pass, and a current-source private Dock staging run passed real upload/readback/withdrawal through that gate. The broader media matrix and any public app grant remain open. Independent verification remains before checklist completion. G12/G13 user/profile acceptance and formal G15 closure remain open.
**Updated:** 2026-10-22.
**Dependencies:** Preserve M01–M11 verified scope; reconcile M12/G12 and M13/G13 residuals. M14 app implementation continues in parallel. Integrated G14 acceptance depends on a verified M15 baseline. M20/G20 and G21 remain later release/device gates.
**Requirements:** R01–R13 and R15, limited to the app-ready portions mapped to G15 in the architecture traceability matrix. R14 production platform release/update/support proof remains M20/G20/G21.
**Exit gate:** G15 — Platform closeout and integration proof. It does not waive G12 or G13.
**Authority:** [central reconciliation checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md), [M01–M11 evidence audit](../audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](../audit-reports/SHELL_RELEASE_AUDIT.md), and [API/update gap audit](../audit-reports/API_UPDATE_GAPS.md).

## Outcome

Reconcile the committed M13 platform candidate and reviewed local inputs, close the remaining shared-platform contracts and shell gates, then verify one exact integrated baseline that M14 can use for app acceptance. The user selected the existing signed company catalogue/update-policy authority for release-scoped first-party API grants; ADR-026 and format-2 exact grants record that decision. M15 establishes app-integration readiness for the declared scope; it does not certify production release, supported customer hosts, or final device acceptance.

## Source layers to preserve

- Last integrated verified milestone: `main` at M11 merge `8c8211c00614b095c529d9d14964ca2ce912db73`.
- Committed closeout candidate: M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.
- The authoritative original checkout remains dirty on `codex/milestone-13` and contains unintegrated inputs. M15.1 reviewed and accepted only the managed-app launch-feedback/native-frame handoff source/test slice, checkpointed at `ad3fa6a10437bf58606631325d93f6b3cc0369b5`; each other disposition is recorded in IMPLEMENTATION_NOTES.md. The original checkout itself remains unchanged.
- Preserve M01–M11 records and the existing M12/G12, M13/G13, M14/G14, M20/G20 and G21 ownership. Do not repeat completed milestone work or merge older history wholesale.

## Work phases

| Phase | Scope | Exit evidence |
| --- | --- | --- |
| **M15.1 — Source and record reconciliation** | Review the committed M13 candidate and each relevant local delta; record integrate/preserve/supersede/defer dispositions; correct stale milestone summaries with dated addenda; bind the eventual baseline to exact source. | Reviewed source inventory, per-delta disposition, preserved history and corrected record pointers. No uncommitted input is implicitly included. |
| **M15.2 — Versioned app authority and required host contracts** | Resolve platform API authority and declared JSON compatibility; verify supported bounded media reads and payload limits; route Patient Record/patient-media and Staff/staff-document uploads through the normal trusted-session gate plus exact signed release authority; keep cross-app navigation unavailable behind its ADR gate. Retain Worker authority and host-held credentials. | Exact signed authority and positive/negative proof for a new approved API-enabled sample and compatible app-only API extension on the unchanged desktop; route/role/session and tenant checks; bounded read/payload evidence; current-source staging upload/readback plus recovery and cleanup proof; explicit navigation gate. No public media grant until the remaining media acceptance passes. |
| **M15.3 — ADR-025 app-update alignment** | Align the Store/runtime with the accepted staged-update target: prepare immutable bytes without disturbing running work, then trial on the next full launch of that app with eligible policy-valid recovery; no Dental OS restart is required solely for an app update. | Source-bound normal Store/Open/Close, version truth, health/trial/recovery, dirty and unknown-write, cancellation/interruption and Update/Open/Close/uninstall race evidence. Preserve original operation identity. App-package update behavior remains separate from the M20 platform updater. |
| **M15.4 — Integrated shell proof and G12/G13 handoff** | Complete the platform's automated accessibility, fit, workspace, shell, and runtime checks while preserving the shared window, dock, overview, explorer, and Genie lifecycle. Keep user/profile acceptance under the M12/G12 and M13/G13 owner records. | Final-source Linux/private and applicable Windows evidence passes. User visual/module/profile acceptance remains a separate owner gate; G15 cannot be closed while G12/G13 are open unless their owners record an explicit approved scope change. |
| **M15.5 — Representative workload and operational continuity** | Exercise synthetic workloads across supported API reads/writes, stable operation identity, sessions, recovery, multiwindow, larger bounded assets, failures, and resource limits. Complete the media size, interruption/recovery, tenant-negative and cleanup matrix before app release grants. Assign staging-feed continuity to the M15 lead role and rehearse safe renewal/expiry recovery. | Measured workload/failure matrix, exact environment inventory, resource results, media boundary/recovery/tenant evidence, metadata-only higher-sequence renewal and expiry-recovery evidence. CI environments are not a customer support matrix. |
| **M15.6 — Integrated platform baseline** | Integrate reviewed platform changes, verify combined behavior, publish the precise app-ready handoff, and list remaining user, app-release, and device gates. | Exact final source/tree and evidence manifest; required build, unit, focused private Linux, applicable Windows CI, and integrated checks pass; M14 receives the baseline and app-specific boundaries; G12/G13/G15, M20/G20, and G21 remain explicitly tracked until their owners accept them. |

## Acceptance criteria

- [x] M15.1 records a reviewed disposition for every in-scope source layer and retains M01–M11 historical evidence without relabeling it as final combined-source proof.
- [x] M15.2 records the approved API authority, route/role/session and tenant checks, supported read/payload bounds, upload deferral, and navigation gate with host-enforced negative cases.
- [x] R13 remains unchanged: no general app-to-app messaging, arbitrary intent bus, direct app invocation, or shared app store was introduced. Any future cross-app navigation remains behind a separate explicit contract/ADR.
- [x] M15.3 aligns normal update behavior with ADR-025 and proves staging, next-full-app-launch trial and eligible recovery without losing running work or retrying revoked/incompatible packages.
- [ ] M15.4 user visual/module/profile evidence must close the existing G12/G13 residuals in their owner records; automated platform checks pass, and the M15 gate does not waive those obligations.
- [x] M15.5 measures synthetic representative data, records bounded failures/resources, assigns staging continuity to the M15 lead role, and makes no customer host-support promise from CI runners.
- [x] M15.6 binds required automated checks to the exact final integrated source and states remaining M14, M20/G20, G12/G13 and G21 gates.
- [ ] G15 is verified only after independent review and all required owner gates/dependencies are satisfied; M14 implementation remains separate, and integrated G14 uses the verified M15 baseline.

## Contract boundaries for M15.2/M15.5

The M14 dependency register at `codex/milestone-14` source `48c18401cada192bfa0bea02a4afdd0cb10e45ca` informed the original scope. Final M15 disposition is limited to declared platform capabilities; M14 app implementation/public release acceptance remains separate:

- **API authority:** the current host policy is compiled. M11 generic package onboarding is not independent evolution of clinic API grants. Define who approves a grant, how host enforcement and the existing Worker authority compose, and compatibility/denial behavior; do not accept arbitrary app self-authorization.
- **Private media:** bounded host-mediated reads are implemented and verified. The local SessionManager allows only the exact Patient Record/patient-media and Staff/staff-document pairs under clinic permissions; the broker also requires the exact signed grant. A private staging Dock fixture uploaded/read back a real JPEG and withdrew its record. A separate real staging acceptance passed both SaaS size caps and readback, cap-plus-one rejection before credentials/network, same-clinic fresh-session recovery after a lost patient content response, and Staff finalise-response reconciliation. A two-clinic negative test denied synthetic record and withdrawn-media reads and rejected both upload intents before bytes; active-file cross-clinic byte denial is still untested. See the dated media evidence in `VERIFICATION_EVIDENCE.md`. SaaS-owned file retention/deletion is outside the OS release gate; no public media grant exists.
- **Cross-app links:** no cross-app navigation capability is granted. Any later patient/case navigation need requires a separate ADR and must preserve dirty/modal work, independently authorize the destination, handle absent/denied destinations, and keep identifiers out of sensitive URL state. R13 remains in force.
- **Payload budgets:** measure sanitized M14 app cases against the current 12,000-character JSON body, 16 KiB request envelope, 256 KiB response, and 8 MiB blob-read bounds. Prefer measured pagination/chunking or an explicitly versioned approved change; never silently raise caps.
- **Print/export:** decide only from a concrete V1 app inventory and host constraints. The current unavailable adapter is not permission to invent an app-to-host escape path.

No solution format for route manifests, app API policies, media intents or cross-app navigation is chosen by this planning record. M14 remains responsible for app UI and workflow adapters; platform authority stays in the trusted host/broker.

## Environment and release boundaries

Observed development/verification environments in the audit records include local Ubuntu 22.04.5 x86_64 under private GNOME/Wayland and hosted Ubuntu 24.04 / Windows Server 2022 jobs where applicable. These identify where prior checks ran; they are not a product support matrix. M20 owns the named customer Windows/Linux matrix, signed platform installers/updater and release operations. G20 remains separate, and physical Windows/device/user acceptance G21 remains mandatory after M20 and before final release.

## Execution and evidence rules

M15.1 preceded source integration. The user later directed that remaining implementation and integration continue in the lead chat/worktree without new parallel chats. Heavy local jobs were serialized and private UI checks used the guarded private display. Read-only profile evidence and all source/test limits are recorded in the M15 status and evidence records; no app feature work was absorbed from M14.

Every later acceptance record must state exact source/tree, profile/environment, command or manual procedure, outcomes, failed attempts and repairs, and limits. Staging evidence must retain resource/environment identity without secrets; no production change follows from this plan. App fixtures and media payloads are synthetic.

## Boundaries and exclusions

M15 is not a general extension/API platform, arbitrary messaging/intent system, clinical app implementation, local business database, offline write queue, production migration, installer/updater certification, customer-host support promise, production promotion, or final device acceptance. M20/G20 and G21 retain their owners and acceptance.


## Worktree output cleanup

After a worktree task is complete and required evidence is retained, remove only its unnecessary task-generated build outputs. Preserve source, reports, commits and evidence; never delete the user's live build or unrelated checkout outputs. P03 is documentation-only and produces no build output or dependency installation.

## Earlier approved media-upload deferral — 2026-10-22 (superseded)

At this checkpoint, the user paused media uploads and directed completion of the remaining platform baseline first. That deferral was later superseded when the user resumed media-capability work. At that time, media upload was excluded from the app-ready inventory and denied by the real SessionManager. No public upload grant was published. The current local gate and remaining acceptance are recorded in the status above and the dated implementation/evidence addenda. This paragraph preserves the earlier decision point.

The user later resumed a basic synthetic staging probe. That probe passed through the private Dock fixture, real staging sign-in, host broker, Worker and R2 readback; the test media was withdrawn and the synthetic patient retained for audit. The staging Worker validation correction was deployed after exact-source/binding review. This probe predates the normal-session gate added to the local candidate. The public-feed grant boundary remains unchanged. The probe does not complete the broader media acceptance matrix or enable public media uploads for M14 releases.

### Earlier deferral-stage attempt (historical)

The staging backend snapshot `af4faf3` was deployed as version `1d3ec32d-fe06-425f-9d14-6008fc17a9df`; health and existing bindings passed. That earlier private probe created one labelled synthetic patient and Staff record. Intent creation returned 500 before binary transfer because null capture-date validation mismatched the existing NOT NULL schema. A later local Worker correction fixed that validation and was deployed to staging under commit `bdc70ed`; the new acceptance is recorded in the current status/evidence. The earlier synthetic Staff record was inactivated after exact ownership checks; the labelled patient/audit history remains retained. No production operation occurred.

At that earlier checkpoint, the remaining platform sequence included real staging ordinary writes/stable retries and role/tenant boundaries, source-bound ADR-025 and shell checks, Windows regression disposition, and final capability handoff. At that checkpoint the media limits and fresh-session recovery were also pending; the later dated evidence supersedes those items. Current OS media residuals are active-file cross-clinic denial and upload failure cases. SaaS owns file retention/support cleanup. M14 app code and user manual review do not block platform implementation. M20/G21 production/device obligations remain separate. No checklist or G15 closure is claimed by this scope change.
