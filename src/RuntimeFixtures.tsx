import { useSessionGeneration } from './SessionBoundary';
import { useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react';
import { ManagedWindowFrame, useManagedWindow as useManagedWindowForDynamic, type WindowController } from './ManagedWindow';
import { useWindowManager, activeWindow } from './windowManager';
import { runtimeIds, runtimeIdForPackage, type RuntimeState, type RuntimeId, type RuntimeLayout } from '../electron/runtime/contracts';
import type { StoreApp } from '../electron/distribution/contracts';
import { dockZoneTop, type WindowId } from './windowGeometry';

type ControllerRef = MutableRefObject<WindowController>;
type DynamicApp = StoreApp & { target: RefObject<HTMLButtonElement | null> };
export function RuntimeFixtures({ controllers, apps = [], targets = {}, onControllerRef = () => {}, blocked }: {
  controllers: Record<string, WindowController>; apps?: StoreApp[];
  targets?: Record<string, RefObject<HTMLButtonElement | null>>;
  onControllerRef?(id: string, controller: ControllerRef | null): void; blocked: boolean;
}) {
  const generation = useSessionGeneration();
  const { state, dispatch } = useWindowManager();
  const [entries,setEntries]=useState<RuntimeState[]>([]), [confirm,setConfirm]=useState<RuntimeId>();
  const [peek,setPeek]=useState(false), [error,setError]=useState('');
  const surfaces=useRef(new Map<RuntimeId,HTMLDivElement>()), liveControllers=useRef(controllers);
  const registered=useRef(new Map<string,string>());
  const lastNativeTarget=useRef<RuntimeId | undefined>(undefined);
  liveControllers.current=controllers;
  const front=activeWindow(state);
  const dockTop=dockZoneTop(state.size);
  const dynamicApps:DynamicApp[]=apps.filter(app=>!!app.installedVersion&&!['company.sample.alpha','company.sample.beta'].includes(app.id)).flatMap(app=>{const id=runtimeIdForPackage(app.id),target=targets[app.id]??targets[id];return target?[{...app,id,target}]:[];});
  const appSignature=dynamicApps.map(app=>`${app.id}:${app.title}`).sort().join('|');
  useEffect(()=>{
    const current=new Map(dynamicApps.map(app=>[app.id,app.title]));
    for(const [id,title] of current)dispatch({type:'register',id,title});
    for(const id of registered.current.keys())if(!current.has(id))dispatch({type:'unregister',id});
    registered.current=current;
  },[appSignature,dispatch]);
  useLayoutEffect(()=>{window.dispatchEvent(new Event('runtime:snapshot'));},[entries]);
  useEffect(()=>window.desktop?.runtime.subscribe((kind,value)=>{
    if(kind==='state')setEntries(value as RuntimeState[]);
    else if(kind==='app-explorer')window.dispatchEvent(new CustomEvent('runtime:app-explorer',{detail:value}));
    else if(kind==='key')window.dispatchEvent(new KeyboardEvent('keydown',value as KeyboardEventInit));
    else if(kind==='close-blocked'){const id=(value as {id:RuntimeId}).id;const controller=liveControllers.current[id];if(controller){controller.open();setConfirm(id);}}
    else if(kind==='edge') {
      const point=value as {x:number;y:number};
      if(point.y>=innerHeight-170){
        // A native WebContentsView paints above the shell. Hide it in the same
        // IPC turn as dock reveal so Windows cannot leave it covering the dock
        // while React schedules the peek-state layout update.
        window.desktop?.runtime.hideAll(generation);
        setPeek(true);window.dispatchEvent(new Event('runtime:dock-edge'));
      }
    }
  }),[]);
  useEffect(()=>{const move=(e:PointerEvent)=>{if(e.clientY<innerHeight-170)setPeek(false);};window.addEventListener('pointermove',move,true);return()=>window.removeEventListener('pointermove',move,true);},[]);
  useLayoutEffect(()=>{
    // Keep the last stable native bounds while the shell is moving/resizing.
    // The full-resolution mirror remains inside the clipped shell window.
    if(blocked){
      if(lastNativeTarget.current!==undefined)window.desktop?.runtime.hideAll(generation);
      lastNativeTarget.current=undefined;
      return;
    }
    const ids=Object.keys(controllers).filter(id=>state.windows[id]);
    const layouts:RuntimeLayout[]=ids.map(id=>{
      const element=surfaces.current.get(id),r=element?.getBoundingClientRect();
      const x=Math.round(r?.x??0),y=Math.max(0,Math.round(r?.y??43)),width=Math.max(1,Math.round(r?.width??1)),fullHeight=Math.max(1,Math.round(r?.height??1));
      const height=Math.min(fullHeight,Math.floor(dockTop-y));
      const rect=height>0?{x,y,width,height}:{x:0,y:0,width:1,height:1};
      return {id,open:state.windows[id].phase!=='closed',visible:height>0&&front===id&&state.windows[id].phase==='visible'&&!peek&&!confirm,rect};
    });
    const nextNativeTarget=layouts.find(layout=>layout.visible)?.id;
    if(lastNativeTarget.current!==nextNativeTarget){
      // WebContentsView children paint above the shell renderer. Hide the old
      // native child before a different React window/overview gets painted.
      window.desktop?.runtime.hideAll(generation);
      lastNativeTarget.current=nextNativeTarget;
    }
    void window.desktop?.runtime.sync(layouts, generation).catch(()=>setError('Runtime layout unavailable. Close and reopen the app.'));
  },[controllers,state,front,blocked,peek,confirm,generation,dockTop]);
  return <>
    {runtimeIds.map(id=>{const controller=controllers[id];return controller?<ManagedWindowFrame key={id} controller={controller}><Surface id={id} controller={controller} entry={entries.find(e=>e.id===id)} confirm={confirm===id} requestConfirm={()=>setConfirm(id)} cancel={()=>setConfirm(undefined)} surface={el=>{if(el)surfaces.current.set(id,el);else surfaces.current.delete(id);}} error={error} activate={()=>setPeek(false)}/></ManagedWindowFrame>:null;})}
    {dynamicApps.filter(app=>state.windows[app.id]).map(app=><DynamicRuntimeWindow key={app.id} id={app.id} title={app.title} target={app.target} entry={entries.find(e=>e.id===app.id)} confirm={confirm===app.id} requestConfirm={()=>setConfirm(app.id)} cancel={()=>setConfirm(undefined)} surface={el=>{if(el)surfaces.current.set(app.id,el);else surfaces.current.delete(app.id);}} error={error} activate={()=>setPeek(false)} onControllerRef={onControllerRef}/>)}
  </>;
}

function DynamicRuntimeWindow({id,title,target,entry,confirm,requestConfirm,cancel,surface,error,activate,onControllerRef}:{id:WindowId;title:string;target:RefObject<HTMLButtonElement|null>;entry?:RuntimeState;confirm:boolean;requestConfirm():void;cancel():void;surface(el:HTMLDivElement|null):void;error:string;activate():void;onControllerRef(id:string,controller:ControllerRef|null):void}){
  const controller=useManagedWindowForDynamic(id,target),latest=useRef(controller);latest.current=controller;
  useLayoutEffect(()=>{onControllerRef(id,latest);return()=>onControllerRef(id,null);},[id,onControllerRef]);
  return <ManagedWindowFrame controller={controller}><Surface id={id} controller={controller} entry={entry} confirm={confirm} requestConfirm={requestConfirm} cancel={cancel} surface={surface} error={error} activate={activate}/></ManagedWindowFrame>;
}

function Surface({id,controller:c,entry,confirm,requestConfirm,cancel,surface,error,activate}:{id:RuntimeId;controller:WindowController;entry?:RuntimeState;confirm:boolean;requestConfirm():void;cancel():void;surface(el:HTMLDivElement|null):void;error:string;activate():void}) {
  const generation=useSessionGeneration();
  const dirty=useRef(false);dirty.current=entry?.dirty??false;const unsafe=useRef(false);unsafe.current=!!entry?.writeState&&entry.writeState!=='none';
  useEffect(()=>{c.setCloseGuard(()=>{if(dirty.current||unsafe.current){requestConfirm();return false;}return true;});return()=>c.setCloseGuard();},[id]);
  useEffect(()=>{c.setModal(!!entry?.modal||confirm);},[entry?.modal,confirm]);
  return <div ref={surface} className="isolated-surface" data-runtime={id} data-runtime-phase={entry?.phase??'closed'} data-runtime-reason={entry?.reason??''} data-dirty={entry?.dirty??false} data-write-state={entry?.writeState??'none'} onPointerDown={()=>{c.focus();activate();}} tabIndex={-1} data-app-focus>
    {entry?.snapshot&&<img className="isolated-mirror" src={entry.snapshot} alt={`Inactive ${id} app preview`}/>}
    {!entry?.snapshot&&<p className="runtime-message">{entry?.phase==='loading'?'Starting isolated app…':entry?.phase==='ready'?'Refreshing app preview…':error||'Open the app from its dock icon.'}</p>}
    {(entry?.phase==='failed'||entry?.phase==='unresponsive')&&<div className="runtime-failure" role="alert"><h2>{entry.phase==='unresponsive'?'App is not responding':'App stopped'}</h2><p>{entry.phase==='unresponsive'?'The app has not responded yet. Wait a moment for it to recover, or restart it.':entry.reason==='restart-limit'?'This app stopped repeatedly. Wait one minute before trying again.':entry.reason==='package-verification-failed'?'The app files could not be verified. Restore a verified copy or contact support.':'The app could not continue. You can try restarting it.'} In-memory work may be lost. Other apps remain available.</p><button onClick={()=>void window.desktop?.runtime.restart(id, generation).catch(()=>{})}>Restart app</button></div>}
    {confirm&&<div className="runtime-confirm" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancel();}else if(event.key==='Tab'){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}}} role="dialog" aria-label={unsafe.current?'Pending server change':'Unsaved app work'}><h2>{unsafe.current?'Reconcile the server change first':'Discard unfinished app work?'}</h2><p>{unsafe.current?'A change may have reached the server. Wait for it to finish, or check its saved result in the app before closing this workspace.':'This app has no durable draft storage.'}</p><button autoFocus onClick={cancel}>Keep working</button>{!unsafe.current&&<button onClick={()=>{dirty.current=false;c.setModal(false);cancel();c.close();}}>Discard and close</button>}</div>}
  </div>;
}
