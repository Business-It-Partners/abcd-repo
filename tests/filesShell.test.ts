import { describe, expect, it } from 'vitest';
import { parseFilesList } from '../electron/host/filesShell';
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
