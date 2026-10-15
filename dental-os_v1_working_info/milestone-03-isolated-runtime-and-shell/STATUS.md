# M03 Status — Isolated runtime and shared shell

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M02](../milestone-02-host-and-os-state/PLAN.md)

## Remaining work

- Prove overlap, z-order, clipping, scoped dialogs, fullscreen, resize, keyboard focus, overview, dock reveal and Genie.
- Reject cross-app storage, unapproved navigation, Node/host privilege and forged runtime identity.
- Crash/hang one sample runtime and record actual containment; repeat close/minimize/restore and inspect leaked resources.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.
