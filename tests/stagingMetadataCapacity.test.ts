import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, type TrustPolicy } from '../electron/packages/format';
import { maxStagingAppEntries, noWatermark, verifyCatalogue, type Catalogue } from '../electron/distribution/catalogue';
import { verifyUpdatePolicy } from '../electron/distribution/updatePolicy';

const now = 1_800_000_000_000;
const pair = generateKeyPairSync('ed25519');
const trust: TrustPolicy = {
  keys: { test: { publisher: 'company', publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString() } },
  apps: {},
  companyApps: { publisher: 'company', capabilities: [] },
};
const stamp = { environment: 'cloudfare-staging' as const, channel: 'staging' as const, sequence: 1, issuedAt: now, expiresAt: now + 3_600_000 };
const apps = (count: number) => Array.from({ length: count }, (_, index) => ({
  id: `company.test.app-${String(index).padStart(2, '0')}`,
  capabilities: [],
  minimumVersion: '1.0.0',
  revokedDigests: [],
  rollback: null,
}));

function signed(field: 'catalogue' | 'policy', value: unknown, purpose: string) {
  return Buffer.from(canonical({
    [field]: value,
    keyId: 'test',
    signature: sign(null, Buffer.from(canonical({ purpose, keyId: 'test', [field]: value })), pair.privateKey).toString('base64'),
  }));
}

function catalogue(count: number): Catalogue {
  return {
    format: 1,
    ...stamp,
    releases: Array.from({ length: count }, (_, index) => {
      const id = `company.test.app-${String(index).padStart(2, '0')}`;
      return {
        id, title: `App ${index}`, description: 'Capacity fixture', version: '1.0.0', notes: 'Synthetic only', capabilities: [],
        platforms: ['linux'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${id}/1.0.0/${'a'.repeat(64)}.dentalpkg`,
        packageSha256: 'a'.repeat(64), packageBytes: 100, payloadDigest: 'b'.repeat(64), status: 'approved', minimumVersion: '1.0.0',
      };
    }),
  };
}

describe('signed M17 staging metadata capacity', () => {
  it('accepts 32 catalogue and policy entries while rejecting a 33rd entry', () => {
    expect(maxStagingAppEntries).toBe(32);
    expect(verifyCatalogue(signed('catalogue', catalogue(32), 'dental-os-catalogue'), trust, noWatermark, now).catalogue.releases).toHaveLength(32);
    expect(() => verifyCatalogue(signed('catalogue', catalogue(33), 'dental-os-catalogue'), trust, noWatermark, now)).toThrow('Catalogue count');

    const policy = { format: 1, ...stamp, revokedKeys: [], apps: apps(32) };
    expect(verifyUpdatePolicy(signed('policy', policy, 'dental-os-update-policy'), trust, noWatermark, now).policy.apps).toHaveLength(32);
    expect(() => verifyUpdatePolicy(signed('policy', { ...policy, apps: apps(33) }, 'dental-os-update-policy'), trust, noWatermark, now)).toThrow('app count');
  });
});
