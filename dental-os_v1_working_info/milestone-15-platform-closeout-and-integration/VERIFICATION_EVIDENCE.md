# M15 Verification Evidence — Platform Closeout and Integration

**Status:** M15.1 source reconciliation/checkpoint implemented; M15 runtime acceptance and G15 verification remain pending.
**Date:** 2026-10-21.
**Source:** lead integration branch `codex/milestone-15`, with milestone-record worker branch `codex/m15-plan-records`, created at committed M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.

**Current accepted source checkpoint:** `ad3fa6a10437bf58606631325d93f6b3cc0369b5` on `codex/milestone-15`; it contains the reviewed managed-app launch-feedback/native-frame handoff slice and related evidence. This is a limited implementation checkpoint, not final integrated-baseline or G15 acceptance.

## P03 scope record

The user accepted the proposed M15.1–M15.6 scope and asked that it be formalized. This is approval to record the plan only. The phase exit criteria are all pending. User scope acceptance does not implement an API permission mechanism, an inter-app navigation contract, media transport, ADR-025 behavior, shell acceptance, a feed-renewal operation or the final integrated baseline.

The central checklist and completed audits were read from the original checkout in read-only mode. Repository-relative pointers for lead integration are:

- `dental-os_v1_working_info/PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md`
- `dental-os_v1_working_info/audit-reports/SOURCE_BASELINE.md` and `.json`
- `dental-os_v1_working_info/audit-reports/MILESTONE_EVIDENCE_AUDIT.md`
- `dental-os_v1_working_info/audit-reports/SHELL_RELEASE_AUDIT.md`
- `dental-os_v1_working_info/audit-reports/API_UPDATE_GAPS.md`

The lead owns those files and included them in the combined documentation checkpoint. Their absence in the initial worker-only snapshot was an expected integration boundary, not a runtime failure.

## Evidence required before G15

