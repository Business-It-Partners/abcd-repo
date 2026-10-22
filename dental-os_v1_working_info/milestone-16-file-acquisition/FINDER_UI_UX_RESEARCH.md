# macOS Finder UI/UX research for Dental OS

**Research date:** 2026-10-22
**Scope:** research and design recommendations only. This document does not change implementation, M16 acceptance, security policy, or any other milestone record.

## Executive summary

Finder works because it combines clear location navigation with a flexible file area. The steady frame is a left sidebar, a compact toolbar, and a main content pane. It offers icon, list, column, and gallery views, sorting, search, previews, and location shortcuts.

The user narrowed the Dental OS adaptation to the Files window's actual job: help a clinic user find a local picture or document and select it for a first-party Dental OS app. The approved visual direction is a **read-only, image-first grid** with folder icons for folders, file-type icons for documents and other files, and small thumbnails only for supported picture files. Keep an optional detail-list view, familiar location navigation, and the existing authorized picker/explicit **Send** action. Do not add Finder's broader file-management, search, tagging, column/gallery previews, or business workflows as part of this UI update.

## Current macOS and visual reference

Apple released macOS 27 Golden Gate on September 14, 2026. Apple describes the current design as a refined Liquid Glass system with greater readability and consistency; its current user guide exposes the Finder patterns summarized below. [Apple release announcement](https://www.apple.com/newsroom/2026/09/major-updates-for-apples-software-platforms-are-now-available/) · [macOS 27 page](https://www.apple.com/os/macos/)

### Official Finder screenshot

The image is from Apple's current Finder user-guide page. It shows the sidebar and file area in one window. The companion guide page also shows the toolbar view controls and the preview pane.

![Finder window showing the locations-and-tags sidebar beside the file area](https://ipcdn-web.apple.com/assets/v2/web/9e454282-30ff-4c0e-a8ef-3aaf3e06113c)

[Open the screenshot's Apple Support page](https://support.apple.com/en-gb/guide/mac-help/mchle9f0a1b2/27/mac/27) · [See Apple's Finder view and preview examples](https://support.apple.com/en-nz/guide/mac-help/mchldaafb302/mac)

## What Finder's interface is doing

| Area | Finder pattern | Why it helps |
| --- | --- | --- |
| Sidebar | Shortcuts grouped into named sections such as Favorites, Locations, and Tags. Selecting a shortcut changes the current location. People can customize the shortcuts. | Gives a stable map of common places without turning the sidebar into a deep folder tree. |
| Toolbar | Back/forward navigation, current context, view controls, organization/actions, and search. Less common commands can live in a menu or the app menu bar. | Keeps navigation and frequent actions near the content they affect. Apple advises grouping related controls and avoiding an overcrowded toolbar. |
| Main pane | The current folder or search results. Its presentation can change without changing the underlying location. | The user can choose a visual scan, a compact inventory, a hierarchy, or a preview-focused view. |
| Preview/details | A selected item can be inspected without opening its owning application. | Reduces unnecessary open/close cycles and makes selection more confident. |
| Path/status | Optional path and status bars show where the user is and basic folder/disk counts. | Adds orientation and useful context without occupying the main toolbar. |

Apple's guide says the sidebar provides quick access to frequently used places; its guide describes the four views and how sorting, grouping, tags, Smart Folders, and a preview pane work. [Finder overview and views](https://support.apple.com/en-gb/guide/mac-help/mchle9f0a1b2/27/mac/27) · [Folder views and preview pane](https://support.apple.com/en-nz/guide/mac-help/mchldaafb302/mac) · [Path and status bars](https://support.apple.com/en-gb/guide/mac-help/mchlp1774/27/mac/27)

### The four views

| View | What Finder shows | Good use | Dental OS fit |
| --- | --- | --- | --- |
| Icon | Items laid out in a grid with adjustable icon size and spacing. | Visual collections such as photos or app bundles. | Default. Use ordinary folder/type icons; show a small thumbnail only for supported picture files under the reviewed M16 bounds. |
| List | Compact rows with sortable columns such as name, kind, size, and modified date. Columns can be shown/hidden and resized. | Scanning, comparing, and selecting specific files. | Optional detail view for exact names and metadata. |
| Column | Folder levels displayed side by side; selecting an item reveals its next level and an item preview/details column. | Following nested folder paths while retaining hierarchy context. | Strong secondary view for drilling through nested directories. |
| Gallery | A large selected-item preview with a strip of nearby items. | Visually reviewing a group of media. | Defer until a bounded and privacy-reviewed preview pipeline exists. A metadata-only selected-item panel is safer initially. |

Apple documents the behavior and keyboard switching for these views in its [Finder guide](https://support.apple.com/en-nz/guide/mac-help/mchldaafb302/mac) and [Finder keyboard shortcuts](https://support.apple.com/en-by/102650).

## Typography and sizing

- **Typeface:** Apple's system interface face is SF Pro, part of the San Francisco family. Apple describes it as a neutral, flexible system font with multiple weights and optical sizing. [Apple Fonts](https://developer.apple.com/fonts/)
- **Documented size baseline:** Apple's HIG recommends **13 pt default and 10 pt minimum** for macOS custom text styles. This is a platform-wide design baseline, not a measurement of every Finder label. Finder itself lets users change text size for supported views, and macOS provides a system accessibility size control. [Apple HIG accessibility guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility) · [Finder text/icon size settings](https://support.apple.com/en-ie/guide/mac-help/mchld786f2cd/mac)
- **Dental OS translation:** Do not copy Apple's font file into a Windows/Linux Electron build. Apple's font license restricts SF font use to mockups for Apple operating systems. Use the host system UI font stack (for example, CSS `system-ui`) so Dental OS remains native-feeling on Windows and Linux. [Apple Fonts and license](https://developer.apple.com/fonts/)
- **Prototype scale to evaluate:** Treat **16–17 CSS px** as the starting main file-row/sidebar label size, **14–15 CSS px** for supporting metadata, and **20–22 CSS px** for a page or location title. These are Dental OS starting recommendations, not Finder measurements. Native points and CSS pixels are different units; measure the result at the app's real display scale and preserve a user-accessible larger-text path.
- Avoid thin text weights for filenames, states, and metadata. Keep filenames and status labels readable at laptop viewing distance; permit truncation with a way to inspect the full name.

Finder's own settings reinforce a useful principle: let people change text/icon size and view density rather than locking every folder to one density. [Apple Finder size controls](https://support.apple.com/en-ie/guide/mac-help/mchld786f2cd/mac)

## Theme, color, and materials

macOS 27 continues Apple's Liquid Glass visual language, with Apple describing a refined treatment tuned for readability. Apple's HIG makes a key distinction: Liquid Glass belongs mainly to navigation and controls; the content layer should use standard materials so the content remains the visual focus. The regular glass treatment is the safer translucent option for text-heavy sidebars and popovers; clear glass is for visually rich media backgrounds. [Apple macOS 27](https://www.apple.com/os/macos/) · [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)

For Dental OS, the transferable ideas are:

- Use a **softly separated navigation surface** for the sidebar and toolbar, with quiet borders and an opaque, calm work area for filenames and file metadata.
- Let the workspace content provide visual focus. Keep blur/translucency subtle and retain a high-legibility fallback when transparency is reduced or contrast is increased.
- Use one restrained accent for selection, focus, and the primary action. Let warning, error, and success colors keep distinct meanings; do not make every control colorful.
- Keep selected rows clearly highlighted across their width. Use a visible keyboard focus treatment in addition to selection. Apple recommends platform-consistent full-row selection and focus cues for lists. [Apple focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- Avoid reproducing Liquid Glass as decoration across file rows/cards. Apple recommends using the material sparingly and not in the content layer. [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials)

This matches Dental OS's existing product direction to keep the visual language soft, clear, and readable. The M12 shell plan already establishes a blue-gray frosted treatment for shell surfaces; this research supports keeping that treatment restrained and preserving a solid, readable content surface.

## Interaction details worth borrowing

1. **Location first:** Keep back, forward, and parent-folder navigation easy to find; keep the current location visible. Finder's path bar can expose parent folders without making the main pane a permanent tree.
2. **Views are modes of the same content:** Let users switch views without losing the current folder or selection where practical. Finder maps Command-1 through Command-4 to its views; Dental OS should use familiar platform-appropriate shortcuts and expose them in menus/tooltips. [Finder shortcuts](https://support.apple.com/en-by/102650)
3. **Search is context-aware:** Keep search available in the toolbar and make its scope visible (current folder versus broader search). Show useful filters/results without making users manually traverse every folder. Apple's newer Finder docs also connect tags to sidebar navigation and Spotlight. [Finder organization and tags](https://support.apple.com/en-gb/guide/mac-help/mchle9f0a1b2/27/mac/27)
4. **Preview without launch:** Spacebar Quick Look is a strong desktop convention. In Dental OS Files, use it only for content that passes a separate privacy and resource review; initially show safe metadata such as name, type, size, and modified time. [Apple Spotlight/Quick Look](https://support.apple.com/guide/mac-help/find-what-you-need-with-spotlight-mchlp1008/27/mac/27)
5. **Selection and commands stay distinct:** Selecting a row should not trigger an operation. Put actions in a small toolbar/context menu and make their scope explicit. Use keyboard navigation, clear selected/focused states, and Escape/Cancel behavior.
6. **Density adapts:** Allow columns to resize and optional details to be shown/hidden. Collapse secondary toolbar commands into overflow as the window narrows rather than letting controls collide. [Apple toolbar guidance](https://developer.apple.com/design/human-interface-guidelines/toolbars) · [Apple lists and tables guidance](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)

## Recommended Dental OS Files design direction

1. **Window frame:** Keep the familiar left location sidebar, compact navigation toolbar, and main content pane within the shared Dental OS window and lifecycle.
2. **Main content:** Default to a clear grid. Show a folder icon for folders, a standard type icon for PDFs and other non-picture files, and a thumbnail only for supported picture files. The optional list view is for closer name/date/size scanning.
3. **Selection:** A single click selects. A double-click opens a folder; it does not open a file preview. The only app handoff is the already authorized custom/native picker or explicit Send to an eligible app.
4. **Safety and privacy:** Keep dot-prefixed entries out of the everyday listing. Thumbnails stay transient in the trusted shell and out of app APIs, receipts, logs, overview and minimized snapshots. Follow the bounds in the [M16 architecture](ARCHITECTURE.md).
5. **Accessibility and density:** Keep readable system fonts, quiet borders, visible keyboard focus and screen-reader names for controls. Adapt the grid to available width while keeping filenames and the primary navigation/actions legible.

### M16 safety boundary

Finder is a broad-purpose file manager; Dental OS Files is a narrowly authorized, read-only local acquisition surface. M16's architecture remains authoritative: no rename/delete/move/execute controls, unrestricted path entry, raw path/bytes sent to an app, or hidden upload/patient-save state. The recipient remains verified by the trusted host. The explicit Send flow stays available. Native cross-view drag was reviewed and deferred in the current runtime, so this visual research does not propose bypassing that decision. These restrictions are part of the Dental OS design contract, not gaps in the Finder comparison. See [M16 architecture](ARCHITECTURE.md) and [M16 device acceptance handoff](DEVICE_ACCEPTANCE_HANDOFF.md).

## Sources

All sources below are Apple primary sources and were reviewed on 2026-10-22.

- [macOS 27 Golden Gate](https://www.apple.com/os/macos/) and [Apple's September 2026 release announcement](https://www.apple.com/newsroom/2026/09/major-updates-for-apples-software-platforms-are-now-available/)
- [Finder overview, sidebar, views, organization, tags, and Smart Folders](https://support.apple.com/en-gb/guide/mac-help/mchle9f0a1b2/27/mac/27)
- [Finder folder views, preview, sorting, and per-folder options](https://support.apple.com/en-nz/guide/mac-help/mchldaafb302/mac)
- [Finder text and icon sizing](https://support.apple.com/en-ie/guide/mac-help/mchld786f2cd/mac)
- [Finder shortcuts](https://support.apple.com/en-by/102650)
- [Finder path/status bars and item information](https://support.apple.com/en-gb/guide/mac-help/mchlp1774/27/mac/27)
- [SF Pro and Apple font licensing](https://developer.apple.com/fonts/)
- [Apple HIG accessibility and text-size guidance](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple HIG sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Apple HIG toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)
- [Apple HIG lists and tables](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)
- [Apple HIG focus and selection](https://developer.apple.com/design/human-interface-guidelines/focus-and-selection/)
- [Apple HIG colors](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple HIG materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Apple HIG split views](https://developer.apple.com/design/human-interface-guidelines/split-views)
- [Apple Spotlight and Quick Look](https://support.apple.com/guide/mac-help/find-what-you-need-with-spotlight-mchlp1008/27/mac/27)
