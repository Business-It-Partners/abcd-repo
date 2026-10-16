/** Trusted local transactions. No renderer paths, credentials or business records. */
import { mkdirSync, lstatSync, openSync, closeSync, readFileSync, writeFileSync, fsyncSync, renameSync, unlinkSync, readdirSync, rmdirSync, statfsSync, readSync, fstatSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { canonical, limits, sha256, verifyPackage, type TrustPolicy, type VerifiedPackage } from './format';
type Installed = { active: string; versions: string[] };
type State = { format: 1; apps: Record<string, Installed> };
type Journal = { format: 1; kind: 'install' | 'uninstall'; appId: string; digest: string; stage: string };
export type Checkpoint = 'journal' | 'asset-write' | 'extracted' | 'published' | 'committed' | 'removed';
export type Lease = VerifiedPackage & { releaseLease(): void };
const digestPattern = /^[a-f0-9]{64}$/;
const uuidPattern = /^[a-f0-9-]{36}$/;
export class PackageRegistry {
  private leases = new Map<string, number>();
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
  private app(id: string) { if (!Object.hasOwn(this.policy.apps, id) || !/^company\.[a-z][a-z0-9.-]{1,70}$/.test(id)) throw new Error('Unknown company app'); return path.join(this.root, 'apps', id); }
  private version(id: string, digest: string) { if (!digestPattern.test(digest)) throw new Error('Invalid version pointer'); return path.join(this.app(id), digest); }
  private state(): State {
    const raw = this.optional(path.join(this.root, 'registry.json'), 65536); if (!raw) return { format: 1, apps: {} };
    const s = JSON.parse(raw.toString());
    if (!s || Object.keys(s).sort().join() !== 'apps,format' || s.format !== 1 || !s.apps || typeof s.apps !== 'object' || Array.isArray(s.apps) || Object.keys(s.apps).length > 16) throw new Error('Registry recovery required');
    for (const [id, v] of Object.entries(s.apps) as [string, Installed][]) {
      this.app(id);
      if (!v || Object.keys(v).sort().join() !== 'active,versions' || !Array.isArray(v.versions) || !v.versions.length || v.versions.length > 3 || new Set(v.versions).size !== v.versions.length || !v.versions.every(d => typeof d === 'string' && digestPattern.test(d)) || !v.versions.includes(v.active)) throw new Error('Registry recovery required');
    }
    return s;
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
    if (!j || Object.keys(j).sort().join() !== 'appId,digest,format,kind,stage' || j.format !== 1 || !['install', 'uninstall'].includes(j.kind) || !digestPattern.test(j.digest) || !uuidPattern.test(j.stage)) throw new Error('Journal recovery required');
    this.app(j.appId); const s = this.state();
    if (j.kind === 'install') {
      this.removeTree(path.join(this.root, 'staging', j.stage));
      if (!s.apps[j.appId]?.versions.includes(j.digest)) this.removeTree(this.version(j.appId, j.digest));
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
  install(bytes: Buffer) {
    const verified = verifyPackage(bytes, this.policy), id = verified.manifest.appId, digest = verified.release.digest;
    return this.locked(() => {
      const s = this.state(), previous = s.apps[id];
      if (previous?.versions.includes(digest)) { this.validateDirectory(this.version(id, digest)); if (previous.active !== digest) throw new Error('Historical activation requires rollback policy'); return digest; }
      if (!previous && Object.keys(s.apps).length >= 16) throw new Error('Installed app limit');
      if (previous && previous.versions.length >= 3) throw new Error('Retention limit; explicit eviction policy required');
      if (previous) {
        const active = this.validateDirectory(this.version(id, previous.active));
        if (active.manifest.appId !== id || active.release.digest !== previous.active) throw new Error('Registry identity mismatch');
        const tuple = (v: string) => v.split('.').map(Number);
        const a = tuple(verified.manifest.version), b = tuple(active.manifest.version); let comparison = 0;
        for (let i = 0; i < 3 && comparison === 0; i++) comparison = a[i] - b[i];
        if (comparison <= 0) throw new Error('Version must increase');
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
      s.apps[id] = { active: digest, versions: [...(previous?.versions ?? []), digest] };
      this.writeState(s); this.checkpoint('committed'); unlinkSync(path.join(this.root, 'operation.json')); this.syncDirectory(this.root); return digest;
    });
  }
  launch(id: string): Lease {
    return this.locked(() => {
      const v = this.state().apps[id]; if (!v) throw new Error('App not installed');
      const verified = this.validateDirectory(this.version(id, v.active));
      if (verified.manifest.appId !== id || verified.release.digest !== v.active) throw new Error('Registry identity mismatch');
      this.leases.set(id, (this.leases.get(id) ?? 0) + 1); let released = false;
      return { ...verified, releaseLease: () => { if (!released) { released = true; this.leases.set(id, Math.max(0, (this.leases.get(id) ?? 1) - 1)); } } };
    });
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
