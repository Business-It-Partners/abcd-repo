# M05 Implementation Notes — Single login and protected sessions

## Starting point and source mapping

M04 is verified/integrated at main `4ad8e32f`. Staging repository, branch/GitHub environment, source SHA, Worker/Firebase/D1/R2/workflow mapping is unchanged from [M04 notes](../milestone-04-sdk-and-api-broker/IMPLEMENTATION_NOTES.md). Live Worker health additionally confirms cloudfare-staging; no deployment SHA is inferred from that response. The SaaS worktree and its unrelated untracked files were not modified.

## Implemented flow

`electron/identity/client.ts` uses the existing Firebase email/password REST sign-in and securetoken refresh endpoints in trusted main, followed by existing Worker `/v1/me`. Project audience/issuer/subject/expiry are checked as configuration guards; only the Worker establishes verified clinic authority. Super Admin-shaped responses cannot establish a clinic session. The Firebase Web API key is public project configuration, not a service/admin credential. No new auth/backend route or identity store.

`session.ts` owns ready/locked/signed-out/expired/unavailable transitions, platform generations, one renewal flight, bounded identity/Worker requests, proactive renewal, safe display context and capability intersection. Every renewal re-resolves Worker authority. A 401 expires authority; operation 403 rechecks `/v1/me` without confusing a valid clinic session with Super Admin privileges. Denied/changed membership clears old workspaces. Logout/switch/lock cancel pending identity work and invalidate app connections; old write outcomes cannot enter the new account. No automatic business write retry. Logout is local sign-out; no global token revocation or web-session interruption is claimed.

`storage.ts` atomically stores only an encrypted refresh-token record for optional remember-me. Password and ID token are never persisted. Restricted directories/files, size limits, regular-file/symlink/mode checks, exclusive temporary ciphertext files, fsync and rename protect this record. Provider failure uses explicit session-only login; no plaintext fallback. `provider.ts` binds Electron safeStorage with Linux backend allowlist, rejecting basic_text/unknown/unavailable. The observable synchronous key-provider API is used for short protected records; native keyring access can involve OS prompts, and physical supported-provider behavior remains a device gate. Windows uses OS protection/DPAPI; same-user/admin compromise is outside its guarantee.

`src/IdentityGate.tsx` gates the normal desktop until sign-in and Worker resolution. Safe identity view is the only shell output; forms clear password and previous account identifier/remember choice. Lock/sign-out/switch destroy isolated runtimes/captures and remount shell workflow state. Session controls and gated Exit are available. `SessionBoundary.tsx` binds shell capture/layout/restart to the owning generation; main rejects stale/locked calls before/after capture. Host screen-lock/suspend also lock; lock clears remembered refresh credentials so relaunch cannot silently undo the lock. Pending storage cleanup is flushed before quit.

The M04 broker intersects fixed first-party app operations with Worker-provided clinic capabilities. SDK apps cannot get passwords/refresh/ID tokens or shell login channels. `runtime.clearSession` revokes connections, destroys native views, drops images and timers. Normal prototype content remains synthetic; independent installed packages and business application delivery remain later milestones.

## Test modes and boundaries

Legacy private-display/Windows-CI regressions retain explicitly synthetic bypass mode; it cannot activate on an ordinary desktop launch. `--identity-fixtures` under those guards exercises complete shell/session integration with synthetic identity, including unavailable secret storage. `--identity-staging` in the private runner exercises actual staging sign-in. These modes are not production authentication fallbacks.

Unit storage uses a test encryption provider; the hosted Electron check also probes actual native protection when adequate. Linux private backend was basic_text and correctly offered session-only login. Positive GNOME/KWallet physical-device coverage is not claimed. Effective Windows ACL/device behavior remains deferred after M11/before release.

## Live acceptance and resource protection

Approved existing staging credentials were supplied by the user, consumed only from temporary mode-0600 files outside the repository and deleted afterward. Reports omit account identifiers, passwords, tokens, tenant IDs and patient data. Read-only identity acceptance proves real login, Worker resolution, renewal, invalid token/grant refusal, clinic/Super Admin separation, local logout and stale-generation refusal. Actual private desktop login/lock/logout also passed. Disabled membership and unavailable-backend transitions are controlled fixtures; no live user/tenant was disabled and no outage induced. No business API mutations, user provisioning, password changes, production configuration, or deployment.

One heavy job at a time with preflight, timeouts, low priority and private profiles. No live OS/Brave interruption. A later user-controlled full relaunch loads the new normal staging sign-in gate.
