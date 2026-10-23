# M17 Implementation Notes

This file records current M17 decisions, source pins, implementation deltas, and platform dependencies. Follow-ups, Appointments, Calendar and Treatment Progress source is now integrated in the M15 worktree; verification outcomes belong in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

## Current user-directed scope — 2026-10-22

- M17 stays in the current M15 worktree and branch.
- Reuse the Follow-ups and Appointments app source already implemented for M17. Keep those workflows; update their package identities for the M17 release line rather than restarting UI implementation. Calendar source was also imported into M15 on 2026-10-23.
- Build the six remaining apps from scratch against their maintained Dental SaaS UI/workflow/API modules. Calendar and Treatment Progress were later imported from completed M17 work, while Treatment Protocols began early as a fresh implementation. Pin the exact source revision per app before implementation.
- Assign all eleven apps their own new unique M17 app IDs. Each app's first M17 package is version 1.0.0. Historical preview IDs and evidence remain in local records; the non-M17 staging releases were removed at sequence 30.
- Use one new M17 staging signing key for the suite. Its public identity is pinned in the source staging trust configuration; the private key stays protected outside the checkout.
- Keep the current M15 SDK/shared UI as the platform boundary. App code does not own identity, HTTP/media transport, or business data authority.
- Give each M17 package exactly one supported `clinic.app.*` family capability. Its new M17 app ID is authorized through the existing signed company package/catalogue/update-policy flow; the host resolves the existing family, role, route and media policy without an ID-specific code entry. New host capabilities or route contracts remain platform work.
- Use focused local Linux checks. Do not run GitHub Actions. Staging only; production is excluded.
- On 2026-10-23 the user directed an early start on M17.10 Treatment Protocols. This is an independent app implementation and does not alter the planned order for remaining apps. Current staging feed identities are recorded from signed metadata below; each app's source/install acceptance remains separate.

## App baseline and release ledger

### 2026-10-22 — M17 suite signing key prepared

A fresh Ed25519 key pair was generated for M17 staging. Key ID: `company-staging-m17-20261022`. Public-key SHA-256 fingerprint: `e59c1c12fc7c594b5810cce75f2161157249a4b6a7586ecde2cebdb21ba20709`. The public key is pinned in `electron/distribution/staging.ts`; the private key remains outside the repository in protected local storage, and no private key material is in repository history. The public staging feed was verified at sequence 28 under this signer before this app release; Treatment Protocols was then published and re-read at sequence 29 with the same key. This task did not verify installation into the user's running OS. The older Follow-ups release helper remains bound to its previous identity and signer; M17.10 uses a separate identity-specific preparer and publisher.

