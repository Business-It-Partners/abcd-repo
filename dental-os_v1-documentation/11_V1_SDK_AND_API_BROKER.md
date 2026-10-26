# Dental OS — SDK and API Broker

**Baseline:** V1. Target architecture; implementation status is tracked in milestone records. M15 accepted the existing signed-policy authority shape under ADR-026 on 2026-10-22; final combined-source acceptance remains open.

The internal versioned SDK expresses approved intent: session display context, named API operations, lifecycle/dirty-state reports, bounded preferences, scoped notifications, approved exports/printing, and platform status. It is not a public developer API.

App -> platform-owned preload -> validated IPC -> API broker -> existing Dental SaaS Worker. The broker mediates authentication/transport only. Business rules, clinic authority and transactions remain on the Worker.

No raw ipcRenderer, arbitrary channel, unrestricted authenticated fetch, arbitrary URL/SQL/filesystem/process primitive, token getter, or self-selected app identity is exposed. Bind caller identity at registration; validate payloads, operation capability, session generation, destination/method and limits at runtime. Scope permissions to the operation, not just a role string in UI.

Preserve backend request/response contracts, material-write idempotency keys and optimistic revisions. Unknown write outcomes use the original key and server-supported reconciliation; never create a new payment because a timeout occurred. Automatic retries require documented idempotency and error policy. Bound timeouts, cancellation, response/body size and concurrency; prevent redirect/token exfiltration and duplicate concurrent token refreshes.

Errors distinguish authentication, access denial, conflict, validation, connectivity, server maintenance, incompatible contract and unknown outcome. Correlation IDs exclude secrets. Logout blocks new calls; cancellation cannot undo a committed server operation. Drop old-session results without pretending the write was cancelled server-side.

## Host-owned request deadlines

The local M15 timeout-policy candidate separates credential acquisition from API transport: credentials have an 8-second cap, ordinary API calls have 30 seconds after credentials are ready, and host-classified report/list reads can take up to 60 seconds. The host selects the class from the closed route contract; apps cannot request a longer deadline. Finance collection reads, transaction and patient-payment reports, ledgers, and supplier statements use the report class. Existing media-read, media-upload, and native file-picker limits remain independent.

The response deadline covers transport and bounded response reading. A dispatched write that times out remains an unknown outcome and must be reconciled with its original operation key; the longer deadline does not enable automatic retries or change Worker authority. This is a source-only candidate until its milestone verification is complete.

## Route and environment selection

Keep existing SaaS business/identity routes; only new OS services use `/v1/dental-os/...`. Do not duplicate business handlers to create an OS namespace. Desktop integration targets the verified `fewa_demo` staging API base URL, not production. Bind authentication, API base, catalogue and download configuration to the same verified environment; reject incompatible/mixed environment configuration without automatic production fallback. See [staging/resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).


SDK 1.7 adds the Admin-only `clinic.app.user-management` family and four fixed `/v1/clinic/users` routes. The host requires `clinic_users.manage` before credential acquisition; the existing Worker independently enforces that capability for each operation. See the [clinic JSON contract](../docs/CLINIC_JSON_API_CONTRACT.md). Account records, login passwords, Firebase identity changes and audit/idempotency records remain SaaS-owned.

## M04 implemented contract

SDK 1.0 uses platform-issued connection and generation, named strict requests and fixed connect/request/cancel IPC. The retained M03 two-boolean report is lifecycle compatibility only. The guarded samples use synthetic host-only identity/transport and distinct capabilities; exact appointment list/status routes, revision and idempotency headers match existing SaaS contracts. See [M04 notes and staging mapping](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/IMPLEMENTATION_NOTES.md) and [evidence](../dental-os_v1_working_info/milestone-04-sdk-and-api-broker/VERIFICATION_EVIDENCE.md). Real login is M05 and authenticated SaaS acceptance M09. Typed native print/export is explicitly unavailable pending an adapter; notification is a scoped receipt for app presentation. These fixture implementations do not claim a production package SDK installation.

## M15 release-scoped API authority — ADR-026

