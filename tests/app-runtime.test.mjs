import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { firstPartyApps } from '../apps/manifest.js';
import { appApiCapabilitiesForRequest, appApiGrantsForApp, appContextCapabilitiesForApp, findAppApiGrant, financeSessionCapabilities, isValidAppCatalog } from '../apps/catalog.js';

const baseOrigin = 'https://browser.example.test';
const runtimeHtml = readFileSync(new URL('../apps/runtime.v1.html', import.meta.url), 'utf8');
const runtimeScript = readFileSync(new URL('../apps/runtime.v1.js', import.meta.url), 'utf8');
const browserClientSource = readFileSync(new URL('../apps/clinic-app-runtime/browserClinicClient.ts', import.meta.url), 'utf8');
const mediaHostSource = readFileSync(new URL('../apps/clinic-app-runtime/mediaHost.js', import.meta.url), 'utf8');
const hostScript = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const shellStyles = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const protocolAppSource = readFileSync(new URL('../apps/treatment-protocols/src/main.tsx', import.meta.url), 'utf8');
const financeAppSource = readFileSync(new URL('../apps/finance/src/main.tsx', import.meta.url), 'utf8');
const financeRuntimeSource = readFileSync(new URL('../apps/finance/src/runtimeBridge.ts', import.meta.url), 'utf8');
const financeSourceImport = JSON.parse(readFileSync(new URL('../apps/finance/SOURCE_IMPORT.json', import.meta.url), 'utf8'));
const calendarAppSource = readFileSync(new URL('../apps/calendar/src/main.tsx', import.meta.url), 'utf8');
const calendarRuntimeSource = readFileSync(new URL('../apps/calendar/src/runtimeBridge.ts', import.meta.url), 'utf8');
const calendarTasksSource = readFileSync(new URL('../apps/calendar/src/calendarTasks.ts', import.meta.url), 'utf8');
const calendarSourceImport = JSON.parse(readFileSync(new URL('../apps/calendar/SOURCE_IMPORT.json', import.meta.url), 'utf8'));
const calendarVerificationSource = readFileSync(new URL('../apps/calendar/SOURCE_VERIFICATION.md', import.meta.url), 'utf8');
const treatmentProgressAppSource = readFileSync(new URL('../apps/treatment-progress/src/main.tsx', import.meta.url), 'utf8');
const treatmentProgressRuntimeSource = readFileSync(new URL('../apps/treatment-progress/src/runtimeBridge.ts', import.meta.url), 'utf8');
const treatmentProgressSourceImport = JSON.parse(readFileSync(new URL('../apps/treatment-progress/SOURCE_IMPORT.json', import.meta.url), 'utf8'));
const workEntryAppSource = readFileSync(new URL('../apps/dental-apps/company.dental.work-entry.m17/src/main.tsx', import.meta.url), 'utf8');
const workEntryWorkspaceSource = readFileSync(new URL('../apps/dental-apps/company.dental.work-entry.m17/src/features/work-entry/WorkEntryWorkspace.tsx', import.meta.url), 'utf8');
const workEntryCaseEntrySource = readFileSync(new URL('../apps/dental-apps/company.dental.work-entry.m17/src/features/work-entry/components/CaseEntryView.tsx', import.meta.url), 'utf8');
const labTrackerAppSource = readFileSync(new URL('../apps/dental-apps/company.dental.lab-tracker.m17/src/main.tsx', import.meta.url), 'utf8');
const labTrackerViewSource = readFileSync(new URL('../apps/dental-apps/company.dental.lab-tracker.m17/src/features/labs/components/LabTrackerView.tsx', import.meta.url), 'utf8');
const labTrackerApiSource = readFileSync(new URL('../apps/dental-apps/company.dental.lab-tracker.m17/src/features/labs/api.ts', import.meta.url), 'utf8');
const patientRecordAppSource = readFileSync(new URL('../apps/dental-apps/company.dental.patient-record.m17/src/main.tsx', import.meta.url), 'utf8');
const userManagementAppSource = readFileSync(new URL('../apps/dental-apps/company.dental.user-management.m17/src/main.tsx', import.meta.url), 'utf8');
const userManagementApiSource = readFileSync(new URL('../apps/dental-apps/company.dental.user-management.m17/src/userManagementApi.ts', import.meta.url), 'utf8');
const serverScript = readFileSync(new URL('../tools/dev-server.mjs', import.meta.url), 'utf8');
const appLaunchSource = hostScript.match(/function openApp\(appId, fromRoute = false\) \{[\s\S]*?^\}/m)?.[0];
const runtimeFailureSource = hostScript.match(/function failAppRuntime\(app, entry, attempt, message\) \{[\s\S]*?^\}/m)?.[0];
const runtimeInitializeSource = hostScript.match(/async function initializeAppRuntime\(app, entry\) \{[\s\S]*?^\}/m)?.[0];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('ships a unique, validated catalog of first-party apps with Worker capability grants', () => {
  assert.equal(firstPartyApps.length, 11);
  assert.deepEqual(firstPartyApps.map((app) => app.id), [
    'appointments', 'patients', 'calendar', 'finance', 'followups', 'lab', 'treatment', 'protocols', 'staff', 'user-management', 'workentry',
  ]);
  assert.equal(isValidAppCatalog(firstPartyApps, baseOrigin), true);
  assert.equal(new Set(firstPartyApps.map((app) => app.id)).size, firstPartyApps.length);
  const protocols = firstPartyApps.find((app) => app.id === 'protocols');
  assert.deepEqual(protocols.apiGrants.map(({ method, path }) => ({ method, path })), [
    { method: 'GET', path: '/v1/treatment-protocols' },
    { method: 'POST', path: '/v1/treatment-protocols' },
    { method: 'PUT', path: '/v1/treatment-protocols/{uuid}' },
  ]);
  assert.deepEqual(protocols.capabilities, ['treatment_protocols.manage']);
  const finance = firstPartyApps.find((app) => app.id === 'finance');
  assert.deepEqual(finance.apiGrants, appApiGrantsForApp('finance'));
  assert.deepEqual(finance.apiGrants.map(({ method, path }) => ({ method, path })), [
    ...appApiGrantsForApp('finance').map(({ method, path }) => ({ method, path })),
  ]);
  assert.deepEqual(finance.capabilities, ['finance.manage', 'patient_payments.outstanding.read']);
  assert.deepEqual(finance.sessionCapabilities, financeSessionCapabilities);
  assert.equal(finance.apiGrants.length, 28);
  assert.deepEqual(firstPartyApps.find((app) => app.id === 'calendar').apiGrants, appApiGrantsForApp('calendar'));
  assert.deepEqual(firstPartyApps.find((app) => app.id === 'treatment').apiGrants, appApiGrantsForApp('treatment'));
  const userManagement = firstPartyApps.find((app) => app.id === 'user-management');
  assert.deepEqual(userManagement.capabilities, ['clinic_users.manage']);
  assert.deepEqual(userManagement.mediaGrants, []);
  assert.deepEqual(userManagement.apiGrants, appApiGrantsForApp('user-management'));
  assert.equal(isValidAppCatalog([firstPartyApps[0], firstPartyApps[0]], baseOrigin), false);
});

