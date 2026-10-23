// Opt-in authenticated staging Store + renderer acceptance for current M17 Follow-ups, Appointments, and Calendar releases.
// Run only through tools/run-ui-test.mjs so Electron uses a private headless display/profile.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw Error('Explicit authenticated M17 staging desktop acceptance required');
}
const root = path.resolve(import.meta.dirname, '..');
const credentialPath = path.resolve(process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE);
if (credentialPath === root || credentialPath.startsWith(root + path.sep)) throw Error('Credential input must remain outside the checkout');
const credentialInfo = await fs.lstat(credentialPath);
if (!credentialInfo.isFile() || credentialInfo.isSymbolicLink() || credentialInfo.nlink !== 1 || credentialInfo.size > 4096
  || process.platform !== 'win32' && (credentialInfo.mode & 0o077) !== 0) throw Error('Unsafe credential input');
let credentials = JSON.parse(await fs.readFile(credentialPath, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join(',') !== 'email,password'
  || typeof credentials.email !== 'string' || !credentials.email || typeof credentials.password !== 'string' || !credentials.password) {
  credentials = undefined;
  throw Error('Credential file must contain only email and password');
}

const apps = [
  { id: 'company.dental.followups.m17', title: 'Follow-ups', version: '1.0.2', payloadDigest: 'a2b047bf7a36008dc0ab27fbf3ae1c70ad9a7b957df6096b940c0cc632fb0156' },
  { id: 'company.dental.appointments.m17', title: 'Appointments', version: '1.0.3', payloadDigest: 'f1fbaa01f85ac67a2582538e55440e8f125fa53d5456785308d87a452195fa0d' },
  { id: 'company.dental.calendar.m17', title: 'Calendar', version: '1.0.2', payloadDigest: '39e019ca056b88464ca34815435b5b0c9ea086eb68fdb4df3750048a478e5aea' },
];
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const checks = [];
const observedStore = [];
let app;
let passed = false;
let phase = 'launch';
const check = (name, value) => {
  if (!value) throw Error('Acceptance case failed');
  checks.push(name);
  console.log('PASS', name);
};
const findGuest = async (instance, id) => {
  for (let n = 0; n < 200; n++) {
    const page = instance.context().pages().find(candidate => !candidate.isClosed() && candidate.url().startsWith(`dental-fixture://${id}/`));
    if (page) return page;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error('M17 app window deadline');
};
const readRegistry = async profile => JSON.parse(await fs.readFile(path.join(profile, 'packages', 'registry.json'), 'utf8'));
const waitFor = async (predicate, label) => {
  for (let n = 0; n < 200; n++) {
    try { const value = await predicate(); if (value) return value; } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw Error(label + ' deadline');
};

try {
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging'], env, timeout: 30000 });
  const shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);
  phase = 'clinic-login';
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.waitForFunction(() => document.querySelector('[data-session-phase]')?.dataset.sessionPhase === 'signed-out');
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.locator('.clinic-widget-menu > summary').waitFor({ state: 'visible', timeout: 20000 });
  const identity = await shell.evaluate(() => window.desktop.identity.view());
  check('authorized staging clinic session is ready without persistent credential storage',
    identity.phase === 'ready' && identity.mode === 'staging' && typeof identity.remembered === 'boolean');
  credentials.email = undefined;
  credentials.password = undefined;
  credentials = undefined;
  const profile = await app.evaluate(({ app }) => app.getPath('userData'));

  for (const target of apps) {
    phase = 'store-open-' + target.id;
    await shell.getByRole('button', { name: 'App Store', exact: true }).click();
    const storeBack = shell.getByRole('button', { name: 'Back', exact: true });
    if (await storeBack.isEnabled()) await storeBack.click();
    phase = 'store-heading-' + target.id;
    await shell.getByRole('heading', { name: 'Your apps. One workspace.' }).waitFor();
    phase = 'store-catalogue-' + target.id;
    const storeView = await waitFor(async () => {
      const value = await shell.evaluate(generation => window.desktop.store.action('view', undefined, generation), identity.generation);
      return ['ready', 'unavailable'].includes(value.phase) ? value : undefined;
    }, 'signed Store catalogue');
    observedStore.push({ phase: storeView.phase, canInstall: storeView.canInstall,
      apps: storeView.apps.map(value => ({ id: value.id, title: value.title, version: value.version, available: value.available })) });
    check('live signed Store catalogue is ready', storeView.phase === 'ready');
    const storeRow = storeView.apps.find(value => value.id === target.id);
    check(`live signed Store view contains available ${target.id} ${target.version}`,
      storeView.canInstall && storeRow?.title === target.title && storeRow.version === target.version && storeRow.available);
    phase = 'store-details-button-' + target.id;
    const storeIndex = storeView.apps.findIndex(value => value.id === target.id);
    await shell.locator('.store-grid article').nth(storeIndex)
      .getByRole('button', { name: `Details ${target.title}`, exact: true }).click();
    phase = 'store-app-detail-' + target.id;
    await shell.getByRole('heading', { name: target.title, exact: true }).waitFor();
    phase = 'store-facts-' + target.id;
    check(`signed Store lists ${target.id} ${target.version} as not installed`,
      await shell.locator('.store-facts').innerText().then(text => text.includes(target.version) && text.includes('Not installed')));
    phase = 'store-install-' + target.id;
    await shell.getByRole('button', { name: 'Get', exact: true }).click();
    await shell.locator('.store-arrival').waitFor({ timeout: 25000 });
    check(`authenticated Store started package arrival for ${target.id}`,
      await shell.locator('.store-arrival').count() === 1 && await shell.locator(`[data-dock-app="${target.id}"]`).count() === 1);
    await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 10000 });
    check(`verified ${target.title} icon landed in the dock`, await shell.locator(`[data-dock-app="${target.id}"]`).isVisible());
    await shell.getByRole('button', { name: 'Open', exact: true }).click();
    await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', target.id);
    const guest = await findGuest(app, target.id);
    await guest.locator(`main[data-dental-os-app="${target.id}"]`).waitFor();
    await guest.getByRole('heading', { name: target.title, exact: true }).waitFor();
    const registry = await waitFor(async () => {
      const value = await readRegistry(profile);
      const state = value.apps[target.id];
      return state?.active === target.payloadDigest && state?.knownGood === target.payloadDigest ? value : undefined;
    }, `${target.title} runtime health acknowledgement`);
    check(`${target.id} opened its renderer and recorded health for the exact published payload`,
      registry.apps[target.id]?.active === target.payloadDigest
      && registry.apps[target.id]?.knownGood === target.payloadDigest
      && registry.apps[target.id]?.versions?.length === 1);
  }
  phase = 'complete';
  passed = true;
} catch {
  console.error(`Authenticated M17 staging desktop acceptance failed at ${phase}; credentials, clinic identity, and response payloads were omitted.`);
  process.exitCode = 1;
} finally {
  credentials = undefined;
  if (app) await app.close();
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/m17-staging-live-desktop.json'), JSON.stringify({
    passed,
    date: new Date().toISOString(),
    platform: process.platform,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'cloudfare-staging',
    apps: apps.map(({ id, version, payloadDigest }) => ({ id, version, payloadDigest })),
    phase,
    checks,
    observedStore,
    scope: 'Private isolated Linux desktop; authenticated staging Store installs; all three exact signed packages opened in Dental OS-managed renderers and reached automatic runtime health. App launch reads staging business data; no business writes were performed. Temporary profile and credentials were removed; not physical Windows or production acceptance.',
  }, null, 2) + '\n');
  console.log('EVIDENCE artifacts/m17-staging-live-desktop.json');
}
if (!passed) process.exitCode = 1;
