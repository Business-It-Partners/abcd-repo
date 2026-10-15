# Dental OS — Electron Desktop

## Product architecture and milestone roadmap

- [Dental OS V1 architecture](dental-os_v1-documentation/00_V1_README.md): constitution, trust/ownership boundaries, app delivery, sessions, privacy and acceptance gates.
- [Master roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) and [current status](dental-os_v1_working_info/00_V1_STATUS.md): eleven production-platform milestones with per-milestone plans, status, implementation notes and evidence.
- [Canonical repository structure](dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md): target layout, ownership, import rules and migration boundaries; source files have not moved.
- [Current prototype/gap map](dental-os_v1-documentation/21_V1_CURRENT_BASELINE_AND_GAPS.md): implemented demo behavior versus planned services.

Permanent scope: company first-party apps only, Windows/Linux, existing Dental SaaS authority. The prototype instructions below describe current source, not completion of the production roadmap. Validate documentation with `python3 tools/check-dental-docs.py`.

On this Linux desktop, **Electron OS** is installed in the Applications menu and pinned to the host Ubuntu dock. Click its blue layered icon to launch. The launcher uses this project directory's built files and dependencies, so keep the directory in place. Launcher: `/home/master-x/.local/share/applications/electron-os.desktop`.

The active Electron + React + TypeScript desktop project. It ports FEWA's shared dock field and Genie mesh geometry; no Flutter or business services are included.

The desktop uses the same original turquoise-shore photograph as FEWA's default wallpaper, centered and cropped to cover the screen. Light interface surfaces stay readable over the photo.

The dock is 10% smaller than the original prototype and touches the screen bottom. Its mostly opaque neutral surface uses modest blur and tighter rounding. Normal windows have layered edge shadows, with stronger depth on the active window. Follow-ups opens across the usable normal workspace, with 4 px below the screen top and 8 px above the resting dock. Resizing and fullscreen behavior remain available. The dock hover surface stays below normal windows so it cannot block their resize edges.

## Run

```sh
npm ci
npm run dev
```

For subsequent launches after building:

```sh
npm start
```

The environment opens fullscreen across the selected display, including the area normally occupied by the host dock/taskbar. Startup uses the full display bounds, not the smaller work area. Open any dental app from its illustrated dock icon. Use the yellow control to minimize it and click its captured preview or app icon to restore it. Green maximizes/restores the internal app window. Drag its title bar to move it, or double-click it to maximize/restore.

The environment has no top status bar. Two separate buttons at the start of the dock provide **Minimize Electron OS** (blue minus) and **Shut down Electron OS** (red power), each with one click. Minimize reveals the host desktop without quitting; Shut down closes only the Electron environment. Restore it from the host taskbar/dock to return fullscreen with the same app windows, positions, saved session rows, notes, counters, and unfinished forms. Repeated launcher clicks activate the existing session instead of opening a fresh environment. Temporary native fullscreen/minimize sizes are ignored by the internal window manager. Internal app controls minimize only their own windows with Genie.

The Playground and Settings icons are visual placeholders. Reduced motion, unavailable WebGL, and invalid geometry use direct minimize/restore.

## Check

```sh
npm run build
npm test
npm run test:electron
npm run test:scaling
npm run test:records
npm run test:native-session
npm run test:windows
```

Electron interaction tests require an active Linux graphical display. They open their own application window and close it when finished. Evidence is written to `artifacts/`.

The active direction is [PRODUCT_DIRECTION.md](PRODUCT_DIRECTION.md), and the work contract is [WORK_CHECKLIST.md](WORK_CHECKLIST.md). The visual match remains subject to user acceptance.

## Source layout

- `electron/`: native window controls, bounded local snapshot capture, isolated preload.
- `src/motion.ts`: shared dock field, damped followers, FEWA Genie geometry.
- `src/genie.ts`: preallocated WebGL texture mesh and animation lifecycle.
- `src/windowManager.tsx`: shared internal lifecycle, focus order, normal bounds, fullscreen state, and modal ownership.
- `src/windowGeometry.ts`: constrained movement and eight-direction resizing.
- `src/ManagedWindow.tsx`: shared app frame, pointer gestures, snapshot/Genie coordination, and fallbacks.
- `src/App.tsx`: desktop, dock, and Studio content.
- `src/App.tsx`: shared dock presentation and direct native minimize/shutdown buttons.
- `tests/`: motion invariants and actual Electron interactions.

