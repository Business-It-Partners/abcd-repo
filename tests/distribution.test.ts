import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync, symlinkSync } from 'node:fs';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { canonical, sha256, buildPackage, type TrustPolicy } from '../electron/packages/format';
import { PackageRegistry } from '../electron/packages/registry';
import { verifyCatalogue, noWatermark, type Catalogue } from '../electron/distribution/catalogue';
import { DistributionService } from '../electron/distribution/service';
import { stagingDistribution } from '../electron/distribution/staging';
import { verifyPackage } from '../electron/packages/format';
import { readFileSync } from 'node:fs';
import { CatalogueStore } from '../electron/distribution/storage';
import { verifyUpdatePolicy } from '../electron/distribution/updatePolicy';
import type { Identity } from '../electron/sdk/broker';
import type { Operation } from '../electron/sdk/contracts';
const pair = generateKeyPairSync('ed25519'), now = 1800000000000, api = 'https://api.fixture.invalid', origin = 'https://releases.fixture.invalid/';
const policy: TrustPolicy = { keys: { test: { publicKey: pair.publicKey.export({ type: 'spki', format: 'pem' }).toString(), publisher: 'company' } }, apps: { 'company.sample.alpha': { publisher: 'company', capabilities: [] } } };
const pkg = buildPackage({ appId: 'company.sample.alpha', publisher: 'company', version: '1.0.0', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: [] }, new Map([['index.html', Buffer.from('<h1>Company sample</h1>')]]), 'test', pair.privateKey);
const p = JSON.parse(pkg.toString()), hash = sha256(pkg);
const base: Catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, releases: [{ id: 'company.sample.alpha', title: 'Motion Studio', description: 'Signed sample', version: '1.0.0', notes: 'Synthetic package fixture', capabilities: [], platforms: ['linux','win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/company.sample.alpha/1.0.0/${hash}.dentalpkg`, packageSha256: hash, packageBytes: pkg.length, payloadDigest: p.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
function signed(c: any = base) { return Buffer.from(canonical({ catalogue: c, keyId: 'test', signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-catalogue', keyId: 'test', catalogue: c })), pair.privateKey).toString('base64') })); }
function signedPolicy(value: any) { return Buffer.from(canonical({ policy: value, keyId: 'test', signature: sign(null, Buffer.from(canonical({ purpose: 'dental-os-update-policy', keyId: 'test', policy: value })), pair.privateKey).toString('base64') })); }
function harness(extra?: (url: string, init: RequestInit, fallback: () => Response) => Promise<Response> | Response) {
 const root = mkdtempSync(path.join(tmpdir(), 'dental-distribution-unit-')), registry = new PackageRegistry(path.join(root, 'packages'), policy); registry.initialize();
 const freshness = new CatalogueStore(path.join(root, 'distribution')); let generation = 1, allowed = true;
 const requests: { url: string; authenticated: boolean }[] = [], identity = { snapshot: () => ({ active: true, generation, userLabel: '', clinicLabel: '' }), credential: async () => 'fixture-credential' };
 const transport: typeof fetch = async (input, init = {}) => {
  const url = String(input); requests.push({ url, authenticated: new Headers(init.headers).has('authorization') });
  const fallback = () => url === api + '/v1/dental-os/catalogue' ? new Response(new Uint8Array(signed()),{headers:{'x-dental-os-time':String(now)}}) : url === api + '/v1/dental-os/install-policy' ? Response.json({ environment: 'cloudfare-staging', canInstall: allowed }) : url === origin + base.releases[0].objectKey ? new Response(new Uint8Array(pkg)) : new Response(null, { status: 404 });
  return extra ? extra(url, init, fallback) : fallback();
 };
 const service = new DistributionService({ apiBase: api, publicBase: origin, policy }, registry, identity, freshness, transport, () => now, 'linux', 100);
 return { root, registry, freshness, service, requests, deny: () => { allowed = false; }, switch: () => { generation++; service.invalidate(); }, close: () => { service.dispose(); rmSync(root, { recursive: true, force: true }); } };
}
function roleFamilyHarness() {
 const appId = 'company.sample.finance', capabilities: Operation[] = ['clinic.app.finance'];
 const trust: TrustPolicy = { ...policy, apps: { [appId]: { publisher: 'company', capabilities } } };
 const bytes = buildPackage({ appId, publisher: 'company', version: '1.0.0', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities },
  new Map([['index.html', Buffer.from('<h1>Finance fixture</h1>')]]), 'test', pair.privateKey);
 const digest = JSON.parse(bytes.toString()).release.digest;
 const release = { ...base.releases[0], id: appId, title: 'Finance', capabilities, objectKey: `releases/${appId}/1.0.0/${sha256(bytes)}.dentalpkg`, packageSha256: sha256(bytes), packageBytes: bytes.length, payloadDigest: digest };
 const catalogue = { ...base, releases: [release] };
 const root = mkdtempSync(path.join(tmpdir(), 'dental-distribution-role-unit-'));
 const registry = new PackageRegistry(path.join(root, 'packages'), trust); registry.initialize();
 const freshness = new CatalogueStore(path.join(root, 'distribution'));
 let familyAllowed = false;
 const identity: Identity = {
  snapshot: () => ({ active: true, generation: 1, userLabel: '', clinicLabel: '' }),
  allowed: operation => operation !== 'clinic.app.finance' || familyAllowed,
  credential: async () => 'fixture-credential',
 };
 const transport: typeof fetch = async input => {
  const url = String(input);
  if (url === api + '/v1/dental-os/catalogue') return new Response(new Uint8Array(signed(catalogue)), { headers: { 'x-dental-os-time': String(now) } });
  if (url === api + '/v1/dental-os/install-policy') return Response.json({ environment: 'cloudfare-staging', canInstall: true });
  if (url === origin + release.objectKey) return new Response(new Uint8Array(bytes));
  return new Response(null, { status: 404 });
 };
 const service = new DistributionService({ apiBase: api, publicBase: origin, policy: trust }, registry, identity, freshness, transport, () => now, 'linux', 100);
 return {
  appId, registry, service,
  allowFamily: (value: boolean) => { familyAllowed = value; service.changed(); },
  close: () => { service.dispose(); rmSync(root, { recursive: true, force: true }); },
 };
}
describe('signed catalogue authenticity/freshness and exact destination binding', () => {
 it('normal staging trust excludes private fixture keys and limits beta to read-only business access', () => {
  expect(() => verifyPackage(readFileSync('fixtures/packages/alpha.dentalpkg'), stagingDistribution.policy)).toThrow('Untrusted');
  expect(stagingDistribution.policy.apps['company.sample.alpha'].capabilities).toContain('appointments.setStatus');expect(stagingDistribution.policy.apps['company.sample.beta'].capabilities).not.toContain('appointments.setStatus');
 });
 it('accepts current company metadata and same-byte sequence replay only within expiry', () => { const a = verifyCatalogue(signed(), policy, noWatermark, now); expect(a.catalogue.sequence).toBe(1); expect(verifyCatalogue(signed(), policy, a.watermark, now + 1000).catalogue.releases).toHaveLength(1); });
 it('accepts a signed immutable PNG artwork reference without changing package authority', () => {
  const catalogue = structuredClone(base) as any;
  const sha = 'a'.repeat(64);
  catalogue.releases[0].icon = { objectKey: `artwork/company.sample.alpha/1.0.0/${sha}.png`, sha256: sha, bytes: 128, mime: 'image/png' };
  expect(verifyCatalogue(signed(catalogue), policy, noWatermark, now).catalogue.releases[0].icon).toEqual(catalogue.releases[0].icon);
  for (const icon of [
   { ...catalogue.releases[0].icon, objectKey: '../escape' },
   { ...catalogue.releases[0].icon, mime: 'image/svg+xml' },
   { ...catalogue.releases[0].icon, bytes: 2 * 1024 * 1024 + 1 },
   { ...catalogue.releases[0].icon, sha256: 'bad' },
  ]) {
   const invalid = structuredClone(catalogue); invalid.releases[0].icon = icon;
   expect(() => verifyCatalogue(signed(invalid), policy, noWatermark, now)).toThrow('Invalid artwork reference');
  }
 });
 it('accepts 25 signed company apps in both catalogue and update policy', () => {
  const count = 25, ids = Array.from({ length: count }, (_, index) => `company.future.app-${index}`);
  const dynamicTrust: TrustPolicy = { ...policy, companyApps: { publisher: 'company', capabilities: [] } };
  const catalogue = { ...base, releases: ids.map(id => ({ ...base.releases[0], id, title: id, objectKey: `releases/${id}/1.0.0/${hash}.dentalpkg` })) };
  expect(verifyCatalogue(signed(catalogue), dynamicTrust, noWatermark, now).catalogue.releases).toHaveLength(count);
  const updatePolicy = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3_600_000, revokedKeys: [], apps: ids.map(id => ({ id, capabilities: [], minimumVersion: '1.0.0', revokedDigests: [], rollback: null })) };
  expect(verifyUpdatePolicy(signedPolicy(updatePolicy), dynamicTrust, noWatermark, now).policy.apps).toHaveLength(count);
 });
 it.each(['signature','unsigned','key','altered','encoding','oversize'])('refuses %s metadata', kind => {
  const e = JSON.parse(signed().toString()); if(kind==='signature')e.signature=Buffer.alloc(64).toString('base64');if(kind==='unsigned')delete e.signature;if(kind==='key')e.keyId='other';if(kind==='altered')e.catalogue.sequence=2;
  const bytes=kind==='oversize'?Buffer.alloc(65537):Buffer.from(canonical(e)+(kind==='encoding'?'\n':''));expect(()=>verifyCatalogue(bytes,policy,noWatermark,now)).toThrow();
 });
 it.each(['schema','environment','channel','expired','future','lifetime','identity','duplicate','path','url','size','sdk','api','capabilities','platform','minimum'])('refuses signed invalid %s', kind => {
  const c:any=structuredClone(base),r=c.releases[0];if(kind==='schema')c.format=2;if(kind==='environment')c.environment='production';if(kind==='channel')c.channel='production';if(kind==='expired')c.expiresAt=now;if(kind==='future')c.issuedAt=now+300001;if(kind==='lifetime')c.expiresAt=now+86400001;if(kind==='identity')r.id='company.other';if(kind==='duplicate')c.releases.push(r);if(kind==='path')r.objectKey='../escape';if(kind==='url')r.objectKey='https://outside.invalid/app';if(kind==='size')r.packageBytes=17000000;if(kind==='sdk')r.sdkMajor=2;if(kind==='api')r.apiMajor=2;if(kind==='capabilities')r.capabilities=['native.intent'];if(kind==='platform')r.platforms=['darwin'];if(kind==='minimum')r.minimumVersion='2.0.0';expect(()=>verifyCatalogue(signed(c),policy,noWatermark,now)).toThrow();
 });
 it('refuses lower sequence, same-sequence equivocation and a rolled-back device clock', () => {
  const c=structuredClone(base);c.sequence=2;const high=verifyCatalogue(signed(c),policy,noWatermark,now).watermark;
  expect(()=>verifyCatalogue(signed(),policy,high,now)).toThrow('replay');c.releases[0].notes='Different';expect(()=>verifyCatalogue(signed(c),policy,high,now)).toThrow('replay');expect(()=>verifyCatalogue(signed(),policy,{...noWatermark,observedAt:now+300001},now)).toThrow('freshness');
 });
 it('requires a fixed HTTPS public origin with no credentials, path, port or query', () => {
  const h=harness();try{for(const publicBase of ['http://outside/','https://user:pass@outside/','https://outside/path/','https://outside/?token=x','https://outside:8443/'])expect(()=>new DistributionService({apiBase:api,publicBase,policy},h.registry,{snapshot:()=>({active:true,generation:1,userLabel:'',clinicLabel:''}),credential:async()=>''},h.freshness)).toThrow('origin');}finally{h.close();}
 });
});
describe('trusted bounded Store lifecycle', () => {
 it('downloads without credentials, verifies and activates before reporting Ready; persists installed truth', async () => {
  const h=harness();try{expect(await h.service.refresh()).toEqual({ok:true});expect(h.service.view().canInstall).toBe(true);expect(await h.service.install('company.sample.alpha')).toEqual({ok:true});expect(h.service.view().apps[0].installedVersion).toBe('1.0.0');expect(h.registry.launch('company.sample.alpha').manifest.version).toBe('1.0.0');expect(h.requests.filter(r=>r.url.startsWith(origin)).every(r=>!r.authenticated)).toBe(true);expect(h.requests.filter(r=>r.url.startsWith(api)).every(r=>r.authenticated)).toBe(true);expect(JSON.stringify(h.service.view())).not.toMatch(/fixture-credential|https:|dentalpkg/);expect(h.freshness.load().sequence).toBe(1);}finally{h.close();}
 });
 it.each(['missing','invalid','skew'])('refuses %s authenticated server clock header',async kind=>{const h=harness((url,_init,fallback)=>url.endsWith('catalogue')?new Response(new Uint8Array(signed()),{headers:kind==='missing'?{}:{'x-dental-os-time':kind==='invalid'?'bad':String(now+300001)}}):fallback());try{expect((await h.service.refresh()).ok).toBe(false);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}});
 it('refuses installation when the Store policy denies this session', async () => {const h=harness();try{h.deny();await h.service.refresh();expect(h.service.view().canInstall).toBe(false);expect((await h.service.install('company.sample.alpha')).ok).toBe(false);expect(h.requests.some(r=>r.url.startsWith(origin))).toBe(false);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}});
 it.each(['redirect','oversize-header','oversize-body','truncated','altered'])('refuses %s package transport',async kind=>{
  const h=harness((url,_init,fallback)=>{if(!url.startsWith(origin))return fallback();if(kind==='redirect')return new Response(null,{status:302,headers:{location:'https://outside.invalid'}});if(kind==='oversize-header')return new Response('x',{headers:{'content-length':String(pkg.length+1)}});if(kind==='oversize-body')return new Response(new Uint8Array(Buffer.alloc(pkg.length+1)));if(kind==='truncated')return new Response('short');return new Response(new Uint8Array(Buffer.alloc(pkg.length)));});try{expect((await h.service.install('company.sample.alpha')).ok).toBe(false);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}
 });
 it('rechecks Store policy immediately before activation',async()=>{let calls=0;const h=harness((url,_init,fallback)=>url.endsWith('install-policy')?Response.json({environment:'cloudfare-staging',canInstall:++calls===1}):fallback());try{expect((await h.service.install('company.sample.alpha')).ok).toBe(false);expect(calls).toBe(2);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}});
 it('refuses withdrawal discovered after download',async()=>{let calls=0;const h=harness((url,_init,fallback)=>{if(!url.endsWith('catalogue'))return fallback();const c=structuredClone(base);c.sequence=++calls;if(calls>1)c.releases[0].status='withdrawn';return new Response(new Uint8Array(signed(c)),{headers:{'x-dental-os-time':String(now)}});});try{expect((await h.service.install('company.sample.alpha')).ok).toBe(false);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}});
 it.each(['version','payloadDigest'])('refuses %s mismatch in fresh metadata even with identical wire hash',async kind=>{let calls=0;const h=harness((url,_init,fallback)=>{if(!url.endsWith('catalogue'))return fallback();const c=structuredClone(base);c.sequence=++calls;if(calls>1){if(kind==='version'){c.releases[0].version='2.0.0';c.releases[0].objectKey=c.releases[0].objectKey.replace('/1.0.0/','/2.0.0/');}else c.releases[0].payloadDigest='0'.repeat(64);}return new Response(new Uint8Array(signed(c)),{headers:{'x-dental-os-time':String(now)}});});try{expect((await h.service.install('company.sample.alpha')).ok).toBe(false);expect(h.registry.inspect().apps).toEqual({});}finally{h.close();}});
 it('bounds hanging operations and cancellation; no install queue or overlapping job',async()=>{vi.useFakeTimers();const h=harness((url,_init,fallback)=>url.startsWith(origin)?new Promise(()=>{}):fallback());try{const pending=h.service.install('company.sample.alpha');await vi.advanceTimersByTimeAsync(10);expect(await h.service.install('company.sample.alpha')).toEqual({ok:false,code:'BUSY'});h.service.cancel();expect(await pending).toEqual({ok:false,code:'CANCELLED'});expect(h.registry.inspect().apps).toEqual({});}finally{h.close();vi.useRealTimers();}});
 it('expires a hanging install at its bounded deadline without real-clock sleeps',async()=>{vi.useFakeTimers();const h=harness((url,_init,fallback)=>url.startsWith(origin)?new Promise(()=>{}):fallback());try{const pending=h.service.install('company.sample.alpha');await vi.advanceTimersByTimeAsync(101);expect(await pending).toEqual({ok:false,code:'CANCELLED'});expect(h.registry.inspect().apps).toEqual({});}finally{h.close();vi.useRealTimers();}});
 it('session switch fences late responses and clears old Store view',async()=>{let release!:(v:Response)=>void;const h=harness((url,_init,fallback)=>url.startsWith(origin)?new Promise(r=>{release=r;}):fallback());try{const pending=h.service.install('company.sample.alpha');await new Promise(r=>setTimeout(r,10));h.switch();release(new Response(new Uint8Array(pkg)));await pending;await new Promise(r=>setTimeout(r,0));expect(h.registry.inspect().apps).toEqual({});expect(h.service.view()).toMatchObject({canInstall:false,phase:'idle',job:null});}finally{h.close();}});
 it('catalogue outage leaves installed bytes coherent; uninstall is independently authorized',async()=>{let outage=false;const h=harness((url,_init,fallback)=>outage&&url.endsWith('catalogue')?new Response(null,{status:503}):fallback());try{await h.service.install('company.sample.alpha');outage=true;expect((await h.service.refresh()).ok).toBe(false);expect(h.service.view().apps[0].installedVersion).toBe('1.0.0');h.deny();expect((await h.service.uninstall('company.sample.alpha')).ok).toBe(false);expect(h.registry.inspect().apps['company.sample.alpha']).toBeTruthy();}finally{h.close();}});
 it('filters installed apps and authorizes uninstall by the current app-family role', async () => {
  const h = roleFamilyHarness();
  try {
   await h.service.refresh();
   expect(h.service.view().apps.some(app => app.id === h.appId)).toBe(false);
   expect((await h.service.install(h.appId)).ok).toBe(false);
   expect(h.registry.inspect().apps[h.appId]).toBeUndefined();
   h.allowFamily(true);
   expect(h.service.view().apps.some(app => app.id === h.appId && app.available)).toBe(true);
   expect(await h.service.install(h.appId)).toEqual({ ok: true });
   expect(h.service.view().apps.some(app => app.id === h.appId && app.installedVersion === '1.0.0')).toBe(true);
   h.allowFamily(false);
   expect(h.service.view().apps.some(app => app.id === h.appId)).toBe(false);
   expect((await h.service.uninstall(h.appId)).ok).toBe(false);
   expect(h.registry.inspect().apps[h.appId]).toBeTruthy();
   h.allowFamily(true);
   expect(h.service.view().apps.some(app => app.id === h.appId && app.installedVersion === '1.0.0')).toBe(true);
   expect(await h.service.uninstall(h.appId)).toEqual({ ok: true });
   expect(h.registry.inspect().apps[h.appId]).toBeUndefined();
  } finally { h.close(); }
 });
 it('refuses arbitrary install IDs and update replacement until M08',async()=>{const h=harness();try{expect(await h.service.install('../../file')).toEqual({ok:false,code:'INVALID'});await h.service.install('company.sample.alpha');expect((await h.service.install('company.sample.alpha')).ok).toBe(false);}finally{h.close();}});
 it('watermark survives restart and corrupt/linked state fails closed',()=>{const h=harness();try{const w=verifyCatalogue(signed(),policy,noWatermark,now).watermark;h.freshness.save(w);expect(new CatalogueStore(path.join(h.root,'distribution')).load()).toEqual(w);writeFileSync(path.join(h.root,'distribution/freshness.json'),'{');expect(()=>h.freshness.load()).toThrow();}finally{h.close();}});
 it('rejects a linked freshness directory',()=>{const h=harness();try{const linked=path.join(h.root,'linked');symlinkSync(path.join(h.root,'distribution'),linked,process.platform==='win32'?'junction':'dir');expect(()=>new CatalogueStore(linked)).toThrow('Unsafe');}finally{h.close();}});
});

it('rejects malformed UTF-8 catalogue bytes whose replacement text still verifies',()=>{const c=structuredClone(base);c.releases[0].description='\ufffd';const good=signed(c),i=good.indexOf(Buffer.from('\ufffd'));expect(()=>verifyCatalogue(good,policy,noWatermark,now)).not.toThrow();const bad=Buffer.concat([good.subarray(0,i),Buffer.from([0x80]),good.subarray(i+3)]);expect(bad.toString()).toBe(good.toString());expect(()=>verifyCatalogue(bad,policy,noWatermark,now)).toThrow('Noncanonical');});
