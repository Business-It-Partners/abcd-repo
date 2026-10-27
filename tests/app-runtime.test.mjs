import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { firstPartyApps } from '../apps/manifest.js';
import { findAppApiGrant, isValidAppCatalog } from '../apps/catalog.js';

const baseOrigin = 'https://browser.example.test';
const runtimeHtml = readFileSync(new URL('../apps/runtime.v1.html', import.meta.url), 'utf8');
const runtimeScript = readFileSync(new URL('../apps/runtime.v1.js', import.meta.url), 'utf8');
const hostScript = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const protocolAppSource = readFileSync(new URL('../apps/treatment-protocols/src/main.tsx', import.meta.url), 'utf8');
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
  assert.ok(firstPartyApps.filter((app) => app.id !== 'protocols').every((app) => app.apiGrants.length === 0));
  const protocols = firstPartyApps.find((app) => app.id === 'protocols');
  assert.deepEqual(protocols.apiGrants, [
    { method: 'GET', path: '/v1/treatment-protocols' },
    { method: 'POST', path: '/v1/treatment-protocols' },
    { method: 'PUT', path: '/v1/treatment-protocols/{uuid}' },
  ]);
  assert.deepEqual(protocols.capabilities, ['treatment_protocols.manage']);
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

test('pins the exact app entry and JavaScript bytes in the trusted manifest and SRI attribute', () => {
  const entryBytes = readFileSync(new URL('../apps/runtime.v1.html', import.meta.url));
  const scriptBytes = readFileSync(new URL('../apps/runtime.v1.js', import.meta.url));
  const bundle = firstPartyApps[0].bundle;
  assert.equal(bundle.entrySha256, sha256(entryBytes));
  assert.equal(bundle.scriptSha256, sha256(scriptBytes));
  const integrity = createHash('sha256').update(scriptBytes).digest('base64');
  assert.ok(runtimeHtml.includes(`integrity="sha256-${integrity}"`));
  assert.ok(firstPartyApps.filter((app) => app.id !== 'protocols')
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
});
