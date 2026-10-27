import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { webcrypto } from 'node:crypto';
import { browserModules, canReadAppPath } from '../apps/browser/catalog.js';
import { validateFrameRead } from '../apps/browser/host.js';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');
const APP_ID = 'company.dental.followups.m17';

test('real source retains original M17 React workflow and disables edits during read acceptance', () => {
  const entry = read('../apps/dental-apps/company.dental.followups.m17/src/main.tsx');
  const view = read('../apps/dental-apps/company.dental.followups.m17/src/features/follow-ups/components/FollowUpsView.tsx');
  const sdk = read('../packages/app-sdk/src/clinicClient.ts');
  assert.match(entry, /from 'react-dom\/client'/);
  assert.match(entry, /<FollowUpsView readOnly/);
  assert.match(entry, /followUpsApi\.listFollowUps|followUpsApi\.createFollowUp|followUpsApi\.toggleFollowUp|followUpsApi\.rescheduleFollowUp/);
  assert.match(view, /disabled=\{readOnly\}/);
  assert.match(view, /onReschedule/);
  assert.match(view, /CreateFollowUpModal/);
  assert.doesNotMatch(sdk, /electron\/sdk\/contracts/);
  assert.match(sdk, /browser-sdk\/src\/contracts/);
  assert.equal(browserModules.followups.source, APP_ID);
});

test('Follow-ups GET route and clinic role are least privilege', () => {
  const roles = ['followups.access'];
  const base = { type: 'read', id: 1, viewId: 'worklist', path: '/v1/follow-ups' };
  assert.equal(validateFrameRead('followups', base, roles), true);
  assert.equal(canReadAppPath('followups', '/v1/clinic/staff-references'), true);
  assert.equal(canReadAppPath('followups', '/v1/patients?q=Sam&limit=8'), true);
  for (const path of ['/v1/clinic/staff', '/v1/follow-ups/123/toggle', '/v1/patients/1/profile',
    'https://other.example/v1/follow-ups', '/v1/follow-ups#fragment']) {
    assert.equal(canReadAppPath('followups', path), false, path);
  }
  assert.equal(validateFrameRead('followups', { ...base, type: 'command' }, roles), false);
});

function makeBridge() {
  const posted = [];
  const session = { clinic: { tenantId: 'synthetic-only', displayName: 'Synthetic clinic' },
    clinicUser: { clinicUserId: 'test-user', displayName: 'Testing', role: 'doctor', capabilities: ['followups.access'] },
    branches: [] };
  const framePort = {
    listener: undefined, start() {},
    addEventListener(_type, listener) { this.listener = listener; },
    removeEventListener() {},
    postMessage(message) {
      posted.push(message);
      queueMicrotask(() => this.listener?.({ data: {
        type: 'response', id: message.id, ok: true, data: { followUps: [] },
      } }));
    },
  };
  const window = { addEventListener() {} };
  runInNewContext(read('../apps/browser/bridge.js'), { window, crypto: webcrypto, setTimeout, clearTimeout });
  const bridge = window.createBrowserAppBridge({
    port: framePort, appId: 'followups', source: APP_ID, title: 'Follow-ups', icon: '/assets/dock/followups.webp',
    views: [{ id: 'worklist', route: '/v1/follow-ups', title: 'Follow-up worklist' },
      { id: 'doctors', route: '/v1/clinic/staff-references', title: 'Doctors' }],
    session,
  });
  return { bridge, posted, session };
}
test('token-free M17 facade initializes an app without Electron and returns the Worker session', async () => {
  const { bridge, posted, session } = makeBridge();
  const connection = await bridge.connect({ major: 1, minor: 7 });
  assert.equal(connection.ok, true);
  assert.equal(connection.value.appId, APP_ID);
  assert.ok(connection.value.capabilities.includes('clinic.api.request'));
  const result = await bridge.request({
    version: 1, connection: connection.value.connection, generation: 1, requestId: 'synthetic',
    operation: 'session.context', input: {},
  });
  assert.equal(result.ok, true);
  assert.equal(result.value.clinicSession, session);
  assert.equal(posted.length, 0);
  assert.ok(!JSON.stringify(connection).includes('Bearer'));
});
test('M17 facade allows clinic GET and fails closed for all unverified mutations', async () => {
  const { bridge, posted } = makeBridge();
  const conn = (await bridge.connect({ major: 1 })).value;
  const readRequest = { version: 1, connection: conn.connection, generation: 1,
    requestId: 'synthetic-read', operation: 'clinic.api.request',
    input: { method: 'GET', path: '/v1/follow-ups', body: null, idempotencyKey: null } };
  const result = await bridge.request(readRequest);
  assert.equal(result.ok, true);
  assert.deepEqual(result.value.body.followUps, []);
  assert.equal(posted.length, 1);
  assert.equal(posted[0].viewId, 'worklist');
  for (const method of ['POST', 'PATCH', 'PUT']) {
    const blocked = await bridge.request({ ...readRequest, input: { ...readRequest.input,
      method, body: '{}', idempotencyKey: 'synthetic-key' } });
    assert.equal(blocked.ok, false);
    assert.equal(blocked.error.code, 'FORBIDDEN');
  }
  assert.equal(posted.length, 1);
  bridge.close();
});
