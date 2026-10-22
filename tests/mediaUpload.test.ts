import { describe, expect, it, vi } from 'vitest';
import { MediaUploads } from '../electron/sdk/mediaUpload';
import { validMediaUpload } from '../electron/sdk/mediaUploadContract';
import { ApiBroker, type Identity } from '../electron/sdk/broker';
import { SDK, MAX_REQUEST_BYTES, bounded } from '../electron/sdk/contracts';
import { staging } from '../electron/sdk/environment';
import { MEDIA_LIMITS, MEDIA_UPLOAD_LIMITS } from '../electron/sdk/mediaLimits';
import type { MediaKind } from '../electron/sdk/mediaRead';

const recordId = '11111111-1111-4111-8111-111111111111', assetId = '22222222-2222-4222-8222-222222222222', key = 'original-upload-key';
function metadata(kind: MediaKind, size = 3) { return { displayFilename: 'synthetic.png', mimeType: 'image/png', byteSize: size, ...(kind === 'patient_media' ? { chiefComplaintId: null, xrayType: 'IOPA', toothCode: null, clinicalNote: null, capturedOn: '2026-10-22' } : { documentType: 'other', expiresOn: null }) }; }
function fakeBackend(kind: MediaKind) {
  return { status: 'pending', failStage: '', failOnce: true, badHandle: false, contentUploaded: false, intentFingerprint: undefined as string | undefined, item: undefined as Record<string, unknown> | undefined,
    calls: [] as Array<{ path: string; method: string; key: string | null }>, contentAttempts: 0, finaliseAttempts: 0 };
}
function fixture(kind: MediaKind = 'patient_media', backend = fakeBackend(kind)) {
  const manager = new MediaUploads(), owner = {}, input = { action: 'begin', kind, recordId, metadata: metadata(kind), idempotencyKey: key };
  const transfer = manager.begin(owner, input); let grant = true;
  const chunk = (data = new Uint8Array([1, 2, 3]), offset = 0) => manager.chunk(owner, { action: 'chunk', transferId: transfer.transferId, offset, data: Buffer.from(data).toString('base64') });
  const context = { apiBase: staging.apiBase, token: 'host-only-synthetic', signal: new AbortController().signal, requestId: 'upload-request-0001',
    assertCurrent: () => { if (!grant) throw Error('Revoked'); }, dispatched() {}, rejected() {},
    transport: async (url: string, init: RequestInit) => {
      const path = new URL(url).pathname; expect(new URL(url).origin).toBe(staging.apiBase); const headers = new Headers(init.headers); expect(headers.get('authorization')).toBe('Bearer host-only-synthetic');
      backend.calls.push({ path, method: init.method!, key: headers.get('idempotency-key') });
      if (init.method === 'GET') return Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [{ ...backend.item, status: backend.status }] });
      if (path.endsWith('upload-intents') || path.endsWith('/documents')) {
        const payload = JSON.parse(init.body as string), fingerprint = JSON.stringify(payload);
        if (backend.intentFingerprint && backend.intentFingerprint !== fingerprint) return new Response(null, { status: 409 });
        backend.intentFingerprint ??= fingerprint;
        backend.item ??= { ...payload, [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'pending' };
        if (backend.failStage === 'intent' && backend.failOnce) { backend.failOnce = false; throw Error('Dropped intent response'); }
        const content = kind === 'patient_media' ? `/v1/patient-media/${assetId}/content` : `/v1/clinic/staff/${recordId}/documents/${assetId}/content`;
        return Response.json({ uploadIntent: { [kind === 'patient_media' ? 'media' : 'document']: { ...backend.item, status: backend.status }, uploadUrl: (backend.badHandle ? 'https://outside.invalid' : staging.apiBase) + content, uploadHeaders: { 'content-type': 'image/png' } } }, { status: 201 });
      }
      if (path.endsWith('/content')) {
        backend.contentAttempts++;
        if (backend.status === 'active' || backend.contentUploaded) return new Response(null, { status: 409 });
        expect(new Uint8Array(init.body as Uint8Array)).toEqual(new Uint8Array([1, 2, 3]));
        backend.contentUploaded = true;
        if (backend.failStage === 'content' && backend.failOnce) { backend.failOnce = false; throw Error('Dropped content response'); }
        return new Response(null, { status: 204 });
      }
      if (path.endsWith('/finalise')) {
        backend.finaliseAttempts++;
        if (!backend.contentUploaded) return new Response(null, { status: 409 });
        backend.status = 'active';
        if (backend.failStage === 'finalise' && backend.failOnce) { backend.failOnce = false; throw Error('Dropped finalise response'); }
        return Response.json({ [kind === 'patient_media' ? 'media' : 'document']: { ...backend.item, status: backend.status } });
      }
      if (path.endsWith('/abort')) { if (backend.status === 'active') return new Response(null, { status: 409 }); backend.status = 'rejected'; return new Response(null, { status: 204 }); }
      throw Error('Unexpected path');
    } };
  const finish = (action = 'commit', operationKey = key) => manager.finish(owner, { action, transferId: transfer.transferId, idempotencyKey: operationKey }, context);
  return { manager, owner, input, transfer, calls: backend.calls, backend, chunk, finish, context, fail: (stage: string) => { backend.failStage = stage; backend.failOnce = true; }, poison: () => { backend.badHandle = true; }, revoke: () => { grant = false; } };
}
for (const kind of ['patient_media', 'staff_document'] as const) describe(kind + ' mediated upload', () => {
  it('hashes host bytes, uses distinct stable step keys and returns no handles', async () => {
    const f = fixture(kind); try { f.chunk(); expect(await f.finish()).toEqual({ committed: true, assetId }); expect(f.manager.has(f.owner)).toBe(false); expect(f.calls.map(row => row.method)).toEqual(['POST', 'PUT', 'POST']); expect(f.calls[0].key).toMatch(/^[a-f0-9]{64}$/); expect(f.calls[0].key).not.toBe(f.calls[2].key); } finally { f.manager.dispose(); }
  });
  for (const stage of ['intent', 'content', 'finalise']) it('retries explicit original-key commit after dropped ' + stage + ' response', async () => {
    const f = fixture(kind); try { f.chunk(); f.fail(stage); await expect(f.finish()).rejects.toThrow('Dropped'); expect(f.manager.has(f.owner)).toBe(true); expect(await f.finish()).toEqual({ committed: true, assetId }); const intentKeys = f.calls.filter(row => row.method === 'POST' && (row.path.endsWith('/documents') || row.path.endsWith('/upload-intents'))).map(row => row.key); expect(new Set(intentKeys).size).toBe(1); } finally { f.manager.dispose(); }
  });
  it('reconciles a repeated completed key without retransmitting bytes', async () => {
    const f = fixture(kind); try { f.chunk(); await f.finish(); const before = f.calls.length; expect(await f.finish()).toEqual({ committed: true, assetId }); expect(f.manager.begin(f.owner, f.input)).toMatchObject({ committed: true, assetId, transferId: f.transfer.transferId }); expect(f.calls).toHaveLength(before); } finally { f.manager.dispose(); }
  });
  it('cancels unsent bytes without any service request', async () => { const f = fixture(kind); try { expect(await f.finish('cancel')).toEqual({ cancelled: true, committed: false }); expect(f.calls).toEqual([]); } finally { f.manager.dispose(); } });
  it('resolves unknown intent then aborts its pending object explicitly', async () => {
    const f = fixture(kind); try { f.chunk(); f.fail('intent'); await expect(f.finish()).rejects.toThrow(); expect(await f.finish('cancel')).toEqual({ cancelled: true, committed: false }); expect(f.calls.at(-1)?.path).toContain('/abort'); } finally { f.manager.dispose(); }
  });
  it('does not claim to undo a finalise that already committed', async () => {
    const f = fixture(kind); try { f.chunk(); f.fail('finalise'); await expect(f.finish()).rejects.toThrow(); expect(await f.finish('cancel')).toEqual({ cancelled: false, committed: true, assetId }); } finally { f.manager.dispose(); }
  });
  it('refuses poisoned upload destinations before PUT', async () => { const f = fixture(kind); try { f.chunk(); f.poison(); await expect(f.finish()).rejects.toMatchObject({ code: 'UNKNOWN_OUTCOME', outcome: 'unknown' }); expect(f.calls).toHaveLength(1); } finally { f.manager.dispose(); } });
  it('refuses incomplete data and wrong operation key before transport', async () => { const f = fixture(kind); try { await expect(f.finish()).rejects.toMatchObject({ code: 'VALIDATION' }); f.chunk(); await expect(f.finish('commit', 'different-upload-key')).rejects.toMatchObject({ code: 'CONFLICT' }); expect(f.calls).toHaveLength(0); } finally { f.manager.dispose(); } });
  it('accepts identical chunk replay and denies changed/overlapping bytes', () => { const f = fixture(kind); try { f.chunk(); expect(f.chunk()).toMatchObject({ received: 3 }); expect(() => f.chunk(new Uint8Array([2, 3, 1]))).toThrow(); expect(() => f.chunk(new Uint8Array([4]), 3)).toThrow(); } finally { f.manager.dispose(); } });
});
describe('upload bounds and owner lifetime', () => {
  it('uses the Dental SaaS size contract for both upload and read paths', () => {
    expect(MEDIA_UPLOAD_LIMITS).toEqual(MEDIA_LIMITS);
    expect(MEDIA_UPLOAD_LIMITS).toEqual({ patient_media: 10 * 1024 * 1024, staff_document: 25 * 1024 * 1024 });
  });
  it('bounds chunks to the unchanged 16 KiB request envelope', () => {
    const manager = new MediaUploads(), owner = {};
    try { const begin = manager.begin(owner, { action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media', 8192), idempotencyKey: key }); const input = { action: 'chunk', transferId: begin.transferId, offset: 0, data: Buffer.alloc(8192, 1).toString('base64') }; expect(bounded({ version: 1, connection: begin.transferId, generation: 1, requestId: 'chunk-0000001', operation: 'clinic.media.upload', input }, MAX_REQUEST_BYTES)).toBe(true); expect(manager.chunk(owner, input)).toMatchObject({ received: 8192 }); expect(() => manager.chunk(owner, { ...input, data: Buffer.alloc(8193).toString('base64') })).toThrow(); } finally { manager.dispose(); }
  });
  it('bounds owners, prevents transfer theft and expires memory without network work', () => {
    vi.useFakeTimers(); const manager = new MediaUploads(), first = {}, second = {}, third = {};
    try { const input = { action: 'begin', kind: 'staff_document', recordId, metadata: metadata('staff_document'), idempotencyKey: key }; const transfer = manager.begin(first, input); manager.begin(second, input); expect(() => manager.begin(third, input)).toThrow(); expect(() => manager.chunk(second, { action: 'chunk', transferId: transfer.transferId, offset: 0, data: 'AQID' })).toThrow(); vi.advanceTimersByTime(300_001); expect(manager.has(first)).toBe(false); expect(manager.has(second)).toBe(false); } finally { manager.dispose(); vi.useRealTimers(); }
  });
  it('rejects caller checksum, unsafe MIME, extra route/credentials and over-limit declarations', () => {
    const input = { action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: key };
    expect(validMediaUpload(input)).toBe(true);
    for (const patch of [{ capturedOn: null }, { capturedOn: '2026-02-30' }, { checksum: 'a'.repeat(64) }, { mimeType: 'text/html' }, { uploadUrl: staging.apiBase }, { byteSize: MEDIA_UPLOAD_LIMITS.patient_media + 1 }]) expect(validMediaUpload({ ...input, metadata: { ...input.metadata, ...patch } })).toBe(false);
    expect(validMediaUpload({ ...input, authorization: 'untrusted' })).toBe(false);
  });
  it.each(['patient_media', 'staff_document'] as const)('accepts exactly the current %s cap and rejects the next byte', kind => {
    const limit = MEDIA_UPLOAD_LIMITS[kind], input = { action: 'begin', kind, recordId, metadata: metadata(kind, limit), idempotencyKey: key };
    expect(validMediaUpload(input)).toBe(true);
    expect(validMediaUpload({ ...input, metadata: { ...input.metadata, byteSize: limit + 1 } })).toBe(false);
  });
});
describe('broker upload lifecycle integration', () => {
  it('holds close/update safety for buffered work, cancels explicitly and fences logout', async () => {
    const sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://upload/index.html' }; let generation = 1, credentials = 0;
    const identity: Identity = { snapshot: () => ({ generation, active: true, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true, allowedMediaUpload: () => true, credential: async () => { credentials++; return 'synthetic'; } };
    const broker = new ApiBroker(staging, identity, async () => { throw Error('No network expected'); });
    try {
      broker.register({ sender, frame, origin: caller.url, appId: 'company.dental.patient-record', appVersion: '1.0.0', capabilities: ['clinic.app.patient-record', 'clinic.media.upload'], authorizeApiOperation: () => true, report() {} });
      const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect');
      let counter = 0; const request = (input: Record<string, unknown>) => broker.request(caller, { version: 1, connection: connected.value.connection, generation, requestId: 'upload-native-' + (++counter), operation: 'clinic.media.upload', input });
      expect(await request({ action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media', MEDIA_UPLOAD_LIMITS.patient_media + 1), idempotencyKey: 'oversize-image-key' })).toMatchObject({ ok: false, error: { code: 'INVALID_REQUEST' } });
      expect(credentials).toBe(0); expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(false);
      const begun = await request({ action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: key }); expect(begun.ok).toBe(true); if (!begun.ok) return;
      expect(credentials).toBe(0); expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(true);
      expect(await request({ action: 'cancel', transferId: (begun.value as any).transferId, idempotencyKey: key })).toMatchObject({ ok: true, value: { cancelled: true } });
      expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(false); expect(credentials).toBe(0);
      await request({ action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: 'another-upload-key' });
      generation++; broker.invalidateSession(); expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(false);
    } finally { broker.dispose(); }
  });
});

describe('broker unknown outcome and exact upload authority', () => {
  for (const kind of ['patient_media', 'staff_document'] as const) it('restarts an upload after fresh sign-in using the original file and operation key', async () => {
    const server = fakeBackend(kind), state = { generation: 1, active: true }, identity: Identity = { snapshot: () => ({ generation: state.generation, active: state.active, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true, allowedMediaUpload: () => true, credential: async () => 'host-only-synthetic' };
    const broker = new ApiBroker(staging, identity, async (url, init) => serverTransport(url, init));
    let requestNumber = 0;
    const makeRegistration = (suffix: string) => {
      const sender = {}, frame = {}, caller = { sender, frame, url: `dental-fixture://fresh-${suffix}/index.html` }, appId = kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff', family = kind === 'patient_media' ? 'clinic.app.patient-record' : 'clinic.app.staff';
      broker.register({ sender, frame, origin: caller.url, appId, appVersion: '1.0.0', capabilities: [family, 'clinic.media.upload'], authorizeApiOperation: () => true, report() {} });
      const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect');
      const request = (input: Record<string, unknown>) => broker.request(caller, { version: 1, connection: connected.value.connection, generation: state.generation, requestId: `fresh-request-${++requestNumber}`, operation: 'clinic.media.upload', input });
      return { caller, sender, request };
    };
    const first = makeRegistration('before-sign-out');
    try {
      const begin = await first.request({ action: 'begin', kind, recordId, metadata: metadata(kind), idempotencyKey: key }); if (!begin.ok) throw Error('begin before sign-out');
      const transferId = (begin.value as any).transferId;
      expect(await first.request({ action: 'chunk', transferId, offset: 0, data: 'AQID' })).toMatchObject({ ok: true });
      server.failStage = 'content'; server.failOnce = true;
      expect(await first.request({ action: 'commit', transferId, idempotencyKey: key })).toMatchObject({ ok: false, error: { code: 'UNKNOWN_OUTCOME', outcome: 'unknown' } });
      expect(broker.hasUnsafeWrites(kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff')).toBe(true);

      state.active = false; state.generation++; broker.invalidateSession();
      expect(broker.hasUnsafeWrites(kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff')).toBe(false);
      state.active = true; state.generation++; broker.invalidateSession();
      const second = makeRegistration('after-sign-in');
      const restarted = await second.request({ action: 'begin', kind, recordId, metadata: metadata(kind), idempotencyKey: key }); if (!restarted.ok) throw Error('begin after sign-in');
      const newTransferId = (restarted.value as any).transferId; expect(newTransferId).not.toBe(transferId);
      expect(await second.request({ action: 'chunk', transferId: newTransferId, offset: 0, data: 'AQID' })).toMatchObject({ ok: true });
      const recovered = await second.request({ action: 'commit', transferId: newTransferId, idempotencyKey: key });
      if (!recovered.ok) throw Error(`Fresh-session reconciliation failed: ${recovered.error.code}/${recovered.error.outcome}; calls=${JSON.stringify(server.calls.map(({ path, method }) => [method, path]))}; status=${server.status}; uploaded=${server.contentUploaded}; finalises=${server.finaliseAttempts}`);
      expect(recovered).toMatchObject({ ok: true, value: { committed: true, assetId } });
      expect(server.item?.[kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']).toBe(assetId);
      expect(server.contentAttempts).toBe(2); expect(server.finaliseAttempts).toBe(1);
      const mismatch = makeRegistration('changed-file');
      const changed = await mismatch.request({ action: 'begin', kind, recordId, metadata: metadata(kind), idempotencyKey: key }); if (!changed.ok) throw Error('begin changed-file check');
      const changedId = (changed.value as any).transferId;
      expect(await mismatch.request({ action: 'chunk', transferId: changedId, offset: 0, data: 'CQkJ' })).toMatchObject({ ok: true });
      expect(await mismatch.request({ action: 'commit', transferId: changedId, idempotencyKey: key })).toMatchObject({ ok: false, error: { code: 'CONFLICT' } });
      expect(server.contentAttempts).toBe(2);
    } finally { broker.dispose(); }

    async function serverTransport(url: string, init: RequestInit) {
      const path = new URL(url).pathname, headers = new Headers(init.headers);
      server.calls.push({ path, method: init.method!, key: headers.get('idempotency-key') });
      if (init.method === 'GET') return Response.json({ [kind === 'patient_media' ? 'media' : 'documents']: [{ ...server.item, status: server.status }] });
      if (path.endsWith('upload-intents') || path.endsWith('/documents')) {
        const payload = JSON.parse(init.body as string), fingerprint = JSON.stringify(payload);
        if (server.intentFingerprint && server.intentFingerprint !== fingerprint) return new Response(null, { status: 409 });
        server.intentFingerprint ??= fingerprint;
        server.item ??= { ...payload, [kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId']: assetId, [kind === 'patient_media' ? 'patientId' : 'staffId']: recordId, status: 'pending' };
        return Response.json({ uploadIntent: { [kind === 'patient_media' ? 'media' : 'document']: { ...server.item, status: server.status }, uploadUrl: staging.apiBase + (kind === 'patient_media' ? `/v1/patient-media/${assetId}/content` : `/v1/clinic/staff/${recordId}/documents/${assetId}/content`), uploadHeaders: { 'content-type': 'image/png' } } }, { status: 201 });
      }
      if (path.endsWith('/content')) {
        server.contentAttempts++;
        if (server.status === 'active' || server.contentUploaded) return new Response(null, { status: 409 });
        server.contentUploaded = true;
        if (server.failStage === 'content' && server.failOnce) { server.failOnce = false; throw Error('Dropped content response'); }
        return new Response(null, { status: 204 });
      }
      if (path.endsWith('/finalise')) {
        server.finaliseAttempts++;
        if (!server.contentUploaded) return new Response(null, { status: 409 });
        server.status = 'active';
        return Response.json({ [kind === 'patient_media' ? 'media' : 'document']: { ...server.item, status: server.status } });
      }
      throw Error('Unexpected fresh-session route');
    }
  });
  for (const action of ['commit', 'cancel']) it('preserves unknown finalise and reconciles with explicit ' + action, async () => {
    const f = fixture(), sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://upload-proof/index.html' };
    const identity: Identity = { snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }), allowed: () => true, allowedMediaUpload: () => true, credential: async () => 'host-only-synthetic' };
    const broker = new ApiBroker(staging, identity, f.context.transport);
    try {
      broker.register({ sender, frame, origin: caller.url, appId: 'company.dental.patient-record', appVersion: '1.0.0', capabilities: ['clinic.app.patient-record', 'clinic.media.upload'], authorizeApiOperation: () => true, report() {} });
      const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect'); let count = 0;
      const request = (input: Record<string, unknown>) => broker.request(caller, { version: 1, connection: connected.value.connection, generation: 1, requestId: 'outcome-proof-' + (++count), operation: 'clinic.media.upload', input });
      const begin = await request(f.input); if (!begin.ok) throw Error('begin'); const transferId = (begin.value as any).transferId;
      await request({ action: 'chunk', transferId, offset: 0, data: 'AQID' }); f.fail('finalise');
      expect(await request({ action: 'commit', transferId, idempotencyKey: key })).toMatchObject({ ok: false, error: { code: 'UNKNOWN_OUTCOME', outcome: 'unknown', operationId: key } });
      expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(true);
      expect(await request({ action, transferId, idempotencyKey: key })).toMatchObject({ ok: true, value: { committed: true, assetId } });
      expect(broker.hasUnsafeWrites('company.dental.patient-record')).toBe(false);
      expect(await request({ action: 'commit', transferId, idempotencyKey: key })).toMatchObject({ ok: true, value: { committed: true, assetId } });
    } finally { broker.dispose(); f.manager.dispose(); }
  });
  it('allows a new company ID through its signed media family contract', async () => {
    const appId = 'company.dental.m17-patient-record', sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://new-patient-record/index.html' };
    let credentials = 0;
    const broker = new ApiBroker(staging, { snapshot: () => ({ generation: 1, active: true, userLabel: '', clinicLabel: '' }), allowed: () => true,
      allowedMediaUpload: (family, kind) => family === 'clinic.app.patient-record' && kind === 'patient_media', credential: async () => { credentials++; return 'never'; } });
    try {
      broker.register({ sender, frame, origin: caller.url, appId, appVersion: '1.0.0', capabilities: ['clinic.app.patient-record', 'clinic.media.upload'], authorizeApiOperation: () => true, report() {} });
      const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect');
      expect(connected.value.capabilities).toContain('clinic.media.upload');
      const result = await broker.request(caller, { version: 1, connection: connected.value.connection, generation: 1, requestId: 'new-upload-0001', operation: 'clinic.media.upload', input: { action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: key } });
      expect(result).toMatchObject({ ok: true, value: { received: 0 } });
      expect(credentials).toBe(0);
      expect(broker.hasUnsafeWrites(appId)).toBe(true);
    } finally { broker.dispose(); }
  });
  it('denies unsupported families and unsigned transfers before allocation or credentials', async () => {
    const cases = [
      { appId: 'company.dental.patient-record', family: 'clinic.app.patient-record', granted: false },
      { appId: 'company.dental.work-entry', family: 'clinic.app.work-entry', granted: true },
      { appId: 'company.dental.followups', family: 'clinic.app.followups', granted: true },
      { appId: 'company.sample.future', family: 'clinic.app.patient-record', granted: false },
    ] as const;
    for (const { appId, family, granted } of cases) {
      let credentials = 0; const sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://denied/index.html' };
      const broker = new ApiBroker(staging, { snapshot: () => ({ generation: 1, active: true, userLabel: '', clinicLabel: '' }), allowed: () => true, allowedMediaUpload: () => true, credential: async () => { credentials++; return 'never'; } });
      try { broker.register({ sender, frame, origin: caller.url, appId, appVersion: '1.0.0', capabilities: [family, 'clinic.media.upload'], authorizeApiOperation: () => granted, report() {} }); const connected = broker.connect(caller, SDK); if (!connected.ok) throw Error('connect'); const result = await broker.request(caller, { version: 1, connection: connected.value.connection, generation: 1, requestId: 'denied-upload-0001', operation: 'clinic.media.upload', input: { action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: key } }); expect(result).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } }); expect(credentials).toBe(0); expect(broker.hasUnsafeWrites(appId)).toBe(false); } finally { broker.dispose(); }
    }
  });
});

describe('patient replacement boundary', () => {
  it('uses only the explicit fixed replacement route and includes the clinical reason', async () => {
    const manager = new MediaUploads(), owner = {}, priorId = '33333333-3333-4333-8333-333333333333';
    const input = { action: 'begin', kind: 'patient_media', recordId, metadata: metadata('patient_media'), idempotencyKey: key, replacement: { assetId: priorId, reason: 'Synthetic replacement proof' } };
    expect(validMediaUpload(input)).toBe(true); const transfer = manager.begin(owner, input);
    manager.chunk(owner, { action: 'chunk', transferId: transfer.transferId, offset: 0, data: 'AQID' });
    const f = fixture(); let observed = false;
    try {
      await manager.finish(owner, { action: 'commit', transferId: transfer.transferId, idempotencyKey: key }, { ...f.context, transport: async (url, init) => {
        if (!observed) { expect(new URL(url).pathname).toBe(`/v1/patient-media/${priorId}/replace`); expect(JSON.parse(init.body as string).reason).toBe('Synthetic replacement proof'); observed = true; return f.context.transport(staging.apiBase + '/v1/patient-media/upload-intents', init); }
        return f.context.transport(url, init);
      } }); expect(observed).toBe(true);
    } finally { manager.dispose(); f.manager.dispose(); }
    expect(validMediaUpload({ ...input, kind: 'staff_document', metadata: metadata('staff_document') })).toBe(false);
  });
});
