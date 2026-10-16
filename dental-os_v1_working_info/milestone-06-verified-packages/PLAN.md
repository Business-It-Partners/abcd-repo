# M06 Plan — Verified packages and local lifecycle

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M05](../milestone-05-identity-and-session/PLAN.md)
**Requirements:** R02, R03, R15
**Exit gates:** G06
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Replace developer-loaded fixtures with company-verified independently installed web packages.

## Deliverables and scope

- Frozen manifest/archive/canonical-signature schema and internal deterministic builder/verifier.
- Platform trust policy, verified version registry and packaged runtime-to-identity binding.
- Staging/activation/uninstall/retained-version primitives with operation journal and safe extraction.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Reject unsigned/altered assets/manifests, unknown publishers/IDs, incompatible SDK/API, invalid entry paths and forged identity.
- [x] Test traversal, links/reparse points, excessive expansion/count, disk exhaustion, concurrent operations and crash checkpoints.
- [x] Restart resolves pending operations; only active verified bytes execute; uninstall affects neither SaaS records nor other app files.

## Scope exclusions

Local signed fixtures only; remote catalogue is M07. No native executables, install scripts or production sideloading.

## Baseline to reconcile

Freeze package format and algorithm here; reuse Flutter verification lessons, not its binary format or authority assumptions.

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

## Approved M06 execution detail — 2026-10-16

1. Freeze `dentalpkg/1`: canonical UTF-8 JSON envelope, uncompressed base64 file payload, SHA-256 inventories/digest and Ed25519 signed release binding. No ZIP/TAR parser, compression, links, modes or executable hooks. Exact keys, paths and bounded sizes/counts are mandatory; deterministic builders share the verifier.
2. Add trusted package modules under `electron/packages/` (transitional format/service boundary) and an internal `tools/app-packages/` builder. Platform policy selects company IDs, public keys, SDK/API and maximum grants; manifest requests cannot grant authority. Production policy starts empty/fail-closed until separately approved release keys exist. Private signed fixtures use ephemeral keys and cannot enter normal profiles.
3. Implement OS-selected profile-local registry with immutable version directories, staged extraction, exclusive operations, atomic pointer/journal writes, capacity checks, retained versions, explicit uninstall and startup reconciliation. Reject links/hardlinks/reparse paths; bound reads/writes; verify installed inventory again before each launch. Pin verified memory bytes for the running version to avoid serving mutable files.
4. Replace direct source-file runtime loading in the private two-app proof with installed verified packages. Bind broker ID/version/capabilities from the verified handle; preserve native isolation, shared frame/motion, session fences and existing SDK behavior. No renderer filesystem/install/sideload API.
5. Add adversarial unit/filesystem tests: signature/identity/schema/compatibility/path/inventory limits; tamper/link/capacity/concurrent/crash recovery; retained version and uninstall containment. Add hosted Linux/Windows packaged-runtime proof. Continue runtime/SDK/identity regressions because the loader changes.
6. Preflight resources, run one bounded unit/build/private UI job at a time, retain source hashes and reports, run Windows Actions, then checkpoint and normal-merge verified source to main. No cloud/backend/deployment work. Stop after M06.

M07 owns catalogue freshness/remote delivery; M08 owns user-facing update timing, dirty workflow coordination, revocation/rollback authorization and retention eviction. M06 provides local primitives only; an active lease blocks uninstall rather than silently terminating work.
