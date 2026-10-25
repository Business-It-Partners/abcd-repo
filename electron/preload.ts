import { contextBridge, ipcRenderer } from 'electron';
const hostListeners = new Set<(transitioning: boolean) => void>();
let hostTransitioning = false;
function publishHostTransition(transitioning: boolean) {
  if (hostTransitioning === transitioning) return;
  hostTransitioning = transitioning;
  for (const listener of hostListeners) listener(transitioning);
}
ipcRenderer.on('window:host-transition', (_event, value: boolean) => publishHostTransition(value));
contextBridge.exposeInMainWorld('desktop', {
  dockCaption: {
    show: (input: { label: string; rect: { x: number; y: number; width: number; height: number } }) => ipcRenderer.send('dock-caption:show', input),
    hide: () => ipcRenderer.send('dock-caption:hide'),
  },
  support:()=>ipcRenderer.invoke('support:action','preview'),
  shell: { reload: () => ipcRenderer.invoke('shell:reload') as Promise<boolean> },
  store: {
    action: (kind: string, input?: unknown, generation?: number) => ipcRenderer.invoke('store:action', kind, input, generation),
    artwork: (appId: string, expectedSha256?: string, generation?: number) => ipcRenderer.invoke('store:artwork', appId, expectedSha256, generation),
    subscribe: (callback: (value: unknown) => void) => { const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('store:state', listener); return () => ipcRenderer.removeListener('store:state', listener); },
  },
  developmentApps: {
    view: () => ipcRenderer.invoke('development-apps:view'),
  },
  identity: {
    view: () => ipcRenderer.invoke('identity:view'),
    clinicLogo: () => ipcRenderer.invoke('identity:clinic-logo') as Promise<string | undefined>,
    action: (kind: 'login' | 'lock' | 'logout' | 'restore', input?: unknown) => ipcRenderer.invoke('identity:action', kind, input),
    devCredentialsAvailable: () => ipcRenderer.invoke('identity:dev-credentials-available'),
    devCredentials: () => ipcRenderer.invoke('identity:dev-credentials'),
    subscribe: (callback: (value: unknown) => void) => { const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('identity:state', listener); return () => ipcRenderer.removeListener('identity:state', listener); },
  },
  runtime: {
    sync: (value: unknown, generation?: number) => ipcRenderer.invoke('runtime:sync', value, generation),
    navigate: (id: string, direction: 'back' | 'forward', generation?: number, discardDirty?: boolean, preserveDraft?: boolean) => ipcRenderer.invoke('runtime:navigate', id, direction, generation, discardDirty, preserveDraft) as Promise<boolean>,
    hideAll: (generation?: number) => ipcRenderer.sendSync('runtime:hide-all', generation) === true,
    restart: (id: string, generation?: number) => ipcRenderer.invoke('runtime:restart', id, generation),
    resume: (id: string, generation?: number) => ipcRenderer.invoke('runtime:resume', id, generation),
    selectModule: (id: string, moduleId: string) => ipcRenderer.invoke('runtime:select-module', id, moduleId),
    discoverApp: (id: string) => ipcRenderer.invoke('runtime:discover-app', id),
    subscribe: (callback: (kind: string, value: unknown) => void) => {
      const state = (_event: unknown, value: unknown) => callback('state', value);
      const key = (_event: unknown, value: unknown) => callback('key', value);
      const edge = (_event: unknown, value: unknown) => callback('edge', value);
      const closeBlocked = (_event: unknown,value:unknown)=>callback('close-blocked',value);
      ipcRenderer.on('runtime:state',state); ipcRenderer.on('runtime:key',key); ipcRenderer.on('runtime:edge',edge); ipcRenderer.on('runtime:close-blocked',closeBlocked);
      return () => { ipcRenderer.removeListener('runtime:state',state); ipcRenderer.removeListener('runtime:key',key); ipcRenderer.removeListener('runtime:edge',edge); ipcRenderer.removeListener('runtime:close-blocked',closeBlocked); };
    },
  },
  resourcePressure: {
    subscribe: (callback: (value: unknown) => void) => { const listener = (_event: unknown, value: unknown) => callback(value); ipcRenderer.on('resource:pressure', listener); return () => ipcRenderer.removeListener('resource:pressure', listener); },
    acknowledge: (requestId: string) => ipcRenderer.send('resource:pressure-ack', requestId),
  },
  preferences: (value?: { overviewShortcutEnabled: boolean }) => ipcRenderer.invoke('os:preferences', value),
  status: () => ipcRenderer.invoke('os:status'),
  control: (action: 'close' | 'minimize') => {
    // Suspend layout synchronously before native fullscreen/minimize events.
    if (action !== 'minimize') return ipcRenderer.invoke('window:control', action);
    publishHostTransition(true);
    // The renderer is already suspended; let the native minimize start immediately.
    return ipcRenderer.invoke('window:control', action).catch(error => { publishHostTransition(false); throw error; });
  },
  onHostTransition: (listener: (transitioning: boolean) => void) => {
    hostListeners.add(listener); listener(hostTransitioning);
    return () => { hostListeners.delete(listener); };
  },
  capture: (rect: { x: number; y: number; width: number; height: number }, generation?: number) => ipcRenderer.invoke('window:capture', rect, generation),
});
