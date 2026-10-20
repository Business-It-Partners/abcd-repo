# M11 Status — Flexible first-party app onboarding and updates

**Status:** IMPLEMENTING
**Updated:** 2026-10-20.
**User acceptance:** the user reports completing the 1.3.0 staging Store update; broader product acceptance remains pending. No production acceptance is claimed.

## Current position

M11 is active on `codex/milestone-11`. A new update refusal/recovery matrix and Windows 16-app scale profile are being added to close the remaining gates. Final-source Windows Actions have not yet run; the new scale profile has no result until that run completes.

Generic first-party onboarding, signed staging releases `company.sample.preview` 1.0.0 → 1.1.0 → 1.2.0, authenticated Store install/update service acceptance, the private live-feed Linux install/update/restart flow, and local safety tests have passed for their recorded scope. The 1.3.0 staging release adds an app-update status panel; the user reports completing its Store update and now sees version 1.3.0 with only **Open**. M07/M08 retain their original verified scope.

## Phase tracking

| Phase | Status | Current evidence / remaining |
| --- | --- | --- |
| M11.1 — Generic first-party identity | IMPLEMENTED for the tested sample | Generic `company.*` path and capability ceiling covered by unit/private UI tests; broader negative package cases remain under G11. |
| M11.2 — Safe app-only release | IMPLEMENTED for the tested acceptance matrix | Live authenticated 1.0.0 → 1.2.0 install/update, dirty-write refusal, known-good rollback, interrupted transaction recovery, and the new 14-case update refusal matrix pass locally; final Windows CI for this source is pending. |
| M11.3 — Staging proof | IMPLEMENTED for recorded scope | Sequences 12–15 published and verified; user reports completing the manual desktop update to 1.3.0 and now seeing only **Open** for the current version. |
| M11.4 — Safety and scale | IMPLEMENTING | Local safety matrix passes; hosted Windows 16-app resource/process measurement and final Windows CI are pending. |

## Verification already recorded

Linux `npm run build`; serial unit suite (13 files / 259 tests); private onboarding, distribution and update UI regressions; staging publisher/conditional transport tests; authenticated Store service acceptance; and live-feed private desktop install/update/restart passed for the recorded source. See [evidence](VERIFICATION_EVIDENCE.md) and `artifacts/staging-onboarding-*.json`.

## Remaining work

- Complete the hosted Windows 16-app resource/process measurement and retain its artifact.
- Rerun required Windows Actions on the exact final M11 source and update this evidence record.
- Close G11 and R02/R03/R05/R08/R09/R12/R15 only when all named evidence passes.

## Scope boundaries

M12 owns the Dental OS shell/workspace UI experience. M13 owns installer, platform updater, host certification and release operations. Physical Windows-device interaction and final user/product acceptance remain after M13; hosted CI is not physical-device certification. Production promotion remains excluded absent separate authorization.
