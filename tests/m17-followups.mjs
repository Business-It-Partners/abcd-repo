import { profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-followups-app');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-followups-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-followups-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
let app, page, passed = false, packageInfo, failure, screenshotWritten = false;
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
const waitForGuest = async () => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = app.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.followups.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Follow-ups guest did not open. Pages: ${app.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = async () => app.evaluate(() => ({
  calls: globalThis.m17.calls.map(({ path, method, operationId }) => ({ path, method, operationId })),
  effects: globalThis.m17.effects(), rows: globalThis.m17.rows.map(row => ({ followUpId: row.followUpId, dueOn: row.dueOn, reason: row.reason, rowVersion: row.rowVersion, called: row.called, noAnswer: row.noAnswer })),
  moduleAcks: globalThis.m17.moduleAcks.slice(), moduleSelectionResult: globalThis.m17.moduleSelectionResult(), package: globalThis.m17.package,
}));
const tomorrow = iso => { const date = new Date(`${iso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + 1); return date.toISOString().slice(0, 10); };

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest();
  page.setDefaultTimeout(15000);
  page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Follow-ups', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Follow-ups');
  await page.getByText('Synthetic M17 Patient', { exact: true }).waitFor();
  const initial = await inspect(); packageInfo = initial.package;
  check('ephemeral signed package is Follow-ups 1.0.5 and is below the 2 MiB package asset cap', packageInfo.version === '1.0.5' && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024);
  check('app is isolated behind the current renderer-safe SDK with no credential or shell Files transfer getter', await page.evaluate(() => Object.keys(window.dentalApp).sort().join(',') === 'cancel,connect,getAppInfo,navigation,onModuleSelected,openAppExplorer,report,request'));
  check('initial business reads use only the registered worklist and staff-reference routes', initial.calls.filter(call => call.method === 'GET').map(call => call.path.split('?')[0]).sort().join('|') === '/v1/clinic/staff-references|/v1/follow-ups');
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' });
  screenshotWritten = true;

  await app.evaluate(() => globalThis.m17.module());
  for (let i = 0; i < 40 && !(await inspect()).moduleAcks.length; i++) await new Promise(resolve => setTimeout(resolve, 50));
  check('the registered Follow-ups module selection is accepted after the app acknowledges it', (await inspect()).moduleSelectionResult?.ok === true && (await inspect()).moduleAcks.length === 1);

  const row = page.locator('[data-clinic-data-table] tbody tr').filter({ hasText: 'Synthetic M17 Patient' }).first();
  await page.getByRole('button', { name: 'Create follow-up', exact: true }).click();
  const draft = page.getByRole('dialog', { name: 'Create follow-up' });
  const doctorOptions = await draft.locator('#create-follow-up-doctor option').allTextContents();
  check('staff selection includes only the active synthetic doctor', doctorOptions.some(value => value.includes('Synthetic Doctor')) && !doctorOptions.some(value => /Inactive|Helper/.test(value)));
  const patientSearch = draft.locator('#create-follow-up-patient-search');
  await patientSearch.fill('Synthetic');
  await draft.getByRole('option', { name: /Synthetic M17 Patient/ }).waitFor();
  await patientSearch.press('ArrowDown'); await patientSearch.press('Enter');
  await draft.locator('#create-follow-up-doctor').selectOption('22222222-2222-4222-8222-222222222222');
  const today = (await app.evaluate(() => globalThis.m17.today));
  await draft.locator('#create-follow-up-date').click();
  await page.getByRole('button', { name: new RegExp(`\\(${today}\\)$`) }).click();
  await draft.locator('#create-follow-up-reason').fill('Synthetic unsaved draft');
  await draft.getByRole('button', { name: 'Cancel', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?' });
  await discard.getByRole('button', { name: 'Keep editing', exact: true }).click();
  check('dirty create form can be kept open without losing its synthetic draft', await draft.isVisible() && await draft.locator('#create-follow-up-reason').inputValue() === 'Synthetic unsaved draft');
  await draft.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('dialog', { name: 'Discard unsaved changes?' }).getByRole('button', { name: 'Discard changes', exact: true }).click();
  await draft.waitFor({ state: 'detached' });
  check('discard confirmation clears the draft and closes the create form');

  const fillCreate = async reason => {
    await page.getByRole('button', { name: 'Create follow-up', exact: true }).click();
    const form = page.getByRole('dialog', { name: 'Create follow-up' });
    await form.locator('#create-follow-up-patient-search').fill('Synthetic');
    await form.getByRole('option', { name: /Synthetic M17 Patient/ }).waitFor();
    await form.locator('#create-follow-up-patient-search').press('Enter');
    await form.locator('#create-follow-up-doctor').selectOption('22222222-2222-4222-8222-222222222222');
    await form.locator('#create-follow-up-date').click();
  await page.getByRole('button', { name: new RegExp(`\\(${today}\\)$`) }).click();
    await form.locator('#create-follow-up-reason').fill(reason);
    return form;
  };
  const successfulForm = await fillCreate('Synthetic successful create');
  await successfulForm.getByRole('button', { name: 'Schedule follow-up', exact: true }).click();
  await successfulForm.waitFor({ state: 'detached' });
  await page.waitForFunction(() => document.querySelectorAll('[data-clinic-data-table] tbody tr').length === 2);
  check('synthetic patient search, active doctor selection, Nepal date and create command complete');
  check('create command adds one server-side follow-up and reloads both canonical rows', (await inspect()).effects === 1 && (await inspect()).rows.length === 2 && (await inspect()).rows[1].reason === 'Synthetic successful create');

  await app.evaluate(() => globalThis.m17.deny());
  const beforeDenied = (await inspect()).calls.length;
  await row.locator('[title="Mark as called"]').click();
  await page.waitForTimeout(250);
  check('host route authorization denies the write before the synthetic transport sees it', (await inspect()).calls.length === beforeDenied && await row.locator('[title="Mark as called"]').getAttribute('aria-pressed') === 'false');
  await app.evaluate(() => globalThis.m17.allow());
  await row.locator('[title="Mark as called"]').click();
  await page.waitForFunction(() => document.querySelector('[title="Unmark called"]')?.getAttribute('aria-pressed') === 'true');
  check('a permitted call mark persists and the queue reloads its canonical state', (await inspect()).effects === 2 && (await inspect()).calls.some(call => call.method === 'PATCH' && call.path.endsWith('/toggle')));

  await app.evaluate(() => globalThis.m17.conflict());
  await row.locator('[title="Mark as no response"]').click();
  await page.waitForTimeout(350);
  check('a row-version conflict leaves the stored response mark unchanged and reloads the queue', (await inspect()).effects === 2 && (await inspect()).rows[0].noAnswer === false);
  await row.locator('[title="Mark as no response"]').click();
  await page.waitForFunction(() => document.querySelector('[title="Remove no-response mark"]')?.getAttribute('aria-pressed') === 'true');
  check('a fresh decision after conflict succeeds with a new operation identity', (await inspect()).effects === 3);

  await row.getByRole('button', { name: 'Reschedule', exact: true }).click();
  const reschedule = page.getByRole('dialog', { name: /Reschedule for Synthetic M17 Patient/ });
  const nextDay = tomorrow(today);
  await reschedule.locator('#reschedule-follow-up-date').click();
  await page.getByRole('button', { name: new RegExp(`\\(${nextDay}\\)$`) }).click();
  await reschedule.locator('#reschedule-follow-up-reason').fill('Synthetic rescheduled reason');
  await reschedule.getByRole('button', { name: 'Save follow-up', exact: true }).click();
  await page.getByRole('dialog', { name: 'Follow-up rescheduled' }).getByRole('button', { name: 'OK', exact: true }).click();
  await page.getByRole('button').filter({ hasText: 'remaining till Saturday' }).click();
  check('reschedule command persists the new date, time and reason through the SDK', (await inspect()).rows[0].dueOn === nextDay && (await inspect()).rows[0].reason === 'Synthetic rescheduled reason');
  check('the default viewport keeps the page fixed and renders the table in its own wrapper', await page.evaluate(() => {
    const canvas = document.querySelector('.clinicWorkspaceCanvas'), table = document.querySelector('[data-clinic-data-table] table');
    return !!canvas && canvas.scrollWidth <= canvas.clientWidth + 2 && !!table?.parentElement;
  }));

  const beforeDrop = await inspect();
  const uncertainForm = await fillCreate('Synthetic dropped-reply create');
  await app.evaluate(() => globalThis.m17.dropReply());
  await uncertainForm.getByRole('button', { name: 'Schedule follow-up', exact: true }).click();
  await uncertainForm.getByRole('button', { name: 'Retry original save', exact: true }).waitFor();
  const afterCommitDrop = await inspect();
  check('response-loss fixture committed a single synthetic create before returning an unknown result', afterCommitDrop.effects === beforeDrop.effects + 1);
  await uncertainForm.getByRole('button', { name: 'Retry original save', exact: true }).click();
  await page.getByText('Synthetic M17 Patient', { exact: true }).first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[role="alert"]')?.textContent?.includes('uncertain result'));
  const afterRetry = await inspect();
  const droppedPosts = afterRetry.calls.filter(call => call.method === 'POST' && call.path === '/v1/follow-ups');
  check('retry reuses the original request key and payload, returning one create receipt without a duplicate', afterRetry.effects === beforeDrop.effects + 1 && afterRetry.rows.length === 3 && afterRetry.rows[2].reason === 'Synthetic dropped-reply create' && droppedPosts.length === 3 && droppedPosts.at(-1).operationId === droppedPosts.at(-2).operationId);

  await app.evaluate(() => globalThis.m17.resize(760, 600));
  await page.waitForFunction(() => innerWidth <= 760 && innerHeight <= 600);
  check('compact viewport keeps the page fixed while the 1080px table scrolls inside its own wrapper', await page.evaluate(() => {
    const canvas = document.querySelector('.clinicWorkspaceCanvas'), table = document.querySelector('[data-clinic-data-table] table'), wrapper = table?.parentElement;
    return !!canvas && canvas.scrollWidth <= canvas.clientWidth + 2 && !!wrapper && wrapper.scrollWidth > wrapper.clientWidth;
  }));
  await app.evaluate(() => globalThis.m17.resize(1200, 850));
  await page.waitForFunction(() => innerWidth >= 1190 && innerHeight >= 840);

  const widthBeforeRevoke = (await inspect()).calls.length;
  await app.evaluate(() => globalThis.m17.revoke());
  await page.getByRole('button', { name: 'Refresh Follow-ups' }).click();
  await page.getByRole('heading', { name: 'Follow-ups unavailable', exact: true }).waitFor();
  check('session revocation clears rendered clinic records and prevents further route calls', !(await page.locator('body').innerText()).includes('Synthetic M17 Patient') && (await inspect()).calls.length === widthBeforeRevoke);
  check('the signed module API and browser console stayed within the synthetic first-party path', errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  if (app) {
    try {
      const diagnostic = await app.evaluate(() => ({
        host: globalThis.__m17Diagnostic ?? null,
        calls: globalThis.m17?.calls ?? null,
      }));
      if (page) diagnostic.body = await page.evaluate(() => document.body?.innerText?.slice(0, 3000) ?? null);
      if (diagnostic.host) failure += `\nPrivate host: ${diagnostic.host}`;
      failure += `\nPrivate page diagnostic: ${JSON.stringify(diagnostic)}`;
    } catch {}
  }
  if (hostLogs.length) failure += `\nPrivate host stderr: ${hostLogs.join('').slice(-6000)}`;
  throw error;
} finally {
  if (app) await app.close();
  await fs.mkdir(path.dirname(reportPath), { recursive: true });
  await fs.writeFile(reportPath, JSON.stringify({ passed, failure: failure ?? null, checks, errors, package: packageInfo, scope: 'Private headless GNOME/Electron acceptance using an ephemeral test-only signing key and in-memory synthetic service; no live staging data or publication.', screenshot: screenshotWritten ? path.basename(screenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
}
