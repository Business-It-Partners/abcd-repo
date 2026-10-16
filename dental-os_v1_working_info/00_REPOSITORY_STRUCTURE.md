# Dental OS — Canonical Repository Structure

**Updated:** 2026-10-15. **Scope:** repository organization, ownership and dependency boundaries.

This is the single source of truth for where Dental OS code and supporting files belong. It documents the agreed target structure; it does not claim that migration has occurred.

## 1. Authority and current status

- [Architecture](../dental-os_v1-documentation/00_V1_README.md) defines product/system behavior and trust requirements.
- This file defines repository placement, dependency direction and migration rules.
- [Master roadmap](00_V1_MASTER_ROADMAP.md) defines execution order; [global status](00_V1_STATUS.md) records progress.
- [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) remains the active work contract and detailed prototype history.
- Source is implementation reality; retained evidence establishes verified behavior. If source and target differ, record the gap rather than implying migration is complete.

**Current state:** shell and demo components are in `src/`; trusted host/preload code is in `electron/`; root package/build/test entry points remain active. The `apps/` and `packages/` layout below is a target, not an instruction to move files during this documentation task. Production application UI/workflow delivery remains separate from the OS-platform milestones.

Create directories when real implementation or a deliberate migration needs them. Do not populate the target with empty modules, duplicate implementations or placeholder package manifests to make it appear complete.

## 2. Target tree

```text
fewa_business_os/
├── AGENTS.md
├── README.md
├── PRODUCT_DIRECTION.md
├── WORK_CHECKLIST.md
├── DEVELOPMENT.md
├── HOW_TO_RUN.md
├── dental-os_v1-documentation/          # Product and architecture contract
├── dental-os_v1_working_info/           # Execution, current status, evidence
│
├── apps/
│   ├── desktop/
│   │   ├── src/
│   │   │   ├── main/                    # Trusted Electron platform
│   │   │   │   ├── bootstrap/
│   │   │   │   ├── lifecycle/
│   │   │   │   ├── app-runtime/
│   │   │   │   ├── package-manager/
│   │   │   │   ├── distribution/
│   │   │   │   ├── identity/
│   │   │   │   ├── api-broker/
│   │   │   │   ├── ipc/
│   │   │   │   ├── storage/
│   │   │   │   ├── host/
│   │   │   │   │   ├── windows/
│   │   │   │   │   └── linux/
│   │   │   │   └── diagnostics/
│   │   │   ├── preload/
│   │   │   │   ├── shell/
│   │   │   │   └── application/
│   │   │   └── renderer/
│   │   │       ├── shell/
│   │   │       ├── desktop/
│   │   │       ├── windows/
│   │   │       ├── dock/
│   │   │       ├── overview/
│   │   │       ├── motion/
│   │   │       ├── store/
│   │   │       ├── session/
│   │   │       ├── settings/
│   │   │       ├── recovery/
│   │   │       ├── styles/
│   │   │       └── assets/
│   │   ├── resources/                  # Desktop icons and packaging inputs
│   │   ├── package.json
│   │   └── <desktop build configuration>
│   └── dental-apps/                    # Later first-party application delivery
│       └── <application-id>/
│           ├── src/
│           ├── assets/
│           ├── tests/
│           ├── app.manifest.json
│           └── package.json
│
├── packages/
│   ├── platform-contracts/
│   ├── app-sdk/
│   ├── ui/
│   └── package-format/
├── fixtures/
│   ├── prototype-apps/
│   ├── runtime-apps/
│   └── package-cases/
├── tests/
│   ├── integration/
│   ├── security/
│   ├── recovery/
│   ├── ui/
│   └── support/
├── tools/
│   ├── verification/
│   ├── app-packages/
│   ├── desktop-release/
│   └── documentation/
├── config/
│   ├── development/
│   └── staging/
├── .github/
│   └── workflows/
├── references/                         # Curated reference material
├── refrence/                           # Preserved Flutter/Rust archive
├── artifacts/                          # Local generated verification output
├── package.json                        # Workspace and familiar root commands
├── package-lock.json
└── <shared TypeScript/tool configuration>
```

