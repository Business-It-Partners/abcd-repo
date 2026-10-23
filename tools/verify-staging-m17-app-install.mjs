// Actual authenticated staging Store installation for the current M17 app releases.
// Runs in a disposable local profile, performs no clinic/business API writes, and records no credentials.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FirebaseClient } from '../dist-electron/identity/client.js';
import { SessionManager } from '../dist-electron/identity/session.js';
import { CredentialStore } from '../dist-electron/identity/storage.js';
import { PackageRegistry } from '../dist-electron/packages/registry.js';
import { CatalogueStore } from '../dist-electron/distribution/storage.js';
import { DistributionService } from '../dist-electron/distribution/service.js';
import { sha256 } from '../dist-electron/packages/format.js';
import { stagingDistribution, m17StagingKeyId } from '../dist-electron/distribution/staging.js';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw Error('Explicit staging acceptance and external clinic credential file are required');
}
const checkout = path.resolve(import.meta.dirname, '..');
const credentialPath = path.resolve(process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE);
if (credentialPath === checkout || credentialPath.startsWith(checkout + path.sep)) throw Error('Credential must remain outside the checkout');
const credentialInfo = await fs.lstat(credentialPath);
if (!credentialInfo.isFile() || credentialInfo.isSymbolicLink() || credentialInfo.size > 4096
  || process.platform !== 'win32' && (credentialInfo.mode & 0o077) !== 0) throw Error('Unsafe external credential input');
let credentials = JSON.parse(await fs.readFile(credentialPath, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join(',') !== 'email,password'
  || typeof credentials.email !== 'string' || !credentials.email || typeof credentials.password !== 'string' || !credentials.password) {
  credentials = undefined;
  throw Error('Credential file must contain only email and password');
}

const expected = [
  { id: 'company.dental.followups.m17', version: '1.0.2', sha256: '31614a593ce389d1739f7da7c4798e08b94aa8e44340b7317b30a6490b56707f' },
  { id: 'company.dental.appointments.m17', version: '1.0.3', sha256: '0d55de88d362882f6157be78eac871411a4d4b89032355c0791f8ed8dcba96c6' },
  { id: 'company.dental.treatment-progress.m17', version: '1.0.4', sha256: '7d29f474519f428bda38899a7b495ed7b1cd0a3e8b83baf6071ce927bbf9f175' },
  { id: 'company.dental.calendar.m17', version: '1.0.3', sha256: 'c9d58d459f0dc03a42bf31323afca54ba6f33187eadd794e96d242a52db8b398' },
  { id: 'company.dental.m17.treatment-protocols', version: '1.0.5', sha256: '388917e049c738eda113579410a9cf4e6adfdf96889e0b88299ec88640b4deb5' },
  { id: 'company.dental.work-entry.m17', version: '1.0.2', sha256: 'de45de9e17dcc11ec96a8b3b7e5788e8d528103ad8dbf1f764c805a63a80e987' },
  { id: 'company.dental.patient-record.m17', version: '1.0.5', sha256: '7aa21170bbe04821817d62f4c06bc3613cfaf64342058c41deb266a429a562d1', capabilities: ['clinic.media.read', 'clinic.media.upload'] },
];
let root;
let session;
let service;
let passed = false;
let phase = 'health';
const checks = [];
const check = (name, value) => {
  if (!value) throw Error('Acceptance case failed');
  checks.push(name);
};
try {
  const health = await fetch(stagingDistribution.apiBase + '/health', { signal: AbortSignal.timeout(10_000), redirect: 'error', cache: 'no-store' });
  check('pinned staging Worker is healthy', health.ok && (await health.json()).environment === 'cloudfare-staging');
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-store-m17-staging-'));
  await fs.chmod(root, 0o700);
  const credentialsStore = new CredentialStore(path.join(root, 'identity'), {
    available: () => false,
    encrypt: async () => { throw Error('Persistent encryption is disabled in this temporary profile'); },
    decrypt: async () => { throw Error('Persistent decryption is disabled in this temporary profile'); },
  });
  session = new SessionManager(new FirebaseClient(), credentialsStore, () => service?.invalidate(), 'staging');
  await session.restore();
  phase = 'clinic-login';
  check('authorized clinic staging session established', (await session.login({ ...credentials, remember: false })).ok);
  credentials = undefined;
  const registry = new PackageRegistry(path.join(root, 'packages'), stagingDistribution.policy);
  service = new DistributionService(stagingDistribution, registry, session, new CatalogueStore(path.join(root, 'distribution')));
  phase = 'catalogue';
  check('live signed staging catalogue and update policy verified', (await service.refresh()).ok);
  const view = service.view();
  check('staging clinic policy allows install', view.canInstall);
  for (const app of expected) {
    const row = view.apps.find(value => value.id === app.id);
    check('signed catalogue lists exact M17 app and version: ' + app.id,
      row?.version === app.version && row.available && row.capabilities.includes('clinic.api.request')
      && (!app.capabilities || app.capabilities.every(capability => row.capabilities.includes(capability))));
  }
  for (const app of expected) {
    phase = 'store-install-' + app.id;
    check('Store downloaded and installed published M17 package: ' + app.id, (await service.install(app.id)).ok);
    const installed = registry.inspectPackage(app.id);
    const installedBundle = await fs.readFile(path.join(root, 'packages', 'apps', app.id, installed.release.digest, 'bundle.dentalpkg'));
    check('local installed package matches expected version, signer, and bytes: ' + app.id,
      registry.describe(app.id).activeVersion === app.version && installed.manifest.appId === app.id
      && installed.release.keyId === m17StagingKeyId && sha256(installedBundle) === app.sha256);
    const lease = registry.launch(app.id);
    try {
      const operations = registry.apiOperations(lease);
      check('installed release obtains a valid launch lease with exact M17 identity and API grant: ' + app.id,
        lease.manifest.appId === app.id && lease.manifest.version === app.version
        && lease.release.keyId === m17StagingKeyId && operations.includes('clinic.api.request'));
    } finally {
      lease.releaseLease();
    }
  }
  passed = true;
} catch {
  console.error('M17 staging Store installation failed at ' + phase + '; credentials and response payloads were not printed.');
  process.exitCode = 1;
} finally {
  credentials = undefined;
  service?.dispose();
  session?.dispose();
  await session?.flush();
  if (root) await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/m17-staging-store-install.json', JSON.stringify({
    passed, phase, checks, apps: expected.map(({ id, version, sha256 }) => ({ id, version, packageSha256: sha256 })),
    keyId: m17StagingKeyId,
    scope: 'Authenticated staging Store installs in a disposable local profile; package identity, bytes, signer, launch lease, and package-bound API grant verified. No clinic/business API reads or writes and no renderer workflow was run; profile removed.',
    source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  }, null, 2) + '\n', { mode: 0o600 });
}
if (passed) console.log(JSON.stringify({ passed, checks }));
