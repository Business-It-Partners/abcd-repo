import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';

const resourceApps = Array.from({ length: 14 }, (_, index) => {
  const suffix = String(index + 1).padStart(2, '0');
  const id = `company.resource.app-${suffix}`;
  return { id, title: id };
});
const apps = [{ id: 'studio', title: 'Motion Studio' }, { id: 'records', title: 'Records' }, ...resourceApps];

export async function verifyRuntimeLimitResources(args, report) {
  let app, passed = false;
  const checks = [], samples = [];
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const check = (name, value = true) => {
    assert.ok(value, name);
    checks.push(name);
    console.log('PASS', name);
  };
  const snapshot = () => app.evaluate(({ app, webContents }) => {
    const metrics = app.getAppMetrics();
    return {
      time: Date.now(),
      processCount: metrics.length,
      processes: metrics.map(row => ({ pid: row.pid, type: row.type, workingSetKiB: row.memory.workingSetSize })),
      aggregateWorkingSetKiB: metrics.reduce((sum, row) => sum + row.memory.workingSetSize, 0),
      appViews: webContents.getAllWebContents().filter(contents => contents.getURL().startsWith('dental-fixture:')).length,
    };
  });
  const waitForAppViews = async expected => {
    const deadline = Date.now() + 15000;
    let current = await snapshot();
    while (current.appViews !== expected && Date.now() < deadline) {
      await new Promise(resolve => setTimeout(resolve, 100));
      current = await snapshot();
    }
    assert.equal(current.appViews, expected, `expected ${expected} isolated app views to remain`);
    return current.appViews;
  };

  try {
    app = await electron.launch({ args: [process.cwd(), ...args], env, timeout: 30000 });
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await page.waitForFunction(() => document.querySelectorAll('[data-dock-app]').length >= 16);
    const store = await page.evaluate(() => window.desktop.store.action('view', undefined, 1));
    check('all 16 signed synthetic company apps are installed before opening', store.apps.filter(item => !!item.installedVersion).length === 16);
    await page.waitForFunction(() => document.querySelectorAll('[data-window-id^="company.resource.app-"]').length === 14);

    const openApp = async item => {
      await page.locator(`[data-dock-app="${item.id}"]`).click({ force: true });
      await page.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', item.id, { timeout: 30000 });
    };
    const closeOpenApps = async () => {
      while (await page.locator('[data-window-id][data-phase="visible"]').count()) {
        const topmost = await page.evaluate(() => [...document.querySelectorAll('[data-window-id][data-phase="visible"]')]
          .sort((a, b) => Number.parseInt(getComputedStyle(b).zIndex, 10) - Number.parseInt(getComputedStyle(a).zIndex, 10))[0]?.getAttribute('data-window-id'));
        assert.ok(topmost, 'a visible managed window should have a window id');
        const title = apps.find(item => item.id === topmost)?.title ?? topmost;
        await page.locator(`[data-window-id="${topmost}"]`).getByRole('button', { name: `Close ${title}`, exact: true }).click();
        await page.waitForFunction(id => document.querySelector(`[data-window-id="${id}"]`)?.dataset.phase === 'closed', topmost, { timeout: 15000 });
      }
    };

    for (const item of apps.slice(0, 2)) await openApp(item);
    check('the platform opens and health-checks its maximum of two isolated app views', await page.locator('[data-runtime-phase="ready"]').count() === 2);
    await page.locator(`[data-dock-app="${apps[2].id}"]`).click({ force: true });
    const capacityDialog = page.getByRole('alertdialog', { name: 'Only two apps can be open at a time' });
    await capacityDialog.waitFor({ state: 'visible' });
    check('the third app is held behind the visible app-capacity choice', await page.locator('[data-runtime-phase="ready"]').count() === 2);
    await capacityDialog.getByRole('button', { name: 'Cancel', exact: true }).click();

    const sampleDuration = Number(process.env.DENTAL_RESOURCE_SAMPLE_MS ?? 60000);
    await new Promise(resolve => setTimeout(resolve, Math.min(3000, Math.floor(sampleDuration / 20))));
    for (let index = 0; index < 5; index++) {
      if (index) await new Promise(resolve => setTimeout(resolve, Math.floor(sampleDuration / 4)));
      const item = apps[index % 2];
      await page.locator(`[data-dock-app="${item.id}"]`).click({ force: true });
      samples.push(await snapshot());
    }
    check(`two app views stay live for the full ${sampleDuration / 1000}-second maximum-window sample`, samples.every(sample => sample.appViews === 2) && samples.at(-1).time - samples[0].time >= sampleDuration);
    check('both maximum-count app views remain health-checked through the sample', await page.locator('[data-runtime-phase="ready"]').count() === 2);

    await closeOpenApps();
    await page.waitForFunction(() => document.querySelectorAll('[data-window-id][data-phase="closed"]').length >= 16);
    let closed = await waitForAppViews(0);
    check('closing both maximum-count apps releases all isolated app views', closed === 0);

    for (let index = 2; index < apps.length; index += 2) {
      const pair = apps.slice(index, index + 2);
      for (const item of pair) await openApp(item);
      check(`installed app pair ${index + 1}-${index + 2} opens within the two-window limit`, await page.locator('[data-runtime-phase="ready"]').count() === 2);
      check(`installed app pair ${index + 1}-${index + 2} creates two isolated app views`, await snapshot().then(sample => sample.appViews === 2));
      await closeOpenApps();
      closed = await waitForAppViews(0);
      check(`installed app pair ${index + 1}-${index + 2} releases both views after close`, closed === 0);
    }
    passed = true;
  } catch (error) {
    console.error(error.message);
    const windows = await app?.firstWindow().then(page => page.evaluate(() => [...document.querySelectorAll('[data-window-id]')].map(frame => ({
      id: frame.getAttribute('data-window-id'), phase: frame.getAttribute('data-phase'), active: frame.getAttribute('data-active'),
      zIndex: getComputedStyle(frame).zIndex, inert: frame.hasAttribute('inert'), ariaHidden: frame.getAttribute('aria-hidden'),
      closeDisabled: frame.querySelector('.window-control-close')?.matches(':disabled'),
      closeReceiver: (() => { const button = frame.querySelector('.window-control-close'), rect = button?.getBoundingClientRect(); return rect && document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2)?.outerHTML.slice(0, 180); })(),
    })))).catch(() => undefined);
    if (windows) console.error('managed window state', JSON.stringify(windows));
    process.exitCode = 1;
  } finally {
    if (app) {
      const final = await snapshot().catch(() => undefined);
      await app.close();
      await fs.mkdir('artifacts', { recursive: true });
      await fs.writeFile(path.join('artifacts', report), JSON.stringify({
        passed,
        checks,
        samples,
        final,
        installedAppCount: apps.length,
        concurrentAppLimit: 2,
        platform: process.platform,
        source: process.env.GITHUB_SHA ?? null,
        scope: 'Sixteen installed capability-free synthetic company apps; verifies the two-window product limit and exercises all apps in pairs. The 60-second idle/foreground-switch sample runs at the maximum concurrent app count. Measures Electron aggregate working set, processes and view cleanup; not a clinical workload or physical-device soak.',
      }, null, 2));
    }
  }
}
