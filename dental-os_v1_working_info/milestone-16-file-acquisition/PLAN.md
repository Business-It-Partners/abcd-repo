# M16 Plan — Dental OS Files and Local Acquisition

**Status:** M16.6 hosted integration and engineering closeout COMPLETE on exact tested source `772a739ed3af`. The later Image Viewer follow-up is implemented on `1ae45df4`; local Linux build/unit/UI checks pass, and targeted Windows Actions on test commit `72967aa4e7c721088725b018f929d113052e317a` passed 47 focused security tests, build/typecheck and 32/32 private GUI assertions. Native cross-view drag remains formally deferred after source/API feasibility review; physical-device acceptance is NOT RUN. **G16 OPEN; M16 not yet accepted.**
**Date:** 2026-10-22. **Branch:** codex/milestone-16.
**Base:** M15 at 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d.
**Requirement:** R16. **Gate:** G16.

## The two sources of truth

1. [ARCHITECTURE.md](ARCHITECTURE.md) is M16's **technical source of truth**: what Files, picker, local selection and sandbox boundaries mean.
2. This plan is M16's **execution source of truth**: how to implement, test, record and accept it.
3. [STATUS](STATUS.md) shows reality, [Implementation Notes](IMPLEMENTATION_NOTES.md) records technical changes, and [Verification Evidence](VERIFICATION_EVIDENCE.md) contains source-bound results. Plans never count as passing tests.
4. The V1 [architecture index](../../dental-os_v1-documentation/00_V1_README.md), [master roadmap](../00_V1_MASTER_ROADMAP.md), [repository structure](../00_REPOSITORY_STRUCTURE.md), [ADR register](../../dental-os_v1-documentation/20_V1_ADR_REGISTER.md), and root [working rules](../../AGENTS.md) still govern shared invariants.

This work extends the M15 platform baseline. Cloudflare media upload, backend patient association, native print/export, arbitrary app messaging, clinical module implementation, installers and production deployment are **not** part of M16.

## Operating approach

**Understand → Decide contract → Implement → Focused local validation → Review changes → Push → Verify CI/source → Record evidence → Next slice.**

One sub-milestone at a time. Before any code, read exact current source, not only docs. Keep one heavy job at a time and use private UI displays; never steal focus from live user applications. Use synthetic non-clinical disk files. Avoid repeated push/fail debugging loops. Keep the branch reviewable and M15 untouched. Record all failures, corrections and exact-SHA reruns.

Documentation-only changes require documentation validation, not app builds or desktop tests. New runtime changes require the smallest focused security/unit checks first, then private Linux/UI and applicable Windows CI. No network/deployment testing is necessary for local acquisition.

## Sequential work packages

| Phase | Deliverable | Exit conditions |
| --- | --- | --- |
| **M16.1 — Architecture and planning** | Architecture, app-owned picker model, OS Files model, temporary receipts, capability design, trust boundaries, explicit fallback, R16/G16/ADR-030, evidence plan. | Documents consistent with established invariants; open SDK permission and drag implementation choices reviewed before runtime. |
| **M16.2 — Trusted filesystem service** | Host-only folder and volume discovery, safe paginated read-only listings, canonicalization/link denial, selected-file lease registry, cancellation and redacted outcomes. | Unit/security cases: link/path escape, forged caller, OS permission, file changed, expired lease, session revoked, large folder and cleanup. |
| **M16.3 — Files core window** | Dock launch, shared managed window, folder navigation, sort/select, breadcrumbs, access errors and keyboard/screen-reader UX. | Isolated trusted shell privileges and private-display OS window/focus/Genie/overview regression. |
| **M16.4 — OS custom picker + native fallback** | Modal picker launched by permitted user gesture, parented native host file dialog, scoped recipient receipt, cancel/errors. | Signed first-party positive and unauthorized/stale/forged negative cases; Windows/Linux fullscreen-parent/focus proof. |
| **M16.5 — Files-to-app transfer** | Drag where native view behavior permits, explicit Send-to-active-eligible-app fallback, recipient hit-testing and single-recipient receipt. | Cross-window private UI and Windows cases; no raw paths, no generic app messaging; fallback always works. |
| **M16.6 — Closeout** | Source-bound build/typecheck, appropriate unit/private UI, applicable Windows workflow, security/resource/failure proof and app handoff. | G16 case-by-case evidence; unresolved drag/device limits explicit; no upload/production claim. |

