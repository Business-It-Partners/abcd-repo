import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Check, ChevronRight, Layers, Minus, Power, Plus, RotateCcw, Sparkles, Table2 } from 'lucide-react';
import { DOCK, Spring, clamp, dockHeight, dockLayout, type DockSpec } from './motion';
import { FollowupsApp } from './FollowupsApp';
import { FinanceApp } from './FinanceApp';
import { StaffApp } from './StaffApp';
import { LabApp } from './LabApp';
import { StoreApp, catalogIds, type StoreJob } from './StoreApp';
import { celebrateStoreArrival } from './storeArrival';
import { DeliveryStore, useDeliveryStore } from './DeliveryStore';
import { sampleWindows } from '../electron/distribution/contracts';
import { RuntimeFixtures } from './RuntimeFixtures';
import { WindowOverview } from './WindowOverview';
import { RecordsApp } from './RecordsApp';
import { ManagedWindowFrame } from './ManagedWindow';
import { useAppWindows } from './useAppWindows';
import { WINDOW_IDS, WINDOW_SPECS, type WindowId } from './windowGeometry';
import { dockArtwork } from './dockArtwork';
import { activeWindow, useWindowManager, WindowManagerProvider } from './windowManager';

const wallpaperUrl = new URL('./assets/fewa-turquoise-shore.jpg', import.meta.url).href;
const runtimeFixtures = new URLSearchParams(location.search).get('runtimeFixtures') === '1';
const fixtures = new URLSearchParams(location.search).get('prototypeFixtures') === '1';
const makeIcons = (ids: WindowId[]) => ids.map(id => ({ id, label: WINDOW_SPECS[id].title, color: id === 'studio' ? 'coral' : id === 'records' ? 'blue' : id === 'followups' ? 'teal' : '' }));
const previewId = (id: WindowId) => id === 'studio' ? 'preview' : `${id}-preview`;
const isPrototype = (id: WindowId) => id === 'studio' || id === 'records' || id === 'followups';
function useDock(size: { width: number; height: number }, frozen: boolean, specs: DockSpec[]) {
  const [field, setField] = useState({ x: null as number | null, intensity: 0 });
  const motion = useRef({ cursor: new Spring(1200), intensity: new Spring(700), inside: false, raf: 0, previous: 0 });
  const frozenRef = useRef(frozen); frozenRef.current = frozen;
  const run = useCallback(() => {
    const m = motion.current;
    if (m.raf || frozenRef.current) return;
    m.previous = performance.now();
    const tick = (time: number) => {
      m.raf = 0;
      if (frozenRef.current) return;
      const dt = (time - m.previous) / 1000; m.previous = time;
      m.cursor.tick(dt); m.intensity.tick(dt);
      setField({ x: m.intensity.value > .0035 ? m.cursor.value : null, intensity: clamp(m.intensity.value) });
      if (!m.cursor.settled || !m.intensity.settled) m.raf = requestAnimationFrame(tick);
    };
    m.raf = requestAnimationFrame(tick);
  }, []);
  useEffect(() => { if (!frozen) run(); }, [frozen, run]);
  useEffect(() => () => { cancelAnimationFrame(motion.current.raf); motion.current.raf = 0; }, []);
  const reset = useCallback(() => {
    const m = motion.current;
    cancelAnimationFrame(m.raf); m.raf = 0; m.inside = false;
    m.intensity.snap(0); setField({ x: null, intensity: 0 });
  }, []);
  return {
    reset,
    layout: dockLayout(specs, size.width / 2, size.height - DOCK.bottom - DOCK.verticalPad, field.x, field.intensity, size.width - 24 - 2 * DOCK.pad),
    move(x: number) {
      if (frozenRef.current) return;
      const m = motion.current;
      if (!m.inside) { m.inside = true; m.cursor.snap(x); m.intensity.target = 1; }
      if (Math.abs(x - m.cursor.target) >= .4) m.cursor.target = x;
      run();
    },
    leave() { const m = motion.current; m.inside = false; m.intensity.target = 0; run(); },
  };
}

