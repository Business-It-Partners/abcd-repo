# M16 — Dental OS Files and Local File Acquisition Architecture

**Design baseline:** 2026-10-22. **Status:** proposed design for review; no implemented file-access claim.
**Source base:** M15 commit 9f6aab8dfb20ce296a93b5d65e3c2f7dcf9ac50d on codex/milestone-15.

## 1. Problem and product outcome

Dental OS is a fullscreen Windows/Linux clinical workspace. A dentist viewing Patient Records must be able to choose an X-ray, photograph or document on the host computer without leaving the Dental OS interface. The system must support (A) a **Files** core app launched from Dental OS dock, (B) a **Choose File** modal within a dental app, (C) a safe explicit Files-to-app transfer/drag experience and (D) a parented host-native file picker as fallback.

Dental OS is **not** building a filesystem. Actual files remain on the Windows/Linux disk and its OS access-control system. Files is a trusted read-only view over the host filesystem, not a copy of local files, cloud drive, or clinic database.

## 2. Scope and deliberate exclusions

In scope: browse user-accessible folders/volumes, list metadata, navigate, select, native/custom pickers, safe short-lived selection receipts, OS-owned Files dock/window, shell-mediated user transfer to one receiving app, errors, accessibility, focus/fullscreen and relevant Windows/Linux testing.

Out of scope: Cloudflare/R2 uploads, patient record association, re-enabling M15 deferred media uploads, SaaS/backend changes, arbitrary app-to-app messaging, a local clinical store, background indexing, clipboard monitoring, local file modification/deletion/rename/move, unbounded file reads, arbitrary app filesystem access, print/export, OS installers or third-party packages.

**File selected** is not **file uploaded**. M16 stops at acquisition and a verified recipient receipt. Existing media-upload denial remains unchanged.

## 3. Trust boundaries

| Boundary | Responsibility | Must not do |
| --- | --- | --- |
| Host Windows/Linux | Actual disks, mounts, OS permissions, native dialogs | Apply dental app authorization |
| Trusted Electron main | Enumerate allowed user locations, read safe metadata, canonicalize paths, enforce ACL/link policy, create/revoke temporary selection handles | Duplicate clinic records or persist medical bytes |
| Dental OS shell | Draw Files window, dock integration, picker modal, drag visual, window focus/hit-testing, user confirmation | Read disk directly in React |
| Sandboxed dental app | Request a typed selection from a real user gesture and receive a safe receipt | Receive raw path, Node/fs API, arbitrary URL or cross-app message |
| Dental SaaS Worker | Existing business authority (unchanged) | Handle local file discovery |

Current host Electron paths: electron/main.ts, electron/preload.ts, electron/runtime/manager.ts, electron/runtime/appPreload.ts and electron/sdk/contracts.ts. UI lives under src/ and uses existing windowManager/ManagedWindow. Actual code placement must follow the [repository ownership map](../00_REPOSITORY_STRUCTURE.md) rather than migrating the whole tree.

A **Files** core app is an OS-owned system window, not an independently shipped dental web package with unrestricted privilege. Its renderer remains sandboxed/no-Node and uses strictly controlled trusted shell-to-main IPC. Company dental apps stay independently signed, isolated WebContentsView instances.

## 4. High-level design

    Host filesystem and native dialogs
                  |
       Trusted local Files service
       * Read-only roots and listings
       * Metadata and canonical paths
       * OS permission and link safety
       * Temporary selection handles
                  |
          Dental OS shell
         /             \
    Files core UI    Custom picker
         \             /
       User-approved selection
                  |
       Shell selection coordinator
       * Verified recipient window
       * Current app/package/session
       * Explicit action and expiry
                  |
       Opaque single-recipient receipt
                  |
       Isolated dental app (e.g. Records)

This **is not a general app-to-app messaging bus**. Files communicates with the trusted shell; the shell delivers only a typed, user-authorized receipt to one already selected recipient. No arbitrary app invocation, broadcast, unscoped intents or cross-app data exchange. ADR-013/R13 remains enforced.

