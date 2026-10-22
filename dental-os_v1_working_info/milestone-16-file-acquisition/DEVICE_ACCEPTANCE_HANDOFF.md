# M16 — Codex native-drag and physical-device acceptance handoff

**Date:** 2026-10-22. **Status:** Codex continuation in progress after M16.6; native drag feasibility reviewed and formally deferred for the current runtime; physical-device walkthrough NOT RUN. **Milestone:** M16/G16 still OPEN.
**Branch:** `codex/milestone-16`.
**Exact latest runtime-tested implementation:** `772a739ed3af3be4fd678f7ebd68baeceef2f954`; [Actions 39785068605](https://github.com/Business-It-Partners/dental-os/actions/runs/39785068605), Windows/Linux success.
**Evidence:** [VERIFICATION_EVIDENCE.md](VERIFICATION_EVIDENCE.md). **Contract:** [ARCHITECTURE.md](ARCHITECTURE.md). **Scope:** [PLAN.md](PLAN.md).

## 1. Do not assume this is already certified

The M16.6 hosted work is complete, but Linux/Windows runner GUIs are synthetic disposable test displays. They are not the user's actual desktop, a real clinic or supported installer. Dragging a file from Files across isolated Electron `WebContentsView` surfaces has **never been implemented or verified**. The supported transfer is the trusted Files **Send to active eligible app** button. Receipt transfer delivers metadata only; no file bytes, Cloudflare upload, patient association, local mutation or clinical record save is authorized here.

## 2. First follow-up: native cross-view drag/drop feasibility and implementation

- [x] On the fresh `ad3e4bc0ed24fd11902693a0e34205716834f755` branch head, inspect Electron `WebContentsView` ownership/visibility, Files shell, recipient binding, policy ceiling, receipt flow and managed-window focus/dirty rules. Findings are recorded in [ARCHITECTURE.md §15](ARCHITECTURE.md#15-native-cross-webcontentsview-drag-feasibility-review--2026-10-22).
- [x] Evaluate genuine OS drop-target attestation. The one-visible-native-input-surface layout hides the recipient while Files is foreground; React hit-testing and `webContents.startDrag` cannot attest the real recipient. Decision: formally defer drag in this runtime; do not add untrusted routing.
- [x] Review the existing narrow metadata-only receipt, recipient authorization, revocation and ACK path. Leave it and the explicit Send confirmation unchanged; no generic app messaging bus was added.
- [x] Record that native drag is an unresolved G16 item, not a test pass or gate waiver. Any future drag work requires a separately reviewed architecture and cross-platform proof.
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
- [ ] Close G16 only when the agreed criteria and code-backed evidence support it; preserve M20 Windows/Linux installer/operations and G21 final product acceptance as separate future gates. The user will merge `codex/milestone-16` to `main` manually.

**Codex continuation record (2026-10-22):** Latest branch head confirmed before edits: `ad3e4bc0ed24fd11902693a0e34205716834f755`. Latest hosted-runtime-tested source: `772a739ed3af3be4fd678f7ebd68baeceef2f954`, Actions `39785068605`. Native drag feasibility review is complete; no drag implementation or runtime test was performed. The physical-device walkthrough is **NOT RUN**: this checkout shares the user's active Ubuntu desktop, repo instructions prohibit automated UI on that live display and prohibit focusing/restarting the running Dental OS, and no separate user-controlled Dental OS/test-clinic session was available to exercise. No Dental OS window was opened/focused, no `--files-fixtures` mode was launched, and no user or clinic files were opened, changed, or created. The hosted tests above remain synthetic and are not physical-device evidence.

Preflight environment snapshot only (not a physical acceptance run): Ubuntu 22.04.5 LTS, kernel `6.8.0-111-generic`, x86_64; Node `v22.13.1`, npm `10.9.2`; `uptime` at 2026-10-22 19:38 local reported load averages `0.78, 1.08, 0.91`; memory `11 GiB` total, `3.8 GiB` available; swap `16 GiB` total, `1.5 GiB` used. Physical target identity, display scale/compositor, Dental OS build/session and fixture package were not established. No build, test suite or GitHub Actions run was started for this documentation-only review.

All physical cases in sections 3.A–3.C remain **NOT RUN / pending**, including host folder/volume behavior, picker/focus, keyboard/accessibility/overview, signed-recipient and Send lifecycle, revocation/session-switch, and bounded-resource observation. Safe synthetic fixtures are still required for a separate user-controlled device session. No clinical files or credentials should be used. The user will perform any merge to `main` manually; this continuation does not merge or modify `main`.

**Work pattern:** Understand → Implement → Validate → Push → Verify → Record evidence → Decide gate. One bounded task at a time; never use production patient data or promote Cloudflare production in this local-files milestone.
