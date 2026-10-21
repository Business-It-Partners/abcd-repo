/** Trusted local transactions. No renderer paths, credentials or business records. */
import { mkdirSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, renameSync, unlinkSync, readdirSync, rmdirSync, statfsSync, readSync, fstatSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonical, limits, sha256, verifyPackage, appTrust, isCompanyAppId, type TrustPolicy, type VerifiedPackage } from './format';
import { apiOperations, type ApiOperationId } from '../sdk/contracts';
type Installed = { active: string; versions: string[]; pending: string | null; knownGood: string | null; trial: string | null; failed: string[] };
type State = { format: 2; apps: Record<string, Installed> };
type Journal = { format: 1; kind: 'install' | 'uninstall' | 'evict'; appId: string; digest: string; stage: string };
export type Checkpoint = 'journal' | 'asset-write' | 'extracted' | 'published' | 'committed' | 'removed' | 'staged' | 'trial-committed' | 'health-committed' | 'rollback-committed' | 'retention-committed';
export type Lease = VerifiedPackage & { releaseLease(): void };
const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9-]{36}$/;
export class PackageRegistry {
  private leases = new Map<string, number>();
  private digestLeases = new Map<string, number>();
  private guard: (value: VerifiedPackage) => void = () => {};
  private rollbackGuard: (from: VerifiedPackage, to: VerifiedPackage) => boolean = () => false;
  private apiGrantResolver: (value: VerifiedPackage) => readonly ApiOperationId[] = () => [];
  setUpdateGuards(guard: (value: VerifiedPackage) => void, rollback: (from: VerifiedPackage, to: VerifiedPackage) => boolean) { this.guard = guard; this.rollbackGuard = rollback; }
  setApiGrantResolver(resolver: (value: VerifiedPackage) => readonly ApiOperationId[]) { this.apiGrantResolver = resolver; }
  assertAllowed(value: VerifiedPackage) { this.guard(value); }
  apiOperations(value: VerifiedPackage): ApiOperationId[] {
    const ceiling = appTrust(this.policy, value.manifest.appId)?.capabilities ?? [];
    return this.apiGrantResolver(value).filter(operation => apiOperations.includes(operation)
      && value.capabilities.includes(operation)
      && ceiling.includes(operation));
  }
  authorizeApiOperation(value: VerifiedPackage, operation: ApiOperationId) {
    this.guard(value);
    return this.apiOperations(value).includes(operation);
  }
  hasActiveLease(id: string) { return (this.leases.get(id) ?? 0) > 0; }
  pendingActivationVersion(id: string) {
    return this.locked(() => {
      const installed=this.state().apps[id];if(!installed?.pending)return null;
      const pending=this.verified(id,installed.pending);this.guard(pending);
      let activeAllowed=true;try{this.guard(this.verified(id,installed.active));}catch{activeAllowed=false;}
      if(!installed.knownGood&&activeAllowed)return null;
      return pending.manifest.version;
    });
  }
  private verified(id: string, digest: string) {
    const value = this.validateDirectory(this.version(id, digest));
    if (value.manifest.appId !== id || value.release.digest !== digest) throw new Error('Registry identity mismatch');
    return value;
  }
  describe(id: string) {
    return this.locked(() => {
      const v = this.state().apps[id];
      if (!v) throw new Error('App not installed');
      const activeVersion = this.verified(id, v.active).manifest.version;
      const pendingVersion = v.pending ? this.verified(id, v.pending).manifest.version : null;
      const trialVersion = v.trial ? this.verified(id, v.trial).manifest.version : null;
      const knownGoodVersion = v.knownGood ? this.verified(id, v.knownGood).manifest.version : null;
      return { version: activeVersion, activeVersion, pendingVersion, trialVersion, knownGoodVersion, trial: !!v.trial };
    });
  }

  /** Read verified installed metadata without opening a runtime or activating a staged update. */
  inspectPackage(id: string) {
    return this.locked(() => {
      const installed = this.state().apps[id];
      if (!installed) throw new Error('App not installed');
      return this.verified(id, installed.active);
    });
  }

  /** Verified retained releases used to check that refreshed metadata preserves eligible API grants. */
  retainedPackages() {
    return this.locked(() => {
      const state = this.state(), retained: VerifiedPackage[] = [];
      for (const [id, installed] of Object.entries(state.apps)) {
        for (const digest of installed.versions) {
          if (installed.failed.includes(digest)) continue;
          retained.push(this.verified(id, digest));
        }
      }
      return retained;
    });
  }

