# M04 Verification Evidence — Internal SDK and API boundary

**Milestone verification:** NOT YET STARTED.

## Required proof

- Negative cases: spoofed app/frame, malformed/oversized requests, forbidden URLs/redirects/channels and stale sessions.
- Transport fixtures prove conflict, timeout, 401/403/503, ambiguous write result and preserved idempotency semantics.
- Compatible/incompatible SDK handshake and cleanup; no arbitrary authenticated fetch, token getter or direct app messaging.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

No milestone-governed runs recorded. Existing WORK_CHECKLIST.md/artifacts evidence is historical until reconciled and rerun where required. Planned checks above are not test results.

## Platform and user acceptance

Windows: not verified. Linux: not verified for this production milestone. User acceptance: pending. For M01, these runtime fields are not applicable to documentation verification; no host runtime claim follows.

## Additional staging-policy acceptance evidence

- Verify broker environment binding uses the mapped staging API, rejects mixed/production fallback configuration, and preserves existing business routes; OS services alone use `/v1/dental-os/...`.

Not executed. Exact mapping and backend regression proof remain required when this milestone is implemented; this amendment changes documentation only.
