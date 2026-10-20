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

  try {
    app = await electron.launch({ args: [process.cwd(), ...args], env, timeout: 30000 });
    const page = await app.firstWindow();
    page.setDefaultTimeout(30000);
    await page.waitForFunction(() => document.querySelectorAll('[data-dock-app]').length >= 16);
    const store = await page.evaluate(() => window.desktop.store.action('view', undefined, 1));
    check('all 16 signed synthetic company apps are installed before opening', store.apps.filter(item => !!item.installedVersion).length === 16);
    await page.waitForFunction(() => document.querySelectorAll('[data-window-id^="company.resource.app-"]').length === 14);

    for (const item of apps) {
      await page.locator(`[data-dock-app="${item.id}"]`).click({ force: true });
      await page.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', item.id);
    }
    check('the configured limit opens and health-checks all 16 isolated app views', await page.locator('[data-runtime-phase="ready"]').count() === 16);
    await new Promise(resolve => setTimeout(resolve, 3000));
    for (let index = 0; index < 5; index++) {
      if (index) await new Promise(resolve => setTimeout(resolve, 15000));
      const item = apps[index % apps.length];
      await page.locator(`[data-dock-app="${item.id}"]`).click({ force: true });
      samples.push(await snapshot());
    }
    check('16 app views stay live for the full 60-second sample', samples.every(sample => sample.appViews === 16 && sample.processCount >= 16) && samples.at(-1).time - samples[0].time >= 60000);
    check('all app views remain health-checked through the sample', await page.locator('[data-runtime-phase="ready"]').count() === 16);

    for (const item of apps) {
      await page.locator(`[data-dock-app="${item.id}"]`).click({ force: true });
      await page.getByRole('button', { name: `Close ${item.title}`, exact: true }).click();
    }
    await page.waitForFunction(() => document.querySelectorAll('[data-window-id][data-phase="closed"]').length >= 16);
    const closed = await app.evaluate(({ webContents }) => webContents.getAllWebContents().filter(contents => contents.getURL().startsWith('dental-fixture:')).length);
    check('closing all 16 apps releases all isolated app views', closed === 0);
    passed = true;
  } catch (error) {
    console.error(error.message);
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
        appCount: apps.length,
        platform: process.platform,
        source: process.env.GITHUB_SHA ?? null,
        scope: 'Sixteen installed and simultaneously open capability-free synthetic company apps; 60-second idle/foreground-switch sample. Measures Electron aggregate working set/processes and view cleanup; not a clinical workload or physical-device soak.',
      }, null, 2));
    }
  }
}
