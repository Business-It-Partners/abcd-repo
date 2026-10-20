# Dental OS — Install, Update and Uninstall

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

## Safe operation model

Resolve approved compatible metadata -> reserve bounded disk capacity -> stage download -> verify -> extract safely -> verify installed assets -> atomically register/activate -> ready. Failure before activation preserves the existing version. Interruption cleanup is idempotent; never discard the only known-good install.

Routine checks/downloads happen quietly. A running instance is pinned to its version; activate on next safe launch. Update-now requests must resolve dirty work before closing. Completion animation is presentation after registry success, not proof of successful installation.

Retain the previous known-good compatible version temporarily with bounded retention. Rollback checks SDK/API/local-state compatibility and current revocation rules. Signed controlled rollback is an exception to downgrade prevention, not permission to replay arbitrary historical releases. Security withdrawal stops affected launches/operations under a communicated policy with a recovery route.

Health checks can roll back launch failures; they do not prove business correctness. Release telemetry must avoid patient data and is not permission to terminate active work silently.

## Uninstall

Serialize with other package operations; resolve dirty work and pending request outcomes; stop the runtime; unregister shortcuts/dock availability; remove executable versions and disposable app-local state. A failed deletion is recorded for retry, not hidden. Do not delete SaaS records or another app's files. Account/clinic switching must not expose another user's leftovers.

## Two update systems

OS/Electron installers have a separate signed update channel and restart flow. App bundles cannot update Electron, host preload or trusted code. Windows and Linux packaging/update mechanisms must be selected and verified explicitly in M20; built-in Electron autoUpdater is not a cross-platform Linux solution. M11/M14 app-only updates never replace platform code.

## Staging delivery boundary

Release catalogue, channel, minimum-version and revocation backend additions reuse `fewa_demo` and extend `/v1/dental-os/...` in Cloudflare staging only. Staging app releases must not alter production feeds, pointers, keys or bucket objects. Compatibility and regression checks include existing Dental SaaS/Super Admin staging clients. Platform/app production publication is a separate task; this roadmap does not authorize promotion. See [backend resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## M08 wire and activation contract

M08 keeps M07 catalogue format 1 and its authenticated route intact. Additive GET `/v1/dental-os/update-policy` transports signed opaque `update-policy/staging.json` from the same dedicated release bucket; no new business DB/binding. Canonical envelope has exactly `policy`, `keyId`, `signature`; Ed25519 covers canonical `{purpose:"dental-os-update-policy",keyId,policy}`. Policy fields are `format:1`, exact staging `environment`/`channel`, positive monotonic `sequence`, `issuedAt`, `expiresAt` (maximum 24 hours), `revokedKeys`, `apps`. Each fixed company app has `id`, strict semver `minimumVersion`, at most 16 `revokedDigests`, and null or explicit digest-paired `{from,to}` rollback authority. At most 16 apps/keys, 64 KiB; key IDs are already pinned company trust anchors. It cannot introduce arbitrary publishers/keys. Unknown schemas/signatures, replay/equivocation, missing/skewed authenticated server clock or expired policy refuse safely. Package/catalogue grants remain independently enforced.

Registry format 2 migrates legacy format 1 without inventing health. Per app: active digest, at most three retained immutable versions, optional pending digest, known-good digest, trial digest and at most three quarantined failed digests. Background staging never changes a running lease. Next launch with no lease atomically selects a pending trial; if the old version has no health receipt, open it first unless current signed controls already forbid it. A safe successor may then trial without a fallback; failure requires explicit recovery rather than pretending an untested version is known-good. Before each launch and broker dispatch, enforce current metadata, signed minimum/withdrawal and digest/key revocation. Existing in-flight writes are not undone by metadata changes.

Runtime launch health is bounded DOM/preload availability, negotiated SDK identity and an event-loop probe; timeout/crash before acknowledgement preserves or selects a currently allowed, intact SDK/API-compatible known-good version. Health is never clinical correctness. An interrupted trial lacking acknowledgement is rolled back on next launch; unknown/corrupt state preserves files and requests recovery. A revoked/incompatible fallback blocks rollback, including offline. Our apps have no authoritative local business schema, so rollback cannot silently downgrade one.

Routine normal-session checks begin after 15 seconds and recur every 15 minutes; one operation at a time, current admin authority before download/commit, deadline/cancel/generation fencing. Private fixture profiles have no automatic network checks. Public signed metadata and replay watermarks are the only new disk cache; no bearer/refresh token, patient content or write queue. Cache is reverified, and expired/missing current controls block launches/new operations until a successful refresh while preserving installed files and running work. App payloads stay pinned even while control metadata changes.

Explicit Update now refuses dirty/modal/not-ready runtime state and pending/unknown broker write outcomes. Save/close/reconcile first; the existing explicit close/discard path remains available. An unknown outcome remains an in-memory app/operation-key marker across app close until original-key reconciliation or session reset. It contains no patient payload. Bounded retention evicts only unleased versions outside active/pending/trial/known-good protection, journalling state before deletion.

Staging rotation adds a second explicitly pinned public company key, while retaining the prior key for permitted old packages. Keys cannot be downloaded from apps/catalogue. A fresh signed policy can revoke a pinned key; it cannot revoke its own signing key. Root trust changes belong in trusted platform source/release, and production key/installer lifecycle belongs to M20. Operator publication validates reviewed paths/hashes/sequence, conditionally creates immutable packages, then independently CAS-publishes policy and catalogue; a partial publication may fail closed and is repaired with a higher sequence.
