// Compiled into a short-lived M17 staging-only Worker. Authentication nonce is short-lived and single-use.
const hex = bytes => [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, '0')).join('');
const digest = async bytes => hex(await crypto.subtle.digest('SHA-256', bytes));
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));

export async function stagingPublisher(request, bucket, expected, nonce, state) {
  const url = new URL(request.url);
  if (request.headers.get('authorization') !== `Bearer ${nonce}`) return new Response(null, { status: 404 });
  if (request.method === 'GET' && url.pathname === '/ready') return Response.json({ ready: true, environment: 'cloudfare-staging' });
  if (request.method !== 'POST' || url.pathname !== '/publish') return new Response(null, { status: 404 });
  if (state.used) return Response.json({ published: false, replay: true }, { status: 409 });
  state.used = true;
  let packageWritten = false;
  let artworkWritten = false;
  const advanced = [];
  try {
    const declaredSize = Number(request.headers.get('content-length') ?? 0);
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > 6_500_000) throw Error('Request size bound');
    const body = await request.json();
    if (!body || typeof body !== 'object' || Object.keys(body).sort().join(',') !== 'artwork,catalogue,package,policy') throw Error('Request fields');
    const artwork = decode(body.artwork), pkg = decode(body.package), catalogue = decode(body.catalogue), policy = decode(body.policy);
    if (pkg.length !== expected.packageBytes || await digest(pkg) !== expected.packageSha256
      || artwork.length !== expected.artworkBytes || await digest(artwork) !== expected.artworkSha256
      || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => artwork[index] === value)
      || await digest(catalogue) !== expected.catalogueSha256 || await digest(policy) !== expected.updatePolicySha256) throw Error('Prepared bytes changed');

    const base = [];
    for (const [key, expectedSha256] of Object.entries(expected.baseline)) {
      const object = await bucket.get(key);
      if (!object || !object.httpEtag) throw Error('Missing signed metadata baseline');
      const bytes = new Uint8Array(await object.arrayBuffer());
      if (await digest(bytes) !== expectedSha256) throw Error('Staging metadata advanced after preparation');
      base.push({ key, etag: object.httpEtag });
    }
    if (base.length !== 2 || base[0].key !== 'catalogue/staging.json' || base[1].key !== 'update-policy/staging.json') throw Error('Baseline targets');

    const catEnvelope = JSON.parse(new TextDecoder().decode(catalogue));
    const policyEnvelope = JSON.parse(new TextDecoder().decode(policy));
    const cat = catEnvelope.catalogue, pol = policyEnvelope.policy;
    const release = cat?.releases?.find(item => item.id === expected.appId);
    const grant = pol?.apps?.find(item => item.id === expected.appId)?.releases?.find(item => item.version === expected.version);
    if (cat?.environment !== 'cloudfare-staging' || cat?.channel !== 'staging' || cat.sequence !== expected.sequence
      || pol?.environment !== 'cloudfare-staging' || pol?.channel !== 'staging' || pol.sequence !== expected.sequence
      || cat.issuedAt !== pol.issuedAt || cat.expiresAt !== pol.expiresAt || cat.issuedAt > Date.now() + 300_000 || cat.expiresAt <= Date.now()
      || catEnvelope.keyId !== expected.keyId || policyEnvelope.keyId !== expected.keyId
      || release?.version !== expected.version || release?.packageSha256 !== expected.packageSha256
      || release?.packageBytes !== expected.packageBytes || release?.payloadDigest !== expected.payloadDigest
      || release?.objectKey !== expected.objectKey || grant?.packageSha256 !== expected.packageSha256
      || grant?.payloadDigest !== expected.payloadDigest || JSON.stringify(grant?.apiOperations) !== JSON.stringify(expected.apiOperations)) {
      throw Error('Prepared signed release contract');
    }
    const icon = release?.icon;
    if (!icon || icon.objectKey !== expected.artworkObjectKey || icon.sha256 !== expected.artworkSha256
      || icon.bytes !== expected.artworkBytes || icon.mime !== 'image/png') throw Error('Prepared artwork contract');

    const objectResult = await bucket.put(expected.objectKey, pkg, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType: 'application/vnd.dental-os.package', cacheControl: 'public, max-age=31536000, immutable' },
    });
    if (!objectResult) throw Error('Immutable package object already exists or raced');
    packageWritten = true;

    const artworkResult = await bucket.put(expected.artworkObjectKey, artwork, {
      onlyIf: new Headers({ 'If-None-Match': '*' }),
      httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=31536000, immutable' },
    });
    if (!artworkResult) throw Error('Immutable app artwork object already exists or raced');
    artworkWritten = true;

    for (const [key, bytes, etag] of [
      ['catalogue/staging.json', catalogue, base[0].etag],
      ['update-policy/staging.json', policy, base[1].etag],
    ]) {
      const result = await bucket.put(key, bytes, {
        onlyIf: new Headers({ 'If-Match': etag }), httpMetadata: { contentType: 'application/json', cacheControl: 'no-store' },
      });
      if (!result) return Response.json({ published: false, conflict: true, packageWritten, advanced }, { status: 409 });
      advanced.push({ key, sequence: expected.sequence });
    }
    return Response.json({ published: true, packageWritten, artworkWritten, advanced }, { status: 200 });
  } catch {
    return Response.json({ published: false, conflict: true, packageWritten, artworkWritten, advanced }, { status: 409 });
  }
}
