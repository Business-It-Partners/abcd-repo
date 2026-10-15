# Dental OS — Shell and Desktop

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

The shared window manager owns stable IDs, lifecycle phases, normal bounds, fullscreen presentation, stacking, focus, interaction locks, and overview. Apps own their content, not separate window-management implementations.

Preserve shared dock-field geometry, snapshot/Genie coordination and fallback, scoped forms/blur, and softer readable styling. Maintain remembered focus, keyboard access, compact-layout usability, and reduced-motion behavior.

Moving/resizing/fullscreen/minimize must coordinate with modals and captures. Display changes must keep controls reachable without corrupting remembered bounds. A modal belongs to one app; it must not create a desktop-wide barrier unnecessarily.

Close/reopen semantics must be explicit: prototype demos retain mounted session state today; production apps cannot depend on a closed renderer remaining alive. Dirty state requires an explicit close choice, and recreating an app may restore presentation state but cannot fabricate persisted drafts.

The shell presents registry truth; animations never establish install success. Overview previews and snapshots can contain patient information: keep them session-scoped, avoid diagnostic capture by default, clear on logout/lock as required, and do not persist them as app cache.

The multi-webContents proof must preserve overlap, z-order, clipping, focus, app-contained dialogs, dock reveal, overview, and motion before renderer integration is accepted.
