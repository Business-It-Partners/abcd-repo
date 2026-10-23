# M17 Verification Evidence

**Status:** Standard Window page, scroll and inset changes from `codex/dental-ap-ui-enhance` are integrated into M15 from commits `431ee411`, `f19eaaa0` and `9bb5463d`. Source-worktree records show the seven existing M17 IDs in the signed feed through sequence 55 and include private UI and public readback evidence. The combined M15 tree has not been rebuilt or retested. Treatment Progress local source is 1.0.5; the signed 1.0.4 package at sequence 50 is the prior source-worktree build and does not contain the current compact-table changes. Lab Tracker 1.0.0, Finance 1.7.0 and Staff 1.0.0 remain integrated but unverified. Authenticated Store installation, full live clinic acceptance, and G17 remain open. See [current M17 status](STATUS.md), [M17 UI staging evidence](evidence/M17_STANDARD_WINDOW_SCROLLBAR_STAGING_UPDATES_2026-10-23.json), [M17.5 update evidence](evidence/M17.5_TREATMENT_PROGRESS_STAGING_UPDATE_2026-10-23.json), and [M17.2 update evidence](evidence/M17.2_PATIENT_RECORD_STAGING_UPDATE_2026-10-23.json).

The M15 platform selects the host's existing clinic route/role/media contract from exactly one supported `clinic.app.*` capability in a verified package, so new M17 IDs do not need per-ID host source entries. Source-worktree staging readback at sequence 55 covers all seven previously staged M17 IDs and preserves prior grants. Those records do not verify the current combined M15 source. A genuinely new host route, family or capability still needs platform code.

The staging evidence was verified against platform implementation reference `94c74ac2f13ed1211c5b2cfa38545f95c002da58`. M15/G15 media exit, current-source Windows verification, and independent review remain open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md). The current M15 integration has not been rebuilt or retested; source-worktree check results below remain historical and are not acceptance of the combined tree.

## M15 source integration

The Follow-ups, Appointments and Calendar app directories, package tooling, fixture tests, release evidence and app plans were imported from source commit `5306b80161542b7a9480b4bb2bc49df6b1218d84` into `codex/milestone-15`. Integration retains M15's generic `clinic.app.*` family routing: verified package capabilities select the existing route and role policy, so these IDs do not require fixed host ID registrations. The import changes no installed-app profile and does not publish or install packages. Integrated M15 build and verification results are recorded below.

## Treatment Progress source integration — 2026-10-23

The completed Treatment Progress app was imported from local source commit `8b506ee3` into the M15 worktree. Its source, pinned SaaS file hashes, M17 package tooling and publication evidence, private fixture, and app plan are now part of M15. The original Treatment Progress source worktree remains intact and was not deleted. M15's generic family authorization is retained; `clinic.app.treatment-progress` selects the existing treatment-progress API family without adding a fixed app-ID registration. Existing signed M17 package bytes and sequence 27 feed entry were not republished. This source integration does not install the app in the user's OS or establish live clinic workflow acceptance.

- App typecheck and package contract tests passed (3/3); production app bundle passed.
- The root Electron production build passed on the Treatment Progress source branch before integration; after integration into M15, the root production build and 517 root tests passed again.
- Focused host/API/distribution tests passed: 251 tests across 8 files.
- Private headless Linux Treatment Progress UI passed 23/23 checks. Evidence and screenshot are retained in `../../artifacts/` under `m17-treatment-progress-private-2026-10-23T04-42-46.120Z`.
- Store installation/runtime health and live clinic acceptance remain open. No live patient data or business write was used.

## Treatment Progress UI update and staging publication — 2026-10-23

Updated `company.dental.treatment-progress.m17` to version 1.0.1 in the existing M15 worktree. Removed the Doctors table column, preserved doctor search/filter, and made long treatment-plan labels wrap and clamp to two lines. The private synthetic fixture now exercises a long plan and asserts both UI requirements.

- App typecheck and build passed; package contract tests passed 4/4.
- Integrated root build passed; `npm test -- --maxWorkers=1` passed 521 tests across 36 files.
- Private headless UI passed 25/25 checks. The first attempt stopped on an older exact SDK bridge expectation; that test was updated for the current `onFilesReceived` bridge method and the failing report was retained alongside the passing rerun.
- Suite-wide public staging verifier passed 26 checks at sequence 34. It verified the current signed packages/grants and isolated install/launch/uninstall of all seven M17 apps.
- The sequence 34 publication advanced both signed catalogue and update policy, denied anonymous and replay publication, returned HTTP 200 for the authorized write, and removed the temporary publisher Worker.
- Exact package, metadata hashes, public readback, and local test artifact links are recorded in [M17.5 update evidence](evidence/M17.5_TREATMENT_PROGRESS_STAGING_UPDATE_2026-10-23.json). The private screenshot shows the plan on two lines with the Doctors column absent.
- No authenticated Store profile, live clinic route, business write, GitHub Action, production target, or user app restart was used. The published package requires the user's running desktop to trust the pinned M17 signer before Store installation.

