# M11 Verification Evidence — Windows/Linux release and operations

**Milestone verification:** NOT YET STARTED.

## Required proof

- Clean-device and upgrade tests on each supported Windows/Linux target; installation permissions and secret providers verified.
- Platform update interruption/restart/recovery with installed app compatibility and dirty-work protection.
- Complete G01–G11/R01–R15 evidence review, authentic release artifacts, rollback/revocation drill and operations handoff.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.

## Additional staging-policy acceptance evidence

- Record that certification uses local/staging artifacts and feeds; production backend promotion or public production publishing remains a separately authorized task.

Not executed. Exact mapping and backend regression proof remain required when this milestone is implemented; this amendment changes documentation only.

## Separate unsigned prototype installer experiment — 2026-10-15

The user authorized a transferable Windows x64 preview of the existing shell, outside the production milestone sequence. [Configuration and build helper](../../tools/desktop-release/windows-preview.cjs), [instructions](../../tools/desktop-release/WINDOWS_PREVIEW.md), [package inspection/provenance](../../artifacts/windows-preview-verification.json) and [native build log](../../artifacts/windows-preview-build-native.log) record this experiment.

- Current renderer/host build and all 25 unit tests pass on Linux, sequentially with bounded resources.
- An unsigned per-user NSIS x64 preview installer was generated locally; publishing is disabled. Source/archive allowlists exclude repository credentials, the Flutter/Rust archive and local test evidence.
- PE architecture, compiled main/preload paths, renderer/icon inclusion and installer archive integrity pass; SHA-256 is recorded in the inspection evidence and beside the artifact.
- The Linux Wine helper failed; the successful build uses the pinned packager's native NSIS uninstaller extraction parser, constrained to that exact build-helper invocation. No installer/helper ran on the user's live desktop.

The exact bundled ASAR also passed seven private Linux smoke checks: host entrypoint, isolated preload, packaged assets, demo UI, native minimize, retained draft after restore and no renderer errors. [Evidence](../../artifacts/windows-package-linux-smoke.json) records that this was Linux, not Windows.

These are prototype artifact checks only, not G11 closure. Real Windows clean install, launch, permissions, upgrade, uninstall, signing and platform runtime acceptance remain pending. M11 stays PLANNED.
