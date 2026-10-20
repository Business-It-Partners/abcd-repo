# Dental OS Git and Windows CI setup

## Verified milestone integration policy — 2026-10-16

The user gives standing authorization to commit and push milestone work for verification, then merge each completed milestone into `main` after its required checks pass. No separate merge confirmation is needed. `main` is the latest integrated verified milestone; `codex/milestone-NN` branches retain milestone work and checkpoint tags identify tested source. Current completion is recorded in the global milestone status; latest verified checkpoints are recorded below.

1. Start one milestone branch from current main. Inspect, plan, implement and perform controlled relevant verification; retain exact source/evidence and any approved scope deferrals.
2. Close the required milestone gates and update status/evidence. Under the 2026-10-19 re-sequencing, keep physical Windows testing deferred until after M13 under G14 and before release; do not treat hosted CI as physical certification.
3. Fetch main, integrate with a normal non-squash merge, and resolve conflicts without losing either side's work. Verify the merged runtime matches tested source. If conflict resolution or intervening changes alter code, rerun affected checks before completing integration. When code is identical and changes are documentation only, validate docs and source hashes without repeating passing heavy suites.
4. Commit and push the merge to main. Preserve milestone branches and checkpoint tags; do not delete, force-move, squash away or reuse completed checkpoints. Record merge/source/evidence and report integration status.

This authorization covers milestone commits, verification publication and verified integration. It does not authorize deploying backend changes, promoting production resources, merging unverified work, deleting branches/worktrees, rewriting history, or starting the next milestone without its work authorization. All backend work remains staging-only under the existing resource policy. `refrence/` and inherited Flutter ancestry remain local-only.

User-authorized repository: https://github.com/Business-It-Partners/dental-os (private).

The existing Flutter root history and former remote are retained. Local caches/builds/installers remain excluded and are not deleted. Existing source, documentation, synthetic prototype artifacts and tracked archive source are preserved. A local pre-setup branch and index backup preserve the initial reference point.

Branches: main for the integrated snapshot; codex/milestone-01 for a reconstructed pre-M02 comparison checkpoint; codex/milestone-02 for current M02 work. M01 was not committed when originally authored: its checkpoint is reconstructed by removing M02 runtime changes, not asserted to reproduce an originally verified historical tree. Future branches are created when implementation starts, not prematurely marked implemented. The 2026-10-19 re-sequencing assigns M11 flexible app onboarding/updates, M12 OS UI, and M13 Windows/Linux release operations.

Windows CI runs sequential unit/filesystem, build and hosted-runner boot/state/recovery checks. No cloud deploy or secrets required. Physical Windows checks (real desktop activation/minimize/restore, ACL/runtime interactions, visual review and supported-device behavior) remain deferred until after M13 under G14 and before final product release. Exact CI run and snapshot IDs will be recorded after publication. No acceptance tag is issued for a pending gate.

## Published initial checkpoints

- M01 reconstructed comparison tree: `3771bce30b4133d5425c77d1a9526a898b752567`. This is not an original historic acceptance commit; retrospective documentation is present but M02 runtime changes are removed.
- Initial M02/main source: `24470d84a55817440f1282e3ffc03c8cf8011bb1`.
- Windows workflow: https://github.com/Business-It-Partners/dental-os/actions/runs/38777592561 (explicitly dispatched on codex/milestone-02; completed successfully).
- Local portable test rerun: 36 tests passed with one worker; no new local build or graphical suite was needed for CI/test portability changes.
- Publication: 433 reviewed snapshot paths, approximately 86.6 MiB; generated caches/installers excluded. Common high-confidence credential patterns were not found in the prospective snapshot or 2,369 reachable historical blobs. This scan is not a guarantee that arbitrary secrets cannot exist. No large historical blob exceeded 25 MiB.
- `.git/index.before-dental-repo-setup` and local `codex/pre-dental-repo-setup` preserve the pre-connection index/HEAD; ignored local files and archive caches were not removed. Local branch is codex/milestone-02, tracking the new origin.

The Flutter remote is retained as flutter-reference; origin points to the dedicated Dental OS repository. No changes were pushed to Flutter or SaaS repositories. Future milestone branches are created when their work starts. Do not force-move completed checkpoints; identify fixes with new commits. Push-trigger automation may be suppressed for automated GitHub credentials; explicit workflow_dispatch provides the verifiable CI run when needed.

