# M11 Verification Evidence — flexible first-party app onboarding and updates

**Milestone verification:** VERIFIED for the documented automated and staging scope. G11 is closed for this scope; M13/G13 app shells, M14/G14 functional apps, and M20/G20 plus final physical/product acceptance G21 remain separate.

## Required proof

- Generic approved company-app identity, signed authorization and bounded capability checks without per-app runtime branches.
- New third-app install from the real staging catalogue, plus same-ID app-only releases `1.0.0` → `1.1.0` → `1.2.0` with no Dental OS platform update.
- Dirty-work, uncertain-write, interruption, revocation, failed-health, rollback, retention and session-boundary safety.
- Resource/process behavior at the app limit.
- Applicable hosted Windows CI for the exact M11 source.
- Complete G11/R02/R03/R05/R08/R09/R12/R15 evidence review. Host installers and release operations belong to M20.

## Evidence record format

For every run retain: date; source commit plus uncommitted tree identity where applicable; dependency/build versions; named OS/architecture/display/profile; exact command; exit status; successful/failed cases; redacted log/artifact paths; limitations and requirement/gate bindings. Never include credentials or patient payloads.

## Executed evidence

### Local safety and failure-matrix verification — 2026-10-20

- On Linux, `node node_modules/vitest/vitest.mjs run --maxWorkers=1 tests/appOnboarding.test.ts tests/distribution.test.ts tests/updates.test.ts tests/packages.test.ts tests/runtimeContracts.test.ts tests/sdkBroker.test.ts tests/identity.test.ts tests/hardening.test.ts` passed: 8 files / 234 tests. This includes 14 update refusal cases that preserve installed/active/known-good state, a correctly signed outsider package refused by trust policy, update trial rollback/restart recovery, session/identity clearing, broker write uncertainty and safe diagnostics.
- `python3 tools/check-dental-docs.py`, both new Windows resource script syntax checks, and `git diff --check` passed. Build and private runtime/onboarding suites had already passed for the same Electron source changes; the final Windows run will rebuild and rerun the complete required suite.
- At the time of this Linux-only matrix run, the hosted 16-app measurement was still pending; its final Windows result is recorded below. Physical Windows-device acceptance remains deferred to G14.

### Scoped first-party app onboarding/update slice — 2026-10-19

- Source branch: `codex/milestone-11`; tested source worktree was based on `7f6e65bf2b8990ba656ed66261670e4f842439dc` and was subsequently recorded in local commit `fbcd156f`. Host: Linux; private UI scenarios used the project's isolated headless GNOME display and disposable profiles. No live Dental OS window was focused, closed, or restarted.
- `npm run build` passed. The final full serial unit suite passed: 13 files / 259 tests. Private Linux UI: onboarding 19 checks (including the restored generic-company-app arrival flight), distribution 10 checks, and update safety/recovery 8 checks passed. The update UI's first run timed out on stale expected wording; assertion was aligned with the current safe refusal message and the full rerun passed. See unique `artifacts/*onboarding-regression*` reports/screenshots; original pre-existing Store/update artifacts were restored byte-for-byte.
- Separate Dental SaaS operator branch `codex/sys-0008-dental-os-third-app-publisher`: 13 tests passed across generic publication validation, conditional publishing, and publication transport. No persistent Worker API, clinic route, D1 migration, binding, or production configuration changed.
- Live Cloudflare staging bucket `dentmitra-dental-os-releases-cloudfare-staging`, public origin `https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev`; app ID `company.sample.preview`; signed sequence chain 12 / 13 / 14 for versions 1.0.0 / 1.1.0 / 1.2.0. Exact package SHA-256 values and catalogue/update-policy hashes are retained in [staging-onboarding-verification.json](../../artifacts/staging-onboarding-verification.json). Existing alpha/beta catalogue entries were retained. Each successor used a temporary operator Worker with conditional R2 writes and replay/anonymous guards; the temporary Worker was removed after publication.
- The current verifier/Store service read the real signed public catalogue, update policy, and immutable R2 packages. The three-sequence run installed v1 and staged/activated v1.1 and v1.2 through protected trial/health transitions while preserving the old active lease. That run simulated install authorization. A separate read-only run using the supplied staging clinic credential then proved real Firebase sign-in and `/v1/me`, authenticated Store metadata/install-policy requests, a fresh Store install of live 1.2.0, and a Store update from a verified 1.0.0 package to live 1.2.0. The old lease remained pinned during download, and 1.2.0 became known-good after health acknowledgement. Details are in [staging-onboarding-auth-verification.json](../../artifacts/staging-onboarding-auth-verification.json); no credential or clinic identity is retained.
- Private Linux onboarding UI verifies the generic first-party app thumbnail flies from its Store detail page to the rightmost dock slot, stays hidden during flight, lands with matching Store/dock artwork, and becomes visible after arrival. App-window and v1.2 relaunch behavior also pass in the private UI fixture.
- Authenticated private desktop acceptance against the real staging session/feed passed first install of signed 1.2.0, Store-to-dock flight, update from signed 1.0.0 to 1.2.0, app health acknowledgement, and a full Dental OS process restart with the actual staging-signed app. Redacted results are in [staging-onboarding-desktop-verification.json](../../artifacts/staging-onboarding-desktop-verification.json).
- No patient/business records, production resources, or local authoritative business database were touched. The app declares zero capabilities. The user-reported manual 1.3.0 click-through and final-source Windows/resource verification are recorded below.

