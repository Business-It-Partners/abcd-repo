# Dental OS Browser Edition — Architecture Baseline

- **Milestone:** B0 — Browser product and architecture baseline
- **Status:** B0 architecture baseline recorded
- **Reviewed:** 2026-10-27

This is the browser edition's architecture record. It does not reuse Electron runtime requirements. B1 supplies the browser shell; B2 supplies staging identity and role access. B3 adds the trusted app catalog and isolated preview runtime. B4 is integrating Treatment Protocols as the first clinic workflow.

## Verified staging facts

Read-only review of the local Dental SaaS configuration and Firebase CLI established:

- Staging Firebase project: `dental-managemetn-staging`.
- Current clinic web site: `cloudfare-dental-saas-staging.web.app`.
- The clinic and other candidate staging Hosting sites already have live releases. The browser edition should have a dedicated site so it has its own deployment boundary and does not replace a live site.
- The staging Cloudflare Worker is the existing clinic API. The clinic web contract sends a Firebase ID token as a Bearer token; the Worker verifies it and resolves clinic tenant, role, and capabilities server-side. `GET /v1/me` returns the clinic session.
- The Worker CORS allowlist does not include the browser preview origin `http://127.0.0.1:4280`. No API call from the current preview is enabled; its CSP blocks connections.
- The deployed Worker already allows `http://localhost:3003` and `http://127.0.0.1:3003`. A read-only preflight from the browser staging origin succeeds, so B2 does not need a CORS or Worker deployment change.
- The production Firebase project and production Worker are outside this browser milestone.

No SaaS source, Firebase Hosting site, Firebase Auth setting, Worker configuration, backend data, or deployment was changed during this review.

## Proposed browser system

```text
Supported desktop browser
  └─ Browser host (dedicated staging Firebase Hosting origin)
      ├─ Firebase Auth session and role-aware shell
      ├─ Static dock, routing, app catalog, and browser API client
      └─ Sandboxed first-party app frames
           └─ narrow MessageChannel API requests to the host
                └─ HTTPS + Firebase ID token → existing staging Worker
                     └─ tenant-scoped SaaS data and authorization
```

### Browser host and hosting

Use a dedicated Firebase Hosting site in the existing `dental-managemetn-staging` project, with its own browser edition origin. Keep the current Dental SaaS clinic site and Super Admin site untouched. The planned site ID is `dental-os-browser-staging`; it has not been created. Before staging deployment, allow the exact hosted origin in Firebase Auth and staging Worker CORS configuration.

Use the same staging Firebase project for browser sign-in and the existing staging Worker for clinic APIs. Keep the browser frontend deployable independently from the Dental SaaS frontend. Do not point staging configuration at production.

### Browser compatibility

V1 supports Brave only, per the user's direction. Chrome, Edge, Firefox, Safari, and mobile-browser compatibility are deferred until all V1 milestones are complete. B1/B6 acceptance uses Brave; browser-specific shell features such as sandboxed app frames and `MessageChannel` communication are checked there.

### Identity, session, and API boundary

1. The browser host owns the Firebase Auth client and the single sign-in session. It obtains and refreshes Firebase ID tokens.
2. The browser host calls the existing Worker with `Authorization: Bearer <Firebase ID token>` and uses `GET /v1/me` to load the backend-authoritative clinic session. When the account has alternate workspace roles, the host can request a role transition through `PUT /v1/clinic/workspace-role`; the Worker validates the account and Admin PIN, then `/v1/me` is fetched again before the browser changes its visible access.
3. The Worker remains the authority for identity validation, tenant resolution, role/capability checks, and business data. The browser never selects a tenant, D1 binding, or trusted role for an API request.
4. The host owns a small browser API client that attaches tokens only to approved route/method grants. App frames do not receive Firebase tokens or Firebase Auth credentials.
5. Sign-out clears the host session and closes app frames. Expired sessions fail closed and require the normal sign-in flow.

This does not require the Electron native broker or its preload SDK. The browser host uses Firebase Auth and a small Worker client; the Worker performs final authorization. B2 uses `/v1/me` for clinic access and capability filtering, with the workspace-role endpoint only for the existing identity/workspace transition. Role switching may update the existing role-session, audit, and PIN-attempt state; it does not access or write patient, appointment, billing, or other clinic business records. App data routes and app workflows remain for later milestones.

