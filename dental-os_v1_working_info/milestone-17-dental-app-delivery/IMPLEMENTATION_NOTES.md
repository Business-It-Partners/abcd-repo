# M17 Implementation Notes

This file records current M17 decisions, source pins, implementation deltas, and platform dependencies. Verification outcomes belong in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

## Current user-directed scope — 2026-10-23

- The initial M17 source checkpoint remains in the M15 worktree. The user's 2026-10-23 Follow-ups/Appointments package-preparation task is isolated at /home/master-x/.codex/worktrees/m17-followups-appointments/fewa_business_os on codex/m17-followups-appointments at base 2fc30a849677e889ef248d40595aad233c260ba5; the source worktree was read-only.
- Reuse the Follow-ups and Appointments app source already present in this M17 worktree. Keep those workflows; update their package identities for the M17 release line rather than restarting UI implementation.
- Build fresh apps against their maintained Dental SaaS UI/workflow/API modules and pin each source revision. Calendar was started out of order at the user's direction; eight app submilestones remain unstarted.
- Assign all eleven apps their own new unique M17 app IDs. Each app's first M17 package is version 1.0.0. Existing preview identities/releases remain unchanged.
- Use the supplied M17 Ed25519 staging key company-staging-m17-20261022, fingerprint e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709. Its public key is pinned in source trust; the private key remains outside the checkout.
- Keep the current M15 SDK/shared UI as the platform boundary. App code does not own identity, HTTP/media transport, or business data authority.
- Use focused local Linux checks. Do not run GitHub Actions. Staging only; production is excluded.

## App baseline and release ledger

| Submilestone | Existing M17 app source | SaaS behavior source | New M17 release ID/version | Current state |
| --- | --- | --- | --- | --- |
| M17.1 Follow-ups | Existing source copied to the new M17 sibling package directory; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | company.dental.followups.m17 / 1.0.0 | Published at sequence 24; public verification and private Store install/open with exact-payload health passed |
| M17.2 Patient Record | None; fresh implementation | Pin on start | TBD / 1.0.0 | Queued after M17.1 and M17.3 |
| M17.3 Appointments | Existing source copied to the new M17 sibling package directory; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | company.dental.appointments.m17 / 1.0.1 current (1.0.0 first release) | 1.0.1 published at sequence 26; public verification and private Store install/open with exact-payload health passed |
| M17.4 Work Entry | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.5 Treatment Progress | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.6 Lab Tracker | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.7 Finance | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.8 Patient Payments | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.9 Staff | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.10 Treatment Protocols | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.11 Calendar | Fresh implementation in its M17 sibling package directory | `fd2cc5439694ce844362c9dec8a6267378d11381` | company.dental.calendar.m17 / 1.0.0 | Published at sequence 28; public verification and authenticated Store install/open with exact-payload health passed |

The existing Follow-ups 1.1.0 staging release and Appointments 1.1.0 local fixture checkpoint are immutable historical package artifacts under earlier identities. Neither is relabeled as an M17 1.0.0 package. The new M17 siblings have now been packaged and checked locally; keep the old artifacts unchanged.

## Delivery notes

### 2026-10-22 — Follow-ups checkpoint

The existing Follow-ups package source was completed in this M17 worktree using the pinned Dental SaaS behavior reference and the current app SDK. Local build, typecheck, 20 private UI workflow checks, launch-feedback regression, root production build, and 455 unit tests were recorded as passing. The earlier package was published as version 1.1.0 at staging catalogue sequence 23, installed/opened in a private Linux profile, and received a matching runtime health receipt. That acceptance remains evidence for the earlier package identity. The later new-ID 1.0.0 package and Store acceptance are recorded in the 2026-10-23 entries below.

### 2026-10-22 — Appointments checkpoint

The existing Appointments package source was implemented in this M17 worktree from the pinned SaaS contract and current SDK. The private Linux workflow passed 20 checks. Local acceptance covers date/range/doctor reads, summary, booking, reschedule, statuses, conflicts, original-command retry, revocation, and host capability denial. The SaaS controller's current role-guard limitation is recorded in the app plan. The local 1.1.0 fixture package was not a staging release. Reuse this M17 source under a new unique ID at 1.0.0; do not search for an older signing key.

### 2026-10-23 — local Follow-ups and Appointments package preparation

The old preview directories and identities were preserved. Sibling M17 packages were created under company.dental.followups.m17 and company.dental.appointments.m17, each with a 1.0.0 first release. The source import records for both apps match the pinned Dental SaaS revision. The source M17 public key pin was carried into this worktree and its fingerprint was verified. Sequence-23 catalogue and policy metadata were verified with the signer recorded in those envelopes; Follow-ups sequence 24 was signed with M17, then verified and used as the prior snapshot for Appointments sequence 25. Existing catalogue rows, policy controls and exact package API grants were retained. Both initial releases were published and verified through authenticated Store installation, managed-renderer open, and automatic health in a private disposable profile; app startup performed initial reads and no business writes. Details are in [staging release evidence](evidence/M17_STAGING_RELEASE_AND_STORE_CHECK_2026-10-23.json). The original [local package evidence](evidence/M17_LOCAL_PACKAGE_PREPARATION_2026-10-23.json) remains a snapshot from before publication.

