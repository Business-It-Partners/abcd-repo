# M16 Plan — Dental OS Files and Local Acquisition

**Status:** IMPLEMENTING — M16.4 custom and native file picker implementation; exact-source security/unit/build CI and private UI evidence must be tracked separately.
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