The clinic catalog contains ten dental navigation apps: Follow-ups, Appointments, Work Entry, Patient Record, Treatment Progress, Lab Tracker, Finance, Staff, Treatment Protocols, and Calendar. Follow-ups, Staff, and Lab Tracker are implemented session demos. Finance has submodule navigation; the other six apps show their name and **Coming soon**. Each app shares movement, eight-way resizing, focus, close, fullscreen, and Genie minimize/restore. Two separate environment controls provide native minimize and exit. Motion Studio and Records remain regression fixtures, enabled only by a private-test switch; their icons are absent from normal use. Playground and Settings placeholders are removed. Run `npm run test:dockapps` for the dental app collection.

App form overlays and blur are confined to their owning internal window; other apps and the dock remain usable.

The green internal-window control expands the app across the entire screen and hides the desktop dock. Move to the bottom-center edge to reveal the dock and its direct environment controls. The dock stays visible while using it, and hides when you leave. Click green again to return to the normal window and persistent desktop chrome.

Drag any edge or corner of a normal app window to resize it. Opposite edges stay anchored, minimum dimensions keep content usable, and oversized tables scroll. Fullscreen and Genie restore retain the resized normal rectangle. Resize controls are hidden while that window owns an open form or while Genie is running. Escape or pointer cancellation rolls back a gesture; pointer release commits it, including release outside the frame. Minimizing or closing an active window activates the next visible app.

Research and behavior rationale: [Dock and application window behavior](docs/DOCK_WINDOW_RESEARCH_REPORT.md).

## Follow-ups

Open the teal calendar-clock dock icon. The window recreates the reference page body with four summary buckets, patient/phone search, a day picker and day navigation, a striped patient table, Call/Un-response/Caught checkboxes, Details, and pagination. It starts with 13 dummy patients and the Missed bucket selected. Create follow-up adds a row to the session; Refresh retains your edits. Dates use Gregorian day/month/year and dummy recalls relative to the session start date. Forms and Details stay inside this app window. All app state survives internal and native minimize/restore and app close/reopen; it ends when Electron OS exits. Run `npm run test:followups` for its behavior checks.

The Follow-ups table panel fills the remaining window height for populated and empty views. Rows retain their natural height; the table viewport scrolls beneath sticky column headings while filters, pagination, and the session footer stay fixed. Short windows use compact summary cards to keep the table usable. Pagination remains four records per page.

The ten dental app icons are original detailed PNG artwork generated with built-in `image_gen`, saved in `src/assets/dock/`. Their objects match their purposes (calendars, patient folder, tooth/progress bars, microscope, calculator, staff badges, and protocol handbook). Prompt set and saved paths: `artifacts/icon-generation.json`. Minimized thumbnails remain actual window captures. The shared dock field fits all icons and previews within the screen, including during magnification; thumbnail destinations are reserved before capture, and thumbnails appear only while apps are minimized. Display changes retain their last real snapshot.

## Finance submodules

Finance stays one dock app and one managed window. Its navigation sits below the title bar and contains Transaction Record, Patient payments, General expenses, Salary payments, Product list, Purchases, Supplier list, and Supplier payments. Selecting a tab shows its section name and Coming soon. Active tabs are highlighted; Left/Right/Home/End support keyboard selection. Navigation wraps inside smaller windows, and short windows omit the decorative image to keep the section text visible. Selection stays in memory across fullscreen, internal/native minimize and restore, and close/reopen. Run `npm run test:finance`.

## Window overview

