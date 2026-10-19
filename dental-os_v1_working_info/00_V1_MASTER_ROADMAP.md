# Dental OS V1 — Master Roadmap

**Purpose:** execution map for the OS platform, not a dental module feature roadmap. Baseline: 2026-10-15; milestone sequence amended 2026-10-19.

## Authority

- [Architecture](../dental-os_v1-documentation/00_V1_README.md) defines product requirements and permanent exclusions.
- This roadmap defines dependencies and milestone order; [global status](00_V1_STATUS.md) records progress.
- [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) remains the active work contract and prototype history. New work entries name their milestone and stay consistent with these records.
- Source is implementation reality; retained verification is proof. No document can manufacture implemented functionality.

## Execution policy

One active milestone by default. Reconcile existing work when a milestone begins; close applicable exit gates before starting dependent implementation. Current milestone authorization/status is recorded in global status. The user gives standing authorization to commit/push milestone work for verification and merge each verified milestone into main without another confirmation, preserving its branch and checkpoint tags. Follow the [integration policy](../docs/GIT_AND_CI_SETUP.md). This does not authorize deployment, production promotion, history rewriting or remote provisioning by itself.

Statuses: PLANNED, IMPLEMENTING, IMPLEMENTED, VERIFIED, BLOCKED, DEFERRED, REMOVED. Technical verification and user acceptance are separate. A missing required supported-host check prevents verification of that scope; an explicit scope change needs a recorded user decision and updated traceability.

## Sequence

| Milestone | Purpose | Depends on | Gate | Plan |
| --- | --- | --- | --- | --- |
| M01 — Architecture and baseline | Freeze the Dental OS constitution, reference pattern, execution sequence and truthful starting point. | None | G01 | [Plan](milestone-01-architecture-baseline/PLAN.md) |
| M02 — Trusted host and OS state | Establish a controlled Electron host lifecycle and durable OS-only state without introducing local business storage. | M01 | G02 | [Plan](milestone-02-host-and-os-state/PLAN.md) |
| M03 — Isolated runtime and shared shell | Prove isolated app execution can preserve the existing desktop experience before building distribution on it. | M02 | G03 | [Plan](milestone-03-isolated-runtime-and-shell/PLAN.md) |
| M04 — Internal SDK and API boundary | Create a versioned, bounded application contract that can use existing SaaS APIs without exposing credentials. | M03 | G04 | [Plan](milestone-04-sdk-and-api-broker/PLAN.md) |
| M05 — Single login and protected sessions | Integrate existing Firebase identity and Worker authorization through one trusted desktop session. | M04 | G05 | [Plan](milestone-05-identity-and-session/PLAN.md) |
| M06 — Verified packages and local lifecycle | Replace developer-loaded fixtures with company-verified independently installed web packages. | M05 | G06 | [Plan](milestone-06-verified-packages/PLAN.md) |
| M07 — First-party store and Cloudflare delivery | Connect the Store to approved package releases in the existing Cloudflare platform. | M06 | G07 | [Plan](milestone-07-store-and-distribution/PLAN.md) |
| M08 — Safe independent application updates | Deliver independent app improvements without replacing running code or losing unfinished work. | M07 | G08 | [Plan](milestone-08-safe-app-updates/PLAN.md) |
| M09 — Integrated OS and SaaS contract proof | Prove the complete OS loop using delivered first-party sample apps and representative existing SaaS APIs. | M08 | G09 | [Plan](milestone-09-integrated-os-and-saas/PLAN.md) |
| M10 — Security, resilience and usability | Close production risks across trust, privacy, failure recovery, accessibility and resource use. | M09 | G10 | [Plan](milestone-10-security-resilience-and-usability/PLAN.md) |
| M11 — Flexible first-party app onboarding and updates | Prove a newly approved company app can be installed and updated independently, without an app-specific shell branch or Dental OS rebuild. | M10; builds on M06–M08 | G11 | [Plan](milestone-11-flexible-first-party-app-updates/PLAN.md) |
| M12 — Dental OS workspace and shell experience | Make the OS-level workspace, navigation and system surfaces coherent and usable around the shared app/window lifecycle. | M11; preserves M03/M10 contracts | G12 | [Plan](milestone-12-os-ui-experience/PLAN.md) |
| M13 — Windows/Linux release and operations | Certify installable, maintainable Dental OS releases on explicitly named Windows/Linux targets. | M12 | G13 | [Plan](milestone-13-windows-linux-release/PLAN.md) |

## Integration order and evidence

M03 establishes isolated apps and the shared shell; M06 verifies local packages; M07 distributes them; M08 safely updates them; M09 proves the SaaS-connected loop; M10 hardens the platform. M11 closes the generic first-party app onboarding/update gap beyond the original fixed samples. M12 then improves the OS-level experience without reimplementing app delivery or replacing shared lifecycle behavior. M13 performs host/release operations after those product surfaces are stable. Final device and user acceptance is tracked separately in G14 after M13.

Use [requirements](../dental-os_v1-documentation/22_V1_REQUIREMENTS_AND_TRACEABILITY.md) and [acceptance gates](../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md) to close milestones. A source snapshot/test count from Flutter does not transfer as acceptance. The first-party-only boundary is permanent; no roadmap stage opens external publishing.

## Backend execution restriction — applies to every milestone

Reuse `fewa_demo` Dental SaaS/Super Admin infrastructure and existing GitHub environments/workflows. All backend changes, remote catalogue/update work and API/login integration in this roadmap target verified Cloudflare staging only. Record exact branch/environment/resource identity before execution; preserve existing clients through additive changes and regression evidence. Use `/v1/dental-os/...` for new OS services only; existing business APIs keep their routes. [Canonical policy](../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

M04/M05 record API/identity staging mapping; M07 owns distribution contracts/resources, M08 update metadata, M09 connected regression proof, and M11 the generic first-party onboarding/update extension. M12 is shell/UI work and does not change SaaS authority. M13 release certification does not authorize production promotion/deployment. Complete dental application UI/workflows remain separate from the OS shell unless specifically scoped.

## 2026-10-19 milestone sequence amendment

M11 is now the full flexible first-party app onboarding/update milestone. M12 is reserved for OS-level workspace and shell UI, organized into submilestones in its plan. The former M11 Windows/Linux release-and-operations scope is now M13. This changes only the active/future roadmap assignment: M01–M10 verified history and their evidence remain unchanged. The current M11 implementation branch is `codex/milestone-11`; M12/M13 branches are created only when those milestones start.

Physical Windows-device acceptance remains a mandatory final product gate, scheduled after M13 and before any final release decision. Applicable Windows GitHub Actions evidence remains part of milestones; CI must not be described as physical-device certification. No final release is approved by completing documentation or a milestone alone.

## Verification policy — deferred physical Windows testing

The 2026-10-15 user decision deferred physical Windows interaction/visual acceptance until after the final platform milestone. Following the 2026-10-19 re-sequencing, that means after M13; the former “after M11” wording is superseded. During M02–M13, Windows acceptance uses GitHub Actions automated build/typecheck, filesystem tests and applicable hosted-runner smoke checks. Missing physical evidence does not block starting the next milestone once applicable Linux and Windows CI gates pass, but must not be presented as physical-device certification or final release approval.

Preserve exact checkpoint commits, workflow run URLs and outcomes. `main` carries the integrated snapshot; `codex/milestone-NN` records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
