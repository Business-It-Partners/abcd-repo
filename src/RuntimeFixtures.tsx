import { useSessionGeneration } from './SessionBoundary';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MutableRefObject, type RefObject } from 'react';
import { ManagedWindowFrame, useManagedWindow as useManagedWindowForDynamic, type WindowController } from './ManagedWindow';
import { useWindowManager, activeWindow } from './windowManager';
import { developmentRuntimeIdForPackage, runtimeIds, runtimeIdForPackage, type RuntimeState, type RuntimeId, type RuntimeLayout } from '../electron/runtime/contracts';
import type { StoreApp } from '../electron/distribution/contracts';
import type { DevelopmentAppItem } from '../electron/developmentApps';
import { dockZoneTop, nativeRuntimeResizeGutter, type WindowId } from './windowGeometry';
import { StoreArtwork } from './StoreArtwork';
import type { WindowModuleNavigation } from './WindowModuleSidebar';
import { AlertTriangle } from 'lucide-react';

type ControllerRef = MutableRefObject<WindowController>;
type DynamicApp = { id: string; title: string; target: RefObject<HTMLButtonElement | null> };
type LaunchHandoff = 'waiting'|'revealing'|'done';
type LaunchFeedback = { minimumElapsed:boolean; handoff:LaunchHandoff };
type RuntimeConfirm = { id: RuntimeId; action: 'close' | 'back' };
export function RuntimeFixtures({ controllers, apps = [], developmentApps = [], targets = {}, onControllerRef = () => {}, blocked, hostTransitioning, resourcePressureActive = false, onSelectModule, onCapacityCloseCommitted, onCapacityCloseCancelled }: {
  controllers: Record<string, WindowController>; apps?: StoreApp[]; developmentApps?: readonly DevelopmentAppItem[];
  targets?: Record<string, RefObject<HTMLButtonElement | null>>;
  onControllerRef?(id: string, controller: ControllerRef | null): void; blocked: boolean; hostTransitioning: boolean; resourcePressureActive?: boolean;
  onSelectModule?(id: RuntimeId, moduleId: string): void | Promise<void>;
  onCapacityCloseCommitted?(id: WindowId): void; onCapacityCloseCancelled?(id: WindowId, pendingWrite: boolean): void;
}) {
  const generation = useSessionGeneration();
  const { state, dispatch } = useWindowManager();
  const [entries,setEntries]=useState<RuntimeState[]>([]), [confirm,setConfirm]=useState<RuntimeConfirm>();
  const [peek,setPeek]=useState(false), [error,setError]=useState('');
  const [launchFeedback,setLaunchFeedback]=useState<Record<string,LaunchFeedback>>({});
  const surfaces=useRef(new Map<RuntimeId,HTMLDivElement>()), liveControllers=useRef(controllers);
  const controllerIds=Object.keys(controllers).sort().join('|');
  const registered=useRef(new Map<string,string>());
  const lastNativeTarget=useRef<RuntimeId | undefined>(undefined);
  const launchVisibleDuration=useRef(new Map<RuntimeId,number>()), launchVisibleSince=useRef(new Map<RuntimeId,number>());
  liveControllers.current=controllers;
  const front=activeWindow(state);
  const immersive=!!front&&state.windows[front]?.presentation==='fullscreen';
  const immersiveRef=useRef(immersive);immersiveRef.current=immersive;
  const dockTop=dockZoneTop(state.size);
  const dynamicApps:DynamicApp[]=[
    ...apps.filter(app=>!!app.installedVersion&&!['company.sample.alpha','company.sample.beta'].includes(app.id)).flatMap(app=>{const id=runtimeIdForPackage(app.id),target=targets[app.id]??targets[id];return target?[{id,title:app.title,target}]:[];}),
    ...developmentApps.flatMap(app=>{const id=developmentRuntimeIdForPackage(app.id),target=targets[app.id]??targets[id];return target?[{id,title:app.title,target}]:[];}),
  ];
  const appSignature=dynamicApps.map(app=>`${app.id}:${app.title}`).sort().join('|');
  const managedApps=dynamicApps;
  const managedAppIds=new Set(managedApps.map(app=>app.id));
  const openManagedAppSignature=managedApps.filter(app=>state.windows[app.id]&&state.windows[app.id].phase!=='closed').map(app=>app.id).sort().join('|');
  const nativeViewWillBeVisible=(id:RuntimeId,launchReady=true)=>{
    const win=state.windows[id];
    if(!win||blocked||front!==id||win.phase!=='visible'||peek||confirm||!launchReady)return false;
    const bounds=surfaces.current.get(id)?.getBoundingClientRect();
    const y=Math.max(0,Math.round(bounds?.y??43)),fullHeight=Math.max(1,Math.round(bounds?.height??1));
    const height=win.presentation==='fullscreen'?fullHeight:Math.min(fullHeight,Math.floor(dockTop-y));
    return height>0;
  };
  useEffect(()=>{
    const current=new Map(dynamicApps.map(app=>[app.id,app.title]));
    for(const [id,title] of current)dispatch({type:'register',id,title});
    for(const id of registered.current.keys())if(!current.has(id))dispatch({type:'unregister',id});
    registered.current=current;
  },[appSignature,dispatch]);
  useEffect(()=>{
    const openIds=new Set(openManagedAppSignature?openManagedAppSignature.split('|'):[]);
    setLaunchFeedback(previous=>{
      const next:Record<string,LaunchFeedback>={};
      for(const id of openIds)next[id]=previous[id]??{minimumElapsed:false,handoff:'waiting'};
      if(Object.keys(previous).length===Object.keys(next).length&&Object.keys(next).every(id=>previous[id]===next[id]))return previous;
      return next;
    });
    for(const id of launchVisibleDuration.current.keys())if(!openIds.has(id)||!managedAppIds.has(id)){
      launchVisibleDuration.current.delete(id);
      launchVisibleSince.current.delete(id);
    }
    for(const id of openIds)if(!launchVisibleDuration.current.has(id))launchVisibleDuration.current.set(id,0);
  },[appSignature,openManagedAppSignature]);
  const launchCanCountId=managedApps.find(app=>{
    const id=app.id,win=state.windows[id],feedback=launchFeedback[id],entry=entries.find(value=>value.id===id);
    return !!feedback&&feedback.handoff==='waiting'&&win?.phase==='visible'&&front===id&&!blocked&&!confirm&&entry?.phase!=='failed'&&entry?.phase!=='unresponsive';
  })?.id;
  useEffect(()=>{
    if(!launchCanCountId||launchFeedback[launchCanCountId]?.minimumElapsed)return;
    const id=launchCanCountId;
    const startedAt=performance.now();
    launchVisibleSince.current.set(id,startedAt);
    const remaining=Math.max(0,2000-(launchVisibleDuration.current.get(id)??0));
    const timer=window.setTimeout(()=>{
      if(launchVisibleSince.current.get(id)!==startedAt)return;
      launchVisibleDuration.current.set(id,(launchVisibleDuration.current.get(id)??0)+performance.now()-startedAt);
      launchVisibleSince.current.delete(id);
      setLaunchFeedback(previous=>previous[id]?.handoff==='waiting'?{...previous,[id]:{...previous[id],minimumElapsed:true}}:previous);
    },remaining);
    return()=>{
      window.clearTimeout(timer);
      if(launchVisibleSince.current.get(id)===startedAt){
        launchVisibleDuration.current.set(id,(launchVisibleDuration.current.get(id)??0)+performance.now()-startedAt);
        launchVisibleSince.current.delete(id);
      }
    };
  },[launchCanCountId,launchCanCountId?launchFeedback[launchCanCountId]?.minimumElapsed:undefined]);
  useEffect(()=>{
    if(!launchCanCountId||!launchFeedback[launchCanCountId]?.minimumElapsed||launchFeedback[launchCanCountId]?.handoff!=='waiting'||entries.find(entry=>entry.id===launchCanCountId)?.phase!=='ready'||front!==launchCanCountId||blocked||peek||confirm)return;
    const id=launchCanCountId;
    setLaunchFeedback(previous=>previous[id]?.handoff==='waiting'?{...previous,[id]:{...previous[id],handoff:'revealing'}}:previous);
  },[launchCanCountId,launchFeedback,entries,front,blocked,peek,confirm]);
  const revealingLaunchId=managedApps.find(app=>launchFeedback[app.id]?.handoff==='revealing')?.id;
  useEffect(()=>{
    if(!revealingLaunchId)return;
    const id=revealingLaunchId;
    const timer=window.setTimeout(()=>setLaunchFeedback(previous=>previous[id]?.handoff==='revealing'?{...previous,[id]:{...previous[id],handoff:'done'}}:previous),340);
    return()=>window.clearTimeout(timer);
  },[revealingLaunchId]);
  useLayoutEffect(()=>{window.dispatchEvent(new Event('runtime:snapshot'));},[entries]);
  useEffect(()=>window.desktop?.runtime.subscribe((kind,value)=>{
    if(kind==='state'){
      const next=value as RuntimeState[];
      setEntries(next);
      for(const entry of next)dispatch({type:'navigation-sync',id:entry.id,navigation:entry.navigation??{entries:[],index:-1}});
    }
    else if(kind==='key')window.dispatchEvent(new KeyboardEvent('keydown',value as KeyboardEventInit));
    else if(kind==='close-blocked'){const id=(value as {id:RuntimeId}).id;const controller=liveControllers.current[id];if(controller){controller.open();setConfirm({id,action:'close'});}}
    else if(kind==='edge') {
      const point=value as {x:number;y:number};
      // A normal window already ends above the dock. Only a fullscreen native
      // surface must be hidden so the renderer can reveal the dock over it.
      if(point.y>=innerHeight-170&&immersiveRef.current){
        // A native WebContentsView paints above the shell. Hide it in the same
        // IPC turn as dock reveal so Windows cannot leave it covering the dock
        // while React schedules the peek-state layout update.
        window.desktop?.runtime.hideAll(generation);
        setPeek(true);window.dispatchEvent(new Event('runtime:dock-edge'));
      }
    }
  }),[dispatch]);
  useEffect(()=>{const move=(e:PointerEvent)=>{if(e.clientY<innerHeight-170)setPeek(false);};window.addEventListener('pointermove',move,true);return()=>window.removeEventListener('pointermove',move,true);},[]);
  useLayoutEffect(()=>{
    // Keep the last stable native bounds while the shell is moving/resizing.
    // The full-resolution mirror remains inside the clipped shell window.
    if(blocked){
      // The main process hides native children without capturePage on host minimize.
      // Avoid racing it with the normal mirror capture while the whole OS transitions.
      if(lastNativeTarget.current!==undefined&&!hostTransitioning)window.desktop?.runtime.hideAll(generation);
      lastNativeTarget.current=undefined;
      return;
    }
    // The native runtime accepts only a bounded list of active windows. Sending
    // every registered app (including closed windows) exceeded that limit once
    // the installed and development app collections were both populated.
    const ids=controllerIds?controllerIds.split('|').filter(id=>state.windows[id]&&state.windows[id].phase!=='closed'):[];
    const layouts:RuntimeLayout[]=ids.map(id=>{
      const element=surfaces.current.get(id),r=element?.getBoundingClientRect();
      const x=Math.round(r?.x??0),y=Math.max(0,Math.round(r?.y??43)),width=Math.max(1,Math.round(r?.width??1)),fullHeight=Math.max(1,Math.round(r?.height??1));
      const fullscreen=state.windows[id].presentation==='fullscreen';
      const height=fullscreen?fullHeight:Math.min(fullHeight,Math.floor(dockTop-y));
      // WebContentsView is composited above this renderer, so React resize
      // handles at the right/bottom edges cannot receive input beneath it.
      // Leave the compact edge and corner hit areas exposed for every normal window.
      const resizeGutter=fullscreen?0:nativeRuntimeResizeGutter;
      const rect=height>0?{x,y,width:Math.max(1,width-resizeGutter),height:Math.max(1,height-resizeGutter)}:{x:0,y:0,width:1,height:1};
      const launchReady=!managedAppIds.has(id)||!!launchFeedback[id]&&launchFeedback[id].handoff!=='waiting';
      return {id,open:true,visible:height>0&&front===id&&state.windows[id].phase==='visible'&&!peek&&!confirm&&launchReady,rect};
    });
    const nextNativeTarget=layouts.find(layout=>layout.visible)?.id;
    if(lastNativeTarget.current!==nextNativeTarget){
      // WebContentsView children paint above the shell renderer. Hide the old
      // native child before a different React window/overview gets painted.
      window.desktop?.runtime.hideAll(generation);
      lastNativeTarget.current=nextNativeTarget;
    }
    void window.desktop?.runtime.sync(layouts, generation).catch(()=>setError('Runtime layout unavailable. Close and reopen the app.'));
  },[controllerIds,state,front,blocked,hostTransitioning,peek,confirm,generation,dockTop,launchFeedback]);
  return <>
    {runtimeIds.map(id=>{const controller=controllers[id];return controller?<ManagedWindowFrame key={id} controller={controller}><Surface id={id} controller={controller} entry={entries.find(e=>e.id===id)} confirmAction={confirm?.id===id?'close':undefined} requestConfirm={()=>setConfirm({id,action:'close'})} cancel={()=>setConfirm(undefined)} surface={el=>{if(el)surfaces.current.set(id,el);else surfaces.current.delete(id);}} error={error} activate={()=>setPeek(false)} nativeViewVisible={nativeViewWillBeVisible(id,!managedAppIds.has(id)||!!launchFeedback[id]&&launchFeedback[id].handoff!=='waiting')} resourcePressureActive={resourcePressureActive} onCapacityCloseCommitted={onCapacityCloseCommitted} onCapacityCloseCancelled={onCapacityCloseCancelled}/></ManagedWindowFrame>:null;})}
    {dynamicApps.filter(app=>state.windows[app.id]).map(app=>{
      const id=app.id,win=state.windows[id],feedback=launchFeedback[id],entry=entries.find(value=>value.id===id);
      const open=!!win&&win.phase!=='closed';
      const countState=!open?'closed':win?.phase!=='visible'?'window-not-visible':front!==id?'not-foreground':blocked?'blocked':confirm?.id===id?'confirmation-open':feedback?.handoff!=='waiting'?'handoff-started':entry?.phase==='failed'||entry?.phase==='unresponsive'?'runtime-failed':launchCanCountId===id?'counting':'waiting';
      return <DynamicRuntimeWindow key={id} id={id} title={app.title} target={app.target} entry={entry} generation={generation} confirmAction={confirm?.id===id?confirm.action:undefined} requestConfirm={action=>setConfirm({id,action})} cancel={()=>setConfirm(undefined)} surface={el=>{if(el)surfaces.current.set(id,el);else surfaces.current.delete(id);}} error={error} activate={()=>setPeek(false)} onControllerRef={onControllerRef} launchFeedback={feedback} launchCountState={countState} nativeViewVisible={nativeViewWillBeVisible(id,!!feedback&&feedback.handoff!=='waiting')} resourcePressureActive={resourcePressureActive} onCapacityCloseCommitted={onCapacityCloseCommitted} onCapacityCloseCancelled={onCapacityCloseCancelled}
        moduleNavigation={entry?.moduleNavigation}
        onSelectModule={moduleId=>onSelectModule?.(id,moduleId)}/>;
    })}
  </>;
}

