import { contextBridge, ipcRenderer } from 'electron';
import type { AppSdk, Result } from '../sdk/contracts';
import type { DentalAppInfo } from '../packages/appMetadata';
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
  if(selectionId&&applied)requestAnimationFrame(()=>requestAnimationFrame(()=>ipcRenderer.send('runtime:module-selection-ack',{selectionId})));
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

// Capture trusted DOM keys in the platform world; app code cannot invoke this IPC.
window.addEventListener('keydown', event => {
  if (!event.isTrusted || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || event.isComposing) return;
  if(event.key==='Escape' && modalOpen)return;
  if (!((event.key === '`' && event.code === 'Backquote') || event.key === 'Escape')) return;
  event.preventDefault(); event.stopImmediatePropagation();
  ipcRenderer.send('runtime:shortcut', { key: event.key, code: event.code, repeat: event.repeat });
}, true);
