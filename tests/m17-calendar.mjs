import { profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-calendar-host.cjs');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-calendar-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-calendar-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
let app, deniedApp, deniedProfile, page, passed = false, packageInfo, failure, screenshotWritten = false;
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.calendar.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Calendar guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  tasks: globalThis.m17.tasks.map(task => ({ ...task })), effects: globalThis.m17.effects(), package: globalThis.m17.package,
  today: globalThis.m17.today, todayBs: globalThis.m17.todayBs,
}));

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app);
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Calendar', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Calendar');
  const calendarContent = await page.locator('[data-sajilo-standard-scroll-content]').evaluate(content => ({
    hasNestedInset: content.classList.contains('calendarPageScrollContent'),
    padding: getComputedStyle(content).padding,
    margin: getComputedStyle(content).margin,
  }));
  check('Calendar uses the shared 22px by 26px page content inset without a nested card',
    !calendarContent.hasNestedInset && calendarContent.padding === '22px 26px 0px' && calendarContent.margin === '0px');
  const initial = await inspect(app); packageInfo = initial.package;
  const initialMonth = await page.locator('.calendarCard h2').innerText();
  check('ephemeral package has the Calendar 1.0.3 update identity and stays under the package cap', packageInfo.version === '1.0.3' && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024);
  check('calendar reads only through the SDK with a bounded BS month range', initial.calls.some(call => call.method === 'GET' && call.path.startsWith('/v1/calendar-tasks?')
    && (Date.parse(`${new URLSearchParams(call.path.split('?')[1]).get('to')}T00:00:00Z`) - Date.parse(`${new URLSearchParams(call.path.split('?')[1]).get('from')}T00:00:00Z`)) / 86400000 <= 45));
  const day = Number(initial.todayBs.split('-')[2]);
  await page.locator(`.calendarDay[aria-label^="${day} "]`).click();
  await page.getByRole('dialog', { name: /^\d+ \w+ \d{4}$/ }).waitFor();
  await page.getByText('Synthetic clinic task', { exact: true }).waitFor();
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' });
  screenshotWritten = true;

  const complete = page.getByRole('checkbox', { name: 'Complete Synthetic clinic task', exact: true });
  await complete.click();
  await page.getByRole('checkbox', { name: 'Reopen Synthetic clinic task', exact: true }).waitFor();
  let current = await inspect(app);
  const statusCall = current.calls.find(call => call.method === 'PATCH' && call.path.endsWith('/22222222-2222-4222-8222-222222222222'));
  check('task completion uses expected row version and reloads canonical clinic state', statusCall?.body.expectedRowVersion === 1 && statusCall?.body.status === 'completed' && current.tasks[0].status === 'completed');

  await app.evaluate(() => globalThis.m17.conflict());
  await page.getByRole('checkbox', { name: 'Reopen Synthetic clinic task', exact: true }).click();
  await page.getByText(/changed.*refresh/i).waitFor();
  current = await inspect(app);
  check('a stale row conflict refreshes and preserves the server task status', current.tasks[0].status === 'completed' && current.tasks[0].rowVersion === 3);
  await page.getByRole('checkbox', { name: 'Reopen Synthetic clinic task', exact: true }).click();
  await page.getByRole('checkbox', { name: 'Complete Synthetic clinic task', exact: true }).waitFor();
  current = await inspect(app);
  check('reopen sends the refreshed row version and returns the task to open', current.tasks[0].status === 'open' && current.calls.some(call => call.method === 'PATCH' && call.body.expectedRowVersion === 3 && call.body.status === 'open'));

  await page.getByLabel('Add a task').fill('Synthetic added clinic task');
  await page.getByRole('combobox', { name: 'Task category', exact: true }).selectOption('lab');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByText('Synthetic added clinic task', { exact: true }).waitFor();
  current = await inspect(app);
  const create = current.calls.find(call => call.method === 'POST' && call.path === '/v1/calendar-tasks');
  check('task creation sends the SaaS AD date, title, and category through an idempotent SDK command', create?.body.taskDate === current.today && create?.body.title === 'Synthetic added clinic task' && create?.body.category === 'lab' && !!create.operationId);

  const beforeDrop = await inspect(app);
  await app.evaluate(() => globalThis.m17.dropReply());
  await page.getByLabel('Add a task').fill('Synthetic uncertain task');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const daySheet = page.getByRole('dialog', { name: /^\d+ \w+ \d{4}$/ });
  await daySheet.getByRole('button', { name: 'Check original save', exact: true }).waitFor();
  const afterDrop = await inspect(app);
  const dropped = afterDrop.calls.filter(call => call.method === 'POST' && call.path === '/v1/calendar-tasks' && call.body.title === 'Synthetic uncertain task');
  check('lost create receipt leaves one committed synthetic row and offers original-command retry', afterDrop.effects === beforeDrop.effects + 1 && afterDrop.tasks.filter(task => task.title === 'Synthetic uncertain task').length === 1 && dropped.length === 1);
  await daySheet.getByRole('button', { name: 'Check original save', exact: true }).click();
  await page.getByText('Calendar task saved.', { exact: true }).waitFor();
  const afterRetry = await inspect(app);
  const retried = afterRetry.calls.filter(call => call.method === 'POST' && call.path === '/v1/calendar-tasks' && call.body.title === 'Synthetic uncertain task');
  check('retry reuses the same operation identity and does not create a duplicate', afterRetry.effects === afterDrop.effects && afterRetry.tasks.filter(task => task.title === 'Synthetic uncertain task').length === 1 && retried.length === 2 && retried[0].operationId === retried[1].operationId);

  await page.getByRole('button', { name: 'Remove task: Synthetic added clinic task', exact: true }).click();
  const confirm = page.getByRole('alertdialog', { name: 'Remove this task?' });
  await confirm.getByRole('button', { name: 'Remove task', exact: true }).click();
  await page.getByText('Synthetic added clinic task', { exact: true }).waitFor({ state: 'detached' });
  current = await inspect(app);
  check('archive uses the SaaS archive endpoint with expected row version and hides the archived task', current.tasks.find(task => task.title === 'Synthetic added clinic task')?.status === 'archived' && current.calls.some(call => call.method === 'POST' && call.path.endsWith('/archive') && call.body.expectedRowVersion === 1));

  await page.getByLabel('Add a task').fill('Unsaved draft');
  await page.getByRole('button', { name: 'Close calendar day', exact: true }).click();
  const discard = page.getByRole('alertdialog', { name: 'Discard unsaved task?' });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  check('dirty task draft survives a rejected day-sheet close', await page.getByLabel('Add a task').inputValue() === 'Unsaved draft');
  await page.getByRole('button', { name: 'Close calendar day', exact: true }).click();
  await page.getByRole('alertdialog', { name: 'Discard unsaved task?' }).getByRole('button', { name: 'Discard draft', exact: true }).click();
  check('confirmed discard closes the day sheet without saving its draft', await page.locator('.calendarDaySheet').count() === 0 && (await inspect(app)).tasks.every(task => task.title !== 'Unsaved draft'));
  await page.getByRole('button', { name: 'Next month', exact: true }).click();
  await page.waitForFunction((previous) => document.querySelector('.calendarCard h2')?.textContent !== previous, initialMonth);
  check('Bikram Sambat month navigation loads the next calendar month', await page.locator('.calendarCard h2').innerText() !== initialMonth);

  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await page.getByText('Synthetic clinic task', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Close calendar day', exact: true }).click();
  const beforeRevoke = (await inspect(app)).calls.length;
  await app.evaluate(() => globalThis.m17.revoke());
  await page.getByRole('button', { name: 'Refresh', exact: true }).click();
  await page.getByRole('heading', { name: 'Calendar unavailable', exact: true }).waitFor();
  check('session revocation clears Calendar data and blocks further clinic routes', !(await page.locator('body').innerText()).includes('Synthetic clinic task') && (await inspect(app)).calls.length === beforeRevoke);
  check('all Calendar renderer errors stayed clear during synthetic acceptance', errors.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-calendar-role-'));
  const deniedEnv = { ...env, M17_DENY_ROLE: '1' };
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: deniedEnv, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp);
  deniedPage.setDefaultTimeout(15000);
  deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByRole('heading', { name: 'Calendar unavailable', exact: true }).waitFor();
  check('host session capability denies Calendar before any clinic business route is called', (await inspect(deniedApp)).calls.length === 0 && (await deniedPage.locator('[role="alert"]').innerText()).includes('current clinic role'));
  check('role-denied Calendar renders no business rows or renderer errors', !(await deniedPage.locator('body').innerText()).includes('Synthetic clinic task') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17Diagnostic ?? null, calls: globalThis.m17?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.calendar.m17/'));
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
    scope: 'Private headless GNOME/Electron acceptance using an ephemeral test-only signing key and an in-memory synthetic Calendar service; no live staging reads/writes or publication.',
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
}