The platform uses existing pinned company signing roots and the existing signed catalogue and update-policy channels. Update-policy format 2 adds up to three API-grant records per app, each bound to one version, package wire SHA-256, package payload digest, and closed operation IDs. The current catalogue candidate must match the exact grant identity. An eligible retained active, pending, trial, known-good or fallback package uses its own record; a successor cannot widen an older package. The signed app-level capability list and platform company-app ceiling remain upper bounds. Format 1 can retain update-safety behavior but contributes no typed clinic API grants.

The host API catalogue contains `appointments.list`, `appointments.setStatus` and, under ADR-027/SDK 1.2, the fixed clinic JSON contract for `clinic.api.request`. The latter requires an exact signed release grant, one supported app-family capability, the host-owned method/path/query catalogue, and trusted session permissions before credentials and again before dispatch. App family and route selection come from signed package capabilities; host policy does not register each app ID separately. A package declaration, app ID, route prefix or signature alone is insufficient. The legacy `clinic.api.blob.read` entry remains denied. SDK 1.4 `clinic.media.upload` has a narrow normal SessionManager gate for the Patient Record/patient-media and Staff/staff-document family pairs; any approved ID with the matching signed family can select the same bounded scope. The broker still requires an exact signed format-2 operation grant. Credentials remain in the host, and business authorization/tenancy remain with the Worker. The current-source private Dock path passed one real staging upload/readback; active-file clinic isolation and remaining upload failure checks remain; SaaS file retention is backend-owned, not an OS gate. See [clinic JSON contract](../docs/CLINIC_JSON_API_CONTRACT.md) and [clinic media upload contract](../docs/CLINIC_MEDIA_UPLOAD_CONTRACT.md).

This supports new first-party IDs selecting an already implemented family/operation through signed catalogue, update-policy and package metadata, without a per-ID OS source change. New Worker routes, payload schemas, app families, media types, print/export and OS navigation require their own compatibility/design gates and host implementation. M17 app compatibility and live Worker proof remain explicit: unit route/grant checks are not app or service acceptance. See [ADR-026](20_V1_ADR_REGISTER.md#adr-026--release-scoped-first-party-api-authority), ADR-027 and [M15 evidence](../dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md).


## SDK 1.3 private-media read extension

[ADR-028](20_V1_ADR_REGISTER.md) and the [typed media contract](../docs/CLINIC_MEDIA_API_CONTRACT.md) define `clinic.media.read`: exact signed-release grant and trusted app/session scope, fixed host-derived routes, fresh metadata and size/MIME/SHA-256 verification before bytes reach the renderer. Domain bounds are 10 MiB patient media and 25 MiB Staff documents, with one reader per registration/two globally and a 30-second deadline. The legacy blob entry point remains denied; uploads are not implied by this read operation. M15 evidence owns source-bound tests and remaining real-service proof.


## SDK 1.4 explicit upload extension

[ADR-029](20_V1_ADR_REGISTER.md) and the [mediated upload contract](../docs/CLINIC_MEDIA_UPLOAD_CONTRACT.md) define a separately signed `clinic.media.upload` operation. The host receives bounded 8 KiB chunks, computes checksums and owns intent/content/finalise/abort calls, original-key reconciliation and transient lifetime. Buffered/unknown work participates in close/update safety; no client retry queue or disk business store is introduced. Patient replacement uses only the existing Worker replacement route; active facts are not undone by cancellation. Fresh-session recovery, real service proof and explicit grant publication remain separate M15 work.

## M15 media upload gate amendment — 2026-10-22

After the earlier user-directed deferral, the local candidate added upload authorization to the normal SessionManager path. A current-source private Dock staging run then passed session sign-in/sign-out/re-login and a real JPEG upload/readback with matching SHA-256 through the exact signed grant; the test media record was withdrawn and the bytes remain stored. The broker independently checks the signed format-2 operation grant and app-family capability. No public release grant was published. Active-file clinic isolation and remaining upload failure checks remain. SaaS owns file retention/cleanup, outside the OS gate. See [current capability inventory](../docs/PLATFORM_APP_CAPABILITIES.md) and [upload contract](../docs/CLINIC_MEDIA_UPLOAD_CONTRACT.md).
