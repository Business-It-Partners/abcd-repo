import { describe, expect, it } from 'vitest';
import { parseFilesList, parseViewerOpen, parseViewerStep } from '../electron/host/filesShell';
import { createDesktop, desktopReducer, activeWindow } from '../src/windowManager';
import { WINDOW_IDS, windowSpec, workArea } from '../src/windowGeometry';
const a = '11111111-1111-4111-8111-111111111111';
const b = '22222222-2222-4222-8222-222222222222';
describe('M16.3 trusted shell-only file listing contract', () => {
  it('accepts exactly the bounded token-only structure', () => {
    expect(parseFilesList({ directoryId: a, cursor: null, limit: 100, generation: 1 }))
      .toEqual({ directoryId: a, cursor: null, limit: 100, generation: 1 });
    expect(parseFilesList({ directoryId: a, cursor: b, limit: 200, generation: 42 })).not.toBeNull();
  });
  it('denies forged paths, extra fields, malformed IDs, large limits and wrong generations', () => {
    const request = { directoryId: a, cursor: null, limit: 100, generation: 2 };
    for (const invalid of [null, [], 'C:\\users\\secret', { ...request, directoryId: '/etc' },
      { ...request, cursor: 'C:\\Windows' }, { ...request, limit: 0 }, { ...request, limit: 201 },
      { ...request, limit: 1.5 }, { ...request, generation: 0 }, { ...request, generation: '2' },
      { ...request, filePath: 'C:\\' }, { ...request, cursor: undefined }]) {
      expect(parseFilesList(invalid)).toBeNull();
    }
  });
});
describe('M16.3 OS core Files window lifecycle', () => {
  it('registers Files in the first-party static managed-window inventory', () => {
    expect(WINDOW_IDS).toContain('files');
    expect(windowSpec('files').title).toBe('Files');
    expect(windowSpec('files').minimum.width).toBeGreaterThanOrEqual(480);
  });
  it('uses the shared focus, fullscreen, minimize/restore and close lifecycle', () => {
    let desktop = createDesktop({ width: 1300, height: 850 });
    expect(desktop.windows.files.phase).toBe('closed');
    desktop = desktopReducer(desktop, { type: 'phase', id: 'files', phase: 'visible' });
    expect(activeWindow(desktop)).toBe('files');
    desktop = desktopReducer(desktop, { type: 'toggle', id: 'files' });
    expect(desktop.windows.files.presentation).toBe('fullscreen');
    desktop = desktopReducer(desktop, { type: 'phase', id: 'files', phase: 'minimized' });
    expect(activeWindow(desktop)).toBeUndefined();
    desktop = desktopReducer(desktop, { type: 'phase', id: 'files', phase: 'visible' });
    expect(desktop.windows.files.presentation).toBe('fullscreen');
    desktop = desktopReducer(desktop, { type: 'toggle', id: 'files' });
    expect(desktop.windows.files.normalBounds.y).toBe(workArea(desktop.size).y);
    desktop = desktopReducer(desktop, { type: 'phase', id: 'files', phase: 'closed' });
    expect(desktop.windows.files.phase).toBe('closed');
  });
});

describe('M16 shell-owned image viewer IPC contract',()=>{
  it('allows a bounded list of opaque current-directory IDs and strictly parsed steps',()=>{
    expect(parseViewerOpen({directoryId:a,fileIds:[a,b],selectedId:b,generation:1})).toEqual({
      directoryId:a,fileIds:[a,b],selectedId:b,generation:1,
    });
    expect(parseViewerStep({sessionId:a,generation:1,direction:1})).not.toBeNull();
    expect(parseViewerStep({sessionId:a,generation:1,direction:-1})).not.toBeNull();
  });
  it('rejects path injection, duplicate IDs, oversized lists, missing selection and extra fields',()=>{
    const r={directoryId:a,fileIds:[a,b],selectedId:a,generation:1};
    for(const invalid of [
      {...r,directoryId:'C:\\Users\\patient'}, {...r,fileIds:[a,a]}, {...r,fileIds:[]},
      {...r,fileIds:Array(2049).fill(a)}, {...r,selectedId:'33333333-3333-4333-8333-333333333333'},
      {...r,generation:0}, {...r,nativePath:'/tmp/sample.png'}, {...r,fileIds:['/etc/passwd']},
      {...r,fileIds:'file.png'}, {...r,generation:'1'},
    ])expect(parseViewerOpen(invalid)).toBeNull();
    for(const invalid of [
      {sessionId:'/etc/passwd',generation:1,direction:1}, {sessionId:a,generation:0,direction:1},
      {sessionId:a,generation:1,direction:0}, {sessionId:a,generation:1,direction:2},
      {sessionId:a,generation:1,direction:1,path:'/tmp'}, {sessionId:a,generation:1,direction:'-1'},
    ])expect(parseViewerStep(invalid)).toBeNull();
  });
  it('manages viewer focus/close/maximize without making the viewer an app launcher',()=>{
    let desktop=createDesktop({width:1300,height:850});
    expect(desktop.windows['image-viewer'].phase).toBe('closed');
    expect(WINDOW_IDS).not.toContain('image-viewer');
    expect(windowSpec('image-viewer').title).toBe('Image Viewer');
    desktop=desktopReducer(desktop,{type:'phase',id:'files',phase:'visible'});
    desktop=desktopReducer(desktop,{type:'phase',id:'image-viewer',phase:'visible'});
    expect(activeWindow(desktop)).toBe('image-viewer');
    expect(desktop.windows.files.phase).toBe('visible');
    desktop=desktopReducer(desktop,{type:'toggle',id:'image-viewer'});
    expect(desktop.windows['image-viewer'].presentation).toBe('fullscreen');
    desktop=desktopReducer(desktop,{type:'phase',id:'image-viewer',phase:'closed'});
    expect(activeWindow(desktop)).toBe('files');
  });
});
