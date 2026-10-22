import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { ApiBroker, type Identity } from '../electron/sdk/broker';
import { SDK, parseRequest, type Operation } from '../electron/sdk/contracts';
import { readClinicMedia, MEDIA_LIMITS, type MediaKind } from '../electron/sdk/mediaRead';
import { staging } from '../electron/sdk/environment';

const recordId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222';
const bytes = new Uint8Array([1, 2, 3]);
const checksum = (data: Uint8Array) => createHash('sha256').update(data).digest('hex');
function fixture(kind: MediaKind = 'patient_media') {
  const asset: Record<string, unknown> = { [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'active', byteSize: 3, checksum: checksum(bytes), mimeType: kind === 'patient_media' ? 'image/png' : 'application/pdf' };
  let body = bytes, requests = 0, granted = true, signed = true, active = true, credentials = 0, responseStatus = 200, redirected = false;
  let stalled = false;
  let afterMetadata: (() => void) | undefined;
  const urls: string[] = [], sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://media/index.html' };
  const appId = kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff';
  const family: Operation = kind === 'patient_media' ? 'clinic.app.patient-record' : 'clinic.app.staff';
  const identity: Identity = { snapshot: () => ({ generation: 1, active, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true,
    allowedMediaRead: (_, requested) => granted && requested === kind, credential: async () => { credentials++; return 'synthetic-only'; } };
  const transport = async (url: string, init: RequestInit) => {
    requests++; urls.push(url); expect(new URL(url).origin).toBe(staging.apiBase); expect(init.redirect).toBe('manual'); expect(init.credentials).toBe('omit');
    if (stalled) return new Promise<Response>((_resolve, reject) => init.signal?.addEventListener('abort', () => reject(new Error('Aborted')), { once: true }));
    if (requests % 2 === 1) { const response = Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [asset] }); afterMetadata?.(); return response; }
    return new Response(body, { status: redirected ? 302 : responseStatus, headers: { 'content-type': asset.mimeType as string } });
  };
  const broker = new ApiBroker(staging, identity, transport);
  broker.register({ sender, frame, origin: caller.url, appId, appVersion: '1.0.0', capabilities: [family, 'clinic.media.read'], authorizeApiOperation: () => signed, preferences: undefined, report() {} } as any);
  const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect');
  const input = { version: 1, connection: connected.value.connection, generation: 1, requestId: 'media-read-0001', operation: 'clinic.media.read', input: { kind, recordId, assetId } };
  return { broker, caller, input, asset, urls, request: () => broker.request(caller, input), requests: () => requests, credentials: () => credentials,
    setBody: (value: Uint8Array) => { body = new Uint8Array(value); }, deny: () => { granted = false; }, unsigned: () => { signed = false; }, logout: () => { active = false; },
    afterMetadata: (fn: () => void) => { afterMetadata = fn; }, redirect: () => { redirected = true; }, status: (value: number) => { responseStatus = value; }, stall: () => { stalled = true; } };
}
for (const kind of ['patient_media', 'staff_document'] as const) describe(kind + ' host read', () => {
  it('returns only verified bytes, MIME and status from host-derived paths', async () => {
    const f = fixture(kind); const result = await f.request(); expect(result).toEqual({ ok: true, value: { status: 200, contentType: f.asset.mimeType, body: bytes } });
    expect(f.requests()).toBe(2); expect(JSON.stringify(result)).not.toContain('synthetic-only'); expect(f.urls[1]).toContain(kind === 'patient_media' ? `/v1/patient-media/${assetId}/view` : `/v1/clinic/staff/${recordId}/documents/${assetId}/download`); f.broker.dispose();
  });
  for (const alteration of [{ checksum: 'a'.repeat(64) }, { status: 'withdrawn' }, { byteSize: 0 }, { byteSize: MEDIA_LIMITS[kind] + 1 }, { mimeType: 'text/html' }]) it('fails closed for invalid metadata ' + JSON.stringify(alteration), async () => {
    const f = fixture(kind); Object.assign(f.asset, alteration); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'INVALID_RESPONSE' } }); f.broker.dispose();
  });
  it('rejects wrong parent identity before requesting bytes', async () => {
    const f = fixture(kind); f.asset[kind === 'patient_media' ? 'patientId' : 'staffId'] = assetId; expect(await f.request()).toMatchObject({ ok: false, error: { code: 'INVALID_RESPONSE' } }); expect(f.requests()).toBe(1); f.broker.dispose();
  });
  it('rejects truncated, oversized and same-length corrupted content', async () => {
    for (const body of [new Uint8Array([1]), new Uint8Array([1, 2, 3, 4]), new Uint8Array([3, 2, 1])]) { const f = fixture(kind); f.setBody(body); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'INVALID_RESPONSE' } }); f.broker.dispose(); }
  });
  it('denies missing signed grant or session permission before credentials', async () => {
    for (const mode of ['unsigned', 'denied']) { const f = fixture(kind); mode === 'unsigned' ? f.unsigned() : f.deny(); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } }); expect(f.credentials()).toBe(0); expect(f.requests()).toBe(0); f.broker.dispose(); }
  });
  it('rechecks authorization after metadata retrieval', async () => { const f = fixture(kind); f.afterMetadata(f.deny); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } }); expect(f.requests()).toBe(1); f.broker.dispose(); });
  it('fences logout and discards stale results', async () => { const f = fixture(kind); f.afterMetadata(f.logout); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'STALE_SESSION' } }); expect(f.requests()).toBe(1); f.broker.dispose(); });
  it('refuses redirects and worker denial', async () => {
    const f = fixture(kind); f.redirect(); expect(await f.request()).toMatchObject({ ok: false, error: { code: 'REDIRECT_DENIED' } }); f.broker.dispose();
    const g = fixture(kind); g.status(403); expect(await g.request()).toMatchObject({ ok: false, error: { code: 'ACCESS_DENIED' } }); g.broker.dispose();
  });
});
describe('media envelope and declared transfer bounds', () => {
  it('rejects paths, headers, caller checksums and malformed identifiers', () => {
    const f = fixture();
    for (const input of [{ ...f.input.input, path: '/v1/secret' }, { ...f.input.input, checksum: 'a'.repeat(64) }, { ...f.input.input, assetId: '../secret' }, { ...f.input.input, kind: 'arbitrary' }]) expect(parseRequest({ ...f.input, input })).toBeUndefined();
    f.broker.dispose();
  });
  it.each(['patient_media', 'staff_document'] as const)('verifies the exact %s maximum with streamed data', async kind => {
    const size = MEDIA_LIMITS[kind], body = new Uint8Array(size); body[0] = 42; body[size - 1] = 11;
    const asset = { [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'active', byteSize: size, mimeType: 'image/png', checksum: checksum(body) }; let calls = 0;
    const value = await readClinicMedia({ kind, recordId, assetId }, { apiBase: staging.apiBase, token: 'synthetic-only', signal: new AbortController().signal, requestId: 'media-test-0001', assertCurrent() {}, rejected() {}, transport: async () => ++calls === 1 ? Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [asset] }) : new Response(body, { headers: { 'content-type': 'image/png' } }) });
    expect(value.body.length).toBe(size); expect(checksum(value.body)).toBe(asset.checksum);
  });
});

