# M05 Verification Evidence — Single login and protected sessions

**Milestone verification:** NOT YET STARTED.

## Required proof

- Use approved staging accounts to test real login, token renewal, denial, disabled access and unavailable backend.
- Test unavailable/inadequate Linux key storage: session-only behavior and no plaintext persisted credentials.
- Switch users during in-flight responses/writes; old data never enters the new session; no app receives password/refresh token.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.

## Additional staging-policy acceptance evidence

- Verify existing staging Firebase/Worker mapping, clinic/Super Admin authority separation and unchanged web login behavior; never modify production identity configuration.

Not executed. Exact mapping and backend regression proof remain required when this milestone is implemented; this amendment changes documentation only.
