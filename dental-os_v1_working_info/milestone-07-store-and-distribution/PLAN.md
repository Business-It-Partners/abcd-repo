# M07 Plan — First-party store and Cloudflare delivery

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M06](../milestone-06-verified-packages/PLAN.md)
**Requirements:** R02, R08
**Exit gates:** G07
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Connect the store to actual approved package releases in the existing Cloudflare platform.

## Deliverables and scope

- Scoped backend catalogue/download contracts, dedicated release R2 configuration and controlled publisher workflow.
- Signed fresh release metadata, compatibility/channel selection, authorization and revocation distribution.
- Real download/progress/install UX replacing simulated store operations; installation/admin policy.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Deliver a staging fixture through actual catalogue and R2; verify bytes, identity, authorization, expiry and bounded download.
- [x] Refuse replayed/withdrawn/incompatible releases, altered metadata, unauthorized install policy and URL/token leakage.
- [x] Catalogue outage and interrupted download leave installed apps coherent; readiness follows registry success, not animation completion.

- [x] Record exact existing fewa_demo repository/branch, GitHub environment/workflow and staging resource map; freeze `/v1/dental-os/...` contracts and prove existing SaaS/Super Admin staging regression checks pass without production mutations.

## Scope exclusions

Only company apps. No third-party portal or patient-media bucket reuse. Production provisioning/deployment requires separately authorized execution.

## Baseline to reconcile

StoreApp/storeArrival are UI prototypes; retain approved presentation while replacing session-only authority.

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

## Execution plan — 2026-10-16

1. Baseline main f79ee668; implement only M07 on codex/milestone-07. Keep the M06 package format/registry and shared desktop lifecycle. Reconcile the earlier user direction: public, dedicated staging release bucket for signed non-sensitive sample web bundles through M11; authenticated catalogue/clinic-admin install policy; private distribution is a later dental-app delivery change.
2. Freeze signed catalogue v1: environment/channel, expiry/issued time/sequence, exact platform/SDK/API compatibility, app metadata and package byte hash/size/payload digest, immutable object paths, withdrawal/minimum versions. Pin company staging public keys and persist a verified freshness watermark. Reject replay, equivocation, stale clocks, unknown keys/IDs and URL destinations. Downloads are anonymous bounded HTTPS bytes only; never forward Firebase credentials to public R2.
3. Trusted desktop distribution service fetches authenticated /v1/dental-os/catalogue and /v1/dental-os/install-policy; exposes safe Store state/progress/cancel/install/uninstall through shell-only generation-fenced IPC. Serialize operations, reauthorize immediately before activation, preserve installs on outage/interruption. Render actual catalogue/registry truth in normal Store; retain old simulated Store only under private prototype fixtures.
4. Backend worktree /home/master-x/Desktop/fewa_demo/dental-os-m07-backend starts from verified origin/cloudfare-staging 76447b9; SYS-0005 owns additive staging-only routes and dedicated R2 binding/publisher procedure. Current SaaS checkout and production configuration stay untouched. No DB migration or clinical route rename. New routes are disabled outside the exact staging environment and when release configuration is absent.
5. Implement local controlled backend and desktop contract fixtures, security negatives and private Store integration. Run resource preflight and one bounded job at a time; Linux build/unit/private UI and hosted Windows gates retain exact source evidence. Backend targeted regression includes existing clinic/platform auth routes; no frontend behavior change.
6. Prepare an exact staging rollout/change record (bucket, public URL, immutable sample releases, signed catalogue, additive Worker deployment and regression/rollback steps). Existing AGENTS requires separate cloud deployment/provisioning approval; finish reviewable local work before asking. G07 is not verified or merged to main until actual approved staging catalogue/R2 acceptance passes. Stop after M07.
