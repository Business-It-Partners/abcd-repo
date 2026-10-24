// Read-only public staging readback for the Standard Window M17 app updates.
// Bundles are installed and launched only in a disposable local PackageRegistry.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { canonical, sha256, verifyPackage } = require('../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
const {
  verifyUpdatePolicy,
  allowUpdatedPackage,
  apiReleaseGrantForPackage,
  apiOperationsForPackage,
  apiReleaseGrantMatchesCatalogue,
} = require('../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution, m17StagingKeyId } = require('../dist-electron/distribution/staging.js');

const checkout = path.resolve(import.meta.dirname, '..');
const [baselineInput] = process.argv.slice(2);
if (process.argv.length !== 3 || !baselineInput) throw Error('Expected one external sequence-68 baseline directory');
const baselineRoot = path.resolve(baselineInput);
if (baselineRoot === checkout || baselineRoot.startsWith(checkout + path.sep)) {
  throw Error('The pre-publication baseline must remain outside the checkout');
}

const expectedApps = [
  {
    id: 'company.dental.finance.m17', version: '1.7.1',
    packageSha256: '06fc2eaab19a73d59c12dd5bfd7d2528fee41e6ce8b76b614698b9c2945a3a2d',
    payloadDigest: '5e2a558d912c4f71d2a519e1565c51882f3f078c9f091036b8b303efdfe1e42b',
    capabilities: ['clinic.app.finance', 'clinic.api.request', 'session.context'],
  },
  {
    id: 'company.dental.lab-tracker.m17', version: '1.0.1',
    packageSha256: 'e356d161b31face186fb0358e2ffb5c810d06d4af147fe7d3cd661c341cd8219',
    payloadDigest: 'de3051fc15d3da9502a8cc94c611c6b07c665404c241362abcc4adbb3912e4cb',
    capabilities: ['clinic.app.lab-tracker', 'clinic.api.request', 'session.context'],
  },
  {
    id: 'company.dental.staff.m17', version: '1.0.1',
    packageSha256: 'bdf3e6da9466b2ea599e95b79784f1332815a676c028cd0573e285aba16584df',
    payloadDigest: '340da0f2550b1e91aedfaa4e31c93d4c15ba8b1862c3d2f92d406dade4c2ee00',
    capabilities: ['clinic.app.staff', 'clinic.api.request', 'session.context', 'clinic.media.read', 'clinic.media.upload'],
  },
];
const maxMetadataBytes = 65_536;
const maxPackageBytes = 2_097_152;
const checks = [];
const verified = [];
let phase = 'baseline';
let temporaryRoot;
let passed = false;
let failure = null;
const check = (name, condition) => {
  if (!condition) throw Error('Acceptance check failed: ' + name);
  checks.push(name);
};
const readFile = (file, maxBytes) => {
  const info = fs.lstatSync(file);
  if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > maxBytes) {
    throw Error('Invalid or oversized verification input');
  }
  return fs.readFileSync(file);
};
const fetchBytes = async (url, maxBytes) => {
  const response = await fetch(url, {
    redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body) throw Error('Public staging read failed');
  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) throw Error('Public staging object exceeds its size bound');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw Error('Public staging object exceeds its size bound');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
};

