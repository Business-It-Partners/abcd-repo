# M16 Status — Files and Local Acquisition

**Status:** IMPLEMENTING — M16.3 Files browsing and M16.4 OS-owned custom picker now have successful synthetic hosted-Windows graphical evidence (12 checks), plus 26 focused security/unit tests and build/typecheck. Native Windows dialog, signed app SDK end-to-end, Linux GUI and G16 overall acceptance remain open.
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

## Not implemented

No M16.5 Files-to-app drag/send, no clinical file-byte read, Cloudflare upload, patient attachment or backend deployment. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next

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
