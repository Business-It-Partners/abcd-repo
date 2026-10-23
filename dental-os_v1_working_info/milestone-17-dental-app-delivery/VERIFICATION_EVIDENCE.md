# M17 Verification Evidence

**Status:** M17.10 Treatment Protocols is published under its new ID at version 1.0.0 and publicly verified at staging catalogue sequence 29 using the M17 suite signer. Local private checks pass; Store installation and app-specific runtime health remain open. The key's public identity is pinned in source trust and has signed the current staging feed. Other apps retain their own acceptance status in the ledger. G17 remains open.

The M15 platform now selects the host's existing clinic route/role/media contract from exactly one supported `clinic.app.*` capability in a verified package, so new M17 IDs do not need per-ID host source entries. Public staging readback at sequence 29 verified the signed packages and exact API grants for Follow-ups, Appointments, Treatment Progress, Calendar and Treatment Protocols. That feed/package verification does not prove Store installation or app runtime health; a new host route, family or capability still needs platform code.

The current platform implementation reference is 94c74ac2f13ed1211c5b2cfa38545f95c002da58. M15/G15 media exit, current-source Windows verification, and independent review remain open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md).

## Per-app evidence ledger

| Submilestone | M17 app source and SaaS behavior pin | Local app checks | SDK/broker checks | New-ID staging acceptance | New-ID signed release and Store | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Current source in this worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Prior typecheck, package build, 20 private workflow checks, root build, and unit suite passed | Prior fixture verified SDK routes, capability/role denial, conflict, same-key retry, revocation, and no credential getter | Staging package and API grant for `company.dental.followups.m17` / 1.0.0 verified from public feed; install/runtime evidence remains in its owning record | Signed package observed at sequence 29; Store install and app runtime health not checked here | IMPLEMENTING — FEED VERIFIED |
| M17.2 Patient Record | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED — queued after M17.1 and M17.3 |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Current source in this worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Typecheck, package build, four package tests, root build, and 20 private workflow checks passed | Fixture checked SDK-only routes, capability denial, doctor filters, draft safety, conflicts, same-key retry, revocation, and no credential getter | Current `company.dental.appointments.m17` / 1.0.1 package and grant verified from public feed; policy retains its 1.0.0 grant | Signed current package observed at sequence 29; Store install and app runtime health not checked here | IMPLEMENTING — FEED VERIFIED |
| M17.4 Work Entry | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.5 Treatment Progress | Signed staging package observed; local source/SaaS pin not reconciled here | Pending in this worktree | Signed package and API grant verified from public feed | Package present in sequence 29 | `company.dental.treatment-progress.m17` / 1.0.0; install/runtime acceptance unverified here | PLANNED — FEED VERIFIED |
| M17.6 Lab Tracker | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.7 Finance | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.8 Patient Payments | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.9 Staff | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| [M17.10 Treatment Protocols](M17.10_TREATMENT_PROTOCOLS_PLAN.md) | Fresh app; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | App typecheck/build, 3 package checks, 3 API contract tests, 14 private UI checks, workspace build and 510 workspace tests pass | Synthetic signed fixture confirms SDK-only GET/POST/PUT, role denial, row-version conflict and original idempotency-key retry | Signed new-ID package and feed published, read back and verified at sequence 29; no live clinic data used | `company.dental.m17.treatment-protocols` / 1.0.0; M17 signature verified; Store installation/runtime health remain open | IMPLEMENTING — STAGING PUBLISHED |
| M17.11 Calendar | Signed staging package observed; local source/SaaS pin not reconciled here | Pending in this worktree | Signed package and API grant verified from public feed | Package present in sequence 29 | `company.dental.calendar.m17` / 1.0.0; install/runtime acceptance unverified here | PLANNED — FEED VERIFIED |

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

## Treatment Protocols local checkpoint evidence

- App ID/version: `company.dental.m17.treatment-protocols` / `1.0.0`. SaaS source pin: `f0d059d36540b4b6907cace089085ce0df62d454`; full imported-file hashes and UI adjustments are in [SOURCE_IMPORT.json](../../apps/dental-apps/company.dental.m17.treatment-protocols/SOURCE_IMPORT.json).
- App typecheck and production bundle passed. The app package contract suite passed 3/3 checks; the API contract suite passed 3/3 checks. Fourteen private headless Linux UI checks passed for signed test-fixture identity, SDK surface, list route, module selection, create, stage/pricing/settings save, conflict refresh, lost-response same-key reconciliation, soft retirement and role denial before business API calls.
- Evidence: [private run report](evidence/m17-treatment-protocols-private-2026-10-22T20-33-14.911Z.json) and [initial catalogue screenshot](evidence/m17-treatment-protocols-private-2026-10-22T20-33-14.911Z.png). The report's package digest and size describe an ephemeral test-key fixture and are not the M17 release package.
- Staging release evidence: [sequence 29 publication and public readback](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json) verifies the M17 signature, package bytes, catalogue row, exact API grant and unchanged prior entries. The temporary Cloudflare publisher Worker returned HTTP 200, denied anonymous/replayed publication, and was deleted.
- No authorized clinic credential, live clinic API, or Store installation was used. The app is present in the public staging catalogue; user-device Store installation and runtime health remain unverified.

## Evidence rules and separate gates

Record exact M17 source, SaaS revision, new package ID/version/hash, signer identity, catalogue sequence, protected staging environment, synthetic fixture, commands, outcome, and limitations. Do not record secrets or patient payloads. Retain failed attempts and add superseding results.

G17 staging evidence does not close M15/G15 or later integrated/device acceptance. Recheck platform-dependent app behavior against the final verified M15 source. M17 staging never authorizes production publication.
