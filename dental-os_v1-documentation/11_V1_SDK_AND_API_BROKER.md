# Dental OS — SDK and API Broker

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

The internal versioned SDK expresses approved intent: session display context, named API operations, lifecycle/dirty-state reports, bounded preferences, scoped notifications, approved exports/printing, and platform status. It is not a public developer API.

App -> platform-owned preload -> validated IPC -> API broker -> existing Dental SaaS Worker. The broker mediates authentication/transport only. Business rules, clinic authority and transactions remain on the Worker.

No raw ipcRenderer, arbitrary channel, unrestricted authenticated fetch, arbitrary URL/SQL/filesystem/process primitive, token getter, or self-selected app identity is exposed. Bind caller identity at registration; validate payloads, operation capability, session generation, destination/method and limits at runtime. Scope permissions to the operation, not just a role string in UI.

Preserve backend request/response contracts, material-write idempotency keys and optimistic revisions. Unknown write outcomes use the original key and server-supported reconciliation; never create a new payment because a timeout occurred. Automatic retries require documented idempotency and error policy. Bound timeouts, cancellation, response/body size and concurrency; prevent redirect/token exfiltration and duplicate concurrent token refreshes.

Errors distinguish authentication, access denial, conflict, validation, connectivity, server maintenance, incompatible contract and unknown outcome. Correlation IDs exclude secrets. Logout blocks new calls; cancellation cannot undo a committed server operation. Drop old-session results without pretending the write was cancelled server-side.

## Route and environment selection

Keep existing SaaS business/identity routes; only new OS services use `/v1/dental-os/...`. Do not duplicate business handlers to create an OS namespace. Desktop integration targets the verified `fewa_demo` staging API base URL, not production. Bind authentication, API base, catalogue and download configuration to the same verified environment; reject incompatible/mixed environment configuration without automatic production fallback. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).
