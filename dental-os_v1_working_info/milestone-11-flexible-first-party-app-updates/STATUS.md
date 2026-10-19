# M11 Status — Flexible first-party app onboarding and updates

**Status:** IMPLEMENTING
**Updated:** 2026-10-19.
**User acceptance:** pending; no production acceptance claimed.

## Current position

M11 is active on `codex/milestone-11`. The current local implementation/evidence checkpoint is commit `fbcd156f`; the build and focused verification were run against the same code worktree before that commit, based on source `7f6e65bf`. The commit records the app-onboarding/update slice and its evidence. Do not treat the commit itself as a verified milestone.

Generic first-party onboarding, signed staging releases `company.sample.preview` 1.0.0 → 1.1.0 → 1.2.0, authenticated Store install/update service acceptance, and the private live-feed Linux install/update/restart flow have passed for their recorded scope. The 1.3.0 staging release adds an app-update status panel; the user's manual Store click-through remains pending. M07/M08 retain their original verified scope.

## Phase tracking

| Phase | Status | Current evidence / remaining |
| --- | --- | --- |
| M11.1 — Generic first-party identity | IMPLEMENTED for the tested sample | Generic `company.*` path and capability ceiling covered by unit/private UI tests; broader negative package cases remain under G11. |
| M11.2 — Safe app-only release | IMPLEMENTING | Live authenticated 1.0.0 → 1.2.0 install/update and health acknowledgement pass; full interruption/dirty-write/revocation/rollback matrix remains open. |
| M11.3 — Staging proof | IMPLEMENTING | Sequences 12–15 published and verified; manual 1.3.0 desktop update click-through pending. |
| M11.4 — Safety and scale | PLANNED | 16-app resource/process measurement, full failure matrix and applicable Windows CI remain open. |

## Verification already recorded

Linux `npm run build`; serial unit suite (13 files / 259 tests); private onboarding, distribution and update UI regressions; staging publisher/conditional transport tests; authenticated Store service acceptance; and live-feed private desktop install/update/restart passed for the recorded source. See [evidence](VERIFICATION_EVIDENCE.md) and `artifacts/staging-onboarding-*.json`.

## Remaining work

- Finish the unchecked safety cases in the [single acceptance checklist](../APP_ONBOARDING_AND_UPDATE_CHECKLIST.md), including interruption, uncertain writes, dirty work, failed health, revocation and cleanup.
- Measure memory/process behavior at the supported app limit and record resource thresholds.
- Run M11 applicable Windows CI and preserve the actual run/source identity.
- Complete the user's manual Store refresh/update check for 1.3.0, or retain it explicitly as pending.
- Close G11 and R02/R03/R05/R08/R09/R12/R15 only when all named evidence passes.

## Scope boundaries

M12 owns the Dental OS shell/workspace UI experience. M13 owns installer, platform updater, host certification and release operations. Physical Windows-device interaction and final user/product acceptance remain after M13; hosted CI is not physical-device certification. Production promotion remains excluded absent separate authorization.
