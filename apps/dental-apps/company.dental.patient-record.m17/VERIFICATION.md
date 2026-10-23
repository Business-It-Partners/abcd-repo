# M17.2 Patient Record — implementation handoff, not an acceptance result

**Source-only state.** Created using `dental-saas/production` at `f44d3e30ca6f79cba61e32601c53d58826500201`. Target M15 starting commit: `327ae15db757d4dc2f8eef83894e825084bb6722`. App ID: `company.dental.patient-record.m17` / `1.0.0`.

User restriction for this work: **No builds, tests, typechecks, runtime checks, CI, signing, package assembly, publication, Store changes, staging tests, or deployments.** None of these are represented as completed. The source is not yet verified as buildable, installable, or live-worker compatible.

## App-local source prepared

- [x] New isolated first-party app identity and metadata without editing M13 or other apps.
- [x] Source provenance and exact production commit pinned in `SOURCE_IMPORT.json`.
- [x] Patient search by name/number/phone through the clinic-scoped directory, cursor paging, cohort/month filters and error/empty states.
- [x] Multi-step standalone intake with demographics, emergency contacts, medical summary, allergy entries, registration ID preview and draft safety.
- [x] Patient detail profile and optimistic row-version correction.
- [x] Chief complaint / case history and case status changes subject to `work_entry.access`.
- [x] Treatment-plan/stage history, timeline, clinical notes and withdrawals.
- [x] Prescription history, new prescription, correction and withdrawal using row-version handling.
- [x] Follow-up history and creation, ledger/payment/correction/reversal subject to separate role capabilities.
- [x] Odontogram view and edit; periodontal/canal history reads; patient lab orders, requests and role-gated status updates.
- [x] Patient X-ray metadata list, private host-broker image viewer, bounded mediated upload and replacement, original-key resume/cancel controls.
- [x] API error display, original-command reconciliation, session reset, reported dirty/modal state and no app-owned backend networking.
- [x] App-local styles and standalone Vite package configuration.

## Deliberately unverified / still required before claiming completion

1. **Build/type validity, imports, packaging compatibility, UI rendering and cross-platform runtime:** untested by user instruction.
2. **Authenticated clinical workflows:** no staging account, clinic/role, backend write, concurrent edit, tenant isolation or audit tests performed here.
3. **X-ray transfer path:** no signed media read/upload grant issued; normal host transfer and image display unverified. Media proof depends on M15/G15 closeout.
4. **Full SaaS feature/UI parity:** the production module has richer odontogram/periodontal editing, canal-session entry, treatment protocol/stage editing, lab supplier dispatch/assignment, old visit correction/removal and specialized presentation. These are not fully reproduced. Native print/export and app-to-app navigation are explicitly unsupported platform capabilities.
5. **Release:** no signed package, release grant, Store entry, publication or deployment. G17 remains open.

Do not mark M17.2 accepted from this commit alone. Have the next executor perform app-local typecheck/build/private-profile UI, request denial and original-key conflict/unknown-outcome checks, X-ray signed-grant tests and authenticated staging workflow evidence **only after the user permits validation**.
