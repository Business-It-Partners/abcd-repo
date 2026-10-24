import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

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
  await frame.getByRole('heading', { name: 'App Store' }).waitFor();
  const brand = frame.locator('.delivery-store-brand');
  const brandMark = brand.locator('img');
  check('App Store carries the Sajilo Dental mark and name', await brand.getByText('Sajilo Dental', { exact: true }).isVisible() && await brandMark.evaluate(img => img.complete && img.naturalWidth > 0));
  const allApps = frame.getByRole('tab', { name: 'All Apps' });
  const newUpdates = frame.getByRole('tab', { name: 'New Updates' });
  check('Store opens on All Apps with the simple app list', await allApps.getAttribute('aria-selected') === 'true' && await frame.locator('.store-grid article').count() === 2);
  await page.screenshot({ path: 'artifacts/store-redesign-list.png' });
  const brandingEvidence = path.join(process.cwd(), 'artifacts', 'sajilo-dental-branding');
  await fs.mkdir(brandingEvidence, { recursive: true });
  await page.screenshot({ path: path.join(brandingEvidence, 'sajilo-dental-store.png'), animations: 'disabled' });
  await newUpdates.click();
  check('New Updates only lists actionable updates', await newUpdates.getAttribute('aria-selected') === 'true' && await frame.getByRole('heading', { name: 'No new updates' }).isVisible() && await frame.locator('.store-grid article').count() === 0);
  await allApps.click();

  const back = page.locator('.window-history-controls').getByRole('button', { name: 'Back', exact: true });
  await back.waitFor();
  check('Store home starts with its OS-owned Back control disabled', await back.isDisabled() && await page.getByRole('button', { name: 'Forward', exact: true }).count() === 0);
  check('Synthetic company catalogue is available', await frame.locator('.store-grid article').count() === 2);

  await frame.getByRole('button', { name: 'Details Motion Studio', exact: true }).click();
  check('Opening app details enables the OS-owned Back control', await frame.getByRole('heading', { name: 'Motion Studio', exact: true }).isVisible() && await back.isEnabled());
  const detailText = await frame.locator('.delivery-store-scroll').innerText();
  check('app details show description and version information without promotional sections', detailText.includes('Store version') && detailText.includes('Installed version') && !detailText.includes('Requested capabilities') && !detailText.includes('COMPANY APP COLLECTION'));
  await page.screenshot({ path: 'artifacts/store-redesign-detail.png' });

  await back.click();
  check('OS-owned Back returns to the Store catalogue', await frame.getByRole('heading', { name: 'App Store' }).isVisible() && await back.isDisabled());
  await frame.getByRole('button', { name: 'Details Records', exact: true }).click();
  check('A different detail opens through the OS-owned page history', await frame.getByRole('heading', { name: 'Records', exact: true }).isVisible() && await back.isEnabled());

  await back.click();
  await frame.getByLabel('Search store').fill('motion');
  check('Store search filters the catalogue without changing the route', await frame.locator('.store-grid article').count() === 1 && await frame.getByRole('heading', { name: 'App Store' }).isVisible());

  await page.getByRole('button', { name: 'Close App Store', exact: true }).click();
  await page.getByRole('button', { name: 'App Store', exact: true }).click();
  check('Reopening App Store restores its home route', await frame.getByRole('heading', { name: 'App Store' }).isVisible());
} finally {
  await app.close();
}
