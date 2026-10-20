import { mkdirSync, lstatSync, readFileSync, writeFileSync, openSync, closeSync, fsyncSync, renameSync, unlinkSync, chmodSync, existsSync } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { storageHost, type StorageHost } from '../host/platform';
export type Preferences = { overviewShortcutEnabled: boolean; favoriteAppIds?: string[] };
type State = { version: 1 | 2; preferences: Preferences };
const LIMIT = 16384;
const validFavoriteIds = (value: unknown): value is string[] => Array.isArray(value) && value.length <= 32 &&
  value.every(id => typeof id === 'string' && /^[a-z0-9][a-z0-9._-]{0,127}$/.test(id)) && new Set(value).size === value.length;
const hash = (s: string | null) => s === null ? null : createHash('sha256').update(s).digest('hex');
export class StateRecoveryError extends Error { constructor() { super('OS_STATE_RECOVERY_REQUIRED'); } }
export class OsStateStore {
  private readonly file: string;
  private readonly journal: string;
  constructor(private readonly root: string, private readonly host: StorageHost = storageHost,
    private readonly checkpoint: (phase: 'journal' | 'state') => void = () => {}) {
    mkdirSync(root, { recursive: true, mode: 0o700 });
    this.assertRegular(root, true);
    if (host.privateModes) chmodSync(root, 0o700);
    this.file = path.join(root, 'preferences.json'); this.journal = path.join(root, 'pending.json');
  }
  private assertRegular(p: string, directory = false) {
    const s = lstatSync(p);
    if (s.isSymbolicLink() || (directory ? !s.isDirectory() : !s.isFile()) || (!directory && s.size > LIMIT)) throw new StateRecoveryError();
  }
  private read(p: string): string | null {
    try { this.assertRegular(p); } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw e;
    }
    return readFileSync(p, 'utf8');
  }
  private parse(raw: string): State {
    const s = JSON.parse(raw);
    if (!s || Object.keys(s).sort().join() !== 'preferences,version' || !s.preferences || typeof s.preferences !== 'object' || Array.isArray(s.preferences) ||
      typeof s.preferences.overviewShortcutEnabled !== 'boolean') throw new StateRecoveryError();
    const preferenceKeys = Object.keys(s.preferences).sort().join();
    const versionOne = s.version === 1 && preferenceKeys === 'overviewShortcutEnabled';
    const versionTwo = s.version === 2 && preferenceKeys === 'favoriteAppIds,overviewShortcutEnabled' && validFavoriteIds(s.preferences.favoriteAppIds);
    if (!versionOne && !versionTwo) throw new StateRecoveryError();
    return s;
  }
  private atomic(p: string, text: string) {
    if (Buffer.byteLength(text) > LIMIT || this.host.availableBytes(this.root) < 1024 * 1024) throw new StateRecoveryError();
    const tmp = path.join(this.root, `.write-${randomUUID()}`);
    let fd: number | undefined;
    try {
      fd = openSync(tmp, 'wx', 0o600); writeFileSync(fd, text); fsyncSync(fd); closeSync(fd); fd = undefined;
      renameSync(tmp, p);
      if (this.host.privateModes) { const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } }
    } finally { if (fd !== undefined) closeSync(fd); if (existsSync(tmp)) unlinkSync(tmp); }
  }
  private recover() {
    const raw = this.read(this.journal); if (raw === null) return;
    const j = JSON.parse(raw);
    if (!j || Object.keys(j).sort().join() !== 'from,next' || !(j.from === null || /^[a-f0-9]{64}$/.test(j.from)) || typeof j.next !== 'string') throw new StateRecoveryError();
    this.parse(j.next);
    const current = this.read(this.file);
    if (current !== j.next) {
      if (hash(current) !== j.from) throw new StateRecoveryError();
      this.atomic(this.file, j.next);
    }
    unlinkSync(this.journal);
  }
  private commit(state: State) {
    const next = JSON.stringify(state); const current = this.read(this.file);
    this.atomic(this.journal, JSON.stringify({ from: hash(current), next })); this.checkpoint('journal');
    this.atomic(this.file, next); this.checkpoint('state'); unlinkSync(this.journal);
  }
  load(): Preferences {
    try {
      this.recover(); const raw = this.read(this.file);
      if (raw === null) { this.commit({ version: 1, preferences: { overviewShortcutEnabled: true } }); return { overviewShortcutEnabled: true }; }
      const s = JSON.parse(raw);
      if (s?.version === 0 && Object.keys(s).sort().join() === 'overviewShortcutEnabled,version' && typeof s.overviewShortcutEnabled === 'boolean') {
        const preferences = { overviewShortcutEnabled: s.overviewShortcutEnabled };
        this.commit({ version: 1, preferences }); return preferences;
      }
      return { ...this.parse(raw).preferences };
    } catch { throw new StateRecoveryError(); }
  }
  update(input: unknown): Preferences {
    const requested = this.parse(JSON.stringify({ version: 1, preferences: input }));
    const current = this.load();
    const state = Array.isArray(current.favoriteAppIds)
      ? this.parse(JSON.stringify({ version: 2, preferences: { ...current, ...requested.preferences } }))
      : requested;
    this.commit(state); return { ...state.preferences };
  }
}
