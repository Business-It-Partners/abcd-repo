# M17 Implementation Notes

This file records current M17 decisions, source pins, implementation deltas, and platform dependencies. Verification outcomes belong in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

## Current user-directed scope — 2026-10-22

- M17 stays in the current M15 worktree and branch.
- Reuse the Follow-ups and Appointments app source already present in this M17 worktree. Keep those workflows; update their package identities for the M17 release line rather than restarting UI implementation.
- Build the other nine apps from scratch against each maintained Dental SaaS UI/workflow/API module. Pin the exact source revision per app before implementation.
- Assign all eleven apps their own new unique M17 app IDs. Each app's first M17 package is version 1.0.0. Existing preview identities/releases remain unchanged.
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
| M17.1 Follow-ups | Existing package source in this worktree; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.followups.m17` / 1.0.0 | Signed package and API grant verified in the staging feed; install/runtime evidence must be reconciled from its owning record |
| M17.2 Patient Record | None; fresh implementation | Pin on start | TBD / 1.0.0 | Queued after M17.1 and M17.3 |
| M17.3 Appointments | Existing package source in this worktree; reuse | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.appointments.m17` / 1.0.0 first package; current 1.0.1 | Current signed package and API grant verified in the staging feed; install/runtime evidence must be reconciled from its owning record |
| M17.4 Work Entry | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.5 Treatment Progress | Feed entry observed; local source/acceptance not reconciled here | Pin on source review | `company.dental.treatment-progress.m17` / 1.0.0 | Signed package and API grant verified in the staging feed; app-specific source/install evidence must be reconciled |
| M17.6 Lab Tracker | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.7 Finance | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.8 Patient Payments | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.9 Staff | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.10 Treatment Protocols | Fresh app under `company.dental.m17.treatment-protocols` | f0d059d36540b4b6907cace089085ce0df62d454 | `company.dental.m17.treatment-protocols` / 1.0.0 | Published and publicly verified at staging sequence 29; Store installation/runtime health remain open |
| M17.11 Calendar | Feed entry observed; local source/acceptance not reconciled here | Pin on source review | `company.dental.calendar.m17` / 1.0.0 | Signed package and API grant verified in the staging feed; app-specific source/install evidence must be reconciled |

The existing Follow-ups 1.1.0 staging release and Appointments 1.1.0 local fixture checkpoint are immutable historical package artifacts under earlier identities. Neither is relabeled as an M17 1.0.0 package. Repackage from the current M17 code under the new ID, recalculate the digest and grants, then perform the required new-identity checks.

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

The user directed M17.10 to start before the remaining app sequence. The M13 preview ID and package remain historical and untouched. M17 uses new ID `company.dental.m17.treatment-protocols`, version `1.0.0`, and the pinned Dental SaaS source in `apps/dental-apps/company.dental.m17.treatment-protocols/SOURCE_IMPORT.json`. The app ports the SaaS catalogue/detail editor and shared action button, calls the existing treatment-protocol routes through `ClinicClient`, and uses the current `clinic.app.treatment-protocols` broker family. SaaS UI has no stage-reorder control; no new reorder UI was added. App typecheck/build, three package checks, three API contract tests, fourteen private Linux UI checks, workspace production build and 510 unit tests pass. The private report and screenshot cover create, stage pricing/settings, conflict refresh, unknown-outcome same-key retry, soft retirement and role denial. The M17-signed 1.0.0 package was published at catalogue sequence 29 and verified by reading back the package, catalogue and update policy; all existing entries were preserved and the temporary publisher Worker was removed. See the [publication evidence](evidence/m17-treatment-protocols-staging-seq29-2026-10-22.json). Store installation and live clinic API acceptance remain open.
