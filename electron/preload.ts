import { contextBridge, ipcRenderer } from 'electron';
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
    roots: (generation: number) => ipcRenderer.invoke('files:roots', generation),
    list: (input: unknown) => ipcRenderer.invoke('files:list', input),
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
