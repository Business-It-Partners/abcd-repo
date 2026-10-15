# M07 Verification Evidence — First-party store and Cloudflare delivery

**Milestone verification:** NOT YET STARTED.

## Required proof

- Deliver a staging fixture through actual catalogue and R2; verify bytes, identity, authorization, expiry and bounded download.
- Refuse replayed/withdrawn/incompatible releases, altered metadata, unauthorized install policy and URL/token leakage.
- Catalogue outage and interrupted download leave installed apps coherent; readiness follows registry success, not animation completion.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.

## Additional staging-policy acceptance evidence

- Record exact existing fewa_demo repository/branch, GitHub environment/workflow and staging resource map; freeze `/v1/dental-os/...` contracts and prove existing SaaS/Super Admin staging regression checks pass without production mutations.

Not executed. Exact mapping and backend regression proof remain required when this milestone is implemented; this amendment changes documentation only.
