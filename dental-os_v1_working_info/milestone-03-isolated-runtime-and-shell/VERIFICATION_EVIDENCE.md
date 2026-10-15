# M03 Verification Evidence — Isolated runtime and shared shell

**Milestone verification:** Linux passed; Windows CI pending. User visual acceptance pending.

## Source and environment

Branch `codex/milestone-03`, based on M02 `7c794b45`. [SHA-256 manifest](evidence/tested-source-sha256.json) identifies runtime, fixture, test, package and workflow files before the CI publication commit. Electron and Playwright versions are pinned by the unchanged lockfile. Linux x64, Node 22.13.1, private headless GNOME/Wayland software-rendered display, disposable profiles. No live desktop focus/restart.

## Executed checks

| Command | Outcome | Retained evidence |
| --- | --- | --- |
| `nice -n 10 timeout 60s node node_modules/vitest/vitest.mjs run --maxWorkers=1` | 39 tests in 5 files pass | [unit log](evidence/unit.log) |
| `nice -n 10 timeout 120s npm run build` | typecheck/build pass, final capture implementation | [build log](evidence/build.log) |
| `nice -n 10 timeout 240s node tools/run-ui-test.mjs tests/runtime.mjs tests/runtime-dpr.mjs tests/overview.mjs tests/native-session.mjs` | sequential private runtime/DPR/overview/native regressions pass | [shared run](evidence/private-shared.log) |
| `nice -n 10 timeout 180s node tools/run-ui-test.mjs tests/runtime.mjs tests/runtime-dpr.mjs` | final serialized capture change passes | [final runtime log](evidence/private-runtime-final.log) |

[R04/R05/R11 and G03 runtime checks](evidence/runtime-verification.json) record three distinct shell/alpha/beta process IDs; sandbox/context isolation/no Node; separate storage; rejected forged report, network, cross-origin/file fetch, popup and unknown layouts; owner-scoped modal/keyboard focus and dirty-close cancellation; shared resize/overview/fullscreen dock/Genie; minimize/restore draft/process continuity; discard/reopen; actual renderer crash and infinite-loop termination with other app/shell still responsive; three cleanup cycles with no closed sample webContents retained; no shell page errors.

[Overlap](evidence/runtime-overlap.png), [contained crash](evidence/runtime-crash.png) and [DPR-2 capture](evidence/runtime-dpr.png) were visually inspected. [DPR dimensions](evidence/runtime-dpr.json) and [native continuity](evidence/native-session-verification.json) supplement this proof. Rounded foreground body, shared chrome, inactive mirror and readable freshly typed DPR draft are visible. This is private software-rendered evidence, not physical GPU/performance certification.

## Failed attempts and repairs

[Initial blocked-navigation wait failure](evidence/initial-navigation-failure.log) and [keyboard diagnosis](evidence/keyboard-diagnosis.log) are retained. See implementation notes for fixes. Earlier DPR capture contained a pre-paint empty field; final capture serializes pending work and the final painted screenshot includes the draft. Passing final runs supersede intermediate outcomes.

## Resource control

CPU/memory/process preflight before heavy work; single heavy job, low priority, bounded timeouts and one test worker. Private scripts run sequentially. No unrelated job was terminated. Runner/app/private compositor exit verified; Brave and the live OS session preserved. No backend/deployment work.

## Remaining limits

Windows hosted CI must pass before G03 is closed. Physical Windows compositing, clipping, input, scaling and device performance are deferred after M11/before release under the approved policy. User visual acceptance is separate. This proves controlled samples, not production package trust, SDK/auth, installed dental apps or general background animation freshness. M04 is not started.