## 5. Two UIs, one trusted service

### Files core application

- Dock entry launches a standard managed Dental OS window, with shared maximize/minimize/restore, overview, Genie and focus semantics.
- Initial locations: Home, Desktop, Documents, Downloads, Pictures, and visible mounted removable/local drives if accessible to the current OS user. Do not crawl full disks automatically.
- File and folder list, breadcrumb/up/back/forward, sorting, file metadata, keyboard navigation, screen-reader labels and selection states.
- Read-only access; no delete/move/rename/write controls. Restricted/unavailable/removed folders render a clear error; no silent fallback to unexpected directories.
- File names, unicode and other metadata are untrusted presentation strings. Never execute/open selected files as active web content.

### OS-owned file picker

- A dental app invokes a new **local.files.pick** typed request after a clear button click (e.g. Attach X-ray), with platform-defined type categories and selection count. No caller-provided absolute folder or drive path.
- Host checks current signed/installed app, actual sender and main frame, session generation, local selection permission, fresh user gesture and recipient managed window.
- Shell opens a modal picker on top of that specific app, using the same Files service, and preserves focus, Esc/cancel and keyboard/screen reader behavior.
- **Use native picker** invokes Electron's host open-file dialog parented to the Dental OS host window. Its result follows exactly the same recipient and session validation. The fallback must open over fullscreen on Windows and Linux, without relying on visible host dock.
- Cancellation is **CANCELLED**, not a failed upload or a cancelled server write. Closing/locking destination cancels pending selection.

### Capability/grant rule

M15 signed format-2 policy grants authorize **clinic API operations**, not disk browsing. M16 must define a **distinct, versioned local selection capability** and validate it through the trusted host: verified company release, compatible SDK, platform capability ceiling, declared app permission, current session, genuine user gesture. Package metadata alone is never sufficient. Exact signed grant/metadata encoding and IPC schema are an explicit **M16.1 design approval gate**; no implementation may invent unrestricted filesystem authority.

## 6. Opaque selection receipts

A successful picker or Files-to-app transfer returns only a limited receipt:

- Opaque unpredictable identifier, safe display filename, OS-observed MIME hint/extension, size and modification metadata, plus expiry.
- Host-internal lease binds canonical path to *specific* installed app ID and release, recipient WebContents/window, session generation and explicit selection request. Absolute paths stay in trusted main memory.
- No raw absolute path, file:// URL, Node object, native handle, raw image payload, arbitrary directory listing or persistent local copy is sent to a dental app.
- Proposed receipt lifetime **10 minutes maximum**, invalidated sooner at logout, lock/session change, recipient close/crash/update/uninstall, explicit cancel, OS exit, or file replacement/change.
- Recheck underlying file identity and access on use; stale/renamed/unmounted targets fail closed. Other apps/windows cannot redeem a copied receipt.
- No persistent path/filename/cache/clinical bytes in diagnostics, app localStorage or OS state.
- An eventual upload consumer needs its own separately authorized, bounded transfer contract. M16 provides no general bytes-read SDK or upload bridge.

**Initial bounded targets to verify before implementation:** at most 200 directory entries per page, 10 selected files per user action, one picker per receiving window, no eager recursive traversal or whole-file buffering. Selection itself does not inherit remote-upload size limits; large images remain selectable as metadata. Thumbnails are optional and disabled unless a separate bounded decoder/privacy review passes.

## 7. Drag and explicit transfer

Independent app WebContentsView surfaces, inactive snapshots, overlapping managed windows and Linux Wayland drag behavior make native HTML5 drag/drop uncertain. Do not assume cross-view drag will work, and do not weaken context isolation or leak host paths to make it appear to work.

