import { createRef, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { Check, ChevronRight, Layers, Plus, RotateCcw, Sparkles, Table2 } from 'lucide-react';
import { DOCK, Spring, clamp, dockHeightForWidth, dockLayout, dockScaleForWidth, type DockSpec } from './motion';
import { FollowupsApp } from './FollowupsApp';
import { FinanceApp, FINANCE_MODULES } from './FinanceApp';
import { StaffApp } from './StaffApp';
import { LabApp } from './LabApp';
import { StoreApp, catalogIds, type StoreJob } from './StoreApp';
import { celebrateStoreArrival } from './storeArrival';
import { DeliveryStore, useDeliveryStore } from './DeliveryStore';
import { sampleWindows } from '../electron/distribution/contracts';
import { packageIdForRuntime, runtimeIdForPackage } from '../electron/runtime/contracts';
import { defaultTableContentWidth } from './windowGeometry';
import { RuntimeFixtures } from './RuntimeFixtures';
import { WindowOverview } from './WindowOverview';
import { RecordsApp } from './RecordsApp';
import { FilesApp, type FilesImageRequest } from './FilesApp';
import { StandardWindow1 } from './StandardWindow1';
import { ImageViewer, type ViewerImage } from './ImageViewer';
import { FilesPickerModal } from './FilesPickerModal';
import type { FilePickerPrompt, FilePickerResponse } from '../electron/host/filePickerContract';
import './FilesApp.css';
import { ManagedWindowFrame, useManagedWindow } from './ManagedWindow';
import type { WindowController } from './ManagedWindow';
import { useAppWindows } from './useAppWindows';
import { statusBarHeightForWidth, WINDOW_IDS, windowSpec, type StaticWindowId, type WindowId } from './windowGeometry';
import { dockArtwork } from './dockArtwork';
import { StoreArtwork } from './StoreArtwork';
import { activeWindow, useWindowManager, WindowManagerProvider } from './windowManager';
import { DesktopChrome } from './DesktopChrome';
import type { SessionView } from '../electron/identity/contracts';

const wallpaperUrl = new URL('./assets/fewa-turquoise-shore.jpg', import.meta.url).href;
const runtimeFixtures = new URLSearchParams(location.search).get('runtimeFixtures') === '1';
const resourceFixtures = runtimeFixtures && new URLSearchParams(location.search).get('resourceFixtures') === '1';
const fixtures = new URLSearchParams(location.search).get('prototypeFixtures') === '1';
const makeIcons = (ids: string[], titles: Record<string,string>) => ids.map(id => ({ id, label: titles[id] ?? windowSpec(id).title, color: id === 'studio' ? 'coral' : id === 'records' ? 'blue' : id === 'followups' ? 'teal' : '' }));
const previewId = (id: WindowId) => id === 'studio' ? 'preview' : `${id}-preview`;
const isPrototype = (id: WindowId) => id === 'studio' || id === 'records' || id === 'followups';
function useDock(size: { width: number; height: number }, frozen: boolean, specs: DockSpec[], scale: number) {
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
    layout: dockLayout(specs, size.width / 2, size.height - DOCK.bottom - DOCK.verticalPad * scale + DOCK.verticalPad * scale * field.intensity, field.x, field.intensity, size.width - 24 * scale - 2 * DOCK.pad * scale, scale),
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

export function App({ session, sessionControls, onRequestClose, onRequestSignOut, leaveConfirmationOpen }: { session?: SessionView; sessionControls?: ReactNode; onRequestClose(): void; onRequestSignOut?: () => void; leaveConfirmationOpen: boolean }) { return <WindowManagerProvider><Desktop session={session} sessionControls={sessionControls} onRequestClose={onRequestClose} onRequestSignOut={onRequestSignOut} leaveConfirmationOpen={leaveConfirmationOpen}/></WindowManagerProvider>; }
function Desktop({ session, sessionControls, onRequestClose, onRequestSignOut, leaveConfirmationOpen }: { session?: SessionView; sessionControls?: ReactNode; onRequestClose(): void; onRequestSignOut?: () => void; leaveConfirmationOpen: boolean }) {
  const { state, dispatch, getState } = useWindowManager(), size = state.size;
  const dockScale = dockScaleForWidth(size.width), dockHeight = dockHeightForWidth(size.width);
  const { targets, controllers } = useAppWindows();
  const staticControllers=controllers as Record<string,WindowController>;
  const { studio, records, followups, files } = controllers;
  const viewerTarget=useMemo(()=>createRef<HTMLButtonElement>(),[]);
  const viewerController=useManagedWindow('image-viewer',viewerTarget);
  const [viewerImage,setViewerImage]=useState<ViewerImage|null>(null);
  const [viewerError,setViewerError]=useState('');
  const [viewerBusy,setViewerBusy]=useState(false);
  const viewerRequest=useRef(0);
  const phase = studio.win.phase;
  const [installed, setInstalled] = useState<StaticWindowId[]>(catalogIds.filter(id => id !== 'calendar' && id !== 'protocols'));
  const [dynamicControllerRefs,setDynamicControllerRefs]=useState<Record<string,MutableRefObject<WindowController>>>({});
  const onControllerRef=useCallback((id:string,ref:MutableRefObject<WindowController>|null)=>setDynamicControllerRefs(previous=>{if(ref){if(previous[id]===ref)return previous;return{...previous,[id]:ref};}if(!previous[id])return previous;const next={...previous};delete next[id];return next;}),[]);
  const dynamicControllers:Record<string,WindowController>=Object.fromEntries(Object.entries(dynamicControllerRefs).map(([id,ref])=>[id,ref.current]));
  const allControllers:Record<string,WindowController>={...staticControllers,...dynamicControllers};
  const closeViewer=()=>{
    viewerRequest.current++;
    if(viewerImage)void window.desktop?.files.viewerClose(viewerImage.sessionId,viewerImage.generation).catch(()=>{});
    setViewerImage(previous=>{previous?.bytes.fill(0);return null;});
    setViewerError('');setViewerBusy(false);viewerController.close();
  };
  const openViewer=async(request:FilesImageRequest)=>{
    if(!window.desktop?.files)return;
    const token=++viewerRequest.current;
    setViewerError('');setViewerBusy(true);
    if(viewerImage)void window.desktop.files.viewerClose(viewerImage.sessionId,viewerImage.generation).catch(()=>{});
    try{
      const image=await window.desktop.files.viewerOpen(request);
      if(viewerRequest.current!==token){
        image.bytes.fill(0);void window.desktop.files.viewerClose(image.sessionId,image.generation).catch(()=>{});return;
      }
      setViewerImage(previous=>{previous?.bytes.fill(0);return image;});viewerController.open();
    }catch{if(viewerRequest.current===token)setViewerError('Unable to safely open this picture. Refresh Files and try again.');}
    finally{if(viewerRequest.current===token)setViewerBusy(false);}
  };
  const stepViewer=async(direction:-1|1)=>{
    if(!viewerImage||viewerBusy||!window.desktop?.files)return;
    const token=++viewerRequest.current;
    setViewerBusy(true);setViewerError('');
    try{
      const image=await window.desktop.files.viewerStep({sessionId:viewerImage.sessionId,generation:viewerImage.generation,direction});
      if(token!==viewerRequest.current){image.bytes.fill(0);return;}
      setViewerImage(previous=>{previous?.bytes.fill(0);return image;});
    }catch{if(token===viewerRequest.current)setViewerError('This picture is no longer available. Close and refresh Files.');}
    finally{if(token===viewerRequest.current)setViewerBusy(false);}
  };
  useEffect(()=>{
    // On a clinic/session change, discard decoded images and all in-flight reads.
    viewerRequest.current++;
    setViewerImage(previous=>{previous?.bytes.fill(0);return null;});
    setViewerError('');setViewerBusy(false);
    dispatch({type:'phase',id:'image-viewer',phase:'closed'});
  },[session?.generation,dispatch]);
  const [updates, setUpdates] = useState<StaticWindowId[]>(['staff', 'lab']);
  const [job, setJob] = useState<StoreJob|null>(null);
  const [storeMessage, setStoreMessage] = useState('');
  const queue = useRef<StaticWindowId[]>([]);
  const [reservation,setReservation]=useState(1);
  const [readyId,setReadyId]=useState<WindowId|null>(null);
  const [updatedId,setUpdatedId]=useState<WindowId|null>(null);
  const [financeModule,setFinanceModule]=useState(FINANCE_MODULES[0]);
  const [launchNotice,setLaunchNotice]=useState('');
  const [pickerPrompt,setPickerPrompt]=useState<FilePickerPrompt|null>(null);
  const launchingPackage=useRef(false);
  const finishArrival=useRef<(()=>void)|undefined>(undefined);
  const [arrivalId, setArrivalId] = useState<WindowId|null>(null);
  const delivery = useDeliveryStore(!fixtures || resourceFixtures, id=>{const windowId=runtimeIdForPackage(id),existing=getState().windows[windowId];if(existing&&existing.phase!=='closed'){setReadyId(windowId);return;}setReservation(0);setReadyId(null);setArrivalId(windowId);});
  const dynamicTargets=useRef<Record<string,RefObject<HTMLButtonElement|null>>>({});
  for(const app of delivery.view.apps){const id=runtimeIdForPackage(app.id);if(!sampleWindows[app.id])dynamicTargets.current[id]??=createRef<HTMLButtonElement>();}
  const runtimeTargets:Record<string,RefObject<HTMLButtonElement|null>>={...targets,...dynamicTargets.current};
  const installedApps=delivery.view.apps.filter(app=>!!app.installedVersion);
  const titleByWindow=Object.fromEntries(installedApps.map(app=>[runtimeIdForPackage(app.id),app.title]));
  const deliveredIds = delivery.installedOrder.map(runtimeIdForPackage);
  const icons = makeIcons(fixtures && !resourceFixtures ? WINDOW_IDS : [...new Set(['files', 'standard-window-1', 'store', ...deliveredIds])], titleByWindow);
  const pendingArrivalId=delivery.installingId?runtimeIdForPackage(delivery.installingId):undefined;
  function startStoreJob(id:StaticWindowId, update = false) { if(job || arrivalId) return; setStoreMessage(''); setJob({id, update, progress:0}); }
  useEffect(() => {
    if(!job) return;
    const timer = setTimeout(() => {
      if(job.progress < 100) { setJob({...job,progress:Math.min(100,job.progress+10)}); return; }
      if(job.update) { setUpdatedId(job.id);setUpdates(old=>old.filter(id=>id!==job.id)); setStoreMessage(`${windowSpec(job.id).title} updated.`); }
      else { setReservation(0);setReadyId(null);setInstalled(old=>old.includes(job.id)?old:[...old,job.id]); setArrivalId(job.id); setStoreMessage(`${windowSpec(job.id).title} installed.`); }
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
  function openStoreApp(id:WindowId){const controller=allControllers[id];if(!controller){setReadyId(id);return;}if(arrivalId){finishArrival.current?.();setArrivalId(null);}setReadyId(null);controller.open();}
  async function openInstalledApp(id:WindowId){
    if(!id.startsWith('company.')){openStoreApp(id);return;}
    if(launchingPackage.current)return;
    launchingPackage.current=true;
    try{
      const result=await window.desktop?.runtime.discoverApp(id);
      if(!result?.ok){setLaunchNotice(result?.error?.message??'This app is not available for your current clinic role.');return;}
      const app=result.value;
      const preferredContentWidth=app?.preferredContentWidth??(app?defaultTableContentWidth(app.appId):undefined);
      if(app?.runtimeId===id&&preferredContentWidth!==undefined){
        dispatch({type:'fit-content-width',id:app.runtimeId,preferredContentWidth,hasModuleSidebar:app.modules.length>1});
      }
      setLaunchNotice('');
      openStoreApp(id);
    }catch{
      setLaunchNotice('The installed app could not be verified. Try again or update it from Apps.');
    }finally{launchingPackage.current=false;}
  }

  // Reserve a thumbnail destination synchronously when capture starts, before
  // measuring Genie geometry. In normal use, previews appear only for minimized apps.
  const hasPreview = (id: WindowId) => {const win=state.windows[id];return !!win&&(fixtures && isPrototype(id) || win.busy || ['minimizing', 'minimized', 'restoring'].includes(win.phase));};
  const specs: DockSpec[] = [...icons.map(i => ({ id: i.id, width: DOCK.size * dockScale * (i.id===arrivalId?reservation:i.id===pendingArrivalId?0:1), height: DOCK.size * dockScale, maxHeight: dockHeight })),
    ...(icons.some(icon => hasPreview(icon.id)) ? [{ id: 'divider', width: .9 * dockScale, height: 28.8 * dockScale, magnifies: false }] : []),
    ...icons.map(icon => icon.id).filter(hasPreview).map(id => ({ id: previewId(id), width: DOCK.previewWidth * dockScale, height: DOCK.previewHeight * dockScale, maxHeight: dockHeight }))];
  const anyMotion = Object.values(state.windows).some(win => win.busy);
  const [count, setCount] = useState(0);
  const [note, setNote] = useState('A little space to make something great.');
  const [dockRevealed, setDockRevealed] = useState(false);
  const [dockItemHovered, setDockItemHovered] = useState(false);
  const dockItemHoveredRef = useRef(false);
  const [statusbarRevealed, setStatusbarRevealed] = useState(false);
  const [hostTransitioning, setHostTransitioning] = useState(false);
  const frontApp = activeWindow(state);
  const immersive = !!frontApp && state.windows[frontApp].presentation === 'fullscreen';
  const showDock = !state.overview && (!immersive || dockRevealed || anyMotion || !!arrivalId);
  const showStatusbar = !immersive || statusbarRevealed || anyMotion || hostTransitioning;
  useEffect(() => { const edge=()=>setDockRevealed(true); window.addEventListener('runtime:dock-edge',edge); return()=>window.removeEventListener('runtime:dock-edge',edge); }, []);
  useEffect(() => { setDockRevealed(false); setStatusbarRevealed(false); }, [immersive, frontApp]);
  useEffect(()=>window.desktop?.files.subscribePicker(prompt=>{
    setPickerPrompt(prompt);
    if(prompt)window.desktop?.runtime.hideAll(session?.generation);
  }),[session?.generation]);
  const respondPicker = (response:FilePickerResponse)=>window.desktop?.files.pickResponse(response)??Promise.resolve(false);
  function updateDockItemHover(hovered:boolean) {
    if (dockItemHoveredRef.current === hovered) return;
    dockItemHoveredRef.current = hovered;
    setDockItemHovered(hovered);
  }
  function trackChrome(event: React.PointerEvent<HTMLElement>) {
    if (state.overview) { updateDockItemHover(false); dock.leave(); return; }
    const { clientX: px, clientY: py } = event;
    const target = event.target as HTMLElement;
    // Start magnification only inside the dock's visible hit area; the sheet
    // itself moves with the live dock width, so use its current rendered box.
    const overWindow = !!target.closest('[data-window-id]');
    const overDock = !!target.closest('.dock-region');
    updateDockItemHover(showDock && !!target.closest('.dock-icon, .dock-preview'));
    const hitZone = document.querySelector<HTMLElement>('.dock-hit-zone')?.getBoundingClientRect();
    const insideDock = !!hitZone && px >= hitZone.left && px <= hitZone.right && py >= hitZone.top && py <= hitZone.bottom;
    if (showDock && insideDock && (!overWindow || overDock)) dock.move(px);
    else dock.leave();
    if (!immersive) return;
    const statusbar = document.querySelector<HTMLElement>('.desktop-statusbar');
    const statusbarHasFocus = !!statusbar?.contains(document.activeElement);
    setStatusbarRevealed(previous => statusbarHasFocus || py <= (previous ? statusBarHeightForWidth(size.width) + 20 : 6));
    const centered = Math.abs(px - size.width / 2) < dock.layout.width / 2 + (DOCK.pad + 50) * dockScale;
    setDockRevealed(previous => centered && py >= size.height - (previous ? 180 : 6) * dockScale);
  }
  const arrivalViewport=useRef({...size});
  const dock = useDock(size, anyMotion || hostTransitioning || state.overview || !!arrivalId, specs, dockScale);
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
      if (event.repeat || pickerPrompt || hostTransitioning || Object.values(current.windows).some(win => win.busy || win.interaction !== 'idle')) return;
      if (!current.overview) { dock.reset(); setDockRevealed(false); }
      dispatch({ type: 'overview', open: !current.overview });
    };
    window.addEventListener('keydown', shortcut, true);
    return () => window.removeEventListener('keydown', shortcut, true);
  }, [dispatch, getState, hostTransitioning, pickerPrompt, dock.reset]);
  useEffect(() => window.desktop?.onHostTransition(value => {
    setHostTransitioning(value);
    if (value) { dock.reset(); setDockRevealed(false); }
  }), [dock.reset]);

  function selectFinanceModule(moduleId: string) { setFinanceModule(moduleId); }
  async function selectRuntimeModule(runtimeId: string, moduleId: string) {
    try {
      const result=await window.desktop?.runtime.selectModule(runtimeId,moduleId);
      if(result?.ok)setLaunchNotice('');
      else setLaunchNotice('This app could not switch modules. Close and reopen the app, or update it from Apps.');
    } catch {
      setLaunchNotice('This app could not switch modules. Close and reopen the app, or update it from Apps.');
    }
  }
  return <main className={`desktop ${immersive ? 'is-immersive' : ''}`} data-phase={phase} data-motion={anyMotion} data-overview={state.overview} inert={leaveConfirmationOpen} style={hostTransitioning ? { width: size.width, height: size.height } : undefined} onPointerMove={trackChrome} onPointerLeave={() => { updateDockItemHover(false); setDockRevealed(false); setStatusbarRevealed(false); dock.leave(); }}>
    <img className="wallpaper" src={wallpaperUrl} alt="" aria-hidden="true"/>
    {!state.overview && <DesktopChrome session={session} sessionControls={sessionControls} statusbarVisible={showStatusbar} onRequestClose={onRequestClose} onRequestSignOut={onRequestSignOut}
      onOpenApps={() => openStoreApp('store')}
      onShowWindows={() => { dispatch({ type: 'overview', open: true }); }}
      onSupport={() => { void window.desktop?.support(); }} />}
    <div className="window-stage" style={{ bottom: immersive ? 0 : DOCK.bottom + dockHeight }} inert={!!pickerPrompt} aria-hidden={!!pickerPrompt}>
    {(runtimeFixtures || !fixtures) && <RuntimeFixtures controllers={{studio,records,...dynamicControllers}} apps={delivery.view.apps} targets={runtimeTargets} onControllerRef={onControllerRef} onSelectModule={selectRuntimeModule} blocked={leaveConfirmationOpen || !!pickerPrompt || state.overview || anyMotion || hostTransitioning || dockItemHovered || Object.values(state.windows).some(w=>w.interaction!=='idle')}/> }
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
    <ManagedWindowFrame controller={files}><FilesApp key={session?.generation ?? 0} visible={files.win.phase === 'visible'} active={frontApp==='files'&&!state.overview&&!pickerPrompt&&!hostTransitioning} onViewImage={request=>void openViewer(request)}/></ManagedWindowFrame>
    <ManagedWindowFrame controller={viewerController} hideMinimize onClose={closeViewer}>
      <ImageViewer image={viewerImage} active={viewerController.active} busy={viewerBusy} error={viewerError} onStep={direction=>void stepViewer(direction)}/>
    </ManagedWindowFrame>
    <ManagedWindowFrame controller={followups}><FollowupsApp controller={followups}/></ManagedWindowFrame>
    <StandardWindow1 controller={staticControllers['standard-window-1']}/>
    {WINDOW_IDS.filter(id => id !== 'files' && id !== 'standard-window-1' && !isPrototype(id)).map(id => <ManagedWindowFrame key={id} controller={staticControllers[id]}
      moduleNavigation={id === 'finance' ? { activeModuleId: financeModule, activeLabel: financeModule, modules: FINANCE_MODULES.map(label=>({id:label,label})) } : undefined}
      onSelectModule={id === 'finance' ? selectFinanceModule : undefined}>
      {id === 'store' && (!fixtures || resourceFixtures) ? <DeliveryStore controller={staticControllers.store} settling={!!arrivalId} view={delivery.view} action={delivery.action} open={openInstalledApp} locked={anyMotion || hostTransitioning || Object.values(state.windows).some(w=>w.interaction!=='idle')}/> : id === 'store' ? <StoreApp locked={!!arrivalId || anyMotion || hostTransitioning || Object.values(state.windows).some(w=>w.interaction!=='idle')} uninstall={id=>{
        if(job || arrivalId || Object.values(getState().windows).some(w=>w.busy || w.interaction!=='idle'))return;
        dispatch({type:'phase',id,phase:'closed'});
        setInstalled(old=>old.filter(app=>app!==id));setUpdates(old=>old.filter(app=>app!==id));
        setStoreMessage(`${windowSpec(id).title} uninstalled. Demo records retained for this session.`);
        }} installed={installed} updates={updates} job={job} message={storeMessage} start={startStoreJob} cancel={()=>{queue.current=[];setJob(null);setStoreMessage('Cancelled. You can try again.');}} open={openStoreApp} updateAll={()=>{if(job)return;const [first,...rest]=updates;queue.current=rest;if(first)startStoreJob(first,true);}}/> : id === 'lab' ? <LabApp controller={controllers.lab}/> : id === 'staff' ? <StaffApp controller={controllers.staff}/> : id === 'finance' ? <FinanceApp selectedModule={financeModule}/> : <div className="coming-soon-body" data-app-focus tabIndex={-1}><img src={dockArtwork(id)} alt=""/><h2>{windowSpec(id).title}</h2><p>Coming soon</p></div>}
    </ManagedWindowFrame>)}
    </div>
    <nav className={`dock-region ${showDock ? 'chrome-shown' : 'chrome-hidden'}`} style={{ '--dock-hide-distance': `${180 * dockScale}px` } as CSSProperties} inert={!showDock || !!pickerPrompt} aria-label="Application dock">
      <div className="dock-hit-zone" style={{ left: dock.layout.left - DOCK.pad * dockScale, top: size.height - DOCK.bottom - dockHeight, width: dock.layout.width + DOCK.pad * dockScale * 2, height: DOCK.bottom * dockScale + dockHeight }}/>
      <div className="dock-pill" style={{ left: dock.layout.left - DOCK.pad * dockScale, width: dock.layout.width + 2 * DOCK.pad * dockScale, top: size.height - DOCK.bottom - dockHeight, height: dockHeight }}/>
      {dock.layout.items.map(item => {
        const style = { left: item.x, top: item.y, width: item.width, height: item.height };
        if (item.id === 'divider') return <span key={item.id} className="dock-divider" style={style}/>;
        const previewApp = Object.keys(allControllers).find(id => previewId(id) === item.id);
        if (previewApp) {
          const controller = allControllers[previewApp];
          const dockLabel = icons.find(icon => icon.id === previewApp)?.label ?? titleByWindow[previewApp] ?? previewApp;
          const title = state.windows[previewApp]?.title ?? dockLabel;
          return <button ref={runtimeTargets[previewApp]} key={item.id} className="dock-preview" style={style} onClick={controller.open} disabled={anyMotion || hostTransitioning} aria-label={controller.win.phase === 'minimized' ? `Restore ${dockLabel}` : `Open ${dockLabel} preview`}>
            {controller.snapshot ? <img src={controller.snapshot} alt={`${title} snapshot`}/> : <div className="preview-empty">{previewApp === 'files' ? <img className="preview-artwork" src={dockArtwork('files')} alt=""/> : previewApp === 'studio' ? <Layers size={21}/> : previewApp === 'records' ? <Table2 size={21}/> : previewApp.startsWith('company.') ? <StoreArtwork appId={packageIdForRuntime(previewApp)} className="preview-artwork"/> : <img className="preview-artwork" src={dockArtwork(previewApp)} alt=""/>}</div>}<span className="dock-caption">{dockLabel}</span>
          </button>;
        }
        const icon = icons.find(i => i.id === item.id)!;
      return <button data-dock-app={icon.id} ref={hasPreview(icon.id) ? undefined : runtimeTargets[icon.id]} key={item.id} className={`dock-icon ${icon.id === 'studio' || icon.id === 'records' ? '' : 'image-icon'} ${icon.color} ${updatedId===icon.id?'store-update-pulse':''}`} style={{...style, visibility: arrivalId===icon.id||pendingArrivalId===icon.id ? 'hidden' : undefined}} aria-label={icon.label} disabled={anyMotion || hostTransitioning} onClick={()=>icon.id.startsWith('company.')?void openInstalledApp(icon.id):openStoreApp(icon.id)}>
          {icon.id === 'studio' ? <Layers size={21}/> : icon.id === 'records' ? <Table2 size={21}/> : icon.id.startsWith('company.') ? <StoreArtwork appId={packageIdForRuntime(icon.id)} className="dock-artwork"/> : <img className="dock-artwork" src={dockArtwork(icon.id)} alt="" draggable={false}/>}<span className="dock-caption">{icon.label}</span>
          {state.windows[icon.id]?.phase !== 'closed' && <span className="running-dot"/>}
        </button>;
      })}
    </nav>
    {readyId && !state.overview && !hostTransitioning && <div className="store-ready" role="status" style={{left: Math.max(12,Math.min(size.width-235,(dock.layout.items.find(item=>item.id===readyId)?.x??size.width/2)-90)),bottom:dockHeight+22*dockScale}}>{readyId.startsWith('company.') ? <StoreArtwork appId={packageIdForRuntime(readyId)}/> : <img src={dockArtwork(readyId)} alt=""/>}<span>{state.windows[readyId]?.title ?? titleByWindow[readyId] ?? readyId}<small>Ready to open</small></span><button aria-label={`Open ${state.windows[readyId]?.title ?? titleByWindow[readyId] ?? readyId} from dock`} onClick={()=>openStoreApp(readyId)}>Open</button><button aria-label="Dismiss app ready" onClick={()=>setReadyId(null)}>×</button></div>}
    {launchNotice && !state.overview && <div className="app-launch-notice" role="alert"><span>{launchNotice}</span><button aria-label="Dismiss app message" onClick={()=>setLaunchNotice('')}>×</button></div>}
    {immersive && !state.overview && <>
      <div className="statusbar-reveal-edge" onPointerEnter={() => setStatusbarRevealed(true)} aria-hidden="true"/>
      <div className="dock-reveal-edge" onPointerEnter={() => setDockRevealed(true)} aria-hidden="true"/>
    </>}
    {state.overview && !pickerPrompt && <WindowOverview controllers={allControllers} onClose={() => dispatch({ type: 'overview', open: false })}/>}
    {pickerPrompt && <FilesPickerModal key={pickerPrompt.requestId} prompt={pickerPrompt} onReply={respondPicker}/> }
  </main>;
}
