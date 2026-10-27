# Dental OS Browser Edition — Status

- **Updated:** 2026-10-27
- **Worktree:** `browsre-verion`
- **Branch:** `browser-veriosn`

## Current state

**Overall status: B0 COMPLETE — B1 COMPLETE — B2 IN PROGRESS.** V1 targets Brave only; support for other browsers is deferred until all V1 milestones are complete. The browser shell and first-party static dock are implemented, with preview-only app windows. B2 now follows the desktop identity flow in the browser: a five-second minimum brand splash while Firebase restores the saved session, then the clinic sign-in screen or workspace. Valid staging sign-in and saved-session restoration now succeed in an isolated browser; token refresh, sign-out, and failure-state acceptance remain.

The browser edition now has a browser-owned desktop shell with the Dental OS wallpaper, static first-party app dock, URL-hash app routes, movable/minimizable/resizable preview windows, and an optional user-triggered full-screen view. Its home screen now includes the desktop-style status bar, clinic profile, and calendar/time widgets; development and app-update panels remain excluded. Battery status is shown only if Brave exposes a live reading. Visual acceptance of these new widgets remains pending. `npm run dev:browser` remains an offline preview at `http://127.0.0.1:4280` with `connect-src 'none'`. `npm run dev:staging` starts a connected local mode at `http://localhost:3003`, loads Firebase Auth with the existing staging Web SDK config, and calls only the staging Worker's read-only `/v1/me` route. The dock remains hidden until the Worker returns clinic capabilities; app windows are still preview-only and no clinic workflow writes exist.

The local shell is not an authenticated clinic workflow or app-runtime acceptance. The offline preview at `http://127.0.0.1:4280` intentionally makes no API calls and is not a staging CORS origin. The connected staging mode uses `http://localhost:3003`, which the existing Worker CORS policy allows. B1 and B2 made no SaaS source, Firebase configuration, Worker, or deployment changes.

Read-only staging review is recorded in [Architecture baseline](ARCHITECTURE.md). Firebase CLI confirmed that existing staging Hosting sites have live releases; none was overwritten. The local SaaS checkout had unrelated uncommitted changes, which were left untouched.

## Milestone state

| ID | Status | Current evidence / remaining work |
| --- | --- | --- |
| B0 — Browser product and architecture baseline | COMPLETE | User direction, staging facts, Brave-only V1 support, architecture decisions, and browser-specific acceptance strategy are recorded. No hosting resource or backend configuration was changed. |
| B1 — Browser foundation and shell | COMPLETE | Browser entry, desktop shell, static dock, app routes, preview windows, and Brave layout/startup acceptance are complete. No Electron APIs are used. |
| B2 — Staging identity and role access | IN PROGRESS | Firebase sign-in, browser-local session persistence, token refresh handling, sign-out, read-only `/v1/me`, and capability-filtered dock are implemented. A valid staging login and saved-session restoration have been verified in an isolated browser; /v1/me returns its clinic data inside a session envelope, which the browser now unwraps. Login recovery uses the sign-in form without extra retry/sign-out buttons. Token refresh, sign-out, and failure-state acceptance remain. |
| B3 — First-party app catalog and isolated runtime | PLANNED | No browser app registry, app runtime, or isolation mechanism exists. |
| B4 — First end-to-end clinic app | PLANNED | Representative app and staging workflow are not selected or integrated. |
| B5 — App migration and experience parity | PLANNED | No app migrations or browser parity acceptance have been completed. |
| B6 — Browser staging readiness | PLANNED | No browser staging deployment or acceptance run has occurred. |
| B7 — Production readiness and release decision | DEFERRED | Production work remains outside the current staging scope and requires separate explicit approval. |

## Verification record

Firebase Hosting site listing and release-channel inspection were read-only. B1 used isolated headless Brave 148.1.90.121 to inspect the shell and placeholder-window controls. The B2 browser check loaded the pinned Firebase SDK in isolated Brave, showed sign-in with the dock hidden before authorization, confirmed unauthenticated staging `/v1/me` returns 401 without clinic data, and checked the sign-in layout at 320px. A browser request with an Authorization header also reached the Worker and returned the expected 401, confirming the connected origin's preflight/CORS path. Focused role-filter tests pass for admin, doctor, reception, and missing capabilities. The new desktop-style splash/sign-in layout was inspected in an isolated browser at 780×493 and 320×600, with no horizontal overflow and the sign-in button visible at both sizes. On 2026-10-27, a valid staging login and saved-session restoration were verified in an isolated Playwright browser: Firebase accepted the account, the Worker returned 200 for /v1/me, and the session capabilities opened the authorized dock. This exposed and fixed the browser's incorrect assumption that clinic data was at the response top level instead of under session. Both extra login-screen buttons (saved-session retry and account sign-out) have now been removed; users can re-authenticate through the sign-in form. Token refresh, sign-out, and invalid-credential/401/403/503/network recovery acceptance remain. No SaaS source, Firebase configuration, Worker, or deployment was changed.
