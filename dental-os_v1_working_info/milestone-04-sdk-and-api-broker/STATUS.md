# M04 Status — Internal SDK and API boundary

**Status:** IMPLEMENTING
**Updated:** 2026-10-16.
**User acceptance:** pending; no production acceptance claimed.

## Current position

SDK/broker implemented; Linux 64 unit/local-HTTP tests, build and private SDK/M03 regressions pass. Hosted Windows gate pending. No real identity acceptance claimed.

**Dependencies:** [M03](../milestone-03-isolated-runtime-and-shell/PLAN.md)

## Remaining work

- Negative cases: spoofed app/frame, malformed/oversized requests, forbidden URLs/redirects/channels and stale sessions.
- Transport fixtures prove conflict, timeout, 401/403/503, ambiguous write result and preserved idempotency semantics.
- Compatible/incompatible SDK handshake and cleanup; no arbitrary authenticated fetch, token getter or direct app messaging.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
