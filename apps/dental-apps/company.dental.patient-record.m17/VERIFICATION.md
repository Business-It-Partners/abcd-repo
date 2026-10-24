# Patient Record — verification record

**Current staging release:** `company.dental.patient-record.m17` / `1.0.10`, signed at staging sequence 86.
**Package SHA-256:** `45211018a4c2b880b39e3adb51c06d3c2b31a57c372d9205902d34e6bf56d2cd` (1,799,052 bytes).
**Payload digest:** `c0a973948162caf9c4adb27bf68b560626b2b0b771193cd69bce8bea6bca9fdf`.
**Signer:** `company-staging-m17-20261022` (pinned M17 staging identity).

## UI and implementation

The Files-inspired patient-section sidebar is fixed at 190 px, giving the content pane 16 px more room than the former 206 px width. Sidebar and active content scroll independently. The new-patient page no longer draws its own Back button; its app history supports a discard navigation after the OS confirms it. Patient content, data and sections remain unchanged.

The polished discard dialog and confirmed OS Back/Forward dispatch are desktop-shell changes. They are not included in this Patient Record package and require a separate desktop-shell update.

The app continues to render the pinned Dental SaaS `PatientRecordView`, `CaseEntryView`, `PatientDrawer`, and detail tabs. The Dental SaaS Worker remains the business authority; the renderer uses Dental OS `ClinicClient` and media SDKs. No local business database, direct renderer networking, or offline write queue was added.

## Checks

- Patient app typecheck — passed.
- `npm run build:patient-record` — passed for 1.0.10.
- `npm run build` — passed.
- `npm test -- --maxWorkers=1` — 528/528 tests passed across 37 files.
- `npm run test:patient-record` — 30/30 private headless checks passed against 1.0.10 using synthetic clinic and media data, including confirmed OS Back behavior, the 190 px sidebar and independent scrolling.
- Public staging readback passed at sequence 86: signed catalogue and policy, exact package bytes and signature, Patient Record's exact API grant, and isolated PackageRegistry install/launch/health/uninstall. No authenticated Store install or clinic API write was performed.

Evidence: [release record](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.10_STAGING_2026-10-24.json), [public package readback](../../../artifacts/m17-patient-record-1.0.10-public-readback-2026-10-24.json), [private UI report](../../../artifacts/m17-patient-record-private-2026-10-24T04-47-16.731Z.json), and [private intake screenshot](../../../artifacts/m17-patient-record-intake-private-2026-10-24T04-47-16.731Z.png).

## Staging policy and remaining gates

The current update policy retains exact API grants for versions 1.0.4–1.0.10. The platform permits at most seven retained grants per app, so the 1.0.3 API grant was retired to publish 1.0.10. Its immutable package object remains in staging storage.

This publication is to the Cloudflare staging Store only. Authenticated Store installation, live clinic workflow acceptance, current-source Windows verification, independent review, M15/G15 closeout, and final user acceptance remain open. Production was untouched. The already-running Dental OS was not restarted; refresh the staging Store and fully reopen Patient Record to load 1.0.10 there. The separate desktop-shell changes are not delivered by this app package.
