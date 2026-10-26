import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [root, ...profileArgs, '--runtime-fixtures', '--runtime-app-count=3', '--distribution-fixtures', '--development-apps-fixtures'],
  env,
  timeout: 30000,
});
const shell = await app.firstWindow();
shell.setDefaultTimeout(15000);
const checks = [], errors = [];
shell.on('pageerror', error => errors.push(error.message));
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const explorer = shell.getByTestId('app-explorer');

try {
  await shell.getByRole('region', { name: 'Development app collection' }).waitFor({ state: 'visible' });
  await shell.getByRole('button', { name: 'Explore apps', exact: true }).click();
  await explorer.waitFor({ state: 'visible' });
  check('Explore opens a built-in modal sheet from its permanent Dock icon');
  check('the system section provides the App Store and built-in app',
    await explorer.locator('[data-explorer-app="store"]').count() === 1
      && await explorer.locator('[data-explorer-app="standard-window-1"]').count() === 1);
  await explorer.locator('[data-explorer-app="company.sample.alpha"]').waitFor({ state: 'visible' });
  await explorer.locator('[data-explorer-app="company.sample.beta"]').waitFor({ state: 'visible' });
  check('only installed signed apps appear in the installed section',
    await explorer.locator('[data-explorer-app="company.sample.alpha"]').count() === 1
      && await explorer.locator('[data-explorer-app^="dev."]').count() === 0);
  check('the development collection remains a separate desktop surface',
    await shell.locator('[aria-label="Development app collection"]').count() === 1
      && await explorer.locator('.development-app-tile').count() === 0
      && await explorer.locator('[aria-label$=" development app"]').count() === 0);
  check('the dialog uses the glass surface and makes the desktop inert', await explorer.getAttribute('aria-modal') === 'true'
    && await shell.locator('main.desktop').evaluate(element => element.inert)
    && await explorer.evaluate(element => getComputedStyle(element).backgroundImage.includes('linear-gradient')));
  check('keyboard focus moves into the app collection', await explorer.evaluate(element => element.contains(document.activeElement)));

  const screenshot = path.join(root, 'artifacts', 'app-explorer-private.png');
  await fs.mkdir(path.dirname(screenshot), { recursive: true });
  await shell.screenshot({ path: screenshot });

  await shell.keyboard.press('Escape');
  await explorer.waitFor({ state: 'detached' });
  check('Escape closes Explore and returns focus to its Dock icon', await shell.evaluate(() => document.activeElement?.getAttribute('aria-label') === 'Explore apps'));

  await shell.getByRole('button', { name: 'Explore apps', exact: true }).click();
  await explorer.waitFor({ state: 'visible' });
  await explorer.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'visible');
  check('the built-in App Store tile opens the existing Store window');
  await shell.getByRole('button', { name: 'Close App Store', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="store"]')?.dataset.phase === 'closed');

  await shell.getByRole('button', { name: 'Explore apps', exact: true }).click();
  await explorer.waitFor({ state: 'visible' });
  await explorer.getByRole('button', { name: 'Standard Window 1', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="standard-window-1"]')?.dataset.phase === 'visible');
  check('the built-in system app launches from Explore');
  await shell.getByRole('button', { name: 'Close Standard Window 1', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="standard-window-1"]')?.dataset.phase === 'closed');

  await shell.getByRole('button', { name: 'Explore apps', exact: true }).click();
  await explorer.waitFor({ state: 'visible' });
  await explorer.getByRole('button', { name: 'company.sample.alpha', exact: true }).click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="studio"]')?.dataset.phase === 'visible');
  check('an installed app tile launches through the existing shared window manager');
  await shell.getByRole('button', { name: 'Explore apps', exact: true }).click();
  await explorer.waitFor({ state: 'visible' });
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.nativeViewVisible === 'false');
  check('opening Explore safely hides the running native app surface beneath the glass sheet');
  await shell.keyboard.press('Escape');
  await explorer.waitFor({ state: 'detached' });
  await shell.waitForFunction(() => document.querySelector('[data-runtime="studio"]')?.dataset.nativeViewVisible === 'true');
  check('closing Explore restores the running app surface');
  check('Explore produces no shell renderer errors', errors.length === 0);

  await fs.writeFile(path.join(root, 'artifacts', 'app-explorer-private.json'), JSON.stringify({ checks, errors }, null, 2) + '\n');
  console.log(`Screenshot: ${screenshot}`);
} finally {
  const closed = app.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (!await closed && app.process().exitCode === null) app.process().kill('SIGTERM');
}
