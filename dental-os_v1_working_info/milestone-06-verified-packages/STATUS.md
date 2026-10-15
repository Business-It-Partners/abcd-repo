# M06 Status — Verified packages and local lifecycle

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M05](../milestone-05-identity-and-session/PLAN.md)

## Remaining work

- Reject unsigned/altered assets/manifests, unknown publishers/IDs, incompatible SDK/API, invalid entry paths and forged identity.
- Test traversal, links/reparse points, excessive expansion/count, disk exhaustion, concurrent operations and crash checkpoints.
- Restart resolves pending operations; only active verified bytes execute; uninstall affects neither SaaS records nor other app files.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
