import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { firstPartyApps } from '../apps/manifest.js';
import { calendarApiGrants, financeApiGrants, findAppApiGrant, isValidAppCatalog, treatmentProgressApiGrants } from '../apps/catalog.js';

const baseOrigin = 'https://browser.example.test';
const runtimeHtml = readFileSync(new URL('../apps/runtime.v1.html', import.meta.url), 'utf8');
const runtimeScript = readFileSync(new URL('../apps/runtime.v1.js', import.meta.url), 'utf8');
const hostScript = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
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
const serverScript = readFileSync(new URL('../tools/dev-server.mjs', import.meta.url), 'utf8');
const appLaunchSource = hostScript.match(/function openApp\(appId, fromRoute = false\) \{[\s\S]*?^\}/m)?.[0];
const runtimeFailureSource = hostScript.match(/function failAppRuntime\(app, entry, attempt, message\) \{[\s\S]*?^\}/m)?.[0];
const runtimeInitializeSource = hostScript.match(/async function initializeAppRuntime\(app, entry\) \{[\s\S]*?^\}/m)?.[0];

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

test('ships a unique, validated catalog of first-party apps with Worker capability grants', () => {
  assert.equal(firstPartyApps.length, 10);
  assert.equal(isValidAppCatalog(firstPartyApps, baseOrigin), true);
  assert.equal(new Set(firstPartyApps.map((app) => app.id)).size, firstPartyApps.length);
  assert.ok(firstPartyApps.filter((app) => !['protocols', 'finance', 'calendar', 'treatment'].includes(app.id)).every((app) => app.apiGrants.length === 0));
  const protocols = firstPartyApps.find((app) => app.id === 'protocols');
  assert.deepEqual(protocols.apiGrants, [
    { method: 'GET', path: '/v1/treatment-protocols' },
    { method: 'POST', path: '/v1/treatment-protocols' },
    { method: 'PUT', path: '/v1/treatment-protocols/{uuid}' },
  ]);
  assert.deepEqual(protocols.capabilities, ['treatment_protocols.manage']);
  const finance = firstPartyApps.find((app) => app.id === 'finance');
  assert.deepEqual(finance.apiGrants, financeApiGrants);
  assert.deepEqual(finance.capabilities, ['finance.manage', 'patient_payments.outstanding.read']);
  assert.deepEqual(finance.sessionCapabilities, [
    'finance.manage', 'patient_payments.outstanding.read', 'patient_payments.received.read',
    'patient_billing_ledger.read', 'patient_payments.collect', 'staff.manage',
  ]);
  assert.equal(finance.apiGrants.length, 28);
  const calendar = firstPartyApps.find((app) => app.id === 'calendar');
  assert.deepEqual(calendar.apiGrants, calendarApiGrants);
  assert.deepEqual(calendar.capabilities, ['calendar.access']);
  const treatmentProgress = firstPartyApps.find((app) => app.id === 'treatment');
  assert.deepEqual(treatmentProgress.apiGrants, treatmentProgressApiGrants);
  assert.deepEqual(treatmentProgress.capabilities, ['treatment_progress.access']);
  assert.equal(isValidAppCatalog([firstPartyApps[0], firstPartyApps[0]], baseOrigin), false);
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

  const broadFinanceGrant = structuredClone(firstPartyApps.find((app) => app.id === 'finance'));
  broadFinanceGrant.apiGrants.push({ method: 'DELETE', path: '/v1/clinic/products/{uuid}' });
  assert.equal(isValidAppCatalog([broadFinanceGrant], baseOrigin), false);
  const unrelatedFinanceGrant = structuredClone(firstPartyApps.find((app) => app.id === 'finance'));
  unrelatedFinanceGrant.apiGrants.push({ method: 'POST', path: '/v1/patients/{uuid}/delete' });
  assert.equal(isValidAppCatalog([unrelatedFinanceGrant], baseOrigin), false);
  const unsupportedFinanceSessionCapability = structuredClone(firstPartyApps.find((app) => app.id === 'finance'));
  unsupportedFinanceSessionCapability.sessionCapabilities.push('unreviewed.capability');
  assert.equal(isValidAppCatalog([unsupportedFinanceSessionCapability], baseOrigin), false);
});

