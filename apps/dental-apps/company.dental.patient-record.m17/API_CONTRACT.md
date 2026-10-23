# Patient Record M17 — pinned clinic API, role and media contract

Reference: `dental-saas/production` @ `f44d3e30ca6f79cba61e32601c53d58826500201`. Platform: `electron/sdk/clinicRoutes.ts`, `docs/CLINIC_JSON_API_CONTRACT.md`, `docs/CLINIC_MEDIA_API_CONTRACT.md`, `docs/CLINIC_MEDIA_UPLOAD_CONTRACT.md` at Dental OS base `327ae15db757d4dc2f8eef83894e825084bb6722`.

## Identity, authority and request envelope

- Family: `clinic.app.patient-record`; app metadata requires `patient_record.access`.
- The host owns Firebase credentials, tenant, session generation, endpoint, signed API/media grants and network transfer. Calls are made only through `ClinicClient.read/command` or the explicit media SDK operation. Server derives actual clinic and clinical permissions again.
- The approved clinic JSON broker restricts patient directory query to `q` (120 chars), `cursor` (512), `limit` (1–100), `cohort` (all/new/regular), and valid `monthStart`/`monthEnd` (AD ISO dates). Typed searches ignore saved month/cohort filters, as in the SaaS source.
- JSON body is limited by the host to 12,000 characters and 12,000 UTF-8 bytes; envelopes 16 KiB; responses 256 KiB. Do not introduce arbitrary fetch, read URLs, signed-URL handling, or app-selected route permissions.
- Commands use `ClinicCommand`: one immutable JSON payload and generated operation key, with explicit original-key replay after an unknown outcome. Concurrent writes are not allowed. Optimistic patient/medical-profile, case, ledger, prescription and lab row versions remain in payloads; 409 requires fresh record review.
- Session switch invalidates app references and prevents presenting an old session's responses. Dirty/modal/unknown in-flight work reports through Dental OS lifecycle. No persisted offline writes.

## Documented business routes

| Intent | Broker route | Methods | Additional role capability |
| --- | --- | --- | --- |
| Patient search/cohorts | `/v1/patients` | GET | Patient Record app access |
| Next record ID | `/v1/patient-intakes/context` | GET | Patient Record app access |
| Register patient | `/v1/patient-intakes` | POST | Patient Record app access |
| Patient profile + row versions | `/v1/patients/:id/core`, `/v1/patients/:id/profile` | GET, PUT | Patient Record app access |
| Chief complaints and cases | `/v1/patients/:id/complaints`, `/v1/patients/:id/cases` | POST | `work_entry.access` |
| Treatment and clinical timeline | `/v1/patients/:id/treatment-plans`, `/v1/patients/:id/timeline` | GET | Patient Record app access |
| Notes and clinical withdrawal | `/v1/patients/:id/notes`, `/v1/patient-notes`, `/v1/patient-notes/:id/withdraw` | GET, POST | Patient Record app access |
| Prescriptions, corrections, withdrawal | `/v1/patients/:id/prescriptions`, `/v1/prescriptions`, `/v1/prescriptions/:id/correct`, `/v1/prescriptions/:id/withdraw` | GET, POST | Patient Record app access |
| Existing follow-up history | `/v1/patients/:id/follow-ups` | GET | Patient Record app access |
| Schedule follow-up | `/v1/follow-ups` | POST | Patient Record app access |
| Billing ledger and payment | `/v1/patients/:id/ledger`, `/v1/patients/:id/payments` | GET, POST | `patient_billing_ledger.read`, `patient_payments.collect` respectively |
| Correct/reverse ledger item | `/v1/patient-ledger/:id/correct`, `/v1/patient-ledger/:id/reverse` | POST | `finance.manage` |
| Odontogram/periodontal chart | `/v1/patients/:id/odontogram`, `/v1/patients/:id/periodontal-chart` | GET, PUT | `work_entry.access` |
| Canal measurements | `/v1/patients/:id/canal-measurements` | GET, POST | `work_entry.access` |
| Patient lab orders | `/v1/patients/:id/lab-orders` | GET | Patient Record app access |
| Lab request | `/v1/lab-requests` | POST | `lab_requests.create` |
| Lab order status | `/v1/lab-orders/:id` | PATCH | `lab_tracker.access` |
| Case status | `/v1/chief-complaints/:id/status` | POST | `work_entry.access` |
| X-ray asset metadata | `/v1/patients/:id/media` | GET | Patient Record app access |
| Private X-ray bytes | `clinic.media.read` with `{kind:"patient_media",recordId,assetId}` | SDK | Signed media-read grant, active same-clinic asset |
| X-ray create/replacement | `clinic.media.upload` begin/chunk/commit/cancel | SDK | Signed upload grant, patient-record family, `patient_record.access` |

**No new API route or host capability was added.** The SaaS Worker may independently reject operations even where the app renders an action.

## X-ray byte rules

- Domain MIME: JPEG, PNG and WebP; patient images 1–10 MiB. Capture date must be real ISO AD. Metadata includes `xrayType` (IOPA/OPG/CBCT/Intraoral photo), tooth code and optional clinical note.
- `begin` allocates a transient transfer only; `chunk` submits at most 8 KiB of base64 data; `commit` finalizes with the original stable key. Never send upload intent URLs or secrets to this app.
- `clinic.media.read` performs fresh host metadata/identity/size/hash validation and returns bounded verified bytes. Browser blob URLs are temporary and revoked on close/unmount. No user-owned binary fetch or external viewer.
- A replacement routes through host-owned `replacement:{assetId,reason}`, preserving the original clinical asset until successful finalization.
- No file withdrawal, retention, deletion, native export/print or new host file system functionality is implemented by this app.

## Differences and limitations

The production web module is substantially larger than this from-scratch M17 implementation. Detail tabs cover the documented route set, but the visual structure is a Dental OS recreation, not a bit-for-bit clone. Full periodontal-site and canal-measurement edit forms, protocol/stage work editing, complete lab supplier assignment, legacy visit amendment/removal, and native print/export are **not** asserted complete. See `VERIFICATION.md`.
