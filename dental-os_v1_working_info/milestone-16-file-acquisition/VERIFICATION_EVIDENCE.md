# M16 Verification Evidence

**Scope:** evolving M16 source-bound architecture, unit/build and graphical test record, latest Windows/Linux M16.4 evidence dated 2026-10-22.
**Base SHA:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

Evidence available: authenticated GitHub repository inspection of M15 architecture, contracts, host/runtime SDK and shell code; branch creation; M16 architecture and plan authored with explicit trust and non-upload boundaries.

Historical note: the M16.1-only baseline had no runtime evidence. Later sections record passing exact-source Windows and Linux CI; neither media upload nor overall G16 completion is claimed.

Pending: checker on committed docs, reviewed exact SDK local-file permission schema, unit security negatives, local real-file selection tests, native picker fullscreen tests, trusted send/drag fallback, platform regression, Windows workflow and final SHA-bound G16 decision.

Record later source, commands, environment, results and all failed attempts before marking any implementation gate passed.

## Post-creation verification and CI attribution (2026-10-22)

GitHub Actions run [39751236251](https://github.com/Business-It-Partners/dental-os/actions/runs/39751236251) on previous M16 documentation commit `163a6c57749965664e8d68e51130b6ed857f665f` reported:
- Documentation validation: **passed**.
- 433 Windows unit tests (as separately logged), package-shell tests and build/typecheck: **passed**.
- Windows isolated graphical runtime step: **failed**, with `page.waitForFunction: Timeout 30000ms exceeded`; later Windows stages skipped. No full workflow success is claimed. This was a docs/checker-only branch delta from M15 and does not itself prove new M16 runtime behavior.
- **No rerun requested**: Windows full UI is not required merely to finish M16.1 design documents; conserve the remaining free-plan Actions minutes.

M16.1 source analysis additionally examined the existing SDK, signed package and signed update-policy authority, session access, WebContentsView lifecycle, shell preload and Electron native dialog contracts. The architecture resolves the local selection grant/wire without changing backend contracts.

The previous doc-check pass is tied to its recorded SHA, **not automatically to subsequent design-document edits**. Following final commit, verify exact modified file links, milestone structure and source diff; record that result separately. No live patient files, network credentials, uploads or deployments were used.

## M16.1 final baseline and M16.2 focused evidence — 2026-10-22

- The later M16.1 documentation checkpoint [Windows run 39753231638](https://github.com/Business-It-Partners/dental-os/actions/runs/39753231638), commit `5790893b2c227957be7260e8e190e8c621c13af6`, completed **successfully**. This supersedes the older failed/cancelled documentation runs; neither run tests M16.2 code.
- M16.2 development used isolated **synthetic host directories**, not real clinic data. Strict TypeScript check of the prototype new host service completed successfully with Node 22 / tsc 5.8:
  `tsc --strict --noEmit --target ES2022 --module Node16 --moduleResolution Node16 --esModuleInterop --skipLibCheck --types node --typeRoots /usr/local/slides_js/node_modules/@types /mnt/data/m16_work/electron/host/localFiles.ts`
- Five independent Node-native smoke/security checks on the locally developed equivalent adapter passed: nested opaque listings and no path leakage, one-use sorted pagination, per-recipient receipts/expiry/change denial, symlink refusal, and bounded large-directory refusal. Local development tests are **not** a claim of exact final remote source validation.
- A Vitest-based host-only test suite was added to the branch for exact-source regression: malformed/path input, unauthorized recipient, frame/version/window/session mismatch, expiry and revocation, changed file, symbolic links, directory mutation, cursor replay, resource cap and disappearing root.
- No browser, Electron GUI, Firebase, Cloudflare or staging backend was accessed for M16.2 implementation. No upload/write API became available.

**Pending exact-source checks:** TypeScript/build, Vitest, Windows CI and any security gaps seen there must be inspected at the final commit. Full G16 remains open; custom picker/Files UI/native drag and remote upload are not verified. One consolidated branch push is used to minimize GitHub Actions consumption.

## M16.2 first Windows gate (failure retained; not accepted)

- [Run 39756354235](https://github.com/Business-It-Partners/dental-os/actions/runs/39756354235) at `259cd6e393b2e7c3ad6abe56631f0dcc9b790354`: **failed** at Windows unit suite; documentation passed; 434 tests passed, 4 skipped, 10 new `tests/localFiles.test.ts` cases failed because synthetic temporary roots were not discovered.
- Reproduced root and existing host behavior are distinct: Linux local focused checks passed; Windows `realpathSync.native` may use canonical aliases not textually identical to `path.resolve`. A Windows-specific canonical-root containment correction was prepared without weakening renderer access or signed authorization.
- Do not count the failed run as acceptance. A single narrower correction and automatic branch validation are required; preserve this failure rather than rewriting history.

## M16.2 corrected-source Windows verification (2026-10-22)

- Commit: `6bcc5b49d4940fe2f78d7bfe4fc2c3c96b18faaa` (host-service correction).
- [GitHub Actions workflow 39756930135](https://github.com/Business-It-Partners/dental-os/actions/runs/39756930135): documentation **passed**, unit suite **444 passed / 4 skipped / 0 failed** (26 test files), build/typecheck **passed**, first-party app shell package checks **passed**.
- The full workflow status is **failure**: existing Windows isolated runtime proof `tests/runtime-ci.mjs` failed with `spawnSync powershell.exe ETIMEDOUT` while requesting the OS test pointer position. Subsequent Windows graphical/integration steps were skipped. This is not M16.2 Files UI proof, and G16 remains open.
- No additional rerun authorized or initiated. The tested host-service source is unchanged by this evidence-only handoff. Linux local smoke results are preliminary only; M16.3+ still own sandboxed shell/UI integration and Windows/Linux interaction acceptance.

**Handoff:** exact implementation source `6bcc5b49`; next M16.3 session starts with source and working tree review. M16.2 provides the main-process foundation only. Do not expose file access directly to dental app JavaScript, bypass signed app policy, restart the user's desktop, or enable Cloudflare uploads.

## M16.3 implementation validation record (2026-10-22)

- Added strict host parser regressions for bounded shell file-list requests and Files static window manager lifecycle (`tests/filesShell.test.ts`).
- Added a private-display UI scenario (`tests/files.mjs`) using `--files-fixtures`, verifying navigation, selectable metadata, shell-only root discovery, preview privacy, and managed minimize/restore/close behavior. The script is available as `npm run test:files`; do not run against a live user desktop.
- Source review confirmed no `files:*` channels in isolated application preload, no changes to SaaS/Cloudflare or `clinic.media.upload`, no file bytes exposed to apps, and no general-purpose file editing.
- Exact-source Windows unit/build validation and private Linux display UI **not yet claimed** by authoring these tests. Record their actual results before accepting M16.3 as verified. In this tooling session private GNOME compositor and full repository node_modules are unavailable; avoid claiming that static inspection constitutes UI proof.

Existing M16.2 Windows evidence and its unrelated pointer timeout remain recorded above. Do not spend quota repeatedly rerunning graphical CI without a changed, targeted reason.

## M16.3 source-bound Windows CI and handoff (2026-10-22)

Commit fa3fc247a047e0051768a68699bee676a1b7ead6 on codex/milestone-16 passed documentation validation, 448 Windows unit tests (4 skipped), application package checks and build/typecheck in [Actions run 39759665540](https://github.com/Business-It-Partners/dental-os/actions/runs/39759665540). The full workflow **failed** at the pre-existing Windows isolated runtime proof step, with `page.waitForFunction: Timeout 30000ms exceeded`; downstream Windows runtime tests did not run. This is not proof of a Files UI failure or a pass.

The dedicated Files UI scenario `npm run test:files` remains **not executed** because this working environment lacks an isolated GNOME headless compositor. Do not run it on the user's actual desktop or with clinic files. Preserve this limitation when assessing M16.3 verification. The next session may perform private-display acceptance before proceeding to M16.4. No new CI run was requested solely for the graphical timeout.

## M16.4 test and acceptance plan — 2026-10-22

- `tests/filePicker.test.ts` exercises: strict local.files.pick shape and SDK 1.5 contract; unrelated clinic API grants denied; forged picker response/extra native path denied; bounded selection; deliberate OS confirmation; session/recipient-bound opaque receipts; native-dialog-approved file outside configured roots; cancellation, stale or unauthorized receipt use; and rejection of Linux symlink selections.
- Scope of authorized standalone actions: local file acquisition only; no bytes read, no upload, no clinic association.
- The new private-display UI `FilesPickerModal` integrates with existing Files browser. The previously pending `npm run test:files` M16.3 private-display test remains pending because this environment lacks a headless GNOME compositor. No live user desktop, real clinical files or staging credentials were used.
- **Pending** exact branch SHA, CI unit/build result, and Windows/Linux custom/native dialog proof. Historical M16.3 Windows run 39759665540 passed 448 unit tests but failed in a separate graphical runtime step and does not validate this M16.4 feature.

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
