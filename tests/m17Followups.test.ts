import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppSdk, Request, Result } from '../electron/sdk/contracts';
import { ClinicClient, ClinicError } from '../packages/app-sdk/src/clinicClient';
import { followUpsApi } from '../apps/dental-apps/company.dental.followups/src/features/follow-ups/api';

function fixture() {
  let generation = 1, unknown = false, malformed = false, malformedList = false, denied = false;
  const calls: Request[] = [];
  const lost = vi.fn();
  const bridge: AppSdk = {
    connect: vi.fn<AppSdk['connect']>(async () => ({ ok: true as const, value: { connection: '00000000-0000-4000-8000-000000000001', generation, appId: 'company.dental.followups', appVersion: '1.1.0', sdk: { major: 1, minor: 6 }, capabilities: ['clinic.api.request', 'session.context', 'clinic.app.followups'] } })),
    request: vi.fn<AppSdk['request']>(async request => {
      calls.push(structuredClone(request));
      if (request.generation !== generation) return { ok: false, error: { code: 'STALE_SESSION', message: 'Session changed', outcome: 'not_sent' } };
      if (request.operation === 'session.context') return { ok: true, value: { clinicSession: { clinicUser: { clinicUserId: 'synthetic', capabilities: ['followups.access'] }, clinic: { tenantId: 'synthetic' }, branches: [] } } };
      if (request.input.method !== 'GET') {
        if (unknown) { unknown = false; return { ok: false, error: { code: 'UNKNOWN_OUTCOME', message: 'Check the original save', outcome: 'unknown', operationId: request.input.idempotencyKey as string } }; }
        if (denied) return { ok: false, error: { code: 'CONFLICT', message: 'Record changed', outcome: 'rejected' } };
        const input = JSON.parse(request.input.body as string);
        const path = request.input.path as string;
        let followUp: Record<string, unknown>;
        if (path.endsWith('/toggle')) followUp = { followUpId: '33333333-3333-4333-8333-333333333333', field: input.field, checked: input.checked, status: 'pending', rowVersion: 2 };
        else if (path.endsWith('/schedule')) followUp = { followUpId: '33333333-3333-4333-8333-333333333333', dueOn: input.dueOn, dueTime: input.dueTime, reason: input.reason, rowVersion: 2 };
        else followUp = { followUpId: '33333333-3333-4333-8333-333333333333', patientId: '11111111-1111-4111-8111-111111111111', chiefComplaintId: null, dueOn: input.dueOn ?? '2026-10-23', dueTime: input.dueTime ?? null, reason: input.reason ?? 'Synthetic', status: 'pending' };
        return { ok: true, value: { status: 200, body: malformed ? {} : { followUp } } };
      }
      const path = request.input.path as string;
      if (path === '/v1/clinic/staff-references') return { ok: true, value: { status: 200, body: { staff: [
        { staffId: '22222222-2222-4222-8222-222222222222', fullName: 'Synthetic Active Doctor', staffType: 'doctor', jobTitle: null, status: 'active' },
        { staffId: '44444444-4444-4444-8444-444444444444', fullName: 'Synthetic Inactive Doctor', staffType: 'doctor', jobTitle: null, status: 'inactive' },
        { staffId: '55555555-5555-4555-8555-555555555555', fullName: 'Synthetic Active Helper', staffType: 'helper', jobTitle: null, status: 'active' },
      ] } } };
      return { ok: true, value: { status: 200, body: { patients: [], followUps: malformedList ? [{ patientName: 'Malformed synthetic row' }] : [] } } };
    }),
    cancel: vi.fn<AppSdk['cancel']>(async () => ({ ok: true, value: { cancelledLocally: true } })),
    getAppInfo: vi.fn<AppSdk['getAppInfo']>(async () => ({ ok: true, value: { appId: 'company.dental.followups', title: 'Follow-ups', description: '', iconDataUrl: '', modules: [] } })),
    openAppExplorer: vi.fn<AppSdk['openAppExplorer']>(async () => ({ ok: true, value: {} })), onModuleSelected: () => () => {},
    navigation: { report: vi.fn(), onRequest: () => () => {} }, report: vi.fn(),
  };
  const client = new ClinicClient(bridge, lost);
  return { bridge, calls, client, lost, unknown: () => { unknown = true; }, malformed: (value: boolean) => { malformed = value; }, malformedList: (value: boolean) => { malformedList = value; }, denied: (value: boolean) => { denied = value; }, switchSession: () => { generation++; } };
}
afterEach(() => followUpsApi.clear());