## M16.1 architecture decisions still requiring exact review

- The SDK shape of local.files.pick and how verified signed packages/host policy represent a local-file-selection capability **separately from** M15 format-2 backend API grants.
- How to attest a fresh button click and bind to app ID/version/WebContents/frame/session/window without app spoofing.
- How modal picker and fallback native picker retain focus above fullscreen under Windows and Wayland.
- The main-process selection handle lifecycle and path-race/link denial, cancellation and recipient-only handoff.
- Whether a reliable native cross-WebContentsView drag is possible with OS-owned control; explicit Send must not depend on this finding.

Do not widen SDK or IPC permissions while these are undecided. Capture resolved decisions in [architecture](ARCHITECTURE.md) and [ADR-030](../../dental-os_v1-documentation/20_V1_ADR_REGISTER.md), then begin M16.2.

## Acceptance matrix

| Area | Positive | Negative |
| --- | --- | --- |
| Browsing | Actual Home, Downloads, Pictures, mounted test drive, sorted/paged list | Permission denial, symlink/junction, traversal, vanishing volume, huge folders |
| Picker | Custom in fullscreen + native fallback + cancel | Unapproved/forged/non-gesture call, wrong session, modal focus loss |
| Receipt | Correct installed app gets a selected item | Other app reuse, old release, app crash/update, expired or replaced file, raw path disclosure |
| Transfer | Drag if proven, plus explicit Send fallback | Wrong hit target, dropped outside, modal/dirty/unknown-write race, no generic messaging |
| Security/privacy | Host-only path, read-only, no persistence or diagnostics content | Arbitrary open/read/delete, unexpected disk buffers or clinical filename logging |
| Platform | Focus, keyboard, overview/dock/Genie, Linux and Windows checks | Behind-fullscreen dialog, inaccessible mount and interrupted file selection |

## Source ownership and checks

Trusted service under electron/host/ with guarded integration in electron/main.ts, electron/preload.ts, electron/runtime/manager.ts and relevant electron/sdk/ contracts. Files/picker UI in src/ reusing the existing ManagedWindow/windowManager lifecycle. No broad repository migration. A standalone Files system window must not become a privileged dental app runtime.

Each verification record contains exact SHA, command, environment, result, failed attempt and scope limitation. Full local document checker for M16.1 is needed before implementation, but it certifies only documentation consistency.

## Phase 1 completion tracker

- [x] Branch from exact M15 source SHA.
- [x] Inspect platform architecture, trusted host, SDK, runtime and window manager.
- [x] Author architecture and implementation plan.
- [x] Separate local acquisition from deferred upload.
- [ ] Run committed-source documentation checker and record actual result.
- [x] Finalize the local selection permission/SDK and native drag **fallback contract** before runtime code; actual drag mechanics remain a later runtime acceptance case.

Current state remains **documentation/design only**, with the M16.1 contract decisions recorded. G16 runtime acceptance is not claimed.

## M16.1 design review closeout — 2026-10-22

The source review resolved the core pre-implementation choices, now codified in [Architecture §11](ARCHITECTURE.md):

