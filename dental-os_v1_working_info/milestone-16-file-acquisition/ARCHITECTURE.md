# M16 — Dental OS Files and Local File Acquisition Architecture

**Design baseline:** 2026-10-22. **Current status:** M16.1–M16.6 hosted engineering is complete on tested source `772a739ed3af3be4fd678f7ebd68baeceef2f954`. Source review formally defers native cross-WebContentsView drag because this runtime cannot attest the real drop target while preserving its one-visible-native-input-surface invariant. Explicit Send remains the verified fallback. Physical-device verification is not run; G16 remains **OPEN**.
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
- Image-first grid by default with an optional detail list, breadcrumb/up/back/forward, sorting, file metadata, keyboard navigation, screen-reader labels and selection states. Folders use folder icons; non-picture files use file-type icons; supported picture files may show the bounded thumbnail described in §16.
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

**Initial bounded targets to verify before implementation:** at most 200 directory entries per page, 10 selected files per user action, one picker per receiving window, no eager recursive traversal or unbounded whole-file buffering for selection/transfer. Selection itself does not inherit remote-upload size limits; large images remain selectable as metadata. A separate bounded, shell-only raster-thumbnail contract was implemented in the post-closeout Files UI follow-up (§16); these transient previews are never returned to an app.

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

## 11. M16.1 resolved host/SDK contract — implementation authority (2026-10-22)

This section settles the previously open M16.1 contract choices after reviewing the actual M15 Electron source and package/security policy. It is **approved design**, not implemented functionality; SDK version, local filesystem I/O and UI code are unchanged on this branch.

### 11.1 Permission encoding and version compatibility

**Choose a new named operation** `local.files.pick` (SDK 1.5 candidate, major version remains 1). It is a **local OS operation**, not an entry in `apiOperations`, not a SaaS request, and not a `native.intent` print/export variant.

A dental app is eligible only if all these checks succeed at request time, at picker completion and before any later receipt consumption:

1. Active verified `company.*` package manifest explicitly declares `local.files.pick` in its signed `capabilities`.
2. Current **company-signed, fresh** update-policy app entry permits that same capability; the shipped `appTrust` capability ceiling also permits it. No unsigned per-app self-grant or generic local FS capability is accepted.
3. `PackageRegistry.assertAllowed(lease)` still succeeds for the exact running package; current release, policy and revocation remain applicable. A newly signed app-only package can opt into the already shipped operation only with company approval and an eligible installed host.
4. Current clinic session is active, app-family access passes the existing `appAllowed`/role/capability policy, generation matches and the verified foreground recipient window is eligible. Add **explicit** local-files authorization; `SessionManager.allowed`'s general local-operation default must never be used as the entire grant.
5. Main-process caller, main frame, expected verified origin, connection, version and request ID all match the registered app and platform SDK. No handoff on stale or hidden/unavailable app surfaces.

**Signing clarification:** The update policy already contains a signed *app-level capability list* in both supported formats; that list plus the signed package manifest and shipped company ceiling are the selected local grant mechanism. Release-specific `format: 2` `apiOperations` grants remain **solely for clinic APIs**, unchanged. Because a package must already have declared the new capability and pass the registry guard, an update to company policy cannot endow an older package that never declared it. No policy schema v3, extra signing root or backend deployment is required merely for selection. A local grant does not enable deferred `clinic.media.upload`.

SDK compatibility: add `local.files.pick` to the closed `operations` set, update strict request/response validators and bump SDK minor only during implementation. Older hosts reject unrecognized operations; existing app-only releases continue to work without requesting the capability. Do not add `files.read`, `files.write`, `filesystem.path`, or a generic URL adapter.

### 11.2 Candidate typed wire, now fixed for M16 implementation

An isolated dental app requests through **existing** `dentalApp.request` → `sdk:request` → registered `ApiBroker` routing. Do not introduce a second app-visible IPC bridge or permit the renderer to invoke `files:*` channels directly.

