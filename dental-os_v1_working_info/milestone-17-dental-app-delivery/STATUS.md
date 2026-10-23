# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — Follow-ups `company.dental.followups.m17` 1.0.0 was published at sequence 24. Appointments 1.0.0 was published at sequence 25 and its current staging entry is 1.0.1 at sequence 26. Treatment Progress `company.dental.treatment-progress.m17` 1.0.0 was published at sequence 27; the public catalogue, update policy, package bytes, signer, and API grant verify. Its Store install and live clinic workflow were not run. The updated M17 trust pin and 64-app platform limit are not yet deployed in the running desktop. Eight apps remain unstarted; G17 remains open.
**Updated:** 2026-10-23.
**Execution model:** M17 app tasks use isolated managed worktrees based on the documented baseline `2fc30a849677e889ef248d40595aad233c260ba5`. Follow-ups/Appointments package work is on `codex/m17-followups-appointments`; the completed Treatment Progress task is on `codex/m17-treatment-progress`. Their source checkouts remain isolated.
**Exit gate:** G17.

M17 uses the retained Follow-ups and Appointments implementation checkpoints and fresh implementations of the remaining apps against maintained Dental SaaS modules. Managed task worktrees may be used to isolate app work; each starts from an explicitly documented M17 baseline. M17 does not use M14 history or unrelated Dental OS milestone code as an app source. The current Treatment Progress implementation and its SaaS pin are recorded in M17.5. The separate Follow-ups/Appointments task worktree is `/home/master-x/.codex/worktrees/m17-followups-appointments/fewa_business_os`; its code and checkout remain isolated from this worktree.

The Dental OS platform and SDK own session/identity mediation, transport/API brokerage, host authorization, media transfer, package verification, Store, and updates. Apps own the feature UI and workflows and call approved SDK capabilities. Dental SaaS remains the business authority.

Every app receives a new, unique M17 app ID and starts at version 1.0.0 under that ID. Existing preview releases and the earlier Follow-ups staging release remain unchanged and are not M17 release identities. The new suite public signing identity `company-staging-m17-20261022` is pinned in the staging verifier; its public-key fingerprint is `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`. It signed the M17 Follow-ups, Appointments, and Treatment Progress packages. Do not search for or reuse older milestone keys, and never place private key material in Git. Authorized clinic credentials remain a separate requirement for full live synthetic staging acceptance. Publication is staging-only; GitHub Actions and production are excluded from this M17 plan.

M17 can proceed against the current M15 SDK/platform contract while M15 closeout continues. This does not close M15/G15. Platform-dependent evidence remains provisional where the M15 gate is still open and must be repeated on the final verified source.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | IMPLEMENTING — sequence 24 published; public verification and private Store install/open with exact-payload health passed; full live workflow acceptance pending | `company.dental.followups.m17` / `1.0.0`; SHA-256 `48e0bc95de7003abe701fc6b6be5c87ab4643dbb7a1caed98c6858a03e44f197` |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED — next app selection remains pending; Treatment Progress has been published | New M17 ID TBD; SaaS source pin pending; fresh implementation |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | IMPLEMENTING — first release 1.0.0 published at sequence 25; current feed entry 1.0.1 published at sequence 26; prior 1.0.0 install/open health passed; full live workflow acceptance pending | Current `company.dental.appointments.m17` SHA-256 `433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03` |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | IMPLEMENTED and staging-published at sequence 27; public metadata/package verification passed; Store install and live clinic acceptance not run | `company.dental.treatment-progress.m17` / `1.0.0`; SHA-256 `d6a0376d71ff6c709f84b936909ab76740331283b6b0f768a59aa14991994f61`; SaaS pin `f0d059d36540b4b6907cace089085ce0df62d454` |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | PLANNED — fresh build | New M17 ID TBD; SaaS source pin pending |

The earlier Follow-ups 1.1.0 staging acceptance remains evidence for that prior package identity and is not relabeled as M17. The Appointments 1.1.0 checkpoint was local/private; it is distinct from its new M17 release. Follow-ups/Appointments release evidence was produced in the separate task worktree named above and inspected read-only here. G17 requires all eleven new M17 IDs and their app-specific evidence. See the [implementation notes](IMPLEMENTATION_NOTES.md) and [verification ledger](VERIFICATION_EVIDENCE.md).
