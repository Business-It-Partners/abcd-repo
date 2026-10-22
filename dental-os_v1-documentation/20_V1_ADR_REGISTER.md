# Dental OS — Architecture Decision Register

**Baseline:** V1, 2026-10-15. Target architecture; implementation status is tracked separately.

Accepted means the agreed product direction, not that implementation exists. Conditional choices need evidence before promotion.

| ADR | Decision | State | Consequence / document |
| --- | --- | --- | --- |
| ADR-001 | Hosted Windows/Linux desktop | Accepted | host remains system authority; 02/16 |
| ADR-002 | First-party apps only for product lifetime | Permanent product constraint | no external publishing/sideloading; 02/19 |
| ADR-003 | Electron/React/TypeScript | Accepted | no required Flutter/Rust runtime; 16 |
| ADR-004 | Existing Dental SaaS remains business authority | Accepted | backend additions within existing system; 04/11 |
| ADR-005 | Independently released self-contained web bundles | Accepted | package/SDK/API version governance; 08/10 |
| ADR-006 | Isolated app contexts and platform-bound identity | Accepted requirement | exact composition gated at M03; 07 |
| ADR-007 | WebContentsView rendering | Accepted for bounded M03 sample proof | foreground native/inactive mirrors; Linux/Windows CI passed; physical tests deferred; 07 |
| ADR-008 | Typed internal SDK and credential-mediating API broker | Accepted | no generic authenticated fetch/token getters; 11 |
| ADR-009 | One login using existing Firebase/Worker authority | Accepted | desktop flow/storage proof required; 12 |
| ADR-010 | R2 release storage + existing Cloudflare catalogue | Accepted direction | dedicated bucket, exact endpoints/metadata frozen in M07; 09 |
| ADR-011 | Staged, pinned-version, atomic updates | Accepted | compatibility-aware rollback; 10 |
| ADR-012 | Online-dependent business operations; no persistent patient cache | Accepted baseline | privacy disk checks; 13 |
| ADR-013 | No general app-to-app communication | Accepted baseline | backend coordination only; 11/19 |
| ADR-014 | Signed metadata/packages, freshness and key lifecycle | Accepted requirement | wire format/algorithm frozen in M06/M07; 08/14 |
| ADR-015 | Ed25519 signatures over canonical release metadata | Accepted for dentalpkg/1 | SHA-256 payload/inventory binding; exact format in 23; M06 evidence governs implementation acceptance |
| ADR-016 | Windows/Linux installer/update formats | Open release decision | select supported matrix before M20 acceptance; 16 |
| ADR-017 | Reuse fewa_demo infrastructure; staging-only backend execution | Accepted execution constraint | verify repository/branch/GitHub environment/resource mapping; production changes/promotion separately authorized; 09 |
| ADR-018 | New OS APIs under /v1/dental-os; existing business routes unchanged | Accepted route boundary | additive services with explicit authorization; prefix is not deployment isolation; 09/11 |
| ADR-023 | Company-signed catalogue registers first-party app IDs within a platform capability ceiling | Accepted for V1 company apps | new IDs do not require per-app shell branches; platform still pins company roots and a capability ceiling; 09/10/14/23 |
| ADR-024 | Explicit app update closes the app and leaves it closed after activation | Superseded by ADR-025 before implementation acceptance | historical decision retained below |
| ADR-025 | Stage verified updates; activate on next full launch without disturbing running work | Accepted target; M15 implementation candidate integrated and focused checks passed; final combined-source verification pending | lifecycle authority: 10; product motivation: 01 |
| ADR-026 | Release-scoped first-party API grants in the existing signed update policy | Accepted 2026-10-22; implementation/final verification tracked in M15 | API/broker authority: 11; update-policy schema: 09/10 |
| ADR-027 | Host-owned clinic JSON contract 1 under exact signed release grants | Accepted technical design in M15; source/runtime verification tracked separately | SDK 1.2; exact app/method/path/query and trusted session capability checks; 11 |

| ADR-030 | OS-owned read-only Files and scoped local file-selection receipts | M16.1 contract selected 2026-10-22; implementation and G16 runtime proof remain open | [M16 architecture](../dental-os_v1_working_info/milestone-16-file-acquisition/ARCHITECTURE.md); G16 |

