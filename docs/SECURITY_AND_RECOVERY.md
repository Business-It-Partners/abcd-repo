# Dental OS V1 security, support and recovery

M10 implementation policy, 2026-10-16. Architecture defines requirements; milestone evidence defines tested scope. This is the configured two-sample platform, with full clinical application delivery and release operations separate.

## Trust review

| Boundary / threat | Implemented response | Verification owner |
| --- | --- | --- |
| Altered package, path escape, resource bomb, substituted capability | Exact canonical bytes, Ed25519 purpose/identity, manifest asset hash inventory, bounded portable paths/count/size and company grants | M06 package negatives/process exits; M10 malformed-UTF-8 signed catalogue regression |
| Stale, replayed, expired or equivocated catalogue/control | Pinned roots, independently persisted watermarks, freshness/minimum/digest/key/listing rules; fail closed | M07/M08 distribution/update negatives and actual staging |
| App escapes to host/files/network or another app | Separate sandboxed WebContents/session, denied permissions/navigation/download/network, narrow preload, caller/frame/connection/generation binding | M03 runtime and M04 SDK negatives, M10 support bridge refusal |
| Credential/account leakage | Platform-only credentials, protected-provider refusal fallback, in-memory app partitions, generation fencing, lock/logout/suspend erasure, preview cleanup | M05/M09/M10 identity/private-profile canaries |
| Duplicate/uncertain writes | Named existing API, original idempotency identity, revision conflict, no automatic retry/offline queue; close/update/host exit refuse unknown/pending | M04/M08/M09/M10 broker/integrated tests |
| App crash/hang or retained preview | Supervision, no automatic restart, three-failure/60-second per-app budget, late capture fencing and image erasure | M10 hardening and runtime regressions |
| Corrupt local state / insufficient space | Preserve bytes and stop unsafe launch/commit; deterministic valid journal recovery, scoped support view, no silent reset | M02/M06/M08 state/capacity/process-exit tests; M10 preserved-state repair fixture |
| Diagnostic payload injection / unbounded logs | Fixed event/target/time schema, reject extra persisted fields, bounded ring and private atomic file, no raw exceptions | M10 diagnostic negative tests and explicit export proof |

The OS shell is trusted UI; downloaded apps are not. A compromised host administrator, stolen trusted signing root, malicious authorized publisher, OS memory/swap/crash dump or hostile accessibility tool is outside sandbox guarantees. No patient telemetry or claim of defeating the host administrator. App source signing establishes provenance, not clinical correctness. Desktop CI is not physical-device certification.

## Diagnostics and support export

`electron/diagnostics/store.ts` stores only a fixed event code, host/studio/records target and timestamp. Ring capacity is 256 entries; events.json <=32 KiB plus at most one normal atomic temporary during a write. Identical consecutive events within one second are coalesced. File mode 0600/directory 0700 where POSIX modes apply; Windows inherits the user profile ACL (physical ACL acceptance remains a release gate). Invalid, linked or oversized existing diagnostics are preserved and persistence disabled. Failed diagnostic storage does not block the workspace. One fixed exclusive temporary path bounds interrupted persistence too: if it remains after a power cut, the next boot preserves it and disables disk logging. Support may inspect it after shutdown; no new temporary files accumulate.

Support diagnostics requires an explicit button. The native preview shows the complete safe JSON and policy before the native save selection. App/Electron versions, platform and architecture accompany the bounded event ring. No account/clinic IDs, operation IDs, arbitrary messages, exception stacks, URLs, filesystem paths, credentials, API responses, patient data, drafts, previews or screenshots are included. No upload or background telemetry. A new file is created with exclusive creation; existing files are never overwritten. The recovery view receives only fixed support actions, not the workspace/identity/native bridge. Apps have no support bridge.

Optional diagnostics never authorize another operation. A timestamp/OS version can still be personal operational information; sharing the exported file is a separate deliberate user action.

## Recovery procedure

