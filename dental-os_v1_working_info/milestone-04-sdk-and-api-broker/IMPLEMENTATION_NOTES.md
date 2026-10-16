# M04 Implementation Notes — Internal SDK and API boundary

## Baseline and implementation

Based on verified main `f904aa9f`. `electron/sdk/contracts.ts` defines SDK 1.0, named intents and strict bounded request/response shapes. `environment.ts` holds the immutable source-verified staging binding. `broker.ts` owns registered caller/frame/origin/version/capabilities, connection/session generation, bounded transport, credential single-flight, cancellation, structured errors and operation-key fingerprints. `fixtures.ts` supplies synthetic host-only identity/service responses in the guarded runtime; it cannot make remote requests.

`electron/runtime/appPreload.ts` exposes connect/request/cancel plus the retained M03 report compatibility method. Only fixed SDK channels exist. Type-only imports keep sandbox preload compatible without broad bundler/repository changes. Main forwards SDK requests to the runtime registry; manager registers after load, revokes on crash/close and disposes the broker. Both sample apps demonstrate reads; alpha alone can change appointment status. Shared window geometry/Genie remains unchanged.

## Contract and limits

SDK input: 16 KiB, named strict schemas, no app-supplied identity/URL/header/channel. Supported major 1/minor 0; independent platform-generated connections. Up to four pending calls/app, eight total; eight-second deadline including credential/stream waits; 256 KiB streamed response limit; 200 appointment maximum. Tests lower limits to prove boundaries promptly. Credentials are host-only, never logged or returned. Errors use fixed safe messages, correlation request IDs and explicit write outcome/operation ID.

Writes retain existing business route/body/idempotency-key/expectedRowVersion. No automatic retry. Concurrent same-key writes are refused; changed-body reuse is refused. At most 128 in-memory operation fingerprints/session, with no eviction that would weaken safety and no hidden write queue/business DB. Timeout/cancel/disconnection/5xx or malformed success after dispatch yields unknown outcome. Retry/reconciliation is explicit with the same key/body; no replacement payment/action is manufactured.

Scoped preferences are memory-only text scale. Lifecycle reports are wired to owner dirty/modal state. Notifications return a bounded app-scoped receipt/message for caller presentation, not a system notification. Print/export intent is typed but explicitly unavailable until an approved adapter exists. M03's narrow report method remains a compatibility signal, not an API authorization path.

## Staging mapping

Separate repo Business-It-Partners/dental-saas, branch/environment `cloudfare-staging`, remote SHA `76447b93155a2b9bcb52887efa1ba0b73c361630` verified by GitHub branch read. API `https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev`; Worker `dentmitra-api-cloudfare-staging`; Firebase `dental-managemetn-staging`; Control D1 `dentmitra-control-cloudfare-staging` / `55ac8b32-9c22-46c5-ab05-45988adff79f`; private SaaS R2 `dentmitra-private-cloudfare-staging`; workflow `.github/workflows/cloudfare-staging-deploy.yml`. Values verified from staging source/config/docs, not a live deployment audit. Existing private SaaS objects are distinct from future OS package distribution; catalogue/download mapping remains null until M07. No resource or backend changes.

Existing appointment client/controller inspected: GET `/v1/appointments?date=...`; POST `/v1/appointments/:uuid/status` with `{status, expectedRowVersion}` and idempotency-key header. No new OS backend routes were invented; new OS services alone would use `/v1/dental-os/...`.

## Repairs and limits

The installed Vitest 5 suite API has no describe.sequential; default sequential suite execution is used. Initial typecheck and unit collection failure were repaired and retained. Initial shell-only screenshot missed native app bodies; final evidence uses shared native-aware capture and wrapped fixture output. No dependency changes.

Real identity/refresh storage is M05; real authorized SaaS read/write acceptance is M09. Fixture success is not a logged-in clinic. Physical Windows acceptance remains deferred after M11/before release.
