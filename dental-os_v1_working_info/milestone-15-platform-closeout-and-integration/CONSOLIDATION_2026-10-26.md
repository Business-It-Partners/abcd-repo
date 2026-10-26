# M15 branch consolidation — 2026-10-26

## Source of truth for this integration

- Destination: `Business-It-Partners/abcd-repo`, `codex/m15-readiness`, parent `188c9d2fb329d4e79b86d38065862bc405889be6`.
- Private input: `Business-It-Partners/dental-os`, `codex/milestone-15`, at `f3727089d3db86d9e23416ce348fbbdeeb2bf162`.
- Common ancestor: `75d65aff995fba051e523fb05b3bd46e9c933954`.
- This is a content integration, not a Git history merge of the private repository. The original branch remains untouched.

## Scope

- Integrates the 98 non-overlapping source, test and documentation paths from private M15, including deletions of the old dock caption overlay.
- Resolves all 22 paths changed on both branches against their common ancestor. Maintains M15 Windows host recovery and resource-pressure fixes alongside private M15 role-switching, Store, App Explorer, UI and app-package changes.
- Does not copy private `artifacts/` screenshots/reports or M17 private evidence JSON into the public repository; refer to the original private repository and published staging receipt for historical proof. No signing keys, credentials or deployment tokens were copied intentionally.
- Preserves V1 fixed Admin workspace PIN policy as an explicit interim product decision; auth continues to require the Worker role/capability checks.
- Public staging/fixture CI exercises this code. No production branch, deploy, patient upload, signing or installer publication is authorized by this integration.

## Verification status

The prior passing Windows hosted CI run `40270853889` proved only public source `8afb4a3`, before this consolidation. The integrated source requires **a new exact-source build, unit suite and Windows hosted UI pass**, plus Linux verification when available. The latest private M19/Linux checks were on earlier private source. Do not represent them as a pass for this consolidated code until rerun.

M15/G15 and protected staging media cleanup remain open independently of this content merge. Real Windows 10 machine acceptance and production signing/distribution are outside this consolidation task.
