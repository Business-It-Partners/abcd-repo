import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, sha256, type TrustPolicy } from '../electron/packages/format';
import { noWatermark, verifyCatalogue } from '../electron/distribution/catalogue';
import { verifyUpdatePolicy } from '../electron/distribution/updatePolicy';
import { prepareMetadataRenewal } from '../electron/distribution/renewal';

const pair = generateKeyPairSync('ed25519');
const keyId = 'renewal-test';
const trust: TrustPolicy = {
  keys: { [keyId]: { publisher: 'company', publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } },
  apps: { 'company.sample.alpha': { publisher: 'company', capabilities: ['appointments.list', 'platform.status'] } },
};
const now = 1_800_000_000_000, hash = 'a'.repeat(64), payload = 'b'.repeat(64);
function fixture(format: 1 | 2 = 2) {
  const validity = { environment: 'cloudfare-staging', channel: 'staging', issuedAt: now - 86_400_000, expiresAt: now - 1 };
  const catalogue = { ...validity, format: 1, sequence: 7, releases: [{
    id: 'company.sample.alpha', title: 'Synthetic', description: 'Synthetic fixture', version: '1.0.0', notes: 'No real service',
    capabilities: ['appointments.list', 'platform.status'], platforms: ['linux'], sdkMajor: 1, apiMajor: 1,
    objectKey: `releases/company.sample.alpha/1.0.0/${hash}.dentalpkg`, packageSha256: hash, packageBytes: 100,
    payloadDigest: payload, status: 'approved', minimumVersion: '1.0.0',
  }] };
  const policy = { ...validity, format, sequence: 11, revokedKeys: [], apps: [{
    id: 'company.sample.alpha', capabilities: ['appointments.list', 'platform.status'], minimumVersion: '1.0.0',
    revokedDigests: ['c'.repeat(64)], rollback: { from: 'd'.repeat(64), to: payload },
    ...(format === 2 ? { releases: [{ version: '1.0.0', packageSha256: hash, payloadDigest: payload, apiOperations: ['appointments.list'] }] } : {}),
  }] };
  const encode = (field: 'catalogue' | 'policy', value: unknown) => Buffer.from(canonical({
    [field]: value, keyId, signature: sign(null, Buffer.from(canonical({
      purpose: field === 'catalogue' ? 'dental-os-catalogue' : 'dental-os-update-policy', keyId, [field]: value,
    })), pair.privateKey).toString('base64'),
  }));
  const cat = encode('catalogue', catalogue), pol = encode('policy', policy);
  return { catalogue, policy, encode, input: {
    catalogue: cat, updatePolicy: pol, privateKey: pair.privateKey, trust, now,
    watermarks: {
      catalogue: { sequence: 7, digest: sha256(cat), observedAt: now - 1000 },
      updatePolicy: { sequence: 11, digest: sha256(pol), observedAt: now - 1000 },
    }, catalogueSequence: 8, policySequence: 12,
  } };
}

describe('offline metadata-only renewal', () => {
  it.each([1, 2] as const)('renews expired format-%i controls without changing package rows, grants, revocations or rollback', format => {
    const { input, catalogue, policy } = fixture(format);
    const before = { catalogue: Buffer.from(input.catalogue), policy: Buffer.from(input.updatePolicy), marks: structuredClone(input.watermarks) };
    expect(() => verifyCatalogue(input.catalogue, trust, noWatermark, now)).toThrow(/freshness/);
    expect(() => verifyUpdatePolicy(input.updatePolicy, trust, noWatermark, now)).toThrow(/freshness/);
    const result = prepareMetadataRenewal(input);
    const cat = verifyCatalogue(result.catalogue, trust, input.watermarks.catalogue, now).catalogue;
    const pol = verifyUpdatePolicy(result.updatePolicy, trust, input.watermarks.updatePolicy, now).policy;
    expect(cat.releases).toEqual(catalogue.releases);
    expect(pol.apps).toEqual(policy.apps);
    expect(pol.revokedKeys).toEqual(policy.revokedKeys);
    expect(cat.sequence).toBe(8); expect(pol.sequence).toBe(12);
    expect(cat.expiresAt).toBe(now + 86_400_000);
    expect(result.review).toMatchObject({ metadataOnly: true, packageWrites: 0, environment: 'cloudfare-staging' });
    expect(input.catalogue).toEqual(before.catalogue); expect(input.updatePolicy).toEqual(before.policy);
    expect(input.watermarks).toEqual(before.marks);
  });

  it('rejects same/lower sequences independently for each control', () => {
    const { input } = fixture();
    for (const catalogueSequence of [0, 7, 7.5, Number.MAX_SAFE_INTEGER + 1]) {
      expect(() => prepareMetadataRenewal({ ...input, catalogueSequence })).toThrow(/sequence/);
    }
    for (const policySequence of [10, 11, NaN]) {
      expect(() => prepareMetadataRenewal({ ...input, policySequence })).toThrow(/sequence/);
    }
  });

  it('refuses stale or equivocated baselines even when a new sequence is proposed', () => {
    const { input } = fixture();
    expect(() => prepareMetadataRenewal({ ...input, watermarks: { ...input.watermarks,
      catalogue: { ...input.watermarks.catalogue, sequence: 8 },
    }, catalogueSequence: 9 })).toThrow(/replay/);
    expect(() => prepareMetadataRenewal({ ...input, watermarks: { ...input.watermarks,
      updatePolicy: { ...input.watermarks.updatePolicy, digest: 'f'.repeat(64) },
    } })).toThrow(/replay/);
  });

  it('authenticates expired inputs instead of trusting their parsed contents', () => {
    const { input } = fixture();
    const altered = JSON.parse(input.catalogue.toString()); altered.catalogue.releases[0].packageBytes++;
    expect(() => prepareMetadataRenewal({ ...input, catalogue: Buffer.from(canonical(altered)) })).toThrow(/signature/);
    const other = generateKeyPairSync('ed25519');
    expect(() => prepareMetadataRenewal({ ...input, privateKey: other.privateKey })).toThrow(/pinned/);
  });

  it('enforces current-time rollback fence and maximum renewed lifetime', () => {
    const { input } = fixture();
    expect(() => prepareMetadataRenewal({ ...input, now: now - 400_000 })).toThrow(/freshness/);
    for (const lifetimeMs of [0, -1, 86_400_001, 1.5, Infinity]) {
      expect(() => prepareMetadataRenewal({ ...input, lifetimeMs })).toThrow(/lifetime/);
    }
    expect(() => prepareMetadataRenewal({ ...input, now: Number.MAX_SAFE_INTEGER })).toThrow(/clock/);
  });

  it('rejects a signed overlong baseline and malformed recorded watermarks', () => {
    const { input, policy, encode } = fixture();
    const oversizedValidity = encode('policy', { ...policy, issuedAt: now - 86_400_001, expiresAt: now });
    expect(() => prepareMetadataRenewal({ ...input, updatePolicy: oversizedValidity,
      watermarks: { ...input.watermarks, updatePolicy: noWatermark } })).toThrow(/freshness/);
    expect(() => prepareMetadataRenewal({ ...input, watermarks: { ...input.watermarks,
      catalogue: { ...input.watermarks.catalogue, observedAt: NaN },
    } })).toThrow(/watermark/);
  });
});
