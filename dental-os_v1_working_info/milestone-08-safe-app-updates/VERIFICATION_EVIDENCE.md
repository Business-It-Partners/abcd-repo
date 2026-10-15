# M08 Verification Evidence — Safe independent application updates

**Milestone verification:** NOT YET STARTED.

## Required proof

- Run old app during new download: unchanged running assets/session; next permitted launch selects verified successor.
- Inject interruption at every persistence/activation boundary, repeated operations and failed health checks.
- Test dirty work, ambiguous in-flight writes, incompatible rollback, revoked versions, key rotation and storage exhaustion.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.

## Additional staging-policy acceptance evidence

- Prove channels, withdrawal/revocation and minimum-version metadata affect staging releases only and preserve existing clients; do not modify production feeds or pointers.

Not executed. Exact mapping and backend regression proof remain required when this milestone is implemented; this amendment changes documentation only.
