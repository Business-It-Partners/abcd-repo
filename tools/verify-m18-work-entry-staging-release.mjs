// Verify the exact Work Entry 1.0.6 package published for M18, including its signed API grant.
// Read-only staging feed/package reads plus an isolated local PackageRegistry lifecycle check.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { sha256, verifyPackage } = require('../dist-electron/packages/format.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
const {
  verifyUpdatePolicy,
  allowUpdatedPackage,
  apiReleaseGrantForPackage,
  apiOperationsForPackage,
  apiReleaseGrantMatchesCatalogue,
} = require('../dist-electron/distribution/updatePolicy.js');
const { stagingDistribution, m17StagingKeyId } = require('../dist-electron/distribution/staging.js');

const appId = 'company.dental.work-entry.m17';
const version = '1.0.6';
const packageSha256 = '84b05f53e1eecb650de8bf9a4d9729b166ca181a1646eae586b6847d10d2bd05';
const payloadDigest = 'bf4305974421fa00ad920117027509a60c3b6abf1047e9c449fe91ed436efb1b';
const expectedSequence = 98;
const expectedApiOperations = ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
const checks = [];
let phase = 'catalogue';
let temp;
let passed = false;
let errorMessage;
const check = (name, condition) => {
  if (!condition) throw Error(`Failed: ${name}`);
  checks.push(name);
};
const getBytes = async (url, maxBytes) => {
  const response = await fetch(url, {
    redirect: 'error', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok || !response.body) throw Error('Public staging read failed');
  const length = Number(response.headers.get('content-length'));
  if (Number.isFinite(length) && length > maxBytes) throw Error('Public staging object size limit');
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > maxBytes) throw Error('Public staging object size limit');
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
    throw Error('Pinned staging origin mismatch');
  }
  const catalogueBytes = await getBytes(new URL('catalogue/staging.json', stagingDistribution.publicBase), 65_536);
  const policyBytes = await getBytes(new URL('update-policy/staging.json', stagingDistribution.publicBase), 65_536);
  const catalogueEnvelope = JSON.parse(catalogueBytes.toString('utf8'));
  const policyEnvelope = JSON.parse(policyBytes.toString('utf8'));
  const now = Date.now();
  const catalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  const policy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
  const release = catalogue.releases.find(row => row.id === appId);
  const appPolicy = policy.apps.find(row => row.id === appId);
  const grant = appPolicy?.releases?.find(row => row.version === version);
  check('fresh catalogue and policy have pinned M17 signatures at the requested sequence',
    catalogue.sequence === expectedSequence && policy.sequence === expectedSequence
      && catalogueEnvelope.keyId === m17StagingKeyId && policyEnvelope.keyId === m17StagingKeyId
      && catalogue.issuedAt === policy.issuedAt && catalogue.expiresAt === policy.expiresAt);
  check('Work Entry 1.0.6 row and exact API grant match the released package identity',
    release?.version === version && release.packageSha256 === packageSha256 && release.payloadDigest === payloadDigest
      && appPolicy?.minimumVersion === '1.0.0' && !!grant && grant.packageSha256 === packageSha256
      && grant.payloadDigest === payloadDigest && JSON.stringify(grant.apiOperations) === JSON.stringify(expectedApiOperations)
      && apiReleaseGrantMatchesCatalogue(appId, grant, catalogue));

  phase = 'package-bytes-and-signature';
  const packageBytes = await getBytes(new URL(release.objectKey, stagingDistribution.publicBase), 16 * 1024 * 1024);
  const packageValue = verifyPackage(packageBytes, stagingDistribution.policy);
  check('public package bytes, identity, payload digest and M17 signature verify',
    sha256(packageBytes) === packageSha256 && packageBytes.length === release.packageBytes
      && packageValue.manifest.appId === appId && packageValue.manifest.version === version
      && packageValue.release.keyId === m17StagingKeyId && packageValue.release.digest === payloadDigest);
  check('installed API authority is exactly the signed Work Entry 1.0.6 API grant',
    !!apiReleaseGrantForPackage(packageValue, policy, now)
      && JSON.stringify(apiOperationsForPackage(packageValue, policy, now)) === JSON.stringify(expectedApiOperations));

  phase = 'isolated-package-registry';
  temp = fs.mkdtempSync(path.join(os.tmpdir(), 'm18-work-entry-package-check-'));
  fs.chmodSync(temp, 0o700);
  const registry = new PackageRegistry(path.join(temp, 'packages'), stagingDistribution.policy);
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const currentGrant = apiReleaseGrantForPackage(value, policy, Date.now());
    return currentGrant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, currentGrant, catalogue)
      ? apiOperationsForPackage(value, policy, Date.now()) : [];
  });
  const installedDigest = registry.install(packageBytes);
  const lease = registry.launch(appId);
  try {
    check('isolated registry installs and launches the exact signed 1.0.6 package',
      installedDigest === payloadDigest && registry.describe(appId).activeVersion === version
        && lease.manifest.appId === appId && lease.release.digest === payloadDigest
        && lease.release.keyId === m17StagingKeyId
      && JSON.stringify(registry.apiOperations(lease)) === JSON.stringify(expectedApiOperations));
    registry.markHealthy(appId, payloadDigest);
  } finally {
    lease.releaseLease();
  }
  registry.uninstall(appId);
  check('isolated registry removes the package after verification', !registry.inspect().apps[appId]);
  passed = true;
} catch (error) {
  errorMessage = String(error?.message ?? 'unknown').slice(0, 200);
  console.error(`M18 Work Entry package verification stopped during ${phase}: ${errorMessage}`);
  process.exitCode = 1;
} finally {
  if (temp) fs.rmSync(temp, { recursive: true, force: true });
  const evidenceDir = 'dental-os_v1_working_info/milestone-18-dental-app-testing/evidence';
  fs.mkdirSync(evidenceDir, { recursive: true });
  const report = {
    recordType: 'm18_work_entry_staging_package_readback',
    environment: 'cloudflare-staging',
    appId,
    version,
    sequence: expectedSequence,
    packageSha256,
    payloadDigest,
    apiOperations: expectedApiOperations,
    signer: m17StagingKeyId,
    productionUsed: false,
    authenticatedClinicSession: false,
    businessApiCalls: false,
    checks,
    phase,
    passed,
    ...(errorMessage ? { errorMessage } : {}),
  };
  const output = path.join(evidenceDir, 'M18.4-LEAD-WORK-ENTRY-1.0.6-PUBLIC-READBACK-2026-10-24.json');
  fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'w', mode: 0o600 });
  console.log(JSON.stringify({ passed, phase, checks: checks.length, evidence: output }));
}