## 2026-10-23 integrated M15 verification

- `npm run build` passed: root typecheck, Vite production build and Electron TypeScript compilation.
- `npm test -- --maxWorkers=2` passed: 517 tests across 36 files.
- Follow-ups, Appointments and Calendar each passed their app `npm run typecheck`, `npm run build`, and package tests (3, 4 and 3 tests respectively).
- Private headless UI fixtures passed Follow-ups 20/20, Appointments 21/21 and Calendar 16/16 (57 assertions total). They used ephemeral test signatures and in-memory synthetic services; no live clinic records or business writes were used. Reports/screenshots are retained in `../../artifacts/` with timestamp `2026-10-23T04-19-48.893Z`, `04-19-56.721Z` and `04-20-01.411Z`.
- The first UI attempt stopped before loading Follow-ups because a clean checkout had no package `dist` bundle; building the package resolved that setup issue. A subsequent assertion expected the pre-M16 SDK bridge method list. It was updated to include M16's mediated `onFilesReceived` method, which passes bounded file-selection metadata through the host; the bridge still exposes no credential getter. All three private fixtures then passed.
- The app package TypeScript configs include Node ambient types because the shared SDK contract references the host-owned `FileSelection` type. This allows typechecking the shared contract without changing app behavior.

The new packages' local `dist/` directories were created for the private checks and are disposable build outputs. The M15 build refreshed the on-disk OS bundle; the user's running app was left open and will load the update on a later full launch. No Store profile, signing key, or installed package state was changed by these checks.

## Staging cleanup — 2026-10-23

At the user's direction, the signed staging catalogue and update policy advanced from sequence 29 to 30. The sequence 30 feed retains five M17 dental IDs and three non-dental sample IDs. Eleven earlier dental IDs were removed from the feed and 14 corresponding R2 package objects (11,092,706 bytes) were deleted. The R2 listing and public signed feed were read back; six M17 package objects remain, including Appointments 1.0.0 and 1.0.1. The temporary nonce-protected Worker was removed. This does not uninstall previously installed packages from a device. See the [cleanup evidence](evidence/m17-staging-legacy-app-cleanup-seq30-2026-10-23.json).

## Per-app evidence ledger

