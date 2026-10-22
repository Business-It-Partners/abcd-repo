# M16 Status — Files and Local Acquisition

**Status:** IMPLEMENTING — M16.1 architecture/working-plan phase. No runtime implementation.
**Updated:** 2026-10-22. **Branch:** codex/milestone-16.
**M15 source parent:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

## Authored in Phase 1

The [Architecture](ARCHITECTURE.md) defines Files, OS picker/native fallback, trust, temporary selection receipts and Files-to-app transfer behavior. The [Plan](PLAN.md) defines implementation phases and exit checks. The R16/G16 milestone mapping and ADR-030 belong to this documentation milestone.

## Not implemented

No new filesystem IPC, Files window, picker, drag behavior, SDK contract, upload, backend deployment or runtime tests. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next

Finish M16.1 design/contract review and documentation validation, then advance sequentially to the trusted host adapter (M16.2). Preserve evidence and avoid changing M15 branch.
