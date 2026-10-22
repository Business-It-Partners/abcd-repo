# M16 Status — Files and Local Acquisition

**Status:** M16.6 integrated closeout IN PROGRESS. M16.5 Send remains source-verified; native cross-view drag and physical-device verification deferred by user. **G16 OPEN** until all scoped acceptance evidence is reviewed.
**Updated:** 2026-10-22. **Branch:** codex/milestone-16.
**M15 source parent:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

## Authored in Phase 1

The [Architecture](ARCHITECTURE.md) defines Files, OS picker/native fallback, trust, temporary selection receipts and Files-to-app transfer behavior. Its §11 fixes the signed local capability, SDK 1.5 candidate, one-time user activation and broker/coordinator integration design after inspection of actual M15 source. The [Plan](PLAN.md) defines implementation phases and exit checks. The R16/G16 milestone mapping and ADR-030 belong to this documentation milestone.

## M16.2 trusted host service — implementation checkpoint

- Added `electron/host/localFiles.ts`: readonly user-folder/volume-root candidates; opaque handles; paged deterministic metadata listings (200/page, at most 2048 scanned per directory); symlink and path-escape refusal; internal ephemeral, recipient-bound, metadata-only selection receipts; cancel, 10-minute expiry, session/recipient revocation and disposal.
- Added `tests/localFiles.test.ts` with synthetic-only host security and lifecycle regressions.
- M16.2 module intentionally has **no renderer or IPC entry point** until M16.3/M16.4 enforce shell caller binding and the actual signed package + consent workflow. Supplemental removable-volume discovery, Windows junction/race verification and trusted UI integration are subsequent acceptance work, not silently claimed here.
- Local prototype checked using TypeScript strict checking and 5 Node native smoke/security checks. Windows CI on exact M16.2 source `6bcc5b49` passed documentation, 444 unit tests (4 skipped), package tests, build/typecheck; full workflow failed later in an existing Windows runtime pointer step (`powershell.exe ETIMEDOUT`). No M16.2 host unit failures remain.

## M16.3 Files window checkpoint

- Added `files` as an OS-owned static managed window with an always-accessible dock launcher; kept shared focus, maximize, minimize, restore and overview lifecycle.
- Added `src/FilesApp.tsx` and stylesheet for accessible, read-only local browsing with opaque directory IDs, roots, back/forward/up, breadcrumbs, pagination, selection, sorting, refresh and actionable errors.
- Exposed only `files:roots` and `files:list` through the **trusted shell preload**; Electron main checks shell main-frame identity, active session and generation, and a strict bounded listing request. Dental application preloads remain unchanged.
- Added a synthetic private-display `--files-fixtures` path and `npm run test:files`. This deliberately does not touch real clinic files.
- File window previews use a generic SVG animation/snapshot and privacy placeholder in overview, never captures of local filenames.
- Files has **no selectable-to-dental-app transfer**, file-byte read/write, upload, native picker or generic app messaging.

## M16.4 picker implementation checkpoint

- Added local.files.pick typed SDK 1.5 candidate, signed package/local policy capability gate, scoped runtime activation ticket and broker-coordinated, abortable selection.
- Added OS-owned shared-files custom picker with a parented native Electron fallback. Only shell IPC gets picker events and opaque file ID confirmation.
- Added temporary native explicit-file receipts to M16.2 host adapter; paths/bytes remain internal to trusted Electron main, and no upload/read consumer is exposed.
- Added focused parser/broker/coordinator tests. Existing app releases without the newly signed capability remain unable to open the picker.

## Not implemented (historical M16.4 checkpoint)

No M16.5 Files-to-app drag/send, no clinical file-byte read, Cloudflare upload, patient attachment or backend deployment. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next (historical M16.4 handoff)

M16.1 design review is documented. Previous M16 Windows job passed documentation, unit and build/typecheck before an unrelated graphical runtime timeout; full runtime CI is not claimed. The M16.2 source-bound Windows unit/build evidence is recorded. Windows source at 69dfaa45339d passed documentation, 456 unit tests (4 skipped), build/typecheck and first-party package checks. The full Windows workflow failed on the existing runtime-scenario Motion Studio launcher lookup; dedicated picker GUI proof did not run. Pending: run the private-display Files/picker UI flow on supported OS devices. Start M16.5 only in a separate session after recording limitations and correcting any M16.4 regression. Never imply the selection receipt uploads a patient file. Before wiring the service to shell IPC, review safe file navigation, session binding and host-specific race/volume limitations. Do not bundle picker, drag or Cloudflare upload work. Preserve evidence and avoid changing M15 branch.

