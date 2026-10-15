# M06 Verification Evidence — Verified packages and local lifecycle

**Milestone verification:** NOT YET STARTED.

## Required proof

- Reject unsigned/altered assets/manifests, unknown publishers/IDs, incompatible SDK/API, invalid entry paths and forged identity.
- Test traversal, links/reparse points, excessive expansion/count, disk exhaustion, concurrent operations and crash checkpoints.
- Restart resolves pending operations; only active verified bytes execute; uninstall affects neither SaaS records nor other app files.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.
