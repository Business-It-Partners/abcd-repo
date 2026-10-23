# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — Treatment Protocols is published under `company.dental.m17.treatment-protocols` / 1.0.0 and verified in staging sequence 29. Store installation and runtime health remain open; other app acceptance remains tracked by submilestone. G17 remains open.
**Updated:** 2026-10-23.
**Execution home:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os, branch codex/milestone-15. This is the existing M15 worktree; no separate M17 worktree or branch is used.
**Exit gate:** G17.

M17 uses the app source already present in this worktree, the maintained Dental SaaS module for business behavior, and the current M15 SDK/shared UI for platform capabilities. Follow-ups and Appointments keep their existing M17 implementation code. The remaining nine apps are built fresh from the corresponding Dental SaaS module. M17 does not consume another Dental OS app branch or worktree as a source.

The Dental OS platform and SDK own session/identity mediation, transport/API brokerage, host authorization, media transfer, package verification, Store, and updates. Apps own the feature UI and workflows and call approved SDK capabilities. Dental SaaS remains the business authority.

Every app receives a new, unique M17 app ID and starts at version 1.0.0 under that ID. Each package declares one supported `clinic.app.*` family capability; the current M15 host applies that family's existing route, session, role and media checks without an ID-specific code entry. Existing preview releases and the earlier Follow-ups staging release remain unchanged and are not M17 release identities. The new suite Ed25519 key is pinned in source staging trust as `company-staging-m17-20261022` (SHA-256 fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`) and is now used by the signed staging feed and M17.10 package. The private key stays protected outside the checkout. This app task did not verify Store installation in the user's running OS. Do not search for or reuse older milestone keys. Authorized clinic credentials remain a separate requirement for live synthetic staging acceptance. Publication is staging-only; GitHub Actions and production are excluded from this M17 plan.

M17 can proceed against the current M15 SDK/platform contract while M15 closeout continues. This does not close M15/G15. Platform-dependent evidence remains provisional where the M15 gate is still open and must be repeated on the final verified source.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | IMPLEMENTING — signed M17 package and API grant verified in staging feed; install/runtime evidence tracked separately | `company.dental.followups.m17` / 1.0.0; previous package remains historical under its old identity |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED — queued after Follow-ups and Appointments | New M17 ID TBD; SaaS source pin pending; fresh implementation |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | IMPLEMENTING — current signed package and API grant verified in staging feed; install/runtime evidence tracked separately | `company.dental.appointments.m17` / 1.0.0 first package, 1.0.1 current |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | PLANNED — signed feed package observed; local source and runtime acceptance not reconciled here | `company.dental.treatment-progress.m17` / 1.0.0 |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | STAGING PUBLISHED — local checks and sequence 29 public package/feed verification pass; Store installation/runtime health remain open | `company.dental.m17.treatment-protocols` / 1.0.0; SaaS `f0d059d` |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | PLANNED — signed feed package observed; local source and runtime acceptance not reconciled here | `company.dental.calendar.m17` / 1.0.0 |

The earlier Follow-ups 1.1.0 staging acceptance is retained as evidence for that prior package identity and workflow. It does not complete the new M17 release identity. The Appointments 1.1.0 checkpoint is local/private and was not a staging release. G17 requires all eleven new M17 IDs and their app-specific evidence. See the [implementation notes](IMPLEMENTATION_NOTES.md) and [verification ledger](VERIFICATION_EVIDENCE.md).
