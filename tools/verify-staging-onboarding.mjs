// Real signed staging feed/package integration with a synthetic install-policy
// response. The clinic Worker is not authenticated here; no clinic data is read.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawnSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { stagingDistribution } from '../dist-electron/distribution/staging.js';
import { noWatermark, verifyCatalogue } from '../dist-electron/distribution/catalogue.js';
import { verifyUpdatePolicy } from '../dist-electron/distribution/updatePolicy.js';
import { staging } from '../dist-electron/sdk/environment.js';

const require = createRequire(import.meta.url);
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { CatalogueStore } = require('../dist-electron/distribution/storage.js');
const { DistributionService } = require('../dist-electron/distribution/service.js');
const { sha256 } = require('../dist-electron/packages/format.js');
const { createPrivateKey, createPublicKey } = require('node:crypto');
const [guard, keyPath, backendRootInput, rawNextSequence] = process.argv.slice(2);
const nextSequence = Number(rawNextSequence), appId = 'company.sample.preview';
if (guard !== '--staging-onboarding-acceptance' || process.argv.length !== 6 || !Number.isSafeInteger(nextSequence) || nextSequence < 2)
  throw Error('Explicit staging acceptance flag, protected signer, existing SaaS backend worktree and next sequence required');

const root = path.resolve(import.meta.dirname, '..'), backendRoot = path.resolve(backendRootInput);
const helper = path.join(root, 'tools/app-packages/prepare-onboarding-release.mjs');
const publisher = path.join(backendRoot, 'apps/platform-worker/operations/dental-os/publish-via-worker.mjs');
if (!await fs.stat(helper).then(s => s.isFile()).catch(() => false) || !await fs.stat(publisher).then(s => s.isFile()).catch(() => false)) throw Error('Required local staging helpers are missing');
const signerInfo = await fs.lstat(keyPath);
if (!signerInfo.isFile() || signerInfo.isSymbolicLink() || signerInfo.nlink !== 1 || signerInfo.size > 4096 || process.platform !== 'win32' && (signerInfo.mode & 0o077) !== 0) throw Error('Unsafe protected staging signer');
const privateKey = createPrivateKey(await fs.readFile(keyPath));
const signerPublic = createPublicKey(privateKey).export({ type: 'spki', format: 'pem' }).toString();
if (stagingDistribution.policy.keys['company-staging-m08-20261016']?.publicKey !== signerPublic) throw Error('Signer is not the currently pinned M08 staging key');

const checks = [], publications = [], expectedHead = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const check = (name, condition) => { if (!condition) throw Error(`Acceptance failed: ${name}`); checks.push(name); console.log('PASS', name); };
const fetchBounded = async (url, max) => {
  const response = await fetch(url, { redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok || Number(response.headers.get('content-length') ?? 0) > max) throw Error('Staging read unavailable or oversized');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > max) throw Error('Staging response exceeded limit');
  return bytes;
};
const metadata = async (minimumSequence) => {
  const catalogueBytes = await fetchBounded(new URL('catalogue/staging.json', stagingDistribution.publicBase), 65536);
  const policyBytes = await fetchBounded(new URL('update-policy/staging.json', stagingDistribution.publicBase), 65536);
  const now = Date.now();
  const catalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  const policy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
  if (catalogue.sequence < minimumSequence || catalogue.sequence !== policy.sequence || catalogue.issuedAt !== policy.issuedAt || catalogue.expiresAt !== policy.expiresAt) throw Error('Live signed metadata sequence mismatch');
  if (catalogue.releases.length !== policy.apps.length || catalogue.releases.some(r => !policy.apps.some(a => a.id === r.id))) throw Error('Live signed app identities differ');
  return { catalogueBytes, policyBytes, catalogue, policy };
};

