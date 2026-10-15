# Dental OS — Boot and Workspace Lifecycle

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

## Startup sequence

1. Host launches the installed Dental OS entry point; repeated launch activates the existing permitted instance/session.
2. Initialize trusted configuration, supported credential provider, local registry and bounded diagnostics.
3. Reconcile interrupted installs/updates; quarantine invalid state without deleting evidence or claiming readiness.
4. Start shell with explicit starting/ready/recovery state; expose installed package readiness separately from authentication readiness.
5. Restore safe preferences/layout; do not reopen patient content before authentication.
6. Authenticate or restore a valid session, resolve server access, then allow authorized app operations.

## Distinct transitions

Internal minimize preserves app runtime and unfinished state. Whole-environment minimize preserves the session. Lock hides sensitive surfaces and blocks access until permitted unlock. Logout invalidates local user-scoped authority. Exit ends processes after unfinished-work handling. Closing an app must not imply logout or uninstall.

Initial instance policy: one active signed-in user session per desktop environment; one running instance of an app in that session. Account switching is a controlled session transition, not a second concurrent clinic context.

Reject a stale asynchronous response after session generation changes. Full exit must not claim persistence of in-memory drafts. Crash restart offers only recovery supported by actual durable records.

The current installed launcher and native minimize continuity are prototype foundations, not proof of the future authenticated startup path.
