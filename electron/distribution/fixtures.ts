/** Private-profile transport fixtures; no request can escape to the network. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, sha256, type TrustPolicy } from '../packages/format';
import { operations } from '../sdk/contracts';
import type { Catalogue, Release } from './catalogue';
export function distributionFixtures(folder: string, sequence: number) {
 const key = generateKeyPairSync('ed25519');
 const policy: TrustPolicy = { keys: { 'test-only-m06': { publicKey: readFileSync(path.join(folder, 'public-key.txt'), 'utf8'), publisher: 'company' }, 'test-only-catalogue': { publicKey: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' } }, apps: {
  'company.sample.alpha': { publisher: 'company', capabilities: operations }, 'company.sample.beta': { publisher: 'company', capabilities: operations.filter(o => o !== 'appointments.setStatus') },
 } };
 const objects = new Map<string, Buffer>(), releases: Release[] = [];
 for (const host of ['alpha', 'beta']) {
  const bytes = readFileSync(path.join(folder, `${host}.dentalpkg`)), envelope = JSON.parse(bytes.toString()), digest = sha256(bytes), id = `company.sample.${host}`, objectKey = `releases/${id}/1.0.0/${digest}.dentalpkg`;
  objects.set('/' + objectKey, bytes); releases.push({ id, title: host === 'alpha' ? 'Motion Studio' : 'Records', description: 'Company sample with synthetic in-memory workflows.', version: '1.0.0', notes: 'Signed first-party sample package.', capabilities: [...policy.apps[id].capabilities], platforms: ['linux','win32'], sdkMajor: 1, apiMajor: 1, objectKey, packageSha256: digest, packageBytes: bytes.length, payloadDigest: envelope.release.digest, status: 'approved', minimumVersion: '1.0.0' });
 }
 const now = Date.now(), catalogue: Catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence, issuedAt: now, expiresAt: now + 86400000, releases };
 const body = Buffer.from(canonical({ catalogue, keyId: 'test-only-catalogue', signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId: 'test-only-catalogue', catalogue })), key.privateKey).toString('base64') }));
 const transport: typeof fetch = async (input, init) => {
  const url = new URL(String(input)); if (init?.signal?.aborted) throw new Error('Cancelled');
  if (url.origin === 'https://releases.fixture.invalid') {
   if (new Headers(init?.headers).has('authorization')) throw new Error('Credential leaked'); const data = objects.get(url.pathname); return data ? new Response(new Uint8Array(data)) : new Response(null, { status: 404 });
  }
  if (url.origin !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' || !new Headers(init?.headers).get('authorization')) return new Response(null, { status: 403 });
  if (url.pathname === '/v1/dental-os/catalogue') return new Response(new Uint8Array(body), { headers: { 'x-dental-os-time': String(Date.now()) } });
  if (url.pathname === '/v1/dental-os/install-policy') return Response.json({ environment: 'cloudfare-staging', canInstall: true });
  return new Response(null, { status: 404 });
 };
 return { config: { apiBase: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev', publicBase: 'https://releases.fixture.invalid/', policy }, transport, catalogue: body };
}