## Platform and user acceptance

Final Windows CI passed on source `e14cd1254f5ca6b2f9abc89b60ab7d9fa89d055f` in [run 39363492330](https://github.com/Business-It-Partners/dental-os/actions/runs/39363492330) on `windows-2022` (5m20s). All 36 unit suites passed: 272 passed, 2 pending, 0 failed. Documentation, build/typecheck, hardening, recovery, the two-app and 16-app resource profiles, integration, update, Store/distribution, package, host, runtime, SDK and identity/session checks all passed. The retained summary is [windows-m11-final-ci-verification.json](../../artifacts/windows-m11-final-ci-verification.json); the run artifact also contains the complete per-process sample JSON and logs. The 16 synthetic apps stayed open and health-checked for 60.406 seconds across 20 Electron processes. Aggregate Windows working set peaked at 2,195,152 KiB (2.09 GiB); its final still-open sample was 1,857,232 KiB. Closing all app views released them and returned the four-process shell to 498,516 KiB (487 MiB). The profile measures a sum of working sets, not PSS/private bytes, and enforces no memory ceiling. Its static zero-capability pages are not representative clinical apps and do not certify low-memory devices. The same run's two-app profile measured six processes, 874,236 KiB peak and 642,636 KiB final. Physical Windows acceptance remains G14 after M13; no installer or production-release certification is claimed.

## Additional staging-policy acceptance evidence

- Record that certification uses local/staging artifacts and feeds; production backend promotion or public production publishing remains a separately authorized task.

Staging-only operator publication executed against the existing bucket/origin and pinned M08 signer. No Worker API source/configuration/binding changed, so shared-client deployment regression checks were not applicable. The separate operator publisher's local validator/conditional transport suite passed. The original three-release current-Store-service run used live signed metadata/R2 packages with simulated install-policy; follow-up authenticated service and private desktop acceptance verified real Worker authorization, current 1.2.0 installation, a 1.0.0 → 1.2.0 update, and native desktop restart. The user-reported 1.3.0 desktop update is recorded below. Local failure/recovery coverage and final-source Windows CI pass; the measured 16-app memory footprint and its limits are recorded above.

### Earlier hosted Windows CI — 2026-10-20

- Source: `codex/milestone-11` at `2a943385c28fe80a3d8cc217a4404463297c0d16`.
- [GitHub Actions run 39361016871](https://github.com/Business-It-Partners/dental-os/actions/runs/39361016871) completed successfully on `windows-2022` in 4m29s. Documentation validation, 36 unit suites (257 passed, 2 pending), build/typecheck, hardening, preserved-state recovery, bounded resources, integrated OS/API, update crash recovery and update safety, Store/distribution, package recovery/runtime, hosted startup/recovery, isolated runtime, SDK/broker and identity/session checks all passed.
- The retained two-app Windows resource sample ran for 60.5 seconds with six app-owned processes and two views; aggregate working set peaked at 939,088 KiB and ended at 661,644 KiB. This is the existing two-app CI profile, not the M11 16-app resource acceptance.
- Earlier attempts on the same branch exposed the Windows default-code-page issue in the docs checker and outdated hardening/integration assertions; the fixes are included in the passing source. Physical Windows acceptance remains deferred to G14 after M13.

## Follow-up manual Store update release — 2026-10-19

- After the original sequence 12–14 acceptance, published `company.sample.preview` / Dental Workspace Preview 1.3.0 at signed sequence 15 to the same staging bucket. It adds a visible app-update status panel and preserves the zero-capability grant and existing alpha/beta entries. The release used the existing pinned M08 signer and temporary operator Worker; conditional publication and cleanup passed. No production or clinic business data was changed.
- Live catalogue and update-policy signatures, the immutable public R2 object, package signature, digest, app identity, version, feature content, and zero capabilities were reverified. Exact hashes are in [staging-onboarding-1.3.0.json](../../artifacts/staging-onboarding-1.3.0.json).
- A disposable `DistributionService` refresh seeded with the prior public 1.2.0 package showed live 1.3.0 over installed 1.2.0 and the Store's **Download update** action enabled alongside **Open**. Its install-policy response was simulated; this verifies the offer state, not the user's authenticated click-through.
- Manual desktop acceptance: on 2026-10-20 the user reported that they had already updated locally to 1.3.0 and that the Store now shows 1.3.0 with only **Open**. This is the expected current state once installed version equals catalogue version, and confirms the manual app-only update completed. It closes the manual 1.3.0 click-through item; M11's automated/staging completion and the remaining G14 device/product gate are recorded above.

## 2026-10-20 roadmap amendment

The future milestone assignments changed after this M11 evidence was recorded: M13 is now first-party app shells, M14 is functional Dental OS apps, and the former M13 host-release scope is M20. M11's verification results are unchanged. The final physical/device gate is now G21 after M20; older dated run notes above retain their original context.
