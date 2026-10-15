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

- [ ] Negative cases: spoofed app/frame, malformed/oversized requests, forbidden URLs/redirects/channels and stale sessions.
- [ ] Transport fixtures prove conflict, timeout, 401/403/503, ambiguous write result and preserved idempotency semantics.
- [ ] Compatible/incompatible SDK handshake and cleanup; no arbitrary authenticated fetch, token getter or direct app messaging.

- [ ] Verify broker environment binding uses the mapped staging API, rejects mixed/production fallback configuration, and preserves existing business routes; OS services alone use `/v1/dental-os/...`.

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