const work = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-onboarding-live-'));
const profile = path.join(work, 'profile'), metadataDir = path.join(work, 'prior');
await fs.mkdir(metadataDir, { mode: 0o700 });
let service, registry, baselinePlatform;
const liveTransport = async (input, init) => {
  const url = new URL(typeof input === 'string' ? input : input.url);
  if (url.origin === new URL(stagingDistribution.apiBase).origin) {
    const current = await metadata(1);
    const headers = { 'x-dental-os-time': String(Date.now()) };
    if (url.pathname === '/v1/dental-os/catalogue') return new Response(current.catalogueBytes, { status: 200, headers });
    if (url.pathname === '/v1/dental-os/update-policy') return new Response(current.policyBytes, { status: 200, headers });
    if (url.pathname === '/v1/dental-os/install-policy') return Response.json({ environment: staging.environment, canInstall: true }, { headers });
    return new Response(null, { status: 404 });
  }
  if (url.origin === new URL(stagingDistribution.publicBase).origin) return fetch(input, init);
  return new Response(null, { status: 403 });
};
const identity = { snapshot: () => ({ active: true, generation: 1 }), credential: async () => 'synthetic-local-acceptance-token' };
const expectedHeading = new Map([['1.0.0', /<h1>Coming soon<\/h1>/i], ['1.1.0', /<h1>Your workspace is ready<\/h1>/i], ['1.2.0', /<h1>Release history<\/h1>/i]]);
const inspectContent = lease => expectedHeading.get(lease.manifest.version)?.test(lease.files.get('index.html')?.toString() ?? '');
const sequenceForVersion = new Map();

async function publish(version, sequence, prior) {
  await fs.writeFile(path.join(metadataDir, 'catalogue.json'), prior.catalogueBytes, { mode: 0o600 });
  await fs.writeFile(path.join(metadataDir, 'policy.json'), prior.policyBytes, { mode: 0o600 });
  const output = path.join(work, `release-${version}`);
  const build = spawnSync(process.execPath, [helper, '--staging-only', path.resolve(keyPath), String(sequence), output, path.join(metadataDir, 'catalogue.json'), path.join(metadataDir, 'policy.json'), version], { cwd: root, encoding: 'utf8', timeout: 20000, maxBuffer: 1024 * 1024 });
  if (build.status !== 0) throw Error('Staging release assembly failed');
  const publishResult = spawnSync(process.execPath, [publisher, '--apply-staging-only', output], { cwd: backendRoot, encoding: 'utf8', timeout: 180000, maxBuffer: 1024 * 1024 });
  if (publishResult.status !== 0) throw Error('Temporary staging publication failed or cleanup needs review');
  const published = JSON.parse(await fs.readFile(path.join(output, 'publication.json'), 'utf8'));
  publications.push({ version, sequence, packageSha256: published.releases[0].packageSha256, catalogueSha256: published.catalogueSha256, updatePolicySha256: published.updatePolicySha256, transport: 'temporary operator Worker; R2 conditional writes' });
  const live = await metadata(sequence);
  const localCatalogue = await fs.readFile(path.join(output, 'catalogue/staging.json'));
  const localPolicy = await fs.readFile(path.join(output, 'update-policy/staging.json'));
  check(`published ${version} at signed sequence ${sequence} is live byte-for-byte`, live.catalogueBytes.equals(localCatalogue) && live.policyBytes.equals(localPolicy));
  check(`existing alpha and beta staging listings remain in ${version} catalogue`, ['company.sample.alpha', 'company.sample.beta', appId].every(id => live.catalogue.releases.some(r => r.id === id)));
  sequenceForVersion.set(version, sequence);
  return live;
}