New ADRs identify problem, options, decision, tradeoffs, affected invariants/contracts, migration/recovery, evidence and milestone. Record supersession explicitly. Do not silently turn a candidate into an accepted/proven implementation.

## ADR-019 — GitHub Windows CI during milestones; physical device testing after the platform milestone

Accepted user decision, 2026-10-15: automated Windows evidence permits milestone progression when applicable gates pass; native physical-device acceptance remains a separate mandatory gate before final product release. The 2026-10-19 sequence placed Windows/Linux release operations at M13 and physical acceptance under G14. The 2026-10-20 sequence places app shells at M13, functional apps at M14, Windows/Linux release operations at M20, and physical/device acceptance under G21 after M20. These changes apply to future ownership only; prior results are preserved. Record CI limitations and deferred scenarios. Hosted-runner automation never certifies a physical device.

## ADR-020 — Bounded uncompressed dentalpkg/1 web container

M06 chooses canonical JSON with base64 file records over ZIP/TAR: deterministic assembly, no compression/link/special-file representation and no new parser dependency. Tradeoffs are base64 size/memory overhead and bounded synchronous verification (16 MiB wire, 8 MiB assets); not suitable for medical imaging payloads. [Exact contract](23_V1_PACKAGE_FORMAT.md) owns limits, signatures, trust and recovery semantics. Platform-owned ID/key/grant policy remains authoritative; production trust is empty until approved release keys exist. No third-party or production sideloading route follows. M07 owns remote freshness/key lifecycle; M08 controls full update/rollback policy. Unknown local schemas preserve files and refuse operation instead of silently migrating/resetting.

## ADR-021 — Public staging package bytes, authenticated install authority

User direction for the app-delivery milestones: dedicated public staging bucket with signed non-sensitive company packages; private package delivery is deferred to actual dental-application delivery. Catalogue and current admin policy remain existing-Worker authenticated. Main owns credentials and never sends them to R2. Signed fresh metadata, pinned origin, exact byte identities and local registry remain installation prerequisites. Public readability does not authorize clinical API use. M07 uses a controlled operator publisher, no clinic upload route or third-party publishing. User authorized the named staging provisioning, publication, and deployments on 2026-10-16; production remains excluded. Live publication and current signed-package verification are recorded in milestone evidence.

## ADR-022 — Separate signed update controls with persisted trial state

M08 selects an additive signed update-policy document over changing the M07 catalogue schema. This preserves existing SaaS/M07 transport contracts and keeps explicit rollback/revocation authority separate from app content. Registry migration does not infer health; active bytes remain leased until close, trial/health/failure transitions persist atomically, and recovery respects current minimum/revocation. Trust anchors are explicitly shipped platform keys, including staging rotation; remote metadata cannot add a publisher. See [update contract](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) for wire/state/timing details and M08 evidence for actual verification scope.

## ADR-023 — Signed first-party app onboarding within the shipped company trust ceiling

**Decision:** The platform does not keep a per-app allowlist that must change for every new company app. A currently pinned company publisher key may register a new `company.*` app ID through the fresh, signed staging catalogue and matching signed update policy. The platform ships the company publisher trust root and a bounded maximum capability set; each release and update policy carries the exact app capability grant, and the verifier rejects any grant outside that platform ceiling. Catalogue, policy, package, registry, and runtime identity must match. The package cannot supply an ID authorization, capability, key, origin, preload, or native code.

**Tradeoff:** An approved company signing key can onboard new first-party IDs without an Electron release, while compromise of that key could authorize an app within the shipped company capability ceiling. Revocation, expiry, sequence freshness, minimum versions, and digest/key revocation remain signed controls. Adding a capability outside the ceiling still requires a trusted platform policy/release change. This does not create third-party publishing, arbitrary sideloading, or a public extension API.

