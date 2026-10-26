# M19 Implementation Notes — Dock, Applications, and Window Audit

## Starting baseline

The read-only Segment 3 audit used commit b11a4b12 on codex/app-store-infrastructure-audit in the user-requested worktree. It found the shared shell/runtime foundation already in place, a dock launch lock that can ignore a concurrent click, older dock/overview test assumptions that exceed the two-window policy, a launch-fade timing assertion that failed, and no completed current-source crash/restart UI run.

## Implementation record

- **M19.1:** Replaced the global app-launch lock with a per-app launch lock. A discovery request for one app no longer blocks another app's dock click; duplicate requests for the same app remain coalesced. Added a private delayed-discovery fixture and concurrency regression.
- **M19.2:** Kept the two-app cap and existing explicit close-or-cancel flow. Updated dock, overview, Finance, and capacity UI checks to current company-app/window behavior. Verified window activation, switching, minimize/restore, maximize/restore, close/reopen, and narrow-dock fit.
- **M19.3:** Expanded isolated runtime recovery verification to crash one renderer, keep the shell and another app interactive, restart/reopen the failed app, recover from invalid package bytes, and block restart while a server write outcome is unknown.
- **M19.4:** Updated stale UI expectations and made launch-feedback timing check minimum foreground duration, readiness and handoff state without relying on an exact animation frame. Test reports now use M19-specific filenames so historic milestone evidence is preserved.

Only `electron/main.ts` and `src/App.tsx` plus the new `src/appLaunchLock.ts` change product behavior. The Electron fixture flag is restricted to private test fixtures. No Genie geometry or app-store bucket behavior changed.

## Ownership and boundaries

The shell owns dock interactions and window controls. The isolated runtime owns app lifecycle and recovery. App-specific work remains in the app package. The two-open-window V1 policy remains unchanged. The Genie effect remains visual polish and is not an architecture or compositor workstream.

M19 uses the existing app-store-infrastructure-audit worktree. No separate branch/worktree, new acceptance gate, or change to G12/G15/G20/G21 is part of this plan.

## Change log / deviations

No change to the two-app limit, package trust policy, Genie geometry, or other milestone gates. A full-suite timeout and broad integration fixture startup limitation are recorded in [the evidence ledger](VERIFICATION_EVIDENCE.md); focused M19 verification passed.
