# Patient Record — M17.2

First-party Dental OS app using the pinned Dental SaaS Patient Record screens.

- App ID: `company.dental.patient-record.m17`
- Current package version: `1.0.10`
- UI and business-flow source: `Business-It-Partners/dental-saas`, `production` at `f44d3e30ca6f79cba61e32601c53d58826500201`
- Dental OS integration base: `327ae15db757d4dc2f8eef83894e825084bb6722`

## UI parity

Patient Record does not have a custom replacement UI. It renders the pinned SaaS `PatientRecordView`, `CaseEntryView`, `PatientDrawer` and its production detail tabs, with their source CSS, shared workspace primitives, icons and date controls. The app shell uses the production `clinicApp`, `clinicWorkspaceCanvas` and `clinicCareWorkspace` layout classes. This preserves the source margins, backgrounds, page sheets, typography, controls, tables, dialogs, responsive behavior and tab structure.

The Files-inspired patient-section sidebar is 190 px wide. The active patient section and sidebar keep separate vertical scroll areas.

Of the 128 vendored source files, 121 are byte-identical to the pinned production revision. Seven files are adapted at the Dental OS boundary for SDK-mediated requests, private image transfer, in-memory app routing, platform role context, or patient-scoped chart media. Those adapters do not replace the production view markup or CSS. File-level provenance and adapter scope are recorded in [`SOURCE_IMPORT.json`](SOURCE_IMPORT.json).

## Runtime boundary

Business data remains authoritative in the Dental SaaS Worker. The renderer uses Dental OS `ClinicClient` commands and the host media SDK; it does not read credentials or make direct network requests. Session, role, operation grants and media transfer remain controlled by Dental OS. No local business database or offline write queue is introduced.

Use [`API_CONTRACT.md`](API_CONTRACT.md) for the clinic routes and platform constraints. Local checks and staging status are tracked in the M17.2 milestone records.
