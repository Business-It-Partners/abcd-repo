import { fixtureArgs as profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const args = [root, ...profileArgs, ...(process.env.PROTOTYPE_NO_SANDBOX === '1' ? ['--no-sandbox'] : [])];
const application = await electron.launch({ args, env, timeout: 30000 });
const page = await application.firstWindow();
const errors = [];
page.on('pageerror', e => errors.push(e.message));
const evidence = { date: new Date().toISOString(), platform: process.platform, checks: [], performance: [] };
const check = (name, value = true) => { assert.ok(value, name); evidence.checks.push(name); console.log('PASS', name); };
const phase = value => page.waitForFunction(p => document.querySelector('main')?.dataset.phase === p, value);
const open = async () => { await page.getByRole('button', { name: 'Motion Studio', exact: true }).click(); await phase('visible'); };
const minimize = async () => { await page.getByRole('button', { name: 'Minimize Motion Studio', exact: true }).click(); await phase('minimized'); };
const restore = async () => { await page.getByRole('button', { name: 'Restore Motion Studio', exact: true }).click(); await phase('visible'); };
try {
  await page.getByRole('navigation', { name: 'Application dock' }).waitFor();
  check('Electron launched with isolated preload bridge', await page.evaluate(() => !!window.desktop && typeof window.require === 'undefined'));
  const displayBounds = await application.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
  await page.waitForFunction(b => innerWidth === b.width && innerHeight === b.height, displayBounds);
  check('Environment opens fullscreen at actual display dimensions', await application.evaluate(({ BrowserWindow, screen }) => {
    const w = BrowserWindow.getAllWindows()[0], bounds = w.getBounds(), display = screen.getPrimaryDisplay().bounds;
    return w.isFullScreen() && !w.isMinimized() &&
      bounds.x === display.x && bounds.y === display.y &&
      bounds.width === display.width && bounds.height === display.height;
  }));
  check('Environment bar is removed and system controls live in the dock', await page.locator('.system-bar,.host-controls,.bar-reveal-edge').count() === 0 && await page.getByRole('button', { name: 'Minimize Electron OS', exact: true }).count() === 1);
  evidence.environment = await application.evaluate(({ app, screen }) => ({ electron: process.versions.electron, chrome: process.versions.chrome, node: process.versions.node, app: app.getVersion(), display: screen.getPrimaryDisplay() }));
  await page.mouse.move(30, 70);
  await page.waitForFunction(() => Math.abs(document.querySelector('.dock-icon').getBoundingClientRect().width - 36) < .1);
  check('Dock surface touches the bottom screen edge', await page.locator('.dock-pill').evaluate(e => Math.abs(e.getBoundingClientRect().bottom - innerHeight) < 1));
  await page.screenshot({ path: path.join(root, 'artifacts/desktop.png') });
  const icon = page.getByRole('button', { name: 'Motion Studio', exact: true });
  await icon.hover();
  await page.waitForFunction(() => document.querySelector('.dock-icon.coral').getBoundingClientRect().width > 36 * 1.8);
  const enlarged = await icon.boundingBox(); check('Bell-curve hover magnifies the dock', enlarged.width > 36 * 1.8);
  await page.screenshot({ path: path.join(root, 'artifacts/dock-hover.png') });
  await page.mouse.move(30, 70);
  await page.waitForFunction(() => Math.abs(document.querySelector('.dock-icon').getBoundingClientRect().width - 36) < .1);
  check('Dock returns to baseline', Math.abs((await icon.boundingBox()).width - 36) < .1);
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  for (let x = viewport.width / 2 - 250; x <= viewport.width / 2 + 250; x += 40) await page.mouse.move(x, viewport.height - 50);
  await page.mouse.move(30, 70); await page.waitForTimeout(350);
  check('Rapid dock pointer sweeps settle without errors', errors.length === 0);
  await open();
  await page.locator('#note').fill('Preserved through the Genie journey');
  await page.getByTestId('increment').click(); await page.getByTestId('increment').click();
  await page.mouse.move(30, 70); await page.screenshot({ path: path.join(root, 'artifacts/studio.png') });
  await page.getByRole('button', { name: 'Minimize Motion Studio', exact: true }).click();
  await page.waitForFunction(() => window.motionStats?.active && window.motionStats.frames >= 10);
  await page.screenshot({ path: path.join(root, 'artifacts/genie-midpoint.png') });
  await phase('minimized');
  const stats = await page.evaluate(() => window.motionStats);
  check('Real snapshot uses a WebGL mesh', stats?.frames > 10 && !stats.active);
  evidence.performance.push(stats);
  check('Native capture provides persistent dock thumbnail', await page.getByAltText('Motion Studio snapshot', { exact: true }).count() === 1);
  await restore();
  check('Counter and note survive minimize/restore', await page.getByTestId('counter').textContent() === '2' && await page.locator('#note').inputValue() === 'Preserved through the Genie journey');
  evidence.performance.push(await page.evaluate(() => window.motionStats));
  for (let i = 0; i < 5; i++) {
    await minimize(); evidence.performance.push({ ...await page.evaluate(() => window.motionStats), measurement: 'No screenshots during animation' });
    await restore(); evidence.performance.push({ ...await page.evaluate(() => window.motionStats), measurement: 'No screenshots during animation' });
  }
  check('Five repeated cycles preserve state without accumulating overlays', await page.locator('canvas').count() === 12 && await page.getByTestId('counter').textContent() === '2');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await minimize(); await restore(); check('Reduced motion uses direct transitions');
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => { document.querySelector('canvas').getContext('webgl').getExtension('WEBGL_lose_context').loseContext(); });
  await page.waitForTimeout(50); await minimize(); await restore();
  check('Unavailable WebGL falls back to usable direct transitions');
  await page.reload(); await open();
  await page.getByRole('button', { name: 'Minimize Motion Studio', exact: true }).click();
  await page.waitForFunction(() => window.motionStats?.active);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 700, deviceScaleFactor: 1, mobile: false });
  await phase('visible'); check('Display-size change interrupts animation safely');
  await minimize(); await restore(); check('Genie works after resize');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.waitForFunction(v => innerWidth === v.width, viewport);
  const normal = await page.getByTestId('studio-window').boundingBox();
  await page.getByRole('button', { name: 'Maximize Motion Studio', exact: true }).click();
  const expanded = await page.getByTestId('studio-window').boundingBox();
  check('Internal maximize expands only the app window', expanded.width > normal.width && expanded.height >= normal.height);
  await minimize();
  check('Internal minimize keeps environment fullscreen', await application.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return w.isFullScreen() && !w.isMinimized(); }));
  await restore();
  check('Maximized window restores through Genie at the same size', Math.abs((await page.getByTestId('studio-window').boundingBox()).width - expanded.width) < 1);
  await page.getByRole('button', { name: 'Restore Motion Studio size', exact: true }).click();
  check('Internal restore returns to the prior rectangle', Math.abs((await page.getByTestId('studio-window').boundingBox()).width - normal.width) < 1);
  await page.getByRole('button', { name: 'Close Motion Studio', exact: true }).click(); await phase('closed');
  check('Internal close returns to desktop');
  const minimizeButton = page.getByRole('button', { name: 'Minimize Electron OS', exact: true });
  const shutdownButton = page.getByRole('button', { name: 'Shut down Electron OS', exact: true });
  check('Dock exposes two distinct environment controls without a menu', await minimizeButton.count() === 1 && await shutdownButton.count() === 1 && await page.getByRole('menu').count() === 0 && await page.getByRole('button', { name: 'Electron OS menu', exact: true }).count() === 0);
  await minimizeButton.focus(); await page.keyboard.press('Tab');
  check('Keyboard users can reach the shutdown button directly', await shutdownButton.evaluate(e => e === document.activeElement));
  await page.mouse.move(20,20); await page.screenshot({ path: path.join(root, 'artifacts/direct-dock-controls.png') });
  await minimizeButton.focus(); await page.keyboard.press('Enter');
  let minimized = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    minimized = await application.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].isMinimized());
    if (minimized) break;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  check('Direct dock button minimizes the native environment without quitting', minimized && !page.isClosed());
  await application.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; w.restore(); w.focus(); });
  await page.waitForFunction(b => innerWidth === b.width && innerHeight === b.height, displayBounds);
  check('Restored environment retains fullscreen', await application.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return w.isFullScreen() && !w.isMinimized(); }));
  check('No renderer exceptions', errors.length === 0);
  evidence.errors = errors;
  await Promise.all([
    page.waitForEvent('close'),
    page.getByRole('button', { name: 'Shut down Electron OS', exact: true }).click().catch(error => {
      if (!page.isClosed()) throw error;
    }),
  ]);
  check('Outer close exits application', page.isClosed());
  await fs.writeFile(path.join(root, 'artifacts/electron-verification.json'), JSON.stringify(evidence, null, 2) + '\n');
} finally { await application.close().catch(() => {}); }
