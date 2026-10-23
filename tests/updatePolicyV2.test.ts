import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { buildPackage, canonical, sha256, verifyPackage, type TrustPolicy } from '../electron/packages/format';
import { apiOperationsForPackage, apiReleaseGrantMatchesCatalogue, verifyUpdatePolicy, type ApiReleaseGrant, type UpdatePolicyV1, type UpdatePolicyV2 } from '../electron/distribution/updatePolicy';
import { noWatermark, type Catalogue } from '../electron/distribution/catalogue';
import type { ApiOperationId, Operation } from '../electron/sdk/contracts';

const now = 1_800_000_000_000;
const appId = 'company.sample.api-authority';
const otherAppId = 'company.sample.other-api-authority';
const key = generateKeyPairSync('ed25519');
const sdkCapabilities: Operation[] = ['clinic.api.request', 'appointments.list', 'appointments.setStatus'];
const trust: TrustPolicy = {
  keys: { company: { publicKey: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' } },
  apps: {
    [appId]: { publisher: 'company', capabilities: sdkCapabilities },
    [otherAppId]: { publisher: 'company', capabilities: sdkCapabilities },
  },
};

function packageBytes(version = '1.0.0', id = appId, html = `<h1>${version}</h1>`, capabilities: Operation[] = sdkCapabilities) {
  return buildPackage({
    appId: id,
    publisher: 'company',
    version,
    entry: 'index.html',
    sdkMajor: 1,
    apiMajor: 1,
    capabilities,
  }, new Map([['index.html', Buffer.from(html)]]), 'company', key.privateKey);
}

function releaseGrant(bytes: Buffer, apiOps: ApiOperationId[]): ApiReleaseGrant {
  const pkg = verifyPackage(bytes, trust);
  return {
    version: pkg.manifest.version,
    packageSha256: sha256(bytes),
    payloadDigest: pkg.release.digest,
    apiOperations: apiOps,
  };
}

function v1Policy(): UpdatePolicyV1 {
  return {
    format: 1,
    environment: 'cloudfare-staging',
    channel: 'staging',
    sequence: 1,
    issuedAt: now,
    expiresAt: now + 3_600_000,
    revokedKeys: [],
    apps: [{ id: appId, capabilities: sdkCapabilities, minimumVersion: '1.0.0', revokedDigests: [], rollback: null }],
  };
}

function v2Policy(releases: ApiReleaseGrant[], capabilities: Operation[] = sdkCapabilities): UpdatePolicyV2 {
  return {
    format: 2,
    environment: 'cloudfare-staging',
    channel: 'staging',
    sequence: 1,
    issuedAt: now,
    expiresAt: now + 3_600_000,
    revokedKeys: [],
    apps: [{ id: appId, capabilities, minimumVersion: '1.0.0', revokedDigests: [], rollback: null, releases }],
  };
}

function signed(policy: UpdatePolicyV1 | UpdatePolicyV2): Buffer {
  const signature = sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId: 'company', policy })), key.privateKey).toString('base64');
  return Buffer.from(canonical({ policy, keyId: 'company', signature }));
}

function verifiedPolicy(policy: UpdatePolicyV1 | UpdatePolicyV2) {
  return verifyUpdatePolicy(signed(policy), trust, noWatermark, now).policy;
}

