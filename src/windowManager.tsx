import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { fitBounds, fitContentWidthBounds, initialBounds, WINDOW_IDS, windowSpec, type Size, type WindowId } from './windowGeometry';
import type { Rect } from './motion';

export type Phase = 'closed' | 'visible' | 'minimizing' | 'minimized' | 'restoring';
export const MAX_OPEN_APP_WINDOWS = 2;
export type OpenAppLimitPrompt = { requestedTitle: string; openAppTitles: string[] };
/** Ephemeral opaque route keys; app page data remains inside the app. */
export type WindowNavigation = { entries: string[]; index: number };
const MAX_WINDOW_NAVIGATION_ENTRIES = 64;
export type ManagedWindow = {
  id: WindowId; title: string; phase: Phase; presentation: 'normal' | 'fullscreen'; normalBounds: Rect;
  busy: boolean; modal: boolean; interaction: 'idle' | 'moving' | 'resizing'; userResized: boolean; navigation: WindowNavigation;
};
export type DesktopState = { size: Size; windows: Record<WindowId, ManagedWindow>; order: WindowId[]; overview: boolean; openAppLimit: OpenAppLimitPrompt | null };
export function createDesktop(size: Size): DesktopState {
  const window = (id: WindowId): ManagedWindow => ({ id, title: windowSpec(id).title, phase: 'closed', presentation: 'normal', normalBounds: initialBounds(id, size), busy: false, modal: false, interaction: 'idle', userResized: false, navigation: { entries: [], index: -1 } });
  return { size, windows: Object.fromEntries(WINDOW_IDS.map(id => [id, window(id)])) as Record<WindowId, ManagedWindow>, order: [], overview: false, openAppLimit: null };
}
export function activeWindow(state: DesktopState): WindowId | undefined {
  return [...state.order].reverse().find(id => state.windows[id].phase === 'visible');
}
export type WindowAction =
  | { type: 'register'; id: WindowId; title: string }
  | { type: 'fit-content-width'; id: WindowId; preferredContentWidth: number; hasModuleSidebar: boolean }
  | { type: 'unregister'; id: WindowId }
  | { type: 'overview'; open: boolean }
  | { type: 'focus'; id: WindowId }
  | { type: 'phase'; id: WindowId; phase: Phase }
  | { type: 'patch'; id: WindowId; patch: Partial<Pick<ManagedWindow, 'normalBounds' | 'busy' | 'modal' | 'interaction' | 'userResized'>> }
  | { type: 'navigation-push'; id: WindowId; entry: string }
  | { type: 'navigation-reset'; id: WindowId; entry: string }
  | { type: 'navigation-sync'; id: WindowId; navigation: WindowNavigation }
  | { type: 'navigation-back'; id: WindowId }
  | { type: 'navigation-forward'; id: WindowId }
  | { type: 'toggle'; id: WindowId }
  | { type: 'dismiss-open-app-limit' }
  | { type: 'viewport'; size: Size };

export function desktopReducer(state: DesktopState, action: WindowAction): DesktopState {
  if (action.type === 'register') {
    const prior = state.windows[action.id];
    if (prior) return prior.title === action.title ? state : { ...state, windows: { ...state.windows, [action.id]: { ...prior, title: action.title } } };
    return { ...state, windows: { ...state.windows, [action.id]: createWindow(action.id, action.title, state.size) } };
  }
  if (action.type === 'unregister') {
    const prior = state.windows[action.id];
    if (!prior || prior.phase !== 'closed') return state;
    const windows = { ...state.windows }; delete windows[action.id];
    return { ...state, windows, order: state.order.filter(id => id !== action.id) };
  }
  if (action.type === 'fit-content-width') {
    const win = state.windows[action.id];
    if (!win || win.phase !== 'closed' || win.userResized) return state;
    return { ...state, windows: { ...state.windows, [action.id]: { ...win,
      normalBounds: fitContentWidthBounds(win.normalBounds, state.size, windowSpec(action.id).minimum, action.preferredContentWidth, action.hasModuleSidebar) } } };
  }
  if (action.type === 'overview') return { ...state, overview: action.open };
  if (action.type === 'dismiss-open-app-limit') return state.openAppLimit ? { ...state, openAppLimit: null } : state;
  if (action.type === 'viewport') {
    const windows = { ...state.windows };
    for (const id of Object.keys(windows) as WindowId[]) windows[id] = { ...windows[id], normalBounds: fitBounds(windows[id].normalBounds, action.size, windowSpec(id).minimum), interaction: 'idle' };
    return { ...state, size: action.size, windows };
  }
  const win = state.windows[action.id];
  if (!win) return state;
  const focus = () => [...state.order.filter(id => id !== action.id), action.id];
  if (action.type === 'focus') return win.phase === 'visible' ? { ...state, order: focus() } : state;
  if (action.type === 'toggle') {
    if (win.phase !== 'visible' || win.busy || win.modal || win.interaction !== 'idle') return state;
    return { ...state, order: focus(), windows: { ...state.windows, [action.id]: { ...win, presentation: win.presentation === 'normal' ? 'fullscreen' : 'normal' } } };
  }
  if (action.type === 'navigation-push') {
    let entries = [...win.navigation.entries.slice(0, win.navigation.index + 1), action.entry];
    if (entries.length > MAX_WINDOW_NAVIGATION_ENTRIES) entries = entries.slice(-MAX_WINDOW_NAVIGATION_ENTRIES);
    return { ...state, windows: { ...state.windows, [action.id]: { ...win, navigation: { entries, index: entries.length - 1 } } } };
  }
  if (action.type === 'navigation-reset') {
    return { ...state, windows: { ...state.windows, [action.id]: { ...win, navigation: { entries: [action.entry], index: 0 } } } };
  }
  if (action.type === 'navigation-sync') {
    const { entries, index } = action.navigation;
    if (!Array.isArray(entries) || entries.length > MAX_WINDOW_NAVIGATION_ENTRIES || !Number.isInteger(index) ||
        (entries.length === 0 ? index !== -1 : index < 0 || index >= entries.length)) return state;
    if (win.navigation.index === index && win.navigation.entries.length === entries.length &&
        win.navigation.entries.every((entry, position) => entry === entries[position])) return state;
    return { ...state, windows: { ...state.windows, [action.id]: { ...win, navigation: { entries: [...entries], index } } } };
  }
  if (action.type === 'navigation-back') {
    if (win.navigation.index <= 0) return state;
    return { ...state, windows: { ...state.windows, [action.id]: { ...win, navigation: { ...win.navigation, index: win.navigation.index - 1 } } } };
  }
  if (action.type === 'navigation-forward') {
    if (win.navigation.index >= win.navigation.entries.length - 1) return state;
    return { ...state, windows: { ...state.windows, [action.id]: { ...win, navigation: { ...win.navigation, index: win.navigation.index + 1 } } } };
  }
  if (action.type === 'patch') return { ...state, windows: { ...state.windows, [action.id]: { ...win, ...action.patch } } };
  const closed = action.phase === 'closed';
  const reopening = win.phase === 'closed' && action.phase === 'visible';
  if (reopening) {
    const openWindows = Object.values(state.windows).filter(openWindow => openWindow.phase !== 'closed');
    if (openWindows.length >= MAX_OPEN_APP_WINDOWS) {
      return { ...state, openAppLimit: { requestedTitle: win.title, openAppTitles: openWindows.map(openWindow => openWindow.title) } };
    }
  }
  return { ...state,
    order: action.phase === 'visible' ? focus() : state.order,
    windows: { ...state.windows, [action.id]: { ...win, phase: action.phase, interaction: 'idle', ...(reopening ? { normalBounds: fitBounds(win.normalBounds, state.size, windowSpec(action.id).minimum) } : {}), ...(closed ? { presentation: 'normal', busy: false, modal: false, navigation: { entries: [], index: -1 } } : {}) } },
  };
}