Angle-bracket entries are descriptive placeholders, not literal filenames. This layout does not require every app to ship at the same time or share a release number. The package manifest's final wire schema remains governed by M06.

## 3. Desktop ownership

| Directory | Responsibility | Must not contain |
| --- | --- | --- |
| `main/bootstrap` | trusted startup/composition root and configuration validation | app workflow rules |
| `main/lifecycle` | native instance activation, host transitions, shutdown/lock coordination | app-specific forms |
| `main/app-runtime` | verified app-to-webContents binding, view supervision, health and teardown | app-defined privilege grants |
| `main/package-manager` | local verification, registry, staging/extraction, activation, uninstall/rollback | patient records or UI animation authority |
| `main/distribution` | catalogue/release selection and bounded package transport | separate business backend or release signing private keys |
| `main/identity` | shared authentication, renewal, secret-provider coordination, session generations | renderer-accessible token stores |
| `main/api-broker` | bounded authorized transport to existing SaaS operations | duplicated clinical/financial rules |
| `main/ipc` | validated handler registration and sender/frame/capability enforcement | unrestricted generic proxy handlers |
| `main/storage` | OS-state roots, atomic persistence, schema/journal recovery, capacity policy | local authoritative dental database |
| `main/host` | narrow file/print/notification/secret/native adapters with OS-specific implementations | general shell-command execution for apps |
| `main/diagnostics` | redacted bounded operational events, health and recovery support | default patient payloads/screenshots |
| `preload/shell` | platform-owned shell bridge for approved shell operations | direct exposure of raw Electron/Node objects |
| `preload/application` | platform-owned restricted application bridge | package-supplied preload or shell-management powers |
| `renderer` | presentation of desktop and platform state | privileged service implementations or refresh secrets |

The main bootstrap wires dependencies explicitly. Feature modules depend on narrow contracts instead of importing bootstrap/global singletons. Long-running extraction or verification may use supervised workers when necessary; new process directories are introduced only with an actual implementation and lifecycle policy.

Shell window state remains shared. Renderer `windows/` owns visual frames/focus/geometry interaction, while trusted `app-runtime/` owns native view/process control and authenticated runtime identity. They exchange validated state/intents; neither creates a second independent lifecycle model. The exact composition is subject to the M03 rendering proof.

`renderer/store` presents installation truth from trusted services. `renderer/session` presents safe sign-in/session state; it does not own token authority. `renderer/motion` retains shared field/snapshot/fallback behavior. Apps own scoped content/forms, not desktop chrome.

## 4. Shared packages and dependency rules

| Package | Allowed contents | Consumers |
| --- | --- | --- |
| `platform-contracts` | versioned messages, runtime schemas, structured errors, lifecycle/capability vocabulary | host, preloads, shell, SDK and verification tools |
| `app-sdk` | restricted application-facing client and safe types over the platform-owned bridge | company apps and controlled fixtures |
| `ui` | reusable components, visual tokens, accessibility primitives | shell and apps where useful |
| `package-format` | pure manifest/metadata schemas, canonicalization and integrity-format primitives | trusted package services and internal build/verification tools |

Dependency direction:

```text
app UI -> app-sdk -> platform-contracts
app UI / shell UI -> ui
preloads / trusted host -> platform-contracts
package manager / build tools -> package-format
```

These are code dependencies, not permission grants. `ui` has no business/session authority and does not fetch data autonomously. `platform-contracts` and `package-format` must not import Electron, host services, apps or credentials. Browser-safe packages must remain free of transitive Node/native authority.

Rules:

