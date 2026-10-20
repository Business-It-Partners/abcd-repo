# M13.8 Patient Payments — local verification

**Package:** `company.dental.patient-payments` 1.0.0

The app is a centered `Patient payments` staging preview with no SDK capabilities, workflows, business API calls, credentials, patient data or local business storage. Its trusted metadata defines the Reception-only `patient-payments` module at `finance/patient-payments` using `patient_payments.outstanding.read`. The only bundled artwork is the existing 512 × 512 Finance app thumbnail.

## Result

`npm test --prefix apps/dental-apps/company.dental.patient-payments` passed all five app-local checks for manifest identity, trusted module and Reception policy, centered staging shell, prohibited workflow/data features, and exact Finance thumbnail reuse.

## Integration boundary

All package files and verification evidence are under this app directory. The package metadata and manifest use the app-package format consumed by the M13 batch assembler. The current `prepare-m13-batch-release.mjs` is explicitly limited to M13.5–M13.7 and probes visibility as `admin`; adding this Reception-only package to a release batch requires the lead's shared release-tool integration. No root build, staging publication, installation, or shared-file change was part of this local verification.
