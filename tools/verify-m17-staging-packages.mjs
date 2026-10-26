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
const { clinicAppFamily, clinicRequestAllowed } = require('../dist-electron/sdk/appPolicy.js');

const currentM17Ids = [
  'company.dental.followups.m17',
  'company.dental.appointments.m17',
  'company.dental.treatment-progress.m17',
  'company.dental.calendar.m17',
  'company.dental.m17.treatment-protocols',
  'company.dental.work-entry.m17',
  'company.dental.patient-record.m17',
  'company.dental.finance.m17',
  'company.dental.lab-tracker.m17',
  'company.dental.staff.m17',
  'company.dental.user-management.m17',
];
const expectedFinance = { version: '1.7.16', sha256: '44970c51703224377e88cdbd86fb25ff6b637e22e1a7fa34e4fac70f0efb3e37' };
const origin = stagingDistribution.publicBase;
if (origin !== 'https://pub-5a82684f6abc4896b7bd2a4b59828182.r2.dev') throw Error('Pinned staging distribution fence');
const now = Date.now();
const checks = [];
let phase = 'catalogue';
let temp;
let passed = false, sequence = null;
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
  sequence = catalogue.sequence;
  check('public catalogue and update policy signatures and freshness verify',
    catalogue.sequence >= 28 && policy.sequence === catalogue.sequence && catalogueEnvelope.keyId === m17StagingKeyId
    && policyEnvelope.keyId === m17StagingKeyId && catalogue.issuedAt === policy.issuedAt && catalogue.expiresAt === policy.expiresAt);
  check('eleven current M17 app identities are present once with matching update grants',
    catalogue.releases.filter(row => currentM17Ids.includes(row.id)).length === currentM17Ids.length
    && policy.apps.filter(row => currentM17Ids.includes(row.id)).length === currentM17Ids.length
    && currentM17Ids.every(id => catalogue.releases.filter(row => row.id === id).length === 1
      && policy.apps.filter(row => row.id === id).length === 1
      && policy.apps.find(row => row.id === id)?.releases.some(grant => grant.version === catalogue.releases.find(row => row.id === id)?.version)));
  const userManagementRelease = catalogue.releases.find(row => row.id === 'company.dental.user-management.m17');
  const userManagementPolicy = policy.apps.find(row => row.id === 'company.dental.user-management.m17');
  check('User Management 1.0.0 carries only the clinic JSON API grant',
    userManagementRelease?.version === '1.0.0'
      && JSON.stringify(userManagementRelease.capabilities) === JSON.stringify(['clinic.app.user-management', 'clinic.api.request', 'session.context'])
      && JSON.stringify(userManagementPolicy?.capabilities) === JSON.stringify(['clinic.app.user-management', 'clinic.api.request', 'session.context'])
      && JSON.stringify(userManagementPolicy?.releases.find(row => row.version === '1.0.0')?.apiOperations) === JSON.stringify(['clinic.api.request']));
  const userManagementFamily = clinicAppFamily(userManagementRelease?.capabilities ?? []);
  const accountRoutes = [
    ['GET', '/v1/clinic/users'], ['POST', '/v1/clinic/users'],
    ['PATCH', '/v1/clinic/users/123e4567-e89b-12d3-a456-426614174000'],
    ['POST', '/v1/clinic/users/123e4567-e89b-12d3-a456-426614174000/password'],
  ];
  check('User Management host policy permits the four account routes only for Admin capability',
    userManagementFamily === 'clinic.app.user-management'
      && accountRoutes.every(([method, route]) => clinicRequestAllowed(userManagementFamily, 'admin', ['clinic_users.manage'], route, method))
      && accountRoutes.every(([method, route]) => !clinicRequestAllowed(userManagementFamily, 'doctor', ['clinic_users.manage'], route, method)
        && !clinicRequestAllowed(userManagementFamily, 'reception', ['clinic_users.manage'], route, method)
        && !clinicRequestAllowed(userManagementFamily, 'admin', [], route, method))
      && !clinicRequestAllowed(userManagementFamily, 'admin', ['clinic_users.manage'], '/v1/clinic/profile', 'GET'));
  const financePolicy = policy.apps.find(row => row.id === 'company.dental.finance.m17');
  const financeRelease = catalogue.releases.find(row => row.id === 'company.dental.finance.m17');
  check('Finance 1.7.16 package and seven-release grant window verify',
    financeRelease?.version === expectedFinance.version && financeRelease.packageSha256 === expectedFinance.sha256
      && financeRelease.minimumVersion === '1.7.10' && financePolicy?.minimumVersion === '1.7.10'
      && JSON.stringify(financePolicy?.releases.map(row => row.version)) === JSON.stringify(['1.7.10', '1.7.11', '1.7.12', '1.7.13', '1.7.14', '1.7.15', '1.7.16'])
      && financePolicy?.releases.find(row => row.version === '1.7.16')?.packageSha256 === expectedFinance.sha256);


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
  for (const appId of currentM17Ids) {
    const row = catalogue.releases.find(value => value.id === appId);
    if (!row) throw Error('Published app row missing');
    const bytes = await getBytes(new URL(row.objectKey, origin), 16 * 1024 * 1024);
    const packageValue = verifyPackage(bytes, stagingDistribution.policy);
    if (appId === 'company.dental.user-management.m17') {
      const appMetadata = JSON.parse(packageValue.files.get('app.json')?.toString('utf8') ?? 'null');
      check('User Management package metadata is one Admin-only module',
        appMetadata?.appId === appId && appMetadata.title === 'User Management'
          && JSON.stringify(appMetadata.anyCapabilities) === JSON.stringify(['clinic_users.manage'])
          && JSON.stringify(appMetadata.excludedRoles) === JSON.stringify(['doctor', 'reception'])
          && appMetadata.modules?.length === 1 && appMetadata.modules[0]?.id === 'user-management'
          && appMetadata.modules[0]?.capability === 'clinic_users.manage');
    }
    const appPolicy = policy.apps.find(value => value.id === appId);
    const grant = appPolicy?.releases.find(value => value.version === row.version);
    const packageHash = sha256(bytes);
    check('public package bytes and signer verify: ' + appId,
      packageHash === row.packageSha256 && bytes.length === row.packageBytes && packageValue.manifest.appId === appId
      && packageValue.manifest.version === row.version && packageValue.release.keyId === m17StagingKeyId
      && packageValue.release.digest === row.payloadDigest && !!grant && grant.packageSha256 === packageHash
      && grant.payloadDigest === packageValue.release.digest && apiReleaseGrantForPackage(packageValue, policy, Date.now()) !== null
      && JSON.stringify(packageValue.manifest.capabilities) === JSON.stringify(row.capabilities)
      && row.capabilities.every(capability => appPolicy?.capabilities.includes(capability)));
    const digest = registry.install(bytes);
    const lease = registry.launch(appId);
    try {
      check('isolated local registry installs and launches signed package: ' + appId,
        registry.describe(appId).activeVersion === row.version && lease.manifest.appId === appId
        && lease.release.digest === digest && lease.release.keyId === m17StagingKeyId
        && registry.apiOperations(lease).includes('clinic.api.request'));
      registry.markHealthy(appId, digest);
    } finally {
      lease.releaseLease();
    }
    registry.uninstall(appId);
    check('isolated install removed after verification: ' + appId, !registry.inspect().apps[appId]);
  }
  passed = true;
} catch (error) {
  console.error(`M17 staging package check stopped during ${phase}: ${String(error?.message ?? 'unknown').slice(0, 180)}`);
  process.exitCode = 1;
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  fs.mkdirSync('artifacts', { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  fs.writeFileSync(`artifacts/m17-staging-packages-readonly-${stamp}.json`, JSON.stringify({
    passed, phase, checks, sequence, keyId: m17StagingKeyId,
    scope: 'Read-only public staging metadata/package reads plus isolated local PackageRegistry install/launch/uninstall. No authenticated Store install or business API writes.',
  }, null, 2) + '\n', { flag: 'w', mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks }));