```ts
// App-to-host local operation (proposed SDK 1.5 shape).
operation: 'local.files.pick'
input: {
  purpose: 'patient-attachment' | 'lab-attachment' | 'staff-document' | 'general';
  fileTypes: 'images' | 'medical-images' | 'documents' | 'all';
  maxSelections: number; // integer 1..10
}

// Successful result: bounded metadata ONLY.
value: {
  selectionId: string;       // opaque request/recipient-bound ID
  files: Array<{
    receiptId: string;       // individually opaque, never a host path
    name: string;            // display only; never diagnostic output
    sizeBytes: number;
    modifiedAt: number | null;
    typeHint: string;        // untrusted extension/MIME hint
  }>;
  expiresAt: number;         // <= 10 minutes after selection
}
```

The app cannot set directory paths, destination app/window ID, opaque handle, OS dialog flags or authorization claims in the request. `purpose` and `fileTypes` choose UX filters, **not** clinic upload permission or trusted content classification. The OS retains authority over picker type, selected count and native fallback. An empty/cancelled selection returns `CANCELLED`; no receipt exists.

`ApiBroker.execute` currently treats non-network local operations synchronously. Implementation must route `local.files.pick` to an **awaited, abortable, injected trusted FileSelectionCoordinator**, keeping normal session/pending-request accounting. It must not route via existing web `Transport`, send credentials, or create a network write. Recheck registered caller and current policy both before displaying and before issuing results.

### 11.3 User gesture, focus, and OS-owned consent

Do **not** trust `{gesture:true}`, a renderer timestamp, `appId`, an invented button selector or any renderer-provided nonce. The platform-owned **isolated application preload** observes genuine DOM pointer or keyboard activation in capture phase (only `event.isTrusted`, active/focused main frame). It notifies main on a narrow private channel; main records a single-use, receiver-bound recent-activation ticket. A pick request requires such a ticket within **750 ms**, consumes it atomically, and is rate-limited to one live picker per receiving managed window. App script may request the public SDK operation, but cannot mint a trusted activation ticket directly.

Activation freshness **does not replace explicit OS-level choice**: the selected path is granted only after the user confirms the platform-owned custom modal or the native dialog. Malicious first-party renderer scripts must not silently select/open/scan local files. Main controls the picker window/shell request; it must not take unrestricted requests for file listings from dental renderers.

For a shell-owned Files **Send to active eligible app** action, the shell asks trusted main to validate the exact currently designated receiving app/window. Never use app-supplied destination IDs. Files and picker can use private shell-only `files:roots`, `files:list`, `files:choose` IPC with `isShell(event)`, current generation and strict bounded schemas. This is **not** an app-facing file API.

### 11.4 Read-only host adapter and native fallback

Use a single trusted main-process `LocalFileService` for both custom Files and picker. Root listing returns **opaque directory IDs**, user-facing labels and page cursors; React sees no absolute canonical path. Main maps IDs to internally canonicalized locations and bounded `lstat`/opened-handle metadata. Initial custom browsing roots are existing accessible user folders and permitted mounted volumes. All listing results are capped (200/page), sorted deterministically, and do not traverse directories recursively.

Main validates component-by-component path traversal, symlink/junction/reparse-point, device file and directory escape; when a safe race-free open cannot be established on a host, **deny** rather than infer safety from string prefixes. Revalidate file identity/ACLs on selection and again on any future read; OS access may change. Use worker/bounded I/O if real large directories block the Electron event loop.

The native fallback calls **`dialog.showOpenDialog(hostWindow, {properties:['openFile', ...]})`** in Electron main, without `openDirectory` mixed with `openFile` on Windows/Linux, and without renderer-chosen paths. The actual human-approved native selection may originate outside the custom browser's roots (e.g. removable drive or network share). Treat it as an **explicit one-file grant only**, never authorization for recursive browsing of its parent. Revalidate type/ACL/link safety before making a receipt; fail closed if portable path/handle safety cannot be achieved. Parent to Dental OS's real BrowserWindow and verify native dialog remains above fullscreen under Windows/Linux/Wayland/portal modes.

