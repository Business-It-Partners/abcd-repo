/** Opaque receipts for individually selected device files; no directory browser is exposed. */
import { randomUUID } from 'node:crypto';
import { lstatSync, realpathSync, type Stats } from 'node:fs';
import path from 'node:path';

export type FilesErrorCode = 'INVALID_REQUEST'|'FORBIDDEN'|'NOT_FOUND'|'STALE_SELECTION'|'RESOURCE_LIMIT'|'IO_ERROR';
export class LocalFilesError extends Error {
  readonly code: FilesErrorCode;
  constructor(code: FilesErrorCode) { super(code); this.code=code; this.name='LocalFilesError'; }
}
export type FileFilter = 'images'|'medical-images'|'documents'|'all';
export type FileRecipient = {
  sender: object; frame: object; appId: string; appVersion: string;
  windowId: string; generation: number; requestId: string;
  authorized(): boolean;
};
export type FileReceipt = { receiptId: string; name: string; sizeBytes: number; modifiedAt: number|null; typeHint: string };
export type FileSelection = { selectionId: string; files: FileReceipt[]; expiresAt: number };
type StoredFile = { absolute: string; root: string; fingerprint: string; receipt: FileReceipt };
type Lease = { owner: FileRecipient; files: Map<string,StoredFile>; expiresAt: number };

const MAX_LEASES=64, MAX_FILES=10, TTL=600000;
const typeHint=(name:string)=>path.extname(name).toLowerCase().slice(0,24);
const within=(root:string,target:string)=>{const relative=path.relative(root,target);return relative===''||(relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative));};
const cleanPath=(value:string)=>process.platform==='win32'?path.normalize(value).toLowerCase():path.normalize(value);
function fingerprint(stat:Stats):string {
  return [stat.dev,stat.ino,stat.size,stat.mtimeMs,stat.ctimeMs,stat.birthtimeMs].join(':');
}
function check(fullPath:string,root:string):Stats {
  if(!path.isAbsolute(fullPath)||!path.isAbsolute(root)||!within(root,fullPath))throw new LocalFilesError('FORBIDDEN');
  const resolved=path.resolve(fullPath),drive=path.parse(resolved).root;
  let cursor=drive;
  for(const component of resolved.slice(drive.length).split(path.sep).filter(Boolean)){
    cursor=path.join(cursor,component);
    const stat=lstatSync(cursor);
    if(stat.isSymbolicLink()||(cursor!==resolved&&!stat.isDirectory()))throw new LocalFilesError('FORBIDDEN');
  }
  const real=realpathSync.native(resolved),canonicalRoot=realpathSync.native(root);
  if(process.platform==='win32'
    ? !within(canonicalRoot,real)
    : cleanPath(real)!==cleanPath(resolved)||!within(root,real))throw new LocalFilesError('FORBIDDEN');
  const stat=lstatSync(resolved);
  if(stat.isSymbolicLink()||!stat.isFile())throw new LocalFilesError('FORBIDDEN');
  return stat;
}
function allowed(name:string,filter:FileFilter){
  const extension=typeHint(name);
  if(filter==='all')return true;
  const images=['.png','.jpg','.jpeg','.webp','.bmp','.gif','.tif','.tiff'];
  if(filter==='images')return images.includes(extension);
  if(filter==='medical-images')return images.includes(extension)||extension==='.dcm'||extension==='.dicom';
  return ['.pdf','.txt','.csv','.doc','.docx','.xls','.xlsx'].includes(extension);
}
function ownerOK(owner:FileRecipient){
  if(!owner||!owner.sender||!owner.frame||typeof owner.appId!=='string'||!owner.appId.startsWith('company.')
    ||typeof owner.appVersion!=='string'||typeof owner.windowId!=='string'||typeof owner.requestId!=='string'
    ||!Number.isSafeInteger(owner.generation)||owner.generation<1||typeof owner.authorized!=='function')return false;
  try{return owner.authorized()===true;}catch{return false;}
}
function same(a:FileRecipient,b:FileRecipient){
  return a.sender===b.sender&&a.frame===b.frame&&a.appId===b.appId&&a.appVersion===b.appVersion
    &&a.windowId===b.windowId&&a.generation===b.generation&&a.requestId===b.requestId;
}

