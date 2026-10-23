# M12 Plan — Dental OS workspace and shell experience

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** M11 app onboarding/update behavior; preserve the verified shared-shell contracts from M03 and M10.
**Requirements:** R01, R04, R05, R11, R12, R15.
**Exit gate:** G12.
**Architecture:** [boot/workspace lifecycle](../../dental-os_v1-documentation/05_V1_BOOT_AND_WORKSPACE_LIFECYCLE.md), [shell/desktop contract](../../dental-os_v1-documentation/06_V1_SHELL_AND_DESKTOP.md), [runtime contract](../../dental-os_v1-documentation/07_V1_APP_RUNTIME_AND_ISOLATION.md).

## Outcome

Make Dental OS feel like one coherent dental-work environment: users can orient themselves, find and open company apps, work across managed windows, understand system/app status and recover from visible errors. The shell owns navigation and windows; each app owns its clinical UI and session data. This milestone does not deliver the dental modules themselves.

## Submilestones / work phases

| Phase | Scope | Completion evidence |
| --- | --- | --- |
| **M12.1 — Desktop status bar** | Add a compact, translucent macOS-style menu bar. Show **Sajilo Dental** when no app is active; otherwise show the active app from shared window-manager focus. Place working Apps, Windows and Help actions beside the app name. Show browser-reported network state and local date/time at the right. Keep account actions out of the status-bar strip. Use the user's requested dark blue-gray frosted-glass material and light readable lettering. | Private UI checks for the no-active-app brand, active-app changes, Apps/Windows actions, clock/date rendering and online/offline state. Network copy must not imply Dental SaaS reachability. |
| **M12.2 — Desktop widgets and dock presentation** | Keep clinic identity and signed-in user/role at upper left. At upper right, use the supplied three-card pattern: a larger Nepali Bikram Sambat calendar, a time card, and a separate Gregorian calendar. Highlight today in the Nepali month grid without a duplicate standalone date row. Do not add weather or fabricated events. Apply the supplied macOS-style frosted-glass treatment to the widgets and dock. Make dock height, spacing, thumbnails and icons respond to display width. Reduce the dock hover magnification bell amplitude by 20%, preserving its shared field, layout and fallback. Put support/account actions in the clinic widget menu. | Private UI checks for identity/session changes; accurate Nepali and Gregorian month/day grids and navigation; in-grid today highlight with no duplicate date row; clock; responsive dock geometry at laptop/monitor widths; glass styling and readable contrast; 20% hover magnification reduction; session actions and shared dock/window/Genie regressions. No patient or appointment data is introduced. |
| **M12.3 — Workspace information architecture and app discovery** | Map boot/sign-in-to-workspace, app discovery/switching, Store/update, lock/account and recovery journeys. Refine launcher, dock, overview/task switching and Store entry points as one navigable shell. For installed multi-module packages, the OS reads verified metadata at launch, opens its shared explorer before the app window, and hands the chosen module to the app. The current reviewed journey and ownership map is [WORKSPACE_FLOW_MAP.md](WORKSPACE_FLOW_MAP.md). | Reviewed flow/surface/state map; private discover/open/switch/return coverage; installed-package dock discovery shows the explorer before a multi-module app opens; selected first screen is applied before its managed surface is shown; single-module apps open directly; existing dock/overview/Genie regressions pass. |
| **M12.4 — Multiwindow work continuity** | Make focus, stacking, minimize/restore, resize/fullscreen, app-scoped dialogs and return-to-work behavior understandable and consistent. Open normal app windows at the full usable desktop height, flush below the responsive status bar and leaving a small 12px gap above the dock. While dragging, clamp the top below the status bar; allow the bottom, left or right edge to hide up to 70% of the window, leaving a 30% visible grab area. Put always-visible icon-only maximize, minimize and close controls on the title bar's right in green/yellow/red order; use 16.6725px circles (10% below the previous 18.525px size) and centered 8.748px maximize/restore and 10.206px minimize/close symbols. Add common Back/Forward title-bar controls, ephemeral per-window history, and SDK support for app bundles to publish opaque page entries and restore app-owned pages. Keep one active clinic session; do not add concurrent user contexts implicitly. | Window lifecycle scenarios preserve intended drafts/session behavior and keep controls reachable; initial/max-height frames meet the status bar and preserve the 12px dock gap; edge hiding stays bounded and recoverable; title-bar controls work by pointer and keyboard; per-window and app-bundle Back/Forward preserves, restores and branches history correctly, while dirty forms, open dialogs and unresolved writes block unsafe transitions. |
| **M12.5 — System and delivery feedback surfaces** | Present sign-in/lock/session state, app install/update progress, update-ready/failed/unavailable states, notifications and recovery guidance clearly. Consume M11/service state; do not duplicate trust, package or update authority in the renderer. | State-driven Store/system UI tests demonstrate each user-visible state without claiming backend success from animation. |
| **M12.6 — Accessibility, fit and integrated usability** | Refine readable hierarchy, keyboard/focus, reduced motion, compact layouts and display scaling; walkthrough the full shell journey with synthetic apps. | Focused Linux private UI, applicable Windows CI, screenshots/interaction evidence, and separate user visual acceptance record. |

Phases are tracked under parent gate G12 in one STATUS.md and one evidence record; they are not additional top-level milestone folders or independent gates. M12.1 and M12.2 reflect the user's 2026-10-20 direction. Complete them in order and keep later phases PLANNED until dependencies and acceptance are clear.

## Exit criteria

- [ ] M12.1–M12.6 complete with reviewed flow/state maps and source-bound evidence.
- [ ] A user can orient from startup to the signed-in workspace, discover/open/switch apps, use multiple managed app windows, find Store status and return safely to work.
- [ ] The shell uses the shared `windowManager`/`ManagedWindow` lifecycle, dock field, overview and Genie pipeline; no per-app window manager or renderer-owned privilege is introduced.
- [ ] App install/update UI reflects verified M11 state and never presents animation or stale catalogue data as proof of success.
- [ ] Lock, logout, session changes, dialogs, errors and recovery states keep sensitive content scoped and controls reachable.
- [ ] Keyboard/focus, compact layout, scaling, reduced-motion and required readability checks pass; claims remain limited to tested accessibility scope.
- [ ] Build, units, focused private UI suites and applicable Windows CI pass; user visual acceptance is recorded separately from automated tests.
- [ ] G12 and R01/R04/R05/R11/R12/R15 trace to passing evidence. No patient workflow/backend authority or clinical feature is invented by shell UI work.

## Boundaries and verification

Keep the single active signed-in clinic session and online Dental SaaS authority. No local authoritative business DB, hidden offline write queue, third-party app surface or new backend is introduced. Do not redesign dock/Genie geometry without reading both required engine references and preserving the shared field/fallback. Automated UI tests use the private display runner only; never focus/restart the user's live app.

M11 owns generic app identity, signing and update decisions; M12 owns their presentation and overall shell navigation. M13 releases minimal app shells; M14 owns functional app workflows; M20 owns installer/host release operations. Physical Windows-device acceptance remains final gate G21 after M20.

## M15 coordination amendment — 2026-10-21

The user adopted [M15 Platform Closeout and Integration](../milestone-15-platform-closeout-and-integration/PLAN.md) during P03. The [central checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) tracks remaining platform work; this amendment changes coordination/dependencies, not historical evidence or acceptance.
Remaining requirements under this milestone's original gate stay open until their evidence is complete; M15.4 coordinates their closeout. Previously implemented/verified scope is reused. M15 planning does not declare those residuals accepted.