describe('signed update-policy v2 API grants', () => {
  it('returns grants only for an exact verified package identity and exposes its wire hash', () => {
    const bytes = packageBytes();
    const pkg = verifyPackage(bytes, trust);
    const policy = verifiedPolicy(v2Policy([releaseGrant(bytes, ['appointments.list'])]));

    expect(pkg.packageSha256).toBe(sha256(bytes));
    expect(pkg.packageSha256).not.toBe(pkg.release.digest);
    expect(apiOperationsForPackage(pkg, policy, now)).toEqual(['appointments.list']);
  });

  it('does not inherit successor operations and rejects version, digest, or app identity mismatches', () => {
    const oldBytes = packageBytes('1.0.0', appId, undefined, ['clinic.api.request', 'appointments.list']);
    const successorBytes = packageBytes('1.1.0', appId, undefined, ['clinic.api.request', 'appointments.list', 'appointments.setStatus']);
    const otherBytes = packageBytes('1.0.0', otherAppId);
    const oldPackage = verifyPackage(oldBytes, trust);
    const successor = verifyPackage(successorBytes, trust);
    const otherPackage = verifyPackage(otherBytes, trust);
    const policy = verifiedPolicy(v2Policy([
      releaseGrant(oldBytes, ['appointments.list', 'appointments.setStatus']),
      releaseGrant(successorBytes, ['appointments.list', 'appointments.setStatus']),
    ]));

    // The signed update grant allows setStatus, but this package's own SDK declaration narrows it away.
    expect(apiOperationsForPackage(oldPackage, policy, now)).toEqual(['appointments.list']);
    expect(apiOperationsForPackage(successor, policy, now)).toEqual(['appointments.list', 'appointments.setStatus']);
    expect(apiOperationsForPackage(otherPackage, policy, now)).toEqual([]);
    expect(apiOperationsForPackage(verifyPackage(packageBytes('1.2.0'), trust), policy, now)).toEqual([]);

    const differentBytes = packageBytes('1.0.0', appId, '<h1>different signed bytes</h1>');
    expect(apiOperationsForPackage(verifyPackage(differentBytes, trust), policy, now)).toEqual([]);
  });

  it('never grants a typed API operation absent from the signed package capability declaration', () => {
    const bytes = packageBytes('1.0.0', appId, '<h1>generic SDK only</h1>', ['clinic.api.request']);
    const pkg = verifyPackage(bytes, trust);
    const policy = verifiedPolicy(v2Policy([releaseGrant(bytes, ['appointments.list', 'appointments.setStatus'])]));

    expect(apiOperationsForPackage(pkg, policy, now)).toEqual([]);
  });

  it('keeps format 1 verifiable for legacy update safety but returns no API grant', () => {
    const pkg = verifyPackage(packageBytes(), trust);
    const policy = verifiedPolicy(v1Policy());
    expect(policy.format).toBe(1);
    expect(apiOperationsForPackage(pkg, policy, now)).toEqual([]);
    expect(apiOperationsForPackage(pkg, undefined, now)).toEqual([]);
  });

  it('rejects duplicate, unknown, malformed, over-ceiling, and more-than-six release grants', () => {
    const bytes = packageBytes();
    const grant = releaseGrant(bytes, ['appointments.list']);
    const duplicate = v2Policy([grant, grant]);
    const unknown = v2Policy([{ ...grant, apiOperations: ['appointments.delete'] as unknown as ApiOperationId[] }]);
    const badVersion = v2Policy([{ ...grant, version: '01.0.0' }]);
    const badPackageHash = v2Policy([{ ...grant, packageSha256: 'G'.repeat(64) }]);
    const badPayloadDigest = v2Policy([{ ...grant, payloadDigest: 'no-digest' }]);
    const overCeiling = v2Policy([releaseGrant(bytes, ['appointments.setStatus'])], ['clinic.api.request']);

    expect(() => verifiedPolicy(duplicate)).toThrow('Duplicate update policy release grant');
    expect(() => verifiedPolicy(unknown)).toThrow('Update policy release grant');
    expect(() => verifiedPolicy(badVersion)).toThrow('Update policy release grant');
    expect(() => verifiedPolicy(badPackageHash)).toThrow('Update policy release grant');
    expect(() => verifiedPolicy(badPayloadDigest)).toThrow('Update policy release grant');
    expect(() => verifiedPolicy(overCeiling)).toThrow('Update policy release grant');

    const six = ['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0'].map(version => packageBytes(version));
    expect(() => verifiedPolicy(v2Policy(six.map(value => releaseGrant(value, ['appointments.list']))))).not.toThrow();
    const seven = [...six, packageBytes('1.6.0')].map(value => releaseGrant(value, ['appointments.list']));
    expect(() => verifiedPolicy(v2Policy(seven))).toThrow('Update policy release grants');
  });

  it('requires a grant matching the current catalogue row while allowing older retained fallback grants', () => {
    const bytes = packageBytes('1.0.0');
    const grant = releaseGrant(bytes, ['appointments.list']);
    const catalogue: Catalogue = {
      format: 1,
      environment: 'cloudfare-staging',
      channel: 'staging',
      sequence: 1,
      issuedAt: now,
      expiresAt: now + 3_600_000,
      releases: [{
        id: appId,
        title: 'Sample',
        description: 'Synthetic',
        version: grant.version,
        notes: 'Current release',
        capabilities: sdkCapabilities,
        platforms: ['linux'],
        sdkMajor: 1,
        apiMajor: 1,
        objectKey: `releases/${appId}/${grant.version}/${grant.packageSha256}.dentalpkg`,
        packageSha256: grant.packageSha256,
        packageBytes: bytes.length,
        payloadDigest: grant.payloadDigest,
        status: 'approved',
        minimumVersion: '1.0.0',
      }],
    };

    expect(apiReleaseGrantMatchesCatalogue(appId, grant, catalogue)).toBe(true);
    expect(apiReleaseGrantMatchesCatalogue(appId, { ...grant, packageSha256: 'f'.repeat(64) }, catalogue)).toBe(false);
    expect(apiReleaseGrantMatchesCatalogue(appId, { ...grant, payloadDigest: 'f'.repeat(64) }, catalogue)).toBe(false);
    expect(apiReleaseGrantMatchesCatalogue(appId, { ...grant, version: '0.9.0' }, catalogue)).toBe(true);
    expect(apiReleaseGrantMatchesCatalogue(appId, grant, undefined)).toBe(true);
  });

  it('preserves exact format-2 release grants across a higher-sequence metadata-only renewal', () => {
    const bytes = packageBytes('1.0.0');
    const pkg = verifyPackage(bytes, trust);
    const original = v2Policy([releaseGrant(bytes, ['appointments.list'])]);
    const first = verifyUpdatePolicy(signed(original), trust, noWatermark, now);
    const renewedAt = now + 3_600_001;
    const renewed: UpdatePolicyV2 = {
      ...original,
      sequence: original.sequence + 1,
      issuedAt: renewedAt,
      expiresAt: renewedAt + 3_600_000,
    };
    const result = verifyUpdatePolicy(signed(renewed), trust, first.watermark, renewedAt);

    expect(result.policy).toMatchObject({ sequence: 2, issuedAt: renewedAt, expiresAt: renewedAt + 3_600_000 });
    expect(result.policy.apps[0]).toEqual(original.apps[0]);
    expect(apiOperationsForPackage(pkg, result.policy, renewedAt)).toEqual(['appointments.list']);
  });
});
