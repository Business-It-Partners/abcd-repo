# M13.7 Finance — local verification

**Scope:** static Finance 1.0.0 staging shell and signed app metadata source. This package contains the eight Finance module labels, per-module visibility capabilities, no Dental OS SDK capabilities, and no business workflows, SaaS calls, patient data, credentials, or local business storage.

The shell centers the default `Transaction Record` module label and displays a `Staging preview · v1.0.0` marker. Its app-local toolbar exposes the shared `More Apps` explorer and updates the centered heading and active module label from trusted `onModuleSelected({ moduleId })` events. The app metadata declares the M12 Finance access policy: Finance is visible with `finance.manage` or `patient_payments.outstanding.read`, Reception is excluded, Patient payments uses `patient_payments.outstanding.read`, and the other seven modules use `finance.manage`.

The single bundled thumbnail is `assets/finance.png`, a 512 × 512 optimized copy of the existing `src/assets/dock/finance.png` main Finance artwork. All eight module entries use the same package icon; no per-module artwork is included.

`npm test` passed all five app-local checks for package identity, the exact module labels/IDs/tabs/capabilities, centered shell and preview marker, the shared explorer/module-selection hooks, absence of business/network/storage/credential features, and the bundled icon dimensions and optimization. The root Electron build also passed.

## Integration boundary

Implementation, icon, metadata, test, and this evidence file are confined to `apps/dental-apps/company.dental.finance/`. The shell starts on `Transaction Record` and updates to the selected module label when the shared runtime sends a `module-selected` event. Its signed 1.0.0 package was published to Cloudflare staging at catalogue sequence 18; user-profile Store installation, managed-window launch and module-switch review remain pending.

## Shared multi-module window contract patch

The source now uses the common M13 multi-module layout: the active module and four-dot More Apps control share the left side of one in-app toolbar, the staging badge sits at the right, and the selected module title remains centered below. The OS titlebar continues to show Finance; module selection updates this same app window. Version 1.0.1 is signed and published at sequence 21. The original 1.0.0 app-local test/build results above are historical; the 1.0.1 package was validated by the release packager and live signed-package verification, but its app-local suite was not rerun. User-profile Store update and visual review remain pending.
