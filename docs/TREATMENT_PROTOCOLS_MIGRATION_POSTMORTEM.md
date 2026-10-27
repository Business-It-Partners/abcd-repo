# Treatment Protocols browser migration — postmortem

- **Date:** 2026-10-27
- **Milestone:** B4, first end-to-end clinic app
- **State:** Useful migration/UI integration is present; full B4 workflow acceptance is still open.

This records the confirmed problems encountered while bringing the Dental OS Treatment Protocols UI into the browser edition. It is a reusable incident log, not a claim that every transient failure was captured.

## What caused delay, and what fixed it

| Problem | Why it failed or slowed the work | Fix and lesson for the next app |
| --- | --- | --- |
| The local host could not resolve the Treatment Protocols asset manifest. | The app manifest is a module used by the browser host, but the small local dev server did not serve the nested `/apps/treatment-protocols/asset-manifest.js` path. The host could not reliably initialize its app catalog/runtime assets. | Added the explicit dev-server asset mapping and a regression assertion. When adding an app, check every generated asset path through the actual local server, not just the source tree or build output. |
| The isolated app package was sensitive to stale/mismatched generated files. | The browser runtime checks the entry, JavaScript, stylesheet, SRI, CSP hashes, and catalog hashes together. Editing or rebuilding only part of that set makes the package fail closed. | Generate the app entry and its integrity/CSP values from the same final build bytes, then regenerate the catalog manifest and verify the served files as a set. Never hand-edit one hash or assume a successful TypeScript build proves the iframe can start. |
| App startup could miss the one-time host handshake. | Registering the message listener from a React effect happens after the module loads and can be later than the host's iframe initialization message. If the one-time message arrives first, the app waits forever. | Register `connectBrowserRuntime()` at module evaluation, before React mounts, and retain the regression check. For future apps, make listener installation precede any host message that is not retried. |
| Desktop app dependencies did not fit the browser trust boundary. | The source UI expected the desktop session/API path and desktop-style navigation lifecycle. Reusing those assumptions inside an opaque browser iframe would couple the app to native code and could bypass the browser host's credential boundary. | Keep the UI, but replace its session/API dependency with the host-mediated browser client and adapt history/lifecycle handling. Tokens stay in the host; the app gets only its exact route grants over the private channel. Audit imports for Electron/native dependencies before declaring a port complete. |
| A local staging origin failed CORS while another worked. | Firebase sign-in could succeed while the API call to `/v1/me` failed, because the local origin/port used for that attempt was not in the Worker's allowlist. | Use the already-allowlisted `http://localhost:3003` staging origin and verify preflight plus the authenticated API route. Do not loosen CORS just to make an arbitrary local port work. |
| Preview looked like the app was still disconnected. | Browser Preview has a synthetic session, blocks clinic networking, and intentionally cannot prove an authenticated clinic workflow. Its preview-only or verified-session-required screen is expected behavior. | Use Preview for isolated UI iteration; use the approved staging origin for authenticated read-only acceptance. Never put clinic credentials in Preview or treat a Preview screenshot as staging acceptance. |
| The first successful list was mistaken for end-to-end completion. | An authenticated `GET` proves sign-in, app launch, the read grant, and list rendering; it does not prove create/update, role denial, uncertain-write recovery, readback, or cleanup. The visible staging data includes test-labelled rows, but the clinic and rows were not confirmed as synthetic. | Keep B4 open until an exact synthetic target, role, workflow, and cleanup plan are established. No business writes were made during this migration. Preserve this gate for future apps instead of treating a successful build or list page as workflow acceptance. |

## Verified outcome

- The Treatment Protocols UI is packaged as an isolated browser app and uses the host's bounded API bridge.
- The host grants only `GET /v1/treatment-protocols`, `POST /v1/treatment-protocols`, and UUID-scoped `PUT /v1/treatment-protocols/{uuid}` for `treatment_protocols.manage`.
- App build and TypeScript typecheck passed; the root focused unit suite passed 16/16 after the startup-listener regression check was added.
- An isolated staging Admin session loaded the app; the list request returned 200 and rendered 22 rows. No protocol was changed.
- B4 remains active pending approved synthetic test records and the remaining workflow/denial/retry/readback/cleanup evidence.

## Reusable migration sequence

1. Inventory the source app's desktop-only imports, session assumptions, routes, API calls, and dirty-work/close behavior before copying UI code.
2. Define exact browser capabilities and routes; keep credentials and authorization in the host.
3. Port the UI behind the browser client and browser history adapter; preserve its existing clinic UI behavior and save guards.
4. Build the isolated package, regenerate every hash/manifest, and request every asset through the local host.
5. Verify handshake timing, package integrity failure, capability denial, and the actual browser window launch before clinic testing.
6. Keep Preview and authenticated staging checks separate. Verify CORS for the exact origin.
7. Start with read-only staging checks. Before writes, identify synthetic records and cleanup expectations; then collect write, role-denial, retry, readback, and cleanup evidence.

The most useful correction to our process is to make the package/server/handshake checks an early gate. We spent time debugging the visible app startup before proving that all generated assets were being served and that the iframe could receive its first message. The later staging-data gate is a separate safety prerequisite, not a code defect.
