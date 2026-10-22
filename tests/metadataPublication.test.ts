import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { publishMetadataRenewal } from '../tools/app-packages/metadata-renewal-worker.mjs';

const now = 1_800_000_000_000;
const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
function fixture() {
  const objects = new Map<string, Buffer>(), writes: string[] = [], reads: string[] = [];
  let conflict = '';
  const publication: Record<string, any> = {};
  for (const [name, field, key, sequence] of [
    ['catalogue', 'catalogue', 'catalogue/staging.json', 5],
    ['updatePolicy', 'policy', 'update-policy/staging.json', 9],
  ] as const) {
    const prior = { format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence,
      issuedAt: now - 100, expiresAt: now + 100, apps: [{ grants: ['same'] }] };
    const old = Buffer.from(JSON.stringify({ [field]: prior, keyId: 'same-key', signature: 'previous' }));
    const bytes = Buffer.from(JSON.stringify({ [field]: { ...prior, sequence: sequence + 1,
      issuedAt: now, expiresAt: now + 86_400_000 }, keyId: 'same-key', signature: 'new' }));
    objects.set(key, old);
    publication[name] = { base64: bytes.toString('base64'), sha256: digest(bytes), previousSha256: digest(old) };
  }
  const bucket = {
    async get(key: string) {
      reads.push(key); const value = objects.get(key);
      return value ? { httpEtag: '"' + digest(value) + '"', arrayBuffer: async () => value } : null;
    },
    async put(key: string, bytes: Uint8Array, options: { onlyIf: Headers }) {
      writes.push(key);
      if (key === conflict || options.onlyIf.get('If-Match') !== '"' + digest(objects.get(key)!) + '"') return null;
      objects.set(key, Buffer.from(bytes)); return {};
    },
  };
  return { publication, bucket, objects, writes, reads, conflict: (key: string) => { conflict = key; } };
}

describe('staging metadata publisher concurrency and object scope', () => {
  it('prechecks both controls and writes only the two metadata objects', async () => {
    const f = fixture();
    expect(await publishMetadataRenewal(f.bucket, f.publication, now)).toMatchObject({ published: true, packageWrites: 0 });
    expect(f.reads).toEqual(['catalogue/staging.json', 'update-policy/staging.json']);
    expect(f.writes).toEqual(f.reads);
    expect(f.objects.size).toBe(2);
    expect(JSON.parse(f.objects.get('catalogue/staging.json')!.toString()).catalogue.sequence).toBe(6);
    expect(JSON.parse(f.objects.get('update-policy/staging.json')!.toString()).policy.sequence).toBe(10);
    await expect(publishMetadataRenewal(f.bucket, f.publication, now)).rejects.toThrow(/baseline changed/);
  });

  it('does not advance the first control when the second baseline changed', async () => {
    const f = fixture(); f.objects.set('update-policy/staging.json', Buffer.from('{}'));
    await expect(publishMetadataRenewal(f.bucket, f.publication, now)).rejects.toThrow(/baseline changed/);
    expect(f.writes).toEqual([]);
  });

  it.each(['catalogue', 'updatePolicy'])('rejects authority edits in %s before any pointer write', async name => {
    const f = fixture(), item = f.publication[name], envelope = JSON.parse(Buffer.from(item.base64, 'base64').toString());
    const field = name === 'catalogue' ? 'catalogue' : 'policy'; envelope[field].apps[0].grants.push('extra');
    const bytes = Buffer.from(JSON.stringify(envelope)); item.base64 = bytes.toString('base64'); item.sha256 = digest(bytes);
    await expect(publishMetadataRenewal(f.bucket, f.publication, now)).rejects.toThrow(/contract/);
    expect(f.writes).toEqual([]);
  });

  it('reports a concurrent second-pointer conflict without rolling back the first', async () => {
    const f = fixture(); f.conflict('update-policy/staging.json');
    const result = await publishMetadataRenewal(f.bucket, f.publication, now);
    expect(result).toEqual({ published: false, conflict: true,
      advanced: [{ key: 'catalogue/staging.json', sequence: 6 }], packageWrites: 0 });
    expect(JSON.parse(f.objects.get('catalogue/staging.json')!.toString()).catalogue.sequence).toBe(6);
    expect(JSON.parse(f.objects.get('update-policy/staging.json')!.toString()).policy.sequence).toBe(9);
    expect(f.writes).toHaveLength(2);
  });

  it('refuses altered bytes, expired controls and key changes before any write', async () => {
    for (const change of ['hash', 'expired', 'key']) {
      const f = fixture(), item = f.publication.catalogue;
      const envelope = JSON.parse(Buffer.from(item.base64, 'base64').toString());
      if (change === 'expired') envelope.catalogue.expiresAt = now;
      if (change === 'key') envelope.keyId = 'other-key';
      const bytes = Buffer.from(JSON.stringify(envelope)); item.base64 = bytes.toString('base64');
      item.sha256 = change === 'hash' ? '0'.repeat(64) : digest(bytes);
      await expect(publishMetadataRenewal(f.bucket, f.publication, now)).rejects.toThrow();
      expect(f.writes).toEqual([]);
    }
  });
});