/** Trusted main-process receipt store. Paths are accepted only from Electron's native chooser. */
export class LocalFileService {
  private leases=new Map<string,Lease>();
  private disposed=false;

  constructor(private now:()=>number=Date.now){}

  private ready(){if(this.disposed)throw new LocalFilesError('FORBIDDEN');}
  private err(error:unknown):LocalFilesError{
    if(error instanceof LocalFilesError)return error;
    const code=(error as NodeJS.ErrnoException)?.code;
    return new LocalFilesError(code==='ENOENT'||code==='ENOTDIR'?'NOT_FOUND':code==='EPERM'||code==='EACCES'||code==='ELOOP'?'FORBIDDEN':'IO_ERROR');
  }
  private sweep(){for(const [id,lease] of this.leases)if(this.now()>=lease.expiresAt)this.leases.delete(id);}

  /** Trusted main invokes this only after the user chooses files in the OS-native dialog. */
  selectNativePaths(paths:readonly string[],owner:FileRecipient,filter:FileFilter='all'):FileSelection{
    this.ready();this.sweep();
    if(!ownerOK(owner))throw new LocalFilesError('FORBIDDEN');
    if(!Array.isArray(paths)||paths.length<1||paths.length>MAX_FILES||new Set(paths).size!==paths.length
      ||paths.some(value=>typeof value!=='string'||!path.isAbsolute(value))
      ||!['images','medical-images','documents','all'].includes(filter))throw new LocalFilesError('INVALID_REQUEST');
    if(this.leases.size>=MAX_LEASES)throw new LocalFilesError('RESOURCE_LIMIT');

    const files=new Map<string,StoredFile>();
    for(const selectedPath of paths){
      const absolute=path.resolve(selectedPath),root=path.dirname(absolute),name=path.basename(absolute);
      let stat:Stats;
      try{stat=check(absolute,root);}catch(error){throw this.err(error);}
      if(!allowed(name,filter)||!Number.isSafeInteger(stat.size)||stat.size<0)throw new LocalFilesError('FORBIDDEN');
      const receiptId=randomUUID();
      files.set(receiptId,{absolute,root,fingerprint:fingerprint(stat),receipt:{receiptId,name,sizeBytes:stat.size,
        modifiedAt:Number.isFinite(stat.mtimeMs)?stat.mtimeMs:null,typeHint:typeHint(name)}});
    }
    if(!ownerOK(owner))throw new LocalFilesError('FORBIDDEN');
    const selectionId=randomUUID(),expiresAt=this.now()+TTL;
    this.leases.set(selectionId,{owner:{...owner},files,expiresAt});
    return {selectionId,files:[...files.values()].map(file=>({...file.receipt})),expiresAt};
  }

  inspect(selectionId:string,receiptId:string,owner:FileRecipient):FileReceipt{
    this.ready();
    if(!/^[0-9a-f-]{36}$/i.test(selectionId)||!/^[0-9a-f-]{36}$/i.test(receiptId))throw new LocalFilesError('INVALID_REQUEST');
    const lease=this.leases.get(selectionId);
    if(!lease)throw new LocalFilesError('STALE_SELECTION');
    if(this.now()>=lease.expiresAt){this.leases.delete(selectionId);throw new LocalFilesError('STALE_SELECTION');}
    if(!ownerOK(lease.owner)||!ownerOK(owner)||!same(lease.owner,owner))throw new LocalFilesError('FORBIDDEN');
    const file=lease.files.get(receiptId);
    if(!file)throw new LocalFilesError('FORBIDDEN');
    let stat:Stats;
    try{stat=check(file.absolute,file.root);}catch(error){throw this.err(error);}
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
    this.ready();for(const [id,lease] of this.leases)if(lease.owner.generation!==current)this.leases.delete(id);
  }
  dispose(){this.leases.clear();this.disposed=true;}
}
