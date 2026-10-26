import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [root, ...profileArgs, '--distribution-fixtures', '--update-fixtures'],
  env,
  timeout: 30000,
});
const page = await app.firstWindow();
page.setDefaultTimeout(15000);
const checks = [];
const check = (name, value = true) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};

try {
  const widget = page.locator('.app-updates-widget');
  await widget.waitFor({ state: 'visible' });
  await widget.getByText('No app updates available', { exact: true }).waitFor();
  check('empty home widget clearly reports that no app updates are available', await widget.locator('.updates-empty-icon').isVisible());
  const store = page.getByTestId('store-window');
  await page.getByRole('button', { name: 'App Store', exact: true }).click();
  await store.getByRole('heading', { name: 'App Store' }).waitFor();
  const back = store.getByRole('button', { name: 'Back', exact: true });
  const refresh = store.getByRole('button', { name: 'Refresh company apps', exact: true });

  await store.getByRole('button', { name: 'Details Motion Studio', exact: true }).click();
  await store.getByRole('button', { name: 'Install', exact: true }).click();
  await store.getByRole('button', { name: 'Open', exact: true }).waitFor();
  await page.locator('.store-celebration').waitFor();
  await page.locator('.store-celebration').waitFor({ state: 'detached' });
  await back.click();

  const profile = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
  const registryPath = path.join(profile, 'packages', 'registry.json');
  const activeBefore = JSON.parse(await fs.readFile(registryPath, 'utf8')).apps['company.sample.alpha'].active;
  await fs.writeFile(path.join(profile, 'update-fixture.json'), JSON.stringify({ version: '1.1.0', offset: 1 }));
  await refresh.click();
  await store.locator('.delivery-store-row').filter({ hasText: 'Motion Studio' }).getByRole('button', { name: 'Update', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close App Store', exact: true }).click();

  const appUpdate = widget.locator('.update-app-row').filter({ hasText: 'Motion Studio' });
  await appUpdate.waitFor();
  check('home widget reads the installed app and signed catalogue versions',
    await appUpdate.getByText('1.0.0', { exact: true }).isVisible()
    && await appUpdate.getByText('1.1.0', { exact: true }).isVisible()
    && await appUpdate.getByRole('button', { name: 'Update Motion Studio', exact: true }).isEnabled());
  check('home widget counts only installed apps with an available signed update', await widget.locator('.updates-count').innerText() === '1 available');

  const dismissReady = page.getByRole('button', { name: 'Dismiss app ready' });
  if (await dismissReady.isVisible()) await dismissReady.click();
  const screenshot = path.join(root, 'artifacts', 'app-updates-widget-connected.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });

  await appUpdate.getByRole('button', { name: 'Update Motion Studio', exact: true }).click();
  await page.waitForFunction(async () => {
    const view = await window.desktop.store.action('view');
    const item = view.apps.find(candidate => candidate.id === 'company.sample.alpha');
    return item?.pendingVersion === '1.1.0' && !view.job;
  });
  const staged = JSON.parse(await fs.readFile(registryPath, 'utf8')).apps['company.sample.alpha'];
  check('Update button stages the verified release through the Store service', !!staged.pending && staged.active === activeBefore);
  await appUpdate.locator('.update-app-staged').waitFor({ state: 'visible' });
  check('widget reports the staged update without replacing the active app version',
    (await appUpdate.innerText()).includes('Staged · checking readiness')
    && await appUpdate.locator('.update-app-staged').innerText() === 'Staged');

  console.log(`Screenshot: ${screenshot}`);
  await fs.writeFile(path.join(root, 'artifacts', 'home-app-updates-verification.json'), JSON.stringify({ checks }, null, 2) + '\n');
} finally {
  await app.close();
}
