import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { FilesApp } from './FilesApp';
import type { FilePickerPrompt, FilePickerResponse } from '../electron/host/filePickerContract';

export function FilesPickerModal({prompt,onReply}:{
  prompt:FilePickerPrompt;
  onReply:(response:FilePickerResponse)=>Promise<boolean>;
}){
  const shell=useRef<HTMLDivElement>(null);
  const [submitting,setSubmitting]=useState(false);
  const respond=async(action:FilePickerResponse['action'],fileIds?:string[])=>{
    if(submitting)return;
    setSubmitting(true);
    try{
      const body={requestId:prompt.requestId,generation:prompt.generation,action,
        ...(action==='choose'?{fileIds:fileIds??[]}:{})} as FilePickerResponse;
      const accepted=await onReply(body);
      if(!accepted)setSubmitting(false);
    }catch{setSubmitting(false);}
  };
  useEffect(()=>{shell.current?.querySelector<HTMLButtonElement>('button')?.focus({preventScroll:true});},[prompt.requestId]);
  function trap(event:KeyboardEvent<HTMLElement>){
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();void respond('cancel');return;}
    if(event.key!=='Tab')return;
    const elements=Array.from(shell.current?.querySelectorAll<HTMLElement>('button:not(:disabled),[tabindex="0"]:not([inert]),select:not(:disabled)')??[]);
    if(!elements.length)return;
    const active=document.activeElement as HTMLElement;
    if(event.shiftKey&&active===elements[0]){event.preventDefault();elements.at(-1)?.focus();}
    else if(!event.shiftKey&&active===elements.at(-1)){event.preventDefault();elements[0].focus();}
  }
  return <div className="files-picker-shade" role="presentation">
    <div className="files-picker-dialog" role="dialog" aria-modal="true" aria-labelledby="files-picker-title"
      data-testid="files-picker-dialog" ref={shell} onKeyDown={trap}>
      <header className="files-picker-top"><div><h2 id="files-picker-title">Choose local files</h2>
        <p>{prompt.appTitle} requested {prompt.maxSelections===1?'a local file':'up to '+prompt.maxSelections+' local files'}. Nothing will be uploaded.</p></div>
        <button type="button" disabled={submitting} aria-label="Cancel file selection" onClick={()=>void respond('cancel')}>×</button>
      </header>
      <FilesApp visible picker={{
        fileTypes:prompt.fileTypes,maxSelections:prompt.maxSelections,
        onChoose:ids=>void respond('choose',ids),
        onNative:()=>void respond('native'),
        onCancel:()=>void respond('cancel'),
      }}/>
      {submitting&&<div className="files-picker-pending" role="status">Checking file selection…</div>}
    </div>
  </div>;
}
