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
  { id: 'company.dental.followups.m17', version: '1.0.2', sha256: '31614a593ce389d1739f7da7c4798e08b94aa8e44340b7317b30a6490b56707f' },
  { id: 'company.dental.appointments.m17', version: '1.0.3', sha256: '0d55de88d362882f6157be78eac871411a4d4b89032355c0791f8ed8dcba96c6' },
  { id: 'company.dental.treatment-progress.m17', version: '1.0.4', sha256: '7d29f474519f428bda38899a7b495ed7b1cd0a3e8b83baf6071ce927bbf9f175' },
  { id: 'company.dental.calendar.m17', version: '1.0.3', sha256: 'c9d58d459f0dc03a42bf31323afca54ba6f33187eadd794e96d242a52db8b398' },
  { id: 'company.dental.m17.treatment-protocols', version: '1.0.5', sha256: '388917e049c738eda113579410a9cf4e6adfdf96889e0b88299ec88640b4deb5' },
  { id: 'company.dental.work-entry.m17', version: '1.0.2', sha256: 'de45de9e17dcc11ec96a8b3b7e5788e8d528103ad8dbf1f764c805a63a80e987' },
  { id: 'company.dental.patient-record.m17', version: '1.0.5', sha256: '7aa21170bbe04821817d62f4c06bc3613cfaf64342058c41deb266a429a562d1', capabilities: ['clinic.media.read', 'clinic.media.upload'] },
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
  check('seven current M17 app identities are present once at their exact versions',
    catalogue.releases.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && policy.apps.filter(row => currentM17Ids.includes(row.id)).length === expectedApps.length
    && expectedApps.every(app => catalogue.releases.filter(row => row.id === app.id && row.version === app.version).length === 1
      && policy.apps.filter(row => row.id === app.id).length === 1));
  const appointmentPolicy = policy.apps.find(row => row.id === 'company.dental.appointments.m17');
  check('Appointments policy retains its earlier grants and adds the 1.0.3 grant',
    appointmentPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '35ac80e60e34f1c9e2487c80052278e8978e5997d014eade7fa3d96b9ccfea16')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === '433a37e77da1ff20beb09b710c0da2d9ccbd944c1300375a08875f4c3abf9b03')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.2' && row.packageSha256 === '206b68025c802008489115ee14b7f7100df5a99c4eda4821887d773dab197b93')
      && appointmentPolicy?.releases.some(row => row.version === '1.0.3' && row.packageSha256 === '0d55de88d362882f6157be78eac871411a4d4b89032355c0791f8ed8dcba96c6'));
  const patientRecordPolicy = policy.apps.find(row => row.id === 'company.dental.patient-record.m17');
  check('Patient Record policy retains all six signed release grants through 1.0.5',
    patientRecordPolicy?.releases.length === 6
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '6294ef5caeb032b262c5b5718fe6392b6387e58802b79bcf2d53f29ffb2376c4')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === '9f0c4097b2dc6b596df7ba54766cc6a965755cb5af7d019ee39986501194bfc8')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.2' && row.packageSha256 === 'ed5960456cb939d31519eadf49037006777a721b5347fc7e23c5ed18e162e556')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.3' && row.packageSha256 === '5b9d80dd9ece37b0bd8cfd1133631f70d370e6109319e8b528c071fb1795f6e1')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.4' && row.packageSha256 === 'e2c58a786692d368ebd7886189ca0366a34f8223855868561e21829c44f859f2')
      && patientRecordPolicy?.releases.some(row => row.version === '1.0.5' && row.packageSha256 === '7aa21170bbe04821817d62f4c06bc3613cfaf64342058c41deb266a429a562d1'));

  const treatmentProtocolsPolicy = policy.apps.find(row => row.id === 'company.dental.m17.treatment-protocols');
  check('Treatment Protocols policy retains all six signed grants through 1.0.5',
    treatmentProtocolsPolicy?.releases.length === 6
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.0' && row.packageSha256 === '6db5fbe5b5418a88e4ea92c7ea32435c9d3a35619e21bb013cc286fcc004c224')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.1' && row.packageSha256 === 'fd744dbd1d6abc22f9a2e2feea6c25b6c54c18376bb5803c18f5fda03e8fd156')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.2' && row.packageSha256 === '4c81cb6f7b11a871a01ae0272dfa51513a2fcf679705c8a1e0df8382555b6f2b')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.3' && row.packageSha256 === 'dfd0d9955abcbf982176178f5f4acfab7c6277d9d519ff9beed1d1304f109b7e')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.4' && row.packageSha256 === '1cd092b6763949a9525e7ca8264d0f61543f547afbc997adb8b23a5ec6ce7920')
      && treatmentProtocolsPolicy?.releases.some(row => row.version === '1.0.5' && row.packageSha256 === '388917e049c738eda113579410a9cf4e6adfdf96889e0b88299ec88640b4deb5'));

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