## Focused remote GUI verification pending

A single tagged push will run the bounded hosted Windows Files/picker graphical job rather than the full suite. Root cause of old runtime launcher timeout unconfirmed; no new visual acceptance yet.

## Graphical startup regression diagnosis

The first bounded Windows GUI run passed focused security tests and build but failed before the Files window because Electron's sandboxed shell preload did not initialize. The M16.4 runtime import of the file-picker contract is being corrected with an inline self-contained validator and a permanent preload import regression test. A second **focused** run is required; overall GUI acceptance remains pending.

## Remote Windows Files/picker GUI verification — completed (2026-10-22)

- Source: `cd66c9e2165de7a4ec1a0dffb33b52e242e87ef8`. [Focused GitHub Actions 39766483727](https://github.com/Business-It-Partners/dental-os/actions/runs/39766483727) finished **successfully**.
- Evidence: 26 targeted unit/security tests passed; build/typecheck passed; **12 real graphical Windows checks passed**. Host shell/dock and isolated runtime fixture started correctly; Files browsing, folder navigation, metadata-only picker choice and user cancellation were verified with synthetic files.
- Previous [focused run 39766003708](https://github.com/Business-It-Partners/dental-os/actions/runs/39766003708) revealed an M16.4 sandboxed shell preload regression. Eliminating a runtime relative import and adding three preload compatibility regressions restored the bridge and launchers.
- Free-plan quota: both focused pushes skipped the full historical Windows milestone job. Do not rerun passed GUI proof merely to seek another green badge.
- **Still open:** actual Windows native-dialog interaction, signed dental app SDK gesture -> picker receipt end-to-end, Linux private-display GUI, Files minimize/overview privacy on platform, M16.5 transfer, file-byte consumption, patient association and Cloudflare upload. G16 not marked VERIFIED.

Next working session: decide whether remaining M16.4 native/signed-app proof should be a targeted gate before M16.5. Do not bundle M16.5 drag/send work with this verification handoff.
## Corrective verification follow-up (pending)

A tightly scoped native Windows dialog automation correction and bounded Linux Wayland teardown have been prepared. The previous `b552f18` logs already proved the signed custom-picker flow on Windows and 7 Linux graphical assertions; those earlier jobs were not green. Do not mark native Windows picker or full cross-platform acceptance passed until the corrected exact-source focused jobs finish.

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


## M16.5 current accepted checkpoint — 2026-10-22

**Implementation:** `9425e0180088bc76041035a4e539e86ac73ec069` on `codex/milestone-16`; typed `electron/host/fileTransfer.ts` one-recipient handoff, active/signed/app-role session checks in runtime, shell-only Files Send with trusted activation, isolated app `dentalApp.onFilesReceived` metadata subscription and bounded ACK, typed IPC, cancellation and revoke-on-permission-loss. Existing Files browsing, M16.4 custom/native pickers, app sandboxing and media-upload denial remain intact. This is **metadata receipt delivery**, not a clinical file import, file-byte read or upload.

**Windows:** [focused run `39781678031`](https://github.com/Business-It-Partners/dental-os/actions/runs/39781678031) `files-ui` passed 32/32 focused tests, build/typecheck and 18/18 private synthetic graphical checks including actual host Windows native picker, company-signed fixture, and Files explicit Send to that app.

**Linux:** same run `linux-files-ui` passed 13/13 focused tests, build/typecheck and 8/8 private Xvfb X11 graphical checks including isolated signed receiving app and Files explicit Send. M16.4 retains its separate 7-check Linux Wayland baseline. The first M16.5 Linux attempt, `39779773853`, was **cancelled during Weston APT package downloads** (no GUI test executed); replaced with private X11 setup to conserve Actions minutes.

**Known limits:** OS-native drag-and-drop between isolated `WebContentsView` windows was **not proven safe or implemented**; no physical Windows/Linux device claim, no file-byte consumption, no full milestone matrix, no Cloudflare/backend work or patient association. Focused successful runner evidence only; **G16 remains OPEN**.

**Next phase, separate session:** M16.6 final integration/acceptance/evidence review and G16 closure decision. Do not start it automatically.
