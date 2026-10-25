import { contextBridge, ipcRenderer } from 'electron';

type DockCaptionUpdate = { label: string; rect: { x: number; y: number; width: number; height: number } } | null;

contextBridge.exposeInMainWorld('dockCaptionOverlay', {
  subscribe(callback: (caption: DockCaptionUpdate) => void) {
    const listener = (_event: unknown, caption: DockCaptionUpdate) => callback(caption);
    ipcRenderer.on('dock-caption:update', listener);
    return () => ipcRenderer.removeListener('dock-caption:update', listener);
  },
});
