# M16 — Codex native-drag and physical-device acceptance handoff

**Date:** 2026-10-22. **Status:** user-deferred follow-up AFTER M16.6 hosted integration. **Milestone:** M16/G16 still OPEN.
**Branch:** `codex/milestone-16`.
**Exact latest runtime-tested implementation:** `772a739ed3af3be4fd678f7ebd68baeceef2f954`; [Actions 39785068605](https://github.com/Business-It-Partners/dental-os/actions/runs/39785068605), Windows/Linux success.
**Evidence:** [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). **Contract:** [ARCHITECTURE.md](ARCHITECTURE.md). **Scope:** [PLAN.md](PLAN.md).

## 1. Do not assume this is already certified

The M16.6 hosted work is complete, but Linux/Windows runner GUIs are synthetic disposable test displays. They are not the user's actual desktop, a real clinic or supported installer. Dragging a file from Files across isolated Electron `WebContentsView` surfaces has **never been implemented or verified**. The supported transfer is the trusted Files **Send to active eligible app** button. Receipt transfer delivers metadata only; no file bytes, Cloudflare upload, patient association, local mutation or clinical record save is authorized here.

## 2. First follow-up: native cross-view drag/drop feasibility and implementation

- [ ] At a fresh branch/source review, inspect Electron `WebContentsView` bounds, native pointer/drop routing, Files shell, last-active recipient binding, permission ceiling, pending file receipt and managed-window focus/dirty states.
- [ ] Design an OS-owned **genuine drop-target attestation** that binds an authentic pointer drag and destination to precisely one authorized currently running signed app. React shell hit-testing, renderer-chosen IDs, arbitrary `webContents.startDrag` and app DOM `drop` events alone are **not** proof of safe cross-view transfer.
- [ ] Reuse narrow metadata-only single-recipient receipt, revocation and ACK flows; enforce drop-outside, app replacement/update, wrong receiver, modal/dirty/unknown-write, focus movement and cancellation denial. Do not create a general app messaging bus.
- [ ] If native routing cannot be proven safe on chosen supported OS hosts, preserve explicit Send, document a reviewed **drag scope/gate decision**, and never fake acceptance. Native drag must be implemented/accepted or formally deferred as an explicit remaining-risk choice.
- [ ] Repeat focused unit/private GUI and Windows/Linux applicable acceptance after any new code. Preserve exact SHAs and quota-aware CI.

## 3. Then full local-device milestone walkthrough in Codex

Before running anything, note source SHA, Node/Electron versions, Windows/Linux version, CPU/RAM, display scale/compositor and the actual app/clinic session fixture. Use non-clinical test files only, with names such as `m16-synthetic-xray.png` and `notes-synthetic.pdf`. Preserve user data, app sessions and browser focus; never run private automation on the live personal display. Do not run `--files-fixtures` outside the documented guarded test harness. Prefer focused checks and run the whole test suite only when the final changed source requires it.

### A. Host/files/desktop

- [ ] Open Dental OS as a real installed/development application on the target physical OS, authenticate an authorized test clinic, and launch Files from dock.
- [ ] Browse actual consented Home/Documents/Downloads/Pictures locations and accessible mounted volumes; validate pagination, sort, breadcrumb/back/forward/up/refresh and readable large-folder/permission-error states.
- [ ] Confirm symlinks, junctions, changed/removed files, unreadable/offline folders and changing/removable volumes fail safely; no arbitrary path input, raw byte read, rename, delete or upload controls.
- [ ] Exercise keyboard-only navigation and focus indicators, screen-reader labels/ARIA, Escape/Cancel, modal focus and full-screen presentation; test native picker parent stays above the OS window, including minimize/restore and relevant multiple-monitor behavior.
- [ ] Test Files minimize/Genie, privacy-preserving overview, dock reopen, resize, host focus and workspace transitions. Avoid capturing/showing filenames in diagnostic screenshots.

### B. Signed application, transfer and lifecycle

- [ ] Launch an approved **company-signed local.files.pick** app and a noneligible/older app with synthetic test permissions. Verify only the eligible app can request a custom/native picker and receive Files Send metadata.
- [ ] Select one and multiple allowed test files (up to 10), use native/custom pickers and explicit Send. Verify exact selected names/count, opaque receipt IDs and that the app does **not** receive a path/byte handle or report an uploaded/saved patient record.
- [ ] Confirm transfer to wrong/closed/unsubscribed/app-updated/app-switched recipient is refused, and dropping outside/into wrong native window is denied if drag is actually implemented.
- [ ] Simulate dirty/modal/unsafe-write state, rejected ACK, app crash/restart, timeout, package permission revocation, logout and new clinic login; confirm prior selections do not revive after re-grant/session switch.
- [ ] Stress benign workloads: repeated Files browse/picker/Send/cancel, directory pagination and bounded resource growth; observe memory/CPU, handle retention and graceful no-permission or full-disk error handling.

### C. Sign-off and evidence

- [ ] Record each case's PASS/FAIL/BLOCKED result, actual OS/device, source SHA, reproducible steps, severity and the minimum privacy-safe evidence.
- [ ] Fix and rerun failing cases before claiming G16. Do not merge `codex/milestone-16` into `main` on M16.6 hosted evidence alone.
- [ ] Review every G16 row in [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md); agree explicitly whether drag is accepted, further deferred with gate decision or blocking.
- [ ] Close G16 and merge only when the actual acceptance agreement and code-backed evidence support it; preserve M20 Windows/Linux installer/operations and G21 final product acceptance as separate future gates.

**Work pattern:** Understand → Implement → Validate → Push → Verify → Record evidence → Decide gate. One bounded task at a time; never use production patient data or promote Cloudflare production in this local-files milestone.
