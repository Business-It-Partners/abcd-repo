// Opt-in Finance staging workflow acceptance. Uses only the isolated UI runner.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw new Error('Explicit approved staging UI acceptance required');
}

const root = path.resolve(import.meta.dirname, '..');
const evidenceDir = path.join(root, 'dental-os_v1_working_info/milestone-18-dental-app-testing/evidence');
const appId = 'company.dental.finance.m17';
const version = '1.7.7';
const catalogueSequence = 91;
const packageSha256 = '96c5c0156e21730424e847ad93781ae2409488cdd3334a2554d7679c55f24c4c';
const payloadDigest = '1a224065b7a9aa630fba1496bb101e1ff5479d7b958775d7e42b85164be3bc63';
const credentialFile = process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE;
const stat = await fs.lstat(credentialFile);
if (!stat.isFile() || stat.isSymbolicLink() || stat.nlink !== 1 || stat.size > 4096 || (process.platform !== 'win32' && (stat.mode & 0o077) !== 0)) {
  throw new Error('Unsafe credential input');
}
let credentials = JSON.parse(await fs.readFile(credentialFile, 'utf8'));
if (!credentials || Object.keys(credentials).sort().join() !== 'email,password' || typeof credentials.email !== 'string' || typeof credentials.password !== 'string') {
  throw new Error('Invalid credential input');
}

