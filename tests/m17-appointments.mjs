import { profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-appointments-app');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-appointments-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-appointments-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.appointments.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Appointments guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  effects: globalThis.m17.effects(),
  appointments: globalThis.m17.appointments.map(row => ({ appointmentId: row.appointmentId, patientName: row.patientName, appointmentDate: row.appointmentDate, startMinute: row.startMinute, status: row.status, rowVersion: row.rowVersion })),
  moduleAcks: globalThis.m17.moduleAcks.slice(), moduleSelectionResult: globalThis.m17.moduleSelectionResult(), package: globalThis.m17.package,
}));

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app);
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Appointments', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Appointments');
  await page.getByText('Synthetic M17 Appointment', { exact: true }).waitFor();
  const initial = await inspect(app); packageInfo = initial.package;
  check('ephemeral signed package has the declared 1.0.4 update identity and stays below the package asset cap', packageInfo.version === '1.0.4' && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024);
  const tableHeaders = await page.locator('.appointmentTable thead th').allTextContents();
  check('appointments screen follows the SaaS day-book layout with summary cards, date controls, and the same status columns',
    await page.locator('.appointmentSummaryCard').count() === 4
      && await page.getByRole('button', { name: 'Previous day' }).count() === 1
      && tableHeaders.map(value => value.trim()).join('|') === 'Time|Patient|Reason|Phone|Arrived|No-show|Cancel|Action');
  check('Doctor is absent from table cells while remaining available as a schedule filter', await page.locator('.appointmentTable [data-label="Doctor"]').count() === 0 && await page.getByRole('combobox', { name: 'Doctor', exact: true }).isVisible());
  check('the initial schedule is the current day rather than the cancelled summary bucket', await page.locator('.appointmentSummaryCard[aria-pressed="true"]').count() === 0 && (initial.calls.find(call => call.method === 'GET' && call.path.startsWith('/v1/appointments?'))?.path.includes('date=') ?? false));
  check('renderer receives only the current SDK bridge surface and no credential getter', await page.evaluate(() => Object.keys(window.dentalApp).sort().join(',') === 'cancel,connect,getAppInfo,navigation,onFilesReceived,onModuleSelected,openAppExplorer,report,request'));
  check('initial reads use only the registered appointment and staff-reference routes', initial.calls.filter(call => call.method === 'GET').map(call => call.path.split('?')[0]).sort().join('|') === '/v1/appointments|/v1/appointments/summary|/v1/clinic/staff-references');
  check('the active-doctor filter excludes inactive doctors and non-doctor staff', await page.getByRole('combobox', { name: 'Doctor', exact: true }).locator('option').allTextContents().then(values => values.includes('Synthetic Doctor') && !values.some(value => /Inactive|Helper/.test(value))));
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' });
  screenshotWritten = true;

  await app.evaluate(() => globalThis.m17.module());
  for (let i = 0; i < 40 && !(await inspect(app)).moduleAcks.length; i++) await new Promise(resolve => setTimeout(resolve, 50));
  const module = await inspect(app);
  check('registered Appointments module selection is acknowledged after app readiness', module.moduleSelectionResult?.ok === true && module.moduleAcks.length === 1);

  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  let form = page.getByRole('dialog', { name: 'Book appointment' });
  await form.getByLabel('Name', { exact: true }).fill('Synthetic draft appointment');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  check('dirty booking draft can be kept without losing entered synthetic details', await form.isVisible() && await form.getByLabel('Name', { exact: true }).inputValue() === 'Synthetic draft appointment');
  await form.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
  await form.waitFor({ state: 'detached' });
  check('discard confirmation closes the booking form without creating a server row', (await inspect(app)).effects === 0);

  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Book appointment' });
  await form.getByLabel('Name', { exact: true }).fill('Synthetic overlap candidate');
  await form.getByRole('combobox', { name: 'Hour', exact: true }).selectOption('10');
  await form.getByRole('combobox', { name: 'Minute', exact: true }).selectOption('30');
  await form.getByRole('status').filter({ hasText: 'Possible doctor overlap' }).waitFor();
  check('same-doctor overlap warning blocks a locally visible conflicting slot', await form.getByRole('button', { name: 'Book appointment', exact: true }).isDisabled());
  await form.getByRole('combobox', { name: 'Hour', exact: true }).selectOption('11');
  await form.getByRole('combobox', { name: 'Minute', exact: true }).selectOption('0');
  await form.getByRole('textbox', { name: 'Reason', exact: true }).fill('Synthetic local acceptance');
  await form.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await form.waitFor({ state: 'detached' });
  await page.getByText('Synthetic local acceptance', { exact: true }).waitFor();
  const afterCreate = await inspect(app);
  const createCall = afterCreate.calls.find(call => call.method === 'POST' && call.path === '/v1/appointments');
  check('booking uses the SDK command with standalone diary fields and no patient-record ID', afterCreate.effects === 1 && createCall && !Object.hasOwn(createCall.body, 'patientId') && createCall.body.patientName === 'Synthetic overlap candidate' && createCall.body.startMinute === 660);
  check('half-open adjacent appointment slot is accepted and reflected in the refreshed schedule', afterCreate.appointments.length === 2 && afterCreate.appointments.some(row => row.startMinute === 660));

  const newRow = page.getByRole('row').filter({ hasText: 'Synthetic overlap candidate' });
  const status = newRow.getByRole('checkbox', { name: 'Mark arrived', exact: true });
  await status.click();
  await page.getByText('Appointment status saved.', { exact: true }).waitFor();
  check('permitted status change saves through the idempotent status route', (await inspect(app)).appointments.some(row => row.appointmentId === '33333333-3333-4333-8333-333333333333' && row.status === 'arrived') && (await inspect(app)).calls.some(call => call.method === 'POST' && call.path.endsWith('/status')));

  await newRow.getByRole('button', { name: 'Reschedule', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Reschedule appointment' });
  await form.getByRole('combobox', { name: 'Hour', exact: true }).selectOption('12');
  await form.getByRole('combobox', { name: 'Minute', exact: true }).selectOption('0');
  await form.getByRole('button', { name: 'Save reschedule', exact: true }).click();
  await form.waitFor({ state: 'detached' });
  const afterReschedule = await inspect(app);
  check('reschedule sends expected row version and refreshed data contains the new time', afterReschedule.appointments.some(row => row.appointmentId === '33333333-3333-4333-8333-333333333333' && row.startMinute === 720 && row.rowVersion === 3) && afterReschedule.calls.some(call => call.method === 'PATCH' && call.path.endsWith('/33333333-3333-4333-8333-333333333333') && call.body.expectedRowVersion === 2));

  const afterConflictStart = await inspect(app);
  await app.evaluate(() => globalThis.m17.conflict());
  const currentStatus = newRow.getByRole('checkbox', { name: 'Cancel booking', exact: true });
  await currentStatus.click();
  await page.getByText(/changed or overlaps another booking/, { exact: false }).waitFor();
  const afterConflict = await inspect(app);
  check('409 conflict refreshes canonical row version without applying the rejected status', afterConflict.effects === afterConflictStart.effects && afterConflict.appointments.find(row => row.appointmentId === '33333333-3333-4333-8333-333333333333')?.status === 'arrived');

  await app.evaluate(() => globalThis.m17.dropReply());
  await page.getByRole('button', { name: 'Book appointment', exact: true }).click();
  form = page.getByRole('dialog', { name: 'Book appointment' });
  await form.getByLabel('Name', { exact: true }).fill('Synthetic dropped-reply appointment');
  await form.getByRole('combobox', { name: 'Hour', exact: true }).selectOption('1');
  await form.getByRole('button', { name: 'PM', exact: true }).click();
  await form.getByRole('textbox', { name: 'Reason', exact: true }).fill('Synthetic uncertain receipt');
  await form.getByRole('button', { name: 'Book appointment', exact: true }).click();
  await form.getByRole('button', { name: 'Check original save', exact: true }).waitFor();
  check('unresolved booking keeps the modal open, disables edits, and offers only original-save reconciliation', await form.getByRole('textbox', { name: 'Name', exact: true }).isDisabled() && await form.getByRole('button', { name: 'Book appointment', exact: true }).isDisabled() && await form.getByRole('button', { name: 'Cancel', exact: true }).isDisabled());
  const afterDrop = await inspect(app);
  const droppedPosts = afterDrop.calls.filter(call => call.method === 'POST' && call.path === '/v1/appointments');
  check('response-loss fixture committed exactly one row before returning an uncertain receipt', afterDrop.effects === afterConflict.effects + 1 && afterDrop.appointments.length === 3 && droppedPosts.at(-1).body.patientName === 'Synthetic dropped-reply appointment');
  await form.getByRole('button', { name: 'Check original save', exact: true }).click();
  await form.waitFor({ state: 'detached' });
  await page.getByText('Appointment confirmed.', { exact: true }).waitFor();
  const afterRetry = await inspect(app);
  const retriedPosts = afterRetry.calls.filter(call => call.method === 'POST' && call.path === '/v1/appointments');
  check('original retry reuses the operation identity and returns one receipt without a duplicate', afterRetry.effects === afterDrop.effects && afterRetry.appointments.length === 3 && retriedPosts.length === 3 && retriedPosts.at(-1).operationId === retriedPosts.at(-2).operationId);

  const beforeRevoke = (await inspect(app)).calls.length;
  await app.evaluate(() => globalThis.m17.revoke());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('heading', { name: 'Appointments unavailable', exact: true }).waitFor();
  check('revocation clears rendered appointment data and blocks any further route calls', !(await page.locator('body').innerText()).includes('Synthetic M17 Appointment') && (await inspect(app)).calls.length === beforeRevoke);
  check('all renderer errors stayed clear during synthetic workflow acceptance', errors.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-appointments-role-'));
  const deniedEnv = { ...env, M17_DENY_ROLE: '1' };
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: deniedEnv, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp);
  deniedPage.setDefaultTimeout(15000);
  deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByRole('heading', { name: 'Appointments unavailable', exact: true }).waitFor();
  check('host session-capability policy denies the app before any clinic business route is called', (await inspect(deniedApp)).calls.length === 0 && (await deniedPage.locator('[role="alert"]').innerText()).includes('current clinic role'));
  check('role-denied page has no business data or renderer error', !(await deniedPage.locator('body').innerText()).includes('Synthetic M17 Appointment') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17Diagnostic ?? null, calls: globalThis.m17?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.appointments.m17/'));
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
  await fs.writeFile(reportPath, JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo, scope: 'Private headless GNOME/Electron acceptance using an ephemeral test-only signing key and in-memory synthetic clinic service; no live staging data or publication. The pinned SaaS route role-guard gap is not established by this fixture.', screenshot: screenshotWritten ? path.basename(screenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
}
