# M12 Implementation Notes — Dental OS workspace and shell experience

## Starting baseline

M03 already established the shared window manager, app isolation, dock, overview and Genie composition. M10 established a bounded accessibility/usability baseline. M12 is a product-level UX pass over those foundations, not a new app window system.

## Implementation record

M12.1–M12.5 are implemented for the tested Linux/private-display scope under the user's 2026-10-20 direction. M12.1 follows the macOS menu-bar composition: product/active-app identity and functional Apps, Windows and Help actions at left; network and local date/time at right; subtle glass with readable labels. Session actions remain in the clinic widget menu. M12.2 provides the three-card Nepali calendar/time/Gregorian calendar collection, frosted widgets/dock, responsive dock sizing and 20% reduced hover-bell gain. The reviewed [workspace journey map](WORKSPACE_FLOW_MAP.md) and source-bound test evidence cover M12.3–M12.5. M12.6 and G12 remain open; user visual acceptance is separate.

### 2026-10-20 — Installed multi-module app discovery at launch

The OS now reads the verified active package and filters its module metadata for the current clinic session before launching. Dock and Store opens of installed company apps use that lookup: multiple available modules open the shared OS App Explorer first; one module opens directly. Selecting a module records the choice in the OS runtime and delivers it through the existing preload-owned `onModuleSelected` event. For a new runtime, the native app surface stays hidden until the app handler acknowledges the selected module, avoiding a default-screen flash. Existing app windows receive and acknowledge the same event before the explorer closes. Finance and Lab Tracker already map module IDs to their current content headings, so no app bundle or Cloudflare release was needed for this OS change. `npm run build` passed. The later private multi-module runtime fixture now verifies package discovery, initial selection and a running module switch with a fresh dock-edge mirror; broader M12.3 workspace-flow acceptance, user visual acceptance and G12 remain open.

## Ownership and boundaries

`src/` owns shell and app presentation; `src/windowManager.tsx` and `src/ManagedWindow.tsx` continue to own shared lifecycle behavior; `electron/` remains the native trusted boundary. Map any new presentation surface to an existing owner before creating new modules. M11 remains authority for verified app updates; shell components may render its state but cannot mint or approve it.

Preserve the existing SaaS as business authority, single active clinic session, first-party-only app boundary, shared dock field/Genie fallback and softer clarity style. Any implementation change must retain app-scoped forms/blur and avoid introducing persistent patient data.

## Change log / deviations

### 2026-10-20 — live app and dock-edge preview coherence

- **Reproduction:** a private runtime test changed the live native app page to a vivid synthetic module state, moved the pointer to its bottom edge, and observed the shell mirror. Before the fix, the mirror retained the previous page image. A separate signed multi-module package reproduced the same transition after changing its selected module.
- **Cause:** the shell calls the trusted synchronous `runtime.hideAll()` before switching windows or entering dock-edge preview, so native app content cannot paint above the next shell surface. `FixtureRuntime.sync()` then saw the child view as already hidden and skipped its old asynchronous refresh. The shell showed a stale or not-yet-captured mirror. Running module callbacks also acknowledged immediately, before the browser had painted the new module, allowing the same stale-frame race.
- **Fix:** every visible-to-hidden runtime transition now invalidates the old mirror, starts a fresh full-resolution capture while synchronously hiding the native child, and emits the completed image. The temporary state says the preview is refreshing instead of telling users to open an app that is already open. Module callbacks acknowledge after two animation frames; the host captures the selected module before resolving the OS selection.
- **Verification:** `npm run build` passed. `node tools/run-ui-test.mjs tests/runtime.mjs tests/runtime-module-preview.mjs` passed 45 shared runtime checks plus 4 signed multi-module fixture checks. The former confirms the live app matches the dock-edge mirror; the latter verifies OS manifest discovery, first selection, running module changes, and the selected module in the preview. Both tests use the private headless GNOME/Wayland display and synthetic data.
- **Scope:** this is shared OS runtime behavior and covers ordinary app windows and multi-module app windows; Finance and Lab Tracker bundles were not edited or republished. Linux/private-display evidence only. No commit, push, staging publication or live desktop restart.

### 2026-10-20 — edge-drag clipping and native preview repair

- The left-edge native surface had been clamped to x=0 while its shell window moved offscreen, making its content extend past the frame. Right/bottom layouts could be rejected when child bounds exceeded the host, leaving stale pixels, and native child views could trail the renderer during movement.
- Native bounds now follow the shell frame through the existing 30% visible edge allowance. Each window frame is clipped at the dock-zone top and native content height uses the same boundary; the full-screen Genie canvas remains outside that clip so its dock landing is preserved. Active dragging hides native child views synchronously while showing their full-resolution captures. The normal runtime sync restores the live app surface at the settled bounds.
- Build, focused runtime-contract tests, 39 private runtime checks plus DPR 2 capture, and 43 private window checks pass. G12, M12.6, user visual acceptance and physical Windows review remain open; the live app was not restarted. See the added edge-drag record in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