function createWindow(id: WindowId, title: string, size: Size): ManagedWindow {
  return { id, title, phase: 'closed', presentation: 'normal', normalBounds: initialBounds(id, size), busy: false, modal: false, interaction: 'idle', userResized: false, navigation: { entries: [], index: -1 } };
}

type Manager = { state: DesktopState; getState(): DesktopState; dispatch(action: WindowAction): void };
const Context = createContext<Manager | null>(null);
export function WindowManagerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(() => createDesktop({ width: innerWidth, height: innerHeight }));
  const current = useRef(state);
  const dispatch = useCallback((action: WindowAction) => {
    current.current = desktopReducer(current.current, action);
    setState(current.current);
  }, []);
  const getState = useCallback(() => current.current, []);
  const lastFocus = useRef(new Map<WindowId, HTMLElement>());
  useEffect(() => {
    const remember = (event: FocusEvent) => {
      const element = event.target as HTMLElement;
      const frame = element.closest<HTMLElement>('[data-window-id]');
      const id = frame?.dataset.windowId as WindowId | undefined;
      if (id && current.current.windows[id]?.phase === 'visible') {
        lastFocus.current.set(id, element);
        if (activeWindow(current.current) !== id) dispatch({ type: 'focus', id });
      }
    };
    document.addEventListener('focusin', remember);
    return () => document.removeEventListener('focusin', remember);
  }, [dispatch]);
  const active = activeWindow(state);
  const restoreAppFocus = useCallback(() => {
    if (current.current.overview) return;
    const active = activeWindow(current.current);
    if (!active) return;
    const frame = document.querySelector<HTMLElement>(`[data-window-id="${active}"]`);
    const remembered = lastFocus.current.get(active);
    const target = remembered?.isConnected && !remembered.closest('[inert],[hidden]') && !remembered.matches(':disabled') ? remembered
      : frame?.querySelector<HTMLElement>('.record-modal-layer:not([hidden]) input') ?? frame?.querySelector<HTMLElement>('.add-record,[data-app-focus],[data-testid="increment"]');
    target?.focus({ preventScroll: true });
  }, []);
  useEffect(() => { restoreAppFocus(); }, [active, state.overview, restoreAppFocus]);
  useEffect(() => {
    let suspended = false;
    const resize = () => {
      if (suspended || current.current.size.width === innerWidth && current.current.size.height === innerHeight) return;
      dispatch({ type: 'viewport', size: { width: innerWidth, height: innerHeight } });
    };
    const unsubscribe = window.desktop?.onHostTransition(value => { suspended = value; if (!value) { resize(); restoreAppFocus(); } });
    window.addEventListener('resize', resize);
    return () => { unsubscribe?.(); window.removeEventListener('resize', resize); };
  }, [dispatch, restoreAppFocus]);
  const value = useMemo(() => ({ state, dispatch, getState }), [state, dispatch, getState]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useWindowManager() {
  const manager = useContext(Context);
  if (!manager) throw new Error('Window manager provider required');
  return manager;
}
