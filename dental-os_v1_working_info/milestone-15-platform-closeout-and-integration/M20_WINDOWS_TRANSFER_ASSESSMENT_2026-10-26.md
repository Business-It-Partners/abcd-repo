# M20 Windows Reference → M15.11 Transfer Assessment (2026-10-26)

## Immutable comparison

- Reference: `Business-It-Partners/dental-os` branch `codex/milestone-20`, SHA `4e62367833d41f4b4e04d5b24362fa1210b51295`, based on older Dental OS M15 commit `be457b09ad48c14d7dccd05f9418392eaedc9d84`.
- Target: `Business-It-Partners/abcd-repo` branch `codex/m15-readiness`, starting SHA `6444591b9380ff3bb0d6a5ecb401c569934b7d66`.
- Selective adaptations only; no Git merge or replacement of the newer M15 codebase.

## Findings and decisions

| Windows M20 change | Decision | Rationale |
| --- | --- | --- |
| ASAR canonical path verification on Windows | **Adapt** | Existing package verifier assumed POSIX separators. Port tested normalize/reject helper into existing verifier. Keep packaging and publisher decisions untouched. |
| Real Windows Electron safeStorage smoke | **Adapt** | An isolated synthetic credential exercises native Windows credential encryption at rest, decrypt and secure removal; validates Windows behavior beyond fixture-only sign-in. Add to existing Windows M15 Actions. |
| Toolchain/Windows broad workflow and first-party app package fallback | **Not transplanted** | The target M15 workflow is focused and already has passing app/build gates; M20's broader historical suite and Node/npm pins belong to separate platform/release decisions. |
| M20 Windows File Explorer roots, known folders, reparse/ADS/path tests | **Exclude** | Internal Files Explorer and folder browsing are out of V1 scope, so no new Windows filesystem capability is authorized. |
| Windows staging NSIS installer branding, uninstall profile deletion, manual OS distribution | **Exclude** | OS self-distribution/updater infrastructure was expressly removed from this work; desktop installation policy remains a separate future release decision. |
| Windows docs, support/version, signing, distribution acceptance | **Reference only** | The recorded unsigned installer was built on Windows 11, but installer execution was blocked by Code Integrity and no real install/upgrade/uninstall acceptance passed. |

## Explicit verification limits

The M20 report `WINDOWS_IMPLEMENTATION_PROGRESS_2026-10-26.md` records a Windows 11 Pro x64 staging build and safeStorage smoke but notes the unsigned installer was not installed, the latest M20 workflow had not yet run at the time of that report, a later partial build had insufficient memory, and Windows 10 had not been tested. Thus neither Windows CI nor the M20 report can establish end-user installer support. No production environment, clinic data, signer or external staging upload was accessed for this transfer.

M15 Windows run [40262275038](https://github.com/Business-It-Partners/abcd-repo/actions/runs/40262275038) **failed** for `6444591b...` at an App Store visibility timeout; the native minimize assertion passed. A bounded diagnostic now reports the actual visible Store state and modal/window gating if that failure repeats, without converting a timeout into a pass. The exact-source result for this change remains pending. Staging upload cleanup and independent review also remain open; do not close M15.11 or move to M15.12.

## Verified selective Windows transfer — 2026-10-26

The resulting newer M15-based source at `8afb4a3a11b134841e63de4163a439e412277807` passed [Windows CI 40270853889](https://github.com/Business-It-Partners/abcd-repo/actions/runs/40270853889) with all stages green: compilation, app/runtime failure containment, real Windows Electron credential encryption smoke, restored native shell, compact layout, session/identity, state/resource recovery and integrated API contract. The missing native `restore` event on the hosted Windows host and subsequent guarded `enter-full-screen`/`focus` fallback were detected and corrected during this transfer. This is Windows **hosted CI** evidence, not physical installation on Windows 10/11, not an OS self-updater, and not M15.11 total closeout. All Files Explorer and out-of-scope distribution changes remain excluded.
