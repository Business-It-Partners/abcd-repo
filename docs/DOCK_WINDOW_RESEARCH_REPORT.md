# Dock and application window behavior

Research date: 13 October 2026. Applies to the separate Electron desktop prototype.

A convincing desktop needs a window manager beneath its dock animation. That manager preserves geometry and content, routes focus and pointer input, resolves modal ownership, and coordinates fullscreen with system chrome. Genie is the visual transition between two states of a window.

This report covers macOS, Windows, and ChromeOS behavior, public implementation examples, and a proposed behavior contract for our hosted Electron environment. **The “black hole zone” means the dock destination where a minimizing window disappears.** Proposed behavior below is design guidance, not an implementation checklist or an expansion of the approved prototype scope.

## Platform behavior

| Topic | Apple macOS | Microsoft Windows | Google ChromeOS |
| --- | --- | --- | --- |
| Launcher surface | Dock | Taskbar | Shelf |
| Minimize | Window leaves the desktop and remains available through the Dock | Window enters minimized state and remains accessible through its taskbar representation | Window can be minimized and accessed through the shelf |
| Large window | Maximize or fill differs from fullscreen | Maximized overlapped window differs from a fullscreen presenter | Maximize differs from fullscreen and from snapped layouts |
| Fullscreen | Fills screen; menu bar and Dock can reveal at their edges | Fullscreen presenter removes frame and title bar and hides taskbar | Fullscreen is a separate window command |
| Layout tools | Edge and corner tiling; Split View | Snap layouts and Snap Assist | Split or partial layouts and paired windows |
| Public internals | AppKit APIs and guidance; Apple's actual Genie implementation is not established by these sources | Win32 and Windows App SDK contracts and app samples | Chromium Ash contains public window animation and resize code |

