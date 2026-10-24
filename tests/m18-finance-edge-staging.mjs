// Opt-in Finance staging edge checks for one previously created M18 synthetic expense.
// Always execute through tools/run-ui-test.mjs so Electron stays on its private display.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw new Error('Explicit approved staging UI acceptance required');
}

const root = path.resolve(import.meta.dirname, '..');
const evidenceDir = path.join(root, 'dental-os_v1_working_info/milestone-18-dental-app-testing/evidence');
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const stat = await fs.lstat(credentialFile);
if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096 || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
  throw new Error('Unsafe credential input');
}
let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
  throw new Error('Invalid credential input');
}

const appId = 'company.dental.finance.m17';
const version = '1.7.7';
const namespace = 'M18-FIN-20261024-BB86171A';
const syntheticPayee = `${namespace} general expense`;
const cases = [];
let failed = false;
let app;
let shell;
let guest;
let trace = [];
let phase = 'launch';
let appPageErrors = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const record = (name, status, detail = null) => {
  cases.push({ name, status, ...(detail ? { detail } : {}) });
  if (status === 'FAIL') failed = true;
};
const getTrace = async () => app.evaluate(() => Array.isArray(globalThis.__m18FinanceApiTrace)
  ? globalThis.__m18FinanceApiTrace.map((item, index) => ({ ...item, index }))
  : null);
const waitForTrace = async (predicate, label, timeout = 15000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const latest = await getTrace();
    if (!latest) throw new Error('API trace switch was unavailable');
    const match = latest.find(predicate);
    if (match) return match;
    await pause(100);
  }
  throw new Error(`API trace deadline: ${label}`);
};
const markTrace = async () => (await getTrace())?.length ?? 0;
const assertNoPostSince = async (start, routePart) => {
  await pause(500);
  const latest = await getTrace();
  return !(latest ?? []).some(item => item.index >= start && item.method === 'POST' && item.route.includes(routePart));
};
const selectGeneralExpenses = async () => {
  const nav = shell.getByRole('navigation', { name: 'Finance modules' });
  await nav.getByRole('button', { name: 'General expenses', exact: true }).click();
  await guest.getByRole('heading', { name: 'General expenses', exact: true }).waitFor();
};
const expenseRow = () => guest.getByRole('row').filter({ hasText: syntheticPayee });

