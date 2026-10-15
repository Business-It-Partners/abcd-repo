# M03 Plan — Isolated runtime and shared shell

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M02](../milestone-02-host-and-os-state/PLAN.md)
**Requirements:** R04, R05, R11
**Exit gates:** G03
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Prove isolated app execution can preserve the existing desktop experience before building distribution on it.

## Deliverables and scope

- Two independently loaded sample apps with app-specific origins/partitions and platform-bound runtime IDs.
- WebContentsView composition ADR with actual bounds/stacking/focus/snapshot integration and process topology.
- Lifecycle/dirty-state protocol, crash supervision, cleanup and shared-window integration.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Prove overlap, z-order, clipping, scoped dialogs, fullscreen, resize, keyboard focus, overview, dock reveal and Genie.
- [x] Reject cross-app storage, unapproved navigation, Node/host privilege and forged runtime identity.
- [x] Crash/hang one sample runtime and record actual containment; repeat close/minimize/restore and inspect leaked resources.

## Scope exclusions

Only controlled sample assets in private test profiles; no arbitrary production sideloading or finished dental modules.

## Baseline to reconcile

Preserve windowManager/ManagedWindow and shared field/fallback. WebContentsView is a candidate until this proof passes.

## Ownership and integration rules

Platform changes stay in trusted Electron/SDK/runtime boundaries and shared shell ownership. Backend work belongs in the separate existing SaaS project with its own instructions and explicit change record. Do not perform remote provisioning, production mutations, commits/pushes or deployment through this plan alone.

Use synthetic or approved staging fixtures. UI automation must run through the private runner; never restart/focus the live OS for verification. Run relevant build/unit checks for code changes and only necessary focused UI suites. Documentation-only changes use link/structure/traceability validation; runtime checks cannot certify prose or unimplemented services.

## Evidence requirements

Record command, source/tree identity, build/dependencies, host/display/profile, actual outcome and redacted retained artifacts. Missing platform evidence remains explicit. Proposed commands and previous Flutter/prototype results are not milestone verification. Technical completion and user acceptance are separate.

## Mandatory backend/staging boundary

Reuse existing `fewa_demo` Dental SaaS/Super Admin repositories, GitHub environments/workflows and Cloudflare resources under the [canonical backend policy](../../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md). Any backend change or remote integration must target verified **Cloudflare staging-only** resources. Record the exact branch, GitHub environment/workflow, API base, Firebase project, Worker/D1/R2 bindings before that work; do not guess names or use production credentials/fallbacks.

New OS-specific services use `/v1/dental-os/...`; existing dental business and identity routes are reused unchanged. Changes must be additive, preserve existing Dental SaaS/Super Admin behavior, and include existing-client regression evidence when shared backend/configuration changes. Production changes/promotion require separate explicit authorization. This plan and documentation amendment authorize no backend edits, provisioning or deployments by themselves.

## Windows verification scope

Use the [approved deferred-device policy](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md): Linux checks plus applicable Windows GitHub Actions evidence during milestones; physical Windows interaction/visual checks after M11, before final release. Record remaining device scenarios separately; CI success is not physical-device certification.

## Detailed M03 execution plan — 2026-10-15

Inspection: shared ManagedWindow/windowManager already owns presentation, dock/overview and Genie. Native WebContentsView bodies sit above shell DOM, so naïvely adding two views would obscure other window chrome/overlays. Preserve one shared lifecycle: render only the foreground isolated body natively; represent inactive/occluded bodies with session-memory snapshots while their isolated renderers remain alive. Hide native content for overview, gestures, dock overlap and animations; compose isolated captures into the shared capture route. This explicit composition tradeoff must pass interaction/visual evidence before ADR-007 can be accepted.

1. Implement a development/test-only runtime registry for two fixed sample IDs mapped to existing studio/records fixture frames. Each uses a distinct secure custom origin, in-memory partition and sandboxed webContents. No production installation or user-supplied path.
2. Add a platform-owned restricted app preload for dirty/modal/paint/input-edge signals only. No identity argument, token getter, arbitrary IPC or shell/native services. Bind sender/frame to registry entry; deny network, downloads, permissions, navigation/popups and file paths. Limit payloads, sessions, bounds and sample count. Restrict all shell host IPC to the actual shell sender.
3. Supervise load/crash/hang and teardown, with bounded watchdog and explicit restart. Close dirty apps through owner-scoped discard/cancel UI; do not promise crash draft recovery. Keep ordinary demo behavior unchanged outside the runtime-fixture flag.
4. Integrate native-body placement/focus and snapshot mirrors with current shared frames, content clipping, existing dock, overview and unchanged Genie field. Forward reserved shell keys and bottom-edge pointer access from native content.
5. Unit-test layout/input/capture helpers. Privately verify two independent processes/origins/storage, denied privilege/network/navigation, real editing/scoped dialog, dirty close, overlap/resize/fullscreen, minimize/restore captures, overview, dock reveal, crash/hang containment and repeated cleanup. Inspect screenshots.
6. Run bounded single-worker tests, build, focused private runtime suite and applicable shared regressions sequentially. Add corresponding hosted Windows CI checks; retain source/run evidence. Physical Windows review remains deferred per policy. M04 is not started.

Resource preflight: no task-owned stale job identified. Browser load is elevated; do source/planning work first, recheck instantaneous CPU/memory before heavy checks. Do not kill unrelated browser activity.