### 2026-10-23 — Appointments SaaS UI parity update, version 1.0.1

Following the user's visual comparison, the Appointments app's day-book layout was updated against the pinned SaaS Appointments module. The title/date header, summary cards, day navigation, doctor filter, status columns, and row actions now follow the SaaS view within the managed app shell. Existing SDK routes, standalone booking behavior, status/reschedule safeguards, and app identity remain in place. The original M17 1.0.0 package and grant at sequence 25 remain unchanged.

Appointments 1.0.1 was published to staging at sequence 26 under `company.dental.appointments.m17`, signed with `company-staging-m17-20261022` (fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`). Public metadata/package verification passed; the private Store UI installed/opened the new package and reported health for its exact payload. Typecheck, four package tests, bundle build, 21/21 private workflow checks, root build, and 458 root tests passed. Startup made initial staging reads and no business writes. Full live role/tenant/workflow acceptance and deployment of the trust pin to the user's running desktop remain open; no production release or deployment is claimed. See [Appointments 1.0.1 evidence](evidence/M17_APPOINTMENTS_UI_PARITY_1_0_1_2026-10-23.json).

The root build passed; the root unit suite passed 458/458; Follow-ups package typecheck, three package tests, bundle build, and 20 private Linux workflow checks passed; Appointments package typecheck, four package tests, bundle build, and 20 private Linux workflow checks passed. The private workflow package used a test-only ephemeral key and in-memory synthetic services; it was not either M17 staging artifact.

### 2026-10-23 — Calendar SaaS module and staging release

At the user's direction, Calendar was started out of submilestone order and implemented at `apps/dental-apps/company.dental.calendar.m17` from the pinned Dental SaaS revision `fd2cc5439694ce844362c9dec8a6267378d11381`. The UI uses the shared Bikram Sambat date utilities and SDK broker routes for list, create, completion/reopen, and archive. It preserves the historical preview identity and has its own M17 ID `company.dental.calendar.m17`, first package version `1.0.0`.

Calendar 1.0.0 was published to Cloudflare staging at sequence 28 after verifying the live sequence-27 catalogue and policy with their recorded M17 envelope signers. The M17 key signed the package and sequence-28 metadata; fingerprint `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`. Package SHA-256 is `0d45934d0ae43d0b79b3f1a60d188a865b3da0f509756d6a4a1642eed57d929d`, size 1,084,641 bytes, payload digest `428b90a0f970ff5ca29f245fc00e172bd7965b645615e9848ddb243d0b911c02`; object key `releases/company.dental.calendar.m17/1.0.0/0d45934d0ae43d0b79b3f1a60d188a865b3da0f509756d6a4a1642eed57d929d.dentalpkg`. All prior catalogue rows, policy controls, grants, and historical package bytes were preserved. The short-lived publisher returned HTTP 200, rejected anonymous and replay requests, advanced both signed metadata pointers, and was removed.

Calendar typecheck, 3/3 package tests, bundle build, root production build, 463/463 root unit tests, and 16/16 private synthetic workflow checks passed. The public verifier passed signatures, freshness, exact package hashes/grants, and isolated install/launch/removal for all three current M17 packages. The authenticated Store verifier installed all three releases and checked exact identity, signer, package bytes, and launch grants. The private Store UI installed and opened Calendar in the OS-managed renderer and recorded health for the exact published payload. App startup made staging reads only; no business writes were made. The temporary credential file and profile were removed. Full role/tenant/workflow acceptance and deployment of the trust pin to the user's running desktop remain open. See [Calendar staging evidence](evidence/M17_CALENDAR_STAGING_RELEASE_2026-10-23.json), the [public verifier report](../../artifacts/m17-staging-packages-readonly.json), the [Store service report](../../artifacts/m17-staging-store-install.json), and the [private Store UI report](../../artifacts/m17-staging-live-desktop.json).

### Platform and staging dependencies

- The current M15 SDK and shared UI are the platform dependencies. Patient Record X-rays and Staff documents must use the existing host-mediated media APIs.
- The new M17 suite public key is pinned in this checkout's verifier. Publication happened before the trust pin was deployed with a desktop client update; authenticated Store install/open checks ran from this M17-aware build in a private display/profile. Coordinate client trust deployment before expecting the user's running desktop client to install this release. Do not place private key material in Git.
- A protected authorized clinic credential is separately required for live synthetic staging acceptance. Never substitute chat-provided values.
- M15/G15, independent review, Windows verification, integrated acceptance, and device acceptance remain separately owned gates.
