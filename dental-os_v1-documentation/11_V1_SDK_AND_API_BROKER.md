# Dental OS — SDK and API Broker

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

The internal versioned SDK expresses approved intent: session display context, named API operations, lifecycle/dirty-state reports, bounded preferences, scoped notifications, approved exports/printing, and platform status. It is not a public developer API.

App -> platform-owned preload -> validated IPC -> API broker -> existing Dental SaaS Worker. The broker mediates authentication/transport only. Business rules, clinic authority and transactions remain on the Worker.

No raw ipcRenderer, arbitrary channel, unrestricted authenticated fetch, arbitrary URL/SQL/filesystem/process primitive, token getter, or self-selected app identity is exposed. Bind caller identity at registration; validate payloads, operation capability, session generation, destination/method and limits at runtime. Scope permissions to the operation, not just a role string in UI.

Preserve backend request/response contracts, material-write idempotency keys and optimistic revisions. Unknown write outcomes use the original key and server-supported reconciliation; never create a new payment because a timeout occurred. Automatic retries require documented idempotency and error policy. Bound timeouts, cancellation, response/body size and concurrency; prevent redirect/token exfiltration and duplicate concurrent token refreshes.

Errors distinguish authentication, access denial, conflict, validation, connectivity, server maintenance, incompatible contract and unknown outcome. Correlation IDs exclude secrets. Logout blocks new calls; cancellation cannot undo a committed server operation. Drop old-session results without pretending the write was cancelled server-side.

## Route and environment selection

Keep existing SaaS business/identity routes; only new OS services use `/v1/dental-os/...`. Do not duplicate business handlers to create an OS namespace. Desktop integration targets the verified `fewa_demo` staging API base URL, not production. Bind authentication, API base, catalogue and download configuration to the same verified environment; reject incompatible/mixed environment configuration without automatic production fallback. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).


## M04 implemented contract

SDK 1.0 uses platform-issued connection and generation, named strict requests and fixed connect/request/cancel IPC. The retained M03 two-boolean report is lifecycle compatibility only. The guarded samples use synthetic host-only identity/transport and distinct capabilities; exact appointment list/status routes, revision and idempotency headers match existing SaaS contracts. See [M04 notes and staging mapping](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/IMPLEMENTATION_NOTES.md) and [evidence](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/VERIFICATION_EVIDENCE.md). Real login is M05 and authenticated SaaS acceptance M09. Typed native print/export is explicitly unavailable pending an adapter; notification is a scoped receipt for app presentation. These fixture implementations do not claim a production package SDK installation.
