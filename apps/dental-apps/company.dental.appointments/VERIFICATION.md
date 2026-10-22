# Appointments implementation verification

**Existing local checkpoint:** `company.dental.appointments` 1.1.0 (preview identity; local/private only)
**New M17 release:** unique app ID TBD; first version 1.0.0; new M17 suite signer required

The former static 1.0.0 shell is now an SDK-backed appointment diary. It provides day/range and active-doctor filters, SaaS summary counts, booking, reschedule, status changes, overlap warnings, row-version conflict recovery, and safe handling of uncertain writes. The package requests only the Appointments module capability, brokered clinic API access, and session context. All business calls use the Dental OS SDK; no direct HTTP, credential access, or patient-register lookup is included.

Current local Linux build and private synthetic acceptance evidence is recorded in the M17.3 plan and M17 ledger. This checkpoint is retained as M17 app source, but it is not the new M17 release package. The new unique app ID, version 1.0.0 package, new suite signer, authenticated staging acceptance, signed publication, and Store installation remain pending. A protected clinic credential is required for live synthetic staging acceptance. The pinned SaaS Appointments controller authenticates clinic access and scopes data but does not call its role-capability guard. The app and OS broker check `appointments.access`; current supported SaaS roles are all granted this capability. Current-source Windows verification and independent review are separate M15/G14 gates.

The app follows the current SaaS standalone-diary contract: it captures an appointment name and optional phone, without creating or linking a patient record.

Local checks completed:

- `npm exec -- tsc -p apps/dental-apps/company.dental.appointments/tsconfig.json --noEmit` — passed.
- `node tools/app-packages/build-appointments.mjs` — passed.
- `npm run test --prefix apps/dental-apps/company.dental.appointments` — passed four package contract tests.
- `npm run build` — passed.
- `node tools/run-ui-test.mjs tests/m17-appointments.mjs` — passed 20 private Linux checks; report and screenshot are linked in the M17 verification ledger.

The private fixture uses only a test-only ephemeral signing key and in-memory synthetic service; it is not a staging package and is not the M17 suite signer. Staging role/tenant and write checks, new-identity package assembly, staging publication, Store installation, and managed-window runtime health have not been verified. The staging credential prerequisite is recorded in [M17 staging evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md). M17.3 remains open.
