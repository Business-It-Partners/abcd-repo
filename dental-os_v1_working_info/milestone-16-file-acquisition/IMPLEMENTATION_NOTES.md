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

## M16.2 verified host-code checkpoint (2026-10-22)

The Windows canonical-root alias correction was committed at `6bcc5b49d4940fe2f78d7bfe4fc2c3c96b18faaa`. Its [Windows run 39756930135](https://github.com/Business-It-Partners/dental-os/actions/runs/39756930135) passed M16.2 host regression cases, documentation validation, build/typecheck, and first-party package checks. The whole workflow remained **failed** because existing `tests/runtime-ci.mjs` later timed out spawning PowerShell for a synthetic pointer position. No new file-access UI is present, so this runtime-stage failure is not evidence of file-service failure or success. Do not rerun Windows solely to force a green workflow at the cost of remaining quota. Track this existing graphical runner issue separately from the next M16.3 implementation.

## M16.3 — Files core window implementation (2026-10-22)

This session touches only the OS shell window, read-only trusted browsing IPC and its synthetic tests. Source: `src/FilesApp.tsx`, `src/FilesApp.css`, `src/windowGeometry.ts`, `src/useAppWindows.ts`, `src/App.tsx`, `src/ManagedWindow.tsx`, `src/WindowOverview.tsx`, `src/global.d.ts`, `electron/main.ts`, `electron/preload.ts`, `electron/host/filesShell.ts`, `tests/filesShell.test.ts`, `tests/files.mjs`, and `package.json`.

The app is always dock-accessible in normal runtime and reuses the static managed-window controller. The trusted main frame is the only accepted caller for `files:roots` and `files:list`; the contract accepts opaque UUIDs, a single page cursor, page limit <=200 and session generation. Files is read-only; no direct arbitrary paths or bytes travel to React or dental apps. Old M16.2 receipt primitives remain internal and unused by the Files UI.

A privacy review revealed that generic minimized/overview captures could include host filenames. For `files` only, M16.3 provides sanitized icon artwork for Genie minimization and a generic privacy card in overview. Other app snapshot paths are unchanged.

Implementation deliberately avoids any M16.4 picker or M16.5 transfer, and adds a private-display synthetic test root under isolated user-data only when `--files-fixtures` is supplied in a trusted private test environment. Files are never uploaded, persisted in OS state, or logged to diagnostics. Browser UI/file-dialog cross-platform proof remains an explicit M16.3 acceptance limitation until private Linux and Windows UI tests execute.

## M16.3 source-bound Windows CI and handoff (2026-10-22)

Commit fa3fc247a047e0051768a68699bee676a1b7ead6 on codex/milestone-16 passed documentation validation, 448 Windows unit tests (4 skipped), application package checks and build/typecheck in [Actions run 39759665540](https://github.com/Business-It-Partners/dental-os/actions/runs/39759665540). The full workflow **failed** at the pre-existing Windows isolated runtime proof step, with `page.waitForFunction: Timeout 30000ms exceeded`; downstream Windows runtime tests did not run. This is not proof of a Files UI failure or a pass.

The dedicated Files UI scenario `npm run test:files` remains **not executed** because this working environment lacks an isolated GNOME headless compositor. Do not run it on the user's actual desktop or with clinic files. Preserve this limitation when assessing M16.3 verification. The next session may perform private-display acceptance before proceeding to M16.4. No new CI run was requested solely for the graphical timeout.

## M16.4 implementation details — 2026-10-22

Files changed: new `electron/host/filePickerContract.ts`, `electron/host/filePicker.ts`, `src/FilesPickerModal.tsx`, and `tests/filePicker.test.ts`. Adapted existing `electron/host/localFiles.ts` for native-dialog-confirmed individual file selections; adjusted the SDK contracts, broker, signed PackageRegistry local capability guard, runtime preload/manager, Electron main and shell preload, global shell types, shared Files UI, Files CSS and App modal composition.

**Security/authorization sequence:** signed installed company release and active update policy check -> app family/clinic permission -> verified main-frame registration and focus -> one-use trusted user activation recorded by the isolated app preload (750 ms) -> cancellable broker request -> OS-owned custom modal or parented native dialog -> main-process revalidation -> in-memory, destination- and generation-bound receipt. Untrusted app code receives no absolute path or bytes. Existing format-2 API release grants are unchanged. No new unrestricted renderer filesystem IPC exists. Explicit human confirmation is necessary even after the SDK request.

Native fallback may select a file outside the custom browser's configured roots only when the OS-native dialog returns that user-approved file; the parent directory does not automatically become browsable. The coordinator cancels on session reset, app close/crash, signal cancellation and OS shutdown. Native OS dialog cancellation and file access failures do not trigger network writes.

No Files-to-app drag/send or Cloudflare upload is implemented. Native picker, focus, portal, race-free host path handling and signed end-to-end app release require Windows/Linux graphical/device evidence. Newly authored M16.4 tests and static source inspection must not be described as passing CI before an exact-source run.
