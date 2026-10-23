# M17.5 Treatment Progress verification

**M17 release:** `company.dental.treatment-progress.m17` first release `1.0.0`; current signed staging release `1.0.5` at sequence 57

**SaaS source:** `Business-It-Partners/dental-saas` at `f0d059d36540b4b6907cace089085ce0df62d454`
**Current status:** M15-source version 1.0.5 is signed and published to Cloudflare staging at sequence 57. App typecheck, four package tests, package build, 29 private UI checks, the 527-test root suite and public signature/package/grant readback passed. The screenshot supplied by the user predates this publication. Authenticated Store installation/runtime health and live synthetic clinic acceptance remain open; publishing does not update an app instance already running.

The app is a fresh Dental OS implementation of the pinned Treatment Progress worklist. It reads the server-calculated active, incomplete treatment projection through `ClinicClient`; supports patient/record/plan/doctor search, doctor filtering, sortable paginated rows, and manual refresh; and shows server-projected stage counts, outstanding balance, and next return date. Assigned doctors remain available to search/filter but are no longer shown in a table column. Long treatment plan labels wrap to a maximum of two lines. It does not add a local clinical database or patient-detail navigation.

## Historical UI update — version 1.0.1

- Removed the Doctors table column while retaining the doctor filter and doctor-name search.
- Confirmed long plan names wrap to two lines and remain clamped there.
- App typecheck and package build passed; four app package contract tests passed.
- Root M15 production build passed and `npm test -- --maxWorkers=1` passed 521 tests across 36 files.
- Private headless UI acceptance passed 25/25 checks, including the new column and long-plan layout assertions. The first run stopped at an outdated SDK bridge assertion; the test was corrected for the current `onFilesReceived` bridge method, and the failed attempt was retained.
- Private UI report: [`m17-treatment-progress-private-2026-10-23T12-10-42.918Z.json`](../../../artifacts/m17-treatment-progress-private-2026-10-23T12-10-42.918Z.json). Screenshot: [`m17-treatment-progress-private-2026-10-23T12-10-42.918Z.png`](../../../artifacts/m17-treatment-progress-private-2026-10-23T12-10-42.918Z.png).
- Public staging verifier passed all 26 checks at sequence 34, including package signature/bytes/grants and isolated local install/launch/uninstall for all seven M17 releases: [`m17-staging-packages-readonly-2026-10-23T12-12-51.836Z.json`](../../../artifacts/m17-staging-packages-readonly-2026-10-23T12-12-51.836Z.json).
- Staging release record: [M17.5 version 1.0.1 sequence 34](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.5_TREATMENT_PROGRESS_STAGING_UPDATE_2026-10-23.json).

## Combined M15 source update — version 1.0.5 (published)

- Imported the shared Standard Window page, scroll viewport and inset alignment from `codex/dental-ap-ui-enhance` commits `431ee411`, `f19eaaa0` and `9bb5463d`.
- Kept the newer M15 treatment-progress changes: Doctors is not a table column; doctor search/filter remain; treatment plans clamp to two lines. Progress now shows only completed/total text, with no progress bar or remaining-count label. The fixed 1100px table minimum was removed to fit the visible viewport.
- The UI worktree's signed version 1.0.4 at sequence 50 is retained as historical staging evidence. M15-source version 1.0.5 supersedes it.
- App typecheck, four package contract tests, app build and 29 private UI checks passed. The root unit suite passed 527/527 after updating a stale 1.0.4 identity expectation; the focused identity test passed 3/3.
- Version 1.0.5 was signed and published to Cloudflare staging at sequence 57. Public readback verified metadata signatures/freshness, package signature and exact bytes/hash/size/digest, the exact API grant, and retained grants 1.0.0–1.0.5. See [release evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.5_TREATMENT_PROGRESS_1.0.5_STAGING_2026-10-23.json) and [public readback report](../../../artifacts/treatment-progress-1.0.5-public-staging-readback.json).
- Authenticated Store installation/runtime health, live clinic acceptance, and updating the user's already-running app remain open. No GitHub Actions, production publication, or app/OS restart occurred.
- Source-worktree evidence: [Standard Window UI staging updates](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_STANDARD_WINDOW_UI_STAGING_UPDATES_2026-10-23.json), [scrollbar staging updates](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_STANDARD_WINDOW_SCROLLBAR_STAGING_UPDATES_2026-10-23.json).