const env = { ...process.env };
for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
const requestedNamespace = process.env.M18_FINANCE_NAMESPACE;
const namespace = requestedNamespace && /^M18-FIN-\d{8}-[A-F0-9]{8}$/.test(requestedNamespace)
  ? requestedNamespace
  : `M18-FIN-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
const checks = [];
const cases = [];
let app;
let shell;
let guest;
let phase = 'launch';
let failed = false;
let salaryWrite = 'not-run';
let syntheticStaffOptions = 0;
let financeTrace = [];
let registryVerified = false;
let appPageErrors = 0;
let packageInstalled = false;
let authState = null;
let productCreated = false;
let supplierCreated = false;
let purchaseCreated = false;
let supplierPaymentCreated = false;
let expenseCreated = false;
let fixtureNames = {};
const recordsReused = { product: false, supplier: false, purchase: false };
let uiDiagnostics = null;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const record = (name, status, detail = null) => {
  cases.push({ name, status, ...(detail ? { detail } : {}) });
  if (status === 'FAIL') failed = true;
};
const step = name => { phase = name; console.log(`STEP ${name}`); };
const check = (name, condition, detail = null) => {
  checks.push({ name, passed: !!condition });
  record(name, condition ? 'PASS' : 'FAIL', detail);
  if (!condition) throw new Error(`Acceptance check failed: ${name}`);
};
const getTrace = async () => app.evaluate(() => Array.isArray(globalThis.__m18FinanceApiTrace)
  ? globalThis.__m18FinanceApiTrace.map((item, index) => ({ ...item, index }))
  : null);
const waitForTrace = async (predicate, label, timeout = 20000) => {
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
const selectModule = async label => {
  const nav = shell.getByRole('navigation', { name: 'Finance modules' });
  await nav.getByRole('button', { name: label, exact: true }).click();
  await guest.getByRole('heading', { name: label, exact: true }).waitFor();
};
const expectRead = async (route, before) => {
  const item = await waitForTrace(entry => entry.route === route && entry.method === 'GET' && entry.index >= before
    && (entry.status !== null || !!entry.transportError), `GET ${route}`, 12000);
  if (!(item.status >= 200 && item.status < 300)) throw new Error(`GET ${route} did not complete successfully`);
  return item;
};
const expectWrite = async (route, before) => {
  const item = await waitForTrace(entry => entry.route === route && entry.method === 'POST' && entry.index >= before
    && (entry.status !== null || !!entry.transportError), `POST ${route}`, 12000);
  if (!(item.status >= 200 && item.status < 300)) throw new Error(`POST ${route} did not complete successfully`);
  return item;
};
const markCurrentTraceIndices = async () => {
  const trace = await getTrace();
  return trace?.length ?? 0;
};

try {
  step('launch-private-staging');
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging', '--m18-finance-api-trace'], env, timeout: 30000 });
  shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);
  shell.on('pageerror', () => { appPageErrors += 1; });

  step('staging-sign-in');
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.locator('.statusbar-account-menu > summary').waitFor({ state: 'visible', timeout: 25000 });
  const session = await shell.evaluate(() => window.desktop.identity.view());
  check('Dental OS is connected to the authenticated staging session', session.phase === 'ready' && session.mode === 'staging');
  credentials.password = undefined;

  step('signed-store-install');
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'App Store' }).waitFor();
  await shell.getByRole('button', { name: 'Details Finance', exact: true }).click();
  await shell.getByRole('heading', { name: 'Finance', exact: true }).waitFor();
  const storeVersion = shell.locator('.delivery-store-versions');
  check('signed staging Store offers Finance 1.7.7 for this isolated profile', await storeVersion.innerText().then(text => text.includes(version) && /Not installed/.test(text)));
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
  await expectRead('/v1/clinic/transaction-record', 0);
  packageInstalled = true;
  check('Finance opens through the managed OS window and loads the transaction report', true);
  check('Finance remains one signed app with the expected internal-module navigation', await shell.getByRole('navigation', { name: 'Finance modules' }).getByRole('button').count() >= 7);

  step('package-health');
  const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
  const registryPath = path.join(userData, 'packages', 'registry.json');
  let registry;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      registry = JSON.parse(await fs.readFile(registryPath, 'utf8'));
      if (registry.apps[appId]?.knownGood === registry.apps[appId]?.active) break;
    } catch {}
    await pause(100);
  }
  const installed = registry?.apps?.[appId];
  registryVerified = !!installed && installed.knownGood === payloadDigest && installed.active === payloadDigest && installed.versions?.includes(payloadDigest);
  check('installed Finance digest matches the signed staging package and passed runtime health', registryVerified);

  step('product-list-navigate');
  let before = await markCurrentTraceIndices();
  await selectModule('Product list');
  step('product-list-reads');
  await expectRead('/v1/clinic/products', before);
  await expectRead('/v1/clinic/purchases', before);
  fixtureNames.product = `${namespace} product`;
  const productSearch = guest.getByPlaceholder('Search products…', { exact: true });
  if (await productSearch.count()) await productSearch.fill(fixtureNames.product);
  if (await guest.getByText(fixtureNames.product, { exact: true }).count()) {
    recordsReused.product = true;
    record('Products: reuse the previously verified synthetic product', 'PASS');
  } else {
    step('product-list-open-form');
    await guest.getByRole('button', { name: 'Add product', exact: true }).click();
    await guest.getByRole('heading', { name: 'New product', exact: true }).waitFor();
    const productModal = guest.getByRole('dialog');
    step('product-list-fill-form');
    await productModal.getByPlaceholder('e.g. Composite kit', { exact: true }).fill(fixtureNames.product);
    await productModal.locator('select').nth(0).selectOption('piece');
    await productModal.locator('select').nth(1).selectOption('other');
    await productModal.getByPlaceholder('Brand, shade, size — anything worth remembering', { exact: true }).fill(namespace);
    before = await markCurrentTraceIndices();
    await productModal.getByRole('button', { name: 'Add product', exact: true }).click();
    await expectWrite('/v1/clinic/products', before);
    await guest.getByText(fixtureNames.product, { exact: true }).waitFor();
    productCreated = true;
    record('Products: create a synthetic product and refresh the list', 'PASS');
  }

  step('supplier-list-navigate');
  before = await markCurrentTraceIndices();
  await selectModule('Supplier list');
  await expectRead('/v1/clinic/suppliers', before);
  fixtureNames.supplier = `${namespace} supplier`;
  const supplierSearch = guest.getByPlaceholder('Search suppliers…', { exact: true });
  if (await supplierSearch.count()) await supplierSearch.fill(fixtureNames.supplier);
  if (await guest.getByText(fixtureNames.supplier, { exact: true }).count()) {
    recordsReused.supplier = true;
    record('Suppliers: reuse the previously verified synthetic supplier', 'PASS');
  } else {
    await guest.getByRole('button', { name: 'Add supplier', exact: true }).click();
    await guest.getByRole('heading', { name: 'New supplier', exact: true }).waitFor();
    const supplierModal = guest.getByRole('dialog');
    await supplierModal.getByPlaceholder('e.g. Dental Depot', { exact: true }).fill(fixtureNames.supplier);
    await supplierModal.locator('select').first().selectOption('goods');
    before = await markCurrentTraceIndices();
    await supplierModal.getByRole('button', { name: 'Add supplier', exact: true }).click();
    await expectWrite('/v1/clinic/suppliers', before);
    await guest.getByText(fixtureNames.supplier, { exact: true }).waitFor();
    supplierCreated = true;
    record('Suppliers: create a synthetic supplier and refresh the directory', 'PASS');
  }

  step('purchases');
  before = await markCurrentTraceIndices();
  await selectModule('Purchases');
  await expectRead('/v1/clinic/purchases', before);
  await expectRead('/v1/clinic/products', before);
  await expectRead('/v1/clinic/suppliers', before);
  const invoiceNumber = `${namespace}-INV`;
  const purchaseSearch = guest.getByPlaceholder('Search invoice or supplier…', { exact: true });
  if (await purchaseSearch.count()) await purchaseSearch.fill(invoiceNumber);
  if (await guest.getByText(invoiceNumber, { exact: false }).count()) {
    recordsReused.purchase = true;
    record('Purchases: reuse the previously verified synthetic invoice', 'PASS');
  } else {
    if (requestedNamespace) throw new Error('Previously verified invoice is not visible; refusing to submit a duplicate invoice');
    await guest.getByRole('button', { name: 'New purchase', exact: true }).click();
    const purchaseSelects = guest.locator('.purchase-form-page select');
    await purchaseSelects.nth(0).selectOption('product');
    await purchaseSelects.nth(1).selectOption({ label: fixtureNames.supplier });
    await guest.getByPlaceholder('Invoice number', { exact: true }).fill(invoiceNumber);
    const productPicker = guest.getByRole('combobox', { name: 'Product name', exact: true });
    await productPicker.fill(fixtureNames.product);
    await guest.getByRole('option', { name: fixtureNames.product, exact: false }).click();
    const lineInputs = guest.locator('.purchase-lines-card tbody tr input');
    await lineInputs.nth(3).fill('10.00');
    await guest.getByRole('button', { name: 'Review Purchase', exact: false }).click();
    await guest.getByRole('heading', { name: 'Confirm Purchase Order', exact: true }).waitFor();
    before = await markCurrentTraceIndices();
    await guest.getByRole('button', { name: 'Confirm & Save Purchase', exact: true }).click();
    await expectWrite('/v1/clinic/purchases', before);
    purchaseCreated = true;
    record('Purchases: review and record an invoice linked to the synthetic product and supplier', 'PASS');
  }

  step('supplier-payments-navigate');
  before = await markCurrentTraceIndices();
  await selectModule('Supplier payments');
  step('supplier-payments-reads');
  await expectRead('/v1/clinic/supplier-payments', before);
  await expectRead('/v1/clinic/suppliers', before);
  await expectRead('/v1/clinic/purchases', before);
  step('supplier-payments-open-form');
  await guest.getByRole('button', { name: 'Record payment', exact: true }).click();
  const paymentModal = guest.getByRole('dialog');
  await paymentModal.getByRole('heading', { name: 'Record payment', exact: true }).waitFor();
  step('supplier-payments-select-supplier');
  const supplierPicker = paymentModal.getByRole('combobox', { name: 'Supplier', exact: true });
  await supplierPicker.fill(fixtureNames.supplier);
  await paymentModal.getByRole('option', { name: fixtureNames.supplier, exact: true }).click();
  step('supplier-payments-fill-amount');
  await paymentModal.locator('#finance-payment-amount-input').fill('1.00');
  step('supplier-payments-select-invoice');
  const invoiceSelect = paymentModal.locator('select').first();
  const invoiceOption = await invoiceSelect.locator('option').evaluateAll((options, token) =>
    options.find(option => (option.textContent ?? '').includes(token))?.value ?? null, `${namespace}-INV`);
  if (!invoiceOption) throw new Error('Synthetic linked invoice is not available in the supplier payment form');
  await invoiceSelect.selectOption(invoiceOption);
  step('supplier-payments-fill-reference');
  await paymentModal.getByPlaceholder('Cheque no., transaction id', { exact: true }).fill(`${namespace}-PAY`);
  before = await markCurrentTraceIndices();
  step('supplier-payments-submit');
  await paymentModal.getByRole('button', { name: 'Record payment', exact: true }).click();
  await expectWrite('/v1/clinic/supplier-payments', before);
  supplierPaymentCreated = true;
  record('Supplier payments: record a synthetic payment against the synthetic supplier', 'PASS');

  step('salary-payments');
  before = await markCurrentTraceIndices();
  await selectModule('Salary payments');
  await expectRead('/v1/clinic/salary-payouts', before);
  const staffRead = await expectRead('/v1/clinic/staff', before);
  await guest.getByRole('button', { name: 'Record salary', exact: true }).click();
  await guest.getByRole('heading', { name: 'Record salary', exact: true }).waitFor();
  const salaryModal = guest.getByRole('dialog');
  const staffSelect = salaryModal.locator('select').first();
  const safeStaff = await staffSelect.locator('option').evaluateAll(options => options
    .filter(option => option.value && !option.disabled && /(^|[^a-z0-9])(m18|synthetic|test fixture)([^a-z0-9]|$)/i.test(option.textContent ?? ''))
    .map(option => option.value));
  syntheticStaffOptions = safeStaff.length;
  if (safeStaff.length) {
    await staffSelect.selectOption(safeStaff[0]);
    await salaryModal.locator('input[placeholder="0"]').nth(0).fill('1.00');
    await salaryModal.locator('input[placeholder="0"]').nth(1).fill('0');
    await salaryModal.getByPlaceholder('Receipt, bank, or transfer reference', { exact: true }).fill(`${namespace}-SAL`);
    await salaryModal.getByPlaceholder('Anything worth recording', { exact: true }).fill(`${namespace} synthetic salary test`);
    before = await markCurrentTraceIndices();
    await salaryModal.getByRole('button', { name: 'Record salary', exact: true }).click();
    await expectWrite('/v1/clinic/salary-payouts', before);
    salaryWrite = 'pass';
    record('Salary payments: record only against a clearly synthetic staff profile', 'PASS');
  } else {
    salaryWrite = 'blocked-no-synthetic-staff';
    record('Salary payments: list and staff directory API calls reached; salary write blocked because no clearly synthetic staff profile is available', 'BLOCKED');
    await guest.keyboard.press('Escape').catch(() => {});
  }

  step('general-expenses');
  before = await markCurrentTraceIndices();
  await selectModule('General expenses');
  await expectRead('/v1/clinic/operating-expenses', before);
  await guest.getByRole('button', { name: 'Add expense', exact: true }).click();
  await guest.getByRole('heading', { name: 'Add expense', exact: true }).waitFor();
  const expenseModal = guest.getByRole('dialog');
  fixtureNames.expense = `${namespace} general expense`;
  await expenseModal.locator('input[placeholder="0"]').first().fill('1.00');
  await expenseModal.locator('select').first().selectOption('other');
  await expenseModal.getByPlaceholder('Who was paid', { exact: true }).fill(fixtureNames.expense);
  await expenseModal.getByPlaceholder('Receipt, wallet, cheque, or bank reference', { exact: true }).fill(`${namespace}-EXP`);
  await expenseModal.getByPlaceholder('Anything worth recording', { exact: true }).fill(`${namespace} synthetic expense test`);
  before = await markCurrentTraceIndices();
  await expenseModal.getByRole('button', { name: 'Add expense', exact: true }).click();
  await expectWrite('/v1/clinic/operating-expenses', before);
  expenseCreated = true;
  record('General expenses: create a synthetic expense and refresh the month list', 'PASS');

  step('trace-and-isolation-check');
  financeTrace = await getTrace() ?? [];
  check('no Patient Payments or patient-ledger API routes were called', !financeTrace.some(item => /\/v1\/(?:patient-payments|patients)(?:\/|\?|$)/.test(item.route)));
  check('all captured Finance API traffic used the signed Finance package identity', financeTrace.every(item => item.appId === appId && item.appVersion === version));
  check('no renderer errors were reported', appPageErrors === 0);
  check('synthetic labels remain isolated to this staging test namespace', Object.values(fixtureNames).every(value => !value || value.startsWith(namespace)));
  if (salaryWrite === 'pass') record('Salary payments synthetic staff prerequisite was available', 'PASS');
} catch (error) {
  record(`Run stopped at ${phase}`, 'FAIL', error instanceof Error ? error.name : 'UnknownError');
  if (app) {
    try { financeTrace = await Promise.race([getTrace(), pause(2000).then(() => [])]) ?? []; } catch { financeTrace = []; }
  }
  if (shell) {
    try {
      authState = await shell.evaluate(async () => {
        const view = await window.desktop.identity.view();
        return {
          phase: view.phase,
          mode: view.mode ?? null,
          sessionPhase: document.querySelector('[data-session-phase]')?.dataset.sessionPhase ?? null,
          hasAlert: !!document.querySelector('[role="alert"]'),
        };
      });
    } catch { authState = { unavailable: true }; }
  }
  if (guest) {
    try {
      uiDiagnostics = await guest.evaluate(() => {
        const activeModule = document.querySelector('.window-module-sidebar-item.is-active span')?.textContent?.trim() ?? null;
        const paymentButton = [...document.querySelectorAll('button')].find(button => button.textContent?.trim() === 'Record payment');
        return {
          activeModule,
          pageHeading: [...document.querySelectorAll('h1,h2,h3')].map(node => node.textContent?.trim() ?? '').filter(text => ['Supplier payments', 'Record payment'].includes(text)),
          dialogCount: document.querySelectorAll('[role="dialog"]').length,
          paymentButtonDisabled: paymentButton ? (paymentButton instanceof HTMLButtonElement ? paymentButton.disabled : null) : null,
          supplierPickerVisible: !!document.querySelector('[role="combobox"][aria-label="Supplier"]'),
          roleOptionCount: document.querySelectorAll('[role="option"]').length,
          alertCount: document.querySelectorAll('[role="alert"]').length,
        };
      });
    } catch { uiDiagnostics = { unavailable: true }; }
  }
  console.error(`Finance staging acceptance stopped at ${phase}; response values, credentials, clinic identity and personal information were omitted.`);
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
  const sanitizedTrace = financeTrace.map(item => ({
    appId: item.appId,
    appVersion: item.appVersion,
    operation: item.operation,
    method: item.method,
    route: item.route,
    queryKeys: item.queryKeys,
    requestId: item.requestId,
    idempotencyKeyPresent: item.idempotencyKeyPresent,
    requestBodyKeys: item.requestBodyKeys,
    status: item.status,
    responseContentType: item.responseContentType,
    responseBodyKeys: item.responseBodyKeys,
    responseArrayCounts: item.responseArrayCounts,
    elapsedMs: item.elapsedMs,
    ...(item.transportError ? { transportError: item.transportError } : {}),
  }));
  await fs.mkdir(evidenceDir, { recursive: true });
  const evidencePath = path.join(evidenceDir, `M18.7-LEAD-FINANCE-WORKFLOWS-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}.json`);
  const result = {
    recordType: 'm18_finance_staging_workflow_acceptance',
    environment: 'cloudfare-staging',
    date: new Date().toISOString(),
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    package: { appId, version, catalogueSequence, packageSha256, payloadDigest },
    isolatedPrivateDesktop: true,
    productionUsed: false,
    credentialsSaved: false,
    patientPaymentsOpened: false,
    salaryWrite,
    syntheticStaffOptions,
    fixtureNamespace: namespace,
    packageInstalled,
    registryVerified,
    recordsCreated: { productCreated, supplierCreated, purchaseCreated, supplierPaymentCreated, expenseCreated },
    recordsReused,
    checks,
    cases,
    apiTrace: sanitizedTrace,
    traceRedaction: 'No request/response values, credentials, tokens, cookies, clinic/user identifiers, patient data, or staff names are recorded; only normalized route, field/key names, status, content type, array counts and correlation/request ID are retained.',
    appPageErrors,
    authState,
    uiDiagnostics,
    failed,
    acceptanceStatus: failed ? 'FAIL' : salaryWrite === 'pass' ? 'PASS' : 'PARTIAL_BLOCKED',
  };
  await fs.writeFile(evidencePath, JSON.stringify(result, null, 2) + '\n', { mode: 0o600 });
  console.log(`EVIDENCE ${path.relative(root, evidencePath)}`);
}

const exitCode = failed || salaryWrite !== 'pass' ? 1 : 0;
process.exit(exitCode);
