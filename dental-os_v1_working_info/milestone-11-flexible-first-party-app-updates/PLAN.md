# M11 Plan — Flexible first-party app onboarding and updates

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M10](../milestone-10-security-resilience-and-usability/PLAN.md); reuses verified package, distribution and safe-update foundations from M06–M08.
**Requirements:** R02, R03, R05, R08, R09, R12, R15.
**Exit gate:** G11.
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [package contract](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md), [safe-update contract](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md).

## Outcome

An approved new company app can be registered, installed, launched and independently updated through the Dental OS Store without a new app-specific platform branch or Dental OS platform release. “Flexible” remains within the permanent first-party company boundary; it does not mean public extensions, third-party publishing or arbitrary sideloading.

## Scope and deliverables

- Generic identity, catalogue, package, Store and runtime handling for approved `company.*` apps within the platform-pinned trust roots and capability ceiling.
- App-only update flow with signed freshness/authorization, bounded download and verification, dirty-work protection, leased-version safety, health acknowledgement, compatible rollback and bounded retention.
- End-to-end synthetic staging demonstration: install a new app, then advance the same app through visible release features while the Dental OS platform build and other apps stay unchanged. Live sequence 1.0.0 → 1.1.0 → 1.2.0 is the initial acceptance path; 1.3.0 is a follow-up manual Store-update check.
- Resource/process behavior measured at the declared app limit; applicable Windows CI and Linux private acceptance with exact source/evidence.
- One detailed acceptance checklist: [APP_ONBOARDING_AND_UPDATE_CHECKLIST.md](../APP_ONBOARDING_AND_UPDATE_CHECKLIST.md).

## Work phases

1. **M11.1 — Generic first-party identity:** remove per-app runtime/renderer registration for approved company identities while retaining existing apps and strict capability bounds.
2. **M11.2 — Safe app-only release:** use the shared signed catalogue, update policy, package registry and runtime health/lifecycle path; keep platform updates separate.
3. **M11.3 — Staging proof:** install a newly approved synthetic app and exercise successive signed versions through the real Store/staging feed.
4. **M11.4 — Safety and scale:** complete interruption, revocation, dirty-work, rollback, retention, session-boundary, resource and cross-host checks.

These are tracked phases under G11, not separately verified top-level milestones. Track each phase in STATUS.md; do not mark G11 complete until all exit criteria pass.

## Exit criteria

- [x] A third approved company app installs and launches through the generic path with the two existing apps unchanged.
- [x] Successive app-only releases add visible features and are usable without changing or rebuilding the Dental OS platform.
- [x] Store identity, signing roots, signed catalogue/update policy, app grants and package identity remain bound; over-granted or untrusted apps fail closed.
- [x] Network loss, cancellation, malformed/oversized/tampered packages, stale/replayed metadata, incompatibility, withdrawal/revocation and disk pressure preserve a safe known-good install.
- [x] Dirty/modal work and uncertain backend writes cannot be silently replaced; failed health checks choose only an authorized compatible known-good version or explicit recovery. Local unit/private UI coverage passes; final-source Windows CI remains required.
- [x] App-local update/rollback leaves other apps and the platform unchanged; close, session change and logout clean only the intended runtime state.
- [x] Resource/process behavior at the configured app limit is measured and reviewed; final-source build, units, focused private UI and applicable Windows CI pass with retained evidence. The synthetic 16-app peak was 2.09 GiB aggregate working set; no memory ceiling was defined or enforced.
- [x] The user reported completing the 1.3.0 desktop update and now seeing version 1.3.0 with only **Open**; this confirms the manual Store click-through rather than inferring success from simulated offer state.
- [x] G11 and its R02/R03/R05/R08/R09/R12/R15 coverage are evidenced for this first-party synthetic/staging scope. Production promotion remains separate authorization.

## Boundaries and verification

M07/M08 remain verified for their original sample scope; M11 extends generic onboarding/update acceptance without rewriting those historical gates. No business data is stored authoritatively on-device, and there is no hidden offline write queue. Use synthetic/staging packages only. Staging publication uses the existing approved operator process and external signer; this plan alone does not authorize new cloud resources, production changes or deployment.

The [M12 UI milestone](../milestone-12-os-ui-experience/PLAN.md) may present M11 update states but must not duplicate its trust or install logic. M13 owns host installers and platform release/operations. Preserve the shared window manager, dock field and Genie pipeline while changing app/shell surfaces.

Record source/tree identity, command, host/display/profile, outcome and redacted artifact paths. Automated UI tests run only through the private display runner; never manipulate the user's running Dental OS. Physical Windows-device acceptance remains a separate final gate after M13.