| Submilestone | Existing M17 app source | SaaS behavior source | New M17 release ID/version | Current state |
| --- | --- | --- | --- | --- |
| M17.1 Follow-ups | Existing package source imported into M15; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.followups.m17` / 1.0.0 | Published at sequence 24; private-profile Store install/open and exact-payload health passed; full live acceptance open |
| M17.2 Patient Record | None; fresh implementation | Pin on start | TBD / 1.0.0 | Queued after M17.1 and M17.3 |
| M17.3 Appointments | Existing package source imported into M15; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.appointments.m17` / 1.0.0 first package; current 1.0.1 | Current package published at sequence 26; private-profile Store install/open and exact-payload health passed; full live acceptance open |
| M17.4 Work Entry | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.5 Treatment Progress | Feed entry observed; local source/acceptance not reconciled here | Pin on source review | `company.dental.treatment-progress.m17` / 1.0.0 | Signed package and API grant verified in the staging feed; app-specific source/install evidence must be reconciled |
| M17.6 Lab Tracker | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.7 Finance | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.8 Patient Payments | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.9 Staff | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.10 Treatment Protocols | Fresh app under `company.dental.m17.treatment-protocols` | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.m17.treatment-protocols` / 1.0.0 | Published and publicly verified at staging sequence 29; Store installation/runtime health remain open |
| M17.11 Calendar | Existing package source imported into M15 | `fd2cc5439694ce844362c9dec8a6267378d11381` | `company.dental.calendar.m17` / 1.0.0 | Published at sequence 28; private-profile Store install/open and exact-payload health passed; full live acceptance open |

The existing Follow-ups 1.1.0 staging release and Appointments 1.1.0 local fixture checkpoint are immutable historical package artifacts under earlier identities. Neither is relabeled as an M17 1.0.0 package. Their M17 source and new identities are recorded in the app plans; new versions must use immutable package bytes and updated grants.

## Delivery notes

### 2026-10-22 — Follow-ups checkpoint

The existing Follow-ups package source was completed in this M17 worktree using the pinned Dental SaaS behavior reference and the current app SDK. Local build, typecheck, 20 private UI workflow checks, launch-feedback regression, root production build, and 455 unit tests were recorded as passing. The earlier package was published as version 1.1.0 at staging catalogue sequence 23, installed/opened in a private Linux profile, and received a matching runtime health receipt. The signed M17 package is now present under `company.dental.followups.m17` / 1.0.0; this task verified its package signature and API grant from the feed but did not re-run its Store installation or runtime-health checks. See the [sequence 29 feed evidence](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json).

### 2026-10-22 — Appointments checkpoint

The existing Appointments package source was implemented in this M17 worktree from the pinned SaaS contract and current SDK. The private Linux workflow passed 20 checks. Local acceptance covers date/range/doctor reads, summary, booking, reschedule, statuses, conflicts, original-command retry, revocation, and host capability denial. The SaaS controller's current role-guard limitation is recorded in the app plan. A signed `company.dental.appointments.m17` 1.0.1 package is now in the staging feed; the retained policy also contains the 1.0.0 first-package grant. This task verified the current package signature and grant but did not re-run its Store installation or runtime-health checks. See the [sequence 29 feed evidence](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json).

### Platform and staging dependencies

- The current M15 SDK and shared UI are the platform dependencies. Patient Record X-rays and Staff documents must use the existing host-mediated media APIs.
- Confirm the M17 public-key trust update is included in the host build used for staging verification. Do not place private key material in Git.
- A protected authorized clinic credential is separately required for live synthetic staging acceptance. Never substitute chat-provided values.
- M15/G15, independent review, Windows verification, integrated acceptance, and device acceptance remain separately owned gates.

### 2026-10-23 — Treatment Protocols started early

The user directed M17.10 to start before the remaining app sequence. The old preview ID and source/evidence remain historical in local records; its staging package was removed at sequence 30. M17 uses new ID `company.dental.m17.treatment-protocols`, version `1.0.0`, and the pinned Dental SaaS source in `apps/dental-apps/company.dental.m17.treatment-protocols/SOURCE_IMPORT.json`. The app ports the SaaS catalogue/detail editor and shared action button, calls the existing treatment-protocol routes through `ClinicClient`, and uses the current `clinic.app.treatment-protocols` broker family. SaaS UI has no stage-reorder control; no new reorder UI was added. App typecheck/build, three package checks, three API contract tests, fourteen private Linux UI checks, workspace production build and 510 unit tests pass. The private report and screenshot cover create, stage pricing/settings, conflict refresh, unknown-outcome same-key retry, soft retirement and role denial. The M17-signed 1.0.0 package was published at catalogue sequence 29 and verified by reading back the package, catalogue and update policy; all existing feed entries were preserved at that time, and the temporary publisher Worker was removed. See the [publication evidence](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json). Store installation and live clinic API acceptance remain open.

### 2026-10-23 — Follow-ups, Appointments and Calendar imported into M15

The user asked to bring the separately completed M17 app work into this local M15 worktree. Commit `5306b80161542b7a9480b4bb2bc49df6b1218d84` was merged locally, bringing the three app packages, assets, release tooling, focused fixtures, release evidence and app plans. The running OS instance and its shared installed-app profile were not changed. This integration keeps M15's generic `clinic.app.*` host policy: each manifest declares one supported app family and the existing route/role rules are selected from that signed capability; no Follow-ups, Appointments or Calendar IDs were registered in host source. The incoming M17-specific 32-entry metadata cap was discarded in favor of M15's shared 64-company-app limit.

The imported apps' staging releases and private Store/runtime evidence predate this merge: Follow-ups 1.0.0 at sequence 24, Appointments 1.0.1 at sequence 26, and Calendar 1.0.0 at sequence 28. Their Store tests used private disposable Linux profiles and made no business writes. The integrated M15 build and focused checks will be recorded once complete; this merge does not publish or install packages, validate full live role/tenant workflows, deploy the M17 trust pin to the user's running desktop, or close G17/G15.

### M17.5 Treatment Progress source integration — 2026-10-23

Imported the completed M17 Treatment Progress app from local source commit `8b506ee3` into `codex/milestone-15`. The merge includes the app bundle source/assets, SaaS source pin, private UI/API fixtures, staging publication evidence and M17.5 plan. M15's generic `clinic.app.*` family routing is retained; no fixed app-ID policy entry or installed-profile change was added. Its signed `company.dental.treatment-progress.m17` 1.0.0 package remains published at staging sequence 27. App typecheck/build and 3 package tests passed, the private headless UI passed 23/23 checks, the Treatment Progress source branch root build passed, and 251 focused host tests across 8 files passed. Store install/runtime health and live clinic workflow acceptance remain open. This integration does not push to GitHub, merge to main, alter the running OS session, or republish the staging app.
