# Dental OS — Principles and Invariants

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

The following requirements govern implementation and review:

1. **INV-01 Hosted environment:** Windows/Linux retain host authority; no replacement kernel or drivers.
2. **INV-02 First-party forever:** only approved company apps execute; no third-party publishing or arbitrary sideloading.
3. **INV-03 SaaS authority:** server-derived identity, clinic, permissions, business validation, transactions, and audit remain authoritative. Reuse `fewa_demo` resources; all roadmap backend work is Cloudflare staging-only with unchanged existing business routes. New OS services use `/v1/dental-os/...`; production promotion is a separate authorization. See [policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
4. **INV-04 Independent delivery:** app changes do not require rebuilding the OS when contracts remain compatible.
5. **INV-05 Explicit ownership:** shell owns presentation; trusted platform owns sessions/packages/host mediation; apps own UI and unfinished workflow state.
6. **INV-06 Verified code:** execute only installed, compatible, integrity-checked approved packages; no unverified runtime executable downloads.
7. **INV-07 Bounded privilege:** app identity is platform-bound; every privileged request is runtime-validated and capability-checked.
8. **INV-08 Credentials stay private:** apps receive session access, never passwords/refresh tokens or unrestricted bearer-token retrieval.
9. **INV-09 Safe transitions:** switching/minimizing preserves work; update/uninstall/exit explicitly handles dirty state.
10. **INV-10 Truthful outcomes:** download completion is not installation readiness; network timeout is not proof a write failed; demo state is not durability.
11. **INV-11 Privacy by default:** no persistent patient cache or hidden offline queue; redact diagnostics and isolate user state.
12. **INV-12 Recoverable delivery:** stage, verify, atomically activate, and reconcile interruptions; rollback is compatibility-checked.
13. **INV-13 Evidence scope:** source is reality; retained tests/runtime evidence is proof; platform/user acceptance is never inferred.
14. **INV-14 Respect live work:** private-display automation only; never disrupt the user's running OS to verify changes.

Changes to architecture require an explicit decision record. INV-02 is a permanent product boundary, not an extensibility roadmap item.
