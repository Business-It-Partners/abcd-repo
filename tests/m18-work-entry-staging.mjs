// Direct Work Entry staging workflow. Full-write mode uses the registered patient already attached to the staging workflow test case.
import { profileArgs } from './profile.mjs';
import { _electron as electron } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';

if (process.env.DENTAL_OS_STAGING_ACCEPTANCE !== 'true' || !process.env.DENTAL_OS_STAGING_CREDENTIAL_FILE) {
  throw new Error('Explicit approved staging UI acceptance required');
}

const root = path.resolve(import.meta.dirname, '..');
const desktopCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const desktopWorkingTreeDirty = execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }).trim().length > 0;
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

const appIds = { workEntry: 'company.dental.work-entry.m17' };
const versions = { workEntry: '1.0.6' };
const digests = { workEntry: 'bf4305974421fa00ad920117027509a60c3b6abf1047e9c449fe91ed436efb1b' };
const stagingCatalogueSequence = 98;
const reuseNamespace = process.env.M18_WORK_ENTRY_REUSE_CASE_NAMESPACE;
if (reuseNamespace && !/^M18-WE-\d{8}-[A-F0-9]{8}$/.test(reuseNamespace)) throw new Error('Invalid staging case reuse namespace');
const namespace = reuseNamespace ?? `M18-WE-${new Date().toISOString().slice(0, 10).replaceAll('-', '')}-${randomUUID().slice(0, 8).toUpperCase()}`;
const complaint = `${namespace} staging workflow test`;
const checks = [];
const traceSnapshot = [];
const uiDiagnostics = [];
let app;
let shell;
let workEntryPage;
let phase = 'launch';
let failed = false;
let knownPatientName = '';
let knownPatientNumber = '';
let apiTraceStart = 0;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
const step = name => { phase = name; console.log(`STEP ${name}`); };
const check = (name, passed, detail = null) => {
  checks.push({ name, passed: !!passed, ...(detail ? { detail } : {}) });
  if (!passed) { failed = true; throw new Error(`Acceptance check failed: ${name}`); }
};
const trace = async () => app.evaluate(() => Array.isArray(globalThis.__m18FinanceApiTrace) ? globalThis.__m18FinanceApiTrace : null);
const waitTrace = async (appId, method, route, from = 0, timeout = 20000) => {
  const until = Date.now() + timeout;
  while (Date.now() < until) {
    const rows = await trace();
    if (!rows) throw new Error('Private API trace switch unavailable');
    const item = rows.find(row => row.appId === appId && row.method === method && row.route === route && rows.indexOf(row) >= from
      && (row.status !== null || !!row.transportError));
    if (item) return item;
    await pause(100);
  }
  throw new Error(`Trace deadline: ${appId} ${method} ${route}`);
};
const markTrace = async () => (await trace())?.length ?? 0;
const require2xx = (item, name) => check(name, item.status >= 200 && item.status < 300, { status: item.status, route: item.route, method: item.method, requestId: item.requestId });
const findGuest = async appId => {
  for (let i = 0; i < 250; i += 1) {
    const page = app.context().pages().find(candidate => !candidate.isClosed() && candidate.url().startsWith(`dental-fixture://${appId}/`));
    if (page) return page;
    await pause(100);
  }
  throw new Error(`Signed app guest did not open: ${appId}`);
};
const installAndOpen = async (shell, appId, title, version) => {
  await shell.getByRole('button', { name: 'App Store', exact: true }).click();
  await shell.getByRole('heading', { name: 'App Store', exact: true }).waitFor();
  await shell.getByRole('button', { name: `Details ${title}`, exact: true }).click();
  await shell.getByRole('heading', { name: title, exact: true }).waitFor();
  const versionText = await shell.locator('.delivery-store-versions').innerText();
  check(`${title} exact signed version is offered`, versionText.includes(version));
  if (/Not installed/i.test(versionText)) {
    await shell.getByRole('button', { name: 'Install', exact: true }).click();
    await shell.locator(`[data-dock-app="${appId}"]`).waitFor({ state: 'visible', timeout: 30000 });
    await shell.locator('.store-celebration').waitFor({ state: 'detached', timeout: 15000 });
  }
  await shell.getByRole('button', { name: 'Open', exact: true }).click();
  return findGuest(appId);
};
const verifyInstalledHealth = async (appId, digest, name) => {
  const userData = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'));
  let installed;
  for (let attempt = 0; attempt < 150; attempt += 1) {
    try {
      const registry = JSON.parse(await fs.readFile(path.join(userData, 'packages', 'registry.json'), 'utf8'));
      installed = registry.apps?.[appId];
      if (installed?.knownGood === digest && installed.active === digest && installed.versions?.includes(digest)) break;
    } catch {}
    await pause(100);
  }
  check(`${name} active and known-good digests match the signed staging package`, !!installed
    && installed.active === digest && installed.knownGood === digest && installed.versions?.includes(digest));
};
const saveEvidence = async () => {
  try {
    const rows = await trace();
    if (rows) traceSnapshot.push(...rows.map(row => ({ ...row })));
  } catch {}
  await fs.mkdir(evidenceDir, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(':', '-');
  const out = path.join(evidenceDir, `M18.4-LEAD-WORK-ENTRY-${stamp}.json`);
  const allowedIds = new Set(Object.values(appIds));
  const safeTrace = traceSnapshot.filter(row => allowedIds.has(row.appId)).map(({ appId, appVersion, operation, method, route, queryKeys, requestId, idempotencyKeyPresent, requestBodyKeys, status, responseContentType, responseBodyKeys, responseArrayCounts, elapsedMs, transportError }) => ({ appId, appVersion, operation, method, route, queryKeys, requestId, idempotencyKeyPresent, requestBodyKeys, status, responseContentType, responseBodyKeys, responseArrayCounts, elapsedMs, ...(transportError ? { transportError } : {}) }));
  const report = {
    recordType: 'm18_work_entry_staging_run',
    appId: appIds.workEntry,
    version: versions.workEntry,
    payloadDigest: digests.workEntry,
    stagingCatalogueSequence,
    desktopCommit,
    desktopWorkingTreeDirty,
    environment: 'cloudflare-staging',
    productionUsed: false,
    credentialsSaved: false,
    patientAndCaseNamesInEvidence: false,
    ...(process.env.M18_WORK_ENTRY_READ_ONLY !== 'true' && process.env.M18_WORK_ENTRY_EXISTING_STAGING_CASE !== 'true' ? { stagingTestNamespace: namespace } : {}),
    runMode: process.env.M18_WORK_ENTRY_EXISTING_STAGING_CASE === 'true' ? 'existing-staging-test-case-read-only'
      : process.env.M18_WORK_ENTRY_READ_ONLY === 'true' ? 'read-only-startup'
        : reuseNamespace ? 'existing-staging-case-resumed-end-to-end' : 'existing-staging-patient-new-case-end-to-end',
    phase,
    checks,
    uiDiagnostics,
    apiTrace: safeTrace,
    failed,
  passed: !failed && (phase === 'complete' || phase === 'complete-read-only' || phase === 'complete-existing-case-read-only'),
  };
  await fs.writeFile(out, JSON.stringify(report, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`EVIDENCE ${path.relative(root, out)}`);
  console.log(JSON.stringify({ passed: report.passed, phase, checks: checks.length, workEntryApiEvents: safeTrace.filter(row => row.appId === appIds.workEntry).length }));
};

try {
  step('launch-private-staging');
  const env = { ...process.env };
  for (const key of ['ELECTRON_RUN_AS_NODE', 'DEBUG', 'PWDEBUG']) delete env[key];
  app = await electron.launch({ args: [root, ...profileArgs, '--identity-staging', '--m18-finance-api-trace'], env, timeout: 30000 });
  shell = await app.firstWindow();
  shell.setDefaultTimeout(20000);
  await shell.getByRole('heading', { name: 'Sign in to your clinic' }).waitFor();

  step('staging-sign-in');
  await shell.getByLabel('Email', { exact: true }).fill(credentials.email);
  await shell.getByLabel('Password', { exact: true }).fill(credentials.password);
  await shell.getByRole('button', { name: 'Sign in', exact: true }).click();
  await shell.locator('.statusbar-account-menu > summary').waitFor({ state: 'visible', timeout: 25000 });
  const session = await shell.evaluate(() => window.desktop.identity.view());
  check('Dental OS session is authenticated in staging mode', session.phase === 'ready' && session.mode === 'staging');
  credentials.password = undefined;

  step('work-entry-signed-install-and-read');
  apiTraceStart = await markTrace();
  workEntryPage = await installAndOpen(shell, appIds.workEntry, 'Work Entry', versions.workEntry);
  workEntryPage.setDefaultTimeout(20000);
  workEntryPage.on('pageerror', () => { failed = true; });
  await workEntryPage.getByRole('heading', { name: 'Work Entry', exact: true }).waitFor();
  check('Work Entry staging UI opens and exposes New case action', await workEntryPage.getByRole('button', { name: /New case/ }).isVisible());
  await verifyInstalledHealth(appIds.workEntry, digests.workEntry, 'Work Entry');
  for (const route of ['/v1/work-entry/cases', '/v1/treatment-protocols', '/v1/clinic/staff-references']) {
    const item = await waitTrace(appIds.workEntry, 'GET', route, apiTraceStart);
    require2xx(item, `Work Entry reads ${route} through the Dental OS broker`);
  }

  if (process.env.M18_WORK_ENTRY_READ_ONLY === 'true' || process.env.M18_WORK_ENTRY_EXISTING_STAGING_CASE === 'true') {
    if (process.env.M18_WORK_ENTRY_EXISTING_STAGING_CASE === 'true') {
      step('work-entry-existing-staging-case-read-only');
      await workEntryPage.getByRole('textbox', { name: 'Search cases' }).fill(reuseNamespace ?? 'staging workflow test');
      const stagingTestRow = workEntryPage.getByRole('row').filter({ hasText: reuseNamespace ?? /staging workflow test/i });
      check('one existing staging workflow case matches the requested read-only scope', await stagingTestRow.count() === 1);
      const detailBefore = await markTrace();
      await stagingTestRow.getByRole('button', { name: 'Start work', exact: true }).click();
      const requiredReads = [
        '/v1/chief-complaints/:id/work-entry',
        '/v1/patients/:id/core',
        '/v1/patients/:id/ledger',
        '/v1/patients/:id/odontogram',
        '/v1/clinic/suppliers',
        '/v1/patients/:id/periodontal-chart',
        '/v1/patients/:id/canal-measurements',
        '/v1/follow-ups',
      ];
      const requiredRouteSet = new Set(requiredReads.filter(route => route !== '/v1/patients/:id/ledger'));
      const observed = () => trace().then(rows => (rows ?? []).slice(detailBefore).filter(row => row.appId === appIds.workEntry));
      let detailRows = [];
      let visibleAlertCount = 0;
      const deadline = Date.now() + 20000;
      while (Date.now() < deadline) {
        detailRows = await observed();
        const received = new Set(detailRows.filter(row => row.method === 'GET').map(row => row.route));
        visibleAlertCount = await workEntryPage.locator('[role="alert"]').count();
        if ([...requiredRouteSet].every(route => received.has(route)) || visibleAlertCount > 0) break;
        await pause(150);
      }
      const capacityMessage = workEntryPage.getByText('Request capacity reached.', { exact: true });
      if (await capacityMessage.count()) {
        uiDiagnostics.push({
          appId: appIds.workEntry,
          visibleError: 'Request capacity reached.',
          observedDetailReads: detailRows.map(row => ({ method: row.method, route: row.route, status: row.status })),
          missingExpectedReads: requiredReads.filter(route => !detailRows.some(row => row.method === 'GET' && row.route === route)),
        });
        check('Work Entry opens every expected staging chart/context read without a broker capacity error', false,
          { visibleError: 'Request capacity reached.', dispatchedReadCount: detailRows.length });
      } else if (visibleAlertCount > 0) {
        uiDiagnostics.push({
          appId: appIds.workEntry,
          visibleError: '[alert text omitted]',
          observedDetailReads: detailRows.map(row => ({ method: row.method, route: row.route, status: row.status, transportError: row.transportError ?? null })),
          missingExpectedReads: requiredReads.filter(route => !detailRows.some(row => row.method === 'GET' && row.route === route)),
        });
        check('Work Entry opens every expected staging chart/context read without a UI error', false,
          { visibleAlertCount, dispatchedReadCount: detailRows.length });
      } else {
        for (const route of requiredReads) {
          const item = detailRows.find(row => row.method === 'GET' && row.route === route);
          check(`Work Entry dispatched ${route} for the staging workflow test case`, !!item, { status: item?.status ?? null });
          if (item) require2xx(item, `Work Entry reads ${route} for the staging workflow test case`);
        }
      }
      if (process.env.M18_WORK_ENTRY_EXPECT_COMMITTED_STATE === 'true') {
        const readback = await waitTrace(appIds.workEntry, 'GET', '/v1/chief-complaints/:id/work-entry', detailBefore);
        require2xx(readback, 'Work Entry reloads the committed case from the staging API');
        const savedProtocolCount = readback.responseArrayCounts?.['case.protocols'] ?? null;
        check('the committed treatment plan is present in the refreshed staging case API readback', savedProtocolCount === 1,
          { savedTreatmentPlans: savedProtocolCount });
      } else {
        check('case detail shows the Chart & plan action', await workEntryPage.getByRole('button', { name: /Chart & plan/ }).isVisible());
      }
      step('complete-existing-case-read-only');
    } else {
      step('complete-read-only');
    }
    const visibleAlerts = await workEntryPage.locator('[role="alert"]').allInnerTexts();
    const safeAlerts = visibleAlerts.map(value => value.includes('Request capacity reached') ? 'Request capacity reached.' : '[alert text omitted]');
    if (safeAlerts.length) uiDiagnostics.push({ appId: appIds.workEntry, alertCount: safeAlerts.length, alerts: safeAlerts });
    if (process.env.M18_WORK_ENTRY_EXISTING_STAGING_CASE === 'true') {
      const caseTrace = (await trace())?.slice(apiTraceStart).filter(row => row.appId === appIds.workEntry) ?? [];
      check('read-only case verification issued no staging writes', caseTrace.every(row => row.method === 'GET'), { appApiEvents: caseTrace.length });
    }
  } else {
  step(reuseNamespace ? 'work-entry-resume-existing-staging-case' : 'work-entry-create-staging-case');
  if (!reuseNamespace) {
    await workEntryPage.getByRole('textbox', { name: 'Search cases' }).fill('staging workflow test');
    const existingRows = await workEntryPage.getByRole('row').filter({ hasText: /staging workflow test/i }).all();
    let patientNumber;
    for (const row of existingRows) {
      const rowText = await row.innerText();
      if (!rowText.includes(namespace)) {
        patientNumber ??= rowText.match(/PT-\d+/)?.[0];
        if (!knownPatientName) knownPatientName = rowText.split('\n').map(value => value.trim()).find(value => value && !/^\d+$/.test(value) && !/^PT-\d+/.test(value) && !/staging workflow test/i.test(value)) ?? '';
      }
    }
    knownPatientNumber = patientNumber ?? '';
    check('an existing staging workflow case provides a registered patient', !!patientNumber);
    await workEntryPage.getByRole('button', { name: /New case/ }).click();
    const patientSearch = workEntryPage.getByRole('combobox', { name: 'Find patient' });
    const searchBefore = await markTrace();
    await patientSearch.fill(patientNumber);
    const patientOption = workEntryPage.getByRole('option').filter({ hasText: patientNumber });
    await patientOption.waitFor();
    const patientLookup = await waitTrace(appIds.workEntry, 'GET', '/v1/patients', searchBefore);
    require2xx(patientLookup, 'Work Entry searches the existing staging patient through the Dental OS broker');
    await patientOption.click();
    await workEntryPage.getByLabel('Chief complaint', { exact: true }).fill(complaint);
    const caseBefore = await markTrace();
    await workEntryPage.getByRole('button', { name: 'Save case', exact: true }).click();
    const caseWrite = await waitTrace(appIds.workEntry, 'POST', '/v1/patients/:id/cases', caseBefore);
    require2xx(caseWrite, 'Work Entry creates a uniquely labeled case for the existing staging patient through its approved UI command');
  }
  const currentTestRow = workEntryPage.getByRole('row').filter({ hasText: namespace });
  if (reuseNamespace) {
    const existingCaseCount = await currentTestRow.count();
    check('the existing M18 staging case is reused exactly once without creating a duplicate', existingCaseCount === 1, { matchingCases: existingCaseCount });
  }
  if (!knownPatientNumber && await currentTestRow.count()) {
    const rowText = await currentTestRow.first().innerText();
    knownPatientNumber = rowText.match(/PT-\d+/)?.[0] ?? '';
    knownPatientName = rowText.split('\n').map(value => value.trim()).find(value => value && !/^\d+$/.test(value) && !/^PT-\d+/.test(value) && !/staging workflow test/i.test(value)) ?? '';
  }
  await workEntryPage.getByText(complaint, { exact: true }).waitFor();
  await workEntryPage.getByRole('textbox', { name: 'Search cases' }).fill(namespace);
  const startWork = workEntryPage.getByRole('button', { name: 'Start work', exact: true });
  await startWork.waitFor();

  step('work-entry-case-read-and-commit');
  const detailBefore = await markTrace();
  await startWork.click();
  const requiredReads = [
    '/v1/chief-complaints/:id/work-entry',
    '/v1/patients/:id/core',
    '/v1/patients/:id/ledger',
    '/v1/patients/:id/odontogram',
    '/v1/patients/:id/periodontal-chart',
    '/v1/patients/:id/canal-measurements',
    '/v1/clinic/suppliers',
    '/v1/follow-ups',
  ];
  for (const route of requiredReads) {
    const item = await waitTrace(appIds.workEntry, 'GET', route, detailBefore);
    require2xx(item, `Work Entry loads ${route} for the staging workflow case`);
  }
  await workEntryPage.getByRole('button', { name: /Patient & purpose/ }).click();
  const caseDoctors = workEntryPage.getByText('Case doctor(s)', { exact: true }).locator('..').getByRole('checkbox');
  check('Work Entry offers an active case doctor for staging workflow', await caseDoctors.count() > 0);
  const assignDoctor = !(await caseDoctors.first().isChecked());
  if (assignDoctor) await caseDoctors.first().check();
  check('an active case doctor is selected before clinical work is committed', await caseDoctors.first().isChecked());
  await workEntryPage.getByRole('button', { name: /Chart & plan/ }).click();
  const archButtons = workEntryPage.getByText('Whole-mouth / arch procedures', { exact: true }).locator('..').getByRole('button');
  check('staging provides a supported arch or whole-mouth treatment protocol', await archButtons.count() > 0);
  await archButtons.first().click();
  await workEntryPage.getByText('Treatment Plan (1)', { exact: true }).waitFor();
  await workEntryPage.getByRole('button', { name: /Recall/ }).last().click();
  const noFollowUp = workEntryPage.getByRole('checkbox', { name: /No follow-up needed for this visit/ });
  await noFollowUp.check();
  check('Work Entry records the explicit no-follow-up choice before review', await noFollowUp.isChecked());
  await workEntryPage.getByRole('button', { name: /Review & commit/ }).click();
  await workEntryPage.getByRole('button', { name: /Commit Work Entry/ }).waitFor();
  const commitBefore = await markTrace();
  await workEntryPage.getByRole('button', { name: /Commit Work Entry/ }).click();
  if (assignDoctor) {
    const caseUpdate = await waitTrace(appIds.workEntry, 'PUT', '/v1/chief-complaints/:id/work-entry', commitBefore, 30000);
    require2xx(caseUpdate, 'Work Entry saves the selected case doctor through its approved update command');
  }
  const commit = await waitTrace(appIds.workEntry, 'POST', '/v1/work-entry/commit', commitBefore, 30000);
  require2xx(commit, 'Work Entry submits its supported treatment plan as one atomic staging commit');

  step('work-entry-refresh-readback');
  await workEntryPage.getByRole('heading', { name: 'Work Entry', exact: true }).waitFor({ timeout: 30000 });
  await workEntryPage.getByText(complaint, { exact: true }).waitFor({ timeout: 20000 });
  await workEntryPage.getByRole('button', { name: 'Start work', exact: true }).click();
  await workEntryPage.getByRole('button', { name: /Chart & plan/ }).click();
  await workEntryPage.getByText('Treatment Plan (1)', { exact: true }).waitFor({ timeout: 20000 });
  check('fresh Work Entry detail read shows the committed staging plan', true);
  step('complete');
  }
} catch (error) {
  failed = true;
  let detail = String(error?.message ?? 'unknown').slice(0, 220);
  if (workEntryPage && !workEntryPage.isClosed()) {
    try {
      const visibleAlerts = await workEntryPage.locator('[role="alert"]').allInnerTexts();
      const safeAlerts = visibleAlerts.map(value => {
        let safe = value;
        if (knownPatientName) safe = safe.replaceAll(knownPatientName, '[patient name]');
        if (knownPatientNumber) safe = safe.replaceAll(knownPatientNumber, '[patient number]');
        return safe.replaceAll(namespace, '[staging case]')
          .replace(/\+?\d[\d\s-]{7,}\d/g, '[phone or identifier]')
          .slice(0, 240);
      });
      if (safeAlerts.length) uiDiagnostics.push({ appId: appIds.workEntry, alertCount: safeAlerts.length, alerts: safeAlerts });
      const knownValidations = [
        'Complete the required Patient & case details before committing this Work Entry.',
        'Choose the case doctor before recording completed work.',
        'Choose a follow-up date or confirm that no follow-up is needed.',
        'Add or complete treatment, update a chart, record a payment, add a prescription or lab request, or schedule a follow-up before saving.',
        'Add or complete treatment, update a chart, add a prescription, lab request, or schedule a follow-up before saving.',
      ];
      for (const message of knownValidations) {
        if (await workEntryPage.getByText(message, { exact: true }).count()) {
          uiDiagnostics.push({ appId: appIds.workEntry, visibleValidation: message });
        }
      }
    } catch {}
  }
  checks.push({ name: `run stopped during ${phase}`, passed: false, detail });
  console.error(`M18 Work Entry run stopped during ${phase}: ${String(error?.message ?? 'unknown').slice(0, 220)}`);
  process.exitCode = 1;
} finally {
  credentials = null;
  try { await saveEvidence(); } catch (error) { console.error(`Evidence save failed: ${String(error?.message ?? 'unknown').slice(0, 180)}`); process.exitCode = 1; }
  if (workEntryPage && !workEntryPage.isClosed()) await workEntryPage.close({ runBeforeUnload: false }).catch(() => {});
  if (shell && !shell.isClosed()) await shell.close({ runBeforeUnload: false }).catch(() => {});
  if (app) await app.close().catch(() => {});
}
