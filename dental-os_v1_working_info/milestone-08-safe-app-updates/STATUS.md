# M08 Status — Safe independent application updates

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M07](../milestone-07-store-and-distribution/PLAN.md)

## Remaining work

- Run old app during new download: unchanged running assets/session; next permitted launch selects verified successor.
- Inject interruption at every persistence/activation boundary, repeated operations and failed health checks.
- Test dirty work, ambiguous in-flight writes, incompatible rollback, revoked versions, key rotation and storage exhaustion.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
