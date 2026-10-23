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
| M12.6 — Accessibility, fit and integrated usability | IMPLEMENTING — focused P06 and fullscreen-chrome follow-up checks pass on Linux private display | Explorer keyboard focus and return, reduced motion, scaling, overview fit and multiwindow preview are covered. Fullscreen windows now fill the viewport beneath auto-hiding statusbar/dock overlays; window and native app content geometry stays fixed as the bars reveal. Full workspace journey, required user visual acceptance and G21 device review remain. |

## Current position

M12 follows M11 app onboarding/update work and precedes M13 app-shell releases. Its purpose is to make the signed-in workspace understandable: users can orient, find/open company apps, work across managed windows, see system and delivery state, and recover from visible errors. Shell navigation and window behavior stay in the shared Electron shell; clinical UI and session data stay with their app; M11 remains authority for package trust and updates. M14 owns functional Dental OS apps, while M20 owns platform host release operations.

On 2026-10-20 the user directed completion of M12.3, M12.4 and M12.5 in this pass. The reviewed [workspace flow map](WORKSPACE_FLOW_MAP.md) records each journey, its owning component/service, expected state and proof. The existing Apps/Store, installed-app dock, Windows overview and shared Genie path form the discover/open/switch/return loop. M12.4 tests cover focus and stacking, minimize/restore, fullscreen/resize, app-owned dialogs, keyboard controls, work-area bounds and draft preservation. M12.5 surfaces authoritative state with accessible feedback; the Store outage path keeps verified installed apps available, blocks new installs, and allows retry. The ready-to-open notice provides an app launch action. The internal SDK's `notifications.show` remains a scoped receipt for the app's own presentation, as defined by the SDK contract; M12 does not claim a native OS notification center.

The package-driven M12.3 extension makes the signed installed bundle, rather than a Finance-only mock, the source of app identity and visible module entries. The OS verifies installed metadata without starting the app, applies the current clinic role/capability filter, opens the shared explorer for multiple visible modules, and starts one-module apps directly. Focused private UI verification now covers manifest discovery, first selected-module rendering, a running module switch, and the subsequent dock-edge mirror. The full milestone remains subject to the broader workspace-flow and user-acceptance gates; G12 and user visual acceptance remain open.

The current evidence is Linux/private-display automation with synthetic identities and packages. It is not user visual acceptance, physical Windows certification, or final product release. M12.6 and G12 remain open; user visual acceptance has not started. Physical Windows-device review remains under G21 after M20. The clinic widget uses a monogram because this checkout has no approved logo asset; no weather, appointments or clinical data are fabricated.

## Status rules

Track each phase against its plan and retain failed runs. Mark G12 VERIFIED only when all phase criteria pass with exact source/build/host evidence. User visual acceptance remains separate; no final product release is inferred from M12 completion.

## M15 coordination amendment — 2026-10-21

The user adopted [M15 Platform Closeout and Integration](../milestone-15-platform-closeout-and-integration/PLAN.md) during P03. The [central checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) tracks remaining platform work; this amendment changes coordination/dependencies, not historical evidence or acceptance.
Remaining requirements under this milestone's original gate stay open until their evidence is complete; M15.4 coordinates their closeout. Previously implemented/verified scope is reused. M15 planning does not declare those residuals accepted.

## M15.1 source reconciliation update — 2026-10-21

The accepted M15.1 checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5` includes the OS-owned managed-app launch surface, native-frame handoff preservation and associated focused regressions. Build, unit and private runtime/app-launch checks passed for that checkpoint; details and exact report files are in [M15 verification evidence](../milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md). This slice reuses the shared window/dock/Genie lifecycle and does not establish completion of M12.6, G12, full workspace journeys, user visual acceptance or physical-device acceptance. Those original obligations remain open.

## M15.4 P06 shell usability evidence — 2026-10-22

The P06 implementation candidate adds explorer focus trapping/restoration and reduced-motion behavior, and fixes overview fullscreen sizing to use actual managed-window bounds. Lead-run private Linux checks passed: `npm run test:m12-usability` (10 assertions), `npm run test:scaling` (5 assertions) and `npm run test:overview` (29 assertions). The overview test uses the guarded private fixture and covers 4/7/10-window layouts, focus, miniaturized state, responsive fit and preview aspect ratio. Reports are retained in `artifacts/m12-usability-verification.json`, `artifacts/scaling-verification.json` and `artifacts/overview-verification.json`. This is candidate evidence pending final combined-source rerun. Full M12.6/G12, user visual acceptance and G21 remain open.

## M15 technical evidence update — 2026-10-22

Read-only current-profile package/signature/assets and automatic known-good health receipts pass for all eleven installed apps, including Follow-ups 1.0.0 and Finance/Lab Tracker 1.0.1. This resolves the missing saved health/version inventory. Private M15 integrated lifecycle, focus, overview, scaling and identity checks pass within the linked M15 records. User visual/module interaction and physical/device acceptance remain separate; G12/G13 are not silently closed. See [live profile evidence](../milestone-15-platform-closeout-and-integration/evidence/P06_LIVE_PROFILE_RECEIPTS_2026-10-22.json). No live app/browser was controlled or restarted.

## M15 fullscreen shell-chrome follow-up — 2026-10-22

The earlier maximize path used the normal work-area bounds and dock clipping even though the user wants maximized apps to cover the renderer and let OS chrome float above them. Fullscreen bounds now cover the viewport; the app title bar begins below the Dental OS statusbar row, and app/native content extends to the bottom edge. The top statusbar and bottom dock auto-hide and reveal at their screen edges without changing app geometry. `npm run build`, `npm test -- --maxWorkers=1` (437/437), `npm run test:windows` (54 checks), and `npm run test:runtime` (50 checks plus DPR 2 capture) pass locally; `artifacts/m12-maximized-window.png` was inspected. No GitHub Actions were triggered and no push or commit was made, per the user's current direction. This is local M15 P06 follow-up evidence, not current-source Windows verification or G12/G15 acceptance. The live app remains untouched and loads changes after a full user-controlled relaunch.

## M12.4 shared page-history controls — 2026-10-23

The shared `windowManager` owns an ephemeral history stack per managed window, and every shared title bar exposes Back and Forward controls. The controls disable at history boundaries; new entries after Back discard the forward branch; minimizing/restoring retains the stack; closing clears it. Standard Window 1's synthetic table/detail view exercises the shared state. The follow-up app-bundle integration is recorded below. Build, unit and private Linux checks for both phases are retained in their evidence entries. G12, M12.6, user visual acceptance and G21 remain open.

## M12.4 app-bundle page navigation — 2026-10-23

Verified app bundles can now publish opaque page identifiers through SDK 1.6.0. The OS keeps per-window Back/Forward controls and history position; route/page state remains app-owned and is restored through app callbacks. App Store home and detail pages use the same window stack. Treatment Protocols and Patient Record are integrated; Motion Studio and Records sample apps have no page-flow behavior and their navigation buttons stay disabled. Dirty forms, pending writes and blocking dialogs prevent unsafe transitions. The apps do not send patient/session identifiers or page payloads into OS history.

Patient Record 1.0.2 was published to Cloudflare staging at sequence 36 and Treatment Protocols 1.0.1 at sequence 37. Previous package grants are retained. Build, unit, app-specific private UI and package checks passed. Public staging readback and docs validation are recorded in [app-navigation evidence](evidence/M12_4_APP_BUNDLE_NAVIGATION_2026-10-23.json). The live OS session was not restarted; this build loads after a later full launch. User visual acceptance, G12, M12.6 and G21 remain open.
