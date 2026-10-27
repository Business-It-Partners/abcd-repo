# App Bringing — Browser integration boundary (2026-10-27)

## Scope and invariants

- Target branch: `app-bringing` from `browser-version` at `544646105fc75292f88337bd68ac9fd4c9f50376`.
- Read-only reference: `main` at `90f4a47c91e2cb983e7bfd683f3c6ee040f24177`. **Never merge/copy Electron shell, preload, IPC, broker or installer.**
- Preserve existing browser Firebase Auth, Worker `/v1/me` session handling, static capability-filtered dock, URL-hash routes, managed window focus/drag/minimize/maximize/close.
- No app Store, installer, Genie, OS update, background persistence, service-account credentials, production endpoints, or new backend.
- Browser Preview is disconnected by design: no Worker requests. Connected browser staging remains at `localhost:3003`.
- Worker verifies identity, clinic, role and authorization on every call. The browser must not determine tenant, role, privileges or business truth.

## Ownership boundary — BEFORE shell/auth editing

1. `main.js`: owns existing auth and desktop lifecycle. Its only app-related change is an **app content mount/unmount hook** invoked from the existing `createWindow` / close lifecycle. Keep auth callbacks, Firebase token ownership and window mechanics unchanged, except a narrowly reviewed host bridge invocation.
2. `apps/browser/catalog.js`: known first-party app IDs, version labels, exact read-route grants and presentation metadata. No untrusted dynamic catalog.
3. `apps/browser/host.js`: creates isolated iframe per authorized window, owns `MessageChannel` capability exchange, validates app identity/nonces, schema, bounded request sizes, route/method allowlists, and obtains Firebase access tokens **from a closure owned by `main.js`** only for approved Worker requests. Never passes a token to an iframe. Cancels pending work on window close/session change. Host reports errors without leaking credentials.
4. `apps/browser/frame.html` + `frame.js` + `modules.js` + `frame.css`: sandboxed first-party application content; no `window.dentalApp`, Electron preload, IPC, Firebase client, direct Worker access, or mutable host globals. Reads only via a session-bound MessagePort. No localhost API base URLs inside frame code.
5. `tools/dev-server.mjs`: serve exact allowlisted app assets and enforce browser CSP. Frame: sandboxed without `allow-same-origin`, `connect-src 'none'`, no forms/popups/top-navigation. Parent `frame-src 'self'` for same-host app resources. Connected host alone may contact staging Worker.
6. Worker calls start as **read-only** (GET) until synthetic staging write fixtures, conflict/idempotency behavior, and route-specific role-denial tests exist. Display no save controls that would suggest successful writes. Never send real patient data to mocks or preview.
7. Presentation should preserve dock icon assets and take workflows/routes/labels from M17 sources; browser port must be judged against the source, not just a generic data viewer. Gaps are recorded per app.

### Session/protocol

- Parent creates one sandboxed iframe with a fresh random launch nonce and `MessageChannel`. Handshake is sent to the exact expected frame `contentWindow` using `postMessage`; the frame must match the parent source and nonce before accepting a transferred port. MessagePort is closed on unmount.
- Frame request schema: `{type:'read', id, path}`; host response: `{type:'response', id, ok, data?|error?}`. No arbitrary URLs, origin switches, HTTP verbs, or application-provided headers. Host accepts only GET on app-specific route expressions. Paths must begin with `/v1/` and contain no traversal, encoded slashes, fragments or credentials. Bounded concurrency and response sizes.
- Host sees an authorized **Worker session**, not a frame-provided role. `main.js` verifies dock access for the app before mount, and the host also checks that app access remains authorized at request time. Session generation and app identity are frozen at launch.
- Frame CSP and sandbox are defense in depth; Worker remains final authorization.

## Source-to-browser mapping (M17 current first-party packages)

| Browser ID | Read-only Electron package on `main` | Existing icon | Source workflow / read endpoint | Port gaps |
| --- | --- | --- | --- | --- |
| `appointments` | `company.dental.appointments.m17` | `assets/dock/appointments.webp` | Diary, staff refs, summary, `/v1/appointments` | Booking/status writes; deep calendar design |
| `patients` | `company.dental.patient-record.m17` | `assets/dock/patients.webp` | Patient search/registration/context, detail and clinical tabs, `/v1/patients` | Intake edits, case chart, media and radiographs |
| `calendar` | `company.dental.calendar.m17` | `assets/dock/calendar.webp` | BS calendar and clinic tasks, `/v1/calendar-tasks` | Task creation/status/archive |
| `finance` | `company.dental.finance.m17` | `assets/dock/finance.webp` | Eight finance workspaces, transaction, payments, expenses, products, purchases, suppliers | All financial write workflows |
| `followups` | `company.dental.followups.m17` | `assets/dock/followups.webp` | Follow-up worklist and staff references, `/v1/follow-ups` | Create, toggle, reschedule and reconciliation |
| `staff` | `company.dental.staff.m17` | `assets/dock/staff.webp` | Staff directory and profiles, `/v1/clinic/staff` | Management, documents and salary workflows |
| `lab` | `company.dental.lab-tracker.m17` | `assets/dock/lab.webp` | Lab order queue and suppliers, `/v1/lab-orders` | Assign, update, supplier write |
| `treatment` | `company.dental.treatment-progress.m17` | `assets/dock/treatment.webp` | Ongoing treatment status, `/v1/treatment-progress` | Case drill-down parity |
| `protocols` | `company.dental.m17.treatment-protocols` | `assets/dock/protocols.webp` | Treatment protocol library, `/v1/treatment-protocols` | Protocol editor/save and version conflicts |
| `workentry` | `company.dental.work-entry.m17` | `assets/dock/workentry.webp` | Active cases, `/v1/work-entry/cases` | Charting, treatment, commit/finalization |
 
## Reusable vs Electron-specific

- Reusable references: M17 React/TSX designs, pure date/validation/formatting logic, API routes, staging Worker response envelopes, workflow labels and static first-party icon artwork. The browser branch already vendors `nepali-date-utils`.
- Electron-only: `ClinicClient` transport using `window.dentalApp`, SDK lifecycle/reporting, preload/broker/IPC, package installer/update + local filesystem capabilities. **Do not transfer these dependencies.**
- React/TSX cannot be dropped directly into the existing no-build browser edition; exact component parity requires an explicit bundled build and adaptation of SDK imports, styling and per-app permissions.
- Browser edition must not claim full app parity, full write workflows, or staging end-to-end validation until those have been exercised.

## Acceptance gates

1. Static test: only ten known modules; source mapping, least-privilege routes, rejecting unauthorized paths and no Electron references.
2. `npm test` from branch, plus a browser smoke for each app inside existing windows in Brave; preview never contacts Worker.
3. With a **synthetic** staging clinic: Firebase sign-in/out/refresh, GET readback per authorized app; 401/403 and role changes fail closed; frame cannot read token or request direct network access.
4. Clinical writes/media/finance actions require separate implementation and verified synthetic staging fixtures. Until then mark each as pending — do not simulate success.
5. Never merge this branch; preserve original `main` and `browser-version`.
