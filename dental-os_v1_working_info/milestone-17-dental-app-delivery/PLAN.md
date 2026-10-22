# M17 Plan — First-party Dental App Delivery

**Status:** IMPLEMENTING — M17.1 Follow-ups is complete for its recorded Linux staging scope; M17.2–M17.11 remain PLANNED and G17 remains open.
**Updated:** 2026-10-22.
**Execution home:** existing M15 worktree on branch codex/milestone-15, as directed by the user. No separate M17 worktree or branch is created.
**Requirements:** R02–R12 and R15, as mapped to G14/G17.
**Exit gate:** G17 for app-by-app staging delivery. G14 remains the final integrated functional-app gate and depends on verified M15/G15.
**Architecture:** [SDK and API Broker](../../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md), [Store and Cloudflare Distribution](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [Install, Update and Uninstall](../../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md), [package format](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md).

## Purpose

Reuse the app UI, workflows, and test work already completed on M14; adapt and finish each first-party app against the Dental OS platform and SDK; publish signed, incremented app packages to the existing Cloudflare staging Store; and install each package through the Dental OS Store. Work proceeds one app at a time, beginning with Follow-ups.

M17 app code does not implement capabilities that belong to Dental OS. The platform owns the isolated runtime, identity/session mediation, networking and API broker, host-enforced permissions, private media transfer, package verification, Store, and update lifecycle. Each app uses the supported SDK to call those capabilities. The app owns its clinical/business UI and maps its user actions to approved SaaS API operations. Dental SaaS remains the business authority.

## Coordination and source inputs

- M17 work stays in the current M15 worktree and branch. M15 remains IMPLEMENTING; this sequencing does not close, waive, or rewrite G15.
- M14 is preserved as source and evidence, not used as the M17 parent branch or accepted wholesale. Review and import app-owned files per app. Do not copy M14 Electron, preload, SDK enforcement, or media-host implementation over the current M15 platform.
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

Complete the app submilestones sequentially. Do not mark later apps complete from shared-package smoke tests or another app's evidence.

## Versioning and staging release

The existing app identities already have staging shell releases at 1.0.0; Finance and Lab Tracker also have recorded 1.0.1 updates. M17 must never replace bytes under an already-used version. Use 1.1.0 as the planned first substantial functional release for an app whose current staging catalogue version is 1.0.0 or 1.0.1. Before packaging each app, read its exact current catalogue/version state and choose the next monotonic SemVer if a higher version already exists. Record the selected version and package hash; later patches/features increment normally.

For each app: validate the source and package; prepare it with the existing protected first-party staging signer; bind package digest, capabilities, and any API operations to the approved signed staging metadata; publish through the existing staging catalogue/bucket path with a higher catalogue sequence; then install and open it through the Dental OS Store. Record the exact source, signing key identity (never key material), package hash/version, catalogue sequence, Store result, profile/tenant, and app acceptance results.

Publication is staging-only. No production bucket, production API, production migration, or production grant is in scope. A missing protected staging identity, publisher, or signer blocks that app's staging release; do not create a replacement key or use chat credentials. The staging package object may be publicly readable, so it must contain app code only, never credentials or clinic data.

## Shared app acceptance sequence

1. Review the M14 app source and corresponding current SaaS behavior; log import dispositions and exact source pins.
2. Complete the app's UI and typed SDK adapter. Test loading, empty, success, error, authorization denial, conflict, unknown outcome, session change, form dirty state, keyboard/focus, and supported window/module behavior as applicable.
3. Prove that app requests pass through the SDK/broker, that undeclared operations fail before credentials/network, and that the SaaS Worker remains the business authorization and persistence authority.
4. Use authorized synthetic staging identities/data for app-specific positive and negative reads/writes, role/tenant denial, idempotency/conflict/reconciliation, refresh/audit, and media cases where applicable. No new staging tenant by default; no real clinic data.
5. Publish the incremented signed package only to Cloudflare staging, install it through the OS Store, open it in the managed runtime, and verify the running package/version/hash and app behavior. Preserve the existing installed app state and other app versions.
6. Record failures, fixes, and exact results in [IMPLEMENTATION_NOTES.md](IMPLEMENTATION_NOTES.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). A mocked or in-memory Worker result is never labeled live staging acceptance.

## M17 and later gates

G17 is the app-by-app implementation and staging-delivery gate. It requires evidence for all eleven app packages and their submilestones. G17 does not claim production readiness, physical-device acceptance, or closure of G14/G15/G20/G21. The original G14 functional-app gate remains open until the M17 app evidence is revalidated on the verified integrated M15/G15 baseline. M15 remains scheduled for closeout after the M17 app work, as directed; any app behavior relying on an unverified M15 capability must be marked provisional and rechecked during that closeout.

## Exit criteria

- [ ] All eleven app submilestones have app-owned source, exact per-app source pins, reviewed SDK operations/roles, and app-specific evidence.
- [ ] Each package uses the existing app ID, an incremented version, the approved signing/catalogue path, and an immutable package hash.
- [ ] Each signed staging package is published through the existing Cloudflare staging Store and installed/opened through Dental OS.
- [ ] Required app workflow, authorization, tenant isolation, conflict/unknown outcome, session, dirty-form, and relevant media checks pass with synthetic data.
- [ ] No app implements platform networking/auth/media transport, a local authoritative business database, or a hidden offline write queue.
- [ ] M17 status and evidence accurately separate M17/G17, later G14/M15/G15 integrated acceptance, and M20/G20/G21.
- [ ] No production publication, promotion, or production acceptance is claimed.
