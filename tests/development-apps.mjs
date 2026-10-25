import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const args = [root, ...profileArgs, '--runtime-fixtures', '--launch-feedback-fixtures', '--distribution-fixtures', '--development-apps-fixtures'];
const profile = profileArgs.find(value => value.startsWith('--user-data-dir='))?.slice('--user-data-dir='.length);
let app;
let page;
const check = (name, value = true) => { assert.ok(value, name); console.log('PASS', name); };

try {
  app = await electron.launch({ args, env, timeout: 30000 });
  page = await app.firstWindow();
  page.setDefaultTimeout(15000);
  const widget = page.getByRole('region', { name: 'Development app collection' });
  await widget.waitFor({ state: 'visible' });
  const tiles = widget.locator('.development-app-tile');
  check('home screen shows ten first-party apps as thumbnail tiles', await tiles.count() === 10);
  check('tiles contain their thumbnails and app names', await widget.locator('.development-app-thumbnail img').count() === 10
    && await widget.getByText('Follow-ups', { exact: true }).count() === 1);
  check('development app grid sits in the center-left home area', await widget.evaluate(element => {
    const rect = element.getBoundingClientRect();
    return rect.left < innerWidth / 2 && Math.abs(rect.top + rect.height / 2 - innerHeight / 2) < innerHeight * 0.12;
  }));
  check('the OS does not expose a build command or build bridge', await widget.getByRole('button', { name: /Build/ }).count() === 0
    && await page.evaluate(() => !('build' in window.desktop.developmentApps)));

  const view = await page.evaluate(() => window.desktop.developmentApps.view());
  check('the local app catalog is a fixed allowlist with embedded image thumbnails', view.enabled && view.apps.length === 10
    && view.apps.every(item => item.thumbnail.startsWith('data:image/png;base64,')));
  const devRegistryPath = path.join(profile, 'development-apps', 'registry.json');
  check('development registry stays empty until a local app is selected', !await fs.stat(devRegistryPath).then(() => true, () => false));

  const screenshot = path.join(root, 'artifacts', 'development-app-collection.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await page.screenshot({ path: screenshot, fullPage: true });

  await widget.getByRole('button', { name: 'Open Follow-ups development app' }).click();
  await page.waitForFunction(() => document.querySelector('[data-runtime="dev.company.dental.followups.m17"]')?.getAttribute('data-runtime-phase') === 'ready'
    || !!document.querySelector('.development-widget-message')?.textContent, { timeout: 6000 }).catch(() => {});
  const devPhase = await page.locator('[data-runtime="dev.company.dental.followups.m17"]').getAttribute('data-runtime-phase').catch(() => null);
  const devMessage = await widget.locator('.development-widget-message').innerText().catch(() => '');
  if (devPhase !== 'ready') throw new Error(`Development app launch did not become ready; phase=${devPhase}; message=${devMessage}`);
  check('development app opens from the local build without an installed or signed Store package');
  const registry = JSON.parse(await fs.readFile(devRegistryPath, 'utf8'));
  const developmentBuild = registry.apps['company.dental.followups.m17'];
  check('local build is imported into its separate development registry', !!developmentBuild?.active);
  check('local app bytes are not placed into the released package registry', !await fs.stat(path.join(profile, 'packages', 'apps', 'company.dental.followups.m17')).then(() => true, () => false));
  check('development tile no longer shows an installed-release version gate', await widget.locator('.development-widget-message').count() === 0);

  await fs.writeFile(path.join(root, 'artifacts', 'development-apps-verification.json'), JSON.stringify({ checks: [
    'home screen lists ten first-party app tiles',
    'each tile shows its app thumbnail and name',
    'development grid is placed in the center-left area',
    'no build control or build bridge is exposed',
    'fixed app catalog returns embedded thumbnails',
    'development registry stays empty until a tile is selected',
    'actual local Follow-ups build opens with no signed Store package',
    'local build is imported into its separate development registry',
    'local app files are absent from released-package storage',
    'development launch has no installed-release identity or version gate',
  ] }, null, 2) + '\n');
  console.log(`Screenshot: ${screenshot}`);
} finally {
  await page?.evaluate(() => window.desktop?.runtime.sync([])).catch(() => {});
  await app?.close();
}
