# Electron Desktop Prototype — Work Checklist

**Status:** Implemented; Linux technical checks pass. User visual acceptance pending.  
**Created:** 2026-10-13  
**Project directory:** `/home/master-x/Desktop/fewa_business_os`  
**Product name:** Not yet chosen; the directory name is a working label.

This file is the single source of truth for this prototype's scope, implementation progress, decisions, and acceptance evidence. Update it as work proceeds. A checked implementation item requires actual verification; existing FEWA behavior is a reference, not proof that this prototype works.

## Dental OS canonical repository structure — documented, 2026-10-15

Expanded [00_REPOSITORY_STRUCTURE.md](dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md) as the sole target folder/ownership/import-boundary guide. It covers desktop main/preload/renderer, shared packages, future first-party apps, fixtures, tests/tools/config, separate fewa_demo backend repositories, installed OS state and incremental migration. Root instructions/development/README and architecture link to it rather than copying the tree. Current src/electron source remains in place; no new implementation packages, source migration, backend change or deployment. Lightweight documentation checks only; no builds/runtime tests or live-session changes. See M01 amendment evidence.

## Dental OS staging/resource policy amendment — 2026-10-15

Documentation-only update: reuse existing fewa_demo Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources. All roadmap backend changes and remote tests are staging-only with verified target mapping; existing clients and production remain protected. New OS services use `/v1/dental-os/...`; business routes remain unchanged. Architecture/ADRs, milestone plans and relevant evidence requirements now reflect this rule. No backend edits, cloud calls, provisioning or deployment were performed. See [policy](dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md) and [M01 amendment evidence](dental-os_v1_working_info/milestone-01-architecture-baseline/VERIFICATION_EVIDENCE.md).

## Dental OS architecture and milestone baseline — 2026-10-15

The user authorized architecture and milestone documentation following the newer Flutter project’s file pattern, with Dental OS-specific scope. [Architecture](dental-os_v1-documentation/00_V1_README.md) defines WHAT; [master roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) defines execution order; [global status](dental-os_v1_working_info/00_V1_STATUS.md) and each milestone record actual progress/evidence. This checklist remains the active work contract and detailed prototype history; new production work entries must name their milestone and stay consistent with those records.

The header’s implemented status describes the prototype only. Documentation does not turn the session-only Store into a real package manager or establish authentication/API integration. Permanent first-party-only scope, existing SaaS authority and Windows/Linux targets are explicit. The next production implementation candidate is M02; this task authorizes documentation only. See M01’s verification record for documentation checks and exact limitations. M01 documentation checks pass (23 architecture documents, eleven four-file milestone folders, local links and requirement/gate coverage); baseline build/typecheck and all 25 unit tests pass. No graphical verification was needed, and M02–M11 remain planned.

The user reviewed the proposed daily-workflow redesign and chose to keep the previous Follow-ups UI. The redesign was reverted; the ten-column table, call flags, Missed default, and app-scoped Details dialog remain.

### Magnetic store handoff — implemented

Connect completion, source separation, dock reservation, velocity-shaped flight, landing and readiness. Use shared dock math to grow new slots; add depth/shadow and a short light ribbon, contact-triggered upward sparks, skip-to-open, quiet update feedback, and cleanup on interruption/reduced motion. Validate full interaction and deterministic frames.

Implemented: a 320 ms shared slot-width reservation (no per-item dock controllers), completion Ready pulse, faded source placeholder and separated shadow, 2050 ms sampled lift/arc-length-remapped flight with a smooth velocity envelope, short light ribbons instead of ghost thumbnails, landing well, damped compression/rebound, and contact-timed upward sparks/ring. Added a destination Ready to open card and early Open that disposes the presentation immediately. Existing-app updates use a subdued icon pulse. Resize and live reduced-motion changes settle directly; all source/overlay effects restore on cleanup.

Validation: build/typecheck and all 25 unit tests pass. Store flow checks (including early Open), two targeted interruption checks, and shared dock suite pass privately. Deterministic paused lift/flight/landing frames captured and visually inspected. Final sampled-lift refinement rebuilt and interruption checks passed. All jobs exited; no live app reload, commit, or push. This is a visual refinement awaiting user acceptance, not a claim of a measured subjective quality score.

### Arrival visibility correction — implemented

Direct paused-frame inspection showed the 1450 ms globally eased path rushed to the dock and the small sparks were visually negligible. Use a 2200 ms linear-time sampled curve, 20 larger sparks above the dock, and a stronger expanding landing ring. Verify captured frames rather than only DOM effect counts.

Paused-frame screenshots were captured and inspected for lift, flight, and landing. Corrected global timing so the icon remains in flight at the midpoint. Enlarged sparks and held their opacity before fading, with a larger local burst above the dock. Build/typecheck and the Store suite pass; the final visual-only refinement was also rebuilt and captured privately. Launcher points to this canonical build. Live session was not reloaded.

### Choreographed store arrival — implemented

Refine the arrival into a 1450 ms lift/curved flight/compression/rebound sequence, with a completion shimmer, three subtle light echoes, destination glow, a landing ring and twelve local sparks. Preserve shared dock geometry and direct/reduced-motion fallbacks; clean up every effect on completion or interruption.

Validation: build/typecheck and 25 unit tests pass. The focused Store suite passes with checks for the 1450 ms timeline, glow/trails/sparks, effect cleanup, dock landing, uninstall/reinstall, updates, and reduced motion. A private visual run captured the flight for inspection. All tests run on the isolated display; live session untouched.

### Store uninstall and slower arrival — implemented

Add an explicit confirmed Uninstall action in installed-app details. Close the app through shared lifecycle, remove its dock/update entry, and allow reinstall; retain dummy session records without claiming data erasure. Slow arrival to 30% speed (680 / 0.3 = 2267 ms). Block conflicting operations until arrival ends.

Validation: build/typecheck, all 25 unit tests, and the focused Store suite pass, including measured 2267 ms animation duration, keeping an app, uninstall closing an open window/removing its dock entry, reinstall, updates, and reduced motion. No live session restart.

### App Store demo — implemented

Build catalog/detail/updates UI with cancellable simulated install/update progress. Protocols and Calendar begin available; existing other clinic apps remain installed. New installs append to the shared dock and animate a visible source icon into its measured slot; reduced motion and hidden sources settle directly. No packages, network downloads, or durable installation are involved.

Implemented a managed App Store window with a custom vector shopping-bag icon, searchable ten-app catalog, detail pages, illustrative feature previews, version/release information, All Apps and Updates Available navigation, Get/Open/Update controls, cancellation/retry, and a sequential Update all queue. Progress reaches 100% before completion. Calendar and Treatment Protocols install into new slots at the end of the shared installed-app list. A measured floating artwork copy travels to its actual dock slot over 680 ms; hidden/offscreen sources and reduced motion complete directly. Arrival freezes/reveals the dock and cleans up its overlay. State persists across internal window operations and resets on full exit. Detail/tab navigation resets scrolling.

Validation: build/typecheck, 25 unit tests, all 11 focused Store UI checks, and shared dock/overview suites pass privately. Catalog/detail and arrival screenshots inspected. Existing dock/overview regressions now install the two available apps in their isolated session before testing the complete clinic collection. All build/test processes exited; the user's live session was left intact.

### Canonical project relocation — complete (2026-10-15)

User-approved direction: Electron OS is the active project in `/home/master-x/Desktop/fewa_business_os`. The prior Flutter/Rust files, including source, docs, dotfiles, platform projects, and local caches, are preserved directly under `refrence/`. The existing root `.git` and its history/index remain in place. The old Electron location is a compatibility symlink to this root, not a second checkout. Root instructions and direction documents supersede the archived Flutter contract for active work.

- [x] Preserve and verify both trees before intentional path/documentation changes.
- [x] Update launcher, instructions, and active paths; build and privately verify launch/session continuity from the new root.

