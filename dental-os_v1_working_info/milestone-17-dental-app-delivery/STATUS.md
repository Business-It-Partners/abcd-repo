# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — Follow-ups and Appointments are existing M17 code checkpoints. Their recorded local workflow checks are retained, but both require a new unique M17 ID, a 1.0.0 package, and staging acceptance under the new suite signer. Patient Record follows these two checkpoints. The other nine apps are fresh builds against Dental SaaS. G17 remains open.
**Updated:** 2026-10-22.
**Execution home:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os, branch codex/milestone-15. This is the existing M15 worktree; no separate M17 worktree or branch is used.
**Exit gate:** G17.

M17 uses the app source already present in this worktree, the maintained Dental SaaS module for business behavior, and the current M15 SDK/shared UI for platform capabilities. Follow-ups and Appointments keep their existing M17 implementation code. The remaining nine apps are built fresh from the corresponding Dental SaaS module. M17 does not consume another Dental OS app branch or worktree as a source.

The Dental OS platform and SDK own session/identity mediation, transport/API brokerage, host authorization, media transfer, package verification, Store, and updates. Apps own the feature UI and workflows and call approved SDK capabilities. Dental SaaS remains the business authority.

Every app receives a new, unique M17 app ID and starts at version 1.0.0 under that ID. Each package declares one supported `clinic.app.*` family capability; the current M15 host applies that family's existing route, session, role and media checks without an ID-specific code entry. Existing preview releases and the earlier Follow-ups staging release remain unchanged and are not M17 release identities. The new suite Ed25519 key has been created and its public key is pinned in source staging trust as `company-staging-m17-20261022` (SHA-256 fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`). No M17 package or Store metadata has been signed with it, and this trust update has not been deployed. The private key stays protected outside the checkout. Do not search for or reuse older milestone keys. Authorized clinic credentials remain a separate requirement for live synthetic staging acceptance. Publication is staging-only; GitHub Actions and production are excluded from this M17 plan.

M17 can proceed against the current M15 SDK/platform contract while M15 closeout continues. This does not close M15/G15. Platform-dependent evidence remains provisional where the M15 gate is still open and must be repeated on the final verified source.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | IMPLEMENTING — existing M17 code and prior local/staging checks retained; new M17 identity and release remain open | New M17 ID TBD; first version 1.0.0; previous package remains historical under its old identity |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED — queued after Follow-ups and Appointments | New M17 ID TBD; SaaS source pin pending; fresh implementation |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | IMPLEMENTING — current M17 source and 20-check private Linux workflow pass; new M17 release remains open | New M17 ID TBD; first version 1.0.0; no package signed/published or Store-installed under the new identity |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |

The earlier Follow-ups 1.1.0 staging acceptance is retained as evidence for that prior package identity and workflow. It does not complete the new M17 release identity. The Appointments 1.1.0 checkpoint is local/private and was not a staging release. G17 requires all eleven new M17 IDs and their app-specific evidence. See the [implementation notes](IMPLEMENTATION_NOTES.md) and [verification ledger](VERIFICATION_EVIDENCE.md).
