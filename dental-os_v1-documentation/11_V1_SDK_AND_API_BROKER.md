# Dental OS — SDK and API Broker

**Baseline:** V1. Target architecture; implementation status is tracked in milestone records. M15 accepted the existing signed-policy authority shape under ADR-026 on 2026-10-22; final combined-source acceptance remains open.

The internal versioned SDK expresses approved intent: session display context, named API operations, lifecycle/dirty-state reports, bounded preferences, scoped notifications, approved exports/printing, and platform status. It is not a public developer API.

App -> platform-owned preload -> validated IPC -> API broker -> existing Dental SaaS Worker. The broker mediates authentication/transport only. Business rules, clinic authority and transactions remain on the Worker.

No raw ipcRenderer, arbitrary channel, unrestricted authenticated fetch, arbitrary URL/SQL/filesystem/process primitive, token getter, or self-selected app identity is exposed. Bind caller identity at registration; validate payloads, operation capability, session generation, destination/method and limits at runtime. Scope permissions to the operation, not just a role string in UI.

Preserve backend request/response contracts, material-write idempotency keys and optimistic revisions. Unknown write outcomes use the original key and server-supported reconciliation; never create a new payment because a timeout occurred. Automatic retries require documented idempotency and error policy. Bound timeouts, cancellation, response/body size and concurrency; prevent redirect/token exfiltration and duplicate concurrent token refreshes.

Errors distinguish authentication, access denial, conflict, validation, connectivity, server maintenance, incompatible contract and unknown outcome. Correlation IDs exclude secrets. Logout blocks new calls; cancellation cannot undo a committed server operation. Drop old-session results without pretending the write was cancelled server-side.

## Route and environment selection

Keep existing SaaS business/identity routes; only new OS services use `/v1/dental-os/...`. Do not duplicate business handlers to create an OS namespace. Desktop integration targets the verified `fewa_demo` staging API base URL, not production. Bind authentication, API base, catalogue and download configuration to the same verified environment; reject incompatible/mixed environment configuration without automatic production fallback. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).


## M04 implemented contract

SDK 1.0 uses platform-issued connection and generation, named strict requests and fixed connect/request/cancel IPC. The retained M03 two-boolean report is lifecycle compatibility only. The guarded samples use synthetic host-only identity/transport and distinct capabilities; exact appointment list/status routes, revision and idempotency headers match existing SaaS contracts. See [M04 notes and staging mapping](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/IMPLEMENTATION_NOTES.md) and [evidence](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/VERIFICATION_EVIDENCE.md). Real login is M05 and authenticated SaaS acceptance M09. Typed native print/export is explicitly unavailable pending an adapter; notification is a scoped receipt for app presentation. These fixture implementations do not claim a production package SDK installation.

## M15 release-scoped API authority — ADR-026

The platform uses existing pinned company signing roots and the existing signed catalogue and update-policy channels. Update-policy format 2 adds up to three API-grant records per app, each bound to one version, package wire SHA-256, package payload digest, and closed operation IDs. The current catalogue candidate must match the exact grant identity. An eligible retained active, pending, trial, known-good or fallback package uses its own record; a successor cannot widen an older package. The signed app-level capability list and platform company-app ceiling remain upper bounds. Format 1 can retain update-safety behavior but contributes no typed clinic API grants.

The current host API operation set is `appointments.list` and `appointments.setStatus`, with fixed request/response schemas and existing Worker routes. A package declaration, app-wide SDK capability, app ID, route prefix or successful signature alone is not authority. `clinic.api.request` and `clinic.api.blob.read` remain generic entry points and are refused before credential acquisition because they have no exact operation ID in the host contract. No upload adapter is implemented. The current broker rechecks the release grant and session at dispatch, keeps credentials in the host, and leaves business authorization and tenant decisions with the Worker.

This supports an app-only compatible release selecting an already implemented host operation without changing the SDK/API major or desktop. It does not authorize a new Worker route, payload schema, role rule, media contract, print/export adapter, arbitrary path, app-to-app message or intent. Those require their own versioned host contract and compatibility review. M14's per-app route/method/payload/role inventory remains a prerequisite to final app-specific grants; current synthetic proof uses only the existing appointment operations. See [ADR-026](20_V1_ADR_REGISTER.md#adr-026--release-scoped-first-party-api-authority) and [M15 evidence](../dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md).
