# Dental OS — Install, Update and Uninstall

**Updated:** 2026-10-22. **Authority:** single source of truth for V1 app installation, update, activation, recovery and uninstall behavior. Accepted behavior is specified below; current implementation and outstanding acceptance are identified separately. ADR-025 supersedes ADR-024's close-first target. M15 integrated the staged/next-full-launch source path and focused synthetic checks; final combined-source acceptance remains pending.

## Product rule and ownership

Dental OS prepares app updates without disturbing running work. A verified update takes effect on the next full launch; startup failure recovers to an eligible known-good version. No live code injection, mandatory update-time close, process kill or automatic app relaunch is part of the normal update action.

All executable apps are developed/controlled and approved by the product owner's organization. There is no third-party submission or public developer marketplace. The internal publisher builds, tests, signs and publishes approved releases. The trusted platform verifies and installs them. Clinic users consume releases through the Store; server-side clinic/user authorization remains on the existing SaaS Worker. First-party ownership does not waive integrity, compatibility, permission or recovery checks.

[Product vision](01_WHY_DENTAL_OS.md) owns motivation; this document owns lifecycle behavior; [package format](23_V1_PACKAGE_FORMAT.md), [runtime](07_V1_APP_RUNTIME_AND_ISOLATION.md) and [SDK/broker](11_V1_SDK_AND_API_BROKER.md) own their respective enforcement details. Milestone records own actual progress/evidence.

## Install a new app

Resolve current approved compatible catalogue/release metadata and authenticated install authority → reserve bounded disk space → download into staging → verify signature, exact release identity, capabilities, digest and asset inventory → extract safely and revalidate → atomically register the immutable installation → show Ready to open. Do not execute partial/unverified files or automatically launch the app. First Open performs normal launch validation and health acknowledgement. Failure before commit creates no usable partial install; interrupted work is reconciled idempotently without deleting another app or a recoverable install.

Store discovery/module visibility is not authorization. Current role/install policy and Worker permissions still apply. Incompatible releases are unavailable with an explanation, not partially installed.

## Normal Update action

1. User selects Update for an approved compatible release. Routine checks may discover offers; only the existing authorized download policy may prepare bytes. This decision introduces no additional automatic installation authority.
2. Download, verify, safely extract and atomically record one pending candidate in a separate immutable directory. Recheck current authority, release identity and policy before committing it.
3. If the app is running, keep its exact code/assets pinned. Its window, draft, requests and session continue unchanged. Preparation neither closes nor reloads it and does not require a save/discard decision.
4. Show Update ready — applies next time you open this app. Keep the running version distinct from the pending version. Open while already running only focuses/restores that existing instance.
5. When the user normally closes the app, perform the shared close checks. Closing releases runtime resources/leases; it need not activate the candidate or start a replacement.
6. On the next full launch, revalidate the candidate and current controls. With no runtime/lease or unresolved transition safety gate, atomically select the pending candidate as a persisted trial and launch it. If the app was already closed when preparation finished, the next Open follows the same path.
7. Mark the candidate known-good only after bounded startup health succeeds. Only then present the new version as successfully running/updated. Keep an eligible fallback with bounded retention.

A full launch creates a new isolated app instance after the previous instance has completely stopped. Focus, module switching, dock/explorer activation of an existing app, overview, minimize and restore are not full launches. A pending candidate survives Dental OS restart. No desktop restart is required solely for a compatible app update.

Download and activation are separate operations. Do not replace executing files in place or require simultaneous old/new app instances. A future optional close-and-apply control requires its own UX/verification; it is not required for V1 and must not become the default Update behavior.

## Store states and version truth

| State | User-facing meaning / action |
| --- | --- |
| Not installed | Get installs the approved release; Open appears after verified registration. |
| Update available | Update prepares the offered release; the installed app remains usable if currently allowed. |
| Downloading / verifying / preparing | Show actual operation/progress, cancellation where safe, and retryable failures. |
| Update ready | Name pending version and explain next full launch. Open focuses the old instance if still running; otherwise starts the candidate trial. |
| Starting updated app | Candidate is in startup trial; do not label it known-good prematurely. |
| Updated | Startup health acknowledged for the active version; Open uses it. |
| Update failed / recovery | Explain whether the old version was retained, restored, or no eligible fallback exists; provide a bounded recovery/retry action. |

