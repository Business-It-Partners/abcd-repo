# Dental OS Browser Edition — Work Checklist

Use this checklist with the [roadmap](ROADMAP.md) and [status record](STATUS.md). Only one milestone is active at a time. Check an item only when its work and evidence are present; planning does not count as implementation or acceptance.

## B0 — Browser product and architecture baseline

**Status: COMPLETE**

- [x] Record the user-approved browser direction: independent browser codebase, familiar Dental OS experience, role-based static dock, staging backend, no Genie or app-store distribution, and battery UI only when the browser provides a live reading.
- [x] Create browser-owned roadmap, status, and checklist documents.
- [x] Make this branch's working tree browser-owned while leaving the desktop branch unchanged.
- [x] Review existing staging Firebase Hosting, Firebase Auth, Worker API, and CORS configuration read-only.
- [x] Record the browser-side identity/session flow and a proposed host-mediated API boundary.
- [x] Record proposed sandboxed app isolation, trusted delivery requirements, and synthetic staging write policy.
- [x] Define browser-specific acceptance evidence for shell, identity, isolation, workflow, visual parity, and staging readiness.
- [x] Set the V1 browser target to Brave only; defer other browsers until all V1 milestones are complete.
- [x] Record a separate staging Hosting site plan without changing Firebase resources.
- [x] Set the browser app isolation, host API bridge, and synthetic staging data policy as implementation baselines with later acceptance checks.
- [x] Close the B0 architecture baseline before starting B1 implementation.

## B1 — Browser foundation and shell

**Status: COMPLETE**

- [x] Establish the browser-owned page entry, local server, and styling boundaries.
- [x] Implement the browser shell, app routes, and default static dock.
- [x] Add app-window shell controls and explicit preview-only states without clinic data.
- [x] Add a user-triggered full-screen toggle with a normal-view exit path.
- [x] Keep pre-auth app windows visibly preview-only; leave role-filtered visibility and authorization to B2.
- [x] Check the shell at desktop and narrow viewport sizes in Brave only for V1.
- [x] Verify browser startup and shell controls in Brave without Electron APIs or desktop services.

## B2 — Staging identity and role access

**Status: IN PROGRESS**

- [x] Add a connected local staging mode without changing the network-blocked 4280 preview.
- [x] Load only the existing staging Firebase Web SDK client configuration; keep service-account and Worker credentials out of the browser.
- [x] Implement Firebase sign-in, browser-local session persistence, ID-token change/refresh handling, and sign-out.
- [x] Match the browser startup/sign-in flow: session-check splash, remembered email, show/hide password, busy/error states, and re-authentication through the sign-in form after a failed check.
- [x] Keep the startup splash visible until both the initial session check and desktop-style five-second minimum have completed.
- [x] Call only the existing staging Worker's read-only `/v1/me` route and use its capabilities to filter the dock; do not use a client-selected role as authority.
- [x] Confirm the existing Worker CORS policy allows the connected local origin; no backend change was required.
- [x] Add focused tests for admin/doctor/reception capability-to-dock mapping and fail-closed behavior.
- [x] Verify valid staging sign-in and /v1/me access with an existing clinic account in an isolated browser.
- [x] Verify saved-session restoration and capability-filtered dock in an isolated browser.
- [ ] Verify ID-token refresh and sign-out in Brave with an existing clinic account.
- [ ] Verify invalid credentials, Worker 401/403/503 responses, and network recovery in Brave.
- [ ] Retain staging-only endpoints and no clinic writes; do not use production resources.

## B3 — First-party app catalog and isolated runtime

**Status: PLANNED**

- [ ] Define a trusted first-party browser app manifest and role visibility rules.
- [ ] Implement the approved app launch and isolation boundary.
- [ ] Enforce content/network policy and reject untrusted app origins or metadata.
- [ ] Define app version, update, rollback, and failure behavior.
- [ ] Verify that an app cannot access another app's data or bypass role checks.

## B4 — First end-to-end clinic app

**Status: PLANNED**

- [ ] Select a representative first-party app and document its workflow and required API routes.
- [ ] Port its browser UI while preserving the agreed Dental OS interaction and visual patterns.
- [ ] Use the existing staging Worker and approved staging data only.
- [ ] Verify authorized reads/writes, role denial, retry/error behavior, and saved state.
- [ ] Record workflow evidence and limitations before accepting B4.

## B5 — App migration and experience parity

**Status: PLANNED**

- [ ] Prioritize remaining first-party apps by user workflow and dependency.
- [ ] Migrate each app through the browser runtime and existing backend APIs.
- [ ] Compare shell and app layouts with the agreed Dental OS visual baseline.
- [ ] Confirm dock and role behavior across supported roles in Brave; defer other browsers until V1 milestones finish.
- [ ] Track unsupported desktop-only behavior explicitly; do not silently claim parity.

## B6 — Browser staging readiness

**Status: PLANNED**

- [ ] Complete browser-specific security, session, role, isolation, and failure checks.
- [ ] Verify Brave V1 coverage and accessible responsive behavior; do not expand browser support in V1.
- [ ] Confirm staging hosting, CORS, CSP, cache/update behavior, and rollback procedure.
- [ ] Run the browser acceptance checklist on staging without production resources.
- [ ] Record source revision, evidence, known limits, and acceptance decision.

## B7 — Production readiness and release decision

**Status: DEFERRED**

- [ ] Start only after B6 is verified and separate production authorization is explicit.
- [ ] Review production identity, API, hosting, security, privacy, operations, and rollback configuration.
- [ ] Record the production go/no-go decision and release evidence.
