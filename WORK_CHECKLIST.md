# Sajilo Dental — Work Checklist

**M15.11 Windows exact-source verification checkpoint — 2026-10-26:** The [M15 Windows readiness run 40270853889](https://github.com/Business-It-Partners/abcd-repo/actions/runs/40270853889) **PASSED** on source commit `8afb4a3a11b134841e63de4163a439e412277807` of `Business-It-Partners/abcd-repo` branch `codex/m15-readiness`. Windows Server 2022 hosted CI passed locked dependencies, Node/npm check, docs, fixture build, unit/state, build/typecheck, real Electron Windows safeStorage synthetic encrypted-at-rest round trip/clear, identity/session and login/minimize/fullscreen restore, App Store/overview/compact layout, native runtime failure containment, saved-state recovery, resource-pressure recovery and integrated shell/API contracts. The previous Windows restore defect was confirmed: minimized fullscreen shell returned via `enter-full-screen`/`focus` without a `restore` event, leaving renderer layout suspended; a guarded alternative native-event resume was added and exact-source CI passed. **Windows hosted CI gate PASSED for this tested code; physical-device installer acceptance NOT DONE.** Protected staging wrong-MIME abort 404 cleanup remains **UNCONFIRMED** (no more staging upload writes until resolved); independent reviewer findings **NOT RECEIVED**. **M15.11 and G15 OPEN; M15.12 NOT STARTED**, no main merge, deploy or production changes.
**M15.11 correction checkpoint — 2026-10-26:** Focused Windows [run 40254615828](https://github.com/Business-It-Partners/abcd-repo/actions/runs/40254615828) on `76fd5b6e42a60476ab7a36581fddcaa9b6f929f9` **FAILED** at the native identity-window minimize assertion after other focused Windows checks passed. The old test used `BrowserWindow.getAllWindows()[0]`, which may select the independent dock-caption child instead of the OS shell. A test-only fix selects the parentless native shell by the loaded page URL; a corrected Windows pass is **PENDING**. The earlier staging synthetic wrong-MIME upload was rejected (422), but SaaS abort returned 404; exact intent and storage cleanup remain **UNCONFIRMED**, so no further staging writes have been made and subsequent cases are **NOT RUN**. Independent technical review is **NOT PERFORMED** (self-review does not qualify). M15.11 and G12/G13/G15 remain OPEN; M15.12, owner manual review, main Dental OS merge, production and deploy are untouched.
## M15 — V1 platform resilience and readiness plan — 2026-10-26

The user directed a sequential readiness track in the dental-os-audit worktree. M15.7 preflight and M15.8–M15.10 implementation are complete for their recorded Linux scope: shell and app crash recovery; resource-pressure cleanup; and saved-session recovery through temporary outages. M15.9's 6 policy tests and 15 private UI checks pass. M15.10's 26 identity tests and 8 private UI checks pass. The Linux production build and full serial unit suite pass (527/527); M15.11 also repaired the Appointments fixture setup and stale package-version expectations. The candidate is committed and pushed to `codex/m15-readiness` as `43feb8a0`. Windows runs [40213429732](https://github.com/Business-It-Partners/dental-os/actions/runs/40213429732) and [40213689249](https://github.com/Business-It-Partners/dental-os/actions/runs/40213689249) captured earlier unit-fixture and runtime-fixture issues; the runtime test now locates the shell by its fixture URL. The broad follow-up run [40251095718](https://github.com/Business-It-Partners/dental-os/actions/runs/40251095718) was canceled at its 20-minute limit. A focused 25-minute M15 Windows workflow is prepared for this branch. The staging verifier rejected the synthetic wrong-MIME upload as expected, but its cleanup call returned 404; no active file or finalise was observed, and the verifier stopped before later cases. Cleanup confirmation, remaining staging cases, exact-source Windows evidence, and independent technical review remain open. M15.12 is the user's manual review, then integration and post-merge checks. See the [M15 plan](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/PLAN.md) and [status](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/STATUS.md). G12/G13/G15 remain open until their required evidence and owner acceptance are recorded.

## Desktop role-switch and clinic-info controls — local M15 candidate — 2026-10-26

The top-bar **Switch role** control now has a quiet rectangular outline. Its popup lists workspace choices only; Lock and Sign out are in the clinic information widget. Clicking outside the role menu or role confirmation dismisses it. Confirming a role change keeps the desktop visible under a **Switching workspace** loading screen until the new authenticated role session is ready, then shows a checkmark toast confirming the active workspace.

On candidate branch `codex/role-switch-menu-ux` in `/home/master-x/.codex/worktrees/role-switch-ux/fewa_business_os`, `npm run build`, focused private `npm run test:identity` (67 checks), serial root `npm test -- --maxWorkers=1` (524/524, 36 files), documentation validation, and `git diff --check` pass. This is a local M15 follow-up; it does not close M15/G15 or change backend/staging. The visible candidate preview was relaunched from the latest build with its separate profile; the original OS session remains untouched.

## App Updates widget information states — local M15 candidate — 2026-10-26

The dashboard widget now has the single heading **Available app updates**. When none are available, a cloud-check icon and **No app updates available** make that state clear. When an update exists, the existing app name, installed/target versions, update status and Update button remain visible without extra explanatory copy. No update-service behavior or backend was changed.

Verification: `npm run build` passed; the private `tests/home-app-updates.mjs` scenario passed five checks for both empty and available states and retained the available-update desktop screenshot at [app-updates-widget-connected.png](artifacts/app-updates-widget-connected.png); `npm test -- --maxWorkers=1` passed 524/524 across 36 files. The current visible preview remains on its already-open build; a later full launch is needed to show this widget update there. The original OS session remains untouched.

## V1 fixed Admin workspace PIN — 2026-10-26

V1 no longer asks Admin to set a PIN before switching to Doctor or Reception. Returning to Admin prompts for the fixed `9876`; the Worker verifies it, keeps the five-attempt/fifteen-minute lockout, and denies Admin workspace entry to Doctor/Reception accounts. Admin-created PIN setup is deferred to V2. Dental OS removes the PIN setup IPC/API call and the configured-state field; the PIN exists only in the open dialog and is sent to the Worker for verification.

Verification: Dental OS `npm run build`, serial root suite (524/524), focused identity suite (26/26), and private `npm run test:identity` (62 checks) pass. Dental SaaS local typecheck, lint, web build, 56 clinic-web tests and 449 Worker tests pass. Backend commit `e802b6a` is deployed to Cloudflare staging; `/health` returned 200 for `cloudfare-staging`, and unauthenticated `/v1/me` returned the expected 401. OS source is committed as `5faca65c` on M15. The current running Dental OS process was not restarted; the build loads on the next full launch. No App Store bundle was created.

## M19 — Dock, Applications, and Window Audit — integrated in M15 — 2026-10-26

Cherry-picked audit commits `b11a4b12` and `f019cdfe` onto `codex/milestone-15` as `7440710f` and `deb6d231`. Reconciled the shared checklist entry; the runtime changes applied without conflict. M15 verification: root build passed, all 520 unit tests passed, and nine private M19 UI scenarios passed 97 checks across dock launch/concurrency, app limit, overview, Finance windowing, package recovery, pending-write restart, usability, and launch feedback. The 15-file M19 source fingerprint also matches. The separate Store update UI runner timed out waiting for the first fixture app to become runtime-ready before its assertions; the update unit tests passed in the full suite. The Work Entry release-identity fixture was updated from 1.0.7 to the already-published 1.0.8. M19 adds no gate and does not close G12/G15/G20/G21. See [M19 status and evidence](dental-os_v1_working_info/milestone-19-dock-applications-window-audit/STATUS.md).

## M15 API broker deadline policy — integrated locally — 2026-10-25

Fast-forwarded source commit `f81ac2c7` from `codex/api-call-tiem-out-fix` into `codex/milestone-15`. The shared host broker keeps credential acquisition on an 8-second cap, gives ordinary API transport 30 seconds after credentials are ready, and permits up to 60 seconds for host-classified report/list reads. The closed route table marks Finance collection reads, transaction and patient-payment reports, patient ledgers, and supplier statements; apps cannot choose or extend a deadline. Media and native picker budgets remain independent. Dispatched writes that time out remain unknown and use their original operation key for reconciliation; no retry behavior changed.

Post-integration verification on M15: focused broker/route tests 79/79, root build passed, serial root unit suite 516/516, private App Explorer flow 13/13, documentation checker passed, and `git diff --check` passed. The live OS was left untouched. This source integration remains local and does not close M15/G15.

## M15 — Dock caption layering over native app views — 2026-10-25 (local source only)

Dock hover captions now render through a transparent, click-through Electron child window above native app views. The overlay follows the caption bounds during dock magnification; app view bounds and app packages are unchanged. Browser preview retains its existing CSS caption, and that caption also remains a fallback if the native overlay cannot load. No Genie geometry changed.

`npm run build` passes. Automated UI/runtime suites were not run for this source update. The running OS session was left untouched; the existing launcher loads this source after the next full launch. M15/G15 acceptance remains open.

## Staff, Patient Record and Work Entry Store updates — 2026-10-25

Built and published Staff 1.0.4 (salary-history validation fix) at Cloudflare staging sequence 99, Patient Record 1.0.11 (request-capacity fix) at sequence 100, and Work Entry 1.0.7 (native picker and Back-navigation app changes) at sequence 101. The final signed public readback passed 33 checks across all ten M17 packages, including exact bytes, signatures and grants plus isolated install/launch/uninstall. Per-app receipts are in the M17 evidence ledger. These releases are in the staging App Store; they were not installed into the user's running OS, and no OS restart, production release or backend change was performed.

## Work Entry case workflow UI — 2026-10-25 (local development snapshot)

Applied the requested Open Case and in-progress workflow changes to Work Entry 1.0.7. Open cases now start on Patient & case; protocol cards use a responsive two-column grid; radiograph uploads show a centered blue spinner; Review & save occupies the stepbar action slot; Open Case places Prescription beside Radiographs, removes Lab entry, and gives Today's work the full content width. Both existing-case workflows now omit Payment and Lab entry surfaces. The imaging step is labeled “Imaging & Rx.” Their final commit request explicitly sends `payment: null` and `labOrders: []`, while retaining clinical work, chart, prescription, follow-up, and case disposition fields. New-patient intake is unchanged. Open Case tab steps no longer show an internal Back button; the OS window Back still exits to the worklist. Work Entry typecheck/build and 5 Node + 13 Vitest package tests pass; the private Work Entry UI run passes 51 checks. Root `npm run build` and `npm test -- --maxWorkers=1` (511 tests) pass. The local Development Apps bucket now selects snapshot `3bd783f6eec6dba8275c111f996b15acfe0e11963d1e0782179ae16290379bfb`; previous snapshot `f2ed2215ce6ef073b74750c17d5c29be782c8d9cef32f06f79324f5e2ce3e5bc` remains available. This is an unsigned local snapshot, not a Store or Cloudflare release. The running OS/app was not restarted; close and reopen the Development Work Entry window to load it. No browser preview changes were made.

## Appointments Development Apps parity — 2026-10-25 (local development snapshot)

The installed signed Appointments package is 1.0.8; the Development Apps registry had still been using local build 1.0.5. In the separate `development-app-work` worktree based on M15 commit `50f1c1b`, restored the 1.0.8 Appointments UI: four full-width summary cards, the sortable Doctor column, fixed table proportions, and no Phone or No-show columns. The local Development Apps registry now selects version 1.0.8, build `b514b94ef8bbbb931db2514f2d5fc708872b734ec770b34ef813ebe432a48836`; the previous 1.0.5 snapshot remains available.

The app typecheck, five package tests, package build, root `npm run build`, all 511 root tests, and 27 private Appointments UI checks pass. The published snapshot payload matches the worktree's built app files. This is an unsigned local development build only; the signed Store package and the running M15 app were left unchanged. Close and reopen the Development Appointments window to load the new snapshot. See the [M17.3 Appointments plan](dental-os_v1_working_info/milestone-17-dental-app-delivery/M17.3_APPOINTMENTS_PLAN.md) and [local snapshot evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_APPOINTMENTS_LOCAL_DEVELOPMENT_2026-10-25.json).

## Development Apps parity refresh — 2026-10-25 (local snapshots)

Compared every active package in the local installed Store registry with its Development Apps snapshot. The five refreshed apps now match the dock's active version: Follow-ups 1.0.5 (was 1.0.3), Work Entry 1.0.7 (was 1.0.6), Patient Record 1.0.11 (was 1.0.10), Lab Tracker 1.0.3 (first local snapshot), and Calendar 1.0.4 (first local snapshot). The other five apps already matched. Staff is 1.0.3 in both active registries; Store 1.0.4 is pending and was not active. All ten current Development snapshots match the locally installed active package versions.

All five app typechecks/builds and relevant package tests passed; their five M17-specific private UI suites passed 23, 30, 31, 19, and 20 checks respectively. The root build and all 511 root tests passed. Each published payload matches its built source files (5/5 files). Previous Follow-ups 1.0.3, Work Entry 1.0.6, and Patient Record 1.0.10 local snapshots remain available. Lab Tracker and Calendar had no earlier local snapshots. The legacy `npm run test:followups` dock-shell test timed out before finding its app button; the M17-specific Follow-ups workflow passed. These are unsigned, per-user local Development builds; no Cloudflare release, signed Store package, or running M15 process changed. Close and reopen a Development app window to load its snapshot. See the [local parity evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_DEVELOPMENT_APPS_LOCAL_PARITY_2026-10-25.json).

## Native app-view resize hit areas — 2026-10-25 (local OS source only)

Native app views now stop 15 logical pixels short of the right and bottom edges in normal windows, leaving the OS resize strips and corner exposed. Fullscreen apps retain the full content area. This is shared window/runtime behavior for every managed app; no dental app package changed.

`npm run build`, all 511 root unit tests, and the focused private `npm run test:runtime-resize` pass. The broader `npm run test:runtime` stops at its dock-edge handoff check under the private Wayland harness: the guest receives the injected pointer, but the shell receives no dock-edge event and the reported host cursor remains `(0, 0)`. The running OS was not restarted; it will load the build on the next full launch. The fix is local to M15; no push, install or M15/G15 status change.

## Home App Updates widget Store wiring — 2026-10-25 (local source only)

Replaced the Home-page dummy update entries with live signed Store offers for installed apps. The widget shows current and offered versions, uses the existing verified Store Update action, reflects staging/progress/readiness and cancellation, and can refresh the catalogue. Catalogue checks now refresh offers at sign-in and every 30 minutes without downloading or staging packages; the user must click Update. A staged candidate does not replace the active version, and the widget does not call it ready until the Store launch-health gate allows that state.

`npm run build`, all 502 root unit tests across 34 files, the private synthetic widget flow (4/4 checks), `python3 tools/check-dental-docs.py`, and `git diff --check` pass. The connected synthetic screenshot and report are `artifacts/app-updates-widget-connected.png` and `artifacts/home-app-updates-verification.json`. Changes remain local on the M15 worktree: no commit, push, Store publication, or app restart. The running OS will load the shell update on its next full launch; M15/G15 acceptance status is unchanged.

## Staff salary-history validation fix — 2026-10-25 (local source only)

The Staff app's salary-payout validator rejected canonical zero-padded `YYYY-MM` periods for January through September, so any such payout caused the whole history list to show “The clinic returned an invalid salary history.” It now matches the Finance app's period format. The seven Staff package tests (including a validator regression), package typecheck/build, root build, 502 root tests and docs check pass. This local app source has not been published or installed; signed Staff 1.0.3 and the running OS remain unchanged.

## Patient Record request-capacity follow-up — 2026-10-25 (local source only)

Patient Record now fetches its core record first and loads other records only when their section is selected. A tab loads at most three independent GETs; reads are cancelled when the user changes section or leaves the patient. Broker `BUSY` responses receive up to two short retries because they are rejected before dispatch. X-ray, lab, and periodontal sections show loading/error feedback while their data is being fetched. Clinic data remains authoritative in the SaaS Worker.

The local source passes Patient Record typecheck and package build, root `npm run build`, root `npm test -- --maxWorkers=1` (502/502), and private headless `npm run test:patient-record` (30/30) with synthetic data. The test confirms that opening a patient does not eagerly request other patient sections and that prescriptions load when selected. This source follow-up is committed on the local M15 branch only; it was not pushed or published. The signed staging package remains 1.0.10, and the running OS was not restarted or updated.

## V1 native device file access and Work Entry follow-up — 2026-10-24/25 (source complete; install pending)

The user chose the host OS file chooser for first-party app file selection; the in-house Files Explorer, Image Viewer, and shell Send-to-app surfaces are out of V1. Work Entry's Add Image control now opens the native multi-file chooser, retains drop support inside its radiograph area, and reports its route history to the shared OS Back control. Back returns to the preceding workflow step while retaining the open case. The in-house Files/Viewer/Send surfaces are removed from the local M15 source. Root OS build, Work Entry package build/typecheck, 502/502 root unit tests, 30/30 Work Entry private UI checks, and the dental-doc checker pass. The broader shell UI checks did not complete cleanly: `tests/windows.mjs` stopped on the Motion Studio initial dock-gap assertion before navigation checks, and `tests/dockapps.mjs` stopped during its App Store fixture setup before reaching its no-Files assertion. Changes remain local; nothing was pushed or published. The existing launcher already points to this worktree, so the OS build loads on the next full launch; the running session was left untouched. The installed Work Entry package remains signed version 1.0.6. This source-only app change cannot replace that immutable signed package through a local sideload, so the app update is not installed in the running OS; it requires a separately authorized, signed versioned package update. See the retained Work Entry private UI report at `artifacts/m17-work-entry-private-2026-10-25T01-08-16.513Z.json` and the earlier failed shell-suite outputs.

## V1 two-open-app limit — close-and-open flow — M15 local integration — 2026-10-25

The shared OS window manager enforces ADR-034's two-open-app cap; minimized and transitioning apps remain counted. When a third app is requested, the OS dialog offers a `Close [app]` action for each open app plus Cancel. Choosing one closes it and opens the requested app. Dirty-work confirmation and pending-write safeguards still apply. M15's dock-hover behavior is retained: pointer hover alone does not block the native app surface. The full source follow-up from `codex/app-feature-update` commit `dfb9fa6f` is integrated locally, including its Finance purchase source and M17.7 notes. This does not close M15/G15 or change release state; integrated-source verification is recorded in [M15 implementation notes](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/IMPLEMENTATION_NOTES.md).

## M18 first-party Dental app staging testing — in progress (2026-10-24)

M18 tests the ten first-party top-level packages through the connected Dental OS and Dental SaaS staging backend; production is excluded. Finance remains one app/package with eight internal modules. Finance 1.7.7 passed core staging reads/creates for the Transaction Record landing and the six selected modules: Products, Suppliers, Purchases, Supplier Payments, Salary Payments and General Expenses. General Expenses required-field and missing-reason guards passed; the correction returned 201 and void returned 200, and a separate read-only verification confirmed the voided synthetic expense is absent from the active list. The immediate list refresh after void returned a transport error; a fresh staging read later returned 200, so no backend defect is confirmed. Patient Payments was never opened. Work Entry 1.0.3 first failed Start Work with “Request capacity reached”; signed 1.0.4 at staging sequence 92 fixed context reads. The 1.0.4 clinical commit then failed locally because of an app-side idempotency-key collision. After specific user approval, signed 1.0.5 was published at staging sequence 93. The existing case’s doctor update returned 200, clinical commit returned 201, and refreshed case read returned 200 with one saved protocol; a corrected read-only run passed 27 checks with 11 GET-only events. The user later requested Work Entry 1.0.6 be released: it is published and publicly verified at staging sequence 98 with exact radiograph `clinic.media.read` and `clinic.media.upload` grants. A private staging-profile read-only run on signed 1.0.6 passed Store install, Start Work and case/context reads (27 checks, 11 GET-only events, zero writes); radiograph and full workflows remain untested. The first post-commit selector failure was a harness mismatch with the continuation view, not a product/API failure. No backend defect was found. Remaining Work Entry scenarios, the eight other unstarted app submilestones, and broader Finance state cases remain to be tested. The existing M15 worktree on codex/milestone-15 is the sole lead/integration root; the user stopped parallel setup, so continue directly in this chat and create no worker chats/worktrees unless asked. Both worker chats remain archived with history and their worktrees were removed after report/evidence integration. Calendar API tracing did not load in an earlier disposable-profile launch, so no Calendar case passed and no Calendar task was created. No backend code/data was changed. See [M18 plan](dental-os_v1_working_info/milestone-18-dental-app-testing/PLAN.md), [Work Entry results](dental-os_v1_working_info/milestone-18-dental-app-testing/M18.4_WORK_ENTRY_TEST_PLAN.md), [status](dental-os_v1_working_info/milestone-18-dental-app-testing/STATUS.md), [Finance results](dental-os_v1_working_info/milestone-18-dental-app-testing/M18.7_FINANCE_TEST_PLAN.md), [evidence ledger](dental-os_v1_working_info/milestone-18-dental-app-testing/VERIFICATION_EVIDENCE.md), [implementation notes](dental-os_v1_working_info/milestone-18-dental-app-testing/IMPLEMENTATION_NOTES.md), and [shared test template](dental-os_v1_working_info/milestone-18-dental-app-testing/TEST_CASE_TEMPLATE.md).

## Clinic-specific desktop logo follow-up — 2026-10-25

The separate local `codex/clinic-logo-fix` worktree, based on M15 commit `def5a58f7b5ceb233c51d3cffcd92649f72a2207`, now requests the authenticated clinic's private logo through Dental SaaS `POST /v1/clinic/branding/logo/view`. Electron main owns the request and Bearer token; the renderer receives only a validated PNG/JPEG/WebP data URL through a shell-only IPC call. The image is bounded to 2 MB, cached in memory for the current session generation, and cleared on logout, lock or account change. Missing/unsupported/unavailable logos show the clinic initials. The latest UI sizing follow-up uses a wide 104×72 logo badge and a 430px maximum clinic card, with smaller responsive sizes on tablet and mobile. The private identity UI and all 537 unit tests passed before this sizing refinement; the root production build was rerun afterward and passes. Tests were not repeated for this CSS-only change. The existing Dental SaaS checkout was inspected read-only; no SaaS code, data, staging service or production service changed. This is a local candidate, not merged into the M15 lead tree; M15/G15 and M18 states are unchanged. No commit, push, publication or live OS restart occurred.

## Finance sidebar, Staff tab and Treatment Protocols confirmation follow-up — 2026-10-25

In the same local candidate, the OS-owned Finance sidebar now copies Patient Record's 190px width, font stack, 12px heading, 14px labels, icon size, gray panel and selected-row tokens; Patient Record app source is unchanged. Staff's **Private documents** tab is hidden with a UI visibility flag while its access, data and document workflows remain in source. Treatment Protocols no longer calls browser-native `window.confirm`; deletion confirmation now uses the shared `ClinicModal` shell also used by Patient Record's success `ConfirmDialog`. Cancel performs no write, confirm retains the existing SaaS soft-retire (`active: false`) behavior, and an open modal blocks OS Back.

Verification: root build and 537 unit tests pass; private Finance sidebar UI passes 5 checks; Treatment Protocols package typecheck/build and 4 package tests pass, and its private UI workflow passes 25 checks. Staff M17 package typecheck/build and 7 package tests pass. The existing `npm run test:finance` and `tests/runtime-module-preview.mjs` still expect a legacy app explorer, so both stop before sidebar assertions; the focused `npm run test:finance-sidebar` fixture passes against the current managed-window component. The successful Treatment Protocols private report and screenshot are retained under `artifacts/m17-treatment-protocols-private-2026-10-25T01-30-03.468Z.*`. M17 package versions and signed staging releases are unchanged. No merge, commit, push, publication, deployment or live OS restart occurred; M15/G15 and M17 acceptance remain open.

## Table-aware app window sizing — 2026-10-24

The OS now uses a verified app content-width hint, with platform defaults for the currently shipped table apps, to widen a closed app window before opening it. The chosen width includes the OS module sidebar when present and is clamped to the available work area. A manual resize is remembered for that window, so reopening preserves the user's chosen size and the app can show its own horizontal table scroll when narrowed. M17 source metadata has optional width hints for future signed package releases; no app package was republished. The local root build passes. The live desktop was left running and needs a full relaunch to load this build.

**Platform reconciliation and closeout:** [Central tracker](dental-os_v1_working_info/PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md) owns current scope and evidence. The latest M15 runtime implementation is commit `342ad41e815da95d026e18931cd490fb878b1500` on `codex/milestone-15`; a documentation-only commit synchronizes the current source records afterward. The Linux production build and full unit suite pass (511/511); the focused private resize test passes, while the broader runtime suite remains incomplete in the private harness. Windows workflow run [40111390043](https://github.com/Business-It-Partners/dental-os/actions/runs/40111390043) failed on earlier source `fbc2f0885e84629bb0667f1bb76e2befe9a45452`; verification of the latest implementation remains open. The user’s separate Windows-laptop work is a later integration and is not part of this M15 snapshot. M15 media evidence includes staging upload/readback/withdrawal, size/recovery and tenant-isolation checks; the corrected upload-failure verifier remains unverified because the protected Clinic A credential is unavailable. Independent review, G12/G13 acceptance and formal G15 remain open, so main integration is not yet recorded. No push or merge has occurred. See [M15 status](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/STATUS.md) and [central tracker](dental-os_v1_working_info/PLATFORM_RECONCILIATION_AND_CLOSEOUT_CHECKLIST.md).

**Status:** Implemented; Linux technical checks pass. User visual acceptance pending.  
**Created:** 2026-10-13  
**Project directory:** `/home/master-x/Desktop/fewa_business_os`  
**Product name:** Sajilo Dental.

## Sajilo Dental startup splash — 2026-10-23

The local `codex/m15-auth-session` worktree implements the approved dimensional tooth/S mark with one glint, separate wordmark and “Less admin. More room to grow.” slogan, and a deep indigo-to-teal CSS background with quiet flowing shapes. An original synthesized chime plays once per startup; the splash mute button stops it and saves the local sound preference (enabling sound also previews the chime). Autoplay permission is scoped to the trusted shell window. The slim indicator is indeterminate during the actual session check and completes when it resolves, with a matching status label; it never estimates percentage progress. The splash remains visible for at least five seconds. Build, all 518 unit tests, private identity UI checks (including mute preference after renderer reload), documentation validation and whitespace checks pass. Captures of the splash, logo, lockup, slogan and background are saved under `artifacts/sajilo-dental-branding/`. Physical speaker playback remains for user review. The existing live preview was preserved and needs a full relaunch to load this build. All changes remain local.

## Sajilo Dental session persistence — 2026-10-23

### Login presentation follow-up

The user requested internet research and a macOS-inspired login presentation. Apple's [login-window reference](https://support.apple.com/en-us/102633) informed the centered identity, large local clock, compact controls and quiet utility actions. The local `codex/m15-auth-session` worktree adapts those patterns to Sajilo's existing mark and indigo-to-teal background, with translucent labeled fields, a mint sign-in action, password visibility control, inline session/error feedback, Support diagnostics, and top-right minimize/close controls. The existing host status bar is absent on the sign-in gate. Both top-right actions are verified against the native window; only Support remains as a bottom utility. The M13-inspired Files thumbnail is a glossy folder/document tile used in the dock, ready notice and minimized preview. Authentication authority and protected-storage behavior remain the existing platform flow; no account identity is fabricated before sign-in. Narrow layouts scroll vertically when needed and clip decorative background overflow. Desktop, compact, locked and dock captures are under `artifacts/sajilo-dental-branding/`. `npm run build`, all 518 unit tests, and all 57 private identity UI assertions pass. Documentation validation and `git diff --check` pass. The OS has been launched from this worktree for review; all changes remain local.

The user directed a desktop flow that stays signed in after a normal app close, restoring into the clinic workspace after the branded splash and asking for credentials again after sign-out or when the session cannot be restored. [ADR-031](dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-031--device-persistent-session-after-sign-in) makes protected refresh-token saving automatic and removes the opt-in remember-device/session checkbox; passwords and ID tokens remain memory-only. The existing explicit Lock action clears saved credentials and workspace data. If protected OS storage is unavailable, login remains session-only with a clear message. A separate default-checked **Remember me** preference stores only the email for prefill and never stores a password or token; see [ADR-032](dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-032--remember-sign-in-email-separately-from-session-persistence). Verification for the original auth implementation passed: `npm run build`, `npm test -- --maxWorkers=2` (36 files / 518 tests), and private `npm run test:identity` (including splash duration, login, lock and sign-out). A separate M15 preview uses an isolated user-data directory; the unrelated `platform-closeout` app was left untouched. No commit or push was made.

## OS exit confirmation — 2026-10-23

The desktop and sign-in top-right **×** controls now open a Sajilo-branded confirmation dialog asking “Are you sure you want to leave Sajilo Dental?” **Cancel** or Escape keeps the app open; **OK** follows the normal Electron close path and does not sign the user out. Focus starts on Cancel and remains within the dialog. `npm run build` passes; tests were not run for this UI follow-up. The refreshed M15 preview uses the existing follow-up profile. All source and assets remain local pending the requested local commit; nothing is pushed. M15/G15 status is unchanged.

## M16 post-hosted closeout checkpoint — 2026-10-22

`codex/milestone-16` latest confirmed remote documentation head before this continuation: `ad3e4bc0ed24fd11902693a0e34205716834f755`; latest runtime-tested implementation remains `772a739ed3af3be4fd678f7ebd68baeceef2f954` (Actions 39785068605). Source/API review formally defers cross-`WebContentsView` drag under the current one-visible-native-input-surface model; recipient authorization, sandbox isolation and explicit Send remain unchanged. Physical-device verification is **NOT RUN** because this checkout shares the user's active desktop and no separate user-controlled Dental OS/test-clinic session was available. **G16 remains OPEN** pending physical cases and agreement on the drag disposition. Evidence and the exact preflight snapshot are in [M16 verification evidence](dental-os_v1_working_info/milestone-16-file-acquisition/VERIFICATION_EVIDENCE.md). No merge to `main` is authorized here; the user will merge manually.

**M16 Files gallery UI follow-up:** continuing on the same isolated branch after M16.6. The grid now uses folder/type icons, supported picture thumbnails, a detail-list option and hidden-entry filtering; no item opens a full preview, and app transfer remains the existing authorized picker/Send path. Bounded shell-only thumbnail source reads are limited to 16 MiB and never enter app IPC or receipts. This follow-up does not accept G16, change the drag deferral, or merge to `main`.

**Files visual refinement — 2026-10-23:** following the supplied GNOME Files reference, the M15 auth-session worktree gives the explorer a neutral light-gray locations rail, white content area, near-black labels, a toolbar search control, and a compact icon grid without date metadata. Search filters names within the current folder using the Files service's bounded listing; closing search refreshes handles before the listing is reused. Custom SVG artwork distinguishes gray folders with burgundy tabs, paper documents and red PDFs; supported pictures retain real thumbnails. Existing navigation, selection, preview and transfer behavior is preserved. `npm run build` passes; no M16 gate or merge status changes.

**Standard Window 1 scaffold — 2026-10-23:** added a permanent first-party sample window directly to the dock, with Back/Forward controls at the top-left of its shared window title bar and a simple list-page header: app name at left, Refresh and New at right, without a kicker, subtitle, or divider. The bordered case-table panel contains filters/search/count, column headings, and striped rows. The results/pagination footer is detached from the panel and pinned to the bottom of the app window; the page heading/actions, filters, table headings, and rows share one vertical scroll area. There is no nested vertical table scroll. A standard page contains 10 rows: the default Active filter shows 10 sample cases, while All shows 12 and can paginate. The custom scroll indicator is about 40% narrower and 70% shorter than its native equivalent, with pointer and keyboard scrolling. Filter and footer labels are about 20% larger with a medium weight. Table typography experiments with Arial and larger 16px column headings; sortable headings are text-only without arrows. Column widths give “Treatment protocols” enough room to keep it separate from “Status.” Refresh resets sample data and filters; New adds a sample case; Update opens a case-detail page through window history. Detail pages use their own content across the full page area and hide the list-page header/actions; window history remains in the shared title bar. Closing the window resets page history so its next open starts on the initial list page. Shared OS window controls remain in use. The Home breadcrumb strip was removed, and the navigation group was enlarged by about 50% at the user’s request. This is a local UI scaffold, not a delivered dental module; `npm run build` and `git diff --check` pass. The running preview is not restarted; it requires a full relaunch to load this build. No tests or milestone/merge status changes.

**Desktop top-bar controls — 2026-10-23:** replaced the desktop's right-side overflow button with minimize and close controls after the clock, using the same host control bridge as the login screen. Session actions remain available in a labeled Account menu on the left. Closing the OS uses the normal Electron close/quit path and preserves the saved session; no logout action is coupled to close. Build and whitespace validation are required; no tests or milestone status changes.

Latest verified follow-up commit is `36c45cc7962088fde4e27f351e723311f29ff7c9`; [Windows Actions 39810891440](https://github.com/Business-It-Partners/dental-os/actions/runs/39810891440) passed security/unit checks, build/typecheck and 21/21 private GUI assertions. Corrected private Linux/Wayland Files, picker and transfer UI passed 11/11. The first combined attempt `39810071174` failed only at stale selectors for the renamed Send control; both test scripts now use its accessible label. Physical-device verification remains NOT RUN; **G16 remains OPEN**.

**Image Viewer follow-up:** implementation source `1ae45df4` is on the same branch. Local build and 25 focused unit tests passed; private Linux Files and signed-app integration runs passed 19/19 and 11/11 assertions. Targeted [Windows Actions 39821015828](https://github.com/Business-It-Partners/dental-os/actions/runs/39821015828) on `72967aa4e7c721088725b018f929d113052e317a` passed all 47 focused security tests, build/typecheck and 32/32 private UI assertions. The Linux hosted job was skipped; no extra run was launched. **G16 remains OPEN** because physical-device acceptance remains NOT RUN and native cross-view drag is deferred; the user will merge to `main` manually.

After the requested graceful stop, the M16 preview was relaunched from its separate worktree at documentation commit `65585535b60fcfa7cb04b27b7a77a642f086ee02` using the existing temporary profile, with no test-fixture mode. Its Electron window process tree is running for visual review; the other active worktree/OS instance remains untouched. This preview is not physical-device acceptance.

**Zoomed-image drag-pan follow-up:** implementation `78fcc9226e1d8f1ac5c1c4f235f8bef5699836d1` and verification-record head `cfebfc37b4a7547ca8ca5955807e23243315346d` are pushed to `codex/milestone-16`. Local build passed and private Linux Files UI passes 22/22 assertions, including drag-pan, viewport-edge coverage and fit/recenter. Windows-only Actions `39825846819` passed 47/47 focused tests, build/typecheck and 34/34 private GUI assertions. The earlier CSS zero-format assertion failure and its correction are retained in the M16 evidence. Linux and broad Windows workflows were skipped for quota. Physical-device panning and G16 acceptance remain open.

**M16 local integration into M15 (2026-10-23):** the full M16 branch is integrated locally in the active M15 worktree so M17 apps can use Files and Image Viewer. The merged source builds; the corrected full unit run passed 507 tests; private Linux Files UI passed 24 assertions; and the signed-app picker/Send flow passed 11/11 assertions. The distribution UI displayed 10 passing assertions, but its private runner did not exit cleanly during teardown, so it is not recorded as a clean pass. The user reports manual device testing passed; it was not repeated. Native cross-view drag remains deferred and G16 remains open. This is a local integration only: no push or merge to `main`.

This file is the single source of truth for this prototype's scope, implementation progress, decisions, and acceptance evidence. Update it as work proceeds. A checked implementation item requires actual verification; existing FEWA behavior is a reference, not proof that this prototype works.

## Staged app-update contract — 2026-10-21

The user authorized documentation of the settled Store update model. [Install, Update and Uninstall](dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) is now the single lifecycle authority: prepare/verify separately while running work remains pinned; trial on next full launch after normal close; eligible known-good recovery on startup failure. ADR-025 supersedes ADR-024's close-first model. Product vision, global status and M13 follow-up records link to this contract. Store/runtime alignment and focused verification remain pending; existing M08/M11 evidence is preserved. No runtime change, publication, deployment, milestone closure or new permission format is implied. Documentation/link checker and Git whitespace validation are the only checks for this prose change.

## Product-contract consolidation — 2026-10-21

The user authorized one canonical product explanation with detailed technical contracts kept separate. [Product Vision and V1 Contract](dental-os_v1-documentation/01_WHY_DENTAL_OS.md) now combines the motivation and product definition; the old definition path remains a compatibility pointer. Architecture navigation and the root direction link to it. At this consolidation checkpoint ADR-024 recorded a close-first target; the later staged-update decision below explicitly supersedes it. Current Store/runtime still use download/apply and immediate successor launch; implementation/verification remain pending. No route-list manifest or remote API permission mechanism was approved by this consolidation. No runtime change, milestone closeout, app publication or production acceptance is claimed. Validation: documentation checker and Git whitespace check; no heavy/runtime tests required.

## First-party app onboarding and independent-update follow-up

The single detailed checklist for installing a new company app from the Cloudflare staging Store and updating it app-only through v1.0.0 → v1.1.0 → v1.2.0 is [APP_ONBOARDING_AND_UPDATE_CHECKLIST.md](dental-os_v1_working_info/APP_ONBOARDING_AND_UPDATE_CHECKLIST.md). M11 is VERIFIED and integrated for its documented staging/automated scope: the signed feed/package/update path, authenticated Store install/update service, private live-feed Linux install/update/restart, local safety matrix, user-confirmed manual 1.3.0 Store update, final-source Windows CI, and 16-app resource characterization pass. Its profile measured 2.09 GiB aggregate working set with 16 minimal synthetic apps open and 487 MiB after closing them; it does not enforce a memory ceiling or certify clinical/low-memory-device behavior. The normal merge is `b6a4045f`; M07/M08 retain their original verified scope.

### Dental OS Follow-ups app release (2026-10-20)

Dental OS owns assembling, signing, publishing, installing, and running this first-party app. Dental SaaS is a read-only product reference for the existing Follow-ups behavior and routes. Follow-ups 1.0.0 is published in the existing Cloudflare staging bucket (catalogue sequence 16) and installed through the authenticated Store distribution service into the user's existing staging profile. The installed package entry is verified on disk. The original install artifact is a pre-launch snapshot. On 2026-10-20, the user reported installing and running all eleven M13 shells in Dental OS, including Follow-ups. The current automatic known-good health receipt has not been independently re-read from the profile. This work uses the M07 staging delivery foundation and M11 generic app-onboarding path; it does not reopen or complete either milestone. M12.3 owns the OS app-discovery experience, including the multi-module explorer behavior. Production is untouched.

## Historical milestone sequence realignment — 2026-10-19 (superseded 2026-10-20)

This was the sequence in effect when the earlier work below was recorded: M11 flexible app onboarding/update, M12 Dental OS workspace/shell UI, and M13 Windows/Linux release and operations, with final device acceptance under G14. The 2026-10-20 amendment below supersedes those future assignments; the [master roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md), [global status](dental-os_v1_working_info/00_V1_STATUS.md), and [acceptance gates](dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md) show the current sequence. M01–M12 verification history is preserved.

## App-delivery milestones and platform release reassignment — 2026-10-20

M13 is first-party app shells at version 1.0.0, with one app submilestone for each of the eleven Dental OS app packages. On 2026-10-20, the user reported installing and running all eleven app shells in Dental OS, including Follow-ups; this supersedes earlier pending install/open notes. The original Follow-ups install artifact is a pre-launch snapshot, so its current automatic known-good health receipt has not been independently re-read. Finance and Lab Tracker received common multi-module toolbar updates as signed version 1.0.1 staging releases at sequence 21; the user-profile updates and module-switch review were not explicitly confirmed. M12.6/G12 remains open under the user's direction to continue M13 shell work. M13 overall and G13 remain open until the remaining specific checks pass.

### M13 app install/run report (2026-10-20)

The user reports installing and running all eleven M13 version 1.0.0 shells in Dental OS. This records user-reported app-window use for M13.1–M13.11. Runtime health acknowledgement is automatic: after the managed app page and platform bridge are ready, the runtime records the active package as known-good. There is no user-facing acknowledgement button. The earlier Follow-ups artifact predates this launch and still records `runtimeLaunchAndHealthAcknowledgement: false`; the current registry receipt has not been re-read. Installation of Finance and Lab Tracker 1.0.1 and module switching were not explicitly confirmed. See the current [M13 status](dental-os_v1_working_info/milestone-13-first-party-app-shells/STATUS.md) and [verification evidence](dental-os_v1_working_info/milestone-13-first-party-app-shells/VERIFICATION_EVIDENCE.md).

M17 remains the active app implementation and staging-delivery track in the existing M15 worktree. Patient Record 1.0.10 is published at signed Cloudflare staging sequence 86 with exact package/signature/grant readback and isolated registry launch; its new sidebar, independent scrolling, and confirmed discard navigation are integrated here. Finance 1.7.11 is current at sequence 97, with its minimum supported version at 1.7.5. Work Entry 1.0.6 is published at sequence 98 with exact radiograph media grants; live 1.0.6 workflow acceptance remains open. The selected App Store, shell, Appointments, and app-artwork changes from `codex/dental-ap-ui-enhance` are integrated locally. The App Store has refreshed list/detail pages and in-row package progress; Appointments 1.0.5 at sequence 62 retains the doctor filter and removes Doctor from the table (first published in 1.0.4 at sequence 56). Seven app artwork/package updates were published at sequences 61–67; Treatment Progress source is now 1.0.6 at sequence 65. Finance 1.7.4 is at sequence 78; Lab Tracker 1.0.3 and Staff 1.0.3 remain at sequences 75 and 76. Source-worktree package readback and isolated registry checks passed. The combined M15 root build and affected Appointments/Treatment Progress package typechecks and builds now pass; package and private UI test suites were not rerun for this import. Authenticated Store installation, live clinic acceptance and G17 remain open, as do M15/G15 platform gates. See [M17 status](dental-os_v1_working_info/milestone-17-dental-app-delivery/STATUS.md).

### M13 managed app handoff frame — verified follow-up (2026-10-21)

The M13 app content runs in the shared isolated managed runtime. When the dock edge or another OS window temporarily hides its native surface, the shell displays a captured frame of that same live app until it becomes visible again. The previous handoff cleared the last frame before asynchronous capture completed, briefly replacing the app with the misleading “Refreshing the app preview” text. The runtime now keeps the last stable frame until a fresh capture atomically replaces it, and the UI no longer calls the app a preview. `npm run build` passes; `npm run test:runtime` passes 46 private runtime checks plus DPR 2 capture, including a deliberately delayed-capture regression. `npm test -- --maxWorkers=1` passed 296/297; one unrelated package-recovery case exceeded its default 5-second timeout and passed when run alone with a 15-second timeout. No package was republished, no M13 acceptance gate was closed, and the live app was not restarted.

### M13.12 Patient Record launch/loading pilot — two-second hold and fade-in verified (2026-10-21)

- [x] Render the Patient Record loading surface in its existing OS-managed window while the isolated package loads.
- [x] Keep the real package hidden until its page and platform bridge are ready, then hold the OS launch screen for at least two visible foreground seconds.
- [x] Fade the actual Patient Record document in over 260 ms after the hold; respect reduced-motion settings and preserve current recovery behavior.
- [x] Verify accessible status, artwork/title, minimum duration, app fade, live-window handoff, and no renderer errors on a private display.

The M13 `company.dental.patient-record` 1.0.0 package remains unchanged. The OS shell displays its artwork, name, and an indeterminate accessible loading indicator. The 2-second clock advances while the managed Patient Record window is foreground and pauses if the user switches away; the native app also waits for the dock overlay to close. Once ready, the OS reveals the actual app with a 260 ms ease-out fade. Reduced-motion settings skip that fade and stop spinner rotation. The pilot initially covered Patient Record only; the user authorized fanout on 2026-10-21, tracked as M13.13.

### M13.13 OS-managed app launch feedback — privately verified (2026-10-21)

- [x] Apply the same OS-managed launch surface to every installed managed app package, without checking a Dental OS app-ID prefix.
- [x] Keep the app hidden until runtime readiness and at least two visible foreground seconds; wait for the app explorer/dock overlay to close before revealing it.
- [x] Fade the actual isolated app document over 260 ms and respect reduced-motion settings.
- [x] Verify the eleven current M13 packages plus a differently named future package, module selection, and a repeated Patient Record launch on a private display.
- [ ] Review the fanout in the user's installed Dental OS after a full user-controlled relaunch.

The shared shell/runtime selects all installed managed packages from the verified Store inventory; launch feedback is not keyed to current M13 IDs. A `company.future.billing` fixture with no Dental OS app prefix verifies that a later company package inherits the same readiness wait, foreground hold, and content fade. Current known apps retain their titles and artwork; an unrecognized app ID uses the OS icon fallback. `npm run build` passes; `npm test -- --maxWorkers=1 --testTimeout=15000` passes 297/297; and `npm run test:app-launch-feedback` passes 132 checks across the eleven current apps plus the future package on private headless GNOME/Wayland. Finance/Lab Tracker module selection and repeated Patient Record launch are covered. The user-installed app packages and Store catalogue were not changed or republished. The running Dental OS was not focused or restarted; it will load the shell change after a later full user-controlled relaunch. Evidence is in `artifacts/app-launch-feedback-2026-10-21T07-18-57-969Z.png`, its matching JSON report, and `artifacts/app-launch-feedback-handoff-2026-10-21T07-18-57-969Z.png`.

### M12.1 desktop status bar and M12.2 wallpaper widgets/dock — implemented for tested Linux scope (2026-10-20)

The user directed the first two M12 UI phases: a desktop-wide top status bar showing the active app, network state, date and time; then desktop identity/widgets. The customer-facing desktop name is Sajilo Dental when no app is active; “Dental OS” remains the internal technical name. The status bar now follows a compact macOS-style layout with functional Apps/Windows/Help actions and soft charcoal lettering; support/account actions remain available in the clinic widget menu. M12.2 implements the requested right-side three-card collection (Nepali Bikram Sambat calendar, time, Gregorian calendar), with today highlighted in the Nepali grid and no duplicate date row, frosted-glass widgets/dock, width-responsive dock and thumbnails, and 20% less dock-hover magnification. The normal product dock includes the Store and installed first-party apps; screenshots from the private prototype fixture intentionally show additional prototype apps. Build, unit and focused private UI checks pass for the recorded Linux scope. M12 overall remains in progress; the previous two-widget implementation has been superseded. The phase order, behavior, data limits and acceptance evidence are recorded in [M12 PLAN](dental-os_v1_working_info/milestone-12-os-ui-experience/PLAN.md), [STATUS](dental-os_v1_working_info/milestone-12-os-ui-experience/STATUS.md), [implementation notes](dental-os_v1_working_info/milestone-12-os-ui-experience/IMPLEMENTATION_NOTES.md), and [verification evidence](dental-os_v1_working_info/milestone-12-os-ui-experience/VERIFICATION_EVIDENCE.md).

### M12 visual readability and support preview correction — 2026-10-20

Follow-up review showed muted grey labels remained in parts of the status bar, widgets and shared app text tokens. Those now use a soft charcoal palette, with slightly less-transparent widget glass to keep small labels legible over the wallpaper. The Help dialog in the user screenshot grew beyond the screen because it showed the entire diagnostics history; it now previews at most five recent safe events while the explicit file export retains the full report. The production build, documentation checker and diff check pass; private UI checks were not rerun after this correction. Do not restart the user's open OS.

### M12.4 — initial window vertical fit — implementation started (2026-10-20)

Normal app windows now open at the full vertical work-area height: directly below the status bar with a 12px gap above the dock surface. Shared window movement/resizing uses the same bounds, including the compact responsive status-bar height. App-specific window widths, horizontal margins, fullscreen mode and dock motion stay as before. `npm run build` passes; private UI checks were not run. M12.4 is implemented for tested Linux/private-display scope; see the updated phase evidence. The running desktop is not restarted.

The M12.4 edge-hiding work allows up to 70% of a window beyond the bottom or either side edge while keeping the top below the status bar and at least 30% visible. Window buttons are always visible on the title bar's right with colored green/yellow/red circles. Their current 16.6725px circles are 10% smaller than the previous 18.525px circles; centered symbols are 8.748px for maximize/restore and 10.206px for minimize/close. The common minimize/restore Genie path stays unchanged. Focused private UI/unit checks pass for M12.4's documented Linux scope. User visual acceptance and G12 remain open.

### M12 status-bar material and maximized-window alignment — implemented for tested Linux scope (2026-10-20)

Following the supplied macOS reference, the top status bar now uses dark translucent navy glass, blur/saturation, soft edge definition, and light text. Maximized app windows use the full horizontal span while starting directly below the status bar and ending 12px above the dock top. This corrects the previous y=0 maximized bounds that let native app content cover the title bar and left a visible strip below the OS bar. Focused window/runtime UI and geometry checks pass; no live-session restart is performed.

Use shared window-manager state for the active app and trusted session data for clinic/user/role. Browser-reported online state is not proof of SaaS availability. No clinic-logo asset or appointment feed exists in this checkout; use a clinic-name monogram and date-only calendar until approved assets/data are available. Do not add clinical data or imply appointment integration. M12.1 and M12.2 are verified for tested Linux/private-display scope. M12.3–M12.5 are implemented for tested Linux/private-display scope; M12.6 and G12 remain open. Physical Windows/device acceptance is now G21 after M20. See [M12 verification evidence](dental-os_v1_working_info/milestone-12-os-ui-experience/VERIFICATION_EVIDENCE.md).

### M12.3–M12.5 — implemented for tested Linux/private-display scope (2026-10-20)

M12.3 maps startup/sign-in, Apps/Store discovery, install/update, multiwindow switching, lock/account and recovery in [WORKSPACE_FLOW_MAP.md](dental-os_v1_working_info/milestone-12-os-ui-experience/WORKSPACE_FLOW_MAP.md). The private shell flow installs two signed first-party samples, announces progress and ready-to-open status, opens them in isolated runtimes, switches through Windows/dock, and returns to an unfinished draft. Current M12.4 evidence includes 50 window checks and 45 runtime checks for keyboard/pointer controls, full work-area and narrow dock gap, dock activation only inside its visible sheet, magnification contained within that sheet, reachable side/bottom resize edges, recoverable edge hiding, close/reopen after edge hiding, native app overlays, modal fit, focus/stacking, and minimize/restore continuity. M12.5 presents trusted Store/session/runtime state with accessible status or alert feedback; outage/retry, verified update success/block/rollback, lock/logout, and boot recovery are covered by private flows.

npm run build passed. The latest full unit run passed 291/291. `tests/windows.mjs` passed 50 checks, including the gap immediately above the dock, actual dock-entry magnification, icon/window clearance, and side/bottom/corner resize hit areas. Runtime passed 43 checks, Records 21, Finance 34, workspace 24, updates 12, identity 44, and recovery 3. Exact source and evidence are in [M12 verification](dental-os_v1_working_info/milestone-12-os-ui-experience/VERIFICATION_EVIDENCE.md). M12.6, G12, user visual acceptance and physical Windows-device review remain open. No live app restart, commit, push, merge or deployment.

The package-driven M12.3 launch path is now implemented in the Electron host. Dock and Store opens inspect verified active-package metadata, filter the app/module list for the current clinic session, open the shared OS explorer for multi-module apps, and pass the selected module into the existing managed runtime before its first visible frame. Finance/Lab Tracker already implement the module-selection callback, so their bundles were not changed or republished. Focused private runtime checks now verify a signed synthetic package’s module discovery, first selection, running selection change and correct dock-edge mirror. This follow-up also repairs stale or missing mirrors for every app window. The broader M12.3 workspace-flow, M12.6, G12 and user visual acceptance gates remain open. No live app restart or deployment.

### Local Finance multi-module navigation mock — 2026-10-20

Clicking Finance in the normal dock opens a compact, rounded glass app explorer just above the dock. Its eight tiles reuse the Finance icon and show the reference sub-app names. Selecting a tile closes the explorer and opens the shared Finance managed window with that name as its mock screen. The Finance window's own toolbar identifies the active sub-app and contains a four-dot **More Apps** control that reopens the same explorer; the main OS status bar continues to identify Finance as the active main app. The window title stays Finance. Switching to another app updates the main OS active-app label while the Finance controls remain inside its window. Escape and outside click dismiss the sheet; selection persists through minimize/restore, fullscreen, overview, close/reopen, and OS restore. The current private UI scenario passes 38 checks; the identity scenario passes 44, the build passes, and all 291 unit tests pass. Screenshots are `artifacts/finance-module-discovery.png`, `artifacts/finance-module-discovery-small.png`, and `artifacts/finance-module-selected.png`. There are no business workflows or records, individual sub-app thumbnails, Cloudflare publication, SaaS API calls, or production milestone claims. This local mock does not close M12.6, G12, or user visual acceptance.

The Records screenshot showed dock hover chrome layered over app content. A first geometry change reserved the entire hover caption area, but the user rejected the resulting large blank band. The final boundary is the resting dock's top with the existing 12px gap; windows retain their full work area and clip consistently there, while the dock remains on its own higher layer. Closing a window while it is edge-hidden and reopening it now refits its saved normal bounds into the current work area. The dock field and Genie path are unchanged. Finance Explorer keeps native embedded app surfaces hidden for its entire open state, including when the pointer crosses the dock reveal area, then restores the active surface when dismissed. Private verification and unit/build results are recorded in [M12 follow-up evidence](dental-os_v1_working_info/milestone-12-os-ui-experience/VERIFICATION_EVIDENCE.md); the user's live OS remains untouched and will load the update after a full relaunch.

## Dental OS canonical repository structure — documented, 2026-10-15

Expanded [00_REPOSITORY_STRUCTURE.md](dental-os_v1_working_info/00_REPOSITORY_STRUCTURE.md) as the sole target folder/ownership/import-boundary guide. It covers desktop main/preload/renderer, shared packages, future first-party apps, fixtures, tests/tools/config, separate fewa_demo backend repositories, installed OS state and incremental migration. Root instructions/development/README and architecture link to it rather than copying the tree. Current src/electron source remains in place; no new implementation packages, source migration, backend change or deployment. Lightweight documentation checks only; no builds/runtime tests or live-session changes. See M01 amendment evidence.

## Dental OS staging/resource policy amendment — 2026-10-15

Documentation-only update: reuse existing fewa_demo Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources. All roadmap backend changes and remote tests are staging-only with verified target mapping; existing clients and production remain protected. New OS services use `/v1/dental-os/...`; business routes remain unchanged. Architecture/ADRs, milestone plans and relevant evidence requirements now reflect this rule. No backend edits, cloud calls, provisioning or deployment were performed. See [policy](dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md) and [M01 amendment evidence](dental-os_v1_working_info/milestone-01-architecture-baseline/VERIFICATION_EVIDENCE.md).

## Dental OS architecture and milestone baseline — 2026-10-15

The user authorized architecture and milestone documentation following the newer Flutter project’s file pattern, with Dental OS-specific scope. [Architecture](dental-os_v1-documentation/00_V1_README.md) defines WHAT; [master roadmap](dental-os_v1_working_info/00_V1_MASTER_ROADMAP.md) defines execution order; [global status](dental-os_v1_working_info/00_V1_STATUS.md) and each milestone record actual progress/evidence. This checklist remains the active work contract and detailed prototype history; new production work entries must name their milestone and stay consistent with those records.

The header’s implemented status describes the prototype only. Documentation does not turn the session-only Store into a real package manager or establish authentication/API integration. Permanent first-party-only scope, existing SaaS authority and Windows/Linux targets are explicit. The next production implementation candidate is M02; this task authorizes documentation only. See M01’s verification record for documentation checks and exact limitations. M01 documentation checks pass (23 architecture documents, eleven four-file milestone folders, local links and requirement/gate coverage); baseline build/typecheck and all 25 unit tests pass. No graphical verification was needed, and M02–M11 remain planned.

The user reviewed the proposed daily-workflow redesign and chose to keep the previous Follow-ups UI. The redesign was reverted; the ten-column table, call flags, Missed default, and app-scoped Details dialog remain.

### Magnetic store handoff — implemented

Connect completion, source separation, dock reservation, velocity-shaped flight, landing and readiness. Use shared dock math to grow new slots; add depth/shadow and a short light ribbon, contact-triggered upward sparks, skip-to-open, quiet update feedback, and cleanup on interruption/reduced motion. Validate full interaction and deterministic frames.

Implemented: a 320 ms shared slot-width reservation (no per-item dock controllers), completion Ready pulse, faded source placeholder and separated shadow, 2050 ms sampled lift/arc-length-remapped flight with a smooth velocity envelope, short light ribbons instead of ghost thumbnails, landing well, damped compression/rebound, and contact-timed upward sparks/ring. Added a destination Ready to open card and early Open that disposes the presentation immediately. Existing-app updates use a subdued icon pulse. Resize and live reduced-motion changes settle directly; all source/overlay effects restore on cleanup.

Validation: build/typecheck and all 25 unit tests pass. Store flow checks (including early Open), two targeted interruption checks, and shared dock suite pass privately. Deterministic paused lift/flight/landing frames captured and visually inspected. Final sampled-lift refinement rebuilt and interruption checks passed. All jobs exited; no live app reload, commit, or push. This is a visual refinement awaiting user acceptance, not a claim of a measured subjective quality score.

### Arrival visibility correction — implemented

Direct paused-frame inspection showed the 1450 ms globally eased path rushed to the dock and the small sparks were visually negligible. Use a 2200 ms linear-time sampled curve, 20 larger sparks above the dock, and a stronger expanding landing ring. Verify captured frames rather than only DOM effect counts.

Paused-frame screenshots were captured and inspected for lift, flight, and landing. Corrected global timing so the icon remains in flight at the midpoint. Enlarged sparks and held their opacity before fading, with a larger local burst above the dock. Build/typecheck and the Store suite pass; the final visual-only refinement was also rebuilt and captured privately. Launcher points to this canonical build. Live session was not reloaded.

### Choreographed store arrival — implemented

Refine the arrival into a 1450 ms lift/curved flight/compression/rebound sequence, with a completion shimmer, three subtle light echoes, destination glow, a landing ring and twelve local sparks. Preserve shared dock geometry and direct/reduced-motion fallbacks; clean up every effect on completion or interruption.

Validation: build/typecheck and 25 unit tests pass. The focused Store suite passes with checks for the 1450 ms timeline, glow/trails/sparks, effect cleanup, dock landing, uninstall/reinstall, updates, and reduced motion. A private visual run captured the flight for inspection. All tests run on the isolated display; live session untouched.

### Store uninstall and slower arrival — implemented

Add an explicit confirmed Uninstall action in installed-app details. Close the app through shared lifecycle, remove its dock/update entry, and allow reinstall; retain dummy session records without claiming data erasure. Slow arrival to 30% speed (680 / 0.3 = 2267 ms). Block conflicting operations until arrival ends.

Validation: build/typecheck, all 25 unit tests, and the focused Store suite pass, including measured 2267 ms animation duration, keeping an app, uninstall closing an open window/removing its dock entry, reinstall, updates, and reduced motion. No live session restart.

### App Store demo — implemented

Build catalog/detail/updates UI with cancellable simulated install/update progress. Protocols and Calendar begin available; existing other clinic apps remain installed. New installs append to the shared dock and animate a visible source icon into its measured slot; reduced motion and hidden sources settle directly. No packages, network downloads, or durable installation are involved.

Implemented a managed App Store window with a custom vector shopping-bag icon, searchable ten-app catalog, detail pages, illustrative feature previews, version/release information, All Apps and Updates Available navigation, Get/Open/Update controls, cancellation/retry, and a sequential Update all queue. Progress reaches 100% before completion. Calendar and Treatment Protocols install into new slots at the end of the shared installed-app list. A measured floating artwork copy travels to its actual dock slot over 680 ms; hidden/offscreen sources and reduced motion complete directly. Arrival freezes/reveals the dock and cleans up its overlay. State persists across internal window operations and resets on full exit. Detail/tab navigation resets scrolling.

Validation: build/typecheck, 25 unit tests, all 11 focused Store UI checks, and shared dock/overview suites pass privately. Catalog/detail and arrival screenshots inspected. Existing dock/overview regressions now install the two available apps in their isolated session before testing the complete clinic collection. All build/test processes exited; the user's live session was left intact.

### Canonical project relocation — complete (2026-10-15)

User-approved direction: Electron OS is the active project in `/home/master-x/Desktop/fewa_business_os`. The prior Flutter/Rust files, including source, docs, dotfiles, platform projects, and local caches, are preserved directly under `refrence/`. The existing root `.git` and its history/index remain in place. The old Electron location is a compatibility symlink to this root, not a second checkout. Root instructions and direction documents supersede the archived Flutter contract for active work.

- [x] Preserve and verify both trees before intentional path/documentation changes.
- [x] Update launcher, instructions, and active paths; build and privately verify launch/session continuity from the new root.

Validation: 581 archived file/symlink entries and 6,664 Electron file/symlink entries matched before intentional configuration/documentation updates. Build/typecheck, all 25 unit tests, and all 24 native-session checks pass from the new root, including installed-launcher reactivation. Launcher shell syntax and desktop entry validate. Active docs, development commands, artifact helper scripts, and launcher paths point to the canonical root. Original Git HEAD/index are preserved; no commit or push was made. Build/test jobs completed; live session untouched.

### Lab Tracker and Lab Supplier Record — implemented

- [x] Review dental-saas models, Worker/API flow, and operational UI without modifying that source repository.
- [x] Build two top-level submodules with dummy orders/suppliers: filters, request assignment, status progression, detail timeline, cancellation, supplier add/edit/status, and supplier work history.
- [x] Keep all dialogs app-scoped and session state persistent across shared window operations; privately verify and rebuild.

Reference: dental-saas lab_orders links patient/case and nullable supplier, with clinical/reception notes, stage dates, and row versions. ClinicCareWorkspace loads labsApi responses and routes callbacks into LabTrackerView/LabsPanel. Worker enforces tenancy/capabilities and uses versioned, idempotent writes. Active lab/both suppliers come from the shared finance supplier directory. This prototype uses only synthetic data and does not implement backend authorization, persistence, or finance ledgers.

Implemented a shared Lab Tracker window with two keyboard-accessible top tabs, eight synthetic orders and three suppliers. Tracker has summary/status/month/search filters and pagination, clinical request details, supplier dispatch, sequential receive/fit confirmation, separate reception notes, cancellation reasons, and retained timelines. Supplier directory supports add/edit, duplicate-name validation, activation/deactivation, and operational history derived from the same order state. New demo request simulates Work Entry; no real backend or financial connection is added. The preferred window is 1180×660, with scoped dialogs and scrollable compact layouts using the softer visual palette.

Validation: build/typecheck and all 25 unit tests pass. All 29 private Lab workflow checks pass, including linked supplier history, role-independent dummy handoff, draft isolation, stage progression, cancellation, supplier CRUD/status, pagination/filtering, empty states, fullscreen, Genie, close/reopen, and compact layout. Shared dental dock and overview suites also pass. Tracker, supplier directory, order detail, assignment, and compact screenshots were inspected. All build/test processes finished; live session untouched. Installed files load after a full exit/relaunch. User visual acceptance remains pending.

### Comfortable clarity refinement — implemented

The user found the previous pass too harsh. Shared colors now use charcoal text, gentler supporting labels, light table headings and row rules, restrained control edges, and softer window shadows. Body copy returns to regular weight; names and headers retain moderate emphasis. Colored badge outlines and doubled selected-card edges are removed. Focus indicators and selected tabs remain clear.

Validation: build/typecheck and all 22 sampled text contrast checks pass. Updated Staff and Follow-ups screenshots were inspected. Only the focused private clarity check was run for this CSS refinement to keep verification load modest. Build and test processes have exited; the user's live session was untouched. Fully exit/relaunch to load the new appearance.

### Shared clarity pass — implemented

- [x] Introduce shared semantic colors for readable text, surfaces, borders, accents, and focus across shell and app content.
- [x] Strengthen tables, labels, forms, tabs, badges, title bars, dock captions, and regression fixtures without changing lifecycle or motion.
- [x] Verify contrast, visual screenshots, build, unit tests, and private UI regressions; leave the live session untouched.

Shared semantic tokens now provide near-black primary text, dark neutral supporting text, opaque content surfaces, visible input boundaries, distinct table headers and row separators, readable status accents, and blue focus/selection states. Platform system typography replaces the previous font stack and forced smoothing. Title bars, dock surfaces/captions, overview, app placeholders, Finance, Follow-ups, Staff, and private Records/Studio fixtures share this direction. Follow-up checkboxes have explicit edges and check marks; disabled pagination remains distinct. Increased-contrast preferences strengthen boundaries further. Existing window ownership and dock/Genie geometry are unchanged. Compact Finance spacing was adjusted after system typography exposed overflow in the smallest layout.

Validation: build/typecheck and 25 unit tests pass. All ten private UI suites pass (Staff, overview, Finance, dental dock, Follow-ups, Records, windows, Electron, native session, and DPR 2 scaling). All 22 sampled text contrast checks pass, with a minimum measured ratio of 4.89:1; this is targeted evidence rather than a complete accessibility audit. Staff, Follow-ups, and form screenshots were visually inspected; reports and clarity screenshots are in artifacts/. Rebuilt installed files load on the next full exit/relaunch; the live session was left untouched.

### Staff app — implemented

- [x] Implement searchable staff table (name, contact, join date, type, base salary, Details) and app-scoped Add staff modal.
- [x] Implement profiles with Overview, Salary history, doctor-only Work done, and Documents tabs using session dummy data.
- [x] Verify creation, role-specific tabs, profile navigation, lifecycle retention, scoped dialogs, and compact layout privately; rebuild without touching the live session.

Staff now opens a preferred 1060×650 window with five sample staff across Doctor, Helper, Support, and Receptionist roles. Base salary is displayed in NPR/month. Add staff validates required fields and appends a session row; profiles remain inside the shared frame. Tabs support arrow/Home/End keyboard navigation, and Work done is available only for doctors. Seed salary rows show payment balances; work amounts are labeled treatment charges. Document entries use explicit dummy previews without real attachments or uploads. Newly added staff have empty histories and documents. All data ends when Electron OS exits.

Validation: build/typecheck and all 25 unit tests pass. All 21 private Staff interaction checks pass, including scoped dialogs, creation, filtering, doctor-only tabs, lifecycle retention, fullscreen, and compact layouts. Staff list, overview, and modal screenshots were inspected. Shared dental dock and overview regressions were also run on the private display. The installed launcher uses the rebuilt files on the next full exit/relaunch; the live user session was left untouched.

### Follow-ups remaining-height table — implemented

- [x] Fill the remaining app height with the table panel for populated and empty views; keep row heights natural.
- [x] Keep heading, summary cards, filters, pagination, and session footer fixed; scroll the table viewport with sticky column headings.
- [x] Verify few-row, empty, overflow, and resized-window layouts on the private test display, then rebuild the installed files without restarting the user's session.

Validation: build/typecheck and all 29 Follow-ups UI checks pass on the private headless display. Two-row and empty views retain the same table viewport; pagination and session footer stay at the bottom. At the minimum 420 px window height, compact summary cards omit descriptive subtitles to preserve usable row space; rows scroll with sticky headings and fixed controls. Four-record pagination remains. Screenshots inspected: `artifacts/followups-fill-height.png` and `artifacts/followups-compact-scroll.png`. The installed launcher uses the rebuilt files on the next full exit and launch; the current user session was left untouched.

### Direct environment controls — implemented

- [x] Replace the system menu with separate dock buttons for Minimize Electron OS and Shut down Electron OS.
- [x] Keep native transition settling, session continuity, fullscreen dock reveal, and shared dock motion.
- [x] Verify one-click native minimize/restore/exit and dock bounds privately; rebuild without restarting the live session.

The old four-pane menu launcher is replaced by two magnifying dock tiles: blue minus for native minimize, red power for closing Electron OS. A divider separates them from the ten dental apps. Both are ordinary accessible buttons with captions and keyboard activation. Native actions settle dock motion and block repeated activation while pending; minimize keeps the same session, and shutdown closes only Electron OS. Fullscreen edge reveal exposes both controls. This supersedes the historical system-menu requirement below.

Validation: build/typecheck and 25 unit tests pass. All nine UI suites pass on the private display, including direct native minimize and exit, preserved app data/drafts through host-dock reactivation, fullscreen reveal, Genie, and dock containment during hover at 480/800 px with nine minimized snapshots. Screenshots inspected: `artifacts/clinic-dock.png` and `artifacts/direct-dock-controls.png`. Updated files are ready through the installed launcher after a full exit/relaunch. The user's live session was not restarted or focused.

## Windows preview installer — 2026-10-15, built; Windows acceptance pending

User-authorized out-of-sequence prototype packaging experiment originally recorded alongside M11 and now retained as historical input for M20. Package only the current shell/demo as an unsigned Windows x64 installer; do not claim M20 acceptance or select a production installer/update channel. No backend, publishing, signing identity or production acceptance is included.

- [x] Add a reproducible, allowlisted Windows preview installer configuration and icon.
- [x] Build the current renderer/host, run unit checks and a relevant private host suite sequentially with bounded resources.
- [x] Produce and inspect the Windows installer, packaged assets and checksum; provide transfer/install instructions.
- [x] Record that real Windows installation, launch, update/uninstall and UI acceptance remain unverified.

Validation: renderer/native build and 25 unit tests pass; six static package checks, NSIS archive integrity, and seven smoke checks of the exact Windows-bundled ASAR on the private Linux display pass. The ASAR run checks isolated preload, relative assets, demo rendering and draft continuity through native minimize/restore. Artifact: `release/windows/Dental-OS-Setup-0.1.0-x64.exe` (134,825,156 bytes, approximately 129 MiB). SHA-256: `c55630b2d3ab6e779a0e410229dad176b71cbc3dcc97897839a1159f0eddda4d`. Evidence: `artifacts/windows-preview-verification.json`, `artifacts/windows-preview-build-native.log`, `artifacts/windows-package-linux-smoke.json`; instructions: `tools/desktop-release/WINDOWS_PREVIEW.md`.

Packaging is pinned to electron-builder 26.15.3 with an explicit runtime/output allowlist, per-user NSIS installation, shortcuts, no auto-launch or publish, and unsigned preview identity. A bounded build wrapper strips live display variables and limits Linux CPU/memory/compression. The first high-compression run was stopped gracefully after excessive memory growth; the lower-compression attempt reached a Wine helper incompatibility. The final successful path uses electron-builder's own native uninstaller parser in a tightly scoped in-memory adaptation, with no dependency-file edits or Windows helper execution. The isolated test and all task-owned build/display processes exited. The user’s existing running app was not restarted or focused. No Windows device has executed this installer; production milestones and release gates remain unchanged.

## Objective

### Native-style overview layout — implemented

- [x] Center a balanced arrangement of proportionally scaled windows, adapting rows to the available screen and window count.
- [x] Replace gallery card decoration with window shadows and overlapping app artwork.
- [x] Verify four/many windows, narrow displays, keyboard navigation, and preserved app state on the private display.

The arrangement evaluates balanced row counts and chooses the largest common window scale that fits the available area. Preview dimensions come from each app's actual normal/fullscreen bounds, retaining proportions and relative sizes. Each row and the whole group center on a fitting screen; scrollable collections start at the top without blank leading space. Gallery panels are removed; window shadows, hover/focus outlines, and 60 px app artwork overlapping the preview edge provide separation and identity. Up/Down navigation follows the nearest window in the adjacent visual row. Read-only clones update when window dimensions change.

Validation: build/typecheck, 25 unit tests, and 30 private overview UI checks pass. Verified 4/7/10-window centering, proportional previews, non-overlap, spatial keyboard navigation, narrow-screen scrolling, drafts/focus/geometry/fullscreen continuity, and minimized-app restore. Screenshots inspected: `artifacts/window-overview-4.png`, `artifacts/window-overview-7.png`, `artifacts/window-overview-10.png`, and `artifacts/window-overview-many-small.png`. Evidence: `artifacts/overview-verification.json`. The existing installed launcher uses this build on the next full exit and launch; the running user session remains untouched.

### Internal window overview — implemented

- [x] Reserve unmodified Backquote (`) while Electron OS is focused to toggle an internal window overview; Escape exits it.
- [x] Arrange previews of open/minimized apps, highlight hovered/focused cards, and select a window without losing its data or presentation.
- [x] Keep background windows/dock inert during overview, preserve forms and remembered focus, and support keyboard selection and smaller displays.
- [x] Privately verify lifecycle/data preservation, shortcut behavior, and preview layout; rebuild installed files without touching the running user session.

Overview lifecycle belongs to the shared desktop state. Its grid shows open and minimized internal apps in recent-focus order. Visible apps use inert read-only DOM previews with current form values and stripped DOM identities; minimized apps use their saved captures, with artwork fallback if capture was unavailable. Background windows stay mounted at their existing bounds, hidden/inert while overview is active. Clicking a card or pressing Enter restores/focuses its window, preserving fullscreen and session content. Arrow/Home/End keys navigate cards; Tab stays within the overview. Backquote/Escape or its close button dismiss it and restore remembered app focus. Modified/composing keys are untouched; held-key repeats do not toggle repeatedly. Busy Genie/drag/resize transitions defer overview entry by ignoring that press. No global host shortcut, key log, host-window list, search, or virtual workspace system is added.

Validation: build/typecheck and 20 unit tests pass. All nine private UI suites pass: overview 17, Finance 20, dental dock 55, Follow-ups 29, Records fixture 21, windows 51, Electron/motion 28, native session 24, and DPR 2 scaling 5. Overview verifies shortcut input suppression, empty/open/minimized cases, preserved draft values/focus/geometry/fullscreen, keyboard selection, hidden/inert backgrounds, duplicate-ID removal, and narrow-screen layout. Inspected screenshots: `artifacts/window-overview.png` and `artifacts/window-overview-small.png`; report: `artifacts/overview-verification.json`. Rebuilt files are ready through the installed launcher after the next full exit and launch. The user's live session remains untouched.

### Finance submodule tabs — superseded by the app explorer mock

The earlier tabbed Finance mock was replaced by the compact app-explorer flow above after the user clarified the desired multi-module behavior. The former inside-window tab bar and its keyboard-navigation contract are no longer the active design.

### Clinic dock apps and image artwork — implemented

- [x] Add Appointments, Work Entry, Patient Record, Treatment Progress, Lab Tracker, Finance, Staff, Treatment Protocols, and Calendar as managed dock apps with only their name and Coming soon.
- [x] Preserve the working Follow-ups app; limit the normal app dock to the ten dental navigation items. Legacy Motion Studio/Records remain private-test fixtures only; remove Playground/Settings placeholders.
- [x] Use detailed raster artwork only for the ten dental app icons, matching each purpose; keep the existing system-menu utility and real captured minimized previews.
- [x] Keep the enlarged app collection usable on smaller displays through shared dock layout and motion.
- [x] Privately verify every new app's controls, snapshots, artwork, and responsive dock; rebuild installed files and document results.

Ten purpose-specific PNGs are saved in `src/assets/dock/`; built-in image_gen prompts and saved paths are recorded in `artifacts/icon-generation.json`. The normal dock has no demo app icons or empty/duplicate previews. Additional thumbnail slots are reserved synchronously before Genie measures capture geometry and shown for minimized apps; snapshots survive viewport changes. The shared layout proportionally fits the complete dock during hover on narrow displays. Legacy demo regression fixtures are enabled only by a private-test switch; the default dental app suite confirms they are absent.

Validation: build/typecheck and 20 unit tests pass. All seven private UI suites pass: dental dock apps 55, Follow-ups 29, Records fixture 21, window manager 51, Electron/motion 28, native session 24, DPR 2 scaling 5. The dental suite verifies each new app's open/fullscreen/minimize/captured thumbnail/restore/close behavior, actual move and corner resize, nine simultaneous minimized previews, and 800/480 px dock containment under hover. Screenshots inspected: `artifacts/clinic-dock.png`, `artifacts/clinic-coming-soon.png`, and `artifacts/clinic-minimized.png`. The installed launcher points to the rebuilt project files; the user's active session stays intact and sees the update after the next full exit and launch. User visual acceptance remains pending.

### Dock edge placement and window depth — implemented

- [x] Place the dock at the bottom screen edge through shared dock geometry.
- [x] Reduce dock transparency, blur, and pill rounding to match the supplied macOS reference's quieter surface.
- [x] Give normal windows clear edge and shadow separation, with stronger depth for the active window.
- [x] Verify overlapping windows, dock motion, and geometry on the private display; rebuild without disturbing the live session.

The supplied Big Sur screenshot is the visual reference. Dock bottom is now 0 px, superseding the earlier 8 px margin; the normal window-to-dock gap remains 8 px. Dock background opacity is approximately 94%, blur 10 px (previously 28 px), corner radius 16 px. Shared normal-window shadows distinguish active and inactive windows; fullscreen removes the shadows. Build/typecheck, 19 unit tests, 51 window checks, and 28 Electron checks pass, including bottom-edge placement, hover, Genie, resize, focus, and native minimize/restore. Inspected overlapping-window screenshot: `artifacts/window-depth.png`. The installed launcher uses the rebuilt files after the user's next full exit and launch; their live session remains untouched.

Build a separate Electron desktop application in TypeScript, with React for presentation, to prove that FEWA-style dock magnification and Genie minimize/restore motion can work smoothly in this stack. Expand the product only after this experiment succeeds and the user chooses to continue.

## Agreed scope

User-authorized local installation: provide a Linux desktop launcher named **Electron OS** and pin it to the host GNOME dock. It launches this project's built app; keep the project directory and its dependencies in place. No publishing or portable installer is implied.

Installed and verified: `~/.local/share/applications/electron-os.desktop`, `~/.local/bin/electron-os`, and a blue layered SVG icon under the local hicolor theme. Desktop entry validation and build pass; GNOME favorites include the launcher with existing favorites preserved. Launched successfully through `gtk-launch`, verified the running process, and registered Electron's desktop name for dock association. The launcher detaches from its launching terminal and logs to `~/.cache/electron-os/launcher.log`.

All app modal backdrops, dimming, and blur must be confined to the owning app window. Other windows, dock, and outer OS controls remain usable.

Visual hierarchy: keep the parent app title bar/frame crisp; modal effects cover only its content area. Use a compact form, modest shadow, clear surrounding margins, and a parent-app context label so the form reads as content inside that window.

All internal apps use the shared macOS-style title bar: red close, yellow minimize, and green maximize/restore circles on the left; centered app name; neutral light strip; dimmed controls/title for inactive windows. The outer Electron environment retains its separate top-right **–** and **×** controls.

Maximized internal apps fill the entire renderer at (0, 0), with no outer margins or reserved dock/status-bar space. Desktop chrome hides while the foreground app is maximized. Hover the bottom center to raise the dock; hover either top corner to reveal the OS status bar. Chrome stays available while the pointer uses it and hides after departure. Returning to normal app size restores persistent chrome. Genie temporarily keeps the dock visible at its normal position for a stable destination.

Full-screen app verification: build/typecheck, 22 Records checks (including full viewport bounds, hidden chrome, edge reveal, retention and return to normal size), and the full Electron interaction suite pass. Reviewed `artifacts/records-fullscreen.png`. A native restore check exposed inconsistent display dimensions; restore now reapplies the current display bounds and fullscreen state, and the rerun passes. Dock baseline checks use the contracted resting width of 40 px rather than a transient sampled width. Updated prototype relaunched.

Title bar verification: `WindowTitleBar` is shared by Motion Studio and Records. Build/typecheck, all 14 Records checks, and the full Electron interaction suite pass. Reviewed the updated title bar screenshot. The first Electron run timed out at dock hover; an isolated rerun passed. Relaunched the updated prototype.

Scope extension requested by the user: add a separate Records dock app with a semantic table, clear column headings, alternating row colors, and an Add form. Records are demo data held in memory for this prototype; no backend or business integration.

- [x] Implement Records window, dock launch and internal minimize/maximize/restore.
- [x] Implement striped table and validated Add/Cancel form.
- [x] Verify adding a record, cancelling, and state preservation through Genie; inspect screenshots and relaunch.

- A separate product and codebase; do not migrate or modify FEWA OS.
- Electron + TypeScript, with React for the desktop interface.
- Light theme: FEWA's turquoise-shore photograph, light system bar, translucent light dock, and readable dark text. The native startup background remains light.
- Readable typography: 14–16 px main interface/body text, 11–12 px small labels, medium body weight and semibold titles/controls. Give the internal window enough room for the larger text.
- A desktop surface filling the selected screen through a frameless fullscreen Electron window, including the host dock/taskbar area. Use full display bounds rather than the reserved work area.
- Only **–** and **×** at the environment's top right. **–** minimizes the entire Electron environment to reveal the host desktop without quitting; **×** exits. Restoring from the host taskbar/dock returns fullscreen. Internal app controls minimize/maximize only the app.
- A dock whose icons follow a shared bell-curve magnification field around the pointer.
- One simple internal test window with recognizable content and internal minimize, maximize/restore, and close controls.
- Genie animation between that internal window and its dock target, matching the FEWA reference geometry and timing.
- Restore through clicking the minimized window's dock target. Clicking its launcher opens or focuses it when appropriate.
- Linux is the initial proof environment. Other platforms receive separate validation when requested; do not infer cross-platform success from Linux.

The environment stays fullscreen while its internal windows minimize/expand/restore. Genie applies to Studio and Records independently. The top-right **–** minimizes the entire environment without quitting; **×** exits. Internal expanded presentation is fullscreen, with dock/status-bar reveal rules described above.

## Excluded from this experiment

SDK, Rust services, business workflows, identity, workspace databases, package systems, app-to-app intents, integrations, networking, distribution, installers, automatic updates, and a complete application ecosystem. No Flutter runtime in the new product.

## Reference and motion contract

FEWA is the visual and behavioral reference. Record the exact reference commit before implementation so acceptance compares against a stable target.

Archived reference project: `/home/master-x/Desktop/fewa_business_os/refrence`. Read `docs/motion/GENIE_ENGINE.md` and locate the corresponding dock, Genie geometry, snapshot, and lifecycle code at the selected commit. Do not assume source paths are identical across FEWA branches.

- [x] Record reference branch, commit, and relevant source paths below.
- [ ] Capture or retain reference demonstrations of dock hover, minimize, and restore.
- [x] Record bell-curve width, magnification, spacing, pointer smoothing, and baseline dock dimensions.
- [x] Record Genie duration, phase overlap, easing, direction, mesh geometry, and source/target bounds.
- [ ] Agree any unavoidable visual differences explicitly; do not silently replace Genie with a scale/fade animation.

## Implementation checklist

### 1. Independent application foundation

- [x] Scaffold Electron, TypeScript, React, and a repeatable development/build setup in this directory.
- [x] Separate Electron main, preload, and renderer responsibilities.
- [x] Keep renderer Node integration disabled and context isolation enabled; expose only narrow window-control functions through preload.
- [x] Launch the application locally and render the desktop surface.
- [x] Keep the fullscreen environment fixed; make only the internal window title draggable.
- [x] Implement top-right **–** (native environment minimize) and **×** (environment exit), with fullscreen on native restore. Internal app controls use the shared shell manager.
- [x] Verify resizing, maximized state, and display scaling keep controls and desktop aligned.

### 2. Dock and bell-curve magnification

- [x] Render a small set of local placeholder icons and a target for the internal test window.
- [x] Port the reference shared field/math approach; drive icons from one pointer field and animation loop.
- [x] Match the reference center magnification, neighboring falloff, spacing, and dock anchoring.
- [x] Preserve predictable hit targets while icons change size.
- [x] Smooth pointer motion and return to baseline on pointer exit without oscillation or abrupt jumps.
- [x] Keep the complete dock centered through hover and minimized-window target changes.
- [x] Verify rapid pointer sweeps, edges, and repeated entry/exit.

### 3. Internal test window

- [x] Create a simple window with readable text, contrasting blocks, and a stateful input or counter for visual and state checks.
- [x] Implement open/focus, internal minimize, internal maximize/restore, and dock-triggered Genie restore.
- [x] Model visible, minimizing, minimized, and restoring states explicitly.
- [x] Keep its content and state alive across minimize/restore.
- [x] Track its rectangle and dock destination accurately during outer-window resizing and display scaling.

### 4. Genie renderer

- [x] Prove a snapshot/texture capture method for the simple test content without permissions or external services.
- [x] Implement a WebGL textured mesh with reference-derived geometry, timing, easing, and deformation phases.
- [x] Match the reference minimize path and restore path; use the reference's reverse-time relationship where defined.
- [x] Hide the live test window during the overlay and reveal it at the correct restore boundary.
- [x] Align the first and final mesh frames with the live window and dock destination without visible jumps.
- [x] Preserve readable texture orientation and avoid mesh folding, clipping, flicker, or stretched end frames.
- [x] Keep animation resources bounded and release snapshots, textures, and listeners when no longer needed.
- [x] Handle repeated clicks, pointer hover during animation, resize, and interrupted transitions with deterministic state.
- [x] Provide a stable direct minimize/restore fallback for unavailable WebGL or failed snapshot capture, and honor reduced motion.

### 5. Validation and visual comparison

- [x] Type checking and the production build pass.
- [x] Add focused checks for bell-curve math, mesh endpoints/order, and lifecycle transitions where they protect real behavior.
- [x] Verify fullscreen screen coverage, internal maximize/restore, top-right internal minimize, and environment exit on Linux.
- [ ] Compare dock behavior and Genie recordings side by side with the pinned FEWA reference.
- [x] Check normal and high display scaling, outer-window resize, and maximize/restore.
- [x] Run repeated internal minimize/restore cycles and confirm preserved content, correct focus, and no accumulating overlays/resources.
- [x] Record frame timing on the actual test machine; target smooth animation at its refresh rate, with approximately 16.7 ms per frame on a 60 Hz display.
- [x] Confirm fallback and reduced-motion behavior remain usable.
- [x] Record verification commands, environment, results, and known limitations below.
- [x] Present the runnable prototype and captured motion evidence for the user's visual acceptance. Exact FEWA side-by-side comparison remains pending.

## Acceptance criteria

The experiment succeeds when all of the following are demonstrated:

1. The separate Electron environment covers the screen, exposes only **–** and **×** at top right, and remains fullscreen through all internal window transitions.
2. Dock magnification follows a smooth bell-shaped field and matches the FEWA reference behavior.
3. An internal test window minimizes into the dock and restores with the reference Genie motion, preserving its state.
4. Hover, repeated interaction, resizing, and scaling cause no visible lifecycle errors or abrupt endpoint jumps.
5. The prototype performs smoothly on the recorded Linux test machine and retains usable fallback behavior.
6. The user accepts the visual match. Technical checks alone do not establish an exact visual match.

## Decisions and evidence

| Item | Record |
|---|---|
| FEWA reference branch/commit | `codex/m08-pharmacy-engine` at `314bebd5f45591e966eee2482c7f4a994e2a7564`; local older baseline reconciled. |
| Reference source paths and recordings | `lib/shell/genie/`, `lib/shell/dock/`, `docs/motion/GENIE_ENGINE.md`. Pinned copies and SHA256 in `references/`. FEWA recording/comparison remains pending. |
| New project product name | Pending; does not block prototype implementation |
| Snapshot capture approach | Bounded main-frame Electron `webContents.capturePage`; captured PNG becomes WebGL texture and dock preview. No screen-capture permission or service. |
| Test machine, OS, GPU, display scaling/refresh | Linux 6.8.0-111-generic, Intel Core i5-1035G1; actual Electron 44.7.0. Primary display ~60 Hz, tested device pixel ratios 1 and 2; renderer reports WebKit WebGL. See evidence JSON for display details. |
| Build/type-check/test commands and results | `npm run build` (both TypeScript checks + Vite + native bridge build), `npm test` (5 motion tests), `npm run test:electron` (fullscreen interaction checks), `npm run test:scaling` (5 checks): PASS before theme revision; theme revision verification below. |
| Performance and comparison evidence | `artifacts/electron-verification.json`, `artifacts/scaling-verification.json`, desktop/hover/studio/Genie/high-DPI PNGs. Frame timing recorded; exact FEWA visual comparison pending. |
| Accepted differences or known limitations | New artwork/icons, fixed preview slot, bottom dock only. After a minimized resize, stale capture is discarded and restore uses the direct fallback. User acceptance of visual differences is pending. |
| User visual acceptance | Pending |

## Progress rule

Keep this checklist current before reporting completion. Record failed or partial checks honestly. Changes to the agreed scope must be reflected here. Completion of this prototype does not authorize expanding the product, modifying FEWA, or publishing it.

## Implementation record — 2026-10-13

- Implemented the standalone project with Electron main/preload/renderer separation. Renderer has no Node integration; after the fullscreen clarification, native APIs are limited to environment exit and bounded capture of this window. All minimize/maximize logic is internal renderer state.
- Ported the FEWA raised-cosine-squared bell, live-width integral layout, 1200/700 damped followers, 636 ms 50/40 Genie phases, quadratic funnel and 64–160 row/two-column WebGL mesh. Native snapshots preserve real rendered note/counter content.
- Dock magnifies from 40 px to 110 px at the lens center, uses 10 px gaps and a 200 px influence radius. Dock geometry freezes during Genie to preserve the captured destination. A continuous hit region prevents gaps from restarting the field.
- Actual Electron checks cover native controls, hover/sweeps, capture, five repeated cycles, state preservation, reduced motion, lost WebGL context, interruption on resize, 2× scaling, and out-of-bounds capture refusal.
- The final ten timing samples without screenshots had median frame intervals around 16.7 ms, p95 around 16.7–16.8 ms, and maxima around 16.7–16.8 ms (40–41 frames each). An earlier run had a 50 ms gap. The final 2× scaling run produced 35 frames, with a maximum 50 ms gap and several 33 ms gaps. See `artifacts/frame-summary.json`; high-DPI smoothness still needs visual review. Screenshot capture during an earlier animation disturbed its timing; that sample is retained and not used as clean performance proof. These are measurements on this machine, not a guarantee for other hardware.
- An initial interaction check measured baseline before the native pointer had settled. The check now explicitly waits for the resting 40 px geometry; passing evidence is retained. TypeScript configuration was corrected for the installed compiler's Node16 resolution rules.
- No FEWA source was modified. No SDK, business services, installer, publishing, or future product work was added.
- Remaining acceptance: view FEWA and this prototype side by side, agree any visual differences, and receive user visual acceptance. Technical completion does not mark those gates accepted.

- Final built application launched with `npm start` on the user's display for review. Run instructions are in `README.md`.

## Scope clarification — 2026-10-13

The user clarified that the environment must cover the full screen. Host-window minimize/maximize is removed; only internal dock applications minimize/maximize/restore. The environment exposes **–** and **×** at top right. **–** is interpreted as minimizing the active internal app, keeping the environment fullscreen; **×** exits. Earlier windowed control evidence is historical and superseded by the fullscreen checks below.

- [x] Fullscreen revision built and actual Electron checks pass.
- [x] Maximized internal window follows the same Genie route and restores maximized, preserving its content.
- [x] Final fullscreen prototype launched for review.

### Fullscreen revision verification

- Build/typecheck and 5 motion tests pass. Actual Electron checks prove fullscreen startup, exactly two environment controls, internal maximize/restore, Genie restore of a maximized window, disabled **–** without an active app, and exit. The native window remains fullscreen and unminimized throughout internal transitions.
- 2× capture/Genie, bounded capture refusal, stale-snapshot fallback on display-size change and retained fullscreen state pass. Display-size changes are simulated through Chromium device metrics; the environment is not resized/minimized through a product UI action.
- Current evidence supersedes the windowed baseline. The older screenshots/JSON are retained in `artifacts/windowed-baseline/`. Current screenshots and JSON are in `artifacts/`; `frame-summary.json` describes this final source. The fullscreen 2× run has occasional frame gaps (maximum ~66.6 ms); visual smoothness on high-DPI hardware remains a review point.

### Fullscreen startup correction

The user observed that the environment still did not cover the display. The prior test checked only Electron's fullscreen flag; its screenshot was actually1344×924 despite a reported1920×1080 display. That was insufficient verification. This correction removes fixed startup/minimum dimensions, uses detected full display bounds, requests fullscreen after the window is ready, and verifies actual renderer/native dimensions against the display. Prior fullscreen acceptance is superseded until those checks pass.

- [x] Startup native bounds and renderer viewport cover the detected display. Actual native and renderer checks pass; screenshot is1920×1080 on the tested display.
- [x] Corrected environment relaunched on the user's screen.

- Corrected startup removes fixed1280×840 and minimum dimensions, initializes from the complete detected display bounds, then shows, requests fullscreen, and focuses after readiness. The corrected interaction suite verifies both native bounds and renderer viewport against detected1920×1080 display bounds. Capture confirms1920×1080 pixels. The environment exposes no native minimize/maximize handler. Internal dock transitions and internal maximize/restore still pass.

### Light theme and full display coverage clarification

- Fullscreen means the entire selected display, including the host dock/taskbar area; startup uses `display.bounds`, not `display.workArea`.
- Normal and 2× checks now verify the native origin and dimensions as well as the renderer viewport. They run separately because simultaneous graphical tests interfere with pointer/keyboard focus.
- The exit check handles the native window closing before Playwright finishes acknowledging the click, while still requiring the page to close.
- [x] Replace dark wallpaper, system bar, dock, tooltips, feedback, and native startup background with the light palette requested by the user.
- [x] Verify the light build, internal motion, fullscreen bounds, scaling, and screenshots.
- [x] Relaunch the light prototype for review.

- Light revision verification: build/typecheck, 5 motion tests, 22 Electron interaction checks, and 5 scaling checks pass. Desktop and hover screenshots reviewed at 1920×1080. The first hover check had a transient timing failure; a complete isolated rerun passed. Latest timing evidence supersedes previous summaries: high-DPI has a 66.6 ms initial frame interval, so smoothness still needs user review. Exact FEWA visual acceptance remains pending.

### Typography revision

- Increased the formerly 7–12 px interface text to 11–16 px, with medium body weight and semibold controls/labels. Desktop heading is larger and semibold; studio heading is 28 px and semibold. Secondary text has stronger contrast.
- Expanded the normal internal window to 760×480 and the sidebar to 184 px to accommodate the larger text; display-size limits still apply.
- Build/typecheck and all 22 Electron interaction checks pass; inspected the updated studio screenshot for readable text and clipping. The hover test now waits for actual magnification instead of assuming it finishes within 400 ms.

### Latest outer minus clarification

The user explicitly requested normal host application behavior: top-right **–** minimizes the entire environment to reveal the host desktop, without quitting. Startup and restore remain fullscreen. Native minimize IPC is now exposed alongside close. Earlier records claiming no host minimize API or an inactive outer minus are historical and superseded. Internal window controls still use Genie independently.

### Records and window-scoped form verification

Build/typecheck passes. All 14 Records checks pass, including semantic column headings, alternating rows, form validation, Save/Cancel, app-contained modal bounds, another dock app opening while the form remains open, Genie/state preservation, and internal maximize. Updated Electron checks pass, including native minimize without quitting and fullscreen restore. Table/form screenshots reviewed in `artifacts/`. Records are session-only; restarting the environment resets them. Relaunched the updated application for review.

### Dock and window research — 2026-10-13

- Completed the requested research report: [Dock and application window behavior](docs/DOCK_WINDOW_RESEARCH_REPORT.md).
- Covers Apple, Microsoft, and Google documentation, Apple's Sequoia release announcement, Chromium and WinUI Gallery source, third-party Genie recreations, and a Microsoft technical blog.
- The user clarified that “black hole zone” means the dock destination where a minimizing window disappears. The report explains target resolution, capture/hide sequencing, deformation, restoration, clipping proposals, and fallback behavior.
- Includes a local source assessment and proposed future acceptance scenarios. Recommendations are not marked as implemented or added to the approved implementation scope. No application code was changed for this research task.

### Shared window manager and resizing — implemented

The user authorized the first implementation stage from the research report. Scope: shared internal window identity, lifecycle, focus/z-order, normal bounds, fullscreen presentation, common Genie coordination, and resizing from all edges and corners. Preserve app content, window-owned forms, dock behavior, and native environment controls. Snapping and a mini-program SDK remain outside this stage.

- [x] Move Studio and Records onto one shared window manager and window frame.
- [x] Preserve normal bounds and app state through fullscreen and minimize/restore.
- [x] Transfer focus to the next visible window after minimize/close.
- [x] Add all eight resize handles with matching cursors and minimum-size constraints.
- [x] Keep the opposite edge/corner anchored while resizing; retain reachable bounds on smaller displays.
- [x] Handle pointer capture, cancellation, release outside the window, viewport changes, and unmount cleanup.
- [x] Keep modal effects inside their owner; prevent conflicting gestures during forms or Genie.
- [x] Verify geometry constraints, real Electron pointer resizing, focus, content, fullscreen and Genie regressions.
- [x] Build the updated application.
- [x] Relaunch the updated application for review.


Verification: build/typecheck and 19 unit tests pass. Real Electron verification records 51 window checks, 22 Records checks, 24 environment/Genie checks, and 5 scaling checks. Evidence is in `artifacts/windows-verification.json`, `records-verification.json`, `electron-verification.json`, and `scaling-verification.json`. Inspected `artifacts/window-resizing.png`: title and controls remain clear; the resized table scrolls inside its frame.

The shared manager owns window phases, normal bounds, fullscreen presentation, active order, remembered focus, modal state, and interaction locks. Both apps use `ManagedWindowFrame` and the common snapshot/Genie lifecycle; business content remains in the app components. Normal resize minima are 540×340 for Studio and 640×360 for Records, reduced to fit the usable area on smaller viewports. Handles use 7 px edge regions and 15 px corners.

Real-pointer checks exposed early/delayed capture loss and a viewport-change race. Global pointer routing now completes gestures even after capture loss; pointer cancellation, Escape, and deactivation roll back. A queued pointer-up from an old viewport cannot overwrite newly fitted bounds. The first Records regression run timed out on dock reveal; an isolated full rerun passed. High-DPI functional checks pass, but animation timing still has occasional gaps (latest initial interval about 83 ms); visual smoothness remains a separate acceptance gate.

Remaining research recommendations for later stages: refine dock destination masking and interruption policy, add keyboard move/resize and further accessibility review, and consider snapping or multiple windows per app. These are not marked implemented. SDK and persistent business services remain outside this prototype.

Updated build relaunched using the installed Electron OS launcher and its native main process verified running. User visual acceptance remains pending.

### FEWA wallpaper — implemented

The user requested the same wallpaper image as FEWA OS. FEWA's `kDefaultWallpaperAsset` selects `assets/bg_image/fewa-turquoise-shore.jpg`, rendered with `BoxFit.cover`. Copy the original bytes into this independent app, render centered with `object-fit: cover`, and remove the previous synthetic aurora/grain layers.

- [x] Copy the exact FEWA default photograph and apply it to Electron OS.
- [x] Build and verify the image loads and covers the viewport at different aspect ratios.
- [x] Relaunch the updated Electron OS for review; the installed dock launcher uses this build.

Wallpaper verification: original and copied image bytes match exactly; the bundled image loads and covers 1920×1080, 1000×700, and 800×1100 viewports. Build/typecheck passes with no renderer exceptions. Evidence: `artifacts/wallpaper-verification.json` and `artifacts/fewa-wallpaper.png`. Final screenshot inspected. Added a light translucent backing behind the welcome text and desktop footnote to preserve readability; the wallpaper image itself is unchanged.

### Compact dock and usable window area — implemented

- [x] Reduce dock icon, preview, spacing, and tray geometry by 10%, preserving shared magnification and Genie target measurement.
- [x] Lower the dock to an 8 px screen-bottom margin.
- [x] Use a 4 px gap below the environment bar and an 8 px gap above the resting dock for normal window bounds.
- [x] Open Records using the available normal workspace; preserve fullscreen and manual resizing.
- [x] Verify spacing at the supplied 1366×768 size and another display size, plus dock hover, Genie, and window controls.
- [x] Build and relaunch the updated dock application.

These spacing changes apply to normal, unmaximized windows. Fullscreen still fills the viewport and hides desktop chrome until edge reveal. Records opens at the normal usable bounds; Motion Studio keeps its smaller preferred size. The dock hover field is observed without placing an invisible intercepting surface over normal window edges.

Validation: build/typecheck, 19 unit tests, 22 Records checks, 51 window-manager checks, and 24 Electron/motion checks pass. Renderer viewport checks at 1366×768 and 1920×1080 measure 4 px above Records, 8 px between Records and dock, approximately 8 px dock bottom margin (CSS subpixel rounding), and 36 px resting icons. Both screenshots inspected; evidence in `artifacts/compact-layout-verification.json`, `artifacts/compact-layout-1366.png`, and `artifacts/compact-layout-1920.png`. Updated Electron OS launched through the installed dock launcher and its native main process verified. User visual acceptance remains pending.

### Dock system menu replacing the OS bar — implemented

- [x] Remove the environment top bar and its top-edge reveal regions.
- [x] Add a Start-style dock icon with a scoped system menu for Minimize Electron OS and Exit Electron OS.
- [x] Support keyboard navigation, Escape, outside dismissal, and fullscreen dock access.
- [x] Reclaim the top bar space for normal windows while preserving app title bars and controls.
- [x] Verify native minimize/restore/exit, window behavior, motion, and the new menu; rebuild and relaunch the installed app.

The user authorized replacing the entire environment top bar with a Start-style dock menu. This supersedes earlier checklist requirements for top-right host controls and top-corner bar reveal. Only internal app title bars remain. Normal usable bounds now start 4 px below the screen top, reclaiming 43 px of height; fullscreen still fills the viewport. The revealed fullscreen dock remains visible while its menu is open. The menu has two actions, initial focus, arrow/Home/End navigation, Escape returning trigger focus, outside-click dismissal, and closes on native blur.

Validation: build/typecheck and 19 unit tests pass; 21 Records checks, 51 shared-window checks, and 27 Electron checks pass, including actual native minimize, fullscreen restore, and exit through the new menu. Layout and menu containment verified at 1366×768 and 1920×1080. Evidence: `artifacts/dock-system-menu-layout-verification.json`, `artifacts/dock-system-menu-1366.png`, `artifacts/dock-system-menu-1920.png`, and updated verification reports. Updated installed dock launcher build relaunched and main process verified running. Visual acceptance remains for the user.

### Native minimize/restore continuity — implemented

- [x] Preserve internal window geometry, state, data, and open forms across whole-environment minimize/restore.
- [x] Prevent transient host fullscreen sizes from clamping internal windows.
- [x] Remove recursive restore bounds/fullscreen/focus changes and settle dock motion before native minimize.
- [x] Reuse the running session when launching again from the installed host-dock entry.
- [x] Exercise native restore and installed-launcher activation with normal, fullscreen, and internally minimized windows, then rebuild the installed app.

Investigation reproduced host fullscreen exit during native minimize: renderer changed from 1366×768 to 1334×726, which previously clamped normal app bounds. The old restore handler reentered itself, repeatedly calling setBounds, setFullScreen, and focus. Evidence: `artifacts/native-before.json`. The replacement suspends layout before minimize, paints the closed menu/resting dock and stable wallpaper before the host animation, and resumes layout after fullscreen has settled. Restore no longer writes bounds or recursively focuses. The native trace now makes one fullscreen call and no app bounds writes (`artifacts/native-after.json`). Host compositor motion remains controlled by the host; its visual feel still needs user review.

Single-instance activation now returns repeat launches to the running session. Tests use distinct user-data profiles, leaving the user's active environment alone. The installed launcher accepts forwarded arguments; normal host-dock launch remains unchanged.

Validation: build/typecheck, 19 unit tests, 21 Records checks, 51 shared-window checks, 27 Electron checks, and 24 native-session checks pass. The new regression suite exercises native restore and the exact installed launcher executable in an isolated profile, with resized normal windows/open form drafts and fullscreen Records/internally minimized Studio. It verifies identical geometry, focus order, presentation, phases, saved row values, note, counter, draft, and retained DOM nodes; also verifies native window identity and stable hidden-renderer desktop/dock geometry. Evidence: `artifacts/native-session-verification.json`. Use `npm run test:native-session`.

The rebuilt files are used by the existing installed host-dock launcher. The user's current session was intentionally left running to preserve in-memory data; the fix takes effect on the next full exit and launch. Quitting still ends this prototype's session data; native minimize/restore preserves it.

### Remove desktop intro — implemented

- [x] Remove the welcome/intro card and its unused styles and icons. Apps continue to open from the dock.
- [x] Rebuild the installed launcher files. Existing running sessions load this visual change on their next full launch.

### Follow-ups dock app — implemented

- [x] Add Follow-ups to the shared window manager and dock, with its own snapshot destination and standard controls.
- [x] Recreate the reference body: heading/actions, four selectable summary cards, search/date toolbar, striped table, checkboxes, Details, and pagination.
- [x] Use dummy patients; make search, day navigation, bucket filtering, status toggles, Refresh, create form, and Details usable in memory.
- [x] Keep create/details dialogs scoped to their owning window; preserve session state through internal and native minimize/restore.
- [x] Verify behavior and reference layout at 1366×768, build the installed files, and document results.

Follow-ups is a third managed app with a teal calendar-clock icon and a dedicated captured preview target. Its content matches the provided reference body, excluding the browser and black site navigation. It starts with 13 synthetic patients and the Missed bucket selected; four records per page keep pagination visible at 1366×768. Search, summary/date filters, day navigation, all three status toggles, create, Details, Refresh, and pagination work in memory. Dialogs and background blur remain inside this app. Demo dates use Gregorian formatting relative to session start. Native restoration now returns keyboard focus to the active app's remembered field, including an unfinished form.

Validation: build/typecheck and 19 unit tests pass. UI checks: followups: 25, records: 21, windows: 51, electron: 27, native-session: 24, scaling: 5. Screenshots `artifacts/followups-1366.png` and `artifacts/followups-form.png`; behavior evidence `artifacts/followups-verification.json`. The final UI suites run on a private headless GNOME/Wayland display. Screenshots were inspected. The updated build is ready through the installed launcher; the user's current session stays open and loads the Follow-ups icon on its next full launch.

### Quiet UI testing — implemented

The user requested that automated tests never interrupt Brave/YouTube or bring Electron windows in front of their running apps.

- [x] Route all npm UI test commands through a private headless GNOME compositor with its own virtual monitor, D-Bus session, temporary settings paths, and app profiles.
- [x] Remove host display/session variables from test child environments and force the private Wayland socket.
- [x] Refuse direct UI test launches or fallback to the real desktop; verified the guard exits before Electron opens.
- [x] Lower test CPU priority and limit software rendering to two threads.
- [x] Run all six UI suites on the private display, including native restore/launcher continuity and DPR 2, without touching the user's running app.
- [x] Document the workflow in README.md and AGENTS.md.

Use `npm run test:ui` or individual `npm run test:<name>` commands. There are no root/system-package changes. A trial Xvfb/Openbox runtime was removed after its X11 minimize state proved incompatible with this Electron build; the final runner uses the already-installed GNOME headless compositor and the same Wayland protocol as the user's desktop. Private-display software rendering checks functionality, not live-desktop performance.

## M02 host/state implementation — 2026-10-15

Implemented strict OS-only preference storage, atomic journal/migration/recovery, narrow status/preferences bridge and bounded host restore polling. Linux: 35 unit tests, build/typecheck and private host-state/native-session checks pass sequentially. See [M02 evidence](dental-os_v1_working_info/milestone-02-host-and-os-state/VERIFICATION_EVIDENCE.md). Windows device verification remains pending, so full milestone acceptance is not claimed and M03 is not started. No backend/deployment/live-session changes.

## Dedicated repository and Windows CI setup — 2026-10-15

User authorized connecting to Business-It-Partners/dental-os, preserving history/work, establishing main and milestone branches, committing/pushing the reviewed project and adding Windows Actions. Physical Windows-device tests are deferred until after M11, before final product release. CI must not deploy the backend. Publication audit, checkpoint identities and run evidence are recorded in docs/GIT_AND_CI_SETUP.md.

Windows CI closeout: [run 38778013772](https://github.com/Business-It-Partners/dental-os/actions/runs/38778013772) passes at `fd124b5c20e0abbac0a3f99a79be2cc01cddb59c`. Dedicated origin/main and M01/M02 branches are published; Flutter origin retained as flutter-reference. M02 is verified for automated Linux/Windows scope under the approved physical-device deferral. M03 not started. No cloud backend deployment or live-session restart.


## M03 isolated runtime implementation — 2026-10-15

User authorized M03 only. Two fixed private sample apps now execute in separate sandboxed renderers/origins/partitions, with platform-bound reports, crash/hang supervision, scoped dirty-close and shared shell composition. Foreground native view plus inactive snapshot mirrors preserves existing dock/overview/Genie; activation-click and background-invalidation limitations are explicit in the composition ADR. Linux: 39 unit tests, final build, isolated runtime/DPR proof and shared overview/native regressions pass sequentially. Windows CI is pending on `codex/milestone-03`; physical Windows remains deferred. See [M03 evidence](dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md). No backend/cloud deployment, M04 start or live-session restart.

M03 closeout: final source `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a` passes Linux 40 unit tests/build/private runtime-DPR and applicable shared regressions; Windows run [38782178992](https://github.com/Business-It-Partners/dental-os/actions/runs/38782178992) passes 39 unit tests (one POSIX-only skip), build, four host and 28 runtime checks. Capture corners and native-focus ordering were repaired and rerun. ADR-007 is accepted for declared sample scope. M03 VERIFIED under approved physical-device deferral; user acceptance pending. Main stays M02 and M04 is not started. All local owned test/display jobs exited.


## M03 main integration and standing workflow — 2026-10-16

User authorized integrating verified M03 into main, retaining milestone branches/checkpoint tags, and future merges after each milestone passes required verification. Normal merge preserves M03 and main history; duplicate cleanup-documentation conflict reconciled, no runtime changes. Tested runtime SHA-256 manifest matches; documentation checks pass. No heavy checks repeated, backend deployment, live-session restart or M04 start. Canonical policy: docs/GIT_AND_CI_SETUP.md; enforced through AGENTS.md, DEVELOPMENT.md and roadmap/status records. Physical Windows testing remains after M11/before final release.


## M04 SDK/broker implementation — 2026-10-16

User authorized M04 inspection/plan/implementation/verification/integration, then continuing directly to M05. SDK 1.0 and bounded named-operation broker now bind caller/frame/origin, capabilities, connection/generation and staging environment. Host-only fixture identity, preserved existing appointment routes/idempotency/revision, structured errors, cancellation/deadlines/limits and lifecycle/status interfaces are implemented. Linux 64 unit/local HTTP tests, build and private SDK/M03 regressions pass; Windows pending. No backend mutation/deployment, real auth or live-session restart. See M04 notes/evidence; M05 is authorized next but not yet active.

M04 closeout: source `672a8118` / checkpoint/m04-ci passes Linux 64 tests and Windows run 38842666568 (63 tests, one POSIX-only skip), build and private/hosted SDK/runtime checks. G04 verified within fixture scope; runtime hashes unchanged for normal main integration. Milestone branch/checkpoint retained; M05 authorized next; no backend changes or deployment.


## M05 platform identity implementation — 2026-10-16

Continued immediately after M04 as authorized. Trusted Firebase/Worker sign-in, coordinated renewal, safe clinic context/capability, protected optional refresh persistence, session-only fallback, lock/logout/switch and generation-fenced app/layout/capture cleanup implemented. Linux 77 unit tests, build and six focused private regressions pass. Approved existing staging account proved real CLI and actual private desktop login/renewal/lock/logout plus invalid identity and clinic/Super Admin separation; no business writes, user changes or web-session revocation. Credentials stayed outside tracked files/evidence and temporary inputs were removed. Windows pending; see M05 evidence. New normal sign-in gate loads on a future user-controlled full relaunch; live session unchanged.

M05 closeout: source `07c2fb21` / checkpoint/m05-ci passes Linux 77 unit tests/build/private regressions, actual approved staging CLI/desktop identity checks and Windows run 38845000521 (76 tests, one POSIX skip; all host/runtime/SDK/identity/privacy checks). Windows native encryption probe passed; first live-profile EBUSY harness failure was repaired and retained. Evidence-only integration preserves all 56 source-manifest hashes. Milestone branches/checkpoints retained; normal main merge authorized. No credentials in repository/reports, temporary credential inputs removed, no backend edits/deployments or running-session interruption. Stop after M05; M06 not started.

## M06 — Verified packages and local lifecycle, 2026-10-16

User authorized the next sprint after M05. Implemented strict signed dentalpkg/1 web packages, OS-profile immutable installation registry/journal/recovery, bounded safe extraction, active pointer/version retention, launch revalidation and pinned bytes, verified broker identity/grants and contained uninstall. Signed private samples replace direct runtime asset loading. No production trust key, third-party/sideload interface, backend change or deployment. Existing Store remains a synthetic presentation until M07/M08 integration. [M06 status](dental-os_v1_working_info/milestone-06-verified-packages/STATUS.md) and [evidence](dental-os_v1_working_info/milestone-06-verified-packages/VERIFICATION_EVIDENCE.md) govern completion. Sequential Linux unit/build/private runtime checks and applicable Windows CI are required before checkpoint/main integration. Physical Windows tests remain deferred after M11 and user visual review remains pending.

M06 completion: Linux 142 unit tests, build/typecheck, eight real process-exit and eight installed-package runtime cases pass; existing runtime (28), SDK (15) and identity (20) private suites pass. Windows run [38848241451](https://github.com/Business-It-Partners/dental-os/actions/runs/38848241451) passes at `083f9128`: 141 unit pass / one POSIX-only skip plus build and all applicable package/host/runtime/SDK/identity gates. `checkpoint/m06-ci` and codex/milestone-06 retain the tested checkpoint/history; authorized normal merge integrates M06 into main. No repeated heavy check for evidence-only closeout. M07 not started; stop after M06. All task-owned jobs exited; live session and local reference archive preserved.

## M07 — First-party Store and staging distribution, 2026-10-16

Started on user authorization after M06. Desktop signed catalogue/clock/replay checks, bounded anonymous package delivery, current admin authorization, actual installed Store/dock state and isolated sample launch/uninstall/restart are implemented locally. Existing prototype Store is private-fixture-only. Local full 182 unit checks plus final 46 focused distribution checks, final build, 10 Store/private and 20 identity cases pass. Separate unchanged-baseline SaaS worktree SYS-0005 implements additive staging-only catalogue/policy and operator publisher; full Worker 410 tests and exact typecheck pass. No deployment, provisioning, production mutation or main integration. [M07 status](dental-os_v1_working_info/milestone-07-store-and-distribution/STATUS.md), [evidence](dental-os_v1_working_info/milestone-07-store-and-distribution/VERIFICATION_EVIDENCE.md), and [concrete rollout](dental-os_v1_working_info/milestone-07-store-and-distribution/STAGING_ROLLOUT.md) distinguish local proof from pending actual G07 cloud acceptance. Windows CI pending. Actual staging rollout needs the separate approval required by AGENTS; M07 stays unverified/unmerged until then. M08 not started.

M07 CI update: [Windows 38850865178](https://github.com/Business-It-Partners/dental-os/actions/runs/38850865178) passes at `8554c1bc`: 187 unit pass / one POSIX-only skip, build and all ten Store, eight recovery, eight package, four host, twenty-eight runtime, fifteen SDK and twenty identity cases. Retained evidence/source hashes match. M07 is still NOT VERIFIED and not merged: actual staging G07 rollout/acceptance needs separate deployment approval. Backend SYS-0005 local commit `67a5dc5` is preserved without staging push/deploy. No heavy job remains; main/checkpoint history and live session preserved.


M07 closeout: user authorized all necessary staging work through M10. Final source `3d349758` passes Windows run 38853480777 and affected Linux checks. Actual G07 acceptance passes 14 staging identity/catalogue/R2/install/access/client-regression cases. Dedicated sample release bucket/public origin added; guarded publication sequence 2; temporary publisher removed. SaaS additive staging deployment 38853577930 at 3ae3397 preserves all previous bindings and no new migration. G07 VERIFIED; normal main integration and checkpoint authorized, M08 follows continuously. Production/live desktop untouched, protected credential input removed, physical Windows deferred.


## M08 — Safe independent app updates, 2026-10-16

Started continuously after verified M07 normal merge f2361db6 on codex/milestone-08. Detailed plan covers pending/trial/known-good registry state, pinned running leases, signed staging controls and explicit rollback, update authorization/background timing, dirty/unknown-write coordination, health recovery/retention and staged/Windows gates. Existing SaaS backend ticket will own additive update-policy delivery; no production changes. Implementation/verification in progress, no acceptance claimed.

M08 closeout: final tested source 857b2c4f / Windows 38857330434 passes 240 units/one POSIX skip, build and all update/package/host/runtime/SDK/identity gates. Linux focused/final checks and actual staging sequences 3–7 prove signed rotation, old-instance pinning, safe activation, revocation/minimum/withdrawal refusal and controlled downgrade. Quarantined digests are communicated and skipped for background download. Additive SYS-0006 deployed at a502142; all existing bindings preserved, no clinical writes/production changes or temporary publisher left. M08 VERIFIED, checkpoint/normal main merge authorized; continue M09/M10. Physical Windows and user acceptance remain deferred/pending.


## M09 — Integrated OS and SaaS contract proof, 2026-10-16

Started after M08 verified normal merge dce9d589. Detailed plan freezes real approved package/runtime transport, representative existing appointment APIs, trusted unresolved-write close coordination, synthetic staff/appointment fixtures and cancel/inactivate cleanup before staging mutations. No real patient inputs, new business backend or production changes. G09 implementation/verification in progress; M10 follows under standing authorization.

M09 closeout: final source 54be1c06 / Windows 38922410037 and 21 real-staging desktop checks pass G09. Original-key unknown write reconciliation, conflict/read-only denial, guarded close/update, independent pinned app, lock/logout partition/disk privacy and uninstall verified. Owned synthetic fixtures cancelled/inactivated with audits preserved. Backend operator-only SYS-0007 does not change shared Worker/source/config or production. Checkpoint/normal main merge preserves source; proceed authorized M10.

## M10 — Security, resilience and usability, 2026-10-16

Started from verified M09 main bd0cea01 on codex/milestone-10. Detailed plan freezes threat negatives, fixed-schema bounded diagnostics/explicit support export, crash/capture/exit safety, preserved-state recovery, keyboard/scaling/reduced-motion and two-app resource budget. Controlled local checks and Windows CI before normal main merge. No production/M11 release work.

M10 local closeout: bounded diagnostics/support/recovery, exact signed-byte canonicality, crash/capture/lease/host-exit safety and public-metadata account continuity implemented. Local full 254 plus final affected 11 unit cases, build, 22 hardening, 23 integrated, 28 runtime, 21 identity, five bounded-resource and two recovery checks pass; eight affected package checks pass after replacing an obsolete raw-error-text assertion with exact reason metadata. Windows first run passed new hardening/recovery/resource/integration and units/build, then failed that old assertion; retained. Final source e2027a57 awaits complete Windows rerun before VERIFIED/tag/normal merge. No M10 backend or production changes.

M10 VERIFIED closeout: final e2027a57 / Windows 38925883945 passes all 255 unit cases (253 pass/two POSIX skips), build and every applicable desktop/process-exit gate. Local proof retained, final package refusal assertion repaired without weakening exact reason verification. Linux resource peak ~1.15 GiB / Windows ~0.78 GiB, six processes, 60-second two-app samples finish below warm baseline. Normal main integration/checkpoint preserve source; stop after authorized M10. M11 signed release/operations, physical/assistive/long-duration host acceptance and full dental application UI/workflow delivery remain separate. No M10 production/backend operation or lingering local test jobs.

## Post-M10 visual repair — verified Store install arrival, 2026-10-17

User requests restoring the existing artwork lift/flight/soft dock landing in the real Store. Scope: trigger only after a successful first install in the current session; retain existing timing/effects and shared dock field; support current vector artwork; append new app icons; settle safely on Open/resize/overview/host transitions, missing source and reduced motion. Startup, refresh, failed/cancelled installs and staged updates must not celebrate. Preserve the running desktop and use sequential bounded build/unit/private UI checks. No backend/cloud changes, M11 start, checkpoint rewrite or live app restart. Implementation/verification pending.

Store-arrival repair complete locally: real verified first installs now reuse the original vector/image flight and right-end dock landing, with safe Open/reduced-motion/overview/resize fallback. Build, 255 units, 20 new arrival checks and 10 Store/eight update/23 integrated/28 runtime regressions pass. [Implementation/evidence](docs/STORE_INSTALL_ARRIVAL.md). No backend, cloud, live-session restart or milestone/checkpoint changes. New build loads at the next full launch; follow-up Windows CI has not been run.

## Post-M11 OS preference recovery compatibility — 2026-10-20

The startup recovery view was being triggered when the active Electron build read a valid version-2 OS preferences file containing workspace favorites, because the M11-integrated reader only accepted version 1. The OS state parser now accepts the exact validated v1 and v2 schemas, and updates to older OS settings preserve v2 favorites. Invalid v2 data still fails closed and is preserved for support. Build/typecheck and all 276 unit tests passed; the focused private recovery scenario proves v2 startup/preservation plus the existing corrupt-state recovery and offline restoration paths. Evidence: `artifacts/recovery-verification.json`. This is a compatibility repair, not evidence of M12 phase completion or G12 acceptance. No OS profile data, backend, production deployment, commit/push, or live application session was changed; the new build loads at the next user-controlled full launch.

## Local development sign-in helper — 2026-10-20

Added a sign-in form button that fills credentials from the ignored root file `.dev-login.local.json` only when Dental OS is unpackaged. The file is owner-readable on POSIX and never enters renderer build assets, tracked source, test evidence, or packaged releases. Private UI tests use a separate synthetic-only fixture switch. This local convenience does not change M05 protected refresh-token behavior or advance any M12 phase. User-provided local development credentials were not copied into tracked files or evidence.

## M12.4 window layering, dock clearance and title controls — 2026-10-20

The user's screenshots exposed an isolated `WebContentsView` remaining over a newly selected shell window. Focus changes now synchronously hide the old native surface before the shell window/overview paints; normal async layout IPC still handles app geometry/activation. The user then requested a small space above the dock: normal/maximized windows retain the flush status-bar title edge and now leave 12px above the dock. Window control buttons remain circular and always visible, ordered green maximize, yellow minimize, red close; their icons are 10% smaller inside the 19.5px targets. Private runtime and window suites passed, including a sampled desktop-corner regression for the stale app surface, title/dock alignment, drag recovery, and control interaction. At this checkpoint M12.4 remained in progress; the later completion status is recorded in the current M12 section above. User visual acceptance is separate. No commit/push or restart of the live OS.

The user additionally requested a 10% shorter status strip and a more visible frosted-glass material. Desktop height is now 31px (from 34px); the narrow layout is 59px (from 66px), with maximized/normal window geometry following the same heights. The bar now uses a more transparent blue-gray gradient and stronger blur/saturation instead of the nearly opaque navy overlay. Final build, 289 unit tests, private identity/windows/runtime suites (44/30/30 checks), documentation validation and diff checks pass. Screenshot evidence: `artifacts/m12-maximized-window.png` and `artifacts/m12-full-fixture-dock.png`. The live OS remains untouched and loads these changes on a future full launch.

### M12.4 inactive-window clarity and control alignment — 2026-10-20

An inactive app mirror was captured at 640px wide and stretched across the full window, softening its text whenever another app had focus. Runtime mirrors now use the original native capture dimensions; no window blur or filter was added or removed, and the existing window shadow declarations are unchanged. Window-control symbols are positioned at each circle's exact center. Following the user's sizing direction, the circles are 18.525px (5% below the interim 19.5px size) and symbols are 10% smaller than the prior symbols. `npm run build`, all 289 unit tests, the private runtime suite (32 checks) and the private window suite (30 checks) pass. An initial window-check attempt failed only because its test required an exact fractional CSS width; Chromium reports the bounding box rounded to 18.5156px. The assertion now allows subpixel layout quantization while still checking dimensions and symbol centers. The live app remains untouched and loads the changes on a later full launch.

The user first asked to reduce the internal traffic-light symbols by another 10%, keeping the 18.525px circles unchanged. Maximize/restore symbols became 8.748px; minimize/close symbols became 10.206px. The user then requested that the circles shrink by another 10%; their current diameter is 16.6725px and the icon sizes stay unchanged. The private window suite checks dimensions and centering.

### M12.4 edge-drag clipping and preview repair — 2026-10-20

The user reported left-edge spill, a right-edge overlay glitch, bottom-edge spill into the dock zone, and a soft preview while moving a window. The cause was native `WebContentsView` geometry being clamped independently from the shell frame; invalid right/bottom child bounds could leave the old native surface painted, while its separate compositor could lag pointer movement. Native bounds now track the frame, horizontal overflow follows the shared 30%-visible edge limit, each window frame is clipped at the dock-zone top, and native content height is clipped to the same boundary. The full-screen Genie canvas stays outside that frame clip. Native child surfaces hide synchronously at drag start; a full-resolution app capture stays inside the clipped moving frame until native bounds settle. `npm run build`, the focused runtime contract suite, `npm run test:runtime` (39 checks plus DPR 2), and `npm run test:windows` (43 checks, including Genie overlay bounds) pass. Private drag/edge captures are recorded under `artifacts/runtime-{drag-preview,edge-left,edge-right,edge-bottom}.png`. G12 and user visual acceptance remain open. The live app was not restarted and will load this change on a later full launch.

## M12 kickoff — user-directed shell chrome cleanup, 2026-10-20

Started M12 on `codex/milestone-12-shell` from M11-integrated `main`. The older pre-M11 `codex/milestone-12` ref remains preserved rather than rewritten. Initial requested cleanup removes the lower-left Electron/Dock+Genie prototype label and the white backplate behind top-right session controls; session actions stay available. The Linux build and all 280 unit tests pass; the focused private identity UI test confirms both strips are gone, the session actions remain, and no page errors occur. Screenshot evidence: `artifacts/m12-chrome-cleanup.png`. All five M12 phases remain PLANNED pending user scope; no phase or G12 acceptance is claimed.

## Published M14 parallel app handoff — 2026-10-21

The user authorized a separate web-chat app track while this checkout continues platform reconciliation. Dental OS `codex/milestone-14` is published at `3ace826ef4800abbcd7ff2c5bc37601de248e63a`; SaaS `codex/den-0003-dental-os-module-bundles` at `12ac3aed66979e7c924b416f5a70aa2733e366a8`. [Start here](https://github.com/Business-It-Partners/dental-os/blob/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality/WEB_CHAT_START_HERE.md) owns the app handoff, source pins, eleven-app matrix and app/platform dependency boundary. M14 is IMPLEMENTING for planning/handoff; no functional app acceptance is claimed. M12/G12, M13/G13 and final G14 dependencies remain open. The app branch excludes this checkout's uncommitted runtime changes. Frontend SaaS typecheck/lint/56 existing unit tests and OS handoff documentation checks passed; static OS package build, live API/Store and private runtime app acceptance remain pending. No environment/main merge, deployment, signed publication or live-app restart occurred.

### M14 Windows/Linux handoff readiness — 2026-10-21

M14 app-development CI now passes on both hosts at source `41c88796be558806cc0664a09972cd3539afa57f`: [run 39634626211](https://github.com/Business-It-Partners/dental-os/actions/runs/39634626211). Shared SaaS typecheck/lint/56 tests pass; ten available M13 source shells pass package validation and synthetic startup on each host. Per the user's clarification, functional dental apps will be implemented afresh in the web-chat track: Follow-ups is explicitly planned/NOT RUN and no functional export is enabled yet. Each implemented app must enable its real build/tests; shell results do not establish M14 acceptance. SaaS source remains identical to the original handoff after the tentative config fix was reverted; current CI pin is `a3b116c64df826cbb5b66bc09305f81bf06cd463`. The existing Windows platform workflow also passes at the final baseline; an earlier intermittent dock-edge failure is retained for platform reliability review.

[M14 start guide](https://github.com/Business-It-Partners/dental-os/blob/codex/milestone-14/dental-os_v1_working_info/milestone-14-dental-app-functionality/WEB_CHAT_START_HERE.md) and its CI contract contain the ready handoff. Evidence-only closeout is published separately with unchanged tested inputs. No main/environment merge, platform runtime changes, deployment, app release, or live desktop restart occurred. Original checkout changes remain preserved; the parallel app track may start.

## M17 app-delivery approach — 2026-10-22

At M17 planning time, the user directed that the work stay in this M15 worktree, without a separate execution worktree. The source plan reused the existing Follow-ups and Appointments implementations, with Dental SaaS references and the current M15 SDK/platform contract; the other apps were to be fresh. The key/public trust was prepared and app IDs/first versions were assigned. This plan-time snapshot was superseded on 2026-10-23 when Follow-ups, Appointments and Calendar source was imported from the completed feature commit. See the dated integration record below for current source and evidence. Keep the private signing key protected outside the checkout. Use focused local verification; do not run GitHub Actions. Current-source Windows verification and independent review remain separate gates. Production is excluded; M17/G17 does not close M15/G15 or G14.

### M17.1 Follow-ups prior-package evidence — 2026-10-22

At this 2026-10-22 checkpoint, the earlier Follow-ups 1.1.0 release had passed the recorded private Linux staging scope under its previous identity, but it did not satisfy the new M17 ID/version. Its package build, typecheck, workflow checks, staging publication at sequence 23, Store installation, and runtime health remain historical evidence. The new Follow-ups ID and 1.0.0 release were subsequently published at sequence 24 and passed private-profile Store install/open and exact-payload health; full live clinic acceptance remains open. See [M17.1 plan](dental-os_v1_working_info/milestone-17-dental-app-delivery/M17.1_FOLLOWUPS_PLAN.md) and [evidence ledger](dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md).

### M17.3 Appointments implementation — 2026-10-22

At this 2026-10-22 checkpoint, Appointments was implemented locally under its preview ID/version 1.1.0; this was not the M17 staging release. The SaaS source pin and local tests are recorded in its plan. The new M17 ID was subsequently published as 1.0.0 at sequence 25, updated to 1.0.1 at sequence 26, and passed private-profile Store install/open and exact-payload health. The app source was imported into this M15 worktree on 2026-10-23. Full live clinic acceptance remains open.

### M17 Follow-ups, Appointments and Calendar source integration — 2026-10-23

Merged source commit `5306b80161542b7a9480b4bb2bc49df6b1218d84` locally into `codex/milestone-15`. The import includes Follow-ups, Appointments and Calendar app source, assets, focused host fixtures/tests, release tooling, M17 evidence and app plans. Kept M15 capability-family routing and its shared 64-company-app metadata limit; no static app-ID entries or installed-profile edits were added. Staging releases already exist for Follow-ups 1.0.0 (sequence 24), Appointments 1.0.1 (sequence 26) and Calendar 1.0.0 (sequence 28); private-profile Store install/open and exact-payload health evidence passed for those releases before the source import. The integrated root build passed, all 517 root tests passed, all 10 app package tests passed, and the three private UI fixtures passed 57/57 checks. Package typecheck/build and details are in the [M17 evidence ledger](dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md). This merge itself does not publish or install packages. No GitHub push, main merge, production change or restart of the user's live OS occurred.

### M17.5 Treatment Progress source integration — 2026-10-23

Imported the completed M17 Treatment Progress app from local source commit `8b506ee3` into `codex/milestone-15`. The merge includes the app bundle source/assets, SaaS source pin, private UI/API fixtures, staging publication evidence and M17.5 plan. M15's generic `clinic.app.*` family routing is retained; no fixed app-ID policy entry or installed-profile change was added. Its signed `company.dental.treatment-progress.m17` 1.0.0 package remains published at staging sequence 27. App typecheck/build and 3 package tests passed, the private headless UI passed 23/23 checks, the Treatment Progress source branch root build passed, and 251 focused host tests across 8 files passed. Store install/runtime health and live clinic workflow acceptance remain open. This integration does not push to GitHub, merge to main, alter the running OS session, or republish the staging app.

### M17.5 Treatment Progress 1.0.1 staging update — 2026-10-23

In the M15 worktree, removed the Doctors table column while keeping doctor search/filter and wrapped long treatment-plan labels to two lines. Updated the app to 1.0.1. App typecheck/build, four package contract tests, the M15 integrated build, 521 root tests, and 25 private UI checks passed. The first UI attempt exposed a stale assertion for the SDK bridge method list; the corrected current-bridge assertion passed and both reports were retained. Published the signed update to Cloudflare staging at sequence 34. Public verification passed 26 checks, including signatures, package bytes, exact grants, and isolated install/launch/uninstall of all seven M17 packages; the old Treatment Progress 1.0.0 grant remains available. The temporary publisher Worker was cleaned up. Store installation/runtime health and live clinic acceptance remain open. No GitHub Actions, production changes or user-app restart occurred. See [M17.5 release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.5_TREATMENT_PROGRESS_STAGING_UPDATE_2026-10-23.json).

### M17.6 Lab Tracker source review and M15 integration — 2026-10-23

Started M17.6 in the existing `codex/milestone-15` worktree with new app ID `company.dental.lab-tracker.m17` and first version `1.0.0`. The source is pinned to Dental SaaS `origin/production` commit `f44d3e30ca6f79cba61e32601c53d58826500201`; `SOURCE_IMPORT.json` records UI and Worker file hashes. The package contains Lab Tracker and Lab Supplier Record modules, uses only the M15 `ClinicClient` for business calls, and preserves the SaaS lab-order flow while keeping submitted clinical fields immutable, retaining cancellation history, and protecting shared Finance supplier edits.

Earlier M17.6 implementation work recorded app typecheck, four package contract tests, package build, 13 private UI checks, integrated root build, 520 root tests and docs validation passing. These are historical results and were not rerun on the current combined M15 tree after Finance and Staff integration. The app source and both modules were already present in the M15 base at `132a9373093d473341522d5733592146aade0adb`; this import brings the Lab Tracker review/status documentation into the current M15 worktree. Reviewed the UI and Worker contract against Dental SaaS production `f44d3e30ca6f79cba61e32601c53d58826500201`; the package uses `ClinicClient` and existing host route policy, with no host route changes. Current-tree verification and release remain pending; the app is unsigned and unpublished.

### M17.9 Staff local implementation — 2026-10-23

Implemented only `company.dental.staff.m17` / `1.0.0` on the requested `codex/staff-app-work` branch, exactly based on M15 `132a9373093d473341522d5733592146aade0adb`. The maintained Dental SaaS reference is pinned to `/home/master-x/Desktop/fewa_demo/dental-saas` commit `a3b116c64df826cbb5b66bc09305f81bf06cd463`; exact UI/API/permission file hashes are in the app's `SOURCE_IMPORT.json`. The package includes the roster/search/type-filter/empty state, add form, staff profile and row-versioned edit/conflict handling, doctor work history, salary history gated on `finance.manage`, and private Staff documents through the M15 host media SDK. It uses the shared `ClinicClient` and Dental OS shared UI, with no server/transport code or local authoritative data store. Current Worker permissions gate Staff data on `staff.manage`, salary history on `finance.manage`, and current roles grant those capabilities to admin. Exact release grants for `clinic.media.read` and `clinic.media.upload` have not been issued; file opening and upload remain blocked pending those grants. See [M17.9 status](dental-os_v1_working_info/milestone-17-dental-app-delivery/M17.9_STAFF_STATUS.md), [implementation notes](dental-os_v1_working_info/milestone-17-dental-app-delivery/M17.9_STAFF_IMPLEMENTATION_NOTES.md), and the [API contract](apps/dental-apps/company.dental.staff.m17/API_CONTRACT.md).

The SaaS Staff Worker lacks the `/v1/clinic/staff/:staffId/documents/:documentId/abort` route used by host cancellation after remote commit begins. The app keeps local pre-commit cancel available, disables cancel once commit starts, and uses retry of the same operation to resolve uncertain outcomes; adding a Worker route is outside this app-only scope.

No build, typecheck, test, docs checker, private UI/runtime/API or clinic-isolation acceptance was run. The source was committed on `codex/staff-app-work` as `b4c26750419d13ac86acb132a0236fefc6153b56` and imported into M15 in a local commit. No signing, bundling, publication, deployment, push, or app restart was performed. Verification and release remain undone by request.

### M17 staging cleanup — 2026-10-23

The user requested removal from Cloudflare staging of dental apps outside the M17 set. On the verified staging account and dedicated `dentmitra-dental-os-releases-cloudfare-staging` bucket, the M17 signer published a new signed catalogue and update policy at sequence 30. They retain the five M17 app IDs and three sample app IDs, and omit eleven prior dental IDs. The bucket inventory contained 20 dental package objects: six M17 versions (including both Appointments releases) and 14 legacy objects. The 14 objects for the eleven earlier identities were deleted; a fresh R2 listing confirmed only the six M17 objects remain under the dental release prefix. Public signed feed readback verified sequence 30 and the exact retained ID set. The temporary nonce-protected staging Worker was deleted. No sample package, production resource, installed local app, or live OS session was changed. Evidence: [staging cleanup sequence 30](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/m17-staging-legacy-app-cleanup-seq30-2026-10-23.json).

## M15 P03 — formal platform closeout planning, 2026-10-21

The user authorized adopting the reconciled scope as M15 Platform Closeout and Integration. Its PLAN, STATUS, IMPLEMENTATION_NOTES and VERIFICATION_EVIDENCE records define six slices and G15. Roadmap, global status, requirements/gates and M12/M13/M14/M20 coordination are aligned. Historical M01–M11 evidence is preserved; M12/G12 and M13/G13 residuals remain open until actually proven. M14 app implementation continues independently; final G14 requires verified G15. M20 keeps platform release/installer/updater/signing/host certification and G21 remains mandatory after M20.

Work pattern: this lead coordinates the separate sidebar chats/worktrees; no embedded workers are used for P03. The combined planning checkpoint is on `codex/milestone-15` in the `platform-closeout` worktree. Existing original-checkout runtime changes are retained for M15.1 review and are not part of this documentation checkpoint. Documentation validation is required; no heavy build or runtime/UI suite is appropriate for this scope. Remove unnecessary task-generated build outputs when each worktree task finishes, preserving source/evidence and live/unrelated builds.

P03 closeout: combined documentation checks PASS with 24 architecture documents, 16 milestone folders/64 required records, 15 requirements and 17 gates. Reviewed the worker outputs, corrected the app-launch wording and included affected final-source privacy in G15 mapping. No runtime build/unit/UI test was run for P03. Five task worktrees were inspected for generated build-output roots; none existed, so none required deletion. Source/reports/evidence and the original live build remain intact. G15 and other runtime/release gates stay open.

## M15.1 — source and record reconciliation, 2026-10-21

Verified the lead worktree is `codex/milestone-15` at the expected P03 base `125fa25bcc27d6ff198148259695d76cf895b0eb`; the original dirty M13 checkout and earlier P03 worker worktrees remain preserved. Reviewed original-checkout runtime, test and artifact deltas plus local side-branch ancestry. Accepted only the managed-app launch feedback and native-frame handoff slice after source review and source-bound build/unit/private-runtime/app-launch checks. Checkpoint: `ad3fa6a10437bf58606631325d93f6b3cc0369b5`. The staging helper and Windows preview/report artifacts are deferred to M20 review; older side branches are classified in M15 implementation notes and were not merged. The original checkout is unchanged.

This checkpoint does not close M12.6/G12 (including user visual acceptance), M13/G13 (current Follow-ups health receipt and Finance/Lab Tracker 1.0.1 review), P04–P09, G15, M14/G14, M20/G20 or G21. `python3 tools/check-dental-docs.py` and `git diff --check` pass for the dated record updates. No main merge, push, deploy, production change, user app restart, worktree deletion or history rewrite occurred.

**2026-10-22 user-approved scope amendment (historical, later superseded):** media upload was deferred and unavailable to real app sessions while the remaining platform baseline was completed. The user later resumed media work; the current host-gate implementation and open checks are recorded below and in the central checklist. No completion was implied at this checkpoint.

**M15 technical closeout update — 2026-10-22:** build, 437 unit tests, all selected private Linux platform suites, 25 real staging signed-profile JSON checks and 10 committed-backend crypto/two-database checks pass within their recorded scopes. Final exact-source Windows validation and review remain. At that checkpoint, media uploads were deferred and denied in real sessions; later normal-session gate work is recorded in the current amendment below. Manual review follows technical verification. See the central checklist and M15 non-upload verification manifest.

**2026-10-22 media scope resumption:** the user authorized a private synthetic staging probe using the existing Dental SaaS Worker API and a locally signed Dock fixture. The Worker path was corrected and deployed to staging; the local normal-session gate was then exercised through the private Dock fixture. No public app grant was published. The fullscreen-chrome follow-up remains unpushed and has no GitHub Actions run, as directed.

**2026-10-22 media size, interruption, and clinic-isolation acceptance:** actual staging uploads at the SaaS caps (10 MiB patient image, 25 MiB Staff document) passed readback and SHA-256 checks. Both cap-plus-one-byte requests were rejected before credentials or network access. Patient content-response loss recovered after sign-out and fresh sign-in to the same clinic by reselecting the same synthetic file and reusing the original operation key; a Staff finalise-response loss also reconciled. Both synthetic media records were later withdrawn and are absent from active lists. Clinic B was denied access to clinic A's synthetic records and withdrawn media, and both cross-clinic upload intents were rejected before any file bytes were sent; the earlier probe did not test an active file. The Worker withdrawal did not delete the combined 35 MiB; external bucket lifecycle and post-withdrawal bytes were not checked. Stored-byte retention/deletion remains. See [size/recovery evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_SIZE_RECOVERY_STAGING_2026-10-22.json) and [clinic isolation evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_TENANT_ISOLATION_STAGING_2026-10-22.json).

**2026-10-22 active-file cross-clinic media isolation:** a separate 19-check private staging probe used newly created synthetic files and fresh private signed Patient Record and Staff apps. Clinic A read back a 68-byte PNG and a 601-byte PDF with matching SHA-256 and confirmed each exact asset active immediately before Clinic B attempted access. The signed Patient Record app and Staff app each received broker `ACCESS_DENIED`; the metadata list request returned HTTP 404, no binary view/download request was dispatched, and zero bytes reached Clinic B. Clinic A confirmed both assets remained active across the denials. SaaS withdrawal then returned HTTP 204 for each asset and removed both from the active lists; no physical R2 deletion was attempted. The private report/journal are mode 0600, no Clinic B credential was persisted, public catalogue/policy hashes stayed unchanged, and no public app grant or production request occurred. See [active-file isolation evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_ACTIVE_TENANT_ISOLATION_STAGING_2026-10-22.json). At the time of this isolation probe, the upload-failure cases had not yet run; the later acceptance is recorded in [P07 upload-failure evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_UPLOAD_FAILURES_STAGING_2026-10-22.json).

**Earlier 2026-10-22 private media Dock probe:** The first staging run passed real clinic sign-in and upload/readback before the current normal-session gate was verified. Its report was superseded by the current-source run below.

**2026-10-22 current-source private media Dock acceptance:** The isolated Dock test passed real clinic sign-in, lock, sign-out, fresh sign-in, signed app launch, host-broker upload and readback of the attributed 303,866-byte JPEG with matching SHA-256, media withdrawal and unchanged public catalogue/policy. One clearly labelled synthetic patient remains for audit; withdrawn R2 bytes remain stored. The current report is [P07 media Dock staging evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_UPLOAD_DOCK_STAGING_2026-10-22.json). Staging deployment version `57bb3b18-fcee-4447-958f-9324abe7b884` remains unchanged. No public grant, production, push or GitHub Actions work occurred. The later active-file clinic-isolation check passes. The targeted upload-failure scenario outcomes also passed: all four MIME/checksum mismatches returned HTTP 422, session revocation during a real content PUT prevented finalise, and the concurrent same-key server receipt race returned HTTP 200/409 followed by HTTP 200 replay. The raw verifier exit 1 was due to duplicate cleanup after successful SaaS withdrawal; the guard was corrected but not rerun, so the media-platform exit remains INCOMPLETE. See [consolidated media staging acceptance](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_STAGING_ACCEPTANCE_2026-10-22.md) and [raw upload-failure evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/evidence/P07_MEDIA_UPLOAD_FAILURES_STAGING_2026-10-22.json). SaaS owns file retention/deletion, outside the OS acceptance scope.

**2026-10-22 normal-session upload gate:** The private fixture uses the normal SessionManager policy. SessionManager permits only the Patient Record/patient-media and Staff/staff-document pairs when the clinic session is ready and trusted claims grant the corresponding permission. The broker continues to require the exact signed format-2 operation grant and app-family capability; the Worker derives tenant from the bearer token. Focused identity/media tests (50), the full serial unit suite (444), build, private media-runtime boundary flow (10 MiB patient image / 25 MiB Staff document), and identity UI checks (41) pass. The current-source staging Dock check also passed this gate for a real staging admin session and one real JPEG; no public app grant was published.

## M15 current-source local build and launcher refresh — 2026-10-22

Current implementation source 94c74ac2f13ed1211c5b2cfa38545f95c002da58 builds successfully with npm run build (renderer and Electron typechecks, Vite production bundle, Electron compilation). npm test -- --maxWorkers=2 passes all 446 tests across 25 files. The initial test invocation with unsupported --minWorkers exited before tests started; the supported bounded invocation then passed.

The installed launcher at /home/master-x/.local/bin/electron-os already targets /home/master-x/.codex/worktrees/platform-closeout/fewa_business_os; the current build refreshed that target's dist/ and dist-electron/. The update will load on the next full launch. No app was started or restarted and the launch path was not changed.

M15 remains IMPLEMENTING. Current-source Windows verification and independent review are open. The media failure scenarios passed at scenario level in the retained run, but the verifier exited 1 on duplicate teardown; the corrected verifier could not be rerun because no protected Clinic A staging credential file was found in active local configuration. The existing M08 signing key and Clinic A synthetic seed journal are available with mode 0600. No other-clinic credential was substituted and no new staging request or credential was made. See the M15 status, verification evidence, and media acceptance records in the milestone-15-platform-closeout-and-integration directory.

## Desktop window controls and dock follow-up — 2026-10-23

Moved host minimize/close affordances fully to the desktop top bar: removed the former first two dock controls and their divider, leaving app icons and minimized-app previews in the dock. The top-right minimize and close controls now read as a single outlined glass group, with brighter symbols and a soft coral close action. Existing host bridge behavior is unchanged. The source splash capture remains at `artifacts/sajilo-dental-branding/sajilo-dental-splash.png`. Build and visual launch status are recorded with this change; no milestone gate or merge status changes.

## M15 host minimize and tucked-window shadow follow-up — 2026-10-24

The OS minimize control had an unconditional two-`requestAnimationFrame` wait before the native minimize request, adding a visible pause even when no Dental apps were open. The preload now begins native minimize immediately after synchronously marking the shell transition. If a managed app is open, the main process hides its native child view without taking a fresh mirror screenshot; the renderer also skips its normal mirror-capture handoff during host minimize/restore. App state stays alive and ordinary in-OS window handoffs retain their snapshots. Separately, active/inactive OS window shadows now render on a sibling layer outside the content clipping, so their depth cue remains visible when a window is tucked past the left, right or bottom edge. The OS close (×) path was not changed. `npm run build` and `git diff --check` pass; tests were not run and the user's live OS was not restarted. This is a local M15 follow-up; M15/G15 gates are unchanged, and no commit or push was made.

## Sign-in email and status-bar brand follow-up — 2026-10-23

The login form now defaults **Remember me** on and saves only a validated email address in the app's local renderer profile for later prefill. Turning the preference off deletes the saved email; passwords and all session tokens remain outside this preference. The status bar's generic building icon/dynamic app title is replaced by the original splash SVG mark and Sajilo/Dental wordmark on one row; logo art is unfiltered and the two wordmark colors match the splash. See [ADR-032](dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-032--remember-sign-in-email-separately-from-session-persistence). The already-authorized dock/system-control cleanup and clearer top-right **– / ×** group remain in this same M15 worktree. `npm run build`, `python3 tools/check-dental-docs.py`, and `git diff --check` pass. I launched a separate updated preview with a fresh profile while leaving the existing M15 preview and its in-memory session untouched. The five-second splash capture is at `artifacts/sajilo-dental-branding/sajilo-dental-splash.png`. All work is local; no commit or push.

## M17.7 Finance planning — 2026-10-23

On required Dental OS branch `codex/finance-app-work` at base `e20ddff0bafc469da0dc83d94a467a1d585f9199`, researched the Finance app against Dental SaaS production commit `f44d3e30ca6f79cba61e32601c53d58826500201` (`origin/production`, confirmed by a fresh remote branch read). The plan inventories eight SaaS Finance internal sub-apps and records their pages, navigation, workflows, rules, role permissions, APIs, important UI states, source paths, and Dental OS mappings. Finance is one top-level app/package at `company.dental.finance.m17`; its eight ordered child plans are M17.7.1 Transaction Record, M17.7.2 Patient payments, M17.7.3 General expenses, M17.7.4 Salary payments, M17.7.5 Product list, M17.7.6 Supplier list, M17.7.7 Purchases, and M17.7.8 Supplier payments. The one package advances 1.0.0, 1.1.0, …, 1.7.0 as each child is added. M17.8's overlapping standalone Patient Payments plan is marked superseded and its scope is absorbed into M17.7.2.

Shared gaps recorded: the host Finance family currently excludes Reception globally, requiring module-filtered Reception access for Patient payments; Finance list APIs return unbounded full arrays while the SDK request/response JSON caps are 12 KiB/256 KiB, requiring a verified data budget or reviewed pagination contract. Existing Finance API route rules and broker operation are present. The Dental SaaS checkout was not modified.

## M17.7.1 Transaction Record source integration — 2026-10-23

On required branch `codex/finance-app-work` at M15 base `e20ddff0bafc469da0dc83d94a467a1d585f9199`, integrated only the first Finance child into the single `company.dental.finance.m17` app and package at version `1.0.0`. The UI/API contract is pinned to Dental SaaS production commit `f44d3e30ca6f79cba61e32601c53d58826500201`. The app uses the existing `clinic.app.finance` family and `clinic.api.request` route; Worker totals and overview stay authoritative. The eight-child version sequence remains 1.0.0–1.7.0, and the next child is M17.7.2 Patient payments.

Status is SOURCE IMPLEMENTED — UNVERIFIED. No tests, builds, verification, GitHub Actions, signing, bundling, publication, or release steps were run. No shared SDK capability gap was added for this child; the existing unpaginated report still has the documented 256 KiB broker response limit.

## M17.7.6 Supplier list source integration — 2026-10-23

On required branch `codex/finance-app-work` at M15 base `e20ddff0bafc469da0dc83d94a467a1d585f9199`, integrated only Supplier list into the existing `company.dental.finance.m17` app/package at version `1.5.0`. The UI and Worker contract are pinned to Dental SaaS `origin/production` commit `f44d3e30ca6f79cba61e32601c53d58826500201`, confirmed by a fresh remote branch read. Earlier Finance children remain in the same package. The internal `supplier-list` module covers supplier directory/search/status, create/edit, route-backed detail, authoritative statement, purchases and payment details, and payment creation from detail through the host ClinicClient.

Supplier and statement values come from Worker responses; no client-side ledger fallback was added. Stale supplier updates use `expectedRowVersion`, and unknown writes keep their original ClinicCommand for same-key retry. Reception policy remains deferred. No Finance route is missing, but the shared SDK has no host-mediated write-receipt lookup after an app view/session is replaced. Supplier, purchase, supplier-payment, and statement responses are unpaginated and subject to the 256 KiB response ceiling.

Status is SOURCE INTEGRATED — UNVERIFIED. Completion criteria remain unchecked. No tests, builds, typechecks, verification, documentation checks, GitHub Actions, signing, bundling, publication, or release steps were run. The next child is M17.7.7 Purchases at Finance version `1.6.0`.

## M17.7.7 Purchases source integration — 2026-10-23

On required branch `codex/finance-app-work` at M15 base `e20ddff0bafc469da0dc83d94a467a1d585f9199`, integrated only Purchases into the existing `company.dental.finance.m17` app/package at version `1.6.0`. The source UI, API and Worker behavior are pinned to Dental SaaS production commit `f44d3e30ca6f79cba61e32601c53d58826500201`, confirmed from the remote production ref. The `purchases` module at `finance/purchases` adds month/search invoice listing, product and lab-service entry with review, detail, correction replacement and reason-required void. Product/supplier quick-create reuses the existing Finance child forms. Purchase writes never create supplier-payment records, and all business requests use ClinicClient.

The Worker validates active supplier/product references, branch availability, invoice uniqueness, amounts and audit behavior and calculates stored totals. The form's line/subtotal/discount figures are previews. Create, correction and void retain their immutable ClinicCommand for same-key retry when the response outcome is unknown. No host route or capability addition was needed; Reception remains deferred.

The purchases, products and suppliers reads are unpaginated and subject to the 256 KiB SDK response bound. The Worker accepts up to 100 lines, but the SDK caps the request body at 12,000 bytes; the form blocks oversize writes without splitting an invoice, so a reviewed size-contract change is needed for the full Worker-valid range. The host has no operation-receipt lookup after the app view/session is replaced.

Status is SOURCE INTEGRATED — UNVERIFIED. Completion criteria remain unchecked. No tests, builds, typechecks, verification, documentation checks, GitHub Actions, signing, bundling, publication, or release steps were run. M17.7.8 Supplier payments follows at Finance version `1.7.0`.

## M17.7.8 Supplier payments source integration — 2026-10-23

On required Dental OS branch `codex/finance-app-work` at M15 base `e20ddff0bafc469da0dc83d94a467a1d585f9199`, integrated only Supplier payments into the existing `company.dental.finance.m17` app/package at version `1.7.0`. The exact Dental SaaS production source pin is `f44d3e30ca6f79cba61e32601c53d58826500201`; `origin/production` was reread and matched. The new internal module is `supplier-payments` at `finance/supplier-payments`; the Finance app ID and package remain shared by all eight sub-apps.

The directory includes the SaaS clinic-month/all-month payment filter, active payment rows, supplier picker, optional recorded purchase link, method/date/amount/reference/note form, correction replacement with reason, and reason-required void. Scope follows the linked purchase type; the Worker validates supplier, branch, scope, audit and idempotency. Same-command retry is retained for unknown outcomes. After writes the app refreshes the affected supplier's authoritative statement and reports any failure without implying the payment write failed.

No host route gap was found. The Worker has an additional restricted Lab Tracker-only create path, but this Finance module requires `finance.manage`. Supplier-payment, supplier, purchase and statement responses are unpaginated under the SDK's 256 KiB response bound. The shared SDK still has no host-mediated write-receipt lookup after an app view/session is replaced; Reception remains deferred.

Status is SOURCE INTEGRATED — UNVERIFIED. All completion criteria remain unchecked. No tests, builds, typechecks, verification, documentation checks, GitHub Actions, signing, bundling, publication, or release steps were run.

### M17.7 Finance import into M15 — 2026-10-23

Imported the committed Finance app source from `codex/finance-app-work` commit `69dd1985771fe409e1169acb14dc66503b5098e8` into the active `codex/milestone-15` worktree. The app is one package (`company.dental.finance.m17`) at source version 1.7.0, containing eight internal sub-apps and their child plans. Reception access is outside this scope; no host role/capability policy was changed. Finance remains source-integrated, unverified, and unaccepted. This M15 import was committed locally as `f7859e9c`; it has not been pushed. No tests, builds, signing, bundling, publication, release, or GitHub Actions were run for the import.


## M17 UI worktree integration — 2026-10-23

Integrated commits `431ee411`, `f19eaaa0` and `9bb5463d` from `codex/dental-ap-ui-enhance` into the active `codex/milestone-15` worktree. This brings the shared app-window Back/Forward bridge, Standard Window page/scroll presentation, and the final Calendar/Patient Record inset corrections. Source-worktree evidence is retained under M12.4 and M17; the signed M17 package set is recorded through sequence 55.

At this 2026-10-23 integration checkpoint, Treatment Progress 1.0.5 was still local and unverified; the signed 1.0.4 at sequence 50 did not include these UI changes. The later version 1.0.5 build, verification and staging publication are recorded in the M17.5 release entry below.

### M17.5 Treatment Progress 1.0.5 verification and staging release — 2026-10-23

The user reported the old progress bar and remaining-count label still visible. The screenshot timestamp (9:44 PM Nepal time) predates the sequence 57 publication later that evening, so it cannot show the 1.0.5 release. Publishing also does not replace an independently installed package or an app window already running in memory. The M15 Treatment Progress package was rebuilt as version 1.0.5 with no progress bar or remaining-count label, completed/total text only, no Doctors table column, two-line plan labels, and no fixed table minimum width. App typecheck, four package contract tests, app build, 29 private UI checks, the complete root suite (527/527), and a focused release identity test (3/3) passed. Public readback verified both signed metadata documents, the package signature/bytes/digest, exact API grant, and retained release grants 1.0.0–1.0.5. Authenticated installation/runtime health and live clinic acceptance remain open; the running app was not restarted. No GitHub Actions or production target was used. See [release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.5_TREATMENT_PROGRESS_1.0.5_STAGING_2026-10-23.json).

## M17 Finance, Lab Tracker and Staff Standard Window table updates — 2026-10-23

Updated the filterable record-table pages in Finance, Lab Tracker and Staff to follow the existing Standard Window page structure: a clean heading with only needed actions, filters and result count in the table toolbar, clear table headers/rows, and pagination held at the bottom of the app window while page content scrolls. Existing summary cards were kept only where they already existed; no new cards were introduced. Finance's one package still contains its eight sub-apps. The relevant app packages are now Finance 1.7.1, Lab Tracker 1.0.1 and Staff 1.0.1.

Each package typecheck, its contract suite (Finance 4/4, Lab Tracker 5/5, Staff 4/4), and production app build passed. Root `npm run build` passed, and `npm test -- --maxWorkers=2 --testTimeout=45000` passed 527/527. Lab Tracker's current M17 private headless UI fixture passed 18/18 checks. The legacy `npm run test:finance` and `npm run test:staff` UI fixtures stop before opening these M17 apps while waiting for old `Finance`/`Staff` shell buttons; the M17 package contract tests and build passed. Finance and Staff have no current M17-specific interaction fixture in this worktree.

Signed Cloudflare staging publication completed sequentially at Finance 1.7.1 / sequence 68, Lab Tracker 1.0.1 / sequence 69, and Staff 1.0.1 / sequence 70. Each publish returned HTTP 200, advanced the signed catalogue and update policy, denied anonymous/replay publication, and cleaned up its temporary publisher Worker. Public readback passed 20 checks including exact signed package identity/grants and isolated PackageRegistry install/launch/uninstall for all three. See [M17 verification evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md) and [public readback report](artifacts/m17-standard-window-app-updates-readback-2026-10-23T18-08-23.838Z.json).

Authenticated Store-profile installation/runtime health, live clinic workflow acceptance, Staff document transfer acceptance, Finance child-level business acceptance, and G17 remain open. No production publication, GitHub Actions, push, commit, or OS restart was performed; the user's installed apps still need Store refresh/update and a later app launch to load the releases.

## M17 Finance blank-window and app-navigation follow-up — 2026-10-24

The Finance app window screenshot showed a blank page. A private M17 startup reproduction captured the renderer exception: `useClinicSnackbar must be used within ClinicSnackbarProvider`. Finance mounted the page-refresh provider without the required snackbar context. Wrapped its loading/refresh providers with `ClinicSnackbarProvider`; the Finance 1.7.2 private fixture now passes 4/4 checks for package startup, Transaction Record render, initial synthetic report request, and error-free empty state. See [report](artifacts/m17-finance-private-latest.json) and [screenshot](artifacts/m17-finance-private-latest.png).

Removed redundant page-level Back buttons from Finance Product and Supplier details, Lab Supplier Record detail, and Staff profile detail. Each route already uses shared OS `AppHistory`; the window title-bar Back/Forward controls remain the page navigation. Escape/close and dirty/modal guards remain intact. Versioned packages were built, signed, and published to Cloudflare staging: Finance 1.7.2 at sequence 71, Lab Tracker 1.0.2 at sequence 72, Staff 1.0.2 at sequence 73. Finance typecheck and six package tests passed; Lab Tracker typecheck, six tests, and 19 private UI checks passed; Staff typecheck and five package tests passed. All three app builds passed. Signed public readback passed 20 checks, including exact package/grant verification and isolated install/launch/uninstall for all three: [report](artifacts/m17-window-navigation-app-updates-readback-2026-10-23T18-21-38.645Z.json).

The older generic Finance and Staff UI fixtures still target the previous shell; Staff-specific private interactions and live document transfer remain unverified. No authenticated Store profile install, live clinic business workflow, production publication, GitHub Actions, push, commit, or OS restart was performed. The running OS remains untouched; refresh the Store and fully reopen each app to load the staged updates. Staging receipts are retained outside the repository under `/home/master-x/.local/share/dental-os/staging-releases/m17-standard-window-followup-20261024/`.


## App Store, Appointments and app artwork integration — 2026-10-24

Selective changes from the clean `codex/dental-ap-ui-enhance` worktree are now integrated into the M15 worktree. The App Store list/detail refresh adds All Apps and New Updates tabs, compact search, single-column app rows, in-row package progress, and shorter detail actions. The shell includes the related artwork and clearer window-control updates. Appointments removes the Doctor table column while keeping its doctor filter and form/detail information; version 1.0.4 was published at sequence 56 and the latest artwork package 1.0.5 at sequence 62. Seven M17 artwork packages were published at sequences 61–67, including Treatment Progress 1.0.6 at sequence 65. Source-worktree package readback and isolated registry checks passed; authenticated Store installation and live clinic acceptance remain open. The root build and affected app-package builds now pass. Package and private UI tests were not rerun for this import; review and M15/G15 gates remain open. No commit, push, production publication, Store installation, or OS restart was performed for this import.

## Finance overview and managed-window navigation — 2026-10-24

Finance Transaction Record now has four primary summary cards in one row and a neutral, always-visible breakdown for the other eight figures. Finance 1.7.5 was built, published to the Cloudflare staging Store at signed sequence 83, and verified from public feed/package/artwork reads with its exact API grant. The app package remains one listing with eight modules.

The shared OS window retains Back and removes Forward. Multi-module apps continue to use the OS-owned left sidebar, with normal app content in the main area. Finance package typecheck/build, root `npm run build`, `git diff --check`, and the documentation contract check passed. UI and package tests were not run for this update. The running OS was left open; its built shell loads after a later full launch. The Finance update is available in the staging Store and is not auto-installed into the current profile. No commit, push, production publication, or live clinic acceptance was performed.

Follow-up Finance 1.7.6 removes the neutral Financial breakdown entirely while keeping the four primary cards, giving the transaction table more vertical space. Its package typecheck/build passed, and the signed package was published at staging sequence 84. Public readback confirmed the updated bundle no longer contains the breakdown UI and that the package, artwork and API grant verify. UI and package tests were not run; the current OS was not restarted and the Finance package is available for Store update.

Finance 1.7.7 replaces the “Transaction Record” page heading with “Financial overview” and removes the duplicate overview heading above the cards, shortening the top area. Package typecheck/build and signed public package/grant/artwork readback passed; package and private UI tests were not run. The update is published to staging sequence 85. To stay within the seven-grant ceiling, grant 1.7.0 was retired and minimum supported Finance version is 1.7.1; local active/fallback versions 1.7.4–1.7.6 remain covered. Refresh App Store and select Finance under New Updates to install; publication did not install it into the profile or restart the running OS.

## M17.2 Patient Record Files-inspired sidebar — 2026-10-24

In worktree `/home/master-x/.codex/worktrees/dentla-app-ui-work-secodn-phase/fewa_business_os`, branch `codex/dentla-app-ui-work-secodn-phase`, based at M15 commit `cb755b2f53be507137368731f6c2da725bdf2550`, updated Patient Record navigation to follow the Files sidebar's gray surface, compact icon rows, and selected-row treatment. Added a semantic patient-section heading and a soft canvas behind the unchanged patient content cards. At this initial candidate checkpoint, the Patient Record 1.0.5 package build and `git diff --check` passed; private UI tests and release work had not yet run.

### M17.2 Patient Record 1.0.7 staging release — 2026-10-24

Bumped Patient Record to version 1.0.7, built the package, and published it to the Cloudflare staging Store at signed feed sequence 80 from the same worktree and branch. App typecheck/build and integrated root build passed; the root suite passed 528/528 tests across 37 files; private headless Patient Record acceptance passed 26/26 checks with synthetic data. Public readback passed 35 checks, verifying the signed feed, all ten current M17 package identities/bytes/grants, and isolated registry install/launch/uninstall. Package SHA-256: `2567c2b27db8aeb1585f3a4c1ac02e14636b4e267d43ba66e0aa629b9bfa5f55`; payload digest: `71059ff1db2fb3989453c4398e26cc65a56cb5e8d7095e1a6108bbab9df451e3`.

The signed policy retains the latest seven Patient Record API grants (1.0.1–1.0.7) and retires the 1.0.0 grant to stay within the platform cap; the 1.0.0 package object remains stored. The temporary publisher Worker was cleaned up, anonymous/replay publication was denied, production was untouched, and the already-running OS was not restarted. Authenticated Store installation and live clinic acceptance remain open. See [release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.7_STAGING_2026-10-24.json), [public readback](artifacts/m17-staging-packages-readonly-2026-10-24T03-27-35.826Z.json), and [private UI report](artifacts/m17-patient-record-private-2026-10-24T03-23-18.088Z.json).

### M17.2 Patient Record independent scroll fix and 1.0.8 staging release — 2026-10-24

After screenshot review, corrected the detail workspace so it fills the app renderer viewport and the sidebar and active record pane scroll independently. Removed the sidebar's extra 42 px sticky offset; left patient section content untouched. Patient Record 1.0.8 was built, signed, and published to the Cloudflare staging Store at sequence 81. App typecheck/build passed; the root unit suite passed 528/528 across 37 files; private headless UI acceptance passed 27/27, including a scroll-isolation check. Public readback passed 35 checks across all ten current M17 packages and isolated Patient Record install/launch/uninstall. Package SHA-256: `17b86468b5ab7cece1487364b53c7547fb8eb72b6c87239e45a88d1495c40602`; payload digest: `2fec182a72577c732491de0f8901dad0c674fd4fbb6bb8629ac42ce2768e0c3b`.

The policy retains Patient Record grants 1.0.2–1.0.8 and retires the 1.0.1 grant to stay within the seven-release cap; its immutable package object remains stored. The temporary publisher Worker was cleaned up, anonymous and replay publication were denied, production was untouched, and the running OS was not restarted. Authenticated Store installation and live clinic acceptance remain open. See [release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.8_STAGING_2026-10-24.json), [public readback](artifacts/m17-staging-packages-readonly-2026-10-24T03-55-04.847Z.json), and [private UI report](artifacts/m17-patient-record-private-2026-10-24T03-51-27.719Z.json).

### M17.2 Patient Record sidebar width and 1.0.9 staging release — 2026-10-24

Reduced the fixed Patient Record sidebar from 206 px to 190 px while preserving independent sidebar/content scrolling and leaving patient content untouched. Bumped the app to 1.0.9, built and signed it with the pinned M17 staging key, and published it to the Cloudflare staging Store at sequence 82. Patient typecheck/build, integrated root build, 528/528 root unit tests, 28/28 private UI checks, and 35/35 signed public readback checks passed. Package SHA-256: `48390b07cdab06d5140528e54a596eba0c74fc92b1586f249d9ef1c333ec4b29`; payload digest: `457530ca648b4333b448fc46383bb76ed2b640cdd2fe6ba59300a306eea2e5d9`.

The policy retains Patient Record grants 1.0.3–1.0.9 and retires the 1.0.2 grant to remain within the seven-release ceiling; the immutable 1.0.2 package remains stored. The publisher Worker was cleaned up, anonymous/replay publication was denied, production was untouched, and the running OS was not restarted. The release was not committed or pushed. Authenticated Store installation and live clinic acceptance remain open. See [release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.9_STAGING_2026-10-24.json), [public readback](artifacts/m17-staging-packages-readonly-2026-10-24T04-13-26.605Z.json), and [private UI report](artifacts/m17-patient-record-private-2026-10-24T04-11-51.861Z.json).

### M17.2 Patient Record new-patient navigation and 1.0.10 staging release — 2026-10-24

Patient Record 1.0.10 is current in the Cloudflare staging Store at sequence 86. The package removes the duplicate new-patient page Back button and supports host-confirmed discard navigation. Root build, Patient Record typecheck/build, 528/528 unit tests and 30/30 private headless UI checks passed. Public readback verified the signed catalogue/policy, exact package bytes/signature/grant, and isolated registry install/launch/health/uninstall. Package SHA-256: `45211018a4c2b880b39e3adb51c06d3c2b31a57c372d9205902d34e6bf56d2cd`; payload digest: `c0a973948162caf9c4adb27bf68b560626b2b0b771193cd69bce8bea6bca9fdf`.

The policy retains grants 1.0.4–1.0.10 and retires 1.0.3 to remain within the seven-release ceiling. The polished discard dialog and OS Back confirmation dispatch are desktop-shell changes and are not delivered by this app package. Authenticated Store installation and live clinic acceptance remain open; refresh the staging Store and fully reopen Patient Record to load 1.0.10. Production was untouched and the running OS was not restarted. See [release/readback evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.2_PATIENT_RECORD_1.0.10_STAGING_2026-10-24.json), [public readback](artifacts/m17-patient-record-1.0.10-public-readback-2026-10-24.json), and [private UI report](artifacts/m17-patient-record-private-2026-10-24T04-47-16.731Z.json).

## M17 Finance purchase entry and keyboard picker visibility — 2026-10-24

Finance purchase entry now omits the invoice-line pagination strip and redundant card borders, removes the page-level Back-to-Purchases action and checkmark beside New Purchase, places a green add-row control on the final line, and advances Enter through item, quantity, unit, and rate to a new row. The product suggestion list is portaled out of the table clipping context and keeps the ArrowUp/ArrowDown-highlighted item in view. The purchase confirmation page now has no redundant bottom Back button. Finance 1.7.11 was built and published to the Dental OS Cloudflare staging App Store feed at sequence 97; the running OS was left open and unchanged. Package tests (9/9), typecheck/build, private UI (14/14), root build, and public signed readback (33 checks) passed. The root unit suite completed with 526 passing and two unrelated failures in window placement and the Work Entry version expectation; authenticated Store-profile installation and live Finance workflows remain open.

Finance package tests (9/9), typecheck, Vite build, private synthetic UI checks (10/10), and public signed package/catalogue/update-policy readback (33 checks) passed. The update is available from App Store refresh/New Updates, but has not been installed into the authenticated user profile. No live clinic data or production system was changed. See [Finance release notes](dental-os_v1_working_info/milestone-17-dental-app-delivery/M17.7_FINANCE_PLAN.md) and [verification evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/VERIFICATION_EVIDENCE.md#finance-purchase-row-entry-picker-visibility-and-clean-heading--1710--2026-10-24).

## M15 local development-app collection — 2026-10-25

The M15 home screen has a source-run-only center-left grid of thumbnails and names for ten fixed first-party M17 apps. Developers use each app's existing project workflow; selecting a tile imports the bounded local `dist` into an immutable snapshot under the separate per-user `development-apps/` root and launches from that dev-only registry. Signed releases stay under `packages/` and are opened only through the dock. Their registries, runtime IDs, origins and session partitions are separate, with no Store fallback or version matching. A fixed per-app development capability grant applies while the existing broker enforces clinic identity, role and route rules. Local builds do not touch Cloudflare or local clinical data. Packaged OS builds do not expose this developer feature. The source-only development-app collection was committed locally in `8dad30be`; the Browser Preview/shared-bucket follow-up below remains local and unpushed. Root build passes, the root unit suite passes 511/511 tests, focused development-app/runtime contracts pass 8/8, and the private local-build UI flow passes 10/10 checks. See [ADR-035](dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-035--separate-source-only-development-app-lane-for-first-party-m17-apps) and [M15 evidence](dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md#local-development-app-collection-and-separate-storage--source-only-candidate--2026-10-25). M15/G15 remains open.

## M15 Browser Preview and shared Dental OS Preview bucket — 2026-10-25

Added `npm run preview:browser -- --app <id>` for per-app Vite/HMR with an isolated synthetic demo session/data bridge and network/write/native-file boundaries; added `npm run publish:development-app -- --app <id>` to build from any worktree and validate/publish an immutable snapshot into the existing OS profile's shared `development-apps/` registry. The registry lock preserves concurrent publishers' updates to different apps. The OS now reads the bucket only and supports one pinned runtime/window per catalog app; closing/reopening that app reads the newest snapshot. The signed `packages/` store and Cloudflare release workflow stay separate. Root `AGENTS.md` defines bucket reuse/create/location and requires an explicit user request before signing/bundling/publishing. The runtime layout now includes only open app windows, avoiding the previous 16-entry layout rejection. The M15 build passed after this correction. See [ADR-036](dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-036--separate-browser-and-dental-os-preview-lanes-with-a-shared-development-bucket) and the [app preview commands](tools/development-apps/README.md). Verification is recorded in the current M15 evidence section. This follow-up remains local and unpushed; no release bundle or Cloudflare publication occurred.

## Native app scrollbar overlap during resize — local source follow-up — 2026-10-25

The 15px resize gutter left the full-size captured app mirror visible behind the native app view. This could expose a duplicate scrollbar along the right edge in both dock-installed and development-grid apps. Dock interaction hides the native view and leaves the full mirror visible, so only one scrollbar remained. The shared shell now crops the mirror's right/bottom 15px only while a normal native view is visible; hidden/transitional views keep the complete mirror and fullscreen stays uncropped.

Validation on the M15 worktree: `npm run build` passed; private `npm run test:runtime-resize` passed the visible and hidden mirror-crop checks plus right, bottom, corner and fullscreen sizing. The full unit suite reported 509 passing and two failures in unchanged development-app tests that call `getBuiltApp()` before publishing a snapshot. `git diff --check` and the documentation checker pass. `/home/master-x/.local/bin/electron-os` already launches this M15 worktree and the build refreshed the outputs it uses. The live Dental OS session was not restarted; a full exit/relaunch is needed to see the update. No commit or push was made, and M15/G15 status is unchanged.

## Common default app window and clearer desktop widgets — local source follow-up — 2026-10-25

All newly opened managed apps now use the same full usable work area. The one-pixel status-bar border is included in the top offset. Windows remain resizable and remember user-sized bounds. The window traffic lights now sit at the left of the title bar with clear space before Back; the app name stays centered. The right-side desktop widgets now use a readable sans-serif stack, larger medium-weight headings and clearer App Updates rows/actions.

Root build passed. Private native resizing passed on the right, bottom, corner and fullscreen paths; the inward right/corner gestures account for the new maximum-width default. The App Updates private UI flow passed 4/4 and its inspected screenshot is `artifacts/app-updates-widget-connected.png`. Full unit tests completed 509/512; two existing development-app tests assume a build was prepublished to their registry, and one release-identity test conflicts with the already present Work Entry version edit. The broader windows test passed initial bounds checks but stops at an existing assertion for a Forward button missing from the current title bar. The M15 local launcher uses this worktree and the refreshed `dist/`/`dist-electron/`; the running OS will load it after a full launch. No commit or push was made; M15/G15 remains open.

## Native app scrollbar spacing refinement — 2026-10-25

The native app scrollbar sat too far inside the right edge because the shared WebContentsView kept a 15px strip clear for the shell's resize handlers. Reduced the runtime inset to 7px, matching the existing 7px edge handles, while retaining the 15px corner hitboxes. The common runtime path covers both signed dock apps and source-development grid apps; no app CSS or package changed.

Verification on the current M15 source: `npm run build` passed; private `npm run test:runtime-resize` passed right-edge, bottom-edge, bottom-right-corner and fullscreen checks; and the serial unit suite completed with 509 passing and 3 existing unrelated failures (2 development-app registry fixtures and 1 M17 Work Entry version assertion). The docs checker and `git diff --check` are run for this record. The launcher output was rebuilt, but the running OS was not restarted; a full launch is needed to see the closer scrollbar spacing. The work remains local; no push or M15/G15 acceptance is claimed.

## Dock-hover app-content flicker — local source follow-up — 2026-10-25

Hovering a dock icon set the shared runtime `blocked` flag, causing the OS to hide the native app surface and reveal its captured mirror while the window frame stayed still. Removed the dock-hover-only state from that gate; fullscreen dock reveal still uses its separate `peek` path. This shared-shell change applies to both signed dock apps and source-development grid apps.

Verification on the current M15 source: `npm run build` passed. The private headless `npm run test:runtime-resize` passed a new dock-hover regression check asserting that the native app remains visible and its window bounds remain unchanged, as well as the existing resize/fullscreen checks. The serial unit suite completed with 509 passing and 3 existing unrelated failures (2 development-app registry fixtures and 1 M17 Work Entry version assertion). The launcher outputs were rebuilt, but the running OS was not restarted and needs a full launch to display the fix. The work remains local; no push or M15/G15 acceptance is claimed.

## Finance purchase window Back guard — local source follow-up — 2026-10-25

Finance's module-switch lock no longer rejects the shared OS window Back action. Purchases now reports a clean new form as not dirty, reports actual edits and pending/uncertain saves as dirty, and retains draft-preserving Back from purchase confirmation to the form. This keeps the fix in Finance, consistent with the Patient Record comparison. Finance 1.7.11 was rebuilt and published as local Dental OS Preview snapshot `8af5ede8e43d5c07d50ef3fd617cafb17a7e2e979af75ce2f760d15dcd0b2860` in `/home/master-x/.config/electron-desktop-prototype/development-apps`; only Finance's registry entry was advanced. Snapshot verification read and validated its 5 files. This is not a signed package or Store install. Finance package typecheck/build and root build passed. UI tests were not run for this source follow-up. The running OS was not restarted; close and reopen Finance to load the snapshot. No commit or push occurred.

## Finance purchase review confirmation action placement — local source follow-up — 2026-10-25

Moved Confirm & Save Purchase from the review page's bottom-right area into the page header, immediately to the right of Refresh. The same header action serves invoice corrections and uncertain-write retries with the existing validation and disabled-state rules. Finance remains at source version 1.7.11; this is a local development snapshot, not a signed release or Store install. Root production build and Finance package build pass. Finance's active local snapshot is `4d37e33bc2b3985a9e2b3214e5c405b53b141862ca60ac0631ee57c332e8ae50` at `/home/master-x/.config/electron-desktop-prototype/development-apps`; readback validated its manifest, digest and five files, and the previous Finance snapshot was retained. Tests were not run. The running OS was not restarted; close and reopen Finance to load this snapshot. No commit, push or Cloudflare publication occurred.

## Desktop calendar legibility and dock caption flicker — local source follow-up — 2026-10-25

Raised the desktop Nepali and Gregorian calendar headings, weekday labels and date text from 9–13px to 12–14px, with slightly taller date cells. The dock flicker came from showing the renderer caption and the separate native caption overlay at once; the shell now keeps the renderer caption when no app window is visible and uses only the native overlay while a managed app window is visible.

`npm run build` passed on the M15 worktree. Tests were not run. The build refreshed M15's `dist/` and `dist-electron/` outputs; the live Dental OS session was left running and must be fully reopened to load them. No packaged installer, commit, push or deployment was created.

## Role-based Store, Dock and uninstall — local OS follow-up — 2026-10-25

Reception now qualifies for the Finance app family when `/v1/me` grants `patient_payments.outstanding.read`; the signed Finance app already has role-neutral app metadata and filters each module by its capability, so Reception gets Patient payments only. The existing filtered Store view also drives installed Dock entries, keeping apps hidden when the current session lacks family access while leaving their local files installed. Uninstall now checks both Store management authority and the installed package's current app-family access. Store and update-widget messages no longer imply administrator-only access. Role/capabilities continue to come from the authenticated session profile and are refreshed by the existing session flow; no additional role data is written to disk. No backend change or Finance bundle republish was needed.

Validation: `npm run build` passed; the serial root unit suite passed 513/513; focused app-policy, app-metadata, clinic-route and Store lifecycle tests passed 107/107; Finance package checks passed 11/11; documentation validation and `git diff --check` passed. The active OS was not restarted; the new host code loads on a later full launch. This source-only M15 follow-up remains local: no package publication, commit, push, deployment or M15/G15 acceptance is claimed.

## API broker integration verification — local — 2026-10-25

Integrated source commit `f81ac2c7` from `codex/api-call-tiem-out-fix` into M15 by fast-forward. Credentials keep an 8-second cap; standard host-brokered clinic API requests receive 30 seconds after credentials resolve, while explicitly classified Finance/report/list routes receive up to 60 seconds. App code cannot choose a larger timeout. Existing media/picker deadlines, bounded responses, idempotency and unknown-write-outcome behavior remain unchanged.

The M15 branch now points to `f81ac2c7`. Existing local M15 edits were restored from a retained stash; the route overlap keeps both User Management access and host-owned timeout classes, and the checklist records the integrated state. Post-integration verification passed: broker/route tests 79/79, build, root unit tests 516/516, App Explorer UI 13/13 and documentation checks. No package publication or deployment occurred.

## Admin User Management App Store release — 2026-10-25

Ported the Dental SaaS account-management workflow into the first-party `company.dental.user-management.m17` app. It is an ordinary signed Store app, not an OS core screen. The host SDK is now 1.7 with the `clinic.app.user-management` family and only four fixed `/v1/clinic/users` routes; the Store, Dock and app-family policy expose it to the current Admin session with `clinic_users.manage`, while Doctor and Reception are denied. Passwords stay in renderer memory only while submitting/reconciling and are not persisted to disk. Existing SaaS Worker capability checks, account database and Firebase identity operations remain authoritative; no backend or database change/deploy was needed.

Built and published User Management 1.0.0 to Cloudflare staging at catalogue sequence 102 using the existing M17 signer. Package SHA-256: `5fa93ced6fe960154820974e13c74922bdebcfaaa8f77e71825776a47c05b1db`; payload digest: `82bdedb8028e790f286099a7307d9d7ed4c6bdfcb72898cfbdb0251247a009bd`. App typecheck/build, OS build, docs validation and signed public readback passed; readback verified all eleven M17 packages and Admin-only host routes in 38 checks. See [M17.12 release evidence](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17.12_USER_MANAGEMENT_1.0.0_STAGING_2026-10-25.json). Automated tests and authenticated Store/live Worker account workflows were not run. The user's running OS was left intact; a full launch from the updated OS build is needed before it recognizes this new host family. No production release, commit or push was made.

## Built-in Explore app launcher — local OS follow-up — 2026-10-25

Added a permanent Explore tile to the Dock. It opens a centered glass-style sheet with the built-in App Store and Standard Window 1, plus signed apps that are installed and visible in the current Store view. The existing role-filtered view remains the source for those apps, so the sheet excludes local development apps and does not persist role data. Selecting a tile uses the existing Store/runtime launch path. The modal makes the desktop inert, pauses Dock motion, hides running native app surfaces beneath it, and restores focus and app surfaces when closed.

`npm run build` passed. The focused private UI flow passed 13/13 checks; screenshot: [Explore app sheet](artifacts/app-explorer-private.png). The root unit run passed 512/513, with the 25-app registry test exceeding its 15-second timeout under parallel load; the isolated rerun passed 1/1 in 1.28 seconds. The running OS was left untouched and needs a full launch to load the refreshed build. This local UI work does not close M15/G15. No commit, push, app publication or deployment was made.

## Finance Purchases table spacing — 1.7.12–1.7.13 — 2026-10-25

Finance 1.7.12 and 1.7.13 are published to the Cloudflare staging App Store at signed sequences 103 and 104. The Purchases table gives Supplier more width, uses two-line truncation for Invoice/Supplier/Items, and reduces Items/minimum table width so the 1366px layout has no horizontal scroll. The 1.7.13 package passed 11 Finance package tests, typecheck/build, 22 private UI checks, a focused 3/3 release-identity test, and 39-check public staging readback. Its seven-release grant window retains 1.7.7–1.7.13; minimum supported version is 1.7.7. See the [M17.7 receipts](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FINANCE_PURCHASE_LIST_1.7.12_STAGING_2026-10-25.json) and [1.7.13 purchase screenshot](artifacts/m17-finance-purchases-list-1.7.13.png). The OS was not restarted or Store-installed; authenticated Store install and live Finance workflow acceptance remain open.

## Finance Purchases column balance — 1.7.14 — 2026-10-25

Finance 1.7.14 is published to the Cloudflare staging App Store at signed sequence 105. Supplier is 20px narrower, Items is 20px wider, and item names have more width with visible padding around each `|` separator. The table minimum remains 870px. Package tests (11/11), typecheck/build, private UI (23/23), focused root identity test (3/3), and 39-check public signed readback passed. The grant window retains 1.7.8–1.7.14 and retires 1.7.7. See the [release receipt](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FINANCE_PURCHASE_LIST_1.7.14_STAGING_2026-10-25.json) and [purchase-list screenshot](artifacts/m17-finance-purchases-list-1.7.14.png). Authenticated Store install and live workflow acceptance remain open; production was not changed and the running OS was not restarted.

## Finance Purchases summary width correction — 1.7.15 — 2026-10-25

Finance 1.7.14 was already active. Its item summary still had a 145px cap, so long names used only part of the Items cell and the `|` separator could fall below the two-line clamp. Version 1.7.15 reduces Supplier from 185px to 170px, widens Items from 120px to 135px, and lets product text fill its available cell width. The table minimum stays 870px and separator spacing remains visible.

Finance 1.7.15 is published to the Cloudflare staging App Store at signed sequence 106. Package tests (11/11), typecheck/build, private UI (24/24), focused root identity test (3/3), and 39-check public signed readback passed. The grant window retains 1.7.9–1.7.15 and retires 1.7.8. See the [release receipt](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FINANCE_PURCHASE_LIST_1.7.15_STAGING_2026-10-25.json), [private UI report](artifacts/m17-finance-private-1.7.15.json), [purchase-list screenshot](artifacts/m17-finance-purchases-list-1.7.15.png), and [public readback](artifacts/m17-staging-packages-readonly-finance-1.7.15.json). Authenticated Store installation and live workflow acceptance remain open; production was not changed and the running OS was not restarted.

## Finance Purchases Items width — 1.7.16 — 2026-10-25

Finance 1.7.16 is published to the Cloudflare staging App Store at signed sequence 107. Items grows by 50px (135px to 185px); the minimum table width is 925px, and the 1366px private layout has no horizontal scroll. Package tests (11/11), typecheck/build, private UI (24/24), focused root identity test (3/3), and 39-check public readback passed. The grant window retains 1.7.10–1.7.16 and retires 1.7.9. See the [release receipt](dental-os_v1_working_info/milestone-17-dental-app-delivery/evidence/M17_FINANCE_PURCHASE_LIST_1.7.16_STAGING_2026-10-25.json), [private UI report](artifacts/m17-finance-private-1.7.16.json), [purchase-list screenshot](artifacts/m17-finance-purchases-list-1.7.16.png), and [public readback](artifacts/m17-staging-packages-readonly-2026-10-25T17-27-42.451Z.json). Authenticated Store installation and live workflow acceptance remain open; production was not changed and the running OS was not restarted.
## Revoked pending app update recovery — M15 integration — 2026-10-26

`PackageRegistry.launch()` now quarantines and clears a pending candidate that fails current package/policy checks when the active installed version remains allowed, then launches that active version. If current policy also blocks the active version, the registry preserves state and fails closed. The Store labels the rejected candidate as update recovery; it cannot be automatically redownloaded. The canonical install/update recovery contract now specifies this case. Ported from audit commit `b11a4b12`; M15/G15 acceptance remains open.

Validation on the originating audit worktree: `npm run build` and focused `tests/updates.test.ts` (72/72) passed. The full unit suite passed 517/518; its sole failure was the Appointments development-app fixture requiring the absent `apps/dental-apps/company.dental.appointments.m17/dist`. The private `npm run test:updates` runner timed out before reaching update assertions. These results predate integration onto the newer M15 source; combined-source checks are recorded after integration.

## Clinic workspace role switching — M15 — 2026-10-26

The OS status-bar **Switch role** menu uses the authenticated Worker profile. Admin can choose Admin, Doctor or Reception; Doctor and Reception can switch between their own workspaces. Before an Admin first leaves Admin, they create and confirm a custom four-digit PIN; the Worker requires it to return. No fixed/default `1111` PIN exists, and the OS does not persist the entered PIN or a locally authoritative role. Session actions stay accessible from the status-bar menu with app windows open. A transition warns that running apps close and unfinished local work can be lost, refuses while clinic writes are pending/uncertain, clears old app runtimes/capabilities and re-resolves `/v1/me` under a new session generation.

The matching backend and additive Control D1 migration were pushed to `cloudfare-staging` in `dental-saas` commit `485c32dae2bfcaec9a2ee314110d3f6013083dd0`; Cloudflare staging deploy run [40262959186](https://github.com/Business-It-Partners/dental-saas/actions/runs/40262959186) succeeded. The OS implementation is commit `6f6c7efd` on `codex/milestone-15`.

Validation: root build passed; the full serial unit suite passed 524/524 across 36 files; focused identity/session/API tests passed 26/26; private identity UI passed 62/62, including Doctor↔Reception, custom Admin PIN setup, wrong-PIN denial, PIN-gated return to Admin, old-session/runtime invalidation and credential-profile scan. The first UI run exposed that the clinic desktop card was covered by the active app surface; Sign out and other session actions moved into the always-visible Switch role menu and the clean rerun passed. `python3 tools/check-dental-docs.py` passed (24 architecture documents, 20 milestones, 80 required milestone files, zero errors); `git diff --check` passed. Authenticated live staging switching remains unverified because no clinic test credentials were available. The user’s running OS was not restarted; a full launch is needed to load the refreshed host build. M15/G15 remain open.
