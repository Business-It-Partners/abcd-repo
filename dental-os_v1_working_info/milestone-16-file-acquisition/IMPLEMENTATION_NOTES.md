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

## M16.2 — trusted filesystem service implementation (2026-10-22)

**Added** `electron/host/localFiles.ts` (new Node-main-only adapter) and `tests/localFiles.test.ts` (synthetic filesystem security regressions). No Electron renderer or dental app SDK source was modified.

The service exposes trusted-main functions to enumerate known accessible user folders (and native system/home drive roots on Windows), navigate by opaque tokens, list bounded and deterministic metadata-only pages, and maintain temporary per-recipient file selections. It rejects traversal-by-path requests, symlink/junction ancestors when visible to Node filesystem checks, incompatible file types, invalid selection counts, untrusted recipient permissions and stale/replaced receipt identities.

Operational bounds: 32 configured roots, 200 entries per page, 2048 directory entries per scan (larger directory returns RESOURCE_LIMIT), 4096 transient file handles, 128 cursors, 64 selection leases, 10 files per lease, 10-minute maximum receipt lifetime. Underlying file paths and file bytes are retained only where necessary inside trusted process memory; never returned from `roots`, `list`, `select` or `inspect`.

**Intentional separation:** This phase creates a reusable host adapter, not a currently usable Files desktop app or picker. User gesture capture, app-release approval, shell-only IPC, generic removable-volume identification and cross-WebContentsView transfer belong to later slices. The adapter's `FileRecipient.authorized` callback must only be constructed by trusted main using existing package/session/policy binding; passing renderer-created callback or blindly forwarding untrusted IPC values is forbidden.

**Known portability constraint:** Node `lstat`/`realpath` revalidation is meaningful for ordinary link/path replacement, but does **not** prove race-free directory traversal under a concurrently hostile filesystem. Before exposing it to untrusted app file consumption, require a specific Windows/Linux race/handle-security gate and document any host limitations. This milestone does not read file bytes or grant users executable filesystem access.

## M16.2 Windows CI regression / focused fix — 2026-10-22

Initial pushed source `259cd6e393b2e7c3ad6abe56631f0dcc9b790354`: Windows workflow [39756354235](https://github.com/Business-It-Partners/dental-os/actions/runs/39756354235) passed documentation validation and 434 existing tests, but 10 new host tests failed with the same `Missing synthetic root` error. Build was skipped. The likely cause is native Windows canonical path spelling differing from `path.resolve`, not 10 distinct file-permission defects.

The narrow fix retains per-component `lstat` link checks and replaces Windows realpath spelling equality with canonical-root containment; Linux retains the strict original spelling/containment check. The new adapter is still unconnected to renderer/SDK IPC. This fix requires exact-source Windows evidence before claiming M16.2 platform verification. No unrelated tests or business code changed.
