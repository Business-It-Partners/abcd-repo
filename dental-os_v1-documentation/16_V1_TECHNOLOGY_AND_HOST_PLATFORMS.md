# Dental OS — Technology and Host Platforms

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

| Layer | Baseline |
| --- | --- |
| Supported host families | Windows and Linux |
| Trusted desktop host | Electron, TypeScript, narrow platform-owned preload |
| Shell and app UI | React, TypeScript, web assets |
| App delivery | signed metadata + immutable web packages in Cloudflare R2 |
| Backend | existing Cloudflare Worker/D1/private R2 Dental SaaS |
| Identity | existing Firebase identity, Worker authority |
| Local data | OS installation/preferences/journal only; no local business DB |
| Native integration | platform adapters; no required Rust service topology |

Electron/Node/React/tool versions are maintained in source/lockfiles; do not duplicate changing version pins here. Define supported Windows versions, Linux distributions/display systems, CPU architectures and installer formats before release. Candidate baseline is Windows x64 and a named Linux x64 desktop configuration; this is not certification or a frozen support promise. macOS/mobile/web deployment of Dental OS is not included.

Printing, file dialogs, external links, notifications, secure storage, app startup and installers are host-provider concerns. Test Windows independently; Linux evidence cannot certify it. Automated Linux GUI tests must use the project's private display runner. User-requested interactive launches are separate from test automation.

Distribution choices must document signing, install permissions, updates/uninstall and downgrade/recovery behavior. No hardware printing support is claimed until scoped requirements and actual device evidence exist.

## Reused backend infrastructure

Use the existing `fewa_demo` Dental SaaS and Super Admin projects, GitHub environments/workflows and Cloudflare setup. Dental OS backend changes and remote tests target verified Cloudflare staging only. Exact branch/resource names remain to be inspected and recorded before implementation; no new production targets or replacement backend are implied. See [environment mapping requirements](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## Verification policy revision — deferred physical Windows testing

User decision, 2026-10-15: during M02–M11, Windows acceptance uses GitHub Actions automated build/typecheck, filesystem tests and applicable hosted-runner smoke checks. Physical Windows-device interaction/visual acceptance is deferred until after M11 and remains a mandatory final product release gate. Missing physical evidence does not block starting the next milestone once its applicable Linux and Windows CI gates pass, but must not be described as physical-device certification or final release approval. If a CI check cannot cover a required behavior, record the remaining risk explicitly. M11 implementation/CI completion is distinct from final product release acceptance.

Preserve exact checkpoint commits, workflow run URLs and outcomes. main carries the integrated snapshot; codex/milestone-NN records each started milestone. Never claim a later milestone started because its branch name exists. Only create future milestone branches when work starts. Tags/commit SHAs establish reproducibility; do not force-move acceptance tags or publish an acceptance tag while required CI is failing/pending.
