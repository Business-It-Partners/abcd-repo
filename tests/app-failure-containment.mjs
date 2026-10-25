import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [];
const check = (name, value = true) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};
const wait = async (predicate, label, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch { /* keep polling transient renderer state */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const app = await electron.launch({
  args: [root, ...profileArgs, '--runtime-fixtures'],
  env,
  timeout: 30000,
});
try {
  const findShell = () => app.windows().find(page => {
    try { return new URL(page.url()).pathname.endsWith('/dist/index.html'); } catch { return false; }
  });
  let shell = findShell();
  await wait(() => (shell = findShell()) !== undefined, 'the desktop shell');
  shell.setDefaultTimeout(20000);

  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready'), 'Motion Studio');
  await shell.getByRole('button', { name: 'Records', exact: true }).click();
  await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'ready'), 'Records');
  const guest = host => app.context().pages().find(page => !page.isClosed() && page.url().startsWith(`dental-fixture://${host}/`));
  let studio = guest('alpha');
  const records = guest('beta');
  assert.ok(studio && records, 'both app renderer pages are present');
  await records.getByLabel('Your draft').fill('m15-app-failure-isolation-canary');

  const crashStudio = async () => {
    await app.evaluate(({ webContents }) => {
      const target = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('dental-fixture://alpha/'));
      if (!target) throw new Error('Motion Studio guest renderer was not found');
      target.forcefullyCrashRenderer();
    });
    await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'failed'), 'Motion Studio crash containment');
  };

  await studio.getByLabel('Your draft').fill('m15-app-crash-private-draft');
  await crashStudio();
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.getByRole('heading', { name: 'App stopped', exact: true }).waitFor();
  const shellState = await shell.evaluate(async () => ({
    status: await window.desktop.status(),
    identity: await window.desktop.identity.view(),
    appStoreAvailable: [...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'App Store'),
    failedPhase: document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase,
    recordsPhase: document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase,
  }));
  check('a crashed app renderer is contained while shell, Store and session stay ready', shellState.status.phase === 'ready' && shellState.identity.phase === 'ready' && shellState.appStoreAvailable && shellState.failedPhase === 'failed' && shellState.recordsPhase === 'ready');
  check('another isolated app keeps its renderer and private draft separate', await records.getByLabel('Your draft').inputValue() === 'm15-app-failure-isolation-canary');

  for (let failure = 2; failure <= 3; failure++) {
    await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
    await shell.getByRole('button', { name: 'Restart app', exact: true }).click();
    await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready'), `Motion Studio recovery ${failure - 1}`);
    studio = guest('alpha');
    assert.ok(studio, 'Motion Studio renderer restarted');
    await crashStudio();
  }

  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.getByRole('button', { name: 'Restart app', exact: true }).click();
  await shell.getByText('This app failed repeatedly. Wait one minute before trying again.', { exact: false }).waitFor();
  check('three renderer failures pause further app restarts', await shell.getByRole('button', { name: 'Restart app', exact: true }).count() === 0);

  await shell.getByRole('button', { name: 'Close Motion Studio', exact: true }).click();
  await wait(() => shell.evaluate(() => document.querySelector('[data-window-id="studio"]')?.dataset.phase === 'closed'), 'closing the failed app window');
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimeReason === 'restart-limit'), 'restart cooldown after close and reopen');
  check('closing and reopening cannot bypass the app crash-loop limit', await shell.getByRole('button', { name: 'Restart app', exact: true }).count() === 0);
  check('the shell and unaffected Records app remain available after app recovery is paused', (await shell.evaluate(() => window.desktop.status())).phase === 'ready' && await records.getByLabel('Your draft').isVisible());

  await app.evaluate(({ webContents }) => {
    const target = webContents.getAllWebContents().find(contents => contents.getURL().startsWith('dental-fixture://beta/'));
    if (!target) throw new Error('Records guest renderer was not found');
    void target.executeJavaScript('while (true) {}').catch(() => {});
  });
  await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'unresponsive'), 'the app hang watchdog', 35000);
  check('a hung app is isolated as unresponsive while shell and identity services stay ready', (await shell.evaluate(async () => ({ shell: await window.desktop.status(), identity: await window.desktop.identity.view() }))).shell.phase === 'ready' && (await shell.evaluate(() => window.desktop.identity.view())).phase === 'ready');
  await shell.getByRole('button', { name: 'Records', exact: true }).click();
  await shell.getByRole('heading', { name: 'App is not responding', exact: true }).waitFor();
  await shell.getByRole('button', { name: 'Restart app', exact: true }).click();
  await wait(() => shell.evaluate(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'ready'), 'Records manual recovery');
  check('the user can restart a hung app without restarting the shell', (await shell.evaluate(() => window.desktop.status())).phase === 'ready' && guest('beta') !== undefined);
} finally {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/m15-app-failure-containment-verification.json'), JSON.stringify({ checks, platform: process.platform }, null, 2) + '\n');
}
