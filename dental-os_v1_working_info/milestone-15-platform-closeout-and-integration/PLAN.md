# M15 Plan — Platform Closeout and Integration

**Status:** IMPLEMENTING — planning/P03 only. No M15 runtime work or acceptance is complete.
**Updated:** 2026-10-21.
**Dependencies:** Preserve M01–M11 verified scope; reconcile M12/G12 and M13/G13 residuals. M14 app implementation continues in parallel. Integrated G14 acceptance depends on a verified M15 baseline. M20/G20 and G21 remain later release/device gates.
**Requirements:** R01–R13 and R15, limited to the app-ready portions mapped to G15 in the architecture traceability matrix. R14 production platform release/update/support proof remains M20/G20/G21.
**Exit gate:** G15 — Platform closeout and integration proof. It does not waive G12 or G13.
**Authority:** [central reconciliation checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md), [M01–M11 evidence audit](../audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](../audit-reports/SHELL_RELEASE_AUDIT.md), and [API/update gap audit](../audit-reports/API_UPDATE_GAPS.md).

## Outcome

Reconcile the committed M13 platform candidate and reviewed local inputs, close the remaining shared-platform contracts and shell gates, then verify one exact integrated baseline that M14 can use for app acceptance. M15 establishes app-integration readiness for the declared scope; it does not certify production release, supported customer hosts, or final device acceptance.

## Source layers to preserve

- Last integrated verified milestone: `main` at M11 merge `8c8211c00614b095c529d9d14964ca2ce912db73`.
- Committed closeout candidate: M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.
- The authoritative original checkout also contains unintegrated product/runtime/test/evidence inputs. They are review candidates only; this plan does not treat their source changes or test reports as accepted or bind them to the M13 commit.
- Preserve M01–M11 records and the existing M12/G12, M13/G13, M14/G14, M20/G20 and G21 ownership. Do not repeat completed milestone work or merge older history wholesale.

## Work phases

| Phase | Scope | Exit evidence |
| --- | --- | --- |
| **M15.1 — Source and record reconciliation** | Review the committed M13 candidate and each relevant local delta; record integrate/preserve/supersede/defer dispositions; correct stale milestone summaries with dated addenda; bind the eventual baseline to exact source. | Reviewed source inventory, per-delta disposition, preserved history and corrected record pointers. No uncommitted input is implicitly included. |
| **M15.2 — Versioned app authority and required host contracts** | Resolve the evidence-backed M14 API-permission, private-media, payload-budget and cross-app navigation needs. Specify approval/compatibility and host enforcement before implementation; retain Worker authority and host-held credentials. | Accepted versioned contract/ADR and positive/negative proof for a genuinely new approved API-enabled sample and a compatible app-only API extension on the same unchanged desktop; bounded media/navigation tests for the documented M14 requests; current limits measured before any versioned change. This phase does not select a route-manifest or permission-policy design during P03. |
| **M15.3 — ADR-025 app-update alignment** | Align the Store/runtime with the accepted staged-update target: prepare immutable bytes without disturbing running work, then trial on the next full launch of that app with eligible policy-valid recovery; no Dental OS restart is required solely for an app update. | Source-bound normal Store/Open/Close, version truth, health/trial/recovery, dirty and unknown-write, cancellation/interruption and Update/Open/Close/uninstall race evidence. Preserve original operation identity. App-package update behavior remains separate from the M20 platform updater. |
| **M15.4 — Integrated shell and G12/G13 residuals** | Complete M12.6/G12 accessibility, fit and end-to-end workspace proof; close the specific M13/G13 profile and module-review items. Preserve the shared window, dock, overview, explorer and Genie lifecycle. | Owning M12/M13 records close their gates using exact source and user/profile evidence as applicable. G15 cannot be marked complete while G12 or G13 is open, absent an explicit user-approved scope change recorded in those gate authorities. |
| **M15.5 — Representative workload and operational continuity** | Exercise synthetic app workloads across API reads/writes, stable operation identity, media, navigation, multiwindow, sessions, recovery and resource limits. Name a staging-feed metadata renewal operator and rehearse safe renewal/expiry recovery. | Measured workload/failure matrix, exact test-environment inventory, resource results, metadata-only higher-sequence renewal and expiry-recovery evidence. Label development/CI environments separately from the future M20 product support matrix. |
| **M15.6 — Integrated platform baseline** | Integrate only reviewed platform changes and verify their combined behavior. Publish a precise M14 handoff and remaining release/device register. | Exact final source/tree and evidence manifest; required build, unit, focused private Linux, applicable Windows CI and integrated checks pass; G12/G13 are separately verified; G15 is closed in its owner record; M14 receives the exact baseline and unresolved app-specific dependencies. |