test('limits User Management to its admin capability and exact account routes', () => {
  const app = firstPartyApps.find((candidate) => candidate.id === 'user-management');
  const userId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  assert.deepEqual(appContextCapabilitiesForApp('user-management'), ['clinic_users.manage']);
  assert.deepEqual(app.apiGrants.map(({ method, path }) => ({ method, path })), [
    { method: 'GET', path: '/v1/clinic/users' },
    { method: 'POST', path: '/v1/clinic/users' },
    { method: 'PATCH', path: '/v1/clinic/users/{uuid}' },
    { method: 'POST', path: '/v1/clinic/users/{uuid}/password' },
  ]);
  assert.ok(findAppApiGrant(app, 'PATCH', `/v1/clinic/users/${userId}`));
  assert.ok(findAppApiGrant(app, 'POST', `/v1/clinic/users/${userId}/password`));
  assert.equal(findAppApiGrant(app, 'DELETE', `/v1/clinic/users/${userId}`), null);
  assert.equal(findAppApiGrant(app, 'PATCH', '/v1/clinic/users/not-a-uuid'), null);
  assert.equal(findAppApiGrant(app, 'POST', `/v1/clinic/users/${userId}/password/reset`), null);
  assert.match(userManagementAppSource, /session\.clinicUser\.role !== "admin"/);
  assert.match(userManagementAppSource, /session\.clinicUser\.capabilities\.includes\("clinic_users\.manage"\)/);
  assert.match(userManagementAppSource, /const browserRuntime = connectBrowserRuntime\(\)/);
  assert.match(userManagementApiSource, /client\.command\("PATCH", `\/v1\/clinic\/users\/\$\{clinicUserId\}`/);
  assert.doesNotMatch(userManagementAppSource + userManagementApiSource, /from ["'][^"']*(?:electron|firebase)|window\.dentalApp|window\.desktop|\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
  assert.match(runtimeInitializeSource, /app\.id === 'user-management'.*role !== 'admin'/s);
  for (const asset of [
    '/apps/user-management.v1.html',
    '/apps/user-management.v1.js',
    '/apps/user-management.v1.css',
    '/apps/dental-apps/company.dental.user-management.m17/asset-manifest.js',
    '/assets/dock/user-management.png',
  ]) assert.ok(serverScript.includes(asset), `dev server route ${asset}`);
});

test('allows app page back through dirty drafts while still blocking modals and pending writes', () => {
  const historyControls = hostScript.match(/function updateAppHistoryControls\(entry\) \{[\s\S]*?^\}/m)?.[0];
  const navigateBack = hostScript.match(/function navigateAppBack\(entry\) \{[\s\S]*?^\}/m)?.[0];
  const dockBuilder = hostScript.match(/function buildDock\(\) \{[\s\S]*?^\}/m)?.[0];
  const appExplorer = hostScript.match(/function renderAppExplorer\(\) \{[\s\S]*?^\}/m)?.[0];
  assert.ok(historyControls);
  assert.ok(navigateBack);
  assert.ok(dockBuilder);
  assert.ok(appExplorer);
  assert.match(historyControls, /entry\.navigationState\?\.canNavigate/);
  assert.match(historyControls, /!entry\.lifecycle\?\.modal/);
  assert.match(historyControls, /!entry\.lifecycle\?\.pendingWrite/);
  assert.match(historyControls, /!entry\.mediaPending/);
  assert.doesNotMatch(historyControls, /entry\.lifecycle\?\.dirty/);
  assert.doesNotMatch(navigateBack, /hasUnresolvedAppWork/);
  assert.match(navigateBack, /entry\.lifecycle\?\.modal \|\| entry\.lifecycle\?\.pendingWrite \|\| entry\.mediaPending/);
  assert.match(shellStyles, /\.running-dot\s*\{[^}]*top:\s*-7px;[^}]*background:\s*#078ac3;/);
  assert.match(shellStyles, /\.dock-icon\.is-active \.running-dot\s*\{[^}]*background:\s*#078ac3;/);
  assert.match(dockBuilder, /orderAppsForDisplay\(apps\.filter\(\(app\) => app\.id !== 'calendar'\)\)/);
  assert.match(appExplorer, /orderAppsForDisplay\(apps\.filter\(\(app\) => app\.id !== 'calendar' && allowedAppIds\.has\(app\.id\)\)\)/);
});

test('keeps default app windows inset and centered in browser full screen', () => {
  const desktopFullscreenRule = shellStyles.match(/\.desktop:fullscreen \.app-window:not\(\[hidden\]\):not\(\.is-fullscreen-resized\)\s*\{([^}]*)\}/)?.[1];
  const narrowFullscreenRule = shellStyles.match(/@media \(max-width: 760px\)\s*\{\s*\.desktop:fullscreen \.app-window:not\(\[hidden\]\):not\(\.is-fullscreen-resized\)\s*\{([^}]*)\}/)?.[1];
  assert.ok(desktopFullscreenRule);
  assert.ok(narrowFullscreenRule);
  for (const rule of [desktopFullscreenRule, narrowFullscreenRule]) {
    assert.match(rule, /left:\s*50%\s*!important;/);
    assert.match(rule, /width:\s*90%\s*!important;/);
    assert.match(rule, /transform:\s*translateX\(-50%\)\s*!important;/);
  }
});

test('rejects remote, malformed, and unregistered app metadata', () => {
  const remoteIcon = structuredClone(firstPartyApps[0]);
  remoteIcon.icon = 'https://untrusted.example/icon.png';
  assert.equal(isValidAppCatalog([remoteIcon], baseOrigin), false);

  const remoteEntry = structuredClone(firstPartyApps[0]);
  remoteEntry.bundle.entry = '//untrusted.example/app.html';
  assert.equal(isValidAppCatalog([remoteEntry], baseOrigin), false);

  const malformedVersion = structuredClone(firstPartyApps[0]);
  malformedVersion.version = 'latest';
  assert.equal(isValidAppCatalog([malformedVersion], baseOrigin), false);

  const unknownPublisher = structuredClone(firstPartyApps[0]);
  unknownPublisher.publisher = 'outside publisher';
  assert.equal(isValidAppCatalog([unknownPublisher], baseOrigin), false);

  const writeGrant = structuredClone(firstPartyApps[0]);
  writeGrant.apiGrants = [{ method: 'POST', path: '/v1/patients' }];
  assert.equal(isValidAppCatalog([writeGrant], baseOrigin), false);
  const broadProtocolGrant = structuredClone(firstPartyApps.find((app) => app.id === 'protocols'));
  broadProtocolGrant.apiGrants.push({ method: 'PUT', path: '/v1/treatment-protocols/{uuid}/archive' });
  assert.equal(isValidAppCatalog([broadProtocolGrant], baseOrigin), false);
});

test('matches only the explicit Work Entry and Patient Record backend routes and bounded queries', () => {
  const workEntry = firstPartyApps.find((candidate) => candidate.id === 'workentry');
  const patients = firstPartyApps.find((candidate) => candidate.id === 'patients');
  assert.ok(findAppApiGrant(workEntry, 'GET', '/v1/work-entry/cases'));
  assert.ok(findAppApiGrant(workEntry, 'POST', '/v1/work-entry/commit'));
  assert.ok(findAppApiGrant(workEntry, 'PUT', '/v1/patients/f12b56d1-2633-4a79-8fd8-2a4a0d39515c/odontogram'));
  assert.ok(findAppApiGrant(workEntry, 'GET', '/v1/patients?q=alia&limit=8'));
  assert.equal(findAppApiGrant(workEntry, 'GET', '/v1/patients?q=alia&limit=100'), null);
  assert.equal(findAppApiGrant(workEntry, 'DELETE', '/v1/work-entry/cases'), null);
  assert.equal(findAppApiGrant(workEntry, 'POST', '/v1/patients'), null);
  assert.equal(findAppApiGrant(workEntry, 'GET', '/v1/patients?q=alia&limit=8&tenant=other'), null);

  assert.ok(findAppApiGrant(patients, 'GET', '/v1/patients?limit=50'));
  assert.ok(findAppApiGrant(patients, 'GET', '/v1/patients?limit=20&cohort=regular'));
  assert.ok(findAppApiGrant(patients, 'POST', '/v1/patient-intakes'));
  assert.ok(findAppApiGrant(patients, 'PUT', '/v1/patients/f12b56d1-2633-4a79-8fd8-2a4a0d39515c/profile'));
  assert.ok(findAppApiGrant(patients, 'PATCH', '/v1/lab-orders/f12b56d1-2633-4a79-8fd8-2a4a0d39515c'));
  assert.ok(findAppApiGrant(patients, 'POST', '/v1/patient-media/f12b56d1-2633-4a79-8fd8-2a4a0d39515c/withdraw'));
  assert.equal(findAppApiGrant(patients, 'GET', '/v1/patients?limit=1000'), null);
  assert.equal(findAppApiGrant(patients, 'GET', '/v1/patients?limit=20&limit=20'), null);
  assert.equal(findAppApiGrant(patients, 'GET', '/v1/patients?limit=20&q=alia&cohort=regular'), null);
  assert.equal(findAppApiGrant(patients, 'DELETE', '/v1/patients/f12b56d1-2633-4a79-8fd8-2a4a0d39515c/profile'), null);

  const protocols = firstPartyApps.find((candidate) => candidate.id === 'protocols');
  const protocolId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  assert.equal(findAppApiGrant(protocols, 'PUT', `/v1/treatment-protocols/${protocolId}`), protocols.apiGrants[2]);
  assert.equal(findAppApiGrant(protocols, 'PUT', `/v1/treatment-protocols/${protocolId}/archive`), null);
  assert.equal(findAppApiGrant(protocols, 'DELETE', `/v1/treatment-protocols/${protocolId}`), null);
});

test('Lab Tracker creates a direct lab order from a searchable patient and open case', () => {
  const lab = firstPartyApps.find((candidate) => candidate.id === 'lab');
  const patientId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  assert.ok(findAppApiGrant(lab, 'GET', '/v1/patients?q=nirmala&limit=8'));
  assert.equal(findAppApiGrant(lab, 'GET', '/v1/patients?q=nirmala&limit=100'), null);
  assert.equal(findAppApiGrant(lab, 'GET', '/v1/patients?limit=8'), null);
  assert.ok(findAppApiGrant(lab, 'GET', `/v1/patients/${patientId}/treatment-plans`));
  assert.ok(findAppApiGrant(lab, 'POST', '/v1/lab-orders'));
  assert.equal(findAppApiGrant(lab, 'POST', '/v1/lab-requests'), null);

  assert.match(labTrackerAppSource, /api\.searchPatients\(query\)/);
  assert.match(labTrackerAppSource, /api\.listPatientCases\(patientId\)/);
  assert.match(labTrackerAppSource, /api\.createLabOrder\(input\)/);
  assert.match(labTrackerViewSource, /onClick=\{\(\) => setAddingLabOrder\(true\)\}/);
  assert.match(labTrackerViewSource, /<Plus size=\{15\} \/> Add Lab/);
  assert.match(labTrackerViewSource, /request=\{null\}[\s\S]*?onSearchPatients=\{onSearchPatients\}/);
  assert.match(labTrackerViewSource, /label="Find patient"[\s\S]*?role="combobox"[\s\S]*?aria-autocomplete="list"/);
  assert.match(labTrackerViewSource, /label="Open patient case"/);
  assert.match(labTrackerViewSource, /status: "sent"/);
  assert.doesNotMatch(labTrackerViewSource, /onCreateLabOrder[\s\S]{0,900}lab-requests/);
  assert.match(labTrackerApiSource, /client\.read<unknown>\(`\/v1\/patients\?\$\{params\.toString\(\)\}`\)/);
  assert.match(labTrackerApiSource, /client\.command\('POST', '\/v1\/lab-orders', input/);
});

test('matches only Finance contract routes and bounded query parameters', () => {
  const finance = firstPartyApps.find((candidate) => candidate.id === 'finance');
  const patientId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  const ledgerGrant = finance.apiGrants.find((grant) => grant.path === '/v1/patients/{uuid}/ledger');

  assert.ok(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-01-01&to=2026-01-31'));
  assert.ok(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?month=2026-01&cursor=opaque.cursor_1`));
  assert.ok(findAppApiGrant(finance, 'PATCH', `/v1/clinic/products/${patientId}`));
  assert.ok(findAppApiGrant(finance, 'POST', `/v1/clinic/operating-expenses/${patientId}/void`));
  assert.equal(findAppApiGrant(finance, 'PATCH', `/v1/clinic/products/${patientId}/delete`), null);
  assert.equal(findAppApiGrant(finance, 'DELETE', `/v1/clinic/products/${patientId}`), null);
  assert.equal(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-02-01'), null);
  assert.equal(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-02-01&to=2026-02-28&branch=other'), null);
  assert.ok(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=worker%3Aopaque%2Ftoken%3D`));
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=first&cursor=second`), null);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=${'x'.repeat(513)}`), null);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?`), null);
  assert.equal(findAppApiGrant(finance, 'POST', `/v1/patients/${patientId}/ledger`), null);
  assert.deepEqual(appApiCapabilitiesForRequest(finance, 'GET', `/v1/patients/${patientId}/ledger`), ['patient_billing_ledger.read']);
  assert.deepEqual(appApiCapabilitiesForRequest(finance, 'POST', `/v1/patients/${patientId}/payments`, {}), [
    'patient_payments.collect',
  ]);
  assert.equal(ledgerGrant.capabilities.includes('patient_billing_ledger.read'), true);
});

test('matches Calendar and Treatment Progress routes, identifiers, and bounded date ranges', () => {
  const calendar = firstPartyApps.find((candidate) => candidate.id === 'calendar');
  const treatmentProgress = firstPartyApps.find((candidate) => candidate.id === 'treatment');
  const taskId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';

  assert.ok(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&to=2026-02-15'));
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&to=2026-02-16'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-02-01&to=2026-01-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-02-30&to=2026-03-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&from=2026-01-02&to=2026-01-20'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks'), null);
  assert.ok(findAppApiGrant(calendar, 'POST', '/v1/calendar-tasks'));
  assert.equal(findAppApiGrant(calendar, 'POST', '/v1/calendar-tasks?from=2026-01-01&to=2026-01-20'), null);
  assert.ok(findAppApiGrant(calendar, 'PATCH', `/v1/calendar-tasks/${taskId}`));
  assert.equal(findAppApiGrant(calendar, 'PATCH', `/v1/calendar-tasks/${taskId}?status=completed`), null);
  assert.equal(findAppApiGrant(calendar, 'PATCH', '/v1/calendar-tasks/not-a-uuid'), null);
  assert.ok(findAppApiGrant(calendar, 'POST', `/v1/calendar-tasks/${taskId}/archive`));
  assert.equal(findAppApiGrant(calendar, 'POST', `/v1/calendar-tasks/${taskId}/delete`), null);
  assert.equal(findAppApiGrant(calendar, 'DELETE', `/v1/calendar-tasks/${taskId}`), null);

  assert.ok(findAppApiGrant(treatmentProgress, 'GET', '/v1/treatment-progress'));
  assert.equal(findAppApiGrant(treatmentProgress, 'GET', '/v1/treatment-progress?branch=other'), null);
  assert.equal(findAppApiGrant(treatmentProgress, 'POST', '/v1/treatment-progress'), null);
});

test('keeps Finance, Calendar, and Treatment Progress route definitions aligned with their source contracts', () => {
  const financeRoutes = Object.values(financeSourceImport.sdkContract)
    .flatMap((value) => value && typeof value === 'object' && Array.isArray(value.routes) ? value.routes : []);
  const sourceFinanceRoutes = [
    financeSourceImport.sdkContract.route,
    ...financeRoutes.map(({ method, path }) => `${method} ${path}`),
  ].map((route) => String(route).replace(/:\w+/g, '{uuid}').replace(/\?.*$/, ''));
  const browserFinanceRoutes = appApiGrantsForApp('finance').map(({ method, path }) => `${method} ${path}`);
  assert.deepEqual([...new Set(browserFinanceRoutes)].sort(), [...new Set(sourceFinanceRoutes)].sort());
  assert.equal(calendarSourceImport.sourceCommit, 'fd2cc5439694ce844362c9dec8a6267378d11381');
  assert.ok(calendarVerificationSource.includes('GET /v1/calendar-tasks?from=...&to=...'));
  assert.match(calendarTasksSource, /client\.command\('POST', '\/v1\/calendar-tasks'/);
  assert.match(calendarTasksSource, /client\.command\('PATCH', `\/v1\/calendar-tasks\/\$\{task\.id\}`/);
  assert.equal(treatmentProgressSourceImport.contractSources.some(({ source }) => source.endsWith('treatmentProgress.routes.ts')), true);
  assert.match(treatmentProgressAppSource, /read<\{ patients: unknown \}>\("\/v1\/treatment-progress"/);
});

test('passes only app-scoped session capabilities as UI context without widening API grants', () => {
  const workEntry = firstPartyApps.find((candidate) => candidate.id === 'workentry');
  const patients = firstPartyApps.find((candidate) => candidate.id === 'patients');
  assert.ok(appContextCapabilitiesForApp('workentry').includes('patient_payments.collect'));
  assert.ok(appContextCapabilitiesForApp('workentry').includes('patient_billing_ledger.read'));
  assert.ok(!workEntry.apiGrants.some(({ method, path }) => method === 'POST' && path === '/v1/patients/{uuid}/payments'));
  assert.ok(appContextCapabilitiesForApp('patients').includes('patient_record.access'));
  assert.deepEqual(appContextCapabilitiesForApp('other-app'), []);
  const commitPath = '/v1/work-entry/commit';
  assert.deepEqual(appApiCapabilitiesForRequest(workEntry, 'POST', commitPath, { payment: null }), ['work_entry.access']);
  assert.deepEqual(appApiCapabilitiesForRequest(workEntry, 'POST', commitPath, { payment: { amount: 100 } }), [
    'work_entry.access', 'patient_payments.collect', 'patient_billing_ledger.read',
  ]);
  assert.equal(appApiCapabilitiesForRequest(workEntry, 'POST', '/v1/patients/f12b56d1-2633-4a79-8fd8-2a4a0d39515c/payments', { amount: 100 }), null);
  assert.match(runtimeInitializeSource, /appContextCapabilitiesForApp\(app\.id\)/);
  assert.match(runtimeInitializeSource, /appContextCapabilities\.filter\(capability => rawCapabilities\.includes\(capability\)\)/);
  assert.match(workEntryCaseEntrySource, /doctorNames: selectedDoctors,\s*payment,\s*followUp/);
  assert.match(workEntryWorkspaceSource, /payment: recall\.payment/);
  assert.match(workEntryWorkspaceSource, /doctorNames, payment, followUp/);
  assert.match(workEntryWorkspaceSource, /labOrders: \[\],\s*followUp:[\s\S]*?payment,/);
});

test('limits radiograph permissions to the Patient Record app', () => {
  const workEntry = firstPartyApps.find((candidate) => candidate.id === 'workentry');
  const patients = firstPartyApps.find((candidate) => candidate.id === 'patients');
  assert.deepEqual(workEntry.mediaGrants, ['clinic.media.read']);
  assert.deepEqual(patients.mediaGrants, ['clinic.media.read', 'clinic.media.upload']);
  assert.equal(isValidAppCatalog([{ ...workEntry, mediaGrants: ['clinic.media.read', 'clinic.media.upload'] }], baseOrigin), false);
});

test('rejects launches without the Worker capability and keeps credentials out of app code', () => {
  assert.ok(appLaunchSource);
  assert.match(appLaunchSource, /if \(!app \|\| !allowedAppIds\.has\(appId\)\) return;/);
  assert.match(hostScript, /visibleAppsForCapabilities\(apps, session\.clinicUser\.capabilities\)/);
  assert.doesNotMatch(runtimeScript, /firebase|authorization|bearer|idToken|accessToken/i);
  assert.doesNotMatch(runtimeScript, /\bwindow\.parent\.document|window\.top\.document/);
});

test('fails closed on an app handshake timeout and offers a clean retry', () => {
  assert.ok(runtimeFailureSource);
  assert.ok(runtimeInitializeSource);
  assert.match(runtimeInitializeSource, /The app did not complete its secure startup handshake/);
  assert.match(runtimeInitializeSource, /failAppRuntime\(app, entry, attempt/);
  assert.match(runtimeFailureSource, /entry\.port\?\.close\(\)/);
  assert.match(runtimeFailureSource, /entry\.frame\?\.remove\(\)/);
  assert.match(runtimeFailureSource, /initializeAppRuntime\(app, entry\)/);
});

test('registers the Treatment Protocols handshake before React mounts', () => {
  const listenerRegistration = protocolAppSource.indexOf('const browserRuntime = connectBrowserRuntime();');
  const reactMount = protocolAppSource.indexOf('createRoot(document.getElementById');
  assert.ok(listenerRegistration >= 0 && reactMount > listenerRegistration);
  assert.match(protocolAppSource, /void browserRuntime\.then\(bridge =>/);
  assert.doesNotMatch(protocolAppSource, /void connectBrowserRuntime\(\)\.then/);
});

test('registers each migrated app handshake before React mounts', () => {
  for (const source of [workEntryAppSource, patientRecordAppSource]) {
    const listenerRegistration = source.indexOf('connectBrowserRuntime()');
    const reactMount = source.indexOf('createRoot(document.getElementById');
    assert.ok(listenerRegistration >= 0 && reactMount > listenerRegistration);
    assert.match(source, /void browserRuntime\.then/);
    assert.doesNotMatch(source, /void connectBrowserRuntime\(\)\.then/);
  }
});

test('registers Finance, Calendar, and Treatment Progress host handshakes before React mounts', () => {
  const financeListener = financeAppSource.indexOf('const browserRuntime = connectBrowserRuntime(APP_ID);');
  const financeMount = financeAppSource.indexOf('createRoot(document.getElementById');
  assert.ok(financeListener >= 0 && financeMount > financeListener);
  assert.match(financeRuntimeSource, /value\.appId !== expectedAppId/);
  assert.match(financeRuntimeSource, /supportedCapabilities\.has\(capability\)/);
  assert.match(runtimeInitializeSource, /app\.sessionCapabilities\.filter\(capability => clinicSession\?\.clinicUser\?\.capabilities\?\.includes\(capability\)\)/);
  assert.doesNotMatch(financeRuntimeSource, /\bfetch\s*\(|authorization|Bearer|idToken|accessToken|window\.desktop|dentalApp/);
  assert.doesNotMatch(financeAppSource, /window\.dentalApp|electron\/|authorization|idToken|accessToken/);

  for (const [appName, appSource, bridgeSource] of [
    ['Calendar', calendarAppSource, calendarRuntimeSource],
    ['Treatment Progress', treatmentProgressAppSource, treatmentProgressRuntimeSource],
  ]) {
    const listenerRegistration = appSource.indexOf('const browserRuntime = connectBrowserRuntime(APP_ID);');
    const reactMount = appSource.indexOf('createRoot(document.getElementById');
    assert.ok(listenerRegistration >= 0 && reactMount > listenerRegistration, `${appName} listener must precede React`);
    assert.match(appSource, /void browserRuntime\.then/);
    assert.match(bridgeSource, /data\.appId === expectedAppId/);
    assert.doesNotMatch(appSource, /window\.dentalApp|electron\/|authorization|Bearer|idToken|accessToken|firebase/i);
    assert.doesNotMatch(bridgeSource, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|window\.desktop|dentalApp|authorization|Bearer|idToken|accessToken/i);
  }
  assert.match(calendarAppSource, /clinicToday\(bridge\.clinicTimeZone \?\? 'Asia\/Kathmandu'\)/);
  assert.match(calendarRuntimeSource, /appId,bundleSha256,clinicTimeZone,nonce,title,type,version/);
  assert.match(runtimeInitializeSource, /const calendarContext = app\.id === 'calendar' \? \{ clinicTimeZone: trustedCalendarTimeZone\(\) \}/);
  assert.match(hostScript, /clinicSession\?\.clinic\?\.timezone/);
  assert.match(hostScript, /return 'Asia\/Kathmandu'/);
});

test('keeps uncertain clinic writes retryable with the original command key and saved receipt', () => {
  assert.match(browserClientSource, /if \(this\.completed\) return this\.saved as T/);
  assert.match(browserClientSource, /this\.bridge\.request\(command\.method, command\.path, command\.body, command\.operationId\)/);
  assert.match(browserClientSource, /this\.saved = value;\s*this\.completed = true/);
  assert.match(browserClientSource, /new ClinicError\('UNKNOWN_OUTCOME',[\s\S]*?'unknown', command\.operationId\)/);
});

test('allows bounded media chunks through while retaining the app concurrency limit', () => {
  assert.match(hostScript, /const isMediaUploadChunk = message\.operation === 'clinic\.media\.upload' && message\.input\.action === 'chunk'/);
  assert.match(hostScript, /appRequestLimitReached\(entry, !isMediaUploadChunk\)/);
  assert.match(hostScript, /return \(countRateLimitedRequest && entry\.requestCount > 30\) \|\| entry\.pendingRequests >= 4/);
  assert.match(mediaHostSource, /const maxBytes = 10 \* 1024 \* 1024/);
  assert.match(mediaHostSource, /chunk\.length > 8192/);
});

test('pins the exact app entry and JavaScript bytes in the trusted manifest and SRI attribute', () => {
  for (const app of firstPartyApps) {
    const { entry, entrySha256, script, scriptSha256, style, styleSha256 } = app.bundle;
    const entryBytes = readFileSync(new URL(`..${entry}`, import.meta.url));
    const scriptBytes = readFileSync(new URL(`..${script}`, import.meta.url));
    assert.equal(entrySha256, sha256(entryBytes), `${app.id} entry hash`);
    assert.equal(scriptSha256, sha256(scriptBytes), `${app.id} script hash`);
    const integrity = createHash('sha256').update(scriptBytes).digest('base64');
    assert.ok(entryBytes.toString('utf8').includes(`integrity="sha256-${integrity}"`), `${app.id} script SRI`);
    if (style) {
      const styleBytes = readFileSync(new URL(`..${style}`, import.meta.url));
      assert.equal(styleSha256, sha256(styleBytes), `${app.id} style hash`);
    }
  }
  const protocolBundle = firstPartyApps.find((app) => app.id === 'protocols').bundle;
  const protocolEntry = readFileSync(new URL('../apps/treatment-protocols.v1.html', import.meta.url), 'utf8');
  const protocolScript = readFileSync(new URL('../apps/treatment-protocols.v1.js', import.meta.url));
  const protocolStyle = readFileSync(new URL('../apps/treatment-protocols.v1.css', import.meta.url));
  assert.match(protocolBundle.style, /^\/apps\/treatment-protocols\.v1\.css$/);
  assert.equal(protocolBundle.entrySha256, sha256(Buffer.from(protocolEntry)));
  assert.equal(protocolBundle.scriptSha256, sha256(protocolScript));
  assert.equal(protocolBundle.styleSha256, sha256(protocolStyle));
  assert.doesNotMatch(protocolScript.toString('utf8'), /process\.env\.NODE_ENV/);
  const protocolScriptIntegrity = createHash('sha256').update(protocolScript).digest('base64');
  const protocolStyleIntegrity = createHash('sha256').update(protocolStyle).digest('base64');
  assert.ok(protocolEntry.includes(`script-src 'sha256-${protocolScriptIntegrity}'`));
  assert.ok(protocolEntry.includes(`style-src 'sha256-${protocolStyleIntegrity}'`));
  assert.ok(protocolEntry.includes(`integrity="sha256-${protocolScriptIntegrity}"`));

  for (const appId of ['workentry', 'patients']) {
    const app = firstPartyApps.find((candidate) => candidate.id === appId);
    const entry = readFileSync(new URL(`../apps/${appId}.v1.html`, import.meta.url), 'utf8');
    const script = readFileSync(new URL(`../apps/${appId}.v1.js`, import.meta.url));
    const style = readFileSync(new URL(`../apps/${appId}.v1.css`, import.meta.url));
    assert.equal(app.bundle.entrySha256, sha256(Buffer.from(entry)));
    assert.equal(app.bundle.scriptSha256, sha256(script));
    assert.equal(app.bundle.styleSha256, sha256(style));
    assert.ok(entry.includes(`integrity="${createHash('sha256').update(script).digest('base64').replace(/^/, 'sha256-')}"`));
    assert.ok(entry.includes(`script-src 'sha256-${createHash('sha256').update(script).digest('base64')}'`));
    assert.ok(entry.includes(`style-src 'sha256-${createHash('sha256').update(style).digest('base64')}'`));
    assert.ok(entry.includes("style-src-attr 'unsafe-inline'"));
    assert.doesNotMatch(script.toString('utf8'), /firebase|NEXT_PUBLIC_FIREBASE|idToken|accessToken|getIdToken|authorization|bearer|window\.dentalApp|window\.desktop/i);
    assert.doesNotMatch(script.toString('utf8'), /\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
  }

  for (const [appId, bundleName] of [['finance', 'finance.v1'], ['calendar', 'calendar.v1'], ['treatment', 'treatment-progress.v1']]) {
    const app = firstPartyApps.find((candidate) => candidate.id === appId);
    const entry = readFileSync(new URL(`../apps/${bundleName}.html`, import.meta.url), 'utf8');
    const script = readFileSync(new URL(`../apps/${bundleName}.js`, import.meta.url));
    const style = readFileSync(new URL(`../apps/${bundleName}.css`, import.meta.url));
    const scriptIntegrity = createHash('sha256').update(script).digest('base64');
    const styleIntegrity = createHash('sha256').update(style).digest('base64');
    assert.equal(app.bundle.entrySha256, sha256(Buffer.from(entry)));
    assert.equal(app.bundle.scriptSha256, sha256(script));
    assert.equal(app.bundle.styleSha256, sha256(style));
    assert.ok(entry.includes(`script-src 'sha256-${scriptIntegrity}'`));
    assert.ok(entry.includes(`style-src 'sha256-${styleIntegrity}'`));
    assert.ok(entry.includes(`integrity="sha256-${scriptIntegrity}"`));
    assert.doesNotMatch(script.toString('utf8'), /process\.env\.NODE_ENV/);
  }

  const userManagement = firstPartyApps.find((candidate) => candidate.id === 'user-management');
  const userManagementEntry = readFileSync(new URL('../apps/user-management.v1.html', import.meta.url), 'utf8');
  const userManagementScript = readFileSync(new URL('../apps/user-management.v1.js', import.meta.url), 'utf8');
  assert.equal(userManagement.bundle.entrySha256, sha256(Buffer.from(userManagementEntry)));
  assert.equal(userManagement.bundle.scriptSha256, sha256(Buffer.from(userManagementScript)));
  assert.equal(userManagement.bundle.styleSha256, sha256(readFileSync(new URL('../apps/user-management.v1.css', import.meta.url))));
  assert.match(userManagementEntry, /connect-src 'none'/);
  assert.doesNotMatch(userManagementScript, /NEXT_PUBLIC_FIREBASE|idToken|accessToken|getIdToken|window\.dentalApp|window\.desktop/i);
  assert.doesNotMatch(userManagementScript, /\bfetch\s*\(|XMLHttpRequest|localStorage|indexedDB/);
});

test('isolates app code in a scripts-only frame with a private host channel and no direct network API', () => {
  const scriptIntegrity = createHash('sha256').update(runtimeScript).digest('base64');
  assert.match(hostScript, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.doesNotMatch(hostScript, /allow-same-origin|allow-top-navigation|allow-forms|allow-popups/);
  assert.match(hostScript, /new MessageChannel\(\)/);
  assert.match(hostScript, /crypto\.subtle\.digest\('SHA-256'/);
  assert.match(hostScript, /message\.nonce === entry\.nonce/);
  assert.match(runtimeScript, /data\.nonce === appContext\.nonce/);
  assert.match(hostScript, /const expectedKeys = \['appId', 'body', 'idempotencyKey', 'method', 'nonce', 'path', 'requestId', 'type', 'version'\]/);
  assert.match(hostScript, /Object\.keys\(message\)\.sort\(\)\.join\(','\) === expectedKeys\.join\(','\)/);
  assert.match(hostScript, /typeof message\.idempotencyKey === 'string'/);
  assert.match(hostScript, /appApiCapabilitiesForRequest\(app, request\.method, request\.path, body\)/);
  assert.match(runtimeScript, /event\.source !== window\.parent/);
  assert.match(runtimeScript, /Object\.keys\(data\)\.sort\(\)\.join\(','\) === 'appId,bundleSha256,nonce,title,type,version'/);
  assert.match(hostScript, /Object\.keys\(message\)\.sort\(\)\.join\(','\) !== 'appId,bundleSha256,nonce,type,version'/);
  assert.match(runtimeScript, /ports\.length === 1/);
  assert.doesNotMatch(runtimeScript, /\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|indexedDB|window\.desktop/);
  assert.match(runtimeHtml, /connect-src 'none'/);
  assert.ok(runtimeHtml.includes(`script-src 'sha256-${scriptIntegrity}'`));
  assert.ok(serverScript.includes(`script-src 'sha256-${scriptIntegrity}'; style-src 'unsafe-inline'; img-src data:; connect-src 'none'`));
  assert.match(serverScript, /frame-src \$\{frameSources\}/);
  assert.match(serverScript, /\['\/apps\/runtime\.v1\.html', 'apps\/runtime\.v1\.html'\]/);
  for (const path of [
    '/apps/calendar.v1.html', '/apps/calendar.v1.js', '/apps/calendar.v1.css', '/apps/calendar/asset-manifest.js',
    '/apps/finance.v1.html', '/apps/finance.v1.js', '/apps/finance.v1.css', '/apps/finance/asset-manifest.js',
    '/apps/treatment-progress.v1.html', '/apps/treatment-progress.v1.js', '/apps/treatment-progress.v1.css', '/apps/treatment-progress/asset-manifest.js',
    '/apps/workentry.v1.html', '/apps/workentry.v1.js', '/apps/workentry.v1.css',
    '/apps/dental-apps/company.dental.work-entry.m17/asset-manifest.js',
    '/apps/patients.v1.html', '/apps/patients.v1.js', '/apps/patients.v1.css',
    '/apps/dental-apps/company.dental.patient-record.m17/asset-manifest.js',
    '/apps/clinic-app-runtime/mediaHost.js',
  ]) assert.ok(serverScript.includes(`['${path}'`), `${path} should be served by the local dev server`);
});
