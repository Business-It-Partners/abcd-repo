# M15 Status — Platform Closeout and Integration

**Status:** IMPLEMENTING — P03/M15.1 complete. P04–P06 implementation candidates and focused checks are integrated; P07 is under execution; P08 metadata-only tooling passes 13 focused checks and the full serial suite passes 324/324, while the real staging renewal/recovery drill is underway; P09 and G15 are open.
**Updated:** 2026-10-22.
**User scope review:** the user accepted the proposed M15.1–M15.6 scope and directed that it be formalized. This records scope authorization, not runtime acceptance.
**Integration branch:** `codex/milestone-15` in the lead `platform-closeout` worktree; milestone-record worker branch `codex/m15-plan-records`, created from committed M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.
**Gate:** G15 — closeout and integrated-baseline proof. The lead integrated the distinct G15 row, requirement mappings and checker changes; this planning checkpoint does not close G15.

## Current position

The M11-integrated `main` remains the last integrated verified milestone. M15.1 reviewed the committed M13 candidate, original-checkout local deltas, side-branch ancestry and preserved P03 worker worktrees. Only the managed-app launch-feedback/native-frame handoff slice was accepted; its source and evidence checkpoint is `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. Other original inputs remain preserved or deferred, as itemized in IMPLEMENTATION_NOTES.md. M01–M11 retain their exact recorded scope; prior results are not relabeled as final combined-source proof.

The central [platform reconciliation checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) records P01/P02 audits and the accepted M15 proposal. The [milestone evidence audit](../audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](../audit-reports/SHELL_RELEASE_AUDIT.md), [API/update audit](../audit-reports/API_UPDATE_GAPS.md), and [source baseline](../audit-reports/SOURCE_BASELINE.md) are supporting read-only inputs. The lead integration includes the checklist and audit reports; runtime source layers remain separately identified.

## Phase tracking

| Phase | Status | Remaining evidence |
| --- | --- | --- |
| M15.1 — Source and record reconciliation | IMPLEMENTED — accepted source checkpoint | Reviewed local inputs and side branches; integrated only the accepted launch-feedback/frame-handoff slice; retained unaccepted inputs; corrected dated M12/M13/M15 records. |
| M15.2 — Versioned app authority and required host contracts | IMPLEMENTED CANDIDATE — user selected existing signed company catalogue/update-policy authority; exact format-2 API grants, broker enforcement and synthetic new-app/API-only extension tests pass on `11cb1bc8`. The latest M14 register submits partial app routes and package measurements; exact host reconciliation/role tests and media/navigation contracts remain | M14 compatibility handoff; settle only evidence-backed host contracts under their documented ADR gates. |
| M15.3 — ADR-025 app-update alignment | IMPLEMENTED CANDIDATE — build, full serial unit, SDK, update, Store-arrival and synthetic integration checks pass on `11cb1bc8`; local metadata-only renewal regression is covered | Independent review and any findings; preserve the separate M20 platform-updater boundary. |
| M15.4 — Integrated shell and G12/G13 residuals | IMPLEMENTED CANDIDATE — app-launch feedback, overview, scaling and focused usability private checks pass on `11cb1bc8`; G12/G13 and owner evidence remain open | Retain user visual, live-profile and device obligations with their owners. |
| M15.5 — Representative workload and operational continuity | PARTIAL — supported signed-fixture workload passes, including the exact 2 MiB per-asset/8 MiB expanded package boundary; the local metadata renewal/expiry rerun passes 77/77; unresolved M14 service/media contracts and P08 staging role/tool/drill requirements remain | Record the exact supported workload evidence; obtain M14 route/role/media/payload contracts; user to name the staging operator and independent reviewer; approve a no-package-write preparation path and perform the bounded staging drill before claiming operational continuity. |
| M15.6 — Integrated platform baseline | IN PROGRESS — lead candidate build, full serial unit suite, focused private UI and integrated regressions pass; the reported M14 Windows dock-edge runtime failure is unresolved and independent review remains | Commit exact integrated source/evidence, run final source-bound checks, reconcile the M14 Windows failure on the exact platform branch when applicable CI is available, publish M14 handoff and residual gate register, and prepare independent GPT-6.1 Sol Medium review. G12/G13/G15 remain open. |

## Dependency and gate position

- M01–M11 are historical verified dependencies for their documented scope. Reuse their implementation/evidence; repeat only checks affected by the final integration.
- M12 remains IMPLEMENTING and G12 open until M12.6 and its owning acceptance evidence close.
- M13 remains IMPLEMENTING and G13 open until the Follow-ups health receipt and Finance/Lab Tracker 1.0.1 install/module review are resolved in the M13 record.
- M14 app implementation proceeds as a separate parallel track. Its test-only mocks may support development; integrated G14 acceptance uses the exact verified M15 baseline and the app track's own acceptance evidence.
- M20/G20 host installer/updater/operations scope is not absorbed into M15. G21 physical-device and final user/product acceptance remains after M20.
- G15 is open and cannot be marked verified while G12 or G13 remains open unless the user explicitly approves a scope change recorded by those gate owners.

## Not claimed

The accepted launch-feedback/frame-handoff source and current P04–P06 candidate checks do not close any full milestone gate. ADR-026's signed company update-policy authority and format-2 exact grant path are implemented and synthetically tested; they do not resolve M14's full per-app route/role inventory, bounded media contract, cross-app navigation design gate or app-side compatibility. No media adapter, live Worker workload acceptance, M12/G12 or M13/G13 closure, M14/G14 app acceptance, M20/G20 release acceptance, or G21 device/user acceptance is claimed. P08's human operator/reviewer assignment and staging renewal/expiry drill remain open. No production mutation, main merge, deployment or live application restart occurred. P03 and M15.1 historical evidence remains separately scoped in VERIFICATION_EVIDENCE.md.


## P03 integrated documentation verification

The lead combined both sidebar worker outputs and aligned the central checklist, roadmap, requirements/gates and affected M12/M13/M14/M20 coordination records. The documentation checker passes for the full combined set (16 milestones, 64 required records, 17 gates); Python syntax and Git whitespace checks pass. G15 remains open. See [verification evidence](VERIFICATION_EVIDENCE.md). Worktree output inspection found no generated build outputs to delete; no dependencies or builds were created for P03.
