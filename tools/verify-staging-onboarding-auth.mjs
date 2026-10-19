// Read-only authenticated staging Store acceptance. All package state is temporary.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { FirebaseClient } from '../dist-electron/identity/client.js';
import { SessionManager } from '../dist-electron/identity/session.js';
import { CredentialStore } from '../dist-electron/identity/storage.js';
import { PackageRegistry } from '../dist-electron/packages/registry.js';
import { sha256, verifyPackage } from '../dist-electron/packages/format.js';
import { CatalogueStore } from '../dist-electron/distribution/storage.js';
import { DistributionService } from '../dist-electron/distribution/service.js';
import { stagingDistribution } from '../dist-electron/distribution/staging.js';
import { staging } from '../dist-electron/sdk/environment.js';

if (!process.argv.includes('--staging-auth-readonly') || staging.environment !== 'cloudfare-staging' || !stagingDistribution.publicBase) throw Error('Explicit read-only staging acceptance flag required');
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
if (!credentialFile) throw Error('External credential file required');
const credentialStat = await fs.lstat(credentialFile);
if (!credentialStat.isFile() || credentialStat.isSymbolicLink() || credentialStat.nlink !== 1 || credentialStat.size > 4096 || (process.platform !== 'win32' && (credentialStat.mode & 0o077) !== 0)) throw Error('Unsafe credential input');

