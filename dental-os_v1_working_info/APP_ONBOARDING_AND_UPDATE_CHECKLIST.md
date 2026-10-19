# First-Party App Onboarding and Independent Update — Working Checklist

**Status:** IMPLEMENTING — generic onboarding, authenticated staging Store install/update, and live-feed private desktop install/update/restart pass on Linux; Windows CI and M11 resource/host gates remain open.
**Milestone assignment:** M11 — Windows/Linux release and operations.
**Purpose:** The sole detailed implementation and acceptance checklist for proving that a newly approved first-party app can be installed from the Store and then updated independently of the Dental OS platform.

## Authority and scope

This file owns the detailed checklist, acceptance criteria, and evidence list for this specific work. The root [WORK_CHECKLIST.md](../WORK_CHECKLIST.md) and [master roadmap](00_V1_MASTER_ROADMAP.md) link here but do not duplicate these task items. The [V1 architecture](../dental-os_v1-documentation/00_V1_README.md), [package contract](../dental-os_v1-documentation/23_V1_PACKAGE_FORMAT.md), [Store and Cloudflare policy](../dental-os_v1-documentation/09_V1_STORE_AND_CLOUDFLARE_DISTRIBUTION.md), [runtime contract](../dental-os_v1-documentation/07_V1_APP_RUNTIME_AND_ISOLATION.md), and [safe update contract](../dental-os_v1-documentation/10_V1_INSTALL_UPDATE_AND_UNINSTALL.md) remain normative. This checklist does not revise or reopen the verified M07/M08 gates.

The end-to-end demonstration is:

1. Publish a new, synthetic, first-party sample app to the existing Dental OS **Cloudflare staging** release path. Its first release displays “Coming Soon.”
2. Install it from the real staging catalogue and open it in its own Dental OS app window.
3. Publish version 1.1.0 of the same app with a plainly visible sample feature; update it.
4. Publish version 1.2.0 of the same app with a second visible sample feature; update it again.
5. Refresh the Store for each release, show the update for the installed app, and select **Update**.
6. Verify the updated app runs each new feature while the Dental OS platform version and other installed apps remain unchanged.

The acceptance gate is intended to prove two related but distinct things: **new-app onboarding** (a third company app can be approved, installed, and launched without hand-adding another renderer case) and **independent release updates** (a later version of that app does not require a Dental OS platform release). M07/M08 prove important package and update behavior within their recorded sample scope; they do not prove that the runtime is generic for new app IDs. The scoped tests below prove the generic Linux runtime, authenticated live staging Store install/update service path, and signed package/update flow. A private Linux desktop also completed a live staging Store install, flight, update, app health check, and full process restart.

The app is a synthetic acceptance fixture, not a dental workflow. It must use no patient data, perform no clinical writes, and introduce no local business database or offline write queue. Apps remain company-controlled and first-party for the product lifetime. There is no third-party publisher, public extension marketplace, or arbitrary sideload path.

## Implemented onboarding path (2026-10-19)

