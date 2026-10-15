# Dental OS — Security and Trust

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

## Boundaries and threats

Protect against modified/replayed packages, compromised app UI, forged IPC, token exfiltration, path traversal/archive bombs, cross-app/session data leaks, unsafe navigation, dependency compromise and interrupted local writes. First-party ownership is not a reason to bypass containment.

Trust roots and signing keys are separate: public verification keys ship with trusted platform releases; release private keys are protected CI/release secrets, never in R2 packages or the desktop. Define rotation, withdrawal, expiry and recovery; separate app and platform release authority as needed. Build provenance and dependency review accompany signatures.

Use sandbox/context isolation/no Node, restrictive CSP and controlled custom origins. No generic authenticated proxy or shell command. Validate actual sender/frame and authorization on every privileged IPC. TLS validation stays enabled; do not disable webSecurity or accept all origins as an integration shortcut.

Protect local roots with appropriate OS permissions; reject path escape, links/reparse points and unbounded writes. Detect integrity violations and stop affected launches. This is not a guarantee against a fully compromised host account, administrator or patched Electron binary.

Redact tokens, signed download URLs, identifiers/clinical content where unnecessary, and secrets from diagnostics. Lock/logout clear previews and account-sensitive memory. Crash dumps/support bundles are sensitive and require explicit bounded policy.

The same backend continues authoritative clinical/financial audit. Local OS operational events record install/update/security outcomes without duplicating patient facts.

## Environment isolation

Backend and remote integration work is restricted to verified `fewa_demo` Cloudflare staging resources and the corresponding GitHub environment/workflow. Do not use production secrets, deploy from an unverified target, or treat `/v1/dental-os/...` as a security boundary. Authorize OS catalogue/download/publisher operations explicitly; preserve clinic/Super Admin separation and existing route authorization. Record mapping and existing-client regression proof under the [backend policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
