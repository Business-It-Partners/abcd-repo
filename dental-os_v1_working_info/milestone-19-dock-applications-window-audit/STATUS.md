# M19 Status — Dock, Applications, and Window Audit

**Status:** VERIFIED
**Updated:** 2026-10-26.
**Worktree:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os.
**Branch/source baseline:** codex/milestone-15 / deb6d231 (M19 runtime source integrated from the audit worktree).
**User acceptance:** implementation and automated Linux/private UI verification complete; manual user acceptance is separate.
**Gate:** no separate G19; existing G12/G15/G20/G21 statuses are unchanged.

## Current position

The per-app launch lock now allows a click on a second app while another app's discovery is in flight. Current-source private UI checks cover the two-app policy, dock activation, minimize/restore, maximize/restore, close/reopen, isolated renderer crash/restart, unknown-write restart protection, reduced-motion behavior, and launch feedback. Older Finance, dock, overview, and usability tests now match current V1 app/window behavior. Genie remains visual-only.

On the integrated M15 source, `npm run build` passed, all 520 root unit tests passed, and nine M19 private UI scenarios passed 97 checks. All 15 files in the M19 source fingerprint match. The separate Store update UI runner timed out waiting for its first fixture app to become runtime-ready before reaching its assertions; the update unit tests passed in the root suite. An earlier broad integration run stopped at fixture `catalogue-ready` before its scenarios. These limitations are recorded in [the evidence ledger](VERIFICATION_EVIDENCE.md); they do not replace or negate the passing dedicated M19 scenarios.

## Submilestone status

| Submilestone | Status | Completion evidence |
| --- | --- | --- |
| [M19.1 Dock click reliability](M19.1_DOCK_CLICK_RELIABILITY_PLAN.md) | VERIFIED | Delayed-discovery concurrency UI report and focused unit tests |
| [M19.2 Window controls and V1 flow](M19.2_WINDOW_CONTROLS_PLAN.md) | VERIFIED | Dock, Finance, overview, and app-limit private UI reports |
| [M19.3 App failure and recovery](M19.3_APP_RECOVERY_PLAN.md) | VERIFIED | Renderer/package recovery and pending-write restart private UI reports |
| [M19.4 Test alignment and launch feedback](M19.4_TEST_ALIGNMENT_PLAN.md) | VERIFIED | Updated UI scripts and launch-feedback private UI report |

## Completion conditions

- All four submilestones have source-bound verification reports.
- No M19 issue silently expands the two-app V1 window policy.
- The dock launch race is covered by a regression test.
- Current-source private UI evidence covers the window-control flow and isolated app recovery.
- The launch-feedback check verifies the handoff state reliably.
- The Genie effect remains optional visual polish with reduced-motion and failure fallbacks.

M19 completion does not close G12, G15, G20, or G21 and does not certify final product release.
