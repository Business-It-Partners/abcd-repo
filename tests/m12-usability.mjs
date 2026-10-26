import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures', '--launch-feedback-fixtures'], env, timeout: 30000 });
const shell = await app.firstWindow();
const checks = [], errors = [];
shell.setDefaultTimeout(15000);
shell.on('pageerror', error => errors.push(error.message));
const check = (name, value = true) => { assert.ok(value, name); checks.push(name); console.log('PASS', name); };
const id = 'company.dental.finance';
const dockApp = shell.getByRole('button', { name: 'Explore apps', exact: true });
const explorer = shell.getByRole('dialog', { name: 'Explore apps', exact: true });
const phase = value => shell.waitForFunction(({ id, value }) => document.querySelector(`[data-window-id="${id}"]`)?.dataset.phase === value, { id, value });

async function openExplorer() {
  await dockApp.waitFor({ state: 'visible' });
  await dockApp.click();
  await explorer.waitFor({ state: 'visible' });
}

try {
  await shell.waitForFunction(() => !!document.querySelector('[data-dock-app="explore"]'));

  await openExplorer();
  const close = explorer.getByRole('button', { name: 'Close app explorer', exact: true });
  await shell.waitForFunction(() => document.querySelector('.app-explorer')?.contains(document.activeElement));
  check('app explorer moves keyboard focus inside its modal surface');
  const buttons = explorer.locator('button:not(:disabled)');
  await buttons.first().focus();
  await shell.keyboard.press('Shift+Tab');
  check('explorer traps reverse tab from its first control', await buttons.last().evaluate(element => element === document.activeElement));
  await shell.keyboard.press('Tab');
  check('explorer traps forward tab from its last control', await buttons.first().evaluate(element => element === document.activeElement));
  await shell.keyboard.press('Escape');
  await explorer.waitFor({ state: 'detached' });
  await shell.waitForFunction(() => document.activeElement === document.querySelector('[aria-label="Explore apps"]'));
  check('Escape returns focus to the app that opened the explorer');

  await openExplorer();
  await shell.locator('.app-explorer-backdrop').click({ position: { x: 2, y: 2 } });
  await explorer.waitFor({ state: 'detached' });
  await shell.waitForFunction(() => document.activeElement === document.querySelector('[aria-label="Explore apps"]'));
  check('backdrop dismissal returns focus to the app that opened the explorer');

  await openExplorer();
  await close.click();
  await explorer.waitFor({ state: 'detached' });
  await shell.waitForFunction(() => document.activeElement === document.querySelector('[aria-label="Explore apps"]'));
  check('explorer close control returns focus to its launching app');

  await openExplorer();
  await explorer.getByRole('button', { name: 'Finance', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', id, { timeout: 15000 });
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.launchHandoff === 'done', id, { timeout: 15000 });
  const guest = app.context().pages().find(page => page.url().startsWith(`dental-fixture://${id}/`));
  assert.ok(guest, 'selected company app should have a retained isolated app page');
  check('launched Finance package displays its first module', await guest.getByRole('heading', { name: 'Transaction Record', exact: true }).count() === 1);
  await guest.evaluate(() => { document.documentElement.dataset.usabilityProbe = 'preserved'; });

  await shell.emulateMedia({ reducedMotion: 'reduce' });
  await shell.getByRole('button', { name: 'Minimize Finance', exact: true }).click();
  await phase('minimized');
  check('reduced motion minimizes the shared app window without a Genie overlay', await shell.locator('.genie-overlay').evaluateAll(elements => elements.every(element => getComputedStyle(element).visibility === 'hidden')));
  await shell.getByRole('button', { name: 'Restore Finance', exact: true }).click();
  await phase('visible');
  check('reduced-motion restore keeps the selected app page state', await guest.getByRole('heading', { name: 'Transaction Record', exact: true }).count() === 1 && await guest.evaluate(() => document.documentElement.dataset.usabilityProbe === 'preserved'));
  check('reduced motion removes dock movement and window-control hover transitions', await shell.locator('.dock-region, .window-control').evaluateAll(elements => elements.length > 3 && elements.every(element => getComputedStyle(element).transitionDuration.split(',').every(value => Number.parseFloat(value) <= 0.001))));
  check('no shell renderer errors across explorer and reduced-motion journeys', errors.length === 0);

  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'm19-usability-verification.json'), JSON.stringify({ checks, errors, platform: process.platform }, null, 2) + '\n');
} finally {
  const closed = app.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (!await closed && app.process().exitCode === null) app.process().kill('SIGTERM');
}
