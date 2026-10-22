# Appointments implementation verification

**Package:** `company.dental.appointments` 1.1.0 (local implementation; not signed or published)

The former static 1.0.0 shell is now an SDK-backed appointment diary. It provides day/range and active-doctor filters, SaaS summary counts, booking, reschedule, status changes, overlap warnings, row-version conflict recovery, and safe handling of uncertain writes. The package requests only the Appointments module capability, brokered clinic API access, and session context. All business calls use the Dental OS SDK; no direct HTTP, credential access, or patient-register lookup is included.

Current local Linux build and private synthetic acceptance evidence is recorded in the M17.3 plan and M17 ledger. The current signed staging catalogue/policy and pinned signer were also verified; the catalogue remains at sequence 23 with only the 1.0.0 Appointments preview. Authenticated staging sign-in/writes are blocked because the protected clinic credential file is unavailable. No signed 1.1.0 package or Store installation was performed. The pinned SaaS Appointments controller authenticates clinic access and scopes data but does not call its role-capability guard. The app and OS broker check `appointments.access`; current supported SaaS roles are all granted this capability. Current-source Windows verification and independent review are separate M15/G14 gates.

The app follows the current SaaS standalone-diary contract: it captures an appointment name and optional phone, without creating or linking a patient record.

Local checks completed:

- `npm exec -- tsc -p apps/dental-apps/company.dental.appointments/tsconfig.json --noEmit` — passed.
- `node tools/app-packages/build-appointments.mjs` — passed.
- `npm run test --prefix apps/dental-apps/company.dental.appointments` — passed four package contract tests.
- `npm run build` — passed.
- `node tools/run-ui-test.mjs tests/m17-appointments.mjs` — passed 20 private Linux checks; report and screenshot are linked in the M17 verification ledger.

The private fixture uses only a test-only ephemeral signing key and in-memory synthetic service; it is not a staging package. Staging role/tenant and write checks, signed package assembly, staging publication, Store installation, and managed-window runtime health have not been verified. The staging preflight and its missing credential-file prerequisite are recorded in [M17 staging evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md). M17.3 remains open.
