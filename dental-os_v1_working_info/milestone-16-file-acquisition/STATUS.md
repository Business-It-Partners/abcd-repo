# M16 Status — Files and Local Acquisition

**Status:** IMPLEMENTING — M16.2 trusted host-only file service implemented as an unconnected module, pending exact-source Windows CI; no Files UI/picker integration.
**Updated:** 2026-10-22. **Branch:** codex/milestone-16.
**M15 source parent:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

## Authored in Phase 1

The [Architecture](ARCHITECTURE.md) defines Files, OS picker/native fallback, trust, temporary selection receipts and Files-to-app transfer behavior. Its §11 fixes the signed local capability, SDK 1.5 candidate, one-time user activation and broker/coordinator integration design after inspection of actual M15 source. The [Plan](PLAN.md) defines implementation phases and exit checks. The R16/G16 milestone mapping and ADR-030 belong to this documentation milestone.

## M16.2 trusted host service — implementation checkpoint

- Added `electron/host/localFiles.ts`: readonly user-folder/volume-root candidates; opaque handles; paged deterministic metadata listings (200/page, at most 2048 scanned per directory); symlink and path-escape refusal; internal ephemeral, recipient-bound, metadata-only selection receipts; cancel, 10-minute expiry, session/recipient revocation and disposal.
- Added `tests/localFiles.test.ts` with synthetic-only host security and lifecycle regressions.
- M16.2 module intentionally has **no renderer or IPC entry point** until M16.3/M16.4 enforce shell caller binding and the actual signed package + consent workflow. Supplemental removable-volume discovery, Windows junction/race verification and trusted UI integration are subsequent acceptance work, not silently claimed here.
- Local prototype checked using TypeScript strict checking and 5 Node native smoke/security checks; exact committed-source Windows workflow remains authoritative.

## Not implemented

No file-access IPC, Files window, modal/native picker, drag behavior, SDK 1.5 operation, upload, or backend deployment. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next

M16.1 design review is documented. Previous M16 Windows job passed documentation, unit and build/typecheck before an unrelated graphical runtime timeout; full runtime CI is not claimed. After recording the source-bound CI result, start **M16.3 — Files core window** in a separate working session. Before wiring the service to shell IPC, review safe file navigation, session binding and host-specific race/volume limitations. Do not bundle picker, drag or Cloudflare upload work. Preserve evidence and avoid changing M15 branch.
