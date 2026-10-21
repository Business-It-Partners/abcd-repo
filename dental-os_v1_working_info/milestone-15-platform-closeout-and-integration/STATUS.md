# M15 Status — Platform Closeout and Integration

**Status:** IMPLEMENTING — P03 planning/documentation complete; M15.1–M15.6 implementation/acceptance pending.
**Updated:** 2026-10-21.
**User scope review:** the user accepted the proposed M15.1–M15.6 scope and directed that it be formalized. This records scope authorization, not runtime acceptance.
**Integration branch:** `codex/milestone-15` in the lead `platform-closeout` worktree; milestone-record worker branch `codex/m15-plan-records`, created from committed M13 snapshot `963633620d9fa620979bd33fc292949ab1a6c2e6`.
**Gate:** G15 — closeout and integrated-baseline proof. The lead integrated the distinct G15 row, requirement mappings and checker changes; this planning checkpoint does not close G15.

## Current position

This branch records P03 and no M15 runtime behavior. The M11-integrated `main` remains the last integrated verified milestone. The committed M13 candidate is the planning baseline; the original checkout's local deltas remain unintegrated review inputs and are not claimed as accepted or tested together. M01–M11 retain their exact recorded scope. No historical result has been repeated or relabeled.

The central [platform reconciliation checklist](../PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) records P01/P02 audits and the accepted M15 proposal. The [milestone evidence audit](../audit-reports/MILESTONE_EVIDENCE_AUDIT.md), [shell/release audit](../audit-reports/SHELL_RELEASE_AUDIT.md), [API/update audit](../audit-reports/API_UPDATE_GAPS.md), and [source baseline](../audit-reports/SOURCE_BASELINE.md) are supporting read-only inputs. The lead integration includes the checklist and audit reports; runtime source layers remain separately identified.

## Phase tracking

| Phase | Status | Remaining evidence |
| --- | --- | --- |
| M15.1 — Source and record reconciliation | PLANNED | Review candidate and local inputs; preserve M01–M11 scope; date stale-record corrections; bind accepted combined source. |
| M15.2 — Versioned app authority and required host contracts | PLANNED | Approve authority/compatibility and host boundary; evidence M14-bounded API/media/payload needs; evaluate cross-app navigation under a separate contract/ADR without changing R13. |
| M15.3 — ADR-025 app-update alignment | PLANNED | Implement and verify staged preparation, next-full-launch trial, truthful versions, failure/recovery and race safety. |
| M15.4 — Integrated shell and G12/G13 residuals | PLANNED | Close M12.6/G12 and outstanding M13/G13 items in their owning records; G15 cannot waive them. |
| M15.5 — Representative workload and operational continuity | PLANNED | Run synthetic API/media/navigation/window/session/failure/resource workloads; identify observed test environments; rehearse metadata renewal and expiry recovery. |
| M15.6 — Integrated platform baseline | PLANNED | Verify final combined source; publish evidence identity and M14 handoff; retain M20/G20 and G21 residuals. |

## Dependency and gate position

- M01–M11 are historical verified dependencies for their documented scope. Reuse their implementation/evidence; repeat only checks affected by the final integration.
- M12 remains IMPLEMENTING and G12 open until M12.6 and its owning acceptance evidence close.
- M13 remains IMPLEMENTING and G13 open until the Follow-ups health receipt and Finance/Lab Tracker 1.0.1 install/module review are resolved in the M13 record.
- M14 app implementation proceeds as a separate parallel track. Its test-only mocks may support development; integrated G14 acceptance uses the exact verified M15 baseline and the app track's own acceptance evidence.
- M20/G20 host installer/updater/operations scope is not absorbed into M15. G21 physical-device and final user/product acceptance remains after M20.
- G15 is open and cannot be marked verified while G12 or G13 remains open unless the user explicitly approves a scope change recorded by those gate owners.

## Not claimed

No M15 runtime implementation, API-policy design, route-manifest format, inter-app contract, media adapter, ADR-025 implementation, M12/G12 or M13/G13 closure, M14/G14 app acceptance, M20/G20 release acceptance, or G21 device/user acceptance is claimed. P03 has no build, runtime/unit/UI test, live-profile inspection, cloud mutation, main merge, deployment or application restart. Documentation validation and branch-checkpoint publication are recorded separately; neither is runtime acceptance.


## P03 integrated documentation verification

The lead combined both sidebar worker outputs and aligned the central checklist, roadmap, requirements/gates and affected M12/M13/M14/M20 coordination records. The documentation checker passes for the full combined set (16 milestones, 64 required records, 17 gates); Python syntax and Git whitespace checks pass. G15 remains open. See [verification evidence](VERIFICATION_EVIDENCE.md). Worktree output inspection found no generated build outputs to delete; no dependencies or builds were created for P03.
