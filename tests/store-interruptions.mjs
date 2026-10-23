import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [process.cwd(), ...profileArgs, '--distribution-fixtures', '--update-fixtures'], env });
const checks = [];
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS ' + name); };
try {
  const page = await app.firstWindow(); page.setDefaultTimeout(15000);
  const store = page.locator('[data-window-id="store"]');
  const install = async title => {
    await page.getByRole('button', { name: 'App Store', exact: true }).click();
    const back = store.getByRole('button', { name: 'Back', exact: true }); if (await back.isEnabled()) await back.click();
    await store.getByRole('button', { name: 'Details ' + title, exact: true }).click();
    await store.getByRole('button', { name: 'Get', exact: true }).click(); await page.locator('.store-arrival').waitFor();
  };
  await install('Records');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 900, height: 650, deviceScaleFactor: 1, mobile: false });
  await page.locator('.store-celebration').waitFor({ state: 'detached' });
  check('viewport resize settles verified-package flight and restores source/dock', await page.locator('.store-source-separated').count() === 0 && await page.locator('[data-dock-app="records"]').isVisible());
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await install('Motion Studio'); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('.store-celebration').waitFor({ state: 'detached' });
  check('enabling reduced motion during verified-package flight settles safely', await page.locator('.store-source-separated').count() === 0 && await page.locator('[data-dock-app="studio"]').isVisible());
  await fs.writeFile('artifacts/store-interruptions-verification.json', JSON.stringify({ source: process.env.GITHUB_SHA, platform: process.platform, checks, passed: true, scope: 'Private signed package Store fixture; no staging or live desktop.' }, null, 2));
} finally { await app.close(); }
