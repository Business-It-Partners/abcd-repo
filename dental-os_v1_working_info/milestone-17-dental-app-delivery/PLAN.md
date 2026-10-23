# M17 Plan — First-party Dental App Delivery

**Status:** IMPLEMENTING — Follow-ups 1.0.0 is current at Cloudflare staging sequence 24; Appointments 1.0.1 is current at sequence 26 after its 1.0.0 first release at sequence 25; Calendar 1.0.0 was started out of order at the user's direction and published at sequence 28. Public package verification and authenticated private-profile Store install/open with exact-payload health passed. Calendar's package checks and 16/16 private synthetic workflow checks passed. Full live role/tenant/workflow acceptance and trust-pin deployment to the user's running desktop remain open. Eight apps remain unstarted; G17 remains open.
**Updated:** 2026-10-23.
**Execution home:** Initial M17 app source was in the existing M15 worktree. The user's 2026-10-23 M17.1/M17.3 package-preparation task uses /home/master-x/.codex/worktrees/m17-followups-appointments/fewa_business_os on codex/m17-followups-appointments at base 2fc30a849677e889ef248d40595aad233c260ba5; the M15 source worktree is read-only for this task.
**Requirements:** R02–R12 and R15, as mapped to G14/G17.
**Exit gate:** G17 for app-by-app staging delivery. Final integrated acceptance is governed by the verified M15/G15 baseline.
**Architecture:** [SDK and API Broker](../../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md), [Store and Cloudflare Distribution](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [Install, Update and Uninstall](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md), [package format](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md).

## Purpose and source of truth

Deliver eleven first-party Dental OS apps as independently signed packages through the existing Cloudflare staging Store. M17 uses the app code already in this worktree, the maintained Dental SaaS UI/workflow/API modules, and the current M15 platform SDK/UI. Dental SaaS is the authority for business behavior; Dental OS is the authority for app identity, package signing, host capabilities, and Store delivery.

The current M17 Follow-ups and Appointments packages are retained as implementation checkpoints. Their user-facing workflows are not restarted. They receive new, unique M17 app IDs and first-release version 1.0.0 packages. The remaining apps are built fresh against their specific Dental SaaS modules; Calendar began before Patient Record at the user's direction. Existing preview packages and previously published package bytes remain unchanged and are not M17 release identities.

No other Dental OS app branch or worktree is an M17 source input. The active M17 app source is this worktree; app behavior is reviewed against the pinned Dental SaaS source for each app.

## Ownership and platform boundary

M17 app code does not implement capabilities that belong to Dental OS. The platform owns the isolated runtime, identity/session mediation, networking and API broker, host-enforced permissions, private media transfer, package verification, Store, and update lifecycle. Each app uses the supported SDK to call those capabilities. App code owns its clinical/business UI and maps user actions to approved SaaS API operations. Dental SaaS remains the business authority.

- Review the corresponding maintained Dental SaaS module and pin its exact revision and relevant file hashes before each fresh implementation.
- For Follow-ups and Appointments, retain the current M17 app source and verify its UI/API behavior against the pinned SaaS contract and current M15 SDK before repackaging.
- Use only SDK-mediated business APIs and platform media capabilities. Do not add app-owned HTTP, credentials, direct Worker/R2 access, a local authoritative business database, or a hidden offline write queue.
- Preserve stable operation identity and reconcile conflicts, session changes, and unknown outcomes through the existing SDK/Worker contract.
- Keep the shared window, module, session, and dirty-form lifecycle. Apps do not create their own window manager or general cross-app navigation.

## App submilestones

| Submilestone | App | New M17 ID | Main focus |
| --- | --- | --- | --- |
| [M17.1](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | company.dental.followups.m17 | Search, schedule, reschedule, status, safe writes |
| [M17.2](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | TBD before release | Patient workflow and host-mediated X-ray use |
| [M17.3](M17.3_APPOINTMENTS_PLAN.md) | Appointments | company.dental.appointments.m17 | Date/doctor views, booking, conflicts |
| [M17.4](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | TBD before release | Clinical encounter and reconciled commit |
| [M17.5](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | TBD before release | Patient-scoped stage aggregation |
| [M17.6](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | TBD before release | Lab Tracker and Lab Supplier Record |
| [M17.7](M17.7_FINANCE_PLAN.md) | Finance | TBD before release | Eight finance modules, ledger integrity |
| [M17.8](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | TBD before release | Receptionist-scoped collection workflow |
| [M17.9](M17.9_STAFF_PLAN.md) | Staff | TBD before release | Staff directory/profile and host-mediated documents |
| [M17.10](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | TBD before release | Protocol editing, ordering, pricing |
| [M17.11](M17.11_CALENDAR_PLAN.md) | Calendar | company.dental.calendar.m17 | BS/AD dates, tasks, draft safety |

Assign a new unique first-party ID to every M17 package, including Follow-ups and Appointments. The IDs listed in the existing preview manifests are not M17 release IDs. Record each selected ID in its plan, manifest, app metadata, and evidence before packaging. Preserve each preview ID and release unchanged.

## Execution order and implementation method

Complete one app at a time. The two existing M17 implementation checkpoints are Follow-ups and Appointments; after those release-identity updates, continue with Patient Record, then the remaining apps in submilestone order. Submilestone numbers and scopes do not change.

1. For Follow-ups and Appointments, continue from the app source already present in this M17 worktree. Confirm the current SaaS contract and M15 SDK boundary; do not restart the UI implementation.
2. For each remaining app, inspect its maintained Dental SaaS UI/workflow/API behavior, write a short route/role/payload/write-recovery contract note, pin the exact source, and build a Dental OS package from scratch using the current shared UI and SDK.
3. Run focused local Linux checks for the app. Do not run GitHub Actions for this M17 work. Current-source Windows verification and independent review remain separate gates.
4. Keep local implementation status separate from authenticated staging acceptance, signed publication, Store installation, and runtime-health evidence.
5. Record exact app source, SaaS revision, package identity/version/hash, signer identity, catalogue sequence, profile/tenant scope, and limitations.

## Version and signing policy

Every M17 app gets its own new unique app ID. The first package for each of the eleven IDs is version 1.0.0. Later packages under that same ID increment SemVer and never replace bytes under a used version. The earlier Follow-ups staging package and the local Appointments 1.1.0 checkpoint remain under their previous identities as historical artifacts; neither is relabeled or overwritten. New M17 packages are assembled from the retained source and assigned their new identity/version before signing.

Use one brand-new M17 first-party staging signing key for the full app suite. Do not search for or reuse an earlier milestone key. Pin the new public identity in the local verifier before preparing signatures, and deploy that trust pin to the staging verifier before any staging publication. Keep the private key only in a protected, Git-ignored local signing directory (directory mode 0700, key mode 0600) until moved into the user's vault. Repository records may contain only the key ID, public fingerprint, trust/pinning evidence, and handling procedure.

The new package signer is separate from the authorized clinic credential required for live synthetic staging acceptance. If the new signer trust, scoped publisher, or protected clinic credential is not ready, pause that app's staging release while continuing independent local implementation. Staging only; no production publication or production grant.

## Shared app acceptance sequence

1. Review and pin the corresponding Dental SaaS module or validate the existing M17 code against its pinned SaaS contract.
2. Verify app UI, SDK operations, loading/empty/error states, role and tenant denials, conflict/unknown-outcome recovery, session clearing, dirty-form behavior, keyboard/focus, and supported window/module behavior as applicable.
3. Confirm business calls pass through the SDK/broker and unauthorized operations fail before credentials or network dispatch. The SaaS Worker remains the business authorization and persistence authority.
4. Use only authorized synthetic staging identities and data for positive/negative business cases. No real clinic records.
5. Sign each first release under its new M17 ID at 1.0.0 with the new pinned suite key; publish only to Cloudflare staging; install and launch through the Dental OS Store; verify running package identity, version, digest, and app behavior.
6. Record attempts and superseding outcomes in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). Synthetic in-memory fixtures are not live staging acceptance.

## M17 and platform gates

G17 requires evidence for all eleven M17 identities and app submilestones. M17 staging delivery does not imply production readiness or physical-device acceptance. M15/G15 remains the platform closeout owner. App behavior that relies on a platform capability still under M15 acceptance must be marked provisional and rechecked against the final verified platform source. The relevant integrated acceptance gate remains separate from G17; M20/G20 and G21 keep their own scope.

## Exit criteria

- [ ] All eleven submilestones have app-owned source, exact per-app SaaS source pins where applicable, reviewed SDK operations/roles, and app-specific evidence.
- [ ] Each app has a unique new M17 ID and immutable version 1.0.0 first-release package signed by the new pinned M17 suite key.
- [ ] Each signed package is published only to Cloudflare staging and installed/opened through the Dental OS Store.
- [ ] Required workflow, authorization, tenant isolation, conflict/unknown-outcome, session, dirty-form, and relevant media checks pass with synthetic data.
- [ ] No app implements platform networking/auth/media transport, a local authoritative business database, or a hidden offline write queue.
- [ ] M17 records accurately separate local code checks, staging delivery, and later integrated/platform/device acceptance.
