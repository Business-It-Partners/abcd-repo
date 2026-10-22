# M17 Implementation Notes

This file records per-app implementation decisions, source pins, implementation deltas, and explicit dependencies. It is not acceptance evidence; passing results belong in VERIFICATION_EVIDENCE.md.

### 2026-10-22 — revised fresh-app and signing approach

- The user's latest direction supersedes selective M14 app-code reuse for apps not yet built. Implement each remaining app from scratch in the current M15 worktree, using `desktop/fewa_demo/dental-saas` as the UI, workflow, and API reference. Pin the exact SaaS source used for each app. M14 remains historical reference/evidence only; do not transfer its app code.
- Preserve M17.1 Follow-ups as completed under its existing app ID, version, and signer. Preserve M17.3 Appointments' current local implementation and passing Linux evidence as a checkpoint; do not restart that implementation. Its unreleased staging package must use a new app ID and the new M17 staging signer.
- Assign a new unique first-party app ID before scaffolding/releasing each not-yet-released M17 app. Leave existing preview IDs/releases unchanged. Start each new ID at 1.0.0 and increment it for later releases. Do not invent IDs in advance; record each approved ID in its plan and package metadata.
- Create one new M17 first-party staging signing key for the fresh release line, not a separate key per app. Pin its public identity in staging before signing. Keep private material only in a protected, Git-ignored local `signing/` directory (0700 directory, 0600 key) until moved into the user's vault. Track only public identity/fingerprint and verification evidence. The older M08 key remains part of M17.1's historical evidence and is not the new M17 signer.
- A new signer does not remove the need for an authorized protected clinic credential for live synthetic staging acceptance. Local Linux checks come first; do not run GitHub Actions. Current-source Windows device verification and independent review remain distinct gates.

## Initial decisions (historical; revised direction below governs unreleased apps)

### 2026-10-22 — M17 work location and source use

- User directed that M17 app work continue in the current M15 worktree, without a separate worktree.
- Reuse M14 app code selectively as source material. Do not merge the M14 branch wholesale or assume its evidence verifies M17.
- Keep OS capabilities in the current Dental OS platform/SDK. M17 app code uses the SDK for network/API and media operations; app-level capability reimplementation is out of scope.
- Work through Follow-ups first, then one app submilestone at a time.
- M15 closeout remains open and is sequenced after M17 app work; no M15/G15 status is changed by this decision.
- The 2026-10-22 M14 non-media-only scope applies to the old M14 execution track, not the new M17 plans. Patient Record and Staff app-side media use is in scope through the existing M15 SDK, subject to the platform's own open acceptance.
- Use 1.1.0 as the planned first substantial functional release for existing apps currently at 1.0.0 or 1.0.1. Inspect and record the current staging catalogue before selecting each actual release version; never overwrite an existing version.
- Staging only; no production publication or promotion.

## App import ledger

Fill one row before importing or changing an app. Preserve the M14 source branch and record files included/excluded so platform code is not silently copied as app code.

