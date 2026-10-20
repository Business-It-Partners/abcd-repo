# M20 Verification Evidence — Windows/Linux release and operations

**Milestone verification:** NOT STARTED. M20 is PLANNED; no production installer or supported-host certification is claimed.

## Required evidence

For each run retain date, exact source and artifact identity, dependency/build versions, host/architecture/permissions, exact command, exit status, logs and limitations. Record Linux and Windows CI separately from physical-device testing. Never include credentials, signing-key material or patient payloads.

## Planned acceptance

- [ ] Explicit Windows/Linux support matrix and installer/updater/permissions ADRs.
- [ ] Signed platform package, provenance and key-custody evidence.
- [ ] Clean install, upgrade, interruption/restart, rollback/recovery and uninstall on named CI/host targets.
- [ ] Compatibility with M11 app packages and M12 shell/session state.
- [ ] Diagnostics and operations/incident/retirement runbooks.
- [ ] G20 evidence for the declared hosted/automated scope.
- [ ] G21 physical Windows-device and user/product acceptance after M20, before final release.

## Historical prototype installer experiment — 2026-10-15

This out-of-sequence experiment is evidence about a prototype artifact only. It does not satisfy G20 or G21 and does not select a production installer.

The user authorized a transferable unsigned Windows x64 preview. [Configuration and build helper](../../tools/desktop-release/windows-preview.cjs), [instructions](../../tools/desktop-release/WINDOWS_PREVIEW.md), [package inspection/provenance](../../artifacts/windows-preview-verification.json) and [native build log](../../artifacts/windows-preview-build-native.log) record it.

- The renderer/host build and all 25 unit tests passed on Linux, sequentially with bounded resources.
- An unsigned per-user NSIS x64 preview installer was generated locally; publishing was disabled. Source/archive allowlists excluded repository credentials, the Flutter/Rust archive and local test evidence.
- PE architecture, compiled main/preload paths, renderer/icon inclusion and installer archive integrity passed; SHA-256 is recorded in inspection evidence and beside the artifact.
- The Linux Wine helper failed. The successful build used the pinned packager's native NSIS uninstaller extraction parser, constrained to that exact build-helper invocation. No installer/helper ran on the user's live desktop.
- The bundled ASAR passed seven private Linux smoke checks: host entrypoint, isolated preload, packaged assets, demo UI, native minimize, retained draft after restore and no renderer errors. [Evidence](../../artifacts/windows-package-linux-smoke.json) records that this was Linux, not Windows.

Real Windows install, launch, permissions, upgrade, uninstall, signing, platform updater, supported-host scope and physical device acceptance remain open.
