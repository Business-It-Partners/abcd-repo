# Patient Record — M17.2

New first-party Dental OS app; **not** the former M13 preview `company.dental.patient-record`.

- App ID: `company.dental.patient-record.m17`
- Initial release identity: `1.0.0`
- SaaS behavior reference: `Business-It-Partners/dental-saas`, **`production`** at `f44d3e30ca6f79cba61e32601c53d58826500201`. Reference repository is read-only.
- Dental OS integration base: `327ae15db757d4dc2f8eef83894e825084bb6722`.
- Runtime: isolated managed Dental OS app. All business data is Worker-authoritative via `ClinicClient` and the platform SDK. No Firebase token access, direct HTTP, Worker endpoint selection, R2 URLs, local business database, or hidden queue.

## App-local organization

- `src/main.tsx` — strict signed-app/session initialization, lifecycle/dirty reporting, single pending original-key write reconciliation, module selection.
- `src/api.ts` — Worker response adapters, stable commands and media SDK read/upload operations.
- `src/directory.tsx` — clinic-scoped search, BS-month cohort filters, counts, cursor pagination.
- `src/intake.tsx` — registration number preview and multi-step patient/safety intake.
- `src/patient.tsx` — record detail, versioned profile correction, complaint/case and plan histories.
- `src/clinical.tsx` — clinical notes/timeline and prescriptions with correction/withdrawal.
- `src/operations.tsx` — patient follow-ups, billing ledger, odontogram and clinical-chart reads, lab orders.
- `src/media.tsx` — host-mediated X-ray metadata, private image viewer, bounded image upload/replacement, original-transfer retry/cancel.
- `src/types.ts` — unchanged production patient types pinned in `SOURCE_IMPORT.json`.
- `src/styles.css` — clinic-style cards, tables, tabbed detail, responsive forms and modal overlays.

## Important boundaries

Each first-party app requires a signed release and matching exact update-policy format-2 operation grants. This source does not sign, package, publish, install, or grant itself API/media authority. `clinic.media.read` and `clinic.media.upload` must be granted independently. Session access and patient scope remain enforced by the Dental OS host and the SaaS Worker.

For exact route/capability mapping and implementation limitations see `API_CONTRACT.md` and `VERIFICATION.md`.

**This code is an untested implementation handoff**, not a staging-accepted, signed, live or production release.
