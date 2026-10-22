# Staging app-feed metadata renewal

Renew only the signed staging catalogue and update policy. Preserve release rows, exact API grants, capabilities, minimum versions, revocations, rollback rules and signing key identities. Never rebuild or upload packages. Production signing/custody remains M20 scope.

The user assigned remaining M15 work to the lead chat on 2026-10-22, including staging preparation/execution. Record the actual executor, source, validation, target and result. The earlier P08 proposal to wait for two named human operators is not a prerequisite to this authorized technical work. This procedure claims no independent human sign-off or production custody certification.

## Prepare and review

Verify branch/source and workstation resources. Retain exact public catalogue/policy bytes, ETags, response dates and SHA-256 values from the pinned staging origin. Establish published and known recorded watermarks without inspecting the user's live profile. A watermark file contains `catalogue` and `updatePolicy`, each with `sequence`, envelope `digest` and `observedAt`. Choose new sequences strictly above the published and recorded values.

Keep the existing protected signer external, mode 0600. After a build, use a new ignored output directory:

```bash
node tools/app-packages/renew-staging-metadata.mjs --staging-metadata-only \
  <old-catalogue.json> <old-policy.json> <watermarks.json> <external-key.pem> \
  <new-catalogue-sequence> <new-policy-sequence> <new-output-dir>
node tools/app-packages/publish-staging-renewal.mjs --validate-staging-only <new-output-dir>
```

The offline tool authenticates expired input under its historical validity clock solely for preparation. The renewed metadata must pass the ordinary present-time verifier and original watermark clock fence. It never changes client watermarks. Review hashes and confirm that only sequence, times and signatures changed. The validation command checks pinned signatures, current live baseline hashes, semantic equality, higher sequences and current freshness before publication.

## Publish staging metadata

```bash
node tools/app-packages/publish-staging-renewal.mjs --apply-staging-metadata-only \
  <reviewed-output-dir> <existing-staging-backend-checkout>
```

The existing Wrangler runtime/login creates one temporary operator Worker on account `03453ad990acaaa56336e5851e24f490`, bound only to `dentmitra-dental-os-releases-cloudfare-staging`. A fresh nonce protects a compiled publication. The only writable keys are `catalogue/staging.json` and `update-policy/staging.json`. Both baselines are checked before the first write, with separate ETag guards. Anonymous and replay denial are checked. The publication POST is never automatically retried. The Worker is deleted in `finally`; retain `publication-result.json` and confirm cleanup.

If a baseline changed, prepare a new higher-sequence review. If one pointer advanced before a conflict, capture both actual states and recover with still-higher sequences. Never rewind a pointer or reset a watermark. If deletion fails, preserve the temporary configuration and remove the exact task-owned Worker before continuing.

## Expiry and recovery proof

Use a disposable synthetic core registry. The first command seeds known-good state under the verified historical baseline clock, switches to actual time and requires expired metadata to block launch without changing pointers. All public package objects are checked sequentially against their signed byte count, wire hash, payload digest and signature. After publication, the second command verifies fresh live controls against original watermarks and confirms every package and registry pointer is unchanged.

```bash
node tools/verify-staging-metadata-renewal.mjs --prepare-expired-staging-profile \
  <retained-baseline-dir> <new-disposable-drill-dir>
# Perform the reviewed metadata publication here.
node tools/verify-staging-metadata-renewal.mjs --verify-renewed-staging-profile \
  <retained-baseline-dir> <disposable-drill-dir>
```

This proves real signed-feed recovery and core registry authorization. Authenticated Store entitlement, native windows and clinical API writes have separate checks. Do not deliberately expire the shared feed or inspect/restart the live user app.

## Cadence and support

During active staging verification, renew within 12 hours and flag a feed with under six hours remaining. Validity remains at most 24 hours. This is a manual staging cadence, with no background signer or customer availability promise. Preserve state during expiry and renew with higher sequences. Corrupt-state and key-compromise recovery follows [security and recovery](SECURITY_AND_RECOVERY.md), not routine renewal.
