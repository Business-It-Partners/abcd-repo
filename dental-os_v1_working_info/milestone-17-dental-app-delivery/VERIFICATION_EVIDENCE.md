# M17 Verification Evidence

**Status:** Follow-ups, Appointments, Calendar, Treatment Progress and Treatment Protocols source is integrated in M15. Follow-ups, Appointments and Calendar have signed staging releases and authenticated private-profile Store install/open with exact-payload runtime health at sequences 24, 26 and 28. Treatment Progress 1.0.0 is published at sequence 27; its app checks and private UI acceptance passed, while Store installation/runtime health remain open. Treatment Protocols 1.0.0 is published at sequence 29; Store installation/runtime health remain open. Full live clinic role/tenant/workflow acceptance and deployment of the new trust pin to the user's running desktop remain open. G17 remains open.

The M15 platform selects the host's existing clinic route/role/media contract from exactly one supported `clinic.app.*` capability in a verified package, so new M17 IDs do not need per-ID host source entries. Public staging readback verified signed packages and exact API grants for Follow-ups, Appointments, Treatment Progress, Calendar and Treatment Protocols. Follow-ups, Appointments and Calendar also have separate private-profile Store install/open and exact-payload health evidence. Treatment Progress and Treatment Protocols still need Store/runtime verification. A genuinely new host route, family or capability still needs platform code.

The staging evidence was verified against platform implementation reference `94c74ac2f13ed1211c5b2cfa38545f95c002da58`. M15/G15 media exit, current-source Windows verification, and independent review remain open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md). The current M15 integration build is recorded below after verification.

## M15 source integration

The Follow-ups, Appointments and Calendar app directories, package tooling, fixture tests, release evidence and app plans were imported from source commit `5306b80161542b7a9480b4bb2bc49df6b1218d84` into `codex/milestone-15`. Integration retains M15's generic `clinic.app.*` family routing: verified package capabilities select the existing route and role policy, so these IDs do not require fixed host ID registrations. The import changes no installed-app profile and does not publish or install packages. Integrated M15 build and verification results are recorded below.

## Treatment Progress source integration — 2026-10-23

The completed Treatment Progress app was imported from local source commit `8b506ee3` into the M15 worktree. Its source, pinned SaaS file hashes, M17 package tooling and publication evidence, private fixture, and app plan are now part of M15. The original Treatment Progress source worktree remains intact and was not deleted. M15's generic family authorization is retained; `clinic.app.treatment-progress` selects the existing treatment-progress API family without adding a fixed app-ID registration. Existing signed M17 package bytes and sequence 27 feed entry were not republished. This source integration does not install the app in the user's OS or establish live clinic workflow acceptance.

- App typecheck and package contract tests passed (3/3); production app bundle passed.
- The root Electron production build passed on the Treatment Progress source branch before integration; after integration into M15, the root production build and 517 root tests passed again.
- Focused host/API/distribution tests passed: 251 tests across 8 files.
- Private headless Linux Treatment Progress UI passed 23/23 checks. Evidence and screenshot are retained in `../../artifacts/` under `m17-treatment-progress-private-2026-10-23T04-42-46.120Z`.
- Store installation/runtime health and live clinic acceptance remain open. No live patient data or business write was used.

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
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Imported source in M15 worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | App typecheck/build and 3 package tests passed after import; private UI fixture passed 20/20; root build and unit tests passed | Fixture verified SDK routes, capability/role denial, conflict, same-key retry, revocation, and no credential getter | `company.dental.followups.m17` / 1.0.0 published at sequence 24; exact grant/signature verified | Authenticated private-profile Store install/open and exact-payload health passed; no business writes; full live role/tenant/workflow acceptance open | IMPLEMENTING — IMPORTED; PRIVATE STORE HEALTH VERIFIED |
| M17.2 Patient Record | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED — queued after M17.1 and M17.3 |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Imported source in M15 worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | App typecheck/build and 4 package tests passed after import; private UI fixture passed 21/21; root build and unit tests passed | Fixture checked SDK-only routes, capability denial, doctor filters, draft safety, conflicts, same-key retry, revocation, and no credential getter | Current `company.dental.appointments.m17` / 1.0.1 published at sequence 26; 1.0.0 grant retained | Authenticated private-profile Store install/open and exact-payload health passed; no business writes; full live role/tenant/workflow acceptance open | IMPLEMENTING — IMPORTED; PRIVATE STORE HEALTH VERIFIED |
| M17.4 Work Entry | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Source integrated from commit `8b506ee3`; pinned Dental SaaS revision recorded in `SOURCE_IMPORT.json` | App typecheck, build and 3 package tests passed; private UI 23/23; host family route and focused tests verified | M15 family-capability routing and exact clinic API grant verified in the app fixture | Signed package, catalogue and policy verified at sequence 27 | `company.dental.treatment-progress.m17` / 1.0.0; Store/runtime acceptance remains open | IMPLEMENTED — SOURCE INTEGRATED; STAGING PUBLISHED |
| M17.6 Lab Tracker | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.7 Finance | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.8 Patient Payments | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.9 Staff | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Fresh app; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | App typecheck/build, 3 package checks, 3 API contract tests, 14 private UI checks, workspace build and 510 workspace tests pass | Synthetic signed fixture confirms SDK-only GET/POST/PUT, role denial, row-version conflict and original idempotency-key retry | Signed new-ID package and feed published, read back and verified at sequence 29; no live clinic data used | `company.dental.m17.treatment-protocols` / 1.0.0; M17 signature verified; Store installation/runtime health remain open | IMPLEMENTING — STAGING PUBLISHED |
| [M17.11 Calendar](M17.11_CALENDAR_PLAN.md) | Imported source; SaaS `fd2cc5439694ce844362c9dec8a6267378d11381` | App typecheck/build and 3 package tests passed after import; private UI fixture passed 16/16; root build and unit tests passed | SDK-only ClinicClient routes, row versions and idempotency; no task edit route exists in pinned SaaS contract | `company.dental.calendar.m17` / 1.0.0 published at sequence 28; signature, bytes and grant verified | Authenticated private-profile Store install/open and exact-payload health passed; startup reads only, no business writes; full live role/tenant/workflow acceptance open | IMPLEMENTING — IMPORTED; PRIVATE STORE HEALTH VERIFIED |

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
