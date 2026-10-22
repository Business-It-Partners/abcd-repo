# M16 Status — Files and Local Acquisition

**Status:** IMPLEMENTING — M16.3 OS-owned Files window and shell-only host browsing integrated; Windows build/unit and private Linux UI evidence pending. G16 picker/transfer acceptance remains open.
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

## Not implemented

No custom/native file picker, drag behavior, SDK 1.5 operation, upload, or backend deployment. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next

M16.1 design review is documented. Previous M16 Windows job passed documentation, unit and build/typecheck before an unrelated graphical runtime timeout; full runtime CI is not claimed. The M16.2 source-bound Windows unit/build evidence is recorded. After source-bound checks, start **M16.4 — Custom and native file picker** in a separate working session. Before wiring the service to shell IPC, review safe file navigation, session binding and host-specific race/volume limitations. Do not bundle picker, drag or Cloudflare upload work. Preserve evidence and avoid changing M15 branch.
