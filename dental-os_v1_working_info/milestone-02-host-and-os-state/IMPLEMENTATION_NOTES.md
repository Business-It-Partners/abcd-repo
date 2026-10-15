# M02 Implementation Notes — Trusted host and OS state

## Source changes

- electron/storage/osState.ts: strict v1 allowlisted overview-shortcut preference, v0 migration, bounded file reads/writes, symlink/non-file refusal, capacity reserve, private Linux modes, fsync and same-directory atomic replacement, pending-transaction reconciliation.
- electron/host/platform.ts: storage-host interface for filesystem capacity and platform permission semantics; Windows uses native inherited permissions rather than POSIX mode guarantees.
- electron/main.ts: initialize state before ordinary shell startup, explicit status and static recovery page without preload, preference IPC with main-frame checks, exiting state; bound restore settling to 100 attempts.
- electron/preload.ts and src/global.d.ts: narrow preference/status API. src/App.tsx reads overview-shortcut preference at mount; updates take effect at next shell launch. No Settings screen added.
- tests/osState.test.ts and tests/host-state.mjs: fault/strictness and private full-restart/recovery checks. Existing native-session suite reconciled at the changed build.
- tools/check-dental-docs.py: allow the documented milestone status vocabulary as implementation begins instead of requiring all later milestones to remain PLANNED forever.

## Ownership/migration

Kept src/electron paths for this bounded slice; target folder migration is incremental, not claimed complete. The state journal is a local OS-state primitive, not a completed application installation registry (M06). No app records, patient cache, credential persistence, authentication/lock enforcement or backend service was implemented. M05 owns authenticated lock/session behavior.

Recovery preserves unsafe files and asks for support rather than silently resetting. Interrupted commits replay only when the installed predecessor digest matches or the target already equals the verified candidate. Windows durability/ACL and UI behavior require device evidence. A directory fsync failure is a recovery condition, not a durability success claim. Fullscreen settling times out to resume responsiveness; it does not certify successful compositor fullscreen.

## Verification repair

First build failed because new filesystem unit tests needed Node type declarations in the renderer/test compilation. Added a Node type reference to that test; subsequent build passes. Tightened the private shortcut assertion to target the actual overview class and added a positive enabled-shortcut control before rerunning the focused private suite. Retained both failed and passing build logs.
