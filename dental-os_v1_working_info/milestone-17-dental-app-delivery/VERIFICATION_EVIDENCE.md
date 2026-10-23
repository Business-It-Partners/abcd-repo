# M17 Verification Evidence

**Status:** Follow-ups 1.0.0 and Appointments 1.0.0 were published at sequences 24 and 25; the current Appointments feed entry is 1.0.1 at sequence 26. Treatment Progress 1.0.0 was published at sequence 27 and its public signed metadata and package bytes verify. Treatment Progress has not been installed from the Store, and no live clinic workflow was run. Eight apps remain unstarted and G17 remains open.

The current platform implementation reference is 94c74ac2f13ed1211c5b2cfa38545f95c002da58. M15/G15 media exit, current-source Windows verification, and independent review remain open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md).

## Per-app evidence ledger

| Submilestone | M17 app source and SaaS behavior pin | Local app checks | SDK/broker checks | New-ID staging acceptance | New-ID signed release and Store | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Retained M17 source; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Typecheck/build, three app tests, 20 private workflow checks, root build, and 458 units passed in release task | Signed package and grants verified; Store install/open and exact-payload automatic health passed | Published sequence 24; private profile used only initial staging reads | `company.dental.followups.m17` / 1.0.0; SHA-256 `48e0bc95de7003abe701fc6b6be5c87ab4643dbb7a1caed98c6858a03e44f197` | Staging release passed; full live workflow acceptance pending |
| M17.2 Patient Record | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED — queued after M17.1 and M17.3 |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Retained M17 source; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Typecheck/build, four app tests, 20 private workflow checks, root build, and 458 units passed in release task | Signed package and grants verified; Store install/open and exact-payload automatic health passed for initial 1.0.0 | First release published sequence 25; current feed entry is 1.0.1 at sequence 26 | `company.dental.appointments.m17`; current SHA-256 `433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03` | Staging release passed; full live workflow acceptance pending |
| M17.4 Work Entry | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| [M17.5 Treatment Progress](M17.5_TREATMENT_PROGRESS_PLAN.md) | Fresh M17 implementation; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | App typecheck/build, three package tests, root build, 460 unit tests, and 23 private Linux checks passed | Fixture verified SDK-only access, GET-only route, family/role denial before dispatch, refresh recovery, malformed-response rejection, and module readiness | Published sequence 27; public signatures, 17-app metadata, downloaded package, and exact grant verified | `company.dental.treatment-progress.m17` / 1.0.0; SHA-256 `d6a0376d71ff6c709f84b936909ab76740331283b6b0f768a59aa14991994f61`; Store install not run | STAGING PUBLISHED; live clinic acceptance not run |
| M17.6 Lab Tracker | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.7 Finance | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.8 Patient Payments | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.9 Staff | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.10 Treatment Protocols | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.11 Calendar | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |

## M17 Follow-ups and Appointments staging release evidence

