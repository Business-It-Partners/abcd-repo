# Verified Store install arrival — 2026-10-17

Post-M10 visual regression repair, base main 7378fc83, local branch codex/store-install-arrival. Not M11 and not a change to historical milestone acceptance/checkpoints.

## Cause and behavior

The real Store introduced in M07 updated installed state but never triggered the earlier prototype celebration. Its vector artwork also lacked the image-only source contract used by that animation.

Successful explicit first installation now hands off to the same 2050-ms lift/flight/soft landing. The existing curve, velocity envelope, contact effects and shared dock field remain. Artwork cloning supports current trusted vector spans and earlier image elements. New installed apps append to the right end of the app icons within the current workspace. Restored startup ordering is initialized from installed catalogue/registry state; custom persistent dock ordering is not introduced.

The hook records an in-flight installation before invoking the platform, waits for ok, and fences callbacks by the current hook/session lifetime. A newly committed icon remains hidden until the arrival owns it, preventing a success flash before the flight. Startup, refresh, cancelled/failed operations and staged updates do not celebrate. Open stays available during flight and settles it immediately. Other management actions wait for settlement. Ready feedback has an app-specific accessible Open name.

Missing/hidden Store artwork, overview, host transitions, viewport resize, other window motion and reduced motion settle to a visible installed icon. Cleanup runs in the layout phase so overview clones cannot retain source fading. The shared Genie geometry, native bridge, verifier, backend and business authority are unchanged.

## Actual verification

Controlled Linux x64 jobs, one at a time with nice 10/timeouts, private headless GNOME/Wayland profiles. No live desktop focus/restart, cloud calls or dependency installation.

- Build/typecheck passes: [log](verification/store-install-arrival-2026-10-17/dental-store-arrival-layout-build.log).
- `npm test -- --maxWorkers=1`: 255 pass / 12 files: [log](verification/store-install-arrival-2026-10-17/dental-store-arrival-unit.log).
- New real-Store renderer fixture: 20 checks, including original vector flight/timing/contact, committed registry before celebration, hidden dock icon, right-end insertion, catalogue/detail installs, immediate Open, cancellation, failed install, reduced motion, overview, resize, update and relaunch behavior: [report](verification/store-install-arrival-2026-10-17/delivery-arrival-verification.json).
- Existing distribution 10, updates eight, integrated 23 and runtime 28 checks pass: [arrival/Store log](verification/store-install-arrival-2026-10-17/dental-store-arrival-ui-final.log), [regression log](verification/store-install-arrival-2026-10-17/dental-store-arrival-regressions.log).
- [Inspected mid-flight screenshot](verification/store-install-arrival-2026-10-17/delivery-install-flight.png) shows vector artwork leaving the Store and heading toward its dock landing well.
- Superseded test failures retained: first harness required main-context process.mainModule.require; second exposed stale faded overview clone, repaired by layout-phase cleanup. They are not counted as passes.

[Authored source hashes](verification/store-install-arrival-2026-10-17/source-sha256.json) identify the verified repair source captured before its local commit. No Windows CI or physical-device claim for this follow-up; earlier milestone evidence remains tied to its checkpoint. `npm run test:store-arrival` runs the focused private suite. A full later Dental OS launch loads the built update; no running session was reloaded.
