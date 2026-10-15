# Dental OS — Architecture Decision Register

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Accepted means the agreed product direction, not that implementation exists. Conditional choices need evidence before promotion.

| ADR | Decision | State | Consequence / document |
| --- | --- | --- | --- |
| ADR-001 | Hosted Windows/Linux desktop | Accepted | host remains system authority; 02/16 |
| ADR-002 | First-party apps only for product lifetime | Permanent product constraint | no external publishing/sideloading; 02/19 |
| ADR-003 | Electron/React/TypeScript | Accepted | no required Flutter/Rust runtime; 16 |
| ADR-004 | Existing Dental SaaS remains business authority | Accepted | backend additions within existing system; 04/11 |
| ADR-005 | Independently released self-contained web bundles | Accepted | package/SDK/API version governance; 08/10 |
| ADR-006 | Isolated app contexts and platform-bound identity | Accepted requirement | exact composition gated at M03; 07 |
| ADR-007 | WebContentsView rendering | Candidate, M03 proof required | native stacking/composition must be proven; 07 |
| ADR-008 | Typed internal SDK and credential-mediating API broker | Accepted | no generic authenticated fetch/token getters; 11 |
| ADR-009 | One login using existing Firebase/Worker authority | Accepted | desktop flow/storage proof required; 12 |
| ADR-010 | R2 release storage + existing Cloudflare catalogue | Accepted direction | dedicated bucket, exact endpoints/metadata frozen in M07; 09 |
| ADR-011 | Staged, pinned-version, atomic updates | Accepted | compatibility-aware rollback; 10 |
| ADR-012 | Online-dependent business operations; no persistent patient cache | Accepted baseline | privacy disk checks; 13 |
| ADR-013 | No general app-to-app communication | Accepted baseline | backend coordination only; 11/19 |
| ADR-014 | Signed metadata/packages, freshness and key lifecycle | Accepted requirement | wire format/algorithm frozen in M06/M07; 08/14 |
| ADR-015 | Ed25519 signatures | Candidate | reference precedent; choose canonical schema and tooling in M06 |
| ADR-016 | Windows/Linux installer/update formats | Open release decision | select supported matrix before M11 acceptance; 16 |
| ADR-017 | Reuse fewa_demo infrastructure; staging-only backend execution | Accepted execution constraint | verify repository/branch/GitHub environment/resource mapping; production changes/promotion separately authorized; 09 |
| ADR-018 | New OS APIs under /v1/dental-os; existing business routes unchanged | Accepted route boundary | additive services with explicit authorization; prefix is not deployment isolation; 09/11 |

New ADRs identify problem, options, decision, tradeoffs, affected invariants/contracts, migration/recovery, evidence and milestone. Record supersession explicitly. Do not silently turn a candidate into an accepted/proven implementation.

## ADR-019 — GitHub Windows CI during milestones; device testing after M11

Accepted user decision, 2026-10-15. Automated Windows evidence permits milestone progression when applicable gates pass; native physical-device acceptance remains a separate mandatory gate before final product release. Record CI limitations and deferred scenarios. main plus started milestone branches and immutable identified checkpoints provide regression traceability. No claim that hosted-runner automation certifies a physical device.
