# M07 reviewable staging rollout — authorized 2026-10-16

**Prepared:** 2026-10-16. Authorized staging provisioning/publication completed; backend deployment/live acceptance in progress. Local/CI verification is separate from live G07 acceptance.

## Verified existing target

| Item | Verified target |
| --- | --- |
| Dental OS repository/branch | Business-It-Partners/dental-os / codex/milestone-07 |
| Backend repository/source | Business-It-Partners/dental-saas / origin/cloudfare-staging at 76447b93155a2b9bcb52887efa1ba0b73c361630 |
| Backend prepared worktree/branch | /home/master-x/Desktop/fewa_demo/dental-os-m07-backend / codex/sys-0005-dental-os-distribution, SYS-0005 |
| GitHub environment/workflow | cloudfare-staging / .github/workflows/cloudfare-staging-deploy.yml |
| Cloudflare account | 03453ad990acaaa56336e5851e24f490; matched read-only Wrangler account and workflow config |
| Worker/API | dentmitra-api-cloudfare-staging / https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev |
| Firebase | dental-managemetn-staging |
| Control D1 | dentmitra-control-cloudfare-staging / 55ac8b32-9c22-46c5-ab05-45988adff79f; unchanged |
| Existing private R2 | dentmitra-private-cloudfare-staging; unchanged, not used for packages |
| Proposed dedicated public R2 | dentmitra-dental-os-releases-cloudfare-staging; created on 2026-10-16 |
| Public download origin | https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev; verified and pinned |
| New API routes | authenticated GET /v1/dental-os/catalogue and /v1/dental-os/install-policy |

No production names/configuration are targets. Existing SaaS checkout remains on its original branch with unrelated user files preserved. Backend dependency caches are reused through ignored node_modules links in the isolated worktree; lockfile hashes match, no dependency install.

## Authorized staging operations

1. Create only the proposed dedicated staging release bucket and enable its public development URL for synthetic signed app bundles. No patient-media/backups exposure. Record/pin its actual HTTPS origin; never guess an r2.dev address. Public development endpoint is a staging mechanism, not a production hosting decision.
2. Provision/use publisher credentials scoped only to this bucket (environment names DENTAL_OS_R2_ACCESS_KEY_ID and DENTAL_OS_R2_SECRET_ACCESS_KEY). No credential values in chat/source/logs. Existing Cloudflare read access works; dedicated S3 publishing credentials are not assumed to exist.
3. Publish two reviewed, platform-local-capability company sample packages and fresh signed catalogue. Local preparation tool accepts external protected staging key, increasing sequence and new output directory; current review artifact is recorded in evidence/publication-review.json. Packages are immutable conditional writes, catalogue ETag/sequence guarded. Regenerate fresh metadata if its 24-hour window expires before acceptance; never replay a sequence already observed by a desktop.
4. Integrate the reviewed additive SYS-0005 backend patch into cloudfare-staging and use the existing protected staging deployment workflow/binding procedure. This changes the central staging Worker, so retain source/workflow/deployment IDs. No new D1 migration exists; inspect and stop for unrelated pending migration rather than applying it as M07 work. Preserve all generated tenant bindings, existing clinic and Super Admin routing, and existing private bucket.
5. Pin verified public origin in Dental OS, rerun affected checks/Windows CI, then execute tools/verify-staging-distribution.mjs --staging-distribution-readonly with the approved staging account via an external mode-0600 credential file. This only reads cloud APIs and installs/uninstalls samples in a disposable local profile. Check existing /health, clinic /v1/me, clinic-versus-platform denial and both existing staging web clients. Positive privileged Super Admin account interaction is a separate credential-dependent scenario; do not invent a pass from clinic denial/HTTP reachability.
6. Only after live G07 proof passes: retain actual resource/deployment/byte identities, mark VERIFIED, checkpoint and normal-merge M07 to Dental OS main. M08–M10 are also authorized by the user; proceed in order without a permission pause.

## Signing and publication ownership

The M07 staging signing private key is local-only outside the checkout in the owner's protected release-key directory (0600 file / 0700 directory). Only its public key is shipped in electron/distribution/staging.ts. It authorizes two synthetic company sample IDs and platform-local grants; no dental appointment read/write permission. Private runtime-test keys are separate and refused by normal staging policy. No production signing key is created.

The local release assembler is tools/app-packages/prepare-staging.mjs. Backend operator publisher is apps/platform-worker/operations/dental-os/publish.mjs; --validate-only makes no cloud calls, --apply-staging-only is now authorized for this named staging target. No clinic publishing route, arbitrary URL, app-supplied preload or third-party portal.

## Recovery and rollout limits

If optional catalogue service fails, existing installations stay intact; unsupported/expired/new downloads refuse safely. Before publish retain previous signed catalogue and ETag; recovery publishes a reviewed higher sequence rather than replaying old metadata. Worker rollback follows the existing staging procedure and preserves clinic bindings/private resources. Do not delete bucket contents or change production as rollback. Deployment/public access/publisher credential changes each remain within this explicit staging scope.

AGENTS.md says milestone authorization “does not extend to deployments”; the SaaS AGENTS.md says staging deployment/acceptance are separate explicitly authorized actions. This record prepares the exact change for that approval; it does not grant it.

## Authorization amendment — 2026-10-16

The user explicitly granted all necessary Dental OS work through M10 and requested continuous M07→M08→M09 execution without permission pauses. The staging operations in this record are now authorized, superseding earlier pending-approval statements; production remains untouched. Record actual outcomes before acceptance, keep commits/branches/checkpoints, and maintain controlled single-job resource use.

## Executed rollout evidence

Dedicated bucket/public origin created; review sequence 2 published through a temporary operator Worker because OAuth cannot mint S3 credentials and management PUT ignores conditional headers. Real R2 absence/ETag guards, immutable byte reuse, anonymous denial and catalogue replay denial passed. Temporary publisher and probe objects removed. No persistent publisher route. Backend guarded publisher implementation and ticket are on codex/sys-0005-dental-os-distribution; normal staging merge f8ffc002a8080cf51bb28af62a63a0b9fb844705 uses the existing deployment workflow. All 13 Control D1 migrations already applied; no pending/new migration. Public-origin-only desktop change passes final build/typecheck and 46 focused distribution cases.
