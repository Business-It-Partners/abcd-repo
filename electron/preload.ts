import { contextBridge, ipcRenderer } from 'electron';
// Sandboxed Electron preloads may import only Electron's limited built-ins.
// Keep this defensive wire check self-contained, never require a local module.
function validShellPickerPrompt(input: unknown): boolean {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return false;
  const v = input as Record<string, unknown>;
  if (Object.keys(v).sort().join(',') !== 'appTitle,fileTypes,generation,maxSelections,purpose,requestId') return false;
  if (typeof v.requestId !== 'string' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(v.requestId)) return false;
  if (!Number.isSafeInteger(v.generation) || (v.generation as number) < 1 ||
      !Number.isSafeInteger(v.maxSelections) || (v.maxSelections as number) < 1 || (v.maxSelections as number) > 10) return false;
  if (typeof v.appTitle !== 'string' || v.appTitle.length < 1 || v.appTitle.length > 80 || /[\u0000-\u001f<>]/.test(v.appTitle)) return false;
  return ['patient-attachment','lab-attachment','staff-document','general'].includes(v.purpose as string) &&
    ['images','medical-images','documents','all'].includes(v.fileTypes as string);
}
const hostListeners = new Set<(transitioning: boolean) => void>();
let hostTransitioning = false;
function publishHostTransition(transitioning: boolean) {
  hostTransitioning = transitioning;
  for (const listener of hostListeners) listener(transitioning);
}
ipcRenderer.on('window:host-transition', (_event, value: boolean) => publishHostTransition(value));
contextBridge.exposeInMainWorld('desktop', {
  support:()=>ipcRenderer.invoke('support:action','preview'),
  store: {
    action: (kind: string, input?: unknown, generation?: number) => ipcRenderer.invoke('store:action', kind, input, generation),
    subscribe: (callback: (value: unknown) => void) => { const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('store:state', listener); return () => ipcRenderer.removeListener('store:state', listener); },
  },
  identity: {
    view: () => ipcRenderer.invoke('identity:view'),
    action: (kind: 'login' | 'lock' | 'logout', input?: unknown) => ipcRenderer.invoke('identity:action', kind, input),
    devCredentialsAvailable: () => ipcRenderer.invoke('identity:dev-credentials-available'),
    devCredentials: () => ipcRenderer.invoke('identity:dev-credentials'),
    subscribe: (callback: (value: unknown) => void) => { const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('identity:state', listener); return () => ipcRenderer.removeListener('identity:state', listener); },
  },
  runtime: {
    sync: (value: unknown, generation?: number) => ipcRenderer.invoke('runtime:sync', value, generation),
    hideAll: (generation?: number) => ipcRenderer.sendSync('runtime:hide-all', generation) === true,
    restart: (id: string, generation?: number) => ipcRenderer.invoke('runtime:restart', id, generation),
    selectModule: (id: string, moduleId: string) => ipcRenderer.invoke('runtime:select-module', id, moduleId),
    discoverApp: (id: string) => ipcRenderer.invoke('runtime:discover-app', id),
    subscribe: (callback: (kind: string, value: unknown) => void) => {
      const state = (_event: unknown, value: unknown) => callback('state', value);
      const key = (_event: unknown, value: unknown) => callback('key', value);
      const edge = (_event: unknown, value: unknown) => callback('edge', value);
      const closeBlocked = (_event: unknown,value:unknown)=>callback('close-blocked',value);
      const appExplorer=(_event:unknown,value:unknown)=>callback('app-explorer',value);
      ipcRenderer.on('runtime:state',state); ipcRenderer.on('runtime:key',key); ipcRenderer.on('runtime:edge',edge); ipcRenderer.on('runtime:close-blocked',closeBlocked); ipcRenderer.on('runtime:app-explorer',appExplorer);
      return () => { ipcRenderer.removeListener('runtime:state',state); ipcRenderer.removeListener('runtime:key',key); ipcRenderer.removeListener('runtime:edge',edge); ipcRenderer.removeListener('runtime:close-blocked',closeBlocked); ipcRenderer.removeListener('runtime:app-explorer',appExplorer); };
    },
  },
  files: {
    subscribePicker: (listener: (value: import('./host/filePickerContract').FilePickerPrompt|null)=>void) => {
      const start=(_event:unknown,value:unknown)=>{if(validShellPickerPrompt(value))listener(value as import('./host/filePickerContract').FilePickerPrompt);};
      const end=(_event:unknown,id:unknown)=>{if(typeof id==='string')listener(null);};
      ipcRenderer.on('files:picker-open',start);
      ipcRenderer.on('files:picker-close',end);
      return()=>{ipcRenderer.removeListener('files:picker-open',start);ipcRenderer.removeListener('files:picker-close',end);};
    },
    pickResponse: (input: unknown)=>ipcRenderer.invoke('files:pick-response',input) as Promise<boolean>,
    roots: (generation: number) => ipcRenderer.invoke('files:roots', generation),
    list: (input: unknown) => ipcRenderer.invoke('files:list', input),
    thumbnail: (fileId: string, generation: number) => ipcRenderer.invoke('files:thumbnail', fileId, generation),
    foreground: (generation:number,active:boolean)=>ipcRenderer.invoke('files:foreground',generation,active),
    transferTarget: (generation:number)=>ipcRenderer.invoke('files:transfer-target',generation),
    send: (input:unknown)=>ipcRenderer.invoke('files:send',input),
  },
  preferences: (value?: { overviewShortcutEnabled: boolean }) => ipcRenderer.invoke('os:preferences', value),
  status: () => ipcRenderer.invoke('os:status'),
  control: (action: 'close' | 'minimize') => {
    // Suspend layout synchronously before native fullscreen/minimize events.
    if (action !== 'minimize') return ipcRenderer.invoke('window:control', action);
    publishHostTransition(true);
    // Paint the stable layout/menu dismissal before the host animates the window.
    return new Promise<void>((resolve, reject) => requestAnimationFrame(() => requestAnimationFrame(() => {
      ipcRenderer.invoke('window:control', action).then(resolve, error => { publishHostTransition(false); reject(error); });
    })));
  },
  onHostTransition: (listener: (transitioning: boolean) => void) => {
    hostListeners.add(listener); listener(hostTransitioning);
    return () => { hostListeners.delete(listener); };
  },
  capture: (rect: { x: number; y: number; width: number; height: number }, generation?: number) => ipcRenderer.invoke('window:capture', rect, generation),
});

// Genuine host-shell activation, single-use and short-lived in trusted main.
const markFileSend=(event:Event)=>{
  if(!event.isTrusted||!document.hasFocus())return;
  if(event instanceof MouseEvent&&event.button!==0)return;
  if(event instanceof KeyboardEvent&&(event.repeat||event.ctrlKey||event.altKey||event.metaKey||!['Enter',' '].includes(event.key)))return;
  ipcRenderer.send('files:send-activation');
};
window.addEventListener('pointerdown',markFileSend,true);
window.addEventListener('keydown',markFileSend,true);
