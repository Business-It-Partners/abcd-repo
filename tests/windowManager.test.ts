import { describe, expect, it } from 'vitest';
import { moveBounds, maximizedBounds, resizeBounds, fitBounds, initialBounds, workArea, dockZoneTop, statusBarHeightForWidth, dockWindowGap, type ResizeEdge } from '../src/windowGeometry';
import { dockHeightForWidth } from '../src/motion';
import { activeWindow, createDesktop, desktopReducer } from '../src/windowManager';

const screen = { width: 1440, height: 1000 }, minimum = { width: 540, height: 340 };
const start = { x: 300, y: 200, width: 760, height: 480 };
describe('Constrained window resizing', () => {
  it('opens app windows flush below the status bar with a small dock gap', () => {
    const area = workArea(screen);
    expect(area.y).toBe(statusBarHeightForWidth(screen.width));
    expect(dockZoneTop(screen)).toBe(screen.height - dockHeightForWidth(screen.width));
    expect(area.y + area.height).toBe(dockZoneTop(screen) - dockWindowGap);
    expect(initialBounds('store', screen)).toMatchObject({ y: area.y, height: area.height });
    expect(initialBounds('records', screen)).toEqual(area);
    expect(initialBounds('store', { width: 580, height: 800 })).toMatchObject({ y: 59, height: workArea({ width: 580, height: 800 }).height });
  });
  it('maximizes across the viewport underneath the floating status bar and dock', () => {
    expect(maximizedBounds(screen)).toEqual({ x: 0, y: 0, width: screen.width, height: screen.height });
  });
  it('clamps drag hiding to 70 percent on bottom and both sides but never above the status bar', () => {
    const box = { x: 300, y: 200, width: 600, height: 500 };
    const left = moveBounds({ ...box, x: -10000 }, screen);
    const right = moveBounds({ ...box, x: 10000 }, screen);
    const bottom = moveBounds({ ...box, y: 10000 }, screen);
    const top = moveBounds({ ...box, y: -10000 }, screen);
    expect(left.x).toBe(-420); expect(left.x + left.width).toBe(180);
    expect(right.x).toBe(1260); expect(right.x + right.width).toBe(1860);
    expect(bottom.y).toBe(workArea(screen).y+workArea(screen).height-150); expect(bottom.y + bottom.height).toBe(bottom.y+500);
    expect(top.y).toBe(workArea(screen).y);
  });
  it('reopens a closed, edge-hidden window fully inside the current work area', () => {
    let state = createDesktop(screen);
    const area = workArea(screen);
    const hidden = moveBounds({ ...state.windows.studio.normalBounds, x: -10000, y: 10000 }, screen);
    state = desktopReducer(state, { type: 'patch', id: 'studio', patch: { normalBounds: hidden } });
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'closed' });
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'visible' });
    const reopened = state.windows.studio.normalBounds;
    expect(reopened.x).toBeGreaterThanOrEqual(area.x);
    expect(reopened.y).toBeGreaterThanOrEqual(area.y);
    expect(reopened.x + reopened.width).toBeLessThanOrEqual(area.x + area.width);
    expect(reopened.y + reopened.height).toBeLessThanOrEqual(area.y + area.height);
  });
  for (const edge of ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'] as ResizeEdge[]) {
    it(`${edge} keeps the opposite boundaries fixed`, () => {
      const next = resizeBounds(start, edge, 40, 30, screen, minimum);
      expect(next.x + next.width).toBe(edge.includes('e') ? 1100 : 1060);
      expect(next.y + next.height).toBe(edge.includes('s') ? 710 : 680);
      expect(next.x).toBe(edge.includes('w') ? 340 : 300);
      expect(next.y).toBe(edge.includes('n') ? 230 : 200);
    });
  }
  it('does not slide a left/top resize beyond minimum size', () => {
    const next = resizeBounds(start, 'nw', 5000, 5000, screen, minimum);
    expect(next).toEqual({ x: 520, y: 340, ...minimum });
    expect(resizeBounds(start, 'nw', 10000, 10000, screen, minimum)).toEqual(next);
  });
  it('limits outward resize to the usable area', () => {
    const area = workArea(screen);
    const nw = resizeBounds(start, 'nw', -10000, -10000, screen, minimum);
    const se = resizeBounds(start, 'se', 10000, 10000, screen, minimum);
    expect(nw.x).toBe(area.x); expect(nw.y).toBe(area.y);
    expect(se.x + se.width).toBe(area.x + area.width);
    expect(se.y + se.height).toBe(area.y + area.height);
  });
  it('fits tiny displays without negative size or unreachable frames', () => {
    const tiny = { width: 400, height: 300 }, area = workArea(tiny);
    const fit = fitBounds(start, tiny, minimum);
    expect(fit).toEqual(area);
    expect(initialBounds('records', tiny)).toEqual(area);
  });
});
describe('Shared lifecycle and focus', () => {
  it('selects the next visible window after minimize or close', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'visible' });
    state = desktopReducer(state, { type: 'phase', id: 'records', phase: 'visible' });
    expect(activeWindow(state)).toBe('records');
    state = desktopReducer(state, { type: 'phase', id: 'records', phase: 'minimizing' });
    expect(activeWindow(state)).toBe('studio');
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'closed' });
    expect(activeWindow(state)).toBeUndefined();
    state = desktopReducer(state, { type: 'focus', id: 'records' });
    expect(activeWindow(state)).toBeUndefined();
  });
  it('retains resized normal bounds and fullscreen through minimize/restore', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'visible' });
    state = desktopReducer(state, { type: 'patch', id: 'studio', patch: { normalBounds: start } });
    state = desktopReducer(state, { type: 'toggle', id: 'studio' });
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'minimized' });
    state = desktopReducer(state, { type: 'phase', id: 'studio', phase: 'visible' });
    expect(state.windows.studio.presentation).toBe('fullscreen');
    state = desktopReducer(state, { type: 'toggle', id: 'studio' });
    expect(state.windows.studio.normalBounds).toEqual(start);
  });
  it('refits normal bounds on display changes without changing fullscreen presentation', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'phase', id: 'records', phase: 'visible' });
    state = desktopReducer(state, { type: 'toggle', id: 'records' });
    state = desktopReducer(state, { type: 'viewport', size: { width: 500, height: 400 } });
    expect(state.windows.records.presentation).toBe('fullscreen');
    expect(state.windows.records.normalBounds).toEqual(workArea(state.size));
  });
  it('registers and releases a Store app window without a static ID edit', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'register', id: 'company.sample.preview', title: 'Dental Workspace Preview' });
    expect(state.windows['company.sample.preview'].title).toBe('Dental Workspace Preview');
    state = desktopReducer(state, { type: 'phase', id: 'company.sample.preview', phase: 'visible' });
    expect(activeWindow(state)).toBe('company.sample.preview');
    state = desktopReducer(state, { type: 'phase', id: 'company.sample.preview', phase: 'closed' });
    state = desktopReducer(state, { type: 'unregister', id: 'company.sample.preview' });
    expect(state.windows['company.sample.preview']).toBeUndefined();
  });
});

