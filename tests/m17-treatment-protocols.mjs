import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-treatment-protocols-app');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-treatment-protocols-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-treatment-protocols-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.m17.treatment-protocols/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Treatment Protocols guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  protocols: globalThis.m17.protocols.map(row => ({ protocolId: row.protocolId, name: row.name, active: row.active, totalPrice: row.totalPrice, rowVersion: row.rowVersion, stages: row.stages.map(stage => ({ stageName: stage.stageName, stageOrder: stage.stageOrder, price: stage.price, active: stage.active })) })),
  effects: globalThis.m17.effects(), moduleAcks: globalThis.m17.moduleAcks.slice(), moduleSelectionResult: globalThis.m17.moduleSelectionResult(), package: globalThis.m17.package,
}));
const waitForNavigation = async target => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const value = await target.evaluate(() => globalThis.m17.navigation());
    if (value?.index >= 0) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error('Treatment Protocols did not report its page history to the host.');
};

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Treatment Protocols', exact: true }).waitFor();
  await page.getByText(/Synthetic Root Canal/).waitFor();
  await page.getByText('Opening treatment protocols…', { exact: true }).waitFor({ state: 'hidden' });
  const initial = await inspect(app); packageInfo = initial.package;
  check('private signed package has the updated M17 identity and version 1.0.1', packageInfo.appId === 'company.dental.m17.treatment-protocols' && packageInfo.version === '1.0.1' && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024);
  check('renderer receives the SDK bridge without a credential getter', await page.evaluate(() => {
    const methods = Object.keys(window.dentalApp ?? {});
    return ['cancel', 'connect', 'getAppInfo', 'navigation', 'request', 'report'].every(method => methods.includes(method))
      && !methods.some(method => /token|credential|fetch|storage/i.test(method));
  }));
  check('initial list reads use only the SaaS treatment-protocol route', initial.calls.filter(call => call.method === 'GET').map(call => call.path).join('|') === '/v1/treatment-protocols');
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' }); screenshotWritten = true;

  await app.evaluate(() => globalThis.m17.module());
  for (let index = 0; index < 40 && !(await inspect(app)).moduleAcks.length; index++) await new Promise(resolve => setTimeout(resolve, 50));
  check('Treatment Protocols module selection is acknowledged', (await inspect(app)).moduleSelectionResult?.ok === true && (await inspect(app)).moduleAcks.length === 1);
  await page.getByRole('button', { name: 'New protocol', exact: true }).click();
  let modal = page.getByRole('dialog', { name: 'New treatment protocol' });
  await modal.getByLabel('Protocol name').fill('Synthetic Crown Protocol');
  await modal.getByRole('button', { name: 'Create protocol', exact: true }).click();
  await modal.waitFor({ state: 'detached' });
  await page.getByRole('heading', { name: 'Synthetic Crown Protocol', exact: true }).waitFor();
  const created = await inspect(app);
  check('new protocol is created through POST and opens the SaaS detail editor', created.effects === 1 && created.calls.some(call => call.method === 'POST' && call.path === '/v1/treatment-protocols' && call.body.name === 'Synthetic Crown Protocol'));
  const detailHistory = await waitForNavigation(app);
  check('protocol detail reports only opaque UUID entries to the OS', detailHistory?.index === 1 && detailHistory.entries.length === 2 && detailHistory.entries.every(entry => /^[0-9a-f-]{36}$/i.test(entry)));
  check('OS Back returns from protocol detail to the catalogue', await app.evaluate(() => globalThis.m17.navigate('back')));
  await page.getByRole('heading', { name: 'Treatment Protocols', exact: true }).waitFor();
  check('OS Forward restores the protocol detail page', await app.evaluate(() => globalThis.m17.navigate('forward')));
  await page.getByRole('heading', { name: 'Synthetic Crown Protocol', exact: true }).waitFor();

  await page.getByRole('button', { name: 'Add stage', exact: true }).click();
  await page.getByRole('textbox', { name: 'Stage 1 description' }).fill('Prepare the tooth');
  await page.getByRole('textbox', { name: 'Stage 1 cost in NPR' }).fill('12500');
  await page.getByLabel('Record canal measurements for this treatment').check();
  check('OS Back is blocked while the protocol detail has unsaved edits', !(await app.evaluate(() => globalThis.m17.navigate('back'))));
  await page.getByRole('heading', { name: 'Synthetic Crown Protocol', exact: true }).waitFor();
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Treatment protocol updated.', { exact: true }).waitFor();
  const afterEdit = await inspect(app);
  const firstPut = afterEdit.calls.find(call => call.method === 'PUT' && call.path.endsWith('/44444444-4444-4444-8444-444444444444'));
  check('stage order, pricing and clinical settings are saved through PUT with the canonical row version', afterEdit.effects === 2 && firstPut?.body.rowVersion === 1 && firstPut.body.stages[0].stageOrder === 1 && firstPut.body.stages[0].price === 12500 && firstPut.body.recordsCanalMeasurements === true);

  await app.evaluate(() => globalThis.m17.conflict());
  await page.getByRole('textbox', { name: 'Stage 1 cost in NPR' }).fill('13000');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText(/changed elsewhere/, { exact: false }).waitFor();
  check('409 row-version conflict is shown and canonical state is refreshed', (await inspect(app)).effects === 2 && (await inspect(app)).protocols.some(row => row.name === 'Synthetic Crown Protocol' && row.rowVersion === 3));

  await page.getByRole('textbox', { name: 'Stage 1 cost in NPR' }).fill('13500');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByText('Treatment protocol updated.', { exact: true }).waitFor();
  await app.evaluate(() => globalThis.m17.dropReply());
  await page.getByRole('textbox', { name: 'Stage 1 cost in NPR' }).fill('14000');
  await page.getByRole('button', { name: 'Save changes', exact: true }).click();
  await page.getByRole('button', { name: 'Check original save', exact: true }).waitFor();
  check('uncertain update locks the original form and offers same-command reconciliation', await page.getByRole('textbox', { name: 'Stage 1 cost in NPR' }).isDisabled());
  const beforeRetry = await inspect(app), requestsBeforeRetry = beforeRetry.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/44444444-4444-4444-8444-444444444444'));
  check('dropped receipt follows one committed update and records its operation identity', beforeRetry.effects === 4 && beforeRetry.protocols.find(row => row.name === 'Synthetic Crown Protocol')?.totalPrice === 14000 && !!requestsBeforeRetry.at(-1)?.operationId);
  await page.getByRole('button', { name: 'Check original save', exact: true }).click();
  await page.getByText('Original treatment protocol save confirmed.', { exact: true }).waitFor();
  const afterRetry = await inspect(app), retryCalls = afterRetry.calls.filter(call => call.method === 'PUT' && call.path.endsWith('/44444444-4444-4444-8444-444444444444'));
  check('same-key retry confirms the original update without a duplicate effect', afterRetry.effects === beforeRetry.effects && retryCalls.at(-1).operationId === retryCalls.at(-2).operationId);

  let confirmationAccepted = false;
  page.once('dialog', async dialog => { confirmationAccepted = dialog.type() === 'confirm'; await dialog.accept(); });
  await page.getByRole('button', { name: 'Delete protocol', exact: true }).click();
  await page.getByRole('heading', { name: 'Treatment Protocols', exact: true }).waitFor();
  const retired = await inspect(app);
  check('retire uses SaaS soft-delete semantics through PUT active=false', confirmationAccepted && retired.effects === 5 && retired.calls.some(call => call.method === 'PUT' && call.body.active === false));
  check('all renderer errors stayed clear through the synthetic protocol workflow', errors.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-treatment-protocols-role-'));
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: { ...env, M17_DENY_ROLE: '1' }, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp); deniedPage.setDefaultTimeout(15000); deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByText('This app is not available for the current clinic role.', { exact: true }).waitFor();
  check('role without treatment_protocols.manage is denied before business routes execute', (await inspect(deniedApp)).calls.length === 0);
  check('role-denied view contains no protocol data or renderer error', !(await deniedPage.locator('body').innerText()).includes('Synthetic Root Canal') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17Diagnostic ?? null, calls: globalThis.m17?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.m17.treatment-protocols/'));
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
    scope: 'Private headless GNOME/Electron acceptance using a test-only ephemeral signing key and in-memory synthetic clinic API. No live staging data or publication.',
    screenshot: screenshotWritten ? path.basename(screenshotPath) : null }, null, 2), { flag: 'wx' });
  console.log('ARTIFACT', reportPath);
  if (screenshotWritten) console.log('ARTIFACT', screenshotPath);
}
