import { profileArgs } from './profile.mjs';
import { assertStandardPageScroll } from './standard-page-scroll-test.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const hostApp = path.join(root, 'tests/fixtures/m17-work-entry-app');
const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG', 'M17_DENY_ROLE']) delete env[key];
const stamp = new Date().toISOString().replaceAll(':', '-');
const reportPath = path.join(root, 'artifacts', `m17-work-entry-private-${stamp}.json`);
const screenshotPath = path.join(root, 'artifacts', `m17-work-entry-private-${stamp}.png`);
const checks = [], errors = [], hostLogs = [];
const check = (label, value = true) => { assert.ok(value, label); checks.push(label); console.log('PASS', label); };
let app, page, deniedApp, passed = false, packageInfo, failure, screenshotWritten = false, deniedProfile;
const waitForGuest = async target => {
  for (let attempt = 0; attempt < 160; attempt++) {
    const candidate = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.work-entry.m17/'));
    if (candidate) return candidate;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw new Error(`Work Entry guest did not open. Pages: ${target.context().pages().map(item => item.url()).join(', ')}`);
};
const inspect = target => target.evaluate(() => ({
  calls: globalThis.m17WorkEntry.calls.map(({ path, method, operationId, body }) => ({ path, method, operationId, body })),
  effects: globalThis.m17WorkEntry.effects(), moduleAcks: globalThis.m17WorkEntry.moduleAcks.slice(),
  moduleSelectionResult: globalThis.m17WorkEntry.moduleSelectionResult(), package: globalThis.m17WorkEntry.package,
}));

try {
  app = await electron.launch({ args: [hostApp, ...profileArgs], env, timeout: 30000 });
  app.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  page = await waitForGuest(app); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.getByRole('heading', { name: 'Work Entry', exact: true }).waitFor();
  await assertStandardPageScroll(page, check, 'Work Entry');
  await page.getByText('Synthetic Work Entry Patient', { exact: true }).waitFor();
  const initial = await inspect(app); packageInfo = initial.package;
  check('private signed package has Work Entry identity, version 1.0.2, and packaged assets', packageInfo.appId === 'company.dental.work-entry.m17' && packageInfo.version === '1.0.2' && packageInfo.wireBytes > 0 && packageInfo.wireBytes < 2 * 1024 * 1024 && packageInfo.assetCount >= 5);
  check('renderer receives the SDK bridge without a credential getter', await page.evaluate(() => {
    const methods = Object.keys(window.dentalApp ?? {});
    return ['cancel', 'connect', 'getAppInfo', 'request', 'report'].every(method => methods.includes(method))
      && !methods.some(method => /token|credential|fetch|storage/i.test(method));
  }));
  check('initial worklist reads use only its registered case, treatment-protocol, and staff-reference routes',
    initial.calls.filter(call => call.method === 'GET').map(call => call.path).sort().join('|') === '/v1/clinic/staff-references|/v1/treatment-protocols|/v1/work-entry/cases');
  check('worklist preserves the SaaS patient, complaint, protocol-count, and in-progress state',
    await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).getByText('Synthetic molar pain').count() === 1
      && await page.getByRole('row').filter({ hasText: 'Synthetic Work Entry Patient' }).getByText('In progress').count() === 1);
  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'wx' }); screenshotWritten = true;

  await app.evaluate(() => globalThis.m17WorkEntry.module());
  for (let index = 0; index < 40 && !(await inspect(app)).moduleAcks.length; index++) await new Promise(resolve => setTimeout(resolve, 50));
  const module = await inspect(app);
  check('Work Entry module selection is acknowledged after the package opens', module.moduleSelectionResult?.ok === true && module.moduleAcks.length === 1);

  await page.getByRole('button', { name: 'Start work', exact: true }).click();
  await page.getByText('Work Done Today', { exact: false }).waitFor();
  const opened = await inspect(app);
  const requiredReads = ['/v1/follow-ups', '/v1/patients/11111111-1111-4111-8111-111111111111/core',
    '/v1/patients/11111111-1111-4111-8111-111111111111/ledger', '/v1/patients/11111111-1111-4111-8111-111111111111/odontogram',
    '/v1/patients/11111111-1111-4111-8111-111111111111/periodontal-chart', '/v1/patients/11111111-1111-4111-8111-111111111111/canal-measurements',
    '/v1/clinic/suppliers?scope=lab', '/v1/chief-complaints/22222222-2222-4222-8222-222222222222/work-entry'];
  check('opening an in-progress case reads its clinical context through the approved SDK routes', requiredReads.every(route => opened.calls.some(call => call.method === 'GET' && call.path === route)));
  await page.getByRole('button', { name: /Patient & case/ }).click();
  await page.getByText('Synthetic Work Entry Patient', { exact: true }).waitFor();
  await page.getByRole('button', { name: /Imaging, Rx & Lab/ }).click();
  await page.getByText('Radiograph upload and withdrawal are not enabled', { exact: false }).waitFor();
  check('X-ray upload is visibly unavailable while this host release has no Work Entry upload grant',
    (await page.getByText('Radiograph upload and withdrawal are not enabled', { exact: false }).count()) === 1);
  check('opening the patient case performs no clinic writes', opened.effects === 0 && opened.calls.every(call => call.method === 'GET'));
  check('renderer errors stayed clear through worklist and clinical context views', errors.length === 0);
  await app.close(); app = undefined;

  deniedProfile = mkdtempSync(path.join(tmpdir(), 'electron-os-m17-work-entry-role-'));
  deniedApp = await electron.launch({ args: [hostApp, '--ozone-platform=wayland', `--user-data-dir=${deniedProfile}`], env: { ...env, M17_DENY_ROLE: '1' }, timeout: 30000 });
  deniedApp.process().stderr?.on('data', chunk => hostLogs.push(String(chunk)));
  const deniedPage = await waitForGuest(deniedApp); deniedPage.setDefaultTimeout(15000); deniedPage.on('pageerror', error => errors.push(error.message));
  await deniedPage.getByText('This app is not available for the current clinic role.', { exact: true }).waitFor();
  check('role without work_entry.access is denied before business routes execute', (await inspect(deniedApp)).calls.length === 0);
  check('role-denied view contains no clinic data or renderer errors', !(await deniedPage.locator('body').innerText()).includes('Synthetic Work Entry Patient') && errors.length === 0);
  passed = true;
} catch (error) {
  failure = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  const target = app ?? deniedApp;
  if (target) {
    try {
      const diagnostic = await target.evaluate(() => ({ host: globalThis.__m17WorkEntryDiagnostic ?? null, calls: globalThis.m17WorkEntry?.calls ?? null }));
      const targetPage = target.context().pages().find(item => item.url().startsWith('dental-fixture://company.dental.work-entry.m17/'));
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