### B2 local setup

- Keep the offline preview at `http://127.0.0.1:4280`; its CSP blocks outbound connections.
- Use `npm run dev:staging` at `http://localhost:3003` for connected staging sign-in. This origin is already allowlisted by the deployed staging Worker.
- `config/staging-firebase.json` contains only the staging Firebase Web SDK's public client fields copied from the SaaS staging frontend. It contains no Firebase service-account or Worker credentials.
- The browser loads the same pinned Firebase JS SDK version used by the SaaS client and lets Firebase manage local session persistence and token refresh.

### App isolation and delivery

**B3 model:** render each first-party app in a sandboxed iframe with `allow-scripts` as its only sandbox permission. Omitting `allow-same-origin` gives the app an opaque origin; the frame cannot use the host's DOM, cookies, Firebase Auth state, or storage. App response headers and the matching meta policy deny direct network connections, nested frames, forms, objects, and navigation to unapproved frame origins. The runtime script is allowed by a fixed CSP SHA-256 source and SRI.

The host bundle contains a strict, closed-schema catalog of company first-party app IDs, role capabilities, local icon and runtime paths, versions, hashes, and exact API grants. The Worker-provided capabilities decide which apps appear and which can launch. Before creating a frame, the host downloads the catalogued same-origin HTML, JavaScript, and optional stylesheet with credentials omitted, redirects rejected, caching disabled, and bounded response sizes; it compares SHA-256 hashes and confirms that the HTML's CSP and SRI pin the expected assets. Unrecognized fields, duplicate IDs/grants, unsafe paths, non-HTTPS API origins, and unsupported methods fail validation.

The current trust root is the reviewed browser-host release delivered from the dedicated HTTPS site. The catalog and its hashes ship in that same release. SHA-256 and SRI catch package drift and partial/cached mismatches; they are **not an independent publisher signature** and do not protect against compromise of the host release itself. Any later distribution that separates app bundles from the browser host must add a separately managed signing key and signed release metadata before it is accepted.

Each frame launch gets a host-created `MessageChannel` bound to the app ID, manifest version, and random launch nonce. The host validates every message schema and accepts only exact method/path grants; it never returns the Firebase token. B3's other nine apps remain generic previews with no API grants. B4 gives Treatment Protocols only `treatment_protocols.manage` and three grants: `GET /v1/treatment-protocols`, `POST /v1/treatment-protocols`, and `PUT /v1/treatment-protocols/{uuid}`. The Worker remains the final authority for each request.

#### B4 — Treatment Protocols browser workflow

The browser app packages the migrated Treatment Protocols UI into a single isolated runtime (one HTML entry, one compiled JavaScript file, and its CSS, with the CSS embedded and hash-pinned by the entry). It uses the host's narrow API bridge instead of the Electron SDK or native broker. The host retains Firebase credentials and mediates only the three catalogued routes above. Mutations carry a stable UUID `Idempotency-Key`; the host validates payloads and route IDs, applies request bounds, and returns Worker status/body without widening app permissions.

This compiled **app bundle** is the browser-ready output for one app. It is not a collection of web pages, an app-store installer, or a separately signed release package. Its hashes detect mismatches against the manifest shipped with the browser host; they are not an independent publisher signature. Separate app signing and release metadata are outside B4.

Local source integration and build do not constitute workflow acceptance. On 2026-10-27, an isolated staging Admin session loaded the app and `GET /v1/treatment-protocols` returned 200; the UI showed 22 protocol rows. No protocol was changed. Although the list includes test-labelled rows, the staging clinic and records are not authoritatively designated as synthetic, and no cleanup plan is recorded. Before any write, record the exact synthetic staging clinic and protocol records, role, cleanup expectations, and acceptance evidence. Mutation flows, Worker role denial, retry/error behavior, and saved-state readback remain acceptance work until a synthetic target is positively identified.

