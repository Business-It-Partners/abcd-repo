# Follow-ups M17 package verification

Package: `company.dental.followups.m17` 1.0.0.
Source: retained M17 Follow-ups implementation, imported into the M15 worktree from M17 source commit `5306b80161542b7a9480b4bb2bc49df6b1218d84`.

This package reuses the existing SDK-backed follow-up workflows. The prior package at `company.dental.followups` 1.1.0 and its bytes remain unchanged. The manifest declares `clinic.app.followups`; the host selects its existing route and role policy from that signed capability, without a fixed app-ID registration. Clinic business calls continue through the Dental OS SDK.

Package typecheck, contract tests, build, private Linux workflow, root build and unit-suite results are tracked in the M17 evidence ledger. The 1.0.0 package was published to Cloudflare staging at sequence 24. Public package/grant verification and authenticated private-profile Store install/open with exact-payload runtime health passed; no business writes were made. Full live role/tenant/workflow acceptance and deployment of the M17 trust pin to the user's running desktop remain open. The running app's existing installed-package profile is independent of this source import.
