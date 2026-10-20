# Dental OS — App Runtime and Isolation

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Apps execute outside the shell JavaScript context in independently managed sandboxed webContents with app-specific origins and session partitions. Node integration is disabled, context isolation enabled, navigation/new windows controlled, and default permissions denied.

A platform-owned preload exposes a narrow SDK. Bind the sender webContents/frame to its verified installed app/version and current session generation. Reject unknown senders, unexpected subframes, forged identities, stale connections, oversized input, and undeclared operations.

## App identity and multi-module discovery

Each first-party package may include a signed `app.json` alongside its entry point and assets. The OS reads that file only from the verified active installed package. It provides the package identity, display title and description, main icon, visibility roles/capabilities, and the module entries the package exposes. Module entries provide a stable ID, user-facing label, internal tab/deep-link key, and required capability. Metadata is descriptive and grants no authority by itself: the OS filters it against the authenticated clinic role and capabilities, while the existing SDK broker independently authorizes each business operation.

The operating system owns the dock, managed window, title bar, controls, borders, resize/focus lifecycle, and app explorer. A dock or Store open first asks the trusted host to inspect the active verified package metadata without starting it. A package with multiple modules available to this user opens the OS-owned explorer first; a package with one available module opens directly. Choosing a module is sent to that app through the platform preload's `onModuleSelected` event. The OS stores the choice for the app session and, on first launch, keeps the native app surface hidden until the app has handled the selection. The app owns the UI inside the managed window body and maps the stable module ID to its own screen. The app does not create its own OS window or replace OS controls.

Packages without discovery metadata retain direct-open compatibility. Malformed metadata or a package that fails active-package verification does not fall back to app-controlled identity; the host reports an unavailable/verification error. The explorer is navigation only and does not represent clinical workflows or business authorization.

## Rendering decision gate

WebContentsView is accepted for the bounded M03 sample composition after automated Linux/Windows proof. It is a native view, not a React child: view bounds, native stacking, clipping, focus and snapshot presentation require deliberate integration. M03 proves two overlapping isolated sample apps, scoped dialogs, resize/fullscreen, overview, dock and Genie on Linux and hosted Windows. Only the foreground native body is live for input; inactive bodies are memory snapshots, and activation clicks are not replayed. Shared shell geometry owns both presentations. Physical Windows assessment remains deferred under the approved policy. See the [composition decision and limits](../dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/decisions/ADR_RUNTIME_001_VIEW_COMPOSITION.md) and [source-bound evidence](../dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md). Production SDK/package integration must preserve these boundaries and repeat applicable tests. An alternative needs an ADR and equivalent boundary evidence; an iframe alone is not proof of independent crash isolation.

## Lifecycle

Create -> loading -> ready -> visible/hidden -> closing -> destroyed; failures enter explicit failed/recovery states. Minimized apps remain logically running. Closed apps release views, listeners, captures and tasks. Background activity is bounded; do not suspend a material in-flight operation without reconciliation.

No app-owned native binaries, preload, arbitrary Node access, executable remote imports, shared app storage, or unlimited worker/process creation. Apply CSP/network restrictions; localhost and arbitrary external connections are denied unless a specifically approved host adapter requires them. Isolation reduces risk; it is not protection against a compromised host administrator.
