# M15 Implementation Notes — Source Reconciliation and Execution Record

**Phase:** M15.1 source and record reconciliation complete; P04–P09 remain open.
**Source checkpoints:** committed M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`; accepted M15.1 source checkpoint `ad3fa6a10437bf58606631325d93f6b3cc0369b5`; last integrated milestone baseline is M11 `main` at `8c8211c00614b095c529d9d14964ca2ce912db73`.
**Integration branch:** `codex/milestone-15`; milestone-record worker branch `codex/m15-plan-records`.

## Accepted planning scope

On 2026-10-21, the user accepted the proposed M15 closeout scope and directed its formalization in a separate worker worktree. This directory records six phases: source reconciliation; versioned app authority and required host contracts; ADR-025 update alignment; M12/G12 and M13/G13 residuals; representative workloads and operational continuity; and final combined-source verification. The matching roadmap/global-status/checklist changes and G15/traceability/checker edits were prepared in separate scopes and combined by the lead in `codex/milestone-15`.

M15 is IMPLEMENTING. P03 established the plan; M15.1 reviewed source layers and accepted a limited launch-feedback/frame-handoff slice. M15.2–M15.6 implementation and final acceptance remain pending. M14 feature work remains separate. The integrated G14 path depends on a verified M15 platform baseline. M20/G20 and G21 remain later release and device gates.

## Baseline facts carried into the plan

- The M11-integrated `main` at `8c8211c0` is the last integrated verified platform milestone. The M13 committed candidate at `96363362` already contains M12 shell/module-navigation/store-arrival ancestors, but the original checkout has additional unintegrated deltas. Do not equate those layers.
- M01–M11 closeouts remain valid within their retained exact source and scope. The evidence audit identifies stale summary/opening prose and historical limits; dated corrections must preserve originals, not rewrite them.
- M12.1–M12.5 have scoped Linux/private-display results. M12.6/G12 remains open. M13 shell packages are placeholders, not functional apps; G13 retains the Follow-ups health receipt and Finance/Lab Tracker 1.0.1/profile module-review items.
- M14's external dependency register at revision `48c18401cada192bfa0bea02a4afdd0cb10e45ca` supplies concrete integration requests. M15 scopes platform work to these documented needs and their evidence, without taking app UI/workflow ownership.
- Existing staging catalogue/update metadata enforces a 24-hour freshness bound. The audit found no scheduled metadata renewal service and calls for a named operator plus a metadata-only higher-sequence renewal and expired-feed recovery drill. This is an operational continuity prerequisite, not evidence that renewal already occurred.

## M15.1 source and side-branch disposition — 2026-10-21

The lead verified the required worktree at `codex/milestone-15`, initially clean at P03 `125fa25bcc27d6ff198148259695d76cf895b0eb`. The original checkout remains untouched on dirty `codex/milestone-13` at `963633620d9fa620979bd33fc292949ab1a6c2e6`. P03 worker worktrees and older detached/source worktrees were inspected for provenance and uncommitted work; they were preserved and not reused or deleted.

| Input | Disposition | Reason / checkpoint |
| --- | --- | --- |
| `electron/distribution/service.ts`, `electron/main.ts`, `electron/packages/fixtures.ts`, `electron/runtime/manager.ts`, `package.json`, `src/RuntimeFixtures.tsx`, `src/style.css`, `tests/runtime-scenario.mjs`, `tests/app-launch-feedback.mjs` | ACCEPTED in M15.1 | Reviewed the app launch feedback lifecycle, signed fixture coverage and frame-handoff preservation. Added a verified installed-metadata title fallback for the catalogue-unavailable view after the focused test exposed the safe-ID fallback. Checkpointed with the related passing evidence in `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. |
| Refreshed private runtime screenshots/report and launch-feedback JSON/screenshots under `artifacts/` | RETAINED as source-bound evidence | Includes the successful 46-check runtime report, successful 132-check launch report and two earlier diagnostic attempts. Failed attempts are preserved and explained in VERIFICATION_EVIDENCE.md. |
| `tools/app-packages/prepare-dental-saas-staging.mjs` from the original dirty checkout | DEFERRED to M20 review | Staging preparation helper has external operational impact; it was not run and is not part of the app-ready runtime checkpoint. Review its purpose/owner and safe procedure under release/operations scope. |
| Modified Windows preview/report artifacts from the original checkout | DEFERRED to M20 review | These do not establish Windows product certification; retain for the named host/release matrix review. They were not copied into the M15 checkpoint. |
| Other original dirty-checkout inputs not named above | PRESERVED, not accepted | P01 inventory is not blanket source approval. No wholesale copy, commit, staging operation or rewrite of the original checkout occurred. |