describe('media lifecycle and capacity fencing', () => {
  it('allows one read per registration and cancellation releases its slot', async () => {
    const f = fixture(); f.stall();
    const pending = f.request();
    for (let i = 0; i < 20 && !f.requests(); i++) await Promise.resolve();
    expect(f.requests()).toBe(1);
    expect(await f.broker.request(f.caller, { ...f.input, requestId: 'media-read-0002' })).toMatchObject({ ok: false, error: { code: 'BUSY' } });
    expect(f.broker.cancel(f.caller, { version: 1, connection: f.input.connection, generation: 1, requestId: f.input.requestId })).toMatchObject({ ok: true });
    expect(await pending).toMatchObject({ ok: false, error: { code: 'CANCELLED' } });
    f.broker.dispose();
  });
  it('refuses a third read across separate registrations', async () => {
    const f = fixture(); f.stall();
    const clients = [f.caller]; const inputs = [f.input];
    for (let index = 0; index < 2; index++) {
      const caller = { sender: {}, frame: {}, url: 'dental-fixture://media-extra/index.html' };
      f.broker.register({ sender: caller.sender, frame: caller.frame, origin: caller.url, appId: 'company.dental.patient-record', appVersion: '1.0.0', capabilities: ['clinic.app.patient-record', 'clinic.media.read'], authorizeApiOperation: () => true, report() {} });
      const connected = f.broker.connect(caller, SDK); if (!connected.ok) throw Error('connect');
      clients.push(caller); inputs.push({ ...f.input, connection: connected.value.connection, requestId: 'media-extra-000' + index });
    }
    const first = f.broker.request(clients[0], inputs[0]), second = f.broker.request(clients[1], inputs[1]);
    for (let i = 0; i < 20 && f.requests() < 2; i++) await Promise.resolve();
    expect(f.requests()).toBe(2);
    expect(await f.broker.request(clients[2], inputs[2])).toMatchObject({ ok: false, error: { code: 'BUSY' } });
    f.broker.dispose(); expect((await first).ok).toBe(false); expect((await second).ok).toBe(false);
  });
});