**Update and recovery behavior:** app versions use exact semantic versions and the browser host release pins the bundle hashes. A migrated app update must publish a reviewed host release with a new manifest version/hash and an immutable, versioned app-asset path. The current B3 app content is the same generic preview runtime for all catalog entries; `/apps/runtime.v1.*` identifies its runtime protocol, not ten separate app bundles. An already-open frame keeps its loaded snapshot; it is not hot-replaced. Reloading the browser host adopts the new manifest. A hash, SRI, CSP, load, or handshake failure closes the frame and its channel, shows a retryable error in the window, and gives the app no API access. Rollback means restoring the last known-good browser-host release from Firebase Hosting; this hosting rollback procedure is recorded for B6 and has not been operationally tested or deployed as part of B3. The local development server uses no-store package checks to expose stale/mismatched files quickly.

This model passed local isolated Brave verification in B3. A read-only staging CORS preflight for the protocol mutation headers also succeeds from `http://localhost:3003`; this does not verify sign-in, route behavior, or writes. The dedicated staging site does not yet exist, so hosted CSP, cache behavior, and Hosting rollback remain B6 acceptance work. Hosting must also send `Access-Control-Allow-Origin: *` for SRI-loaded runtime assets because a scripts-only sandbox gives those requests an opaque origin.

### Data and write policy

- Keep existing SaaS staging as the only backend for B0–B6. The Worker remains business authority.
- Start browser API integration with authenticated, read-only session and clinic reads.
- Use a designated synthetic staging clinic and synthetic records for later write acceptance. Do not use production data or create an offline business-write queue.
- Before the first write workflow, record its exact routes, synthetic records, role, cleanup expectations, and acceptance evidence.
- Allow only exact staging origins in CORS. CORS supplements Worker authentication and authorization; it does not replace them.

## Browser acceptance strategy

Acceptance uses browser-specific evidence. Electron builds, native window tests, and desktop broker tests do not prove browser behavior.

| Milestone | Required browser evidence |
| --- | --- |
| B1 | Launch the browser-owned shell in Brave; verify routes, static dock, responsive layout, keyboard focus, and the agreed visual reference. Confirm there are no Electron globals or native IPC dependencies. |
| B2 | Verify Firebase sign-in/out, refreshed and expired ID tokens, `/v1/me`, role-filtered navigation, server-authorized workspace switching, Worker-side denials, and network/maintenance states against staging. Do not write clinic business records. |
| B3 | Verify frame isolation, token non-disclosure, blocked direct app networking, message schema/nonce checks, capability-gated launch, exact app route grants, and that no ungranted request reaches the Worker. B4 verifies Worker behavior for its approved workflow routes. |
| B4 | Complete one approved workflow with a synthetic staging clinic and records; retain readback, role-denial, and cleanup evidence for any writes. |
| B5 | Compare shell and migrated app screens at agreed desktop sizes and roles. Preserve the visual language and static dock; Genie animation is excluded. Browser battery UI may appear only when a live browser reading is available. |
| B6 | Run the V1 browser acceptance matrix in Brave on staging, including session expiry, denied access, network failure, app update/rollback, CSP/CORS, and hosting recovery. Confirm production was not used. |

Exact browser versions, viewport sizes, workflow, roles, test identities, and test records are set before each relevant milestone. Never put real patient data or tokens in screenshots or evidence.

## B0 baseline decisions and remaining work

| Decision | Proposal | State |
| --- | --- | --- |
| Browser compatibility | Brave only for V1; other browsers deferred until V1 milestones finish | Set by user; recorded for B1/B6 acceptance |
| Browser hosting | Dedicated `dental-os-browser-staging` Hosting site in the existing staging Firebase project | Planned for browser staging deployment; no site created |
| Sign-in and API | One Firebase Auth session in the host; host-owned route-granted API client; existing Worker remains authoritative | Baseline for B2 |
| App isolation | Scripts-only sandbox, opaque origin, runtime CSP hash/SRI, nonce-bound host `MessageChannel`, per-app route grants | Implemented locally in B3; Brave isolation acceptance is recorded in Status |
| App trust and updates | Reviewed dedicated-host release is the trust root; manifest and bundle SHA-256/SRI pinning; exact semantic versions; host release rollback | Implemented/defined for B3. Hashes are not an independent signature; hosted deployment and rollback validation remain B6 |
| First write data | Designated synthetic staging clinic/records after read-only integration succeeds | Baseline for B4; exact workflow and cleanup to be recorded before writes |

B0 closes with these product and architecture decisions recorded. Hosting creation, CORS/Auth updates, app runtime code, and clinic data access remain in their later milestones; B0 made no hosting or backend changes.
