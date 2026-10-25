import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const sourceFiles = [
  'electron/main.ts', 'electron/host/resourcePressure.ts', 'electron/preload.ts',
  'electron/runtime/contracts.ts', 'electron/runtime/manager.ts', 'src/App.tsx',
  'src/RuntimeFixtures.tsx', 'src/global.d.ts', 'src/style.css', 'package.json',
  'tests/resourcePressure.test.ts', 'tests/resource-pressure.mjs',
];
const sourceIdentity = {
  gitHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  sha256: Object.fromEntries(sourceFiles.map(file => [file, createHash('sha256').update(readFileSync(path.join(root, file))).digest('hex')])),
};
const checks = [];
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const wait = async (predicate, label, timeoutMs = 30000) => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try { if (await predicate()) return; } catch { /* wait through renderer replacement */ }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${label}`);
};

const app = await electron.launch({
  args: [root, ...profileArgs, '--runtime-fixtures', '--resource-pressure-fixtures'],
  env,
  timeout: 30000,
});
let samples = {};
let passed = false;
try {
  const findShell = () => app.windows().find(page => {
    try { return new URL(page.url()).pathname.endsWith('/dist/index.html'); } catch { return false; }
  });
  let shell = findShell();
  await wait(() => (shell = findShell()) !== undefined, 'the desktop shell');
  shell.setDefaultTimeout(20000);
  await shell.getByRole('button', { name: 'Motion Studio', exact: true }).waitFor();
  await shell.evaluate(() => {
    window.__m15ResourceEvents = [];
    window.desktop.resourcePressure.subscribe(value => window.__m15ResourceEvents.push(value));
    window.__m15ResourceOrder = [];
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'childList' && [...record.removedNodes].some(node => node instanceof HTMLElement && (node.matches('.store-body') || !!node.querySelector('.store-body')))) window.__m15ResourceOrder.push('store-content-unmounted');
        if (record.type === 'attributes' && record.target instanceof HTMLElement && record.target.matches('[data-runtime="studio"]') && record.target.dataset.runtimePhase === 'suspended') window.__m15ResourceOrder.push('studio-renderer-paused');
      }
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-runtime-phase'] });
  });

  const guest = host => app.context().pages().find(page => !page.isClosed() && page.url().startsWith(`dental-fixture://${host}/`));
  const snapshot = () => app.evaluate(({ app: electronApp, webContents }) => {
    const guests = webContents.getAllWebContents().filter(contents => contents.getURL().startsWith('dental-fixture://'));
    const pids = [...new Set(guests.map(contents => contents.getOSProcessId()))];
    const metrics = electronApp.getAppMetrics();
    return {
      time: Date.now(),
      system: process.getSystemMemoryInfo(),
      guestCount: guests.length,
      guestPids: pids,
      guestWorkingSetKiB: pids.reduce((sum, pid) => sum + (metrics.find(metric => metric.pid === pid)?.memory.workingSetSize ?? 0), 0),
      allAppWorkingSetKiB: metrics.reduce((sum, metric) => sum + metric.memory.workingSetSize, 0),
      appProcessCount: metrics.length,
    };
  });
  const injectCriticalPressure = () => app.evaluate(({ ipcMain, BrowserWindow }) => {
    const host = BrowserWindow.getAllWindows().find(win => win.getTitle() === 'Sajilo Dental');
    if (!host) throw new Error('The shell host window was not found');
    ipcMain.emit('resource:pressure-fixture', { sender: host.webContents, senderFrame: host.webContents.mainFrame }, 'critical');
  });

  // Phase 1 uses the two available window slots for App Store + one clean app.
  await shell.getByRole('button', { name: 'Open apps catalog', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'visible');
  await shell.locator('[data-dock-app="studio"]').click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  check('App Store and one app can be open together before cleanup', await shell.evaluate(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'visible' && document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready'));
  samples.storeAndAppBefore = await snapshot();
  check('the clean app renderer is measured before cleanup', samples.storeAndAppBefore.guestCount === 1 && samples.storeAndAppBefore.guestPids.length === 1);

  await injectCriticalPressure();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'closed');
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'suspended');
  await wait(async () => (await snapshot()).guestCount === 0, 'the clean app renderer to exit');
  await shell.waitForFunction(() => window.__m15ResourceEvents.some(event => event.phase === 'complete'));
  samples.storeAndAppAfter = await snapshot();
  samples.reclamationOrder = await shell.evaluate(() => window.__m15ResourceOrder);
  await shell.waitForFunction(() => document.querySelector('.resource-pressure-notice')?.textContent?.includes('closed the App Store and paused 1 app'));
  check('pressure unmounts App Store content and releases the clean app renderer', samples.storeAndAppAfter.guestCount === 0 && await shell.evaluate(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'closed' && document.querySelector('[data-window-id="store"] .store-body') === null && document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'suspended'));
  check('App Store content is released before the eligible app renderer is paused', samples.reclamationOrder.indexOf('store-content-unmounted') >= 0 && samples.reclamationOrder.indexOf('studio-renderer-paused') > samples.reclamationOrder.indexOf('store-content-unmounted'));
  check('shell explains that Store and app content were closed to free memory');
  check('the shell and session authority stay available during cleanup', (await shell.evaluate(async () => ({ shell: await window.desktop.status(), identity: await window.desktop.identity.view() }))).shell.phase === 'ready' && (await shell.evaluate(() => window.desktop.identity.view())).phase === 'ready');

  await shell.getByTestId('resource-paused').getByRole('button', { name: 'Reopen app', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready');
  check('the user can reopen an app after memory cleanup', (await snapshot()).guestCount === 1);
  await shell.getByRole('button', { name: 'Open apps catalog', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'visible');
  await shell.locator('[data-window-id="store"] .store-body').waitFor();
  check('the App Store can be reopened after its content was released');
  await shell.getByRole('button', { name: 'Close App Store', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'closed');

  // Phase 2 fills both app slots and proves a dirty app is protected while a clean one is reclaimed.
  const studio = guest('alpha');
  assert.ok(studio, 'reopened Motion Studio guest renderer is present');
  await studio.getByLabel('Your draft').fill('m15-resource-pressure-unsaved-canary');
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.dirty === 'true');
  await shell.locator('[data-dock-app="records"]').click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'ready');
  samples.twoAppsBefore = await snapshot();
  check('two isolated app renderers are measured before the unsaved-work check', samples.twoAppsBefore.guestCount === 2 && samples.twoAppsBefore.guestPids.length === 2);

  await injectCriticalPressure();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'suspended');
  await shell.waitForFunction(() => window.__m15ResourceEvents.filter(event => event.phase === 'complete').length === 2);
  await shell.waitForFunction(() => document.querySelector('.resource-pressure-notice')?.textContent?.includes('left open because work may be unsaved or saving.'));
  await wait(async () => (await snapshot()).guestCount === 1, 'the eligible app renderer to exit');
  samples.twoAppsAfter = await snapshot();
  samples.pressureEvents = await shell.evaluate(() => window.__m15ResourceEvents);
  check('unsaved work keeps the dirty app open while the clean app is paused', await shell.evaluate(() => document.querySelector('[data-runtime="studio"]')?.dataset.runtimePhase === 'ready' && document.querySelector('[data-runtime="studio"]')?.dataset.dirty === 'true') && await studio.getByLabel('Your draft').inputValue() === 'm15-resource-pressure-unsaved-canary');
  check('the clean renderer is released and offers a reopen action', samples.twoAppsAfter.guestCount === 1 && await shell.getByTestId('resource-paused').getByRole('button', { name: 'Reopen app', exact: true }).isEnabled());
  check('pressure reports a protected app as skipped', samples.pressureEvents.filter(event => event.phase === 'complete').at(-1)?.skippedUnsavedCount === 1);
  check('shell explains why the unsaved app remains open');
  await shell.getByTestId('resource-paused').getByRole('button', { name: 'Reopen app', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-runtime="records"]')?.dataset.runtimePhase === 'ready');
  check('the paused clean app can be reopened after the cleanup pass', (await snapshot()).guestCount === 2);

  samples.pressureEvents = await shell.evaluate(() => window.__m15ResourceEvents);
  check('both cleanup passes report prepare and completion', samples.pressureEvents.filter(event => event.phase === 'prepare').length === 2 && samples.pressureEvents.filter(event => event.phase === 'complete').length === 2);
  passed = true;
} finally {
  await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
  await app.close().catch(() => {});
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/m15-resource-pressure-verification.json'), JSON.stringify({
    passed,
    checks,
    samples,
    sourceIdentity,
    platform: process.platform,
    source: process.env.GITHUB_SHA ?? null,
    thresholds: { warningAvailable: 'max(768 MiB, 15% of system RAM), capped at 25%', criticalAvailable: 'max(384 MiB, 8% of system RAM), capped at 12%', warningGuestWorkingSet: 'max(512 MiB, 12% of system RAM), capped at 1.5 GiB', criticalGuestWorkingSet: 'max(768 MiB, 20% of system RAM), capped at 2 GiB', ordinaryPressureSamples: 2, recoverySamples: 3 },
    scope: 'Private Linux fixture: critical pressure is injected through a test-only main-process hook; host memory and guest working sets are sampled before/after. Dirty and saving apps remain protected. This is not physical-device low-memory certification.',
  }, null, 2) + '\n');
}