- **Grant mechanism:** signed package manifest + fresh company-signed app-level policy capabilities + shipped platform trust ceiling; **not** M15 per-release clinic API grants or a generic IPC filesystem route.
- **SDK:** explicit `local.files.pick` local operation through the existing broker with an awaited trusted coordinator; SDK minor 1.5 only when implemented.
- **Consent:** platform-preload trusted activation (one-use main-held 750 ms ticket), recipient/window/session checks, and actual OS-owned picker confirmation.
- **Result:** opaque, bounded, recipient- and version-bound metadata-only receipts. No raw paths or bytes to dental app JavaScript and no upload.
- **Files/fallback:** read-only trusted root IDs/page enumeration, modal custom picker, human-approved native dialog (including selected files outside standard browsing roots), no general path access.
- **Cross-view transfer:** OS-shell mediated receipt; explicit Send is mandatory. Native cross-WebContentsView drag remains implementation/acceptance risk, not an open contract decision.

M16.1 handoff: implement **M16.2 trusted host adapter only** in the next working session. Do not bundle Files UI, picker or drag in that session. Use local focused validation before a consolidated push and reserve costly Windows CI for a justified platform behavior gate.

## M16.3 bounded execution / acceptance

- [x] Reuse static shared managed-window controller, dock, focus, minimize/restore, overview and keyboard shortcuts for **Files**.
- [x] Implement read-only Files application with root sidebar, folder breadcrumbs, back/forward/up, refresh, deterministic paged listings, visible selection, loaded-page sort and meaningful permission/error states.
- [x] Enforce trusted main-frame **shell-only** IPC for `files:roots` and `files:list` with exact generation and closed payload schema. No app-preload, business SDK, or raw path/bytes operations.
- [x] Add a synthetic private-display fixture and targeted security, window-lifecycle and UI regression scripts.
- [x] Protect file names in OS overview and minimized previews with static sanitized artwork.
- [x] Source-bound Windows documentation, 448 unit tests (4 skipped), app package checks and build/typecheck passed at fa3fc247; full graphical workflow failed at a runtime timeout unrelated to a direct Files test.
- [ ] Run private Linux UI script `npm run test:files` when a private GNOME environment is available; no GUI acceptance is claimed yet. Do not use the user's display or real clinic files.

**Stop before M16.4:** no OS-owned modal picker, native host file dialog, app SDK activation, file receipt transfer, drag/drop, or Cloudflare upload is enabled in M16.3.

## M16.4 bounded implementation tasks (2026-10-22)

- [x] Extend the existing typed SDK with local.files.pick (minor 1.5); strictly validate purpose, file category and selection count 1–10.
- [x] Enforce separate local-file permission through verified company package manifest, signed app-level update policy, shipped trust ceiling, app family and live session — never use clinic API release grants for disk access.
- [x] Bind a recent **isTrusted** user gesture recorded by the isolated platform preload to exactly one focused, verified app main frame (750 ms, one-use).
- [x] Route the authorized request through the existing async/cancellable SDK broker; never add an app-visible filesystem IPC channel or network upload.
- [x] Display an OS-owned custom picker using the shared Files browser, with explicit confirmation, keyboard Escape/cancel, and native Electron open dialog fallback parented to the fullscreen host window.
- [x] Return only short-lived, single-recipient opaque metadata receipts. The trusted main process alone holds canonical host paths.
- [x] Add unit tests for unauthorized/forged/invalid requests, recipient binding, cancellation, native-file consent, symlink denial and no host paths in replies.
- [x] Exact-source M16.4 Windows checks at 69dfaa45339d: documentation, 456 unit tests (4 skipped), TypeScript/build, and first-party package checks passed; graphical OS runtime remains unverified.
- [ ] Run the M16.3 Files and M16.4 modal/native picker **private-display** graphical scenarios on actual supported Windows/Linux hosts. No acceptance claims from an unavailable compositor.
- [ ] Validate a company-signed dental application release explicitly declaring local.files.pick; older already-deployed app releases cannot gain authority retroactively. No staging deployment is part of this task.

**Stop:** M16.5 drag-and-drop and Files-to-app explicit transfer, Cloudflare uploads and patient-record association remain excluded. A receipt does not permit reading local file bytes.