Track offered, installed active, pending, trial and known-good identities accurately; do not infer them from one version label. The completed download animation is presentation, not proof of activation or business correctness. A first install can be Ready to open before it has a health receipt.

## Drafts, requests and session transitions

Preparing an update must preserve running work. Normal close handles unsaved local forms through an explicit keep-working/discard decision. Pending writes must settle or enter a truthful reconciliation state. Unknown outcomes retain their original operation identity; never submit a fresh payment or clinical command merely because an app closes, updates or a request times out. Cancellation cannot undo an already committed server transaction.

Do not activate a successor across an unresolved broker write safety gate. An app/operation-key marker is not a durable business write queue; process/session restart must not be presented as proof that the server rejected a write. Preserve the broker/backend idempotency and app-level reconciliation contract. Apps and adapters must propagate material outcome information.

Lock/logout/account changes fence requests and stale results, clear app surfaces/partitions according to the session contract, and cancel or fence in-progress Store mutations. Pending verified package bytes contain no patient data and may remain installed; a later launch must satisfy the new session's current access policy. Force termination remains explicit recovery, never a routine updater shortcut.

## Startup trial and recovery

Startup health checks package loading, DOM/platform preload readiness, negotiated SDK identity and event-loop responsiveness within a bounded deadline. A successful business API read is not a health prerequisite. An internet/Worker outage or expired authentication must surface the appropriate service/session error rather than automatically classifying healthy executable code as broken. Health does not prove clinical calculations or workflow correctness.

Persist trial identity before launch and health acknowledgement after success so process interruption is recoverable. Failure before acknowledgement quarantines the failed candidate and preserves/selects a currently allowed, intact, SDK/API-compatible known-good version. Show that recovery occurred; offer reopening/retry without automatic restart loops. Do not repeatedly select the quarantined candidate on each Open. If no eligible fallback exists, preserve files and show recovery guidance. First installations have no invented known-good predecessor.

| Failure | Required result |
| --- | --- |
| Interrupted download, invalid signature/hash, extraction or capacity failure | Reject/clean incomplete candidate safely; retain installed version. |
| Exit during preparation/registry mutation | Reconcile journal on startup to the last valid committed state. |
| Candidate modified after staging | Reject during launch revalidation; preserve/recover the allowed previous version. |
| Crash, hang or missing bridge during trial | Quarantine candidate; choose eligible known-good fallback or explicit recovery. |
| Interrupted trial without health receipt | Reconcile conservatively on next launch; do not infer success. |
| Temporary API/session failure | Report service/authentication condition; no package rollback solely for that condition. |
| Workflow bug after health success | Internal release withdrawal/fix or controlled rollback; startup probes cannot discover every bug. |
| Revoked/incompatible fallback | Refuse fallback and explain recovery; never bypass security controls. |

App rollback restores executable version selection, not remote transactions, patient records or backend schema. Backend changes must preserve supported old-app contracts or explicitly restrict incompatible versions. No authoritative local business schema exists to downgrade. Controlled historical downgrade/rollback remains distinct from replaying arbitrary old releases.

## Concurrency, storage and cancellation

Use one global download/install mutation at a time and one pending candidate per app. Serialize launch/activation, update and uninstall decisions; never switch activation while an app lease exists. A later release does not silently replace an already pending candidate in V1: finish/cancel/reconcile the existing pending operation before preparing a successor under the same rules.

Keep immutable versions with bounded retention; the current registry permits at most three retained versions per app. Protect active/pending/trial/known-good and leased versions; if no safe eviction exists, report the limit rather than deleting protected files. Journal cleanup and reconcile interruptions. No uncontrolled staging-directory or failed-version accumulation.

Cancellation before commit preserves the installed version and cleans task-owned incomplete bytes. Cancellation after a committed pending install must not pretend the commit was undone; report the actual state. Do not delete the only recoverable version.

