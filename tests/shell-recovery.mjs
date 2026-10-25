import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profile, profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const checks = [];
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const diagnosticFile = path.join(profile, 'diagnostics', 'events.json');
const diagnosticEvents = async () => { try { return JSON.parse(await fs.readFile(diagnosticFile, 'utf8')); } catch { return []; } };
const app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures'], env, timeout: 30000 });
try {
  const findShellPage = () => app.windows().find(page => {
    try { return new URL(page.url()).pathname.endsWith('/dist/index.html'); } catch { return false; }
  });
  let shell = findShellPage();
  const shellDeadline = Date.now() + 30000;
  while (!shell && Date.now() < shellDeadline) {
    await new Promise(resolve => setTimeout(resolve, 100));
    shell = findShellPage();
  }
  assert.ok(shell, 'Sajilo Dental shell page loaded');
  shell.setDefaultTimeout(20000);
  shell.on('crash', () => console.log('EVENT shell page crashed'));
  shell.on('domcontentloaded', () => console.log('EVENT shell page loaded'));
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).waitFor();
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  let guest = app.context().pages().find(page => page.url().startsWith('dental-fixture://alpha/'));
  assert.ok(guest, 'Motion Studio guest renderer is open');
  await guest.getByLabel('Your draft').fill('m15-shell-recovery-canary');
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'visible');

  const shellProbe = () => app.evaluate(async ({ BrowserWindow }) => {
    const host = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Sajilo Dental');
    if (!host) throw new Error('Sajilo Dental host window was not found');
    return Promise.race([
      host.webContents.executeJavaScript(`(async () => {
        const status = await window.desktop.status();
        const identity = await window.desktop.identity.view();
        return {
          origin: performance.timeOrigin,
          phase: status.phase,
          identityPhase: identity.phase,
          storePhase: document.querySelector('[data-window-id="store"]')?.dataset.phase,
          studioPhase: document.querySelector('[data-window-id="studio"]')?.dataset.phase,
          storeButton: [...document.querySelectorAll('button')].some(button => button.getAttribute('aria-label') === 'App Store'),
        };
      })()`),
      new Promise(resolve => setTimeout(() => resolve({ probeTimeout: true }), 5000)),
    ]);
  });
  const waitForShellReload = async (priorTimeOrigin, timeoutMs = 35000) => {
    const before = await diagnosticEvents();
    const recoveredCount = before.filter(event => event.code === 'shell-recovered').length;
    const requiredCount = before.filter(event => event.code === 'shell-recovery-required').length;
    const deadline = Date.now() + timeoutMs;
    let events = [];
    let state;
    while (Date.now() < deadline) {
      events = await diagnosticEvents();
      if (events.filter(event => event.code === 'shell-recovery-required').length > requiredCount) throw new Error('Automatic shell recovery exhausted its retry budget: ' + JSON.stringify(events));
      if (events.filter(event => event.code === 'shell-recovered').length > recoveredCount) {
        state = await shellProbe();
        if (!state.probeTimeout && state.phase === 'ready' && state.storePhase === 'visible' && state.studioPhase === 'visible') break;
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    assert.ok(events.filter(event => event.code === 'shell-recovered').length > recoveredCount, 'main process records a new shell recovery within the bounded deadline: ' + JSON.stringify(events));
    console.log('PASS main process recorded shell recovery');
    assert.ok(state && !state.probeTimeout && state.phase === 'ready', 'recovered shell renderer responds to its main-process bridge: ' + JSON.stringify(state));
    assert.notEqual(state.origin, priorTimeOrigin, 'shell reload creates a fresh renderer document');
    assert.equal(state.storeButton, true, 'Store controls return inside the recovered shell');
    guest = app.context().pages().find(page => page.url().startsWith('dental-fixture://alpha/'));
    assert.ok(guest && !guest.isClosed(), 'native app renderer remains alive through shell reload');
    check('shell reload restores the open Store/app layout and keeps the guest renderer alive');
    check('the guest app draft remains inside its isolated renderer', await guest.getByLabel('Your draft').inputValue() === 'm15-shell-recovery-canary');
    return state;
  };
  const crashShell = async () => {
    const prior = (await shellProbe()).origin;
    console.log('REQUEST shell renderer crash');
    await app.evaluate(({ BrowserWindow }) => {
      const host = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Sajilo Dental');
      if (!host) throw new Error('Sajilo Dental host window was not found');
      host.webContents.forcefullyCrashRenderer();
    });
    console.log('RETURN shell renderer crash request');
    return waitForShellReload(prior);
  };

  check('main-process identity/session services are available before failure', (await shell.evaluate(() => window.desktop.identity.view())).phase === 'ready');
  await crashShell();

  let prior = (await shellProbe()).origin;
  await app.evaluate(({ BrowserWindow }) => {
    const host = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Sajilo Dental');
    if (!host) throw new Error('Sajilo Dental host window was not found');
    void host.webContents.executeJavaScript('while(true){}').catch(() => {});
  });
  const hangRecovery = await waitForShellReload(prior, 35000);
  check('a hung shell renderer is detected and reloaded while main-process session authority remains ready', hangRecovery.phase === 'ready' && hangRecovery.identityPhase === 'ready');

  await crashShell();
  const recoveryRetryOrigin = (await shellProbe()).origin;
  const recoveryPagePromise = app.waitForEvent('window', { timeout: 20000 });
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Sajilo Dental')?.webContents.forcefullyCrashRenderer());
  const recoveryPage = await recoveryPagePromise;
  await recoveryPage.getByRole('heading', { name: 'Desktop shell needs recovery', exact: true }).waitFor();
  check('repeated shell failures stop automatic reloads and show an OS recovery surface');
  await recoveryPage.getByRole('button', { name: 'Retry desktop', exact: true }).click();
  const retryState = await waitForShellReload(recoveryRetryOrigin);
  check('the recovery surface provides a manual retry after bounded automatic recovery');
  check('recovered desktop exposes Store controls and the identity service', retryState.storeButton && retryState.identityPhase === 'ready');
} finally {
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/m15-shell-recovery-verification.json'), JSON.stringify({ checks, platform: process.platform }, null, 2) + '\n');
}