## Historical local evidence before UI-worktree integration

- App typecheck: `npm run typecheck --prefix apps/dental-apps/company.dental.treatment-progress.m17` — PASS.
- App package build: `npm run build --prefix apps/dental-apps/company.dental.treatment-progress.m17` — PASS.
- App package contract tests: `npm test --prefix apps/dental-apps/company.dental.treatment-progress.m17` — 3 passed.
- Root production build: `npm run build` — PASS.
- Root unit suite after the 64-app capacity change: `npm test -- --maxWorkers=2` — 26 files, 460 tests passed.
- Private app acceptance: `node tools/run-ui-test.mjs tests/m17-treatment-progress.mjs` — 23 checks passed. The ephemeral signed package was verified as the new app ID at version 1.0.0. Coverage includes SDK-only bridge exposure, the approved read-only route, projection fields, search/filter/pagination, refresh, empty/error/malformed responses, stale-row clearing, module readiness, and host role denial before route dispatch.
- Report: [`m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json`](../../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json).
- Screenshot: [`m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png`](../../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png).

Private acceptance used synthetic in-memory data and an ephemeral test-only package key on the isolated headless display. It did not access clinic records, sign with the suite key, publish to staging, install from the Store, or mutate a live service. Staging signing, catalogue publication, Store installation, and live clinic acceptance remain separate release steps. M15 platform-dependent behavior must be repeated on the final verified platform source.

## Historical first staging release — version 1.0.0

- M17 suite key: `company-staging-m17-20261022`; catalogue sequence 27 (baseline sequence 26).
- App: `company.dental.treatment-progress.m17` version `1.0.0`, approved in the public catalogue and update policy.
- Package SHA-256: `d6a0376d71ff6c709f84b936909ab76740331283b6b0f768a59aa14991994f61` (1,119,939 bytes); payload digest: `f37e6eaa3c05a82051c938728e120fb4fa1009d3207fe45d57ff03abefaec998`.
- Public verification confirmed 17 matching catalogue and update-policy apps, the package signature and inventory, the exact release grant, and the `clinic.api.request` operation. The staging publisher confirmed both metadata objects advanced to sequence 27, denied anonymous and replay publication, and removed its temporary Worker.
- Report: [staging publication and public verification](../../../artifacts/m17-treatment-progress-staging-publication-2026-10-23.json).
- The original version 1.0.0 release remains in the update policy as the prior grant.

## Signed staging release from the UI worktree — version 1.0.4

- Published at sequence 50. Package SHA-256: `7d29f474519f428bda38899a7b495ed7b1cd0a3e8b83baf6071ce927bbf9f175`.
- This is the exact source-worktree package and is not the combined M15 version 1.0.5. The local compact-table changes remain unsigned and unpublished.
- See [Standard Window scrollbar staging evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_STANDARD_WINDOW_SCROLLBAR_STAGING_UPDATES_2026-10-23.json).

## Historical staging release — version 1.0.1

- Published at sequence 34 from baseline sequence 33 using the pinned M17 suite key. Package SHA-256: `ba1082a1ef429094be6fc0f8b6dd270d12bf6316df6a9c071d845c5301a9b5c7` (1,123,815 bytes); payload digest: `14ec8d5268b5ce1e1b463604748a73d8f5cbf694e25e70386a0fa1db46cbd4a8`.
- Catalogue SHA-256: `892e9c4e35b789b2ad9679c37e329bb2c9738bc8412bd7e0354f5d1e4fa75076`; update-policy SHA-256: `47cba8b1865ecbbde281c216eabbda14b54e93f27210fc1b65133c7482da6ace`.
- Publication advanced both signed metadata objects to sequence 34; the temporary publisher Worker was ready, denied anonymous and replay publication, returned HTTP 200 for the authorized write, and was cleaned up.
- Public readback verified the new signature, package bytes, exact `clinic.api.request` grant, and the prior 1.0.0 grant. The isolated local registry installed, launched, and removed the package. No authenticated Store profile, live clinic API, business write, GitHub Action, or production target was used.
- See the [M17.5 staging update evidence](../../../dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.5_TREATMENT_PROGRESS_STAGING_UPDATE_2026-10-23.json). The user's running OS was not restarted or modified; it must already trust the M17 signer to discover/install this staging release.