try {
  if (stagingDistribution.publicBase !== 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev') {
    throw Error('Pinned staging distribution fence mismatch');
  }
  const baselineCatalogueBytes = readFile(path.join(baselineRoot, 'catalogue/staging.json'), maxMetadataBytes);
  const baselinePolicyBytes = readFile(path.join(baselineRoot, 'update-policy/staging.json'), maxMetadataBytes);
  const baselineCatalogue = verifyCatalogue(baselineCatalogueBytes, stagingDistribution.policy, noWatermark, Date.now()).catalogue;
  const baselinePolicy = verifyUpdatePolicy(baselinePolicyBytes, stagingDistribution.policy, noWatermark, Date.now()).policy;
  check('saved sequence-68 baseline signatures and shared freshness verify', baselineCatalogue.sequence === 68
    && baselinePolicy.sequence === 68 && baselineCatalogue.issuedAt === baselinePolicy.issuedAt
    && baselineCatalogue.expiresAt === baselinePolicy.expiresAt);
  check('baseline already contains Finance 1.7.1 and older Lab Tracker and Staff releases',
    baselineCatalogue.releases.some(row => row.id === expectedApps[0].id && row.version === '1.7.1')
      && baselineCatalogue.releases.some(row => row.id === expectedApps[1].id && row.version === '1.0.0')
      && baselineCatalogue.releases.some(row => row.id === expectedApps[2].id && row.version === '1.0.0'));

  phase = 'public-feed';
  const catalogueBytes = await fetchBytes(new URL('catalogue/staging.json', stagingDistribution.publicBase), maxMetadataBytes);
  const policyBytes = await fetchBytes(new URL('update-policy/staging.json', stagingDistribution.publicBase), maxMetadataBytes);
  const catalogueEnvelope = JSON.parse(catalogueBytes.toString('utf8'));
  const policyEnvelope = JSON.parse(policyBytes.toString('utf8'));
  const now = Date.now();
  const catalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  const policy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
  check('public catalogue and policy signatures, pinned signer, freshness, and sequence 70 verify',
    catalogue.sequence === 70 && policy.sequence === 70 && catalogueEnvelope.keyId === m17StagingKeyId
      && policyEnvelope.keyId === m17StagingKeyId && catalogue.issuedAt === policy.issuedAt
      && catalogue.expiresAt === policy.expiresAt);
  const targetIds = new Set(expectedApps.map(app => app.id));
  check('unrelated app releases remain unchanged and each target resolves to its updated version',
    baselineCatalogue.releases.filter(previous => !targetIds.has(previous.id)).every(previous => {
      const current = catalogue.releases.find(row => row.id === previous.id && row.version === previous.version);
      return !!current && canonical(current) === canonical(previous);
    }) && catalogue.releases.length === baselineCatalogue.releases.length
      && expectedApps.every(app => catalogue.releases.filter(row => row.id === app.id).length === 1
        && catalogue.releases.some(row => row.id === app.id && row.version === app.version)));
  check('all pre-existing API grants remain in the updated policy', baselinePolicy.apps.every(previous => {
    const current = policy.apps.find(row => row.id === previous.id);
    if (!current || !previous.releases.every(grant => current.releases.some(value => canonical(value) === canonical(grant)))) return false;
    if (!expectedApps.some(app => app.id === previous.id)) return canonical(current) === canonical(previous);
    return canonical(current.capabilities) === canonical(previous.capabilities);
  }));

  for (const app of expectedApps) {
    const rows = catalogue.releases.filter(row => row.id === app.id && row.version === app.version);
    const appPolicy = policy.apps.find(row => row.id === app.id);
    check(`exact ${app.id} ${app.version} release appears once`, rows.length === 1 && !!appPolicy);
    const row = rows[0];
    check(`exact app capabilities and matching signed grant are published for ${app.id}`,
      canonical(row.capabilities) === canonical(app.capabilities)
        && canonical(appPolicy.capabilities) === canonical(app.capabilities)
        && !!appPolicy.releases.find(grant => grant.version === app.version));
  }

  phase = 'isolated-package-install';
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-os-m17-standard-window-readback-'));
  fs.chmodSync(temporaryRoot, 0o700);
  const registry = new PackageRegistry(path.join(temporaryRoot, 'packages'), stagingDistribution.policy);
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const grant = apiReleaseGrantForPackage(value, policy, Date.now());
    return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, catalogue)
      ? apiOperationsForPackage(value, policy, Date.now()) : [];
  });
  for (const app of expectedApps) {
    const row = catalogue.releases.find(value => value.id === app.id && value.version === app.version);
    const bytes = await fetchBytes(new URL(row.objectKey, stagingDistribution.publicBase), maxPackageBytes);
    const verifiedPackage = verifyPackage(bytes, stagingDistribution.policy);
    const appPolicy = policy.apps.find(value => value.id === app.id);
    const grant = apiReleaseGrantForPackage(verifiedPackage, policy, Date.now());
    const actualSha = sha256(bytes);
    const apiOperations = app.capabilities.filter(value => value.startsWith('clinic.api.') || value.startsWith('clinic.media.'));
    const packageOkay = actualSha === app.packageSha256 && actualSha === row.packageSha256
      && bytes.length === row.packageBytes && verifiedPackage.manifest.appId === app.id
      && verifiedPackage.manifest.version === app.version && verifiedPackage.release.keyId === m17StagingKeyId
      && verifiedPackage.release.digest === app.payloadDigest && verifiedPackage.release.digest === row.payloadDigest
      && canonical(verifiedPackage.manifest.capabilities) === canonical(app.capabilities)
      && !!grant && canonical(grant.apiOperations) === canonical(apiOperations)
      && apiReleaseGrantMatchesCatalogue(app.id, grant, catalogue)
      && canonical(appPolicy.releases.find(value => value.version === app.version)) === canonical(grant);
    check(`public package bytes, signer, digest, identity, and API grant verify for ${app.id}`, packageOkay);
    const digest = registry.install(bytes);
    const lease = registry.launch(app.id);
    try {
      const operations = registry.apiOperations(lease);
      check(`isolated PackageRegistry installs and launches ${app.id} with exact signed operations`,
        registry.describe(app.id).activeVersion === app.version && lease.manifest.appId === app.id
          && lease.release.digest === digest && lease.release.keyId === m17StagingKeyId
          && canonical(operations) === canonical(apiOperations));
      registry.markHealthy(app.id, digest);
      verified.push({ id: app.id, version: app.version, packageSha256: actualSha, payloadDigest: row.payloadDigest, apiOperations: operations });
    } finally {
      lease.releaseLease();
    }
    registry.uninstall(app.id);
    check(`isolated install is removed after verification for ${app.id}`, !registry.inspect().apps[app.id]);
  }
  passed = true;
} catch (error) {
  failure = String(error?.message ?? 'unknown failure').slice(0, 180);
  console.error(`M17 Standard Window staging verification stopped during ${phase}: ${failure}`);
  process.exitCode = 1;
} finally {
  if (temporaryRoot) fs.rmSync(temporaryRoot, { recursive: true, force: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const report = {
    passed, phase, failure, checks, sequence: passed ? 70 : null, keyId: m17StagingKeyId, apps: verified,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim(),
    scope: 'Read-only signed public staging feed and package reads plus isolated local PackageRegistry install/launch/uninstall. No authenticated Store session or clinic business API reads/writes.',
  };
  fs.mkdirSync(path.join(checkout, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(checkout, `artifacts/m17-standard-window-app-updates-readback-${stamp}.json`),
    JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks, sequence: 70, apps: verified }, null, 2));
