import {capabilityLabel} from './capabilityLabels';
import { useEffect, useRef, useState } from 'react';
import './DeliveryStore.css';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import type { StoreView } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';
import { useSessionGeneration } from './SessionBoundary';
import { StoreArtwork } from './StoreArtwork';
export const emptyStore: StoreView = { phase: 'idle', apps: [], canInstall: false, job: null, message: '' };
export function useDeliveryStore(enabled: boolean, onInstalled?: (id:string)=>void) {
 const generation = useSessionGeneration(), [view, setView] = useState<StoreView>(emptyStore);
 const current=useRef(emptyStore),epoch=useRef(0);
 const [installedOrder,setInstalledOrder]=useState<string[]>([]);
 const [installingId,setInstallingId]=useState<string|null>(null);
 useEffect(() => {
  if (!enabled || !window.desktop) return; let alive = true;epoch.current++;
  const publish=(next:StoreView)=>{if(!alive)return;current.current=next;setView(next);const ids=next.apps.filter(a=>a.installedVersion).map(a=>a.id);setInstalledOrder(previous=>[...previous.filter(id=>ids.includes(id)),...ids.filter(id=>!previous.includes(id))]);};
  const unsubscribe = window.desktop.store.subscribe(publish);
  void window.desktop.store.action('view', undefined, generation).then(publish);
  void window.desktop.store.action('refresh', undefined, generation);
  return () => { alive = false;epoch.current++;unsubscribe(); };
 }, [enabled, generation]);
 const action = async (kind: 'refresh' | 'cancel' | 'install' | 'uninstall' | 'update-now', id?: string) => {
  const started=epoch.current;
  const firstInstall=kind==='install'&&!!id&&current.current.apps.some(a=>a.id===id&&!a.installedVersion);
  if(firstInstall)setInstallingId(id!);
  try{const result=await window.desktop?.store.action(kind,id,generation);if(result?.ok&&firstInstall&&started===epoch.current)onInstalled?.(id!);}catch{/* Store state owns operation errors; never celebrate a rejected IPC call. */}finally{if(firstInstall&&started===epoch.current)setInstallingId(null);}
 };
 return { view, action, installedOrder, installingId };
}
export function DeliveryStore({ view, action, open, locked, settling = false }: { view: StoreView; action(kind: 'refresh' | 'cancel' | 'install' | 'uninstall' | 'update-now', id?: string): void; open(id: string): void; locked: boolean; settling?:boolean }) {
 const [selected, setSelected] = useState<string | null>(null), [search, setSearch] = useState(''), [confirm, setConfirm] = useState(false), scroll = useRef<HTMLDivElement>(null);
 useEffect(() => { scroll.current?.scrollTo(0, 0); setConfirm(false); }, [selected]);
 const app = view.apps.find(a => a.id === selected), busy = !!view.job || view.phase === 'refreshing' || locked || settling;
 const image = (id: string) => <StoreArtwork appId={id}/>;
 const controls = (a: StoreView['apps'][number]) => <div className="store-action">{view.job?.appId === a.id ? <><progress aria-label={`${a.title} progress`} max={Math.max(1, view.job.total)} value={view.job.received}/><span role="status">{view.job.phase === 'downloading' ? `Downloading ${view.job.received} / ${view.job.total} bytes` : view.job.phase === 'verifying' ? 'Verifying signature and files' : view.job.phase === 'installing' ? 'Installing verified app' : 'Checking install permission'}</span><button onClick={() => action('cancel')}>Cancel</button></> : a.installedVersion ? <><button className="store-open" disabled={locked} onClick={() => open(runtimeIdForPackage(a.id))}>Open</button>{a.pendingVersion ? <button disabled={busy} onClick={()=>action('update-now',a.id)}>Use update now</button> : a.version!==a.installedVersion && <button disabled={busy||!view.canInstall||!a.available} onClick={()=>action('install',a.id)}>Download update</button>}</> : <button className="store-get" disabled={busy || !view.canInstall || !a.available} onClick={() => action('install', a.id)}>Get</button>}</div>;
 return <div className="store-body"><nav className="store-tabs" aria-label="Store sections"><button aria-pressed="true" onClick={() => setSelected(null)}>Company Apps</button><button disabled={busy} onClick={() => action('refresh')}><RefreshCw size={14}/>Refresh</button></nav><div className="store-scroll" ref={scroll}>
  {app ? <><button className="staff-back" onClick={() => setSelected(null)}><ArrowLeft size={16}/>Back to apps</button><header className="store-detail">{image(app.id)}<div><span className="store-kicker">COMPANY APP COLLECTION</span><h2>{app.title}</h2><p>{app.description}</p><small>Company publisher · Staging sample</small></div>{controls(app)}</header><div className="store-facts"><span>Version<strong>{app.version}</strong></span><span>Installed<strong>{app.installedVersion ?? 'Not installed'}</strong></span><span>Pending<strong>{app.pendingVersion ?? 'None'}</strong></span><span>Platform<strong>Windows / Linux</strong></span><span>Access<strong>Clinic account</strong></span></div><section className="store-copy"><h3>About this release</h3><p>{app.notes}</p><h3>Requested capabilities</h3><p>{app.capabilities.map(capabilityLabel).join(', ') || 'No additional capabilities.'}</p>{app.reason && <p role="status">{app.reason}</p>}{app.installedVersion && <div className="store-manage">{confirm ? <div role="group" aria-label="Confirm uninstall"><strong>Uninstall {app.title}?</strong><p>Close its window first. This removes local application files; your clinic records remain on the server.</p><button autoFocus onClick={() => setConfirm(false)}>Keep app</button><button className="lab-danger" disabled={busy || !view.canInstall} onClick={() => { action('uninstall', app.id); setConfirm(false); }}>Confirm uninstall</button></div> : <button className="store-uninstall" disabled={busy || !view.canInstall} onClick={() => setConfirm(true)}>Uninstall</button>}</div>}<p className="store-disclaimer">Signed company sample apps. Clinical application workflows are a separate delivery. Updates download separately and activate on a safe launch. Save unfinished work and resolve any pending write before using an update now.</p></section></> : <><header className="store-heading"><div><span className="store-kicker">COMPANY APP COLLECTION</span><h2>Your apps. One workspace.</h2><p>Install verified company apps for your clinic.</p></div></header><label className="staff-search"><Search size={16}/><input aria-label="Search store" placeholder="Search company apps…" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="store-grid">{view.apps.filter(a => a.title.toLowerCase().includes(search.toLowerCase())).map(a => <article key={a.id}><button className="store-app-link" aria-label={`Details ${a.title}`} onClick={() => setSelected(a.id)}>{image(a.id)}<div><h3>{a.title}</h3><p>{a.description}</p><small>{a.installedVersion ? `Installed · ${a.installedVersion}${a.pendingVersion ? ` · Update ${a.pendingVersion} ready` : ''}` : a.available ? `Available · ${a.version}` : a.reason}</small></div></button>{controls(a)}</article>)}</div>{!view.apps.length && <div className="store-empty"><h3>{view.phase === 'refreshing' ? 'Checking company apps…' : 'Catalogue unavailable'}</h3><p>Installed apps remain available. Try Refresh when the service is ready.</p></div>}</>}
 </div><footer className="staff-footer"><span>{view.canInstall ? 'Clinic administrator · App management allowed' : 'App management requires clinic administrator permission'}</span><span role="status">{view.message}</span></footer></div>;
}
