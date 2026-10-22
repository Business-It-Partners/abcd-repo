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

## M16.4 corrected build and workflow attribution — 2026-10-22

- Initial implementation commit `f66d2c9cc93fb9032c5d50eabb8fda01fb7ee038`: [Actions 39763142196](https://github.com/Business-It-Partners/dental-os/actions/runs/39763142196) passed documentation and **456 unit tests (4 skipped)**, including 8 focused M16.4 picker tests. Build/typecheck failed only because `src/capabilityLabels.ts` lacked the new required `local.files.pick` display label.
- Narrow label fix commit `69dfaa45339de7dc7dc24da937ca2290e978a1b8`: [Actions 39763434071](https://github.com/Business-It-Partners/dental-os/actions/runs/39763434071) passed documentation, **456 unit tests (4 skipped; 28 files)**, TypeScript/build, and first-party package checks. The **full job failed** at existing Windows isolated runtime proof (`tests/runtime-scenario.mjs:51`), where Playwright timed out waiting for the `Motion Studio` dock button. The root cause of this GUI failure has **not** been established and is not claimed unrelated to M16.4. Subsequent graphical/integration stages were skipped.
- No additional CI run was requested. The current branch implementation SHA is `69dfaa45339de7dc7dc24da937ca2290e978a1b8`. A separate evidence-only commit may advance the branch HEAD without runtime-code changes.
- No supported Windows/Linux visual custom/native picker acceptance is established. A signed company application must actually ship the new `local.files.pick` capability under fresh signed policy to use this feature; preexisting releases have no implicit grant. M16.5 drag/drop, file-byte consumption, patient association and Cloudflare upload remain unimplemented.

## M16.3/M16.4 remote graphical proof — quota-bounded diagnostic follow-up (2026-10-22)

Previous M16.4 Windows CI run 39763434071 passed security unit tests/build but failed while waiting for a `Motion Studio` dock launcher before the existing runtime scenario could exercise native windows. The root cause is not yet established; do not call it unrelated to M16.4.

One **focused Windows GUI runner** `.github/workflows/m16-files-ui.yml` will execute for one tagged `[m16-gui]` push. The historical full Windows milestone job is skipped only for this tagged push. It runs only three Files/picker security test files, TypeScript/build, and `tests/m16-files-windows-ci.mjs` on hosted Windows in a clean private profile. Timeout 10 minutes, evidence retention 7 days. No full historical suite or production deployment.

Tests use synthetic X-ray and document filenames only, checking the Files window and user-confirmed custom modal selection/cancel and opaque metadata. The host fixture driver is guarded by `GITHUB_ACTIONS=true`, `RUNNER_OS=Windows`, and both `--files-fixtures` and `--files-picker-verify`. It is unavailable in normal desktops, staging sessions, or dental app JS. **This does not replace a signed company application permission/gesture end-to-end proof.**

The same test captures boot phase and dock identifiers to diagnose the preexisting Motion Studio launcher failure, plus synthetic-only screenshot on failure. Native host dialog usability, Linux headless Wayland GUI testing, signed application picker activation and G16 overall verification remain open unless separately proven.

## Focused Windows GUI run 39766003708 — startup blocker and corrective action (2026-10-22)

At commit `df1c833ec859199dab4dae76201a7b80e4a1434b`, [targeted Windows run 39766003708](https://github.com/Business-It-Partners/dental-os/actions/runs/39766003708) confirmed the full historical workflow was **skipped**, focused Files/picker security tests **passed**, and TypeScript/build **passed**. The graphical scenario failed at startup, before any Files or picker interaction.

Private screenshot and diagnostic log show the Dental OS sign-in screen permanently in `loading` with **`window.desktop` absent**. The Electron main shell loaded the expected `?prototypeFixtures=1&runtimeFixtures=1` query, but no sandboxed shell bridge appeared. Source inspection identified the M16.4-added **runtime relative import of `./host/filePickerContract` from `electron/preload.ts`**. Electron sandboxed preloads cannot load arbitrary local modules through their restricted `require`, preventing the entire shell bridge from initializing. This is a specific M16.4 integration regression; the earlier full-suite Motion Studio launcher failure is consistent with it.

Correction: remove the runtime import, retain only an inline closed-schema defensive prompt validator in the sandboxed shell preload, and add `tests/sandboxedPreload.test.ts` to block future runtime-relative preload imports. The trusted main-process parser remains authoritative. Re-execute one **focused tagged** Windows job only; do not rerun the full regression suite or declare visual acceptance before the GUI test passes. No patient data or staging credentials were accessed.

## M16.3/M16.4 targeted remote graphical proof — successful corrective run (2026-10-22)

- **Root cause established:** shell preload imported `./host/filePickerContract` at runtime while Electron sandbox restricts relative module loads. As a result the private Windows fixture originally showed the sign-in page stuck loading with `window.desktop=false`; no Motion Studio or Files launcher could appear. This was a genuine M16.4 integration regression, not merely a flaky Windows pointer step.
- Fixed in `electron/preload.ts`: inline closed-schema picker prompt validator; runtime imports remain Electron-only. Added `tests/sandboxedPreload.test.ts` (3 assertions) as a regression guard.
- Corrected source `cd66c9e2165de7a4ec1a0dffb33b52e242e87ef8`. [Actions 39766483727](https://github.com/Business-It-Partners/dental-os/actions/runs/39766483727): **success**, 26 focused unit/security tests across 4 test files, TypeScript/build passed, and hosted-Windows Playwright scenario completed **12 checks** without needing a user device.
- Graphical checks cover: desktop bridge startup; correct runtime fixture mode; only synthetic roots; Files window launch; nested directory navigation; back; strictly guarded synthetic test picker; OS-owned custom modal; selecting synthetic X-ray returns metadata-only recipient receipt; modal repeat/cancel; Motion Studio launcher present. Synthetic fixture driver cannot run on actual patient data, user desktops or a normal staging login.
- Exactly two bounded Windows GUI runs were made: first diagnosed the preload regression; second passed. Full historical Windows suite was **skipped** for both via tagged job condition; no more Actions minutes should be used on unchanged tests.
- **Remaining acceptance limits:** real Windows native file picker UI is untested; a signed production/staging dental app declaring `local.files.pick` has not been launched through full user-gesture/session permission; Linux Wayland private-display testing and Files minimize/overview visual privacy remain pending. M16.5 drag-and-drop and patient media upload not started. G16 remains open.


## Signed picker GUI initial attempt — 2026-10-22

Run [39769766129](https://github.com/Business-It-Partners/dental-os/actions/runs/39769766129) at `98d6f9b97304a76b0cb6c7a69929e98a5bda2dec`: both Windows focused unit/build and Linux isolated Weston build passed. Linux graphical test passed synthetic root, folder traversal, and back navigation; Windows graphical test passed the 12 earlier Files/custom-picker checks. Both extended tests then timed out waiting for the newly signed `company.dental.patient-record` dynamic app launcher. Thus signed app UI and native host dialog were **not** exercised, and the workflow is **failed**, not accepted.

Cause identified in source: `runtimeResourceFixtures` was false when only `--files-picker-app-fixtures` was supplied, so shell `App.tsx` rendered static `WINDOW_IDS` rather than `delivery.installedOrder`. The signed package/policy unit test passed, but the test fixture app was invisible to the dock. A narrow guarded `runtimeResourceFixtures` change enables dynamic fixture app discovery only in the private runtime fixture mode. No runtime API, clinic role policy, remote deployment or patient data changed.


## Native/signed SDK verification — correct the test fixture's early connection (2026-10-22)

Focused run [39770204656](https://github.com/Business-It-Partners/dental-os/actions/runs/39770204656) at source `0e84a57c30edbcad6552f992dc0e61a319e155d7`: old full Windows suite skipped; focused Windows unit/security tests and build/typecheck passed, Linux isolated Weston build passed. Windows showed 13 graphical PASS assertions, and Linux showed four. Both platforms **successfully launched the newly installed, company-signed patient-record picker app** after the dynamic-dock switch was corrected.

Both later failed waiting for the synthetic app's `#pick-result` to say `SDK connected`; Windows GUI was cancelled at the 10-minute CI cap and Linux at the 12-minute cap. No real signed app picker request or native Windows dialog completed. Root cause: synthetic app HTML called `window.dentalApp.connect` immediately during inline HTML parsing, before the trusted runtime host registered the WebContentsView as an SDK caller at did-finish-load. This is **fixture setup timing**, distinct from signed app manifest verification.

Corrective fixture now provides a dedicated `Connect SDK` button activated only after the signed app reports runtime `ready`; Windows/Linux tests click it before requesting files. Also add bounded Electron cleanup if a test assertion fails and reduce the targeted Windows/Linux job caps to six/seven minutes. No new production authorization or upload pathway. Preserve both failed attempts and do not declare native or signed-SDK GUI acceptance until focused corrected run passes.