- Separate task worktree: `/home/master-x/.codex/worktrees/m17-followups-appointments/fewa_business_os`, branch `codex/m17-followups-appointments`, based on M17 baseline `2fc30a849677e889ef248d40595aad233c260ba5`. This current worktree inspected its published-release status read-only; no source files were copied or changed here.
- Suite signer: `company-staging-m17-20261022`; public-key SHA-256 fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`.
- Follow-ups `company.dental.followups.m17` 1.0.0 was published at staging sequence 24; package SHA-256 `48e0bc95de7003abe701fc6b6be5c87ab4643dbb7a1caed98c6858a03e44f197`.
- Appointments `company.dental.appointments.m17` 1.0.0 was published at staging sequence 25; package SHA-256 `35ac80e60e34f1c9e2487c80052278e8978e5997d014eade7fa3d96b9ccfea16`.
- Public catalogue/policy signatures, package bytes, signers, and package-bound grants verified. Authenticated Store installation and Dental OS-managed renderer launch passed in a private disposable profile; each exact published payload reached automatic runtime health after its initial staging read. No business writes occurred. The disposable profile and protected temporary credential file were removed.
- Full live role/tenant/workflow acceptance and deployment of the M17 trust pin to the user's running desktop remain open. Production was not used.

The current public feed also reports `company.dental.appointments.m17` 1.0.1 with package SHA-256 `433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03` at sequence 26. This task verified the current signed catalogue row but did not install that update.

## Prior Follow-ups package evidence

- The earlier package was signed and published as company.dental.followups version 1.1.0 at staging sequence 23. Its SHA-256 was 4f22e9eaaa30e0a82d551d0c9c04f564aba1899c6a7db7eebcd15885c042bb3a, size 1,218,978 bytes, and payload digest 823be47d143cd09b96176a209ba4ef76aa6e1f0ff7dd02ca6a1448bf558fb429.
- It installed and opened in a private Linux profile and recorded the matching runtime health receipt. The app read its permitted worklist; no business record was changed.
- Store artifact: [followups-staging-install-2026-10-22T15-59-21.135Z.json](../../artifacts/followups-staging-install-2026-10-22T15-59-21.135Z.json). Private workflow artifact: [m17-followups-private-2026-10-22T15-43-15.200Z.json](../../artifacts/m17-followups-private-2026-10-22T15-43-15.200Z.json).
- This is prior-identity evidence. Keep the original package immutable; repeat release/install verification for the new M17 ID and version 1.0.0.

## Appointments local checkpoint evidence

- SaaS source pin: f0d059d36540b4b6907cace089085ce0df62d454. Existing M17 source in the current worktree is retained.
- Typecheck, package build, four package contract tests, root build, and the private Linux workflow passed. The 20 checks cover SDK routes/no credential getter, active doctors, readiness, draft recovery, overlap warning, booking, status, reschedule, row-version conflicts, same-operation lost-receipt retry, revocation, and host capability denial.
- The private test fixture package company.dental.appointments 1.1.0 was signed with an ephemeral test-only key and served from the private fixture. It is not a staging release and must not be published. The passing report is [m17-appointments-private-2026-10-22T16-45-04.538Z.json](../../artifacts/m17-appointments-private-2026-10-22T16-45-04.538Z.json); the matching screenshot is [m17-appointments-private-2026-10-22T16-45-04.538Z.png](../../artifacts/m17-appointments-private-2026-10-22T16-45-04.538Z.png).
- The prior staging preflight stopped before authenticated app reads/writes, package signing, publication, or Store installation because an authorized protected clinic credential was unavailable. This does not block local implementation. A protected credential is required for new-ID live synthetic staging acceptance.
- New release: assign a unique M17 ID, set package version 1.0.0, recompute package hash/grants, sign with the new suite key, and verify Store installation. No staging or production mutation occurred during the recorded local checkpoint.

## Evidence rules and separate gates

Record exact M17 source, SaaS revision, new package ID/version/hash, signer identity, catalogue sequence, protected staging environment, synthetic fixture, commands, outcome, and limitations. Do not record secrets or patient payloads. Retain failed attempts and add superseding results.

G17 staging evidence does not close M15/G15 or later integrated/device acceptance. Recheck platform-dependent app behavior against the final verified M15 source. M17 staging never authorizes production publication.


## Treatment Progress local implementation evidence

- SaaS source pin: `Business-It-Partners/dental-saas` at `f0d059d36540b4b6907cace089085ce0df62d454`; exact UI, API, type, and Worker contract file hashes are in [SOURCE_IMPORT.json](../../apps/dental-apps/company.dental.treatment-progress.m17/SOURCE_IMPORT.json).
- New app identity/version: `company.dental.treatment-progress.m17` / `1.0.0`. App typecheck/build and three package contract tests passed. Root build passed; root unit suite passed with 26 files and 458 tests.
- Private Linux acceptance passed 23 checks. It exercised only `GET /v1/treatment-progress` through the SDK, validated projection rendering, search, doctor filtering, pagination, refresh and corrected rows, empty state, Worker failure with stale-row clearing and recovery, malformed response rejection, module readiness, and role denial before the business route was dispatched.
- Report: [m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json](../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.json); screenshot: [m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png](../../artifacts/m17-treatment-progress-private-2026-10-22T19-13-42.533Z.png).
- The private package fixture used an ephemeral test-only key and synthetic in-memory rows. The staging package was then separately signed with the suite key and published. Public catalogue, update-policy, package signature/inventory, and release grant verification passed at sequence 27. No Store install or live clinic workflow was run. See [app verification](../../apps/dental-apps/company.dental.treatment-progress.m17/VERIFICATION.md) and the [publication report](../../artifacts/m17-treatment-progress-staging-publication-2026-10-23.json).
