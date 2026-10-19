# M11 Status — Windows/Linux release and operations

**Status:** IMPLEMENTING
**Updated:** 2026-10-19.
**User acceptance:** pending; no production acceptance claimed.

## Current position

Implementation started on `codex/milestone-11` from source `7f6e65bf`, preserving uncommitted user artifacts. The user authorized M11 and its scoped first-party app onboarding/update amendment on 2026-10-19. Generic Linux onboarding and the live signed Cloudflare releases `company.sample.preview` 1.0.0 → 1.1.0 → 1.2.0 (sequences 12–14) pass for their recorded scope. A real staging clinic session also passed authenticated Store refresh, fresh 1.2.0 install, and a 1.0.0 → 1.2.0 update through the current Store service. The new company app's Store-to-dock arrival flight is restored and covered by the private onboarding UI test. M07/M08 remain verified only for their original documented sample scope.

The added acceptance slice is tracked only in the [first-party app onboarding/update checklist](../APP_ONBOARDING_AND_UPDATE_CHECKLIST.md): a third approved app is installed from staging and updated through three versions without a Dental OS platform update. All original M11 release, operations, host, recovery, and evidence gates remain required.

**Scoped Linux/staging checks:** `npm run build`; the full serial unit suite (13 files / 259 tests); private UI onboarding, distribution, and update regressions; 13 operator publisher/conditional transport tests; authenticated Store service acceptance; and the live-feed private desktop install/update/restart pass. Evidence: [staging-onboarding-verification.json](../../artifacts/staging-onboarding-verification.json), [staging-onboarding-auth-verification.json](../../artifacts/staging-onboarding-auth-verification.json), and [staging-onboarding-desktop-verification.json](../../artifacts/staging-onboarding-desktop-verification.json). M11 Windows CI, maximum-limit resource measurement, and the original host/release gates remain open.

**Dependencies:** [M10](../milestone-10-security-resilience-and-usability/PLAN.md)

## Remaining work

- Clean-device and upgrade tests on each supported Windows/Linux target; installation permissions and secret providers verified.
- Platform update interruption/restart/recovery with installed app compatibility and dirty-work protection.
- Complete G01–G11/R01–R15 evidence review, authentic release artifacts, rollback/revocation drill and operations handoff.

## Status rules

PLANNED -> IMPLEMENTING -> IMPLEMENTED -> VERIFIED. VERIFIED is limited to named scope and retained evidence, not implied production release. BLOCKED identifies a concrete dependency; DEFERRED/REMOVED need a recorded product decision. Do not mark a milestone verified with missing required host evidence. Update the global status when this file changes.

## Prototype packaging experiment

On 2026-10-15 the user separately authorized a local unsigned Windows x64 installer of the existing prototype for device testing. See [work contract](../../WORK_CHECKLIST.md) and [preview instructions](../../tools/desktop-release/WINDOWS_PREVIEW.md). This experiment does not bypass M10, freeze the production installer/update choice, or satisfy G11. M11 remains IMPLEMENTING; Windows installation/runtime and production certification remain unverified.
