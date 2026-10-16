import { useSessionGeneration } from './SessionBoundary';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ManagedWindowFrame, type WindowController } from './ManagedWindow';
import { useWindowManager, activeWindow } from './windowManager';
import { runtimeIds, type RuntimeState, type RuntimeId, type RuntimeLayout } from '../electron/runtime/contracts';
export function RuntimeFixtures({ controllers, blocked }: { controllers: Record<RuntimeId, WindowController>; blocked: boolean }) {
  const generation = useSessionGeneration();
  const { state } = useWindowManager();
  const [entries,setEntries]=useState<RuntimeState[]>([]), [confirm,setConfirm]=useState<RuntimeId>();
  const [peek,setPeek]=useState(false), [error,setError]=useState('');
  const surfaces=useRef(new Map<RuntimeId,HTMLDivElement>());
  const front=activeWindow(state);
  useLayoutEffect(()=>{window.dispatchEvent(new Event('runtime:snapshot'));},[entries]);
  useEffect(()=>window.desktop?.runtime.subscribe((kind,value)=>{
    if(kind==='state')setEntries(value as RuntimeState[]);
    else if(kind==='key')window.dispatchEvent(new KeyboardEvent('keydown',value as KeyboardEventInit));
    else if(kind==='close-blocked'){const id=(value as {id:RuntimeId}).id;if(runtimeIds.includes(id)){controllers[id].open();setConfirm(id);}}
    else if(kind==='edge') {
      const point=value as {x:number;y:number};
      if(point.y>=innerHeight-170){setPeek(true);window.dispatchEvent(new Event('runtime:dock-edge'));}
    }
  }),[]);
  useEffect(()=>{const move=(e:PointerEvent)=>{if(e.clientY<innerHeight-170)setPeek(false);};window.addEventListener('pointermove',move,true);return()=>window.removeEventListener('pointermove',move,true);},[]);
  useLayoutEffect(()=>{
    const layouts:RuntimeLayout[]=runtimeIds.map(id=>{
      const element=surfaces.current.get(id),r=element?.getBoundingClientRect();
      return {id,open:state.windows[id].phase!=='closed',visible:front===id&&state.windows[id].phase==='visible'&&!blocked&&!peek&&!confirm,rect:{x:Math.max(0,r?.x??0),y:Math.max(0,r?.y??43),width:Math.max(1,r?.width??1),height:Math.max(1,r?.height??1)}};
    });
    void window.desktop?.runtime.sync(layouts, generation).catch(()=>setError('Runtime layout unavailable. Close and reopen the sample.'));
  },[state,front,blocked,peek,confirm]);
  return <>{runtimeIds.map(id=><ManagedWindowFrame key={id} controller={controllers[id]}><Surface id={id} controller={controllers[id]} entry={entries.find(e=>e.id===id)} confirm={confirm===id} requestConfirm={()=>setConfirm(id)} cancel={()=>setConfirm(undefined)} surface={el=>{if(el)surfaces.current.set(id,el);else surfaces.current.delete(id);}} error={error} activate={()=>setPeek(false)}/></ManagedWindowFrame>)}</>;
}
function Surface({id,controller:c,entry,confirm,requestConfirm,cancel,surface,error,activate}:{id:RuntimeId;controller:WindowController;entry?:RuntimeState;confirm:boolean;requestConfirm():void;cancel():void;surface(el:HTMLDivElement|null):void;error:string;activate():void}) {
  const generation=useSessionGeneration();
  const dirty=useRef(false);dirty.current=entry?.dirty??false;const unsafe=useRef(false);unsafe.current=!!entry?.writeState&&entry.writeState!=='none';
  useEffect(()=>{c.setCloseGuard(()=>{if(dirty.current||unsafe.current){requestConfirm();return false;}return true;});return()=>c.setCloseGuard();},[id]);
  useEffect(()=>{c.setModal(!!entry?.modal||confirm);},[entry?.modal,confirm]);
  return <div ref={surface} className="isolated-surface" data-runtime={id} data-runtime-phase={entry?.phase??'closed'} data-dirty={entry?.dirty??false} data-write-state={entry?.writeState??'none'} onPointerDown={()=>{c.focus();activate();}} tabIndex={-1} data-app-focus>
    {entry?.snapshot&&<img className="isolated-mirror" src={entry.snapshot} alt={`Inactive ${id} sample preview`}/>}
    {!entry?.snapshot&&<p className="runtime-message">{entry?.phase==='loading'?'Starting isolated sample…':error||'Open the sample from its dock icon.'}</p>}
    {entry?.phase==='failed'&&<div className="runtime-failure" role="alert"><h2>Sample stopped</h2><p>{entry.reason}. In-memory drafts may be lost. The other app remains available.</p><button onClick={()=>void window.desktop?.runtime.restart(id, generation)}>Restart sample</button></div>}
    {confirm&&<div className="runtime-confirm" onKeyDown={event=>{if(event.key==='Escape'){event.preventDefault();cancel();}else if(event.key==='Tab'){event.preventDefault();const buttons=[...event.currentTarget.querySelectorAll<HTMLButtonElement>('button')];const current=buttons.indexOf(document.activeElement as HTMLButtonElement);buttons[(current+(event.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus();}}} role="dialog" aria-label={unsafe.current?'Pending server change':'Unsaved sample draft'}><h2>{unsafe.current?'Reconcile the server change first':'Discard unfinished sample work?'}</h2><p>{unsafe.current?'A change may have reached the server. Wait for it to finish, or check its saved result in the app before closing this workspace.':'This sample has no durable draft storage.'}</p><button autoFocus onClick={cancel}>Keep working</button>{!unsafe.current&&<button onClick={()=>{dirty.current=false;c.setModal(false);cancel();c.close();}}>Discard and close</button>}</div>}
  </div>;
}
