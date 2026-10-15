# M03 Verification Evidence — Isolated runtime and shared shell

**Milestone verification:** NOT YET STARTED.

## Required proof

- Prove overlap, z-order, clipping, scoped dialogs, fullscreen, resize, keyboard focus, overview, dock reveal and Genie.
- Reject cross-app storage, unapproved navigation, Node/host privilege and forged runtime identity.
- Crash/hang one sample runtime and record actual containment; repeat close/minimize/restore and inspect leaked resources.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.
