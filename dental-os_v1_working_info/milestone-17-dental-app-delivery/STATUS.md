# M17 Status — First-party Dental App Delivery

**Status:** IMPLEMENTING — M17.1 Follow-ups remains complete for its recorded Linux staging scope. M17.3 Appointments source and local Linux checks pass, but its existing preview identity was not released with this implementation. Before a staging release it needs a new app ID, the new M17 staging signer, and authorized protected clinic credentials. M17.2 is queued after M17.3. New implementations for unstarted apps will be built from scratch against the Dental SaaS UI/API reference. G17 remains open.
**Updated:** 2026-10-22.
**Execution home:** /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os, branch codex/milestone-15. This is the existing M15 worktree; no separate worktree or M17 branch was created.
**Exit gate:** G17.

M17 is the active app-delivery plan directed by the user. M14 remains preserved as historical source/evidence only; new app implementations do not import M14 code. They are built from scratch against the relevant maintained Dental SaaS UI, workflow, and API behavior, using the current M15 shared UI and SDK.

The Dental OS platform and SDK own session/identity mediation, network transport, API broker, host authorization, media transfer, verified package lifecycle, Store, and updates. App code brings the Dental SaaS module's UI/UX and business workflows and calls only approved SDK capabilities. Dental SaaS remains the business authority, including stored-file status and retention.

M17 is scoped to new unique app IDs, signed packages in the existing Cloudflare staging catalogue, and installation through the Dental OS Store. Existing preview IDs/releases remain immutable; M17.1's accepted identity and signing evidence are preserved. Each not-yet-released app starts at 1.0.0 under its new ID. One new M17 staging signing key is planned for the suite; its public identity must be pinned before package signing and its private key kept in a protected Git-ignored local `signing/` area until moved to the user's vault. Authorized clinic credentials remain a separate requirement. No production publication or GitHub Actions run is planned.

M17 can proceed before M15 closeout using the pinned current platform contract and explicit provisional notes. This does not mark M15/G15 complete. Final G14 integrated app acceptance remains after verified M15/G15. The M15 media exit is still incomplete and must retain its own status.

## Submilestone status

| Submilestone | App | Status | Evidence |
| --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Follow-ups | COMPLETE | Signed 1.1.0 published at staging sequence 23; Store install, real module launch, and matching health receipt passed in a private Linux profile |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | Patient Record | PLANNED — queued after M17.3; fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Appointments | IMPLEMENTING | Current SDK-backed local implementation and 20-check private Linux workflow pass; staging release requires new ID/signer and protected clinic credentials; no package signed/published or Store install performed |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | Work Entry | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Treatment Progress | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Lab Tracker | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | Finance | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Patient Payments | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Staff | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Treatment Protocols | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Calendar | PLANNED — fresh build | New app ID TBD; SaaS reference/source pin pending |

M17.1 is accepted for its recorded Linux/private-profile staging scope under its historical app ID and signer. M17.3 remains the active local implementation; its passing checks do not include a new-identity release. M17.2 is queued next and will be built from scratch using the SaaS UI/API reference. The other eight apps remain planned for fresh implementation. G17 requires evidence for every app; neither M17.1 nor the M17.3 local build closes G17, M15/G15, G14, M20/G20, or G21. See the per-app [verification ledger](VERIFICATION_EVIDENCE.md), [Follow-ups acceptance record](M17.1_FOLLOWUPS_PLAN.md), and [Appointments plan](M17.3_APPOINTMENTS_PLAN.md).
