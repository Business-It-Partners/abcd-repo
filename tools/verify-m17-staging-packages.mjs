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
  { id: 'company.dental.followups.m17', version: '1.0.3', sha256: '2e94ba56072a0ca1feb6e52057de0440738ddc1bcc368156bfafc0b40ffada39' },
  { id: 'company.dental.appointments.m17', version: '1.0.5', sha256: '32d870d3684f91f9cf296bfdc66b2c471191fdcfc80a43606bf88dc0894545fb' },
  { id: 'company.dental.treatment-progress.m17', version: '1.0.6', sha256: '5533b1a3567f03b845bf55c10d7b8e4f52f9d39456fcff829f551cda213d6541' },
  { id: 'company.dental.calendar.m17', version: '1.0.4', sha256: '533c7f85be7e1bb83cbb1ae0f7de9783e701040d407c4c7fd69615f4e195b2ae' },
  { id: 'company.dental.m17.treatment-protocols', version: '1.0.6', sha256: '3ec7226c4d54efac157e3686b13644ccc22e7adf7b3d603d2087ea816ddca277' },
  { id: 'company.dental.work-entry.m17', version: '1.0.3', sha256: '361706cacf71bfc20f1372450c9a47b94fd92f422a3701195abb6a43f76a2e29' },
  { id: 'company.dental.patient-record.m17', version: '1.0.10', sha256: '45211018a4c2b880b39e3adb51c06d3c2b31a57c372d9205902d34e6bf56d2cd', capabilities: ['clinic.media.read', 'clinic.media.upload'] },
  { id: 'company.dental.finance.m17', version: '1.7.7', sha256: '96c5c0156e21730424e847ad93781ae2409488cdd3334a2554d7679c55f24c4c' },
  { id: 'company.dental.lab-tracker.m17', version: '1.0.3', sha256: 'e19d454ac718be8841cfbc5754ceac32e70ba85b5eb87815ab0bb1ea1b26e080' },
  { id: 'company.dental.staff.m17', version: '1.0.3', sha256: '99ce65d4ecc1203ee9a436a782ac28b0ccf3c00a0b739b5d9fb97591a57c5858' },
];
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
  const currentM17Ids = expectedApps.map(app => app.id);
  check('ten current M17 app identities are present once at their exact versions',
    catalogue.releases.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && policy.apps.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && expectedApps.every(app => catalogue.releases.filter(row => row.id === app.id && row.version === app.version).length === 1
      && policy.apps.filter(row => row.id === app.id).length === 1));
  const appointmentPolicy = policy.apps.find(row => row.id === 'company.dental.appointments.m17');
  check('Appointments policy retains grants 1.0.0–1.0.5',
    appointmentPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '35ac80e60e34f1c9e2487c80052278e8978e5997d014eade7fa3d96b9ccfea16')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === '433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.2' && row.packageSha256 === '206b68025c802008489115ee14b7f7100df5a99c4eda4821887d773dab197b93')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.3' && row.packageSha256 === '0d55de88d362882f6157be78eac871411a4d4b89032355c0791f8ed8dcba96c6')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.4' && row.packageSha256 === '22d6f4d44dfdeb90d422798771e15762a8e5d11859f20759d3f8f13ed0e817f7')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.5' && row.packageSha256 === '32d870d3684f91f9cf296bfdc66b2c471191fdcfc80a43606bf88dc0894545fb'));
  const patientRecordPolicy = policy.apps.find(row => row.id === 'company.dental.patient-record.m17');
  check('Patient Record policy retains exactly grants 1.0.4–1.0.10 within the seven-release ceiling',
    patientRecordPolicy?.releases.length === 7
      && !patientRecordPolicy?.releases.some(row => row.version === '1.0.0')
      && !patientRecordPolicy?.releases.some(row => row.version === '1.0.1')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.4' && row.packageSha256 === 'e2c58a786692d368ebd7886189ca0366a34f8223855868561e21829c44f859f2')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.5' && row.packageSha256 === '7aa21170bbe04821817d62f4c06bc3613cfaf64342058c41deb266a429a562d1')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.6' && row.packageSha256 === '84009af32c8ca5518da5fa81909bab4ae14335344e6508ecf7c73adc4a81bd33')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.7' && row.packageSha256 === '2567c2b27db8aeb1585f3a4c1ac02e14636b4e267d43ba66e0aa629b9bfa5f55')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.8' && row.packageSha256 === '17b86468b5ab7cece1487364b53c7547fb8eb72b6c87239e45a88d1495c40602')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.9' && row.packageSha256 === '48390b07cdab06d5140528e54a596eba0c74fc92b1586f249d9ef1c333ec4b29')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.10' && row.packageSha256 === '45211018a4c2b880b39e3adb51c06d3c2b31a57c372d9205902d34e6bf56d2cd'));
  const financePolicy = policy.apps.find(row => row.id === 'company.dental.finance.m17');
  const financeRelease = catalogue.releases.find(row => row.id === 'company.dental.finance.m17');
  check('Finance 1.7.7 policy retires only 1.7.0 and keeps the 1.7.1 minimum',
    financeRelease?.version === '1.7.7' && financeRelease.minimumVersion === '1.7.1'
      && financePolicy?.minimumVersion === '1.7.1' && financePolicy?.releases.length === 7
      && !financePolicy?.releases.some(row => row.version === '1.7.0')
      && financePolicy?.releases.some(row => row.version === '1.7.7' && row.packageSha256 === '96c5c0156e21730424e847ad93781ae2409488cdd3334a2554d7679c55f24c4c'));

  const treatmentProtocolsPolicy = policy.apps.find(row => row.id === 'company.dental.m17.treatment-protocols');
  check('Treatment Protocols policy retains grants 1.0.0–1.0.6',
    treatmentProtocolsPolicy?.releases.length === 7
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '6db5fbe5b5418a88e4ea92c7ea32435c9d3a35619e21bb013cc286fcc004c224')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === 'fd744dbd1d6abc22f9a2e2feea6c25b6c54c18376bb5803c18f5fda03e8fd156')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.2' && row.packageSha256 === '4c81cb6f7b11a871a01ae0272dfa51513a2fcf679705c8a1e0df8382555b6f2b')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.3' && row.packageSha256 === 'dfd0d9955abcbf982176178f5f4acfab7c6277d9d519ff9beed1d1304f109b7e')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.4' && row.packageSha256 === '1cd092b6763949a9525e7ca8264d0f61543f547afbc997adb8b23a5ec6ce7920')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.5' && row.packageSha256 === '388917e049c738eda113579410a9cf4e6adfdf96889e0b88299ec88640b4deb5')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.6' && row.packageSha256 === '3ec7226c4d54efac157e3686b13644ccc22e7adf7b3d603d2087ea816ddca277'));

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
    const bytes = await getBytes(new URL(row.objectKey, origin), 16 * 1024 * 1024);
    const packageValue = verifyPackage(bytes, stagingDistribution.policy);
    check('public package bytes and signer verify: ' + app.id,
      sha256(bytes) === app.sha256 && bytes.length === row.packageBytes && packageValue.manifest.appId === app.id
      && packageValue.manifest.version === app.version && packageValue.release.keyId === m17StagingKeyId
      && packageValue.release.digest === row.payloadDigest && apiReleaseGrantForPackage(packageValue, policy, Date.now()) !== null
      && (!app.capabilities || app.capabilities.every(capability => packageValue.manifest.capabilities.includes(capability)
        && row.capabilities.includes(capability)
        && policy.apps.find(value => value.id === app.id)?.capabilities.includes(capability))));
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
  const stamp = new Date().toISOString().replaceAll(':', '-');
  fs.writeFileSync(`artifacts/m17-staging-packages-readonly-${stamp}.json`, JSON.stringify({
    passed, phase, checks, sequence, keyId: m17StagingKeyId,
    scope: 'Read-only public staging metadata/package reads plus isolated local PackageRegistry install/launch/uninstall. No authenticated Store install or business API writes.',
  }, null, 2) + '\n', { flag: 'w', mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks }));
