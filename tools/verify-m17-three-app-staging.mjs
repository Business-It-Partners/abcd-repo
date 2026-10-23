// Read-only public verification of the M17 Finance, Lab Tracker, and Staff releases.
// It also installs each signed package into a disposable local PackageRegistry; it does not sign in or call clinic APIs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const {
  PackageRegistry,
} = require('../dist-electron/packages/registry.js');
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
if (process.argv.length !== 3 || !baselineInput) throw Error('Expected one external M17 baseline directory');
const baselineRoot = path.resolve(baselineInput);
if (baselineRoot === checkout || baselineRoot.startsWith(checkout + path.sep)) {
  throw Error('The pre-publication baseline must remain outside the checkout');
}
const expectedApps = [
  {
    id: 'company.dental.finance.m17', version: '1.7.0',
    packageSha256: '775a045087b60130f3860f1c21402dc158290391f5eebf288685d1d57b953a49',
    capabilities: ['clinic.app.finance', 'clinic.api.request', 'session.context'],
  },
  {
    id: 'company.dental.lab-tracker.m17', version: '1.0.0',
    packageSha256: 'd34c19917b8216f5f47802a71175c93b845ddc78ee73a6919ad5923d9206bd44',
    capabilities: ['clinic.app.lab-tracker', 'clinic.api.request', 'session.context'],
  },
  {
    id: 'company.dental.staff.m17', version: '1.0.0',
    packageSha256: '6f69c75c84eb61bf0dd66ea16c665a34fa46d75c4028f173269a19045630185c',
    capabilities: ['clinic.app.staff', 'clinic.api.request', 'session.context', 'clinic.media.read', 'clinic.media.upload'],
  },
];
const maxMetadataBytes = 65_536;
const maxPackageBytes = 2_097_152;
const checks = [];
const verified = [];
let phase = 'baseline';
let sequence = null;
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
  const baselineCatalogueBytes = readFile(path.join(baselineRoot, 'catalogue-staging.json'), maxMetadataBytes);
  const baselinePolicyBytes = readFile(path.join(baselineRoot, 'update-policy-staging.json'), maxMetadataBytes);
  const baselineCatalogue = verifyCatalogue(baselineCatalogueBytes, stagingDistribution.policy, noWatermark, Date.now()).catalogue;
  const baselinePolicy = verifyUpdatePolicy(baselinePolicyBytes, stagingDistribution.policy, noWatermark, Date.now()).policy;
  check('saved pre-publication feed verifies at sequence 57', baselineCatalogue.sequence === 57
    && baselinePolicy.sequence === 57 && baselineCatalogue.issuedAt === baselinePolicy.issuedAt
    && baselineCatalogue.expiresAt === baselinePolicy.expiresAt);

  phase = 'public-feed';
  const catalogueBytes = await fetchBytes(new URL('catalogue/staging.json', stagingDistribution.publicBase), maxMetadataBytes);
  const policyBytes = await fetchBytes(new URL('update-policy/staging.json', stagingDistribution.publicBase), maxMetadataBytes);
  const catalogueEnvelope = JSON.parse(catalogueBytes.toString('utf8'));
  const policyEnvelope = JSON.parse(policyBytes.toString('utf8'));
  const now = Date.now();
  const catalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  const policy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
  sequence = catalogue.sequence;
  check('staging catalogue and update policy signatures, key, freshness, and final sequence verify',
    sequence === 60 && policy.sequence === sequence && catalogueEnvelope.keyId === m17StagingKeyId
      && policyEnvelope.keyId === m17StagingKeyId && catalogue.issuedAt === policy.issuedAt
      && catalogue.expiresAt === policy.expiresAt);
  check('all three original M17 feed rows and grants are unchanged',
    baselineCatalogue.releases.every(previous => {
      const current = catalogue.releases.find(row => row.id === previous.id);
      return !!current && canonical(current) === canonical(previous);
    }) && baselinePolicy.apps.every(previous => {
      const current = policy.apps.find(row => row.id === previous.id);
      return !!current && canonical(current) === canonical(previous);
    }));
  check('the feed has exactly three additional app identities and preserves all prior entries',
    catalogue.releases.length === baselineCatalogue.releases.length + expectedApps.length
      && policy.apps.length === baselinePolicy.apps.length + expectedApps.length);
  for (const app of expectedApps) {
    const rows = catalogue.releases.filter(row => row.id === app.id && row.version === app.version);
    const policies = policy.apps.filter(row => row.id === app.id);
    check(`exact ${app.id} ${app.version} release appears once`, rows.length === 1 && policies.length === 1);
    check(`exact capabilities are published for ${app.id}`,
      canonical(rows[0].capabilities) === canonical(app.capabilities)
        && canonical(policies[0].capabilities) === canonical(app.capabilities));
  }

  phase = 'isolated-package-install';
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-os-m17-three-app-readback-'));
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
    const packageOkay = actualSha === app.packageSha256 && actualSha === row.packageSha256
      && bytes.length === row.packageBytes && verifiedPackage.manifest.appId === app.id
      && verifiedPackage.manifest.version === app.version && verifiedPackage.release.keyId === m17StagingKeyId
      && verifiedPackage.release.digest === row.payloadDigest && canonical(verifiedPackage.manifest.capabilities) === canonical(app.capabilities)
      && !!grant && canonical(grant.apiOperations) === canonical(app.capabilities.filter(value => value.startsWith('clinic.api.') || value.startsWith('clinic.media.')))
      && apiReleaseGrantMatchesCatalogue(app.id, grant, catalogue) && canonical(appPolicy?.releases?.find(value => value.version === app.version)) === canonical(grant);
    check(`public bundle bytes, package signature, exact identity, and API grant verify for ${app.id}`, packageOkay);
    const digest = registry.install(bytes);
    const lease = registry.launch(app.id);
    let operations;
    try {
      operations = registry.apiOperations(lease);
      check(`isolated PackageRegistry installs and launches ${app.id} with its exact signed operations`,
        registry.describe(app.id).activeVersion === app.version && lease.manifest.appId === app.id
          && lease.release.digest === digest && lease.release.keyId === m17StagingKeyId
          && canonical(operations) === canonical(app.capabilities.filter(value => value.startsWith('clinic.api.') || value.startsWith('clinic.media.'))));
      registry.markHealthy(app.id, digest);
    } finally {
      lease.releaseLease();
    }
    registry.uninstall(app.id);
    check(`isolated install is removed after verification for ${app.id}`, !registry.inspect().apps[app.id]);
    verified.push({ id: app.id, version: app.version, packageSha256: actualSha, payloadDigest: row.payloadDigest, operations });
  }
  passed = true;
} catch (error) {
  failure = String(error?.message ?? 'unknown failure').slice(0, 180);
  console.error(`M17 three-app staging verification stopped during ${phase}: ${failure}`);
  process.exitCode = 1;
} finally {
  if (temporaryRoot) fs.rmSync(temporaryRoot, { recursive: true, force: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const report = {
    passed, phase, failure, checks, sequence, keyId: m17StagingKeyId, apps: verified,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: checkout, encoding: 'utf8' }).trim(),
    scope: 'Read-only signed public staging feed and package reads plus isolated local PackageRegistry install/launch/uninstall. No authenticated Store session or clinic business API reads/writes.',
  };
  fs.mkdirSync(path.join(checkout, 'artifacts'), { recursive: true });
  fs.writeFileSync(path.join(checkout, `artifacts/m17-finance-lab-staff-staging-readback-${stamp}.json`),
    JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks, sequence, apps: verified }, null, 2));
