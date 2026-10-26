import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { profileArgs } from './profile.mjs';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [root, ...profileArgs, '--runtime-fixtures', '--launch-feedback-fixtures', '--slow-app-discovery-fixtures'],
  env,
  timeout: 30000,
});
const checks = [];
const check = (name, value = true) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};

try {
  const shell = await app.firstWindow();
  shell.setDefaultTimeout(15000);
  await shell.waitForSelector('[data-dock-app="company.dental.appointments"]');
  await shell.waitForSelector('[data-dock-app="company.dental.followups"]');

  const appointmentsClick = shell.locator('[data-dock-app="company.dental.appointments"]').click();
  await shell.waitForTimeout(100);
  await shell.locator('[data-dock-app="company.dental.followups"]').click();
  await Promise.all([
    appointmentsClick,
    shell.waitForFunction(() => ['company.dental.appointments', 'company.dental.followups']
      .every(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready')),
  ]);
  check('a second app dock click is retained while the first package discovery is delayed');
  check('both delayed app launches create one managed window each', await shell.locator('[data-window-id]:not([data-phase="closed"])').count() === 2 &&
    await shell.locator('[data-window-id="company.dental.appointments"]').count() === 1 &&
    await shell.locator('[data-window-id="company.dental.followups"]').count() === 1);

  await shell.locator('[data-dock-app="company.dental.work-entry"]').click();
  const capacity = shell.getByRole('alertdialog', { name: 'Only two apps can be open at a time' });
  await capacity.waitFor();
  check('a third app still opens the two-app capacity prompt', await capacity.isVisible() &&
    await shell.locator('[data-window-id="company.dental.work-entry"]').count() === 1 &&
    await shell.locator('[data-window-id="company.dental.work-entry"]').getAttribute('data-phase') === 'closed');
  await shell.keyboard.press('Escape');
  await capacity.waitFor({ state: 'detached' });

  await shell.locator('[data-dock-app="company.dental.appointments"]').click();
  await shell.waitForFunction(() => document.querySelector('[data-window-id="company.dental.appointments"]')?.dataset.active === 'true');
  check('repeated click activates the existing app window without duplication', await shell.locator('[data-window-id="company.dental.appointments"]').count() === 1);

  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts/m19-app-launch-concurrency-verification.json'), JSON.stringify({ checks }, null, 2));
} finally {
  const closed = app.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (!await closed && app.process().exitCode === null) app.process().kill('SIGTERM');
}