### 11.5 File receipt lifecycle and drag integration

Trusted main holds one in-memory selection registry. Receipt binds: original host-resolved file identity, exact verified running release, recipient `WebContents` + main frame, managed-window ID, session generation, request ID, selection purpose and maximum 10-minute expiry. Return only display metadata to the app, keep host absolute paths private. Deny copying a receipt to another frame/app/version/window. Explicit cancel, app crash/close, lock/logout, generation change, update/uninstall, timeout, file replacement/rename or OS exit **revokes** the handle.

Selected receipts are not a new clinical file cache or general-purpose read capability. File bytes cannot be consumed until a **separate later authorized consumer contract** exists; no upload transition is performed in M16. OS Files-to-app transfer uses the same receipt generator, and requires shell hit-test/recipient eligibility plus a user-controlled drop or **Send** confirmation. Generic app-to-app messaging remains disallowed.

Because native `WebContentsView` stacking and input behavior are not equivalent to a single DOM tree, M16.5 must prototype trusted shell drag hit-testing and restore native view visibility after cancel/drop. Treat `webContents.startDrag` as an OS-native drag primitive, **not** proof of safe drag between two isolated app views. The explicit Send fallback is a required passing feature even if cross-view drag cannot be made safe.

### 11.6 Source ownership and verification map

| Contract | Implement where | Focused gate |
| --- | --- | --- |
| Closed operation/SDK minor and payload schema | `electron/sdk/contracts.ts`, `electron/runtime/appPreload.ts` | forged/non-gesture request rejected; unknown input rejected; older host compatibility |
| Signed capability and active-session authorization | `electron/packages/registry.ts`, signed policy resolver, `electron/identity/session.ts`, `electron/sdk/broker.ts` | manifest/policy/ceiling/clinic/session negatives |
| Native read-only filesystem and receipts | new `electron/host/localFiles.ts` and a small main IPC integration | traversal/link/race/mount/expiry/privacy/bounds |
| Picker routing and lifecycle | `electron/runtime/manager.ts` and trusted shell/preload | cancellation, close, logout, update, stale result, fullscreen parent |
| Files UI and shell-owned drag/send | `src/` window/dock integrations, reuse `ManagedWindow` | keyboard/focus/overview/Genie and explicit Send fallback |
| CI regression | focused host/security tests, private UI and applicable Windows suite | exact-source proof; no automatic backend or media-upload test |

**Architecture review result:** the listed encoding, request envelope, consent flow, host-only path model and fallback are selected for M16.2–M16.5 implementation. This resolves the contract-choice checkbox in the plan; it is not a claim that any of these mechanisms were implemented or tested.

## 12. M16.3 Files core-window integration and privacy contract (2026-10-22)

- Files is an **OS-owned, always-present static window** (window ID `files`), not an installable dental app package. Its dock icon is available independent of the Store; it shares the ordinary managed-window minimize, maximize, focus, resize, close, overview and dock restoration lifecycle.
- File browsing passes exclusively through `files:roots` and `files:list` exposed by the **trusted desktop shell preload**. Electron main must validate the exact host BrowserWindow main frame (`isShell`), active clinic session and expected generation. The listing schema is closed: opaque directory ID, optional opaque cursor, integer limit 1–200 and session generation. No renderer-provided path, app ID, file byte or arbitrary native invoke.
- The isolated company application preload and `ApiBroker` are unchanged by this phase. In particular, `local.files.pick` remains **unimplemented** until M16.4; the M16.2 receipt generator is not exposed to the Files UI for app transfer in M16.3.
- The Files UI presents roots, folder breadcrumbs, back/forward/up, refresh, paged metadata-only listings, sorting for loaded rows, keyboard selection, meaningful access errors and read-only status. It must not provide delete, move, rename, file preview execution, external document open or background full-disk enumeration. Actual local files remain on the host.
- **Sensitive display rule:** the standard window overview and Genie snapshot pipeline would otherwise copy visible file names. For Files only, minimized preview/Genie animation uses a fixed non-clinical SVG and the overview uses a static privacy card. No local file names or thumbnails are embedded into captured previews, persisted OS state or diagnostics.
- Automated UI validation must run on a **private display** with a synthetic user-data root behind `--files-fixtures`. The flag is ignored for normal desktops; staged clinic credentials, clinical files, Cloudflare/R2 uploads, and production assets are not used.
- M16.3 code completion does not itself imply G16 acceptance or M16.4 picker usability. The M16.3 evidence must distinguish unit/build verification from actual Linux/Windows GUI proof, and explicitly track unavailable private-display tooling.


