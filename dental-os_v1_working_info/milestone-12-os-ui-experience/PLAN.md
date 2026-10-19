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
| **M12.1 — Workspace information architecture** | Map the boot/sign-in-to-workspace, app discovery, app switching, Store/update, lock/account and recovery journeys. Define the shell surfaces and their states before visual implementation. | Reviewed interaction map, surface inventory, state/empty/error designs, and acceptance scenarios. |
| **M12.2 — Desktop navigation and app discovery** | Refine the workspace frame, launcher, dock, overview/task switching and Store entry points as one navigable shell. Preserve shared lifecycle ownership and first-party-only policy. | Private UI coverage for discover/open/switch/return flows; existing dock/overview/Genie regressions pass. |
| **M12.3 — Multiwindow work continuity** | Make focus, stacking, minimize/restore, resize/fullscreen, app-scoped dialogs and return-to-work behavior understandable and consistent. Keep one active clinic session; do not add concurrent user contexts implicitly. | Window lifecycle scenarios preserve intended drafts/session behavior and keep controls reachable. |
| **M12.4 — System and delivery feedback surfaces** | Present sign-in/lock/session state, app install/update progress, update-ready/failed/unavailable states, notifications and recovery guidance clearly. Consume M11/service state; do not duplicate trust, package or update authority in the renderer. | State-driven Store/system UI tests demonstrate each user-visible state without claiming backend success from animation. |
| **M12.5 — Accessibility, fit and integrated usability** | Refine readable hierarchy, keyboard/focus, reduced motion, compact layouts and display scaling; walkthrough the full shell journey with synthetic apps. | Focused Linux private UI, applicable Windows CI, screenshots/interaction evidence, and separate user visual acceptance record. |

Phases are tracked under parent gate G12 in one STATUS.md and one evidence record; they are not additional top-level milestone folders or independent gates. Start one phase at a time and keep all later phases PLANNED until dependencies and acceptance are clear.

## Exit criteria

- [ ] M12.1–M12.5 complete with reviewed flow/state maps and source-bound evidence.
- [ ] A user can orient from startup to the signed-in workspace, discover/open/switch apps, use multiple managed app windows, find Store status and return safely to work.
- [ ] The shell uses the shared `windowManager`/`ManagedWindow` lifecycle, dock field, overview and Genie pipeline; no per-app window manager or renderer-owned privilege is introduced.
- [ ] App install/update UI reflects verified M11 state and never presents animation or stale catalogue data as proof of success.
- [ ] Lock, logout, session changes, dialogs, errors and recovery states keep sensitive content scoped and controls reachable.
- [ ] Keyboard/focus, compact layout, scaling, reduced-motion and required readability checks pass; claims remain limited to tested accessibility scope.
- [ ] Build, units, focused private UI suites and applicable Windows CI pass; user visual acceptance is recorded separately from automated tests.
- [ ] G12 and R01/R04/R05/R11/R12/R15 trace to passing evidence. No patient workflow/backend authority or clinical feature is invented by shell UI work.

## Boundaries and verification

Keep the single active signed-in clinic session and online Dental SaaS authority. No local authoritative business DB, hidden offline write queue, third-party app surface or new backend is introduced. Do not redesign dock/Genie geometry without reading both required engine references and preserving the shared field/fallback. Automated UI tests use the private display runner only; never focus/restart the user's live app.

M11 owns app identity, signing and update decisions; M12 owns their presentation and overall shell navigation. M13 owns installer/host release operations. Physical Windows-device acceptance remains the final G14 gate after M13.
