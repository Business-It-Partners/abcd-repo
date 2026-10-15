# Dental OS Git and Windows CI setup

User-authorized repository: https://github.com/Business-It-Partners/dental-os (private).

The existing Flutter root history and former remote are retained. Local caches/builds/installers remain excluded and are not deleted. Existing source, documentation, synthetic prototype artifacts and tracked archive source are preserved. A local pre-setup branch and index backup preserve the initial reference point.

Branches: main for the integrated snapshot; codex/milestone-01 for a reconstructed pre-M02 comparison checkpoint; codex/milestone-02 for current M02 work. M01 was not committed when originally authored: its checkpoint is reconstructed by removing M02 runtime changes, not asserted to reproduce an originally verified historical tree. Future M03–M11 branches are created when implementation starts, not prematurely marked implemented.

Windows CI runs sequential unit/filesystem, build and hosted-runner boot/state/recovery checks. No cloud deploy or secrets required. Physical Windows checks (real desktop activation/minimize/restore, ACL/runtime interactions, visual review and supported-device behavior) remain deferred until after M11 and before final product release. Exact CI run and snapshot IDs will be recorded after publication. No acceptance tag is issued for a pending gate.

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


## Local-only reference correction

The user clarified that refrence/ is local lookup material. It is removed from current branch tracking and ignored; the local directory is preserved. Existing commits/checkpoint tags retain their historical trees. No published history is rewritten. Earlier archive-publication statements describe the previous setup only.


## Reference history removal — 2026-10-15

The user explicitly authorized rewriting published Dental OS history and checkpoint tags. The published history now starts at the Dental OS baseline, with inherited Flutter ancestry detached and `refrence/` removed from every retained commit. All four published branches and three checkpoint tags were rewritten together. Every retained commit/checkpoint was compared against its predecessor: all non-reference blob IDs and file modes are identical.

[Commit/ref translation map](GIT_HISTORY_REWRITE_MAP.json) maps the original IDs to their rewritten equivalents. Earlier CI evidence retains its original executed SHA and run link; the rewritten checkpoints contain the same non-reference source/evidence. This cleanup does not rerun or invalidate those checks. Earlier statements that the published Flutter history was retained or that no rewrite occurred describe superseded setup steps.

The local reference directory and original history backup are preserved outside publication. The original Flutter repository/remote and local legacy branches remain local lookup/recovery sources; never push them to Dental OS origin or merge their ancestry back. Fresh clones receive only the cleaned Dental OS history. Existing external clones must be realigned or freshly cloned before contributing; do not merge their old branch histories. GitHub may retain unreachable objects/cached old commit URLs internally; the rewrite removes them from published branch/tag ancestry, not GitHub's internal storage retention.
