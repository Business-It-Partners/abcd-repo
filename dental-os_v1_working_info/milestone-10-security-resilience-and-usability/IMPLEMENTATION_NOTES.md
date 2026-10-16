# M10 Implementation Notes — Security, resilience and usability

- `electron/diagnostics/store.ts` owns fixed-schema, bounded OS-only events and private atomic persistence; corrupt/linked state is preserved with optional persistence disabled. Trusted support IPC provides complete safe preview and exclusive native save; recovery gets a separate narrow preload.
- `electron/runtime/restartBudget.ts` and manager enforce three failures/60 seconds across close/reopen, no automatic restart; failed snapshots are cleared and late captures require current ready entry. Shared dock/Genie code is unchanged. Ordinary host close/quit refuses pending/unknown writes before disposal.
- Exact byte re-encoding closes replacement-decoded malformed UTF-8 acceptance in package/catalogue/control canonical JSON. Negative test creates invalid catalogue bytes whose replacement-decoded signed value would otherwise verify.
- Zero-count lease maps are removed. Only verified public update metadata survives account invalidation; installation authority and in-flight operations are cleared. Current expiry/revocation guards still apply on immediate launch.
- Store capability labels describe access. Existing scoped dialog keyboard handling, semantic controls and quiet styling are retained; new automated checks cover contrast, compact/zoom/reduced motion, crash/hang/suspend and resource budgets.
- [Support/recovery/key lifecycle and limits](../../docs/SECURITY_AND_RECOVERY.md) distinguish control-root compromise, optional diagnostics, known-good preference repair, clinical authority and deferred physical/assistive/long-duration acceptance.

No cloud/backend mutation or deployment in M10. No patient database, offline queue, third-party extension platform, arbitrary repair/reset or telemetry. See verification evidence for actual executed results. Production/release certification is not implied.