1. Leave the recovery screen intact. Use Preview safe diagnostics; save only the safe export if useful. Show local files opens the current profile only on explicit user action. Never automatically reset a registry, clear a freshness watermark or delete suspect state to make startup green.
2. Close Dental OS fully before inspecting or repairing its profile. Preserve suspect OS preference, registry, journal and package bytes in a protected external support copy; do not copy identity credentials into a support bundle. Do not publish profile files or raw application screenshots.
3. Determine the failed subsystem. A valid interrupted preference/package transaction uses its existing journal reconciliation. Invalid or conflicting journals stop recovery, preserving both sides. Low capacity requires freeing unrelated space by the owner; do not purge clinic data or active package versions.
4. For OS preferences only, an engineering-reviewed known-good supported-schema copy may be restored after shutdown, retaining the original corrupt bytes. M10 tests this exact fixture procedure. Do not extend this proof to arbitrary package-registry or whole-profile rollback.
5. Package registry repair requires matching signed package identities, current approved update metadata, retention/lease state and transaction history. Preserve distribution anti-replay ledgers; an older backup must never reduce a watermark. If evidence is insufficient, engineering must produce a reviewed scoped repair. There is no generic reset/delete button or automatic clinical cleanup.
6. Relaunch and verify the affected subsystem plus the retained evidence. Reauthentication may be needed; existing clinic records remain server authority. Never recover an uncertain write by guessing that it failed or inventing a new operation key. If process death/sign-out removed in-memory intent, inspect current server state before deliberately making a new change.

Ordinary host close/quit refuses pending/unknown writes before disposing identity/runtime. Explicit lock/logout still erase in-memory work. Forced process termination, host power loss and deliberate session erasure cannot promise durable drafts; no hidden write queue exists. Close/save individual drafts before exiting the host. Runtime restart refuses unresolved writes and the app must reconcile or the operator must perform an explicit session/server review.

## Signing-key lifecycle

All current staging trust keys are compiled platform trust anchors for signed control metadata as well as delivery. Private keys remain outside repositories and sample bundles. Access is limited to the operator; no private key in desktop CI, logs or user apps. Current local staging files are mode 0600 under mode-0700 storage. This is staging custody, not production key-management certification.

- Routine rotation: separately authorize/review the new anchor in a platform update; retain the previous safe anchor during rollout. Publish immutable company bundles with the new key and monotonic signed catalogue/control metadata. Prove pinned old-instance continuity and safe successor health before considering the transition accepted. M08 retains this staging proof.
- Package/catalogue key withdrawal: use an unaffected trusted control key, higher sequence, explicit revoked key/digest or minimum/listing policy and compatible successor. Recheck signatures, expiry, platform/API compatibility and server installation authority. Preserve old bytes needed for evidence; a revoked version is never a rollback target.
- Compromised control trust anchor: remote revokedKeys cannot securely revoke an anchor able to sign replacement control metadata. Stop publication, investigate and distribute a separately authenticated platform update removing that trust anchor. A claim that remote app revocation solves root compromise is prohibited. Production anchor separation/custody and signed host-update channel are M11 release work.
- Metadata expires within 24 hours. Authorized staging operators must renew with a strictly higher sequence and current policy before expiry, even if bundles are unchanged. No scheduled renewal service is silently installed. Expired metadata prevents unsafe launches; cached public metadata retained across account changes is rechecked at use and grants no install authority.

## Supported verification envelope and remaining release work

M10 automation exercises two native sample apps, ten open/close cycles and a 60-second resource sample: <=12 app-owned OS processes, <=2 GiB aggregate working set, <=160 MiB warm-to-final growth, no views after close/lock. These are regression ceilings, not minimum hardware recommendations. Actual measurements belong in milestone evidence. No arbitrary app count or clinic-day endurance claim.

Keyboard dialog trapping/Escape, accessible control names, sample text contrast >=4.5, reduced-motion lifecycle, 200% zoom and 1024x768 compact layout are measured automated checks. This is not complete WCAG or screen-reader certification. Multi-hour Windows/Linux device soak, physical host/ACL/GPU/session interactions, actual assistive technology and visual acceptance remain named post-M11/before-release checks. Full clinical UI and signed installers/host updater are separate deliveries.
