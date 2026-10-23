# Patient Record — verification record

**Current candidate:** `company.dental.patient-record.m17` / `1.0.1`
**Pinned SaaS source:** production `f44d3e30ca6f79cba61e32601c53d58826500201`
**State:** local build and private synthetic UI acceptance pass. The 1.0.1 staging update is the next release step; the earlier 1.0.0 release at sequence 32 is preserved as historical evidence.

## UI parity and local checks

- The patient directory, registration view, patient details and visible tabs use the pinned Dental SaaS view components and CSS. The app wrapper now uses the same `clinicApp`, `clinicWorkspaceCanvas` and `clinicCareWorkspace` classes as the production workspace.
- File comparison: 121 of 128 vendored files are byte-identical to the pinned source. The remaining seven are SDK/session/routing/media adapters documented in [`SOURCE_IMPORT.json`](SOURCE_IMPORT.json); they do not replace the source view markup or styles.
- `npm --prefix apps/dental-apps/company.dental.patient-record.m17 run build` — passed after the production shell wrapper change.
- `npm run test:patient-record` — **17/17** private synthetic checks passed against the rebuilt 1.0.1 app. The flow covers the directory, source intake controls and patient number, profile read/edit retry using the original operation identity, timeline, private image read/upload, lab dispatch, SDK isolation and role denial.
- Latest private artifacts: [report](../../../artifacts/m17-patient-record-private-2026-10-23T09-43-57.467Z.json), [directory](../../../artifacts/m17-patient-record-private-2026-10-23T09-43-57.467Z.png), [registration](../../../artifacts/m17-patient-record-intake-private-2026-10-23T09-43-57.467Z.png), [patient detail](../../../artifacts/m17-patient-record-detail-private-2026-10-23T09-43-57.467Z.png), [lab tab](../../../artifacts/m17-patient-record-lab-private-2026-10-23T09-43-57.467Z.png).
- The private fixture uses synthetic records and ephemeral test signing keys. It does not use clinic credentials or real patient data.

## Staging and remaining acceptance

The signed `1.0.0` package published at sequence 32 remains intact. It predates the UI parity correction. The corrected `1.0.1` package must be built, signed with the pinned M17 staging identity, published as a staging-only update and publicly read back before the corrected package is marked staging-published.

Authenticated Store installation, live clinic reads/writes, current-source Windows verification, independent review, M15/G15 media-platform closure and final user acceptance remain separate gates. No production publication or GitHub Actions run is part of this app update.
