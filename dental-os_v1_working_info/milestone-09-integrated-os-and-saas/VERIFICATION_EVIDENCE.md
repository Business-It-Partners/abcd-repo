# M09 Verification Evidence — Integrated OS and SaaS contract proof

**Milestone verification:** local gates passed; staging/Windows pending.
**Date:** 2026-10-16. Branch codex/milestone-09, source identified by the commit containing this evidence. No acceptance tag until final gates pass.

## Executed local gates

Linux x64, installed locked dependencies; private headless GNOME/Wayland display, isolated disposable profiles. One heavy job at a time, conservative single unit worker, timeouts and post-run cleanup. User desktop/session preserved.

- Build/typecheck: `npm run build`, exit 0. [Log](evidence/dental-m09-integration-build.log).
- `node node_modules/vitest/vitest.mjs run --maxWorkers=1` with JSON reporter: 242 tests / 11 files pass. [Report](evidence/m09-unit.json), [log](evidence/dental-m09-unit-final.log).
- Focused private runner integration, SDK, identity, runtime, distribution and updates suites: 102 checks pass (20/15/21/28/10/8). [Log](evidence/dental-m09-private-regressions.log), [integration](evidence/integration-verification.json), [identity](evidence/identity-verification.json), [runtime](evidence/runtime-verification.json), [distribution](evidence/distribution-verification.json), [updates](evidence/updates-verification.json).
- Integrated fixture proves pending/unknown close and update refusal, one original idempotency key, conflict/replay, read-only app denial, lock/account partition erasure and password/storage/draft canaries absent from closed private profile.

## Outstanding gates and limits

Actual staging representative operation and cleanup, existing-client reachability/access smoke and Windows Actions remain pending. Physical Windows-device/visual acceptance is deferred after M11/before release. Sample platform/API proof does not deliver full dental workflow UI. Production untouched.
