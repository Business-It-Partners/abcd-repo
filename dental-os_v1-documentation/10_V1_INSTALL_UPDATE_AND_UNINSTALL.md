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

OS/Electron installers have a separate signed update channel and restart flow. App bundles cannot update Electron, host preload or trusted code. Windows and Linux packaging/update mechanisms must be selected and verified explicitly in M11; built-in Electron autoUpdater is not a cross-platform Linux solution.

## Staging delivery boundary

Release catalogue, channel, minimum-version and revocation backend additions reuse `fewa_demo` and extend `/v1/dental-os/...` in Cloudflare staging only. Staging app releases must not alter production feeds, pointers, keys or bucket objects. Compatibility and regression checks include existing Dental SaaS/Super Admin staging clients. Platform/app production publication is a separate task; this roadmap does not authorize promotion. See [backend resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
