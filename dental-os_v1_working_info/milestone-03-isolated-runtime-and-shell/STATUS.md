# M03 Status — Isolated runtime and shared shell

**Status:** VERIFIED — automated Linux/Windows scope; physical Windows testing deferred.
**Updated:** 2026-10-16.
**User acceptance:** pending; no production release acceptance claimed.

## Current position

Two fixed isolated sample apps pass G03 on Linux and hosted Windows. Independent sandboxed processes/origins/partitions, denied privilege/navigation/storage crossover, owner-scoped lifecycle, native focus, crash/hang containment and shared shell/overview/dock/Genie composition are verified within the declared fixture scope. See [evidence](VERIFICATION_EVIDENCE.md) and [composition decision](decisions/ADR_RUNTIME_001_VIEW_COMPOSITION.md).

Tested checkpoint after the reference-history rewrite: `ce58156ef1bc8fc373c751412d0be51cb8f3529f` (`checkpoint/m03-ci`); original executed CI source was `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a`. The translation map preserves that evidence relationship. M03 was integrated into main on 2026-10-16 under explicit user authorization. The milestone branch/checkpoint tags are retained unchanged. M04 has not started.

**Dependencies:** [M02](../milestone-02-host-and-os-state/PLAN.md)

## Remaining acceptance boundaries

Physical Windows clipping/compositing/input/scaling and performance checks remain mandatory after M11/before final release. User visual acceptance is separate. Inactive windows display snapshots and activation clicks are not replayed. Production SDK, verified installed bundles, auth, updates and finished dental modules remain later milestones/separate delivery. No backend/cloud changes.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. Windows evidence follows the approved hosted-CI/physical-device deferral policy. Update global status with milestone status.
