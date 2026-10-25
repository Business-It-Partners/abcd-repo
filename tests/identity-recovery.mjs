import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profile, profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [];
let app;
const account = 'recovery@fixture.invalid';
const refreshToken = `fixture-refresh-${Buffer.from(account).toString('base64url')}-1`;
const credentialFile = path.join(profile, 'identity', 'refresh.enc');
const key = createHash('sha256').update('private-dental-os-identity-fixture-key-v1').digest();
const iv = randomBytes(12);
const cipher = createCipheriv('aes-256-gcm', key, iv);
const plaintext = JSON.stringify({ version: 1, project: 'dental-managemetn-staging', refreshToken });
const originalBytes = Buffer.concat([iv, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
const sourceFiles = [
  'electron/identity/client.ts', 'electron/identity/contracts.ts', 'electron/identity/fixtures.ts',
  'electron/identity/session.ts', 'electron/identity/storage.ts', 'electron/main.ts', 'electron/preload.ts',
  'src/IdentityGate.tsx', 'src/IdentityGate.css', 'src/global.d.ts', 'tests/identity.test.ts',
  'tests/identity-recovery.mjs', 'package.json',
];
const sourceIdentity = async () => ({
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(await Promise.all(sourceFiles.map(async file => [
    file,
    createHash('sha256').update(await fs.readFile(path.join(root, file))).digest('hex'),
  ]))),
});
const check = (name, condition = true) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };

try {
  await fs.mkdir(path.dirname(credentialFile), { recursive: true, mode: 0o700 });
  await fs.writeFile(credentialFile, originalBytes, { mode: 0o600 });
  check('test profile starts with an encrypted synthetic saved credential', !originalBytes.includes(Buffer.from('fixture-refresh-')));

  app = await electron.launch({
    args: [root, ...profileArgs, '--runtime-fixtures', '--identity-fixtures', '--identity-persistent-fixtures', '--identity-restore-outage-once'],
    env,
    timeout: 30000,
  });
  const findShell = () => app.windows().find(page => {
    try { return new URL(page.url()).pathname.endsWith('/dist/index.html'); } catch { return false; }
  });
  let shell = findShell();
  const shellDeadline = Date.now() + 30000;
  while (!shell && Date.now() < shellDeadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
    shell = findShell();
  }
  if (!shell) throw new Error(`Sajilo Dental shell page did not load; windows=${JSON.stringify(app.windows().map(page => page.url()))}`);
  const pageErrors = [];
  shell.on('pageerror', error => pageErrors.push(error.message));
  try {
    await shell.locator('[data-session-phase="unavailable"]').waitFor({ timeout: 30000 });
  } catch (error) {
    const snapshot = await shell.evaluate(async () => ({
      url: location.href,
      view: await window.desktop?.identity?.view().catch(() => undefined),
      phaseAttribute: document.querySelector('[data-session-phase]')?.getAttribute('data-session-phase') ?? null,
      body: document.body?.innerText?.slice(0, 800) ?? '',
    })).catch(() => undefined);
    console.log('Restore UI timeout snapshot:', JSON.stringify({ snapshot, pageErrors }));
    throw error;
  }
  const failedView = await shell.evaluate(() => window.desktop.identity.view());
  check('temporary restore outage enters retryable unavailable state', failedView.phase === 'unavailable' && failedView.restoreAvailable && failedView.message.includes('It has been kept'));
  await shell.getByRole('button', { name: 'Retry saved session', exact: true }).waitFor({ timeout: 10000 });
  check('login screen exposes Retry saved session during the outage', await shell.getByRole('button', { name: 'Retry saved session', exact: true }).isVisible());
  check('outage leaves the saved credential byte-for-byte intact', (await fs.readFile(credentialFile)).equals(originalBytes));

  await shell.getByRole('button', { name: 'Retry saved session', exact: true }).click();
  await shell.locator('.statusbar-account-menu').waitFor({ timeout: 15000 });
  const restored = await shell.evaluate(() => window.desktop.identity.view());
  check('retry restores the workspace without asking for a password', restored.phase === 'ready' && restored.remembered && restored.userLabel === account);
  const renewedBytes = await fs.readFile(credentialFile);
  check('successful retry stores only encrypted rotated credentials', !renewedBytes.includes(Buffer.from('fixture-refresh-')) && renewedBytes.length >= 29);
  check('renderer session view exposes no token or credential value', !JSON.stringify(restored).includes('fixture-refresh-') && !JSON.stringify(restored).includes('synthetic-fixture-credential'));
  check('recovery UI has no renderer errors', pageErrors.length === 0);
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'm15-saved-session-recovery.json'), JSON.stringify({
    passed: true,
    checks,
    platform: process.platform,
    scope: 'Private Linux fixture: pre-seeded encrypted synthetic credential, injected one-time refresh outage, unchanged file check, and successful user-triggered retry.',
    sourceIdentity: await sourceIdentity(),
  }, null, 2));
} catch (error) {
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'm15-saved-session-recovery.json'), JSON.stringify({
    passed: false,
    checks,
    platform: process.platform,
    error: error instanceof Error ? error.message.split('\n')[0] : String(error),
    sourceIdentity: await sourceIdentity(),
  }, null, 2));
  throw error;
} finally {
  await app?.close();
}
