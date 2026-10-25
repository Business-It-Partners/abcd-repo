import {ipcRenderer} from 'electron';
// This recovery view gets no workspace, authentication, storage or general IPC bridge.
window.addEventListener('DOMContentLoaded',()=>{
 document.getElementById('show-files')?.addEventListener('click',()=>void ipcRenderer.invoke('support:action','show-files'));
 document.getElementById('export-support')?.addEventListener('click',async()=>{const value=await ipcRenderer.invoke('support:action','view');document.getElementById('support-preview')!.textContent=JSON.stringify(value,null,2);document.getElementById('save-support')!.hidden=false;});
 document.getElementById('save-support')?.addEventListener('click',async()=>{const result=await ipcRenderer.invoke('support:action','export');document.getElementById('support-status')!.textContent=result.ok?'Diagnostics saved. No automatic upload.':result.cancelled?'Save cancelled.':'Could not save. Choose a new file in a writable folder.';});
 document.getElementById('retry-shell')?.addEventListener('click',async()=>{const status=document.getElementById('support-status');status!.textContent='Restoring the desktop…';const ok=await ipcRenderer.invoke('shell:recovery-retry');if(!ok)status!.textContent='The desktop could not start yet. Wait briefly, then retry.';});
 document.getElementById('quit-recovery')?.addEventListener('click',()=>void ipcRenderer.invoke('shell:recovery-quit'));
});
