import { afterEach, describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { ApiBroker, type Identity } from '../electron/sdk/broker';
import { canonical, buildPackage, sha256, verifyPackage, type TrustPolicy } from '../electron/packages/format';
import { PackageRegistry, type Lease } from '../electron/packages/registry';
import { allowUpdatedPackage, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, verifyUpdatePolicy, type ApiReleaseGrant, type UpdatePolicyV2 } from '../electron/distribution/updatePolicy';
import { noWatermark, type Catalogue } from '../electron/distribution/catalogue';
import { staging } from '../electron/sdk/environment';
import { sampleAppointment } from '../electron/sdk/fixtures';
import type { ApiOperationId, Operation } from '../electron/sdk/contracts';
import { appOperation } from '../electron/sdk/appPolicy';

const now = 1_800_000_000_000;
const appId = 'company.dental.p04-probe'; // Deliberately absent from the compiled clinic app map.
const pair = generateKeyPairSync('ed25519');
const keyId = 'company';
const caps: Operation[] = ['clinic.api.request', 'appointments.list', 'appointments.setStatus'];
const trust: TrustPolicy = {
  keys: { [keyId]: { publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' } },
  apps: { [appId]: { publisher: 'company', capabilities: caps } },
};
let root = '';
let registry: PackageRegistry;
let broker: ApiBroker | undefined;
let currentPolicy: ReturnType<typeof verifyUpdatePolicy>['policy'];
let currentCatalogue: Catalogue;
let credentialCalls = 0;
let transportCalls = 0;

function bytes(version: string) {
  return buildPackage({ appId, publisher: 'company', version, entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: caps },
    new Map([['index.html', Buffer.from(`<h1>${version}</h1>`)]]), keyId, pair.privateKey);
}
function grant(packageBytes: Buffer, operations: ApiOperationId[]): ApiReleaseGrant {
  const verified = verifyPackage(packageBytes, trust);
  return { version: verified.manifest.version, packageSha256: sha256(packageBytes), payloadDigest: verified.release.digest, apiOperations: operations };
}
function signedPolicy(sequence: number, releases: ApiReleaseGrant[]) {
  const policy: UpdatePolicyV2 = {
    format: 2,
    environment: 'cloudfare-staging',
    channel: 'staging',
    sequence,
    issuedAt: now,
    expiresAt: now + 3_600_000,
    revokedKeys: [],
    apps: [{ id: appId, capabilities: caps, minimumVersion: '1.0.0', revokedDigests: [], rollback: null, releases }],
  };
  const signature = sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId, policy })), pair.privateKey).toString('base64');
  return verifyUpdatePolicy(Buffer.from(canonical({ policy, keyId, signature })), trust, noWatermark, now).policy;
}
function catalogue(packageBytes: Buffer, sequence: number): Catalogue {
  const pkg = verifyPackage(packageBytes, trust), digest = sha256(packageBytes);
  return {
    format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence, issuedAt: now, expiresAt: now + 3_600_000,
    releases: [{
      id: appId, title: 'P04 compatibility probe', description: 'Synthetic first-party package.', version: pkg.manifest.version,
      notes: 'Synthetic only.', capabilities: [...pkg.capabilities], platforms: [process.platform === 'win32' ? 'win32' : 'linux'],
      sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${pkg.manifest.version}/${digest}.dentalpkg`,
      packageSha256: digest, packageBytes: packageBytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0',
    }],
  };
}
function installAuthority() {
  registry.setUpdateGuards(value => allowUpdatedPackage(value, currentPolicy, currentCatalogue, now), () => true);
  registry.setApiGrantResolver(value => {
    const matched = apiReleaseGrantForPackage(value, currentPolicy, now);
    return matched && apiReleaseGrantMatchesCatalogue(value.manifest.appId, matched, currentCatalogue)
      ? apiOperationsForPackage(value, currentPolicy, now)
      : [];
  });
}
function client(lease: Lease) {
  const sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://p04/index.html' };
  const identity: Identity = {
    allowed: () => true,
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic clinician', clinicLabel: 'Synthetic clinic' }),
    credential: async () => { credentialCalls++; return 'synthetic-token'; },
  };
  broker = new ApiBroker(staging, identity, async url => {
    transportCalls++;
    if (new URL(url).pathname.endsWith('/status')) {
      return Response.json({ appointment: { ...sampleAppointment, status: 'arrived', rowVersion: 2 } });
    }
    return Response.json({ appointments: [sampleAppointment] });
  });
  broker.register({
    sender, frame, origin: caller.url, appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities],
    authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } },
    authorizeApiOperation: operation => { try { return registry.authorizeApiOperation(lease, operation); } catch { return false; } },
    report: () => {},
  });
  const connected = broker.connect(caller, { major: 1, minor: 0 });
  if (!connected.ok) throw Error(connected.error.code);
  let requestNumber = 0;
  const request = (operation: Operation, input: Record<string, unknown>) => broker!.request(caller, {
    version: 1, connection: connected.value.connection, generation: connected.value.generation,
    requestId: `p04_request_${++requestNumber}`, operation, input,
  });
  return { capabilities: connected.value.capabilities, request, dispose: () => { broker?.dispose(); broker = undefined; } };
}

function setup() {
  root = mkdtempSync(path.join(tmpdir(), 'dental-p04-api-'));
  const first = bytes('1.0.0'), successor = bytes('1.1.0');
  currentPolicy = signedPolicy(1, [grant(first, ['appointments.list'])]);
  currentCatalogue = catalogue(first, 1);
  registry = new PackageRegistry(path.join(root, 'packages'), trust);
  registry.initialize();
  installAuthority();
  credentialCalls = 0; transportCalls = 0;
  return { first, successor };
}
afterEach(() => {
  broker?.dispose(); broker = undefined;
  if (root) rmSync(root, { recursive: true, force: true });
  root = '';
});

describe('release-scoped first-party API authority', () => {
  it('grants a new first-party app only its exact signed API and does not treat generic transport as authority', async () => {
    const { first } = setup();
    expect(appOperation(appId)).toBeUndefined();
    expect(registry.install(first)).toBeTruthy();
    const lease = registry.launch(appId), app = client(lease);
    try {
      expect(app.capabilities).toContain('appointments.list');
      expect(app.capabilities).not.toContain('appointments.setStatus');
      expect(app.capabilities).not.toContain('clinic.api.request');
      const deniedWrite = await app.request('appointments.setStatus', {
        appointmentId: sampleAppointment.appointmentId, status: 'arrived', expectedRowVersion: 1, idempotencyKey: 'p04_write_0001',
      });
      expect(deniedWrite.ok ? null : deniedWrite.error).toMatchObject({ code: 'FORBIDDEN', outcome: 'not_sent' });
      const deniedGeneric = await app.request('clinic.api.request', { path: '/v1/appointments', method: 'GET', body: null, idempotencyKey: null });
      expect(deniedGeneric.ok ? null : deniedGeneric.error).toMatchObject({ code: 'FORBIDDEN', outcome: 'not_sent' });
      const deniedBlob = await app.request('clinic.api.blob.read', { path: '/v1/patients/synthetic/media' });
      expect(deniedBlob.ok ? null : deniedBlob.error).toMatchObject({ code: 'FORBIDDEN', outcome: 'not_sent' });
      expect(credentialCalls).toBe(0);
      expect(transportCalls).toBe(0);
      expect((await app.request('appointments.list', { date: '2026-10-22' })).ok).toBe(true);
      expect(credentialCalls).toBe(1);
      expect(transportCalls).toBe(1);
    } finally { app.dispose(); lease.releaseLease(); }
  });

  it('keeps v1 narrow while v1.1 adds one operation, then restores only v1 authority after trial failure', async () => {
    const { first, successor } = setup();
    registry.install(first);
    const v1 = registry.launch(appId);
    registry.markHealthy(appId, v1.release.digest);
    const runningV1 = client(v1);
    try {
      expect((await runningV1.request('appointments.list', { date: '2026-10-22' })).ok).toBe(true);
      const before = credentialCalls;
      expect((await runningV1.request('appointments.setStatus', {
        appointmentId: sampleAppointment.appointmentId, status: 'arrived', expectedRowVersion: 1, idempotencyKey: 'p04_old_write_0001',
      })).ok).toBe(false);
      expect(credentialCalls).toBe(before);

      currentPolicy = signedPolicy(2, [grant(first, ['appointments.list']), grant(successor, ['appointments.list', 'appointments.setStatus'])]);
      currentCatalogue = catalogue(successor, 2);
      installAuthority();
      registry.install(successor, true);
      expect(registry.describe(appId)).toMatchObject({ activeVersion: '1.0.0', pendingVersion: '1.1.0', knownGoodVersion: '1.0.0' });
      expect((await runningV1.request('appointments.setStatus', {
        appointmentId: sampleAppointment.appointmentId, status: 'arrived', expectedRowVersion: 1, idempotencyKey: 'p04_old_write_0002',
      })).ok).toBe(false);
      expect(credentialCalls).toBe(before);
    } finally { runningV1.dispose(); v1.releaseLease(); }

    const v11 = registry.launch(appId), appV11 = client(v11);
    try {
      expect(v11.manifest.version).toBe('1.1.0');
      expect(registry.describe(appId)).toMatchObject({ trialVersion: '1.1.0', knownGoodVersion: '1.0.0' });
      expect(appV11.capabilities).toContain('appointments.setStatus');
      const written = await appV11.request('appointments.setStatus', {
        appointmentId: sampleAppointment.appointmentId, status: 'arrived', expectedRowVersion: 1, idempotencyKey: 'p04_successor_write_0001',
      });
      expect(written.ok).toBe(true);

      registry.markFailed(appId, v11.release.digest);
      expect(registry.describe(appId)).toMatchObject({ activeVersion: '1.0.0', trialVersion: null, knownGoodVersion: '1.0.0' });
    } finally { appV11.dispose(); v11.releaseLease(); }

    const fallback = registry.launch(appId), appFallback = client(fallback);
    try {
      expect(fallback.manifest.version).toBe('1.0.0');
      expect(appFallback.capabilities).toContain('appointments.list');
      expect(appFallback.capabilities).not.toContain('appointments.setStatus');
      const before = credentialCalls;
      expect((await appFallback.request('appointments.setStatus', {
        appointmentId: sampleAppointment.appointmentId, status: 'arrived', expectedRowVersion: 1, idempotencyKey: 'p04_fallback_write_0001',
      })).ok).toBe(false);
      expect(credentialCalls).toBe(before);
    } finally { appFallback.dispose(); fallback.releaseLease(); }
  });
});
