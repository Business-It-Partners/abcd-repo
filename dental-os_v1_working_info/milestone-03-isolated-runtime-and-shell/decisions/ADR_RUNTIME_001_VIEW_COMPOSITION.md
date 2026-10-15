# ADR Runtime 001 — Foreground native view and inactive mirrors

**State:** accepted for M03 fixed-sample composition after Linux and Windows CI proof; physical device assessment deferred.
**Date:** 2026-10-15.
**Related:** architecture ADR-007 and M03/G03.

## Problem

A WebContentsView is a native child view, not a React child. Multiple native bodies placed above a single shell renderer can obscure DOM title bars, overview, dock and Genie. The established shared window manager must remain the lifecycle/geometry/focus owner.

## Decision

Two fixed fixture IDs bind to separate sandboxed webContents, memory partitions and secure custom origins. Only the foreground body receives a native visible/input surface. Inactive/occluded bodies are represented by session-memory captures; their renderers stay alive. Hide native input during shared gestures, overview, motion, owner-scoped discard UI and lower-edge dock overlap. Frame bounds and native view bounds derive from the same shared shell layout. Round native edges; fullscreen has square edges.

The host capture route composes the current isolated body bitmap into the shell capture, preserving the shared Genie renderer/field. Mirrors refresh after app content reports and before/after relevant visibility changes; overview clones refresh when mirrors change. No cross-app DOM cloning or code injection grants apps shell privileges.

Native app keys are forwarded by trusted platform preload DOM capture, not app SDK methods: trusted unmodified key-down only, bounded shape and registered sender/frame. This also works with Playwright CDP input, which did not produce Electron before-input-event in the private proof. Scoped app dialogs keep Escape/Tab locally. Bottom-edge input is converted to bounded host coordinates so fullscreen dock remains reachable.

## Security/lifecycle

Only fixed assets from the matching origin resolve. CSP denies network/frame/object/form activity; session policy denies network, permissions, downloads and popups. Reports contain two booleans only and do not authorize anything. Shell host handlers require the actual shell webContents. Invalid/stale callers cannot select another identity. One protocol session per fixture is reused within the host (two maximum); no persisted partition or arbitrary package path.

Closed views release webContents, timers and captures. A main-process watchdog pings ready renderers at two-second intervals, allows 1.5 seconds for a reply, then marks failure and terminates a hung renderer. No automatic crash loop; explicit restart creates clean workflow state. In-memory drafts may be lost after crash/discard and are labeled accordingly.

## Tradeoffs and limits

Inactive content is a read-only snapshot; clicking activates the live body and the activation click is not replayed into its controls. Background visual updates depend on bounded report/invalidation signals; a general production invalidation SDK is M04 work. Snapshot scaling during drag is temporary. This is a compositional fixture proof, not production package trust, authentication, arbitrary app compatibility or a general multi-window SDK. Whole-environment dirty-exit/session orchestration belongs to later integration work; M03 guards app-window close only. Physical Windows compositing/visual assessment remains deferred by policy.

## Alternatives

Directly stacking all native bodies was rejected as incompatible with DOM chrome occlusion. Iframes alone do not establish independent crash containment. Offscreen streaming would add frame scheduling/GPU/copy complexity and continuous resource use. The bounded foreground/mirror design passed its declared automated checks and screenshot review on Linux and hosted Windows. Acceptance is limited to that scope, with these interaction tradeoffs retained explicitly.

## References

[Electron WebContentsView](https://www.electronjs.org/docs/latest/api/web-contents-view), [session-specific protocols](https://www.electronjs.org/docs/latest/api/protocol), and installed Electron type definitions informed API use. This composition policy is our design, not an Electron-provided desktop compositor.

## Acceptance evidence

[M03 evidence](../VERIFICATION_EVIDENCE.md) records source `fc7f3a23248d8acf18c1fc3462dcbcf3095c966a`, final Windows run 38782178992 and Linux logs/screenshots. Production package/SDK integration must preserve these boundaries and repeat applicable regressions.
