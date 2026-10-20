# M13.10 Treatment Protocols — local verification

**Scope:** version 1.0.0 placeholder shell only. No staging publication, installation, SaaS access, patient data, credential handling, or business workflow is included in this verification.

## Result

Five app-local checks cover package manifest identity and its empty SDK capability list, the Treatment Protocols app metadata and single module, the centered staging-preview label, the absence of workflow/API/storage controls, and the bundled icon's PNG dimensions and package-size limit. The app uses the Dental SaaS catalog identity `company.dental.treatment-protocols`, label `Treatment Protocols`, module/tab `treatment-protocols`, and visibility capability `treatment_protocols.manage`. The catalog models it as a first-party app with one module and no parent-app field.

The package icon is an optimized 512 × 512 copy of the existing Dental OS main Treatment Protocols thumbnail at `src/assets/dock/protocols.png`. The app manifest requests no SDK capabilities; the app metadata carries the existing visibility capability.

Run the lightweight checks with `npm test` from this package directory. Staging publication and managed-window installation/launch evidence are outside this app-local verification.