Validation: 581 archived file/symlink entries and 6,664 Electron file/symlink entries matched before intentional configuration/documentation updates. Build/typecheck, all 25 unit tests, and all 24 native-session checks pass from the new root, including installed-launcher reactivation. Launcher shell syntax and desktop entry validate. Active docs, development commands, artifact helper scripts, and launcher paths point to the canonical root. Original Git HEAD/index are preserved; no commit or push was made. Build/test jobs completed; live session untouched.

### Lab Tracker and Lab Supplier Record — implemented

- [x] Review dental-saas models, Worker/API flow, and operational UI without modifying that source repository.
- [x] Build two top-level submodules with dummy orders/suppliers: filters, request assignment, status progression, detail timeline, cancellation, supplier add/edit/status, and supplier work history.
- [x] Keep all dialogs app-scoped and session state persistent across shared window operations; privately verify and rebuild.

Reference: dental-saas lab_orders links patient/case and nullable supplier, with clinical/reception notes, stage dates, and row versions. ClinicCareWorkspace loads labsApi responses and routes callbacks into LabTrackerView/LabsPanel. Worker enforces tenancy/capabilities and uses versioned, idempotent writes. Active lab/both suppliers come from the shared finance supplier directory. This prototype uses only synthetic data and does not implement backend authorization, persistence, or finance ledgers.

Implemented a shared Lab Tracker window with two keyboard-accessible top tabs, eight synthetic orders and three suppliers. Tracker has summary/status/month/search filters and pagination, clinical request details, supplier dispatch, sequential receive/fit confirmation, separate reception notes, cancellation reasons, and retained timelines. Supplier directory supports add/edit, duplicate-name validation, activation/deactivation, and operational history derived from the same order state. New demo request simulates Work Entry; no real backend or financial connection is added. The preferred window is 1180×660, with scoped dialogs and scrollable compact layouts using the softer visual palette.

Validation: build/typecheck and all 25 unit tests pass. All 29 private Lab workflow checks pass, including linked supplier history, role-independent dummy handoff, draft isolation, stage progression, cancellation, supplier CRUD/status, pagination/filtering, empty states, fullscreen, Genie, close/reopen, and compact layout. Shared dental dock and overview suites also pass. Tracker, supplier directory, order detail, assignment, and compact screenshots were inspected. All build/test processes finished; live session untouched. Installed files load after a full exit/relaunch. User visual acceptance remains pending.

### Comfortable clarity refinement — implemented

The user found the previous pass too harsh. Shared colors now use charcoal text, gentler supporting labels, light table headings and row rules, restrained control edges, and softer window shadows. Body copy returns to regular weight; names and headers retain moderate emphasis. Colored badge outlines and doubled selected-card edges are removed. Focus indicators and selected tabs remain clear.

Validation: build/typecheck and all 22 sampled text contrast checks pass. Updated Staff and Follow-ups screenshots were inspected. Only the focused private clarity check was run for this CSS refinement to keep verification load modest. Build and test processes have exited; the user's live session was untouched. Fully exit/relaunch to load the new appearance.

### Shared clarity pass — implemented

- [x] Introduce shared semantic colors for readable text, surfaces, borders, accents, and focus across shell and app content.
- [x] Strengthen tables, labels, forms, tabs, badges, title bars, dock captions, and regression fixtures without changing lifecycle or motion.
- [x] Verify contrast, visual screenshots, build, unit tests, and private UI regressions; leave the live session untouched.

Shared semantic tokens now provide near-black primary text, dark neutral supporting text, opaque content surfaces, visible input boundaries, distinct table headers and row separators, readable status accents, and blue focus/selection states. Platform system typography replaces the previous font stack and forced smoothing. Title bars, dock surfaces/captions, overview, app placeholders, Finance, Follow-ups, Staff, and private Records/Studio fixtures share this direction. Follow-up checkboxes have explicit edges and check marks; disabled pagination remains distinct. Increased-contrast preferences strengthen boundaries further. Existing window ownership and dock/Genie geometry are unchanged. Compact Finance spacing was adjusted after system typography exposed overflow in the smallest layout.

Validation: build/typecheck and 25 unit tests pass. All ten private UI suites pass (Staff, overview, Finance, dental dock, Follow-ups, Records, windows, Electron, native session, and DPR 2 scaling). All 22 sampled text contrast checks pass, with a minimum measured ratio of 4.89:1; this is targeted evidence rather than a complete accessibility audit. Staff, Follow-ups, and form screenshots were visually inspected; reports and clarity screenshots are in artifacts/. Rebuilt installed files load on the next full exit/relaunch; the live session was left untouched.

### Staff app — implemented

- [x] Implement searchable staff table (name, contact, join date, type, base salary, Details) and app-scoped Add staff modal.
- [x] Implement profiles with Overview, Salary history, doctor-only Work done, and Documents tabs using session dummy data.
- [x] Verify creation, role-specific tabs, profile navigation, lifecycle retention, scoped dialogs, and compact layout privately; rebuild without touching the live session.

Staff now opens a preferred 1060×650 window with five sample staff across Doctor, Helper, Support, and Receptionist roles. Base salary is displayed in NPR/month. Add staff validates required fields and appends a session row; profiles remain inside the shared frame. Tabs support arrow/Home/End keyboard navigation, and Work done is available only for doctors. Seed salary rows show payment balances; work amounts are labeled treatment charges. Document entries use explicit dummy previews without real attachments or uploads. Newly added staff have empty histories and documents. All data ends when Electron OS exits.

Validation: build/typecheck and all 25 unit tests pass. All 21 private Staff interaction checks pass, including scoped dialogs, creation, filtering, doctor-only tabs, lifecycle retention, fullscreen, and compact layouts. Staff list, overview, and modal screenshots were inspected. Shared dental dock and overview regressions were also run on the private display. The installed launcher uses the rebuilt files on the next full exit/relaunch; the live user session was left untouched.

### Follow-ups remaining-height table — implemented

- [x] Fill the remaining app height with the table panel for populated and empty views; keep row heights natural.
- [x] Keep heading, summary cards, filters, pagination, and session footer fixed; scroll the table viewport with sticky column headings.
- [x] Verify few-row, empty, overflow, and resized-window layouts on the private test display, then rebuild the installed files without restarting the user's session.

Validation: build/typecheck and all 29 Follow-ups UI checks pass on the private headless display. Two-row and empty views retain the same table viewport; pagination and session footer stay at the bottom. At the minimum 420 px window height, compact summary cards omit descriptive subtitles to preserve usable row space; rows scroll with sticky headings and fixed controls. Four-record pagination remains. Screenshots inspected: `artifacts/followups-fill-height.png` and `artifacts/followups-compact-scroll.png`. The installed launcher uses the rebuilt files on the next full exit and launch; the current user session was left untouched.

### Direct environment controls — implemented

- [x] Replace the system menu with separate dock buttons for Minimize Electron OS and Shut down Electron OS.
- [x] Keep native transition settling, session continuity, fullscreen dock reveal, and shared dock motion.
- [x] Verify one-click native minimize/restore/exit and dock bounds privately; rebuild without restarting the live session.

The old four-pane menu launcher is replaced by two magnifying dock tiles: blue minus for native minimize, red power for closing Electron OS. A divider separates them from the ten dental apps. Both are ordinary accessible buttons with captions and keyboard activation. Native actions settle dock motion and block repeated activation while pending; minimize keeps the same session, and shutdown closes only Electron OS. Fullscreen edge reveal exposes both controls. This supersedes the historical system-menu requirement below.

Validation: build/typecheck and 25 unit tests pass. All nine UI suites pass on the private display, including direct native minimize and exit, preserved app data/drafts through host-dock reactivation, fullscreen reveal, Genie, and dock containment during hover at 480/800 px with nine minimized snapshots. Screenshots inspected: `artifacts/clinic-dock.png` and `artifacts/direct-dock-controls.png`. Updated files are ready through the installed launcher after a full exit/relaunch. The user's live session was not restarted or focused.

## Windows preview installer — 2026-10-15, built; Windows acceptance pending

User-authorized out-of-sequence prototype packaging experiment related to M11. Package only the current shell/demo as an unsigned Windows x64 installer; do not advance M02–M11 or select a production installer/update channel. No backend, publishing, signing identity or production acceptance is included.

