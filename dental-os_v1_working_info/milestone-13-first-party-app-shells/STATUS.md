# M13 Status — First-party app shells

**Status:** IMPLEMENTING — All eleven version 1.0.0 shells are published. On 2026-10-20, the user reported installing and running all eleven in Dental OS. The Follow-ups launch-health receipt has not been independently re-read from the current profile; the retained install artifact is a pre-launch snapshot. Finance and Lab Tracker 1.0.1 Store updates and module-switch review remain unconfirmed. M12.6/G12 remains open by explicit user-approved sequencing exception.
**Updated:** 2026-10-20.
**Worktrees:** M13.2–M13.4, M13.5–M13.7 and M13.8–M13.10 used separate app worktree chats; M13.11 used its own worktree chat. The lead reviewed, integrated and staged each batch. Worktrees remain preserved.

## Submilestones

| Submilestone | Status | Evidence / remaining |
| --- | --- | --- |
| M13.1 Follow-ups | USER-REPORTED RUN — runtime receipt check pending | Version 1.0.0 is published at staging sequence 16. The user now reports installing and running it in Dental OS. The retained [install evidence](../../artifacts/followups-staging-install-verification.json) is a pre-launch snapshot; its automatic known-good health receipt has not been re-read from the current profile for G13 closeout. |
| M13.2 Appointments | COMPLETE — user-accepted staging release | Signed 1.0.0 package is live at staging sequence 17. On 2026-10-20, the user reported downloading/installing it with the other two apps and confirmed the app windows work as expected. |
| M13.3 Work Entry | COMPLETE — user-accepted staging release | Signed 1.0.0 package is live at staging sequence 17. On 2026-10-20, the user reported downloading/installing it with the other two apps and confirmed the app windows work as expected. |
| M13.4 Patient Record | COMPLETE — user-accepted staging release | Signed 1.0.0 package is live at staging sequence 17. On 2026-10-20, the user reported downloading/installing it with the other two apps and confirmed the app windows work as expected. |
| M13.5 Treatment Progress | RELEASED — install/run reported by user | Signed 1.0.0 package is live at staging sequence 18. On 2026-10-20, the user reported installing and running all eleven shells in Dental OS. |
| M13.6 Lab Tracker | RELEASED — 1.0.0 install/run reported; 1.0.1 review pending | Signed 1.0.0 package is live at sequence 18 and the shared-window 1.0.1 patch at sequence 21. The user reports installing and running the apps; installation of the 1.0.1 update and module-switch review were not explicitly confirmed. |
| M13.7 Finance | RELEASED — 1.0.0 install/run reported; 1.0.1 review pending | Signed 1.0.0 package is live at sequence 18 and the shared-window 1.0.1 patch at sequence 21. The user reports installing and running the apps; installation of the 1.0.1 update and module-switch review were not explicitly confirmed. |
| M13.8 Patient Payments | RELEASED — install/run reported by user | Signed Reception-only 1.0.0 package is live at staging sequence 19; local package checks pass 5/5. The user reports installing and running all eleven shells in Dental OS. |
| M13.9 Staff | RELEASED — install/run reported by user | Signed 1.0.0 package is live at staging sequence 19; local package checks pass 5/5. The user reports installing and running all eleven shells in Dental OS. |
| M13.10 Treatment Protocols | RELEASED — install/run reported by user | Signed 1.0.0 package is live at staging sequence 19; local package checks pass 5/5. The user reports installing and running all eleven shells in Dental OS. |
| M13.11 Calendar | RELEASED — install/run reported by user | Signed 1.0.0 package is live at staging sequence 20; local package checks pass 5/5. The user reports installing and running all eleven shells in Dental OS. |

## Current position

The user reports installing and running all eleven M13 app shells in Dental OS on 2026-10-20. This supersedes the earlier pending-install/open notes for the version 1.0.0 shells. Finance and Lab Tracker received the shared multi-module toolbar correction as signed version 1.0.1 updates at sequence 21. That contract uses one in-app toolbar with the active module and More Apps on the left, the staging badge on the right, and the selected module centered below; switching modules stays within the same managed app window. Installation of those two 1.0.1 updates and module-switch review were not explicitly confirmed. The Follow-ups install artifact records the earlier pre-launch state; its current automatic known-good receipt has not been independently re-read. Work remains in Dental OS; Dental SaaS supplies the reference app behavior and route inventory.

M12.6 and G12 remain open. The user authorized the remaining M13 work to proceed in batches while G12 remains open. The user's report now covers running Follow-ups in Dental OS; its saved install artifact predates that launch, so the current runtime health receipt still needs confirmation. M13 overall stays IMPLEMENTING until the remaining update/module review and G13 evidence are complete.

## M15 coordination amendment — 2026-10-21

The user adopted [M15 Platform Closeout and Integration](../milestone-15-platform-closeout-and-integration/PLAN.md) during P03. The [central checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) tracks remaining platform work; this amendment changes coordination/dependencies, not historical evidence or acceptance.
Remaining requirements under this milestone's original gate stay open until their evidence is complete; M15.4 coordinates their closeout. Previously implemented/verified scope is reused. M15 planning does not declare those residuals accepted.

## M15.1 source reconciliation update — 2026-10-21

The managed-app launch-feedback/frame-handoff slice from the original dirty checkout was reviewed and accepted into M15 checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. The preserved original M13 checkout itself was not modified. The new private fixture covers the eleven current shells plus a differently named future managed app; its successful report and failed diagnostic attempts are retained in M15 evidence. It proves shell launch behavior only. The live-profile Follow-ups health receipt and Finance/Lab Tracker 1.0.1 installation/module review remain unverified, so G13 stays open; M15 does not close M13.

## M15 technical evidence update — 2026-10-22

Read-only current-profile package/signature/assets and automatic known-good health receipts pass for all eleven installed apps, including Follow-ups 1.0.0 and Finance/Lab Tracker 1.0.1. This resolves the missing saved health/version inventory. Private M15 integrated lifecycle, focus, overview, scaling and identity checks pass within the linked M15 records. User visual/module interaction and physical/device acceptance remain separate; G12/G13 are not silently closed. See [live profile evidence](../milestone-15-platform-closeout-and-integration/evidence/P06_LIVE_PROFILE_RECEIPTS_2026-10-22.json). No live app/browser was controlled or restarted.