- [Runtime contracts](../electron/runtime/contracts.ts), [runtime manager](../electron/runtime/manager.ts), registry, Store, dock, and layout handling now accept validated company app identities through one bounded generic path; the old `studio` and `records` apps retain their identities and behavior.
- The platform pins company signing roots and a capability ceiling. A fresh company-signed catalogue plus matching signed update policy authorizes new `company.*` IDs and exact per-app grants; packages cannot add roots or exceed the ceiling. See [ADR-023](../dental-os_v1-documentation/20_V1_ADR_REGISTER.md#adr-023--signed-first-party-app-onboarding-within-the-shipped-company-trust-ceiling).
- Synthetic `company.sample.preview` releases `1.0.0`, `1.1.0`, and `1.2.0` are published to Cloudflare staging at catalogue/policy sequences 12, 13, and 14. The live feed retains alpha/beta.
- The signed metadata and immutable packages were fetched from the pinned public origin and verified through the current verifier/Store service/registry. A real staging clinic session completed Store refresh, first install of 1.2.0, and an authenticated 1.0.0 → 1.2.0 update in disposable local profiles; evidence is [staging-onboarding-auth-verification.json](../artifacts/staging-onboarding-auth-verification.json). No clinic records were accessed or changed.
- The private Linux onboarding UI verifies the new company app thumbnail flies from its Store detail page into the rightmost dock slot, stays hidden until landing, and then reveals with matching artwork. An authenticated private desktop run against the live staging Store also installed 1.2.0, verified the flight, updated a separate 1.0.0 install to 1.2.0, acknowledged app health, and relaunched the actual signed package after a full Dental OS process restart. See [live staging desktop evidence](../artifacts/staging-onboarding-desktop-verification.json). Windows CI, resource/process acceptance, and the remaining M11 gates remain open.

The first-party boundary remains company-controlled. This enables new company app IDs without a per-app shell branch; it does not create third-party publishing, arbitrary sideloading, or a public extension API.

## Work checklist

### 0. Assign and freeze the work scope

- [x] Assign the follow-up to M11 as a scoped amendment after the user authorized implementation on 2026-10-19. M11 is active; its original release/operations gates remain required.
- [x] Record the exact starting branch `codex/milestone-11`, source SHA `7f6e65bf2b8990ba656ed66261670e4f842439dc`, named Cloudflare staging bucket/origin, live predecessor sequence 11, and existing artifacts before changes.
- [x] Keep onboarding a new app ID separate from updating an installed app; authenticated staging evidence records both service and live desktop flows.
- [x] Freeze the test identity as `company.sample.preview` and use that exact ID across `1.0.0` → `1.1.0` → `1.2.0`.
- [x] Keep installed apps and runtime layouts bounded at 16 identities/slots; preserve the existing app-view cap. The memory/process budget at that limit remains unmeasured and is tracked below.

### 1. Resolve the first-party trust and registration model

- [x] Record the company-key, signed-catalogue/update-policy onboarding decision and its capability-ceiling tradeoff in ADR-023.
- [x] Use a pinned company signer plus fresh signed catalogue/update policy within a platform-shipped ID namespace and capability ceiling; this sample ID did not require a per-app Electron branch. New capabilities outside the ceiling still require a platform change.
- [x] Verify package grants against the platform company capability ceiling and exact signed catalogue/update-policy grants; negative over-grant unit coverage passes.
- [x] Keep the M08 signing key outside the checkout/package and use only its already pinned public key; metadata cannot add a root.
- [x] Preserve signed environment/channel, sequence/expiry, revocation/minimum-version, compatibility, and package/count bounds; the original onboarding chain advanced through sequences 12–14, followed by the manual-update release at sequence 15 (recorded in M11 evidence). M08 negative-evidence scope remains separately recorded.
- [x] Check signed catalogue/policy/package/registry identity and exact zero-capability grants at install and launch; staging and local unit/UI checks pass.

### 2. Remove sample-only runtime assumptions safely

- [x] Replace fixed two-ID layouts with validated bounded app identities and reject invalid/uninstalled identities in the shared runtime path.
- [x] Resolve app ID, host, title, icon, and update dispatch generically from verified package/catalogue identity; apps still cannot select origin, session, preload, or privileges.
- [x] Route the new app through the existing isolated sandboxed runtime lifecycle, broker binding, health, close, update, and uninstall path; private Linux UI and unit tests pass.
- [x] Use one package ID through Store, dock, window lifecycle, layout, focus, and installed-app recovery.
- [x] Preserve the shared foreground input surface and bounded 16-slot runtime; resource use at the maximum limit remains unmeasured.
- [x] Keep updates scoped to the selected app; live package-registry verification preserved the old active lease until activation and left platform source unchanged.
- [x] Retain per-app leases; both live 1.1.0 and 1.2.0 checks confirmed the previous release stayed active during download.

### 3. Build three synthetic app releases

- [x] Add a capability-free v1 “Coming Soon” screen with visible version; package/registry evidence carries stable ID `company.sample.preview`.
- [x] Add a harmless v1.1.0 welcome/install guide and version marker with no business writes.
- [x] Add a distinct v1.2.0 release-history panel and version marker.
- [x] Build three distinct immutable packages for one app ID, with compatible SDK/API declarations and zero capabilities; retain three-version history.
- [x] Sign all three through the authorized staging process with the external pinned M08 key; the key and values are absent from checkout/evidence.
- [x] Verify package signatures, wire/payload digests, bounds, entry, file inventory, publisher, capabilities, and platform compatibility before publication and on live download.
- [x] Keep the synthetic assets local HTML/CSS only; no remote code, frames, network requests, or backend operations.

### 4. Publish only to the verified Cloudflare staging resources

- [x] Reconfirm the pinned staging API/public origin, bucket, key ID, live sequence 11, protected signer, and existing temporary-Worker publisher immediately before staging-only operations; no production resource was used.
- [x] Reuse the existing bucket/catalogue. The operator-only publisher was generalized in a separate SYS-0008 worktree; no clinic Worker route, binding, D1, or business API changed.
- [x] Publish content-addressed package paths and matching signed catalogue/policy at sequences 12, 13, and 14; conditional object and pointer guards passed.
- [x] Fetch and byte-compare live signed metadata after each publication; the current verifier/DistributionService installed all three exact public R2 packages and confirmed app identity and compatibility.
- [x] Not applicable to this operator-only publication: no shared Worker source/configuration/binding changed. Existing operator conditional-publisher/transport tests pass.
- [x] Keep all work in the named staging bucket with synthetic content; no clinic records, production feeds, or user desktop app session were changed.

### 5. Prove first installation from the Store

- [x] Use a fresh temporary Linux test profile and record the unchanged Dental OS source head; the staging runtime profile began without the preview app installed.
- [x] Refresh the current `DistributionService` against the live signed staging feed; title, version, notes, platform list, and zero capabilities verify. A real staging clinic session received authenticated catalogue, update-policy, and install-policy responses.
- [x] Verify authenticated Store `Get` installs the current signed 1.2.0 package from public R2 and completes local registry/health checks in a disposable profile. The earlier three-sequence run installed each package through the Store service with simulated install authorization; the authenticated run separately covers the current live release.
- [x] Verify v1’s Coming Soon package content and isolated runtime window in private Linux UI; actual signed staging v1 content is separately verified through the live Store service/registry.
- [x] Verify a newly onboarded company app thumbnail flies from its Store page to the rightmost dock slot, stays hidden in flight, lands with the matching Store/dock artwork, and reveals only after animation completion.
- [x] Run existing Store and update UI regressions: alpha/beta IDs remain intact; both apps launch, alpha updates without replacing beta, and beta rollback remains app-local.
- [x] Keep publisher IDs in the `company.*` namespace and require signed metadata; package/capability-negative unit tests pass, with no sideload path added.

### 6. Prove two sequential app-only updates (v1 → v2 → v3)

- [x] Record platform source head `7f6e65bf2b8990ba656ed66261670e4f842439dc`; no platform package/build update occurred during sequences 12–14.
- [x] Publish v1.1.0 at sequence 13 while the same app’s 1.0.0 release remained installed and known-good.
- [x] Refresh the live signed Store service and verify `company.sample.preview` 1.0.0 → 1.1.0 with release notes; existing alpha/beta listings remain unchanged.
- [x] Verify the live 1.1.0 package downloads while the old version lease and active pointer stay pinned, then safely trial/health-acknowledge the new release. The explicit Update button/app-window sequence is additionally covered by private UI fixtures.
- [x] Verify the platform source stayed fixed and 1.1.0 became known-good only after health acknowledgement; the existing UI update suite proves beta remains unchanged during alpha update.
- [x] With 1.1.0 known-good, publish 1.2.0 at sequence 14 and retain the same app ID.
- [x] Verify the live Store service offers 1.1.0 → 1.2.0, downloads the public package while the old lease stays pinned, and trial/health-acknowledges the release-history feature.
- [x] Verify 1.2.0 digest/known-good state, three-version retention, unchanged platform source, and preservation of the other signed catalogue entries.
- [x] Install and update through the authenticated live Store, open staging-signed 1.2.0, and confirm it survives a full Dental OS process restart; see [live staging desktop evidence](../artifacts/staging-onboarding-desktop-verification.json).
- [x] Use capability-free static releases and the public R2 package path; no SaaS business API or local business database was accessed or written.

### 7. Prove safety, recovery, and refusal paths

- [ ] During an update, test network loss, cancellation, short/oversized response, digest mismatch, invalid package signature, malformed metadata, stale/replayed sequence, incompatible SDK/API, withdrawn release, revoked digest/key, and insufficient disk space. In each case keep the installed known-good app coherent.
- [ ] Verify an unknown/new ID that is not authorized by the approved first-party trust policy cannot install or launch, even if its package is correctly signed by an untrusted key.
- [ ] Verify an app cannot expand its grants by changing its manifest or catalogue request; undeclared broker operations remain denied.
- [ ] Verify an app with dirty/modal work or pending/unknown backend writes cannot be silently replaced or closed by Update. Preserve the existing save/reconcile/explicit-close rules.
- [ ] Inject a v2 launch-health failure and verify the safe compatible known-good version is selected according to M08 policy; do not treat launch health as proof of clinical correctness.
- [ ] Verify update/lock/logout/session-generation changes close and clear only the intended isolated runtime state, and diagnostics contain no patient data, drafts, tokens, URLs with credentials, or response bodies.
- [ ] Verify app close/update/uninstall releases renderer views, listeners, timers, captures, leases, and temporary files without deleting another app’s package or SaaS data.

### 8. Verification and evidence

- [x] Add generic onboarding/capability/update unit coverage and private runtime/UI checks; the existing update UI suite exercises dirty-work refusal, lease pinning, clean activation, and app-local rollback.
- [x] Add and pass a private Linux onboarding UI scenario covering third-app install/arrival flight, v1.1/v1.2 Update actions, safe health, bounded history, and v1.2 relaunch.
- [x] Run read-only authenticated staging acceptance with the real clinic session: fresh Store install of 1.2.0 and update from a verified 1.0.0 install to live 1.2.0; old lease pinning and health acknowledgement pass. See [authenticated staging evidence](../artifacts/staging-onboarding-auth-verification.json).
- [x] Linux `npm run build`, the full serial unit suite (13 files / 259 tests), and the private onboarding/distribution/update UI suites pass.
- [ ] Full Windows CI has not run for this M11 branch; physical Windows is deferred under the existing decision.
- [ ] The installed/open-app limit is bounded, but memory/process measurements at that limit have not been run.
- [x] Run the operator publisher validator plus conditional-publisher/transport tests (13 passed); no shared Worker/API/config/binding changed, so existing-client deployment regressions were not applicable.
- [x] Retain exact app hashes, sequence/policy/catalogue digests, named staging bucket/origin, test commands/results, and private UI screenshots without secrets or clinical data. Resource/process counts remain open.
- [x] Update this checklist, M11 status/evidence, requirement traceability, architecture ADR, tooling guide, and root work index; keep Windows CI, resource/process, and remaining host gates open.

## Acceptance gate

This work is complete only when all of the following are true:

- [x] Authenticated staging Store service acceptance: a real clinic session authorized a fresh install of live 1.2.0 and an update from signed 1.0.0 to live 1.2.0, with the previous runtime pinned and new release health-acknowledged.
- [x] Native desktop click-through against the authenticated live staging feed and restart of the actual staging-signed package; see [live staging desktop evidence](../artifacts/staging-onboarding-desktop-verification.json).
- [x] The current Store service/package registry passed live signed/R2 versions 1.0.0 → 1.1.0 → 1.2.0 through the original sequence test; the authenticated live Store path separately passed the 1.0.0 → 1.2.0 update. The platform package stayed fixed.
- [x] The Dental OS/Electron platform build stays unchanged during the app-only v1.0.0 → v1.2.0 Store update; the signed catalogue keeps the existing apps coherent.
- [x] New app onboarding and app updates use a generic trusted path rather than adding another per-app runtime branch. The new `company.sample.preview` ID is authorized by the signed staging policy and handled through the shared runtime/Store path.
- [ ] Dirty work, ambiguous writes, invalid or interrupted packages, revocation, and failed health checks preserve the safe recovery behavior described in M08.
- [ ] Linux verification, applicable Windows CI, staging evidence, resource/process regression, and required client regressions pass for the assigned scope.
- [ ] The assigned milestone and global status identify exactly what passed, what remains unverified, and whether user acceptance or physical-device testing is still pending.

## Explicit exclusions

- No production catalogue, production bucket, production key, or production deployment/promotion.
- No third-party publisher, public extension API, arbitrary sideload, app-owned native code, or app-selected preload.
- No Dental SaaS production feature work, patient data, clinical writes, local business database, or offline write queue.
- No Electron/Dental OS platform update in the app-update scenario. Platform updater/install certification remains in M11.
- No claim of physical Windows-device acceptance, broad Windows 8 support, or final product release from this checklist alone.