| Phase | Required evidence | Current result |
| --- | --- | --- |
| M15.1 | Reviewed source-layer inventory, exact integrated candidate SHA/tree, local-delta dispositions, dated milestone record corrections | IMPLEMENTED — limited accepted source checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5`; see M15.1 evidence below. |
| M15.2 | Accepted versioned authority and host-contract decisions; unchanged-desktop positive/negative API evolution; M14-bounded media, navigation and payload tests; R13 unchanged | Pending; no design was selected or code changed. |
| M15.3 | ADR-025 staged update from a live old version through next full launch, readiness/trial/recovery, interruption/concurrency matrix, dirty/unknown-write and original-key safety | Pending; earlier M08/M11 evidence covers its original scope only. |
| M15.4 | M12.6/G12 and M13/G13 owner records closed with source-bound Linux/private, applicable Windows and required user/profile evidence | Pending; G12/G13 remain open. |
| M15.5 | Synthetic representative workload matrix, measured resource/failure cases, test-environment inventory, named staging-feed operator and metadata-only renewal/expiry-recovery drill | Pending; no M15 workloads or staging operations were run. |
| M15.6 | Final integrated-source manifest, required build/unit/focused private UI/applicable Windows and combined regressions, M14 handoff, M20/G20/G21 residuals | Pending; no combined-source verification was run. |

## Limits and gate status

Historical M01–M11 evidence remains applicable to its exact recorded source and scope; it is not final M15 integration evidence. The local M13 candidate and the original checkout's unintegrated changes are separate source layers. M14 app functionality and the registered app dependencies remain separate. M20/G20 platform release/operations and post-M20 G21 device/user/product acceptance remain mandatory.

G15 cannot be verified while M12/G12 or M13/G13 remains open, unless the relevant gate owners record an explicit user-approved scope change. G14 integrated app acceptance depends on the verified M15 platform baseline. None of these gates is closed by this planning report.

## Validation performed for this planning record

Only the four required M15 documents were added under this directory. The branch was created from the exact committed M13 source above. No dependency install, build, runtime/unit/UI test, live profile inspection, cloud operation, commit, push, merge, deploy, application restart, or generated build output was produced. Full documentation-checker validation is deferred until lead integration supplies the central checklist, audit reports, and matching gate/traceability/checker updates; the checker's output on this partial worker snapshot would not validate the final integrated document set.


## Lead-integrated P03 verification — 2026-10-21

**Result:** P03 scope/records/dependency formalization PASS as documentation only. M15 remains IMPLEMENTING; G15 and all runtime acceptance are pending.

- Combined milestone records, architecture build phases/G15/requirement traceability, roadmap/global status and M12/M13/M14/M20 coordination links are present.
- `python3 tools/check-dental-docs.py`: PASS; 24 architecture documents, 16 milestones, 64 required milestone records, 15 requirements, 17 gates, 14 invariants and zero errors. [Machine-readable result](evidence/P03_DOCUMENTATION_CHECK.json).
- Python syntax review (`ast.parse`), Git whitespace review and scoped local report-link review: PASS.
- Lead corrected a draft's ambiguous update wording to the next full **app** launch; a desktop restart is not required for compatible app-only updates. The canonical ADR-025 lifecycle is unchanged. G15 maps affected OS-only durability/privacy while R14 release proof stays with G20/G21.
- [Worktree output cleanup inspection](evidence/P03_WORKTREE_OUTPUT_CLEANUP.json): five task worktrees checked, no generated output roots present and no deletions needed. Source, reports, evidence, all worktrees and the original live application build were preserved.

The documentation branch starts from committed M13 `96363362` plus accepted documentation/audit records. At P03, the original checkout's uncommitted runtime/test/artifact delta remained excluded for M15.1 review. No build, runtime/unit/UI test, live-profile inspection, staging/production mutation, app publication, main integration or live-session restart occurred in P03. A planning checkpoint does not close G15 or certify the integrated runtime.

## Lead-integrated M15.1 source and record reconciliation — 2026-10-21

**Result:** M15.1 PASS for reviewed source dispositions, limited accepted source checkpoint and dated record reconciliation. M15 remains IMPLEMENTING; P04–P09, M12.6/G12, M13/G13 and G15 remain open.

- Required lead worktree was verified as `/home/master-x/.codex/worktrees/platform-closeout/fewa_business_os`, branch `codex/milestone-15`, commit `125fa25bcc27d6ff198148259695d76cf895b0eb`, initially clean. The original checkout remained untouched on dirty `codex/milestone-13`. P03 worker worktrees with uncommitted source/docs/audits and old detached worktrees were inspected and preserved; no worktree was deleted or reused.
- The accepted source files and per-file decisions, original-side-branch disposition, and excluded staging helper/Windows artifacts are listed in [M15 implementation notes](IMPLEMENTATION_NOTES.md). Only the launch-feedback/native-frame handoff slice was checkpointed at `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. The original staging helper was not run. The main branch was not merged, pushed or changed.
- Environment: local Ubuntu 22.04.5 x86_64 under the repository's private GNOME/Wayland test display; synthetic signed packages and app fixtures. The user's live Dental OS/Brave session was not inspected, focused or restarted.
- `npm run build`: PASS on the exact source tree later committed as `ad3fa6a10437bf58606631325d93f6b3cc0369b5`.
- `npm test -- --maxWorkers=2 --testTimeout=10000`: PASS, 297/297 unit tests. Earlier runs had two distinct unrelated 5-second timeout failures (one updates-signature case with two workers; another staged-interruption case with one worker); each case passed in isolation and the bounded full run passed with the explicit 10-second timeout. These earlier attempts are retained in the work log rather than represented as clean first-run success.
- `npm run test:runtime`: PASS, 46 checks plus DPR 2 capture; the report covers runtime isolation, process cleanup, native frame freshness/handoff, multiwindow, session and failure containment. The final [runtime report](../../artifacts/runtime-verification.json) and refreshed screenshots are retained. The test passed twice during M15.1; no additional run was needed after the exact source tree was checkpointed.
- `npm run test:app-launch-feedback`: first attempt exposed that the catalogue-unavailable view displayed the raw package ID where verified installed metadata supplied a title. The fix reads the title from the verified package registry with a safe ID fallback if metadata is unavailable. A filtered diagnostic attempt reproduced the title issue. Final run PASS, 132 checks across all eleven current shells, a differently named future managed app and a repeat Patient Record launch; no shell renderer errors. The successful [JSON report](../../artifacts/app-launch-feedback-2026-10-21T17-58-44-546Z.json), splash screenshot and handoff screenshot are retained. The two earlier diagnostic JSON reports are also retained and show partial attempts, not successful full-suite runs.
- These checks establish the accepted source slice only. No private API-authority evolution, media workload, ADR-025 staged-update trial/fallback matrix, full M12.6 journey, current user-profile M13 health receipt/module review, staging feed renewal, combined P07 workload or final-source M15.6 verification was performed.
- Dated owner-record updates were made in the central checklist, global status, roadmap, M12 status, M13 status and all M15 records. P03 historical evidence remains intact. G12/G13/G15 and M14/M20/G21 scopes remain separate.
