/** Private-profile transport fixtures; no request can escape to the network. */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { generateKeyPairSync, sign } from 'node:crypto';
import { canonical, sha256, type TrustPolicy } from '../packages/format';
import { operations } from '../sdk/contracts';
import type { Catalogue, Release } from './catalogue';
export function distributionFixtures(folder: string, sequence: number, updateControlFile?: string) {
 const key = generateKeyPairSync('ed25519');
 const policy: TrustPolicy = { keys: { 'test-only-m06': { publicKey: readFileSync(path.join(folder, 'public-key.txt'), 'utf8'), publisher: 'company' }, 'test-only-catalogue': { publicKey: key.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' } }, apps: {
  'company.sample.alpha': { publisher: 'company', capabilities: operations }, 'company.sample.beta': { publisher: 'company', capabilities: operations.filter(o => o !== 'appointments.setStatus') },
 } };
 const objects = new Map<string, Buffer>(), releases: Release[] = [], successors:Release[]=[];
 for (const host of ['alpha', 'beta']) for(const version of updateControlFile?['1.0.0','1.1.0']:['1.0.0']) {
  const bytes = readFileSync(path.join(folder, `${host}${version==='1.0.0'?'':'-update'}.dentalpkg`)), envelope = JSON.parse(bytes.toString()), digest = sha256(bytes), id = `company.sample.${host}`, objectKey = `releases/${id}/${version}/${digest}.dentalpkg`;
  objects.set('/' + objectKey, bytes); (version==='1.0.0'?releases:successors).push({ id, title: host === 'alpha' ? 'Motion Studio' : 'Records', description: 'Company sample with synthetic in-memory workflows.', version, notes: 'Signed first-party sample package.', capabilities: [...policy.apps[id].capabilities], platforms: ['linux','win32'], sdkMajor: 1, apiMajor: 1, objectKey, packageSha256: digest, packageBytes: bytes.length, payloadDigest: envelope.release.digest, status: 'approved', minimumVersion: '1.0.0' });
 }
 const now = Date.now(), catalogue: Catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence, issuedAt: now, expiresAt: now + 86400000, releases };
 const body = Buffer.from(canonical({ catalogue, keyId: 'test-only-catalogue', signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId: 'test-only-catalogue', catalogue })), key.privateKey).toString('base64') }));
 const bodies=new Map<string,{catalogue:Buffer;policy:Buffer}>();
 function current(){let state={version:'1.0.0',offset:0};try{if(updateControlFile)state=JSON.parse(readFileSync(updateControlFile,'utf8'));}catch{}if(!['1.0.0','1.1.0'].includes(state.version)||!Number.isSafeInteger(state.offset)||state.offset<0||state.offset>100)throw Error('Fixture state');const name=JSON.stringify(state);let cached=bodies.get(name);if(!cached){const c={...catalogue,sequence:sequence+state.offset,releases:state.version==='1.1.0'?successors:releases};const p={format:1,environment:'cloudfare-staging',channel:'staging',sequence:sequence+state.offset,issuedAt:now,expiresAt:now+86400000,revokedKeys:[],apps:releases.map(r=>({id:r.id,minimumVersion:'1.0.0',revokedDigests:[],rollback:null}))};const encode=(purpose:string,field:string,value:unknown)=>Buffer.from(canonical({[field]:value,keyId:'test-only-catalogue',signature:sign(null,Buffer.from(canonical({purpose,keyId:'test-only-catalogue',[field]:value})),key.privateKey).toString('base64')}));cached={catalogue:encode('dental-os-catalogue','catalogue',c),policy:encode('dental-os-update-policy','policy',p)};bodies.set(name,cached);}return cached;}
 const transport: typeof fetch = async (input, init) => {
  const url = new URL(String(input)); if (init?.signal?.aborted) throw new Error('Cancelled');
  if (url.origin === 'https://releases.fixture.invalid') {
   if (new Headers(init?.headers).has('authorization')) throw new Error('Credential leaked'); const data = objects.get(url.pathname); return data ? new Response(new Uint8Array(data)) : new Response(null, { status: 404 });
  }
  if (url.origin !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' || !new Headers(init?.headers).get('authorization')) return new Response(null, { status: 403 });
  if (url.pathname === '/v1/dental-os/catalogue') return new Response(new Uint8Array(updateControlFile?current().catalogue:body), { headers: { 'x-dental-os-time': String(Date.now()) } });
  if (updateControlFile&&url.pathname==='/v1/dental-os/update-policy')return new Response(new Uint8Array(current().policy),{headers:{'x-dental-os-time':String(Date.now())}});
  if (url.pathname === '/v1/dental-os/install-policy') return Response.json({ environment: 'cloudfare-staging', canInstall: true });
  return new Response(null, { status: 404 });
 };
 return { config: { updates:!!updateControlFile, apiBase: 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev', publicBase: 'https://releases.fixture.invalid/', policy }, transport, catalogue: body };
}