## M16.3/M16.4 remote GUI verification follow-up

- [x] Isolate prior Windows runtime failure: Motion Studio launcher not found before graphical test body proceeded.
- [x] Prepare one tagged, bounded hosted Windows focused Files/picker verification job and skip costly full suite.
- [x] Observe and archive exact focused graphical result: Windows hosted Files navigation, custom picker and cancellation passed 12 checks; screenshots/JSON retained in GitHub artifacts.
- [ ] Verify native host OS dialogs and private Linux GUI separately.
- [ ] Verify company-signed first-party dental app permission and trusted gesture before claiming G16 verified.

## Latest cross-platform graphical verification tasks

- [x] Inspect exact b552f18 Windows/Linux logs and classify native dialog versus Linux teardown separately.
- [x] Prepare bounded Win32 HWND/UIAutomation native dialog selection and error-preserving test cleanup.
- [x] Prepare bounded Wayland private CI exit after synthetic GUI checks and avoid a repeat full-suite Windows run.
- [x] Observe one exact-source tagged Windows + Linux verification result and update evidence.
- [x] Confirm the native host dialog and signed app receipt on Windows, all Linux UI checks and clean runner completion before declaring these three M16.4 tasks finished.

## M16.4 exact-source cross-platform checkpoint

- [x] Windows 17 real GUI assertions passed on ef7acba, including company-signed SDK and actual native file-dialog selection; full Windows CI job timed out during teardown.
- [x] Linux isolated Wayland: **completed success** with seven graphical checks on ef7acba.
- [x] Confirm one Windows-only bounded teardown correction completes with a green focused CI job; retain failing/cancelled prior evidence and avoid rerunning Linux.
- [x] Once confirmed, mark M16.4 picker verification complete (not overall G16, which still needs M16.5 transfer work).

## M16.4 final cross-platform verification — accepted 2026-10-22