function DynamicRuntimeWindow({id,title,target,entry,generation,confirmAction,requestConfirm,cancel,surface,error,activate,onControllerRef,launchFeedback,launchCountState,nativeViewVisible,resourcePressureActive,moduleNavigation,onSelectModule,onCapacityCloseCommitted,onCapacityCloseCancelled}:{id:WindowId;title:string;target:RefObject<HTMLButtonElement|null>;entry?:RuntimeState;generation:number;confirmAction?:RuntimeConfirm['action'];requestConfirm(action:RuntimeConfirm['action']):void;cancel(accepted?:boolean):void;surface(el:HTMLDivElement|null):void;error:string;activate():void;onControllerRef(id:string,controller:ControllerRef|null):void;launchFeedback?:LaunchFeedback;launchCountState:string;nativeViewVisible:boolean;resourcePressureActive:boolean;moduleNavigation?:WindowModuleNavigation;onSelectModule?(moduleId:string):void|Promise<void>;onCapacityCloseCommitted?(id:WindowId):void;onCapacityCloseCancelled?(id:WindowId,pendingWrite:boolean):void}){
  const controller=useManagedWindowForDynamic(id,target),latest=useRef(controller);latest.current=controller;
  useLayoutEffect(()=>{onControllerRef(id,latest);return()=>onControllerRef(id,null);},[id,onControllerRef]);
  const navigationDisabled=entry?.phase!=='ready'||!!entry?.modal||!!entry?.writeState&&entry.writeState!=='none';
  const preservesDraft=entry?.navigation?.backPreservesDraft===true;
  const requestBack=()=>{
    if(entry?.dirty&&!preservesDraft){requestConfirm('back');return;}
    void window.desktop?.runtime.navigate(id,'back',generation,false,preservesDraft);
  };
  const acceptBack=()=>{
    if(entry?.writeState&&entry.writeState!=='none')return;
    cancel();
    controller.setModal(false);
    void window.desktop?.runtime.navigate(id,'back',generation,true);
  };
  return <ManagedWindowFrame controller={controller} navigationDisabled={navigationDisabled} moduleNavigation={moduleNavigation} onSelectModule={onSelectModule}
    onNavigationBack={requestBack}>
    <Surface id={id} title={title} controller={controller} entry={entry} confirmAction={confirmAction} requestConfirm={()=>requestConfirm('close')} cancel={cancel} acceptConfirm={confirmAction==='back'?acceptBack:undefined} surface={surface} error={error} activate={activate} launchFeedback={launchFeedback} launchCountState={launchCountState} nativeViewVisible={nativeViewVisible} resourcePressureActive={resourcePressureActive} onCapacityCloseCommitted={onCapacityCloseCommitted} onCapacityCloseCancelled={onCapacityCloseCancelled}/>
  </ManagedWindowFrame>;
}

