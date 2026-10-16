# Dental OS — Identity, Session and Authorization

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Reuse existing Firebase identity and Worker access checks. Login is platform-owned; apps never authenticate separately or store refresh credentials. Resolve /v1/me through the Worker before claiming clinic readiness. Tenant/role/capability are server-derived; installed availability does not authorize data access.

The session manager owns renewal, refresh serialization, expiry/revocation, protected persistence and account switching. Apps receive safe identity/display information and permitted SDK operations, not passwords, refresh tokens or bearer-token retrieval. The exact desktop Firebase flow/credential-provider integration must be proven in M05; do not copy browser localPersistence into app renderers.

Remember-me requires a supported host secret provider. Detect unavailable/inadequate Linux storage; use session-only login, never a silent plaintext fallback. Never persist passwords or backend service credentials. A compromised host user/admin is outside any guarantee of credential invulnerability.

Lock hides sensitive views/previews and gates interactions. Logout invalidates local authority, cancels queued work safely, clears sensitive runtime state and credentials according to user choice/policy. Switching users increments session generation; old responses cannot populate new screens. In-flight writes reconcile without attributing them to the new user.

Worker authorization remains mandatory on every request. A valid Firebase token or local capability list is not sufficient authority. Desktop app capability enforcement is a local boundary; if server-verifiable app identity is later needed, add a designed backend mechanism rather than trusting a client app-ID header.

## Existing staging identity

Reuse the Firebase identity and Worker access configuration belonging to the verified `fewa_demo` staging setup. Do not create a second identity system, modify production users/settings, or add OS-only duplicates of existing identity routes. Confirm Firebase project/API/Worker alignment before integration; never fall back to production to bypass staging login failure. Retain separate Super Admin and clinic authorization. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).


## M05 implemented desktop flow

Trusted main uses existing staging Firebase email/password REST sign-in and coordinated refresh, then Worker `/v1/me` before readiness. Apps receive only safe display context/operation capability; no credentials. Optional remember-me stores only native-encrypted refresh state; inadequate Linux basic_text/unknown/unavailable storage is refused with session-only login. Lock/logout/switch clear isolated views and generation-bound captures/runtime calls; lock requires reauthentication and clears remembered refresh state. See [flow decision](../dental-os_v1_working_info/milestone-05-identity-and-session/decisions/ADR_IDENTITY_001_DESKTOP_FLOW.md) and [evidence](../dental-os_v1_working_info/milestone-05-identity-and-session/VERIFICATION_EVIDENCE.md) for exact live/fixture/platform scope. Logout is local and does not revoke existing web sessions. Device keyring/ACL behavior remains a physical-release gate.