## 13. M16.5 implemented host-mediated Files-to-app transfer contract (2026-10-22)

A clinician selects 1–10 files in the trusted Files window and presses **Send to active eligible app**. The shell supplies opaque Files entry IDs and its live session generation; **no renderer may choose a destination app, filename path, host location, or transfer scope**. A short-lived trusted-activation ticket in the sandboxed shell preload and main-frame check gate the Send IPC. Electron main resolves the **last native active app surface** from its own one-visible-view layout state, never a renderer-supplied app ID. Files must remain foreground, and the previous native recipient must still be running, connected, ready, registered for delivery, eligible for its clinic family, and independently authorized by the package's signed `local.files.pick` ceiling and current clinic-session rights. Modal/dirty/pending-write apps cannot receive. A missing/closed/unsubscribed/stale recipient fails closed.

The **single destination** is bound through the existing `LocalFileService.select` and `FileRecipient` to exact receiving WebContents/main frame, window ID, signed app ID and version, generation and a new host-generated request ID. `FileTransferCoordinator` delivers only `{transferId,selection:{selectionId,files:[{receiptId,name,sizeBytes,modifiedAt,typeHint}],expiresAt}}` through the **narrow dedicated** `runtime:file-transfer` IPC, not a generic cross-app message bus. The isolated preload validates the full shape, invokes a registered `dentalApp.onFilesReceived` listener, and sends a typed acknowledgement over a separate narrow channel. Main rechecks authorization and on-disk file identity before accepting an acknowledgement. A missing/negative response, changed file, timeout (4 seconds), recipient close/crash, session change or revoked permission rejects the handoff and invalidates the pending grant. The revocation hardening removes the receiving WebContents leases even if the owner is no longer authorized to cancel them by normal receipt authority.

**Acceptance choice:** raw OS-native cross-`WebContentsView` drag was not safely demonstrated on supported hosts; no `startDrag` payload or app DOM drop access is enabled. The secure explicit Send fallback is the accepted M16.5 transfer mechanism. Last-active-native-view routing is a deterministic recipient choice for **Send**, not evidence of secure drag hit-testing. M16.6 must decide whether the unsupported native gesture is explicitly deferred or receives additional dedicated proof; do not claim native drag acceptance from the Send checks.

