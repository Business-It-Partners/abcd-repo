# M03 Verification Evidence — Isolated runtime and shared shell

**Milestone verification:** VERIFIED for automated Linux/Windows G03 scope. Physical Windows testing deferred; user visual acceptance pending.

## Source and environment

Branch `codex/milestone-03`, based on M02 `7c794b45`. [SHA-256 manifest](evidence/tested-source-sha256.json) identifies runtime, fixture, test, package and workflow files before the CI publication commit. Electron and Playwright versions are pinned by the unchanged lockfile. Linux x64, Node 22.13.1, private headless GNOME/Wayland software-rendered display, disposable profiles. No live desktop focus/restart.

## Executed checks

| Command | Outcome | Retained evidence |
| --- | --- | --- |
| `nice -n 10 timeout 60s node node_modules/vitest/vitest.mjs run --maxWorkers=1` | 40 tests in 5 files pass | [unit log](evidence/unit.log) |
| `nice -n 10 timeout 120s npm run build` | typecheck/build pass, final capture/focus implementation | [build log](evidence/build.log) |
| `nice -n 10 timeout 240s node tools/run-ui-test.mjs tests/runtime.mjs tests/runtime-dpr.mjs tests/overview.mjs tests/native-session.mjs` | sequential private runtime/DPR/overview/native regressions pass | [shared run](evidence/private-shared.log) |
| `nice -n 10 timeout 180s node tools/run-ui-test.mjs tests/runtime.mjs tests/runtime-dpr.mjs` | final rounded capture and focus ordering changes pass | [final runtime log](evidence/private-runtime-final.log) |

[R04/R05/R11 and G03 runtime checks](evidence/runtime-verification.json) record three distinct shell/alpha/beta process IDs; sandbox/context isolation/no Node; separate storage; rejected forged report, network, cross-origin/file fetch, popup and unknown layouts; owner-scoped modal/keyboard focus and dirty-close cancellation; shared resize/overview/fullscreen dock/Genie; minimize/restore draft/process continuity; discard/reopen; actual renderer crash and infinite-loop termination with other app/shell still responsive; three cleanup cycles with no closed sample webContents retained; no shell page errors.

[Overlap](evidence/runtime-overlap.png), [contained crash](evidence/runtime-crash.png) and [DPR-2 capture](evidence/runtime-dpr.png) were visually inspected. [DPR dimensions](evidence/runtime-dpr.json) and [native continuity](evidence/native-session-verification.json) supplement this proof. Rounded foreground body, shared chrome, inactive mirror and readable freshly typed DPR draft are visible. This is private software-rendered evidence, not physical GPU/performance certification.

## Failed attempts and repairs

[Initial blocked-navigation wait failure](evidence/initial-navigation-failure.log) and [keyboard diagnosis](evidence/keyboard-diagnosis.log) are retained. See implementation notes for fixes. Earlier DPR capture contained a pre-paint empty field; final capture serializes pending work and the final painted screenshot includes the draft. Passing final runs supersede intermediate outcomes.

## Resource control

CPU/memory/process preflight before heavy work; single heavy job, low priority, bounded timeouts and one test worker. Private scripts run sequentially. No unrelated job was terminated. Runner/app/private compositor exit verified; Brave and the live OS session preserved. No backend/deployment work.

## Remaining limits

Windows hosted CI passed; G03 is closed within the declared automated scope. Physical Windows compositing, clipping, input, scaling and device performance are deferred after M11/before release under the approved policy. User visual acceptance is separate. This proves controlled samples, not production package trust, SDK/auth, installed dental apps or general background animation freshness. M04 is not started.


## First hosted Windows run

[Run 38781581529](https://github.com/Business-It-Partners/dental-os/actions/runs/38781581529) at `f8fc71e35d980cda251e40c7abdb9245a3cdcc21` passed 38 unit tests (one POSIX-only skip), build, four host-state checks and 26 runtime checks. [Original metadata](evidence/windows-ci-first/run.json) and original screenshots/logs are retained under `evidence/windows-ci-first/`. Review found a capture corner defect, repaired after this run. It is superseded as final runtime evidence by the final run on the repaired source below.


## Final Windows G03 closeout

[Run 38782178992](https://github.com/Business-It-Partners/dental-os/actions/runs/38782178992) passed at `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a` (tag `checkpoint/m03-ci`). [Metadata](evidence/windows-ci/run.json), [unit results](evidence/windows-ci/windows-unit.json), [build log](evidence/windows-ci/windows-build.log), [host results](evidence/windows-ci/windows-host-ci.json) and [runtime results](evidence/windows-ci/windows-runtime.json) are retained beyond GitHub artifact expiry. Windows: 39 tests passed, one POSIX-specific test skipped, zero failures; typecheck/build, four host-state checks and all 28 runtime checks pass. Both-direction native focus, real crash/hang containment and cleanup are included; no shell page errors. [Corrected overlap screenshot](evidence/windows-ci/runtime-overlap.png) was visually inspected and preserves rounded corners. Linux: 40 unit tests passed.

This promotes ADR-007 for the bounded foreground-native/inactive-mirror sample design. It does not certify physical hardware or claim production app installation. Follow-up evidence/documentation commits do not modify tested runtime source. `codex/milestone-03` retains this milestone; main remains M02.

## Deferred physical Windows handoff

After M11 and before release, verify native-body clipping/occlusion at overlapping corners; actual keyboard/focus activation in both directions and local modal Escape/Tab; dock access in fullscreen; real host minimize/restore; Genie and overview snapshots; 100/125/150/200 percent scaling and display changes; repeated crash/restart/close; device GPU/performance/resource behavior. Evaluate inactive snapshot and activation-click semantics with the user. These remain open physical-device gates, not failures silently waived by CI.


## Main integration — 2026-10-16

The user authorized merging verified M03 into main and established standing verified-milestone integration. A normal merge preserves both histories; the sole conflict was duplicate reference-cleanup prose in docs/GIT_AND_CI_SETUP.md, reconciled without runtime edits. All files in the retained tested-source SHA-256 manifest match the integrated runtime. Documentation/link/whitespace validation passes; no repeated build or runtime suite was needed. The earlier main-at-M02 statements above describe initial milestone closeout and are superseded by this integration. Milestone branches and checkpoint tags are unchanged, and local `refrence/` remains ignored/preserved. The original CI SHA maps to rewritten checkpoint `ce58156ef1bc8fc373c751412d0be51cb8f3529f`; exact runtime bytes are unchanged. M04 has not started.
