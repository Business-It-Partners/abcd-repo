// Opt-in authenticated Follow-ups install acceptance; never runs in default CI.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw Error('Explicit authenticated staging UI acceptance required');
}

const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const credentialStat = await fs.lstat(credentialFile);
if (!credentialStat.isFile() || credentialStat.isSymbolicLink() || credentialStat.nlink !== 1 || credentialStat.size > 4096 || (process.platform !== 'win32' && (credentialStat.mode & 0o077) !== 0)) {
  throw Error('Unsafe credential input');
}

let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
  throw Error('Invalid credential input');
}

const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const root = path.resolve(import.meta.dirname, '..');
const appId = 'company.dental.followups';
const version = '1.0.0';
const checks = [];
let app;
let passed = false;
let phase = 'launch';
const check = (name, value) => {
  if (!value) throw Error('Acceptance case failed');
  checks.push(name);
  console.log('PASS', name);
};

try {
  phase = 'fresh-install-launch';
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging'], env, timeout: 30000 });
  const shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);

  phase = 'clinic-login';
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.waitForFunction(() => document.querySelector('[data-session-phase]')?.dataset.sessionPhase === 'signed-out');
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.getByRole('group', { name: 'Session controls', exact: true }).waitFor({ timeout: 20000 });
  credentials.password = undefined;
  const session = await shell.evaluate(() => window.desktop.identity.view());
  check('clinic session is ready', session.phase === 'ready');
  check('session uses the staging identity mode', session.mode === 'staging');
  check('sign-in did not remember credentials on this temporary profile', session.remembered === false);

  phase = 'store-discovery';
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'Your apps. One workspace.' }).waitFor();
  await shell.getByRole('button', { name: 'Details Follow-ups', exact: true }).click();
  await shell.getByRole('heading', { name: 'Follow-ups', exact: true }).waitFor();
  check('signed staging Store offers Follow-ups 1.0.0 as not installed', await shell.locator('.store-facts').innerText().then(text => text.includes(version) && text.includes('Not installed')));

  phase = 'authenticated-install';
  await shell.getByRole('button', { name: 'Get', exact: true }).click();
  await shell.locator('.store-arrival').waitFor({ timeout: 25000 });
  check('authenticated Store install starts the package-to-dock arrival', await shell.locator('.store-arrival svg').count() === 1 && await shell.locator(`[data-dock-app="${appId}"]`).count() === 1);
  await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 10000 });
  check('verified Follow-ups artwork lands in the dock', await shell.locator(`[data-dock-app="${appId}"]`).isVisible());

  phase = 'first-launch';
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId);
  const guest = await (async () => {
    for (let n = 0; n < 150; n++) {
      const page = app.context().pages().find(candidate => !candidate.isClosed() && candidate.url().startsWith(`dental-fixture://${appId}/`));
      if (page) return page;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw Error('Follow-ups app window deadline');
  })();
  await guest.locator(`main[data-dental-os-app="${appId}"]`).waitFor();
  await guest.getByRole('heading', { name: 'Follow-ups', exact: true }).waitFor();
  check('installed app opens the real Follow-ups module UI', true);

  const userData = await app.evaluate(({ app }) => app.getPath('userData'));
  const registryPath = path.join(userData, 'packages', 'registry.json');
  let registry;
  for (let n = 0; n < 150; n++) {
    try {
      registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      if (registry.apps[appId]?.knownGood === registry.apps[appId]?.active) break;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  check('Follow-ups 1.0.0 passes runtime health acknowledgement', registry?.apps[appId]?.versions?.length === 1 && registry.apps[appId]?.knownGood === registry.apps[appId]?.active);
  passed = true;
} catch (error) {
  const detail = String(error?.message ?? '').split('\n')[0]
    .replaceAll(credentials?.email ?? '\u0000', '<redacted>')
    .replaceAll(credentials?.password ?? '\u0000', '<redacted>')
    .slice(0, 160);
  console.error(`Authenticated Follow-ups staging acceptance failed at ${phase} (${error?.name ?? 'Error'}: ${detail}); credentials, clinic identity, tokens, and response payloads were omitted.`);
  process.exitCode = 1;
} finally {
  if (credentials) {
    credentials.email = undefined;
    credentials.password = undefined;
  }
  if (app) await app.close();
  const artifactRoot = path.join(root, 'artifacts');
  await fs.mkdir(artifactRoot, { recursive: true });
  await fs.writeFile(path.join(artifactRoot, 'followups-staging-install-verification.json'), JSON.stringify({
    passed,
    date: new Date().toISOString(),
    platform: process.platform,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    environment: 'cloudfare-staging',
    appId,
    version,
    phase,
    checks,
    scope: 'Private isolated Linux desktop; real staging clinic login and authenticated Store install; signed public package; temporary local profile only. No live desktop or clinic records were accessed or changed.',
  }, null, 2) + '\n');
}

if (!passed) process.exitCode = 1;