- [x] Add a reproducible, allowlisted Windows preview installer configuration and icon.
- [x] Build the current renderer/host, run unit checks and a relevant private host suite sequentially with bounded resources.
- [x] Produce and inspect the Windows installer, packaged assets and checksum; provide transfer/install instructions.
- [x] Record that real Windows installation, launch, update/uninstall and UI acceptance remain unverified.

Validation: renderer/native build and 25 unit tests pass; six static package checks, NSIS archive integrity, and seven smoke checks of the exact Windows-bundled ASAR on the private Linux display pass. The ASAR run checks isolated preload, relative assets, demo rendering and draft continuity through native minimize/restore. Artifact: `release/windows/Dental-OS-Setup-0.1.0-x64.exe` (134,825,156 bytes, approximately 129 MiB). SHA-256: `c55630b2d3ab6e779a0e410229dad176b71cbc3dcc97897839a1159f0eddda4d`. Evidence: `artifacts/windows-preview-verification.json`, `artifacts/windows-preview-build-native.log`, `artifacts/windows-package-linux-smoke.json`; instructions: `tools/desktop-release/WINDOWS_PREVIEW.md`.

Packaging is pinned to electron-builder 26.15.3 with an explicit runtime/output allowlist, per-user NSIS installation, shortcuts, no auto-launch or publish, and unsigned preview identity. A bounded build wrapper strips live display variables and limits Linux CPU/memory/compression. The first high-compression run was stopped gracefully after excessive memory growth; the lower-compression attempt reached a Wine helper incompatibility. The final successful path uses electron-builder's own native uninstaller parser in a tightly scoped in-memory adaptation, with no dependency-file edits or Windows helper execution. The isolated test and all task-owned build/display processes exited. The user’s existing running app was not restarted or focused. No Windows device has executed this installer; production milestones and release gates remain unchanged.

## Objective

### Native-style overview layout — implemented

- [x] Center a balanced arrangement of proportionally scaled windows, adapting rows to the available screen and window count.
- [x] Replace gallery card decoration with window shadows and overlapping app artwork.
- [x] Verify four/many windows, narrow displays, keyboard navigation, and preserved app state on the private display.

The arrangement evaluates balanced row counts and chooses the largest common window scale that fits the available area. Preview dimensions come from each app's actual normal/fullscreen bounds, retaining proportions and relative sizes. Each row and the whole group center on a fitting screen; scrollable collections start at the top without blank leading space. Gallery panels are removed; window shadows, hover/focus outlines, and 60 px app artwork overlapping the preview edge provide separation and identity. Up/Down navigation follows the nearest window in the adjacent visual row. Read-only clones update when window dimensions change.

Validation: build/typecheck, 25 unit tests, and 30 private overview UI checks pass. Verified 4/7/10-window centering, proportional previews, non-overlap, spatial keyboard navigation, narrow-screen scrolling, drafts/focus/geometry/fullscreen continuity, and minimized-app restore. Screenshots inspected: `artifacts/window-overview-4.png`, `artifacts/window-overview-7.png`, `artifacts/window-overview-10.png`, and `artifacts/window-overview-many-small.png`. Evidence: `artifacts/overview-verification.json`. The existing installed launcher uses this build on the next full exit and launch; the running user session remains untouched.

### Internal window overview — implemented

