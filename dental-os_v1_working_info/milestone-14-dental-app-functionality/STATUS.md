# M14 Status — Functional Dental OS apps

**Status:** DEFERRED as the active app implementation path. M14 is a separate historical milestone; its code and branch are not inputs to M17. G14 remains open.
**Updated:** 2026-10-23.
**Branch:** historical M14 records remain here; M17 uses its own documented baseline and does not inspect or import the M14 branch.

M14 currently has an overview and app-level submilestone names only. The user directed that detailed per-app plans be written after M13 is complete. No functional-app implementation or acceptance is claimed.

M14.1 Follow-ups; M14.2 Appointments; M14.3 Work Entry; M14.4 Patient Record; M14.5 Treatment Progress; M14.6 Lab Tracker; M14.7 Finance; M14.8 Patient Payments; M14.9 Staff; M14.10 Treatment Protocols; M14.11 Calendar.

## M15 coordination amendment — 2026-10-21

The user adopted [M15 Platform Closeout and Integration](../milestone-15-platform-closeout-and-integration/PLAN.md) during P03. The [central checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) tracks remaining platform work; this amendment changes coordination/dependencies, not historical evidence or acceptance.
The active maintained app plan/checklist is on [the separate M14 branch](https://github.com/Business-It-Partners/dental-os/tree/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality). Its newer app order/plans supersede the older local overview above; do not reset that external work. App implementation proceeds in parallel. Final G14 integrated acceptance requires M13/G13 and M15/G15, with actual app evidence; a mock or shell CI pass is insufficient. This platform amendment is not an edit to the active app branch.

## M17 source-boundary clarification — 2026-10-23

The earlier 2026-10-22 realignment draft said M17 would review or import M14 code; that statement is superseded. The user clarified that M17 has no relationship to M14 and must not use its branch or files. M17 starts from its own documented M17 baseline and the pinned Dental SaaS modules, with the current Dental OS SDK/platform contract. M14 remains only its separate historical record; this clarification does not complete M14 or close G14. See [M17 Plan](../milestone-17-dental-app-delivery/PLAN.md).
