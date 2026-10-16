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
 private file(name = 'freshness.json', max = 2048) { this.directory(); const p = path.join(this.root, name); try { const s = lstatSync(p); if (!s.isFile() || s.isSymbolicLink() || s.nlink !== 1 || s.size > max) throw new Error('Unsafe catalogue state'); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } return p; }
 load(name = 'freshness.json'): Watermark {
  const p = this.file(name); let text: string; try { text = readFileSync(p, 'utf8'); } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { ...noWatermark }; throw e; }
  const v = JSON.parse(text);
  if (!v || Object.keys(v).sort().join() !== 'digest,observedAt,sequence' || !Number.isSafeInteger(v.sequence) || v.sequence < 1 || !/^[a-f0-9]{64}$/.test(v.digest) || !Number.isSafeInteger(v.observedAt) || v.observedAt < 1) throw new Error('Catalogue recovery required'); return v;
 }
 save(value: Watermark, name = 'freshness.json') { this.write(name,JSON.stringify(value),2048); }
 loadUpdate() { return this.load('update-freshness.json'); }
 saveUpdate(value:Watermark) { this.save(value,'update-freshness.json'); }
 loadMetadata(): { catalogue: string; policy: string } | undefined {
  const p=this.file('metadata.json',200000);let text:string;try{text=readFileSync(p,'utf8');}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return;throw e;}
  const value=JSON.parse(text);if(!value||Object.keys(value).sort().join()!=='catalogue,policy'||typeof value.catalogue!=='string'||typeof value.policy!=='string')throw Error('Metadata recovery required');return value;
 }
 saveMetadata(value:{catalogue:string;policy:string}) { this.write('metadata.json',JSON.stringify(value),200000); }
 private write(name:string, data:string,max:number) {
  if(Buffer.byteLength(data)>max)throw Error('Metadata size');
  const destination = this.file(name,max), temp = path.join(this.root, `.write-${randomUUID()}`); let fd: number | undefined;
  try { fd = openSync(temp, 'wx', 0o600); writeFileSync(fd, data); fsyncSync(fd); closeSync(fd); fd = undefined; renameSync(temp, destination); if (process.platform !== 'win32') { const dir = openSync(this.root, 'r'); try { fsyncSync(dir); } finally { closeSync(dir); } } }
  finally { if (fd !== undefined) closeSync(fd); try { unlinkSync(temp); } catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e; } }
 }
}
