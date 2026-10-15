# M07 Status — First-party store and Cloudflare delivery

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M06](../milestone-06-verified-packages/PLAN.md)

## Remaining work

- Deliver a staging fixture through actual catalogue and R2; verify bytes, identity, authorization, expiry and bounded download.
- Refuse replayed/withdrawn/incompatible releases, altered metadata, unauthorized install policy and URL/token leakage.
- Catalogue outage and interrupted download leave installed apps coherent; readiness follows registry success, not animation completion.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
