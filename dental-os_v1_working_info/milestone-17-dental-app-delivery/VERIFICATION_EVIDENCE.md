# M17 Verification Evidence

**Status:** M17.1 Follow-ups passed its recorded Linux staging acceptance on 2026-10-22. M17.2–M17.11 have no M17 acceptance evidence yet; G17 remains open.

Prior M14 results are references, not M17 passes:

- Eleven-app synthetic package validation passed on OS 8af1d14de62d0773b4f4c12369d499eabf08c677 with SaaS source d66a3c494cb96540c1fea908282c9b08919001d2: [workflow 39702783617](https://github.com/Business-It-Partners/dental-os/actions/runs/39702783617).
- Packaged Follow-ups broker reference proof passed on OS ec32273dfb46705e5ae6150f652cdbce047c2646 with SaaS source f0d059d36540b4b6907cace089085ce0df62d454: [workflow 39737035903](https://github.com/Business-It-Partners/dental-os/actions/runs/39737035903). It used an in-memory synthetic Worker transport, not Cloudflare staging.
- The current M15 source is 94c74ac2f13ed1211c5b2cfa38545f95c002da58. Its platform media exit remains incomplete, current-source Windows verification remains open, and independent review remains open; see [M15 status](../milestone-15-platform-closeout-and-integration/STATUS.md).

## Per-app evidence ledger

| Submilestone | Source and package pins | Source/UI checks | Broker/SDK and negative checks | Staging business acceptance | Signed staging release and Store install | Status |
| --- | --- | --- | --- | --- | --- | --- |
| [M17.1 Follow-ups](M17.1_FOLLOWUPS_PLAN.md) | OS `410a18a6`; M14 `093cd963`; SaaS `f0d059d`; staged `1.1.0`, SHA-256 `4f22e9ea…c042bb3a` | Typecheck, package build, private UI acceptance (20 checks), production build, and unit suite passed | SDK broker routes, role/tenant denial, 409 conflict, idempotent unknown-outcome retry, revocation, and no credential getter passed in the synthetic service fixture | Private Linux staging profile signed in; app read its permitted worklist; no business writes | Signed package published at catalogue sequence 23; Store install, real module launch, and matching health receipt passed | COMPLETE for recorded Linux staging scope |
| M17.2 Patient Record | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.3 Appointments | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.4 Work Entry | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.5 Treatment Progress | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.6 Lab Tracker | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.7 Finance | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.8 Patient Payments | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.9 Staff | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.10 Treatment Protocols | Pending | Pending | Pending | Pending | Pending | PLANNED |
| M17.11 Calendar | Pending | Pending | Pending | Pending | Pending | PLANNED |

Each entry must identify exact OS/SaaS source revisions, package ID/version/hash, signed catalogue sequence, protected staging environment and synthetic fixture, commands or manual procedure, outcome, relevant logs/screenshots, and limitations. Do not record secrets or patient payloads. Keep failed attempts and add superseding results rather than rewriting them.

## M17.1 Follow-ups acceptance detail

- Source/package identity, checksums, commands, and test coverage: [M17.1 acceptance record](M17.1_FOLLOWUPS_PLAN.md).
- The private synthetic-service UI artifact reports an ephemeral test package hash `54309313…a99` and payload digest `823be47d…fb429`; that package was not published. The signed staging package is a separate artifact with SHA-256 `4f22e9ea…c042bb3a`, the same payload digest, and catalogue sequence 23.
- Staging Store acceptance artifact: [followups-staging-install-2026-10-22T15-59-21.135Z.json](../../artifacts/followups-staging-install-2026-10-22T15-59-21.135Z.json). The private app-workflow artifact is [m17-followups-private-2026-10-22T15-43-15.200Z.json](../../artifacts/m17-followups-private-2026-10-22T15-43-15.200Z.json).
- This evidence is Linux/private-profile staging acceptance only. It does not close G17, G14, M15/G15, G20, or G21. Patient Record and Staff media workflows still depend on the separate M15 platform media exit.

## Separate gates

M17/G17 staging evidence does not close G14, M15/G15, M20/G20, or G21. After M15 is closed, rerun the app-specific integrated checks affected by the final platform source and update the G14 disposition. Staging never authorizes production publication.
