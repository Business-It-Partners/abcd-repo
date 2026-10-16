# ADR Identity 001 — Host-owned Firebase REST session

**State:** accepted for the declared staging/automated host scope after live Linux and hosted Windows proof; physical-provider matrix deferred. **Date:** 2026-10-16.

Use the existing staging email/password Firebase REST flow in main, then Worker `/v1/me`. This avoids browser localPersistence or refresh tokens in independently updated app renderers. Google endpoints and staging Worker are fixed; no user-selected tenant/project/token URL. The existing clinic account remains the identity; no desktop-only account or Super Admin authority.

Protected remember-me is optional and requires an adequate native key provider. Linux basic_text/unknown/unavailable is refused, with explicit session-only behavior. Lock clears protected refresh state and workspaces; unlock reauthenticates, so restart cannot silently undo a lock. Logout does not revoke other web/device sessions. A generation fence prevents old async responses, snapshots or runtime calls from crossing an account boundary. Clinic permission denial re-resolves Worker authority; Firebase token possession never establishes business permission by itself.

Alternatives: browser auth/localPersistence in each app would disclose/shared-store credentials; arbitrary web login/sideload pages would expand navigation/credential boundaries; a new OAuth/identity backend would duplicate existing infrastructure. None is selected. Production installed-app integration remains dependent on M06/M09, and native keyring behavior must be reviewed on actual supported devices.

Sources: [Firebase Auth REST](https://firebase.google.com/docs/reference/rest/auth), [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage), existing SaaS clinic authentication/controller/session contracts. Decoding JWT claims is not signature verification; Worker resolution remains authoritative. [M05 evidence](../VERIFICATION_EVIDENCE.md) separates live staging checks, controlled negatives and deferred physical checks.
