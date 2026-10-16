# M07 Status — First-party store and Cloudflare delivery

**Status:** IMPLEMENTED
**Updated:** 2026-10-16.
**User acceptance:** pending; no production acceptance claimed.

## Current position

User authorized the next sprint (M07). Desktop and isolated staging backend implementation/local verification complete. Windows CI 38850865178 passes at 8554c1bc (187 tests pass / one POSIX skip plus build and all Store/package/host/runtime/SDK/identity gates). Actual G07 catalogue/R2 acceptance remains pending. User explicitly authorized scoped staging rollout and continuous M07–M10 work; provisioning/publication complete, deployment/live acceptance in progress.

**Dependencies:** [M06](../milestone-06-verified-packages/PLAN.md)

## Remaining work

- Deliver a staging fixture through actual catalogue and R2; verify bytes, identity, authorization, expiry and bounded download.
- Refuse replayed/withdrawn/incompatible releases, altered metadata, unauthorized install policy and URL/token leakage.
- Catalogue outage and interrupted download leave installed apps coherent; readiness follows registry success, not animation completion.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.

**Next gate:** actual staging API/catalogue/install acceptance and refreshed Windows evidence for the verified public origin. M07 remains unverified/unmerged until this passes. No acceptance checkpoint tag yet. M08 not started.