- **Windows fully green:** exact code SHA `76a3e418f80fc8b5bc0770306a0d3a157176dda6`, [targeted Actions 39777077788](https://github.com/Business-It-Partners/dental-os/actions/runs/39777077788) **conclusion SUCCESS**, focused security/unit tests and TypeScript/build passed, plus **17 automated graphical checks passed**. Native Win32 common dialog was actually located, selected `m16-synthetic-xray.png`, returned the metadata-only receipt through an ephemeral signed dental app SDK, and the test script exited successfully (`M16 WINDOWS VERIFIED EXIT SUCCESS 17`). No filesystem paths were returned to the app.
- **Linux fully green:** exact code SHA `ef7acba596c2ec98e51ec019b1b5013f7510c74b`, [targeted Actions 39775866409](https://github.com/Business-It-Partners/dental-os/actions/runs/39775866409) **linux-files-ui job conclusion SUCCESS** after **7 Wayland graphical checks**: Files browse/back, ephemeral company-signed app in isolated view, delayed-gesture forbidden, accepted custom picker metadata, cancellation, and clean CI exit. Windows in that older combined run was cancelled after 17 functional checks because of runner teardown; this was corrected and fully verified in the later Windows-only run.
- **Quota discipline:** full historical Windows milestone suite intentionally skipped for targeted pushes; the final Windows-only run explicitly skipped already-passing Linux. No repeat testing requested after both platform jobs became green. Documentation closeout uses `[skip ci]`.
- **Scope statement:** This closes the three remaining M16.3/M16.4 GUI verification tasks (native Windows dialog, signed app SDK, isolated Linux GUI). It does **not** implement or accept M16.5 Files-to-app drag/send, file-byte read, media upload, backend patient association, production promotion, or physical device certification. **G16 remains OPEN** until its separate remaining phases are implemented and accepted.
- **Next session:** start M16.5 only, using these contract and signed-file-selection proofs as the baseline. Read current branch SHA and M16 plan; do not start M16.5 as part of this documentation handoff.


## M16.5 completion and M16.6 handoff — 2026-10-22

- [x] Inspect current signed package/local permission ceiling, clinic-session and SDK bridge, Files shell, local receipt registry, picker, isolated app lifecycle, and targeted existing GUI scripts before modifying runtime.
- [x] Define explicit shell-to-one-recipient typed transfer and acknowledgement; no destination selection or absolute paths in app/shell IPC and no generic app-to-app bus.
- [x] Implement a visible **Send to active eligible app** action from actual local Files (1–10 selected entries), protected by shell user activation, active Files, runtime-bound last eligible receiving app, exact release/grant/session/tenant-role checks and subscribed isolated preload.
- [x] Reuse M16.2–M16.4 opaque receipt creation and file-identity inspection, implement cancellation/timeout/window-closure/logout/revocation failure cases and re-grant-resistant lease deletion after permission changes.
- [x] Run focused signed-app picker and transfer security tests, build/typecheck and synthetic GUI on Windows; GUI accepted 18/18, Vitest 32/32.
- [x] Run private hosted Linux X11 graphical checks including signed app delivery; GUI accepted 8/8, Vitest 13/13 and build/typecheck. Retain prior 7-check private Wayland proof for M16.4; no claim that M16.5 ran on Wayland.
- [x] Preserve failed infrastructure attempt: `39779773853` Linux setup was cancelled by slow Weston APT downloads without reaching tests; subsequent `39781678031` replaced setup with ephemeral Xvfb and passed both OS jobs. Automated conventional milestone workflow was skipped.
- [x] Reject claiming a native isolated-view drag implementation; drag not enabled or proven. The explicit user-confirmed fallback is the shipped M16.5 path.
- [ ] **M16.6 only, next session:** collect final integrated G16 security/failure/resource/accessibility evidence, cross-OS window/focus/session/installation/update behavior, confirm native drag deferment or prove a distinct safe implementation, reconcile all acceptance matrix cases and app handoff. Physical desktop certification and clinical end-to-end upload are **not** established by M16.5.
- [ ] **G16 CLOSEOUT** is not authorized by this checkpoint.

Verified M16.5 source: `9425e0180088bc76041035a4e539e86ac73ec069`; [focused Windows/Linux GitHub Actions run](https://github.com/Business-It-Partners/dental-os/actions/runs/39781678031). Do not launch M16.6 from this session or treat the documentation-only handoff commit as a new tested source build.


## M16.6 closeout verification plan — 2026-10-22

- [x] Inspect exact current M16.5 tested source and G16 matrix, without expanding into upload, production, M20 or native drag.
- [x] Identify and correct a session-switch UI lifecycle issue: remount the trusted Files browser when clinic generation changes so obsolete folder-history IDs are not reused.
- [x] Run host tests for nested-folder invalidation and fresh handles after session change, outstanding receipt resource cap/expiry, and cancellation on late authorization loss; test no-gesture Send and app-shell bridge absence on both private graphical hosts.
- [x] Run a single exact-source focused Windows Actions job and private-X11 Linux graphical job, with a full integrated Vitest pass only on Linux to conserve Windows minutes.
- [x] Reconcile G16 scope line by line, mark hosted automated M16.6 closeout appropriately, hand off native drag and physical-device/complete milestone acceptance to Codex on user's device.
- **Explicit deferral decision:** native isolated-view drag/drop is not a working feature and is not a G16 pass; the verified explicit Send remains the supported fallback. Physical-device certification is reserved for the user's Codex/device round. **G16 remains OPEN.**

**M16.6 exact-source result:** `772a739ed3af3be4fd678f7ebd68baeceef2f954` — [Actions 39785068605](https://github.com/Business-It-Partners/dental-os/actions/runs/39785068605) both jobs SUCCESS, Windows 35/35 focused unit + 20/20 GUI, Linux 472/472 full Vitest + 10/10 GUI, both build/typecheck. G16 OPEN for deferred drag/device review. [Codex/device handoff](DEVICE_ACCEPTANCE_HANDOFF.md).

## Post-M16.6 drag/device continuation — 2026-10-22

- [x] Confirm current `origin/codex/milestone-16` before edits: `ad3e4bc0ed24fd11902693a0e34205716834f755`. Runtime test evidence remains bound to `772a739ed3af3be4fd678f7ebd68baeceef2f954`; the docs head is not a new tested runtime source.
- [x] Review native surface visibility and Electron drag semantics. Current runtime shows only one native input surface; Files is in the shell renderer, and the recipient `WebContentsView` is hidden while Files is foreground. Current shell hit-testing and `webContents.startDrag` cannot establish a genuine authorized destination.
- [x] Formally defer native cross-view drag in this architecture; preserve existing signed-recipient checks, sandbox isolation, narrow metadata receipt/ACK and explicit Send behavior. No runtime source was changed.
- [ ] Conduct physical-device G16 walkthrough with safe synthetic files in a separate user-controlled Dental OS/test-clinic session. All physical cases remain NOT RUN; hosted synthetic evidence is not a substitute.
- [ ] Reconcile the agreed acceptance criteria and every G16 row after device evidence. Keep G16 open until they pass and the remaining drag deferral is explicitly accepted as within scope.

Validation is documentation-only under the repository rules: run `python3 tools/check-dental-docs.py` and `git diff --check`; do not spend Actions quota or rerun runtime suites for this record. The user will merge to `main` manually; do not merge this branch.

## Post-closeout Files gallery follow-up — 2026-10-22

This is a UI follow-up within M16, not a new acquisition capability. The Files grid is image-first, with a standard folder icon for folders, type icons for documents and other files, and small thumbnails only for supported common raster pictures. A detail-list toggle remains available. Dot-prefixed entries stay hidden. Opening a card is not a general document/image preview workflow; existing picker and explicit **Send** actions remain the only app handoff paths.

- [x] Review current Electron isolation/Files source and document the safe local-preview boundary.
- [x] Add bounded shell-only raster thumbnail reads by opaque file ID; keep the Files shell sandboxed and app receipts metadata-only.
- [x] Add the default grid/detail-list switch, type-specific icons, lazy thumbnails, and dotfile filtering.
- [x] Extend synthetic tests for folders, PDF icon, hidden-entry filtering, bounded source bytes, thumbnail rendering and overview/minimize privacy.
- [x] Complete local build, unit and private-display UI checks: build passed; focused Vitest 19/19; full `npm test -- --maxWorkers=2` 478/478; private `npm run test:files` 14/14 assertions with no renderer errors.
- [x] Run the first tagged Windows/Linux workflow on committed source `5da11f620e9fe49feeda79c95661d350b829e002`; both builds and unit suites passed, while both platform UI scripts exposed a stale pre-redesign Send-button selector.
- [x] Update the synthetic Windows/Linux UI selectors to use the current accessible label; corrected private Linux Wayland integration passed 11/11 assertions, including authorized Send and rejection without a fresh trusted gesture.
- [x] Run Windows-only tagged verification on the corrected test scripts; Windows security/unit checks, build/typecheck and **21/21** private GUI assertions passed. The already locally verified Linux job was skipped to conserve Actions quota.
- [x] Record exact SHA and CI results; keep G16 OPEN because physical-device acceptance remains NOT RUN and native cross-view drag remains deferred. Windows-only Actions 39821015828 passed on `72967aa4e7c721088725b018f929d113052e317a`; hosted Linux was skipped to conserve quota, while the private local Linux scenario passed 11/11.

No test-clinic data or staging/production services are involved. Research notes are retained in [Finder UI/UX research](FINDER_UI_UX_RESEARCH.md). The user explicitly asked to see the updated OS after the work; restart only the separate M16 preview after checks, without touching the primary checkout or any other worktree.
