# FEWA OS — Electron working rules

This root is the active Electron + React + TypeScript project. Read PRODUCT_DIRECTION.md; WORK_CHECKLIST.md is the active work contract. Read `dental-os_v1-documentation/00_V1_README.md` for the production architecture and `dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md` / `00_V1_STATUS.md` for milestone order and actual progress. Keep the checklist and milestone records consistent; prototype evidence is not production acceptance.

- The entire earlier Flutter/Rust project is archived under `refrence/`. Consult it for proven ideas; do not apply its product contract or build instructions to the active Electron code.
- Preserve Dental OS history. The user-authorized reference cleanup is recorded in docs/GIT_AND_CI_SETUP.md and docs/GIT_HISTORY_REWRITE_MAP.json. `refrence/` is local-only; never push local legacy Flutter branches/backups to Dental OS origin or merge that ancestry back. Preserve unrelated user changes. Do not commit, push, deploy, or delete archives/worktrees without authorization.
- Current source: `src/` owns shell/app presentation; `electron/` owns the isolated native bridge; shared lifecycle stays in windowManager/ManagedWindow. [Canonical repository structure](dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md) defines the target layout, ownership, import boundaries and incremental migration. Do not mistake planned paths for an already migrated codebase.
- Preserve the softer clarity styling: readable labels with quiet borders and moderate emphasis, not a harsh high-contrast redesign.
- Build with `npm run build`, run `npm test`, and use the smallest relevant private UI suites. Do not run Flutter/Rust checks for Electron-only changes.
- Before changing dock/Genie geometry, read `references/fewa/GENIE_ENGINE.md` and the archived `refrence/docs/motion/GENIE_ENGINE.md`; keep the shared field and fallback.

## Controlled builds, tests and resource use

- This workstation has approximately 12 GB RAM and 8 logical CPUs. Keep resource use bounded so the user's desktop stays responsive; recheck actual load rather than assuming capacity is available.
- Before dependency installation, builds, tests or other heavy jobs, inspect CPU/memory pressure and existing task-related process trees. Identify leftover builds, test runners, watchers, temporary servers or private displays before starting another job.
- Run one heavy job at a time across workers/worktrees. Do not overlap builds, test suites or dependency installs. Use the smallest relevant checks and conservative worker limits where supported; avoid full UI suites unless the change or required acceptance gate justifies them.
- Do not repeat passing checks without new changes, failures or unresolved concerns. Documentation-only work must not trigger a heavy build or runtime test suite.
- Use bounded, observable runs with appropriate timeouts and progress checks. Avoid unattended watch/restart loops; a yielded tool session does not mean its process has exited.
- High CPU alone is not proof of a deadlock. Confirm process ownership and lack of useful progress before stopping a stale, hung or runaway task-owned job. Attempt graceful termination first; force-stop only the confirmed task-owned process tree if necessary. Never use broad name-based kill commands.
- Preserve Brave/YouTube, the user's running Dental OS and all unrelated jobs. If ownership or impact is unclear, leave the process intact and clarify before terminating it. If unrelated load leaves insufficient headroom, defer heavy work rather than competing with it.
- After each heavy operation, verify completion and clean up task-owned child processes, temporary servers and private displays that are no longer needed. Check that no build/test loop remains. Keep a long-running process only when explicitly required, and report what remains running.

## Parallel worktree coordination

When the user requests parallel worktrees or agents, act as lead coordinator, split non-overlapping scopes, use isolated worktrees for repository edits, monitor workers, and own integration/review. Report the layout and status. Do not merge, push, deploy, or delete worktrees without authorization. For tightly coupled changes, explain why parallel work is not useful.

## Respect the user's live desktop

- The user watches YouTube and uses Brave while work proceeds. Automated UI testing must never show windows on their real desktop or take its focus.
- Run UI tests only through `npm run test:ui`, individual `npm run test:<name>` commands, or `node tools/run-ui-test.mjs <script>`. The runner creates a private headless GNOME/Wayland display and temporary D-Bus/settings/app profiles. Direct test scripts refuse to run on the live display.
- For new/ad hoc UI verification scripts, import `tests/profile.mjs` and use its profileArgs; execute the script through the runner. Never bypass the display guard or silently fall back to the host display.
- Do not stop, restart, reload, minimize, or focus the user's running application for automated verification. Keep their in-memory session intact. Built updates load on a later full launch; tell the user when that is required.
- Keep the shared window manager and shared dock field/Genie pipeline. App content owns only its UI and session demo data. Forms/blur remain scoped to their owning window.

## Dental OS product boundaries

- First-party company apps only for the product lifetime: never add third-party publishing, arbitrary sideloading or a public extension platform.
- Reuse the existing Dental SaaS backend as business authority; no local authoritative business DB or hidden offline write queue.
- Independent verified web apps, isolated runtimes, single-login credential mediation and safe updates are architecture requirements, not current implementation claims. Candidate renderer/installer decisions require their documented gates.
- Documentation-only changes: run `python3 tools/check-dental-docs.py`; do not launch graphical tests solely to verify prose. Runtime code changes retain the build/unit/private-UI requirements above.
