# M16 Verification Evidence

**Scope:** architecture and working plan only (2026-10-22).
**Base SHA:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

Evidence available: authenticated GitHub repository inspection of M15 architecture, contracts, host/runtime SDK and shell code; branch creation; M16 architecture and plan authored with explicit trust and non-upload boundaries.

No build, private UI run, Windows CI, upload, hosted deployment, local documentation checker run, or G16 runtime verification is claimed by this record.

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
