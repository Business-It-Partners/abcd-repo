import { describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, symlinkSync, unlinkSync, linkSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { generateKeyPairSync, sign, verify } from 'node:crypto';
import { buildPackage, canonical, verifyPackage, sha256, limits, productionTrust, type TrustPolicy, type Manifest } from '../electron/packages/format';
import { PackageRegistry, type Checkpoint } from '../electron/packages/registry';
const keys = generateKeyPairSync('ed25519'), publicKey = keys.publicKey.export({ type: 'spki', format: 'pem' }).toString();
const policy: TrustPolicy = { keys: { test: { publicKey, publisher: 'company' } }, apps: { 'company.sample.alpha': { publisher: 'company', capabilities: ['platform.status'] }, 'company.sample.beta': { publisher: 'company', capabilities: [] } } };
const files = new Map([['index.html', Buffer.from('<h1>Signed sample</h1>')], ['sub/app.js', Buffer.from('void 0;')]]);
const meta = (version = '1.0.0', appId = 'company.sample.alpha'): Omit<Manifest, 'format' | 'assets'> => ({ appId, publisher: 'company', version, entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: appId.endsWith('alpha') ? ['platform.status'] : [] });
const bundle = (version = '1.0.0', appId = 'company.sample.alpha') => buildPackage(meta(version, appId), files, 'test', keys.privateKey);
function resign(change: (body: any, release: any) => void) {
 const envelope = JSON.parse(bundle().toString()), body = JSON.parse(Buffer.from(envelope.payload, 'base64').toString()); change(body, envelope.release);
 const payload = Buffer.from(canonical(body)); envelope.payload = payload.toString('base64'); envelope.release.digest = sha256(payload); envelope.signature = sign(null, Buffer.from(canonical(envelope.release)), keys.privateKey).toString('base64'); return Buffer.from(canonical(envelope));
}
function harness(checkpoint?: (phase: Checkpoint) => void, capacity?: () => number) {
 const base = mkdtempSync(path.join(tmpdir(), 'dental-package-unit-')), root = path.join(base, 'packages');
 const registry = new PackageRegistry(root, policy, capacity, checkpoint); registry.initialize();
 return { base, root, registry, close: () => rmSync(base, { recursive: true, force: true }) };
}
describe('dentalpkg/1 signature and portable inventory', () => {
 it('is deterministic, binds identity and approves only platform-granted capabilities', () => {
  expect(bundle().equals(bundle())).toBe(true); const verified = verifyPackage(bundle(), policy);
  expect(verified.manifest.appId).toBe('company.sample.alpha'); expect(verified.files.get('sub/app.js')).toEqual(files.get('sub/app.js')); expect(verified.capabilities).toEqual(['platform.status']);
 });
 it('normal production policy never trusts fixture keys or identities', () => { expect(() => verifyPackage(bundle(), productionTrust)).toThrow('Untrusted'); });
 it('refuses an unknown app signed by an untrusted key before installation or launch', () => {
  const outsider = generateKeyPairSync('ed25519');
  const bytes = buildPackage(meta('1.0.0', 'company.unknown.app'), files, 'outsider', outsider.privateKey);
  const envelope = JSON.parse(bytes.toString()), releaseBytes = Buffer.from(canonical(envelope.release));
  expect(verify(null, releaseBytes, outsider.publicKey, Buffer.from(envelope.signature, 'base64'))).toBe(true);
  expect(() => verifyPackage(bytes, policy)).toThrow('Untrusted release');
  const h = harness();
  try { expect(() => h.registry.install(bytes)).toThrow('Untrusted release'); expect(() => h.registry.launch('company.unknown.app')).toThrow('not installed'); }
  finally { h.close(); }
 });
 it.each(['signature', 'payload', 'release', 'unsigned', 'unknown-key', 'unknown-app', 'publisher'])('rejects %s tampering', field => {
  const e = JSON.parse(bundle().toString());
  if (field === 'signature') e.signature = Buffer.alloc(64).toString('base64');
  if (field === 'payload') e.payload = Buffer.from('altered').toString('base64');
  if (field === 'release') e.release.version = '2.0.0';
  if (field === 'unsigned') delete e.signature;
  if (field === 'unknown-key') e.release.keyId = 'other';
  if (field === 'unknown-app') e.release.appId = 'company.unknown.app';
  if (field === 'publisher') e.release.publisher = 'external';
  expect(() => verifyPackage(Buffer.from(canonical(e)), policy)).toThrow();
 });
 it.each(['../escape.js', '/absolute.js', 'c:/escape.js', 'sub\\escape.js', 'sub//x.js', 'con.js', 'aux/x.js', 'app.js:stream', 'a./x.js', 'a/../../x.js', '%2e%2e/x.js', 'App.js', 'native.exe', 'a/' .repeat(9) + 'x.js'])('refuses path %s even signed by a known key', name => {
  expect(() => verifyPackage(resign(b => { b.manifest.assets[0].path = name; b.files[0].path = name; b.manifest.entry = name; }), policy)).toThrow();
 });
 it.each(['schema', 'sdk', 'api', 'entry', 'identity', 'version', 'capabilities', 'asset-hash', 'asset-bytes', 'duplicate', 'missing', 'extra', 'link', 'count', 'expanded', 'file-limit'])('refuses signed invalid %s', kind => {
  const bytes = resign((b, r) => {
   if (kind === 'schema') b.manifest.format = 2;
   if (kind === 'sdk') b.manifest.sdkMajor = 2;
   if (kind === 'api') b.manifest.apiMajor = 2;
   if (kind === 'entry') b.manifest.entry = 'absent.html';
   if (kind === 'identity') b.manifest.appId = 'company.sample.beta';
   if (kind === 'version') b.manifest.version = '01.0.0';
   if (kind === 'capabilities') b.manifest.capabilities.push('appointments.setStatus');
   if (kind === 'asset-hash') b.manifest.assets[0].sha256 = '0'.repeat(64);
   if (kind === 'asset-bytes') b.files[0].data = Buffer.from('changed').toString('base64');
   if (kind === 'duplicate') b.manifest.assets[1].path = b.manifest.assets[0].path;
   if (kind === 'missing') b.files.pop();
   if (kind === 'extra') b.files.push({ path: 'extra.js', data: '' });
   if (kind === 'link') b.files[0].link = '/tmp/elsewhere';
   if (kind === 'count') b.manifest.assets = Array.from({ length: limits.count + 1 }, (_, i) => ({ path: `${i}.js`, size: 0, sha256: sha256(Buffer.alloc(0)) }));
   if (kind === 'expanded') b.manifest.assets = Array.from({ length: 5 }, (_, i) => ({ path: `${i}.html`, size: limits.file, sha256: '0'.repeat(64) }));
   if (kind === 'file-limit') b.manifest.assets[0].size = limits.file + 1;
   void r;
  }); expect(() => verifyPackage(bytes, policy)).toThrow();
 });
 it('refuses whitespace, duplicate-key aliases, noncanonical base64 and oversized wire before extraction', () => {
  expect(() => verifyPackage(Buffer.concat([bundle(), Buffer.from('\n')]), policy)).toThrow();
  expect(() => verifyPackage(Buffer.from(bundle().toString().replace('{', '{"payload":"",')), policy)).toThrow();
  const e = JSON.parse(bundle().toString()); e.payload += '\n'; expect(() => verifyPackage(Buffer.from(canonical(e)), policy)).toThrow();
  expect(() => verifyPackage(Buffer.alloc(limits.wire + 1), policy)).toThrow('size');
 });
});
describe('local immutable registry and transactions', () => {
 it('installs, launches verified memory bytes, retains old version and pins running lease', () => {
  const h = harness(); try {
   const one = h.registry.install(bundle()), lease = h.registry.launch('company.sample.alpha');
   const two = h.registry.install(bundle('1.1.0')); expect(two).not.toBe(one);
   expect(lease.manifest.version).toBe('1.0.0'); expect(lease.files.get('index.html')).toEqual(files.get('index.html'));
   const next = h.registry.launch('company.sample.alpha'); expect(next.manifest.version).toBe('1.1.0'); next.releaseLease();
   expect(h.registry.inspect().apps['company.sample.alpha'].versions).toEqual([one, two]);
   expect(() => h.registry.uninstall('company.sample.alpha')).toThrow('running'); lease.releaseLease(); lease.releaseLease(); h.registry.uninstall('company.sample.alpha'); expect(h.registry.inspect().apps).toEqual({});
  } finally { h.close(); }
 });
 it('rejects downgrade, same-version replacement and retained historical activation', () => {
  const h = harness(); try {
   h.registry.install(bundle()); h.registry.install(bundle('2.0.0'));
   expect(() => h.registry.install(bundle())).toThrow('Historical'); expect(() => h.registry.install(bundle('1.5.0'))).toThrow('increase');
   const changed = new Map(files); changed.set('index.html', Buffer.from('replacement'));
   expect(() => h.registry.install(buildPackage(meta('2.0.0'), changed, 'test', keys.privateKey))).toThrow('increase');
  } finally { h.close(); }
 });
 it('bounds retained versions without evicting running/known-good bytes', () => {
  const h = harness(); try { for (const v of ['1.0.0', '2.0.0', '3.0.0']) h.registry.install(bundle(v)); expect(() => h.registry.install(bundle('4.0.0'))).toThrow('Retention'); expect(h.registry.inspect().apps['company.sample.alpha'].versions).toHaveLength(3); } finally { h.close(); }
 });
 it('refuses low capacity and preserves the active version', () => {
  let capacity = 100_000_000; const h = harness(undefined, () => capacity); try { const one = h.registry.install(bundle()); capacity = 1; expect(() => h.registry.install(bundle('2.0.0'))).toThrow('space'); expect(h.registry.inspect().apps['company.sample.alpha'].active).toBe(one); } finally { h.close(); }
 });
 it.each(['journal', 'asset-write', 'extracted', 'published', 'committed'] as Checkpoint[])('reconciles first-ever interrupted install at %s', point => {
  let fail = false; const h = harness(phase => { if (fail && phase === point) throw new Error('first install interrupted'); }); try {
   fail = true; expect(() => h.registry.install(bundle())).toThrow(); const next = new PackageRegistry(h.root, policy); next.initialize(); expect(!!next.inspect().apps['company.sample.alpha']).toBe(point === 'committed');
  } finally { h.close(); }
 });
 it.each(['journal', 'asset-write', 'extracted', 'published', 'committed'] as Checkpoint[])('reconciles interrupted install at %s on restart', point => {
  let fail = false; const h = harness(phase => { if (fail && phase === point) throw new Error('simulated interruption'); }); try {
   const one = h.registry.install(bundle()); fail = true; expect(() => h.registry.install(bundle('2.0.0'))).toThrow('interruption');
   const next = new PackageRegistry(h.root, policy); next.initialize(); const lease = next.launch('company.sample.alpha'); expect(lease.manifest.version).toBe(point === 'committed' ? '2.0.0' : '1.0.0'); lease.releaseLease();
   expect(existsSync(path.join(h.root, 'operation.json'))).toBe(false); if (point !== 'committed') expect(next.inspect().apps['company.sample.alpha'].versions).toEqual([one]);
  } finally { h.close(); }
 });
 it.each(['journal', 'committed', 'removed'] as Checkpoint[])('reconciles interrupted uninstall at %s', point => {
  let fail = false; const h = harness(phase => { if (fail && phase === point) throw new Error('uninstall interrupted'); }); try {
   h.registry.install(bundle()); fail = true; expect(() => h.registry.uninstall('company.sample.alpha')).toThrow();
   const next = new PackageRegistry(h.root, policy); next.initialize(); expect(!!next.inspect().apps['company.sample.alpha']).toBe(point === 'journal'); expect(existsSync(path.join(h.root, 'operation.json'))).toBe(false);
  } finally { h.close(); }
 });
 it('recovers ENOSPC during extraction without changing the active version', () => {
  let full = false; const h = harness(phase => { if (full && phase === 'asset-write') throw Object.assign(new Error('disk full'), { code: 'ENOSPC' }); }); try {
   const first = h.registry.install(bundle()); full = true; expect(() => h.registry.install(bundle('2.0.0'))).toThrow('disk full');
   const next = new PackageRegistry(h.root, policy); next.initialize(); expect(next.inspect().apps['company.sample.alpha'].active).toBe(first); expect(existsSync(path.join(h.root, 'operation.json'))).toBe(false);
  } finally { h.close(); }
 });
 it('serializes competing managers and refuses a live/stale malformed owner', () => {
  const h = harness(); try {
   writeFileSync(path.join(h.root, 'operation.lock'), String(process.pid));
   const competing = new PackageRegistry(h.root, policy); expect(() => competing.initialize()).toThrow('alive'); expect(() => competing.install(bundle())).toThrow('busy');
   writeFileSync(path.join(h.root, 'operation.lock'), 'invalid'); expect(() => competing.initialize()).toThrow('owner');
  } finally { h.close(); }
 });
 it('reclaims only recognized abandoned atomic files during single-owner startup', () => {
  const h = harness(); try { const temp = path.join(h.root, '.write-00000000-0000-0000-0000-000000000000'); writeFileSync(temp, 'incomplete write'); writeFileSync(path.join(h.root, 'unrelated'), 'preserve'); new PackageRegistry(h.root, policy).initialize(); expect(existsSync(temp)).toBe(false); expect(existsSync(path.join(h.root, 'unrelated'))).toBe(true); } finally { h.close(); }
 });
 it('fails closed on corrupt registry/journal or forged active identity', () => {
  const h = harness(); try {
   const digest = h.registry.install(bundle()); writeFileSync(path.join(h.root, 'registry.json'), '{'); expect(() => h.registry.launch('company.sample.alpha')).toThrow();
   writeFileSync(path.join(h.root, 'registry.json'), canonical({ format: 1, apps: { 'company.sample.beta': { active: digest, versions: [digest] } } }));
   expect(() => h.registry.launch('company.sample.beta')).toThrow();
   writeFileSync(path.join(h.root, 'operation.json'), canonical({ format: 1, kind: 'uninstall', appId: '../../escape', digest, stage: 'x' })); expect(() => h.registry.inspect()).toThrow('Journal');
  } finally { h.close(); }
 });
 it('revalidates installed inventory and refuses changed/missing/extra bytes', () => {
  const h = harness(); try {
   const digest = h.registry.install(bundle()), dir = path.join(h.root, 'apps/company.sample.alpha', digest), file = path.join(dir, 'index.html');
   writeFileSync(file, 'altered'); expect(() => h.registry.launch('company.sample.alpha')).toThrow('integrity'); writeFileSync(file, files.get('index.html')!);
   writeFileSync(path.join(dir, 'extra.js'), 'extra'); expect(() => h.registry.launch('company.sample.alpha')).toThrow('integrity'); unlinkSync(path.join(dir, 'extra.js'));
   unlinkSync(file); expect(() => h.registry.launch('company.sample.alpha')).toThrow('inventory');
  } finally { h.close(); }
 });
 it('rejects installed hardlinks', () => {
  const h = harness(); try { const d = h.registry.install(bundle()), file = path.join(h.root, 'apps/company.sample.alpha', d, 'index.html'); linkSync(file, path.join(h.base, 'outside.html')); expect(() => h.registry.launch('company.sample.alpha')).toThrow('Unsafe'); } finally { h.close(); }
 });
 it('rejects symlink/junction roots and refuses deletion through a linked app directory', () => {
  const h = harness(); try {
   const outside = path.join(h.base, 'outside'); mkdirSync(outside); writeFileSync(path.join(outside, 'keep.txt'), 'safe');
   const linked = path.join(h.base, 'linked'); symlinkSync(outside, linked, process.platform === 'win32' ? 'junction' : 'dir'); expect(() => new PackageRegistry(path.join(linked, 'child'), policy)).toThrow('Unsafe');
   h.registry.install(bundle()); const app = path.join(h.root, 'apps/company.sample.alpha'); rmSync(app, { recursive: true }); symlinkSync(outside, app, process.platform === 'win32' ? 'junction' : 'dir');
   expect(() => h.registry.launch('company.sample.alpha')).toThrow(); expect(() => h.registry.uninstall('company.sample.alpha')).toThrow('Unsafe'); expect(readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('safe'); expect(existsSync(path.join(h.root, 'operation.json'))).toBe(true);
  } finally { h.close(); }
 });
 it('uninstall leaves another app and unrelated clinic files untouched', () => {
  const h = harness(); try {
   h.registry.install(bundle()); h.registry.install(bundle('1.0.0', 'company.sample.beta')); writeFileSync(path.join(h.base, 'clinic-marker'), 'not owned by package manager');
   h.registry.uninstall('company.sample.alpha'); expect(readFileSync(path.join(h.base, 'clinic-marker'), 'utf8')).toBe('not owned by package manager'); const beta = h.registry.launch('company.sample.beta'); expect(beta.manifest.appId).toBe('company.sample.beta'); beta.releaseLease();
  } finally { h.close(); }
 });
});