try {
  phase = 'launch-staging';
  const env = { ...process.env };
  for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging', '--m18-finance-api-trace'], env, timeout: 30000 });
  shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);
  shell.on('pageerror', () => { appPageErrors += 1; });
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  phase = 'sign-in-staging';
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.locator('.statusbar-account-menu > summary').waitFor({ state: 'visible', timeout: 25000 });
  const session = await shell.evaluate(() => window.desktop.identity.view());
  if (session.phase !== 'ready' || session.mode !== 'staging') throw new Error('Session is not authenticated to staging');
  credentials.password = undefined;

  phase = 'signed-store-install';
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'App Store' }).waitFor();
  await shell.getByRole('button', { name: 'Details Finance', exact: true }).click();
  await shell.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
  const storeText = await shell.locator('.delivery-store-versions').innerText();
  if (!storeText.includes(version) || !/Not installed/.test(storeText)) throw new Error('Expected Finance staging package is unavailable for this isolated profile');
  await shell.getByRole('button', { name: 'Install', exact: true }).click();
  await shell.locator(`[data-dock-app="${appId}"]`).waitFor({ state: 'visible', timeout: 30000 });
  await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 15000 });
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  await shell.waitForFunction(id => document.querySelector(`[data-runtime="${id}"]`)?.dataset.runtimePhase === 'ready', appId, { timeout: 30000 });
  for (let attempt = 0; attempt < 200; attempt += 1) {
    guest = app.context().pages().find(candidate => !candidate.isClosed() && candidate.url().startsWith(`dental-fixture://${appId}/`));
    if (guest) break;
    await pause(100);
  }
  if (!guest) throw new Error('Signed Finance guest window did not open');
  guest.setDefaultTimeout(20000);
  guest.on('pageerror', () => { appPageErrors += 1; });
  await guest.locator(`main[data-dental-os-app="${appId}"]`).waitFor();
  await guest.getByRole('heading', { name: 'Financial overview', exact: true }).waitFor();
  phase = 'finance-package-health';
  await waitForTrace(item => item.method === 'GET' && item.route === '/v1/clinic/transaction-record' && item.status === 200, 'Finance transaction report read');
  const registryPath = path.join(await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData')), 'packages', 'registry.json');
  let registry;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      if (registry.apps[appId]?.knownGood === '1a224065b7a9aa630fba1496bb101e1ff5479d7b958775d7e42b85164be3bc63') break;
    } catch {}
    await pause(100);
  }
  if (registry.apps[appId]?.knownGood !== '1a224065b7a9aa630fba1496bb101e1ff5479d7b958775d7e42b85164be3bc63') {
    throw new Error('Installed Finance digest does not match the signed sequence-91 staging package');
  }
  phase = 'general-expenses-load';
  let before = await markTrace();
  await selectGeneralExpenses();
  await waitForTrace(item => item.index >= before && item.method === 'GET' && item.route === '/v1/clinic/operating-expenses' && item.status === 200, 'expense list read');

  phase = 'create-validation';
  await guest.getByRole('button', { name: 'Add expense', exact: true }).click();
  let dialog = guest.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Add expense', exact: true }).waitFor();
  before = await markTrace();
  await dialog.getByRole('button', { name: 'Add expense', exact: true }).click();
  await dialog.getByText('Choose an expense category.', { exact: true }).waitFor();
  const noCreate = await assertNoPostSince(before, '/operating-expenses');
  if (!noCreate) throw new Error('Blank expense validation unexpectedly sent a create request');
  record('General expenses: missing required category is explained locally and sends no API write', 'PASS');
  await guest.keyboard.press('Escape');
  await dialog.waitFor({ state: 'detached' });

  phase = 'target-synthetic-expense';
  const row = expenseRow();
  if (await row.count() !== 1) throw new Error('Expected exactly one existing M18 synthetic expense in the active month list');

  phase = 'correction-reason-validation';
  await row.getByRole('button', { name: /^Edit expense from / }).click();
  dialog = guest.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Edit expense', exact: true }).waitFor();
  await dialog.getByPlaceholder('0', { exact: true }).fill('1.50');
  before = await markTrace();
  await dialog.getByRole('button', { name: 'Save correction', exact: true }).click();
  await dialog.getByText('Enter a reason for the correction.', { exact: true }).waitFor();
  const noCorrection = await assertNoPostSince(before, '/correct');
  if (!noCorrection) throw new Error('Missing correction reason unexpectedly sent an API write');
  record('General expenses: correction requires an audit reason before dispatch', 'PASS');

  phase = 'correction-workflow';
  await dialog.getByPlaceholder('What was wrong in the original entry?', { exact: true }).fill(`${namespace} correction verification`);
  before = await markTrace();
  await dialog.getByRole('button', { name: 'Save correction', exact: true }).click();
  const corrected = await waitForTrace(item => item.index >= before && item.method === 'POST' && item.route.endsWith('/correct') && item.status !== null, 'expense correction');
  if (corrected.status !== 201) throw new Error('Expense correction did not return the documented 201');
  await dialog.waitFor({ state: 'detached' });
  await waitForTrace(item => item.index > corrected.index && item.method === 'GET' && item.route === '/v1/clinic/operating-expenses' && item.status === 200, 'expense correction refresh');
  if (await expenseRow().count() !== 1) throw new Error('Corrected M18 synthetic expense was not visible after refresh');
  record('General expenses: synthetic expense correction persists and the active row refreshes', 'PASS');

  phase = 'void-reason-validation';
  const correctedRow = expenseRow();
  await correctedRow.getByRole('button', { name: /^Remove expense from / }).click();
  dialog = guest.getByRole('dialog');
  await dialog.getByRole('heading', { name: 'Remove financial record?', exact: true }).waitFor();
  before = await markTrace();
  await dialog.getByRole('button', { name: 'Remove record', exact: true }).click();
  await dialog.getByText('Enter a reason so this correction is auditable.', { exact: true }).waitFor();
  const noVoid = await assertNoPostSince(before, '/void');
  if (!noVoid) throw new Error('Missing void reason unexpectedly sent an API write');
  record('General expenses: void requires an audit reason before dispatch', 'PASS');

  phase = 'void-workflow';
  await dialog.getByPlaceholder('Reason for removal (required)', { exact: true }).fill(`${namespace} void verification`);
  before = await markTrace();
  await dialog.getByRole('button', { name: 'Remove record', exact: true }).click();
  const voided = await waitForTrace(item => item.index >= before && item.method === 'POST' && item.route.endsWith('/void') && item.status !== null, 'expense void');
  if (voided.status !== 200) throw new Error('Expense void did not return the documented 200');
  await dialog.waitFor({ state: 'detached' });
  await waitForTrace(item => item.index > voided.index && item.method === 'GET' && item.route === '/v1/clinic/operating-expenses' && item.status === 200, 'expense void refresh');
  if (await expenseRow().count() !== 0) throw new Error('Voided M18 synthetic expense remained in the active list');
  record('General expenses: synthetic corrected record voids with reason and leaves active totals/list', 'PASS');

  phase = 'trace-and-isolation';
  trace = await getTrace() ?? [];
  if (trace.some(item => /patient-payments|\/v1\/clinic\/patients/.test(item.route))) throw new Error('Patient Payments or patient-ledger API route was called');
  if (!trace.every(item => item.appId === appId && item.appVersion === version)) throw new Error('Unexpected app identity in API trace');
  if (appPageErrors !== 0) throw new Error('Finance renderer reported an uncaught page error');
  record('General expenses: all API traffic used signed Finance identity; excluded routes untouched; no renderer errors', 'PASS');
} catch (error) {
  failed = true;
  record(`Run stopped at ${phase}`, 'FAIL', error instanceof Error ? error.name : 'UnknownError');
  if (app) {
    try { trace = await Promise.race([getTrace(), pause(1500).then(() => [])]) ?? []; } catch { trace = []; }
  }
  console.error(`Finance edge verification stopped at ${phase}; values and personal data are omitted.`);
} finally {
  if (credentials) {
    credentials.email = undefined;
    credentials.password = undefined;
  }
  if (app) {
    const electronProcess = app.process();
    const closed = await Promise.race([app.close().then(() => true, () => true), pause(5000).then(() => false)]);
    if (!closed) {
      electronProcess.kill('SIGTERM');
      const exited = await Promise.race([once(electronProcess, 'exit').then(() => true), pause(1500).then(() => false)]);
      if (!exited) electronProcess.kill('SIGKILL');
    }
  }
  const sanitizedTrace = trace.map(item => ({
    appId: item.appId, appVersion: item.appVersion, operation: item.operation, method: item.method,
    route: item.route, queryKeys: item.queryKeys, requestId: item.requestId,
    idempotencyKeyPresent: item.idempotencyKeyPresent, requestBodyKeys: item.requestBodyKeys,
    status: item.status, responseContentType: item.responseContentType, responseBodyKeys: item.responseBodyKeys,
    responseArrayCounts: item.responseArrayCounts, elapsedMs: item.elapsedMs,
    ...(item.transportError ? { transportError: item.transportError } : {}),
  }));
  await fs.mkdir(evidenceDir, { recursive: true });
  const report = {
    recordType: 'm18_finance_staging_edge_workflow', environment: 'cloudflare-staging',
    date: new Date().toISOString(), sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    package: { appId, version, catalogueSequence: 91, packageSha256: '96c5c0156e21730424e847ad93781ae2409488cdd3334a2554d7679c55f24c4c', payloadDigest: '1a224065b7a9aa630fba1496bb101e1ff5479d7b958775d7e42b85164be3bc63' },
    isolatedPrivateDesktop: true, productionUsed: false, credentialsSaved: false, patientPaymentsOpened: false,
    fixtureNamespace: namespace, targetedExistingSyntheticExpense: true, cases, apiTrace: sanitizedTrace,
    traceRedaction: 'No request/response values, credentials, tokens, cookies, clinic/user identifiers, patient data or staff names are recorded.',
    appPageErrors, failed, acceptanceStatus: failed ? 'FAIL' : 'PASS',
  };
  const evidencePath = path.join(evidenceDir, 'M18.7-LEAD-FINANCE-EDGE-20261024.json');
  await fs.writeFile(evidencePath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(`EVIDENCE ${path.relative(root, evidencePath)}`);
}

process.exit(failed ? 1 : 0);
