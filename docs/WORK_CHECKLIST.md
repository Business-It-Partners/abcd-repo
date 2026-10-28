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

**Status: COMPLETE**

- [x] Add a connected local staging mode without changing the network-blocked 4280 preview.
- [x] Load only the existing staging Firebase Web SDK client configuration; keep service-account and Worker credentials out of the browser.
- [x] Implement Firebase sign-in, browser-local session persistence, ID-token change/refresh handling, and sign-out.
- [x] Match the browser startup/sign-in flow: session-check splash, remembered email, show/hide password, busy/error states, and re-authentication through the sign-in form after a failed check.
- [x] Keep the startup splash visible until both the initial session check and desktop-style five-second minimum have completed.
- [x] Load access from the existing staging Worker's `/v1/me` response and use returned capabilities to filter the dock; do not use a client-selected role as authority or write clinic business records.
- [x] Implement server-authorized workspace role switching from the roles returned by `/v1/me`; require the Admin PIN when returning to Admin, close open app windows, and refresh `/v1/me` before accepting the new access.
- [x] Confirm the existing Worker CORS policy allows the connected local origin; no backend change was required.
- [x] Add focused tests for admin/doctor/reception capability-to-dock mapping and fail-closed behavior.
- [x] Verify valid staging sign-in and /v1/me access with an existing clinic account in an isolated browser.
- [x] Verify saved-session restoration and capability-filtered dock in an isolated browser.
- [x] Verify ID-token refresh, saved-session restoration, and sign-out in Brave with an existing clinic account.
- [x] Verify invalid credentials, real Worker 401/403 responses, and simulated 503/network recovery in Brave.
- [x] Verify alternate-role switching, Admin PIN enforcement, and post-switch capability filtering in Brave with an existing clinic account.
- [x] Keep all calls staging-only and make no clinic business-record writes; do not use production resources.

## B3 — First-party app catalog and isolated runtime

**Status: COMPLETE**

- [x] Define a strict first-party app manifest with app identity, semantic version, role capabilities, local runtime paths, hashes, and exact API grants.
- [x] Implement the approved app launch boundary with a scripts-only sandbox, opaque origin, and nonce-bound private `MessageChannel`.
- [x] Enforce runtime CSP network denial and reject remote paths, unknown metadata, unrecognized API methods, and non-exact route grants.
- [x] Define package verification, host-release trust, version adoption, failure/retry, and host-release rollback behavior.
- [x] Verify Brave app startup, frame isolation, blocked direct app networking, and token non-disclosure.
- [x] Verify capability-gated launch, message schema/nonce checks, and exact grants through focused unit tests plus the B2 role evidence.
- [x] Verify bad package/hash failure leaves the app closed and retryable without API access in Brave.
- [x] Verify handshake timeouts use the same fail-closed cleanup and retry path in a focused source test.
- [x] Verify that an app cannot access another app's data or bypass role checks.

## B4 — First end-to-end clinic app

**Status: ACTIVE**

- [x] Select Treatment Protocols and define its catalogue, create, and versioned-update route requirements.
- [x] Port its app UI into the isolated browser runtime and replace Electron SDK/session dependencies with the browser host bridge.
- [x] Grant only `treatment_protocols.manage` and the three exact protocol routes; keep Firebase credentials in the host and direct frame networking blocked.
- [x] Add UUID idempotency keys for mutations and guard close, sign-out, and role switching while saves or drafts are pending.
- [x] Build the app bundle and pass TypeScript typechecking; confirm the local staging origin can preflight the required headers.
- [x] Verify an authenticated staging Admin session, the granted `GET /v1/treatment-protocols` route, and the 22-row list in the app UI without changing records.
- [ ] Identify and record the synthetic staging clinic/protocol dataset, role, cleanup expectations, and acceptance plan before any business write.
- [ ] Verify authorized reads/writes, role denial, retry/error behavior, saved-state readback, and cleanup against the approved synthetic target.
- [ ] Record workflow evidence and limitations before accepting B4.

## B5 — App migration and experience parity

**Status: IMPLEMENTATION PRESENT; ACCEPTANCE OPEN**

Finance, Calendar, and Treatment Progress were already present on `browser-version` in commits `44a77d8` and `32d5793`; Work Entry and Patient Record were integrated from their migration worktree, and Appointments, Follow-ups, Staff, and Lab Tracker are now integrated from the app-bringing worktree. User Management has now been migrated from `origin/main` into the Browser runtime. All eleven app-specific implementations have catalog entries and generated bundles. Keep B5 visual and authenticated workflow acceptance open while B4 is active. Source revision attribution needs reconciliation: the Work Entry and Patient Record import manifests identify `production` revision `f44d3e30`, while the older status narrative identifies `abcd/main` revision `90f4a47`.

- [x] Prioritize Work Entry and Patient Record for the requested migration; retain the B4 acceptance gate as open.
- [x] Port both source app UIs/assets into the browser runtime and replace desktop session/API seams with the host bridge.
- [x] Grant only documented API methods/routes and fixed host-mediated media operations; do not allow frame credentials or direct clinic requests.
- [x] Build both app bundles and generate entry, SRI/CSP, catalog, and nested asset-manifest hashes from the same output.
- [x] Verify all generated app assets and nested manifests through the offline local dev server.
- [x] Add focused route, handshake, bundle-integrity, media upload, and role-denial checks.
- [x] Verify Work Entry and Patient Record X-ray uploads on connected staging, cross-app image readback, and audited withdrawal of the synthetic test images; record the unconfirmed synthetic status of the associated patient record in `STATUS.md`.
- [x] Port Appointments, Follow-ups, Staff, and Lab Tracker into the isolated Browser runtime with host-owned API access and app-specific bundles.
- [x] Add the Finance-style module sidebar to Finance and Lab Tracker, sourced from `abcd-repo` main's `WindowModuleSidebar` pattern.
- [x] Keep Follow-ups read-only and Staff document media fail-closed pending relevant Browser acceptance and supported host transport.
- [x] Make app-window sizing adapt to browser full-screen and normal viewport changes, including proportional drag/resize geometry.
- [ ] Restart the local staging dev server after the latest bundle generation so its in-memory app route map includes User Management.
- [x] Migrate User Management from `origin/main` into the scripts-only Browser runtime with Admin and `clinic_users.manage` checks, host-mediated session/API access, and four exact route grants.
- [x] Generate the User Management entry, script, style, CSP/SRI hashes, catalog metadata, and nested asset manifest from one build; typecheck and verify app assets through a private offline server.
- [x] Replace the Finance sidebar's “Transaction Record” label with “Overview” in source metadata and visible loading/error/title text.
- [x] Add capability, exact-route, sandbox, asset-route, and bundle-integrity assertions; the root unit suite passes 28/28.
- [ ] Compare both app screens at agreed Brave desktop sizes and verify visual/interaction parity.
- [ ] Verify authenticated read/write, denial, retry, and saved-state behavior using the approved synthetic staging dataset after the cleanup plan is recorded.
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