| Submilestone | M17 app source and SaaS behavior pin | Local app checks | SDK/broker checks | New-ID staging acceptance | New-ID signed release and Store | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Imported SaaS source and follow-up workflow; source worktree used the pinned Dental SaaS revision | Existing local checks plus source-worktree UI check; combined M15 tree not retested | Existing SDK route, permission and retry fixture coverage | Signed 1.0.2 package readback passed at sequence 46; previous grants preserved | `company.dental.followups.m17` / 1.0.2; current update not installed through authenticated Store | SOURCE UI UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |
| [M17.2 Patient Record](M17.2_PATIENT_RECORD_PLAN.md) | SaaS production `f44d3e30ca6f79cba61e32601c53d58826500201`; 121/128 vendored files byte-identical, seven SDK adapters documented | Source-worktree UI fixture passed; current combined M15 tree not retested | Synthetic fixture covers SDK-only access, role denial, retry, media and timeline | Signed 1.0.5 package readback passed at sequence 55; six release grants retained | `company.dental.patient-record.m17` / 1.0.5; authenticated install/live acceptance open | STANDARD PAGE UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Imported source; pinned SaaS revision retained | Source-worktree UI fixture passed; combined M15 tree not retested | Existing SDK route, role, draft and retry fixture coverage | Signed 1.0.3 package readback passed at sequence 47; prior grants retained | `company.dental.appointments.m17` / 1.0.3; authenticated install/live acceptance open | SOURCE UI UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |
| [M17.4 Work Entry](M17.4_WORK_ENTRY_PLAN.md) | SaaS production `f44d3e30ca6f79cba61e32601c53d58826500201` pinned | Source-worktree app and UI checks passed; combined M15 tree not retested | Existing focused SDK/route/policy evidence | Signed 1.0.2 package readback passed at sequence 48 | `company.dental.work-entry.m17` / 1.0.2; authenticated install/live acceptance open | SOURCE UI UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Source integrated from `8b506ee3`; pinned SaaS revision remains recorded | Historical checks cover no Doctors column and two-line plans; current compact-table changes and combined tree not tested | Existing route and exact API grant evidence remains historical | Signed 1.0.4 readback passed at sequence 50; local source is changed and not signed | `company.dental.treatment-progress.m17` / signed 1.0.4; local 1.0.5 | SOURCE UPDATE IMPORTED; LOCAL 1.0.5 UNVERIFIED |
| [M17.6 Lab Tracker](M17.6_LAB_TRACKER_PLAN.md) | Existing app source in M15 base; SaaS pin `f44d3e30ca6f79cba61e32601c53d58826500201` | Earlier app typecheck, 4 contract tests, app build, 13 private UI checks, root build, 520 root tests and docs check passed on the implementation source | Existing M15 family routes; synthetic workflow and role-denial fixture passed | Historical checks PASS; verification on current Finance/Staff-integrated tree pending | `company.dental.lab-tracker.m17` / 1.0.0; not signed or published | SOURCE PRESENT; CURRENT TREE UNVERIFIED |
| [M17.7 Finance](M17.7_FINANCE_PLAN.md) | M17.7.1–M17.7.8 source integrated against production commit `f44d3e30ca6f79cba61e32601c53d58826500201` | NOT RUN — tests, builds, and verification intentionally omitted | NOT RUN | NOT RUN — no staging or live app activity | `company.dental.finance.m17` / 1.7.0, one package; sequence 1.0.0–1.7.0 | SOURCE INTEGRATED — UNVERIFIED; all eight children remain unverified |
| [M17.8 Patient Payments](M17.8_PATIENT_PAYMENTS_PLAN.md) | Scope absorbed into Finance child M17.7.2 | Not applicable | Not applicable | Not applicable | No separate package or ID | SUPERSEDED — no implementation |
| [M17.9 Staff](M17.9_STAFF_PLAN.md) | Local source integrated from `codex/staff-app-work`; SaaS pin `a3b116c64df826cbb5b66bc09305f81bf06cd463` | No build/tests or runtime/API acceptance run | Pending | Not signed or published | `company.dental.staff.m17` / 1.0.0; media grants unissued | SOURCE IMPLEMENTED; VERIFICATION PENDING |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | SaaS source `f0d059d36540b4b6907cace089085ce0df62d454` | Source-worktree UI and package checks passed; combined M15 tree not retested | Synthetic SDK-only, role, conflict and retry evidence remains historical | Signed 1.0.5 package readback passed at sequence 53; six grants retained | `company.dental.m17.treatment-protocols` / 1.0.5; authenticated Store install/runtime open | SOURCE UI UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Imported source; SaaS revision `fd2cc5439694ce844362c9dec8a6267378d11381` | Source-worktree UI fixture passed; combined M15 tree not retested | SDK-only routes and calendar control evidence remain historical | Signed 1.0.3 package readback passed at sequence 54 | `company.dental.calendar.m17` / 1.0.3; authenticated install/live acceptance open | STANDARD PAGE UPDATE PUBLISHED; COMBINED TREE UNVERIFIED |

## Prior Follow-ups package evidence

- The earlier package was signed and published as company.dental.followups version 1.1.0 at staging sequence 23. Its SHA-256 was 4f22e9eaaa30e0a82d551d0c9c04f564aba1899c6a7db7eebcd15885c042bb3a, size 1,218,978 bytes, and payload digest 823be47d143cd09b96176a209ba4ef76aa6e1f0ff7dd02ca6a1448bf558fb429.
- It installed and opened in a private Linux profile and recorded the matching runtime health receipt. The app read its permitted worklist; no business record was changed.
- Store artifact: [followups-staging-install-2026-10-22T15-59-21.135Z.json](../../artifacts/followups-staging-install-2026-10-22T15-59-21.135Z.json). Private workflow artifact: [m17-followups-private-2026-10-22T15-43-15.200Z.json](../../artifacts/m17-followups-private-2026-10-22T15-43-15.200Z.json).
- This is prior-identity evidence. Its publication/install records remain in this repository, while the R2 package object was removed at sequence 30. Repeat release/install verification for the new M17 ID and version 1.0.0.

## Appointments local checkpoint evidence

