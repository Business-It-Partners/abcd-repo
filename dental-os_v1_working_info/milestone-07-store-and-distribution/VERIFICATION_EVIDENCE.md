# M07 Verification Evidence — Store and Cloudflare delivery

**Milestone verification:** NOT VERIFIED. Local implementation/preparation passes; Windows CI and actual approved staging G07 delivery remain pending. R02/R08/G07. No cloud mutations/deployment or final product certification.

## Source and environment

Baseline main f79ee668faa4586030e37dc28ee68b1d0d9bc7d7; codex/milestone-07. [Source hashes](evidence/source-sha256.json) identify current desktop/tool/fixture/test inputs before CI checkpoint. [Linux metadata](evidence/linux-run.json) records versions, counts, backend commit and resource policy. Separate backend branch codex/sys-0005-dental-os-distribution at 67a5dc5; no merge to cloudfare-staging. [Rollout record](STAGING_ROLLOUT.md) maps exact existing resources and proposed changes.

## Local executed proof — 2026-10-16

Every heavy command ran sequentially with load/memory/process preflight, nice 10, conservative workers, bounded timeout and private display/profile. No dependency install; live desktop/session untouched.

| Command | Actual result | Retained proof |
| --- | --- | --- |
| `node node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=default --reporter=json --outputFile=artifacts/m07-unit.json` | 182 tests / 10 files pass at initial distribution implementation | [log](evidence/unit-full-linux.log), [JSON](evidence/m07-unit.json) |
| `node node_modules/vitest/vitest.mjs run tests/distribution.test.ts --maxWorkers=1 --reporter=default --reporter=json --outputFile=artifacts/m07-distribution-unit.json` | Final 46 focused tests pass after staging-trust/server-clock/final-metadata security review; replaces earlier 40-case coverage | [log](evidence/distribution-unit-final.log), [JSON](evidence/m07-distribution-unit.json) |
| `npm run build` | Final source typecheck, renderer build and Electron compile pass | [log](evidence/build-linux.log) |
| `node tools/run-ui-test.mjs tests/distribution.mjs` | 10 final Store/install/launch/uninstall/restart/artwork cases pass privately | [report](evidence/distribution-verification.json), [log](evidence/store-linux.log), [screenshot](evidence/distribution-store.png) |
| `node tools/run-ui-test.mjs tests/identity.mjs` | Existing 20 identity/session/privacy cases pass after host/IPC wiring | [report](evidence/identity-verification.json), [log](evidence/identity-linux.log) |
| Worker TypeScript 5.9.3 `tsc --noEmit` | Exit 0, no diagnostics | [record](evidence/backend-worker-check.log) |
| Worker Vitest 5.0.3 full `run --maxWorkers=1` | 410 tests / 47 files pass including existing clinic/platform authorization and new routes | [log](evidence/backend-worker-tests.log) |
| Worker final targeted `run test/route-contract/dentalOs.test.ts --maxWorkers=1` | 12 pass after response clock header assertion | [log](evidence/backend-worker-route-final.log) |
| Staging assembler + operator publisher `--validate-only` | Two signed local sample bundles and fresh catalogue prepared/validated; no cloud calls | [public review metadata](evidence/publication-review.json) |
| `node --check` on staging assembler, read-only acceptance and publisher scripts | All parse successfully | No application/deployment executed |

Full initial unit source predates the final security additions; affected distribution tests were rerun instead of repeating unrelated passing suites. Final CI will run the complete current suite. The first backend test command selected wrong root Vitest 2.1.9 and failed before any tests; [failed log](evidence/backend-worker-first-failed.log) retained, corrected locked Worker run supersedes it. First Store screenshot revealed blank raster slots for vector sample icons; fixed using existing Layers/Table2 language, rebuilt and final screenshot inspected. No visual acceptance by the user is implied.

## Case coverage

Signed metadata: valid current/exact-sequence bytes, signature/unsigned/unknown key/altered/noncanonical/body cap; schema/environment/channel, expiry/future/max lifetime, ID/duplicates, traversal/arbitrary URL, size/SDK/API/grant/platform/minimum-version; replay/equivocation, device clock rollback, missing/invalid/skewed authenticated server clock; normal staging key refuses private fixtures and appointment grants.

Transport/lifecycle: fixed HTTPS origin rules, no credentials to R2, no redirects, declared/streamed/truncated/modified bytes, before-download admin denial and pre-commit role recheck, post-download withdrawal/version/payload/capability identity consistency, cancellation/deadline/busy refusal, late generation fencing, outage preservation and independently authorized uninstall. Native proof ties Ready and dock to registry success, isolated signed app launch, no install bridge, uninstall truth and restart persistence.

Backend: new namespace only, absent outside exact staging, methods/query/publisher path refusal, existing actor 401/403/503, admin versus doctor/reception policy, missing/failing/oversized R2, bounded opaque signed-byte response/no-store/current time. [Scope check](evidence/backend-scope.json) proves production config, existing client/shared contracts/business authorities/migrations/deployment workflows unchanged. No frontend rebuild was necessary for a backend-only additive route.

## Actual cloud observations and remaining gate

GitHub cloudfare-staging commit matches 76447b9; read-only Wrangler account matches 03453ad990acaaa56336e5851e24f490 and current bucket inventory has no dedicated Dental OS release bucket. Existing staging Worker/Firebase/D1/private R2 map is recorded without secrets. These are inventory observations, not deployment or actual package delivery evidence.

Required before G07 VERIFIED/main merge: separately authorized dedicated public staging bucket/publisher credentials, reviewed immutable release/catalogue publication, additive staging Worker rollout preserving tenant bindings and existing clients, exact public origin pin, actual catalogue/R2 byte/authorization/freshness proof and affected CI rerun. tools/verify-staging-distribution.mjs is prepared but not executed against undeployed routes. Positive privileged Super Admin account acceptance is not inferred from web reachability/clinic denial. Physical Windows remains deferred after M11/before final release; M08 has not started.
