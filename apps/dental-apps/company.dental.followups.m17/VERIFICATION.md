# Follow-ups M17 package verification

Initial package: `company.dental.followups.m17` 1.0.0.
Source: retained M17 Follow-ups implementation, imported into the M15 worktree from M17 source commit `5306b80161542b7a9480b4bb2bc49df6b1218d84`.

This package reuses the existing SDK-backed follow-up workflows. The prior package at `company.dental.followups` 1.1.0 and its bytes remain unchanged. The manifest declares `clinic.app.followups`; the host selects its existing route and role policy from that signed capability, without a fixed app-ID registration. Clinic business calls continue through the Dental OS SDK.

Package typecheck, contract tests, build, private Linux workflow, root build and unit-suite results are tracked in the M17 evidence ledger. The 1.0.0 package was published to Cloudflare staging at sequence 24. Public package/grant verification and authenticated private-profile Store install/open with exact-payload runtime health passed; no business writes were made. Full live role/tenant/workflow acceptance and deployment of the M17 trust pin to the user's running desktop remain open. The running app's existing installed-package profile is independent of this source import.

## Historical compact-card update — 2026-10-24

Follow-ups 1.0.4, published to Cloudflare staging at sequence 87, makes the four summary cards compact and left-aligned. Typecheck, four package tests, app build, root build, 528 root unit tests, and 24 private UI checks passed. The signed sequence-88 public readback verified the package bytes/hash, signer, exact API grant, and isolated registry install/launch/health/uninstall. See the [release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FOLLOWUPS_1.0.4_STAGING_2026-10-24.json). Authenticated Store install and live clinic acceptance remain open; the running OS was not restarted.

## Latest update — Follow-ups 1.0.5 — 2026-10-24

The four summary cards now fill the content width in four equal columns, with a two-column and single-column layout at narrower breakpoints. Follow-ups 1.0.5 was published to Cloudflare staging at sequence 89. Typecheck, four package tests, app build, integrated root build, 528 root unit tests, and 24 private UI checks passed. Public readback verified the signed package, exact API grant and artwork; the final sequence-90 verifier also completed isolated registry install/launch/health/uninstall. See [release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FOLLOWUPS_1.0.5_STAGING_2026-10-24.json), [private report](../../../artifacts/m17-followups-private-2026-10-24T06-01-45.106Z.json), and [screenshot](../../../artifacts/m17-followups-private-2026-10-24T06-01-45.106Z.png).

Authenticated Store installation and live clinic acceptance remain open. The running OS was not restarted; refresh the staging Store and fully relaunch Follow-ups to load 1.0.5. Production was not changed.