  constructor(readonly root: string, private policy: TrustPolicy, private capacity: () => number = () => { const s = statfsSync(root); return s.bavail * s.bsize; }, private checkpoint: (phase: Checkpoint) => void = () => {}) {
    // Reject link/reparse ancestors too, including a linked user-data directory.
    const absolute = path.resolve(root); let cursor = path.parse(absolute).root;
    for (const part of absolute.slice(cursor.length).split(path.sep).filter(Boolean)) {
      cursor = path.join(cursor, part);
      try { this.directory(cursor); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; mkdirSync(cursor, { mode: 0o700 }); this.directory(cursor); }
    }
    for (const part of ['apps', 'staging']) { const p = path.join(root, part); try { mkdirSync(p, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; } this.directory(p); }
  }
  private directory(p: string) { const s = lstatSync(p); if (!s.isDirectory() || s.isSymbolicLink()) throw new Error('Unsafe directory'); }
  private chain(p: string) {
    const relative = path.relative(this.root, p); if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Outside package root');
    this.directory(this.root); let current = this.root;
    for (const part of relative.split(path.sep).slice(0, -1)) { current = path.join(current, part); this.directory(current); }
  }
  private read(p: string, max = limits.wire): Buffer {
    this.chain(p); const before = lstatSync(p);
    if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1 || before.size > max) throw new Error('Unsafe file');
    const fd = openSync(p, 'r');
    try {
      const opened = fstatSync(fd); if (opened.ino !== before.ino || opened.dev !== before.dev || !opened.isFile() || opened.nlink !== 1) throw new Error('File changed');
      // Use the opened descriptor, bound the read, and recheck the named inode.
      const buffer = Buffer.alloc(before.size + 1); let count = 0;
      while (count < buffer.length) { const n = readSync(fd, buffer, count, buffer.length - count, count); if (!n) break; count += n; }
      const after = lstatSync(p);
      if (count !== before.size || after.ino !== before.ino || after.dev !== before.dev || !after.isFile() || after.isSymbolicLink() || after.nlink !== 1) throw new Error('File changed');
      return buffer.subarray(0, count);
    } finally { closeSync(fd); }
  }
  private optional(p: string, max?: number): Buffer | undefined { try { return this.read(p, max); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; } }
  private syncDirectory(p: string) { if (process.platform !== 'win32') { const fd = openSync(p, 'r'); try { fsyncSync(fd); } finally { closeSync(fd); } } }
  private atomic(p: string, data: Buffer | string) {
    this.chain(p); if (Buffer.byteLength(data) > limits.wire) throw new Error('Write limit');
    // Refuse unsafe destinations rather than silently replacing a link.
    this.optional(p); const temp = path.join(path.dirname(p), `.write-${randomUUID()}`);
    let fd: number | undefined;
    try { fd = openSync(temp, 'wx', 0o600); writeFileSync(fd, data); fsyncSync(fd); closeSync(fd); fd = undefined; renameSync(temp, p); this.syncDirectory(path.dirname(p)); }
    finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
  }
  private app(id: string) { if (!isCompanyAppId(id) || !appTrust(this.policy,id)) throw new Error('Unknown company app'); return path.join(this.root, 'apps', id); }
  private version(id: string, digest: string) { if (!digestPattern.test(digest)) throw new Error('Invalid version pointer'); return path.join(this.app(id), digest); }
  private state(): State {
    const raw = this.optional(path.join(this.root, 'registry.json'), 65536); if (!raw) return { format: 2, apps: {} };
    const s = JSON.parse(raw.toString());
    if (!s || Object.keys(s).sort().join() !== 'apps,format' || ![1, 2].includes(s.format) || !s.apps || typeof s.apps !== 'object' || Array.isArray(s.apps) || Object.keys(s.apps).length > 16) throw new Error('Registry recovery required');
    for (const [id, v] of Object.entries(s.apps) as [string, Installed][]) {
      this.app(id);
      if (!v || Object.keys(v).sort().join() !== (s.format === 1 ? 'active,versions' : 'active,failed,knownGood,pending,trial,versions') || !Array.isArray(v.versions) || !v.versions.length || v.versions.length > 3 || new Set(v.versions).size !== v.versions.length || !v.versions.every(d => typeof d === 'string' && digestPattern.test(d)) || !v.versions.includes(v.active)) throw new Error('Registry recovery required');
      if (s.format === 1) Object.assign(v, { pending:null, knownGood:null, trial:null, failed:[] });
      if (![v.pending,v.knownGood,v.trial].every(d => d === null || typeof d === 'string' && v.versions.includes(d)) || v.trial !== null && v.trial !== v.active || v.pending !== null && (v.pending === v.active || v.trial !== null) || !Array.isArray(v.failed) || v.failed.length > 3 || !v.failed.every(d => digestPattern.test(d)) || new Set(v.failed).size !== v.failed.length) throw new Error('Registry recovery required');
    }
    s.format = 2; return s;
  }
  private writeState(s: State) { this.atomic(path.join(this.root, 'registry.json'), canonical(s)); }
  private removeTree(p: string) {
    try { this.chain(p); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return; throw e; }
    let count = 0;
    const scan = (dir: string, depth: number): (() => void) => {
      this.directory(dir); if (depth > 12) throw new Error('Cleanup depth'); const actions: (() => void)[] = [];
      for (const name of readdirSync(dir)) {
        if (++count > 1024) throw new Error('Cleanup count'); const item = path.join(dir, name), s = lstatSync(item);
        if (s.isSymbolicLink() || (!s.isDirectory() && (!s.isFile() || s.nlink !== 1))) throw new Error('Unsafe cleanup path');
        actions.push(s.isDirectory() ? scan(item, depth + 1) : () => unlinkSync(item));
      }
      return () => { for (const action of actions) action(); rmdirSync(dir); };
    };
    try { scan(p, 0)(); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
  }
  private recover() {
    const raw = this.optional(path.join(this.root, 'operation.json'), 4096); if (!raw) return;
    const j = JSON.parse(raw.toString()) as Journal;
    if (!j || Object.keys(j).sort().join() !== 'appId,digest,format,kind,stage' || j.format !== 1 || !['install', 'uninstall', 'evict'].includes(j.kind) || !digestPattern.test(j.digest) || !uuidPattern.test(j.stage)) throw new Error('Journal recovery required');
    this.app(j.appId); const s = this.state();
    if (j.kind === 'install') {
      this.removeTree(path.join(this.root, 'staging', j.stage));
      if (!s.apps[j.appId]?.versions.includes(j.digest)) this.removeTree(this.version(j.appId, j.digest));
    } else if (j.kind === 'evict') { if (!s.apps[j.appId]?.versions.includes(j.digest)) this.removeTree(this.version(j.appId,j.digest));
    } else if (!s.apps[j.appId]) this.removeTree(this.app(j.appId));
    unlinkSync(path.join(this.root, 'operation.json')); this.syncDirectory(this.root);
  }
  private locked<T>(work: () => T): T {
    const lock = path.join(this.root, 'operation.lock'); this.chain(lock);
    let fd: number;
    try { fd = openSync(lock, 'wx', 0o600); } catch { throw new Error('Package operation busy; recovery may be needed'); }
    try { writeFileSync(fd, String(process.pid)); fsyncSync(fd); this.recover(); return work(); }
    finally { closeSync(fd); unlinkSync(lock); this.syncDirectory(this.root); }
  }
  /** Bootstrap only, after Electron's profile single-instance lock is acquired. */
  initialize() {
    const lock = path.join(this.root, 'operation.lock'), raw = this.optional(lock, 32);
    if (raw) {
      if (!/^[1-9][0-9]{0,9}$/.test(raw.toString())) throw new Error('Invalid operation owner');
      try { process.kill(Number(raw.toString()), 0); throw new Error('Package operation owner alive'); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw e; }
      unlinkSync(lock);
    }
    return this.locked(() => {
      let count = 0;
      for (const name of readdirSync(this.root)) if (/^\.write-[a-f0-9-]{36}$/.test(name)) {
        if (++count > 64) throw new Error('Atomic cleanup limit');
        const temp = path.join(this.root, name); this.read(temp); unlinkSync(temp);
      }
      this.syncDirectory(this.root); return this.state();
    });
  }
  inspect() { return this.locked(() => structuredClone(this.state())); }
  private validateDirectory(dir: string): VerifiedPackage {
    this.chain(path.join(dir, 'bundle.dentalpkg')); this.directory(dir);
    const verified = verifyPackage(this.read(path.join(dir, 'bundle.dentalpkg')), this.policy);
    const found: string[] = [];
    const scan = (folder: string, prefix = '') => {
      this.directory(folder);
      for (const name of readdirSync(folder)) {
        const relative = prefix + name, p = path.join(folder, name), s = lstatSync(p);
        if (s.isSymbolicLink()) throw new Error('Linked installed asset');
        if (s.isDirectory()) {
          if (!verified.manifest.assets.some(a => a.path.startsWith(relative + '/'))) throw new Error('Unknown installed directory');
          scan(p, relative + '/');
        } else {
          if (relative === 'bundle.dentalpkg') continue;
          const expected = verified.files.get(relative); if (!expected || !this.read(p, limits.file).equals(expected)) throw new Error('Installed integrity'); found.push(relative);
        }
      }
    };
    scan(dir); if (found.length !== verified.files.size) throw new Error('Installed inventory'); return verified;
  }
  install(bytes: Buffer, stageUpdate = false) {
    const verified = verifyPackage(bytes, this.policy), id = verified.manifest.appId, digest = verified.release.digest;
    return this.locked(() => {
      const s = this.state(), previous = s.apps[id];
      if (stageUpdate) this.guard(verified);
      if (previous?.failed.includes(digest)) throw new Error('Failed update quarantined');
      if (previous?.versions.includes(digest)) {
        this.verified(id,digest);
        if (previous.pending === digest || previous.active === digest) return digest;
        if (!stageUpdate || !this.rollbackGuard(this.verified(id,previous.active),verified) || previous.trial || previous.pending) throw new Error('Historical activation requires rollback policy');
        previous.pending=digest; this.writeState(s); this.checkpoint('staged'); return digest;
      }
      if (!previous && Object.keys(s.apps).length >= 16) throw new Error('Installed app limit');
      if (stageUpdate && previous && (previous.pending || previous.trial)) throw new Error('Update already pending or awaiting health');
      if (stageUpdate && previous) this.trim(s,id);
      if (previous && previous.versions.length >= 3) throw new Error('Retention limit; explicit eviction policy required');
      if (previous) {
        const active = this.validateDirectory(this.version(id, previous.active));
        if (active.manifest.appId !== id || active.release.digest !== previous.active) throw new Error('Registry identity mismatch');
        const tuple = (v: string) => v.split('.').map(Number);
        const a = tuple(verified.manifest.version), b = tuple(active.manifest.version); let comparison = 0;
        for (let i = 0; i < 3 && comparison === 0; i++) comparison = a[i] - b[i];
        if (comparison <= 0 && (!stageUpdate || !this.rollbackGuard(active,verified))) throw new Error('Version must increase');
      }
      const reserve = bytes.length + verified.manifest.assets.reduce((n, a) => n + a.size, 0) + 4 * 1024 * 1024;
      if (this.capacity() < reserve) throw new Error('Insufficient package space');
      const stage = randomUUID(), dir = path.join(this.root, 'staging', stage);
      const j: Journal = { format: 1, kind: 'install', appId: id, digest, stage };
      this.atomic(path.join(this.root, 'operation.json'), canonical(j)); this.checkpoint('journal');
      mkdirSync(dir, { mode: 0o700 });
      this.atomic(path.join(dir, 'bundle.dentalpkg'), bytes);
      for (const [name, data] of verified.files) {
        const target = path.join(dir, name); let parent = dir;
        for (const part of name.split('/').slice(0, -1)) { parent = path.join(parent, part); try { mkdirSync(parent, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; } this.directory(parent); }
        this.checkpoint('asset-write'); this.atomic(target, data);
      }
      this.validateDirectory(dir); this.checkpoint('extracted');
      const appDir = this.app(id); try { mkdirSync(appDir, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; } this.directory(appDir); this.syncDirectory(path.join(this.root, 'apps'));
      const destination = this.version(id, digest);
      try { lstatSync(destination); throw new Error('Unregistered version collision'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; }
      renameSync(dir, destination); this.syncDirectory(appDir); this.syncDirectory(path.join(this.root, 'staging')); this.checkpoint('published');
      s.apps[id] = { active: stageUpdate && previous ? previous.active : digest, versions: [...(previous?.versions ?? []), digest], pending: stageUpdate && previous ? digest : null, knownGood: previous?.knownGood ?? null, trial: null, failed: previous?.failed ?? [] };
      this.writeState(s); this.checkpoint('committed'); if (stageUpdate) this.checkpoint('staged'); unlinkSync(path.join(this.root, 'operation.json')); this.syncDirectory(this.root); return digest;
    });
  }
  launch(id: string): Lease {
    return this.locked(() => {
      const s=this.state(), v = s.apps[id]; if (!v) throw new Error('App not installed');
      // A prior trial without health acknowledgement is failed, including process exit.
      if (!this.leases.get(id) && v.trial) this.rollback(s,id);
      let activeAllowed=true;try{this.guard(this.verified(id,v.active));}catch{activeAllowed=false;}
      if (!this.leases.get(id) && v.pending && (v.knownGood || !activeAllowed)) {
        this.guard(this.verified(id,v.pending));
        v.active=v.pending; v.pending=null; v.trial=v.active;
        this.writeState(s); this.checkpoint('trial-committed');
      }
      const verified = this.verified(id,v.active); this.guard(verified);
      this.leases.set(id, (this.leases.get(id) ?? 0) + 1); const digest=verified.release.digest; this.digestLeases.set(digest,(this.digestLeases.get(digest)??0)+1); let released = false;
      return { ...verified, releaseLease: () => { if (!released) { released = true; const remaining=(this.digestLeases.get(digest)??1)-1;if(remaining>0)this.digestLeases.set(digest,remaining);else this.digestLeases.delete(digest);const appRemaining=(this.leases.get(id)??1)-1;if(appRemaining>0)this.leases.set(id,appRemaining);else this.leases.delete(id); } } };
    });
  }
  private trim(s: State, id: string) {
    const v=s.apps[id];
    while(v.versions.length>=3) {
      const discard=v.versions.find(d=>![v.active,v.pending,v.knownGood,v.trial].includes(d)&&!this.digestLeases.get(d));
      if(!discard)throw new Error('Retention limit; protected versions remain');
      const j:Journal={format:1,kind:'evict',appId:id,digest:discard,stage:randomUUID()};
      this.atomic(path.join(this.root,'operation.json'),canonical(j));this.checkpoint('journal');
      v.versions=v.versions.filter(d=>d!==discard);this.writeState(s);this.checkpoint('retention-committed');
      this.removeTree(this.version(id,discard));this.checkpoint('removed');unlinkSync(path.join(this.root,'operation.json'));this.syncDirectory(this.root);
    }
  }
  private rollback(s: State, id: string) {
    const v=s.apps[id]; if(!v.trial)return;
    if(!v.knownGood||v.knownGood===v.trial)throw new Error('No known-good rollback');
    const fallback=this.verified(id,v.knownGood);this.guard(fallback);
    v.failed=[...new Set([...v.failed,v.trial])].slice(-3);v.active=v.knownGood;v.trial=null;
    this.writeState(s);this.checkpoint('rollback-committed');
  }
  markHealthy(id: string, digest: string) {
    return this.locked(()=>{const s=this.state(),v=s.apps[id];if(!v||v.active!==digest||!this.digestLeases.get(digest))throw new Error('Stale health receipt');const value=this.verified(id,digest);this.guard(value);v.knownGood=digest;v.trial=null;this.writeState(s);this.checkpoint('health-committed');});
  }
  markFailed(id: string, digest: string) {
    return this.locked(()=>{const s=this.state(),v=s.apps[id];if(v?.trial===digest)this.rollback(s,id);});
  }
  uninstall(id: string) {
    return this.locked(() => {
      if (this.leases.get(id)) throw new Error('App is running; close it before uninstall');
      const s = this.state(), v = s.apps[id]; this.app(id); if (!v) return;
      const j: Journal = { format: 1, kind: 'uninstall', appId: id, digest: v.active, stage: randomUUID() };
      this.atomic(path.join(this.root, 'operation.json'), canonical(j)); this.checkpoint('journal');
      delete s.apps[id]; this.writeState(s); this.checkpoint('committed');
      this.removeTree(this.app(id)); this.syncDirectory(path.join(this.root, 'apps')); this.checkpoint('removed'); unlinkSync(path.join(this.root, 'operation.json')); this.syncDirectory(this.root);
    });
  }
}
