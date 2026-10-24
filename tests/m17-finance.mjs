import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const host = path.join(root, 'tests/fixtures/m17-finance-host.cjs');
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
  await page.getByRole('heading', { name: 'Transaction Record', exact: true }).waitFor();
  packageInfo = await app.evaluate(() => globalThis.m17Finance.package);
  check('private Finance package opens with its current identity and assets', packageInfo.appId === 'company.dental.finance.m17' && packageInfo.version === '1.7.4' && packageInfo.wireBytes > 0 && packageInfo.assetCount >= 5);
  check('Finance renders its initial page instead of a blank app window', await page.locator('[data-clinic-page-header]').innerText().then(value => value.includes('Transaction Record')));
  check('Finance completes its initial transaction report request', await app.evaluate(() => globalThis.m17Finance.calls.some(call => call.path.startsWith('/v1/clinic/transaction-record') && call.method === 'GET')));
  await page.getByText(/No transactions found/).waitFor();
  check('Finance shows the loaded empty state with no renderer errors', (await page.locator('body').innerText()).includes('No transactions found') && errors.length === 0);
  const selection = await app.evaluate(async () => {
    const result = await globalThis.m17Finance.selectModule('patient-payments');
    return { result, ackCount: globalThis.m17Finance.moduleAcks.length };
  });
  await page.getByRole('heading', { name: 'Patient payments', exact: true }).waitFor();
  check('OS module-selection event moves Finance to Patient payments and receives its acknowledgement', selection.result.ok === true && selection.ackCount >= 1);
  const screenshotPath = path.join(root, 'artifacts', 'm17-finance-private-latest.png');
  await fs.writeFile(screenshotPath, await page.screenshot(), { flag: 'w' });
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
    scope: 'Private headless GNOME/Electron startup check using an ephemeral test key and in-memory synthetic transaction report. No live clinic data or publication.' }, null, 2));
}
