import { fixtureArgs as profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, ...profileArgs, '--force-device-scale-factor=2'], env });
const page = await app.firstWindow();
const result = { checks: [] };
try {
  const bounds = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
  await page.waitForFunction(b => innerWidth === b.width && innerHeight === b.height, bounds);
  assert.ok(await app.evaluate(({ BrowserWindow, screen }) => {
    const window = BrowserWindow.getAllWindows()[0];
    const actual = window.getBounds(), expected = screen.getPrimaryDisplay().bounds;
    return window.isFullScreen() && !window.isMinimized() &&
      ['x', 'y', 'width', 'height'].every(key => actual[key] === expected[key]);
  }));
  result.checks.push('Full display coverage at devicePixelRatio 2, including host dock/taskbar area');
  await page.getByRole('button', { name: 'Motion Studio', exact: true }).click();
  const dpr = await page.evaluate(() => devicePixelRatio); assert.equal(dpr, 2); result.devicePixelRatio = dpr;
  await page.locator('#note').fill('High DPI proof');
  await page.getByRole('button', { name: 'Minimize Motion Studio', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main').dataset.phase === 'minimized');
  const stats = await page.evaluate(() => window.motionStats); assert.ok(stats.frames > 10); result.performance = stats;
  await page.getByRole('button', { name: 'Restore Motion Studio', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main').dataset.phase === 'visible');
  assert.equal(await page.locator('#note').inputValue(), 'High DPI proof'); result.checks.push('Native capture and WebGL round-trip at devicePixelRatio 2');
  const denied = await page.evaluate(async () => { try { await window.desktop.capture({ x: -1, y: 0, width: 40, height: 40 }); return false; } catch { return true; } });
  assert.ok(denied); result.checks.push('Native snapshot rejects out-of-bounds capture');
  await page.screenshot({ path: path.join(root, 'artifacts/high-dpi.png') });
  await page.getByRole('button', { name: 'Minimize Motion Studio', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main').dataset.phase === 'minimized');
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 950, height: 660, deviceScaleFactor: 2, mobile: false });
  await page.waitForFunction(() => innerWidth === 950);
  await page.getByRole('button', { name: 'Restore Motion Studio', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('main').dataset.phase === 'visible');
  assert.equal(await page.locator('#note').inputValue(), 'High DPI proof'); result.checks.push('Minimized display-size change restores session state safely');
  assert.ok(await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isFullScreen())); result.checks.push('Environment remains fullscreen through internal transitions');
  await fs.writeFile(path.join(root, 'artifacts/scaling-verification.json'), JSON.stringify(result, null, 2) + '\n');
  console.log('PASS', result);
} finally { await app.close(); }
