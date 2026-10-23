# M15 auth persistence decision — 2026-10-23

**Product decision:** after the first successful sign-in, Sajilo Dental should reopen directly into the clinic workspace while that session remains valid. Email/password entry is required again after sign-out, explicit Lock, session revocation/expiry that cannot be refreshed, or when no saved session exists.

## Behavior

- Show the branded startup splash while checking the saved session.
- On successful Firebase refresh, resolve the current clinic through Worker `/v1/me` before opening the workspace.
- Save only the refresh token through the existing native `safeStorage`-backed `CredentialStore`; never save the password or ID token.
- Do not ask the user to opt into remembering the device. Normal app close keeps the protected session; Sign out and Switch account remove it.
- The sign-in form has a separate, default-checked **Remember me** preference for the email address only. It never stores a password, refresh token, or ID token and does not control protected session restoration; turning it off removes the remembered email.
- Lock continues to clear the saved token and all in-memory workspace/runtime state, requiring sign-in on unlock and preventing a relaunch from silently undoing a deliberate lock.
- If the OS protected-storage provider is unavailable or saving fails, allow this login but explain that it lasts only until the app closes. Never fall back to plaintext.

## Why

This removes repeated login friction while keeping Dental SaaS/Firebase and the Worker as identity and clinic-access authorities. Startup restoration verifies the session again, so a saved token alone never grants workspace access. The existing M05 restrictions still apply: Linux `basic_text`/unknown storage is refused, apps receive no credentials, and user logout is local rather than revoking browser/device sessions.

**Supersedes:** M05's optional remember-me choice, while preserving its native protected-storage implementation and original evidence as historical records.

The email-only form preference is a distinct UI convenience recorded in [ADR-032](../../dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-032--remember-sign-in-email-separately-from-session-persistence). It does not restore the old opt-in session behavior.

**Scope:** local implementation in `/home/master-x/.codex/worktrees/m15-auth-session/fewa_business_os`, branch `codex/m15-auth-session`. This is not a G15/M15 closeout claim, backend change, production release, commit, or push.
