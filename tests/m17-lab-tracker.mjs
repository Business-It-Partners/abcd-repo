import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-lab-tracker-host.cjs');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-lab-tracker-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-lab-tracker-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 200; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.lab-tracker.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Lab Tracker guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17LabTracker.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  effects: globalThis.m17LabTracker.effects(), moduleAcks: globalThis.m17LabTracker.moduleAcks.slice(),
  moduleSelectionResult: globalThis.m17LabTracker.moduleSelectionResult(), package: globalThis.m17LabTracker.package,
  orders: structuredClone(globalThis.m17LabTracker.orders), suppliers: structuredClone(globalThis.m17LabTracker.suppliers),
}));

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Lab Tracker', exact: true }).waitFor();
  await page.getByText('Synthetic Pending Patient', { exact: true }).waitFor();
  const initial = await inspect(app); packageInfo = initial.package;
  check('private signed package has Lab Tracker identity, version 1.0.3, and packaged assets', packageInfo.appId === 'company.dental.lab-tracker.m17' && packageInfo.version === '1.0.3' && packageInfo.wireBytes > 0 && packageInfo.assetCount >= 5);
  const standardPage = page.locator('[data-sajilo-standard-page]:visible');
  const standardCount = standardPage.locator('[data-sajilo-table-count]');
  const standardPagination = standardPage.locator('[data-sajilo-pagination]');
  const tableFilters = standardPage.locator('[data-sajilo-table-filters]');
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' }); screenshotWritten = true;
  check('Lab Tracker list uses the shared Standard Window page header',
    await standardPage.locator('[data-clinic-page-header]').count() === 1);
  check('Lab Tracker keeps its filters inside the table toolbar', await tableFilters.count() === 1);
  check('Lab Tracker result count reflects the displayed rows', await standardCount.innerText() === '2 orders');
  check('Lab Tracker pagination sits outside the scrolling table', await standardPagination.count() === 1);
  check('Lab Tracker pagination remains visible at the bottom of the app window',
    await standardPagination.evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return rect.bottom <= innerHeight && rect.bottom > innerHeight - 160;
    }));
  check('renderer receives the SDK bridge with no credential getter', await page.evaluate(() => {
    const methods = Object.keys(window.dentalApp ?? {});
    return ['cancel', 'connect', 'getAppInfo', 'request', 'report'].every(method => methods.includes(method))
      && !methods.some(method => /token|credential|fetch|storage/i.test(method));
  }));
  check('startup loads lab orders and lab-scoped shared suppliers through the approved SDK routes',
    initial.calls.some(call => call.method === 'GET' && call.path === '/v1/lab-orders')
      && initial.calls.some(call => call.method === 'GET' && call.path === '/v1/clinic/suppliers?scope=lab'));
  const pendingRow = page.getByRole('row').filter({ hasText: 'Synthetic Pending Patient' });
  await pendingRow.locator('button[title="Advance to Sent"]').click();
  await page.getByRole('heading', { name: 'Send to lab', exact: true }).waitFor();
  await page.locator('input[list="lab-work-options"]').fill('Zirconia Crown');
  await page.locator('select').last().selectOption('55555555-5555-4555-8555-555555555555');
  await page.getByRole('button', { name: 'Send to lab', exact: true }).click();
  await page.getByRole('row').filter({ hasText: 'Synthetic Pending Patient' }).locator('button[title="Advance to Received"]').waitFor();
  const assigned = await inspect(app);
  const assignment = assigned.calls.find(call => call.method === 'POST' && call.path === '/v1/lab-orders/33333333-3333-4333-8333-333333333333/assign');
  check('pending doctor request is assigned with the expected row version and an idempotent SDK write', assignment?.body?.expectedRowVersion === 1 && Boolean(assignment.operationId) && assigned.orders[0].status === 'sent');

  const assignedRow = page.getByRole('row').filter({ hasText: 'Synthetic Pending Patient' });
  await assignedRow.locator('button[title="Advance to Received"]').click();
  await assignedRow.locator('button[title="Advance to Fitted"]').waitFor();
  await assignedRow.locator('button[title="Advance to Fitted"]').click();
  const progressed = await inspect(app);
  const progressWrites = progressed.calls.filter(call => call.method === 'PATCH' && call.path === '/v1/lab-orders/33333333-3333-4333-8333-333333333333');
  check('receipt and fit progression are persisted with optimistic row versions', progressWrites.some(call => call.body.status === 'received' && call.body.expectedRowVersion === 2) && progressWrites.some(call => call.body.status === 'fitted' && call.body.expectedRowVersion === 3) && progressed.orders[0].status === 'fitted');

  const sentRow = page.getByRole('row').filter({ hasText: 'Synthetic Sent Patient' });
  await sentRow.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.locator('textarea').last().fill('Pickup after 3 PM');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  const noteSaved = await inspect(app);
  const noteWrite = noteSaved.calls.find(call => call.method === 'PATCH' && call.path === '/v1/lab-orders/44444444-4444-4444-8444-444444444444' && call.body.receptionNote === 'Pickup after 3 PM');
  check('reception notes are editable without exposing immutable clinical request fields', Boolean(noteWrite) && !Object.hasOwn(noteWrite.body, 'labWorkName') && !Object.hasOwn(noteWrite.body, 'clinicalNote'));

  await sentRow.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('heading', { name: 'Cancel Lab Order?', exact: true }).waitFor();
  await page.locator('label').filter({ hasText: 'Reason for cancellation' }).locator('..').getByRole('textbox').fill('Lab could not meet the requested date');
  await page.getByRole('button', { name: 'Cancel Order', exact: true }).click();
  await page.getByRole('button', { name: 'View cancelled', exact: true }).click();
  await page.getByText('Lab could not meet the requested date', { exact: true }).waitFor();
  const cancelled = await inspect(app);
  const cancelWrite = cancelled.calls.find(call => call.method === 'PATCH' && call.path === '/v1/lab-orders/44444444-4444-4444-8444-444444444444' && call.body.status === 'cancelled');
  check('cancellation sends its reason with the row version and preserves the cancelled order in audit history', cancelWrite?.body?.receptionNote === 'Lab could not meet the requested date' && cancelled.orders[1].status === 'cancelled');

  await app.evaluate(() => globalThis.m17LabTracker.selectModule('lab-suppliers'));
  await page.getByRole('heading', { name: 'Lab supplier record', exact: true }).waitFor();
  for (let index = 0; index < 40 && !(await inspect(app)).moduleAcks.length; index++) await new Promise(resolve => setTimeout(resolve, 50));
  check('second module selection is acknowledged in the same app package and runtime', (await inspect(app)).moduleSelectionResult?.ok === true && (await inspect(app)).moduleAcks.length === 1);
  await page.getByRole('button', { name: 'Add Lab Supplier', exact: true }).click();
  await page.getByRole('heading', { name: 'Register a Dental Lab Supplier', exact: true }).waitFor();
  await page.getByPlaceholder('e.g. Kantipur Dental Lab').fill('Synthetic New Lab');
  await page.getByRole('button', { name: 'Add Lab Supplier', exact: true }).last().click();
  const supplierSaved = await inspect(app);
  const supplierCreate = supplierSaved.calls.find(call => call.method === 'POST' && call.path === '/v1/clinic/suppliers');
  check('new lab supplier is created in the shared directory as a lab-only record', supplierCreate?.body?.supplierType === 'lab' && supplierCreate?.body?.openingBalanceAmount === 0 && Boolean(supplierCreate.operationId));

  const existingLabRow = page.getByRole('row').filter({ hasText: 'Bright Dental Lab' });
  await existingLabRow.getByRole('button', { name: 'Lab orders', exact: true }).click();
  await page.getByRole('heading', { name: 'Bright Dental Lab', exact: true }).waitFor();
  check('Lab supplier detail has no duplicate in-page Back button', await page.locator('[data-clinic-page-header] button').count() === 0);
  const visibleSupplierOrderRows = await page.getByRole('row').filter({ hasText: 'Synthetic Pending Patient' }).evaluateAll(rows => rows.filter(row => row.getClientRects().length > 0).length);
  check('Lab Supplier Record displays associated operational work history without finance balances', visibleSupplierOrderRows === 1 && !/current due|opening balance|supplier statement/i.test(await page.locator('body').innerText()));
  check('renderer completed workflows without errors and every write used an idempotency key', errors.length === 0 && supplierSaved.calls.filter(call => call.method !== 'GET').every(call => Boolean(call.operationId)));
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-lab-tracker-role-'));
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: { ...env, M17_DENY_ROLE: '1' }, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp); deniedPage.setDefaultTimeout(15000); deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByText('This app is not available for the current clinic role.', { exact: true }).waitFor();
  check('role without lab_tracker.access is denied before clinic business routes execute', (await inspect(deniedApp)).calls.length === 0);
  check('role-denied view contains no lab data or renderer errors', !(await deniedPage.locator('body').innerText()).includes('Synthetic Pending Patient') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17LabTrackerDiagnostic ?? null, calls: globalThis.m17LabTracker?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.lab-tracker.m17/'));
      if (targetPage) diagnostic.body = await targetPage.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? null);
      if (diagnostic.host) failure += `\nPrivate host: ${diagnostic.host}`;
      failure += `\nPrivate page diagnostic: ${JSON.stringify(diagnostic)}`;
    } catch {}
  }
  if (hostLogs.length) failure += `\nPrivate host stderr: ${hostLogs.join('').slice(-6000)}`;
  throw error;
} finally {
  if (app) await app.close();
  if (deniedApp) await deniedApp.close();
  if (deniedProfile) rmSync(deniedProfile, { recursive: true, force: true });
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo,
    scope: 'Private headless GNOME/Electron acceptance using a test-only ephemeral signing key and in-memory synthetic clinic API. No live clinic data or publication.',
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
}
