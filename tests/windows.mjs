import { fixtureArgs as profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env }; delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, ...profileArgs], env });
const page = await app.firstWindow();
const checks = [], errors = [];
page.on('pageerror', error => errors.push(error.message));
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const near = (a, b) => Math.abs(a - b) < 1;
const phase = (id, value) => page.waitForFunction(({ id, value }) => document.querySelector(`[data-testid="${id}-window"]`).dataset.phase === value, { id, value });
const open = async id => { await page.getByRole('button', { name: id === 'records' ? 'Records' : 'Motion Studio', exact: true }).click(); await phase(id, 'visible'); };
async function dragHandle(frame, edge, dx, dy, release = true) {
  const handle = frame.locator(`[data-resize="${edge}"]`);
  await handle.hover();
  const b = await handle.boundingBox();
  const x = b.x + b.width / 2, y = b.y + b.height / 2;
  await page.mouse.move(x, y); await page.mouse.down();
  await frame.page().waitForFunction(id => document.querySelector(`[data-testid="${id}"]`).dataset.interaction === 'resizing', await frame.getAttribute('data-testid')); 
  await page.mouse.move(x + dx, y + dy, { steps: 8 });
  if (release) await page.mouse.up();
}
try {
  const display = await app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds);
  await page.waitForFunction(b => innerWidth === b.width && innerHeight === b.height, display);
  await page.waitForTimeout(250);
  for (const id of ['studio', 'records']) {
    await open(id);
    const frame = page.getByTestId(`${id}-window`);
    if (id === 'records') {
      // Records now starts at the usable boundaries. Move its top/left
      // inward to exercise unconstrained expansion in every direction.
      await dragHandle(frame, 'nw', 100, 80);
      await dragHandle(frame, 'se', -100, -80);
    }
    check(`${id} exposes eight resize directions`, await frame.locator('[data-resize]').count() === 8);
    for (const edge of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se']) {
      const before = await frame.boundingBox();
      const dx = edge.includes('e') ? 32 : edge.includes('w') ? -32 : 0;
      const dy = edge.includes('s') ? 24 : edge.includes('n') ? -24 : 0;
      await dragHandle(frame, edge, dx, dy);
      const after = await frame.boundingBox();
      check(`${id} ${edge} resizes and anchors the opposite boundaries`,
        near(after.width, before.width + Math.abs(dx)) && near(after.height, before.height + Math.abs(dy)) &&
        near(after.x, before.x + (edge.includes('w') ? dx : 0)) && near(after.y, before.y + (edge.includes('n') ? dy : 0)));
      await dragHandle(frame, edge, -dx, -dy);
      const restored = await frame.boundingBox();
      check(`${id} ${edge} can contract to its previous rectangle`, Object.keys(before).every(k => near(before[k], restored[k])));
    }
    await page.getByRole('button', { name: `Close ${id === 'records' ? 'Records' : 'Motion Studio'}`, exact: true }).click();
  }
  await open('records');
  const records = page.getByTestId('records-window');
  await dragHandle(records, 'nw', 100, 80);
  await dragHandle(records, 'se', -100, -80);
  const baseline = await records.boundingBox();
  await dragHandle(records, 'nw', 55, 35, false);
  await page.keyboard.press('Escape'); await page.mouse.up();
  let actual = await records.boundingBox();
  check('Escape cancels a resize and restores initial bounds', Object.keys(baseline).every(k => near(baseline[k], actual[k])) && await records.getAttribute('data-interaction') === 'idle');
  await dragHandle(records, 'se', 35, 25, false);
  await records.locator('[data-resize="se"]').dispatchEvent('pointercancel', { pointerId: 1 });
  await page.mouse.up(); actual = await records.boundingBox();
  check('Pointer cancellation rolls back and clears capture state', Object.keys(baseline).every(k => near(baseline[k], actual[k])) && await records.getAttribute('data-interaction') === 'idle');
  await dragHandle(records, 'e', 25, 0, false);
  await records.locator('[data-resize="e"]').evaluate(e => e.releasePointerCapture(1));
  const captureLost = await records.boundingBox();
  await page.mouse.move(captureLost.x + captureLost.width + 30, captureLost.y + captureLost.height / 2);
  await page.mouse.up();
  check('Lost capture continues through global routing and release outside the frame', (await records.boundingBox()).width > baseline.width + 25 && await records.getAttribute('data-interaction') === 'idle');
  await dragHandle(records, 'e', baseline.width - (await records.boundingBox()).width, 0);
  await dragHandle(records, 'e', 25, 0, false);
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); await page.mouse.up();
  check('Deactivation cancels the resize', near((await records.boundingBox()).width, baseline.width) && await records.getAttribute('data-interaction') === 'idle');

  await dragHandle(records, 'nw', baseline.width, baseline.height);
  actual = await records.boundingBox();
  check('Minimum size keeps opposite corner fixed', near(actual.width, 640) && near(actual.height, 360) && near(actual.x + actual.width, baseline.x + baseline.width) && near(actual.y + actual.height, baseline.y + baseline.height));
  check('Table remains scrollable rather than deforming', await records.locator('.table-scroll').evaluate(e => e.scrollWidth > e.clientWidth));
  await page.getByRole('button', { name: 'Add record', exact: true }).click();
  check('Owned modal disables resize handles', await records.locator('[data-resize]').count() === 0);
  const modal = await records.locator('.record-modal-layer').boundingBox();
  check('Form remains inside the resized owner', modal.x >= actual.x && modal.y >= actual.y + 43 && modal.x + modal.width <= actual.x + actual.width + 1 && modal.y + modal.height <= actual.y + actual.height + 1);
  await page.getByRole('dialog').getByLabel('Item name', { exact: true }).fill('Resized window record');
  await page.getByRole('button', { name: 'Save record', exact: true }).click();
  await dragHandle(records, 'nw', -80, -60);
  const resized = await records.boundingBox();
  await page.getByRole('button', { name: 'Maximize Records', exact: true }).click();
  check('Fullscreen removes all resize handles', await records.locator('[data-resize]').count() === 0);
  await page.getByRole('button', { name: 'Minimize Records', exact: true }).click(); await phase('records', 'minimized');
  await page.getByRole('button', { name: 'Restore Records', exact: true }).click(); await phase('records', 'visible');
  check('Fullscreen survives Genie restore', await records.getAttribute('data-presentation') === 'fullscreen');
  await page.getByRole('button', { name: 'Restore Records size', exact: true }).click();
  actual = await records.boundingBox();
  check('Fullscreen restore preserves resized normal geometry and data', Object.keys(resized).every(k => near(resized[k], actual[k])) && await page.getByRole('rowheader', { name: 'Resized window record' }).count() === 1);

  await open('studio'); await page.locator('#note').fill('Shared manager preserves content');
  await page.mouse.move(30, 70);
  await page.waitForFunction(() => Math.abs(document.querySelector('.system-icon').getBoundingClientRect().width - 36) < .1);
  await page.screenshot({ path: path.join(root, 'artifacts/window-depth.png') });
  await open('records');
  check('Dock activation raises the requested window', await records.getAttribute('data-active') === 'true' && Number(await records.evaluate(e => getComputedStyle(e).zIndex)) > Number(await page.getByTestId('studio-window').evaluate(e => getComputedStyle(e).zIndex)));
  await page.getByRole('button', { name: 'Minimize Records', exact: true }).click(); await phase('records', 'minimized');
  check('Minimizing active app activates and focuses the next visible app', await page.getByTestId('studio-window').getAttribute('data-active') === 'true' && await page.getByTestId('studio-window').evaluate(e => e.contains(document.activeElement)));
  await page.getByRole('button', { name: 'Restore Records', exact: true }).click(); await phase('records', 'visible');
  await page.getByRole('button', { name: 'Close Records', exact: true }).click();
  check('Closing active app transfers focus without losing other app data', await page.getByTestId('studio-window').getAttribute('data-active') === 'true' && await page.locator('#note').inputValue() === 'Shared manager preserves content');

  await open('records');
  await dragHandle(records, 'se', 30, 20, false);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 500, height: 400, deviceScaleFactor: 1, mobile: false });
  await page.mouse.up();
  await page.waitForFunction(() => { const e = document.querySelector('[data-testid="records-window"]'), b = e.getBoundingClientRect(); return innerWidth === 500 && b.right <= 500 && b.bottom <= 400 && e.dataset.interaction === 'idle'; }, null, { timeout: 5000 }).catch(async error => { console.log(await page.evaluate(() => { const e = document.querySelector('[data-testid="records-window"]'); return { viewport: [innerWidth, innerHeight], box: e.getBoundingClientRect().toJSON(), data: { ...e.dataset }, style: e.getAttribute('style') }; })); throw error; });
  actual = await records.boundingBox();
  check('Viewport change settles gestures and fits smaller screens', actual.x >= 0 && actual.y >= 0 && actual.x + actual.width <= 500 && actual.y + actual.height <= 400 && await records.getAttribute('data-interaction') === 'idle');
  await cdp.send('Emulation.clearDeviceMetricsOverride');
  await page.waitForFunction(() => innerWidth > 500);
  await page.mouse.move(20, 70);
  await page.screenshot({ path: path.join(root, 'artifacts/window-resizing.png') });
  check('Native environment remains fullscreen during internal gestures', await app.evaluate(({ BrowserWindow }) => { const w = BrowserWindow.getAllWindows()[0]; return w.isFullScreen() && !w.isMinimized(); }));
  check('No renderer exceptions or abandoned gesture styles', errors.length === 0 && await page.evaluate(() => !document.body.style.cursor && !document.body.style.userSelect));
  await fs.writeFile(path.join(root, 'artifacts/windows-verification.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
} finally { await app.close(); }
