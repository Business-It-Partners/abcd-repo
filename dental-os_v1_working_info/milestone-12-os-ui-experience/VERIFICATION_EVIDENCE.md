# M12 Verification Evidence — Dental OS workspace and shell experience

**Milestone verification:** M12.1 and M12.2 are implemented for the tested Linux/private-display scope. M12 remains IMPLEMENTING; G12 is not accepted.

## Required evidence

For each phase retain source/tree identity, dependency/build versions, private display/profile, exact command, test results, screenshots where useful, accessibility limits, known failures and requirement/gate mapping. Automated verification is not user visual acceptance or physical Windows-device certification.

## Planned acceptance map

| Phase | Planned proof | Status |
| --- | --- | --- |
| M12.1 | Private status-bar checks for active-window state, Apps/Windows actions, reported network state and date/time; verify no account-action chips | PASS — identity scenario |
| M12.2 | Nepali, time and Gregorian card layout; independent date navigation; glass treatment; responsive dock; 20% lower hover magnification; shared Genie regressions | PASS — identity, unit and Electron private-display checks; screenshot inspected |
| M12.3 | Reviewed journey/surface/state map; private discover/open/switch flows and shared dock/overview/Genie regressions | Not run |
| M12.4 | Window/focus/resize/minimize/restore and safe return-to-work scenarios | PARTIAL — focused window/runtime checks pass; broader lifecycle acceptance remains open |
| M12.5 | Store/session/system status states render from trusted state and handle failure plainly | Not run |
| M12.6 | Keyboard/focus, reduced motion, compact/scaled layout, focused workflow walkthrough and applicable Windows CI | Not run |

### M12.4 initial vertical-fit behavior — implementation started

- Source now calculates the normal work area from the status-bar bottom and dock top, with a 66px status-bar edge at compact widths and the existing 34px desktop edge. Normal app windows open at the full work-area height; movement and resizing remain constrained to it.
- `npm run build` passed after the source change. Private window-boundary UI evidence is pending and was not run in this pass. No live app restart was performed.

### M12.4 edge hiding and title-bar controls — implementation

- `moveBounds` now permits no more than 70% of the frame beyond the bottom or side edges, leaves 30% visible, and clamps the top to the status-bar edge. Normal fitting and constrained resizing remain within the work area; minimize/restore still uses the shared Genie path.
- Replaced traffic-light dots with right-aligned circular minimize, close and maximize controls. Their familiar green, yellow and red backgrounds and symbols are always visible; the interim 19.5px targets were later reduced to 18.525px at the user's request. See the follow-up below for current dimensions and verification.

### 2026-10-20 — dark-glass status bar and maximized-window boundary repair

- Changed the status bar from pale glass to the supplied dark navy translucent/blurred treatment with light text and a subtle lower edge. Reduced-transparency preferences retain a solid dark fallback.
- Maximized window bounds previously used renderer y=0, under the persistent status bar. The 43px title-bar offset for native app surfaces then left title controls covered and exposed a narrow gap below the status bar. Maximized bounds now use x=0/full width and the responsive status-bar-to-dock vertical work area; the native app surface starts below its still-visible title bar.
- Validation: `npm run build` passed; `npm test -- --maxWorkers=1 tests/windowManager.test.ts tests/motion.test.ts` passed 26 tests; private `npm run test:windows` passed including all drag boundaries, right-side always-visible traffic-light controls and maximize/status/dock alignment; private `npm run test:runtime` passed isolated-app placement and resize acknowledgement checks. `node tools/run-ui-test.mjs tests/identity.mjs` is pending after updating its prefixed-backdrop assertion. Documentation/diff checks passed before this final UI-only adjustment. No live app reload, commit, or push.

## M12.1/M12.2 implementation run — 2026-10-20

### Visual contrast and safe diagnostics dialog repair

- Follow-up review found the desktop text still looked muted on the translucent wallpaper surface, and the native Help preview could extend beyond the screen when diagnostics history was long. The latest source darkens shared app text tokens and M12 status/widget labels to soft charcoal, slightly increases widget glass opacity, and limits the on-screen preview to five recent events. Full export still includes the complete safe report.
- Checks after this correction: `npm run build` passed; `git diff --check` passed; `python3 tools/check-dental-docs.py` passed with zero errors. Focused private UI scenarios were not rerun after this correction, so the native dialog sizing change has compile-time verification only in this pass. The existing signed-in desktop session was not restarted.

