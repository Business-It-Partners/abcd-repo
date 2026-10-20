import type { Identity } from '../sdk/broker';
import { PackageRegistry } from '../packages/registry';
import { sha256, verifyPackage, isCompanyAppId, type TrustPolicy } from '../packages/format';
import { verifyCatalogue, compareVersion, type Catalogue, type Release, type Watermark } from './catalogue';
import { verifyUpdatePolicy, allowUpdatedPackage, type UpdatePolicy } from './updatePolicy';
import type { StoreResult, StoreView } from './contracts';
export type DistributionConfig = { apiBase: string; publicBase: string | null; policy: TrustPolicy; updates?: boolean };
export interface FreshnessStore { load(): Watermark; save(value: Watermark): void; loadUpdate?(): Watermark; saveUpdate?(value: Watermark): void; loadMetadata?(): {catalogue:string;policy:string} | undefined; saveMetadata?(value:{catalogue:string;policy:string}): void }
export class DistributionService {
 private updatePolicy?:UpdatePolicy; private policyBytes?:Buffer; private catalogueBytes?:Buffer; private updateTimer?:ReturnType<typeof setInterval>; private initialTimer?:ReturnType<typeof setTimeout>; private checking=false;
 private pendingVersions=new Map<string,string>(); private quarantined=new Set<string>();
 private catalogue?: Catalogue; private canInstall = false; private phase: StoreView['phase'] = 'idle'; private message = ''; private job: StoreView['job'] = null;
 private action?: AbortController; private installed = new Map<string, string>(); private listeners = new Set<(v: StoreView) => void>(); private lastProgress = 0;
 constructor(private config: DistributionConfig, private registry: PackageRegistry, private identity: Identity, private freshness: FreshnessStore, private transport: typeof fetch = fetch, private now = Date.now, private platform = process.platform, private timeout = 45000) {
  this.reloadInstalled();
  if(config.updates){
   if(!freshness.loadUpdate||!freshness.saveUpdate||!freshness.loadMetadata||!freshness.saveMetadata)throw Error('Update metadata store required');
   registry.setUpdateGuards(value=>allowUpdatedPackage(value,this.updatePolicy,this.catalogue,this.now()),(from,to)=>{try{allowUpdatedPackage(to,this.updatePolicy,this.catalogue,this.now());const rule=this.updatePolicy?.apps.find(a=>a.id===to.manifest.appId)?.rollback;return rule?.from===from.release.digest&&rule?.to===to.release.digest;}catch{return false;}});
   try {const cache=freshness.loadMetadata();if(cache){this.policyBytes=Buffer.from(cache.policy,'base64');this.updatePolicy=verifyUpdatePolicy(this.policyBytes,config.policy,freshness.loadUpdate(),this.now()).policy;this.catalogueBytes=Buffer.from(cache.catalogue,'base64');this.catalogue=verifyCatalogue(this.catalogueBytes,this.catalogueTrust(),freshness.load(),this.now()).catalogue;}}catch{this.updatePolicy=undefined;this.catalogue=undefined;this.message='Refresh current update metadata before opening apps.';}
  }
  if (config.publicBase) { const u = new URL(config.publicBase); if (u.protocol !== 'https:' || u.username || u.password || u.port || u.search || u.hash || u.pathname !== '/') throw new Error('Invalid release origin'); }
 }
 subscribe(fn: (v: StoreView) => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
 view(): StoreView {
  const releases = this.catalogue?.releases ?? [];
  const apps = releases.map(r => ({ id: r.id, title: r.title, description: r.description, version: r.version, notes: r.notes, capabilities: [...r.capabilities], installedVersion: this.installed.get(r.id) ?? null, pendingVersion: this.pendingVersions.get(r.id) ?? null, available: this.compatible(r), reason: this.quarantined.has(r.id+':'+r.payloadDigest) ? 'This update failed its launch check. Your previous version was retained; wait for a corrected release.' : this.compatible(r) ? '' : r.status === 'withdrawn' ? 'Release withdrawn.' : 'Not compatible with this desktop.' }));
  for (const [id, version] of this.installed) if (!apps.some(a => a.id === id)) apps.push({ id, title: id, description: 'Installed company app.', version, notes: 'Catalogue currently unavailable.', capabilities: [], installedVersion: version, pendingVersion: this.pendingVersions.get(id) ?? null, available: false, reason: 'Refresh the catalogue to manage this app.' });
  return { phase: this.phase, apps, canInstall: this.canInstall, job: this.job ? { ...this.job } : null, message: this.message };
 }
 private emit() { const view = this.view(); for (const fn of this.listeners) fn(view); }
 private compatible(r: Release) { return !!this.catalogue && this.catalogue.expiresAt > this.now() && r.status === 'approved' && !this.quarantined.has(r.id+':'+r.payloadDigest) && r.platforms.includes(this.platform as 'linux' | 'win32'); }
 invalidate() { this.action?.abort(); this.canInstall = false; this.phase = 'idle'; this.message = ''; this.job = null; this.emit(); }
 dispose() { clearInterval(this.updateTimer);clearTimeout(this.initialTimer);this.invalidate(); this.listeners.clear(); }
 private reloadInstalled(){const installed=new Map<string,string>(),pending=new Map<string,string>(),quarantined=new Set<string>();const apps=this.registry.inspect().apps;for(const id of Object.keys(apps)){for(const digest of apps[id].failed)quarantined.add(id+':'+digest);const v=this.registry.describe(id);installed.set(id,v.version);if(v.pendingVersion)pending.set(id,v.pendingVersion);}this.installed=installed;this.pendingVersions=pending;this.quarantined=quarantined;}
 changed(){this.reloadInstalled();this.emit();}
 startUpdates(){if(!this.config.updates||this.updateTimer)return;this.initialTimer=setTimeout(()=>void this.checkUpdates(),15000);this.updateTimer=setInterval(()=>void this.checkUpdates(),15*60*1000);this.updateTimer.unref?.();this.initialTimer.unref?.();}
 async checkUpdates(){if(!this.config.updates||this.checking||!this.identity.snapshot().active)return;this.checking=true;try{if(!(await this.refresh()).ok||!this.canInstall)return;for(const r of this.catalogue?.releases??[]){const current=this.installed.get(r.id);if(current&&this.compatible(r)&&!this.pendingVersions.has(r.id)&&compareVersion(r.version,current)>0)await this.install(r.id);}}finally{this.checking=false;}}
 private catalogueTrust():TrustPolicy {return {...this.config.policy,keys:Object.fromEntries(Object.entries(this.config.policy.keys).filter(([id])=>!this.updatePolicy?.revokedKeys.includes(id)))};}
 async updateNow(id:unknown,apply:(id:string)=>void):Promise<StoreResult> {
  if(!isCompanyAppId(id))return{ok:false,code:'INVALID'};
  let blocked=false,blockedMessage:string|undefined;
  const result=await this.run(async(signal,generation)=>{
   await this.loadCatalogue(signal,generation);await this.authorize(signal,generation);this.fence(signal,generation);
   if(!this.pendingVersions.has(id))throw Error('No pending update');
   const expected=this.pendingVersions.get(id)!;
   try{apply(id);}catch(error){blocked=true;const reason=error instanceof Error?error.message:'';blockedMessage=({
    'Resolve pending or unknown write before updating':'Reconcile the server change in the app before updating.',
    'Save work and close dialogs before updating':'Save app work and close its dialogs before updating.',
    'Open the app before applying its update':'Open the app from the dock before applying its update.',
    'No verified app update is staged':'Refresh the Store to confirm the current app update, then try again.',
    'Another runtime instance still holds the app package':'Another app window is still using these files. Close the app windows and retry.',
    'The staged app version did not start':'The new app version could not start; the installed version is still available.',
    'The current app release has not passed its launch health check':'Leave the current app open until its startup check finishes, then retry the update.',
   } as Record<string,string>)[reason];throw Error('Runtime update blocked');}
   const active=this.registry.describe(id);
   if(active.version!==expected||active.pendingVersion)throw Error('Runtime did not activate the staged app version');
   this.reloadInstalled();this.message='Verified update ready. Your previous version remains available for safe recovery.';
  });
  if(blocked){this.message=blockedMessage??'Save unfinished work, close dialogs, and reconcile pending or unknown writes before updating. Then try again.';this.emit();}
  return result;
 }

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
  if(this.config.updates){const response=await this.response(`${this.config.apiBase}/v1/dental-os/update-policy`,signal,generation,true);const clock=response.headers.get('x-dental-os-time');if(!clock||!/^[0-9]{13}$/.test(clock)||Math.abs(Number(clock)-this.now())>300000)throw Error('Clock mismatch');const body=await this.bytes(response,signal,generation,65536);const control=verifyUpdatePolicy(body,this.config.policy,this.freshness.loadUpdate!(),Math.max(Number(clock),this.now()));this.fence(signal,generation);this.freshness.saveUpdate!(control.watermark);this.updatePolicy=control.policy;this.policyBytes=body;}
  const verified = verifyCatalogue(bytes, this.catalogueTrust(), this.freshness.load(), Math.max(serverNow, this.now())); this.fence(signal, generation); this.freshness.save(verified.watermark); this.catalogue = verified.catalogue; this.catalogueBytes=bytes;if(this.config.updates)this.freshness.saveMetadata!({catalogue:bytes.toString('base64'),policy:this.policyBytes!.toString('base64')});
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
    try { const current = new Map<string, string>(); for (const id of Object.keys(this.registry.inspect().apps)) { const info = this.registry.describe(id); current.set(id, info.version); } this.installed = current; } catch { this.phase = 'unavailable'; this.message = 'Local app state needs recovery. Close and relaunch Dental OS; your files are preserved.'; }
    this.canInstall = false; if (this.phase === 'refreshing') this.phase = 'unavailable'; }
   return { ok: false, code: controller.signal.aborted ? 'CANCELLED' : 'UNAVAILABLE' };
  } finally { clearTimeout(timer); if (aborted) controller.signal.removeEventListener('abort', aborted); if (this.action === controller) { this.action = undefined; this.job = null; this.emit(); } }
 }
 refresh() { return this.run(async (signal, generation) => { this.phase = 'refreshing'; this.emit(); if (!this.config.publicBase) throw new Error('Distribution not configured'); await this.loadCatalogue(signal, generation); await this.authorize(signal, generation); this.phase = 'ready'; this.emit(); }); }
 install(id: unknown): Promise<StoreResult> {
  if (!isCompanyAppId(id)) return Promise.resolve({ ok: false, code: 'INVALID' });
  return this.run(async (signal, generation) => {
   if (!this.config.publicBase) throw new Error('Distribution not configured'); this.job = { appId: id, phase: 'authorizing', received: 0, total: 0 }; this.emit();
   await this.loadCatalogue(signal, generation); if (!await this.authorize(signal, generation)) throw new Error('Install denied');
   const release = this.catalogue!.releases.find(r => r.id === id); if (!release || !this.compatible(release)) throw new Error('Release unavailable');
   if (this.installed.has(id) && !this.config.updates) throw new Error('Update policy belongs to M08');
   this.job = { appId: id, phase: 'downloading', received: 0, total: release.packageBytes }; this.emit();
   const response = await this.response(new URL(release.objectKey, this.config.publicBase).href, signal, generation, false), bytes = await this.bytes(response, signal, generation, release.packageBytes, true);
   if (bytes.length !== release.packageBytes || sha256(bytes) !== release.packageSha256) throw new Error('Package digest');
   this.job = { appId: id, phase: 'verifying', received: bytes.length, total: bytes.length }; this.emit();
   const verified = verifyPackage(bytes, this.config.policy);
   if (verified.manifest.appId !== id || verified.manifest.version !== release.version || verified.release.digest !== release.payloadDigest || canonicalCaps(verified.capabilities) !== canonicalCaps(release.capabilities)) throw new Error('Release identity');
   if (this.config.updates) allowUpdatedPackage(verified, this.updatePolicy, this.catalogue, this.now());
   // Fresh metadata + current Worker authority immediately before the atomic registry commit.
   await this.loadCatalogue(signal, generation); if (!await this.authorize(signal, generation)) throw new Error('Install denied');
   const current = this.catalogue!.releases.find(r => r.id === id); if (!current || !this.compatible(current) || current.packageSha256 !== release.packageSha256 || current.version !== verified.manifest.version || current.payloadDigest !== verified.release.digest || canonicalCaps(current.capabilities) !== canonicalCaps(verified.capabilities)) throw new Error('Release changed');
   this.fence(signal, generation); this.job = { appId: id, phase: 'installing', received: bytes.length, total: bytes.length }; this.emit();
   this.fence(signal, generation); this.registry.install(bytes,!!this.config.updates&&this.installed.has(id)); this.reloadInstalled(); this.phase = 'ready'; this.message = this.pendingVersions.has(id) ? 'Verified update ready for the next safe launch. Running work is unchanged.' : 'Verified app installed. Ready to open.';
  });
 }
 uninstall(id: unknown): Promise<StoreResult> {
  if (!isCompanyAppId(id)) return Promise.resolve({ ok: false, code: 'INVALID' });
  return this.run(async (signal, generation) => { if (!await this.authorize(signal, generation)) throw new Error('Uninstall denied'); this.fence(signal, generation); this.registry.uninstall(id); this.installed.delete(id); this.pendingVersions.delete(id); this.message = 'App uninstalled. Clinic records remain on the server.'; });
 }
 cancel() { this.action?.abort(); return { ok: true } as const; }
}
const canonicalCaps = (values: readonly string[]) => [...values].sort().join(',');
