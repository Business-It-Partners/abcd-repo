import { useSessionGeneration } from './SessionBoundary';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type RefObject } from 'react';
import { flushSync } from 'react-dom';
import { prepareGenie } from './genie';
import { dockZoneTop, fitBounds, maximizedBounds, moveBounds, resizeBounds, windowSpec, type ResizeEdge, type Size, type WindowId } from './windowGeometry';
import { activeWindow, useWindowManager } from './windowManager';
import { WindowTitleBar } from './WindowTitleBar';
import type { Rect } from './motion';

const edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];
const privateFilesSnapshot = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="1040" height="630"><rect width="1040" height="630" rx="18" fill="#e7f2f4"/><rect x="54" y="54" width="930" height="520" rx="22" fill="#ffffff" stroke="#c1dce3"/><path d="M427 285h75l29 25h93v86H427z" fill="#4b9ab2"/><text x="520" y="443" font-size="28" text-anchor="middle" font-family="sans-serif" fill="#376378">Files</text></svg>'
);

const rectOf = (el: HTMLElement): Rect => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
type Gesture = { pointerId: number; element: HTMLElement; bounds: Rect; size: Size; px: number; py: number; edge?: ResizeEdge; cursor: string; selection: string };

/** One lifecycle/animation/gesture implementation shared by every internal app. */
export function useManagedWindow(id: WindowId, target: RefObject<HTMLButtonElement | null>) {
  const sessionGeneration = useSessionGeneration();
  const manager = useWindowManager(), { state, dispatch, getState } = manager;
  const win = state.windows[id], active = activeWindow(state) === id;
  const windowRef = useRef<HTMLElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const snapshotRef = useRef<string | undefined>(undefined), [snapshot, setSnapshot] = useState<string>();
  const closeGuard = useRef<(() => boolean) | undefined>(undefined);
  const setCloseGuard = (guard?: () => boolean) => { closeGuard.current = guard; };
  const generation = useRef(0), animation = useRef<ReturnType<typeof prepareGenie> | null>(null);
  const gesture = useRef<Gesture | null>(null);
  const anyBusy = Object.values(state.windows).some(w => w.busy);
  const bounds = win.presentation === 'fullscreen' ? maximizedBounds(state.size) : win.normalBounds;
  const patch = (value: Parameters<typeof dispatch>[0] & { type: 'patch' }) => dispatch(value);
  const focus = () => dispatch({ type: 'focus', id });
  const setModal = (modal: boolean) => dispatch({ type: 'patch', id, patch: { modal } });

  function endGesture(cancel = false) {
    const g = gesture.current;
    if (!g) return;
    gesture.current = null;
    document.body.style.cursor = g.cursor; document.body.style.userSelect = g.selection;
    if (g.element.hasPointerCapture(g.pointerId)) g.element.releasePointerCapture(g.pointerId);
    dispatch({ type: 'patch', id, patch: { interaction: 'idle', ...(cancel ? { normalBounds: fitBounds(g.bounds, getState().size, windowSpec(id).minimum) } : {}) } });
  }
  useEffect(() => {
    const cancel = () => endGesture(true);
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape' && gesture.current) { event.preventDefault(); cancel(); } };
    const move = (event: PointerEvent) => moveGesture(event);
    const up = (event: PointerEvent) => {
      if (event.pointerId !== gesture.current?.pointerId) return;
      moveGesture(event); endGesture();
    };
    const pointerCancel = (event: PointerEvent) => { if (event.pointerId === gesture.current?.pointerId) cancel(); };
    window.addEventListener('blur', cancel); window.addEventListener('keydown', key);
    // Global routing also finishes a drag if Chromium releases capture early.
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', pointerCancel);
    return () => {
      window.removeEventListener('blur', cancel); window.removeEventListener('keydown', key);
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', pointerCancel);
      endGesture();
    };
  }, [dispatch, getState, id]);

  useEffect(() => {
    endGesture();
    generation.current++;
    animation.current?.dispose(); animation.current = null;
    const current = getState().windows[id];
    dispatch({ type: 'patch', id, patch: { busy: false } });
    if (current.phase === 'minimizing' || current.phase === 'restoring') dispatch({ type: 'phase', id, phase: 'visible' });
    // A hidden minimized app keeps its last real thumbnail when the display changes.
    // Restore measures the current fitted bounds and current dock destination.
    if (current.phase !== 'minimized') { snapshotRef.current = undefined; setSnapshot(undefined); }
    return () => { generation.current++; animation.current?.dispose(); animation.current = null; };
  }, [state.size.width, state.size.height, dispatch, getState, id]);

  function startGesture(event: ReactPointerEvent<HTMLElement>, edge?: ResizeEdge) {
    const current = getState(), w = current.windows[id];
    if (event.button !== 0 || w.phase !== 'visible' || w.presentation !== 'normal' || w.modal || Object.values(current.windows).some(w => w.busy || w.interaction !== 'idle')) return;
    if (!edge && (event.target as HTMLElement).closest('button,input,select,textarea,a')) return;
    // Native guest views sit above this renderer. Hide them synchronously before
    // the shell frame starts moving so they cannot trail behind or steal drag input.
    window.desktop?.runtime.hideAll(sessionGeneration);
    event.preventDefault(); event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    gesture.current = { element: event.currentTarget, pointerId: event.pointerId, bounds: { ...w.normalBounds }, size: { ...current.size }, px: event.clientX, py: event.clientY, edge, cursor: document.body.style.cursor, selection: document.body.style.userSelect };
    document.body.style.cursor = edge ? getComputedStyle(event.currentTarget).cursor : 'grabbing';
    document.body.style.userSelect = 'none';
    focus(); dispatch({ type: 'patch', id, patch: { interaction: edge ? 'resizing' : 'moving' } });
  }
  function moveGesture(event: { pointerId: number; clientX: number; clientY: number }) {
    const g = gesture.current;
    if (!g || event.pointerId !== g.pointerId) return;
    const dx = event.clientX - g.px, dy = event.clientY - g.py, size = getState().size;
    // The reducer already refits bounds on viewport changes. Never apply a
    // queued pointer-up delta from the old screen over those new bounds.
    if (size.width !== g.size.width || size.height !== g.size.height) { endGesture(); return; }
    const next = g.edge ? resizeBounds(g.bounds, g.edge, dx, dy, size, windowSpec(id).minimum)
      : moveBounds({ ...g.bounds, x: g.bounds.x + dx, y: g.bounds.y + dy }, size);
    patch({ type: 'patch', id, patch: { normalBounds: next } });
  }

  async function transition(minimizing: boolean) {
    const current = getState(), w = current.windows[id];
    if (w.phase !== (minimizing ? 'visible' : 'minimized') || w.modal || Object.values(current.windows).some(w => w.busy || w.interaction !== 'idle') || !windowRef.current || !target.current || !canvasRef.current) return;
    const token = ++generation.current;
    flushSync(() => dispatch({ type: 'patch', id, patch: { busy: true } }));
    try {
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const source = rectOf(windowRef.current), destination = rectOf(target.current);
      // Files preview never captures local filenames or thumbnails into persisted snapshots.
      const data = minimizing ? id === 'files' ? privateFilesSnapshot : await window.desktop?.capture(source, sessionGeneration) : snapshotRef.current;
      if (!data) return;
      const image = new Image(); image.src = data; await image.decode();
      if (generation.current !== token) return;
      snapshotRef.current = data; setSnapshot(data);
      const renderer = prepareGenie(canvasRef.current, image, source, destination);
      animation.current = renderer; renderer.draw(minimizing ? 0 : 1);
      flushSync(() => dispatch({ type: 'phase', id, phase: minimizing ? 'minimizing' : 'restoring' }));
      await renderer.play(minimizing);
    } catch { /* Capture/graphics failures settle through the same lifecycle. */ }
    finally {
      if (generation.current === token) {
        flushSync(() => {
          dispatch({ type: 'phase', id, phase: minimizing ? 'minimized' : 'visible' });
          dispatch({ type: 'patch', id, patch: { busy: false } });
        });
        animation.current?.dispose(); animation.current = null;
        if (!minimizing) windowRef.current?.querySelector<HTMLElement>('[data-testid="increment"],.add-record,[data-app-focus]')?.focus({ preventScroll: true });
      }
    }
  }
  function open() {
    if (Object.values(getState().windows).some(w => w.busy || w.interaction !== 'idle')) return;
    if (getState().windows[id].phase === 'minimized') { void transition(false); return; }
    dispatch({ type: 'phase', id, phase: 'visible' });
    const target = windowRef.current?.querySelector<HTMLElement>('.record-modal-layer:not([hidden]) input')
      ?? windowRef.current?.querySelector<HTMLElement>('.add-record,[data-app-focus],[data-testid="increment"]');
    target?.focus({ preventScroll: true });
  }
  function close() {
    if (closeGuard.current && !closeGuard.current()) return;
    const current = getState();
    if (current.windows[id].modal || Object.values(current.windows).some(w => w.busy || w.interaction !== 'idle')) return;
    snapshotRef.current = undefined; setSnapshot(undefined);
    dispatch({ type: 'phase', id, phase: 'closed' });
  }
  const toggleFullscreen = () => { if (!Object.values(getState().windows).some(w => w.busy || w.interaction !== 'idle')) dispatch({ type: 'toggle', id }); };
  return { id, win, bounds, active, anyBusy, snapshot, windowRef, canvasRef, focus, setModal, setCloseGuard, open, close, toggleFullscreen,
    minimize: () => void transition(true), startGesture };
}
export type WindowController = ReturnType<typeof useManagedWindow>;

