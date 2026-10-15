import { contextBridge, ipcRenderer } from 'electron';
let modalOpen = false;
// No caller-supplied identity, token getter, raw IPC or native service is exposed.
contextBridge.exposeInMainWorld('dentalApp', Object.freeze({
  report(value: { dirty: boolean; modal: boolean }) {
    if (!value || Object.keys(value).sort().join() !== 'dirty,modal' || typeof value.dirty !== 'boolean' || typeof value.modal !== 'boolean') throw new Error('Invalid report');
    modalOpen = value.modal; ipcRenderer.send('runtime:report', value);
  },
}));
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