- [x] Reserve unmodified Backquote (`) while Electron OS is focused to toggle an internal window overview; Escape exits it.
- [x] Arrange previews of open/minimized apps, highlight hovered/focused cards, and select a window without losing its data or presentation.
- [x] Keep background windows/dock inert during overview, preserve forms and remembered focus, and support keyboard selection and smaller displays.
- [x] Privately verify lifecycle/data preservation, shortcut behavior, and preview layout; rebuild installed files without touching the running user session.

Overview lifecycle belongs to the shared desktop state. Its grid shows open and minimized internal apps in recent-focus order. Visible apps use inert read-only DOM previews with current form values and stripped DOM identities; minimized apps use their saved captures, with artwork fallback if capture was unavailable. Background windows stay mounted at their existing bounds, hidden/inert while overview is active. Clicking a card or pressing Enter restores/focuses its window, preserving fullscreen and session content. Arrow/Home/End keys navigate cards; Tab stays within the overview. Backquote/Escape or its close button dismiss it and restore remembered app focus. Modified/composing keys are untouched; held-key repeats do not toggle repeatedly. Busy Genie/drag/resize transitions defer overview entry by ignoring that press. No global host shortcut, key log, host-window list, search, or virtual workspace system is added.

Validation: build/typecheck and 20 unit tests pass. All nine private UI suites pass: overview 17, Finance 20, dental dock 55, Follow-ups 29, Records fixture 21, windows 51, Electron/motion 28, native session 24, and DPR 2 scaling 5. Overview verifies shortcut input suppression, empty/open/minimized cases, preserved draft values/focus/geometry/fullscreen, keyboard selection, hidden/inert backgrounds, duplicate-ID removal, and narrow-screen layout. Inspected screenshots: `artifacts/window-overview.png` and `artifacts/window-overview-small.png`; report: `artifacts/overview-verification.json`. Rebuilt files are ready through the installed launcher after the next full exit and launch. The user's live session remains untouched.

### Finance submodule navigation — implemented

- [x] Add the eight reference submodules as navigation inside the Finance window, below its shared title bar.
- [x] Show the selected submodule name and Coming soon; retain selection through window lifecycle changes.
- [x] Support clear active styling, keyboard navigation, and smaller resized windows.
- [x] Verify privately and rebuild the installed launcher files without restarting the live session.

Finance remains a single dock app/window. The eight tabs match the reference order: Transaction Record, Patient payments, General expenses, Salary payments, Product list, Purchases, Supplier list, Supplier payments. Transaction Record is initially selected. Selection persists while the mounted app is closed, minimized, restored, or fullscreen; quitting still ends session state. Tabs highlight the active section, support Left/Right/Home/End, and wrap on smaller windows. Short layouts hide the decorative image so the section name and Coming soon remain visible. Other app layouts are unchanged.

Validation: build/typecheck, 20 Finance checks, and 55 dental dock regression checks pass on the private display. Native OS minimize/restore preserves the selected submodule. Normal and minimum-size screenshots inspected: `artifacts/finance-navigation.png` and `artifacts/finance-navigation-small.png`. Results: `artifacts/finance-verification.json`. The installed launcher uses rebuilt files on the next full exit and launch; the current user session was left untouched.

### Clinic dock apps and image artwork — implemented

- [x] Add Appointments, Work Entry, Patient Record, Treatment Progress, Lab Tracker, Finance, Staff, Treatment Protocols, and Calendar as managed dock apps with only their name and Coming soon.
- [x] Preserve the working Follow-ups app; limit the normal app dock to the ten dental navigation items. Legacy Motion Studio/Records remain private-test fixtures only; remove Playground/Settings placeholders.
- [x] Use detailed raster artwork only for the ten dental app icons, matching each purpose; keep the existing system-menu utility and real captured minimized previews.
- [x] Keep the enlarged app collection usable on smaller displays through shared dock layout and motion.
- [x] Privately verify every new app's controls, snapshots, artwork, and responsive dock; rebuild installed files and document results.

Ten purpose-specific PNGs are saved in `src/assets/dock/`; built-in image_gen prompts and saved paths are recorded in `artifacts/icon-generation.json`. The normal dock has no demo app icons or empty/duplicate previews. Additional thumbnail slots are reserved synchronously before Genie measures capture geometry and shown for minimized apps; snapshots survive viewport changes. The shared layout proportionally fits the complete dock during hover on narrow displays. Legacy demo regression fixtures are enabled only by a private-test switch; the default dental app suite confirms they are absent.

Validation: build/typecheck and 20 unit tests pass. All seven private UI suites pass: dental dock apps 55, Follow-ups 29, Records fixture 21, window manager 51, Electron/motion 28, native session 24, DPR 2 scaling 5. The dental suite verifies each new app's open/fullscreen/minimize/captured thumbnail/restore/close behavior, actual move and corner resize, nine simultaneous minimized previews, and 800/480 px dock containment under hover. Screenshots inspected: `artifacts/clinic-dock.png`, `artifacts/clinic-coming-soon.png`, and `artifacts/clinic-minimized.png`. The installed launcher points to the rebuilt project files; the user's active session stays intact and sees the update after the next full exit and launch. User visual acceptance remains pending.

### Dock edge placement and window depth — implemented

- [x] Place the dock at the bottom screen edge through shared dock geometry.
- [x] Reduce dock transparency, blur, and pill rounding to match the supplied macOS reference's quieter surface.
- [x] Give normal windows clear edge and shadow separation, with stronger depth for the active window.
- [x] Verify overlapping windows, dock motion, and geometry on the private display; rebuild without disturbing the live session.

The supplied Big Sur screenshot is the visual reference. Dock bottom is now 0 px, superseding the earlier 8 px margin; the normal window-to-dock gap remains 8 px. Dock background opacity is approximately 94%, blur 10 px (previously 28 px), corner radius 16 px. Shared normal-window shadows distinguish active and inactive windows; fullscreen removes the shadows. Build/typecheck, 19 unit tests, 51 window checks, and 28 Electron checks pass, including bottom-edge placement, hover, Genie, resize, focus, and native minimize/restore. Inspected overlapping-window screenshot: `artifacts/window-depth.png`. The installed launcher uses the rebuilt files after the user's next full exit and launch; their live session remains untouched.

Build a separate Electron desktop application in TypeScript, with React for presentation, to prove that FEWA-style dock magnification and Genie minimize/restore motion can work smoothly in this stack. Expand the product only after this experiment succeeds and the user chooses to continue.

## Agreed scope

User-authorized local installation: provide a Linux desktop launcher named **Electron OS** and pin it to the host GNOME dock. It launches this project's built app; keep the project directory and its dependencies in place. No publishing or portable installer is implied.

Installed and verified: `~/.local/share/applications/electron-os.desktop`, `~/.local/bin/electron-os`, and a blue layered SVG icon under the local hicolor theme. Desktop entry validation and build pass; GNOME favorites include the launcher with existing favorites preserved. Launched successfully through `gtk-launch`, verified the running process, and registered Electron's desktop name for dock association. The launcher detaches from its launching terminal and logs to `~/.cache/electron-os/launcher.log`.

All app modal backdrops, dimming, and blur must be confined to the owning app window. Other windows, dock, and outer OS controls remain usable.

Visual hierarchy: keep the parent app title bar/frame crisp; modal effects cover only its content area. Use a compact form, modest shadow, clear surrounding margins, and a parent-app context label so the form reads as content inside that window.

All internal apps use the shared macOS-style title bar: red close, yellow minimize, and green maximize/restore circles on the left; centered app name; neutral light strip; dimmed controls/title for inactive windows. The outer Electron environment retains its separate top-right **–** and **×** controls.

Maximized internal apps fill the entire renderer at (0, 0), with no outer margins or reserved dock/status-bar space. Desktop chrome hides while the foreground app is maximized. Hover the bottom center to raise the dock; hover either top corner to reveal the OS status bar. Chrome stays available while the pointer uses it and hides after departure. Returning to normal app size restores persistent chrome. Genie temporarily keeps the dock visible at its normal position for a stable destination.

Full-screen app verification: build/typecheck, 22 Records checks (including full viewport bounds, hidden chrome, edge reveal, retention and return to normal size), and the full Electron interaction suite pass. Reviewed `artifacts/records-fullscreen.png`. A native restore check exposed inconsistent display dimensions; restore now reapplies the current display bounds and fullscreen state, and the rerun passes. Dock baseline checks use the contracted resting width of 40 px rather than a transient sampled width. Updated prototype relaunched.

Title bar verification: `WindowTitleBar` is shared by Motion Studio and Records. Build/typecheck, all 14 Records checks, and the full Electron interaction suite pass. Reviewed the updated title bar screenshot. The first Electron run timed out at dock hover; an isolated rerun passed. Relaunched the updated prototype.

Scope extension requested by the user: add a separate Records dock app with a semantic table, clear column headings, alternating row colors, and an Add form. Records are demo data held in memory for this prototype; no backend or business integration.

- [x] Implement Records window, dock launch and internal minimize/maximize/restore.
- [x] Implement striped table and validated Add/Cancel form.
- [x] Verify adding a record, cancelling, and state preservation through Genie; inspect screenshots and relaunch.

- A separate product and codebase; do not migrate or modify FEWA OS.
- Electron + TypeScript, with React for the desktop interface.
- Light theme: FEWA's turquoise-shore photograph, light system bar, translucent light dock, and readable dark text. The native startup background remains light.
- Readable typography: 14–16 px main interface/body text, 11–12 px small labels, medium body weight and semibold titles/controls. Give the internal window enough room for the larger text.
- A desktop surface filling the selected screen through a frameless fullscreen Electron window, including the host dock/taskbar area. Use full display bounds rather than the reserved work area.
- Only **–** and **×** at the environment's top right. **–** minimizes the entire Electron environment to reveal the host desktop without quitting; **×** exits. Restoring from the host taskbar/dock returns fullscreen. Internal app controls minimize/maximize only the app.
- A dock whose icons follow a shared bell-curve magnification field around the pointer.
- One simple internal test window with recognizable content and internal minimize, maximize/restore, and close controls.
- Genie animation between that internal window and its dock target, matching the FEWA reference geometry and timing.
- Restore through clicking the minimized window's dock target. Clicking its launcher opens or focuses it when appropriate.
- Linux is the initial proof environment. Other platforms receive separate validation when requested; do not infer cross-platform success from Linux.

The environment stays fullscreen while its internal windows minimize/expand/restore. Genie applies to Studio and Records independently. The top-right **–** minimizes the entire environment without quitting; **×** exits. Internal expanded presentation is fullscreen, with dock/status-bar reveal rules described above.

## Excluded from this experiment

SDK, Rust services, business workflows, identity, workspace databases, package systems, app-to-app intents, integrations, networking, distribution, installers, automatic updates, and a complete application ecosystem. No Flutter runtime in the new product.

## Reference and motion contract

FEWA is the visual and behavioral reference. Record the exact reference commit before implementation so acceptance compares against a stable target.

Archived reference project: `/home/master-x/Desktop/fewa_business_os/refrence`. Read `docs/motion/GENIE_ENGINE.md` and locate the corresponding dock, Genie geometry, snapshot, and lifecycle code at the selected commit. Do not assume source paths are identical across FEWA branches.

- [x] Record reference branch, commit, and relevant source paths below.
- [ ] Capture or retain reference demonstrations of dock hover, minimize, and restore.
- [x] Record bell-curve width, magnification, spacing, pointer smoothing, and baseline dock dimensions.
- [x] Record Genie duration, phase overlap, easing, direction, mesh geometry, and source/target bounds.
- [ ] Agree any unavoidable visual differences explicitly; do not silently replace Genie with a scale/fade animation.

## Implementation checklist

### 1. Independent application foundation

- [x] Scaffold Electron, TypeScript, React, and a repeatable development/build setup in this directory.
- [x] Separate Electron main, preload, and renderer responsibilities.
- [x] Keep renderer Node integration disabled and context isolation enabled; expose only narrow window-control functions through preload.
- [x] Launch the application locally and render the desktop surface.
- [x] Keep the fullscreen environment fixed; make only the internal window title draggable.
- [x] Implement top-right **–** (native environment minimize) and **×** (environment exit), with fullscreen on native restore. Internal app controls use the shared shell manager.
- [x] Verify resizing, maximized state, and display scaling keep controls and desktop aligned.

### 2. Dock and bell-curve magnification

- [x] Render a small set of local placeholder icons and a target for the internal test window.
- [x] Port the reference shared field/math approach; drive icons from one pointer field and animation loop.
- [x] Match the reference center magnification, neighboring falloff, spacing, and dock anchoring.
- [x] Preserve predictable hit targets while icons change size.
- [x] Smooth pointer motion and return to baseline on pointer exit without oscillation or abrupt jumps.
- [x] Keep the complete dock centered through hover and minimized-window target changes.
- [x] Verify rapid pointer sweeps, edges, and repeated entry/exit.

### 3. Internal test window

- [x] Create a simple window with readable text, contrasting blocks, and a stateful input or counter for visual and state checks.
- [x] Implement open/focus, internal minimize, internal maximize/restore, and dock-triggered Genie restore.
- [x] Model visible, minimizing, minimized, and restoring states explicitly.
- [x] Keep its content and state alive across minimize/restore.
- [x] Track its rectangle and dock destination accurately during outer-window resizing and display scaling.

### 4. Genie renderer

- [x] Prove a snapshot/texture capture method for the simple test content without permissions or external services.
- [x] Implement a WebGL textured mesh with reference-derived geometry, timing, easing, and deformation phases.
- [x] Match the reference minimize path and restore path; use the reference's reverse-time relationship where defined.
- [x] Hide the live test window during the overlay and reveal it at the correct restore boundary.
- [x] Align the first and final mesh frames with the live window and dock destination without visible jumps.
- [x] Preserve readable texture orientation and avoid mesh folding, clipping, flicker, or stretched end frames.
- [x] Keep animation resources bounded and release snapshots, textures, and listeners when no longer needed.
- [x] Handle repeated clicks, pointer hover during animation, resize, and interrupted transitions with deterministic state.
- [x] Provide a stable direct minimize/restore fallback for unavailable WebGL or failed snapshot capture, and honor reduced motion.

### 5. Validation and visual comparison

- [x] Type checking and the production build pass.
- [x] Add focused checks for bell-curve math, mesh endpoints/order, and lifecycle transitions where they protect real behavior.
- [x] Verify fullscreen screen coverage, internal maximize/restore, top-right internal minimize, and environment exit on Linux.
- [ ] Compare dock behavior and Genie recordings side by side with the pinned FEWA reference.
- [x] Check normal and high display scaling, outer-window resize, and maximize/restore.
- [x] Run repeated internal minimize/restore cycles and confirm preserved content, correct focus, and no accumulating overlays/resources.
- [x] Record frame timing on the actual test machine; target smooth animation at its refresh rate, with approximately 16.7 ms per frame on a 60 Hz display.
- [x] Confirm fallback and reduced-motion behavior remain usable.
- [x] Record verification commands, environment, results, and known limitations below.
- [x] Present the runnable prototype and captured motion evidence for the user's visual acceptance. Exact FEWA side-by-side comparison remains pending.

## Acceptance criteria

The experiment succeeds when all of the following are demonstrated:

1. The separate Electron environment covers the screen, exposes only **–** and **×** at top right, and remains fullscreen through all internal window transitions.
2. Dock magnification follows a smooth bell-shaped field and matches the FEWA reference behavior.
3. An internal test window minimizes into the dock and restores with the reference Genie motion, preserving its state.
4. Hover, repeated interaction, resizing, and scaling cause no visible lifecycle errors or abrupt endpoint jumps.
5. The prototype performs smoothly on the recorded Linux test machine and retains usable fallback behavior.
6. The user accepts the visual match. Technical checks alone do not establish an exact visual match.

## Decisions and evidence

| Item | Record |
|---|---|
| FEWA reference branch/commit | `codex/m08-pharmacy-engine` at `314bebd5f45591e966eee2482c7f4a994e2a7564`; local older baseline reconciled. |
| Reference source paths and recordings | `lib/shell/genie/`, `lib/shell/dock/`, `docs/motion/GENIE_ENGINE.md`. Pinned copies and SHA256 in `references/`. FEWA recording/comparison remains pending. |
| New project product name | Pending; does not block prototype implementation |
| Snapshot capture approach | Bounded main-frame Electron `webContents.capturePage`; captured PNG becomes WebGL texture and dock preview. No screen-capture permission or service. |
| Test machine, OS, GPU, display scaling/refresh | Linux 6.8.0-111-generic, Intel Core i5-1035G1; actual Electron 44.7.0. Primary display ~60 Hz, tested device pixel ratios 1 and 2; renderer reports WebKit WebGL. See evidence JSON for display details. |
| Build/type-check/test commands and results | `npm run build` (both TypeScript checks + Vite + native bridge build), `npm test` (5 motion tests), `npm run test:electron` (fullscreen interaction checks), `npm run test:scaling` (5 checks): PASS before theme revision; theme revision verification below. |
| Performance and comparison evidence | `artifacts/electron-verification.json`, `artifacts/scaling-verification.json`, desktop/hover/studio/Genie/high-DPI PNGs. Frame timing recorded; exact FEWA visual comparison pending. |
| Accepted differences or known limitations | New artwork/icons, fixed preview slot, bottom dock only. After a minimized resize, stale capture is discarded and restore uses the direct fallback. User acceptance of visual differences is pending. |
| User visual acceptance | Pending |

## Progress rule

Keep this checklist current before reporting completion. Record failed or partial checks honestly. Changes to the agreed scope must be reflected here. Completion of this prototype does not authorize expanding the product, modifying FEWA, or publishing it.

## Implementation record — 2026-10-13

- Implemented the standalone project with Electron main/preload/renderer separation. Renderer has no Node integration; after the fullscreen clarification, native APIs are limited to environment exit and bounded capture of this window. All minimize/maximize logic is internal renderer state.
- Ported the FEWA raised-cosine-squared bell, live-width integral layout, 1200/700 damped followers, 636 ms 50/40 Genie phases, quadratic funnel and 64–160 row/two-column WebGL mesh. Native snapshots preserve real rendered note/counter content.
- Dock magnifies from 40 px to 110 px at the lens center, uses 10 px gaps and a 200 px influence radius. Dock geometry freezes during Genie to preserve the captured destination. A continuous hit region prevents gaps from restarting the field.
- Actual Electron checks cover native controls, hover/sweeps, capture, five repeated cycles, state preservation, reduced motion, lost WebGL context, interruption on resize, 2× scaling, and out-of-bounds capture refusal.
- The final ten timing samples without screenshots had median frame intervals around 16.7 ms, p95 around 16.7–16.8 ms, and maxima around 16.7–16.8 ms (40–41 frames each). An earlier run had a 50 ms gap. The final 2× scaling run produced 35 frames, with a maximum 50 ms gap and several 33 ms gaps. See `artifacts/frame-summary.json`; high-DPI smoothness still needs visual review. Screenshot capture during an earlier animation disturbed its timing; that sample is retained and not used as clean performance proof. These are measurements on this machine, not a guarantee for other hardware.
- An initial interaction check measured baseline before the native pointer had settled. The check now explicitly waits for the resting 40 px geometry; passing evidence is retained. TypeScript configuration was corrected for the installed compiler's Node16 resolution rules.
- No FEWA source was modified. No SDK, business services, installer, publishing, or future product work was added.
- Remaining acceptance: view FEWA and this prototype side by side, agree any visual differences, and receive user visual acceptance. Technical completion does not mark those gates accepted.

- Final built application launched with `npm start` on the user's display for review. Run instructions are in `README.md`.

## Scope clarification — 2026-10-13

The user clarified that the environment must cover the full screen. Host-window minimize/maximize is removed; only internal dock applications minimize/maximize/restore. The environment exposes **–** and **×** at top right. **–** is interpreted as minimizing the active internal app, keeping the environment fullscreen; **×** exits. Earlier windowed control evidence is historical and superseded by the fullscreen checks below.

- [x] Fullscreen revision built and actual Electron checks pass.
- [x] Maximized internal window follows the same Genie route and restores maximized, preserving its content.
- [x] Final fullscreen prototype launched for review.

### Fullscreen revision verification

- Build/typecheck and 5 motion tests pass. Actual Electron checks prove fullscreen startup, exactly two environment controls, internal maximize/restore, Genie restore of a maximized window, disabled **–** without an active app, and exit. The native window remains fullscreen and unminimized throughout internal transitions.
- 2× capture/Genie, bounded capture refusal, stale-snapshot fallback on display-size change and retained fullscreen state pass. Display-size changes are simulated through Chromium device metrics; the environment is not resized/minimized through a product UI action.
- Current evidence supersedes the windowed baseline. The older screenshots/JSON are retained in `artifacts/windowed-baseline/`. Current screenshots and JSON are in `artifacts/`; `frame-summary.json` describes this final source. The fullscreen 2× run has occasional frame gaps (maximum ~66.6 ms); visual smoothness on high-DPI hardware remains a review point.

### Fullscreen startup correction

The user observed that the environment still did not cover the display. The prior test checked only Electron's fullscreen flag; its screenshot was actually1344×924 despite a reported1920×1080 display. That was insufficient verification. This correction removes fixed startup/minimum dimensions, uses detected full display bounds, requests fullscreen after the window is ready, and verifies actual renderer/native dimensions against the display. Prior fullscreen acceptance is superseded until those checks pass.

- [x] Startup native bounds and renderer viewport cover the detected display. Actual native and renderer checks pass; screenshot is1920×1080 on the tested display.
- [x] Corrected environment relaunched on the user's screen.

- Corrected startup removes fixed1280×840 and minimum dimensions, initializes from the complete detected display bounds, then shows, requests fullscreen, and focuses after readiness. The corrected interaction suite verifies both native bounds and renderer viewport against detected1920×1080 display bounds. Capture confirms1920×1080 pixels. The environment exposes no native minimize/maximize handler. Internal dock transitions and internal maximize/restore still pass.

### Light theme and full display coverage clarification

- Fullscreen means the entire selected display, including the host dock/taskbar area; startup uses `display.bounds`, not `display.workArea`.
- Normal and 2× checks now verify the native origin and dimensions as well as the renderer viewport. They run separately because simultaneous graphical tests interfere with pointer/keyboard focus.
- The exit check handles the native window closing before Playwright finishes acknowledging the click, while still requiring the page to close.
- [x] Replace dark wallpaper, system bar, dock, tooltips, feedback, and native startup background with the light palette requested by the user.
- [x] Verify the light build, internal motion, fullscreen bounds, scaling, and screenshots.
- [x] Relaunch the light prototype for review.

- Light revision verification: build/typecheck, 5 motion tests, 22 Electron interaction checks, and 5 scaling checks pass. Desktop and hover screenshots reviewed at 1920×1080. The first hover check had a transient timing failure; a complete isolated rerun passed. Latest timing evidence supersedes previous summaries: high-DPI has a 66.6 ms initial frame interval, so smoothness still needs user review. Exact FEWA visual acceptance remains pending.

### Typography revision

- Increased the formerly 7–12 px interface text to 11–16 px, with medium body weight and semibold controls/labels. Desktop heading is larger and semibold; studio heading is 28 px and semibold. Secondary text has stronger contrast.
- Expanded the normal internal window to 760×480 and the sidebar to 184 px to accommodate the larger text; display-size limits still apply.
- Build/typecheck and all 22 Electron interaction checks pass; inspected the updated studio screenshot for readable text and clipping. The hover test now waits for actual magnification instead of assuming it finishes within 400 ms.

### Latest outer minus clarification

The user explicitly requested normal host application behavior: top-right **–** minimizes the entire environment to reveal the host desktop, without quitting. Startup and restore remain fullscreen. Native minimize IPC is now exposed alongside close. Earlier records claiming no host minimize API or an inactive outer minus are historical and superseded. Internal window controls still use Genie independently.

### Records and window-scoped form verification

Build/typecheck passes. All 14 Records checks pass, including semantic column headings, alternating rows, form validation, Save/Cancel, app-contained modal bounds, another dock app opening while the form remains open, Genie/state preservation, and internal maximize. Updated Electron checks pass, including native minimize without quitting and fullscreen restore. Table/form screenshots reviewed in `artifacts/`. Records are session-only; restarting the environment resets them. Relaunched the updated application for review.

### Dock and window research — 2026-10-13

- Completed the requested research report: [Dock and application window behavior](docs/DOCK_WINDOW_RESEARCH_REPORT.md).
- Covers Apple, Microsoft, and Google documentation, Apple's Sequoia release announcement, Chromium and WinUI Gallery source, third-party Genie recreations, and a Microsoft technical blog.
- The user clarified that “black hole zone” means the dock destination where a minimizing window disappears. The report explains target resolution, capture/hide sequencing, deformation, restoration, clipping proposals, and fallback behavior.
- Includes a local source assessment and proposed future acceptance scenarios. Recommendations are not marked as implemented or added to the approved implementation scope. No application code was changed for this research task.

### Shared window manager and resizing — implemented

The user authorized the first implementation stage from the research report. Scope: shared internal window identity, lifecycle, focus/z-order, normal bounds, fullscreen presentation, common Genie coordination, and resizing from all edges and corners. Preserve app content, window-owned forms, dock behavior, and native environment controls. Snapping and a mini-program SDK remain outside this stage.

- [x] Move Studio and Records onto one shared window manager and window frame.
- [x] Preserve normal bounds and app state through fullscreen and minimize/restore.
- [x] Transfer focus to the next visible window after minimize/close.
- [x] Add all eight resize handles with matching cursors and minimum-size constraints.
- [x] Keep the opposite edge/corner anchored while resizing; retain reachable bounds on smaller displays.
- [x] Handle pointer capture, cancellation, release outside the window, viewport changes, and unmount cleanup.
- [x] Keep modal effects inside their owner; prevent conflicting gestures during forms or Genie.
- [x] Verify geometry constraints, real Electron pointer resizing, focus, content, fullscreen and Genie regressions.
- [x] Build the updated application.
- [x] Relaunch the updated application for review.


Verification: build/typecheck and 19 unit tests pass. Real Electron verification records 51 window checks, 22 Records checks, 24 environment/Genie checks, and 5 scaling checks. Evidence is in `artifacts/windows-verification.json`, `records-verification.json`, `electron-verification.json`, and `scaling-verification.json`. Inspected `artifacts/window-resizing.png`: title and controls remain clear; the resized table scrolls inside its frame.

The shared manager owns window phases, normal bounds, fullscreen presentation, active order, remembered focus, modal state, and interaction locks. Both apps use `ManagedWindowFrame` and the common snapshot/Genie lifecycle; business content remains in the app components. Normal resize minima are 540×340 for Studio and 640×360 for Records, reduced to fit the usable area on smaller viewports. Handles use 7 px edge regions and 15 px corners.

Real-pointer checks exposed early/delayed capture loss and a viewport-change race. Global pointer routing now completes gestures even after capture loss; pointer cancellation, Escape, and deactivation roll back. A queued pointer-up from an old viewport cannot overwrite newly fitted bounds. The first Records regression run timed out on dock reveal; an isolated full rerun passed. High-DPI functional checks pass, but animation timing still has occasional gaps (latest initial interval about 83 ms); visual smoothness remains a separate acceptance gate.

Remaining research recommendations for later stages: refine dock destination masking and interruption policy, add keyboard move/resize and further accessibility review, and consider snapping or multiple windows per app. These are not marked implemented. SDK and persistent business services remain outside this prototype.

Updated build relaunched using the installed Electron OS launcher and its native main process verified running. User visual acceptance remains pending.

### FEWA wallpaper — implemented

The user requested the same wallpaper image as FEWA OS. FEWA's `kDefaultWallpaperAsset` selects `assets/bg_image/fewa-turquoise-shore.jpg`, rendered with `BoxFit.cover`. Copy the original bytes into this independent app, render centered with `object-fit: cover`, and remove the previous synthetic aurora/grain layers.

- [x] Copy the exact FEWA default photograph and apply it to Electron OS.
- [x] Build and verify the image loads and covers the viewport at different aspect ratios.
- [x] Relaunch the updated Electron OS for review; the installed dock launcher uses this build.

Wallpaper verification: original and copied image bytes match exactly; the bundled image loads and covers 1920×1080, 1000×700, and 800×1100 viewports. Build/typecheck passes with no renderer exceptions. Evidence: `artifacts/wallpaper-verification.json` and `artifacts/fewa-wallpaper.png`. Final screenshot inspected. Added a light translucent backing behind the welcome text and desktop footnote to preserve readability; the wallpaper image itself is unchanged.

### Compact dock and usable window area — implemented

- [x] Reduce dock icon, preview, spacing, and tray geometry by 10%, preserving shared magnification and Genie target measurement.
- [x] Lower the dock to an 8 px screen-bottom margin.
- [x] Use a 4 px gap below the environment bar and an 8 px gap above the resting dock for normal window bounds.
- [x] Open Records using the available normal workspace; preserve fullscreen and manual resizing.
- [x] Verify spacing at the supplied 1366×768 size and another display size, plus dock hover, Genie, and window controls.
- [x] Build and relaunch the updated dock application.

These spacing changes apply to normal, unmaximized windows. Fullscreen still fills the viewport and hides desktop chrome until edge reveal. Records opens at the normal usable bounds; Motion Studio keeps its smaller preferred size. The dock hover field is observed without placing an invisible intercepting surface over normal window edges.

Validation: build/typecheck, 19 unit tests, 22 Records checks, 51 window-manager checks, and 24 Electron/motion checks pass. Renderer viewport checks at 1366×768 and 1920×1080 measure 4 px above Records, 8 px between Records and dock, approximately 8 px dock bottom margin (CSS subpixel rounding), and 36 px resting icons. Both screenshots inspected; evidence in `artifacts/compact-layout-verification.json`, `artifacts/compact-layout-1366.png`, and `artifacts/compact-layout-1920.png`. Updated Electron OS launched through the installed dock launcher and its native main process verified. User visual acceptance remains pending.

### Dock system menu replacing the OS bar — implemented

- [x] Remove the environment top bar and its top-edge reveal regions.
- [x] Add a Start-style dock icon with a scoped system menu for Minimize Electron OS and Exit Electron OS.
- [x] Support keyboard navigation, Escape, outside dismissal, and fullscreen dock access.
- [x] Reclaim the top bar space for normal windows while preserving app title bars and controls.
- [x] Verify native minimize/restore/exit, window behavior, motion, and the new menu; rebuild and relaunch the installed app.

The user authorized replacing the entire environment top bar with a Start-style dock menu. This supersedes earlier checklist requirements for top-right host controls and top-corner bar reveal. Only internal app title bars remain. Normal usable bounds now start 4 px below the screen top, reclaiming 43 px of height; fullscreen still fills the viewport. The revealed fullscreen dock remains visible while its menu is open. The menu has two actions, initial focus, arrow/Home/End navigation, Escape returning trigger focus, outside-click dismissal, and closes on native blur.

Validation: build/typecheck and 19 unit tests pass; 21 Records checks, 51 shared-window checks, and 27 Electron checks pass, including actual native minimize, fullscreen restore, and exit through the new menu. Layout and menu containment verified at 1366×768 and 1920×1080. Evidence: `artifacts/dock-system-menu-layout-verification.json`, `artifacts/dock-system-menu-1366.png`, `artifacts/dock-system-menu-1920.png`, and updated verification reports. Updated installed dock launcher build relaunched and main process verified running. Visual acceptance remains for the user.

### Native minimize/restore continuity — implemented

- [x] Preserve internal window geometry, state, data, and open forms across whole-environment minimize/restore.
- [x] Prevent transient host fullscreen sizes from clamping internal windows.
- [x] Remove recursive restore bounds/fullscreen/focus changes and settle dock motion before native minimize.
- [x] Reuse the running session when launching again from the installed host-dock entry.
- [x] Exercise native restore and installed-launcher activation with normal, fullscreen, and internally minimized windows, then rebuild the installed app.

Investigation reproduced host fullscreen exit during native minimize: renderer changed from 1366×768 to 1334×726, which previously clamped normal app bounds. The old restore handler reentered itself, repeatedly calling setBounds, setFullScreen, and focus. Evidence: `artifacts/native-before.json`. The replacement suspends layout before minimize, paints the closed menu/resting dock and stable wallpaper before the host animation, and resumes layout after fullscreen has settled. Restore no longer writes bounds or recursively focuses. The native trace now makes one fullscreen call and no app bounds writes (`artifacts/native-after.json`). Host compositor motion remains controlled by the host; its visual feel still needs user review.

Single-instance activation now returns repeat launches to the running session. Tests use distinct user-data profiles, leaving the user's active environment alone. The installed launcher accepts forwarded arguments; normal host-dock launch remains unchanged.

Validation: build/typecheck, 19 unit tests, 21 Records checks, 51 shared-window checks, 27 Electron checks, and 24 native-session checks pass. The new regression suite exercises native restore and the exact installed launcher executable in an isolated profile, with resized normal windows/open form drafts and fullscreen Records/internally minimized Studio. It verifies identical geometry, focus order, presentation, phases, saved row values, note, counter, draft, and retained DOM nodes; also verifies native window identity and stable hidden-renderer desktop/dock geometry. Evidence: `artifacts/native-session-verification.json`. Use `npm run test:native-session`.

The rebuilt files are used by the existing installed host-dock launcher. The user's current session was intentionally left running to preserve in-memory data; the fix takes effect on the next full exit and launch. Quitting still ends this prototype's session data; native minimize/restore preserves it.

### Remove desktop intro — implemented

- [x] Remove the welcome/intro card and its unused styles and icons. Apps continue to open from the dock.
- [x] Rebuild the installed launcher files. Existing running sessions load this visual change on their next full launch.

### Follow-ups dock app — implemented

- [x] Add Follow-ups to the shared window manager and dock, with its own snapshot destination and standard controls.
- [x] Recreate the reference body: heading/actions, four selectable summary cards, search/date toolbar, striped table, checkboxes, Details, and pagination.
- [x] Use dummy patients; make search, day navigation, bucket filtering, status toggles, Refresh, create form, and Details usable in memory.
- [x] Keep create/details dialogs scoped to their owning window; preserve session state through internal and native minimize/restore.
- [x] Verify behavior and reference layout at 1366×768, build the installed files, and document results.

Follow-ups is a third managed app with a teal calendar-clock icon and a dedicated captured preview target. Its content matches the provided reference body, excluding the browser and black site navigation. It starts with 13 synthetic patients and the Missed bucket selected; four records per page keep pagination visible at 1366×768. Search, summary/date filters, day navigation, all three status toggles, create, Details, Refresh, and pagination work in memory. Dialogs and background blur remain inside this app. Demo dates use Gregorian formatting relative to session start. Native restoration now returns keyboard focus to the active app's remembered field, including an unfinished form.

Validation: build/typecheck and 19 unit tests pass. UI checks: followups: 25, records: 21, windows: 51, electron: 27, native-session: 24, scaling: 5. Screenshots `artifacts/followups-1366.png` and `artifacts/followups-form.png`; behavior evidence `artifacts/followups-verification.json`. The final UI suites run on a private headless GNOME/Wayland display. Screenshots were inspected. The updated build is ready through the installed launcher; the user's current session stays open and loads the Follow-ups icon on its next full launch.

### Quiet UI testing — implemented

The user requested that automated tests never interrupt Brave/YouTube or bring Electron windows in front of their running apps.

- [x] Route all npm UI test commands through a private headless GNOME compositor with its own virtual monitor, D-Bus session, temporary settings paths, and app profiles.
- [x] Remove host display/session variables from test child environments and force the private Wayland socket.
- [x] Refuse direct UI test launches or fallback to the real desktop; verified the guard exits before Electron opens.
- [x] Lower test CPU priority and limit software rendering to two threads.
- [x] Run all six UI suites on the private display, including native restore/launcher continuity and DPR 2, without touching the user's running app.
- [x] Document the workflow in README.md and AGENTS.md.

Use `npm run test:ui` or individual `npm run test:<name>` commands. There are no root/system-package changes. A trial Xvfb/Openbox runtime was removed after its X11 minimize state proved incompatible with this Electron build; the final runner uses the already-installed GNOME headless compositor and the same Wayland protocol as the user's desktop. Private-display software rendering checks functionality, not live-desktop performance.

## M02 host/state implementation — 2026-10-15

Implemented strict OS-only preference storage, atomic journal/migration/recovery, narrow status/preferences bridge and bounded host restore polling. Linux: 35 unit tests, build/typecheck and private host-state/native-session checks pass sequentially. See [M02 evidence](dental-os_v1_working_info/milestone-02-host-and-os-state/VERIFICATION_EVIDENCE.md). Windows device verification remains pending, so full milestone acceptance is not claimed and M03 is not started. No backend/deployment/live-session changes.

## Dedicated repository and Windows CI setup — 2026-10-15

User authorized connecting to Business-It-Partners/dental-os, preserving history/work, establishing main and milestone branches, committing/pushing the reviewed project and adding Windows Actions. Physical Windows-device tests are deferred until after M11, before final product release. CI must not deploy the backend. Publication audit, checkpoint identities and run evidence are recorded in docs/GIT_AND_CI_SETUP.md.

Windows CI closeout: [run 38778013772](https://github.com/Business-It-Partners/dental-os/actions/runs/38778013772) passes at `fd124b5c20e0abbac0a3f99a79be2cc01cddb59c`. Dedicated origin/main and M01/M02 branches are published; Flutter origin retained as flutter-reference. M02 is verified for automated Linux/Windows scope under the approved physical-device deferral. M03 not started. No cloud backend deployment or live-session restart.


## M03 isolated runtime implementation — 2026-10-15

User authorized M03 only. Two fixed private sample apps now execute in separate sandboxed renderers/origins/partitions, with platform-bound reports, crash/hang supervision, scoped dirty-close and shared shell composition. Foreground native view plus inactive snapshot mirrors preserves existing dock/overview/Genie; activation-click and background-invalidation limitations are explicit in the composition ADR. Linux: 39 unit tests, final build, isolated runtime/DPR proof and shared overview/native regressions pass sequentially. Windows CI is pending on `codex/milestone-03`; physical Windows remains deferred. See [M03 evidence](dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md). No backend/cloud deployment, M04 start or live-session restart.

M03 closeout: final source `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a` passes Linux 40 unit tests/build/private runtime-DPR and applicable shared regressions; Windows run [38782178992](https://github.com/Business-It-Partners/dental-os/actions/runs/38782178992) passes 39 unit tests (one POSIX-only skip), build, four host and 28 runtime checks. Capture corners and native-focus ordering were repaired and rerun. ADR-007 is accepted for declared sample scope. M03 VERIFIED under approved physical-device deferral; user acceptance pending. Main stays M02 and M04 is not started. All local owned test/display jobs exited.


## M03 main integration and standing workflow — 2026-10-16

User authorized integrating verified M03 into main, retaining milestone branches/checkpoint tags, and future merges after each milestone passes required verification. Normal merge preserves M03 and main history; duplicate cleanup-documentation conflict reconciled, no runtime changes. Tested runtime SHA-256 manifest matches; documentation checks pass. No heavy checks repeated, backend deployment, live-session restart or M04 start. Canonical policy: docs/GIT_AND_CI_SETUP.md; enforced through AGENTS.md, DEVELOPMENT.md and roadmap/status records. Physical Windows testing remains after M11/before final release.


## M04 SDK/broker implementation — 2026-10-16

User authorized M04 inspection/plan/implementation/verification/integration, then continuing directly to M05. SDK 1.0 and bounded named-operation broker now bind caller/frame/origin, capabilities, connection/generation and staging environment. Host-only fixture identity, preserved existing appointment routes/idempotency/revision, structured errors, cancellation/deadlines/limits and lifecycle/status interfaces are implemented. Linux 64 unit/local HTTP tests, build and private SDK/M03 regressions pass; Windows pending. No backend mutation/deployment, real auth or live-session restart. See M04 notes/evidence; M05 is authorized next but not yet active.

M04 closeout: source `672a8118` / checkpoint/m04-ci passes Linux 64 tests and Windows run 38842666568 (63 tests, one POSIX-only skip), build and private/hosted SDK/runtime checks. G04 verified within fixture scope; runtime hashes unchanged for normal main integration. Milestone branch/checkpoint retained; M05 authorized next; no backend changes or deployment.


## M05 platform identity implementation — 2026-10-16

Continued immediately after M04 as authorized. Trusted Firebase/Worker sign-in, coordinated renewal, safe clinic context/capability, protected optional refresh persistence, session-only fallback, lock/logout/switch and generation-fenced app/layout/capture cleanup implemented. Linux 77 unit tests, build and six focused private regressions pass. Approved existing staging account proved real CLI and actual private desktop login/renewal/lock/logout plus invalid identity and clinic/Super Admin separation; no business writes, user changes or web-session revocation. Credentials stayed outside tracked files/evidence and temporary inputs were removed. Windows pending; see M05 evidence. New normal sign-in gate loads on a future user-controlled full relaunch; live session unchanged.

M05 closeout: source `07c2fb21` / checkpoint/m05-ci passes Linux 77 unit tests/build/private regressions, actual approved staging CLI/desktop identity checks and Windows run 38845000521 (76 tests, one POSIX skip; all host/runtime/SDK/identity/privacy checks). Windows native encryption probe passed; first live-profile EBUSY harness failure was repaired and retained. Evidence-only integration preserves all 56 source-manifest hashes. Milestone branches/checkpoints retained; normal main merge authorized. No credentials in repository/reports, temporary credential inputs removed, no backend edits/deployments or running-session interruption. Stop after M05; M06 not started.

## M06 — Verified packages and local lifecycle, 2026-10-16

User authorized the next sprint after M05. Implemented strict signed dentalpkg/1 web packages, OS-profile immutable installation registry/journal/recovery, bounded safe extraction, active pointer/version retention, launch revalidation and pinned bytes, verified broker identity/grants and contained uninstall. Signed private samples replace direct runtime asset loading. No production trust key, third-party/sideload interface, backend change or deployment. Existing Store remains a synthetic presentation until M07/M08 integration. [M06 status](dental-os_v1_working_info/milestone-06-verified-packages/STATUS.md) and [evidence](dental-os_v1_working_info/milestone-06-verified-packages/VERIFICATION_EVIDENCE.md) govern completion. Sequential Linux unit/build/private runtime checks and applicable Windows CI are required before checkpoint/main integration. Physical Windows tests remain deferred after M11 and user visual review remains pending.

M06 completion: Linux 142 unit tests, build/typecheck, eight real process-exit and eight installed-package runtime cases pass; existing runtime (28), SDK (15) and identity (20) private suites pass. Windows run [38848241451](https://github.com/Business-It-Partners/dental-os/actions/runs/38848241451) passes at `083f9128`: 141 unit pass / one POSIX-only skip plus build and all applicable package/host/runtime/SDK/identity gates. `checkpoint/m06-ci` and codex/milestone-06 retain the tested checkpoint/history; authorized normal merge integrates M06 into main. No repeated heavy check for evidence-only closeout. M07 not started; stop after M06. All task-owned jobs exited; live session and local reference archive preserved.

## M07 — First-party Store and staging distribution, 2026-10-16

Started on user authorization after M06. Desktop signed catalogue/clock/replay checks, bounded anonymous package delivery, current admin authorization, actual installed Store/dock state and isolated sample launch/uninstall/restart are implemented locally. Existing prototype Store is private-fixture-only. Local full 182 unit checks plus final 46 focused distribution checks, final build, 10 Store/private and 20 identity cases pass. Separate unchanged-baseline SaaS worktree SYS-0005 implements additive staging-only catalogue/policy and operator publisher; full Worker 410 tests and exact typecheck pass. No deployment, provisioning, production mutation or main integration. [M07 status](dental-os_v1_working_info/milestone-07-store-and-distribution/STATUS.md), [evidence](dental-os_v1_working_info/milestone-07-store-and-distribution/VERIFICATION_EVIDENCE.md), and [concrete rollout](dental-os_v1_working_info/milestone-07-store-and-distribution/STAGING_ROLLOUT.md) distinguish local proof from pending actual G07 cloud acceptance. Windows CI pending. Actual staging rollout needs the separate approval required by AGENTS; M07 stays unverified/unmerged until then. M08 not started.