1. User selects a local item in Files and begins a drag or chooses **Send to active eligible app**.
2. Shell renders drag feedback and identifies an eligible receiving managed window; host checks package permission, session, focus and user intention.
3. Confirmed drop/Send causes an OS-owned selection receipt for exactly that recipient. Dropping elsewhere cancels without changing any other app.
4. Recipient displays the selected filename and requested attachment context, **not** uploaded/saved state.

**Mandatory fallback:** explicit Send to active eligible app must work even if native drag integration fails. Using a recipient's custom/native picker must also work independently. Never implement a generic cross-app event bus (R13). Preserve modal/dirty/unknown-write safety and shared window manager input ownership. Native startDrag integration is conditional on real private-display Linux and Windows proof.

## 8. Filesystem/identity security

- Trusted main-process only: explicit IPC operation list, sender/frame binding, strict schema, maximum response sizes, request cancellation and bounded concurrency.
- Canonicalize/validate each navigation and selection. Deny symlink, junction, reparse-point and traversal escapes in first implementation; do not use string-prefix checks as an access-control primitive. Avoid TOCTOU by revalidating metadata/access when consuming a receipt.
- Respect OS ACLs and per-user accessible paths. No hidden/system root scan by default; unsupported network drives or portal permission errors produce truthful errors, not shell-command workarounds.
- No file edit/delete/move/execute, raw filesystem API, arbitrary local URL, shell process launch, clipboard file watcher, or persistent patient cache.
- Names, paths, bytes and X-ray content must be absent from analytics/logs/support bundles; only safe action code, count, duration and redacted outcome are permitted.
- Lock/logout kills pending dialogs and receipts. App session mismatch, forged frame, stale receiver and window reassignment all deny.

Error classes planned for review: CANCELLED, FORBIDDEN, STALE_SESSION, STALE_SELECTION, NOT_FOUND, UNAVAILABLE, RESOURCE_LIMIT, IO_ERROR. SDK names/wire are not final until contract review. A file that disappears must be reselected, never silently replaced.

## 9. Cross-platform and UX proof

- Windows: Downloads/Pictures, drive letters, removable drives, unicode/long names, permissions, reparse points, parented native dialog and fullscreen/HiDPI focus.
- Linux: user folders, mounts, symlink refusal, Wayland/X11 display differences, native dialog/portal and removable media.
- OS windows: File app, picker and recipient app preserve global dock, focus, overview, minimize/restore, keyboard shortcuts and reduced-motion behavior.
- Negative tests: forged IPC, non-user-gesture picker, unapproved app, mismatched version/session, expired receipt, renamed/replaced file, denied paths, symlinks, many directory entries, external drop, modal race, app restart, and diagnostics redaction.

## 10. Acceptance and design gates

**G16** proves actual local read-only browsing; custom picker; parented native fallback; destination-scoped safe receipt into an isolated approved app; drag where feasible **plus always-working explicit transfer fallback**; private Linux runtime; hosted Windows applicable checks; revocation, accessibility, failure and resource tests. This gate **does not** authorize media upload or clinical record association.

Before coding, M16.1 must settle the exact typed SDK/grant encoding and user-gesture evidence, host service ownership, path/lease policy, fullscreen native picker behavior and the precise isolation-preserving Files-to-app transfer path. Record architectural changes in [ADR register](../../dental-os_v1-documentation/20_V1_ADR_REGISTER.md), never as unnoticed patches. Then follow [M16 implementation plan](PLAN.md).

Governing requirements: [V1 architecture](../../dental-os_v1-documentation/00_V1_README.md), [invariants](../../dental-os_v1-documentation/03_V1_PRINCIPLES_AND_INVARIANTS.md), [SDK security](../../dental-os_v1-documentation/11_V1_SDK_AND_API_BROKER.md), [host/runtime isolation](../../dental-os_v1-documentation/07_V1_APP_RUNTIME_AND_ISOLATION.md). This document is the **scoped M16 technical source of truth**; when it conflicts with an established invariant, stop and resolve the ADR before implementing.
