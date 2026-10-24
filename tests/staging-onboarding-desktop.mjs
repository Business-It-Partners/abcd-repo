// Opt-in authenticated live staging Store acceptance; never runs in default CI.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) throw Error('Explicit authenticated staging UI acceptance required');
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const credentialStat = await fs.lstat(credentialFile);
if (!credentialStat.isFile() || credentialStat.isSymbolicLink() || credentialStat.nlink !== 1 || credentialStat.size > 4096 || (process.platform !== 'win32' && (credentialStat.mode & 0o077) !== 0)) throw Error('Unsafe credential input');
let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') throw Error('Invalid credential input');
const env = { ...process.env }; for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { sha256, verifyPackage } = require('../dist-electron/packages/format.js');
const { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const appId = 'company.sample.preview';
const v1Sha256 = 'edea3cf0000e3e6dc2b54b95b0d44d216e8b3377af631d9a26c7432568145a5e';
const checks = [];
let app, updateProfile, passed = false, phase = 'launch';
const check = (name, value) => { if (!value) throw Error('Acceptance case failed'); checks.push(name); console.log('PASS', name); };
const signIn = async shell => {
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.waitForFunction(() => document.querySelector('[data-session-phase]')?.dataset.sessionPhase === 'signed-out');
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.getByRole('complementary', { name: 'Session controls' }).waitFor({ timeout: 20000 });
  const view = await shell.evaluate(() => window.desktop.identity.view());
  check('private desktop resolves the real staging clinic session with automatic persistence status', view.phase === 'ready' && view.mode === 'staging' && typeof view.remembered === 'boolean');
};
const openStore = async shell => {
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'App Store' }).waitFor();
  await shell.getByRole('button', { name: 'Details Dental Workspace Preview', exact: true }).click();
  await shell.getByRole('heading', { name: 'Dental Workspace Preview', exact: true }).waitFor();
};
const findGuest = async instance => {
  for (let n = 0; n < 150; n++) {
    const page = instance.context().pages().find(candidate => !candidate.isClosed() && candidate.url().startsWith(`dental-fixture://${appId}/`));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('App window deadline');
};
const registryState = async profile => JSON.parse(await fs.readFile(path.join(profile, 'packages', 'registry.json'), 'utf8'));
const waitFor = async (predicate, label) => {
  for (let n = 0; n < 150; n++) { try { const value = await predicate(); if (value) return value; } catch {} await new Promise(resolve => setTimeout(resolve, 100)); }
  throw Error(label + ' deadline');
};
const fetchBounded = async (url, maximum) => {
  const response = await fetch(url, { signal: AbortSignal.timeout(15000), redirect: 'error', cache: 'no-store', credentials: 'omit' });
  if (!response.ok || response.redirected || Number(response.headers.get('content-length') ?? 0) > maximum || !response.body) { await response.body?.cancel(); throw Error('Staging package unavailable'); }
  const reader = response.body.getReader(), parts = []; let length = 0;
  try { for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.length; if (length > maximum) throw Error('Staging package too large'); parts.push(Buffer.from(value)); } }
  finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(parts, length);
};