| Submilestone | M14 Dental OS source SHA | SaaS app source SHA | App implementation/source inputs | Platform dependencies found | Existing preview ID/version | M17 release ID/version | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M17.1 Follow-ups | 093cd96382466bf3aacf2a89a5b6389e19bce042 | f0d059d36540b4b6907cace089085ce0df62d454 | Follow-ups view/create form/model and UI/date dependency closure; exact blobs in [SOURCE_IMPORT.json](../../apps/dental-apps/company.dental.followups/SOURCE_IMPORT.json) | Current M15 clinic JSON/lifecycle contracts; Firebase/HTTP wrappers replaced by the SDK client; no M14 Electron/preload/broker code imported | Existing signed staging version 1.0.0 at sequence 22 | Signed 1.1.0 published at sequence 23 | Complete for recorded Linux staging scope; package SHA-256 `4f22e9eaaa30e0a82d551d0c9c04f564aba1899c6a7db7eebcd15885c042bb3a`; see verification evidence |
| M17.2 Patient Record | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | M15 media and app SDK | `company.dental.patient-record` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Queued after M17.3; fresh implementation not started |
| M17.3 Appointments | Historical shell `6fd362ec`; M15 base `edc62142` | `f0d059d36540b4b6907cace089085ce0df62d454` | Existing local implementation checkpoint; exact reviewed source hashes in `SOURCE_IMPORT.json` | `ClinicClient` and current M15 broker; no patient lookup/link | `company.dental.appointments` / `1.0.0`; catalogue/policy sequence 23 was verified | New ID TBD / `1.0.0` first release | Local checks pass; no signed release or Store install; new key and credential prerequisites remain |
| M17.4 Work Entry | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.work-entry` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.5 Treatment Progress | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.treatment-progress` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.6 Lab Tracker | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.lab-tracker` / `1.0.1` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.7 Finance | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.finance` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.8 Patient Payments | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.patient-payments` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.9 Staff | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 media and app SDK | `company.dental.staff` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.10 Treatment Protocols | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.treatment-protocols` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |
| M17.11 Calendar | Reference only | Pin on start | Fresh implementation from SaaS UI/workflow/API contract | Current M15 SDK | `company.dental.calendar` / `1.0.0` preview | New ID TBD / `1.0.0` first release | Not started |

## Change log

M17.1 started on 2026-10-22. Review/import only the Follow-ups UI and pure/shared presentation dependencies from the pinned SaaS revision. Exclude Next application/server configuration, Firebase login, HTTP transport, media code, other app workflows and all M14 Electron/preload/broker changes. Keep shared presentation under packages/dental-ui and the browser bridge client under packages/app-sdk. The existing SaaS worktrees remain read-only.

### 2026-10-22 — M17.3 Appointments implementation

The user selected Appointments before Patient Record. Reviewed current SaaS route/controller/service and appointment UI/model at `f0d059d36540b4b6907cace089085ce0df62d454`. The M14 Appointments folder is still a static shell, so no functional M14 UI was imported. Adapted the standalone diary through `ClinicClient`: date/range and doctor reads, summary, booking, reschedule, status changes, row-version conflicts, original-command retry, and draft safety. The SaaS contract has no patient record link: only the appointment's own name and optional phone are captured. Reused the M17.1 lesson to wait on explicit SDK readiness, use accessible roles, and compute fixture dates in the clinic timezone. App typecheck, 4 package contract tests, package build, the prior root build, and the final 20-check private Linux workflow pass. The fixture uncovered and drove fixes to success messaging and lost-receipt retry access from an open modal. The pinned SaaS route does not call `requireClinicCapability("appointments.access")`; the Dental OS host capability denial passes locally, and all three current SaaS roles receive that capability. If role policy is narrowed later, server-side enforcement remains necessary. The pinned M08 signer and current signed catalogue/policy were verified, but the required protected clinic credential file was unavailable. No authenticated staging sign-in/write, package signing/publication, Store launch, or GitHub Actions run has been recorded; M17.3 stays IMPLEMENTING.

The 2026-10-22 fresh-app direction preserves this implementation and its test results but replaces the planned release identity/signing route: the new release ID is TBD and starts at 1.0.0; the new M17 suite signer must be pinned before publication. The existing preview ID, old-key preflight, and local 1.1.0 package are not a signed release.

### 2026-10-22 — M17.1 Follow-ups accepted

Selective import and implementation completed against the recorded M14/SaaS pins. Package build, app typecheck, 20-check private synthetic-service UI acceptance, 11-check Finance launch-feedback regression, root production build, and 455 unit tests passed. Signed `company.dental.followups` 1.1.0 was published to Cloudflare staging at catalogue sequence 23 and installed/opened through the Store in a private Linux profile; the real runtime health receipt matched the payload digest. Exact commands, immutable hashes, scope and artifacts are in [M17.1_FOLLOWUPS_PLAN.md](M17.1_FOLLOWUPS_PLAN.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). M17.2–M17.11 and G17 remain open; M15/G15, Windows verification and independent review remain separate gates.
