// M16.2 read-only local filesystem adapter. Trusted Electron main only, never renderer IPC.
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, constants as fsConstants, fstatSync, lstatSync, openSync, opendirSync, readSync, realpathSync, type Stats } from 'node:fs';
import path from 'node:path';
import { homedir } from 'node:os';

export type FilesErrorCode = 'INVALID_REQUEST'|'FORBIDDEN'|'NOT_FOUND'|'STALE_SELECTION'|'RESOURCE_LIMIT'|'IO_ERROR';
export class LocalFilesError extends Error {
  readonly code: FilesErrorCode;
  constructor(code: FilesErrorCode) { super(code); this.code=code; this.name='LocalFilesError'; }
}
export type RootLocation = { label: string; path: string; kind?: 'home'|'folder'|'volume' };
export type FileRoot = { id: string; label: string; kind: 'home'|'folder'|'volume' };
export type FileEntry = { id: string; name: string; kind: 'directory'|'file'; sizeBytes: number|null; modifiedAt: number|null; typeHint: string };
export type FilePage = { directoryId: string; entries: FileEntry[]; nextCursor: string|null };
export type FilePreviewData = { bytes: Uint8Array; typeHint: string };
export type FileFilter = 'images'|'medical-images'|'documents'|'all';
export type FileRecipient = {
  sender: object; frame: object; appId: string; appVersion: string;
  windowId: string; generation: number; requestId: string;
  authorized(): boolean;
};
export type FileReceipt = { receiptId: string; name: string; sizeBytes: number; modifiedAt: number|null; typeHint: string };
export type FileSelection = { selectionId: string; files: FileReceipt[]; expiresAt: number };
type EntryRef = { absolute: string; root: string; kind: 'directory'|'file'; fingerprint?: string };
type StoredRoot = Omit<EntryRef,'kind'> & FileRoot;
type Cursor = { directoryId: string; offset: number; fingerprint: string };
type StoredFile = EntryRef & { fingerprint: string; receipt: FileReceipt };
type Lease = { owner: FileRecipient; files: Map<string,StoredFile>; expiresAt: number };
const MAX_PAGE=200, MAX_SCAN=2048, MAX_HANDLES=4096, MAX_CURSORS=128, MAX_LEASES=64, MAX_FILES=10, TTL=600000;
const MAX_PREVIEW_BYTES=16*1024*1024;
export const VIEWER_TYPES=new Set(['.png','.jpg','.jpeg','.webp','.gif','.bmp']);
const PREVIEW_TYPES=VIEWER_TYPES;
const MAX_VIEWER_ITEMS=2048;
const isId=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f-]{36}$/i.test(x);
const typeHint=(x:string)=>path.extname(x).toLowerCase().slice(0,24);
const validName=(s:string)=>s.length>0&&s!=='.'&&s!=='..'&&!/[\u0000-\u001f\u007f]/.test(s);
const within=(root:string,target:string)=>{const r=path.relative(root,target);return r===''||(r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r));};
const cleanPath=(p:string)=>process.platform==='win32'?path.normalize(p).toLowerCase():path.normalize(p);
function fingerprint(s:Stats):string {
  return [s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs,s.birthtimeMs].join(':');
}
function check(full:string,root:string,kind:'directory'|'file'):Stats {
  if(!path.isAbsolute(full)||!path.isAbsolute(root)||!within(root,full))throw new LocalFilesError('FORBIDDEN');
  const resolved=path.resolve(full),drive=path.parse(resolved).root;
  let cursor=drive;
  for(const component of resolved.slice(drive.length).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,component);
    const s=lstatSync(cursor);
    if(s.isSymbolicLink()||(cursor!==resolved&&!s.isDirectory()))throw new LocalFilesError('FORBIDDEN');
  }
  const real=realpathSync.native(resolved);
  // Windows native realpath may use device/alias spelling different from the
  // caller's absolute spelling. All original path components were checked
  // with lstat above; require actual membership in the canonical trusted root.
  const canonicalRoot=realpathSync.native(root);
  if(process.platform==='win32'
    ? !within(canonicalRoot,real)
    : cleanPath(real)!==cleanPath(resolved)||!within(root,real))throw new LocalFilesError('FORBIDDEN');
  const s=lstatSync(resolved);
  if(s.isSymbolicLink()||!(kind==='file'?s.isFile():s.isDirectory()))throw new LocalFilesError('FORBIDDEN');
  return s;
}
function defaults():RootLocation[]{
  const home=path.resolve(homedir());
  const locations:RootLocation[]=[{label:'Home',path:home,kind:'home'}];
  for(const name of ['Desktop','Documents','Downloads','Pictures'])
    locations.push({label:name,path:path.join(home,name),kind:'folder'});
  if(process.platform==='win32'){
    const volumes=new Set([path.parse(home).root,process.env.SystemDrive?process.env.SystemDrive+path.sep:'']);
    for(const volume of volumes)if(volume)locations.push({label:'Local drive '+volume,path:volume,kind:'volume'});
  }
  return locations;
}
function allowed(name:string,filter:FileFilter){
  const ext=typeHint(name);
  if(filter==='all')return true;
  const images=['.png','.jpg','.jpeg','.webp','.bmp','.gif','.tif','.tiff'];
  if(filter==='images')return images.includes(ext);
  if(filter==='medical-images')return images.includes(ext)||ext==='.dcm'||ext==='.dicom';
  return ['.pdf','.txt','.csv','.doc','.docx','.xls','.xlsx'].includes(ext);
}
function same(a:FileRecipient,b:FileRecipient){
  return a.sender===b.sender&&a.frame===b.frame&&a.appId===b.appId&&a.appVersion===b.appVersion
    &&a.windowId===b.windowId&&a.generation===b.generation&&a.requestId===b.requestId;
}
function ownerOK(o:FileRecipient){
  if(!o||!o.sender||!o.frame||typeof o.appId!=='string'||!o.appId.startsWith('company.')
    ||typeof o.appVersion!=='string'||typeof o.windowId!=='string'||typeof o.requestId!=='string'
    ||!Number.isSafeInteger(o.generation)||o.generation<1||typeof o.authorized!=='function')return false;
  try{return o.authorized()===true;}catch{return false;}
}
export class LocalFileService {
  private rootsById=new Map<string,StoredRoot>();
  private handles=new Map<string,EntryRef>();
  private cursors=new Map<string,Cursor>();
  private leases=new Map<string,Lease>();
  private disposed=false;
  constructor(locations:readonly RootLocation[]=defaults(),private now:()=>number=Date.now){
    for(const item of locations.slice(0,32)){
      try{
        const full=path.resolve(item.path);
        check(full,full,'directory');
        if(!validName(item.label)||item.label.length>80)continue;
        if([...this.rootsById.values()].some(v=>cleanPath(v.absolute)===cleanPath(full)))continue;
        const entry:StoredRoot={id:randomUUID(),label:item.label,kind:item.kind??'folder',absolute:full,root:full};
        this.rootsById.set(entry.id,entry);
        this.handles.set(entry.id,{absolute:full,root:full,kind:'directory'});
      }catch{}
    }
  }
  private ready(){if(this.disposed)throw new LocalFilesError('FORBIDDEN');}
  private err(e:unknown):LocalFilesError{
    if(e instanceof LocalFilesError)return e;
    const c=(e as NodeJS.ErrnoException)?.code;
    return new LocalFilesError(c==='ENOENT'||c==='ENOTDIR'?'NOT_FOUND':c==='EPERM'||c==='EACCES'||c==='ELOOP'?'FORBIDDEN':'IO_ERROR');
  }
  roots():FileRoot[]{
    this.ready();
    const out:FileRoot[]=[];
    for(const r of this.rootsById.values()){
      try{check(r.absolute,r.root,'directory');out.push({id:r.id,label:r.label,kind:r.kind});}catch{}
    }
    return out;
  }
  private handle(id:string,kind:'directory'|'file'):EntryRef{
    if(!isId(id))throw new LocalFilesError('INVALID_REQUEST');
    const h=this.handles.get(id);
    if(!h||h.kind!==kind)throw new LocalFilesError('NOT_FOUND');
    return h;
  }
  private put(entry:EntryRef){
    const id=randomUUID();this.handles.set(id,entry);
    while(this.handles.size>MAX_HANDLES+this.rootsById.size){
      const candidate=[...this.handles.keys()].find(x=>!this.rootsById.has(x));
      if(!candidate)break;
      this.handles.delete(candidate);
    }
    return id;
  }
  list(directoryId:string,cursor:string|null=null,limit=MAX_PAGE):FilePage{
    this.ready();
    if(!Number.isSafeInteger(limit)||limit<1||limit>MAX_PAGE||!(cursor===null||isId(cursor)))
      throw new LocalFilesError('INVALID_REQUEST');
    const h=this.handle(directoryId,'directory');
    try{
      const before=fingerprint(check(h.absolute,h.root,'directory'));
      let saved:Cursor|undefined,offset=0;
      if(cursor){
        saved=this.cursors.get(cursor);this.cursors.delete(cursor);
        if(!saved||saved.directoryId!==directoryId)throw new LocalFilesError('STALE_SELECTION');
        offset=saved.offset;
      }
      const dir=opendirSync(h.absolute),names:string[]=[];
      try{
        let item;
        while((item=dir.readSync())!==null){
          if(names.length>=MAX_SCAN)throw new LocalFilesError('RESOURCE_LIMIT');
          // Match the ordinary Finder view: Unix-style dotfiles and hidden
          // folders stay out of the user's everyday browser listing.
          if(validName(item.name)&&!item.name.startsWith('.'))names.push(item.name);
        }
      }finally{dir.closeSync();}
      const after=fingerprint(check(h.absolute,h.root,'directory'));
      names.sort((a,b)=>a<b?-1:a>b?1:0);
      const fp=after+':'+createHash('sha256').update(JSON.stringify(names)).digest('hex');
      if(saved&&saved.fingerprint!==fp)throw new LocalFilesError('STALE_SELECTION');
      if(before!==after)throw new LocalFilesError('STALE_SELECTION');
      const entries:FileEntry[]=[];
      for(const name of names.slice(offset,offset+limit)){
        const absolute=path.join(h.absolute,name);
        try{
          const st=lstatSync(absolute);
          if(st.isSymbolicLink()||!(st.isFile()||st.isDirectory()))continue;
          const kind=st.isFile()?'file':'directory',safe=check(absolute,h.root,kind);
          entries.push({id:this.put({absolute,root:h.root,kind,fingerprint:fingerprint(safe)}),name,kind,
            sizeBytes:kind==='file'&&Number.isSafeInteger(safe.size)?safe.size:null,
            modifiedAt:Number.isFinite(safe.mtimeMs)?safe.mtimeMs:null,
            typeHint:kind==='file'?typeHint(name):''});
        }catch{}
      }
      const nextCursor=offset+limit<names.length?randomUUID():null;
      if(nextCursor){
        this.cursors.set(nextCursor,{directoryId,offset:offset+limit,fingerprint:fp});
        while(this.cursors.size>MAX_CURSORS)this.cursors.delete(this.cursors.keys().next().value!);
      }
      return {directoryId,entries,nextCursor};
    }catch(e){throw this.err(e);}
  }
  /** Only raster IDs from the same real directory as the loaded Files listing. */
  viewerListing(directoryId:string,ids:readonly string[]):Array<{id:string;name:string}>{
    this.ready();
    if(!Array.isArray(ids)||ids.length<1||ids.length>MAX_VIEWER_ITEMS||new Set(ids).size!==ids.length)
      throw new LocalFilesError('INVALID_REQUEST');
    const directory=this.handle(directoryId,'directory');
    try{
      check(directory.absolute,directory.root,'directory');
      return ids.map(id=>{
        const h=this.handle(id,'file'),name=path.basename(h.absolute);
        if(h.root!==directory.root||path.dirname(h.absolute)!==directory.absolute
          ||name.startsWith('.')||!VIEWER_TYPES.has(typeHint(name)))throw new LocalFilesError('FORBIDDEN');
        const stat=check(h.absolute,h.root,'file');
        if(!h.fingerprint||fingerprint(stat)!==h.fingerprint)throw new LocalFilesError('STALE_SELECTION');
        return {id,name};
      });
    }catch(e){throw this.err(e);}
  }
  /**
   * Trusted-shell-only source bytes for a bounded image preview. This method
   * never returns a path; callers must keep the bytes inside Dental OS and
   * must not forward them to a Dental app. File identity is rechecked around
   * the descriptor read to avoid symlink/replacement races.
   */
  previewBytes(id:string):{bytes:Uint8Array;typeHint:string}|null{
    this.ready();
    const h=this.handle(id,'file'),name=path.basename(h.absolute),ext=typeHint(name);
    if(name.startsWith('.')||!PREVIEW_TYPES.has(ext))return null;
    let fd:number|undefined;
    try{
      const before=check(h.absolute,h.root,'file');
      if(h.fingerprint&&fingerprint(before)!==h.fingerprint)return null;
      if(!Number.isSafeInteger(before.size)||before.size<1||before.size>MAX_PREVIEW_BYTES)return null;
      const flags=fsConstants.O_RDONLY|(fsConstants.O_NOFOLLOW??0);
      fd=openSync(h.absolute,flags);
      const opened=fstatSync(fd);
      if(!opened.isFile()||fingerprint(opened)!==fingerprint(before)
        ||!Number.isSafeInteger(opened.size)||opened.size<1||opened.size>MAX_PREVIEW_BYTES)return null;
      const bytes=new Uint8Array(opened.size);
      let offset=0;
      while(offset<bytes.byteLength){
        const count=readSync(fd,bytes,offset,bytes.byteLength-offset,offset);
        if(count<=0)return null;
        offset+=count;
      }
      const after=fstatSync(fd),current=check(h.absolute,h.root,'file');
      if(fingerprint(after)!==fingerprint(opened)||fingerprint(current)!==fingerprint(opened))return null;
      return {bytes,typeHint:ext};
    }catch(e){
      if(e instanceof LocalFilesError)throw e;
      const code=(e as NodeJS.ErrnoException)?.code;
      if(code==='ELOOP'||code==='ENOENT'||code==='ENOTDIR'||code==='EPERM'||code==='EACCES')return null;
      throw this.err(e);
    }finally{if(fd!==undefined)try{closeSync(fd);}catch{}}
  }
  // Trusted main invokes this only AFTER verified OS-level user consent.
  select(ids:readonly string[],owner:FileRecipient,filter:FileFilter='all'):FileSelection{
    this.ready();this.sweep();
    if(!ownerOK(owner))throw new LocalFilesError('FORBIDDEN');
    if(!Array.isArray(ids)||ids.length<1||ids.length>MAX_FILES||new Set(ids).size!==ids.length
      ||!['images','medical-images','documents','all'].includes(filter))throw new LocalFilesError('INVALID_REQUEST');
    if(this.leases.size>=MAX_LEASES)throw new LocalFilesError('RESOURCE_LIMIT');
    const files=new Map<string,StoredFile>();
    for(const id of ids){
      const h=this.handle(id,'file'),name=path.basename(h.absolute);
      let stat:Stats;
      try{stat=check(h.absolute,h.root,'file');}catch(e){throw this.err(e);}
      if(!allowed(name,filter)||!Number.isSafeInteger(stat.size)||stat.size<0)throw new LocalFilesError('FORBIDDEN');
      const receiptId=randomUUID();
      files.set(receiptId,{...h,fingerprint:fingerprint(stat),receipt:{
        receiptId,name,sizeBytes:stat.size,modifiedAt:Number.isFinite(stat.mtimeMs)?stat.mtimeMs:null,typeHint:typeHint(name)}});
    }
    if(!ownerOK(owner))throw new LocalFilesError('FORBIDDEN');
    const selectionId=randomUUID(),expiresAt=this.now()+TTL;
    this.leases.set(selectionId,{owner:{...owner},files,expiresAt});
    return {selectionId,files:[...files.values()].map(x=>({...x.receipt})),expiresAt};
  }
  /**
   * Trusted main ONLY: call solely with actual paths returned from a user-confirmed,
   * host-parented native picker. Grant individual files, not their parent directories.
   */
  selectNativePaths(paths:readonly string[],owner:FileRecipient,filter:FileFilter='all'):FileSelection{
    this.ready();
    if(!Array.isArray(paths)||paths.length<1||paths.length>MAX_FILES||new Set(paths).size!==paths.length
      ||paths.some(v=>typeof v!=='string'||!path.isAbsolute(v)))throw new LocalFilesError('INVALID_REQUEST');
    const temporary:string[]=[];
    try{
      for(const file of paths){
        const absolute=path.resolve(file),root=path.dirname(absolute);
        try{check(absolute,root,'file');}catch(e){throw this.err(e);}
        const id=randomUUID();
        this.handles.set(id,{absolute,root,kind:'file'});
        temporary.push(id);
      }
      return this.select(temporary,owner,filter);
    }finally{
      for(const id of temporary)this.handles.delete(id);
    }
  }
  inspect(selectionId:string,receiptId:string,owner:FileRecipient):FileReceipt{
    this.ready();
    if(!isId(selectionId)||!isId(receiptId))throw new LocalFilesError('INVALID_REQUEST');
    const lease=this.leases.get(selectionId);
    if(!lease)throw new LocalFilesError('STALE_SELECTION');
    if(this.now()>=lease.expiresAt){this.leases.delete(selectionId);throw new LocalFilesError('STALE_SELECTION');}
    if(!ownerOK(lease.owner)||!ownerOK(owner)||!same(lease.owner,owner))throw new LocalFilesError('FORBIDDEN');
    const file=lease.files.get(receiptId);
    if(!file)throw new LocalFilesError('FORBIDDEN');
    let stat:Stats;
    try{stat=check(file.absolute,file.root,'file');}catch(e){throw this.err(e);}
    if(fingerprint(stat)!==file.fingerprint){this.leases.delete(selectionId);throw new LocalFilesError('STALE_SELECTION');}
    return {...file.receipt};
  }
  cancel(selectionId:string,owner:FileRecipient):void{
    this.ready();const lease=this.leases.get(selectionId);
    if(!lease)return;
    if(!ownerOK(lease.owner)||!ownerOK(owner)||!same(lease.owner,owner))throw new LocalFilesError('FORBIDDEN');
    this.leases.delete(selectionId);
  }
  revokeRecipient(sender:object):void{
    this.ready();for(const [id,lease] of this.leases)if(lease.owner.sender===sender)this.leases.delete(id);
  }
  invalidateGeneration(current:number):void{
    this.ready();
    for(const [id,lease] of this.leases)if(lease.owner.generation!==current)this.leases.delete(id);
    this.cursors.clear();this.handles.clear();
    for(const r of this.rootsById.values())this.handles.set(r.id,{absolute:r.absolute,root:r.root,kind:'directory'});
  }
  sweep(){this.ready();for(const [id,lease] of this.leases)if(this.now()>=lease.expiresAt)this.leases.delete(id);}
  dispose(){this.leases.clear();this.cursors.clear();this.handles.clear();this.rootsById.clear();this.disposed=true;}
}
