import type { Identity } from '../sdk/broker';
import { PackageRegistry } from '../packages/registry';
import { sha256, verifyPackage, type TrustPolicy } from '../packages/format';
import { verifyCatalogue, type Catalogue, type Release, type Watermark } from './catalogue';
import type { StoreResult, StoreView } from './contracts';
export type DistributionConfig = { apiBase: string; publicBase: string | null; policy: TrustPolicy };
export interface FreshnessStore { load(): Watermark; save(value: Watermark): void }
export class DistributionService {
 private catalogue?: Catalogue; private canInstall = false; private phase: StoreView['phase'] = 'idle'; private message = ''; private job: StoreView['job'] = null;
 private action?: AbortController; private installed = new Map<string, string>(); private listeners = new Set<(v: StoreView) => void>(); private lastProgress = 0;
 constructor(private config: DistributionConfig, private registry: PackageRegistry, private identity: Identity, private freshness: FreshnessStore, private transport: typeof fetch = fetch, private now = Date.now, private platform = process.platform, private timeout = 45000) {
  for (const id of Object.keys(registry.inspect().apps)) { const lease = registry.launch(id); this.installed.set(id, lease.manifest.version); lease.releaseLease(); }
  if (config.publicBase) { const u = new URL(config.publicBase); if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash || u.pathname !== '/') throw new Error('Invalid release origin'); }
 }
 subscribe(fn: (v: StoreView) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
 view(): StoreView {
  const releases = this.catalogue?.releases ?? [];
  const apps = releases.map(r => ({ id: r.id, title: r.title, description: r.description, version: r.version, notes: r.notes, capabilities: [...r.capabilities], installedVersion: this.installed.get(r.id) ?? null, available: this.compatible(r), reason: this.compatible(r) ? '' : r.status === 'withdrawn' ? 'Release withdrawn.' : 'Not compatible with this desktop.' }));
  for (const [id, version] of this.installed) if (!apps.some(a => a.id === id)) apps.push({ id, title: id.endsWith('alpha') ? 'Motion Studio' : 'Records', description: 'Installed company sample app.', version, notes: 'Catalogue currently unavailable.', capabilities: [], installedVersion: version, available: false, reason: 'Refresh the catalogue to manage this app.' });
  return { phase: this.phase, apps, canInstall: this.canInstall, job: this.job ? { ...this.job } : null, message: this.message };
 }
 private emit() { const view = this.view(); for (const fn of this.listeners) fn(view); }
 private compatible(r: Release) { return !!this.catalogue && this.catalogue.expiresAt > this.now() && r.status === 'approved' && r.platforms.includes(this.platform as 'linux' | 'win32'); }
 invalidate() { this.action?.abort(); this.catalogue = undefined; this.canInstall = false; this.phase = 'idle'; this.message = ''; this.job = null; this.emit(); }
 dispose() { this.invalidate(); this.listeners.clear(); }
 private fence(signal: AbortSignal, generation: number) { const s = this.identity.snapshot(); if (signal.aborted || !s.active || s.generation !== generation) throw new Error('Session changed'); }
 private async response(url: string, signal: AbortSignal, generation: number, authenticated: boolean) {
  this.fence(signal, generation); const token = authenticated ? await this.identity.credential(generation, signal) : undefined; this.fence(signal, generation);
  const response = await this.transport(url, { signal, redirect: 'manual', credentials: 'omit', cache: 'no-store', headers: token ? { authorization: `Bearer ${token}` } : {} });
  this.fence(signal, generation);
  if (!response.ok || response.status >= 300) { if (authenticated && (response.status === 401 || response.status === 403)) this.identity.rejected?.(response.status); await response.body?.cancel().catch(() => {}); throw new Error('Remote refusal'); }
  return response;
 }
 private async bytes(response: Response, signal: AbortSignal, generation: number, max: number, progress = false) {
  const length = response.headers.get('content-length'); if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > max)) { await response.body?.cancel().catch(() => {}); throw new Error('Response size'); }
  if (!response.body) throw new Error('Missing response'); const reader = response.body.getReader(), chunks: Buffer[] = []; let received = 0;
  try {
   for (;;) { const part = await reader.read(); this.fence(signal, generation); if (part.done) break; received += part.value.byteLength; if (received > max) throw new Error('Response size'); chunks.push(Buffer.from(part.value));
    if (progress && this.job) { this.job.received = received; if (this.now() - this.lastProgress >= 100) { this.lastProgress = this.now(); this.emit(); } }
   }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
  return Buffer.concat(chunks, received);
 }
 private async authorize(signal: AbortSignal, generation: number) {
  const r = await this.response(`${this.config.apiBase}/v1/dental-os/install-policy`, signal, generation, true), b = await this.bytes(r, signal, generation, 1024), v = JSON.parse(b.toString());
  if (!v || Object.keys(v).sort().join() !== 'canInstall,environment' || v.environment !== 'cloudfare-staging' || typeof v.canInstall !== 'boolean') throw new Error('Invalid install policy'); this.canInstall = v.canInstall; return v.canInstall as boolean;
 }
 private async loadCatalogue(signal: AbortSignal, generation: number) {
  const r = await this.response(`${this.config.apiBase}/v1/dental-os/catalogue`, signal, generation, true), bytes = await this.bytes(r, signal, generation, 65536);
  const time = r.headers.get('x-dental-os-time'), serverNow = Number(time);
  if (!time || !/^[0-9]{13}$/.test(time) || !Number.isSafeInteger(serverNow) || Math.abs(serverNow - this.now()) > 300000) throw new Error('Clock mismatch');
  const verified = verifyCatalogue(bytes, this.config.policy, this.freshness.load(), Math.max(serverNow, this.now())); this.fence(signal, generation); this.freshness.save(verified.watermark); this.catalogue = verified.catalogue;
 }
 private async run(work: (signal: AbortSignal, generation: number) => Promise<void>): Promise<StoreResult> {
  if (this.action) return { ok: false, code: 'BUSY' };
  const s = this.identity.snapshot(); if (!s.active) return { ok: false, code: 'DENIED' };
  const controller = new AbortController(); this.action = controller; const timer = setTimeout(() => controller.abort(), this.timeout);
  let aborted: (() => void) | undefined;
  try {
   this.message = ''; await Promise.race([work(controller.signal, s.generation), new Promise<never>((_, reject) => { aborted = () => reject(new Error('Cancelled')); controller.signal.addEventListener('abort', aborted, { once: true }); })]);
   this.fence(controller.signal, s.generation); return { ok: true };
  } catch {
   const current = this.identity.snapshot(); if (current.active && current.generation === s.generation) { this.message = controller.signal.aborted ? 'Operation timed out or was cancelled. Review your installed apps below.' : 'Store operation unavailable. Review your installed apps below.';
    try { const current = new Map<string, string>(); for (const id of Object.keys(this.registry.inspect().apps)) { const lease = this.registry.launch(id); current.set(id, lease.manifest.version); lease.releaseLease(); } this.installed = current; } catch { this.phase = 'unavailable'; this.message = 'Local app state needs recovery. Close and relaunch Dental OS; your files are preserved.'; }
    this.canInstall = false; if (this.phase === 'refreshing') this.phase = 'unavailable'; }
   return { ok: false, code: controller.signal.aborted ? 'CANCELLED' : 'UNAVAILABLE' };
  } finally { clearTimeout(timer); if (aborted) controller.signal.removeEventListener('abort', aborted); if (this.action === controller) { this.action = undefined; this.job = null; this.emit(); } }
 }
 refresh() { return this.run(async (signal, generation) => { this.phase = 'refreshing'; this.emit(); if (!this.config.publicBase) throw new Error('Distribution not configured'); await this.loadCatalogue(signal, generation); await this.authorize(signal, generation); this.phase = 'ready'; this.emit(); }); }
 install(id: unknown): Promise<StoreResult> {
  if (typeof id !== 'string' || !Object.hasOwn(this.config.policy.apps, id)) return Promise.resolve({ ok: false, code: 'INVALID' });
  return this.run(async (signal, generation) => {
   if (!this.config.publicBase) throw new Error('Distribution not configured'); this.job = { appId: id, phase: 'authorizing', received: 0, total: 0 }; this.emit();
   await this.loadCatalogue(signal, generation); if (!await this.authorize(signal, generation)) throw new Error('Install denied');
   const release = this.catalogue!.releases.find(r => r.id === id); if (!release || !this.compatible(release)) throw new Error('Release unavailable');
   // M08 coordinates live update timing/dirty state. M07 installs new apps only.
   if (this.installed.has(id)) throw new Error('Update policy belongs to M08');
   this.job = { appId: id, phase: 'downloading', received: 0, total: release.packageBytes }; this.emit();
   const response = await this.response(new URL(release.objectKey, this.config.publicBase).href, signal, generation, false), bytes = await this.bytes(response, signal, generation, release.packageBytes, true);
   if (bytes.length !== release.packageBytes || sha256(bytes) !== release.packageSha256) throw new Error('Package digest');
   this.job = { appId: id, phase: 'verifying', received: bytes.length, total: bytes.length }; this.emit();
   const verified = verifyPackage(bytes, this.config.policy);
   if (verified.manifest.appId !== id || verified.manifest.version !== release.version || verified.release.digest !== release.payloadDigest || canonicalCaps(verified.capabilities) !== canonicalCaps(release.capabilities)) throw new Error('Release identity');
   // Fresh metadata + current Worker authority immediately before the atomic registry commit.
   await this.loadCatalogue(signal, generation); if (!await this.authorize(signal, generation)) throw new Error('Install denied');
   const current = this.catalogue!.releases.find(r => r.id === id); if (!current || !this.compatible(current) || current.packageSha256 !== release.packageSha256 || current.version !== verified.manifest.version || current.payloadDigest !== verified.release.digest || canonicalCaps(current.capabilities) !== canonicalCaps(verified.capabilities)) throw new Error('Release changed');
   this.fence(signal, generation); this.job = { appId: id, phase: 'installing', received: bytes.length, total: bytes.length }; this.emit();
   this.fence(signal, generation); this.registry.install(bytes); this.installed.set(id, release.version); this.phase = 'ready'; this.message = 'Verified app installed. Ready to open.';
  });
 }
 uninstall(id: unknown): Promise<StoreResult> {
  if (typeof id !== 'string' || !Object.hasOwn(this.config.policy.apps, id)) return Promise.resolve({ ok: false, code: 'INVALID' });
  return this.run(async (signal, generation) => { if (!await this.authorize(signal, generation)) throw new Error('Uninstall denied'); this.fence(signal, generation); this.registry.uninstall(id); this.installed.delete(id); this.message = 'App uninstalled. Clinic records remain on the server.'; });
 }
 cancel() { this.action?.abort(); return { ok: true } as const; }
}
const canonicalCaps = (values: readonly string[]) => [...values].sort().join(',');