try {
  registry = new PackageRegistry(path.join(profile, 'packages'), stagingDistribution.policy);
  registry.initialize();
  service = new DistributionService(stagingDistribution, registry, identity, new CatalogueStore(path.join(profile, 'distribution')), liveTransport);
  let live = await metadata(1);
  check('current signed Cloudflare staging catalogue and policy verify with the pinned company key', live.catalogue.releases.some(r => r.id === 'company.sample.alpha') && live.catalogue.releases.some(r => r.id === 'company.sample.beta'));
  const first = live.catalogue.releases.find(r => r.id === appId);
  if (!first || first.version !== '1.0.0' || first.status !== 'approved' || first.capabilities.length !== 0) throw Error('The live onboarding release is not the expected capability-free v1');
  sequenceForVersion.set('1.0.0', live.catalogue.sequence);
  publications.push({ version: first.version, sequence: live.catalogue.sequence, packageSha256: first.packageSha256, catalogueSha256: sha256(live.catalogueBytes), updatePolicySha256: sha256(live.policyBytes), transport: 'existing signed Cloudflare staging objects' });
  check('first-party v1 is visible in the real signed feed with zero capabilities', true);
  check('Store service refresh accepts real staging signatures and app IDs', (await service.refresh()).ok && service.view().apps.length === 3);
  check('Store service installs the exact public R2 v1 package', (await service.install(appId)).ok && registry.describe(appId).version === '1.0.0');
  let initial = registry.launch(appId);
  check('installed v1 contains its Coming Soon screen', inspectContent(initial));
  registry.markHealthy(appId, initial.release.digest);
  initial.releaseLease();

  for (const version of ['1.1.0', '1.2.0']) {
    const sequence = nextSequence + (version === '1.1.0' ? 0 : 1);
    live = await metadata(sequence - 1);
    check(`${version} starts from the immediately preceding signed staging sequence`, live.catalogue.sequence === sequence - 1);
    live = await publish(version, sequence, live);
    service.changed();
    const before = registry.describe(appId);
    check(`Store presents ${before.version} → ${version} for the same app ID`, (await service.refresh()).ok && service.view().apps.find(a => a.id === appId)?.version === version && service.view().apps.find(a => a.id === appId)?.installedVersion === before.version);
    const oldDigest = registry.inspect().apps[appId].active;
    const oldLease = registry.launch(appId);
    const staged = await service.install(appId);
    check(`${version} downloads from its immutable public R2 object while old runtime remains pinned`, staged.ok && oldLease.manifest.version === before.version && registry.inspect().apps[appId].active === oldDigest && registry.describe(appId).pendingVersion === version);
    oldLease.releaseLease();
    let trial = registry.launch(appId);
    check(`${version} activates in a protected package trial and contains its feature`, trial.manifest.version === version && !!registry.inspect().apps[appId].trial && inspectContent(trial));
    const digest = trial.release.digest;
    registry.markHealthy(appId, digest);
    trial.releaseLease();
    check(`${version} is known-good only after health acknowledgement and platform source remains fixed`, registry.inspect().apps[appId].knownGood === digest && execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim() === expectedHead);
  }

  const final = registry.describe(appId), installed = registry.inspect().apps[appId];
  check('v1, v1.1 and v1.2 use one app identity with bounded three-release retention', final.version === '1.2.0' && installed.versions.length === 3 && !installed.pending && !installed.trial);
  check('other company app IDs were retained in the feed and were not rewritten locally', ['company.sample.alpha', 'company.sample.beta'].every(id => live.catalogue.releases.some(r => r.id === id)) && !registry.inspect().apps['company.sample.alpha'] && !registry.inspect().apps['company.sample.beta']);
  const report = {
    passed: true,
    platform: process.platform,
    sourceHead: expectedHead,
    environment: staging.environment,
    bucket: 'dentmitra-dental-os-releases-cloudfare-staging',
    publicOrigin: stagingDistribution.publicBase,
    appId,
    sequenceChain: [...sequenceForVersion.values()],
    releases: publications,
    checks,
    limits: [
      'The public signed catalogue, update policy and R2 packages were fetched live and verified by the current Dental OS code.',
      'The authenticated clinic install-policy response was simulated as approved because no external clinic credential was supplied.',
      'Native app-window presentation is covered separately by the passing private Linux onboarding UI run.',
      'No clinic business data, patient data, production resource, or persistent publisher endpoint was changed.',
    ],
  };
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/staging-onboarding-verification.json'), JSON.stringify(report, null, 2));
  console.log('Staging onboarding acceptance passed. The clinic Worker authorization response was simulated; signed feed, policy and packages were live.');
} catch (error) {
  console.error(`Staging onboarding acceptance stopped safely: ${error instanceof Error ? error.message : 'unknown failure'}`);
  process.exitCode = 1;
} finally {
  service?.dispose();
  await fs.rm(work, { recursive: true, force: true });
}
