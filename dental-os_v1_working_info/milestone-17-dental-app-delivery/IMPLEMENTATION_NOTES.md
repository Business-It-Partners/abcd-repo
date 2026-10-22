# M17 Implementation Notes

This file records current M17 decisions, source pins, implementation deltas, and platform dependencies. Verification outcomes belong in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

## Current user-directed scope — 2026-10-22

- M17 stays in the current M15 worktree and branch.
- Reuse the Follow-ups and Appointments app source already present in this M17 worktree. Keep those workflows; update their package identities for the M17 release line rather than restarting UI implementation.
- Build the other nine apps from scratch against each maintained Dental SaaS UI/workflow/API module. Pin the exact source revision per app before implementation.
- Assign all eleven apps their own new unique M17 app IDs. Each app's first M17 package is version 1.0.0. Existing preview identities/releases remain unchanged.
- Create one brand-new M17 staging signing key for the suite. Do not search for or reuse an earlier milestone key. Pin its public identity before signing; protect and Git-ignore the private key.
- Keep the current M15 SDK/shared UI as the platform boundary. App code does not own identity, HTTP/media transport, or business data authority.
- Use focused local Linux checks. Do not run GitHub Actions. Staging only; production is excluded.

## App baseline and release ledger

| Submilestone | Existing M17 app source | SaaS behavior source | New M17 release ID/version | Current state |
| --- | --- | --- | --- | --- |
| M17.1 Follow-ups | Existing package source in this worktree; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | TBD / 1.0.0 | Local and prior staging workflow evidence exists under the previous identity; new M17 package acceptance pending |
| M17.2 Patient Record | None; fresh implementation | Pin on start | TBD / 1.0.0 | Queued after M17.1 and M17.3 |
| M17.3 Appointments | Existing package source in this worktree; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | TBD / 1.0.0 | Local implementation and 20 private checks pass; new M17 package acceptance pending |
| M17.4 Work Entry | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.5 Treatment Progress | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.6 Lab Tracker | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.7 Finance | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.8 Patient Payments | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.9 Staff | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.10 Treatment Protocols | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.11 Calendar | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |

The existing Follow-ups 1.1.0 staging release and Appointments 1.1.0 local fixture checkpoint are immutable historical package artifacts under earlier identities. Neither is relabeled as an M17 1.0.0 package. Repackage from the current M17 code under the new ID, recalculate the digest and grants, then perform the required new-identity checks.

## Delivery notes

### 2026-10-22 — Follow-ups checkpoint

The existing Follow-ups package source was completed in this M17 worktree using the pinned Dental SaaS behavior reference and the current app SDK. Local build, typecheck, 20 private UI workflow checks, launch-feedback regression, root production build, and 455 unit tests were recorded as passing. The earlier package was published as version 1.1.0 at staging catalogue sequence 23, installed/opened in a private Linux profile, and received a matching runtime health receipt. That acceptance remains evidence for the earlier package identity; the new M17 ID, 1.0.0 package, suite signature, and Store acceptance remain open.

### 2026-10-22 — Appointments checkpoint

The existing Appointments package source was implemented in this M17 worktree from the pinned SaaS contract and current SDK. The private Linux workflow passed 20 checks. Local acceptance covers date/range/doctor reads, summary, booking, reschedule, statuses, conflicts, original-command retry, revocation, and host capability denial. The SaaS controller's current role-guard limitation is recorded in the app plan. The local 1.1.0 fixture package was not a staging release. Reuse this M17 source under a new unique ID at 1.0.0; do not search for an older signing key.

### Platform and staging dependencies

- The current M15 SDK and shared UI are the platform dependencies. Patient Record X-rays and Staff documents must use the existing host-mediated media APIs.
- Pin the new M17 suite public key in the staging verifier before signing. Do not place private key material in Git.
- A protected authorized clinic credential is separately required for live synthetic staging acceptance. Never substitute chat-provided values.
- M15/G15, independent review, Windows verification, integrated acceptance, and device acceptance remain separately owned gates.
