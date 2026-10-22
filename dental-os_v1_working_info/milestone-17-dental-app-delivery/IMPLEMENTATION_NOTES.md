# M17 Implementation Notes

This file records per-app source import decisions, implementation deltas, and explicit dependencies. It is not acceptance evidence; passing results belong in VERIFICATION_EVIDENCE.md.

## Decisions

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

| Submilestone | M14 Dental OS source SHA | SaaS app source SHA | App files imported | Platform dependencies found | Existing staging version | M17 target version | Disposition |
| --- | --- | --- | --- | --- | --- | --- | --- |
| M17.1 Follow-ups | 093cd96382466bf3aacf2a89a5b6389e19bce042 | f0d059d36540b4b6907cace089085ce0df62d454 | Follow-ups view/create form/model and UI/date dependency closure; exact blobs in [SOURCE_IMPORT.json](../../apps/dental-apps/company.dental.followups/SOURCE_IMPORT.json) | Current M15 clinic JSON/lifecycle contracts; Firebase/HTTP wrappers replaced by the SDK client; no M14 Electron/preload/broker code imported | Existing signed staging version 1.0.0 at sequence 22 | Signed 1.1.0 published at sequence 23 | Complete for recorded Linux staging scope; package SHA-256 `4f22e9eaaa30e0a82d551d0c9c04f564aba1899c6a7db7eebcd15885c042bb3a`; see verification evidence |
| M17.2 Patient Record | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.3 Appointments | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.4 Work Entry | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.5 Treatment Progress | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.6 Lab Tracker | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.7 Finance | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.8 Patient Payments | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.9 Staff | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.10 Treatment Protocols | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |
| M17.11 Calendar | Pending | Pending | Pending | Pending | Pending | Planned 1.1.0 | Not started |

## Change log

M17.1 started on 2026-10-22. Review/import only the Follow-ups UI and pure/shared presentation dependencies from the pinned SaaS revision. Exclude Next application/server configuration, Firebase login, HTTP transport, media code, other app workflows and all M14 Electron/preload/broker changes. Keep shared presentation under packages/dental-ui and the browser bridge client under packages/app-sdk. The existing SaaS worktrees remain read-only.

### 2026-10-22 — M17.1 Follow-ups accepted

Selective import and implementation completed against the recorded M14/SaaS pins. Package build, app typecheck, 20-check private synthetic-service UI acceptance, 11-check Finance launch-feedback regression, root production build, and 455 unit tests passed. Signed `company.dental.followups` 1.1.0 was published to Cloudflare staging at catalogue sequence 23 and installed/opened through the Store in a private Linux profile; the real runtime health receipt matched the payload digest. Exact commands, immutable hashes, scope and artifacts are in [M17.1_FOLLOWUPS_PLAN.md](M17.1_FOLLOWUPS_PLAN.md) and [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). M17.2–M17.11 and G17 remain open; M15/G15, Windows verification and independent review remain separate gates.