test('matches API grants by exact method and path only', () => {
  const app = { ...firstPartyApps[0], apiGrants: [{ method: 'GET', path: '/v1/clinic-profile' }] };
  assert.deepEqual(findAppApiGrant(app, 'GET', '/v1/clinic-profile'), app.apiGrants[0]);
  assert.equal(findAppApiGrant(app, 'POST', '/v1/clinic-profile'), null);
  assert.equal(findAppApiGrant(app, 'GET', '/v1/clinic-profile?tenant=other'), null);
  assert.equal(findAppApiGrant(firstPartyApps[0], 'GET', '/v1/clinic-profile'), null);
  const protocols = firstPartyApps.find((candidate) => candidate.id === 'protocols');
  const protocolId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  assert.equal(findAppApiGrant(protocols, 'PUT', `/v1/treatment-protocols/${protocolId}`), protocols.apiGrants[2]);
  assert.equal(findAppApiGrant(protocols, 'PUT', `/v1/treatment-protocols/${protocolId}/archive`), null);
  assert.equal(findAppApiGrant(protocols, 'DELETE', `/v1/treatment-protocols/${protocolId}`), null);
});

test('matches only Finance contract routes, scoped UUIDs, and documented query parameters', () => {
  const finance = firstPartyApps.find((candidate) => candidate.id === 'finance');
  const recordGrant = finance.apiGrants[0];
  const patientId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
  const productGrant = finance.apiGrants.find((grant) => grant.path === '/v1/clinic/products/{uuid}' && grant.method === 'PATCH');
  const ledgerGrant = finance.apiGrants.find((grant) => grant.path === '/v1/patients/{uuid}/ledger');

  assert.equal(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-01-01&to=2026-01-31'), recordGrant);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?month=2026-01&cursor=opaque.cursor_1`), ledgerGrant);
  assert.equal(findAppApiGrant(finance, 'PATCH', `/v1/clinic/products/${patientId}`), productGrant);
  assert.equal(findAppApiGrant(finance, 'POST', `/v1/clinic/operating-expenses/${patientId}/void`), finance.apiGrants.find((grant) => grant.path.endsWith('/void')));
  assert.equal(findAppApiGrant(finance, 'PATCH', `/v1/clinic/products/${patientId}/delete`), null);
  assert.equal(findAppApiGrant(finance, 'DELETE', `/v1/clinic/products/${patientId}`), null);
  assert.equal(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-02-01'), null);
  assert.equal(findAppApiGrant(finance, 'GET', '/v1/clinic/transaction-record?from=2026-02-01&to=2026-02-28&branch=other'), null);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=worker%3Aopaque%2Ftoken%3D`), ledgerGrant);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=first&cursor=second`), null);
  assert.equal(findAppApiGrant(finance, 'GET', `/v1/patients/${patientId}/ledger?cursor=${'x'.repeat(513)}`), null);
  assert.equal(findAppApiGrant(finance, 'POST', `/v1/patients/${patientId}/ledger`), null);
});

test('matches Calendar and Treatment Progress routes, UUIDs, and bounded date ranges', () => {
  const calendar = firstPartyApps.find((candidate) => candidate.id === 'calendar');
  const treatmentProgress = firstPartyApps.find((candidate) => candidate.id === 'treatment');
  const taskId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';

  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&to=2026-02-15'), calendar.apiGrants[0]);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&to=2026-02-16'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-02-01&to=2026-01-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-02-30&to=2026-03-01'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks?from=2026-01-01&from=2026-01-02&to=2026-01-20'), null);
  assert.equal(findAppApiGrant(calendar, 'GET', '/v1/calendar-tasks'), null);
  assert.equal(findAppApiGrant(calendar, 'POST', '/v1/calendar-tasks'), calendar.apiGrants[1]);
  assert.equal(findAppApiGrant(calendar, 'POST', '/v1/calendar-tasks?from=2026-01-01&to=2026-01-20'), null);
  assert.equal(findAppApiGrant(calendar, 'PATCH', `/v1/calendar-tasks/${taskId}`), calendar.apiGrants[2]);
  assert.equal(findAppApiGrant(calendar, 'PATCH', `/v1/calendar-tasks/${taskId}?status=completed`), null);
  assert.equal(findAppApiGrant(calendar, 'PATCH', '/v1/calendar-tasks/not-a-uuid'), null);
  assert.equal(findAppApiGrant(calendar, 'POST', `/v1/calendar-tasks/${taskId}/archive`), calendar.apiGrants[3]);
  assert.equal(findAppApiGrant(calendar, 'POST', `/v1/calendar-tasks/${taskId}/delete`), null);
  assert.equal(findAppApiGrant(calendar, 'DELETE', `/v1/calendar-tasks/${taskId}`), null);

  assert.equal(findAppApiGrant(treatmentProgress, 'GET', '/v1/treatment-progress'), treatmentProgress.apiGrants[0]);
  assert.equal(findAppApiGrant(treatmentProgress, 'GET', '/v1/treatment-progress?branch=other'), null);
  assert.equal(findAppApiGrant(treatmentProgress, 'POST', '/v1/treatment-progress'), null);
});

