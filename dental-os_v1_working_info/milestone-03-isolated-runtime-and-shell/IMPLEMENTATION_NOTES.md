# M03 Implementation Notes — Isolated runtime and shared shell

## Starting baseline

M02 accepted automated baseline `7c794b45` on main. Implementation is isolated on `codex/milestone-03`. Existing demo apps and the live user session are preserved.

## Implementation record

- `electron/runtime/manager.ts` owns two fixed, separate sandboxed WebContentsView renderers, secure origins, memory partitions, restricted assets, lifecycle, explicit restart, capture composition and bounded hang supervision.
- `electron/runtime/appPreload.ts` exposes two-boolean dirty/modal reports only. Reserved keys and lower-edge pointer signals are platform-owned and sender/frame bound; app code cannot select a runtime identity. `contracts.ts` strictly validates layouts/assets and bounds bitmap work.
- `src/RuntimeFixtures.tsx` integrates fixture bodies with existing ManagedWindow/windowManager geometry, focus, scoped dirty-close UI and inactive mirrors. Shared overview refreshes mirrors without duplicate runtime identities; Genie field/renderer remains unchanged.
- Main-process shell handlers now bind the actual shell sender and main frame. App sessions deny network, permissions, downloads, navigation and popups; fixtures add restrictive CSP. No application credentials or host API are exposed.
- Fixture mode requires the command flag plus the private Linux display or Windows CI environment. Ordinary desktop launches retain existing prototype content. Fixed synthetic assets are not an installer or sideloading path.
- `tests/runtime-scenario.mjs` is shared by guarded Linux and hosted Windows entrypoints. DPR-2 capture proof and pure contract tests supplement existing overview/native-session regressions. Windows Actions runs all steps sequentially.

## Decisions and boundaries

See [composition decision](decisions/ADR_RUNTIME_001_VIEW_COMPOSITION.md). Only foreground content is natively interactive; inactive bodies use read-only snapshots and activation clicks are not replayed. General invalidation/SDK, installed package trust and authentication remain later milestones. App close is guarded; whole-environment dirty exit is later integration work. In-memory draft loss after crash/discard is explicit.

No backend/cloud configuration, deployment, production credentials or real patient data. Physical Windows visual/input assessment remains deferred until after M11, before final release.

## Repairs during verification

Initial denied-navigation test waited for a navigation intentionally blocked by policy; the final test observes unchanged origin without waiting for success. Private CDP keyboard input did not produce Electron before-input-event, so reserved keys use trusted DOM keydown capture in the isolated platform preload. Modal Escape stays local. Captures now serialize with pending mirror work; the DPR test waits for painting before capture and the resulting draft text was visually inspected.

The first Windows CI passed automation, but screenshot review found square composed corners. The final bitmap compositor applies a scaled rounded mask, preserving shell pixels outside native clipping; a focused unit regression covers corner preservation. The original Windows run remains retained separately.

Focus is selected once after all native visibility changes, so registry iteration order cannot return focus to the shell after activating the other app. Linux verifies both directions explicitly; Windows rerun applies the same checks.
