# M17 Implementation Notes

This file records current M17 decisions, source pins, implementation deltas, and platform dependencies. Verification outcomes belong in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md).

## Current user-directed scope — 2026-10-22

- M17 work uses the current documented M17 baseline; managed task worktrees may isolate app work without modifying the original checkout or another task worktree.
- Reuse the Follow-ups and Appointments app source already present in this M17 worktree. Keep those workflows; update their package identities for the M17 release line rather than restarting UI implementation.
- Build the other nine apps from scratch against each maintained Dental SaaS UI/workflow/API module. Pin the exact source revision per app before implementation.
- Assign all eleven apps their own new unique M17 app IDs. Each app's first M17 package is version 1.0.0. Existing preview identities/releases remain unchanged.
- The new suite public signing identity `company-staging-m17-20261022` is pinned in staging configuration. Confirm protected private-key custody and availability before signing; do not search for or reuse an earlier milestone key, and never commit private key material.
- Keep the current M15 SDK/shared UI as the platform boundary. App code does not own identity, HTTP/media transport, or business data authority.
- Match the relevant Dental SaaS module UI closely: preserve its page and detail layouts, components, labels, controls, states, and interaction patterns. Do not invent app-specific UX. This guidance governs the remaining app work; the current Treatment Progress UI is left at its existing checkpoint without rework.
- Use focused local Linux checks. Do not run GitHub Actions. Staging only; production is excluded.

## App baseline and release ledger

| Submilestone | Existing M17 app source | SaaS behavior source | New M17 release ID/version | Current state |
| --- | --- | --- | --- | --- |
| M17.1 Follow-ups | Existing M17 source retained in separate task worktree | f0d059d36540b4b6907cace089085ce0df62d454 | company.dental.followups.m17 / 1.0.0 | Staging sequence 24; public verification and private Store install/open/health passed; full live workflow acceptance pending |
| M17.2 Patient Record | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started; queued after the existing Follow-ups/Appointments checkpoints |
| M17.3 Appointments | Existing M17 source retained in separate task worktree | f0d059d36540b4b6907cace089085ce0df62d454 | company.dental.appointments.m17 / 1.0.0 first release | First release sequence 25; current 1.0.1 feed entry sequence 26, SHA-256 `433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03` |
| M17.4 Work Entry | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.5 Treatment Progress | Fresh implementation in `codex/m17-treatment-progress` | f0d059d36540b4b6907cace089085ce0df62d454 | company.dental.treatment-progress.m17 / 1.0.0 | Published sequence 27; public signed metadata and package verify; Store install/live clinic acceptance not run |
| M17.6 Lab Tracker | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.7 Finance | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.8 Patient Payments | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.9 Staff | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.10 Treatment Protocols | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |
| M17.11 Calendar | None; fresh implementation | Pin on start | TBD / 1.0.0 | Not started |

The existing Follow-ups 1.1.0 staging release and Appointments 1.1.0 local fixture checkpoint are immutable historical package artifacts under earlier identities. Neither is relabeled as an M17 1.0.0 package. Repackage from the current M17 code under the new ID, recalculate the digest and grants, then perform the required new-identity checks.

## Delivery notes

### 2026-10-22 — Follow-ups checkpoint

The existing Follow-ups package source was completed and later copied into the separate M17 Follow-ups/Appointments task worktree. The earlier package was published as version 1.1.0 at staging catalogue sequence 23; that acceptance remains evidence for the earlier identity. The new `company.dental.followups.m17` version `1.0.0` was signed with the pinned suite key and published at staging sequence 24. Public signature/package/grant verification and authenticated Store install/open with exact-payload automatic health passed in a private disposable profile. Only initial staging reads occurred; full live role/tenant/workflow acceptance and deploying the new trust pin to the user's running desktop remain open. Its source/evidence worktree is recorded in M17 status and remains unmodified here.

### 2026-10-22 — Appointments checkpoint

The existing Appointments package source was implemented from the pinned SaaS contract and current SDK; its private Linux workflow passed 20 checks. It was retained in the separate M17 Follow-ups/Appointments task worktree, assigned `company.dental.appointments.m17` version `1.0.0`, and published at staging sequence 25. Public signature/package/grant verification and authenticated Store install/open with exact-payload automatic health passed in a private disposable profile. Only initial staging reads occurred. Full live role/tenant/workflow acceptance and deployment of the trust pin to the user's running desktop remain open. The SaaS controller's current role-guard limitation is recorded in the app plan. The local 1.1.0 fixture package remains a distinct non-staging artifact.

### Platform and staging dependencies

- The current M15 SDK and shared UI are the platform dependencies. Patient Record X-rays and Staff documents must use the existing host-mediated media APIs.
- The new suite public key is pinned in the staging verifier as `company-staging-m17-20261022`; private-key custody and availability remain a release prerequisite. Do not place private key material in Git.
- A protected authorized clinic credential is separately required for live synthetic staging acceptance. Never substitute chat-provided values.
- M15/G15, independent review, Windows verification, integrated acceptance, and device acceptance remain separately owned gates.


### 2026-10-23 — Treatment Progress implementation and staging release

M17.5 was implemented from the pinned Dental SaaS source at `f0d059d36540b4b6907cace089085ce0df62d454` as `company.dental.treatment-progress.m17` version `1.0.0`. The app reads the active, incomplete treatment projection from `GET /v1/treatment-progress` through `ClinicClient`; the SaaS Worker remains responsible for tenant filtering and calculated fields. The app includes search, doctor filtering, sorting, bounded pagination, manual refresh, and loading, empty, failure, malformed-response, and access-denied states. Patient-detail navigation is omitted.

App typecheck/build and three package contract tests passed. The root production build and all 460 root unit tests passed after raising the first-party app capacity. The private Linux acceptance passed 23 checks covering package ID/version, SDK-only renderer surface, approved read-only route, projection fields, search/filter/pagination, corrected refresh, empty/error/malformed states, recovery, module readiness, and role denial before business dispatch. The report and screenshot are linked in [M17.5 verification](../../apps/dental-apps/company.dental.treatment-progress.m17/VERIFICATION.md). These checks used synthetic data and an ephemeral test-only key; no clinic records were accessed.

The package was signed with the pinned M17 suite key and published to Cloudflare staging at sequence 27, advancing the signed catalogue and update policy from sequence 26. Public verification confirmed 17 matching app records, the downloaded 1,119,939-byte package, its signature and inventory, and the exact `clinic.api.request` release grant. Package SHA-256 is `d6a0376d71ff6c709f84b936909ab76740331283b6b0f768a59aa14991994f61`. The staging publisher denied anonymous and replay attempts and cleaned up its temporary Worker. See [publication evidence](../../artifacts/m17-treatment-progress-staging-publication-2026-10-23.json).

To fit the published 17-entry metadata, the current task branch raises the shared catalogue, update-policy, and installed-registry ceiling from 16 to 64. Regression tests accept 25 company apps; architecture docs and active M17 release-preparation tools use the same limit. Metadata remains bounded to 64 KiB, and the unrelated revoked-key limit remains 16. The family-policy, signer pin, and capacity changes still need integration into a desktop build before an existing client can accept this feed. As requested for this app task, work stopped after public staging verification: there was no Store installation, clinic credential use, live clinical request, production action, commit, or push.
