# Dental OS — App Runtime and Isolation

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Apps execute outside the shell JavaScript context in independently managed sandboxed webContents with app-specific origins and session partitions. Node integration is disabled, context isolation enabled, navigation/new windows controlled, and default permissions denied.

A platform-owned preload exposes a narrow SDK. Bind the sender webContents/frame to its verified installed app/version and current session generation. Reject unknown senders, unexpected subframes, forged identities, stale connections, oversized input, and undeclared operations.

## Rendering decision gate

WebContentsView is accepted for the bounded M03 sample composition after automated Linux/Windows proof. It is a native view, not a React child: view bounds, native stacking, clipping, focus and snapshot presentation require deliberate integration. M03 proves two overlapping isolated sample apps, scoped dialogs, resize/fullscreen, overview, dock and Genie on Linux and hosted Windows. Only the foreground native body is live for input; inactive bodies are memory snapshots, and activation clicks are not replayed. Shared shell geometry owns both presentations. Physical Windows assessment remains deferred under the approved policy. See the [composition decision and limits](../dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/decisions/ADR_RUNTIME_001_VIEW_COMPOSITION.md) and [source-bound evidence](../dental-os_v1_working_info/milestone-03-isolated-runtime-and-shell/VERIFICATION_EVIDENCE.md). Production SDK/package integration must preserve these boundaries and repeat applicable tests. An alternative needs an ADR and equivalent boundary evidence; an iframe alone is not proof of independent crash isolation.

## Lifecycle

Create -> loading -> ready -> visible/hidden -> closing -> destroyed; failures enter explicit failed/recovery states. Minimized apps remain logically running. Closed apps release views, listeners, captures and tasks. Background activity is bounded; do not suspend a material in-flight operation without reconciliation.

No app-owned native binaries, preload, arbitrary Node access, executable remote imports, shared app storage, or unlimited worker/process creation. Apply CSP/network restrictions; localhost and arbitrary external connections are denied unless a specifically approved host adapter requires them. Isolation reduces risk; it is not protection against a compromised host administrator.
