# Appointments M17 package verification

Initial M17 package: `company.dental.appointments.m17` 1.0.1, published to Cloudflare staging at sequence 26. Current package: 1.0.8 at sequence 91.

The 1.0.1 UI update aligns the managed app with the Dental SaaS Appointments module's day-book layout: title/date header, four summary cards, day navigation and doctor filter, and the same appointment status columns and actions. It reuses the retained SDK-backed diary behavior. The earlier 1.0.0 M17 package at sequence 25 remains a historical release with its original bytes and grant. The prior preview package at `company.dental.appointments` 1.1.0 is unchanged. The app keeps the SaaS standalone-diary contract: it captures an appointment name and optional phone without creating or linking a Patient Record.

Package typecheck, four contract tests, bundle build, 21/21 private Linux workflow checks, root build, and 458 root unit tests passed. Public staging verification confirmed the current package signature, digest, ID/version, signer, metadata sequence, and package-bound grant. The authenticated Store UI installed and opened 1.0.1 in a private disposable Linux profile; runtime health matched the exact published payload. Startup performed initial staging reads and no business writes. The running desktop was not redeployed with the M17 trust pin. Full live role/tenant/workflow acceptance remains open; the pinned SaaS controller's role-capability limitation is documented in the M17.3 plan.

See the [M17 verification ledger](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md) and [1.0.1 release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_UI_PARITY_1_0_1_2026-10-23.json).

## Historical table update — 2026-10-24

Appointments 1.0.6 removes the separate Phone and No-show table columns, styles both row actions blue, and matches Follow-ups row-label typography. The existing summary-card placement and appointment status model are unchanged. Typecheck, five package tests, app build, root build, 528 root unit tests, and 25 private UI checks passed. The signed sequence-88 public readback verified the exact package bytes/hash, signer, API grant, and isolated registry install/launch/health/uninstall. See the [release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_1.0.6_STAGING_2026-10-24.json). Authenticated Store install and live clinic acceptance remain open; the running OS was not restarted.

## Latest update — Appointments 1.0.7 — 2026-10-24

The four summary cards now fill the content width in four equal columns. The 1.0.6 table changes remain: Phone and No-show columns are absent, both row actions are blue, and row labels use the Follow-ups system font at 14px. Appointments 1.0.7 was published to Cloudflare staging at sequence 90. Typecheck, five package tests, app build, integrated root build, 528 root unit tests, and 26 private UI checks passed. Public readback verified the signed package, exact API grant and artwork; the final sequence-90 verifier also completed isolated registry install/launch/health/uninstall. The grant policy retains versions 1.0.1–1.0.7 and retires the 1.0.0 grant to remain within the seven-release ceiling. See [release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_1.0.7_STAGING_2026-10-24.json), [private report](../../../artifacts/m17-appointments-private-2026-10-24T06-02-35.268Z.json), and [screenshot](../../../artifacts/m17-appointments-private-2026-10-24T06-02-35.268Z.png).

Authenticated Store installation and live clinic acceptance remain open. The running OS was not restarted; refresh the staging Store and fully relaunch Appointments to load 1.0.7. Production was not changed.

## Latest update — Appointments 1.0.8 — 2026-10-24

The table now assigns 9.5% to Time, 19% to Patient, 20% each to Reason and Doctor, 6.5% each to Arrived and Cancel, and 18.5% to Action. Fixed layout keeps these widths independent of long text; Time stays on one line, and the row actions wrap inside their cell without table overflow. All prior full-width summary-card and table presentation changes remain.

Appointments 1.0.8 was published to the Cloudflare staging Store at sequence 91. App typecheck, five package tests, app build, root build, 528 root unit tests, and 28 private UI checks passed. Public verification passed 36 checks, including exact current package signatures/grants and isolated registry install/launch/health/uninstall for all ten M17 apps. The seven active Appointments grants are 1.0.2–1.0.8; 1.0.1 was retired. See the [1.0.8 release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_1.0.8_STAGING_2026-10-24.json).

The package is available in staging only. No production promotion, authenticated Store-profile install, live clinic workflow, or OS restart occurred. Refresh the staging Store and fully relaunch Appointments to load 1.0.8.

## Local Development Apps UI parity — 2026-10-25

The current M15-based Development Apps source now matches the installed 1.0.8 UI: four equal full-width summary cards, a sortable Doctor column, fixed table proportions, and no Phone or No-show columns. The unsigned local snapshot is version 1.0.8, build `b514b94ef8bbbb931db2514f2d5fc708872b734ec770b34ef813ebe432a48836`. The previous local snapshot 1.0.5 remains available. The local build uses the current M15 navigation bridge, so its JavaScript contains newer draft-preserving navigation code than the signed 1.0.8 bundle.

App typecheck, five package tests, app build, root build, all 511 root tests, and 27 private UI checks passed. The published snapshot files match the worktree's built output. No signed Store package or running OS process was changed. Reopen the Development Appointments window to load the new snapshot. See the [local snapshot evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_LOCAL_DEVELOPMENT_2026-10-25.json) and [private UI report](../../../artifacts/m17-appointments-private-2026-10-25T07-15-20.213Z.json).
