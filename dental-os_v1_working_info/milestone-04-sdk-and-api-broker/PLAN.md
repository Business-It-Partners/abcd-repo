# M04 Plan — Internal SDK and API boundary

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M03](../milestone-03-isolated-runtime-and-shell/PLAN.md)
**Requirements:** R05, R07, R13
**Exit gates:** G04
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Create a versioned, bounded application contract that can use existing SaaS APIs without exposing credentials.

## Deliverables and scope

- Runtime-validated SDK schemas, sender/frame-to-app binding and capability allowlist.
- API broker with allowed destinations/operations, bounded transport and structured errors.
- Operation identity, idempotency/revision handling, lifecycle/status/native intent interfaces and contract fixtures.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Negative cases: spoofed app/frame, malformed/oversized requests, forbidden URLs/redirects/channels and stale sessions.
- [x] Transport fixtures prove conflict, timeout, 401/403/503, ambiguous write result and preserved idempotency semantics.
- [x] Compatible/incompatible SDK handshake and cleanup; no arbitrary authenticated fetch, token getter or direct app messaging.

- [x] Verify broker environment binding uses the mapped staging API, rejects mixed/production fallback configuration, and preserves existing business routes; OS services alone use `/v1/dental-os/...`.

## Scope exclusions

Use fixture credentials/servers here; live identity integration is M05 and real SaaS acceptance M09. No business-rule duplication.

## Baseline to reconcile

Inspect existing API contracts and private bridge. Do not change the separate backend without a scoped implementation task.

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


## Detailed execution plan — 2026-10-16

Baseline: main `f904aa9f`, verified M03. Existing fixtures have a two-boolean report bridge, independent native renderers and strict origin/session isolation, but no version negotiation, credential mediation or named API operations. Keep ordinary demos and shared window/dock/Genie behavior intact. No dependency install or broad repository migration is needed.

1. Record the existing SaaS staging resource/route mapping from the separate repository without changing it. Bind one immutable staging profile; reject production/mixed/unknown fields. Distribution endpoints remain unconfigured until M07, with no fallback. Use fixture identity/transport only here, not real clinic credentials.
2. Add renderer-safe SDK types and runtime validation under `electron/sdk/` as an explicitly transitional boundary. Preserve the existing build/main paths; broad packages/apps migration is out of scope. The sandbox preload uses type-only imports, fixed IPC channels and bounded serialization; trusted host validates everything again.
3. Add major/minor handshake and host-registered sender/main-frame/origin/app-version binding. Connections and session generations are platform-owned. App-facing methods are connect/request/cancel plus the retained M03 lifecycle report. No URL/header/token/channel/app-identity argument, raw fetch, token getter or app-to-app messaging.
4. Implement named list/status-write appointment operations using the exact existing business routes/body/header shapes. Enforce input/output limits, capabilities, per-app/global concurrency, deadlines/cancellation, denied redirects and bounded response streaming. Preserve caller-owned idempotency key and expectedRowVersion; refuse key reuse with changed operation/body, never auto-retry writes, mark post-dispatch uncertain outcomes explicitly. No local business authority or write queue.
5. Define session display/status, scoped memory-only preferences, lifecycle, bounded notification receipt and typed native-intent interface. Unsupported print/export returns an explicit unavailable result rather than claiming an adapter exists. Credentials are obtained through a host-only identity-provider interface with single-flight acquisition and stale-session rejection; real identity provider is M05.
6. Bind this SDK into both M03 fixture runtimes, unregister/abort on close/crash and session invalidation. Add sample SDK controls using synthetic responses, with different read/write capabilities, preserving app/window interaction. Fixture services cannot contact the real staging API.
7. Unit/security/real local HTTP fixtures cover forged caller/subframe, malformed/oversized payload, incompatible handshake, forbidden destination/header/channel/capability, stale generation/results, cleanup, 401/403/409/422/503, timeout/network loss/redirect, response limits, cancellation/concurrency, idempotency/revision preservation and ambiguous writes. Private Electron integration proves real sender binding, sample read/write separation and lifecycle cleanup. Re-run affected M03 regressions sequentially.
8. Preflight load/processes before heavy work; one bounded low-priority job and one test worker. Run unit/build/private suites sequentially, then Windows Actions with retained source/run evidence. Close G04 only after applicable Linux and Windows gates pass. Preserve physical Windows deferral and explicit fixture/live-identity limits. Commit/tag the verified checkpoint, merge normally into main and preserve the milestone branch. M05 is not started.

No backend configuration, cloud mutations, real authentication or deployment is authorized by this milestone execution. Mapping is source/configuration evidence, not deployed-resource or authenticated SaaS acceptance.
