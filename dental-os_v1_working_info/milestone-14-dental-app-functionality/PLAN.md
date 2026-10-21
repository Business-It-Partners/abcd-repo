# M14 Overview — Functional Dental OS apps

**Local historical overview:** Current app order and detailed working plans are maintained on [the active M14 app branch](https://github.com/Business-It-Partners/dental-os/tree/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality). The older per-app table below is retained as history; use that branch for app execution. This checkout owns platform integration requirements.

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** parallel app implementation authorized; final integrated acceptance requires M13/G13 and M15/G15. See current app-track pointer in the amendment below.
**Exit gate:** G14.

## Purpose

Turn each M13 placeholder package into a working Dental OS app in its own app-level submilestone. Bring over the corresponding Dental SaaS module and submodule behavior as the product reference; implement the app UI and brokered API wiring inside the Dental OS app contract. Release each app's functional package as an app-only update to its M13 version 1.0.0 shell. Use existing Dental OS identity, capability, runtime, package signing, staging Store and update boundaries.

This document is intentionally an overview. Per-app implementation plans, detailed acceptance criteria and verification records will be added after all M13 app shells are complete, as directed by the user. No M14 functionality is claimed yet.

## App submilestone map

| Submilestone | App | Included modules at overview level |
| --- | --- | --- |
| M14.1 — Follow-ups | Follow-ups | Follow-ups workflow |
| M14.2 — Appointments | Appointments | Appointments |
| M14.3 — Work Entry | Work Entry | Work Entry |
| M14.4 — Patient Record | Patient Record | Patient Record |
| M14.5 — Treatment Progress | Treatment Progress | Treatment Progress |
| M14.6 — Lab Tracker | Lab Tracker | Lab Tracker; Lab supplier record |
| M14.7 — Finance | Finance | Transaction Record; Patient payments; General expenses; Salary payments; Product list; Purchases; Supplier list; Supplier payments |
| M14.8 — Patient Payments | Patient Payments | Reception patient payments |
| M14.9 — Staff | Staff | Staff |
| M14.10 — Treatment Protocols | Treatment Protocols | Treatment Protocols |
| M14.11 — Calendar | Calendar | Calendar |

## Shared boundary

Each detailed submilestone will define the actual UI/workflow, permitted API operations, roles/capabilities, app-only version update and staging acceptance. Business authority remains the existing SaaS Worker/API. Dental OS owns the app packages and their lifecycle; no direct database access, local authoritative business data, hidden offline write queue or production changes are introduced.

## M15 coordination amendment — 2026-10-21

The user adopted [M15 Platform Closeout and Integration](../milestone-15-platform-closeout-and-integration/PLAN.md) during P03. The [central checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) tracks remaining platform work; this amendment changes coordination/dependencies, not historical evidence or acceptance.
The active maintained app plan/checklist is on [the separate M14 branch](https://github.com/Business-It-Partners/dental-os/tree/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality). Its newer app order/plans supersede the older local overview above; do not reset that external work. App implementation proceeds in parallel. Final G14 integrated acceptance requires M13/G13 and M15/G15, with actual app evidence; a mock or shell CI pass is insufficient. This platform amendment is not an edit to the active app branch.
