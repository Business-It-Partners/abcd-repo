# M16 Implementation Notes

**Date:** 2026-10-22. **Disposition:** documentation-only architecture/plan; no runtime change.

M16 was based on the exact M15 branch source at 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d. Source surveyed includes electron/main.ts, electron/runtime/manager.ts, electron/runtime/appPreload.ts, electron/sdk/contracts.ts, electron/sdk/broker.ts and src/windowManager.tsx.

Approved product direction: host-mounted read-only Files core app and OS-owned custom picker, plus parented native fallback; explicit user-initiated Files-to-app transfer with native drag investigated only when verifiable. The trusted host is the only filesystem authority. No app-direct path/Node/IPC privilege, file edit or general cross-app messaging.

The exact local SDK capability, permission encoding, sender gesture attestation, receipt lifecycle and Windows/Linux drag/focus mechanisms need an M16.1 implementation design review. Subsequent code changes and decisions will be recorded here; proposed source paths and plans are not shipped behavior.
