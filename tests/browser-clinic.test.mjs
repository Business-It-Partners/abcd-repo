import test from 'node:test';
import assert from 'node:assert/strict';
import { BrowserClinicMediaHost } from '../apps/clinic-app-runtime/mediaHost.js';

const patientId = 'f12b56d1-2633-4a79-8fd8-2a4a0d39515c';
const mediaAssetId = '9c2b775a-c98c-4a36-bec8-112a16b92d23';
const apiBaseUrl = 'https://clinic-api.example.test/';

test('Patient Record media upload stays host-mediated and returns only a verified receipt', async () => {
  const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/lAAAAABJRU5ErkJggg==', 'base64');
  const checksum = Buffer.from(await crypto.subtle.digest('SHA-256', bytes)).toString('hex');
  const calls = [];
  const context = {
    connected: true,
    apiBaseUrl,
    user: { getIdToken: async () => 'synthetic-private-token' },
    session: { clinicUser: { capabilities: ['patient_record.access'] } },
  };
  const host = new BrowserClinicMediaHost({ getContext: () => context, isCurrent: () => true, onPendingChange() {} });
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    calls.push({ path: parsed.pathname, method: init.method, authorization: init.headers.authorization,
      credentials: init.credentials, redirect: init.redirect, body: init.body });
    if (parsed.pathname === '/v1/patient-media/upload-intents' && init.method === 'POST') {
      const intent = JSON.parse(init.body);
      return Response.json({ uploadIntent: {
        uploadUrl: new URL(`/v1/patient-media/${mediaAssetId}/content`, apiBaseUrl).href,
        uploadHeaders: { 'content-type': 'image/png' },
        media: { mediaAssetId, patientId: intent.patientId, checksum: intent.checksum, byteSize: bytes.length, mimeType: 'image/png' },
      } }, { status: 201 });
    }
    if (parsed.pathname === `/v1/patient-media/${mediaAssetId}/content` && init.method === 'PUT') {
      assert.deepEqual(Buffer.from(init.body), bytes);
      return new Response(null, { status: 204 });
    }
    if (parsed.pathname === `/v1/patient-media/${mediaAssetId}/finalise` && init.method === 'POST') {
      return Response.json({ media: { mediaAssetId, patientId, status: 'active', checksum, byteSize: bytes.length, mimeType: 'image/png' } }, { status: 200 });
    }
    throw new Error(`Unexpected private media route ${init.method} ${parsed.pathname}`);
  };
  const owner = { app: { id: 'patients', mediaGrants: ['clinic.media.read', 'clinic.media.upload'] } };
  const attempt = 1;
  const send = (requestId, input) => host.handle(owner.app, owner, attempt, {
    operation: 'clinic.media.upload', requestId, input,
  });
  try {
    const metadata = {
      displayFilename: 'synthetic.png', mimeType: 'image/png', byteSize: bytes.length,
      chiefComplaintId: null, xrayType: 'IOPA', toothCode: null, clinicalNote: null, capturedOn: '2026-10-27',
    };
    const began = await send('begin-request', { action: 'begin', kind: 'patient_media', recordId: patientId, metadata, idempotencyKey: 'synthetic-key-0001' });
    assert.deepEqual(Object.keys(began).sort(), ['received', 'total', 'transferId']);
    const chunk = await send('chunk-request', { action: 'chunk', transferId: began.transferId, offset: 0, data: bytes.toString('base64') });
    assert.equal(chunk.received, bytes.length);
    const receipt = await send('commit-request', { action: 'commit', transferId: began.transferId, idempotencyKey: 'synthetic-key-0001' });
    assert.deepEqual(receipt, { committed: true, assetId: mediaAssetId });
    assert.deepEqual(calls.map(call => [call.method, call.path]), [
      ['POST', '/v1/patient-media/upload-intents'],
      ['PUT', `/v1/patient-media/${mediaAssetId}/content`],
      ['POST', `/v1/patient-media/${mediaAssetId}/finalise`],
    ]);
    assert.ok(calls.every(call => call.authorization === 'Bearer synthetic-private-token'
      && call.credentials === 'omit' && call.redirect === 'manual'));
    assert.doesNotMatch(JSON.stringify([began, chunk, receipt]), /synthetic-private-token|https?:/);
  } finally {
    globalThis.fetch = originalFetch;
    host.dispose(owner);
  }
});

test('Work Entry and unauthorized Patient Record roles cannot start media requests', async () => {
  let fetches = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => { fetches += 1; throw new Error('network should not be reached'); };
  const context = {
    connected: true,
    apiBaseUrl,
    user: { getIdToken: async () => 'synthetic-private-token' },
    session: { clinicUser: { capabilities: ['patient_record.access'] } },
  };
  const host = new BrowserClinicMediaHost({ getContext: () => context, isCurrent: () => true, onPendingChange() {} });
  try {
    const workEntry = { id: 'workentry', mediaGrants: ['clinic.media.read'] };
    await assert.rejects(host.handle(workEntry, { app: workEntry }, 1, {
      operation: 'clinic.media.upload', requestId: 'denied-workentry', input: {},
    }), error => error.code === 'FORBIDDEN');
    context.session.clinicUser.capabilities = [];
    const patients = { id: 'patients', mediaGrants: ['clinic.media.read', 'clinic.media.upload'] };
    await assert.rejects(host.handle(patients, { app: patients }, 1, {
      operation: 'clinic.media.upload', requestId: 'denied-role', input: {},
    }), error => error.code === 'FORBIDDEN');
    assert.equal(fetches, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