### 2026-10-20 — M12.3–M12.5 complete for tested Linux/private-display scope

- M12.3 records the boot/sign-in, discovery, Store/update, window-switch, lock/account and recovery flows in [WORKSPACE_FLOW_MAP.md](WORKSPACE_FLOW_MAP.md). Private signed-in flows prove Store search, install, ready notice, open, overview/dock switching and return to an unfinished draft.
- M12.4 verification now covers keyboard and pointer title controls, fit and dock clearance, edge recovery, resize cancellation, app-owned dialogs, focus/stacking, maximize/minimize/restore and retained app work.
- M12.5 makes Store progress/results and unavailable state visible as accessible status/alert feedback, and announces failed/recovery reasons as alerts. Tests cover install/update ready, blocked update, failed-update rollback, catalogue outage/retry, sign-in/lock/logout and boot recovery. The app-ready notice has a direct Open action.
- The installed-app SDK notification call remains a scoped receipt for app-owned presentation, per the SDK architecture. This work does not add or claim a native OS notification center or renderer-owned trust decisions.
- Build passed. The full unit run passed 288/289 with one existing 5-second insufficient-disk update test timeout; its focused 15-second rerun passed. At that completion checkpoint, focused private UI suites passed: workspace/delivery 24 checks, window 40, runtime 32 plus DPR 2, updates 12, identity 44, and recovery 3. Later M12.4 edge-drag verification is recorded above and in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).
- M12.6, G12, user visual acceptance, and physical Windows-device review remain open. The user's live app was not restarted.

### 2026-10-20 — normal app windows fill the vertical desktop work area

- Normal app windows now open at the full available height with their top edge flush below the responsive status bar and a 12px gap above the dock surface. Their width remains app-specific; existing horizontal margins are unchanged.
- Shared move/resize fitting uses that same work area, so a window cannot be dragged or resized into the status bar or dock. The compact status-bar breakpoint is kept in sync with the CSS layout. Fullscreen presentation behavior and dock motion are unchanged.
- Scope is the first requested M12.4 behavior, not full M12.4 acceptance. `npm run build` passes; focused window UI checks have not been run after this change. The live app is not restarted.

### 2026-10-20 — recoverable edge hiding and right-side window controls

- Dragging uses the shared window geometry: the top cannot cross the status bar; bottom, left and right edges allow up to 70% of the window outside the screen, preserving 30% as a visible grab area. The existing constrained resize behavior and shared Genie minimize/restore path remain in place.
- Window bounds use the resting dock surface as their lower edge, with the existing 12px clearance. Normal, maximized, dragged, resized, and isolated fixture content share that narrow clipping boundary; the dock remains on its higher visual layer while hovered, without reserving a large blank band for its magnified preview and caption.
- Replaced left-side controls with right-side maximize, minimize and close icon buttons, ordered green/yellow/red. The interim 13px targets were enlarged to 19.5px, then reduced by the user's later 5% refinement to 18.525px. Symbols are 10% smaller than their prior size, centered, and the colored circles/icons are always visible. Accessible action labels remain unchanged.
- This is partial M12.4 behavior. Focused private edge/control interaction checks pass; full phase acceptance remains open and the user’s live desktop was not restarted.

### 2026-10-20 — dark Mac-style status glass and maximized-window alignment

- Restyled the desktop status bar to use the supplied reference's translucent blue-gray glass, backdrop blur/saturation, subtle edge and light text. The bar is now 10% shorter at 31px desktop / 59px compact.
- Fixed the top-edge mismatch: maximized app windows previously started at renderer y=0, underneath the status bar. They now span the screen width while fitting between the status bar and dock, preserving their 43px app title bar. Native app surfaces therefore begin below the visible title bar instead of painting over its controls.
- Added shared geometry and private window/runtime assertions for the status-bar/window/dock boundaries. Build and focused checks are recorded in VERIFICATION_EVIDENCE.md. The active OS session is left untouched and loads these changes on its next full launch.

### 2026-10-20 — text contrast and support-dialog fit correction

- The first visual pass still left muted slate labels in the status bar, desktop widgets and shared app text tokens. Darkened these to soft charcoal while keeping the light frosted surfaces and avoiding pure black. The widget glass is slightly more opaque so wallpaper details do not wash out small labels.
- The Help action opened a native diagnostics dialog with the entire retained event history pretty-printed. Longer histories made that dialog taller than the visible screen. The preview now lists at most the five newest safe events in a compact summary; choosing **Save diagnostics file** still exports the complete bounded report.
- Updated the existing status-bar color assertion. `npm run build`, `git diff --check`, and the documentation checker pass; focused private UI checks have not been rerun after this correction. No live app restart is performed.

### 2026-10-20 — native window overlap and dock clearance follow-up

