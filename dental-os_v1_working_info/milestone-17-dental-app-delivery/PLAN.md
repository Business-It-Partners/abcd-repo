# M17 Plan — First-party Dental App Delivery

**Status:** IMPLEMENTING — Treatment Progress 1.0.5 remains published at sequence 57; Finance 1.7.3, Lab Tracker 1.0.3, and Staff 1.0.3 are published at signed staging sequences 74–76. The latest audit aligned applicable record pages with Standard Window 1 and removed redundant explanatory captions without inventing summary cards. All three app checks/builds, root build and 527 unit tests passed; Finance's four private startup checks and Lab Tracker's 19 private UI checks passed; combined signed public readback passed 20 checks. Authenticated Store installation, live clinic acceptance, and G17 remain open.
**Updated:** 2026-10-23.
**Execution home:** Existing M15 worktree on branch codex/milestone-15. Follow-ups, Appointments and Calendar were imported from commit `5306b80161542b7a9480b4bb2bc49df6b1218d84`; no separate M17 worktree or branch is an ongoing source dependency.
**Requirements:** R02–R12 and R15, as mapped to G14/G17.
**Exit gate:** G17 for app-by-app staging delivery. Final integrated acceptance is governed by the verified M15/G15 baseline.
**Architecture:** [SDK and API Broker](../../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md), [Store and Cloudflare Distribution](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [Install, Update and Uninstall](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md), [package format](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md).

## Purpose and source of truth

Deliver ten first-party Dental OS apps as independently signed packages through the existing Cloudflare staging Store. Finance is one of those top-level apps and contains eight internal Finance sub-apps in one package; the former standalone M17.8 Patient Payments scope is absorbed into Finance child M17.7.2. M17 uses the app code in this worktree, the maintained Dental SaaS UI/workflow/API modules, and the current M15 platform SDK/UI. Dental SaaS is the authority for business behavior; Dental OS is the authority for app identity, package signing, host capabilities, and Store delivery.

Follow-ups, Appointments, Calendar, Treatment Protocols, Work Entry, Patient Record, and Treatment Progress have signed staging releases through sequence 57. Standard Window table updates followed at sequences 68–70. The latest concise-copy updates are Finance 1.7.3 at sequence 74, Lab Tracker 1.0.3 at 75, and Staff 1.0.3 at 76. All three current packages passed typecheck, package tests, app build, signed public package/grant readback and isolated PackageRegistry install/launch/uninstall. Finance also passed four private startup checks after its blank-window provider fix; Lab Tracker passed 19 private UI checks. Finance remains one app package containing all eight internal sub-apps, with initial version 1.7.0. Authenticated Store installation and full live workflow acceptance remain open, so these results do not close M17/G17. The sequence 30 cleanup removed every earlier non-M17 dental identity and its package objects; historical preview IDs and evidence remain in the repository.

No other Dental OS app branch or worktree is an M17 source input. The active M17 app source is this worktree; app behavior is reviewed against the pinned Dental SaaS source for each app.

## Ownership and platform boundary

M17 app code does not implement capabilities that belong to Dental OS. The platform owns the isolated runtime, identity/session mediation, networking and API broker, host-enforced permissions, private media transfer, package verification, Store, and update lifecycle. Each app uses the supported SDK to call those capabilities. App code owns its clinical/business UI and maps user actions to approved SaaS API operations. Dental SaaS remains the business authority.

- Review the corresponding maintained Dental SaaS module and pin its exact revision and relevant file hashes before each fresh implementation.
- For Follow-ups, Appointments and Calendar, retain the imported app source and verify its UI/API behavior against the pinned SaaS contract and current M15 SDK before any later repackaging.
- Use only SDK-mediated business APIs and platform media capabilities. Do not add app-owned HTTP, credentials, direct Worker/R2 access, a local authoritative business database, or a hidden offline write queue.
- Preserve stable operation identity and reconcile conflicts, session changes, and unknown outcomes through the existing SDK/Worker contract.
- Keep the shared window, module, session, and dirty-form lifecycle. Apps do not create their own window manager or general cross-app navigation.

## App submilestones

| Submilestone | App | New M17 ID | Main focus |
| --- | --- | --- | --- |
| [M17.1](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | `company.dental.followups.m17` / 1.0.0 | Search, schedule, reschedule, status, safe writes |
| [M17.2](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | `company.dental.patient-record.m17` / first 1.0.0, current 1.0.5 | Pinned SaaS UI/workflows and host-mediated X-ray use; Standard Window inset update at sequence 55 |
| [M17.3](M17.3_APPOINTMENTS_PLAN.md) | Appointments | `company.dental.appointments.m17` / 1.0.0 first package; 1.0.3 current | Date/doctor views, booking, conflicts |
| [M17.4](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | `company.dental.work-entry.m17` / first 1.0.0, current 1.0.2 | Clinical encounter and reconciled commit; staging sequence 48 |
| [M17.5](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | `company.dental.treatment-progress.m17` / signed 1.0.5 at sequence 57 | Compact patient-scoped stage view; no Doctors column, progress bar or remaining label; 1.0.5 checks and public readback passed |
| [M17.6](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | `company.dental.lab-tracker.m17` / 1.0.3; staging sequence 75 | Lab Tracker and Lab Supplier Record; Standard Window, navigation and concise-page-copy updates; package checks and 19 private UI checks passed; Store/live acceptance open |
| [M17.7](M17.7_FINANCE_PLAN.md) | Finance | `company.dental.finance.m17` / initial 1.7.0, current 1.7.3; staging sequence 74 | Eight ordered internal Finance child submilestones; blank-window fix, Standard Window and concise-page-copy updates; four private startup checks passed; child-level acceptance remains open |
| [M17.8](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | SUPERSEDED — no separate app ID/package/listing/version | Overlapping scope absorbed into Finance child M17.7.2 |
| [M17.9](M17.9_STAFF_PLAN.md) | Staff | `company.dental.staff.m17` / 1.0.3; staging sequence 76 | Standard Window, navigation and concise-page-copy updates; package checks and public readback passed; Store/live acceptance open; post-commit abort route absent |
| [M17.10](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | `company.dental.m17.treatment-protocols` / 1.0.0 | Protocol editing, ordered stages, pricing |
| [M17.11](M17.11_CALENDAR_PLAN.md) | Calendar | `company.dental.calendar.m17` / 1.0.0 | BS/AD dates, tasks, draft safety |

Assign a new unique first-party ID to every active M17 package, including Follow-ups and Appointments. Finance is one package shared by all eight internal modules; superseded M17.8 has no separate ID. The IDs listed in historical preview manifests are not M17 release IDs. Record each selected ID in its plan, manifest, app metadata, and evidence before packaging. Preserve the old IDs and release evidence in local history; earlier non-M17 staging releases were removed at sequence 30.

## Execution order and implementation method

Complete one app at a time. Follow-ups and Appointments remain existing M17 implementation checkpoints. Patient Record was next after those checkpoints and is now staging-published. On 2026-10-23 the user directed early implementation starts on Work Entry and Patient Record in the same M15 worktree. Treatment Protocols also began early at the user's direction because it is independent. These user-directed starts do not change submilestone numbers or scopes.

1. Continue from the Follow-ups, Appointments and Calendar source integrated into this M15 worktree. Confirm the current SaaS contract and M15 SDK boundary; do not restart the UI implementation.
2. For each remaining app, inspect its maintained Dental SaaS UI/workflow/API behavior, write a short route/role/payload/write-recovery contract note, pin the exact source, and build a Dental OS package from scratch using the current shared UI and SDK.
3. Run focused local Linux checks for the app. Do not run GitHub Actions for this M17 work. Current-source Windows verification and independent review remain separate gates.
4. Keep local implementation status separate from authenticated staging acceptance, signed publication, Store installation, and runtime-health evidence.
5. Record exact app source, SaaS revision, package identity/version/hash, signer identity, catalogue sequence, profile/tenant scope, and limitations.

## Version and signing policy

Each of the ten active M17 top-level apps gets its own new unique app ID. A first release normally starts at version 1.0.0. Finance uses one package under `company.dental.finance.m17`; the original plan was to add each child and advance the minor version from 1.0.0 through 1.7.0. In actual delivery, all eight modules were integrated before the first Finance release, so 1.7.0 is the first published Finance version; 1.0.0–1.6.0 were not published. Reserve patch increments for fixes. No internal Finance sub-app gets its own app ID, package, Store listing, or version. Later packages under any app ID increment SemVer and never replace bytes under a used version. Earlier Follow-ups and Appointments releases remain documented under their previous identities as historical evidence; they were not relabeled, and their non-M17 staging objects were removed at sequence 30. New M17 packages are assembled from the retained source and assigned their new identity/version before signing. Each package declares exactly one supported `clinic.app.*` family capability; the signed catalogue/update policy bind the new ID and exact release grant, while the unchanged host applies that family's existing role, route and media rules. M17's new IDs need no per-ID OS source entry. A genuinely new host capability or route contract still requires platform implementation.

Use one M17 first-party staging signing key for the full app suite. The fresh Ed25519 key was created on 2026-10-22 with key ID `company-staging-m17-20261022` and public-key SHA-256 fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`. Its public key is pinned in the source staging trust configuration at `electron/distribution/staging.ts` and has signed the M17.10 package and staging metadata at sequence 29. The private key remains local and outside the checkout in a protected directory (mode 0700; key mode 0600) until moved into the user's vault. Do not search for or reuse an earlier milestone key. Repository records may contain only the key ID, public fingerprint, trust/pinning evidence, and handling procedure. This work did not confirm installation in the user's running OS.

The new package signer is separate from the authorized clinic credential required for live synthetic staging acceptance. If the new signer trust, scoped publisher, or protected clinic credential is not ready, pause that app's staging release while continuing independent local implementation. Staging only; no production publication or production grant.

## Shared app acceptance sequence

1. Review and pin the corresponding Dental SaaS module or validate the existing M17 code against its pinned SaaS contract.
2. Verify app UI, SDK operations, loading/empty/error states, role and tenant denials, conflict/unknown-outcome recovery, session clearing, dirty-form behavior, keyboard/focus, and supported window/module behavior as applicable.
3. Confirm business calls pass through the SDK/broker and unauthorized operations fail before credentials or network dispatch. The SaaS Worker remains the business authorization and persistence authority.
4. Use only authorized synthetic staging identities and data for positive/negative business cases. No real clinic records.
5. Sign each first release under its new M17 ID at 1.0.0 with the new pinned suite key; publish only to Cloudflare staging; install and launch through the Dental OS Store; verify running package identity, version, digest, and app behavior.
6. Record attempts and superseding outcomes in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). Synthetic in-memory fixtures are not live staging acceptance.

## M17 and platform gates

G17 requires evidence for all ten active M17 app identities, including all eight Finance child submilestones inside its single package. Superseded M17.8 does not create another identity or acceptance track. M17 staging delivery does not imply production readiness or physical-device acceptance. M15/G15 remains the platform closeout owner. App behavior that relies on a platform capability still under M15 acceptance must be marked provisional and rechecked against the final verified platform source. The relevant integrated acceptance gate remains separate from G17; M20/G20 and G21 keep their own scope.

## Exit criteria

- [ ] All ten active M17 apps have app-owned source, exact per-app SaaS source pins where applicable, reviewed SDK operations/roles, and app-specific evidence; Finance also satisfies all eight internal child plans.
- [ ] Each active app has a unique new M17 ID and immutable version 1.0.0 first-release package signed by the new pinned M17 suite key; Finance later child releases follow its single-package minor-version sequence through 1.7.0.
- [ ] Each signed package is published only to Cloudflare staging and installed/opened through the Dental OS Store.
- [ ] Required workflow, authorization, tenant isolation, conflict/unknown-outcome, session, dirty-form, and relevant media checks pass with synthetic data.
- [ ] No app implements platform networking/auth/media transport, a local authoritative business database, or a hidden offline write queue.
- [ ] M17 records accurately separate local code checks, staging delivery, and later integrated/platform/device acceptance.
