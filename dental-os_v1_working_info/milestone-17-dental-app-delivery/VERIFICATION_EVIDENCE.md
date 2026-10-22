# M17 Verification Evidence

**Status:** Follow-ups and Appointments have existing M17 code and recorded local workflow checks. Follow-ups also has a prior signed staging-install result under its previous identity. Those results are retained as implementation evidence, but do not complete the new M17 release line. Every app needs a unique new M17 ID and first package version 1.0.0. The new suite Ed25519 key is created and its public key is pinned in source trust; no release has been signed with it, and the trust update is not deployed yet. Staging publication, Store installation, and app-specific acceptance under each new identity remain required. Patient Record is queued after the two existing code checkpoints. G17 remains open.

The M15 platform now selects the host's existing clinic route/role/media contract from exactly one supported `clinic.app.*` capability in a verified package, so the new M17 ID does not need its own host source entry. Local synthetic JSON, typed-operation and media-family fixtures pass on the current uncommitted source; no M17 package has yet exercised this path through the staging Store. A new host route, family or capability still needs platform code.

The current platform implementation reference is 94c74ac2f13ed1211c5b2cfa38545f95c002da58. M15/G15 media exit, current-source Windows verification, and independent review remain open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md).

## Per-app evidence ledger

| Submilestone | M17 app source and SaaS behavior pin | Local app checks | SDK/broker checks | New-ID staging acceptance | New-ID signed release and Store | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | Current source in this worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Prior typecheck, package build, 20 private workflow checks, root build, and unit suite passed | Prior fixture verified SDK routes, capability/role denial, conflict, same-key retry, revocation, and no credential getter | Pending under the new ID; prior staging read used the old identity | New ID TBD / 1.0.0; new signature, publish, install, and runtime health pending | IMPLEMENTING |
| M17.2 Patient Record | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED — queued after M17.1 and M17.3 |
| [M17.3 Appointments](M17.3_APPOINTMENTS_PLAN.md) | Current source in this worktree; SaaS f0d059d36540b4b6907cace089085ce0df62d454 | Typecheck, package build, four package tests, root build, and 20 private workflow checks passed | Fixture checked SDK-only routes, capability denial, doctor filters, draft safety, conflicts, same-key retry, revocation, and no credential getter | Pending; fixture service was synthetic and in memory | New ID TBD / 1.0.0; no staging signature, publish, or Store install recorded | IMPLEMENTING |
| M17.4 Work Entry | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.5 Treatment Progress | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.6 Lab Tracker | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.7 Finance | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.8 Patient Payments | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.9 Staff | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.10 Treatment Protocols | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |
| M17.11 Calendar | Fresh M17 implementation; SaaS source pin pending | Pending | Pending | Pending | New ID TBD / 1.0.0; pending | PLANNED |

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