Side-branch review: `main` at M11 `8c8211c0` remains historical. The M13 candidate already contains the `codex/milestone-12-shell`, `codex/module-navigation` and `codex/store-install-arrival` ancestry, so those were not merged again. The older `codex/milestone-12` v2 state-recovery work is already represented in M13; its older support-review variant is superseded by the current safer support flow. `codex/os-minimize-glitch` is at the M12 shell ancestor. `refrence/` legacy branches remain local-only. The separate M14 source/worktree is not touched. No side branch was merged or deleted.

## M15.2 contract guardrails — design remains open

The current host clinic API policy is compiled in `electron/sdk/appPolicy.ts`. Generic M11 package onboarding does not prove a newly signed package can acquire a new clinic API grant on an unchanged desktop. M15 must define approval, compatibility and host enforcement with the existing Worker as business authority, then prove approved and denied behavior. No route-manifest format, remotely supplied policy model, or permission evolution mechanism is selected by P03.

M14's cross-app patient/case links are not authorization for a general app-to-app system. Architecture requirement R13 and the permanent exclusions in `19_V1_NON_GOALS.md` remain unchanged. M15 may assess a bounded OS-owned navigation/selection contract under a separate explicit contract/ADR, including source dirty/modal preservation, independent destination authorization, missing/denied destinations and identifiers kept out of sensitive URLs. No arbitrary messages, app-selected targets with authority, or app-to-app intents are designed or implemented here.

Media/payload scope follows the M14 register only: Patient Record/Staff private media upload/download; current payload limits; MIME/size/checksum, tenant/permission and failure-cleanup evidence. Any limit change must be versioned and approved after measuring sanitized synthetic app payloads. Print/export is addressed only if a concrete V1 app requirement establishes it. No clinical content, live patient payload, renderer bearer token or undocumented capability is introduced.

## Planned source and evidence ownership

| Concern | Existing owner/source | M15 disposition |
| --- | --- | --- |
| App API calls and identity | `electron/sdk/appPolicy.ts`, `contracts.ts`, `broker.ts`, `electron/identity/`; existing Worker authority | Reconcile app requirements and design approval/enforcement. The contract and implementation remain pending. |
| Package/session/update safety | `electron/packages/registry.ts`, `electron/distribution/`, `electron/runtime/manager.ts`, `src/DeliveryStore.tsx` | Reuse M08/M11 foundations; align the default Store path with ADR-025 and prove the complete combined-source path. |
| Shell/module handoff | M12 shell and `electron/packages/appMetadata.ts`, `src/AppExplorer.tsx`, shared window manager | Close M12.6/G12 and the M13 profile/module residuals in owner records; do not fork the shared lifecycle. |
| Private media | Existing SaaS Worker endpoints plus M14 Staff dependency | Design host mediation with app owner; test only synthetic bytes and declared limits. No media adapter is claimed present. |
| Feed renewal | Signed catalogue/update policy and staging operator tooling | Assign an operator and verify metadata-only renewal/expiry recovery under approved staging procedure. No renewal service is claimed. |
| Platform installer/updater | M20 | Excluded from M15 app-package update work; assess under M20/G20. |

## Development environments versus supported products

Historical runs identify a local Ubuntu 22.04.5 x86_64 private GNOME/Wayland environment and hosted Ubuntu 24.04/Windows Server 2022 runners where applicable. M15 should report those as observed test environments only. It must separately inventory future named customer targets for M20; neither Linux private display nor hosted Windows CI certifies physical devices or creates a product support promise.

## Change log

- 2026-10-21 — Created the M15 planning record in response to user acceptance of P03 scope. No runtime, app, architecture-authority, roadmap, global-status, central-checklist, or external checkout file was changed in this worktree.
- 2026-10-21 — Completed M15.1 review and checkpointed only the accepted launch-feedback/frame-handoff source/test slice at `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. Classified deferred and preserved inputs above; updated root/global/roadmap/central and M12/M13 owner records. G12, G13 and G15 remain open.


## Lead integration review — P03

The lead combined these four records with the other sidebar worker's gates/build-phases/traceability/checker changes and the lead's roadmap/status/checklist amendments. The review corrected an ambiguous worker phrase: activation occurs on the next full **app** launch, not a required Dental OS restart. The accepted install/update contract remains authoritative. Requirement mapping is resolved in the combined matrix; runtime authority/media/navigation designs remain pending. Earlier worker validation statements describe the partial worker stage; integrated P03 checks are recorded in VERIFICATION_EVIDENCE.md.