**No byte-reading consumer or data persistence is created by this transfer.** The SDK receives display metadata only. No arbitrary filesystem access, Cloudflare/R2 upload, patient-record association, API transport, production deployment or real clinical files are involved. Source revision `9425e0180088bc76041035a4e539e86ac73ec069` was checked in [targeted CI](https://github.com/Business-It-Partners/dental-os/actions/runs/39781678031) (Windows synthetic hosted UI and separate Linux private X11 UI); the prior M16.4 private Wayland verification remains its own baseline. Full G16 acceptance awaits M16.6.

## 14. M16.6 engineering closeout versus G16 final acceptance (2026-10-22)

The OS-mediated Files/picker/explicit Send design remains unchanged by M16.6. The Files browser instance is keyed by current clinic session generation, so obsolete local folder selection/history state is discarded when the trusted host invalidates its per-session handles. Integrated signed-app isolation and no-gesture refusal are now hosted GUI-verified on Windows and Linux synthetic displays, alongside prior receipt/authority unit evidence. Tested source: `772a739ed3af3be4fd678f7ebd68baeceef2f954`, [successful hosted CI](https://github.com/Business-It-Partners/dental-os/actions/runs/39785068605).

Native cross-isolated-view drag/drop is **not implemented**; no OS-owned hit-testing may be inferred from the explicit Send fallback. The user requested a follow-up source review and device verification after the M16.6 hosted engineering closeout. The review outcome and current-runtime deferral are recorded in §15; the physical-device walkthrough remains NOT RUN. **G16 cannot be marked fully accepted on the hosted evidence alone.** Physical G21 release acceptance remains a separately governed later gate. See [DEVICE_ACCEPTANCE_HANDOFF.md](DEVICE_ACCEPTANCE_HANDOFF.md).

## 15. Native cross-WebContentsView drag feasibility review — 2026-10-22

**Reviewed source:** latest branch/documentation head `ad3e4bc0ed24fd11902693a0e34205716834f755`; latest runtime-tested implementation `772a739ed3af3be4fd678f7ebd68baeceef2f954`. This is a source/API feasibility review, not a successful drag test.

The current runtime renders Files in the shell `BrowserWindow` renderer and managed company apps in separate `WebContentsView`s. `RuntimeFixtures` marks a native app surface visible only when it is the front app, and `FixtureRuntime` hides the other views. The native layout parser rejects more than one visible input surface. Therefore, when Files is foreground, the destination app view is hidden and cannot attest a genuine OS-delivered drop. Shell React bounds or DOM hit-testing would not prove which native target received the pointer. Electron's `webContents.startDrag` starts a native drag using host file paths; that API does not establish a trusted inbound target and is not suitable evidence for secure Files-to-app delivery.

**Decision:** formally defer native cross-view drag for this runtime. No drag payload, host path, or drag-specific IPC was added; recipient authorization, signed `local.files.pick` policy, sandbox isolation, metadata-only app receipts, revocation/ACK checks, and the explicit Send confirmation remain unchanged. The later Files gallery follow-up adds only a distinct trusted-shell thumbnail channel as specified in §16; it does not enable app reads. The existing Files **Send to active eligible app** path is the supported transfer feature and retains hosted source-bound verification. This deferral is an unresolved G16 acceptance item, not a pass or a waiver.

Reconsider drag only with a reviewed architecture that can attest one exact native recipient while safely handling simultaneous surface visibility/stacking and input ownership, plus updated threat analysis and real Windows/Linux proof. Preserve the signed-release/session/frame binding, no-path/no-byte boundary, single-recipient receipt and explicit Send fallback. Do not infer drag acceptance from Send or hosted synthetic UI tests.

## 16. Files picture-thumbnail and icon contract — post-closeout UI follow-up (2026-10-22)

The Files window serves as a safe source browser for choosing local pictures and documents for first-party Dental OS apps. Its grid uses folder icons for directories and type icons for ordinary files such as PDFs. Supported common raster picture formats (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.bmp`) show small thumbnails in the grid. Unsupported picture formats such as TIFF and DICOM keep a picture-type icon. The optional detail-list view uses file-type icons and metadata. Dot-prefixed entries are hidden from the normal listing. Selecting or double-clicking a file does not open, execute, upload or attach it; existing explicit Send/picker behavior is unchanged.

Thumbnail reads are narrowly scoped to the trusted shell and opaque file IDs. Main verifies the current workspace generation and shell sender, refuses hidden/unsupported files, opens only a regular in-root file without following a final symlink where supported, caps source reads at **16 MiB**, and rechecks file identity around the descriptor read. The sandboxed shell renderer validates the extension/header pair, caps dimensions at **20,000 per side** and **25 million pixels**, decodes to at most **256 × 192**, and emits a transient preview of at most **256 KiB**. At most two thumbnail reads run concurrently; previews load as cards approach the viewport. File bytes never enter the dental-app preload/SDK, receipt registry, upload path, persistent cache, diagnostics, overview or minimized/Genie snapshots. A hidden/unsupported/invalid/oversized image keeps its ordinary icon. The user must still select a file and use the previously authorized picker or explicit Send flow to pass metadata to one eligible app.

The local Files UI check uses synthetic PNG/PDF/folder fixtures, confirms the hidden synthetic file is omitted, confirms ordinary folder/document icons remain visible, and decodes an 8 × 8 synthetic PNG to verify the thumbnail. Hosted Windows/Linux checks add the same bounded PNG rendering assertion. These checks establish UI behavior on private test displays only; they do not replace physical-device G16 verification or alter the native-drag deferral.

## 16. OS-managed Image Viewer — M16 follow-up (2026-10-22)

- Files **single click** remains selection; double-click on a directory navigates as before. Double-click on `.png/.jpg/.jpeg/.webp/.gif/.bmp` in the ordinary, non-picker Files browser opens the private **Image Viewer** managed window. Nonraster formats (including TIFF/DICOM) keep their existing Files icons; unsupported documents retain their prior behavior. The viewer opens above Files without closing it, displays a fit-to-window static picture, zoom, rotation and prev/next over the supported opaque IDs *already loaded in that directory*. At zoom above 100%, primary-mouse dragging pans the image within bounds that keep the visible viewport covered; fit, rotation, image changes and viewer resizing clear or reclamp the pan. This is not an OS external image-app launch.
- The window is registered in the **shared shell window reducer/controller** with focus, drag, resize, maximize/restore and close behavior. It is deliberately excluded from app dock launchers and overview cards; its minimize control is hidden because there is no safe viewer dock-restoration surface. There is no viewer snapshot, overview clone, dock screenshot or Genie preview. Files itself retains its existing redacted minimized artwork and overview placeholder.
- Only the sandboxed, context-isolated **trusted OS main frame** has `files:viewer-open`, `files:viewer-step`, `files:viewer-close`. Requests are exact-shape and session-generation bound. Open accepts *only opaque directory and file IDs*, selected ID and bounded current-list order (max 2048); it never accepts a host pathname or an arbitrary app-provided URL. Electron main stores a randomized viewer session, source sender/frame and immutable ordered identity; navigation and close recheck session ID, sender, frame and generation.
- The host file adapter refuses symlinks/reparse-path escapes and unsupported extensions, checks all siblings belong to the selected directory, fingerprints file metadata at listing, and verifies identity before and after bounded descriptor reads. Maximum encoded source is 16 MiB; image header validation limits raster dimensions to 20,000 per axis and 25 million pixels. The renderer decodes just one frame, rejects dimension mismatches, draws directly to a canvas bounded to 4 million pixels, and zeros original IPC/payload buffers. Direct canvas rendering avoids object-URL lifetime failures and exposes no file path or source metadata to the viewer. Corrupt, changed, removed, oversized or inaccessible pictures fail closed.
- Image bytes remain in the shell, and no viewer IPC is added to signed Dental app preloads or SDK contracts. While a viewer session is active, the Electron main screenshot endpoint refuses capture even for other shell windows, preventing background snapshots from accidentally including this private overlay. Session change invalidates the host handles and viewer session, and the UI clears its image and closes.
- **Acceptance boundary:** unit/host tests and targeted Windows synthetic GUI checks are required on exact final source, followed by separate user physical-device inspection; no production patient files or credentials. The viewer itself does not advance native drag, backend upload, byte handoff to Dental apps, or G16 clinical acceptance.
# V1 scope note — 2026-10-24

The product owner later directed that V1 use the host operating system's native file chooser for app file selection. The in-house Files browser, shell Image Viewer and cross-app Send flow described below are historical M16 design/evidence and are removed from the active M15 source. Work Entry may handle device-file drops inside its own imaging drop zone. See the current V1 boundary in [the product contract](../../dental-os_v1-documentation/01_WHY_DENTAL_OS.md) and the current implementation record in [global status](../00_V1_STATUS.md).
