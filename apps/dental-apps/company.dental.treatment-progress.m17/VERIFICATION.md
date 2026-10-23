# M17.5 Treatment Progress verification

**M17 release:** `company.dental.treatment-progress.m17` `1.0.0`

**SaaS source:** `Business-It-Partners/dental-saas` at `f0d059d36540b4b6907cace089085ce0df62d454`
**Current status:** Published to the Cloudflare staging Store as sequence 27. The public signed catalogue, update policy, and downloaded package verify as M17 1.0.0. Store installation and live synthetic clinic acceptance were not run.

The app is a fresh Dental OS implementation of the pinned Treatment Progress worklist. It reads the server-calculated active, incomplete treatment projection through `ClinicClient`; supports patient/record/plan/doctor search, doctor filtering, sortable paginated rows, and manual refresh; and shows server-projected stage counts, assigned doctors, outstanding balance, and next return date. It does not add a local clinical database or patient-detail navigation.

## Local evidence

- App typecheck: `npm run typecheck --prefix apps/dental-apps/company.dental.treatment-progress.m17` — PASS.
- App package build: `npm run build --prefix apps/dental-apps/company.dental.treatment-progress.m17` — PASS.
- App package contract tests: `npm test --prefix apps/dental-apps/company.dental.treatment-progress.m17` — 3 passed.
- Root production build: `npm run build` — PASS.
- Root unit suite after the 64-app capacity change: `npm test -- --maxWorkers=2` — 26 files, 460 tests passed.
- Private app acceptance: `node tools/run-ui-test.mjs tests/m17-treatment-progress.mjs` — 23 checks passed. The ephemeral signed package was verified as the new app ID at version 1.0.0. Coverage includes SDK-only bridge exposure, the approved read-only route, projection fields, search/filter/pagination, refresh, empty/error/malformed responses, stale-row clearing, module readiness, and host role denial before route dispatch.
- Report: [`m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json`](../../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json).
- Screenshot: [`m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png`](../../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png).

Private acceptance used synthetic in-memory data and an ephemeral test-only package key on the isolated headless display. It did not access clinic records, sign with the suite key, publish to staging, install from the Store, or mutate a live service. Staging signing, catalogue publication, Store installation, and live clinic acceptance remain separate release steps. M15 platform-dependent behavior must be repeated on the final verified platform source.

## Staging release evidence

- M17 suite key: `company-staging-m17-20261022`; catalogue sequence 27 (baseline sequence 26).
- App: `company.dental.treatment-progress.m17` version `1.0.0`, approved in the public catalogue and update policy.
- Package SHA-256: `d6a0376d71ff6c709f84b936909ab76740331283b6b0f768a59aa14991994f61` (1,119,939 bytes); payload digest: `f37e6eaa3c05a82051c938728e120fb4fa1009d3207fe45d57ff03abefaec998`.
- Public verification confirmed 17 matching catalogue and update-policy apps, the package signature and inventory, the exact release grant, and the `clinic.api.request` operation. The staging publisher confirmed both metadata objects advanced to sequence 27, denied anonymous and replay publication, and removed its temporary Worker.
- Report: [staging publication and public verification](../../../artifacts/m17-treatment-progress-staging-publication-2026-10-23.json).
- This task stopped after public staging verification. No Store install, clinic credential use, live clinical request, or production action occurred. The OS changes that pin the M17 signer and raise suite capacity to 64 still need integration into a desktop build before existing clients can consume the new feed.
