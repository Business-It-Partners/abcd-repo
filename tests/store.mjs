import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;
const app = await electron.launch({
  args: [process.cwd(), ...profileArgs, '--distribution-fixtures'],
  env,
});
const page = await app.firstWindow();
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log('PASS', name);
};

try {
  await page.getByRole('button', { name: 'App Store', exact: true }).click();
  const frame = page.getByTestId('store-window');
  await frame.getByRole('heading', { name: 'Your apps. One workspace.' }).waitFor();

  const back = frame.getByRole('button', { name: 'Back', exact: true });
  const forward = frame.getByRole('button', { name: 'Forward', exact: true });
  check('Store home starts with Back and Forward disabled', await back.isDisabled() && await forward.isDisabled());
  check('Synthetic company catalogue is available', await frame.locator('.store-grid article').count() === 2);

  await frame.getByRole('button', { name: 'Details Motion Studio', exact: true }).click();
  check('Opening app details enables Back only', await frame.getByRole('heading', { name: 'Motion Studio', exact: true }).isVisible() && await back.isEnabled() && await forward.isDisabled());

  await back.click();
  check('Window Back returns to the Store catalogue', await frame.getByRole('heading', { name: 'Your apps. One workspace.' }).isVisible() && await forward.isEnabled());

  await forward.click();
  check('Window Forward restores the app detail', await frame.getByRole('heading', { name: 'Motion Studio', exact: true }).isVisible() && await back.isEnabled());

  await back.click();
  await frame.getByRole('button', { name: 'Details Records', exact: true }).click();
  check('Choosing a different detail clears Forward history', await frame.getByRole('heading', { name: 'Records', exact: true }).isVisible() && await back.isEnabled() && await forward.isDisabled());

  await back.click();
  await frame.getByLabel('Search store').fill('motion');
  check('Store search filters the catalogue without changing the route', await frame.locator('.store-grid article').count() === 1 && await frame.getByRole('heading', { name: 'Your apps. One workspace.' }).isVisible());

  await page.getByRole('button', { name: 'Close App Store', exact: true }).click();
  await page.getByRole('button', { name: 'App Store', exact: true }).click();
  check('Reopening App Store restores its home route', await frame.getByRole('heading', { name: 'Your apps. One workspace.' }).isVisible());
} finally {
  await app.close();
}
