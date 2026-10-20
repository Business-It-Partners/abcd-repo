# M13 Plan — First-party app shells

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** reuses the verified package/runtime/store path from M06–M11. M12.6/G12 remains open; by explicit user direction, M13.2–M13.10 proceeded as three sequential parallel batches of three, followed by M13.11 in its own worktree chat. This is a scoped sequencing exception, not G12 closure.
**Requirements:** R02, R03, R05, R08, R12, R15.
**Exit gate:** G13.
**Architecture:** [app runtime](../../dental-os_v1-documentation/07_V1_APP_RUNTIME_AND_ISOLATION.md), [package and registry](../../dental-os_v1-documentation/08_V1_APP_PACKAGE_AND_LOCAL_REGISTRY.md), [Store and Cloudflare delivery](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [package format](../../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md).

## Overview

Create and release one minimal first-party Dental OS package per main dental app. Each app opens in its managed OS window with the selected app or submodule name centered. Multi-module packages carry their approved module labels and reuse the M12.3 explorer. The page is a clearly marked staging preview; it contains no full workflows or business API calls. Publish each package as version 1.0.0 through the existing staging Store and signing pipeline. This milestone does not build new signing infrastructure or change the Cloudflare backend.

Dental OS owns package assembly, identity, versioning, staging publication and installation. Dental SaaS is consulted as the reference for current app names, routes and submodule inventory.

## App submilestones

| Submilestone | App package | Placeholder labels | Status |
| --- | --- | --- | --- |
| M13.1 — Follow-ups | `company.dental.followups` | Follow-ups | User reports installing and running it in Dental OS; current automatic health receipt still needs confirmation for G13. |
| M13.2 — Appointments | `company.dental.appointments` | Appointments | COMPLETE — user reported staging install and successful app-window use on 2026-10-20 |
| M13.3 — Work Entry | `company.dental.work-entry` | Work Entry | COMPLETE — user reported staging install and successful app-window use on 2026-10-20 |
| M13.4 — Patient Record | `company.dental.patient-record` | Patient Record | COMPLETE — user reported staging install and successful app-window use on 2026-10-20 |
| M13.5 — Treatment Progress | `company.dental.treatment-progress` | Treatment Progress | Released at staging sequence 18; the user reports installing and running it in Dental OS. |
| M13.6 — Lab Tracker | `company.dental.lab-tracker` | Lab Tracker; Lab supplier record | 1.0.0 released at sequence 18; 1.0.1 shared-window update at sequence 21; user reports app use, while the update and module-switch review remain unconfirmed. |
| M13.7 — Finance | `company.dental.finance` | Transaction Record; Patient payments; General expenses; Salary payments; Product list; Purchases; Supplier list; Supplier payments | 1.0.0 released at sequence 18; 1.0.1 shared-window update at sequence 21; user reports app use, while the update and module-switch review remain unconfirmed. |
| M13.8 — Patient Payments | `company.dental.patient-payments` | Patient payments | Released at staging sequence 19; Reception-only app policy; the user reports installing and running it in Dental OS. |
| M13.9 — Staff | `company.dental.staff` | Staff | Released at staging sequence 19; the user reports installing and running it in Dental OS. |
| M13.10 — Treatment Protocols | `company.dental.treatment-protocols` | Treatment Protocols | Released at staging sequence 19; the user reports installing and running it in Dental OS. |
| M13.11 — Calendar | `company.dental.calendar` | Calendar | Released at staging sequence 20; the user reports installing and running it in Dental OS. |

This inventory is the observed first-party app set at the scope date; future changes require updating the app catalog and this table together.

## Shared release boundaries

- Every package is a verified company package with app identity, reused approved main-app artwork, and module labels where applicable. Until separately designed module artwork is needed, each module tile uses its package's existing main-app artwork.
- App content is limited to the selected name centered in the managed window and a clear preview indicator. Multi-module apps also include a small in-window toolbar for the active module label and More Apps control; module changes use the existing `dentalApp.openAppExplorer()` and `dentalApp.onModuleSelected()` contract.
- All multi-module apps use one content-window contract: the app name stays in the shared OS titlebar; the active module label and four-dot **More Apps** button sit together at the leading side of one in-app toolbar; the staging-preview badge sits at its trailing side; and the selected module label remains centered below. Choosing a module updates that same app window rather than opening a window per sub-app. Single-module apps keep their existing consistent window shell and do not show a module explorer.
- Use the existing staging publisher, signature policy, catalogue, Store and runtime. Signature verification remains mandatory; no new signer feature is in scope.
- Do not implement clinical screens, forms, business API calls, patient data, local business storage or production publication in M13.
- Install/open/close behavior must use the shared Dental OS lifecycle and existing app permission boundaries.

## Completion evidence

- Each app's initial version 1.0.0 signed package is present in the staging catalogue; versioned staging patches may correct shell consistency without adding M14 functionality.
- Multi-module app choices use the M12.3 explorer and show the selected module label; role/capability visibility comes from trusted metadata and OS policy.
- Staging package/hash/catalogue evidence and an install/open check are retained per completed submilestone. Production is unchanged.
- G13 is closed only after M13.1–M13.11 are complete and their documented checks pass.

## Sequencing

M12.6/G12 remains open. M13.1 records the Follow-ups staging publication/install; the user now reports running all eleven app shells in Dental OS. M13.2–M13.4 proceeded in three separate worktree chats while G12 remained open; their version 1.0.0 packages were published at sequence 17 and the user reports installing and successfully opening all three. M13.5–M13.7 were implemented in the next three worktree chats and published together at sequence 18. M13.8–M13.10 were implemented in three worktree chats and published at sequence 19, and M13.11 was implemented in its own worktree and published at sequence 20. These releases preserve prior catalogue and policy entries. Finance and Lab Tracker 1.0.1 Store updates and module-switch review remain unconfirmed; the Follow-ups automatic launch-health receipt has not been independently re-read. M14 starts only after the full M13 shell set is complete.