- Dental app source cannot import desktop internals, preloads, another app's source or another app's mutable store.
- Renderer code cannot import trusted main-process modules, credential adapters or filesystem services. It uses its approved bridge.
- Preload code is shipped and updated by the desktop platform, not the app bundle.
- `main/` must not import renderer components or app source to run a workflow.
- Shared packages cannot depend on `apps/` or test fixtures. Keep dependencies acyclic.
- Package validation primitives may be reused, but the trusted verifier alone selects trust roots, binds identity and authorizes execution.
- Publish explicit package exports; do not bypass them with deep relative imports into another package's source. Type-only imports must also use approved contracts, not host internals.
- Network/IPC boundaries require runtime validation even when compile-time imports/types are correct.

Enforce these boundaries with project references, package exports and suitable lint/build checks as implementation proceeds. This document does not claim those checks already exist. Add a shared package only after a concrete stable responsibility justifies it; avoid a catch-all `common/`, `utils/` or `services/` dumping ground.

## 5. Application and fixture boundaries

Each `apps/dental-apps/<application-id>` is a company-controlled independently built web application. Its package contains no native executable, app-owned preload, install script or Node privilege. Use a stable app ID separate from its display name. Reuse SDK/UI/contracts through declared compatible versions; builds bundle runtime dependencies and do not require another app to be installed.

Within a substantial app, organize `src/` by workflow/feature; keep components, state, request adapters and unit tests near the owning feature. Extract genuinely shared app-local components only when needed. A larger feature may use `components/`, `model/` and `api/`; do not mandate those subfolders for every small screen.

| Fixture area | Purpose | Release rule |
| --- | --- | --- |
| `prototype-apps` | preserved synthetic UI and session demos | not production dental applications |
| `runtime-apps` | controlled two-app runtime/lifecycle proof | isolated dev/test profiles or explicitly approved sample releases |
| `package-cases` | valid, altered, incompatible and adversarial package inputs | never discovered as normal installable apps |

Fixtures use synthetic data. Test signing keys must be unmistakably test-only and not trusted by production policy. Build/release inputs explicitly allowlist deliverables; fixture placement alone does not guarantee exclusion. Production app development remains a separate delivery from the platform roadmap's sample-app proof.

## 6. Verification, tools and configuration

Co-locate focused unit tests with the feature/package they verify. Root `tests/` owns cross-boundary checks: integrated session/runtime flows, security negatives, restart/recovery and private-display UI suites. `tests/support` contains synthetic profiles and shared harness code, not business services. App-level acceptance may live in the app's `tests/`; cross-platform OS acceptance stays at root.

`tools/verification` owns controlled runners; `tools/app-packages` owns deterministic internal assembly/inspection; `tools/desktop-release` owns platform packaging/release automation; `tools/documentation` owns documentation validation. Tools cannot become an alternate runtime authority or a hidden production sideloading mechanism.

Keep root commands stable during migration. Retain npm and its lockfile; introduce npm workspaces when real package boundaries require them. Package-manager replacement is not part of this organization change. Independently released apps/SDK have explicit versions and compatibility; a workspace does not imply lockstep releases. Do not use symlinks to the development source as a production installation strategy.

`config/development` and `config/staging` contain safe schemas, examples and reviewed non-secret target configuration. Never commit tokens, service-account JSON, passwords or release private keys. API base, identity project, catalogue and download targets must resolve to the verified environment together; no automatic production fallback. Selected installers/resources/build outputs have explicit packaging paths once implemented.

Run required verification sequentially under the [controlled resource rules](../AGENTS.md). UI automation always uses the private display runner. Folder changes do not justify uncontrolled full-suite reruns; documentation-only changes use lightweight document checks.

## 7. Separate backend repositories

The existing `fewa_demo/dental-saas` repository owns Worker APIs, business contracts, D1/R2 access and shared backend operations. `fewa_demo/super-admin` owns operator UI. Do not copy, move or duplicate either backend into Dental OS, and do not add a second backend directory here.

