import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { buildPackage, canonical, sha256, verifyPackage, type TrustPolicy } from '../electron/packages/format';
import { apiOperationsForPackage, verifyUpdatePolicy } from '../electron/distribution/updatePolicy';
import { noWatermark } from '../electron/distribution/catalogue';
import { resolveClinicJsonRoute } from '../electron/sdk/clinicRoutes';
import { clinicRequestAllowed } from '../electron/sdk/appPolicy';
import { ApiBroker, type Identity, type Transport } from '../electron/sdk/broker';
import { staging } from '../electron/sdk/environment';
import type { ApiOperationId, Operation } from '../electron/sdk/contracts';
import type { ClinicAppFamily } from '../electron/sdk/appPolicy';

const id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const app = (name: string) => `clinic.app.${name}` as ClinicAppFamily;
const dynamicAppId = 'company.dental.m17-finance-suite';
describe('closed clinic JSON route contract', () => {
  it.each([
    ['followups', 'GET', '/v1/follow-ups?date=2026-10-22'],
    ['followups', 'PATCH', `/v1/follow-ups/${id}/toggle`],
    ['appointments', 'GET', '/v1/appointments?bucket=week&today=2026-10-22'],
    ['appointments', 'PATCH', `/v1/appointments/${id}`],
    ['patient-record', 'PUT', `/v1/patients/${id}/profile`],
    ['work-entry', 'POST', '/v1/work-entry/commit'],
    ['work-entry', 'GET', `/v1/patients/${id}/ledger`],
    ['work-entry', 'GET', '/v1/follow-ups'],
    ['work-entry', 'GET', '/v1/clinic/suppliers?scope=lab'],
    ['treatment-progress', 'GET', '/v1/treatment-progress'],
    ['lab-tracker', 'GET', `/v1/clinic/suppliers/${id}/statement?scope=lab`],
    ['finance', 'GET', '/v1/clinic/staff'],
    ['patient-payments', 'GET', '/v1/patient-payments?from=2026-10-01&to=2026-10-22'],
    ['staff', 'GET', '/v1/clinic/salary-payouts'],
    ['treatment-protocols', 'PUT', `/v1/treatment-protocols/${id}`],
    ['calendar', 'GET', '/v1/calendar-tasks?from=2026-10-01&to=2026-10-31'],
    ['calendar', 'POST', '/v1/calendar-tasks'],
    ['calendar', 'PATCH', `/v1/calendar-tasks/${id}`],
    ['calendar', 'POST', `/v1/calendar-tasks/${id}/archive`],
  ])('resolves %s %s %s within its declared app contract', (name, method, path) => {
    expect(resolveClinicJsonRoute(app(name), path, method)).toBeTruthy();
  });

  it.each([
    ['followups', 'GET', '/v1/patients'],
    ['followups', 'GET', '/v1/patients?q=test&limit=100'],
    ['followups', 'GET', '/v1/follow-ups?tenantId=another'],
    ['appointments', 'GET', '/v1/appointments?date=2026-10-22&date=2026-10-23'],
    ['appointments', 'GET', '/v1/appointments?date=2026-02-31'],
    ['appointments', 'GET', '/v1/appointments?bucket=all&today=2026-10-22'],
    ['appointments', 'DELETE', `/v1/appointments/${id}`],
    ['finance', 'POST', '/v1/clinic/staff'],
    ['lab-tracker', 'GET', `/v1/clinic/suppliers/${id}/statement`],
    ['work-entry', 'GET', '/v1/clinic/suppliers'],
    ['staff', 'POST', '/v1/clinic/salary-payouts'],
    ['patient-record', 'POST', '/v1/patient-media/upload-intents'],
    ['patient-record', 'GET', '/v1/patient-unknown'],
    ['patient-record', 'GET', '/v1/patients/../clinic/staff'],
    ['patient-record', 'GET', '/v1/patients/%2e%2e/clinic/staff'],
    ['patient-record', 'GET', '/v1/patients?q=%0asecret'],
    ['patient-record', 'GET', '/v1/patients?role=admin'],
    ['staff', 'GET', '/v1/dental-os/catalogue'],
    ['staff', 'GET', '/v1/clinic/staff?clinicId=another'],
    ['calendar', 'GET', '/v1/calendar-tasks?from=2026-10-22&to=2026-10-01'],
    ['calendar', 'GET', '/v1/calendar-tasks?from=2026-10-01&to=2026-11-16'],
    ['finance', 'GET', '/v1/clinic/transaction-record?month=2026-10'],
    ['unknown', 'GET', '/v1/follow-ups'],
  ])('denies %s %s %s', (name, method, path) => {
    expect(resolveClinicJsonRoute(name === 'unknown' ? undefined : app(name), path, method)).toBeUndefined();
  });

  it('requires the Worker capability for sensitive reference reads in addition to app access', () => {
    expect(clinicRequestAllowed(app('finance'), 'admin', ['finance.manage'], '/v1/clinic/staff', 'GET')).toBe(false);
    expect(clinicRequestAllowed(app('finance'), 'admin', ['finance.manage', 'staff.manage'], '/v1/clinic/staff', 'GET')).toBe(true);
    expect(clinicRequestAllowed(app('staff'), 'admin', ['staff.manage'], '/v1/clinic/salary-payouts', 'GET')).toBe(false);
    expect(clinicRequestAllowed(app('staff'), 'admin', ['staff.manage', 'finance.manage'], '/v1/clinic/salary-payouts', 'GET')).toBe(true);
    expect(clinicRequestAllowed(app('work-entry'), 'doctor', ['work_entry.access'], `/v1/patients/${id}/ledger`, 'GET')).toBe(false);
    expect(clinicRequestAllowed(app('work-entry'), 'doctor', ['work_entry.access', 'patient_billing_ledger.read'], `/v1/patients/${id}/ledger`, 'GET')).toBe(true);
    expect(clinicRequestAllowed(app('work-entry'), 'doctor', ['work_entry.access'], '/v1/follow-ups', 'GET')).toBe(false);
    expect(clinicRequestAllowed(app('work-entry'), 'doctor', ['work_entry.access', 'followups.access'], '/v1/follow-ups', 'GET')).toBe(true);
    expect(clinicRequestAllowed(app('finance'), 'reception', ['finance.manage', 'staff.manage'], '/v1/clinic/staff', 'GET')).toBe(false);
    expect(clinicRequestAllowed(app('patient-payments'), 'doctor', ['patient_payments.outstanding.read'], '/v1/patient-payments', 'GET')).toBe(false);
  });
});