- **Source identity:** working tree based on `8c8211c00614b095c529d9d14964ca2ce912db73` on `codex/milestone-12-shell`; relevant source and evidence remain uncommitted. No commit, push, merge or deployment was performed.
- **Host/runtime:** Linux x64; Node.js `v22.13.1`, Electron `44.7.0`, Vite `8.3.4`, Vitest `5.0.4`; private headless GNOME/Wayland display from `tools/run-ui-test.mjs`; synthetic identity fixture; screenshot at 1366×768.
- **Build and checks:** `npm run build` passed after final source edits. `npm test -- --maxWorkers=1` passed: 15 files / 286 tests. `python3 tools/check-dental-docs.py` passed: 24 architecture documents, 13 milestone folders, 52 required milestone files, 15 requirements and 14 acceptance gates; zero errors. `git diff --check` passed.
- **Private UI checks:** `node tools/run-ui-test.mjs tests/identity.mjs` passed 44 checks with zero page errors. `node tools/run-ui-test.mjs tests/electron.mjs` passed 26 checks, including the dock hover response, return to baseline, pointer sweeps, Genie mesh, five repeated minimize/restore cycles, reduced-motion and WebGL fallbacks, resize interruption, maximize/restore, direct dock controls, and clean shutdown. The identity checks also prove that Apps opens the signed-in catalog and Windows opens the shared overview. All graphical tests used the private display; the user's live application was not restarted or focused.
- **M12.2 coverage:** right-side three-card stack shows a large Nepali Bikram Sambat calendar, local time and separate Gregorian calendar; both calendars highlight today and navigate independently, with the Nepali date shown only as the highlighted grid cell (no duplicate standalone date row). The laptop-size case (580×800) stacks widgets and scales dock icons. CSS tests verify translucent glass gradients; the same frosted surface and reduced-transparency fallback apply to widgets and dock. Dock width scaling covers small and large displays. `DOCK.peak` changes from `2.75` to `2.4`, reducing hover gain by 20%, while preserving the shared bell field and fallback.
- **Calendar data:** `nepali-date-utils@1.0.0` is pinned and used for Bikram Sambat conversion/month lengths. Unit checks cover the 2024-04-13 BS new-year anchor, 2026-10-20 → 2083-07-03, month boundaries/navigation and Gregorian grids. The package advertises conversion coverage through BS year 2099; see [upstream project](https://github.com/nativeTiger/nepali-date-utils). No holidays, events, weather or clinical data are fabricated.
- **Visual evidence:** [M12 desktop menu bar, widgets and product-style dock](../../artifacts/m12-desktop-chrome.png), captured from a private signed-catalog profile after installing three synthetic first-party packages through the Store. The separate [full prototype fixture screenshot](../../artifacts/m12-full-fixture-dock.png) intentionally shows every local prototype and must not be interpreted as the normal customer dock. The checkout has no clinic logo asset, so the clinic card uses a monogram; no appointment feed exists.
- **Repair and failed-run record:** an early private Electron run found that the full-width status bar intercepted clicks on a window's minimize control; the display-only bar now passes pointer input through except at its working menu buttons, and the repeated lifecycle suite passes. Two later dock runs exposed a test timing assumption: it waited for the first icon, then immediately asserted the hovered app icon had settled. The test now waits for that icon's baseline too; the Electron suite passes. The existing `tests/dockapps.mjs` and `tests/store-visual.mjs` scripts timed out looking for legacy `Treatment Protocols`/`Calendar` demo-catalog entries; the current signed product catalog uses a different catalog and those failures do not exercise M12.2 widget/dock acceptance. Their fixtures were not changed. Earlier typecheck/selector issues were corrected before the passing current build and checks.
- **Limits:** Linux private-display coverage only. Physical Windows review remains deferred to G14 after M13. User visual acceptance, broader accessibility review and reduced-transparency OS-setting review remain separate. M12.3–M12.6 were not started. An npm install reported 8 moderate audit advisories in the dependency tree; no unrelated audit remediation was included.

## M12.4 native-surface focus, control, and dock-gap follow-up — 2026-10-20

- **Source identity:** working tree on `codex/milestone-12-shell`, based on `8c8211c00614b095c529d9d14964ca2ce912db73`; local changes are uncommitted. No commit, push, merge, deploy or live app restart.
- **Native overlap diagnosis/fix:** a retained `WebContentsView` could paint above a newer React shell window while async layout IPC was in flight. A narrow trusted synchronous hide-all IPC now runs before the new React front window paints; async layout remains responsible for native geometry and activation.
- **Dock gap/control update:** shared window work-area geometry reserves 12px above the dock. Title controls use persistent green maximize, yellow minimize, red close ordering and 10% smaller symbols inside 18.525px circles (5% below the interim 19.5px targets).
- **Build and units:** final `npm run build` passed; `npm test -- --maxWorkers=1` passed 15 files / 289 tests, including shared geometry and motion.
- **Private UI results:** `tests/identity.mjs` passed 44 checks; `tests/windows.mjs` passed 30; `tests/runtime.mjs` passed 30. These cover the status-bar glass/height, responsive geometry, controls and dock gap, 70% edge hiding, a sampled clear-corner regression when switching from an active isolated app to the Store, overview, maximize/title-bar placement, dock reveal, restore and cleanup. All used the isolated private GNOME/Wayland display; the user's running app was untouched.
- **Visual evidence:** [maximized native app and title bar](../../artifacts/m12-maximized-window.png) shows the 31px glass bar, visible window title/control row, app surface below it and 12px dock clearance. The [desktop/widgets/dock capture](../../artifacts/m12-full-fixture-dock.png) shows the revised bar. These are private Linux fixtures, not user acceptance.
- **Documentation:** `python3 tools/check-dental-docs.py` passed with zero errors; `git diff --check` passed.
- **M12 boundary:** M12.4 remains in progress; M12.3, M12.5, M12.6 and G12 remain open. Linux private-display evidence is not physical Windows or user visual acceptance.

### M12.4 inactive mirror clarity and control alignment — 2026-10-20

- **Root cause:** `FixtureRuntime.refresh()` resized each native `WebContentsView` capture to at most 640px wide before exposing it as `RuntimeState.snapshot`. `RuntimeFixtures` then displayed that image across the full-size inactive window, so text became visibly soft/upscaled when another window was active.
- **Fix:** mirrors now use the capture at its native dimensions. Their CSS has no `filter` or `backdrop-filter`, and the window's existing shadow styles are untouched. This affects the inactive mirror display only; it does not change runtime isolation, native activation or app state.
- **Controls:** maximize/minimize/close remain green/yellow/red in their existing right-side order. Their circle size is 18.525 CSS px, 5% below the previous 19.5px setting; their glyphs are 10% smaller than the previous glyph sizes and explicitly centered.
- **Further icon adjustment:** in response to the user's follow-up, glyph dimensions were reduced by another 10%, without changing the circles: maximize/restore 9.72→8.748px and minimize/close 11.34→10.206px. The private window regression now verifies the new dimensions and centering.
- **Control-circle adjustment:** the user then asked for another 10% diameter reduction. Circle size is now 16.6725px, reduced from 18.525px; glyph dimensions remain 8.748px / 10.206px and centered.
- **Build:** `npm run build` passed after the final source changes (TypeScript check, Vite renderer build and Electron TypeScript build).
- **Unit tests:** `npm test -- --maxWorkers=1` passed 289 tests across 15 files.
- **Private UI:** `node tools/run-ui-test.mjs tests/runtime.mjs` passed 32 checks, including native-resolution inactive mirror, no CSS blur, retained shadow and the existing two-app isolation/focus/restore paths. `node tools/run-ui-test.mjs tests/windows.mjs` passed 30 checks, including icon center offsets under 0.5px, requested symbol/circle sizes, color/order and existing move/resize/maximize behavior. Both used the private headless GNOME/Wayland runner; the user's live desktop was not focused or restarted.
- **Failed-run note:** the first post-change window run stopped at the new CSS-size assertion because exact equality did not account for browser layout quantization (18.525 CSS px measured as 18.5156px). The implementation was unchanged; the regression assertion now accepts a 0.1px measurement tolerance. The final run passed all 30 checks.
- **Evidence and limits:** current machine-generated reports are [runtime-verification.json](../../artifacts/runtime-verification.json) and [windows-verification.json](../../artifacts/windows-verification.json). `artifacts/runtime-overlap.png` was captured by the private runtime scenario. This is Linux prototype evidence only; user visual acceptance and physical Windows review remain separate, and M12.4 remains in progress.

## M12.1 status-bar glass and height refinement — 2026-10-20

- Status bar is 31px on desktop and 59px at the narrow breakpoint (rounded from a 10% reduction of 34px/66px). Window work-area geometry uses the same values to keep its top edge aligned.
- Changed the dark navy wash to a transparent blue-gray gradient with stronger blur/saturation and a quiet glass edge; light text and reduced-transparency fallback remain.
- Focused identity verification passed 44 checks after these edits. The test checks the source CSS backdrop-filter declaration because private headless Electron returns `none` from computed style on its compositor while the shipped CSS rule is present. Final build, full unit suite, runtime/window suites, docs checker and diff check pass for the current tree.

## M12.2 Nepali calendar and M12.4 control-size follow-up — 2026-10-20

- Removed the separate current-day/month/year row from the Nepali calendar card. Today remains represented by the selected cell in the Nepali month grid; month conversion and navigation are unchanged. The identity scenario asserts that the old `.calendar-today-line` element is absent and exactly one current-day cell remains selected.
- The window controls retain the requested right-side green maximize, yellow minimize and red close order. Their circles are now 16.6725px (10% below the prior 18.525px circles); centered glyph sizes remain 8.748px for maximize/restore and 10.206px for minimize/close.
- `npm run build` passed. Focused calendar and window-manager unit checks passed 22/22; private identity UI checks passed 44/44; private window UI checks passed 30/30. The UI tests used the private headless GNOME/Wayland runner and did not interact with the live OS session.
- A full `npm test -- --maxWorkers=1` run passed 288 of 289 tests; `tests/updates.test.ts` timed out once at its 5-second limit during the historical-activation rollback case. Rerunning that single case with a 15-second limit passed (1 passed, 66 skipped); the full suite was not repeated. Focused relevant unit and UI checks passed.
- The running desktop remains untouched and will load these changes after a later full launch. M12.2 remains implemented for the tested Linux/private-display scope; this refinement does not close M12.4 or G12.
