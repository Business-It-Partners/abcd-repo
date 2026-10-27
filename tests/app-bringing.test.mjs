import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserModules, canReadAppPath, permittedView } from '../apps/browser/catalog.js';
import { validateFrameRead } from '../apps/browser/host.js';

const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const IDS = [
  'appointments', 'patients', 'calendar', 'finance', 'followups',
  'staff', 'lab', 'treatment', 'protocols', 'workentry',
];

test('all ten current M17 first-party packages have browser modules and retained icon identities', () => {
  assert.deepEqual(Object.keys(browserModules), IDS);
  for (const [id, app] of Object.entries(browserModules)) {
    assert.match(app.source, /^company\.dental\./);
    assert.equal(app.icon, '/assets/dock/' + id + '.webp');
    assert.ok(app.views.length > 0);
    assert.ok(app.views.every(view => view.route.startsWith('/v1/')));
  }
});

test('read grants deny external URLs, traversal, encoded slashes, unknown apps and out-of-scope routes', () => {
  const illegal = [
    'https://example.com/v1/patients',
    '//example.com/v1/patients',
    '/v1/patients/../me',
    '/v1/patients%2F../me',
    '/v1/patients%5Cother',
    '/v1/clinic/staff',
    '/v1/patients#fragment',
    '/v1/patients?q=' + 'a'.repeat(600),
  ];
  for (const path of illegal) assert.equal(canReadAppPath('patients', path), false, path);
  assert.equal(canReadAppPath('unknown', '/v1/patients'), false);
  assert.equal(canReadAppPath('patients', '/v1/patients?limit=30'), true);
  assert.equal(canReadAppPath('workentry', '/v1/work-entry/cases'), true);
});

test('frame protocol accepts only known read requests with a valid view', () => {
  const allowed = { type: 'read', id: 1, viewId: 'worklist', path: '/v1/follow-ups' };
  assert.equal(validateFrameRead('followups', allowed, ['followups.access']), true);
  for (const input of [
    { ...allowed, type: 'command' },
    { ...allowed, id: 0 },
    { ...allowed, id: '1' },
    { ...allowed, viewId: 'unknown' },
    { ...allowed, path: '/v1/clinic/staff' },
  ]) assert.equal(validateFrameRead('followups', input, ['followups.access']), false);
});

test('Finance payments-only account cannot access privileged finance routes', () => {
  const paymentCapabilities = ['patient_payments.outstanding.read'];
  assert.equal(!!permittedView('finance', 'payments', paymentCapabilities), true);
  assert.equal(permittedView('finance', 'expenses', paymentCapabilities), null);
  assert.equal(validateFrameRead('finance', {
    type: 'read', id: 1, viewId: 'payments', path: '/v1/patient-payments',
  }, paymentCapabilities), true);
  assert.equal(validateFrameRead('finance', {
    type: 'read', id: 2, viewId: 'payments', path: '/v1/clinic/operating-expenses',
  }, paymentCapabilities), false);
  assert.equal(validateFrameRead('finance', {
    type: 'read', id: 3, viewId: 'expenses', path: '/v1/clinic/operating-expenses',
  }, paymentCapabilities), false);
});

test('Staff references and sensitive management data use distinct grants', () => {
  assert.equal(validateFrameRead('staff', {
    type: 'read', id: 1, viewId: 'references', path: '/v1/clinic/staff-references',
  }, ['staff.reference.read']), true);
  assert.equal(validateFrameRead('staff', {
    type: 'read', id: 2, viewId: 'references', path: '/v1/clinic/staff',
  }, ['staff.reference.read']), false);
  assert.equal(validateFrameRead('staff', {
    type: 'read', id: 3, viewId: 'directory', path: '/v1/clinic/staff',
  }, ['staff.manage']), true);
});

test('frame is sandboxed without same-origin, direct Worker access or Electron globals', () => {
  const host = source('../apps/browser/host.js');
  const frame = source('../apps/browser/frame.js');
  const server = source('../tools/dev-server.mjs');
  const shell = source('../main.js');
  assert.match(host, /setAttribute\('sandbox', 'allow-scripts'\)/);
  assert.match(host, /launchNonce/);
  assert.match(host, /new MessageChannel\(\)/);
  assert.match(host, /getIdToken\(\)/);
  assert.match(server, /connect-src 'none'/);
  assert.match(server, /sandbox allow-scripts/);
  assert.match(shell, /mountBrowserApp\(/);
  assert.match(shell, /entry\.dispose\?\.\(\)/);
  assert.match(frame, /createBrowserAppBridge/);
  assert.match(frame, /init\.source === originalSources\[app\.appId\]/);
  assert.doesNotMatch(frame, /window\.electron|ipcRenderer|firebaseAuth|apiBaseUrl|\.fetch\(/);
  assert.match(source('../apps/browser/bridge.js'), /Clinical writes are disabled/);
  assert.doesNotMatch(host, /ipcRenderer|window\.dentalApp|preload/);
});

test('browser route paths exist and retain no Electron installer or Store support', () => {
  const server = source('../tools/dev-server.mjs');
  for (const path of ['host.js', 'catalog.js', 'frame.html', 'frame.js', 'bridge.js', 'frame.css']) {
    assert.ok(server.includes("'/apps/browser/" + path + "'"), path);
  }
  assert.doesNotMatch(source('../apps/browser/frame.js'), /packageRegistry|installApp\(|updateApp\(/);
});
