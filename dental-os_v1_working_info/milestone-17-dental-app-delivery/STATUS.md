# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — Follow-ups 1.0.0 is published at staging sequence 24; Appointments 1.0.1 is current at sequence 26 after its 1.0.0 first release at sequence 25. At the user's direction, Calendar was started out of order, built from the pinned SaaS module, and published as company.dental.calendar.m17 1.0.0 at sequence 28. Public package/signature/grant checks and authenticated Store installation, managed-renderer open, and exact-payload health passed in a private disposable Linux profile for all three current M17 apps. Calendar's 16 private synthetic workflow checks, package typecheck/tests/build, root build, and 463 root tests passed. App startup made staging reads only; no business writes occurred. Full live role/tenant/workflow acceptance, deployment of the M17 trust pin to the user's running desktop, and G17 remain open.
**Updated:** 2026-10-23.
**Execution home:** This Follow-ups/Appointments/Calendar M17 worktree: /home/master-x/.codex/worktrees/m17-followups-appointments/fewa_business_os, branch codex/m17-followups-appointments, based on 2fc30a849677e889ef248d40595aad233c260ba5. The current M15 worktree was inspected read-only; its changes were preserved.
**Exit gate:** G17.

M17 uses the app source already present in this worktree, the maintained Dental SaaS module for business behavior, and the current M15 SDK/shared UI for platform capabilities. Follow-ups and Appointments keep their existing M17 implementation code. The other nine M17 apps are fresh implementations from the corresponding Dental SaaS module; Calendar is now delivered and eight remain unstarted. M17 does not consume another Dental OS app branch or worktree as a source.

The Dental OS platform and SDK own session/identity mediation, transport/API brokerage, host authorization, media transfer, package verification, Store, and updates. Apps own the feature UI and workflows and call approved SDK capabilities. Dental SaaS remains the business authority.

Every app receives a new, unique M17 app ID and starts at version 1.0.0 under that ID. Follow-ups is company.dental.followups.m17; Appointments is company.dental.appointments.m17; Calendar is company.dental.calendar.m17. Their former IDs and package artifacts remain historical and unchanged. The M17 Ed25519 suite key is pinned in this checkout as company-staging-m17-20261022 with public-key SHA-256 fingerprint e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709. It signed all new M17 packages and the sequence-24/25/26/28 metadata; prior signed metadata was verified with the signer recorded in each envelope. Public verification passed. Authenticated Store installs and renderer launches verified the three current releases and exact-payload health in a private disposable profile; initial staging reads occurred, with no business writes. Temporary credentials and profiles were removed. The trust pin has not been deployed with an update to the user's running desktop, and full role/tenant/workflow acceptance remains open. GitHub Actions and production are excluded from the M17 plan.

M17 can proceed against the current M15 SDK/platform contract while M15 closeout continues. This does not close M15/G15. Platform-dependent evidence remains provisional where the M15 gate is still open and must be repeated on the final verified source.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | IMPLEMENTING — seq 24 published; public verification, Store install/open, and exact-payload runtime health passed in private Linux profile; full live workflow acceptance pending | company.dental.followups.m17 / 1.0.0; SHA-256 48e0bc95de7003abe701fc6b6be5c87ab4643dbb7a1caed98c6858a03e44f197 |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED — original next submilestone; not started | New M17 ID TBD; SaaS source pin pending; fresh implementation |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | IMPLEMENTING — 1.0.1 UI parity update published at seq 26; public verification, Store install/open, and exact-payload runtime health passed in private Linux profile; full live workflow acceptance pending | company.dental.appointments.m17 / 1.0.1; SHA-256 433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03 (1.0.0 seq 25 retained historically) |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | IMPLEMENTING out of order at user direction — sequence 28 published; public package checks, authenticated Store install/open, exact-payload health, and 16/16 private synthetic workflow checks passed; full live workflow acceptance pending | company.dental.calendar.m17 / 1.0.0; SHA-256 0d45934d0ae43d0b79b3f1a60d188a865b3da0f509756d6a4a1642eed57d929d |

The earlier Follow-ups 1.1.0 staging acceptance is retained as evidence for that prior package identity and workflow. It does not complete the new M17 release identity. The Appointments 1.1.0 checkpoint is local/private and was not a staging release. G17 requires all eleven new M17 IDs and their app-specific evidence. New-ID publication and Store-service evidence is recorded in the [verification ledger](VERIFICATION_EVIDENCE.md), including the [Calendar staging release](evidence/M17_CALENDAR_STAGING_RELEASE_2026-10-23.json). See also the [implementation notes](IMPLEMENTATION_NOTES.md).