**Evidence and limits:** Linux tests cover the generic runtime and Store path; Cloudflare staging sequences 12–14 demonstrate `company.sample.preview` `1.0.0` → `1.1.0` → `1.2.0`, with sequence 15 publishing 1.3.0. Authenticated clinic Store install/update service acceptance and a private live-feed desktop install/update/restart pass are recorded in [M11 evidence](../dental-os_v1_working_info/milestone-11-flexible-first-party-app-updates/VERIFICATION_EVIDENCE.md). The user reports completing the manual 1.3.0 desktop update. Local failure/recovery tests and final-source Windows CI pass. The 16 minimal synthetic apps measured 2.09 GiB peak aggregate working set across 20 processes; closing all app views returned the shell to 487 MiB across four processes. This is a working-set sum with no enforced budget, not PSS or proof for clinical workloads/low-memory devices. M11 closes G11 for its recorded scope; this does not certify Windows release operations (M20/G20) or final device acceptance (G21).

## ADR-024 — Simple explicit app update; next open runs the successor (superseded)

**Status:** superseded by ADR-025 on 2026-10-21. The following records the earlier decision, not the current target.

**Decision (2026-10-21):** at the user's direction, use Update → safe close → verified atomic activation → Updated/Open, leaving the app closed. Download/verification may precede close. Next user launch starts the new version. This supersedes immediate relaunch as the explicit update-now UX; it does not supersede signed controls, immutable package bytes, health/trial recovery or compatibility-aware rollback in ADR-011/022.

**Tradeoff and safety:** removes the need for a user-facing download/apply split or automatic relaunch, at the cost of interrupting that app at the safe activation boundary. Resolve drafts and pending/unknown writes before close; do not routinely kill active work. Other apps remain running. Preserve the old recoverable version if preparation or activation fails.

**Scope/evidence:** M13 platform follow-up; Store/runtime implementation and focused tests remain pending. Current update-now closes and immediately starts the successor. This is an accepted product decision only, not a new milestone completion or release claim. The [update contract](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) owns behavior; the [product vision](01_WHY_DENTAL_OS.md) owns its motivation. No runtime edits or additional remote authority follow from this documentation consolidation.

## ADR-025 — Staged app updates with next-full-launch activation

**Decision (2026-10-21):** at the user's direction, the Store Update action prepares a verified immutable candidate on disk while the running app remains pinned and usable. The next full launch after normal close selects a persisted trial; startup health acknowledges success or selects an eligible known-good fallback. No forced app close, live code replacement or automatic relaunch is required. This explicitly supersedes ADR-024; preserve its history, not its behavior as a current requirement.

**Tradeoff:** users may keep the old version open until their next natural close, avoiding interrupted clinic work. Store state must distinguish pending from active versions. Signed security withdrawal, compatibility and freshness rules remain enforced separately. Package rollback never undoes server-side business operations.

**Scope/evidence:** retain ADR-011/022's immutable package, lease, trial and recovery foundations and M08/M11 evidence. Store/runtime alignment and focused acceptance remain pending M13 platform follow-up, with no new milestone number/gate closure or remote operation. The [install/update contract](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) alone owns detailed lifecycle rules and required verification; this register records the decision and supersession. Documentation does not approve a new API-permission format or claim revised runtime behavior implemented.

## ADR-026 — Release-scoped first-party API authority

**Decision (2026-10-22):** a first-party app release receives only the closed host API operation IDs explicitly granted to that exact package version and digests by the existing company-signed catalogue/update-policy authority. Use the already pinned company trust roots, signature purpose, freshness, sequence, revocation and environment controls. Do not introduce an API-specific signing key, trust root, endpoint, route manifest, app-to-app message or intent system.

The additive update-policy format 2 carries up to three exact release records per app: semantic version, package wire SHA-256, package payload digest and operation IDs. The signed app-level capability list and platform/company trust ceiling remain ceilings. The catalogue's current release must match the corresponding format-2 identity. Retained eligible trial/known-good/fallback versions use their own exact records; no version borrows a successor's grant. Format 1 remains usable for its prior update-safety purpose but authorizes no typed clinic API operation.

The initial closed API catalogue contained `appointments.list` and `appointments.setStatus`. ADR-027 subsequently defines the host-owned clinic JSON contract for `clinic.api.request`; it still requires an exact signed release grant and precise local route/session validation. `clinic.api.blob.read` remains denied without a later explicit media contract. These decisions approve no new Worker routes or business schema semantics. Session/Worker authorization remains authoritative; renderer code receives no credentials and cannot select a tenant, role, absolute URL or headers. JSON path/method selections resolve only within the versioned host-owned contract.

