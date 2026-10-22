/** Trusted main-process selector. UI is shell owned, results are opaque and recipient bound. */
import { randomUUID } from 'node:crypto';
import type { BrowserWindow } from 'electron';
import { dialog } from 'electron';
import { LocalFileService, LocalFilesError, type FileRecipient, type FileSelection } from './localFiles';
import { validPickerResponse, type FilePickerResponse, type FilePickInput, type FilePickerPrompt } from './filePickerContract';

type Pending = {
  prompt: FilePickerPrompt; owner: FileRecipient; signal: AbortSignal;
  resolve(value: FileSelection):void; reject(reason: Error):void; abort():void;
};
export class FilePickerCancelled extends Error {
  constructor(readonly code:'CANCELLED'|'FORBIDDEN'|'BUSY'|'UNAVAILABLE'='CANCELLED'){super(code);}
}
export class FilePickerCoordinator {
  private pending?: Pending;
  private nativeOpen=false;
  constructor(private win: BrowserWindow, private files: LocalFileService, private generation:()=>number, private active:()=>boolean){}
  async pick(input:FilePickInput, owner:FileRecipient, appTitle:string,signal:AbortSignal):Promise<FileSelection>{
    if(this.pending || this.nativeOpen)throw new FilePickerCancelled('BUSY');
    if(signal.aborted)throw new FilePickerCancelled();
    if(!this.active() || this.generation()!==owner.generation || owner.authorized()!==true)
      throw new FilePickerCancelled('FORBIDDEN');
    const prompt:FilePickerPrompt={...input,appTitle:appTitle.slice(0,80),generation:owner.generation,requestId:randomUUID()};
    return new Promise<FileSelection>((resolve,reject)=>{
      const pending:Pending={prompt,owner,signal,resolve,reject,abort:()=>this.finish(pending,new FilePickerCancelled())};
      this.pending=pending;signal.addEventListener('abort',pending.abort,{once:true});
      try {
        if(this.win.isDestroyed())throw new FilePickerCancelled('UNAVAILABLE');
        this.win.webContents.send('files:picker-open',prompt);
      }catch {this.finish(pending,new FilePickerCancelled('UNAVAILABLE'));}
    });
  }
  private finish(pending:Pending,error?:Error,result?:FileSelection){
    if(this.pending!==pending)return;
    this.pending=undefined;
    pending.signal.removeEventListener('abort',pending.abort);
    if(!this.win.isDestroyed())this.win.webContents.send('files:picker-close',pending.prompt.requestId);
    if(error)pending.reject(error);
    else if(result)pending.resolve(result);
    else pending.reject(new FilePickerCancelled('UNAVAILABLE'));
  }
  private authorized(p:Pending):boolean{
    try{return this.pending===p && !p.signal.aborted && this.active() &&
      this.generation()===p.owner.generation && p.owner.authorized()===true;}catch{return false;}
  }
  async respond(response:unknown):Promise<boolean>{
    if(!validPickerResponse(response))return false;
    if(this.nativeOpen)return false;
    const p=this.pending;
    if(!p || p.prompt.requestId!==response.requestId || p.prompt.generation!==response.generation)return false;
    if(!this.authorized(p)){this.finish(p,new FilePickerCancelled('FORBIDDEN'));return false;}
    if(response.action==='cancel'){this.finish(p,new FilePickerCancelled());return true;}
    if(response.action==='choose'){
      if(response.fileIds.length>p.prompt.maxSelections)return false;
      try{
        const receipt=this.files.select(response.fileIds,p.owner,p.prompt.fileTypes);
        if(!this.authorized(p)){this.files.cancel(receipt.selectionId,p.owner);this.finish(p,new FilePickerCancelled('FORBIDDEN'));return false;}
        this.finish(p,undefined,receipt);return true;
      }catch(error){if(error instanceof LocalFilesError)return false;this.finish(p,new FilePickerCancelled('UNAVAILABLE'));return false;}
    }
    if(this.nativeOpen)return false;
    this.nativeOpen=true;
    try{
      // This is user-approved native selection, parented to the actual fullscreen OS.
      const selected=await dialog.showOpenDialog(this.win,{
        title:'Choose local files for Dental OS',
        buttonLabel:'Choose',
        properties:p.prompt.maxSelections>1?['openFile','multiSelections']:['openFile'],
        filters:p.prompt.fileTypes==='all'?[]:p.prompt.fileTypes==='documents'
          ?[{name:'Documents',extensions:['pdf','txt','csv','doc','docx','xls','xlsx']}]
          :[{name:'Medical images',extensions:p.prompt.fileTypes==='images'
            ?['png','jpg','jpeg','webp','gif','bmp','tif','tiff']
            :['png','jpg','jpeg','webp','gif','bmp','tif','tiff','dcm','dicom']}],
      });
      if(!this.authorized(p))return false;
      if(selected.canceled || selected.filePaths.length===0){this.finish(p,new FilePickerCancelled());return true;}
      if(selected.filePaths.length>p.prompt.maxSelections){this.finish(p,new FilePickerCancelled('FORBIDDEN'));return false;}
      const receipt=this.files.selectNativePaths(selected.filePaths,p.owner,p.prompt.fileTypes);
      if(!this.authorized(p)){this.files.cancel(receipt.selectionId,p.owner);return false;}
      this.finish(p,undefined,receipt);return true;
    }catch{
      if(this.pending===p)this.finish(p,new FilePickerCancelled('UNAVAILABLE'));
      return false;
    }finally{this.nativeOpen=false;}
  }
  cancelAll(){if(this.pending)this.finish(this.pending,new FilePickerCancelled());}
  cancelRecipient(sender:object){
    if(this.pending?.owner.sender===sender)this.cancelAll();
    this.files.revokeRecipient(sender);
  }
}
