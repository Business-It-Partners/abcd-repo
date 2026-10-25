# Dental OS — Shell and Desktop

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

The shared window manager owns stable IDs, lifecycle phases, normal bounds, fullscreen presentation, stacking, focus, interaction locks, and overview. Apps own their content, not separate window-management implementations.

For V1, the platform allows at most two managed app windows whose lifecycle phase is not `closed`; minimized and transitioning windows still count. Attempting to open a third keeps it closed and shows a shell-owned blocking dialog listing the open apps and asking the user to close one before retrying. The OS never chooses an app to close automatically. This is a simple open-window cap, not a measured memory budget, and it does not suspend app work or cancel in-flight API requests.

The shared title bar provides Back and Forward controls backed by an ephemeral history stack scoped to each managed window. The shell stores opaque route identifiers and safe navigation guards; page content, route interpretation and session data stay with the app. Verified bundles use the SDK history helper to publish opaque page entries and restore app-owned pages when the user moves through the window history. App Store home/details are shell-owned routes. The current M12.4 integration covers Patient Record and Treatment Protocols; sample apps without page flows leave Back and Forward disabled.

Preserve shared dock-field geometry, snapshot/Genie coordination and fallback, scoped forms/blur, and softer readable styling. Maintain remembered focus, keyboard access, compact-layout usability, and reduced-motion behavior.

Moving/resizing/fullscreen/minimize must coordinate with modals and captures. Display changes must keep controls reachable without corrupting remembered bounds. A modal belongs to one app; it must not create a desktop-wide barrier unnecessarily.

Close/reopen semantics must be explicit: prototype demos retain mounted session state today; production apps cannot depend on a closed renderer remaining alive. Dirty state requires an explicit close choice, and recreating an app may restore presentation state but cannot fabricate persisted drafts.

The shell presents registry truth; animations never establish install success. Overview previews and snapshots can contain patient information: keep them session-scoped, avoid diagnostic capture by default, clear on logout/lock as required, and do not persist them as app cache.

The multi-webContents proof must preserve overlap, z-order, clipping, focus, app-contained dialogs, dock reveal, overview, and motion before renderer integration is accepted.
