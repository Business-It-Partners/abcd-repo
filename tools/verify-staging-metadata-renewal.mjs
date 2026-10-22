// Public signed staging feed + disposable core registry proof. No identity/live profile access.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const [guard, baselineRoot, output] = process.argv.slice(2);
if (!['--prepare-expired-staging-profile', '--verify-renewed-staging-profile'].includes(guard)
  || !baselineRoot || !output) throw Error('Explicit staging renewal drill mode and disposable paths required');
const require = createRequire(import.meta.url);
const { stagingDistribution: config } = require('../dist-electron/distribution/staging.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, allowUpdatedPackage } = require('../dist-electron/distribution/updatePolicy.js');
const { sha256, canonical, verifyPackage } = require('../dist-electron/packages/format.js');
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const root = path.resolve(output), baseline = path.resolve(baselineRoot), appId = 'company.sample.alpha';
const beforeCat = fs.readFileSync(path.join(baseline, 'catalogue.json'));
const beforePolicy = fs.readFileSync(path.join(baseline, 'updatePolicy.json'));
const historicalClock = Math.min(JSON.parse(beforeCat).catalogue.expiresAt, JSON.parse(beforePolicy).policy.expiresAt) - 1;
let catalogue = verifyCatalogue(beforeCat, config.policy, noWatermark, historicalClock).catalogue;
let policy = verifyUpdatePolicy(beforePolicy, config.policy, noWatermark, historicalClock).policy;
let clock = historicalClock;
const get = async (key, maximum) => {
  const response = await fetch(new URL(key, config.publicBase), { redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) throw Error('Public staging read failed');
  const reader = response.body.getReader(), chunks = []; let size = 0;
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length;
    if (size > maximum) throw Error('Staging object exceeds declared bound'); chunks.push(part.value); }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks);
};
const inventory = async () => {
  const rows = [];
  for (const release of catalogue.releases) {
    const bytes = await get(release.objectKey, release.packageBytes);
    if (bytes.length !== release.packageBytes || sha256(bytes) !== release.packageSha256) throw Error('Immutable package changed');
    const verified = verifyPackage(bytes, config.policy);
    if (verified.release.digest !== release.payloadDigest) throw Error('Package payload identity changed');
    rows.push({ id: release.id, version: release.version, objectKey: release.objectKey, sha256: sha256(bytes), bytes: bytes.length });
    if (guard === '--prepare-expired-staging-profile' && release.id === appId) fs.writeFileSync(path.join(root, 'sample.dentalpkg'), bytes, { flag: 'wx', mode: 0o600 });
  }
  return rows;
};
if (guard === '--prepare-expired-staging-profile') {
  fs.mkdirSync(root, { mode: 0o700 });
  const packages = await inventory();
  const registry = new PackageRegistry(path.join(root, 'profile/packages'), config.policy); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, clock), () => false);
  const digest = registry.install(fs.readFileSync(path.join(root, 'sample.dentalpkg')));
  const seeded = registry.launch(appId); registry.markHealthy(appId, digest); seeded.releaseLease();
  const state = registry.inspect(); clock = Date.now();
  let expiredBlocked = false; try { registry.launch(appId).releaseLease(); } catch { expiredBlocked = true; }
  if (!expiredBlocked || canonical(state) !== canonical(registry.inspect())) throw Error('Expired metadata did not preserve fail-closed state');
  fs.writeFileSync(path.join(root, 'before.json'), JSON.stringify({ source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'cloudfare-staging', setup: 'Disposable known-good registry seeded under verified baseline historical clock; then switched to actual current clock.',
    historicalClock, observedAt: clock, appId, digest, expiredBlocked, state, packages,
    catalogueSequence: catalogue.sequence, policySequence: policy.sequence }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('PASS: all public package identities verified; expired actual staging metadata blocks synthetic known-good launch and preserves registry.');
} else {
  const before = JSON.parse(fs.readFileSync(path.join(root, 'before.json')));
  const freshCat = await get('catalogue/staging.json', 65_536), freshPolicy = await get('update-policy/staging.json', 65_536);
  clock = Date.now();
  const catVerified = verifyCatalogue(freshCat, config.policy, { sequence: before.catalogueSequence, digest: sha256(beforeCat), observedAt: before.observedAt }, clock);
  const polVerified = verifyUpdatePolicy(freshPolicy, config.policy, { sequence: before.policySequence, digest: sha256(beforePolicy), observedAt: before.observedAt }, clock);
  const oldCatalogue = catalogue, oldPolicy = policy; catalogue = catVerified.catalogue; policy = polVerified.policy;
  if (catalogue.sequence <= before.catalogueSequence || policy.sequence <= before.policySequence
    || canonical(catalogue.releases) !== canonical(oldCatalogue.releases) || canonical(policy.apps) !== canonical(oldPolicy.apps)
    || canonical(policy.revokedKeys) !== canonical(oldPolicy.revokedKeys)) throw Error('Invalid metadata-only recovery');
  const packages = await inventory();
  if (canonical(packages) !== canonical(before.packages)) throw Error('Package inventory changed');
  const registry = new PackageRegistry(path.join(root, 'profile/packages'), config.policy); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, clock), () => false);
  if (canonical(registry.inspect()) !== canonical(before.state)) throw Error('Registry changed before recovery');
  const lease = registry.launch(appId);
  if (lease.release.digest !== before.digest) throw Error('Recovery selected another package'); lease.releaseLease();
  if (canonical(registry.inspect()) !== canonical(before.state)) throw Error('Renewal changed registry pointers');
  let staleRejected = false; try { verifyCatalogue(beforeCat, config.policy, catVerified.watermark, clock); } catch { staleRejected = true; }
  if (!staleRejected) throw Error('Old control accepted after renewal');
  const report = { passed: true, environment: 'cloudfare-staging', checks: {
    expiredBaselineBlocked: before.expiredBlocked, freshSignedControlsAccepted: true, semanticAuthorityUnchanged: true,
    immutablePackagesUnchanged: packages.length, registryPointersUnchanged: true, sameKnownGoodPackageAuthorized: true,
    oldMetadataRejected: staleRejected, packageWrites: 0, clinicalWrites: 0,
  }, source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  catalogueSequence: catalogue.sequence, policySequence: policy.sequence, expiresAt: Math.min(catalogue.expiresAt, policy.expiresAt),
  catalogueSha256: sha256(freshCat), policySha256: sha256(freshPolicy), packages,
  limits: 'Public signed staging control and core registry authorization proof. No authenticated Store entitlement, clinical API or native window UI acceptance.' };
  fs.writeFileSync(path.join(root, 'result.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify(report));
}
