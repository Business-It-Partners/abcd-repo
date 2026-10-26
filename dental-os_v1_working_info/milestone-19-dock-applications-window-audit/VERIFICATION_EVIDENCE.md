# M19 Verification Evidence

## Evidence rules

Record each M19 verification against the exact source commit and include the command or private UI runner, environment, outcome, retained report path, and known limitations. A source method or an earlier audit is not proof that a new change works. Runtime checks must use the private UI test runner.

## Starting audit notes — 2026-10-25

Starting source: b11a4b12 on codex/app-store-infrastructure-audit. The tree was clean at the start of planning.

The prior read-only audit reported:

- Focused unit checks passed: 40 tests across window-manager, runtime-contract, sandboxed-preload, and motion suites.
- Private window-resize/fullscreen/dock interaction checks passed.
- Private two-window-cap behavior passed for cancel and choose-an-app-to-close.
- The private app-launch-feedback run reached app handoff, but the Appointments fade timing assertion failed; Follow-ups passed its checks.
- A current-source app crash/unresponsive/restart UI scenario was not completed.
- Existing dock/overview UI scripts include expectations that do not match the documented two-app V1 limit.

These results are carried forward as audit context only. The launch-feedback run did not fully pass, and this ledger does not contain source-hashed raw test reports for the prior run. Re-run affected checks during M19 before counting them as completion evidence. No source fix or runtime test was performed while creating this plan.

## M15 integration verification — 2026-10-26

The user authorized bringing the audit work into M15. Cherry-picked `b11a4b12` and `f019cdfe` in order as M15 commits `7440710f` and `deb6d231`; the only cherry-pick conflict was the shared `WORK_CHECKLIST.md` entry, which was reconciled while preserving both records. Runtime source was then verified on `codex/milestone-15` at `deb6d231`:

| Command | Result |
| --- | --- |
| `npm run build` | Passed. |
| `npm test -- --maxWorkers=1` | 520/520 passed. The M17 identity expectation was aligned to the already-published Work Entry 1.0.8. |
| `sha256sum -c artifacts/m19-source-fingerprint.sha256` | 15/15 M19 source files matched the retained fingerprint. |

All nine M19 private UI scenarios listed below were re-run on the integrated M15 source, passing 97 checks: launch concurrency, dock/window controls, app limit, overview, Finance windowing, package recovery, pending-write restart protection, App Explorer/usability and launch feedback. The updated JSON reports below are the M15 integration runs.

`npm run test:updates` was also attempted through the private UI runner. It timed out after 15 seconds waiting for the initial fixture app to reach runtime-ready, before any update assertions ran. The root unit suite, including update tests, passed. A prior broad integration run stopped during fixture startup at `catalogue-ready`; it did not reach its scenarios.

## M19.1 Dock click reliability

Private UI run: `node tools/run-ui-test.mjs tests/app-launch-concurrency.mjs` — passed four checks. It delays app discovery, confirms the second app click is retained, opens both apps once, activates an existing app on repeat click, and preserves the third-app capacity prompt. Focused unit test: `npm test -- --maxWorkers=1 tests/appLaunchLock.test.ts` — 2/2 passed.

Report: [concurrent launch](../../artifacts/m19-app-launch-concurrency-verification.json).

## M19.2 Window controls and V1 flow

All checks ran through the private UI runner on Linux:

| Command | Result | Report |
| --- | --- | --- |
| `node tools/run-ui-test.mjs tests/dockapps.mjs` | 18 checks passed: correct app windows, two-app cap, activate, maximize/restore, minimize/restore, close/reopen, dock fit, no renderer errors | [Dock](../../artifacts/m19-dockapps-verification.json) |
| `node tools/run-ui-test.mjs tests/open-app-limit.mjs` | 3 checks passed: third-app dialog, cancel, choose an app to close | [App limit](../../artifacts/m19-open-app-limit-verification.json) |
| `node tools/run-ui-test.mjs tests/overview.mjs` | 19 checks passed: two-window overview, switching, restored minimized app, geometry and narrow display | [Overview](../../artifacts/m19-overview-verification.json) |
| `node tools/run-ui-test.mjs tests/finance.mjs` | 12 checks passed: Finance module selection, second-app switching, controls, overview, close/reopen | [Finance](../../artifacts/m19-finance-verification.json) |

## M19.3 App failure and recovery

Private runtime/UI checks passed:

| Command | Result | Report |
| --- | --- | --- |
| `node tools/run-ui-test.mjs tests/packages.mjs` | 13 checks passed: renderer crash isolation, other-app interaction, dirty-work close protection, restart/reopen, package-integrity failure and retry | [Package recovery](../../artifacts/m19-packages-recovery-verification.json) |
| `node tools/run-ui-test.mjs tests/pending-write-restart.mjs` | 5 checks passed: unknown server outcome blocks restart while the shell and another app remain usable; original operation is reconciled | [Pending-write restart](../../artifacts/m19-pending-write-restart-verification.json) |

## M19.4 Test alignment and launch feedback

Private UI runs passed:

| Command | Result | Report |
| --- | --- | --- |
| `node tools/run-ui-test.mjs tests/m12-usability.mjs` | 11 checks passed: current App Explorer flow, Finance package launch, reduced-motion minimize/restore and preserved app state | [Usability](../../artifacts/m19-usability-verification.json) |
| `LAUNCH_FEEDBACK_APP=company.dental.appointments node tools/run-ui-test.mjs tests/app-launch-feedback.mjs` | 12 checks passed; foreground hold observed at 1935 ms, app content fade 260 ms, handoff completed | [Launch feedback](../../artifacts/m19-app-launch-feedback-verification.json) |

## Shared checks and limitations

- The integrated-source build and full unit suite results are recorded above; the full suite passed 520/520.
- A broad `node tools/run-ui-test.mjs tests/integration.mjs` attempt on the earlier audit source did not reach its scenarios: fixture startup stopped at `catalogue-ready`. Dedicated M19 UI scenarios passed independently and were re-run on M15 above.
- `python3 tools/check-dental-docs.py` and `git diff --check` are run after this ledger is updated.

All retained JSON reports are M19-specific; older milestone reports were restored and are not overwritten. Genie remains presentation-only. No new gate is created, and M19 does not close G12, G15, G20, or G21.

The [fingerprint manifest](../../artifacts/m19-source-fingerprint.sha256) retains the M19 source file list and per-file SHA-256 digests. All 15 entries matched on the integrated M15 source.
