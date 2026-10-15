# M02 Verification Evidence — Trusted host and OS state

**Result:** Linux checks pass; Windows device verification pending; full cross-host milestone not VERIFIED.
**Date:** 2026-10-15. Source is the uncommitted tree; [source hashes](evidence/source-manifest.json) identify changed implementation/checker files. No commit or push.

## Executed sequential checks

| Command | Outcome | Evidence |
| --- | --- | --- |
| `nice -n 10 timeout 60s npm test -- --maxWorkers=1` | exit 0; 35 tests / 4 files | [unit log](evidence/unit.log) |
| `nice -n 10 timeout 90s npm run build` first attempt | exit 1; missing Node test types | [retained failure](evidence/build-initial-failure.log) |
| same build after type-reference repair | exit 0; typecheck and production build | [build log](evidence/build.log) |
| `nice -n 10 timeout 180s node tools/run-ui-test.mjs tests/host-state.mjs tests/native-session.mjs` | exit 0; suites ran sequentially on private GNOME/Wayland | [log](evidence/private-ui.log) |

[Host-state cases](evidence/host-state-verification.json): ready, default preference, invalid field refusal, full-exit persistence, disabled shortcut, corrupt-state recovery, absence of privileged recovery bridge and preserved corrupt bytes. Positive enabled-shortcut control also executed. [Native continuity report](evidence/native-session-verification.json) verifies installed-launcher reactivation, native identity, fullscreen/minimize geometry, retained drafts/rows/focus and no renderer errors.

Unit cases bind R10/G02 to journal/state interruption, v0 migration, malformed/future/oversized data preservation, low-space failure, conflicting journal refusal, symlink refusal and private generated file modes. These are filesystem tests and injected capacity/fault cases, not physical power-loss certification or a complete privacy audit.

Host: Linux 6.8.0-111-generic, Node v22.13.1; private GNOME/Wayland virtual display, isolated user-data profiles and software rendering. Build/unit/private jobs ran one at a time with bounded timeouts and lower priority. Preflight found adequate available memory and no identified stale task-owned build/test loop. No unrelated process was terminated. Runner/compositor processes exited after completion; live OS/Brave remained untouched.

## Pending

Named Windows device/build evidence for activation, state permissions/durability behavior, recovery and minimize/restore. User visual acceptance is separate. No M03 start, backend changes, cloud resources, deployments or authenticated-session claims. New build loads only after a future user-controlled full relaunch; the existing session was preserved.

## GitHub setup revision — 2026-10-15

The user superseded the immediate physical Windows requirement: applicable Windows GitHub CI is now the milestone gate; physical checks remain deferred until after M11 and before final product release. Earlier pending-device wording above is retained as historical scope. Windows CI is pending publication/run; no result is inferred.

Portable tests now use platform-specific directory-fsync/mode policy. Linux local single-worker unit suite: 36 tests pass. Windows skips the POSIX-specific file-symlink case and runs a portable directory-junction rejection case; private POSIX modes are asserted only on Linux. Dedicated GitHub-Windows smoke checks boot, preference restart and corrupt-state recovery without launching on the user's desktop. No physical Windows interaction is certified.

## First Windows Actions result

[Run 38777592561](https://github.com/Business-It-Partners/dental-os/actions/runs/38777592561) at source 24470d84a55817440f1282e3ffc03c8cf8011bb1 passed. Retained [run metadata](evidence/windows-ci/run.json), [unit log](evidence/windows-ci/windows-unit.log), [build log](evidence/windows-ci/windows-build.log) and [host smoke](evidence/windows-ci/windows-host-ci.json). Windows: 35 passed, one POSIX file-symlink case skipped; directory-junction refusal runs on Windows. Hosted boot, full-restart persistence and no-preload corrupt-state recovery pass. Physical desktop interaction remains deferred.

Workflow follow-up: direct Vitest invocation makes worker/reporter arguments explicit and produces missing JSON; artifact upload is narrowed to new logs only. Local direct command passes 36 tests and emits JSON. Latest workflow revision awaits its own Windows run before final closeout.
