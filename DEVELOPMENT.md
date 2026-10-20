# Electron development

Work in `/home/master-x/Desktop/fewa_business_os`.

```sh
npm ci                 # only when dependencies need installing
npm run build          # TypeScript, Vite, Electron main/preload
npm test               # unit checks
npm run test:labs      # example focused UI suite on the private display
```

All graphical verification must use the private display runner described in AGENTS.md. Never launch test windows on the live desktop. `npm start` is an interactive user launch; it uses the current built files. Leave the user's running session intact during builds.

Source: `src/`, `electron/`. Verification: `tests/`, `artifacts/`. Archived Flutter/Rust implementation: `refrence/`. Pinned motion reference: `references/`. Published history contains Dental OS only; the local-only reference history cleanup is documented in docs/GIT_AND_CI_SETUP.md.

## Controlled execution workflow

The workstation has approximately 12 GB RAM and 8 logical CPUs. Protect responsiveness by running heavy work sequentially, including across agents and worktrees.

1. Before installing dependencies, building or testing, inspect current CPU/memory pressure and relevant process trees. Lightweight checks such as `uptime`, `free -h`, a short `vmstat` sample and scoped process inspection are sufficient; do not launch load-generating diagnostics.
2. Identify existing task-owned builds, test runners, watch/restart loops, temporary servers and private test displays. Check elapsed time and useful progress. High CPU by itself does not establish that a process is stuck.
3. Stop only confirmed stale or runaway processes belonging to our work. Terminate gracefully first, then verify exit; escalate only for the identified task-owned process tree if needed. Avoid broad commands such as killing every Node, Electron or browser process. Preserve the user's active Dental OS, Brave/YouTube and unrelated work. Clarify uncertain ownership; defer heavy work if unrelated load leaves insufficient headroom.
4. Run one required heavy command at a time. Wait for dependency installation/build completion before starting the next check. Use supported conservative worker limits and the smallest relevant unit/private UI checks; reserve the complete UI suite for justified regressions or acceptance gates.
5. Apply appropriate timeouts and observe progress. Do not start unattended watchers or automatic retry loops. Resume/poll a yielded command to learn whether it exited instead of starting a duplicate. Repeat checks only when new changes, failures or unresolved concerns justify it.
6. On success, failure, cancellation or timeout, verify the task and its children have exited. Clean up no-longer-needed task-owned temporary servers and private displays, and check for leftover loops. If a long-running process is explicitly needed, retain it deliberately and report its purpose.

Required code verification still applies, but must follow this sequence. Documentation-only changes use lightweight document/whitespace checks; do not run heavy builds, runtime tests or GUI suites for prose alone. An explicit instruction not to run tests takes precedence. Never interrupt the user's live session for cleanup or verification.

## Repository organization

Use [the canonical repository structure](dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md) for target paths, responsibilities, allowed imports, shared-package rules, fixtures, backend separation and source-versus-installed-state placement. Current code remains in `src/` and `electron/`; source migration is milestone work, not completed by documenting its target. Do not duplicate the folder tree here or create empty packages in advance.

## Architecture and execution records

Read [the Dental OS contract](dental-os_v1-documentation/00_V1_README.md), [roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) and [status](dental-os_v1_working_info/00_V1_STATUS.md) before production-platform work. The existing Store/apps remain prototypes until their milestone gates pass.

For documentation-only verification:

```sh
python3 tools/check-dental-docs.py
```

This checks local links, document structure and requirement ownership; it does not prove architectural quality or runtime security. Preserve existing work and never run live-desktop UI checks for documentation changes.

## Windows CI

Windows milestone validation runs on windows-2022 with Node 22.13.1: locked dependency install, documentation checks, single-worker unit/filesystem tests, build/typecheck and hosted Windows boot/restart/recovery smoke. Steps run sequentially with a 20-minute job timeout; same-ref superseded runs cancel. The Windows smoke script refuses non-GitHub-Windows execution. Artifacts retain logs and JSON for 30 days; preserve relevant results in milestone evidence. The POSIX file-mode assertion and file-symlink test are Linux-specific; Windows runs the directory-junction refusal and portable state fault tests. No cloud secrets or deploy steps are used. Physical Windows interaction remains deferred, not certified by CI.


## Milestone completion and main integration

After each milestone passes its required verification, commit/push its evidence and merge it into `main` under the user's standing authorization. Preserve the milestone branch and checkpoint tags. Use the [canonical integration policy](docs/GIT_AND_CI_SETUP.md), including source comparison and affected-check rules. Do not repeat passing heavy checks for documentation-only integration when the runtime is unchanged. Deployments and production promotion require their own authorization; physical Windows acceptance remains after M13 under G14 and before final release.


M05 identity checks: `npm run test:identity` runs synthetic private desktop verification. Optional real staging tools (`tools/verify-staging-identity.mjs --staging-identity-readonly` and private-runner `tests/identity-staging.mjs`) require an approved account via named environment variables or a mode-0600 credential input file outside the repository. The desktop live test also requires `DENTAL_OS_STAGING_ACCEPTANCE=true`. Never hardcode credentials, print tokens or add live identity checks to default CI. Retain reports with outcomes only; remove temporary credential inputs after use.

## M06 verified local packages

Read [dentalpkg/1](dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md) and [internal tooling](tools/app-packages/README.md). `npm run test:packages` uses the private display; `node tests/packages-crash.mjs` checks abrupt installer exits after a controlled build. Run these sequentially under resource rules. Normal launches trust no fixture signing keys. The existing sample-runtime flag now installs signed fixtures into the isolated profile and revalidates at launch; it never exposes a package file picker or production sideload command. Cloud delivery/Store wiring and full update policy remain M07/M08. Current user session remains untouched; new builds take effect on full relaunch.

## M07 Store delivery checks

`npm run test:distribution` exercises signed fixture catalogue → bounded download → registry → isolated launch → uninstall/relaunch under the private display. The guarded `--distribution-fixtures` path cannot call the network. Normal Store uses host catalogue/registry truth and stays unavailable while its pinned staging public origin is unconfigured. `tools/app-packages/prepare-staging.mjs --staging-only <external-key> <sequence> <new-output>` prepares two signed samples/catalogue without cloud calls; do not commit its signing key. See M07 rollout record for separately approved staging operations. Never deploy the SaaS branch or create a bucket merely to make local tests green.
