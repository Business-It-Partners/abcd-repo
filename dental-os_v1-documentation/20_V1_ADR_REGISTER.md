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
| ADR-016 | Windows/Linux installer/update formats | Open release decision | select supported matrix before M13 acceptance; 16 |
| ADR-017 | Reuse fewa_demo infrastructure; staging-only backend execution | Accepted execution constraint | verify repository/branch/GitHub environment/resource mapping; production changes/promotion separately authorized; 09 |
| ADR-018 | New OS APIs under /v1/dental-os; existing business routes unchanged | Accepted route boundary | additive services with explicit authorization; prefix is not deployment isolation; 09/11 |
| ADR-023 | Company-signed catalogue registers first-party app IDs within a platform capability ceiling | Accepted for V1 company apps | new IDs do not require per-app shell branches; platform still pins company roots and a capability ceiling; 09/10/14/23 |

New ADRs identify problem, options, decision, tradeoffs, affected invariants/contracts, migration/recovery, evidence and milestone. Record supersession explicitly. Do not silently turn a candidate into an accepted/proven implementation.

## ADR-019 — GitHub Windows CI during milestones; physical device testing after M13

Accepted user decision, 2026-10-15: automated Windows evidence permits milestone progression when applicable gates pass; native physical-device acceptance remains a separate mandatory gate before final product release. On 2026-10-19, the user re-sequenced the remaining work: M11 is flexible app onboarding/update, M12 is OS shell UI, and M13 is Windows/Linux release/operations. The device deadline therefore moves from after the former M11 release milestone to after M13 under G14. This reassigns future milestone ownership only; prior results are preserved. Record CI limitations and deferred scenarios. Hosted-runner automation never certifies a physical device.

## ADR-020 — Bounded uncompressed dentalpkg/1 web container

M06 chooses canonical JSON with base64 file records over ZIP/TAR: deterministic assembly, no compression/link/special-file representation and no new parser dependency. Tradeoffs are base64 size/memory overhead and bounded synchronous verification (16 MiB wire, 8 MiB assets); not suitable for medical imaging payloads. [Exact contract](23_V1_PACKAGE_FORMAT.md) owns limits, signatures, trust and recovery semantics. Platform-owned ID/key/grant policy remains authoritative; production trust is empty until approved release keys exist. No third-party or production sideloading route follows. M07 owns remote freshness/key lifecycle; M08 controls full update/rollback policy. Unknown local schemas preserve files and refuse operation instead of silently migrating/resetting.

## ADR-021 — Public staging package bytes, authenticated install authority

User direction for platform milestones through M13: dedicated public staging bucket with signed non-sensitive company samples; private package delivery is deferred to actual dental-application delivery. Catalogue and current admin policy remain existing-Worker authenticated. Main owns credentials and never sends them to R2. Signed fresh metadata, pinned origin, exact byte identities and local registry remain installation prerequisites. Public readability does not authorize clinical API use. M07 uses a controlled operator publisher, no clinic upload route or third-party publishing. User authorized the named staging provisioning, publication, and deployments on 2026-10-16; production remains excluded. Live publication and current signed-package verification are recorded in milestone evidence.

## ADR-022 — Separate signed update controls with persisted trial state

M08 selects an additive signed update-policy document over changing the M07 catalogue schema. This preserves existing SaaS/M07 transport contracts and keeps explicit rollback/revocation authority separate from app content. Registry migration does not infer health; active bytes remain leased until close, trial/health/failure transitions persist atomically, and recovery respects current minimum/revocation. Trust anchors are explicitly shipped platform keys, including staging rotation; remote metadata cannot add a publisher. See [update contract](10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) for wire/state/timing details and M08 evidence for actual verification scope.

## ADR-023 — Signed first-party app onboarding within the shipped company trust ceiling

**Decision:** The platform does not keep a per-app allowlist that must change for every new company app. A currently pinned company publisher key may register a new `company.*` app ID through the fresh, signed staging catalogue and matching signed update policy. The platform ships the company publisher trust root and a bounded maximum capability set; each release and update policy carries the exact app capability grant, and the verifier rejects any grant outside that platform ceiling. Catalogue, policy, package, registry, and runtime identity must match. The package cannot supply an ID authorization, capability, key, origin, preload, or native code.

**Tradeoff:** An approved company signing key can onboard new first-party IDs without an Electron release, while compromise of that key could authorize an app within the shipped company capability ceiling. Revocation, expiry, sequence freshness, minimum versions, and digest/key revocation remain signed controls. Adding a capability outside the ceiling still requires a trusted platform policy/release change. This does not create third-party publishing, arbitrary sideloading, or a public extension API.

**Evidence and limits:** Linux tests cover the generic runtime and Store path; Cloudflare staging sequences 12–14 demonstrate `company.sample.preview` `1.0.0` → `1.1.0` → `1.2.0`, with sequence 15 publishing 1.3.0. Authenticated clinic Store install/update service acceptance and a private live-feed desktop install/update/restart pass are recorded in [M11 evidence](../dental-os_v1_working_info/milestone-11-flexible-first-party-app-updates/VERIFICATION_EVIDENCE.md). The user reports completing the manual 1.3.0 desktop update. Local failure/recovery tests and final-source Windows CI pass. The 16 minimal synthetic apps measured 2.09 GiB peak aggregate working set across 20 processes; closing all app views returned the shell to 487 MiB across four processes. This is a working-set sum with no enforced budget, not PSS or proof for clinical workloads/low-memory devices. M11 closes G11 for its recorded scope; this does not certify Windows release operations (M13/G13) or final device acceptance (G14).
