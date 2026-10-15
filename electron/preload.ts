import { contextBridge, ipcRenderer } from 'electron';
const hostListeners = new Set<(transitioning: boolean) => void>();
let hostTransitioning = false;
function publishHostTransition(transitioning: boolean) {
  hostTransitioning = transitioning;
  for (const listener of hostListeners) listener(transitioning);
}
ipcRenderer.on('window:host-transition', (_event, value: boolean) => publishHostTransition(value));
contextBridge.exposeInMainWorld('desktop', {
  runtime: {
    sync: (value: unknown) => ipcRenderer.invoke('runtime:sync', value),
    restart: (id: string) => ipcRenderer.invoke('runtime:restart', id),
    subscribe: (callback: (kind: string, value: unknown) => void) => {
      const state = (_event: unknown, value: unknown) => callback('state', value);
      const key = (_event: unknown, value: unknown) => callback('key', value);
      const edge = (_event: unknown, value: unknown) => callback('edge', value);
      ipcRenderer.on('runtime:state',state); ipcRenderer.on('runtime:key',key); ipcRenderer.on('runtime:edge',edge);
      return () => { ipcRenderer.removeListener('runtime:state',state); ipcRenderer.removeListener('runtime:key',key); ipcRenderer.removeListener('runtime:edge',edge); };
    },
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
  capture: (rect: { x: number; y: number; width: number; height: number }) => ipcRenderer.invoke('window:capture', rect),
});
