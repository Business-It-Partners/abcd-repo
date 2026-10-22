# M16 Status — Files and Local Acquisition

**Status:** IMPLEMENTING — M16.1 architecture and detailed contract review documented; M16.2 trusted host adapter is the next sub-milestone. No runtime implementation.
**Updated:** 2026-10-22. **Branch:** codex/milestone-16.
**M15 source parent:** 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.

## Authored in Phase 1

The [Architecture](ARCHITECTURE.md) defines Files, OS picker/native fallback, trust, temporary selection receipts and Files-to-app transfer behavior. Its §11 fixes the signed local capability, SDK 1.5 candidate, one-time user activation and broker/coordinator integration design after inspection of actual M15 source. The [Plan](PLAN.md) defines implementation phases and exit checks. The R16/G16 milestone mapping and ADR-030 belong to this documentation milestone.

## Not implemented

No new filesystem IPC, Files window, picker, drag behavior, SDK contract, upload, backend deployment or runtime tests. The existing M15 upload denial remains intact. G16 has no implementation acceptance evidence.

## Next

M16.1 design review is documented. Previous M16 Windows job passed documentation, unit and build/typecheck before an unrelated graphical runtime timeout; full runtime CI is not claimed. Advance in the **next working session** to only the trusted host adapter (M16.2), after verifying current branch and source. Do not combine later Files UI, picker or drag slices. Preserve evidence and avoid changing M15 branch.
