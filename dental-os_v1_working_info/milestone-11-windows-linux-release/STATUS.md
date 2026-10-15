# M11 Status — Windows/Linux release and operations

**Status:** PLANNED
**Updated:** 2026-10-15.
**User acceptance:** pending; no production acceptance claimed.

## Current position

No milestone-governed implementation or verification has started. Existing prototype work must be reconciled against this plan before it can satisfy any exit criterion.

**Dependencies:** [M10](../milestone-10-security-resilience-and-usability/PLAN.md)

## Remaining work

- Clean-device and upgrade tests on each supported Windows/Linux target; installation permissions and secret providers verified.
- Platform update interruption/restart/recovery with installed app compatibility and dirty-work protection.
- Complete G01–G11/R01–R15 evidence review, authentic release artifacts, rollback/revocation drill and operations handoff.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.

## Prototype packaging experiment

On 2026-10-15 the user separately authorized a local unsigned Windows x64 installer of the existing prototype for device testing. See [work contract](../../WORK_CHECKLIST.md) and [preview instructions](../../tools/desktop-release/WINDOWS_PREVIEW.md). This experiment does not bypass M10, freeze the production installer/update choice, or satisfy G11. This milestone remains PLANNED; Windows installation/runtime and production certification remain unverified.
