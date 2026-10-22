/** M16.5: one recipient, one user-approved Files selection; trusted Electron main only. */
import { randomUUID } from 'node:crypto';
import { LocalFileService, type FileRecipient, type FileSelection } from './localFiles';

export type ShellTransferRequest = Readonly<{generation:number;fileIds:string[]}>;
export type TransferNotice = Readonly<{transferId:string;selection:FileSelection}>;
const uuid=(x:unknown):x is string=>typeof x==='string'&&/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x);
export function parseShellTransfer(x:unknown):ShellTransferRequest|null{
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='fileIds,generation')return null;
  const v=x as Record<string,unknown>;
  if(!Number.isSafeInteger(v.generation)||(v.generation as number)<1||!Array.isArray(v.fileIds)||
    v.fileIds.length<1||v.fileIds.length>10||!v.fileIds.every(uuid)||new Set(v.fileIds).size!==v.fileIds.length)return null;
  return {generation:v.generation as number,fileIds:v.fileIds as string[]};
}
export function validTransferNotice(x:unknown):x is TransferNotice{
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).sort().join()!=='selection,transferId')return false;
  const v=x as Record<string,unknown>,s=v.selection as Record<string,unknown>|null;
  return uuid(v.transferId)&&!!s&&typeof s==='object'&&!Array.isArray(s)&&Object.keys(s).sort().join()==='expiresAt,files,selectionId'&&
    uuid(s.selectionId)&&Number.isSafeInteger(s.expiresAt)&&(s.expiresAt as number)>0&&
    Array.isArray(s.files)&&s.files.length>=1&&s.files.length<=10&&s.files.every(f=>{
      if(!f||typeof f!=='object'||Array.isArray(f)||Object.keys(f).sort().join()!=='modifiedAt,name,receiptId,sizeBytes,typeHint')return false;
      const r=f as Record<string,unknown>;
      return uuid(r.receiptId)&&typeof r.name==='string'&&r.name.length>0&&r.name.length<=255&&
        !/[\u0000-\u001f\u007f]/.test(r.name)&&Number.isSafeInteger(r.sizeBytes)&&(r.sizeBytes as number)>=0&&
        (r.modifiedAt===null||typeof r.modifiedAt==='number'&&Number.isFinite(r.modifiedAt))&&
        typeof r.typeHint==='string'&&r.typeHint.length<=24&&/^\.[a-z0-9]{1,23}$|^$/.test(r.typeHint);
    });
}
export class FileTransferError extends Error {
  constructor(readonly code:'FORBIDDEN'|'BUSY'|'CANCELLED'|'UNAVAILABLE'|'STALE_SELECTION'){
    super(code);this.name='FileTransferError';
  }
}
type Pending={
  transferId:string;owner:FileRecipient;selection:FileSelection;
  resolve:(value:FileSelection)=>void;reject:(error:FileTransferError)=>void;timer:ReturnType<typeof setTimeout>;
};
export class FileTransferCoordinator {
  private pending?:Pending;
  constructor(private files:LocalFileService,private timeoutMs=4000){}
  get busy(){return !!this.pending;}
  send(ids:readonly string[],owner:FileRecipient,deliver:(notice:TransferNotice)=>void):Promise<FileSelection>{
    if(this.pending)throw new FileTransferError('BUSY');
    if(owner.authorized()!==true)throw new FileTransferError('FORBIDDEN');
    const selection=this.files.select(ids,owner,'all');
    const transferId=randomUUID();
    return new Promise<FileSelection>((resolve,reject)=>{
      const timer=setTimeout(()=>this.cancel('UNAVAILABLE'),this.timeoutMs);
      const pending:Pending={transferId,selection,owner,resolve,reject,timer};
      this.pending=pending;
      try{
        if(owner.authorized()!==true)throw new FileTransferError('FORBIDDEN');
        deliver({transferId,selection});
      }catch{
        this.cancel('UNAVAILABLE');
      }
    });
  }
  acknowledge(sender:object,frame:object|null,transferId:unknown,accepted:unknown):boolean{
    const p=this.pending;
    if(!p||p.owner.sender!==sender||p.owner.frame!==frame||p.transferId!==transferId||typeof accepted!=='boolean')return false;
    if(!accepted){this.cancel('CANCELLED');return true;}
    try{
      if(!p.owner.authorized())throw new Error('Revoked');
      for(const f of p.selection.files)this.files.inspect(p.selection.selectionId,f.receiptId,p.owner);
    }catch{this.cancel('STALE_SELECTION');return false;}
    this.pending=undefined;clearTimeout(p.timer);p.resolve(p.selection);return true;
  }
  cancel(code:'CANCELLED'|'UNAVAILABLE'|'FORBIDDEN'|'STALE_SELECTION'='CANCELLED'){
    const p=this.pending;if(!p)return;
    this.pending=undefined;clearTimeout(p.timer);
    try{this.files.cancel(p.selection.selectionId,p.owner);}catch{/* revoke below on recipient lifecycle */}
    p.reject(new FileTransferError(code));
  }
  cancelRecipient(sender:object){if(this.pending?.owner.sender===sender)this.cancel('CANCELLED');}
}
