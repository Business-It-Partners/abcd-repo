# M06 Implementation Notes — Verified packages and local lifecycle

## Baseline and reference

Started from main `b24e3591586aa1d950d8367ba193c4ea09cd7dfb`, after M05 verification/integration. M03 loaded three fixed source assets and hardcoded broker identity/grants. M06 replaces that loader with verified installed leases while preserving shared frames, dock/Genie composition, isolated memory sessions and M04/M05 session/caller checks. Consulted archived Flutter `refrence/fewa-os_v1-documentation/08_V1_APP_RUNTIME_AND_PACKAGE.md` for verification-before-launch/registry/grant lessons; its compiled binary format and product scope are not imported.

## Implemented boundaries

- `electron/packages/format.ts`: deterministic canonical JSON/base64 web archive, exact manifest/release inventory, Ed25519/SHA-256 validation, portable path and size limits, platform-selected ID/key/grant policy. [Exact contract](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md) is normative; ADR-015 accepted and ADR-020 records the format tradeoff.
- `electron/packages/registry.ts`: OS-profile-owned format-1 registry/journal, exclusive transactions, safe regular extraction, capacity preflight, immutable versions, atomic activation, retained versions, monotonic installs, launch revalidation/pinned bytes, active leases and uninstall containment. Bootstrap reconciles conclusively dead installer owners and interrupted operations. Unknown/corrupt/unsafe state is preserved and refused.
- `electron/packages/fixtures.ts` plus bootstrap: only guarded private Linux/GitHub Windows samples load test policy. Normal trust is empty/fail-closed until approved release public keys exist. No renderer package-management/file/sideload API. Fixture private signing key discarded; retained public key and signed bundles are test-only.
- `electron/runtime/manager.ts`: protocol serves lease bytes with platform CSP/content types/no-store; broker registration derives ID/version/grants from verified manifest. Existing `dental-fixture` origins remain bounded sample origins; no generic installed production catalogue is implied.
- `tools/app-packages/`: internal assembly and explicit fixture regeneration; no dependency install, backend changes, provisioning or deployment. `tests/packages*`: format negatives, filesystem lifecycle, actual abrupt-process exit/restart, private/Windows runtime binding and tampering. Windows workflow adds package gates before existing host/runtime/SDK/identity gates.

## Recovery findings and corrections

The first actual abrupt-exit run exposed a first-install cleanup bug when the app parent directory had never been created. Cleanup now handles the missing parent idempotently; regression tests cover all first-install and update phases. The first package UI run attempted to close an inactive window behind another app; the harness now activates its dock icon first and uses an explicit 15-second locator timeout. Neither issue required touching the user's live desktop. Initial typecheck caught a parsed-release TypeScript narrowing mismatch; the validated wire value is explicitly typed after runtime validation. Failed logs are retained alongside superseding runs.

## Scope and limitations

M06 is the local primitive/installed-sample gate. The Store UI remains synthetic until M07/M08 wire approved distribution and real operation truth. No production signing keys are provisioned or trusted. Catalogue freshness/key rotation/public download/private bucket policy is M07; dirty workflow scheduling, revocation, rollback authority and retention eviction are M08. Three retained versions/app are a hard refusal boundary here. Running leases block uninstall; the manager never silently kills workflow state.

One trusted Electron host owns each profile; operation locks add transaction exclusion, not distributed locking. Process exit tests do not certify sudden power loss, filesystem firmware durability, Windows ACL/antivirus interactions or physical-device usability. ENOSPC is covered by capacity refusal and injected extraction failure; the actual workstation filesystem was not filled. Windows physical verification remains after M11 before final release. Test fixtures use no live API credentials or network; M05 staging identity proof was not needlessly repeated. Builds/tests run sequentially on private profiles and owned processes are cleaned up.