function client(granted = true, authorize?: (operation: ApiOperationId) => boolean, transport?: Transport) {
  let credentials = 0, transports = 0, active = true;
  let capabilities = ['finance.manage', 'staff.manage'];
  const sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://finance/index.html' };
  const identity: Identity = {
    snapshot: () => ({ generation: 1, active, userLabel: 'Synthetic', clinicLabel: 'Synthetic' }),
    allowed: () => true,
    allowedClinicRequest: (family, path, method) => clinicRequestAllowed(family, 'admin', capabilities, path, method),
    credential: async () => { credentials++; return 'synthetic-secret'; },
  };
  const sent: RequestInit[] = [];
  const broker = new ApiBroker(staging, identity, async (url, init) => {
    transports++; sent.push(init); expect(new URL(url).origin).toBe(staging.apiBase);
    return transport ? transport(url, init) : Response.json({ staff: [] });
  });
  const packageCapabilities: Operation[] = ['clinic.api.request', 'clinic.app.finance'];
  broker.register({ sender, frame, origin: caller.url, appId: dynamicAppId, appVersion: '1.0.0', capabilities: packageCapabilities,
    authorizeApiOperation: operation => granted && operation === 'clinic.api.request' && (authorize?.(operation) ?? true), report: () => {} });
  const connected = broker.connect(caller, { major: 1, minor: 2 }); if (!connected.ok) throw Error('Fixture handshake');
  let requestId = 0;
  return { broker, caller, identity, connection: connected.value, sent,
    counts: () => ({ credentials, transports }), revokeStaff: () => { capabilities = ['finance.manage']; },
    request: (path = '/v1/clinic/staff', method = 'GET', body: string | null = null) => broker.request(caller, { version: 1, connection: connected.value.connection,
      generation: 1, requestId: `clinic_request_${++requestId}`, operation: 'clinic.api.request',
      input: { path, method, body, idempotencyKey: method === 'GET' ? null : 'stable_write_key_01' } }),
  };
}
describe('signed clinic JSON entry point dispatch', () => {
  it('uses the exact signed policy identity and denies another validly signed package digest', async () => {
    const pair = generateKeyPairSync('ed25519'), keyId = 'company', now = Date.now();
    const caps: Operation[] = ['clinic.api.request', 'clinic.app.finance'];
    const trust: TrustPolicy = { keys: { [keyId]: { publisher: 'company', publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } },
      apps: {}, companyApps: { publisher: 'company', capabilities: caps } };
    const bytes = (body: string) => buildPackage({ appId: dynamicAppId, publisher: 'company', version: '1.0.0', entry: 'index.html',
      sdkMajor: 1, apiMajor: 1, capabilities: caps }, new Map([['index.html', Buffer.from(body)]]), keyId, pair.privateKey);
    const original = bytes('<h1>Synthetic finance</h1>'), verified = verifyPackage(original, trust);
    const policy = { format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 60_000,
      revokedKeys: [], apps: [{ id: dynamicAppId, capabilities: caps, minimumVersion: '1.0.0', revokedDigests: [], rollback: null,
        releases: [{ version: '1.0.0', packageSha256: sha256(original), payloadDigest: verified.release.digest, apiOperations: ['clinic.api.request'] }] }] };
    const signed = Buffer.from(canonical({ policy, keyId, signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy })), pair.privateKey).toString('base64') }));
    const approved = verifyUpdatePolicy(signed, trust, noWatermark, now).policy;
    for (const [packageBytes, expected] of [[original, true], [bytes('<h1>Different signed content</h1>'), false]] as const) {
      const grants = apiOperationsForPackage(verifyPackage(packageBytes, trust), approved, now);
      const h = client(true, operation => grants.includes(operation));
      try { expect((await h.request()).ok).toBe(expected);
        expect(h.counts().transports).toBe(expected ? 1 : 0);
        expect(h.counts().credentials).toBe(expected ? 1 : 0);
      } finally { h.broker.dispose(); }
    }
  });
  it('requires a release grant and checks exact methods/queries and role capabilities before credentials', async () => {
    const denied = client(false);
    try { expect(denied.connection.capabilities).not.toContain('clinic.api.request');
      expect(await denied.request()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN', outcome: 'not_sent' } });
      expect(denied.counts()).toEqual({ credentials: 0, transports: 0 });
    } finally { denied.broker.dispose(); }
    const allowed = client();
    try {
      expect(allowed.connection.capabilities).toContain('clinic.api.request');
      expect(await allowed.request('/v1/clinic/staff', 'POST')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
      expect(await allowed.request('/v1/clinic/staff?tenantId=other')).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
      allowed.revokeStaff(); expect(await allowed.request()).toMatchObject({ ok: false, error: { code: 'FORBIDDEN' } });
      expect(allowed.counts()).toEqual({ credentials: 0, transports: 0 });
    } finally { allowed.broker.dispose(); }
  });

  it('dispatches a permitted request with host-held credentials and no renderer credential fields', async () => {
    const h = client();
    try {
      const result = await h.request(); expect(result).toEqual({ ok: true, value: { status: 200, body: { staff: [] } } });
      expect(h.counts()).toEqual({ credentials: 1, transports: 1 });
      expect(new Headers(h.sent[0].headers).get('authorization')).toBe('Bearer synthetic-secret');
      expect(h.sent[0]).toMatchObject({ redirect: 'manual', credentials: 'omit', cache: 'no-store' });
      expect(JSON.stringify(result)).not.toContain('synthetic-secret');
    } finally { h.broker.dispose(); }
  });

  it('rechecks changed access after credential mediation before sending transport', async () => {
    const h = client(); let release!: (value: string) => void;
    h.identity.credential = async () => new Promise(resolve => { release = resolve; });
    try {
      const pending = h.request(); await Promise.resolve(); h.revokeStaff(); release('synthetic-secret');
      expect(await pending).toMatchObject({ ok: false, error: { code: 'FORBIDDEN', outcome: 'not_sent' } });
      expect(h.counts().transports).toBe(0);
    } finally { h.broker.dispose(); }
  });

  it('holds an unknown generic write unsafe until original-key reconciliation and rejects changed content', async () => {
    let loseResponse = true, mutations = 0;
    const receipts = new Map<string, unknown>(), keys: string[] = [];
    const h = client(true, undefined, async (_url, init) => {
      const key = new Headers(init.headers).get('idempotency-key')!; keys.push(key);
      if (!receipts.has(key)) { mutations++; receipts.set(key, { receipt: 'synthetic-receipt' }); }
      if (loseResponse) throw Error('Synthetic committed response dropped');
      return Response.json(receipts.get(key));
    });
    const body = JSON.stringify({ amount: 1, note: 'Synthetic fixture' });
    try {
      expect(await h.request('/v1/clinic/operating-expenses', 'POST', body)).toMatchObject({ ok: false,
        error: { code: 'UNKNOWN_OUTCOME', outcome: 'unknown', operationId: 'stable_write_key_01' } });
      expect(h.broker.hasUnsafeWrites(dynamicAppId)).toBe(true);
      expect(await h.request('/v1/clinic/operating-expenses', 'POST', JSON.stringify({ amount: 2 })))
        .toMatchObject({ ok: false, error: { code: 'CONFLICT', outcome: 'not_sent' } });
      expect(h.broker.hasUnsafeWrites(dynamicAppId)).toBe(true);
      loseResponse = false;
      expect((await h.request('/v1/clinic/operating-expenses', 'POST', body)).ok).toBe(true);
      expect(mutations).toBe(1); expect(keys).toEqual(['stable_write_key_01', 'stable_write_key_01']);
      expect(h.broker.hasUnsafeWrites(dynamicAppId)).toBe(false);
    } finally { h.broker.dispose(); }
  });
});
