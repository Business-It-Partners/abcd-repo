// Read-only staging feed verification plus isolated local PackageRegistry install smoke test for current M17 releases.
// This does not authenticate to the clinic API or claim Store UI installation.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { sha256, verifyPackage } = require('../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
const { verifyUpdatePolicy, allowUpdatedPackage, apiReleaseGrantForPackage, apiOperationsForPackage, apiReleaseGrantMatchesCatalogue } = require('../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution, m17StagingKeyId } = require('../dist-electron/distribution/staging.js');

const expectedApps = [
  { id: 'company.dental.followups.m17', version: '1.0.0', sha256: '48e0bc95de7003abe701fc6b6be5c87ab4643dbb7a1caed98c6858a03e44f197' },
  { id: 'company.dental.appointments.m17', version: '1.0.1', sha256: '433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03' },
  { id: 'company.dental.calendar.m17', version: '1.0.0', sha256: '0d45934d0ae43d0b79b3f1a60d188a865b3da0f509756d6a4a1642eed57d929d' },
];
const origin = stagingDistribution.publicBase;
if (origin !== 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev') throw Error('Pinned staging distribution fence');
const now = Date.now();
const checks = [];
let phase = 'catalogue';
let temp;
let passed = false;
const check = (name, condition) => {
  if (!condition) throw Error('Failed: ' + name);
  checks.push(name);
};
const getBytes = async (url, max) => {
  const response = await fetch(url, { redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20_000) });
  if (!response.ok || !response.body) throw Error('Staging read failed');
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > max) throw Error('Staging object size limit');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > max) throw Error('Staging object size limit');
      chunks.push(Buffer.from(part.value));
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  return Buffer.concat(chunks, size);
};

try {
  const catalogueBytes = await getBytes(new URL('catalogue/staging.json', origin), 65_536);
  const policyBytes = await getBytes(new URL('update-policy/staging.json', origin), 65_536);
  const catalogueEnvelope = JSON.parse(catalogueBytes.toString('utf8'));
  const policyEnvelope = JSON.parse(policyBytes.toString('utf8'));
  const catalogueResult = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now);
  const policyResult = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now);
  const catalogue = catalogueResult.catalogue;
  const policy = policyResult.policy;
  check('public catalogue and update policy signatures and freshness verify',
    catalogue.sequence === 28 && policy.sequence === 28 && catalogueEnvelope.keyId === m17StagingKeyId
    && policyEnvelope.keyId === m17StagingKeyId && catalogue.issuedAt === policy.issuedAt && catalogue.expiresAt === policy.expiresAt);
  const currentM17Ids = expectedApps.map(app => app.id);
  check('three current M17 app identities are present once at their exact versions',
    catalogue.releases.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && policy.apps.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && expectedApps.every(app => catalogue.releases.filter(row => row.id === app.id && row.version === app.version).length === 1
      && policy.apps.filter(row => row.id === app.id).length === 1));
  const appointmentPolicy = policy.apps.find(row => row.id === 'company.dental.appointments.m17');
  check('Appointments policy retains the signed 1.0.0 grant and adds the 1.0.1 grant',
    appointmentPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '35ac80e60e34f1c9e2487c80052278e8978e5997d014eade7fa3d96b9ccfea16')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === '433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03'));

  phase = 'isolated-local-install';
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'dental-os-m17-published-package-check-'));
  fs.chmodSync(temp, 0o700);
  const registry = new PackageRegistry(path.join(temp, 'packages'), stagingDistribution.policy);
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const grant = apiReleaseGrantForPackage(value, policy, Date.now());
    return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, catalogue)
      ? apiOperationsForPackage(value, policy, Date.now()) : [];
  });
  for (const app of expectedApps) {
    const row = catalogue.releases.find(value => value.id === app.id);
    if (!row) throw Error('Published app row missing');
    const bytes = await getBytes(new URL(row.objectKey, origin), 2_097_152);
    const packageValue = verifyPackage(bytes, stagingDistribution.policy);
    check('public package bytes and signer verify: ' + app.id,
      sha256(bytes) === app.sha256 && bytes.length === row.packageBytes && packageValue.manifest.appId === app.id
      && packageValue.manifest.version === app.version && packageValue.release.keyId === m17StagingKeyId
      && packageValue.release.digest === row.payloadDigest && apiReleaseGrantForPackage(packageValue, policy, Date.now()) !== null);
    const digest = registry.install(bytes);
    const lease = registry.launch(app.id);
    try {
      check('isolated local registry installs and launches signed package: ' + app.id,
        registry.describe(app.id).activeVersion === app.version && lease.manifest.appId === app.id
        && lease.release.digest === digest && lease.release.keyId === m17StagingKeyId
        && registry.apiOperations(lease).includes('clinic.api.request'));
      registry.markHealthy(app.id, digest);
    } finally {
      lease.releaseLease();
    }
    registry.uninstall(app.id);
    check('isolated install removed after verification: ' + app.id, !registry.inspect().apps[app.id]);
  }
  passed = true;
} catch (error) {
  console.error(`M17 staging package check stopped during ${phase}: ${String(error?.message ?? 'unknown').slice(0, 180)}`);
  process.exitCode = 1;
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync('artifacts', { recursive: true });
  fs.writeFileSync('artifacts/m17-staging-packages-readonly.json', JSON.stringify({
    passed, phase, checks, sequence: 28, keyId: m17StagingKeyId,
    scope: 'Read-only public staging metadata/package reads plus isolated local PackageRegistry install/launch/uninstall. No authenticated Store install or business API writes.',
  }, null, 2) + '\n', { flag: 'w', mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks }));
