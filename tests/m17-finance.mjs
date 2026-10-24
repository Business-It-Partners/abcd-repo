import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const host = path.join(root, 'tests/fixtures/m17-finance-host.cjs');
const expectedVersion = JSON.parse(await fs.readFile(path.join(root, 'apps/dental-apps/company.dental.finance.m17/app.manifest.json'), 'utf8')).version;
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const checks = [], errors = [], logs = [];
let app, page, packageInfo, failure, passed = false;
const check = (name, condition) => { assert.ok(condition, name); checks.push(name); console.log('PASS', name); };
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.finance.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Finance guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};

try {
  app = await electron.launch({ args: [host, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => logs.push(String(chunk)));
  page = await waitForGuest(app);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {
    const text = message.text();
    if (message.type() === 'error' && !text.includes("frame-ancestors")) errors.push(text);
  });
  page.setDefaultTimeout(15000);
  await page.getByRole('heading', { name: 'Financial overview', exact: true }).waitFor();
  packageInfo = await app.evaluate(() => globalThis.m17Finance.package);
  check('private Finance package opens with its current identity and assets', packageInfo.appId === 'company.dental.finance.m17' && packageInfo.version === expectedVersion && packageInfo.wireBytes > 0 && packageInfo.assetCount >= 5);
  check('Finance renders its initial page instead of a blank app window', await page.locator('[data-clinic-page-header]').innerText().then(value => value.includes('Financial overview')));
  check('Finance completes its initial transaction report request', await app.evaluate(() => globalThis.m17Finance.calls.some(call => call.path.startsWith('/v1/clinic/transaction-record') && call.method === 'GET')));
  await page.getByText(/No transactions found/).waitFor();
  check('Finance shows the loaded empty state with no renderer errors', (await page.locator('body').innerText()).includes('No transactions found') && errors.length === 0);
  const selection = await app.evaluate(async () => {
    const result = await globalThis.m17Finance.selectModule('patient-payments');
    return { result, ackCount: globalThis.m17Finance.moduleAcks.length };
  });
  await page.getByRole('heading', { name: 'Patient payments', exact: true }).waitFor();
  check('OS module-selection event moves Finance to Patient payments and receives its acknowledgement', selection.result.ok === true && selection.ackCount >= 1);

  const purchaseSelection = await app.evaluate(async () => globalThis.m17Finance.selectModule('purchases'));
  await page.getByRole('heading', { name: 'Purchases', exact: true }).waitFor();
  const purchaseTable = page.locator('[data-sajilo-standard-table]');
  await purchaseTable.locator('tbody tr').nth(2).waitFor();
  const purchaseHeaders = await purchaseTable.locator('thead th').allTextContents();
  check('purchase list removes the Category column and keeps the simplified scan layout', !purchaseHeaders.some(value => value.trim() === 'Category') && purchaseHeaders.some(value => value.includes('Items')));
  check('supplier and item labels wrap to two lines, invoice stays single-line, and totals stay single-line', await page.locator('.purchase-supplier-summary').first().evaluate(element => getComputedStyle(element).webkitLineClamp) === '2' && await page.locator('.purchase-items-summary').nth(1).evaluate(element => getComputedStyle(element).webkitLineClamp) === '2' && await page.locator('.purchase-invoice-summary').last().evaluate(element => getComputedStyle(element).whiteSpace) === 'nowrap' && await page.locator('.purchase-total-single-line').nth(1).evaluate(element => getComputedStyle(element).whiteSpace) === 'nowrap');
  check('long invoice references clip to one line with ellipsis', await page.locator('.purchase-invoice-summary').last().evaluate(element => element.scrollWidth > element.clientWidth && getComputedStyle(element).textOverflow === 'ellipsis'));
  check('purchase list no longer shows the success note as a page subtitle', await page.locator('.purchase-notice').count() === 0 && !(await page.locator('body').innerText()).includes('Purchase recorded successfully.'));
  await page.locator('[aria-label="Opening purchases…"]').waitFor({ state: 'detached' });
  const purchaseListScreenshotPath = path.join(root, 'artifacts', 'm17-finance-purchases-list.png');
  await fs.writeFile(purchaseListScreenshotPath, await page.screenshot(), { flag: 'w' });
  console.log('SCREENSHOT', purchaseListScreenshotPath);
  await page.getByRole('button', { name: 'New purchase', exact: true }).click();
  await page.getByRole('heading', { name: 'New purchase', exact: true }).waitFor();
  await page.locator('.purchase-form-page select').nth(1).selectOption('20000000-0000-4000-8000-000000000001');
  const product = page.getByRole('combobox', { name: 'Product name', exact: true });
  await product.fill('Keyboard choice');
  await page.getByRole('option', { name: 'Keyboard choice 12 box' }).waitFor();
  for (let index = 0; index < 8; index++) await product.press('ArrowDown');
  const activeOption = await page.evaluate(() => {
    const list = document.querySelector('.purchase-product-options');
    const option = list?.querySelector('.highlighted');
    if (!list || !option) return null;
    const listBounds = list.getBoundingClientRect();
    const optionBounds = option.getBoundingClientRect();
    return {
      name: option.textContent?.trim() ?? '',
      scrollTop: list.scrollTop,
      visible: optionBounds.top >= listBounds.top && optionBounds.bottom <= listBounds.bottom,
    };
  });
  check('ArrowDown scrolls the highlighted product option into view', activeOption?.name.includes('Keyboard choice 09') && activeOption.scrollTop > 0 && activeOption.visible);
  await product.fill('Synthetic gauze');
  await page.getByRole('option', { name: 'Synthetic gauze box' }).waitFor();
  await product.press('Enter');
  await page.waitForFunction(() => document.activeElement?.dataset.purchaseField === 'quantity');
  check('keyboard product selection advances focus to quantity', true);
  await page.locator('input[data-purchase-field="quantity"]').first().press('Enter');
  await page.waitForFunction(() => document.activeElement?.dataset.purchaseField === 'unit');
  await page.locator('input[data-purchase-field="unit"]').first().press('Enter');
  await page.waitForFunction(() => document.activeElement?.dataset.purchaseField === 'rate');
  await page.locator('input[data-purchase-field="rate"]').first().fill('125');
  await page.locator('input[data-purchase-field="rate"]').first().press('Enter');
  await page.locator('.purchase-lines-card tbody tr').nth(1).waitFor();
  await page.waitForFunction(() => document.activeElement?.dataset.purchaseField === 'item' && document.activeElement?.dataset.purchaseLine === '1');
  check('Enter from the last rate field appends and focuses the next product row', await page.locator('.purchase-lines-card tbody tr').count() === 2);
  check('invoice lines have no pagination strip', await page.locator('.purchase-lines-card').getByText(/Showing \d+ to \d+ of \d+ invoice lines/).count() === 0);
  await page.getByRole('button', { name: 'Add invoice line', exact: true }).click();
  await page.locator('.purchase-lines-card tbody tr').nth(2).waitFor();
  await page.waitForFunction(() => document.activeElement?.dataset.purchaseField === 'item' && document.activeElement?.dataset.purchaseLine === '2');
  check('green row plus appends a line and focuses its product field', await page.locator('.purchase-lines-card tbody tr').count() === 3 && purchaseSelection.ok === true);
  const screenshotPath = path.join(root, 'artifacts', 'm17-finance-private-latest.png');
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'w' });
  await page.getByPlaceholder('Invoice number', { exact: true }).fill('M17-REVIEW-001');
  const draftRows = page.locator('.purchase-lines-card tbody tr');
  await draftRows.nth(2).getByRole('button', { name: /^Remove invoice line/ }).click();
  await draftRows.nth(1).getByRole('button', { name: /^Remove invoice line/ }).click();
  await page.getByRole('button', { name: 'Review Purchase', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirm Purchase Order', exact: true }).waitFor();
  const reviewNavigation = await app.evaluate(() => ({ navigation: globalThis.m17Finance.navigation(), lifecycle: globalThis.m17Finance.lifecycle() }));
  check('OS history marks purchase review as a safe Back step while retaining the unsaved draft', reviewNavigation.navigation?.backPreservesDraft === true && reviewNavigation.lifecycle?.dirty === true && reviewNavigation.lifecycle?.modal === false);
  check('OS Back returns to the editable purchase form without discarding its draft', await app.evaluate(() => globalThis.m17Finance.navigate('back', false, true)) === true);
  await page.getByRole('heading', { name: 'New purchase', exact: true }).waitFor();
  check('purchase draft fields remain intact after OS Back from review', await page.getByPlaceholder('Invoice number', { exact: true }).inputValue() === 'M17-REVIEW-001' && await page.locator('input[data-purchase-field="rate"]').first().inputValue() === '125');
  await page.getByRole('button', { name: 'Review Purchase', exact: true }).click();
  await page.getByRole('heading', { name: 'Confirm Purchase Order', exact: true }).waitFor();
  const reviewContext = await page.locator('.purchase-review-context').innerText();
  check('purchase confirmation presents supplier, invoice number, date and type as clearly labeled fields', reviewContext.includes('Supplier') && reviewContext.includes('Synthetic supplier') && reviewContext.includes('Invoice number') && reviewContext.includes('M17-REVIEW-001') && reviewContext.includes('Invoice date') && reviewContext.includes('Purchase type') && await page.locator('.purchase-review-context dt').count() === 4);
  check('purchase confirmation removes the long explanation and heading checkmark', await page.locator('.purchase-review-intro, .purchase-review-reminder, .purchase-review-metadata').count() === 0 && await page.locator('[data-clinic-page-header] h2 svg').count() === 0);
  check('purchase confirmation frames invoice items and emphasizes the net total', await page.locator('.purchase-review-items').getByRole('heading', { name: 'Invoice items', exact: true }).count() === 1 && await page.locator('.purchase-review-totals .grand-total strong').innerText().then(value => value.includes('125')));
  check('purchase confirmation has no redundant bottom Back button', await page.locator('.purchase-form-actions').getByRole('button', { name: 'Back', exact: true }).count() === 0);
  const reviewScreenshotPath = path.join(root, 'artifacts', 'm17-finance-purchase-review.png');
  await fs.writeFile(reviewScreenshotPath, await page.screenshot(), { flag: 'w' });
  console.log('SCREENSHOT', reviewScreenshotPath);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (app) {
    try {
      const diagnostic = await app.evaluate(() => ({ host: globalThis.__m17FinanceDiagnostic ?? null, fixture: globalThis.m17Finance ?? null }));
      const target = app.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.finance.m17/'));
      if (target) diagnostic.body = (await target.locator('body').innerText()).slice(0, 3000);
      failure += `\nPrivate diagnostic: ${JSON.stringify(diagnostic)}`;
    } catch {}
  }
  if (logs.length) failure += `\nPrivate host stderr: ${logs.join('').slice(-6000)}`;
  throw error;
} finally {
  if (app) await app.close();
  await fs.mkdir(path.join(root, 'artifacts'), { recursive: true });
  await fs.writeFile(path.join(root, 'artifacts', 'm17-finance-private-latest.json'), JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo,
    scope: 'Private headless GNOME/Electron acceptance using an ephemeral test key and in-memory synthetic Finance data, including purchase-row keyboard interaction. No live clinic data or publication.' }, null, 2));
}