Initial Windows evidence: 35 passed / 1 POSIX-only test skipped, build/typecheck pass and all four hosted runtime checks pass. The initial npm invocation did not emit the requested JSON report, so the workflow now invokes Vitest directly with explicit worker/reporter arguments. Artifact paths are narrowed to this run’s own logs, avoiding historical prototype logs already in the repository. The direct invocation passes 36 local tests and emits JSON; a fresh Windows run verifies this workflow correction.

## Final CI gate

Run [38778013772](https://github.com/Business-It-Partners/dental-os/actions/runs/38778013772) passed at `fd124b5c20e0abbac0a3f99a79be2cc01cddb59c`: 35 Windows tests passed, one POSIX-specific case skipped, build/typecheck and four hosted runtime checks passed. JSON and logs are retained under M02 evidence/windows-ci-final, beyond GitHub's artifact retention. Tag checkpoint/m02-ci identifies this tested source. Later evidence-only commits do not change tested runtime code. M02 automated scope is verified; physical Windows tests remain deferred until after M11, before final release. M03 is not started.


## M03 checkpoint

`codex/milestone-03` contains isolated-runtime implementation and retained evidence. Tested source/tag: `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a` / `checkpoint/m03-ci`; Windows run [38782178992](https://github.com/Business-It-Partners/dental-os/actions/runs/38782178992) passes. Evidence-only follow-up commits preserve identical runtime source. At initial closeout, main remained M02. The user subsequently authorized M03 integration on 2026-10-16; main now includes M03. Physical device testing remains deferred after M11/before release. M04 has not started.


## Local-only reference correction — 2026-10-15

The user clarified that `refrence/` is local lookup material and must not be published with Dental OS. Remove it from tracking on main and the started milestone branch tips, preserve the local directory, and ignore `/refrence/` for future commits. Existing checkpoint tags and older commits retain their historical trees; this cleanup does not rewrite published history. Historical statements about publishing tracked archive source above describe the earlier setup and are superseded for current branch contents.


## Reference history removal — 2026-10-15

The user explicitly authorized rewriting published Dental OS history and checkpoint tags. The published history now starts at the Dental OS baseline, with inherited Flutter ancestry detached and `refrence/` removed from every retained commit. All four published branches and three checkpoint tags were rewritten together. Every retained commit/checkpoint was compared against its predecessor: all non-reference blob IDs and file modes are identical.

[Commit/ref translation map](GIT_HISTORY_REWRITE_MAP.json) maps the original IDs to their rewritten equivalents. Earlier CI evidence retains its original executed SHA and run link; the rewritten checkpoints contain the same non-reference source/evidence. This cleanup does not rerun or invalidate those checks. Earlier statements that the published Flutter history was retained or that no rewrite occurred describe superseded setup steps.

The local reference directory and original history backup are preserved outside publication. The original Flutter repository/remote and local legacy branches remain local lookup/recovery sources; never push them to Dental OS origin or merge their ancestry back. Fresh clones receive only the cleaned Dental OS history. Existing external clones must be realigned or freshly cloned before contributing; do not merge their old branch histories. GitHub may retain unreachable objects/cached old commit URLs internally; the rewrite removes them from published branch/tag ancestry, not GitHub's internal storage retention.


## M04 and M05 integrated checkpoints — 2026-10-16

M04 tested source `672a81180336b535d90ee9c2d92917354dc1c6e5` / `checkpoint/m04-ci` passed Windows run 38842666568 and was merged into main at `4ad8e32f`. M05 tested source `07c2fb21575dc6b575ad664a9bb3b3466c0fd6e3` / `checkpoint/m05-ci` passed final Windows run 38845000521, plus retained Linux/live-staging identity evidence, and is now merged into main. `codex/milestone-04` and `codex/milestone-05` remain available; tags identify exact tested sources. Evidence-only closeout does not change runtime bytes. No backend deployment, history rewrite or deletion occurred. Stop after M05; M06 has not started.

## M06 verified package checkpoint — 2026-10-16

The user authorized the next sprint, superseding the prior stop after M05. M06 tested source `083f91280fec560000b531bc96d9394b820ddf4d` / `checkpoint/m06-ci` passed [Windows run 38848241451](https://github.com/Business-It-Partners/dental-os/actions/runs/38848241451) and retained Linux local-package/runtime regression evidence. M06 is integrated into main with the required normal non-squash merge; codex/milestone-06 and previous milestone branches/checkpoint tags are preserved. Evidence-only closeout has identical tested source (116 retained hashes). No production key publication, backend change, deployment or history rewrite. Physical Windows remains after M11/before final release. Stop after M06; M07 has not started.

## M07 prepared checkpoint — 2026-10-16

`codex/milestone-07` source `8554c1bc28004e91c0d934e1e08f2cc4f4859bf3` passes hosted Windows run 38850865178 plus retained Linux proof. Backend SYS-0005 remains isolated/local at `67a5dc5`. This is preparation, not a completed G07 acceptance checkpoint: no acceptance tag/main merge until actual approved staging catalogue/R2 delivery proof. Separate staging deployment/provisioning approval remains required by AGENTS; see the milestone rollout record. Evidence-only follow-up skips redundant CI with identical runtime source. Existing branches/tags and main remain preserved.

## M07 verified live staging checkpoint — 2026-10-16

User authorized scoped staging operations and continuous work through M10, superseding prior pending-approval/stop statements. M07 tested source `3d3497584f77bbb0d43cbf5a1c2621ed987f9bca` / checkpoint/m07-ci passes Windows 38853480777, affected Linux checks and actual staging G07 acceptance. Backend additive deployment 38853577930 at SaaS staging merge 3ae3397 preserves previous tenant bindings/clients. Retain milestone branch/tag; normal merge into main. Physical Windows remains after M11/before final release, no production change.

## M08 verified update checkpoint — 2026-10-16

`codex/milestone-08` / `checkpoint/m08-ci` retains final tested source `857b2c4fb44a0fa3308db49a222d768fa3eb9800`; Windows [38857330434](https://github.com/Business-It-Partners/dental-os/actions/runs/38857330434) and retained Linux/live-staging G08 gates pass. Evidence-only normal main integration preserves tested source hashes. Earlier CI failures/repairs remain in milestone evidence. Backend SYS-0006 staging deployment and publication sequences 3–7 are accepted without production/clinical mutation. Proceed M09/M10 under standing authorization; physical Windows stays after M11/before release.

## M09 verified integrated checkpoint — 2026-10-16

Source 54be1c0609f367a784de9d06516964da157e6e3e / checkpoint/m09-ci, Windows [38922410037](https://github.com/Business-It-Partners/dental-os/actions/runs/38922410037), final Linux and actual staging 21-case integration pass. Preserve branch/tag, merge normally with identical runtime/source hashes; continue M10 under existing authorization. Physical Windows after M11/before release. No production or shared backend deployment.

## M10 verified hardening checkpoint — 2026-10-16

`codex/milestone-10` / `checkpoint/m10-ci` retains source e2027a57198ac87ceb0d7db0a82d6063d9878c14. [Windows 38925883945](https://github.com/Business-It-Partners/dental-os/actions/runs/38925883945) passes all unit/build/hardening/recovery/resource/integration/update/Store/package/host/runtime/SDK/identity gates. Linux evidence and the superseded old error-text assertion failure are retained. Normal evidence-only main merge must match 151 source hashes. Stop at M10; M11 is not started. Preserve every milestone branch/tag; no production or M10 backend deployment. Physical/device/release acceptance remains separate.

## M11 verified and integrated app-update checkpoint — 2026-10-20

`codex/milestone-11` retains tested source `e14cd1254f5ca6b2f9abc89b60ab7d9fa89d055f` at `checkpoint/m11-ci`; final Windows [run 39363492330](https://github.com/Business-It-Partners/dental-os/actions/runs/39363492330) passed. Its 16 minimal synthetic app profile measured 2.09 GiB peak aggregate working set over 20 Electron processes and 487 MiB after close across four processes; this is not PSS, no memory ceiling is enforced, and clinical apps/low-memory devices were not tested. The user confirmed the staging Store update to 1.3.0 by reporting that the installed version and Store version match and only **Open** remains. Normal non-squash merge `b6a4045f28f99e1dde72e0025f4157ad9bea1ffb` (parents `7378fc83a8fd6ebe4be25404eb974fef2b480bf3` and branch tip `4084474fa41e7dafb1ce0a6251b06c0f619d5b65`) was pushed to `main`. Merged runtime, tests and workflow files are unchanged from tested source; follow-up commits only add evidence/status documentation. The milestone branch and checkpoint tag remain preserved. G14 physical Windows/device and final product acceptance remain after M13; no production promotion or release certification is implied.
