# M16 Implementation Notes

**Date:** 2026-10-22. **Disposition:** M16.1 design, M16.2–M16.6 hosted engineering, and the post-closeout Files UI/Image Viewer follow-ups are implemented. Native drag is formally deferred in the current runtime; physical-device/G16 acceptance remains open.

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

## M16.4 remaining verification — focused corrective work (2026-10-22)

- Prior exact branch source `b552f18aff3b07b6076b251ef5ce74c68bb40464` had one bounded Windows GUI job failure and a Linux GUI job cancelled at teardown ([Actions 39772133780](https://github.com/Business-It-Partners/dental-os/actions/runs/39772133780)). The Windows logs **passed** signed company app SDK connect, delayed-gesture denial, local custom picker and opaque receipt; its real Windows native file dialog automation then failed, with the test's final error obscured by `EBUSY` temporary-profile cleanup. No native-dialog success is claimed.
- The Linux isolated Weston/Wayland log completed **7 graphical assertions successfully**, including signed app SDK custom selection and cancellation, and printed `M16 PRIVATE WAYLAND SUCCESS 7`; the job remained open in Electron/Playwright cleanup and was cancelled by the job runtime cap. Functional results must be separated from full job success.
- Corrective source only: use a dedicated `tests/m16-native-dialog-ci.ps1` to find the *actual* native Windows window by HWND/title/class/process, populate its file name using UI Automation or keyboard fallback, and retain redacted diagnostic information; suppress CI-only `EBUSY` masking of the real test error. Bound native window detection to 13 seconds.
- Linux private GUI runner now records its synthetic-only evidence and deliberately exits with the measured test result after bounded cleanup, avoiding a lingering Wayland/Playwright process. The Linux job has a 9-minute safety limit for variable hosted Weston package-install duration.
- Perform **one** tagged `[m16-gui]` push: only focused Windows/Linux verification jobs run, while full historical Windows validation is skipped. No staging or production credentials, real patient files, platform media upload, M16.5 transfer or app release publication is involved.
- The above are changes and a verification plan, **not passing evidence**. Record CI exact source SHAs and both job outcomes separately, including any remaining Windows/Linux or signed-app limitations before moving on.

## M16.4 full native-dialog and private Linux proof — exact-source CI (2026-10-22)

- [Focused CI run 39775866409](https://github.com/Business-It-Partners/dental-os/actions/runs/39775866409), SHA `ef7acba596c2ec98e51ec019b1b5013f7510c74b`: targeted security/unit tests and build/typecheck **passed** on Windows. The Windows Playwright UI printed `M16 FILES/PICKER UI SUCCESS 17`: **17 graphical assertions passed**, including ephemeral **company-signed** dental app SDK connect, forbidden delayed invocation, custom-picker opaque X-ray receipt, **actual native Windows file dialog** via Win32 HWND/UIAutomation/keyboard, and returned synthetic X-ray reference. The Windows job itself was **cancelled after the tests passed** because the Electron/Playwright process stayed open until CI timeout. This is a runner-cleanup issue, not proof of a failed file-picker assertion; full-job success is not claimed.
- At the *same exact SHA*, the isolated **Linux headless Wayland job completed successfully**, including seven graphical assertions for Files browsing, signed SDK selection, denied delayed gesture, metadata-only receipt and cancellation. The Linux teardown now exits cleanly.
- The Windows harness is being tightened in a **Windows-only tagged follow-up**: output the actual test result, bound Electron closure and synthetic profile cleanup, and terminate the disposable CI Node process with the recorded exit code. The previously passing Linux job will be skipped, and the full Windows milestone suite remains skipped to conserve Actions quota.
- No local device, production credentials, patient data, clinic backend, app upload capability, M16.5 drag/send or remote deployment was involved. Full G16 includes M16.5 and remains open independently of these M16.4 checks.

## M16.4 final cross-platform verification — accepted 2026-10-22

- **Windows fully green:** exact code SHA `76a3e418f80fc8b5bc0770306a0d3a157176dda6`, [targeted Actions 39777077788](https://github.com/Business-It-Partners/dental-os/actions/runs/39777077788) **conclusion SUCCESS**, focused security/unit tests and TypeScript/build passed, plus **17 automated graphical checks passed**. Native Win32 common dialog was actually located, selected `m16-synthetic-xray.png`, returned the metadata-only receipt through an ephemeral signed dental app SDK, and the test script exited successfully (`M16 WINDOWS VERIFIED EXIT SUCCESS 17`). No filesystem paths were returned to the app.
- **Linux fully green:** exact code SHA `ef7acba596c2ec98e51ec019b1b5013f7510c74b`, [targeted Actions 39775866409](https://github.com/Business-It-Partners/dental-os/actions/runs/39775866409) **linux-files-ui job conclusion SUCCESS** after **7 Wayland graphical checks**: Files browse/back, ephemeral company-signed app in isolated view, delayed-gesture forbidden, accepted custom picker metadata, cancellation, and clean CI exit. Windows in that older combined run was cancelled after 17 functional checks because of runner teardown; this was corrected and fully verified in the later Windows-only run.
- **Quota discipline:** full historical Windows milestone suite intentionally skipped for targeted pushes; the final Windows-only run explicitly skipped already-passing Linux. No repeat testing requested after both platform jobs became green. Documentation closeout uses `[skip ci]`.
- **Scope statement:** This closes the three remaining M16.3/M16.4 GUI verification tasks (native Windows dialog, signed app SDK, isolated Linux GUI). It does **not** implement or accept M16.5 Files-to-app drag/send, file-byte read, media upload, backend patient association, production promotion, or physical device certification. **G16 remains OPEN** until its separate remaining phases are implemented and accepted.
- **Next session:** start M16.5 only, using these contract and signed-file-selection proofs as the baseline. Read current branch SHA and M16 plan; do not start M16.5 as part of this documentation handoff.


## M16.5 explicit Files-to-app handoff — implementation and review (2026-10-22)

Source revision: `9425e0180088bc76041035a4e539e86ac73ec069`, [focused CI](https://github.com/Business-It-Partners/dental-os/actions/runs/39781678031). M16.5 scope only; no M16.6 work.

- `electron/host/fileTransfer.ts`: strict `{generation,fileIds}` shell parser with 1–10 unique opaque IDs and no caller-selected recipient/path, single in-flight transfer, `LocalFileService.select` receipt, 4-second ACK bound to exactly one sender/main frame/transfer ID, `inspect` revalidation on ACK and cancellation on reject/timeout/recipient lifecycle. Unauthorized cancellation falls back to trusted `revokeRecipient(sender)` so re-granting permission cannot revive an old pending lease.
- `electron/main.ts` and `electron/preload.ts`: shell-main-frame/active-generation check, Files visibility gate, trusted real user pointer/keyboard activation ticket valid up to 750ms, no app-facing bridge to shell filesystem IPC. A synthetic X11 verifier flag is permitted **only** for explicitly guarded GitHub Linux Actions; ordinary desktop profiles do not enable it.
- `electron/runtime/manager.ts`: recipient is derived from the host's last visible native app layout before Files opens (not a renderer-provided target); app must be ready, subscribed, signed, capability-eligible under existing `local.files.pick` policy ceiling, authorized under current session and family permissions, not dirty/modal/unsafe-write, and window/version/frame/session still valid. On close/crash/session change or subscription removal, pending receipt is cancelled. No general inter-application messaging bus was added.
- `electron/runtime/appPreload.ts` and `electron/sdk/contracts.ts`: narrow app `onFilesReceived` metadata listener, strict bounded notification parsing and typed ACK; no Node, raw path, binary handle or host shell IPC exposed to dental apps.
- `src/FilesApp.tsx`, `src/App.tsx`, `src/FilesApp.css`, `src/global.d.ts`: explicit send button, keyboard/Ctrl selection support, receiver eligibility text and failure feedback, reset on navigation/role/visibility. Shared OS window/dock, custom picker and native picker behavior are preserved.
- `electron/packages/fixtures.ts`: temporary per-run signed synthetic patient-record package with real isolated SDK receiver. GUI scripts exercise actual Files navigation/Send and check no absolute host path reaches the app. `tests/fileTransfer.test.ts` covers forged receiver/IDs, cross-frame refusal, cancellation, stale file identity, expiry/timeout, permission revocation and re-grant, recipient closure.
- Native cross-view OS drag was deliberately not enabled: `WebContentsView` paints and receives input separately from the React shell, so neither DOM drop events nor `webContents.startDrag` alone prove isolated secure destination routing. Explicit Send is the mandatory verified fallback. A real drag hit-test remains unimplemented/unsupported and must not be advertised.

**Review/verification:** first push `9f0930aaea186a606478a04348a2f4c2724ae133` passed focused Windows 32 unit and 18 UI checks; Linux CI on run `39779773853` never reached tests because an Ubuntu mirror stalled the Weston dependency install. A narrowly scoped correction `9425e0180088bc76041035a4e539e86ac73ec069` hardened unauthorized lease cancellation and replaced costly Wayland installation with guarded ephemeral `xvfb-run` for M16.5. The exact corrected-source run `39781678031` passed Windows 32 focused tests + 18 graphical checks and Linux 13 focused tests + 8 graphical checks; both builds/typechecks passed. Prior M16.4 Wayland pass remains independently recorded. The ordinary historical Windows milestone workflow was skipped by the tagged commit. CI logs and artifacts are on the GitHub run.

No staging/production contact, host device access, real clinical data, upload feature, backend association or M16.6 integration was part of this change. G16 is not closed.

## M16.6 integration closeout changes — 2026-10-22

- **Session-bound Files reset:** `src/App.tsx` keys the trusted Files browsing component by current clinic session generation. Prior M16.2 host generation invalidation correctly dropped folder IDs, but the mounted React Files history retained now-invalid tokens after a clinic switch. Remounting removes old folder breadcrumbs, choices, transient recipient information and in-flight browser effects before the next session's roots load. No app SDK, native file permissions or backend changed.
- **Security/resource regressions:** `tests/localFiles.test.ts` covers nested-handle invalidation and fresh session browsing; 64 outstanding receipt cap, cancellation and expiry capacity; `tests/fileTransfer.test.ts` covers single in-flight delivery, late owner authorization loss, invalidated lease and subsequent fresh Send. Existing path/symlink/forged owner tests retained.
- **Isolation/gesture GUI:** both hosted test scripts assert signed app renderer cannot reach privileged `window.desktop.files`, and actual well-formed script-driven Files Send fails without a current trusted user gesture; then a real Files button click succeeds. Existing native Windows dialog and Linux custom picker scenarios retained. Linux CI now runs full Vitest once; Windows remains focused to conserve Actions quota.
- **Verification:** tested exactly `772a739ed3af3be4fd678f7ebd68baeceef2f954`, [successful targeted Windows/Linux run](https://github.com/Business-It-Partners/dental-os/actions/runs/39785068605); Windows 35 focused tests + 20 private GUI checks, Linux 472 full tests + 10 private GUI checks, both with typecheck/build. No physical-device tests, production/staging credentials, OS-native drag gesture or clinic file upload were performed.
- **Exit:** M16.6 hosted engineering closeout complete; **G16 remains OPEN**. The follow-up source/API review and physical-device status are recorded below; do not imply Windows/Linux release certification (G20) or user acceptance (G21).

## Post-M16.6 drag feasibility and device status — 2026-10-22

On confirmed branch head `ad3e4bc0ed24fd11902693a0e34205716834f755`, source/API review found that Files is hosted in the shell renderer while managed apps occupy separate native views, and the runtime permits only one visible native input surface. A receiving app is therefore hidden while Files is foreground; shell DOM hit-testing cannot attest the native drop target. Electron `webContents.startDrag` initiates an outgoing drag from host file paths and does not prove inbound recipient identity. Native cross-view drag is formally deferred in the current architecture; no runtime code changed. Existing signed-recipient authorization, sandboxing, metadata-only receipts and explicit Send are unchanged.

The physical-device walkthrough is **NOT RUN**. The current environment shares the user's active Ubuntu desktop, and no separate user-controlled Dental OS/test-clinic session was available. No app was started/focused and no user/clinic files were opened or modified. See [device handoff](DEVICE_ACCEPTANCE_HANDOFF.md) and [verification evidence](VERIFICATION_EVIDENCE.md). Hosted M16.6 evidence remains bound to runtime SHA `772a739ed3af3be4fd678f7ebd68baeceef2f954`; no build/tests/Actions were repeated for this documentation-only update. G16 remains open; the user will merge to `main` manually.

## Image Viewer rendering correction after live review — 2026-10-22

The user-provided desktop screenshot exposed that the Image Viewer displayed a broken image even though its controls appeared. A private Linux test with the guarded 8 × 8 synthetic PNG reproduced the unavailable object URL and zero natural width. Source `1151d58f8048bafeb78f876b80676c6ed121f8ce` draws the single bounded, sanitized frame directly onto a maximum 4-million-pixel canvas and zeroes the canvas on image change or unmount. No host path or image bytes are sent to the dental app. Local build, 38 focused file/picker tests, 20/20 private Linux Files UI assertions, and Windows-only Actions 39823039280 (47 focused security tests, build/typecheck, 33/33 private Windows GUI assertions) pass. Physical-device acceptance and G16 remain open.