export function App() { return <WindowManagerProvider><Desktop /></WindowManagerProvider>; }
function Desktop() {
  const { state, dispatch, getState } = useWindowManager(), size = state.size;
  const { targets, controllers } = useAppWindows();
  const { studio, records, followups } = controllers;
  const phase = studio.win.phase;
  const [installed, setInstalled] = useState<WindowId[]>(catalogIds.filter(id => id !== 'calendar' && id !== 'protocols'));
  const delivery = useDeliveryStore(!fixtures, id=>{const windowId=sampleWindows[id];if(!windowId||getState().windows[windowId].phase!=='closed')return;setReservation(0);setReadyId(null);setArrivalId(windowId);});
  const deliveredIds = delivery.installedOrder.filter(id=>sampleWindows[id]).map(id=>sampleWindows[id]);
  const icons = makeIcons(fixtures ? WINDOW_IDS : ['store', ...deliveredIds]);
  const pendingArrivalId=delivery.installingId?sampleWindows[delivery.installingId]:undefined;
  const [updates, setUpdates] = useState<WindowId[]>(['staff', 'lab']);
  const [job, setJob] = useState<StoreJob|null>(null);
  const [storeMessage, setStoreMessage] = useState('');
  const queue = useRef<WindowId[]>([]);
  const [reservation,setReservation]=useState(1);
  const [readyId,setReadyId]=useState<WindowId|null>(null);
  const [updatedId,setUpdatedId]=useState<WindowId|null>(null);
  const finishArrival=useRef<(()=>void)|undefined>(undefined);
  const [arrivalId, setArrivalId] = useState<WindowId|null>(null);
  function startStoreJob(id:WindowId, update = false) { if(job || arrivalId) return; setStoreMessage(''); setJob({id, update, progress:0}); }
  useEffect(() => {
    if(!job) return;
    const timer = setTimeout(() => {
      if(job.progress < 100) { setJob({...job,progress:Math.min(100,job.progress+10)}); return; }
      if(job.update) { setUpdatedId(job.id);setUpdates(old=>old.filter(id=>id!==job.id)); setStoreMessage(`${WINDOW_SPECS[job.id].title} updated.`); }
      else { setReservation(0);setReadyId(null);setInstalled(old=>old.includes(job.id)?old:[...old,job.id]); setArrivalId(job.id); setStoreMessage(`${WINDOW_SPECS[job.id].title} installed.`); }
      const next=queue.current.shift(); setJob(next?{id:next,update:true,progress:0}:null);
    }, job.progress===100?350:260);
    return ()=>clearTimeout(timer);
  },[job]);

  useEffect(()=>{
    if(!arrivalId){setReservation(1);return;}
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){setReservation(1);return;}
    let raf=0;const start=performance.now();
    const tick=(time:number)=>{const t=Math.min(1,(time-start)/320);setReservation(t*t*(3-2*t));if(t<1)raf=requestAnimationFrame(tick);};
    raf=requestAnimationFrame(tick);return ()=>cancelAnimationFrame(raf);
  },[arrivalId]);
  useEffect(()=>{if(!readyId)return;const timer=setTimeout(()=>setReadyId(null),5000);return ()=>clearTimeout(timer);},[readyId]);
  useEffect(()=>{if(!updatedId)return;const timer=setTimeout(()=>setUpdatedId(null),900);return ()=>clearTimeout(timer);},[updatedId]);
  function openStoreApp(id:WindowId){if(arrivalId){finishArrival.current?.();setArrivalId(null);}setReadyId(null);controllers[id].open();}

  // Reserve a thumbnail destination synchronously when capture starts, before
  // measuring Genie geometry. In normal use, previews appear only for minimized apps.
  const hasPreview = (id: WindowId) => fixtures && isPrototype(id) || state.windows[id].busy || ['minimizing', 'minimized', 'restoring'].includes(state.windows[id].phase);
  const specs: DockSpec[] = [{ id: 'host-minimize', width: DOCK.size, height: DOCK.size }, { id: 'host-shutdown', width: DOCK.size, height: DOCK.size }, { id: 'control-divider', width: .9, height: 28.8, magnifies: false }, ...icons.map(i => ({ id: i.id, width: DOCK.size*(i.id===arrivalId?reservation:i.id===pendingArrivalId?0:1), height: DOCK.size })),
    ...(icons.some(icon => hasPreview(icon.id)) ? [{ id: 'divider', width: .9, height: 28.8, magnifies: false }] : []),
    ...icons.map(icon => icon.id).filter(hasPreview).map(id => ({ id: previewId(id), width: DOCK.previewWidth, height: DOCK.previewHeight }))];
  const anyMotion = Object.values(state.windows).some(win => win.busy);
  const [count, setCount] = useState(0);
  const [note, setNote] = useState('A little space to make something great.');
  const [dockRevealed, setDockRevealed] = useState(false);
  const [hostActionPending, setHostActionPending] = useState(false);
  const hostActionLock = useRef(false);
  const [hostTransitioning, setHostTransitioning] = useState(false);
  const frontApp = activeWindow(state);
  const immersive = !!frontApp && state.windows[frontApp].presentation === 'fullscreen';
  const showDock = !state.overview && (!immersive || dockRevealed || anyMotion || !!arrivalId);
  useEffect(() => { const edge=()=>setDockRevealed(true); window.addEventListener('runtime:dock-edge',edge); return()=>window.removeEventListener('runtime:dock-edge',edge); }, []);
  useEffect(() => { setDockRevealed(false); }, [immersive, frontApp]);
  function trackChrome(event: React.PointerEvent<HTMLElement>) {
    if (state.overview) return;
    const { clientX: px, clientY: py } = event;
    const target = event.target as HTMLElement;
    // Observe the hover field without a transparent surface over app windows.
    const overWindow = !!target.closest('[data-window-id]');
    const overDock = !!target.closest('.dock-region');
    if (showDock && Math.abs(px - size.width / 2) < dock.layout.width / 2 + DOCK.pad + 30 && py >= size.height - 154.8 && (!overWindow || overDock)) dock.move(px);
    else dock.leave();
    if (!immersive) return;
    const centered = Math.abs(px - size.width / 2) < dock.layout.width / 2 + DOCK.pad + 50;
    setDockRevealed(previous => centered && py >= size.height - (previous ? 180 : 6));
  }
  const arrivalViewport=useRef({...size});
  const dock = useDock(size, anyMotion || hostTransitioning || state.overview || !!arrivalId, specs);
  useLayoutEffect(() => {
    const resized=arrivalViewport.current.width!==size.width || arrivalViewport.current.height!==size.height;
    arrivalViewport.current={...size};
    if(!arrivalId) return;
    if(resized||state.overview||hostTransitioning||anyMotion||state.windows.store.phase!=='visible'){setArrivalId(null);setReadyId(arrivalId);return;}
    dock.reset();
    const media=matchMedia('(prefers-reduced-motion: reduce)');
    const reduce=()=>{if(media.matches){setArrivalId(null);setReadyId(arrivalId);}};
    media.addEventListener('change',reduce);
    let disposeArrival: (()=>void)|undefined;
    const timer=setTimeout(()=>{
      const target=document.querySelector<HTMLElement>(`[data-dock-app="${arrivalId}"]`);
      const source=[...document.querySelectorAll<HTMLElement>(`[data-store-art="${arrivalId}"]`)].find(el=>{
        const r=el.getBoundingClientRect(), frame=el.closest('[data-window-id]')?.getBoundingClientRect();
        return !!frame && el.checkVisibility() && r.top>=frame.top+43 && r.bottom<=frame.bottom && r.left>=frame.left && r.right<=frame.right;
      });
      if(!source || !target || state.overview || hostTransitioning || matchMedia('(prefers-reduced-motion: reduce)').matches){setArrivalId(null);setReadyId(arrivalId);return;}
      try { disposeArrival=celebrateStoreArrival(source,target,()=>{setArrivalId(null);setReadyId(arrivalId);});finishArrival.current=disposeArrival; }
      catch { disposeArrival?.();setArrivalId(null);setReadyId(arrivalId); }
    },420);
    return ()=>{clearTimeout(timer);media.removeEventListener('change',reduce);disposeArrival?.();finishArrival.current=undefined;};
  },[arrivalId, state.overview, hostTransitioning, size.width, size.height, anyMotion, state.windows.store.phase, dock.reset]);
  const overviewShortcutEnabled = useRef(true);
  useEffect(() => { let active = true; void window.desktop?.preferences().then(value => { if (active) overviewShortcutEnabled.current = value.overviewShortcutEnabled; }).catch(() => { overviewShortcutEnabled.current = false; }); return () => { active = false; }; }, []);
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const current = getState();
      const toggle = (event.code === 'Backquote' || event.key === '`') && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey && !event.isComposing;
      if (toggle && !overviewShortcutEnabled.current) return;
      if (!toggle && !(event.key === 'Escape' && current.overview)) return;
      event.preventDefault(); event.stopImmediatePropagation();
      if (event.repeat || hostTransitioning || Object.values(current.windows).some(win => win.busy || win.interaction !== 'idle')) return;
      if (!current.overview) { dock.reset(); setDockRevealed(false); }
      dispatch({ type: 'overview', open: !current.overview });
    };
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, [dispatch, getState, hostTransitioning, dock.reset]);
  useEffect(() => window.desktop?.onHostTransition(value => {
    setHostTransitioning(value);
    if (value) { dock.reset(); setDockRevealed(false); }
  }), [dock.reset]);


  async function controlHost(action: 'minimize' | 'close') {
    if (anyMotion || hostTransitioning || hostActionLock.current) return;
    hostActionLock.current = true; setHostActionPending(true);
    dock.reset(); setDockRevealed(false);
    try { await window.desktop?.control(action); }
    finally { hostActionLock.current = false; setHostActionPending(false); }
  }
  return <main className={`desktop ${immersive ? 'is-immersive' : ''}`} data-phase={phase} data-motion={anyMotion} data-overview={state.overview} style={hostTransitioning ? { width: size.width, height: size.height } : undefined} onPointerMove={trackChrome} onPointerLeave={() => { setDockRevealed(false); dock.leave(); }}>
    <img className="wallpaper" src={wallpaperUrl} alt="" aria-hidden="true"/>
    {(runtimeFixtures || !fixtures) && <RuntimeFixtures controllers={{studio,records}} blocked={state.overview || anyMotion || hostTransitioning || Object.values(state.windows).some(w=>w.interaction!=='idle')}/> }
    {fixtures && !runtimeFixtures && <ManagedWindowFrame controller={studio}>
      <div className="studio-body">
        <aside className="studio-sidebar"><span className="sidebar-heading">WORKSPACE</span><div className="sidebar-active"><Sparkles size={15}/>Canvas<ChevronRight size={13}/></div><div className="sidebar-item"><Layers size={15}/>Collections</div><div className="sidebar-item"><RotateCcw size={15}/>History</div><div className="sidebar-bottom"><span className="avatar">Y</span><div>Your workspace<small>Everything stays here</small></div></div></aside>
        <div className="studio-content"><div className="content-top"><span className="eyebrow">A SMALL EXPERIMENT</span><span className="saved"><Check size={12}/> In memory</span></div><h2>Make room for ideas.</h2><p className="content-description">One window. A little state. A different way to move.</p>
          <div className="art-card"><div className="art-disc"/><div className="art-arch"/><div className="art-orbit"/><span>FORM<br/>FOLLOWS<br/>FEELING.</span><span className="art-index">01 — MOTION STUDY</span></div>
          <div className="note-row"><label htmlFor="note">YOUR NOTE</label><input id="note" value={note} onChange={e => setNote(e.target.value)} spellCheck={false}/></div>
          <div className="studio-footer"><span>Minimize. Restore. Pick up where you left off.</span><button data-testid="increment" onClick={() => setCount(n => n + 1)}><Plus size={13}/><span data-testid="counter">{count}</span> ideas</button></div>
        </div>
      </div>
    </ManagedWindowFrame>}
    {fixtures && !runtimeFixtures && <ManagedWindowFrame controller={records}><RecordsApp controller={records}/></ManagedWindowFrame>}
    <ManagedWindowFrame controller={followups}><FollowupsApp controller={followups}/></ManagedWindowFrame>
    {WINDOW_IDS.filter(id => !isPrototype(id)).map(id => <ManagedWindowFrame key={id} controller={controllers[id]}>
      {id === 'store' && !fixtures ? <DeliveryStore settling={!!arrivalId} view={delivery.view} action={delivery.action} open={openStoreApp} locked={anyMotion || hostTransitioning || Object.values(state.windows).some(w=>w.interaction!=='idle')}/> : id === 'store' ? <StoreApp locked={!!arrivalId || anyMotion || hostTransitioning || Object.values(state.windows).some(w=>w.interaction!=='idle')} uninstall={id=>{
        if(job || arrivalId || Object.values(getState().windows).some(w=>w.busy || w.interaction!=='idle'))return;
        dispatch({type:'phase',id,phase:'closed'});
        setInstalled(old=>old.filter(app=>app!==id));setUpdates(old=>old.filter(app=>app!==id));
        setStoreMessage(`${WINDOW_SPECS[id].title} uninstalled. Demo records retained for this session.`);
      }} installed={installed} updates={updates} job={job} message={storeMessage} start={startStoreJob} cancel={()=>{queue.current=[];setJob(null);setStoreMessage('Cancelled. You can try again.');}} open={openStoreApp} updateAll={()=>{if(job)return;const [first,...rest]=updates;queue.current=rest;if(first)startStoreJob(first,true);}}/> : id === 'lab' ? <LabApp controller={controllers.lab}/> : id === 'staff' ? <StaffApp controller={controllers.staff}/> : id === 'finance' ? <FinanceApp/> : <div className="coming-soon-body" data-app-focus tabIndex={-1}><img src={dockArtwork(id)} alt=""/><h2>{WINDOW_SPECS[id].title}</h2><p>Coming soon</p></div>}
    </ManagedWindowFrame>)}
    <nav className={`dock-region ${showDock ? 'chrome-shown' : 'chrome-hidden'}`} inert={!showDock} aria-label="Application dock">
      <div className="dock-hit-zone" style={{ left: dock.layout.left - DOCK.pad, top: size.height - DOCK.bottom - dockHeight, width: dock.layout.width + DOCK.pad * 2, height: DOCK.bottom + dockHeight }}/>
      <div className="dock-pill" style={{ left: dock.layout.left - DOCK.pad, width: dock.layout.width + 2 * DOCK.pad, top: size.height - DOCK.bottom - dockHeight, height: dockHeight }}/>
      {dock.layout.items.map(item => {
        const style = { left: item.x, top: item.y, width: item.width, height: item.height };
        if (item.id === 'host-minimize' || item.id === 'host-shutdown') {
          const minimize = item.id === 'host-minimize', label = minimize ? 'Minimize Electron OS' : 'Shut down Electron OS';
          return <button key={item.id} className={`dock-icon system-icon ${minimize ? 'host-minimize' : 'host-shutdown'}`} style={style} aria-label={label} disabled={anyMotion || hostActionPending || hostTransitioning} onClick={() => void controlHost(minimize ? 'minimize' : 'close')}>
            {minimize ? <Minus style={{ width: '56%', height: '56%' }} strokeWidth={2.2}/> : <Power style={{ width: '56%', height: '56%' }} strokeWidth={1.9}/>}<span className="dock-caption">{label}</span>
          </button>;
        }
        if (item.id === 'divider' || item.id === 'control-divider') return <span key={item.id} className="dock-divider" style={style}/>;
        const previewApp = WINDOW_IDS.find(id => previewId(id) === item.id);
        if (previewApp) {
          const controller = controllers[previewApp], title = WINDOW_SPECS[previewApp].title;
          return <button ref={targets[previewApp]} key={item.id} className="dock-preview" style={style} onClick={controller.open} disabled={anyMotion || hostActionPending || hostTransitioning} aria-label={controller.win.phase === 'minimized' ? `Restore ${title}` : `Open ${title} preview`}>
            {controller.snapshot ? <img src={controller.snapshot} alt={`${title} snapshot`}/> : <div className="preview-empty">{previewApp === 'studio' ? <Layers size={21}/> : previewApp === 'records' ? <Table2 size={21}/> : <img className="preview-artwork" src={dockArtwork(previewApp)} alt=""/>}</div>}<span className="dock-caption">{title}</span>
          </button>;
        }
        const icon = icons.find(i => i.id === item.id)!;
        return <button data-dock-app={icon.id} ref={hasPreview(icon.id) ? undefined : targets[icon.id]} key={item.id} className={`dock-icon ${icon.id === 'studio' || icon.id === 'records' ? '' : 'image-icon'} ${icon.color} ${updatedId===icon.id?'store-update-pulse':''}`} style={{...style, visibility: arrivalId===icon.id||pendingArrivalId===icon.id ? 'hidden' : undefined}} aria-label={icon.label} disabled={anyMotion || hostActionPending || hostTransitioning} onClick={()=>openStoreApp(icon.id)}>
          {icon.id === 'studio' ? <Layers size={21}/> : icon.id === 'records' ? <Table2 size={21}/> : <img className="dock-artwork" src={dockArtwork(icon.id)} alt="" draggable={false}/>}<span className="dock-caption">{icon.label}</span>
          {state.windows[icon.id].phase !== 'closed' && <span className="running-dot"/>}
        </button>;
      })}
    </nav>
    {readyId && !state.overview && !hostTransitioning && <div className="store-ready" role="status" style={{left: Math.max(12,Math.min(size.width-235,(dock.layout.items.find(item=>item.id===readyId)?.x??size.width/2)-90)),bottom:dockHeight+22}}><img src={dockArtwork(readyId)} alt=""/><span>{WINDOW_SPECS[readyId].title}<small>Ready to open</small></span><button aria-label={`Open ${WINDOW_SPECS[readyId].title} from dock`} onClick={()=>openStoreApp(readyId)}>Open</button><button aria-label="Dismiss app ready" onClick={()=>setReadyId(null)}>×</button></div>}
    {immersive && !state.overview && <div className="dock-reveal-edge" onPointerEnter={() => setDockRevealed(true)}/>}
    {state.overview && <WindowOverview controllers={controllers} onClose={() => dispatch({ type: 'overview', open: false })}/>}
    <div className="desktop-footnote"><span className="experiment-dot"/> ELECTRON / TYPESCRIPT<span className="footnote-line"/>DOCK + GENIE</div>
  </main>;
}
