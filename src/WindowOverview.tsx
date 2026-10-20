import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import type { WindowController } from './ManagedWindow';
import { useWindowManager } from './windowManager';
import type { WindowId } from './windowGeometry';
import { dockArtwork } from './dockArtwork';
import { overviewLayout } from './overviewLayout';

/** Read-only DOM image of a visible window, including unsaved form values.
 * Clones have no handlers, IDs, test identities, or accessible controls. */
function WindowPreview({ controller }: { controller: WindowController }) {
  const host = useRef<HTMLDivElement>(null);
  const [revision,setRevision]=useState(0);
  useEffect(()=>{const update=()=>setRevision(n=>n+1);window.addEventListener('runtime:snapshot',update);return()=>window.removeEventListener('runtime:snapshot',update);},[]);
  useLayoutEffect(() => {
    const source = controller.windowRef.current, container = host.current;
    if (!source || !container) return;
    const clone = source.cloneNode(true) as HTMLElement;
    const fields = source.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select');
    clone.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input,textarea,select').forEach((field, index) => {
      field.value = fields[index].value;
      if (field instanceof HTMLInputElement && fields[index] instanceof HTMLInputElement) field.checked = (fields[index] as HTMLInputElement).checked;
    });
    [clone, ...clone.querySelectorAll<HTMLElement>('*')].forEach(element => {
      for (const attribute of ['id', 'for', 'data-testid', 'data-window-id', 'aria-labelledby', 'aria-controls', 'data-runtime', 'data-runtime-phase']) element.removeAttribute(attribute);
    });
    clone.inert = true; clone.setAttribute('aria-hidden', 'true');
    const bounds = source.getBoundingClientRect();
    Object.assign(clone.style, { position: 'absolute', width: `${bounds.width}px`, height: `${bounds.height}px`, visibility: 'visible', transformOrigin: 'top left', pointerEvents: 'none', zIndex: '0', boxShadow: 'none' });
    container.replaceChildren(clone);
    const fit = () => {
      const scale = Math.min(container.clientWidth / bounds.width, container.clientHeight / bounds.height);
      Object.assign(clone.style, { transform: `scale(${scale})`, left: `${(container.clientWidth - bounds.width * scale) / 2}px`, top: `${(container.clientHeight - bounds.height * scale) / 2}px` });
    };
    fit(); const observer = new ResizeObserver(fit); observer.observe(container);
    return () => { observer.disconnect(); container.replaceChildren(); };
  }, [controller.id, controller.windowRef, controller.bounds.width, controller.bounds.height, revision]);
  return <div className="overview-preview" ref={host} aria-hidden="true" inert/>;
}

export function WindowOverview({ controllers, onClose }: { controllers: Record<WindowId, WindowController>; onClose(): void }) {
  const { state } = useWindowManager();
  const grid = useRef<HTMLDivElement>(null), close = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [area, setArea] = useState({ width: 1, height: 1, viewportHeight: 1 });
  const ids = [...state.order].reverse().filter(id => ['visible', 'minimized'].includes(state.windows[id].phase));
  useLayoutEffect(() => {
    const element = stage.current!;
    const measure = () => {
      const width = Math.min(1160, element.clientWidth - 12);
      const rows = Math.ceil(ids.length / Math.max(1, Math.floor(width / 250)));
      setArea({ width, viewportHeight: element.clientHeight - 12, height: Math.max(360, element.clientHeight - 12, rows * 180 + Math.max(0, rows - 1) * 32) });
    };
    measure(); const observer = new ResizeObserver(measure); observer.observe(element);
    return () => observer.disconnect();
  }, [ids.length]);
  const positions = overviewLayout(ids.map(id => {
    const window = state.windows[id];
    return window.presentation === 'fullscreen' ? state.size : window.normalBounds;
  }), area);
  // Center within a fitting screen, but start scrollable collections at the top.
  const offset = positions.length && area.height > area.viewportHeight ? Math.min(...positions.map(p => p.y)) : 0;
  const layout = positions.map(p => ({ ...p, y: p.y - offset }));
  const contentHeight = offset ? Math.max(...layout.map(p => p.y + p.height + 66)) : area.height;
  useLayoutEffect(() => { (grid.current?.querySelector<HTMLButtonElement>('button') ?? close.current)?.focus({ preventScroll: true }); }, []);
  function select(id: WindowId) {
    onClose();
    // Let the overlay disappear and background inert state clear before restoring Genie.
    requestAnimationFrame(() => controllers[id].open());
  }
  function keys(event: KeyboardEvent<HTMLElement>) {
    const cards = [...(grid.current?.querySelectorAll<HTMLButtonElement>('.overview-card') ?? [])];
    const index = cards.indexOf(document.activeElement as HTMLButtonElement);
    if (index >= 0 && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault();
      let next = event.key === 'Home' ? 0 : event.key === 'End' ? cards.length - 1 : (index + (event.key === 'ArrowLeft' ? -1 : 1) + cards.length) % cards.length;
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        const current = layout[index], rows = Math.max(...layout.map(p => p.row)) + 1;
        const row = (current.row + (event.key === 'ArrowUp' ? -1 : 1) + rows) % rows;
        next = layout.map((p, i) => ({ i, row: p.row, distance: Math.abs(p.x + p.width / 2 - current.x - current.width / 2) })).filter(p => p.row === row).sort((a, b) => a.distance - b.distance)[0].i;
      }
      cards[next]?.focus();
    }
    if (event.key === 'Tab') {
      const first = close.current, last = cards.at(-1) ?? first;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    }
  }
  return <section className="window-overview" role="dialog" aria-modal="true" aria-labelledby="overview-title" onKeyDown={keys}>
    <header className="overview-heading"><div><h2 id="overview-title">Open windows</h2><p>Select a window to return to your work. Press ` or Escape to exit.</p></div><button ref={close} onClick={onClose} aria-label="Close window overview"><X size={22}/></button></header>
    <div className="overview-scroll" ref={stage}><div className="overview-grid" ref={grid} style={{ width: area.width, height: contentHeight }}>
      {ids.map((id, index) => <button className="overview-card" key={id} style={{ left: layout[index].x, top: layout[index].y, width: layout[index].width, height: layout[index].height + 66 }} aria-label={`Switch to ${state.windows[id].title}`} onClick={() => select(id)}>
        <div className="overview-window" style={{ height: layout[index].height }}>
        {state.windows[id].phase === 'minimized' ? <div className="overview-preview"><img className={controllers[id].snapshot ? 'overview-snapshot' : 'overview-fallback'} src={controllers[id].snapshot ?? dockArtwork(id)} alt=""/></div> : <WindowPreview controller={controllers[id]}/>}
        </div>
        <span className="overview-caption"><img src={dockArtwork(id)} alt=""/><span>{state.windows[id].title}</span>{state.windows[id].phase === 'minimized' && <small>Minimized</small>}</span>
      </button>)}
      {!ids.length && <div className="overview-empty"><h3>No open windows</h3><p>Close this overview and open an app from the dock.</p></div>}
    </div></div>
  </section>;
}