function Surface({id,title,controller:c,entry,confirmAction,requestConfirm,cancel,acceptConfirm,surface,error,activate,launchFeedback,launchCountState,nativeViewVisible,resourcePressureActive,onCapacityCloseCommitted,onCapacityCloseCancelled}:{id:RuntimeId;title?:string;controller:WindowController;entry?:RuntimeState;confirmAction?:RuntimeConfirm['action'];requestConfirm():void;cancel(accepted?:boolean):void;acceptConfirm?():void;surface(el:HTMLDivElement|null):void;error:string;activate():void;launchFeedback?:LaunchFeedback;launchCountState?:string;nativeViewVisible:boolean;resourcePressureActive:boolean;onCapacityCloseCommitted?(id:WindowId):void;onCapacityCloseCancelled?(id:WindowId,pendingWrite:boolean):void}) {
  const generation=useSessionGeneration();
  const dirty=useRef(false);dirty.current=entry?.dirty??false;const unsafe=useRef(false);unsafe.current=!!entry?.writeState&&entry.writeState!=='none';
  const phase=useRef(c.win.phase);phase.current=c.win.phase;
  const liveController=useRef(c);liveController.current=c;
  const [resumeError,setResumeError]=useState('');
  const waitingForVisibleCloseConfirmation=useRef(false);
  useEffect(()=>{
    if(waitingForVisibleCloseConfirmation.current&&c.win.phase==='visible'&&!c.win.busy){
      waitingForVisibleCloseConfirmation.current=false;
      requestConfirm();
    }
  },[c.win.phase,c.win.busy,requestConfirm]);
  useEffect(()=>{c.setCloseGuard(()=>{
    if(dirty.current||unsafe.current){
      if(phase.current==='minimized'){
        waitingForVisibleCloseConfirmation.current=true;
        liveController.current.open();
      }else requestConfirm();
      return false;
    }
    return true;
  });return()=>c.setCloseGuard();},[id]);
  useEffect(()=>{c.setModal(!!entry?.modal||!!confirmAction);},[entry?.modal,confirmAction]);
  const cancelConfirm=()=>{
    const pendingWrite=unsafe.current;
    cancel();
    if(confirmAction==='close')onCapacityCloseCancelled?.(id,pendingWrite);
  };
  const acceptClose=()=>{
    dirty.current=false;
    c.setModal(false);
    cancel(true);
    if(c.close())onCapacityCloseCommitted?.(id);
  };
  const managedApp=launchFeedback!==undefined;
  const launchWaiting=managedApp&&c.win.phase!=='closed'&&(launchFeedback?.handoff??'waiting')==='waiting'&&entry?.phase!=='failed'&&entry?.phase!=='unresponsive';
  return <div ref={surface} className="isolated-surface" data-runtime={id} data-runtime-phase={entry?.phase??'closed'} data-runtime-reason={entry?.reason??''} data-native-view-visible={nativeViewVisible?'true':'false'} data-presentation={c.win.presentation} style={{'--native-runtime-resize-gutter':`${nativeRuntimeResizeGutter}px`} as CSSProperties} data-launch-handoff={managedApp?(launchFeedback?.handoff??'waiting'):undefined} data-launch-minimum-elapsed={managedApp?launchFeedback?.minimumElapsed??false:undefined} data-launch-count-state={managedApp?launchCountState:undefined} data-dirty={entry?.dirty??false} data-write-state={entry?.writeState??'none'} onPointerDown={()=>{c.focus();activate();}} tabIndex={-1} data-app-focus>
    {entry?.snapshot&&<img className="isolated-mirror" src={entry.snapshot} alt={`Inactive ${id} app`}/>}
    {launchWaiting&&<div className="app-launch-splash" data-testid="app-launch-splash" data-handoff={launchFeedback?.handoff??'waiting'} role="status" aria-live="polite" aria-busy="true"><div className="app-launch-content"><StoreArtwork appId={id} className="app-launch-artwork"/><h2>{title??id}</h2><p><span className="app-launch-spinner" aria-hidden="true"/>Opening your workspace…</p></div></div>}
    {!launchWaiting&&!entry?.snapshot&&entry?.phase==='loading'&&<p className="runtime-message">Starting app…</p>}
    {!entry?.snapshot&&entry?.phase!=='loading'&&entry?.phase!=='ready'&&entry?.phase!=='suspended'&&<p className="runtime-message">{error||'Open the app from its dock icon.'}</p>}
    {entry?.phase==='suspended'&&<div className="runtime-pressure-paused" data-testid="resource-paused" role="status"><h2>Paused to free memory</h2><p>Dental OS paused this app because it reported no unsaved work. Reopening reloads the app; any state kept only in memory may need to be entered again.</p>{resourcePressureActive&&<p>Wait for system memory to recover before reopening.</p>}{resumeError&&<p role="alert">{resumeError}</p>}<button disabled={resourcePressureActive} onClick={()=>{setResumeError('');void window.desktop?.runtime.resume(id,generation).catch(()=>setResumeError('System memory has not recovered yet. Try again shortly.'));}}>Reopen app</button></div>}
    {(entry?.phase==='failed'||entry?.phase==='unresponsive')&&<div className="runtime-failure" role="alert"><h2>{entry.reason==='restart-limit'?'App recovery paused':entry.phase==='unresponsive'?'App is not responding':'App stopped'}</h2><p>{entry.reason==='restart-limit'?'This app failed repeatedly. Wait one minute before trying again.':entry.phase==='unresponsive'?'The app has not responded yet. Wait a moment for it to recover, or restart it.':entry.reason==='package-verification-failed'?'The app files could not be verified. Restore a verified copy or contact support.':'The app could not continue. You can try restarting it.'} In-memory work may be lost. Other apps remain available.</p>{entry.reason!=='restart-limit'&&<button onClick={()=>void window.desktop?.runtime.restart(id, generation).catch(()=>{})}>Restart app</button>}</div>}
    {confirmAction&&<div className="runtime-confirm-backdrop"><section className="runtime-confirm" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();cancelConfirm();}else if(event.key==='Tab'){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not([disabled])')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}}} role="alertdialog" aria-modal="true" aria-label={unsafe.current?'Pending server change':id==='company.dental.patient-record.m17'?'Discard unsaved patient details?':'Discard unfinished app work?'}>
      <div className="runtime-confirm-icon" aria-hidden="true"><AlertTriangle size={22}/></div>
      <h2>{unsafe.current?'Reconcile the server change first':id==='company.dental.patient-record.m17'?'Discard unsaved patient details?':'Discard unfinished app work?'}</h2>
      <p>{unsafe.current?'A change may have reached the clinic. Keep this window open and check the save result in the app before leaving.':id==='company.dental.patient-record.m17'?'The patient details on this page have not been saved. If you leave now, they will be discarded.':'This app has unfinished work that has not been saved. If you leave now, it will be discarded.'}</p>
      <div className="runtime-confirm-actions"><button autoFocus className="runtime-confirm-cancel" onClick={cancelConfirm}>Cancel</button>{!unsafe.current&&<button className="runtime-confirm-ok" onClick={confirmAction==='close'?acceptClose:(acceptConfirm??(()=>{dirty.current=false;c.setModal(false);cancel(true);c.close();}))}>OK</button>}</div>
    </section></div>}
  </div>;
}