Consume shared API contracts from one maintained source via a deliberately versioned package/generated artifact or another recorded integration method. Freeze the exact mechanism before use; do not maintain independently edited copies of backend authority or schemas.

All roadmap backend changes and remote integration remain staging-only, reusing existing GitHub/Cloudflare/Firebase setup. Record the actual branch/environment/resource mapping before changes; preserve current clients. New OS services use `/v1/dental-os/...`; existing business routes remain unchanged. See the [canonical backend policy](../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). No production deployment or cloud resource action follows from this folder map.

## 8. Source, generated output and installed state

| Category | Location/policy |
| --- | --- |
| Maintained source/config/docs | reviewed repository files and package inputs |
| Local build/dependency output | declared ignored output directories; no secrets in distributed assets |
| Local runtime verification output | `artifacts/`, bounded and redacted; not a runtime dependency |
| Retained milestone evidence | milestone `evidence/`, intentional safe logs/reports with source identity |
| Installed app packages and registry | platform-selected OS application-data root, never source folders |
| Remembered credentials | approved host secret provider, never package/config/artifact directories |

Conceptual installed-state layout, outside the checkout:

```text
<OS-selected Dental OS data root>/
├── state/
├── applications/<app-id>/<version>/
├── staging/
├── operation-journal/
└── diagnostics/
```

Resolve actual Windows/Linux locations through platform APIs and an explicit profile policy; do not hardcode a developer home path. Registry/journal ownership remains trusted. Enforce extraction boundaries and separate test profiles. App install/update/uninstall never edits `apps/dental-apps/` and never deletes SaaS records. This data-root layout does not create a local clinical database or authorize a patient cache.

Ignore generated local outputs and dependencies; retain only deliberately selected safe evidence. Do not blanket-ignore all `evidence/` or accidentally publish diagnostic output in app packages. Historical `artifacts/` and relocation records are preserved; no bulk cleanup is authorized by this document.

## 9. Incremental migration map

| Current source | Target responsibility | Migration gate |
| --- | --- | --- |
| `electron/main.ts` | `apps/desktop/src/main` modules and composition root | M02; split by actual responsibility |
| `electron/preload.ts` | shell/application preload separation | M03/M04; preserve validated behavior |
| `src/App.tsx`, `src/main.tsx` | shell entry/composition and desktop presentation | controlled desktop migration |
| `src/windowManager.tsx`, `ManagedWindow.tsx`, title/geometry helpers | renderer `windows` plus runtime adapter contracts | M03; preserve one shared lifecycle |
| Dock, artwork, overview and motion modules | renderer `dock`, `overview`, `motion`, assets | preserve shared field/Genie fallback and private regressions |
| `src/StoreApp.tsx`, `storeArrival.ts` | renderer `store` presentation | M06–M08 replace simulated authority, not just move it |
| Synthetic `src/*App.tsx` bodies/demo state | `fixtures/prototype-apps` as deliberately reconciled | not automatic conversion to production apps |
| `tests/`, `tools/`, root build configuration | scoped test/tool areas and workspace entry points | preserve runner guards and root commands |

Migration procedure:

1. Inspect current worktree and owning milestone; preserve unrelated edits.
2. Move one coherent boundary and update imports, asset paths, build/test inputs and launcher/package paths together.
3. Avoid maintaining old and new implementations as competing authorities. Any temporary adapter has an explicit owner and removal criterion.
4. Run the smallest necessary verification under resource limits; file moves affecting output need appropriate build/private checks when implemented.
5. Record actual migrated paths, source/evidence and remaining old locations in the owning milestone and current-state map.
6. Remove superseded implementation only after its replacement preserves required behavior; archive/deletion restrictions still apply. Never delete `refrence/` or reset Git history as migration cleanup.

