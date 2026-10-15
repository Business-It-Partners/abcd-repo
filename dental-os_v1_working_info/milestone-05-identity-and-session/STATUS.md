# M05 Status — Single login and protected sessions

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M04](../milestone-04-sdk-and-api-broker/PLAN.md)

## Remaining work

- Use approved staging accounts to test real login, token renewal, denial, disabled access and unavailable backend.
- Test unavailable/inadequate Linux key storage: session-only behavior and no plaintext persisted credentials.
- Switch users during in-flight responses/writes; old data never enters the new session; no app receives password/refresh token.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
