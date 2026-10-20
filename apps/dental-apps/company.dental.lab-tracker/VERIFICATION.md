# M13.6 Lab Tracker — local verification

**Package:** `company.dental.lab-tracker` 1.0.0

This package contains a centered `Lab Tracker` staging preview. Trusted metadata defines exactly two modules: `lab-tracker` / “Lab Tracker” and `lab-supplier-record` / “Lab supplier record”. Both use the existing app policy capability, `lab_tracker.access`, matching the neighboring app metadata convention. The app manifest requests no SDK capabilities. The sole bundled thumbnail is a 512 × 512 optimized copy of the existing `src/assets/dock/lab.png`; both module tiles use that app icon. The window toolbar shows the active module label and opens the OS App Explorer; selecting either module updates the centered heading and status label.

The app-local `npm test` command passed all 4 checks for package identity, module metadata, the static preview and its business-data boundaries, and the bundled artwork. The root Electron build also passed. The package contains no workflows, SaaS calls, patient data, credentials or local business storage. It was signed and published at Cloudflare staging sequence 18; user-profile installation, managed-window launch and module-switch review remain pending.

## Shared multi-module window contract patch

The source now uses the same toolbar structure and CSS as Finance: the active module and four-dot More Apps control share the left side of one in-app toolbar, the staging badge sits at the right, and the selected module title remains centered below. The OS titlebar continues to show Lab Tracker; module selection updates this same app window. Version 1.0.1 is signed and published at sequence 21. The original 1.0.0 app-local test/build results above are historical; the 1.0.1 package was validated by the release packager and live signed-package verification, but its app-local suite was not rerun. User-profile Store update and visual review remain pending.
