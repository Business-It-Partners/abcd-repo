# M09 Verification Evidence — Integrated OS and SaaS contract proof

**Milestone verification:** G09 VERIFIED for configured samples, actual staging and automated Linux/Windows.
**Date:** 2026-10-16. Branch codex/milestone-09, source identified by the commit containing this evidence. No acceptance tag until final gates pass.

## Executed local gates

Linux x64, installed locked dependencies; private headless GNOME/Wayland display, isolated disposable profiles. One heavy job at a time, conservative single unit worker, timeouts and post-run cleanup. User desktop/session preserved.

- Build/typecheck: `npm run build`, exit 0. [Log](evidence/dental-m09-integration-build.log).
- `node node_modules/vitest/vitest.mjs run --maxWorkers=1` with JSON reporter: 242 tests / 11 files pass. [Report](evidence/m09-unit.json), [log](evidence/dental-m09-unit-final.log).
- Focused private runner integration, SDK, identity, runtime, distribution and updates suites: 102 checks pass (20/15/21/28/10/8). [Log](evidence/dental-m09-private-regressions.log), [integration](evidence/integration-verification.json), [identity](evidence/identity-verification.json), [runtime](evidence/runtime-verification.json), [distribution](evidence/distribution-verification.json), [updates](evidence/updates-verification.json).
- Integrated fixture proves pending/unknown close and update refusal, one original idempotency key, conflict/replay, read-only app denial, lock/account partition erasure and password/storage/draft canaries absent from closed private profile.

## Initial outstanding gates — superseded by final acceptance below

Actual staging representative operation and cleanup, existing-client reachability/access smoke and Windows Actions remain pending. Physical Windows-device/visual acceptance is deferred after M11/before release. Sample platform/API proof does not deliver full dental workflow UI. Production untouched.

## Final G09 acceptance

Final source `54be1c0609f367a784de9d06516964da157e6e3e`, checkpoint/m09-ci. [Source hashes](evidence/source-sha256.json). Linux final private integration 21 checks ([report](evidence/integration-final-linux.json), [log](evidence/integration-final-linux.log)); final Electron compiler and prior full build/unit evidence above. Changes after initial unit run affect runtime configuration/test harness; final Windows reruns complete unit/build and all applicable desktop gates.

Actual staging 21 desktop checks pass ([report](evidence/integration-staging-desktop.json), [log](evidence/staging-acceptance.log)). [Rollout](evidence/integration-staging-rollout.json) records immutable 1.2.2→1.2.3, sequences 10–11 and exact hashes. Original successful write response is dropped once; same-key retry/replay returns arrived revision 2, new-key stale revision conflicts, independent read confirms one server truth. Close/update cannot drop unresolved writes. Both apps install/update/uninstall through the real runtime and shared clinic identity. Lock/logout erase partition/previews, closed profile has no password/private draft/storage canary. No privacy-scan file exclusions.

[Cleanup](evidence/integration-staging-cleanup.json) confirms owned synthetic appointment cancelled, doctor inactive; normal audit/receipts remain. Earlier attempts/cleanup/investigation are retained, never relabeled passed. Three owned fixture pairs in total were created and audited/cleaned. No existing clinical record edit, SQL, Firebase user, Worker business/auth/config/schema/binding deployment or production operation. Existing staging clinic and Super Admin clients reachable; clinic token denied platform tenants. Reachability is not positive privileged Super Admin UI acceptance. Backend SYS-0007 has 15 focused ownership negatives and unchanged shared service source.

241 passed / one POSIX-only skip (242 total). [Windows CI 38922410037](https://github.com/Business-It-Partners/dental-os/actions/runs/38922410037) passes full unit/build, 21 integrated, 12 update process-exit/8 update, 10 Store, 8 package process-exit/8 package, 4 host, 28 runtime, 15 SDK and 21 identity checks. [Retained run](evidence/windows-ci/run.json), [units](evidence/windows-ci/windows-unit.json), [integration](evidence/windows-ci/windows-integration.json). Earlier failed assertion run retained under evidence/windows-first-failed. Physical Windows/user visual acceptance stays pending.

Evidence-only closeout/normal merge must match source hashes, requiring lightweight doc/hash verification rather than repeating passing heavy suites. All owned test displays/apps/publisher Workers finished; protected credential and successful cleanup journal removed. M10 follows under standing authorization; M11 and production release remain separate.
