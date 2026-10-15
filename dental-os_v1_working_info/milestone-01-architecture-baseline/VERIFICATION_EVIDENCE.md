# M01 Verification Evidence — Architecture and baseline

**Milestone verification:** VERIFIED — documentation scope only.
**Date:** 2026-10-15.
**User review/acceptance:** pending.
**Source:** uncommitted working tree on dev/work-startup; base HEAD and SHA-256 identity of the architecture/plans are retained in the checker report. No commit was created.

## Executed checks

| Check | Command | Actual result | Evidence |
| --- | --- | --- | --- |
| Document structure, local links, requirement/gate ownership presence | `python3 tools/check-dental-docs.py` | exit 0; 23 architecture docs, 11 milestones, 44 required milestone files; R01–R15, G01–G11, INV-01–INV-14 present; no broken scoped local links | [report](evidence/documentation-check.json) |
| Baseline Electron build/typecheck | `npm run build` | exit 0 | [build log](evidence/baseline-build.log) |
| Baseline unit suite | `npm test` | exit 0; 3 files, 25 tests pass | [unit log](evidence/baseline-unit-tests.log) |
| Tracked root-document whitespace | `git diff --check -- AGENTS.md PRODUCT_DIRECTION.md README.md DEVELOPMENT.md` | exit 0 | recorded command/outcome here |

## G01 / R01 / R15 review

- Numbered architecture and four-file-per-milestone pattern reconciled against the newer Flutter branch at 314bebd5f45591e966eee2482c7f4a994e2a7564, without switching branches or modifying the archive.
- Permanent company-only publishing, hosted Windows/Linux scope, SaaS authority, online-dependent storage, session/credential ownership, independent package updates and candidate decision gates are explicit.
- Root product direction, README, AGENTS, development guidance and active work checklist link to the architecture/roadmap/status without replacing detailed prototype history.
- WebContentsView, signature wire format and installer choices remain explicitly conditional/open; current Store is recorded as simulated and memory-only.
- Source-to-target gaps and all production milestone starting statuses are explicit; M02–M11 remain PLANNED.

## Scope limits

The checker verifies structure, links and identifier coverage, not the correctness of every design claim or external URL availability. Human architectural/user review remains separate. Build/unit checks confirm the existing local baseline compiles/tests; they do not test unimplemented package/session/distribution features or certify production security.

Execution host was this Linux development workspace. No GUI suites, application launches, reloads, backend calls, deployments or production mutations were performed for verification. No Windows runtime certification, user visual acceptance or production release approval is claimed. Documentation-only M01 does not require cross-host runtime certification; later milestone host gates remain mandatory.

## Preservation

Pre-existing uncommitted relocation/prototype changes were retained. Only documentation and the documentation checker were authored in this task; dist outputs were refreshed by the normal build. No commit/push/merge, archive change, worktree deletion or live-session interruption.

## Staging-policy amendment verification — 2026-10-15

Documentation-only amendment; M01 remains verified within documentation scope and M02–M11 remain PLANNED. The original [baseline report](evidence/documentation-check.json) and build/unit logs above are preserved as historical evidence. They were not rerun or relabeled as new runtime proof.

- `python3 tools/check-dental-docs.py`: exit 0; scoped links, architecture/milestone structure, requirements and gates pass for the amended contract. [Amended contract report](evidence/staging-policy-check.json).
- Direct documentation consistency assertions: all eleven PLAN.md files require fewa_demo resource reuse, staging-only execution and `/v1/dental-os/...`; targeted M04/M05/M07/M08/M09/M11 exit/evidence criteria include staging checks. Permanent first-party policy and milestone statuses remain unchanged.
- New ADR-017/018 and R08/gate coverage record the resource and namespace decisions; existing business routes are explicitly preserved. Exact live branch/resource mapping is pending, not asserted as verified.
- Markdown whitespace/conflict inspection and `git diff --check` for tracked documentation: pass.

No runtime/build/UI tests were necessary or rerun for this prose-only amendment. No backend source, fewa_demo checkout, cloud resource, credential, production environment, deployment workflow or running application was changed. No cloud calls, deployment, commit or push occurred. These checks do not certify staging deployment or existing-client regression behavior; those are future implementation gates.

## Repository structure amendment verification — 2026-10-15

Expanded the canonical repository structure and linked it from AGENTS.md, DEVELOPMENT.md, README.md and the architecture index/system document. Current source has not moved; no new app/shared-package directories were created.

`python3 tools/check-dental-docs.py` passes; [amendment report](evidence/repository-structure-check.json) records the current contract and repository-guide digest. Lightweight local link/whitespace checks for all touched documents pass. Historical build/unit evidence above is unchanged and was not rerun. No runtime tests, builds, backend changes, deployment, process cleanup or live-session actions occurred. M01 remains documentation-only verified; M02–M11 remain planned.
