# Dental OS — Identity, Session and Authorization

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Reuse existing Firebase identity and Worker access checks. Login is platform-owned; apps never authenticate separately or store refresh credentials. Resolve /v1/me through the Worker before claiming clinic readiness. Tenant/role/capability are server-derived; installed availability does not authorize data access.

The session manager owns renewal, refresh serialization, expiry/revocation, protected persistence and account switching. Apps receive safe identity/display information and permitted SDK operations, not passwords, refresh tokens or bearer-token retrieval. The exact desktop Firebase flow/credential-provider integration must be proven in M05; do not copy browser localPersistence into app renderers.

After successful sign-in and Worker `/v1/me` resolution, the desktop automatically saves only the encrypted refresh token with a supported native host secret provider. On startup, it refreshes the session and resolves current Worker access before opening the workspace. Users do not need to opt into remembering the device. Separately, the sign-in form may prefill a remembered email address using a default-checked email-only preference; that renderer preference does not control session restoration and never stores passwords, refresh tokens or ID tokens. Turning it off removes the saved email. If protected storage is unavailable or cannot save, keep the current session usable, explain that it ends when the app closes, and never fall back to plaintext. A compromised host user/admin is outside any guarantee of credential invulnerability. See [ADR-031](20_V1_ADR_REGISTER.md#adr-031--device-persistent-session-after-sign-in) and [ADR-032](20_V1_ADR_REGISTER.md#adr-032--remember-sign-in-email-separately-from-session-persistence).

Lock hides sensitive views/previews and gates interactions. Logout invalidates local authority, cancels queued work safely, clears sensitive runtime state and credentials according to user choice/policy. Switching users increments session generation; old responses cannot populate new screens. In-flight writes reconcile without attributing them to the new user.

Worker authorization remains mandatory on every request. A valid Firebase token or local capability list is not sufficient authority. Desktop app capability enforcement is a local boundary; if server-verifiable app identity is later needed, add a designed backend mechanism rather than trusting a client app-ID header.

User Management is shown only to a current admin profile with `clinic_users.manage`; the existing Worker checks that capability again on each account operation. The role and capability come from the current authenticated profile, not an app-owned local user record.

## Clinic workspace role switching — M15 implementation

The Clinic user’s stored account role is unchanged when moving between temporary workspaces. The Worker returns `accountRole`, active `role`, and allowed `workspaceRoles` from `/v1/me`; the OS uses this response for the status-bar **Switch role** menu, app visibility and capabilities. Admin accounts can choose Admin, Doctor or Reception. Doctor and Reception accounts can switch between Doctor and Reception, but cannot enter Admin.

For V1, Admin does not configure a PIN before leaving the Admin workspace. Returning to Admin requires the fixed four-digit PIN `9876`. The OS never persists the entered PIN; the Worker verifies it and rate-limits invalid attempts. Admin-created PIN setup is deferred to V2. The account role still controls which workspaces are allowed, so a Doctor or Reception account cannot enter Admin by supplying the PIN. See the Dental SaaS `SYS-0014` contract for the current lockout policy.

The OS sends role/PIN operations only to the fixed Worker endpoint `PUT /v1/clinic/workspace-role`; bearer credentials remain in the trusted host process. The PIN is included only when returning to Admin. After a successful role change, the host invalidates the prior session generation, app runtimes and capabilities, then resolves `/v1/me` again before restoring access. A role is never saved as an independent local authority. Switching warns that open apps close and unfinished local work can be lost; a pending or uncertain clinic write blocks the transition.

The fixed-PIN Worker contract is deployed to Cloudflare staging on `cloudfare-staging` commit `e802b6ac4d651f1708f4331eb2a67729afa3c8b1` ([successful deploy workflow](https://github.com/Business-It-Partners/dental-saas/actions/runs/40268063042)). Staging `/health` returned 200 with `environment: cloudfare-staging`; unauthenticated `/v1/me` returned the expected 401. This change adds no database migration and reuses the existing lockout-counter table. No clinic credentials were available for authenticated live-switch testing; Worker behavior is covered by its service/controller tests, while the OS client is covered by private session and UI fixtures. Production was not changed.

## Existing staging identity

Reuse the Firebase identity and Worker access configuration belonging to the verified `fewa_demo` staging setup. Do not create a second identity system, modify production users/settings, or add OS-only duplicates of existing identity routes. Confirm Firebase project/API/Worker alignment before integration; never fall back to production to bypass staging login failure. Retain separate Super Admin and clinic authorization. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).


## M05 implemented desktop flow

Trusted main uses existing staging Firebase email/password REST sign-in and coordinated refresh, then Worker `/v1/me` before readiness. Apps receive only safe display context/operation capability; no credentials. M05 originally implemented optional remember-me; the user-directed M15 policy in [ADR-031](20_V1_ADR_REGISTER.md#adr-031--device-persistent-session-after-sign-in) supersedes that opt-in: supported native storage now saves only an encrypted refresh token automatically. Inadequate Linux basic_text/unknown/unavailable storage remains session-only. Lock/logout/switch clear isolated views and generation-bound captures/runtime calls; lock requires reauthentication and clears saved refresh state. See the [original flow decision](../dental-os_v1_working_info/milestone-05-identity-and-session/decisions/ADR_IDENTITY_001_DESKTOP_FLOW.md) and [M05 evidence](../dental-os_v1_working_info/milestone-05-identity-and-session/VERIFICATION_EVIDENCE.md) for the original implementation scope. Logout is local and does not revoke existing web sessions. Device keyring/ACL behavior remains a physical-release gate.
