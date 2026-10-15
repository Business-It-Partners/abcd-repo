# Dental OS — Non-Goals and Permanent Exclusions

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

## Permanent product exclusions

Third-party app publishing/execution, public extensions/plugins, arbitrary sideloading and a public developer marketplace will never be part of Dental OS. This is not a deferred V2 feature.

## Outside this platform baseline

- Replacement kernel/drivers, host-account management or general-purpose host application execution.
- A separate business backend, local authoritative clinical/financial DB, offline write queue, sync/merge engine.
- General cross-app messaging/intents, hidden shared app stores, user-created executable tools.
- App-supplied native binaries, install scripts, Node privileges or arbitrary downloaded executable code.
- macOS/mobile support, a required Rust/Flutter runtime, or inheritance of the pharmacy roadmap.
- Implementation of every dental module's contents; the platform roadmap uses controlled sample apps and representative API contracts.
- Automatic remote provisioning/deployment, credential changes, commits/pushes or production mutations through documentation tasks.

Explicit later product decisions may scope offline/draft/host integrations where compatible with the constitution; they cannot treat permanent third-party exclusion as an anticipated expansion.

## Current backend restriction

Production backend changes, production credentials/data mutation, and production promotion are outside every current milestone task. Backend work reuses the existing `fewa_demo` staging infrastructure; no parallel backend and no renaming/duplication of existing dental APIs. Only new OS services use `/v1/dental-os/...`. Future production promotion requires separate explicit authorization; this is an execution restriction, not a claim that Dental OS can never ship. [Policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