The table summarizes [Apple fullscreen behavior](https://support.apple.com/en-gb/guide/mac-help/mchl9c21d2be/mac), [Apple Dock behavior](https://support.apple.com/en-gb/guide/mac-help/mchlp1119/mac), [Windows window states](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features), [Windows presenters](https://learn.microsoft.com/en-us/windows/apps/develop/ui/manage-app-windows), and [Chromebook window commands](https://support.google.com/chromebook/answer/177891?hl=en).

### Apple behavior and release history

Apple exposes Dock preferences for position, size, magnification, minimization animation, and automatic hiding. A minimized window can go into its application icon or a separate Dock area. A running-app indicator therefore does not mean the app currently has a visible window. Title-bar double-click behavior is configurable, rather than universally tied to maximize. [Apple Desktop and Dock settings](https://support.apple.com/en-gb/guide/mac-help/mchlp1119/mac)

In fullscreen, the pointer can reveal the menu bar at the top and the Dock at its configured location. Apple also allows the menu bar to stay visible through a preference. Our requested top-corner activation and bottom-center activation are our product's narrower reveal rules. [Apple fullscreen guide](https://support.apple.com/en-gb/guide/mac-help/mchl9c21d2be/mac)

Apple's macOS Sequoia release announcement, dated **16 September 2024**, describes dragging to an edge to preview a tiled position and releasing to commit, including side-by-side and corner arrangements. Tiling belongs in the window-placement system; it is separate from Genie. [Official Sequoia release announcement](https://www.apple.com/newsroom/2024/09/macos-sequoia-is-available-today/)

### Microsoft behavior

Windows distinguishes window state from geometry: a maximized-looking rectangle does not alone establish maximized state. Restoring returns a window to its previous size and position. Win32 also provides minimum and maximum tracking-size constraints. [Win32 window features](https://learn.microsoft.com/en-us/windows/win32/winmsg/window-features)

Windows App SDK represents a top-level native window with an AppWindow. Its overlapped presenter supports conventional window operations; its fullscreen presenter removes the title and border and hides the taskbar. A modal window requires an owner. These are native contracts, not automatic behavior for a React panel inside one Electron window. [Manage app windows](https://learn.microsoft.com/en-us/windows/apps/develop/ui/manage-app-windows)

Windows Snap offers placement through screen-edge dragging and layout controls. This gives the user a preview and a layout choice rather than treating every enlargement as fullscreen. [Microsoft Snap guide](https://support.microsoft.com/en-us/windows/experience/snap-your-windows)

### Google behavior

ChromeOS supports title-bar dragging to a highlighted screen side, then releasing to snap. Its maximize menu offers additional arrangements. Paired windows support divider resizing; floating a window is another distinct mode, with previous geometry available when leaving it. [Chromebook multitasking guide](https://support.google.com/chromebook/answer/177891?hl=en)

The shelf can be pinned, placed at the left, bottom, or right, and automatically hidden. Moving the pointer to the corresponding side reveals it. Pinned identity and currently visible windows are consequently different pieces of state. [Customize the Chromebook shelf](https://support.google.com/chromebook/answer/3113576?hl=en)

## Window anatomy and responsibilities

A window has a title region, controls, a content region, and resize boundaries. Its visible shadow is decoration; it need not be an input boundary. Native Windows hit testing explicitly distinguishes caption, client content, minimize/maximize/close buttons, four edges, and four corners. [WM_NCHITTEST](https://learn.microsoft.com/en-us/windows/win32/inputdev/wm-nchittest)

For our internal windows, use one shared title-strip component. Keep title alignment, control ordering, active/inactive appearance, accessible names, and interaction boundaries consistent across apps. The requested macOS appearance can be adopted without assuming that a fixed strip height or circle diameter is Apple's universal standard.

The shell should own window identity and lifecycle; app content should own its records and forms. The dock should request actions by window identity. The animation engine should receive source and destination geometry and report completion or failure.

```text
Host OS window manager
└── Electron environment window
    └── Internal window manager
        ├── App windows and their owned dialogs
        ├── Focus, geometry, placement and visibility
        ├── Dock and environment status bar
        └── Temporary animation surface
```

This arrangement matches our hosted model. Internal apps do not become independent host windows merely because they look like desktop windows.

Windows DWM illustrates why presentation and logical state can differ: windows draw to offscreen surfaces that are composed for display. This does not imply our WebGL snapshot is DWM or Apple's compositor. [DWM overview](https://learn.microsoft.com/en-us/windows/win32/dwm/dwm-overview)

## Proposed window state model

Keep these dimensions separate:

| Dimension | Example values | Purpose |
| --- | --- | --- |
| Lifecycle | Open, closed | Determines whether the window instance exists |
| Visibility | Visible, minimized | Keeps hidden windows and their content alive |
| Presentation | Normal, maximized, fullscreen, snapped | Determines placement policy |
| Interaction | Idle, moving, resizing | Tracks a pointer gesture |
| Transition | None, minimizing, restoring | Tracks temporary motion and cancellation |
| Focus | Active window plus focused control | Determines keyboard routing and active appearance |

A fullscreen window can be minimized, then restored fullscreen. A normal window can be inactive but visible. These combinations should not be compressed into one boolean.

Store normal bounds before entering a different presentation. Do not overwrite them every animation frame. Store the prior presentation when minimizing. Restore should recover that presentation, geometry, scroll position, form values, and app state.

Closing is a separate action. Define whether closing discards the window instance, preserves app data, or requests confirmation for unsaved changes. Those are product policies; minimizing must not accidentally trigger them.

Electron provides separate native minimize, restore, fullscreen, and normal-bounds APIs. Internal windows need equivalent state in our shell; calling BrowserWindow.minimize would minimize the entire environment. [Electron BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)

## Moving windows

For our renderer windows, begin a move only on the draggable title area. Buttons, fields, links, and menus must retain their own input behavior. Record pointer and window origins at pointer-down, then calculate movement from that fixed start:

```text
newX = initialWindowX + currentPointerX - initialPointerX
newY = initialWindowY + currentPointerY - initialPointerY
```

Use pointer capture and handle pointer-up, pointer-cancel, lost capture, and window deactivation. A gesture must finish even if the pointer leaves its original title strip. Suppress text selection during the gesture. Keep enough of the title region reachable so a misplaced window can be recovered.

Dragging a fullscreen or maximized window needs an explicit policy. A later desktop-like option is to restore normal size while preserving the pointer's proportional horizontal position within the title strip. Otherwise the window jumps away from the cursor. This behavior is a proposed interaction, not a claim that every platform implements identical geometry.

For example, if the pointer starts 70% across the expanded window, position the restored title strip so the pointer remains approximately 70% across it. Clamp only as required by the reachable-screen policy.

Electron's native `app-region: drag` ignores ordinary pointer events in that region, requiring `no-drag` exclusions for controls. **Do not apply it to internal app title strips:** it would drag the environment's native window. Use normal renderer pointer handling there. [Electron custom window interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)

## Resizing edges and corners

Support eight directions: north, south, east, west, and the four diagonal combinations. Show the corresponding resize cursor and prioritize corners over overlapping edge hit regions.

For a proposed rectangle with left L, right R, top T, and bottom B:

| Handle | Geometry change | Fixed boundary |
| --- | --- | --- |
| Right | R follows horizontal pointer delta | L |
| Left | L follows horizontal pointer delta | R |
| Bottom | B follows vertical pointer delta | T |
| Top | T follows vertical pointer delta | B |
| Corner | Apply its horizontal and vertical changes together | Opposite corner |

Clamp size while preserving the fixed boundary. For example, when dragging the left edge inward, `newL = min(candidateL, R - minimumWidth)`. Once minimum width is reached, further inward pointer movement must not slide the whole window.

Chromium's resizer calculates pointer delta from initial bounds, applies size constraints before deriving the final origin, and supports aspect-ratio constraints. Its comments explicitly explain why a constrained left-edge resize must stop moving the origin. [Chromium window_resizer.cc](https://github.com/chromium/chromium/blob/main/ash/wm/window_resizer.cc)

For our design, resize should reflow content rather than stretch a screenshot. Tables may need horizontal scrolling below a reasonable minimum width; forms need internal scrolling when height is constrained. Reserve texture deformation for Genie.

Choose a usable input thickness independently of the painted border. Do not make a one-pixel border the only resize target. Prevent fullscreen windows from exposing resize grips that cannot work. Preserve normal bounds when temporarily disabling resize.

## Maximize fullscreen and snapping

Use distinct names even if the prototype initially exposes only one enlargement action:

| Mode | Proposed bounds | Environment chrome |
| --- | --- | --- |
| Normal | Stored movable and resizable rectangle | Normally visible |
| Maximized | Internal usable area | Normally visible |
| Fullscreen | Entire environment viewport | Hidden until requested reveal |
| Snapped | Chosen tile in internal usable area | Defined by layout policy |

The user's requested expanded mode belongs to the **fullscreen** row: no surrounding desktop gap, hidden dock and environment top bar, with reveal at bottom center and upper corners. The app's own title strip remains part of its window unless a separate requirement changes that.

Revealing chrome should overlay the fullscreen window instead of shrinking its content on every pointer movement. Hide it again after leaving its retention region, but keep it available while keyboard focus, an open menu, or an active dock interaction requires it.

If snapping is introduced later, show a preview while dragging and commit on release. Escape should cancel the preview without corrupting saved normal bounds. Define layout minima before allowing two windows to share a small screen.

## Focus stacking and modal ownership

For our shell, clicking a window should activate it and raise its owned group. After minimizing or closing the active window, choose the next eligible visible window. Hidden windows must not receive keyboard input. Dock activation should open, focus, restore, or offer a window choice according to the target's state.

Avoid treating every child as a globally independent z-index. A dialog should belong to its owner, stay above that owner's content, and move with it. Activating a different app should bring that app's group above the previous owner and its dialog.

Microsoft's WinUI Gallery modal sample explicitly sets a native owner and reactivates the main window when the modal closes. The example demonstrates ownership in an application; it is not Windows compositor source. [WinUI Gallery ModalWindow sample](https://github.com/microsoft/WinUI-Gallery/blob/main/WinUIGallery/SampleSupport/SamplePages/ModalWindow.xaml.cs)

For the requested “items inside the bowl” appearance:

- Keep the parent frame and title strip visually recognizable.
- Dim or gently blur only the owner's content region.
- Keep the form's shadow contained and lighter than the parent window's desktop shadow.
- Center or attach the form within the owner, with safe margins and scrolling if needed.
- Block the owner's background controls while keeping unrelated apps usable.
- Trap keyboard navigation within the dialog while its owner is active; restore appropriate focus when dismissed or reactivated.

A body-level HTML modal can produce the wrong ownership and stacking behavior. An internal dialog should live within the owner group's layout and stacking policy. These are recommendations for our product's visual hierarchy.

## The dock black hole destination

### What the destination represents

The destination is the geometry associated with the minimized window's dock representation. It may be an app icon, a dedicated minimized-window tile, or a fallback at the shelf edge. It is not a separate application state and does not destroy the window.

Chromium's `GetMinimizeAnimationTargetBoundsInScreen` first asks the window's shelf for its icon bounds. For an auto-hidden shelf, it can preserve the item's location while a dimension collapses at the shelf boundary. If there is no visible icon, it falls back toward the launcher location. Its minimize transform is recalculated for restoration because the launcher item may have moved. That path uses scale and translation; it is not Apple's Genie mesh. [Chromium window_animations.cc](https://github.com/chromium/chromium/blob/main/ash/wm/window_animations.cc)

### Proposed target contract for our Genie

Resolve a destination by stable window or app identity. Obtain its rectangle in the same coordinate system as the source. Freeze that rectangle for the duration of one transition, including the dock magnification layout. On a later restore, measure again; the dock or screen may have changed.

The target has width and height even if the final visual collapses to a line or point. A rectangle gives the animation a predictable alignment and scale. Do not choose a hardcoded bottom-center coordinate when the correct tile is elsewhere.

For our current bottom dock, place the disappearance boundary consistently relative to the target tile. A proposed clip or mask should make the final mesh disappear at that boundary. It should not vanish abruptly above the icon or leak below the desktop. The exact boundary and masking arrangement require visual tuning; these sources do not establish Apple's private clipping method.

If the dock is hidden during fullscreen, choose one policy and keep it consistent: temporarily reveal and stabilize the target for the transition, or animate toward a defined hidden-dock edge target. The current prototype reveals the dock during motion, so stabilizing that visible target is the simpler continuation.

### Proposed minimize sequence

1. Validate that the window is visible and another conflicting transition is not running.
2. Remember its presentation, geometry, content, and focus context.
3. Stabilize dock layout and measure source and destination.
4. Capture while the real source is still rendered.
5. Prepare the animation surface and its first frame before hiding the live source.
6. Disable interaction with the departing window and transfer active focus appropriately.
7. Deform and draw the snapshot toward the destination.
8. Commit minimized state, release animation resources, and resume dock motion.

Restoration reverses the visual path toward the preserved window presentation. Keep the live window noninteractive until it can replace the final animation frame cleanly. Then activate it and restore meaningful control focus.

No frame should show both a complete live window and its complete animated duplicate. No failure should leave neither visible after a restore request. Use a stable direct transition when capture, decoding, or WebGL fails.

### How a Genie recreation can work

A recreation can map a window image onto a subdivided mesh, progressively narrow the near edge toward the dock, curve the side boundaries, and draw the trailing part through the destination. The geometry and easing determine whether it resembles a funnel or a plain shrinking rectangle.

The `genie-web` project demonstrates WebGL mesh deformation with an origin element or rectangle, snapshots, and explicit show/hide lifecycle. Its documentation describes capture failures and stacking-context problems. It is a third-party recreation, not proof of Apple's implementation. [genie-web repository](https://github.com/fenxer/genie-web)

`GenieWarpMesh` is another recreation. It warps NSWindow through the private `CGSSetWindowWarp` API, hides rather than closes the window, and leaves minimized-state tracking to the caller. Its author warns that the private API may prevent Mac App Store acceptance. It is useful as a conceptual example, not a portable Electron dependency. [GenieWarpMesh repository](https://github.com/usagimaru/GenieWarpMesh)

Apple's exact Genie mesh, easing, and timings cannot be inferred from these recreations. Our FEWA-derived parameters remain a project reference, not an authenticated specification of Apple's animation.

## Dock interaction and automatic hiding

For our product, keep launcher identity, running indicator, minimized tile, icon geometry, and animation target separate. A launcher can be pinned with no open window. A running app can have a minimized window. With multiple windows later, one app icon needs an unambiguous way to select which window to restore.

Continue using one shared magnification field. Separate the visual icon from a stable interaction region so pointer movement between icons does not repeatedly hide the dock. Freeze the relevant layout during Genie; resume smoothly afterward.

Automatic hiding needs a small activation region and a larger retention region. Otherwise the pointer crosses the activation line, the dock rises, and immediately hides before the user reaches it. Retain visibility for dock menus and keyboard navigation as well as hover. Avoid an invisible overlay that intercepts the whole lower half of an app.

The reveal region, icon hit region, and Genie destination are three different rectangles. Giving them the same size is likely to produce either a difficult reveal gesture or unintended blocked clicks.

## Display coordinates and animation reliability

Use one logical coordinate space for internal window and dock rectangles. Convert only at the capture/render boundary, where texture pixel dimensions may differ because of display scaling. Account for rounding and avoid mixing host screen coordinates with renderer-local coordinates.

Electron documents restrictions on native position, resize, focus, and related operations under Wayland. A successful Linux run therefore does not guarantee identical host-window control on every compositor, nor Windows or macOS validation. Internal renderer movement remains a separate mechanism. [BrowserWindow platform limitations](https://www.electronjs.org/docs/latest/api/browser-window)

For our implementation, cancel or retarget predictably when viewport size or scale changes mid-transition. Release WebGL resources, unlock dock motion, and settle in a valid state. Invalidate stale snapshots rather than stretching an old capture over a new window layout.

At 60 Hz, a frame has about 16.7 ms; at 120 Hz, about 8.3 ms. These are refresh budgets, not guaranteed performance. Measure capture and preparation separately from animation frame intervals. Avoid layout reads and texture uploads on every frame. Provide reduced-motion behavior and recover from a lost graphics context.

Raymond Chen's technical blog explains how Windows' logical window rectangle can differ from what DWM displays, including historical maximized borders. The 2012 article is architectural context, not a current universal pixel measurement. It supports an important design lesson: explicit state and painted geometry should not be confused. [The Old New Thing on maximized rectangles](https://devblogs.microsoft.com/oldnewthing/20120326-00/?p=8003)

## Current prototype assessment

This assessment records the research baseline before the shared window manager and resizing stage. Current implementation status and verification live in [WORK_CHECKLIST.md](../WORK_CHECKLIST.md).

| Area | Current source behavior | Further work to consider |
| --- | --- | --- |
| Environment | One native fullscreen Electron window; outer minus minimizes it | Validate coverage and restore on each target platform |
| Internal title strip | Shared macOS-style traffic lights and title | Keep future app windows on the same component |
| Movement | Title-strip pointer dragging and position constraints | Gesture cancellation, recovery, and expanded-window drag policy |
| Resizing | No eight-edge/corner resize mechanism | Implement common resize constraints and responsive content |
| Expanded mode | Entire viewport; dock and environment bar hide | Call it fullscreen in the shared state model |
| Chrome reveal | Bottom center and top corners, with wider retention regions | Verify menus, keyboard use, and competing pointer operations |
| Genie | Native capture, WebGL deformation, frozen dock geometry, fallback | Validate target masking, repeated interruptions, and visual continuity |
| Modal | Records form owned by its internal window, background inertness | Audit inactive-owner focus and small-window overflow |
| Window model | Lifecycle and motion logic distributed across Studio and Records | Consolidate into a shared manager before adding many apps |
| Data | Records are held in session memory | Persistence remains a separate product decision |
| Placement | Normal and expanded modes | Snapping and independent resize are future features |

Relevant files: [App.tsx](../src/App.tsx), [RecordsApp.tsx](../src/RecordsApp.tsx), [WindowTitleBar.tsx](../src/WindowTitleBar.tsx), [genie.ts](../src/genie.ts), [motion.ts](../src/motion.ts), and [electron/main.ts](../electron/main.ts).

## Proposed order of future work

First consolidate window identity, bounds, presentation, focus, and lifecycle into one manager. Then add eight-direction resizing and robust gesture cancellation. Next formalize fullscreen reveal and modal ownership. Finally refine Genie disappearance and restoration against the stable geometry contract. Snap layouts and multiple windows per app can follow if requested.

This keeps our dock experiment focused while giving it a sound foundation. A full business SDK or mini-program system is not necessary to validate these window behaviors.

## Acceptance scenarios for future implementation

| Scenario | Expected result |
| --- | --- |
| Drag each title strip | Smooth motion; buttons and inputs never initiate a drag |
| Release outside title strip | Gesture ends without a stuck moving state |
| Cancel or lose pointer capture | Valid bounds and no abandoned listeners |
| Resize each of eight directions | Correct cursor, fixed opposite boundary, responsive content |
| Drag beyond minimum size | Size stops; window does not slide unexpectedly |
| Enter and leave fullscreen | Full viewport coverage; original normal bounds restored |
| Reveal dock and top bar | Required activation regions work; content does not jump |
| Keep dock menu or keyboard focus | Dock remains available until interaction finishes |
| Minimize normal and fullscreen windows | Internal content survives; environment remains present |
| Restore after dock layout changes | Uses the current target and preserved presentation |
| Minimize with a form open | Owned form state remains attached to its app |
| Switch apps while a form is open | Other app remains usable; stacking and focus follow ownership |
| Save, cancel, or Escape from form | Correct data result and meaningful focus restoration |
| Capture or graphics failure | Direct transition; no invisible stuck window |
| Viewport changes during Genie | Animation settles safely; dock unlocks; stale capture discarded |
| Repeated minimize/restore requests | No duplicate transitions or detached snapshots |
| Reduced motion | Same lifecycle without unnecessary deformation |
| Outer environment minus | Host desktop appears; restoring returns the environment fullscreen |
| Different scaling and screen sizes | Source/target alignment and reachable controls remain correct |
| Low frame rate or high refresh display | Time-based motion completes consistently; performance measured separately |

## Source interpretation

Apple and Google support pages describe user-facing behavior. Microsoft and Electron API documents define developer contracts. Chromium files expose actual Ash implementation paths; GitHub `main` links can change over time. WinUI Gallery exposes an application sample. Genie repositories expose independent recreations. The Microsoft blog supplies historical architectural explanation.

These sources establish behavior and usable engineering patterns. They do not establish exact proprietary Apple or Windows animation algorithms, universal timing constants, or verified performance of our prototype across platforms.
