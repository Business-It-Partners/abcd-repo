# M04 Status — Internal SDK and API boundary

**Status:** VERIFIED — automated Linux/Windows fixture scope
**Updated:** 2026-10-16.
**User acceptance:** pending; no production acceptance claimed.

## Current position

G04 passed for the declared fixture boundary. Linux: 64 unit/local HTTP tests, build and private SDK/M03/DPR checks pass. Windows run 38842666568 passes all applicable checks. Tested source/checkpoint: `672a81180336b535d90ee9c2d92917354dc1c6e5` / `checkpoint/m04-ci`. Integrated into main under standing authorization; milestone branch retained. Real identity is M05.

**Dependencies:** [M03](../milestone-03-isolated-runtime-and-shell/PLAN.md)

## Remaining work

- Negative cases: spoofed app/frame, malformed/oversized requests, forbidden URLs/redirects/channels and stale sessions.
- Transport fixtures prove conflict, timeout, 401/403/503, ambiguous write result and preserved idempotency semantics.
- Compatible/incompatible SDK handshake and cleanup; no arbitrary authenticated fetch, token getter or direct app messaging.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
