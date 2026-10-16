import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
export async function verifyPackages(profileArgs, reportName) {
 const root = path.resolve(import.meta.dirname, '..'), env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
 const app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures'], env, timeout: 30000 }), checks = [];
 const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
 try {
  const shell = await app.firstWindow(), profile = await app.evaluate(({ app }) => app.getPath('userData'));
  shell.setDefaultTimeout(15000);
  const packageRoot = path.join(profile, 'packages'), registry = JSON.parse(await fs.readFile(path.join(packageRoot, 'registry.json'), 'utf8'));
  check('two signed packages installed under isolated OS profile', Object.keys(registry.apps).length === 2 && registry.format === 1);
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  const alpha = app.context().pages().find(p => p.url().startsWith('dental-fixture://alpha/')); assert.ok(alpha);
  const connection = await alpha.evaluate(() => window.dentalApp.connect({ major: 1, minor: 0 }));
  check('broker identity/version/capabilities derive from verified package', connection.ok && connection.value.appId === 'company.sample.alpha' && connection.value.appVersion === '1.0.0');
  check('renderer cannot access installation or filesystem authority', await alpha.evaluate(() => typeof window.desktop === 'undefined' && typeof require === 'undefined' && !window.dentalApp.install && !window.dentalApp.uninstall));
  await shell.getByRole('button', { name: 'Records', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'ready');
  const beta = app.context().pages().find(p => p.url().startsWith('dental-fixture://beta/')); assert.ok(beta);
  const betaConnection = await beta.evaluate(() => window.dentalApp.connect({ major: 1, minor: 0 }));
  check('beta manifest has no appointment write grant', betaConnection.ok && !betaConnection.value.capabilities.includes('appointments.setStatus'));
  const dir = path.join(packageRoot, 'apps/company.sample.alpha', registry.apps['company.sample.alpha'].active);
  const original = await fs.readFile(path.join(dir, 'app.js')); await fs.writeFile(path.join(dir, 'app.js'), 'document.body.textContent="TAMPERED_EXECUTED"');
  check('already-running version remains pinned in memory', (await alpha.locator('body').innerText()).includes('SYNTHETIC DATA'));
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.getByRole('button', { name: 'Close Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="studio"]')?.dataset.phase === 'closed');
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'failed');
  check('tampered installed bytes refuse execution on next launch', await shell.locator('[data-runtime="studio"]').innerText().then(s => s.includes('package-verification-failed')));
  check('failure leaves other app and host usable', await beta.getByLabel('Your draft').inputValue() === '' && (await shell.evaluate(() => window.desktop.status())).phase === 'ready');
  await fs.writeFile(path.join(dir, 'app.js'), original);
  await shell.getByRole('button', { name: 'Restart sample', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  check('restored signed bytes pass explicit retry', true);
 } finally {
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', reportName), JSON.stringify({ checks, platform: process.platform, sha: process.env.GITHUB_SHA ?? null }, null, 2)); await app.close();
 }
}
