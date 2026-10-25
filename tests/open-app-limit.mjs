import { fixtureArgs as profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const app = await electron.launch({ args: [root, ...profileArgs, '--runtime-fixtures'], env, timeout: 30000 });
try {
  const page = await app.firstWindow();
  page.setDefaultTimeout(45000);
  const phase = (id, value) => page.waitForFunction(({ id, value }) =>
    document.querySelector(`[data-testid="${id}-window"]`)?.dataset.phase === value, { id, value });
  const open = async (title, id) => {
    await page.getByRole('button', { name: title, exact: true }).click();
    await phase(id, 'visible');
    if (id === 'studio' || id === 'records') {
      await page.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', id);
    }
    await page.mouse.move(10, 10);
  };

  await open('Motion Studio', 'studio');
  await open('Records', 'records');
  await page.getByRole('button', { name: 'Standard Window 1', exact: true }).click();
  const dialog = page.getByRole('alertdialog', { name: 'Only two apps can be open at a time' });
  await dialog.waitFor();
  assert.equal(await page.getByTestId('standard-window-1-window').getAttribute('data-phase'), 'closed');
  assert.equal(await dialog.getByRole('button', { name: 'Close Motion Studio', exact: true }).count(), 1);
  assert.equal(await dialog.getByRole('button', { name: 'Close Records', exact: true }).count(), 1);
  console.log('PASS third app request opens the OS capacity dialog with one close action per app');

  await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });
  assert.equal(await page.getByTestId('studio-window').getAttribute('data-phase'), 'visible');
  assert.equal(await page.getByTestId('records-window').getAttribute('data-phase'), 'visible');
  assert.equal(await page.getByTestId('standard-window-1-window').getAttribute('data-phase'), 'closed');
  console.log('PASS Cancel leaves both open apps intact and the requested app closed');

  await page.getByRole('button', { name: 'Standard Window 1', exact: true }).click();
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Close Motion Studio', exact: true }).click();
  await phase('studio', 'closed');
  await phase('standard-window-1', 'visible');
  assert.equal(await page.getByTestId('records-window').getAttribute('data-phase'), 'visible');
  console.log('PASS choosing an app closes it and then opens the requested app');
} finally {
  const closed = app.waitForEvent('close', { timeout: 5000 }).then(() => true, () => false);
  await app.evaluate(({ app }) => app.exit(0)).catch(() => {});
  if (!await closed && app.process().exitCode === null) app.process().kill('SIGTERM');
}