Press unmodified **`** (Backquote) while Electron OS is focused to toggle an overview of open and minimized internal windows. The key is reserved, including inside text fields; it is not recorded or stored. Escape or the close control exits. Click a preview, or use arrow/Home/End keys and Enter, to select an app. Background windows and the dock are inert and hidden while the overview is active. Visible windows use read-only DOM previews with current form values; minimized windows use their saved captures. App data, forms, normal geometry, and fullscreen presentation stay intact; exiting without selection restores remembered app focus. Windows share a common scale and keep their individual proportions. A balanced arrangement centers rows within the available screen, with shadows separating previews and larger app artwork overlapping each lower edge. Arrow Up/Down selects the nearest window in the adjacent visual row. The arrangement scrolls vertically when a small display cannot fit all previews at a useful size. No host windows or virtual workspaces are included. Run `npm run test:overview`.

## Quiet UI testing

All UI test commands use `tools/run-ui-test.mjs`, which starts a private headless GNOME/Wayland compositor, virtual 1366×768 monitor, temporary settings directories, separate D-Bus session, and isolated app profiles. Screenshots are saved to artifacts; no test window opens on your real desktop. Test processes run at lower CPU priority with software-rendering threads limited to two. GNOME Shell headless support and `dbus-run-session` must be installed; there is no fallback to the host display. Direct execution of test scripts is guarded. Run `npm run test:ui` for the suite or individual `npm run test:followups`, etc. Do not launch ad hoc Electron tests on the live desktop.

## Staff

Staff opens a 1060×650 preferred window with a searchable, type-filtered table: Name, Contact, Join date, Type, Base salary (NPR/month), and Details. Add staff opens an app-scoped form with required name, contact, join date, role, and base salary, plus optional email, address, and notes. Saved staff remain in memory through window close/reopen and minimize/restore; quitting Electron OS ends the session.

Details opens a profile in the same window, with Back to staff and keyboard-accessible Overview, Salary history, Documents, and doctor-only Work done tabs. Five dummy staff cover all four roles. Seed profiles contain sample salary payments and document records; doctors also show sample dental work, dates, patients, cases, treatment charges, and supporting doctors. Documents use explicit dummy previews; no real files or uploads are included. New staff start with empty history and documents. No Finance integration or durable storage is implemented. Run `npm run test:staff` for private-display interaction checks.

## Shared visual clarity

The shell and apps use shared semantic CSS colors for charcoal primary text, readable supporting labels, solid content surfaces, quiet borders, blue focus/selection, and readable status accents. Forms have subtle input edges; tables have gently separated headers and rows; tab selection combines color with a border. Dock captions, inactive titles, overview labels, and private regression fixtures use the same readability direction. Platform system fonts render through the host; Apple fonts are not bundled. This is a macOS-inspired cross-platform appearance, not native AppKit rendering. Increased-contrast preferences strengthen labels and boundaries further.

Run `npm run test:clarity` for sampled computed foreground/background contrast evidence and private screenshots; it is a targeted check, not a complete accessibility audit.

## Lab Tracker and Lab Supplier Record

The Lab Tracker dock app contains two top-level tabs. Tracker uses synthetic patient/case requests, work, tooth scope, shade, supplier snapshots, clinical/reception notes, stage dates, and a local timeline. Eight sample orders demonstrate Awaiting assignment, Sent, Received, Fitted, and Cancelled. Search, status/month filters, and six-row pagination organize the table. Assign lab dispatches a pending request to an active supplier. Receive/Fit dialogs enforce stage-date order; fitted and cancelled records retain terminal histories. Reception notes remain separate from clinical intent. Cancellation records a required reason rather than deleting the order.

New demo request simulates the clinical handoff normally created by Work Entry in dental-saas. This prototype has no connection to that backend. The dummy supplier directory provides active/inactive views, add/edit forms with duplicate-name validation, and work history linked to the same session orders. Deactivated suppliers cannot receive a new assignment, while existing order history and names remain visible. Supplier invoices, statements, and payments remain outside this operational UI.

Reference inspected: `/home/master-x/Desktop/fewa_demo/dental-saas/apps/clinic-web/src/features/labs/`, `ClinicCareWorkspace.tsx`, Worker lab controllers/services/repositories, shared supplier types/repository, and migration `0015_lab_request_reception_handoff.sql`. The original frontend uses authenticated labsApi calls; Worker tenancy/capability checks, idempotency receipts, and expected row versions protect durable writes. The Electron demo only retains local session state; authorization, API calls, and durable finance/data storage are not implemented.

Run `npm run test:labs` for private-display workflow checks. All dialogs belong to the Lab Tracker window; existing fullscreen, resizing, Genie, and close/reopen controls apply. Built updates appear after a full Electron OS exit/relaunch.

## Canonical location and Flutter/Rust reference

Develop and run Electron OS from `/home/master-x/Desktop/fewa_business_os`. The complete previous Flutter/Rust project is preserved under [`refrence/`](refrence/), including its original instructions, documentation, source, platform projects, and local build caches. It is historical reference for proven behavior, not the active build or product contract. The separate pinned motion extracts remain in `references/`.

The repository's existing `.git` stays at the root, retaining previous commits and the untouched index. The relocation is a working-tree change, not a new repository or automatic commit. Old automation/workflows were archived with the Flutter project. `/home/master-x/Desktop/electron-desktop-prototype` compatibility shortcut was removed at the user’s request; use the canonical path for future work. The installed Electron OS launcher points directly here. Relocation verification is recorded in `docs/PROJECT_RELOCATION.json`.

## App Store (session demo)

Open App Store from its blue shopping-bag dock icon. All Apps lists ten dental apps; detail pages include conceptual feature previews, metadata, release notes, and Get/Open/Update states. Protocols and Calendar start uninstalled; the other dental apps stay available. Staff and Lab Tracker start with simulated updates available. Updates Available supports individual updates and a sequential Update all queue. Cancelling leaves the installed version unchanged and allows another attempt. All installation/version state is memory-only and resets at full exit.

Progress simulates download and installation, including a visible 100% completion stage. New installations append after the last installed app in the shared dock layout. A floating artwork copy travels from a visible listing/detail icon into the measured dock slot. The dock is held still and revealed during arrival, and the slot becomes clickable after landing. Hidden/offscreen source artwork, host transitions, overview, and reduced motion use direct completion. Updates preserve the existing icon. No package installation, real network transfer, or update distribution exists. The store preview is illustrative; several listed apps remain Coming soon demos. Run `npm run test:store` for isolated verification.

Installed apps have an Uninstall action on their Store detail page. Confirmation closes their internal window, removes dock/update entries, and changes the action back to Get. Keep app cancels confirmation. Reinstallation remains available; dummy session records are retained rather than erased. An earlier preview ran at 30% speed (2267 ms); the choreographed sequence below supersedes that preview. Store operations are blocked during a flight to avoid overlapping arrivals.

The arrival presentation is now choreographed in `src/storeArrival.ts`: a 2200 ms lift, tilted cubic-path flight, compression/rebound landing, completion shimmer, three translucent echoes, destination glow, ring, and twenty local sparks. It replaces the earlier slow-motion preview. Shared dock layout still reserves the real destination; no independent dock-item motion controllers are introduced. Temporary nodes and animations are disposed on completion or interruption. Reduced motion keeps direct completion.

### Magnetic installation handoff

The current presentation connects the completion state to source separation, shared dock-slot growth, an arc-length-remapped flight with a smooth velocity envelope, and a damped contact response. A 2050 ms timeline controls the lift, short light ribbon, landing well, upward contact sparks, and expanding ring. The source returns to normal after completion or interruption. A short-lived Ready to open card appears near the dock slot; Open from the store can finish the presentation early without delaying launch. Updates use a quiet existing-icon pulse. Viewport changes, overview, host transitions, hidden sources and reduced motion settle safely. No real downloads or installation are implemented.

Deterministic visual QA frames are `artifacts/store-paused-lift.png`, `store-paused-flight.png`, and `store-paused-landing.png`; these pause the animation only in the private test session. Earlier fixed-duration/ghost-thumbnail experiments are superseded by this choreography.

## Windows preview installer

An unsigned x64 preview of the current prototype can be built with `npm run dist:windows`. The installer is written to `release/windows/Dental-OS-Setup-0.1.0-x64.exe`; copy that single file to a Windows device and run it to install **Dental OS Preview** for the current user. It includes the runtime and creates desktop/Start menu shortcuts. No automatic launch, publishing or update feed is configured.

See [Windows preview instructions](tools/desktop-release/WINDOWS_PREVIEW.md) for transfer, installation, verification, rebuilding and limitations. `node tools/desktop-release/verify-windows.mjs` creates the SHA-256 checksum and package inspection evidence. `npm run test:windows-package` launches the bundled ASAR on the private Linux display only. Windows install/runtime acceptance is still pending; this packaging experiment does not complete production M11.
