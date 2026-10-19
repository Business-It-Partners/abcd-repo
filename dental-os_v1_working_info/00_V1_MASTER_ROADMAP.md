# Dental OS V1 — Master Roadmap

**Purpose:** execution map for the OS platform, not a dental module feature roadmap. Baseline: 2026-10-15.

## Authority

- [Architecture](../dental-os_v1-documentation/00_V1_README.md) defines product requirements and permanent exclusions.
- This roadmap defines dependencies and milestone order; [global status](00_V1_STATUS.md) records progress.
- [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) remains the active work contract and prototype history. New work entries name their milestone and stay consistent with it.
- Source is implementation reality; retained verification is proof. No document can manufacture implemented functionality.

## Execution policy

One active milestone by default. Reconcile existing work when a milestone begins; close applicable exit gates before starting dependent implementation. Current milestone authorization/status is recorded in the global status. The user gives standing authorization to commit/push milestone work for verification and merge each verified milestone into main without another confirmation, preserving its branch and checkpoint tags. Follow the [integration policy](../docs/GIT_AND_CI_SETUP.md). This does not authorize deployment, production promotion, history rewriting or remote provisioning by itself.

Statuses: PLANNED, IMPLEMENTING, IMPLEMENTED, VERIFIED, BLOCKED, DEFERRED, REMOVED. Technical verification and user acceptance are separate. A missing required supported-host check prevents verification of that scope; an explicit scope change needs an ADR and user decision.

## Sequence

| Milestone | Purpose | Depends on | Gate | Plan |
| --- | --- | --- | --- | --- |
| M01 — Architecture and baseline | Freeze the Dental OS constitution, reference pattern, execution sequence and truthful starting point. | None | G01 | [Plan](milestone-01-architecture-baseline/PLAN.md) |
| M02 — Trusted host and OS state | Establish a controlled Electron host lifecycle and durable OS-only state without introducing local business storage. | M01 | G02 | [Plan](milestone-02-host-and-os-state/PLAN.md) |
| M03 — Isolated runtime and shared shell | Prove isolated app execution can preserve the existing desktop experience before building distribution on it. | M02 | G03 | [Plan](milestone-03-isolated-runtime-and-shell/PLAN.md) |
| M04 — Internal SDK and API boundary | Create a versioned, bounded application contract that can use existing SaaS APIs without exposing credentials. | M03 | G04 | [Plan](milestone-04-sdk-and-api-broker/PLAN.md) |
| M05 — Single login and protected sessions | Integrate the existing Firebase identity and Worker authorization through one trusted desktop session. | M04 | G05 | [Plan](milestone-05-identity-and-session/PLAN.md) |
| M06 — Verified packages and local lifecycle | Replace developer-loaded fixtures with company-verified independently installed web packages. | M05 | G06 | [Plan](milestone-06-verified-packages/PLAN.md) |
| M07 — First-party store and Cloudflare delivery | Connect the store to actual approved package releases in the existing Cloudflare platform. | M06 | G07 | [Plan](milestone-07-store-and-distribution/PLAN.md) |
| M08 — Safe independent application updates | Deliver independent app improvements without replacing running code or losing unfinished work. | M07 | G08 | [Plan](milestone-08-safe-app-updates/PLAN.md) |
| M09 — Integrated OS and SaaS contract proof | Prove the complete OS loop using two delivered first-party sample apps and representative existing SaaS APIs. | M08 | G09 | [Plan](milestone-09-integrated-os-and-saas/PLAN.md) |
| M10 — Security, resilience and usability | Close production risks across trust, privacy, failure recovery, accessibility and resource use. | M09 | G10 | [Plan](milestone-10-security-resilience-and-usability/PLAN.md) |
| M11 — Windows/Linux release and operations | Certify installable, maintainable Dental OS releases on explicitly named Windows/Linux targets. | M10 | G11 | [Plan](milestone-11-windows-linux-release/PLAN.md) |

## Integration order and evidence

M03 uses development fixtures; M06 converts them to verified packages; M07 delivers them remotely; M08 upgrades them; M09 proves the full SaaS-connected loop. This prevents early dental-module implementation from masking unfinished OS infrastructure. M10/M11 require explicit hardening and host evidence, not only a happy-path demo.

Use [requirements](../dental-os_v1-documentation/22_V1_REQUIREMENTS_AND_TRACEABILITY.md) and [acceptance gates](../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md) to close milestones. A source snapshot/test count from Flutter does not transfer as acceptance. The first-party-only boundary is permanent; no roadmap stage opens external publishing.

## Backend execution restriction — applies to every milestone

Reuse `fewa_demo` Dental SaaS/Super Admin infrastructure and existing GitHub environments/deployment workflows. All backend changes, remote catalogue/update work and API/login integration in this roadmap target verified Cloudflare staging only. Record exact branch/environment/resource identity before execution; preserve existing clients through additive changes and regression evidence. Use `/v1/dental-os/...` for new OS services only; existing business APIs keep their routes. [Canonical policy](../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

M04/M05 record API/identity staging mapping; M07 owns distribution contracts/resources, M08 update metadata, and M09 connected regression proof. Their verified scope remains in those milestone records. M11 release certification does not authorize production promotion/deployment. Complete dental application UI/workflows remain a separate delivery. M11 implementation is active under the scoped amendment below.

## M11 scope amendment — first-party app onboarding and app-only updates

The user authorized this scoped M11 work on 2026-10-19. The [working checklist](APP_ONBOARDING_AND_UPDATE_CHECKLIST.md) defines a new-app Store install followed by app-only v1.0.0-to-v1.1.0-to-v1.2.0 updates. Linux private UI, live signed staging/package acceptance, authenticated Store service acceptance, and the private live-feed desktop install/update/restart pass for the named scope; Windows CI and M11 host/resource gates remain open. It does not revise or reopen the verified M07/M08 sample gates. M11 implementation is active on `codex/milestone-11`; production promotion remains excluded.

## Verification policy revision — deferred physical Windows testing

User decision, 2026-10-15: during M02–M11, Windows acceptance uses GitHub Actions automated build/typecheck, filesystem tests and applicable hosted-runner smoke checks. Physical Windows-device interaction/visual acceptance is deferred until after M11 and remains a mandatory final product release gate. Missing physical evidence does not block starting the next milestone once its applicable Linux and Windows CI gates pass, but must not be described as physical-device certification or final release approval. If a CI check cannot cover a required behavior, record the remaining risk explicitly. M11 implementation/CI completion is distinct from final product release acceptance.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