## Internal release and compatibility policy

Build each first-party app from a clean pinned source revision, test relevant workflows/roles and supported hosts, verify SDK/API/permission compatibility and upgrade behavior, then sign immutable package bytes. Keep the signer outside distributed apps/source. Publish the package, verify uploaded identity/bytes, and then publish signed catalogue/update controls referencing it through the guarded publisher. Never overwrite a published version's content; retain exact source, version, digest, sequence and acceptance evidence. Partial metadata publication must fail safely and be repaired by an authorized higher-sequence publication.

Compatible app changes ship without replacing Dental OS. New platform powers may require a platform update. Unsupported releases must be refused without losing the working version. App packages still have no route-list manifest field. Under ADR-026, exact release API operation grants may be carried only by format 2 of the existing signed update policy; that policy names already implemented closed host operations and cannot define routes, schemas, roles, or new SDK semantics.

Routine updates must not kill active clinic work after an arbitrary deadline. Urgent security withdrawal/minimum-version enforcement is separate signed policy with clear messaging; preserve existing in-flight write outcome truth. Current expiry/revocation/freshness controls still apply: staging bytes on disk does not guarantee offline launch eligibility or continued permission to run.

## Uninstall

Resolve dirty work and pending/unknown request outcomes, stop the runtime and serialize with package operations. Remove installation registration, dock availability, package versions and disposable app-local state. Record/retry failed deletion rather than hiding it. Never delete SaaS records or another app's files. Account/clinic changes must not expose the previous user's leftovers.

## Platform updates and staging boundary

OS/Electron installers use a separate signed channel and restart flow. App bundles cannot replace Electron, host preloads or trusted code. Windows/Linux installer mechanisms and production signing operations remain M20 scope; app-only updates do not implement them.

Reuse existing `fewa_demo` infrastructure; roadmap backend/feed execution is verified Cloudflare staging-only, preserving existing SaaS/Super Admin clients and business routes. New OS services use `/v1/dental-os/...`. Production publication/promotion requires separate authorization. [Resource policy](09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md).

## Acceptance and implementation status

**Accepted target:** staged preparation and next-full-launch activation under ADR-025. **Existing foundation:** M08/M11 implement immutable packages, leases, pending/trial/health state, signed controls, journal recovery and bounded rollback within their retained evidence scope. **M15 implementation candidate:** the lead worktree now separates offered, active, pending, trial and known-good versions; keeps an active runtime pinned during staging; trials on the next full app launch; promotes only after startup health; and recovers to eligible known-good bytes. The user-facing immediate-update control is removed; legacy IPC does not close or relaunch the runtime. Focused unit and guarded private UI checks passed for the recorded staging, trial, fallback, interruption, Store-state and race cases. The final combined-source run and independent review remain pending; no M20 platform updater or staging publication is implied.

Required focused acceptance uses small signed representative apps and isolated profiles; full clinical UI is not necessary:

- New install, first health acknowledgement, denied install, incompatible release and no app auto-launch.
- Running app remains on original code/assets with its draft and requests intact while a verified successor is staged.
- Focus/minimize/restore/module switch does not activate; genuine close/reopen does, including when already closed at download completion.
- Pending update survives desktop restart; interrupted preparation/activation/trial reconciles correctly.
- Invalid/tampered package, insufficient space, cancellation and retention pressure preserve valid state.
- Failed startup selects an eligible fallback and quarantines candidate; missing/revoked fallback shows recovery without loops.
- Backend outage/authentication failure is distinguished from startup failure; known-good status is not business acceptance.
- Dirty close, pending/unknown writes, original-key reconciliation and session changes preserve truthful outcomes/privacy.
- Launch/update/uninstall concurrency does not race package leases or corrupt activation pointers.
- First-party app-only update works on an unchanged compatible desktop; unsupported capabilities refuse clearly.

Record exact source/tree, package identities, named host and result for relevant unit/private-UI/staging checks. Preserve failures and prior M08/M11 evidence without retroactively certifying new behavior. Physical Windows/G21 and full app/M14 correctness remain separate. This documentation-only decision closes no milestone gate and performs no publication/deployment.

