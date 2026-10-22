# M17 Plan — First-party Dental App Delivery

**Status:** IMPLEMENTING — M17.1 Follow-ups remains complete for its recorded Linux staging scope. M17.3 Appointments has a passing local implementation checkpoint but no release; its package identity and signer must follow the revised fresh-release approach. M17.2 Patient Record is queued after it. New implementations for the remaining apps are built from scratch against the Dental SaaS UI/API reference. G17 remains open.
**Updated:** 2026-10-22.
**Execution home:** existing M15 worktree on branch codex/milestone-15, as directed by the user. No separate M17 worktree or branch is created.
**Requirements:** R02–R12 and R15, as mapped to G14/G17.
**Exit gate:** G17 for app-by-app staging delivery. G14 remains the final integrated functional-app gate and depends on verified M15/G15.
**Architecture:** [SDK and API Broker](../../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md), [Store and Cloudflare Distribution](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [Install, Update and Uninstall](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md), [package format](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md).

## Purpose

Build the remaining first-party dental apps from scratch in the existing M15 worktree. Use the maintained Dental SaaS modules at `desktop/fewa_demo/dental-saas` as the reference for UI, workflows, and API behavior; implement the Dental OS app UI and SDK adapter in this repository. Do not transfer M14 app code. Deliver one app at a time through local Linux verification, a new first-party staging app identity, signing with the new suite staging key, Cloudflare staging publication, and installation through the Dental OS Store. Preserve M17.1's accepted release and M17.3's current local work as recorded checkpoints.

M17 app code does not implement capabilities that belong to Dental OS. The platform owns the isolated runtime, identity/session mediation, networking and API broker, host-enforced permissions, private media transfer, package verification, Store, and update lifecycle. Each app uses the supported SDK to call those capabilities. The app owns its clinical/business UI and maps its user actions to approved SaaS API operations. Dental SaaS remains the business authority.

## Coordination and source inputs

- M17 work stays in the current M15 worktree and branch. M15 remains IMPLEMENTING; this sequencing does not close, waive, or rewrite G15.
- M14 is preserved as historical source/evidence only. It is not an app-code source for new M17 implementations. Consult it only to understand prior decisions or compare behavior; it never substitutes for the maintained Dental SaaS reference or new M17 acceptance.
- For each not-yet-built app, review only its maintained SaaS module under `desktop/fewa_demo/dental-saas`, record the exact source revision and relevant file hashes, then recreate its app-owned UI/workflow in the Dental OS app package. Use the current M15 `packages/dental-ui` and `packages/app-sdk`; do not copy SaaS server/auth/transport code or rebuild OS capabilities in the app.
- Published M14 source reviewed for this plan: Dental OS branch head 093cd96382466bf3aacf2a89a5b6389e19bce042. The earlier eleven-app synthetic package run used OS 8af1d14de62d0773b4f4c12369d499eabf08c677 with SaaS app source d66a3c494cb96540c1fea908282c9b08919001d2 ([run 39702783617](https://github.com/Business-It-Partners/dental-os/actions/runs/39702783617)).
- Follow-ups has a later packaged broker reference proof at OS ec32273dfb46705e5ae6150f652cdbce047c2646 and SaaS app source f0d059d36540b4b6907cace089085ce0df62d454 ([run 39737035903](https://github.com/Business-It-Partners/dental-os/actions/runs/39737035903)). It uses an in-memory synthetic Worker; it is not staging acceptance.
- Current M15 platform implementation reference is 94c74ac2f13ed1211c5b2cfa38545f95c002da58. Record exact imported app and SaaS source revisions, package identity/version, and M15 SDK/platform revision in the M17 import ledger before implementing each app. Do not assume one SaaS SHA covers every app.
- Existing M14 CI and broker runs are useful starting evidence only. They do not count as M17 verification or prove live staging behavior.

## App ownership and SDK contract

- Implement app presentation and workflows from the maintained Dental SaaS module behavior. Derive endpoints, methods, query parameters, payloads, roles, and conflict semantics from the current SaaS Worker and reviewed platform SDK contract at implementation time.
- Use Dental OS SDK APIs for brokered requests, session identity, capabilities, API outcomes, and media. No app-owned HTTP transport, direct Worker/R2 request, bearer-token access, upload URL/signing logic, hidden offline queue, or local authoritative business database.
- The OS signed release grant, app capability ceiling, current clinic session, and SaaS Worker authorization must all permit a business operation. Apps must fail closed when a required SDK capability or route is absent.
- Preserve stable operation identity for writes and handle conflict, cancellation, session change, and unknown outcomes by reconciling through the original operation identity. Do not silently retry a business operation with a new key.
- Keep existing shared window, module explorer, session, and dirty-form lifecycle. No app-owned window manager or general app-to-app messaging/navigation is introduced; cross-app navigation remains unavailable absent its own approved contract.
- Patient Record X-rays and Staff documents use the M15 media SDK. The SDK/host mediates bytes and authorization; SaaS owns stored-file status, retention, and deletion. No app or OS withdrawal/deletion lifecycle is added.

## App submilestones

| Submilestone | App | Package | Main focus |
| --- | --- | --- | --- |
| [M17.1](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | company.dental.followups | Search, schedule, reschedule, status, safe writes |
| [M17.2](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | company.dental.patient-record | Patient workflow and host-mediated X-ray use |
| [M17.3](M17.3_APPOINTMENTS_PLAN.md) | Appointments | company.dental.appointments | Date/doctor views, booking, conflicts |
| [M17.4](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | company.dental.work-entry | Clinical encounter and reconciled commit |
| [M17.5](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | company.dental.treatment-progress | Patient-scoped stage aggregation |
| [M17.6](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | company.dental.lab-tracker | Lab Tracker and Lab Supplier Record |
| [M17.7](M17.7_FINANCE_PLAN.md) | Finance | company.dental.finance | Eight finance modules, ledger integrity |
| [M17.8](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | company.dental.patient-payments | Receptionist-scoped collection workflow |
| [M17.9](M17.9_STAFF_PLAN.md) | Staff | company.dental.staff | Staff directory/profile and host-mediated documents |
| [M17.10](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | company.dental.treatment-protocols | Protocol editing, ordering, pricing |
| [M17.11](M17.11_CALENDAR_PLAN.md) | Calendar | company.dental.calendar | BS/AD dates, tasks, draft safety |

The IDs shown above are the existing preview IDs. M17.1 remains on its already released ID. For each not-yet-released M17 app, assign a new unique first-party app ID before creating its release package; record and freeze it in that app plan, manifest, and evidence. Do not infer an ID from the preview row.

Complete one app at a time. The user-directed execution order after M17.1 is M17.3 Appointments, then M17.2 Patient Record, followed by the remaining app submilestones in their recorded order; this changes execution order only and does not renumber or change their scope. Do not mark another app complete from shared-package smoke tests or evidence from a different app.

## Fresh implementation workflow

1. Inspect the one app's SaaS UI and API behavior; write a short contract note covering screens, routes, roles, validation, write identity, and conflict/recovery behavior. Pin its SaaS revision before coding.
2. Implement its UI and business interaction from scratch in the existing Dental OS app structure, using the shared UI package and SDK. Do not transplant M14 or SaaS application/server code.
3. Build one complete user workflow early, then add the remaining scoped flows and states. Keep each review and verification focused on that app; do not repeat checks that already pass without a change or a concrete concern.
4. Run the agreed focused local Linux checks. Do not run GitHub Actions for this M17 work; current-source Windows verification remains a separate user-device gate.
5. Complete staging identity, signer trust, authenticated synthetic acceptance, signed publication, and Store installation only after that app's local checkpoint is ready. Keep staging acceptance separate from code implementation status.

## Versioning and staging release

Existing preview IDs and their releases remain unchanged. Each new M17 app ID starts at version 1.0.0; every later package under that same ID increments SemVer and never replaces bytes under a used version. The existing M17.3 local 1.1.0 is a private development checkpoint under the preview ID, not a release version; its first package under the new ID must use 1.0.0. Record exact ID/version/hash before release.

Create one new first-party staging signing key for the fresh M17 release line and pin its public identity in the staging verifier before signing packages. Keep private key material in a temporary local-only `signing/` area with a 0700 directory and 0600 key file, excluded from Git; move it into the user's vault when available. Track only the key ID, public-key fingerprint, trust/pinning evidence, and handling procedure. Do not reuse the old M08 key for new M17 packages or re-sign M17.1's historical release. The new key does not replace the separate authenticated staging-clinic credential requirement.

For each app: validate source and package; sign with the new pinned M17 staging key; bind package digest, capabilities, and API operations to approved staging metadata; publish through the existing staging catalogue/bucket path with a higher sequence; then install and open through the Dental OS Store. Record exact SaaS source, new package ID/version, signer identity (never key material), package hash, catalogue sequence, Store result, profile/tenant, and acceptance outcomes.

Publication is staging-only. No production bucket, production API, production migration, or production grant is in scope. Bootstrap the one user-directed new M17 staging key and pin its public identity before signing any new package. If signer trust, the scoped staging publisher, or authorized protected clinic credentials are unavailable, stop that release until the missing prerequisite is ready; do not create per-app replacement keys or use chat credentials. The staging package object may be publicly readable, so it must contain app code only, never credentials or clinic data.

## Shared app acceptance sequence

1. Review the corresponding current Dental SaaS module and pin its exact source revision; treat M14 as historical reference only.
2. Complete the app's UI and typed SDK adapter. Test loading, empty, success, error, authorization denial, conflict, unknown outcome, session change, form dirty state, keyboard/focus, and supported window/module behavior as applicable.
3. Prove that app requests pass through the SDK/broker, that undeclared operations fail before credentials/network, and that the SaaS Worker remains the business authorization and persistence authority.
4. Use authorized synthetic staging identities/data for app-specific positive and negative reads/writes, role/tenant denial, idempotency/conflict/reconciliation, refresh/audit, and media cases where applicable. No new staging tenant by default; no real clinic data.
5. Publish the newly identified, signed package only to Cloudflare staging, install it through the OS Store, open it in the managed runtime, and verify the running package/version/hash and app behavior. Preserve existing preview releases and installed state.
6. Record failures, fixes, and exact results in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). A mocked or in-memory Worker result is never labeled live staging acceptance.

## M17 and later gates

G17 is the app-by-app implementation and staging-delivery gate. It requires evidence for all eleven app packages and their submilestones. G17 does not claim production readiness, physical-device acceptance, or closure of G14/G15/G20/G21. The original G14 functional-app gate remains open until the M17 app evidence is revalidated on the verified integrated M15/G15 baseline. M15 remains scheduled for closeout after the M17 app work, as directed; any app behavior relying on an unverified M15 capability must be marked provisional and rechecked during that closeout.

## Exit criteria

- [ ] All eleven app submilestones have app-owned source, exact per-app source pins, reviewed SDK operations/roles, and app-specific evidence.
- [ ] M17.1 retains its already accepted app ID/version/signature. Each other release uses its new unique app ID, starts at 1.0.0, uses the new pinned M17 signer, and has an immutable package hash.
- [ ] Each signed staging package is published through the existing Cloudflare staging Store and installed/opened through Dental OS.
- [ ] Required app workflow, authorization, tenant isolation, conflict/unknown outcome, session, dirty-form, and relevant media checks pass with synthetic data.
- [ ] No app implements platform networking/auth/media transport, a local authoritative business database, or a hidden offline write queue.
- [ ] M17 status and evidence accurately separate M17/G17, later G14/M15/G15 integrated acceptance, and M20/G20/G21.
- [ ] No production publication, promotion, or production acceptance is claimed.
