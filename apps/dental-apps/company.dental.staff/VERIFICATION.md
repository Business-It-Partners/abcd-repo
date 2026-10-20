# M13.9 Staff — local verification

**Scope:** version 1.0.0 placeholder shell and app metadata only. The reference Dental SaaS navigation identifies Staff as a top-level workspace item with the `staff.manage` capability and no nested modules. The package contains no Staff workflows, SaaS calls, business data, credentials, or local business storage.

The shell centers `Staff` in the managed app window and displays a `Staging preview · v1.0.0` marker. Its single metadata module uses ID/tab `staff` and the reference capability `staff.manage`; the Dental OS package manifest requests no SDK capabilities.

The bundled main thumbnail is `assets/staff.png`, an optimized 512 × 512 copy of the existing `src/assets/dock/staff.png` artwork.

`npm test` passed all five app-local checks for package identity, exact module metadata and access policy, centered placeholder and preview marker, absence of workflow/network/storage/credential features, and thumbnail type, dimensions and package-size limit. No root build or staging publication was performed as part of this app-local slice.