describe('M17 Follow-ups SDK and safe write integration', () => {
  it('keeps the original operation ID and frozen payload after an unknown outcome', async () => {
    const f = fixture(), input = { reason: 'Synthetic original intent' };
    const command = f.client.command('POST', '/v1/follow-ups', input);
    input.reason = 'Edited after submission';
    f.unknown();
    await expect(command.execute()).rejects.toMatchObject({ outcome: 'unknown', operationId: command.operationId });
    await command.execute();
    expect(f.calls).toHaveLength(2);
    expect(f.calls[0].input).toEqual(f.calls[1].input);
    expect(f.calls[1].input.body).toContain('Synthetic original intent');
    expect(f.calls[0].requestId).not.toBe(f.calls[1].requestId);
    await command.execute();
    expect(f.calls).toHaveLength(2); // A completed command does not duplicate the write.
  });
  it('blocks another write until an uncertain original write is reconciled', async () => {
    const f = fixture(), states: string[] = [];
    followUpsApi.configure(f.client, value => states.push(value));
    f.unknown();
    await expect(followUpsApi.toggleFollowUp('synthetic', { field: 'called', checked: true, expectedRowVersion: 1 })).rejects.toBeInstanceOf(ClinicError);
    await expect(followUpsApi.toggleFollowUp('other', { field: 'caught', checked: true, expectedRowVersion: 1 })).rejects.toMatchObject({ code: 'UNKNOWN_OUTCOME' });
    expect(f.calls).toHaveLength(1);
    await followUpsApi.reconcile();
    expect(f.calls[1].input).toEqual(f.calls[0].input);
    expect(states).toEqual(['none', 'saving', 'unknown', 'saving', 'none']);
  });
  it('retains original identity when a successful HTTP response has a malformed receipt', async () => {
    const f = fixture(); followUpsApi.configure(f.client, () => {});
    f.malformed(true);
    await expect(followUpsApi.rescheduleFollowUp('synthetic', { dueOn: '2026-10-23', dueTime: null, reason: 'Synthetic', expectedRowVersion: 1 })).rejects.toMatchObject({ code: 'INVALID_RESPONSE', outcome: 'unknown' });
    f.malformed(false); await followUpsApi.reconcile();
    expect(f.calls[0].input).toEqual(f.calls[1].input);
  });
  it('allows a fresh decision after a definite row-version conflict', async () => {
    const f = fixture(); followUpsApi.configure(f.client, () => {}); f.denied(true);
    await expect(followUpsApi.toggleFollowUp('synthetic', { field: 'called', checked: true, expectedRowVersion: 1 })).rejects.toMatchObject({ code: 'CONFLICT', outcome: 'rejected' });
    f.denied(false); await followUpsApi.toggleFollowUp('synthetic', { field: 'called', checked: true, expectedRowVersion: 2 });
    expect(f.calls[0].input.idempotencyKey).not.toBe(f.calls[1].input.idempotencyKey);
  });
  it('pins the original session and refuses reconnection into a changed clinic', async () => {
    const f = fixture(); await f.client.initialize('company.dental.followups'); f.switchSession();
    await expect(f.client.read('/v1/follow-ups')).rejects.toMatchObject({ code: 'STALE_SESSION' });
    const count = f.calls.length;
    await expect(f.client.read('/v1/follow-ups')).rejects.toMatchObject({ code: 'STALE_SESSION' });
    expect(f.calls).toHaveLength(count); expect(f.lost).toHaveBeenCalledTimes(1); expect(f.bridge.connect).toHaveBeenCalledTimes(1);
  });
  it('retries only an initial frame-registration handshake without dispatching a business call', async () => {
    const f = fixture(), connect = f.bridge.connect;
    f.bridge.connect = vi.fn().mockResolvedValueOnce({ ok: false, error: { code: 'UNKNOWN_CALLER', message: 'Not registered', outcome: 'not_sent' } }).mockImplementation(connect);
    await f.client.initialize('company.dental.followups');
    expect(f.bridge.connect).toHaveBeenCalledTimes(2); expect(f.calls.map(value => value.operation)).toEqual(['session.context']);
  });
  it('sends patient lookup only through the SDK with the exact bounded query', async () => {
    const f = fixture(); followUpsApi.configure(f.client, () => {});
    expect(await followUpsApi.searchPatients('   ')).toEqual([]); expect(f.calls).toHaveLength(0);
    await followUpsApi.searchPatients(' Synthetic & Patient ');
    expect(f.calls[0].input).toEqual({ path: '/v1/patients?q=Synthetic+%26+Patient&limit=8', method: 'GET', body: null, idempotencyKey: null });
  });
  it('uses only active doctor staff references and rejects malformed worklist rows', async () => {
    const f = fixture(); followUpsApi.configure(f.client, () => {});
    expect(await followUpsApi.staffReferences()).toEqual([{ staffId: '22222222-2222-4222-8222-222222222222', fullName: 'Synthetic Active Doctor' }]);
    f.malformedList(true);
    await expect(followUpsApi.listFollowUps()).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
  it('cancels a pending read through the same connection and request identity', async () => {
    const f = fixture(), controller = new AbortController(); let release!: (value: Result) => void;
    f.bridge.request = vi.fn<AppSdk['request']>(() => new Promise<Result>(resolve => { release = resolve; }));
    const reading = f.client.read('/v1/follow-ups', controller.signal);
    await vi.waitFor(() => expect(f.bridge.request).toHaveBeenCalled()); controller.abort();
    const request = vi.mocked(f.bridge.request).mock.calls[0][0];
    expect(f.bridge.cancel).toHaveBeenCalledWith({ version: 1, connection: request.connection, generation: request.generation, requestId: request.requestId });
    release({ ok: false, error: { code: 'CANCELLED', message: 'Stopped', outcome: 'not_sent' } });
    await expect(reading).rejects.toMatchObject({ code: 'CANCELLED' });
  });
});
