import { contextBridge, ipcRenderer } from 'electron';
import type { AppNavigationRequest, AppNavigationSnapshot, AppSdk, Result } from '../sdk/contracts';
import type { DentalAppInfo } from '../packages/appMetadata';
import type { FileSelection } from '../host/localFiles';
function acknowledgeAfterPaintOrTimeout(acknowledge: () => void) {
  let completed = false;
  let fallback: number | undefined;
  const finish = () => {
    if (completed) return;
    completed = true;
    if (fallback !== undefined) window.clearTimeout(fallback);
    acknowledge();
  };
  fallback = window.setTimeout(finish, 500);
  try { window.requestAnimationFrame(() => window.requestAnimationFrame(finish)); }
  catch { /* A paused or unavailable animation clock must not strand app launch. */ }
}
function cloneBounded(value: unknown): unknown {
  const json = JSON.stringify(value);
  if (!json || json.length > 16384) throw new Error('Invalid SDK input');
  return JSON.parse(json);
}
async function invoke(channel: 'sdk:connect' | 'sdk:request' | 'sdk:cancel', value: unknown): Promise<Result> {
  try { return await ipcRenderer.invoke(channel, cloneBounded(value)); }
  catch { return { ok: false, error: { code: 'INVALID_REQUEST', message: 'Invalid or unavailable SDK request.', outcome: 'not_sent' } }; }
}
let modalOpen = false;
const fileListeners = new Set<(value:FileSelection)=>void>();
const navigationListeners = new Set<(value:AppNavigationRequest)=>void>();
ipcRenderer.on('runtime:navigate', (_event, value: unknown) => {
  const request = value as AppNavigationRequest | null;
  if (!request || Object.keys(request).sort().join() !== 'direction,entry' ||
      !['back','forward'].includes(request.direction) ||
      typeof request.entry !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(request.entry)) return;
  for (const listener of navigationListeners) listener(request);
});
ipcRenderer.on('runtime:file-transfer',(_event,value:unknown)=>{
  // Sandboxed preload: parse inline; never import executable local modules.
  const v=value as {transferId?:unknown;selection?:unknown}|null;
  const uuid=(s:unknown)=>typeof s==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(s);
  const selection=v?.selection as FileSelection|undefined;
  const valid=!!v&&Object.keys(v).sort().join()==='selection,transferId'&&uuid(v.transferId)&&
    !!selection&&Object.keys(selection).sort().join()==='expiresAt,files,selectionId'&&uuid(selection.selectionId)&&
    Number.isSafeInteger(selection.expiresAt)&&Array.isArray(selection.files)&&selection.files.length>0&&selection.files.length<=10&&
    selection.files.every(f=>!!f&&Object.keys(f).sort().join()==='modifiedAt,name,receiptId,sizeBytes,typeHint'&&
      uuid(f.receiptId)&&typeof f.name==='string'&&f.name.length>0&&f.name.length<=255&&!/[\u0000-\u001f\u007f]/.test(f.name)&&
      Number.isSafeInteger(f.sizeBytes)&&f.sizeBytes>=0&&(f.modifiedAt===null||typeof f.modifiedAt==='number'&&Number.isFinite(f.modifiedAt))&&
      typeof f.typeHint==='string'&&/^\.[a-z0-9]{1,23}$|^$/.test(f.typeHint));
  let accepted=valid&&fileListeners.size>0;
  if(accepted)for(const listener of fileListeners){try{listener(selection!);}catch{accepted=false;}}
  if(uuid(v?.transferId))ipcRenderer.send('runtime:file-transfer-ack',{transferId:v!.transferId,accepted});
});
const moduleListeners = new Set<(value:{moduleId:string})=>void>();
ipcRenderer.on('runtime:module-selected',(_event,value:unknown)=>{
  if(!value||typeof value!=='object'||Array.isArray(value))return;
  const keys=Object.keys(value).sort().join();
  if(!['moduleId','moduleId,selectionId'].includes(keys))return;
  const message=value as {moduleId?:unknown;selectionId?:unknown};
  if(typeof message.moduleId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(message.moduleId))return;
  const selectionId=message.selectionId;
  if(selectionId!==undefined&&(typeof selectionId!=='string'||!/^[a-f0-9-]{36}$/.test(selectionId)))return;
  let applied=moduleListeners.size>0;
  for(const listener of moduleListeners){try{listener({moduleId:message.moduleId});}catch{applied=false;}}
  if(selectionId&&applied)acknowledgeAfterPaintOrTimeout(()=>ipcRenderer.send('runtime:module-selection-ack',{selectionId}));
});
// No caller-supplied identity, token getter, raw IPC or native service is exposed.
contextBridge.exposeInMainWorld('dentalApp', Object.freeze({
  connect: input => invoke('sdk:connect', input) as ReturnType<AppSdk['connect']>,
  request: async input => {
    const result = await invoke('sdk:request', input);
    if (result.ok && input.operation === 'lifecycle.report') modalOpen = input.input.modal as boolean;
    return result;
  },
  cancel: input => invoke('sdk:cancel', input),
  getAppInfo: () => ipcRenderer.invoke('runtime:app-info') as Promise<Result<DentalAppInfo>>,
  openAppExplorer: () => ipcRenderer.invoke('runtime:open-explorer') as Promise<Result>,
  onModuleSelected(listener: (value: { moduleId: string }) => void) {
    moduleListeners.add(listener);
    return () => moduleListeners.delete(listener);
  },
  onFilesReceived(listener: (selection:FileSelection)=>void) {
    if(typeof listener!=='function')throw Error('Invalid file recipient');
    fileListeners.add(listener);
    ipcRenderer.send('runtime:file-transfer-ready',true);
    return ()=>{fileListeners.delete(listener);if(fileListeners.size===0)ipcRenderer.send('runtime:file-transfer-ready',false);};
  },
  navigation: {
    report(input: AppNavigationSnapshot) {
      const value = cloneBounded(input) as AppNavigationSnapshot;
      const valid = !!value && Object.keys(value).sort().join() === 'entries,index' && Array.isArray(value.entries) &&
        value.entries.length >= 1 && value.entries.length <= 64 && value.entries.every(entry =>
          typeof entry === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(entry)) &&
        new Set(value.entries).size === value.entries.length && Number.isSafeInteger(value.index) &&
        value.index >= 0 && value.index < value.entries.length;
      if (!valid) throw new Error('Invalid navigation state');
      ipcRenderer.send('runtime:navigation-report', value);
    },
    onRequest(listener: (value: AppNavigationRequest) => void) {
      if (typeof listener !== 'function') throw new Error('Invalid navigation listener');
      navigationListeners.add(listener);
      return () => navigationListeners.delete(listener);
    },
  },
  report(value: { dirty: boolean; modal: boolean }) {
    if (!value || Object.keys(value).sort().join() !== 'dirty,modal' || typeof value.dirty !== 'boolean' || typeof value.modal !== 'boolean') throw new Error('Invalid report');
    modalOpen = value.modal; ipcRenderer.send('runtime:report', value);
  },
} satisfies AppSdk));
let lastEdge = 0;
window.addEventListener('pointermove', event => {
  if (event.clientY < innerHeight - 160 || performance.now() - lastEdge < 100) return;
  lastEdge = performance.now(); ipcRenderer.send('runtime:edge', { x: event.clientX, y: event.clientY });
});

// Trusted activation observed only in the platform-isolated preload, never app JS.
const fileActivate=(event:Event)=>{
  if(!event.isTrusted || !document.hasFocus())return;
  if(event instanceof MouseEvent && event.button!==0)return;
  if(event instanceof KeyboardEvent && (event.repeat||event.ctrlKey||event.altKey||event.metaKey||event.isComposing ||
    !['Enter',' '].includes(event.key)))return;
  ipcRenderer.send('runtime:file-activation');
};
window.addEventListener('pointerdown',fileActivate,true);
window.addEventListener('keydown',fileActivate,true);
// Capture trusted DOM keys in the platform world; app code cannot invoke this IPC.
window.addEventListener('keydown', event => {
  if (!event.isTrusted || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
  if(event.key==='Escape' && modalOpen)return;
  if (!((event.key === '`' && event.code === 'Backquote') || event.key === 'Escape')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ipcRenderer.send('runtime:shortcut', { key: event.key, code: event.code, repeat: event.repeat });
}, true);