- SaaS source pin: f0d059d36540b4b6907cace089085ce0df62d454. Existing M17 source in the current worktree is retained.
- Typecheck, package build, four package contract tests, root build, and the private Linux workflow passed. The 20 checks cover SDK routes/no credential getter, active doctors, readiness, draft recovery, overlap warning, booking, status, reschedule, row-version conflicts, same-operation lost-receipt retry, revocation, and host capability denial.
- The private test fixture package company.dental.appointments 1.1.0 was signed with an ephemeral test-only key and served from the private fixture. It is not a staging release and must not be published. The passing report is [m17-appointments-private-2026-10-22T16-45-04.538Z.json](../../artifacts/m17-appointments-private-2026-10-22T16-45-04.538Z.json); the matching screenshot is [m17-appointments-private-2026-10-22T16-45-04.538Z.png](../../artifacts/m17-appointments-private-2026-10-22T16-45-04.538Z.png).
- The prior staging preflight stopped before authenticated app reads/writes, package signing, publication, or Store installation because an authorized protected clinic credential was unavailable. This does not block local implementation. A protected credential is required for new-ID live synthetic staging acceptance.
- New release: assign a unique M17 ID, set package version 1.0.0, recompute package hash/grants, sign with the new suite key, and verify Store installation. No staging or production mutation occurred during the recorded local checkpoint.

## Treatment Protocols local checkpoint evidence

- App ID/version: `company.dental.m17.treatment-protocols` / `1.0.0`. SaaS source pin: `f0d059d36540b4b6907cace089085ce0df62d454`; full imported-file hashes and UI adjustments are in [SOURCE_IMPORT.json](../../apps/dental-apps/company.dental.m17.treatment-protocols/SOURCE_IMPORT.json).
- App typecheck and production bundle passed. The app package contract suite passed 3/3 checks; the API contract suite passed 3/3 checks. Fourteen private headless Linux UI checks passed for signed test-fixture identity, SDK surface, list route, module selection, create, stage/pricing/settings save, conflict refresh, lost-response same-key reconciliation, soft retirement and role denial before business API calls.
- Evidence: [private run report](evidence/m17-treatment-protocols-private-2026-10-22T20-33-14.911Z.json) and [initial catalogue screenshot](evidence/m17-treatment-protocols-private-2026-10-22T20-33-14.911Z.png). The report's package digest and size describe an ephemeral test-key fixture and are not the M17 release package.
- Staging release evidence: [sequence 29 publication and public readback](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json) verifies the M17 signature, package bytes, catalogue row and exact API grant; the prior entries were unchanged at publication time. The temporary Cloudflare publisher Worker returned HTTP 200, denied anonymous/replayed publication, and was deleted.
- No authorized clinic credential, live clinic API, or Store installation was used. The app is present in the public staging catalogue; user-device Store installation and runtime health remain unverified.

## Evidence rules and separate gates

Record exact M17 source, SaaS revision, new package ID/version/hash, signer identity, catalogue sequence, protected staging environment, synthetic fixture, commands, outcome, and limitations. Do not record secrets or patient payloads. Retain failed attempts and add superseding results.

G17 staging evidence does not close M15/G15 or later integrated/device acceptance. Recheck platform-dependent app behavior against the final verified M15 source. M17 staging never authorizes production publication.


## Standard Window UI and navigation worktree integration — 2026-10-23

Imported commits `431ee411`, `f19eaaa0` and `9bb5463d` from `codex/dental-ap-ui-enhance` into `codex/milestone-15`. The changes add app-owned Back/Forward page history through the shared SDK/runtime, align M17 apps with the shared Standard Window page/scroll presentation, and correct Calendar and Patient Record insets. Source-worktree evidence is retained in [M12.4 navigation](../milestone-12-os-ui-experience/evidence/M12_4_APP_BUNDLE_NAVIGATION_2026-10-23.json), [M17 shared UI staging updates](evidence/M17_STANDARD_WINDOW_UI_STAGING_UPDATES_2026-10-23.json), [M17 scrollbar staging updates](evidence/M17_STANDARD_WINDOW_SCROLLBAR_STAGING_UPDATES_2026-10-23.json), and [M17 page inset updates](evidence/M17_REST_APPS_STANDARD_SCROLL_ALIGNMENT_2026-10-23.json).

The source-worktree records signed releases through sequence 55 and private UI checks. They are historical evidence for that worktree, not verification of this combined M15 tree. Treatment Progress remains on signed source version 1.0.4 at sequence 50; this M15 tree is local version 1.0.5 because it preserves the newer compact-table request. The combined source has not been built or tested, and the local Treatment Progress package has not been signed or published.
