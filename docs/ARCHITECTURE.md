# Dental OS Browser Edition — Architecture Baseline

- **Milestone:** B0 — Browser product and architecture baseline
- **Status:** B0 architecture baseline recorded
- **Reviewed:** 2026-10-27

This is the browser edition's architecture record. It does not reuse Electron runtime requirements. B1 supplies the browser shell; its app windows are preview placeholders, and staging authentication and app isolation are later milestones.

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
2. The browser host calls the existing Worker with `Authorization: Bearer <Firebase ID token>` and uses `GET /v1/me` to load the backend-authoritative clinic session.
3. The Worker remains the authority for identity validation, tenant resolution, role/capability checks, and business data. The browser never selects a tenant, D1 binding, or trusted role for an API request.
4. The host owns a small browser API client that attaches tokens only to approved route/method grants. App frames do not receive Firebase tokens or Firebase Auth credentials.
5. Sign-out clears the host session and closes app frames. Expired sessions fail closed and require the normal sign-in flow.

This does not require the Electron native broker or its preload SDK. The browser host API client is the browser-specific credential bridge required for one login and isolated apps; it calls the existing SaaS Worker, which performs final authorization. The first B2 slice requests only `/v1/me`; it derives dock visibility from the Worker's returned capabilities and does not trust a client-selected role. App data routes and app workflows remain for later milestones.

### B2 local setup

- Keep the offline preview at `http://127.0.0.1:4280`; its CSP blocks outbound connections.
- Use `npm run dev:staging` at `http://localhost:3003` for connected staging sign-in. This origin is already allowlisted by the deployed staging Worker.
- `config/staging-firebase.json` contains only the staging Firebase Web SDK's public client fields copied from the SaaS staging frontend. It contains no Firebase service-account or Worker credentials.
- The browser loads the same pinned Firebase JS SDK version used by the SaaS client and lets Firebase manage local session persistence and token refresh.

### App isolation and delivery

**Baseline model for B3:** render each first-party app in a sandboxed iframe with scripts enabled and same-origin access disabled. Give each launch a host-created `MessageChannel` bound to the trusted app ID, immutable version, and launch nonce. The host accepts only schema-checked API requests within that app's route/method grants; it rejects arbitrary URLs and never returns the Firebase token. App frames have no direct Worker connection. B3 must verify this boundary and review any browser compatibility constraints before accepting the runtime.

Deliver only company-approved first-party app bundles from trusted browser distribution. Use immutable versions and verify trusted app metadata and bundle identity before launch. Define the exact signing and update mechanism in B3 before implementing app delivery.

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
| B2 | Verify Firebase sign-in/out, refreshed and expired ID tokens, `/v1/me`, role-filtered navigation, Worker-side denials, and network/maintenance states against staging. Begin with reads only. |
| B3 | Verify frame isolation, token non-disclosure, blocked direct app networking, message schema/nonce checks, per-app route grants, and Worker denial of unauthorized requests. |
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
| App isolation | Sandboxed app frames with no same-origin access; narrow host-mediated `MessageChannel` | Baseline for B3; security and compatibility checks required |
| First write data | Designated synthetic staging clinic/records after read-only integration succeeds | Baseline for B4; exact workflow and cleanup to be recorded before writes |

B0 closes with these product and architecture decisions recorded. Hosting creation, CORS/Auth updates, app runtime code, and clinic data access remain in their later milestones; B0 made no hosting or backend changes.