## Acceptance criteria

- [ ] M15.1 records a reviewed disposition for every in-scope source layer and retains M01–M11 historical evidence without relabeling it as final combined-source proof.
- [ ] M15.2 documents the approved API authority, required media/payload limits and any cross-app navigation contract with explicit negative cases and a host-enforcement boundary.
- [ ] R13 remains unchanged: no general app-to-app messaging, arbitrary intent bus, direct app invocation or shared app store is introduced. Any cross-app need is assessed as bounded OS-owned navigation/selection under an explicit later contract/ADR; P03 approves no design.
- [ ] M15.3 aligns normal update behavior with ADR-025 and proves staging, next-full-launch trial and eligible recovery without losing running work or retrying revoked/incompatible packages.
- [ ] M15.4 closes the existing G12 and G13 residuals in their respective records; the M15 gate does not silently waive them.
- [ ] M15.5 measures only synthetic representative data, records bounded failures/resources, names an operator for staging metadata continuity, and makes no customer host-support promise from CI runners.
- [ ] M15.6 binds all required checks to the same final integrated source and states remaining M20/G20/G21 and app-specific gates.
- [ ] G15 is verified only after every criterion and its dependencies are satisfied; M14 implementation remains separate, and integrated G14 uses the verified M15 baseline.

## Contract boundaries for M15.2/M15.5

The M14 dependency register at `codex/milestone-14` source `48c18401cada192bfa0bea02a4afdd0cb10e45ca` names the current evidence-backed needs. Scope M15 to those requests:

- **API authority:** the current host policy is compiled. M11 generic package onboarding is not independent evolution of clinic API grants. Define who approves a grant, how host enforcement and the existing Worker authority compose, and compatibility/denial behavior; do not accept arbitrary app self-authorization.
- **Private media:** Patient Record and Staff's documented needs are host-mediated private upload/download. Verify MIME, size, checksum, authorization, tenant isolation, interrupted-transfer cleanup, and renderer credential secrecy. Existing notes identify a 10 MiB Worker upload and an 8 MiB current blob-read limit; measure actual synthetic payload needs before proposing any versioned adjustment.
- **Cross-app links:** evaluate only the documented patient/case navigation need. Preserve source dirty/modal work; independently authorize the destination; handle absent/denied destinations; keep identifiers out of sensitive URL state. The desired boundary is an OS-owned navigation flow, not a general app-to-app communication system. R13 remains in force.
- **Payload budgets:** measure sanitized M14 app cases against the current 12,000-character JSON body, 16 KiB request envelope, 256 KiB response, and 8 MiB blob-read bounds. Prefer measured pagination/chunking or an explicitly versioned approved change; never silently raise caps.
- **Print/export:** decide only from a concrete V1 app inventory and host constraints. The current unavailable adapter is not permission to invent an app-to-host escape path.

No solution format for route manifests, app API policies, media intents or cross-app navigation is chosen by this planning record. M14 remains responsible for app UI and workflow adapters; platform authority stays in the trusted host/broker.

## Environment and release boundaries

Observed development/verification environments in the audit records include local Ubuntu 22.04.5 x86_64 under private GNOME/Wayland and hosted Ubuntu 24.04 / Windows Server 2022 jobs where applicable. These identify where prior checks ran; they are not a product support matrix. M20 owns the named customer Windows/Linux matrix, signed platform installers/updater and release operations. G20 remains separate, and physical Windows/device/user acceptance G21 remains mandatory after M20 and before final release.

## Execution and evidence rules

M15.1 precedes source integration. Freeze M15.2/M15.3 contracts before parallel code changes; avoid overlapping files and have the lead own shared-file integration. M15.5 tests the combined platform path and M15.6 performs final integration. Run one heavy local build/test job at a time under the repository's resource policy. Keep private UI checks on the guarded private display. No live-profile access or app worktree edits are part of this planning phase.

Every later acceptance record must state exact source/tree, profile/environment, command or manual procedure, outcomes, failed attempts and repairs, and limits. Staging evidence must retain resource/environment identity without secrets; no production change follows from this plan. App fixtures and media payloads are synthetic.

## Boundaries and exclusions

M15 is not a general extension/API platform, arbitrary messaging/intent system, clinical app implementation, local business database, offline write queue, production migration, installer/updater certification, customer-host support promise, production promotion, or final device acceptance. M20/G20 and G21 retain their owners and acceptance.


## Worktree output cleanup

After a worktree task is complete and required evidence is retained, remove only its unnecessary task-generated build outputs. Preserve source, reports, commits and evidence; never delete the user's live build or unrelated checkout outputs. P03 is documentation-only and produces no build output or dependency installation.
