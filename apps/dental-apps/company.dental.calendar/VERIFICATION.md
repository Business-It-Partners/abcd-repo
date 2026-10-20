# M13.11 Calendar — local verification

**Scope:** version 1.0.0 first-party placeholder shell and package metadata. The read-only Dental SaaS catalog entry confirms app ID `company.dental.calendar`, title `Calendar`, the `calendar` module/tab, and visibility capability `calendar.access`.

The static app page centers `Calendar` and displays the `Staging preview · v1.0.0` marker. The package manifest requests no Dental OS SDK capabilities. The only bundled artwork is a 512 × 512 optimized copy of the existing `src/assets/dock/calendar.png` main app thumbnail. The package contains no calendar workflows, business API calls, calendar data, credentials, or local business storage.

`npm test` passed all five app-local checks for package identity, exact catalog-derived metadata, centered staging preview, absence of workflow/network/storage/credential features, and bounded thumbnail packaging. No shared files, root build, staging publication, or installation were part of this app-local slice.