try {
  phase = 'fresh-install-launch';
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging'], env, timeout: 30000 });
  let shell = await app.firstWindow(); shell.setDefaultTimeout(20000);
  const freshProfile = await app.evaluate(({ app }) => app.getPath('userData'));
  await signIn(shell);
  await openStore(shell);
  check('live signed catalogue lists the not-yet-installed first-party app', await shell.locator('.delivery-store-versions').innerText().then(text => text.includes('1.2.0') && text.includes('Not installed')));
  phase = 'fresh-install';
  await shell.getByRole('button', { name: 'Install', exact: true }).click();
  await shell.locator('.store-arrival').waitFor({ timeout: 25000 });
  check('authenticated live Store install starts the Store-to-dock thumbnail flight', await shell.locator('.store-arrival svg').count() === 1 && await shell.locator('[data-dock-app]').last().getAttribute('data-dock-app') === appId);
  check('new dock icon remains hidden until the live package arrival lands', ((await shell.locator(`[data-dock-app="${appId}"]`).getAttribute('style')) ?? '').includes('visibility: hidden'));
  await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 10000 });
  check('live installed app lands with matching artwork in the dock', await shell.locator(`[data-dock-app="${appId}"] .dock-artwork svg`).count() === 1 && await shell.locator(`[data-dock-app="${appId}"]`).isVisible());
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId);
  let guest = await findGuest(app);
  await guest.getByRole('heading', { name: 'Release history', exact: true }).waitFor();
  let state = await waitFor(async () => { const current = await registryState(freshProfile); return current.apps[appId]?.knownGood === current.apps[appId]?.active ? current : undefined; }, 'fresh install health acknowledgement');
  check('live signed 1.2.0 first install opens and passes its runtime health check', state.apps[appId]?.versions.length === 1 && state.apps[appId]?.knownGood === state.apps[appId]?.active);
  await app.close(); app = undefined;

  phase = 'seed-prior-release';
  updateProfile = await fs.mkdtemp(path.join(os.tmpdir(), 'dental-staging-desktop-update-'));
  if (process.platform !== 'win32') await fs.chmod(updateProfile, 0o700);
  const v1Url = new URL(`releases/${appId}/1.0.0/${v1Sha256}.dentalpkg`, stagingDistribution.publicBase);
  const v1Bytes = await fetchBounded(v1Url, 16 * 1024 * 1024);
  const v1 = verifyPackage(v1Bytes, stagingDistribution.policy);
  check('previous 1.0.0 package matches its signed public R2 digest', sha256(v1Bytes) === v1Sha256 && v1.manifest.appId === appId && v1.manifest.version === '1.0.0');
  const registry = new PackageRegistry(path.join(updateProfile, 'packages'), stagingDistribution.policy);
  registry.initialize(); registry.install(v1Bytes);
  const baseline = registry.launch(appId), oldDigest = baseline.release.digest;
  registry.markHealthy(appId, oldDigest); baseline.releaseLease();

  phase = 'authenticated-update-launch';
  const updateArgs = [root, '--ozone-platform=wayland', `--user-data-dir=${updateProfile}`, '--identity-staging'];
  app = await electron.launch({ args: updateArgs, env, timeout: 30000 });
  shell = await app.firstWindow(); shell.setDefaultTimeout(20000);
  const actualProfile = await app.evaluate(({ app }) => app.getPath('userData'));
  if (path.resolve(actualProfile) !== path.resolve(updateProfile)) throw Error('Disposable profile binding mismatch');
  await signIn(shell);
  await openStore(shell);
  check('live Store offers 1.2.0 Update for the installed 1.0.0 app', await shell.locator('.delivery-store-versions').innerText().then(text => text.includes('1.0.0') && text.includes('1.2.0')));
  phase = 'authenticated-update-download';
  await shell.getByRole('button', { name: 'Update', exact: true }).click();
  await shell.locator('.delivery-update-state').filter({ hasText: 'Update ready · 1.2.0' }).waitFor({ timeout: 25000 });
  state = await registryState(updateProfile);
  check('live authenticated Store stages 1.2.0 over the verified 1.0.0 installation', state.apps[appId]?.active === oldDigest && !!state.apps[appId]?.pending && state.apps[appId]?.versions.length === 2);
  check('live Store offers no immediate update action', await shell.getByRole('button', { name: 'Use update now', exact: true }).count() === 0);
  check('an app-only update does not replay the first-install arrival animation', await shell.locator('.store-celebration').count() === 0);
  phase = 'authenticated-update-next-open-trial';
  await shell.getByRole('button', { name: 'Open', exact: true }).waitFor({ timeout: 15000 });
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  state = await waitFor(async () => { const current = await registryState(updateProfile); return current.apps[appId]?.active !== oldDigest && current.apps[appId]?.trial === current.apps[appId]?.active ? current : undefined; }, 'next-open 1.2.0 trial');
  check('next app open trials 1.2.0 while retaining 1.0.0 as known-good', state.apps[appId]?.knownGood === oldDigest && !state.apps[appId]?.pending);
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId);
  guest = await findGuest(app);
  await guest.getByRole('heading', { name: 'Release history', exact: true }).waitFor();
  state = await waitFor(async () => { const current = await registryState(updateProfile); return current.apps[appId]?.versions.length === 2 && current.apps[appId]?.knownGood === current.apps[appId]?.active && !current.apps[appId]?.pending ? current : undefined; }, 'updated app health acknowledgement');
  check('live Store Update opens 1.2.0 and acknowledges its health before promotion', state.apps[appId]?.versions.length === 2 && state.apps[appId]?.knownGood === state.apps[appId]?.active && !state.apps[appId]?.pending);
  await app.close(); app = undefined;
  app = await electron.launch({ args: updateArgs, env, timeout: 30000 });
  shell = await app.firstWindow(); shell.setDefaultTimeout(20000);
  await signIn(shell);
  await shell.getByRole('button', { name: 'Dental Workspace Preview', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId);
  guest = await findGuest(app);
  await guest.getByRole('heading', { name: 'Release history', exact: true }).waitFor();
  state = await registryState(updateProfile);
  check('actual staging-signed 1.2.0 survives a full Dental OS process restart', state.apps[appId]?.knownGood === state.apps[appId]?.active && await shell.locator('.store-celebration').count() === 0);
  passed = true;
} catch (error) {
  const detail = String(error?.message ?? '').split('\n')[0].replaceAll(credentials.email, '<redacted>').replaceAll(credentials.password, '<redacted>').slice(0, 160);
  console.error('Authenticated live staging desktop acceptance failed at ' + phase + ` (${error?.name ?? 'Error'}: ${detail}); credentials, clinic identity, tokens, and response payloads were omitted.`);
  process.exitCode = 1;
} finally {
  credentials.password = undefined;
  if (app) await app.close();
  if (updateProfile) await fs.rm(updateProfile, { recursive: true, force: true });
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/staging-onboarding-desktop-verification.json'), JSON.stringify({ passed, date: new Date().toISOString(), platform: process.platform, sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), environment: 'cloudfare-staging', appId, phase, checks, scope: 'Private isolated Linux desktop; real staging clinic login, authenticated Store install/update calls, signed public R2 package bytes, temporary profiles only. No clinic/business records were read or changed. This is not physical Windows or production acceptance.' }, null, 2) + '\n');
}
if (!passed) process.exitCode = 1;
