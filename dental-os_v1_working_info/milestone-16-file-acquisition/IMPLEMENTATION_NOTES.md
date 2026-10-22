# M16 Implementation Notes

**Date:** 2026-10-22. **Disposition:** documentation-only architecture/plan; no runtime change.

M16 was based on the exact M15 branch source at 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d. Source surveyed includes electron/main.ts, electron/runtime/manager.ts, electron/runtime/appPreload.ts, electron/sdk/contracts.ts, electron/sdk/broker.ts and src/windowManager.tsx.

Approved product direction: host-mounted read-only Files core app and OS-owned custom picker, plus parented native fallback; explicit user-initiated Files-to-app transfer with native drag investigated only when verifiable. The trusted host is the only filesystem authority. No app-direct path/Node/IPC privilege, file edit or general cross-app messaging.

The exact local SDK capability, permission encoding, sender gesture attestation, receipt lifecycle and Windows/Linux drag/focus mechanisms need an M16.1 implementation design review. Subsequent code changes and decisions will be recorded here; proposed source paths and plans are not shipped behavior.

## M16.1 completed source review — 2026-10-22

Reviewed actual M15 host code, not merely conceptual documentation:

- `electron/sdk/contracts.ts`: closed SDK 1.4 operation list and 16 KiB validated request envelope; planned new local-only `local.files.pick` and SDK 1.5.
- `electron/runtime/appPreload.ts`: isolated, platform-owned preload and an existing trusted `isTrusted` keyboard observer. Extend with a one-use trusted pointer/keyboard activation ticket, never a caller-supplied flag.
- `electron/runtime/manager.ts`: sandboxed WebContentsView, verified `PackageRegistry` lease, pinned frame/origin and managed lifecycle. Selection must bind this actual recipient and use its existing broker registration.
- `electron/sdk/broker.ts`: local operations currently synchronous. The new picker must be an awaited, abortable trusted coordinator injection within the existing `sdk:request` pipeline, with current session/policy checks both before display and before receipt creation.
- `electron/packages/format.ts`, `electron/distribution/updatePolicy.ts` and `electron/packages/registry.ts`: signed package manifest + signed per-app update-policy capability list + platform appTrust ceiling can authorize a named **local** operation. The format-2 `apiOperations` release grants remain reserved for clinic APIs.
- `electron/identity/session.ts`: the existing broad default operation allow-path is **not sufficient** to grant host filesystem selection; implement explicit local permission + clinic app-family/session rules.
- `electron/main.ts` and `electron/preload.ts`: shell-validated IPC and the real fullscreen parent BrowserWindow; use a parented native open dialog and shell-only folder enumeration.
- `src/ManagedWindow.tsx`, `src/windowManager.tsx`: existing pointer drag and window focus lifecycle are shared shell-owned; Files gestures must coexist without rerouting arbitrary app IPC.

The detailed security and wire decisions are fixed in [M16 architecture §11](ARCHITECTURE.md), and the M16.1 planning checkbox is closed. **No runtime, SDK, filesystem, UI, package or CI source changes were made in this session.** Next implementation session owns **M16.2 trusted read-only filesystem service only**.