- A user screenshot showed the old isolated app covering a newly selected shell window. Since Electron's `WebContentsView` children render above React windows, front-window changes now synchronously hide native surfaces before the regular async runtime layout runs. A private runtime regression captures the desktop corner outside the Store window to ensure stale app pixels are gone.
- Per the user's latest visual direction, normal and maximized windows now leave a 12px gap above the dock. The status-bar edge remains flush. The title-bar controls stay visible and are ordered green maximize, yellow minimize, red close. The current circles are 16.6725px after the user's latest 10% reduction; maximize/restore symbols are 8.748px and minimize/close symbols are 10.206px.
- Runtime and window private UI suites pass for native/DOM switching, maximize/title placement, dock clearance, drag recovery and control behavior. The identity suite's glass style assertion was adjusted to validate the actual source declaration because this headless compositor reports `backdrop-filter: none` in computed style even though the shipped CSS includes blur/saturation; final rerun pending.

### 2026-10-20 — inactive window mirror clarity and control centering

- The user-reported softness was caused by the native app manager reducing every mirror capture to a maximum width of 640px, then rendering that thumbnail across the full inactive window. Inactive app mirrors now use the original capture size so they are not upscaled; the existing window shadow rules are unchanged.
- The right-side green/yellow/red control circles are 18.525px, 5% below the interim 19.5px targets. Their symbols are 10% smaller than before and explicitly centered with absolute positioning.
- The user requested one more 10% reduction to the internal symbols while keeping the circles unchanged. The current maximize/restore symbol is 8.748px and minimize/close symbols are 10.206px; the private window regression checks these sizes and their centering.
- The user then requested the control-circle diameter be reduced 10% from 18.525px. It is now 16.6725px; symbol sizes stay unchanged and remain centered. The private window regression checks both target and symbol dimensions.
- `node tools/run-ui-test.mjs tests/runtime.mjs` passes 32 checks, including native-resolution mirrors, no CSS blur and preserved window shadow. `node tools/run-ui-test.mjs tests/windows.mjs` passes 30 checks, including symbol centering, circle/icon sizes, traffic-light color/order and existing geometry/lifecycle behavior. A first version of the new size assertion failed because the browser reports 18.5156px for an 18.525px CSS value; changing the assertion to allow less than 0.1px measurement quantization resolved it without relaxing the requested dimensions. Build passes. No live-app reload.

### 2026-10-20 — status-bar size and glass material refinement

- Reduced the status bar height by approximately 10% at both breakpoints: 34→31px desktop and 66→59px compact. Window geometry derives from the same responsive values so the title bar remains flush below it.
- Replaced the mostly opaque navy wash with a brighter, more transparent blue-gray gradient and stronger blur/saturation. The frosted glass keeps light labels and its reduced-transparency fallback.

### 2026-10-20 — status bar and desktop widgets

- **User-approved interaction direction:** status bar displays the customer-facing product name, Sajilo Dental, when no app is active; otherwise it displays the active app. It also shows network status, date and time, without the top-right session-action chips. Upper-left widget shows clinic identity and signed-in user/role, with support/account actions in a small options menu. The expanded upper-right widget collection contains a Nepali Bikram Sambat calendar, time card and Gregorian calendar. Widgets and dock use the supplied Big Sur frosted-glass reference with a readable, moderate treatment. Dock geometry scales for display width and its hover bell amplitude is reduced by 20% through the existing shared motion field.
- **Data rules:** active app comes from shared `activeWindow` state; identity comes from the trusted `SessionView`; connectivity is the browser/OS `navigator.onLine` signal and does not certify Dental SaaS availability. Calendar is local date only. This checkout has no approved clinic logo asset or appointment feed, so a clinic-name monogram is used and no appointments are fabricated.
- **Source:** shell presentation in `src/DesktopChrome.tsx` and `src/DesktopChrome.css`, integrated by `src/App.tsx` and `src/IdentityGate.tsx`; private UI coverage in `tests/identity-scenario.mjs`.
- **Status:** M12.1 and M12.2 pass their documented Linux/private-display checks. M12 overall remains in progress; M12.3–M12.6 and G12 are open. No broader milestone acceptance is claimed.
- **Physical Windows visual acceptance:** G21 after M20 (2026-10-20 roadmap amendment).

### 2026-10-20 — Nepali calendar date-row cleanup

- Removed the separate large “day + month + year” line from the Nepali calendar card; the current date remains visible as the highlighted day in the month grid.
- The identity UI regression checks that no standalone date row is rendered and that exactly one current-day cell remains selected. This is a small M12.2 presentation refinement; it does not change calendar conversion or navigation.
- The same follow-up confirms the right-side maximize/minimize/close circles are 16.6725px after the requested 10% reduction; the centered glyph dimensions remain 8.748px for maximize/restore and 10.206px for minimize/close.
- `npm run build` passed; focused calendar/window-manager unit checks passed (22 tests); private identity UI checks passed (44 checks); private window UI checks passed (30 checks). The full unit run reported 288 passing tests and one update-rollback test timed out at its configured 5-second limit; rerunning that case alone with a 15-second limit passed.
- UI checks ran on the private headless display. The user's live OS was not reloaded; the changes appear there after a later full launch.
