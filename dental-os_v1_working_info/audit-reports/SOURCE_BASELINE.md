# Platform source baseline — reconciliation audit

**Date:** 2026-10-21. **Owner:** lead platform chat (`dental-os-sole`).
**Method:** read-only Git/source inspection, including a successful `git fetch --no-prune origin`. No branch merge, reset, source commit, publication, deployment or application restart.

The machine-readable [inventory](SOURCE_BASELINE.json) records exact refs and SHA-256 identities of 39 pre-audit modified/untracked inputs. It excludes ignored credentials, user profile contents and local reference archives. Audit reports are separate outputs. This is a source identity record, not a runtime acceptance result.

## Three source layers

| Layer | Exact identity / scope | Disposition |
| --- | --- | --- |
| Last integrated verified milestone | `main` and `origin/main`: `8c8211c00614b095c529d9d14964ca2ce912db73`, M11-integrated | Preserve as historical integrated baseline; do not claim newer UI/app-shell work is already integrated here. |
| Committed platform candidate | Local/remote `codex/milestone-13`: `963633620d9fa620979bd33fc292949ab1a6c2e6`, 20 commits beyond main | Proposed foundation for closeout, subject to retained evidence and final affected verification. It already includes the current M12-shell/module-navigation/store-arrival ancestry. |
| Current local candidate delta | Same M13 HEAD plus the tracked/untracked inputs in SOURCE_BASELINE.json | Preserve and review as separate groups before any checkpoint/integration. These bytes have no combined commit-level acceptance identity. |

`git fetch` refreshed origin refs without pruning or changing a checkout. The M14 remote advanced independently to `48c18401cada192bfa0bea02a4afdd0cb10e45ca`; this is app planning/documentation work. The local M14 worktree stays at `6fd362ec51b3f4c256750202a10c16d4ece05518`. Do not reset, fast-forward or write into the app worktree while its external owner works.

## Relevant branch disposition

| Ref | Observed relation to M13 HEAD | Proposed disposition |
| --- | --- | --- |
| `codex/milestone-01` through `codex/milestone-11` and checkpoint tags | Historical milestone lines/evidence; final main integration recorded in the owning milestone records | Preserve history and tested scope. Retain original CI identities and documented history-rewrite translations. |
| `codex/milestone-12-shell` (`1badd285`) | Ancestor of M13; local tip includes one commit beyond its remote `158f12a7` | Already present in candidate ancestry. Do not merge again. Any publication decision follows closeout/source review. |
| `codex/module-navigation` (`cfe5f063`) | Ancestor of M13 | Already present; retain branch, do not repeat its changes. |
| `codex/store-install-arrival` (`7f6e65bf`) | Ancestor of M13 | Already present; retain branch and its original evidence. |
| Older `codex/milestone-12` (`65bd3b1d`) | Divergent older line, one ref-only commit and 31 M13-only commits | Preserve; assess its individual patch semantically, never merge the old line wholesale. See below. |
| `codex/milestone-13` | Current candidate HEAD | Review local delta and gate residuals before final integration. |
| `codex/milestone-14` / origin M14 | Separate app track; remote eight commits beyond M13 at inspection | Keep app ownership separate. Read its contract/dependency changes; coordinate later compatibility and integrated acceptance. |
| `codex/os-minimize-glitch` and pre-existing detached worktrees | User's other checkouts at older shell source | Preserve; audit creates no ownership or deletion authority over them. Relevant shell fixes must be compared before any future selective integration. |
| `dev/work-startup`, `codex/pre-dental-repo-setup`, `flutter-reference` | Local legacy/reference history, outside active Dental OS origin | Preserve locally. Never push/merge legacy ancestry into Dental OS. |

### Older M12 patch: overlap and remaining distinction

The unique `65bd3b1d` patch adds v2 preference compatibility, concise support preview and tests. Current M13 already contains the v2 parser/preservation and its regression (`electron/storage/osState.ts`, `tests/osState.test.ts`, `tests/recovery-scenario.mjs`). Treat those behaviors as already represented, subject to final-source regression checks.

