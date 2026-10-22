// Compiled into a temporary operator Worker. No request-supplied publication or package keys.
const canonical = value => JSON.stringify(value && typeof value === 'object'
  ? Array.isArray(value) ? value.map(item => JSON.parse(canonical(item)))
    : Object.fromEntries(Object.keys(value).sort().map(key => [key, JSON.parse(canonical(value[key]))])) : value);
const sha256 = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))]
  .map(value => value.toString(16).padStart(2, '0')).join('');
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export async function publishMetadataRenewal(bucket, publication, now = Date.now()) {
  const prepared = [];
  for (const [name, field, key] of [
    ['catalogue', 'catalogue', 'catalogue/staging.json'],
    ['updatePolicy', 'policy', 'update-policy/staging.json'],
  ]) {
    const item = publication[name];
    if (!item || typeof item.base64 !== 'string') throw Error('Invalid metadata publication');
    const bytes = decode(item.base64);
    if (!bytes.length || bytes.length > 65_536 || await sha256(bytes) !== item.sha256) throw Error('Invalid metadata bytes');
    const previous = await bucket.get(key);
    if (!previous || !previous.httpEtag) throw Error('Missing metadata baseline');
    const priorBytes = new Uint8Array(await previous.arrayBuffer());
    if (await sha256(priorBytes) !== item.previousSha256) throw Error('Metadata baseline changed');
    const priorEnvelope = JSON.parse(new TextDecoder().decode(priorBytes));
    const nextEnvelope = JSON.parse(new TextDecoder().decode(bytes));
    const prior = priorEnvelope[field], next = nextEnvelope[field];
    const semantic = value => Object.fromEntries(Object.entries(value)
      .filter(([name]) => !['sequence', 'issuedAt', 'expiresAt'].includes(name)));
    if (!prior || !next || canonical(semantic(prior)) !== canonical(semantic(next))
      || priorEnvelope.keyId !== nextEnvelope.keyId
      || next.environment !== 'cloudfare-staging' || next.channel !== 'staging'
      || !Number.isSafeInteger(next.sequence) || next.sequence <= prior.sequence
      || !Number.isSafeInteger(next.issuedAt) || next.issuedAt < 1 || next.issuedAt > now + 300_000
      || !Number.isSafeInteger(next.expiresAt) || next.expiresAt <= now
      || next.expiresAt <= next.issuedAt || next.expiresAt - next.issuedAt > 86_400_000) {
      throw Error('Metadata-only renewal contract violated');
    }
    prepared.push({ key, bytes, etag: previous.httpEtag, sequence: next.sequence });
  }
  // Read and validate BOTH baselines before the first pointer write. ETag guards protect
  // changes after this read. Partial publication is reported; never rewind either pointer.
  const advanced = [];
  for (const item of prepared) {
    const result = await bucket.put(item.key, item.bytes, {
      onlyIf: new Headers({ 'If-Match': item.etag }),
      httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
    });
    if (!result) return { published: false, conflict: true, advanced, packageWrites: 0 };
    advanced.push({ key: item.key, sequence: item.sequence });
  }
  return { published: true, advanced, packageWrites: 0 };
}
