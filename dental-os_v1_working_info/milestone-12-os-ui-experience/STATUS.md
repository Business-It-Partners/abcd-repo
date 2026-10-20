# M12 Status — Dental OS workspace and shell experience

**Status:** IMPLEMENTING — M12.1–M12.5 implemented for tested Linux/private-display scope; M12.6 and G12 remain open.
**User acceptance:** not started.
**Active branch:** `codex/milestone-12-shell`, created from M11-integrated `main` (`8c8211c0`). A pre-existing `codex/milestone-12` branch is retained unchanged; it is based before M11's final integration.

## Phase tracking

| Phase | Status | Notes |
| --- | --- | --- |
| M12.1 — Desktop status bar | IMPLEMENTED — tested Linux/private-display scope | Compact blue-gray frosted-glass bar (31px desktop / 59px narrow) shows active app, functional Apps/Windows/Help actions, browser network state, and local date/time; no session-action chips. Reduced-transparency fallback remains available. |
| M12.2 — Desktop widgets and dock presentation | IMPLEMENTED — tested Linux/private-display scope | Three-card Bikram Sambat/time/Gregorian layout highlights today in the Nepali grid without a duplicate date row; frosted glass, width-responsive dock and thumbnails, and 20% lower hover magnification are covered by private UI/unit checks plus shared Genie regressions. |
| M12.3 — Workspace information architecture and app discovery | IMPLEMENTED — focused package-module path verified on Linux/private display | [Workspace flow map](WORKSPACE_FLOW_MAP.md) maps sign-in, app discovery, delivery, window switching, session changes and recovery. Installed multi-module apps preflight verified metadata at dock/Store launch, apply clinic role/capability filtering and open the OS explorer before their managed window. A signed synthetic multi-module package verifies explorer discovery, initial selection, running selection changes and preview refresh. Broader user acceptance remains open. |
| M12.4 — Multiwindow work continuity | IMPLEMENTED — tested Linux/private-display scope | Full work-area fit, 12px dock gap, dock hover only inside its visible sheet, magnification contained within the sheet, reachable side/bottom/corner resize edges, bounded 70% edge hiding, per-window dock-top clipping that preserves the full-screen Genie overlay, native-surface hiding and fresh full-resolution preview capture, always-visible right-side green/yellow/red controls, keyboard and pointer operation, app dialogs, focus/stacking and safe return are covered by 50 window checks plus 45 runtime checks and DPR 2 capture. |
| M12.5 — System and delivery feedback surfaces | IMPLEMENTED — tested Linux/private-display scope | Accessible Store progress, success/update-ready and outage feedback; installed-app ready notice; sign-in/lock/session changes; failed-update rollback and recovery guidance are covered by private UI flows. Presentation consumes trusted identity/distribution/runtime state. |
| M12.6 — Accessibility, fit and integrated usability | PLANNED | Focused integrated accessibility/usability review remains; physical Windows review remains after M20 under G21. |

## Current position

M12 follows M11 app onboarding/update work and precedes M13 app-shell releases. Its purpose is to make the signed-in workspace understandable: users can orient, find/open company apps, work across managed windows, see system and delivery state, and recover from visible errors. Shell navigation and window behavior stay in the shared Electron shell; clinical UI and session data stay with their app; M11 remains authority for package trust and updates. M14 owns functional Dental OS apps, while M20 owns platform host release operations.

On 2026-10-20 the user directed completion of M12.3, M12.4 and M12.5 in this pass. The reviewed [workspace flow map](WORKSPACE_FLOW_MAP.md) records each journey, its owning component/service, expected state and proof. The existing Apps/Store, installed-app dock, Windows overview and shared Genie path form the discover/open/switch/return loop. M12.4 tests cover focus and stacking, minimize/restore, fullscreen/resize, app-owned dialogs, keyboard controls, work-area bounds and draft preservation. M12.5 surfaces authoritative state with accessible feedback; the Store outage path keeps verified installed apps available, blocks new installs, and allows retry. The ready-to-open notice provides an app launch action. The internal SDK's `notifications.show` remains a scoped receipt for the app's own presentation, as defined by the SDK contract; M12 does not claim a native OS notification center.

The package-driven M12.3 extension makes the signed installed bundle, rather than a Finance-only mock, the source of app identity and visible module entries. The OS verifies installed metadata without starting the app, applies the current clinic role/capability filter, opens the shared explorer for multiple visible modules, and starts one-module apps directly. Focused private UI verification now covers manifest discovery, first selected-module rendering, a running module switch, and the subsequent dock-edge mirror. The full milestone remains subject to the broader workspace-flow and user-acceptance gates; G12 and user visual acceptance remain open.

The current evidence is Linux/private-display automation with synthetic identities and packages. It is not user visual acceptance, physical Windows certification, or final product release. M12.6 and G12 remain open; user visual acceptance has not started. Physical Windows-device review remains under G21 after M20. The clinic widget uses a monogram because this checkout has no approved logo asset; no weather, appointments or clinical data are fabricated.

## Status rules

Track each phase against its plan and retain failed runs. Mark G12 VERIFIED only when all phase criteria pass with exact source/build/host evidence. User visual acceptance remains separate; no final product release is inferred from M12 completion.
