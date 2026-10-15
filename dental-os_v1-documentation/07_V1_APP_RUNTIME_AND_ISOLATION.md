# Dental OS — App Runtime and Isolation

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Apps execute outside the shell JavaScript context in independently managed sandboxed webContents with app-specific origins and session partitions. Node integration is disabled, context isolation enabled, navigation/new windows controlled, and default permissions denied.

A platform-owned preload exposes a narrow SDK. Bind the sender webContents/frame to its verified installed app/version and current session generation. Reject unknown senders, unexpected subframes, forged identities, stale connections, oversized input, and undeclared operations.

## Rendering decision gate

WebContentsView is the preferred candidate, not an already accepted implementation. It is a native view, not a React child: view bounds, native stacking, clipping, focus and snapshot presentation require deliberate integration. M03 must prove two overlapping isolated sample apps, scoped dialogs, resize/fullscreen, overview, dock and Genie on supported hosts. Record the actual renderer/process topology and crash containment. An alternative needs an ADR and equivalent boundary evidence; an iframe alone is not proof of independent crash isolation.

## Lifecycle

Create -> loading -> ready -> visible/hidden -> closing -> destroyed; failures enter explicit failed/recovery states. Minimized apps remain logically running. Closed apps release views, listeners, captures and tasks. Background activity is bounded; do not suspend a material in-flight operation without reconciliation.

No app-owned native binaries, preload, arbitrary Node access, executable remote imports, shared app storage, or unlimited worker/process creation. Apply CSP/network restrictions; localhost and arbitrary external connections are denied unless a specifically approved host adapter requires them. Isolation reduces risk; it is not protection against a compromised host administrator.
