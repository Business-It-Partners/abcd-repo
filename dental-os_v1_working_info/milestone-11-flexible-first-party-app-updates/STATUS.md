# M11 Status — Flexible first-party app onboarding and updates

**Status:** VERIFIED — documented automated and staging scope
**Updated:** 2026-10-20.
**User acceptance:** the user reports completing the 1.3.0 staging Store update; broader product acceptance remains pending. No production acceptance is claimed.

## Current position

M11 is complete on `codex/milestone-11` and is ready for its authorized normal merge into `main`. Final-source Windows Actions passed on `e14cd125` in run 39363492330. The 1.3.0 user-reported desktop update, local safety matrix, and 16-app Windows profile are recorded in the checklist and evidence below.

Generic first-party onboarding, signed staging releases `company.sample.preview` 1.0.0 → 1.1.0 → 1.2.0, authenticated Store install/update service acceptance, the private live-feed Linux install/update/restart flow, and local safety tests have passed for their recorded scope. The 1.3.0 staging release adds an app-update status panel; the user reports completing its Store update and now sees version 1.3.0 with only **Open**. M07/M08 retain their original verified scope.

## Phase tracking

| Phase | Status | Current evidence / remaining |
| --- | --- | --- |
| M11.1 — Generic first-party identity | VERIFIED for tested first-party scope | Generic `company.*` path, bounded capability ceiling, untrusted signer and unauthorized app refusal covered by unit/private UI tests. |
| M11.2 — Safe app-only release | VERIFIED for tested update scope | Live authenticated 1.0.0 → 1.2.0 install/update, dirty-write refusal, known-good rollback, interrupted transaction recovery, and 14-case update refusal matrix pass. |
| M11.3 — Staging proof | VERIFIED for recorded scope | Sequences 12–15 published and verified; user reports completing the manual desktop update to 1.3.0 and now sees only **Open** for the current version. |
| M11.4 — Safety and scale | VERIFIED for automated synthetic scope | Final Windows CI passed; 16 app views stayed ready through 60 seconds and were released on close. Peak aggregate working set was 2.09 GiB; no memory ceiling is enforced and real clinical apps/low-memory hardware were not measured. |

## Verification already recorded

Linux `npm run build`; serial unit suite (13 files / 259 tests); private onboarding, distribution and update UI regressions; staging publisher/conditional transport tests; authenticated Store service acceptance; and live-feed private desktop install/update/restart passed for the recorded source. See [evidence](VERIFICATION_EVIDENCE.md) and `artifacts/staging-onboarding-*.json`.

## Scope boundaries

M11 closes G11 for the documented automated/staging scope and does not claim production release readiness. The 16-app profile characterizes minimal static fixtures; its working-set sum is not PSS and has no enforced memory ceiling. M12 owns the Dental OS shell/workspace UI experience. M13 owns installer, platform updater, host certification and release operations. Physical Windows-device interaction and final product acceptance remain after M13 under G14; hosted CI is not physical-device certification. Production promotion remains excluded absent separate authorization.