describe('Per-window page navigation', () => {
  it('keeps an isolated back/forward stack for each window and drops forward entries after a new route', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'navigation-reset', id: 'standard-window-1', entry: 'table' });
    state = desktopReducer(state, { type: 'navigation-push', id: 'standard-window-1', entry: 'case:one' });
    state = desktopReducer(state, { type: 'navigation-push', id: 'standard-window-1', entry: 'case:two' });
    state = desktopReducer(state, { type: 'navigation-back', id: 'standard-window-1' });
    expect(state.windows['standard-window-1'].navigation).toEqual({ entries: ['table', 'case:one', 'case:two'], index: 1 });
    state = desktopReducer(state, { type: 'navigation-push', id: 'standard-window-1', entry: 'case:three' });
    expect(state.windows['standard-window-1'].navigation).toEqual({ entries: ['table', 'case:one', 'case:three'], index: 2 });
    state = desktopReducer(state, { type: 'navigation-back', id: 'standard-window-1' });
    state = desktopReducer(state, { type: 'navigation-forward', id: 'standard-window-1' });
    expect(state.windows['standard-window-1'].navigation.entries[state.windows['standard-window-1'].navigation.index]).toBe('case:three');
    expect(state.windows.followups.navigation).toEqual({ entries: [], index: -1 });
  });

  it('does not move outside the stack and clears history when a window closes', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'navigation-back', id: 'standard-window-1' });
    expect(state.windows['standard-window-1'].navigation).toEqual({ entries: [], index: -1 });
    state = desktopReducer(state, { type: 'navigation-reset', id: 'standard-window-1', entry: 'table' });
    state = desktopReducer(state, { type: 'navigation-push', id: 'standard-window-1', entry: 'case:one' });
    state = desktopReducer(state, { type: 'phase', id: 'standard-window-1', phase: 'minimizing' });
    state = desktopReducer(state, { type: 'phase', id: 'standard-window-1', phase: 'minimized' });
    state = desktopReducer(state, { type: 'phase', id: 'standard-window-1', phase: 'restoring' });
    state = desktopReducer(state, { type: 'phase', id: 'standard-window-1', phase: 'visible' });
    expect(state.windows['standard-window-1'].navigation).toEqual({ entries: ['table', 'case:one'], index: 1 });
    state = desktopReducer(state, { type: 'phase', id: 'standard-window-1', phase: 'closed' });
    expect(state.windows['standard-window-1'].navigation).toEqual({ entries: [], index: -1 });
  });

  it('bounds the shell stack to the shared 64-entry app navigation limit', () => {
    let state = createDesktop(screen);
    state = desktopReducer(state, { type: 'navigation-reset', id: 'standard-window-1', entry: 'page-0' });
    for (let index = 1; index <= 70; index++) {
      state = desktopReducer(state, { type: 'navigation-push', id: 'standard-window-1', entry: `page-${index}` });
    }
    expect(state.windows['standard-window-1'].navigation.entries).toHaveLength(64);
    expect(state.windows['standard-window-1'].navigation.entries[0]).toBe('page-7');
    expect(state.windows['standard-window-1'].navigation.entries.at(-1)).toBe('page-70');
  });
});