test('documents the copied Calendar and Treatment Progress source contracts', () => {
  const calendarGrants = calendarApiGrants.map(({ method, path }) => `${method} ${path}`);
  const treatmentRoute = treatmentProgressSourceImport.contractSources.find(({ source }) => source.endsWith('treatmentProgress.routes.ts'));
  assert.equal(calendarSourceImport.sourceCommit, 'fd2cc5439694ce844362c9dec8a6267378d11381');
  assert.deepEqual(calendarGrants, [
    'GET /v1/calendar-tasks',
    'POST /v1/calendar-tasks',
    'PATCH /v1/calendar-tasks/{uuid}',
    'POST /v1/calendar-tasks/{uuid}/archive',
  ]);
  assert.ok(calendarVerificationSource.includes('GET /v1/calendar-tasks?from=...&to=...'));
  assert.ok(calendarVerificationSource.includes('POST /v1/calendar-tasks'));
  assert.ok(calendarVerificationSource.includes('PATCH /v1/calendar-tasks/:id'));
  assert.ok(calendarVerificationSource.includes('POST /v1/calendar-tasks/:id/archive'));
  assert.match(calendarTasksSource, /\/v1\/calendar-tasks\?\$\{new URLSearchParams\(\{ from, to \}\)\}/);
  assert.match(calendarTasksSource, /client\.command\('POST', '\/v1\/calendar-tasks'/);
  assert.match(calendarTasksSource, /client\.command\('PATCH', `\/v1\/calendar-tasks\/\$\{task\.id\}`/);
  assert.match(calendarTasksSource, /client\.command\('POST', `\/v1\/calendar-tasks\/\$\{task\.id\}\/archive`/);
  assert.ok(treatmentRoute);
  assert.equal(treatmentProgressApiGrants.length, 1);
  assert.equal(treatmentProgressApiGrants[0].method, 'GET');
  assert.equal(treatmentProgressApiGrants[0].path, '/v1/treatment-progress');
  assert.match(treatmentProgressAppSource, /read<\{ patients: unknown \}>\("\/v1\/treatment-progress"/);
});

test('keeps the Finance host grants aligned with the pinned backend contract', () => {
  const contract = financeSourceImport.sdkContract;
  const sourceRoutes = [contract.route];
  for (const value of Object.values(contract)) {
    if (value && typeof value === 'object' && Array.isArray(value.routes)) {
      sourceRoutes.push(...value.routes.map(({ method, path }) => `${method} ${path}`));
    }
  }
  const normalize = (route) => route
    .replace(/:\w+/g, '{uuid}')
    .replace(/\?.*$/, '');
  const sourceGrantKeys = [...new Set(sourceRoutes.map(normalize))].sort();
  const browserGrantKeys = financeApiGrants.map(({ method, path }) => `${method} ${path}`).sort();
  assert.deepEqual(browserGrantKeys, sourceGrantKeys);
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

test('registers the Finance host handshake before React mounts and keeps credentials outside the app', () => {
  const listenerRegistration = financeAppSource.indexOf('const browserRuntime = connectBrowserRuntime(APP_ID);');
  const reactMount = financeAppSource.indexOf('createRoot(document.getElementById');
  assert.ok(listenerRegistration >= 0 && reactMount > listenerRegistration);
  assert.match(financeRuntimeSource, /value\.appId !== expectedAppId/);
  assert.match(financeRuntimeSource, /supportedCapabilities\.has\(capability\)/);
  assert.match(hostScript, /capabilities: app\.sessionCapabilities\.filter\(\(capability\) => clinicSession\?\.clinicUser\?\.capabilities\?\.includes\(capability\)\)/);
  assert.doesNotMatch(financeRuntimeSource, /\bfetch\s*\(|authorization|Bearer|idToken|accessToken|window\.desktop|dentalApp/);
  assert.doesNotMatch(financeAppSource, /window\.dentalApp|electron\/|authorization|idToken|accessToken/);
});

test('registers Calendar and Treatment Progress host handshakes before React mounts', () => {
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
  assert.match(hostScript, /app\.id === 'calendar' \? \{ clinicTimeZone: trustedCalendarTimeZone\(\) \}/);
  assert.match(hostScript, /clinicSession\?\.clinic\?\.timezone/);
  assert.match(hostScript, /return 'Asia\/Kathmandu'/);
});

test('pins the exact app entry and JavaScript bytes in the trusted manifest and SRI attribute', () => {
  const entryBytes = readFileSync(new URL('../apps/runtime.v1.html', import.meta.url));
  const scriptBytes = readFileSync(new URL('../apps/runtime.v1.js', import.meta.url));
  const bundle = firstPartyApps[0].bundle;
  assert.equal(bundle.entrySha256, sha256(entryBytes));
  assert.equal(bundle.scriptSha256, sha256(scriptBytes));
  const integrity = createHash('sha256').update(scriptBytes).digest('base64');
  assert.ok(runtimeHtml.includes(`integrity="sha256-${integrity}"`));
  assert.ok(firstPartyApps.filter((app) => !['protocols', 'finance', 'calendar', 'treatment'].includes(app.id))
    .every((app) => app.bundle.entry === bundle.entry && app.bundle.scriptSha256 === bundle.scriptSha256));
  const protocolBundle = firstPartyApps.find((app) => app.id === 'protocols').bundle;
  const protocolEntry = readFileSync(new URL('../apps/treatment-protocols.v1.html', import.meta.url), 'utf8');
  const protocolScript = readFileSync(new URL('../apps/treatment-protocols.v1.js', import.meta.url));
  const protocolStyle = readFileSync(new URL('../apps/treatment-protocols.v1.css', import.meta.url));
  assert.notEqual(protocolBundle.entry, bundle.entry);
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
  const financeBundle = firstPartyApps.find((app) => app.id === 'finance').bundle;
  const financeEntry = readFileSync(new URL('../apps/finance.v1.html', import.meta.url), 'utf8');
  const financeScript = readFileSync(new URL('../apps/finance.v1.js', import.meta.url));
  const financeStyle = readFileSync(new URL('../apps/finance.v1.css', import.meta.url));
  assert.equal(financeBundle.entrySha256, sha256(Buffer.from(financeEntry)));
  assert.equal(financeBundle.scriptSha256, sha256(financeScript));
  assert.equal(financeBundle.styleSha256, sha256(financeStyle));
  const financeScriptIntegrity = createHash('sha256').update(financeScript).digest('base64');
  const financeStyleIntegrity = createHash('sha256').update(financeStyle).digest('base64');
  assert.ok(financeEntry.includes(`script-src 'sha256-${financeScriptIntegrity}'`));
  assert.ok(financeEntry.includes(`style-src 'sha256-${financeStyleIntegrity}'`));
  assert.ok(financeEntry.includes(`integrity="sha256-${financeScriptIntegrity}"`));

  for (const [appId, bundleName] of [
    ['calendar', 'calendar.v1'],
    ['treatment', 'treatment-progress.v1'],
  ]) {
    const appBundle = firstPartyApps.find((app) => app.id === appId).bundle;
    const appEntry = readFileSync(new URL(`../apps/${bundleName}.html`, import.meta.url), 'utf8');
    const appScript = readFileSync(new URL(`../apps/${bundleName}.js`, import.meta.url));
    const appStyle = readFileSync(new URL(`../apps/${bundleName}.css`, import.meta.url));
    const appScriptIntegrity = createHash('sha256').update(appScript).digest('base64');
    const appStyleIntegrity = createHash('sha256').update(appStyle).digest('base64');
    assert.equal(appBundle.entry, `/apps/${bundleName}.html`);
    assert.equal(appBundle.script, `/apps/${bundleName}.js`);
    assert.equal(appBundle.style, `/apps/${bundleName}.css`);
    assert.equal(appBundle.entrySha256, sha256(Buffer.from(appEntry)));
    assert.equal(appBundle.scriptSha256, sha256(appScript));
    assert.equal(appBundle.styleSha256, sha256(appStyle));
    assert.ok(appEntry.includes(`script-src 'sha256-${appScriptIntegrity}'`));
    assert.ok(appEntry.includes(`style-src 'sha256-${appStyleIntegrity}'`));
    assert.ok(appEntry.includes(`integrity="sha256-${appScriptIntegrity}"`));
    assert.doesNotMatch(appScript.toString('utf8'), /process\.env\.NODE_ENV/);
  }
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
  assert.match(hostScript, /findAppApiGrant\(app, request\.method, request\.path\)/);
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
  assert.match(serverScript, /\['\/apps\/finance\/asset-manifest\.js', 'apps\/finance\/asset-manifest\.js'\]/);
  assert.match(serverScript, /\['\/apps\/finance\.v1\.js', 'apps\/finance\.v1\.js'\]/);
  assert.match(serverScript, /'\/apps\/finance\.v1\.js', '\/apps\/finance\.v1\.css'/);
  for (const [bundleName, appName] of [['calendar.v1', 'calendar'], ['treatment-progress.v1', 'treatment-progress']]) {
    assert.match(serverScript, new RegExp(`\\['/apps/${appName}/asset-manifest\\.js', 'apps/${appName}/asset-manifest\\.js'\\]`));
    assert.match(serverScript, new RegExp(`\\['/apps/${bundleName}\\.html', 'apps/${bundleName}\\.html'\\]`));
    assert.match(serverScript, new RegExp(`\\['/apps/${bundleName}\\.js', 'apps/${bundleName}\\.js'\\]`));
    assert.match(serverScript, new RegExp(`'/apps/${bundleName}\\.js', '/apps/${bundleName}\\.css'`));
  }
});
