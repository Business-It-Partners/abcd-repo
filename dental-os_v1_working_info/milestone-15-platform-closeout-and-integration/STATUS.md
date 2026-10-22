# M15 Status — Platform Closeout and Integration

**Status:** VERIFYING — P01–P05 and P08 have evidence-backed dispositions. All declared non-upload Linux/local/live-staging checks pass; P06/P07 await final exact-source Windows/source review under P09. Media upload is explicitly deferred and real-session denied. User manual review follows technical verification. G15 is not yet closed.
**Updated:** 2026-10-22.
**User scope review:** the user accepted the proposed M15.1–M15.6 scope and directed that it be formalized. This records scope authorization, not runtime acceptance.
**Integration branch:** `codex/milestone-15` in the lead `platform-closeout` worktree; milestone-record worker branch `codex/m15-plan-records`, created from committed M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.
**Gate:** G15 — closeout and integrated-baseline proof. The lead integrated the distinct G15 row, requirement mappings and checker changes; this planning checkpoint does not close G15.

**Latest:** media upload deferred and denied in real sessions; non-upload implementation and Linux/local/live-staging verification pass within the evidence scopes below. Final workload/Windows/source-review work continues. User manual acceptance follows technical verification.

## Current position

The M11-integrated `main` remains the last integrated verified milestone. M15.1 reviewed the committed M13 candidate, original-checkout local deltas, side-branch ancestry and preserved P03 worker worktrees. Only the managed-app launch-feedback/native-frame handoff slice was accepted; its source and evidence checkpoint is `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. Other original inputs remain preserved or deferred, as itemized in IMPLEMENTATION_NOTES.md. M01–M11 retain their exact recorded scope; prior results are not relabeled as final combined-source proof.

The central [platform reconciliation checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) records P01/P02 audits and the accepted M15 proposal. The [milestone evidence audit](../audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](../audit-reports/SHELL_RELEASE_AUDIT.md), [API/update audit](../audit-reports/API_UPDATE_GAPS.md), and [source baseline](../audit-reports/SOURCE_BASELINE.md) are supporting read-only inputs. The lead integration includes the checklist and audit reports; runtime source layers remain separately identified.

## Phase tracking

| Phase | Status | Remaining evidence |
| --- | --- | --- |
| M15.1 — Source and record reconciliation | IMPLEMENTED — accepted source checkpoint | Reviewed local inputs and side branches; integrated only the accepted launch-feedback/frame-handoff slice; retained unaccepted inputs; corrected dated M12/M13/M15 records. |
| M15.2 — Versioned app authority and required host contracts | TECHNICAL PROOF PASSES for declared non-upload scope; signed grants/JSON authority/live roles and source-level tenant boundaries verified; explicit unsupported capability inventory published | Final Windows/source review under M15.6. Upload is user-deferred; print/export/deep navigation have no approved adapter/ADR. |
| M15.3 — ADR-025 app-update alignment | LINUX TECHNICAL PROOF PASSES; staged/running/next-launch/trial/health/fallback/race and process-exit evidence retained | Final Windows/source review under M15.6; M20 desktop updater remains separate. |
| M15.4 — Integrated shell and G12/G13 residuals | LINUX TECHNICAL PROOF PASSES; all 11 installed package/asset/known-good receipts verified read-only | Final workload/Windows checks under M15.6; user visual/module/device acceptance remains separate. |
| M15.5 — Representative workload and operational continuity | Non-upload live JSON/role/recovery and staging feed continuity proof pass; final private batch running | Final batch and M15.6 review; upload re-enablement requires later actual staging/recovery proof. |
| M15.6 — Integrated platform baseline | IN PROGRESS — lead candidate build, full serial unit suite, focused private UI and integrated regressions pass; the reported M14 Windows dock-edge runtime failure is unresolved and independent review remains | Commit exact integrated source/evidence, run final source-bound checks, reconcile the M14 Windows failure on the exact platform branch when applicable CI is available, publish M14 handoff and residual gate register, and prepare independent GPT-6.1 Sol Medium review. G12/G13/G15 remain open. |

## Dependency and gate position

- M01–M11 are historical verified dependencies for their documented scope. Reuse their implementation/evidence; repeat only checks affected by the final integration.
- M12 remains IMPLEMENTING and G12 open until M12.6 and its owning acceptance evidence close.
- M13 remains IMPLEMENTING and G13 open until the Follow-ups health receipt and Finance/Lab Tracker 1.0.1 install/module review are resolved in the M13 record.
- M14 app implementation proceeds as a separate parallel track. Its test-only mocks may support development; integrated G14 acceptance uses the exact verified M15 baseline and the app track's own acceptance evidence.
- M20/G20 host installer/updater/operations scope is not absorbed into M15. G21 physical-device and final user/product acceptance remains after M20.
- G15 is open and cannot be marked verified while G12 or G13 remains open unless the user explicitly approves a scope change recorded by those gate owners.

## Not claimed

The accepted launch-feedback/frame-handoff source and current P04–P06 candidate checks do not close any full milestone gate. ADR-026's signed company update-policy authority and format-2 exact grant path are implemented and synthetically tested; they do not resolve M14's full per-app route/role inventory, bounded media contract, cross-app navigation design gate or app-side compatibility. No media adapter, live Worker workload acceptance, M12/G12 or M13/G13 closure, M14/G14 app acceptance, M20/G20 release acceptance, or G21 device/user acceptance is claimed. P08 staging metadata renewal/recovery is verified for the public signed feed and core registry scope; authenticated Store/native UI acceptance remains separate. No production mutation, main merge, deployment or live application restart occurred. P03 and M15.1 historical evidence remains separately scoped in VERIFICATION_EVIDENCE.md.


## P03 integrated documentation verification

The lead combined both sidebar worker outputs and aligned the central checklist, roadmap, requirements/gates and affected M12/M13/M14/M20 coordination records. The documentation checker passes for the full combined set (16 milestones, 64 required records, 17 gates); Python syntax and Git whitespace checks pass. G15 remains open. See [verification evidence](VERIFICATION_EVIDENCE.md). Worktree output inspection found no generated build outputs to delete; no dependencies or builds were created for P03.


## Current lead-only completion checkpoint — 2026-10-22

The user directed all remaining implementation and automated verification to continue in this chat/worktree, with manual acceptance afterward. P08 is now verified for staging-feed continuity: actual expired sequence-21 controls were renewed to sequence 22 using unchanged signed authority; all 14 package objects and the disposable synthetic known-good registry remained unchanged. Anonymous/replay denial and deletion of the temporary publisher were verified; staging API and existing web clients remain reachable. See [retained operation evidence](evidence/P08_METADATA_RENEWAL_2026-10-22.json) and [runbook](../../docs/STAGING_METADATA_RENEWAL.md). Source checkpoint `d5504845` passes build and 324/324 unit tests. Historical unassigned-operator/no-tool/no-drill statements below earlier checkpoints no longer describe this P08 state. P04 exact M14 routes, media/navigation contracts and P07 integration remain the next technical work.


## API contract checkpoint — `7420a898`

P04 now has exact app/method/path/query rules and trusted capability checks under ADR-027/SDK 1.2, with exact signed package authority. Build, 367/367 full unit tests, 43 clinic-contract cases, private SDK 15 and identity 44 assertions pass. Real Worker/M14 adapter proof and media remain open. The user assigned further implementation/verification here; no parallel chat/worktree is active.


## Media backend safety checkpoint — 2026-10-22

The lead reused the existing SaaS backend checkout sequentially on `codex/sys-0009-mediated-media`, based on verified staging `1268bb3`. Reviewed source checkpoint `5fb1284` adds creator-scoped pending-upload cancellation, exact tenant object-key checks, bounded stream reads, late-PUT cleanup and conditional finalise/audit transitions. Replacement cancellation cannot withdraw the original X-ray. Existing unrelated SYS-0008 publisher files remain byte-for-byte unchanged and excluded from this commit.

Worker typecheck passes. The full serial Worker suite passed 481/481 (53 files), including 39 new SQLite-backed media cases; after two additional route-auth cases, the affected auth matrix passed 143/143 and final typecheck passed. The full run also included five unrelated publisher tests without approving their source. [Source/check manifest](evidence/P07_MEDIA_BACKEND_5FB1284.json) records the exact checks and limits. No service deployment, live clinical writes, app restart, new chat/worktree or persistent generated build output occurred.

This is a reviewed backend slice, not completed P07: intent expiry and abandoned-transfer recovery, typed host upload/download/checksum transport and actual Worker/D1/R2/role/tenant acceptance remain. M14 app UI stays separate. P04 JSON already permits Work Entry's media metadata list; private binary transport remains unavailable. P05/P06 final combined checks, the reported Windows dock-edge issue and P09 handoff also remain open. The lead continues implementation here; user manual acceptance follows technical verification.


## Media expiry/recovery checkpoint — `307a21b`

The reviewed backend follow-up enforces the advertised five-minute upload-intent expiry, including a cutoff inside finalise SQL. Creator-scoped authenticated discovery returns at most 20 expired/cleanup-pending upload identifiers without storage keys or clinical text. Failed deletion of a late cancelled PUT remains discoverable for retry. Staff discovery retains `staff.manage`.

Final Worker typecheck and full serial suite pass **495/495 across 54 files**, including **49 media** and **145 route-auth** cases. [Source/check manifest](evidence/P07_MEDIA_BACKEND_307A21B.json) records synthetic storage limits and unchanged excluded publisher inputs. No deployment occurred; all test processes completed and no generated build output was created. The OS host adapter, actual D1/R2/role/tenant/stable-retry proof and support disposition for creators who never return remain open. P07/P09 and runtime gates are not closed. This work continues in the lead chat; manual user acceptance remains afterward.


## Typed media read and staging identity checkpoint — `9ca018cc`

ADR-028/SDK 1.3 adds exact signed `clinic.media.read` authority, typed UUID/kind inputs, fresh host-fetched authenticated metadata and size/MIME/SHA-256 verification. Patient Record/Work Entry patient reads are bounded to 10 MiB; Staff-document reads to 25 MiB. One active read per registration/two broker-wide, 30-second deadline, session/grant/cancel fences and host-held credentials remain enforced. Legacy blob remains denied; JSON/envelope bounds are unchanged.

The complete build passes. Full serial unit command with `--testTimeout=15000` passes **397/397**, including **29 media cases**. Private SDK **16**, identity **44**, and a dedicated native fixture **2** checks pass; the latter transfers exact 10/25 MiB files through actual sandboxed appPreload, IPC and ApiBroker with synthetic metadata/object responses. The supplied staging account also passes **7 read-only checks**, including real sign-in/session and Follow-ups transport through the broker. No clinical payload or credential is retained; no writes or production requests occur. Synthetic registration authority does not certify public signed-grant or live media integration.

[Source/check manifest](evidence/P07_MEDIA_READ_9CA018CC.json) retains preliminary build/test failures and repairs: deterministic Store cancellation/deadline tests; a default five-second update-test timeout resolved by the explicit bounded 15-second unit budget; and native-fixture module loading corrected before its pass. These are scoped results, not checklist closure. Mediated uploads/recovery, real staging write/media/role/tenant cases, support cleanup, navigation/print-export decisions, Windows issue and final P09 verification remain.


## Mediated upload checkpoint — `ef4e0dcd`

ADR-029/SDK 1.4 implements host-owned begin/chunk/commit/cancel, host SHA-256 and fixed intent/content/finalise/abort routes. Exact signed operation/app/session authority remains required. Buffers are bounded to two registrations with unchanged 10/25 MiB domain limits; 8 KiB chunks retain the 16 KiB request envelope. Patient replacement uses only the existing reviewed backend route. Explicit original-key retries reconcile unknown responses, and bounded terminal receipts recover a lost SDK result without another mutation. Buffered/unknown transfers participate in close/update safety; unsent cancellation performs no credential acquisition or network request. No local business DB, disk transfer or automatic write queue is introduced.

Build and **427/427 serial unit tests across 24 files** pass, including **30 upload** and **29 read** cases. On the checkpoint, private SDK **16**, identity **44**, media-read **2** and media-upload **2** checks pass. Native 10/25 MiB uploads run through the actual sandboxed preload/IPC/ApiBroker; the Staff case drops the finalise response and confirms the same committed file with exactly one finalisation and cleared safety state. [Source/check manifest](evidence/P07_MEDIA_UPLOAD_EF4E0DCD.json) retains initial transform/type/test-fixture corrections and the exact evidence boundary.

These runs use synthetic Worker/R2 and registration authority. No public media grant, live clinical/media write or staging backend deployment is claimed. Fresh-session host recovery, never-returning-creator cleanup disposition, real D1/R2/role/tenant/receipt-race checks and final integration remain. The backend staging branch advanced to `72b1a82` with read-only CI files only; these were reviewed and normally merged into the existing SYS-0009 branch at `af4faf3`, with identical media runtime to tested `307a21b` and preserved unrelated publisher inputs. Production, main and the user's live app/browser remain untouched.

## Approved media-upload deferral — 2026-10-22

The user explicitly paused media uploads and directed completion of the remaining platform baseline first. The lead owns this revised scope in the current chat/worktree. Retain ADR-029 implementation, local synthetic evidence, backend branch, failed live attempt and all worktrees. Media upload is excluded from the current app-ready capability inventory and denied by the real SessionManager even if a signed release requests it. No public upload grant was published. Re-enablement requires a later reviewed media capability task proving actual staging transfer, outcome/recovery, role/tenant boundaries and support cleanup. This deferral does not defer ordinary JSON writes, API authority, update safety, shell checks or final source verification.

The staging backend snapshot `af4faf3` was deployed as version `1d3ec32d-fe06-425f-9d14-6008fc17a9df`; health and existing bindings passed. The private probe created one labelled synthetic patient and Staff record. Intent creation returned 500 before binary transfer; null capture-date validation mismatched the existing NOT NULL schema. Candidate validation corrections and a new backend schema regression remain preserved, uncommitted and paused; they are not a deployed fix or acceptance. Synthetic-record reconciliation remains a bounded cleanup task. No production operation occurred.

Remaining platform sequence: (1) real staging ordinary writes/stable retries and role/tenant boundaries; (2) source-bound ADR-025 and shell journey checks plus Windows regression disposition; (3) capability/navigation/print-export handoff and final build/unit/private-UI/Windows checks and source review. M14 app code and user manual review do not block this implementation sequence. M20/G21 production/device obligations remain separate. No checklist or G15 closure is claimed by this scope change.

## Non-upload platform verification — 2026-10-22

On unchanged runtime source from `680de739` (electron/src trees unchanged through `b68eab2b`), build passes and the full owned-suite unit run passes **437/437 in 25 files**. The test discovery configuration at `e0db2ede` excludes retained deployment snapshots by positively selecting `tests/**/*.test.ts`. A preliminary accidentally broad discovery was stopped; it is not a failed implementation result or a claimed pass.

The private package/profile staging JSON verifier passes **25 checks**: real SessionManager sign-in, exact company-signed release grants, one synthetic appointment committed with its response deliberately lost, truthful unknown outcome and explicit original-key recovery, changed-payload conflict, forbidden route/tenant selectors, Worker role denial, disabled membership invalidation and owned-data cleanup. Public catalogue/policy remain unchanged. [Sanitized report](evidence/P07_LIVE_JSON_STAGING_2026-10-22.json). The verifier source was uncommitted during execution and then checkpointed unchanged at `b68eab2b`; its SHA-256 is retained in the report.

A separate local verifier bundles only exact committed deployed backend `af4faf3` (excluding dirty publisher/media-validation inputs), executes actual RS256 verification and auth/controller/service/repository SQL against Control plus two separate canonical-schema Clinic SQLite databases. **10 checks pass**, including known existing foreign record/list/write/receipt denial, own-tenant mutation and one-audit replay, disabled mapping, wrong project and suspension. Only the Google certificate/account responses are synthetic; all real network is forbidden. This is meaningful source-level tenant isolation proof, not a claim that two remote staging D1 databases were exercised. [Report](evidence/P04_BACKEND_TENANT_BOUNDARY_2026-10-22.json).

Private staged updates **17**, Store interruption **2**, runtime **46 plus DPR 2**, usability **10**, overview **30**, scaling **5**, integration **26**, identity **44** and SDK **16** pass. Real update process exits/recovery pass at **12** persistence boundaries. The old Store interruption fixture initially timed out looking for a removed demo app; it was corrected to actual signed-package Store Records/Motion Studio and reran successfully. No product failure was hidden or retry substituted for a source correction. Remaining private package/workspace/hardening/onboarding/distribution/arrival/launch batch and exact M15 Windows proof are still in progress.

Read-only live-profile inspection verifies package signatures, exact installed asset bytes and current automatic known-good receipts for **all 11 installed apps**. Follow-ups is **1.0.0**, Finance/Lab Tracker **1.0.1**, all active=knownGood and no pending/trial. [Report](evidence/P06_LIVE_PROFILE_RECEIPTS_2026-10-22.json). This supersedes the previous missing-health/version inventory item, while user visual/module interaction acceptance stays separate. The live app/browser were not controlled or restarted.

The paused media probe's labelled Staff was inactivated after exact ownership checks; active patient media/Staff document lists are empty. The labelled synthetic patient and audit history remain intentionally retained because there is no supported archive API. Its preserved journal contains only failed intent POSTs and no binary PUT/finalise. [Reconciliation](evidence/MEDIA_DEFERRAL_RECONCILIATION_2026-10-22.json). No further media implementation or deployment was performed after the user deferred it.

[Platform capability handoff](../../docs/PLATFORM_APP_CAPABILITIES.md) states current API/update/lifecycle/budget authority and explicit upload/native-print-export/deep-navigation boundaries. Those unavailable powers are not inferred from app needs or invented as generic host escapes. Final source/Windows/review gates remain open; M20/G21 and later user review remain explicit.

## Final Linux workload batch — 2026-10-22

The entire final private batch passes on unchanged runtime source: packages **8**, workspace navigation **18**, delivery states **6**, hardening **22**, two-app 60-second resource sample **5**, preserved-state recovery **3**, independent new-app onboarding/updates **23**, distribution **10**, signed Store arrival/interruption **25**, and managed launch feedback **132**. All private runners, app children and private displays exited. No live desktop/browser was controlled. Exact report copies and hashes are retained in [the non-upload verification manifest](evidence/P09_NONUPLOAD_VERIFICATION_MANIFEST.json).

All planned Linux/local/staging checks for the declared non-upload platform baseline have now passed. Final exact-source Windows validation, final record alignment and independent review preparation remain P09. User visual/module interaction review remains afterward. No production readiness, G12/G13/G15 closure or independent-review pass is claimed.
