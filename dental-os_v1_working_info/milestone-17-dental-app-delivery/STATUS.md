# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — M17.1 Follow-ups completed on the current Linux staging path; M17.2–M17.11 remain PLANNED and G17 remains open.
**Updated:** 2026-10-22.
**Execution home:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os, branch codex/milestone-15. This is the existing M15 worktree; no separate worktree or M17 branch was created.
**Exit gate:** G17.

M17 is the active app-delivery plan directed by the user. M14 remains preserved as source code and historical evidence. M17 imports reviewed app-owned changes per app; it does not merge the M14 branch wholesale and does not bring M14 platform/media implementation over the current M15 platform.

The Dental OS platform and SDK own session/identity mediation, network transport, API broker, host authorization, media transfer, verified package lifecycle, Store, and updates. App code brings the Dental SaaS module's UI/UX and business workflows and calls only approved SDK capabilities. Dental SaaS remains the business authority, including stored-file status and retention.

M17 is scoped to incremented, signed packages in the existing Cloudflare staging catalogue and installation through the Dental OS Store. No production publication is planned. The existing 1.0.0 app shells are immutable; the planned first substantial functional release is 1.1.0 when the current catalogue is at 1.0.0/1.0.1, with exact catalogue state checked per app before release.

M17 can proceed before M15 closeout using the pinned current platform contract and explicit provisional notes. This does not mark M15/G15 complete. Final G14 integrated app acceptance remains after verified M15/G15. The M15 media exit is still incomplete and must retain its own status.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | COMPLETE | Signed 1.1.0 published at staging sequence 23; Store install, real module launch, and matching health receipt passed in a private Linux profile |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED | M14 synthetic evidence is source input only |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | PLANNED | M14 source/evidence review pending |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED | M14 source/evidence review pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | PLANNED | M14 source/evidence review pending |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED | M14 source/evidence review pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED | M14 source/evidence review pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED | M14 source/evidence review pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED | M14 source/evidence review pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | PLANNED | M14 source/evidence review pending |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | PLANNED | M14 source/evidence review pending |

M17.1 is accepted for its recorded Linux/private-profile staging scope. The other ten app submilestones have not started. G17 requires evidence for every app; M17.1 does not close G17, M15/G15, G14, M20/G20, or G21. See the per-app [verification ledger](VERIFICATION_EVIDENCE.md) and [Follow-ups acceptance record](M17.1_FOLLOWUPS_PLAN.md).
