# Appointments M17 package verification

Current package: `company.dental.appointments.m17` 1.0.1, published to Cloudflare staging at sequence 26.

The 1.0.1 UI update aligns the managed app with the Dental SaaS Appointments module's day-book layout: title/date header, four summary cards, day navigation and doctor filter, and the same appointment status columns and actions. It reuses the retained SDK-backed diary behavior. The earlier 1.0.0 M17 package at sequence 25 remains a historical release with its original bytes and grant. The prior preview package at `company.dental.appointments` 1.1.0 is unchanged. The app keeps the SaaS standalone-diary contract: it captures an appointment name and optional phone without creating or linking a Patient Record.

Package typecheck, four contract tests, bundle build, 21/21 private Linux workflow checks, root build, and 458 root unit tests passed. Public staging verification confirmed the current package signature, digest, ID/version, signer, metadata sequence, and package-bound grant. The authenticated Store UI installed and opened 1.0.1 in a private disposable Linux profile; runtime health matched the exact published payload. Startup performed initial staging reads and no business writes. The running desktop was not redeployed with the M17 trust pin. Full live role/tenant/workflow acceptance remains open; the pinned SaaS controller's role-capability limitation is documented in the M17.3 plan.

See the [M17 verification ledger](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md) and [1.0.1 release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_UI_PARITY_1_0_1_2026-10-23.json).
