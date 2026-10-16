# M05 Plan — Single login and protected sessions

**Status:** see [STATUS.md](STATUS.md).
**Dependencies:** [M04](../milestone-04-sdk-and-api-broker/PLAN.md)
**Requirements:** R06, R07
**Exit gates:** G05
**Architecture:** [contract index](../../dental-os_v1-documentation/00_V1_README.md), [gate matrix](../../dental-os_v1-documentation/18_V1_ACCEPTANCE_GATES.md).

## Outcome

Integrate the existing Firebase identity and Worker authorization through one trusted desktop session.

## Deliverables and scope

- Proven platform-owned desktop sign-in flow and Worker /v1/me access resolution.
- Session manager, coordinated token renewal and protected credential-provider adapters.
- Lock/logout/account switching, generation-bound requests and clear expiry/revocation UX.

## Execution sequence

1. Reconcile current source and existing prototype evidence; freeze exact supported scope and unresolved ADRs.
2. Define contracts/fixtures, failure cases and measurable acceptance criteria before implementation.
3. Implement the smallest vertical slice within this milestone; preserve unrelated user work and shared lifecycle.
4. Verify negative and interruption cases as well as successful behavior; retain exact source/host evidence.
5. Update requirement coverage, limitations and status together; advance only after the applicable gate passes.

## Exit criteria and verification

- [x] Use approved staging accounts to test real login, token renewal, denial, disabled access and unavailable backend.
- [x] Test unavailable/inadequate Linux key storage: session-only behavior and no plaintext persisted credentials.
- [x] Switch users during in-flight responses/writes; old data never enters the new session; no app receives password/refresh token.

- [x] Verify existing staging Firebase/Worker mapping, clinic/Super Admin authority separation and unchanged web login behavior; never modify production identity configuration.

## Scope exclusions

No new identity provider or user-selected tenant authority; no public app credentials; no duplicate desktop business accounts.

## Baseline to reconcile

Worker remains final authority. Select and document the exact Firebase desktop flow before implementation.

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

Baseline: main `4ad8e32f`, verified/integrated M04. SaaS staging branch/environment/source mapping is retained in M04; real staging credentials are currently absent from expected local environment variables and the Codex browser has no open signed-in tab. User has been asked for an approved credential file path/environment names while independent implementation continues. Do not invent a logged-in acceptance result.

1. Select the existing Firebase email/password REST flow in trusted main, followed by the unchanged Worker GET `/v1/me`. Tokens/password never reach app renderers. Enforce the mapped staging Firebase project/audience/issuer, fixed Google endpoints and Worker URL; no production fallback or new identity backend. Worker verification is authoritative; decoding claims is only a configuration check.
2. Implement a bounded provider/client and single session manager with safe shell display state, serialized login/refresh, explicit phases/generation and stale-result rejection. Fresh authorization is required before ready and after renewal. No automatic business-write replay. Provider revocation/invalid token expires local authority; clinic 403 remains distinct from Super Admin authority.
3. Protect optional refresh-token persistence with Electron safeStorage and restricted atomic files. Reject unavailable/basic_text/unknown Linux protection, offer session-only behavior, persist no password or ID token and no plaintext refresh fallback. Detect corrupt/symlinked files without following or overwriting unrelated paths. Clear persisted credentials on logout; provider failure is explicit.
4. Add a platform-owned shell gate/login/lock/logout/switch interface and safe status subscription. Clearing/locking session destroys isolated views and snapshots and remounts shell workflow state; main gates capture/runtime calls while locked. Screen lock/suspend also lock the session. Preserve private prototype/runtime regression modes behind existing private-display/Windows-CI guards; normal launch requires staging sign-in.
5. Connect the M04 broker to the session identity and generation; deny stale/in-flight results after lock/logout/switch and re-register clean runtime state. Worker-derived clinic/user display and allowed operation capabilities cannot be selected by the app. Real SaaS operation acceptance remains M09.
6. Verify unit/HTTP fixtures for login/refresh, disabled/denied/unavailable service, audience mismatch, refresh serialization/rotation, session expiry, secret-provider failure, encrypted storage, lock/logout/switch and old writes/results. Private Linux and Windows hosted scenarios prove actual shell-gate/IPC isolation and view/preview cleanup. Preflight and run one bounded heavy job at a time; retain failures/evidence.
7. Use an approved existing staging account for real sign-in, `/v1/me`, renewal and sign-out checks without editing users/backend/config or writing business records. Real denied/disabled cases need approved accounts; fixture cases alone are not real-account verification. If access is unavailable, keep that required gate pending and continue all independent work; do not mark M05 verified or merge it prematurely.
8. After all applicable M05 gates pass, record source/run evidence, create checkpoint, merge normally to main, retain branch/tags and stop. Physical Windows remains after M11/before release. M06 is not authorized.

API references: Firebase Auth REST reference (signInWithPassword/securetoken refresh) and Electron safeStorage documentation. Linux basic_text is explicitly inadequate. No third-party accounts/platforms or backend deployment.


Completion scope: real approved staging login/renewal/denial/local logout and actual private desktop sign-in/lock/logout passed. Disabled membership, outage and in-flight write/account-switch negatives are controlled fixtures; no live account was disabled or service interrupted. Required automated Windows gate passed; physical device/provider matrix remains under the existing after-M11 policy.
