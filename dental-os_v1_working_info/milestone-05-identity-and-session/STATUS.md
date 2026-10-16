# M05 Status — Single login and protected sessions

**Status:** VERIFIED — Linux/Windows automation and live staging identity
**Updated:** 2026-10-16.
**User acceptance:** pending; no production acceptance claimed.

## Current position

G05 passed in the declared scope. Linux 77 tests/build/private regressions and real staging CLI/desktop identity checks pass. Windows run 38845000521 passed 76 tests with one POSIX-specific skip, build, host/runtime/SDK and all identity/privacy checks. Tested source `07c2fb21575dc6b575ad664a9bb3b3466c0fd6e3` / `checkpoint/m05-ci`. Verified M05 is integrated into main; milestone branch/checkpoint retained. User asked to stop after M05; M06 has not started. Physical-device and production release acceptance remain pending.

**Dependencies:** [M04](../milestone-04-sdk-and-api-broker/PLAN.md)

## Remaining work

- Use approved staging accounts to test real login, token renewal, denial, disabled access and unavailable backend.
- Test unavailable/inadequate Linux key storage: session-only behavior and no plaintext persisted credentials.
- Switch users during in-flight responses/writes; old data never enters the new session; no app receives password/refresh token.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