## Retained M08 wire, registry and implementation baseline

M08 keeps M07 catalogue format 1 and its authenticated route intact. Additive GET `/v1/dental-os/update-policy` transports signed opaque `update-policy/staging.json` from the same dedicated release bucket; no new business DB/binding. The canonical envelope has exactly `policy`, `keyId`, `signature`; Ed25519 covers canonical `{purpose:"dental-os-update-policy",keyId,policy}`. Both policy formats retain the same exact staging environment/channel, positive monotonic sequence, issue/expiry (maximum 24 hours), revoked key and app-level controls. Format 1 keeps the M08 app rule shape and authorizes no typed clinic API operation. Format 2 adds a `releases` list of at most three exact records per app: `{version, packageSha256, payloadDigest, apiOperations}`. Each operation must be closed in the host API contract and present in the signed app capability list and platform trust ceiling. Duplicate/malformed identities, unknown operations and over-ceiling grants fail verification. The current catalogue release must match its record; each retained eligible fallback/trial version uses its own record. The whole metadata document remains bounded to 64 KiB and at most 32 apps and 16 revoked keys, under existing pinned roots and signature purpose. The metadata ceiling allows the M17 app family while preserving the separate 16-installed-app resource bound. No new publisher/key/route is introduced. Unknown schemas/signatures, replay/equivocation, missing/skewed authenticated server clock or expired policy refuse safely. See [ADR-026](20_V1_ADR_REGISTER.md#adr-026--release-scoped-first-party-api-authority) for exact API-authority semantics.

Registry format 2 migrates legacy format 1 without inventing health. Per app: active digest, at most three retained immutable versions, optional pending digest, known-good digest, trial digest and at most three quarantined failed digests. Background staging never changes a running lease. Next launch with no lease atomically selects a pending trial; if the old version has no health receipt, open it first unless current signed controls already forbid it. A safe successor may then trial without a fallback; failure requires explicit recovery rather than pretending an untested version is known-good. Before each launch and broker dispatch, enforce current metadata, signed minimum/withdrawal and digest/key revocation. Existing in-flight writes are not undone by metadata changes.

Runtime launch health is bounded DOM/preload availability, negotiated SDK identity and an event-loop probe; timeout/crash before acknowledgement preserves or selects a currently allowed, intact SDK/API-compatible known-good version. Health is never clinical correctness. An interrupted trial lacking acknowledgement is rolled back on next launch; unknown/corrupt state preserves files and requests recovery. A revoked/incompatible fallback blocks rollback, including offline. Our apps have no authoritative local business schema, so rollback cannot silently downgrade one.

Routine normal-session checks begin after 15 seconds and recur every 15 minutes; one operation at a time, current admin authority before download/commit, deadline/cancel/generation fencing. Private fixture profiles have no automatic network checks. Public signed metadata and replay watermarks are the only new disk cache; no bearer/refresh token, patient content or write queue. Cache is reverified, and expired/missing current controls block launches/new operations until a successful refresh while preserving installed files and running work. App payloads stay pinned even while control metadata changes.

The historical explicit Update now path refuses dirty/modal/not-ready runtime state and pending/unknown broker write outcomes, then closes and immediately launches the successor. It is not the normal V1 Update flow defined above. Preserve its safety protections while aligning the Store/runtime; preparation alone must not require closing or discarding work. An unknown outcome remains an in-memory app/operation-key marker across app close until original-key reconciliation or session reset. It contains no patient payload. Bounded retention evicts only unleased versions outside active/pending/trial/known-good protection, journalling state before deletion.

Staging rotation adds a second explicitly pinned public company key, while retaining the prior key for permitted old packages. Keys cannot be downloaded from apps/catalogue. A fresh signed policy can revoke a pinned key; it cannot revoke its own signing key. Root trust changes belong in trusted platform source/release, and production key/installer lifecycle belongs to M20. Operator publication validates reviewed paths/hashes/sequence, conditionally creates immutable packages, then independently CAS-publishes policy and catalogue; a partial publication may fail closed and is repaired with a higher sequence.