The support preview is an alternative implementation: the old branch uses `supportReviewDetail`; current `electron/main.ts` uses `supportReviewText` with the five most recent fixed-schema diagnostic events and safe export controls. The old `tests/support.mjs` is absent from M13. There is no justification to overwrite the newer support flow merely to import this commit. Proposed disposition: retain current behavior, inspect any useful missing negative assertions during focused support verification, and record the old UI variant as superseded if that evidence is adequate. This audit performs no cherry-pick or test port.

## Local delta classification

| Group | Files / inputs | Ownership and next action |
| --- | --- | --- |
| Accepted product/update documentation | PRODUCT_DIRECTION; architecture index, vision/definition, install/update contract, ADR register; related milestone pointers | Lead maintains accepted product intent. ADR-025 is the target; these docs alone do not implement it. Preserve original milestone evidence. |
| Existing M13 platform/runtime changes | `electron/distribution/service.ts`, `electron/main.ts`, `electron/runtime/manager.ts`, `src/RuntimeFixtures.tsx`, `src/style.css` | Review capture/launch-feedback and installed-title behavior as one scoped platform delta. Separate from upcoming API/update changes and from M14 app UI. |
| Existing M13 fixture/test changes | `electron/packages/fixtures.ts`, `tests/runtime-scenario.mjs`, `tests/app-launch-feedback.mjs`, package script | Retain private-display guards; review exact fixture versus real-runtime coverage and bind future acceptance to an exact integrated source. |
| Existing evidence | Modified runtime/Windows-preview reports/screenshots and untracked launch-feedback artifacts | Preserve as recorded attempts/results. Some preview outputs are separate packaging experiments, not proof of current release readiness. Do not manufacture a shared tested-source claim from unrelated artifacts. |
| Untracked SaaS packaging helper | `tools/app-packages/prepare-dental-saas-staging.mjs` | Preserve as unfinished release tooling, separate from source baseline acceptance. Review before any future use; audit does not execute its signing/publishing inputs. |
| Working/milestone status and new central tracker | Root WORK_CHECKLIST, roadmap/global status, M13/M14 local records, platform checklist | Lead owns reconciliation tracking. Keep later app planning on the externally active branch; do not replace it with the older local M14 pointer. |

The product direction and launch-feedback entries were already in the checkout when this audit started. Ownership here means proposed review responsibility, not an assertion that every pre-existing edit was authored by this lead.

## Worker layout and coordination correction

The first two isolated embedded-worker audits were stopped after the user clarified that workers must be separate sidebar chats. Their partial reports and worktrees remain preserved. They are inputs, not accepted final worker reports.

| Role | Chat / checkout | Edit boundary |
| --- | --- | --- |
| Lead | `dental-os-sole`, original checkout | Source baseline, central checklist, reconciliation decisions and final review |
| Sidebar evidence worker | `Platform audit - milestone evidence`; `/home/master-x/.codex/worktrees/d585/fewa_business_os` | Its milestone-evidence report only; reads source/evidence and the preserved partial report |
| Sidebar shell/release worker | `Platform audit - shell and release`; `/home/master-x/.codex/worktrees/0b37/fewa_business_os` | Its shell/release report only; reads local accepted docs/runtime read-only |
| Preserved partial evidence checkout | `/home/master-x/.codex/worktrees/platform-evidence-audit/fewa_business_os` | Embedded worker stopped; report retained |
| Preserved partial shell checkout | `/home/master-x/.codex/worktrees/platform-shell-release-audit/fewa_business_os` | Embedded worker stopped; report retained |

Sidebar workers use GPT-6 Luna Extra High and perform document/source review only. No dependency installs or heavy local checks are started by the audit. The lead owns integration order; no worker edits the central checklist, active runtime, architecture authority or external app branch.

## Proposed baseline decision and limits

Use committed M13 plus explicitly reviewed local platform/documentation deltas as the closeout candidate; use main as the preserved verified M11 reference. First reconcile the workers' findings and define the remaining scope. Then create the approved closeout branch/checkpoint under repository policy and verify the resulting combined source. M14's final compatibility check must use that exact source, not merely this audit snapshot.

Open source-management items are now explicit: the uncommitted platform delta needs review/checkpoint, the older M12 patch needs a recorded semantic disposition, and unrelated checkouts remain untouched. This inventory does not read the live clinic profile, certify existing test artifacts independently, or claim device/production readiness.
