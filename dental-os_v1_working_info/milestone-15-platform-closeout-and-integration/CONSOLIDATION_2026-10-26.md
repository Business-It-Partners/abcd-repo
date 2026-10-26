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

## Consolidation closeout — verified 2026-10-26

**Repository consolidation: COMPLETE for the agreed source-transfer and hosted CI scope.**

- Consolidated public source HEAD verified: `acbaf479b5b15149c2bb368b2fba3432d9f15681` on `Business-It-Partners/abcd-repo` / `codex/m15-readiness`.
- Final exact-source public GitHub Actions run: [40305761627](https://github.com/Business-It-Partners/abcd-repo/actions/runs/40305761627) — **SUCCESS**: `windows-m15` and `linux-m15` completed successfully on the same SHA.
- Linux: documentation validation, fixture build, 40 test files / **545 passing unit tests**, and production build/typecheck passed.
- Windows Server 2022: locked dependency/toolchain, docs, fixture, unit/filesystem, build/typecheck, real Electron safeStorage with synthetic credentials, saved identity/session recovery, full integrated shell/API contract, shell/app failure containment, saved-state recovery, and both resource-pressure/16-app-limit checks passed.
- Exact public content integration: `7b969c9b9b432ac7fa37701f49b690f2c665c4de`; the subsequent public commits corrected the Windows hardening scenario and aligned the integrated UI test with the role-switching/clinic-widget/App Explorer flow. The Windows full integration suite now passes, including app install, isolated sessions, named SDK calls, write guards, staged app update/recovery, lock, uninstall, and sign-out.
- The private source branch `Business-It-Partners/dental-os` / `codex/milestone-15` was rechecked at `f3727089d3db86d9e23416ce348fbbdeeb2bf162` and was **not modified**. No private-repository Actions, production deployment, installer release, or merge to `main` was performed.
- The later *documentation-only* closeout commit is outside the tested source SHA. It does not modify runtime code, test behavior, dependencies, or workflow configuration and intentionally uses `[skip ci]`; the exact tested source remains `acbaf479`.

### Source preservation and limits

Both branches' intended changed application/source paths were accounted for against their shared ancestor. The private test screenshots and verification JSON were intentionally excluded from the public content transfer. Merge resolutions on shared application/platform files were tested as combined functionality; **this is not a claim that every individual clinic workflow or physical Windows installer has passed acceptance**.

### Remaining work outside repository consolidation

- M15/G15 independent technical review and formal milestone acceptance remain open.
- The protected staging wrong-MIME media-upload abort returned 404; pending intent/object cleanup remains unconfirmed. Do not make further staging writes until that state is inspected and verified.
- Real clinic end-to-end/staging checks, user acceptance on a physical device, Windows installed-product verification, signing, distribution, and any production promotion are separate follow-on gates.
- Keep public `codex/m15-readiness` as the consolidated source for later release preparation; do not silently merge or back-port it into the private repository.

### Earlier pre-consolidation verification note (historical)

The prior passing Windows hosted CI run `40270853889` proved only public source `8afb4a3`, before this consolidation. The integrated source requires **a new exact-source build, unit suite and Windows hosted UI pass**, plus Linux verification when available. The latest private M19/Linux checks were on earlier private source. Do not represent them as a pass for this consolidated code until rerun.

M15/G15 and protected staging media cleanup remain open independently of this content merge. Real Windows 10 machine acceptance and production signing/distribution are outside this consolidation task.
