import { mkdirSync, lstatSync, readFileSync, openSync, writeFileSync, fsyncSync, closeSync, renameSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { noWatermark, type Watermark } from './catalogue';
/** OS-only replay watermark. Never caches catalogue credentials/patient data. */
export class CatalogueStore {
 constructor(private root: string) {
  try { mkdirSync(root, { mode: 0o700 }); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e; }
  this.directory();
 }
 private directory() { const s = lstatSync(this.root); if (!s.isDirectory() || s.isSymbolicLink()) throw new Error('Unsafe catalogue state'); }
 private file() { this.directory(); const p = path.join(this.root, 'freshness.json'); try { const s = lstatSync(p); if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.size > 2048) throw new Error('Unsafe catalogue state'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } return p; }
 load(): Watermark {
  const p = this.file(); let text: string; try { text = readFileSync(p, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ...noWatermark }; throw e; }
  const v = JSON.parse(text);
  if (!v || Object.keys(v).sort().join() !== 'digest,observedAt,sequence' || !Number.isSafeInteger(v.sequence) || v.sequence < 1 || !/^[a-f0-9]{64}$/.test(v.digest) || !Number.isSafeInteger(v.observedAt) || v.observedAt < 1) throw new Error('Catalogue recovery required'); return v;
 }
 save(value: Watermark) {
  const destination = this.file(), temp = path.join(this.root, `.write-${randomUUID()}`); let fd: number | undefined;
  try { fd = openSync(temp, 'wx', 0o600); writeFileSync(fd, JSON.stringify(value)); fsyncSync(fd); closeSync(fd); fd = undefined; renameSync(temp, destination); if (process.platform !== 'win32') { const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } } }
  finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
 }
}