M02 introduces host/state structure; M03 establishes isolation/composition; M04 extracts SDK/contracts. M06 introduces package-format/build boundaries. Later migrations follow actual scope, not the desire to create the whole tree at once. M01 documentation verification does not complete any source migration.

## 10. Documentation and naming conventions

The architecture index links here instead of copying the full target tree. Root instructions and development guidance link here. Architecture diagrams may show logical services without duplicating physical paths. A source-placement change updates this file and the relevant milestone; a behavioral/trust change also updates architecture/ADRs. Resolve conflicts explicitly rather than maintaining two competing folder maps.

Each milestone retains `PLAN.md`, `STATUS.md`, `IMPLEMENTATION_NOTES.md` and `VERIFICATION_EVIDENCE.md`. Introduce submilestones with the same pattern only when execution needs them. Optional `REQUIREMENT_COVERAGE.md` binds actual cases; `evidence/` stores executed, redacted outcomes including superseded failures. New filenames use descriptive consistent names; React components use PascalCase and feature directories use lowercase hyphenated names. Existing filenames need not be renamed gratuitously.

Preserve both `references/` (curated material) and `refrence/` (the existing archived project spelling). The newer Flutter documentation pattern was inspected at `origin/codex/m08-pharmacy-engine`, commit `314bebd5f45591e966eee2482c7f4a994e2a7564`. Its milestones/source structure do not become the Dental OS contract; do not switch/reset the checkout or overwrite the archive to consult it.

## 11. Completion criteria for this document

The target tree, ownership, dependency rules, backend separation, runtime-data placement and migration policy are documented and discoverable. Actual migration completion is recorded only when source moves and milestone evidence establish it. This document does not authorize backend edits, deployment, package installation, source restructuring or heavy verification by itself.

## Git and CI ownership

The dedicated remote is https://github.com/Business-It-Partners/dental-os. Preserve the former Flutter remote as flutter-reference and retain its history; never push this project to it. main is the integrated Dental OS snapshot. Started milestone branches use codex/milestone-NN; future branches are created on start. .github/workflows/windows-validation.yml owns bounded sequential hosted Windows checks, not backend deployment. Physical Windows tests are deferred until after M11 and before final product release under the architecture acceptance policy. Reconstructed historical checkpoints must be labeled as reconstructed, never as original verified commits.

## M03 transitional source mapping

The bounded runtime proof introduces `electron/runtime/` for the trusted fixture supervisor/preload and `fixtures/runtime-apps/` for fixed synthetic assets, plus `src/RuntimeFixtures.tsx` for shared-frame integration. `electron/runtime/contracts.ts` is an explicitly renderer-safe transitional contract (pure schemas/types/pixel helper, no Node/Electron imports); the shell may consume its safe exports until M04 extracts the governed shared SDK/contracts package. This is not permission to import other trusted runtime internals. No full apps/packages migration or production app registry is claimed.


## M04 source mapping

`electron/sdk/contracts.ts` is a pure renderer-safe transitional SDK contract; `environment.ts`, `broker.ts` and `fixtures.ts` are trusted main-process code. Application preload uses a type-only contract import and fixed IPC channels, without importing host implementations into sandboxed app JavaScript. Existing src/electron paths/build remain stable; planned packages migration is not claimed. SDK integration/transport fixtures are `tests/sdk*.mjs` / `tests/sdk*.test.ts`. Scoped preference/operation fingerprints are memory-only OS coordination, not authoritative business storage.


## M05 source mapping

Trusted identity/REST/session/protected-store adapters live in `electron/identity/`; only its pure contracts are type-imported into the shell. `src/IdentityGate.tsx` owns platform sign-in and `src/SessionBoundary.tsx` scopes shell generation. App code has no identity-client/store imports. `tests/identity*` owns controlled integration/security/live optional acceptance; `tools/verify-staging-identity.mjs` is explicit approved-account, identity-only staging acceptance. No credential input is stored in the repository. Broad packages/apps migration remains separate work.
