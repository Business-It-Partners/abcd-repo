// Read-only staging readback for the M18 synthetic expense void. Private display only.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) throw new Error('Explicit approved staging UI acceptance required');
const root = path.resolve(import.meta.dirname, '..');
const evidenceDir = path.join(root, 'dental-os_v1_working_info/milestone-18-dental-app-testing/evidence');
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const stat = await fs.lstat(credentialFile);
if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096 || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) throw new Error('Unsafe credential input');
let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') throw new Error('Invalid credential input');

const appId = 'company.dental.finance.m17';
const version = '1.7.7';
const payloadDigest = '1a224065b7a9aa630fba1496bb101e1ff5479d7b958775d7e42b85164be3bc63';
const namespace = 'M18-FIN-20261024-BB86171A';
const syntheticPayee = `${namespace} general expense`;
const cases = [];
let app;
let shell;
let guest;
let trace = [];
let phase = 'launch';
let failed = false;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const getTrace = async () => app.evaluate(() => Array.isArray(globalThis.__m18FinanceApiTrace) ? globalThis.__m18FinanceApiTrace.map((item, index) => ({ ...item, index })) : null);
const waitTrace = async (predicate, label, timeout = 15000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const current = await getTrace();
    if (!current) throw new Error('API trace switch unavailable');
    const match = current.find(predicate);
    if (match) return match;
    await pause(100);
  }
  throw new Error(`Trace deadline: ${label}`);
};
try {
  const env = { ...process.env };
  for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging', '--m18-finance-api-trace'], env, timeout: 30000 });
  shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);
  phase = 'staging-login';
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.locator('.statusbar-account-menu > summary').waitFor({ state: 'visible', timeout: 25000 });
  const session = await shell.evaluate(() => window.desktop.identity.view());
  if (session.phase !== 'ready' || session.mode !== 'staging') throw new Error('Authenticated session is not staging');
  credentials.password = undefined;
  phase = 'signed-store-install';
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'App Store' }).waitFor();
  await shell.getByRole('button', { name: 'Details Finance', exact: true }).click();
  await shell.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
  const storeText = await shell.locator('.delivery-store-versions').innerText();
  if (!storeText.includes(version) || !/Not installed/.test(storeText)) throw new Error('Expected Finance staging package is unavailable');
  await shell.getByRole('button', { name: 'Install', exact: true }).click();
  await shell.locator(`[data-dock-app="${appId}"]`).waitFor({ state: 'visible', timeout: 30000 });
  await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 15000 });
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId, { timeout: 30000 });
  for (let i = 0; i < 200; i += 1) {
    guest = app.context().pages().find(page => !page.isClosed() && page.url().startsWith(`dental-fixture://${appId}/`));
    if (guest) break;
    await pause(100);
  }
  if (!guest) throw new Error('Finance guest window did not open');
  guest.setDefaultTimeout(20000);
  await guest.locator(`main[data-dental-os-app="${appId}"]`).waitFor();
  await guest.getByRole('heading', { name: 'Financial overview', exact: true }).waitFor();
  phase = 'package-health';
  await waitTrace(item => item.method === 'GET' && item.route === '/v1/clinic/transaction-record' && item.status === 200, 'transaction report');
  const registryPath = path.join(await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData')), 'packages', 'registry.json');
  let registry;
  for (let i = 0; i < 150; i += 1) {
    try {
      registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      if (registry.apps[appId]?.knownGood === payloadDigest) break;
    } catch {}
    await pause(100);
  }
  if (registry?.apps[appId]?.knownGood !== payloadDigest) throw new Error('Signed Finance package health was not confirmed');
  phase = 'read-only-expense-readback';
  await shell.getByRole('navigation', { name: 'Finance modules' }).getByRole('button', { name: 'General expenses', exact: true }).click();
  await guest.getByRole('heading', { name: 'General expenses', exact: true }).waitFor();
  await waitTrace(item => item.method === 'GET' && item.route === '/v1/clinic/operating-expenses' && item.status === 200, 'expense list readback');
  const remaining = await guest.getByRole('row').filter({ hasText: syntheticPayee }).count();
  if (remaining !== 0) throw new Error('Voided M18 synthetic expense remains visible in the active list');
  trace = await getTrace() ?? [];
  if (trace.some(item => item.method === 'POST')) throw new Error('Readback-only run unexpectedly issued a business write');
  if (trace.some(item => /patient-payments|\/v1\/clinic\/patients/.test(item.route))) throw new Error('Out-of-scope patient route was called');
  if (!trace.every(item => item.appId === appId && item.appVersion === version)) throw new Error('Unexpected app identity in trace');
  cases.push({ name: 'Finance UI readback confirms the previously voided synthetic expense is absent from the active list', status: 'PASS' });
  cases.push({ name: 'readback was staging-only and performed no business writes', status: 'PASS' });
} catch (error) {
  failed = true;
  cases.push({ name: `Run stopped at ${phase}`, status: 'FAIL', detail: error instanceof Error ? error.name : 'UnknownError' });
  if (app) { try { trace = await Promise.race([getTrace(), pause(1500).then(() => [])]) ?? []; } catch { trace = []; } }
  console.error(`Read-only Finance evidence stopped at ${phase}; values and personal data are omitted.`);
} finally {
  if (credentials) { credentials.email = undefined; credentials.password = undefined; }
  if (app) {
    const child = app.process();
    const closed = await Promise.race([app.close().then(() => true, () => true), pause(5000).then(() => false)]);
    if (!closed) {
      child.kill('SIGTERM');
      const exited = await Promise.race([once(child, 'exit').then(() => true), pause(1500).then(() => false)]);
      if (!exited) child.kill('SIGKILL');
    }
  }
  const apiTrace = trace.map(item => ({ appId: item.appId, appVersion: item.appVersion, operation: item.operation, method: item.method, route: item.route, queryKeys: item.queryKeys, requestId: item.requestId, idempotencyKeyPresent: item.idempotencyKeyPresent, requestBodyKeys: item.requestBodyKeys, status: item.status, responseContentType: item.responseContentType, responseBodyKeys: item.responseBodyKeys, responseArrayCounts: item.responseArrayCounts, elapsedMs: item.elapsedMs, ...(item.transportError ? { transportError: item.transportError } : {}) }));
  await fs.mkdir(evidenceDir, { recursive: true });
  const report = { recordType: 'm18_finance_staging_void_readback', environment: 'cloudflare-staging', date: new Date().toISOString(), sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), package: { appId, version, catalogueSequence: 91, payloadDigest }, isolatedPrivateDesktop: true, productionUsed: false, credentialsSaved: false, patientPaymentsOpened: false, fixtureNamespace: namespace, recordsCreated: false, cases, apiTrace, traceRedaction: 'No request/response values, credentials, tokens, cookies, clinic/user identifiers, patient data or staff names are recorded.', failed, acceptanceStatus: failed ? 'FAIL' : 'PASS' };
  const output = path.join(evidenceDir, 'M18.7-LEAD-FINANCE-VOID-READBACK-20261024.json');
  await fs.writeFile(output, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`EVIDENCE ${path.relative(root, output)}`);
}
process.exit(failed ? 1 : 0);