SDK/API major 1 remains compatible for an app-only release that selects an operation already defined by the host. A new operation contract, route, schema or security/business semantic requires explicit platform/API compatibility review and its own host release before any package grant can name it. First-party catalogue onboarding remains bounded by platform trust and capability policy under ADR-023.

**Tradeoff and migration:** release-scoped records permit approved app-only capability evolution without updating the desktop, at the cost of signed policy growth and retaining grants for every eligible local release (bounded to three). Format-1 policy fails closed for API calls during migration. If an exact record is absent, expired, revoked, mismatched or outside the platform ceiling, that release receives no API authority; safe update/fallback policy remains independently enforced.

**Scope/evidence:** the user selected the existing signed company catalogue/update-policy authority on 2026-10-22. M15 integrates the format-2 verifier/resolver and synthetic positive/negative tests for a previously unlisted first-party app and a v1→v1.1 API-only grant extension on the same host implementation. See [M15 verification evidence](../dental-os_v1_working_info/milestone-15-platform-closeout-and-integration/VERIFICATION_EVIDENCE.md). Final combined-source verification, M14's per-app route inventory, media, navigation, and payload needs remain tracked separately; this ADR alone does not close G15 or authorize a new route.

## ADR-027 — Host-owned clinic JSON contract 1

**Decision (2026-10-22):** under the user's instruction to complete M15 platform contracts, SDK 1.2 adds a fixed clinic JSON contract for the eleven existing first-party app identities. Each request needs the exact package's signed `clinic.api.request` grant, its package/app-family capability, an exact host-approved method/path/query and current trusted session capabilities. Recheck after credential mediation. Unknown app identities have no generic JSON surface. Worker tenancy, business schemas, capability checks and transaction semantics remain authoritative.

Replace broad path prefixes with the [compiled catalogue and reviewed app scope](../docs/CLINIC_JSON_API_CONTRACT.md). Preserve existing JSON/envelope/response, deadline/concurrency and unknown-write limits. Supplier scope is explicit; staff/payroll reads require independent sensitive capabilities. No upload handle, credentials, arbitrary route manifest, new trust root, new Worker route, print/export escape or app-to-app transport is introduced. Media and OS navigation retain their separate design gates.

**Compatibility:** the existing signed format-2 envelope and exact version/wire/payload identity remain unchanged. The operation catalogue grows by one implemented contract; old hosts reject unsupported grants. Policy migration must be reviewed separately from renewal and preserve eligible retained release grants. P08 sequence-22 renewal enabled no API grants. Implementation, per-app negative/positive checks and real service proof remain source-bound M15 evidence; this decision alone does not close P04 or G15.

## ADR-028 — Typed host-mediated private media read contract

**Decision (2026-10-22):** under the user's instruction to complete platform capabilities independently of M14 app implementation, SDK 1.3 defines `clinic.media.read`. The host derives fixed metadata/view/download routes from a typed media kind and UUIDs, retrieves fresh authenticated metadata, and verifies exact parent/status/size/MIME/SHA-256 before returning bytes. Retain existing company signed format-2 exact-release authority, app-family/session ceilings and Worker tenancy/business authorization. No extra trust root, renderer upload/storage URL or generic binary API is introduced.

The [media contract](../docs/CLINIC_MEDIA_API_CONTRACT.md) declares 10 MiB patient-media and 25 MiB Staff-document bounds matching the maintained SaaS service, one active read per registration/two globally and a 30-second deadline. Preserve the legacy denied blob operation and its limits. In-memory transfer buffers are transient, bounded and discarded on termination; no authoritative local business database or hidden offline write queue is created.

**Review and compatibility:** this is an explicit host contract extension reviewed against existing Worker list/view/download semantics and backend `307a21b`; no M14 app completion is a prerequisite to its platform tests. New operation grants require a supported host and separate reviewed publication. Read tests, actual staging compatibility and final source evidence remain required; uploading and any OS navigation need separate explicit contracts. This decision itself does not close P04/P07/G15 or authorize production changes.

## ADR-029 — Explicit host-mediated private upload contract