export function ManagedWindowFrame({ controller: c, children, onClose, hideMinimize = false, titleBarLeading }: { controller: WindowController; children: ReactNode; onClose?:()=>void; hideMinimize?:boolean; titleBarLeading?: ReactNode }) {
  const fullscreen = c.win.presentation === 'fullscreen', visible = c.win.phase === 'visible';
  const sessionGeneration = useSessionGeneration();
  const manager = useWindowManager();
  const order = manager.state.order.indexOf(c.id);
  const clippedBottom = Math.max(0, c.bounds.y + c.bounds.height - dockZoneTop(manager.state.size));
  return <>
    <section ref={c.windowRef} className={`studio-window ${c.id === 'records' ? 'records-window' : ''}`} data-testid={`${c.id}-window`}
      data-window-id={c.id} data-phase={c.win.phase} data-presentation={c.win.presentation} data-interaction={c.win.interaction} data-active={c.active}
      inert={!visible || manager.state.overview} aria-hidden={!visible || manager.state.overview} onPointerDown={c.focus}
      style={{ left: c.bounds.x, top: c.bounds.y, width: c.bounds.width, height: c.bounds.height, clipPath: !fullscreen && clippedBottom ? `inset(0px 0px ${clippedBottom}px 0px)` : undefined, borderRadius: fullscreen ? 0 : undefined, borderWidth: fullscreen ? 0 : undefined, zIndex: 10 + Math.max(order, 0), visibility: visible ? 'visible' : 'hidden' }}>
      <WindowTitleBar title={c.win.title} active={c.active} maximized={fullscreen} disabled={c.anyBusy} inert={c.win.modal}
        onDrag={event => c.startGesture(event)} onClose={onClose ?? c.close} onMinimize={c.minimize} onToggleMaximize={c.toggleFullscreen} hideMinimize={hideMinimize} leadingControls={titleBarLeading}/>
      {children}
      {!fullscreen && !c.anyBusy && !c.win.modal && edges.map(edge => <div key={edge} className={`window-resize-handle resize-${edge}`} data-resize={edge}
        aria-hidden="true" onPointerDown={event => c.startGesture(event, edge)}/>)}
    </section>
    <canvas ref={c.canvasRef} className="genie-overlay" style={{ visibility: c.win.phase === 'minimizing' || c.win.phase === 'restoring' ? 'visible' : 'hidden' }} aria-hidden="true"/>
  </>;
}
