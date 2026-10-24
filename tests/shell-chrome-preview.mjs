import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [root, ...profileArgs, '--distribution-fixtures', '--onboarding-fixtures'],
  env,
  timeout: 30000,
});

try {
  const page = await app.firstWindow();
  await page.waitForFunction(() => document.querySelector('.desktop-statusbar') && document.querySelector('.clinic-widget-copy'));
  for (const title of ['Motion Studio', 'Records', 'Dental Workspace Preview']) {
    await page.getByRole('button', { name: 'App Store', exact: true }).click();
    const store = page.getByTestId('store-window');
    await store.getByRole('heading', { name: 'App Store' }).waitFor();
    await store.getByRole('button', { name: `Details ${title}`, exact: true }).click();
    await store.getByRole('button', { name: 'Install', exact: true }).click();
    await store.getByRole('button', { name: 'Open', exact: true }).waitFor();
    await page.locator('.store-celebration').waitFor({ state: 'detached' });
    await store.getByRole('button', { name: 'Back', exact: true }).click();
    await page.getByRole('button', { name: 'Close App Store', exact: true }).click();
  }
  await page.waitForFunction(() => document.querySelectorAll('.dock-icon:not(.system-icon)').length === 4);
  const dismissReady = page.getByRole('button', { name: 'Dismiss app ready' });
  if (await dismissReady.isVisible()) await dismissReady.click();
  const apps = await page.locator('.dock-icon:not(.system-icon)').evaluateAll(icons => icons.map(icon => icon.getAttribute('aria-label')));
  assert.equal(apps.length, 4);
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await page.screenshot({ path: path.join(root, 'artifacts/m12-desktop-chrome.png') });
  await fs.writeFile(path.join(root, 'artifacts/m12-desktop-chrome.json'), JSON.stringify({ display: await app.evaluate(({ screen }) => screen.getPrimaryDisplay().bounds), appIcons: apps, mode: 'private signed-catalog fixture; three synthetic company packages installed through Store' }, null, 2) + '\n');
  console.log('PASS Product-style shell screenshot uses Store plus three apps installed through the signed-catalog flow');
} finally {
  await app.close();
}
