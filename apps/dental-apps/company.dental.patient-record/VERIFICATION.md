# Patient Record shell verification

**Package:** `company.dental.patient-record` 1.0.0

The app source is a static page with a centered `Patient Record` heading and a visible “Staging preview” badge. Its package manifest requests no Dental OS SDK capabilities. The trusted app metadata carries the Patient Record module and its `patient_record.access` visibility rule. The copied 512 × 512 icon is optimized from the existing Dental OS Patient Record dock artwork.

`npm test` runs four app-owned checks for package identity, app metadata, the centered preview page with a restrictive content policy, and the copied icon. This evidence covers local app source only; signed package assembly, staging publication, installation and managed-window launch are lead integration work.
