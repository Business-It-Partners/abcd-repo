# M12 Status — Dental OS workspace and shell experience

**Status:** IMPLEMENTING — M12.1 status bar and M12.2 desktop widgets implemented for tested Linux/private-display scope; broader M12 work remains.
**User acceptance:** not started.
**Active branch:** `codex/milestone-12-shell`, created from M11-integrated `main` (`8c8211c0`). A pre-existing `codex/milestone-12` branch is retained unchanged; it is based before M11's final integration.

## Phase tracking

| Phase | Status | Notes |
| --- | --- | --- |
| M12.1 — Desktop status bar | IMPLEMENTED — tested Linux/private-display scope | Compact blue-gray frosted-glass bar (31px desktop / 59px narrow) shows active app, functional Apps/Windows/Help actions, browser network state, and local date/time; no session-action chips. Reduced-transparency fallback remains available. |
| M12.2 — Desktop widgets and dock presentation | IMPLEMENTED — tested Linux/private-display scope | Three-card Bikram Sambat/time/Gregorian layout highlights today in the Nepali grid without a duplicate date row; frosted glass, width-responsive dock and thumbnails, and 20% lower hover magnification are covered by private UI/unit checks plus shared Genie regressions. |
| M12.3 — Workspace information architecture and app discovery | PLANNED | Map journeys and refine navigation after the two requested desktop surfaces. |
| M12.4 — Multiwindow work continuity | IN PROGRESS — window fit, edge hiding and controls implemented | Normal and maximized windows fit below the status bar, with a 12px gap above the dock. Dragging can hide 70% past the bottom or either side while preserving a 30% grab area; the top stays below the status bar. Always-visible circular maximize/minimize/close controls are on the right in green/yellow/red order; circles are 16.6725px, 10% below the previous 18.525px size, with centered 8.748px maximize/restore and 10.206px minimize/close symbols. Inactive app mirrors use native capture dimensions, removing the stretch blur; existing window shadows remain. Native app surfaces hide synchronously before focus changes to shell windows/overview. Focus, stacking, minimize/restore and full phase acceptance remain open. |
| M12.5 — System and delivery feedback surfaces | PLANNED | Presentation consumes trusted platform state; it does not decide app trust/update authorization. |
| M12.6 — Accessibility, fit and integrated usability | PLANNED | Physical Windows review remains after M13 under G14. |

## Current position

M12 follows M11 flexible app onboarding/update work and precedes M13 host release operations. The first user-directed task removed the prototype footnote and white backing behind session controls while preserving lock/account/sign-out; that cleanup is preparatory and is not phase acceptance. On 2026-10-20 the user directed M12.1 to add a desktop status bar with active app, network and date/time, and M12.2 to add wallpaper widgets. The user then asked to remove the top-right session-action chips; these are available from a compact options menu on the clinic widget. Account and clinic data come from the authenticated session. The expanded M12.2 right-side collection contains a Bikram Sambat calendar, time and Gregorian calendar; today is highlighted in the Nepali month grid without a duplicate standalone date row. Widgets and dock use the supplied frosted-glass treatment; dock sizing responds to display width; hover magnification is reduced by 20%. The expanded work is implemented for tested Linux/private-display scope; exact evidence and limitations are in VERIFICATION_EVIDENCE.md. This checkout has no clinic logo asset; the clinic widget uses a monogram. Do not add weather, fabricated appointments or clinical data. M12.1 and M12.2 are implemented for tested scope; M12.3, M12.5 and M12.6 remain PLANNED, M12.4 is partially implemented, and G12 stays open. User visual acceptance remains separate.

On 2026-10-20 the user directed the first M12.4 window-fit behavior: normal app windows should use the full vertical work area, touching the status bar, then requested a small gap above the dock. The shared geometry now matches responsive status-bar height and leaves 12px before the dock for initial placement, movement and resizing. This is a partial M12.4 implementation; broader lifecycle continuity and verification remain open.

The user then directed recoverable edge hiding and right-aligned window controls. Window dragging now permits 70% of its width past either side and 70% of its height past the bottom, leaving the remainder visible to grab; the top remains clamped below the status bar. The title-bar controls are right-aligned, always visible, use green/yellow/red maximize/minimize/close order, and have 18.525px circles with smaller centered symbols. Inactive app mirrors now use native capture resolution instead of 640px thumbnails stretched across a window; this removes the blur while leaving window shadows unchanged. Maximized windows start below the status bar and leave a 12px dock gap. A runtime focus change hides old native app surfaces synchronously before a shell window/overview paints. Focused private checks pass; full M12.4 acceptance remains open.

## Status rules

Track each phase against its plan and retain failed runs. Mark G12 VERIFIED only when all phase criteria pass with exact source/build/host evidence. User visual acceptance remains separate; no final product release is inferred from M12 completion.