**Decision (2026-10-22):** under the user-directed platform capability completion scope, SDK 1.4 adds `clinic.media.upload` with explicit begin/chunk/commit/cancel stages. The host owns bounded transient buffers, SHA-256, fixed intent/content/finalise/abort routes and credentials. Preserve existing signed company exact-release authority, app/session ceilings and authoritative Worker tenancy. The [upload contract](../docs/CLINIC_MEDIA_UPLOAD_CONTRACT.md) defines 8 KiB chunks inside the existing envelope, unchanged 10/25 MiB domain limits, two transfers, bounded receipts and lifecycle/outcome behavior.

Explicit original-key retries and authoritative active-file reconciliation protect unknown outcomes. Cancellation does not undo an already committed clinical record. No local authoritative database, disk-backed transfer queue, background upload retry, general messaging or new trust root is introduced. Full native/staging proof, fresh-session recovery and support cleanup remain required M15 work; no public capability grant, backend deployment, production access or checklist completion is implied by this design checkpoint.

## ADR-030 — OS-owned local file acquisition, Files, and recipient-bound receipts

**Decision direction (2026-10-22):** Dental OS provides a read-only Files core system window, a common OS-owned custom picker and a parented native host picker fallback. Trusted Electron main mediates local host filesystem access. A company dental app may request only an approved user-gesture-controlled selection, receiving an opaque, short-lived, release/window/session-bound receipt and no raw path or Node access.

**Options:** requiring host file explorer alone causes fullscreen friction; each app building its own explorer duplicates privileges and UX; generic fs SDK access is forbidden; OS-owned read-only service and picker is selected. The Files UI is system owned, not a dental package elevated beyond its declared privileges. A drag gesture is preferred but not assumed reliable across WebContentsView; explicit user-directed Send to an eligible app is mandatory fallback.

**Compatibility and safety:** Existing M15 signed format-2 clinic API grants do not authorize local filesystem access. Implement a distinct, versioned local selection contract guarded by verified company package, platform trust ceiling, explicit user action and current session; choose exact signed metadata/release policy representation under M16.1 before implementation. Preserve ADR-013/R13 no general app messaging, sandbox/context isolation, OS path/ACL/symlink safety, revocation and non-persistence of patient content.

**Owner and proof:** M16/G16. [Architecture](../dental-os_v1_working_info/milestone-16-file-acquisition/ARCHITECTURE.md) and [Plan](../dental-os_v1_working_info/milestone-16-file-acquisition/PLAN.md). New code, local drag semantics, host permission handling, Windows/Linux focus and resource behavior require source-bound acceptance. No Cloudflare upload, business record association, file modification, staging/production deployment or G16 completion is implied by this ADR.

### M16.1 contract resolution (2026-10-22)

After inspecting the M15 source, M16 selects a distinct SDK local operation `local.files.pick` (candidate minor 1.5). A current signed app manifest, fresh company-signed **app-level capability** in existing update-policy metadata, platform company ceiling, approved clinic app-family session and exact registered WebContents/frame/release are all required. The existing format-2 **clinic API** release-grant list is unchanged and cannot grant local host file permissions. In particular, the current default local-operation authorization path in SessionManager must never be sufficient to open files.

The trusted app preload observes genuine `isTrusted` pointer/keyboard activation and registers a short-lived, single-use, main-process activation ticket (750 ms). Caller-provided gesture booleans/nonces are refused. Actual file access additionally requires explicit user choice in the **OS-owned picker** or parented native open dialog. The app gets only a short-lived, one-recipient metadata receipt; no host path, file bytes, generic read/write/execute permission or media upload.

Read-only OS Files uses main-process rooted, opaque folder IDs and paged listings; the shell owns the Files window and eligible drop/Send destination. Files-to-app is a platform-mediated selection receipt, not a general app-to-app messaging bus. Native cross-WebContentsView drag remains a runtime proof risk, so explicit Send is mandatory. Review and validation criteria are in [M16 architecture §11](../dental-os_v1_working_info/milestone-16-file-acquisition/ARCHITECTURE.md). This ADR resolves **design direction only**; SDK code, native FS safety, Linux/Windows dialogs and G16 remain unimplemented.