let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string' || credentials.email.length > 254 || credentials.password.length > 1024) throw Error('Invalid credential input');
const appId = 'company.sample.preview';
const v1Sha256 = 'edea3cf0000e3e6dc2b54b95b0d44d216e8b3377af631d9a26c7432568145a5e';
const v1Url = new URL(`releases/${appId}/1.0.0/${v1Sha256}.dentalpkg`, stagingDistribution.publicBase);
const checks = [];
let phase = 'profile', root, session, service, registry, oldLease, trialLease, passed = false;
const check = (name, ok) => { if (!ok) throw Error('Acceptance case failed'); checks.push(name); console.log('PASS', name); };
const readBounded = async (response, max) => {
  if (!response.ok || response.redirected || Number(response.headers.get('content-length') ?? 0) > max || !response.body) { await response.body?.cancel(); throw Error('Remote object unavailable'); }
  const reader = response.body.getReader(); const parts = []; let size = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > max) throw Error('Remote object too large'); parts.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(parts, size);
};
try {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-auth-onboarding-'));
  const store = new CredentialStore(path.join(root, 'identity'), { available: () => false, encrypt: async () => { throw Error('Disabled'); }, decrypt: async () => { throw Error('Disabled'); } });
  session = new SessionManager(new FirebaseClient(), store, () => service?.invalidate(), 'staging');
  await session.restore();
  phase = 'clinic-login';
  const login = await session.login({ ...credentials, remember: false });
  credentials = undefined;
  check('staging Firebase login and clinic membership resolution succeeded', login.ok && session.view().phase === 'ready');

  registry = new PackageRegistry(path.join(root, 'packages'), stagingDistribution.policy);
  registry.initialize();
  service = new DistributionService(stagingDistribution, registry, session, new CatalogueStore(path.join(root, 'distribution')));
  phase = 'authenticated-first-install';
  const firstRefresh = await service.refresh();
  let view = service.view();
  let preview = view.apps.find(app => app.id === appId);
  check('authenticated Store refresh accepts current signed metadata and install policy', firstRefresh.ok && view.canInstall && ['company.sample.alpha', 'company.sample.beta', appId].every(id => view.apps.some(app => app.id === id)));
  check('live Store offers 1.2.0 for a first-party app not yet installed', preview?.version === '1.2.0' && preview.installedVersion === null && preview.capabilities.length === 0);
  const firstInstall = await service.install(appId);
  check('authenticated Store Get installs the current signed 1.2.0 package from R2', firstInstall.ok && registry.describe(appId).version === '1.2.0');
  let firstLease = registry.launch(appId);
  const firstHtml = firstLease.files.get('index.html')?.toString() ?? '';
  const firstDigest = firstLease.release.digest;
  check('authenticated first install opens the release-history app with zero capabilities', firstLease.manifest.version === '1.2.0' && /<h1>Release history<\/h1>/i.test(firstHtml) && firstLease.capabilities.length === 0);
  registry.markHealthy(appId, firstDigest);
  firstLease.releaseLease(); firstLease = undefined;
  registry.uninstall(appId);
  service.changed();

  phase = 'seed-prior-app';
  const oldResponse = await fetch(v1Url, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store', credentials: 'omit' });
  const oldBytes = await readBounded(oldResponse, 16 * 1024 * 1024);
  const oldPackage = verifyPackage(oldBytes, stagingDistribution.policy);
  check('signed staging 1.0.0 package has its recorded public-object digest', sha256(oldBytes) === v1Sha256 && oldPackage.manifest.appId === appId && oldPackage.manifest.version === '1.0.0');
  registry.install(oldBytes);
  const first = registry.launch(appId);
  check('prior 1.0.0 installation exists only in the disposable profile', first.manifest.version === '1.0.0');
  registry.markHealthy(appId, first.release.digest);
  first.releaseLease();

  phase = 'authenticated-update-offer';
  service.changed();
  view = service.view();
  preview = view.apps.find(app => app.id === appId);
  check('live authenticated Store keeps app-management permission and offers 1.2.0 over installed 1.0.0', view.canInstall && preview?.version === '1.2.0' && preview.installedVersion === '1.0.0' && preview.capabilities.length === 0);

  oldLease = registry.launch(appId);
  phase = 'authenticated-update-download';
  const staged = await service.install(appId);
  check('authenticated Store download stages live R2 1.2.0 while the old runtime stays pinned', staged.ok && oldLease.manifest.version === '1.0.0' && registry.describe(appId).version === '1.0.0' && registry.describe(appId).pendingVersion === '1.2.0');
  oldLease.releaseLease(); oldLease = undefined;

  phase = 'trial-health';
  trialLease = registry.launch(appId);
  const html = trialLease.files.get('index.html')?.toString() ?? '';
  const digest = trialLease.release.digest;
  check('authenticated 1.2.0 update opens in trial with release history and zero capabilities', trialLease.manifest.version === '1.2.0' && /<h1>Release history<\/h1>/i.test(html) && trialLease.capabilities.length === 0);
  registry.markHealthy(appId, digest);
  trialLease.releaseLease(); trialLease = undefined;
  check('updated 1.2.0 becomes known-good only after health acknowledgement', registry.describe(appId).version === '1.2.0' && registry.inspect().apps[appId].knownGood === digest && !registry.inspect().apps[appId].pending);
  passed = true;
} catch {
  console.error('Authenticated staging acceptance failed at ' + phase + '; no credentials, tokens, clinic identity, or response payload were printed.');
  process.exitCode = 1;
} finally {
  credentials = undefined;
  oldLease?.releaseLease(); trialLease?.releaseLease();
  service?.dispose(); session?.dispose(); await session?.flush();
  if (root) await fs.rm(root, { recursive: true, force: true });
  const report = {
    passed,
    date: new Date().toISOString(),
    platform: process.platform,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: staging.environment,
    appId,
    priorVersion: '1.0.0',
    currentVersion: '1.2.0',
    authenticatedWorkerAuthorization: passed ? 'verified through the real staging clinic session and Store service' : 'not verified',
    checks,
    scope: 'Real staging Firebase login, /v1/me, authenticated signed metadata/install-policy requests and public R2 package download. Installed/update state was disposable local state only; no clinic or production records were accessed or changed. Native UI click-through remains covered by private fixture tests, not by this authenticated service run.',
  };
  await fs.mkdir('artifacts', { recursive: true });
  await fs.writeFile('artifacts/staging-onboarding-auth-verification.json', JSON.stringify(report, null, 2) + '\n');
}
