# M12 Workspace Flow and Surface Map

This map records the current production shell paths for M12.3–M12.5. It describes the active Electron app, not the archived Flutter project or prototype-only catalog. User flows use synthetic packages and identities in private UI evidence.

## Journey map

| Journey | Entry and surfaces | State owner and expected result | Proof |
| --- | --- | --- | --- |
| Start and sign in | Host startup → `IdentityGate` → signed-in desktop | `IdentityService` owns authentication and session generation. Only a ready session mounts the workspace. Errors stay at the sign-in surface. | `tests/identity.mjs`; `tests/recovery.mjs` |
| Discover a company app | Status-bar **Apps** → company Store → search and release details | Store catalogue, permissions, progress, and install results come from M11's distribution service. The shell displays them; it does not approve packages. | `tests/workspace-flows.mjs`; `tests/distribution.mjs` |
| Open after install | Verified install result → dock arrival/ready notice → **Open** → isolated app window | The ready notice is a polite, temporary status with a direct Open action. `PackageRegistry` and `FixtureRuntime` own package/runtime state. | `tests/workspace-flows.mjs`; `tests/store-arrival-delivery.mjs` |
| Switch and return to work | Dock app icon or status-bar **Windows** → overview → selected window | Shared `windowManager` / `ManagedWindow` own ordering, focus, stacking, minimize and restore. Each runtime retains its own app session; the clinic session stays singular. | `tests/workspace-flows.mjs`; `tests/windows.mjs`; `tests/runtime.mjs`; `tests/overview.mjs` |
| Install or update feedback | Store action → progress → verified ready state → safe activation | M11 owns signature checks, pending versions, health checks, activation, rollback, and recovery facts. The shell announces only service state. Dirty work or an app modal blocks update-now with guidance. | `tests/workspace-flows.mjs`; `tests/updates.mjs` |
| Catalogue/service unavailable | Store **Refresh** → accessible alert → retry | Distribution service reports unavailability. Verified installed apps remain listed/openable; new installs remain disabled until a successful refresh. | `tests/delivery-states.mjs` |
| Lock, account, and recovery | Clinic widget session menu → lock / sign out; Help → support; boot recovery view if local state cannot load safely | Identity changes invalidate the session and clear runtime workspaces. Boot recovery preserves local files and directs the user to support; it does not reset or delete data. | `tests/identity.mjs`; `tests/recovery.mjs` |
| App failure | Failed runtime surface → accessible alert → restart or Store recovery details | Runtime watchdog/package manager reports failure; Store details can explain failed-update rollback. Other app windows and the shell remain available. | `tests/runtime.mjs`; `tests/updates.mjs` |

## Surface ownership

- `src/DesktopChrome.tsx`: Apps, Windows, Help, session identity, and system-reported network/date/time.
- `src/WindowOverview.tsx`, `src/windowManager.tsx`, `src/ManagedWindow.tsx`: shared navigation and managed-window behavior.
- `src/DeliveryStore.tsx`: accessible rendering of catalogue, progress, success, update, and unavailable state from `StoreView`.
- `electron/distribution/`: trusted catalogue, package, update, and recovery authority from M11.
- `src/IdentityGate.tsx` and `electron/identity/`: sign-in/locked/error presentation and session authority.
- `src/RuntimeFixtures.tsx` and `electron/runtime/`: isolated runtime state, failure reporting, and app-owned modal/dirty-work close guards.

The SDK's `notifications.show` response is a scoped receipt for the calling app's own presentation, as specified in `dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md`; it is not an OS notification or a shell privilege. M12's shell feedback here covers Store progress/results, ready-to-open notices, session errors, runtime failures, and recovery guidance.

## Boundaries

The shell does not own clinical UI or patient data. The SaaS remains business authority; there is no local authoritative business database, offline write queue, public extension platform, or third-party app catalog. “Online” reports the host network signal only. Prototype-only local apps are not evidence for the customer Store path.
