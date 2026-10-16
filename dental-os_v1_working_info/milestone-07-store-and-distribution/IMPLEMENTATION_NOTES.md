# M07 Implementation Notes — First-party Store and Cloudflare delivery

## Baseline and implemented scope

Main f79ee668 after verified M06. Signed package/registry primitives remain the executable authority. New electron/distribution modules implement exact signed catalogue/freshness checks, OS replay watermark, fixed-origin credential-free streaming downloads, pre-activation catalogue/admin rechecks, safe Store projections and cancellation/session fences. Normal Store/dock now derive from trusted catalogue/registry state. DeliveryStore reuses existing quiet visual style and vector sample artwork; no dock/window geometry rewrite. Old Store remains only in guarded prototype mode.

Normal staging trust pins a separate company public key for two synthetic samples, with platform-local grants only; no appointment operations until M09 integration. Public origin stays null before provisioning approval. Production trust/private test keys remain separate. Private --distribution-fixtures transport cannot call the network and proves install/launch/uninstall/relaunch. Credential-bearing API calls use the fixed staging host; anonymous package requests never carry credentials or accept redirects. Package updates deliberately await M08 policy.

## Separate backend patch

Prepared /home/master-x/Desktop/fewa_demo/dental-os-m07-backend from exact cloudfare-staging 76447b9, branch codex/sys-0005-dental-os-distribution. SYS-0005 owns additive routes, optional dedicated R2 binding, operator publisher and operational notes. Existing SaaS checkout/untracked work preserved. Env/routing addition refuses non-staging and reuses existing clinic authority; admin-only install policy does not alter clinic/platform roles. No migrations, production config edits, frontend changes or deployments. Worker typecheck and full 410 tests pass. Ignored dependency-cache links reuse identical lockfile inputs; no npm installation needed.

## Publisher and cloud boundary

External mode-0600 staging key signs deterministic sample bundles/fresh 24-hour catalogue through prepare-staging.mjs; public key only in source. Output stays ignored under release/. Operator --validate-only checks reviewed bytes/paths/hashes locally. Cloud writes require scoped bucket credentials and explicit --apply-staging-only; immutable PUT and ETag pointer concurrency guards refuse overwrite/replay. Read-only Wrangler inventory/account matches existing staging map; proposed release bucket is absent. [Exact rollout](STAGING_ROLLOUT.md) is prepared for separate approval. No live catalogue/R2 acceptance claimed before that rollout.

## Verification findings

The first backend test command selected root Vitest 2.1.9 rather than locked Worker 5.0.3 and exited before tests due worker-pool option mismatch. Correct Worker-scoped runtime then passed all 410 tests. Typecheck was repeated using exact Worker TypeScript 5.9.3 (root cache was 5.7.3). Initial private Store screenshot showed blank image slots because sample dock icons are vectors, not raster assets; replaced those slots with existing Layers/Table2 vector language and scoped styling, then rebuilt/reverified. No live desktop windows were opened/focused.

## Remaining acceptance

M07 local/CI proof is not live G07 completion. Separate approval is needed for dedicated public staging bucket, scoped publisher setup, actual reviewed publication and additive staging Worker deployment; then pin the actual public origin and run live read-only delivery/existing-client checks. Positive privileged Super Admin interaction requires its own approved credential if that scenario is required; reachability/clinic denial are labeled accordingly. Physical Windows remains deferred after M11. Do not mark M07 verified or merge it into main until required live evidence exists. M08 not started.
