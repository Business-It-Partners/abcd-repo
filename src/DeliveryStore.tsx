import {capabilityLabel} from './capabilityLabels';
import { useEffect, useRef, useState } from 'react';
import './DeliveryStore.css';
import { ArrowLeft, RefreshCw, Search } from 'lucide-react';
import type { StoreView } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';
import { useSessionGeneration } from './SessionBoundary';
import { StoreArtwork } from './StoreArtwork';
export const emptyStore: StoreView = { phase: 'idle', apps: [], canInstall: false, job: null, message: '' };
type DeliveryAction = 'refresh' | 'cancel' | 'install' | 'uninstall';
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
 const action = async (kind: DeliveryAction, id?: string) => {
  const started=epoch.current;
  const firstInstall=kind==='install'&&!!id&&current.current.apps.some(a=>a.id===id&&!a.installedVersion);
  if(firstInstall)setInstallingId(id!);
  try{const result=await window.desktop?.store.action(kind,id,generation);if(result?.ok&&firstInstall&&started===epoch.current)onInstalled?.(id!);}catch{/* Store state owns operation errors; never celebrate a rejected IPC call. */}finally{if(firstInstall&&started===epoch.current)setInstallingId(null);}
 };
 return { view, action, installedOrder, installingId };
}
export function DeliveryStore({ view, action, open, locked, settling = false }: { view: StoreView; action(kind: DeliveryAction, id?: string): void; open(id: string): void; locked: boolean; settling?:boolean }) {
 const [selected, setSelected] = useState<string | null>(null), [search, setSearch] = useState(''), [confirm, setConfirm] = useState(false), scroll = useRef<HTMLDivElement>(null);
 useEffect(() => { scroll.current?.scrollTo(0, 0); setConfirm(false); }, [selected]);
 const app = view.apps.find(a => a.id === selected), busy = !!view.job || view.phase === 'refreshing' || locked || settling;
 const unavailable = view.phase === 'unavailable';
 const notice = view.job ? '' : view.phase === 'refreshing' ? 'Checking company apps and clinic access…' : view.message;
 const installedCount = view.apps.filter(a => !!a.installedVersion).length;
 const image = (id: string) => <StoreArtwork appId={id}/>;
 const updateState=(a:StoreView['apps'][number])=>a.trialVersion
  ? <span className="delivery-update-state" role="status">Starting updated app · {a.trialVersion}</span>
  : a.pendingVersion
   ? <span className="delivery-update-state" role="status">{a.pendingReady ? `Update ready · ${a.pendingVersion} applies the next time you open this app.` : `Update ${a.pendingVersion} is staged and needs a current readiness check before trial.`}</span>
   : a.activeVersion&&a.knownGoodVersion===a.activeVersion
    ? <span className="delivery-update-state" role="status">Startup health confirmed · {a.activeVersion}</span>
    : null;
 const controls = (a: StoreView['apps'][number]) => <div className="store-action">{view.job?.appId === a.id ? <><progress aria-label={`${a.title} progress`} max={Math.max(1, view.job.total)} value={view.job.received}/><span role="status">{view.job.phase === 'downloading' ? `Downloading ${view.job.received} / ${view.job.total} bytes` : view.job.phase === 'verifying' ? 'Verifying signature and files' : view.job.phase === 'installing' ? 'Installing verified app' : 'Checking install permission'}</span><button onClick={() => action('cancel')}>Cancel</button></> : a.activeVersion ? <><button className="store-open" disabled={locked} onClick={() => open(runtimeIdForPackage(a.id))}>Open</button>{updateState(a)}{!a.pendingVersion&&!a.trialVersion&&a.version!==a.activeVersion&&<button disabled={busy||!view.canInstall||!a.available} onClick={()=>action('install',a.id)}>Download update</button>}</> : <button className="store-get" disabled={busy || !view.canInstall || !a.available} onClick={() => action('install', a.id)}>Get</button>}</div>;
 return <div className="store-body">
  {notice && <div className="delivery-store-notice" data-state={unavailable ? 'unavailable' : view.phase === 'refreshing' ? 'refreshing' : 'message'} role={unavailable ? 'alert' : 'status'} aria-live={unavailable ? 'assertive' : 'polite'} aria-atomic="true">
   <strong>{notice}</strong>
   {unavailable && <span>{installedCount ? 'Your installed apps remain available. Use Refresh to try again.' : 'App installation and update checks are unavailable. Use Refresh to try again.'}</span>}
  </div>}
  <nav className="store-tabs" aria-label="Store sections"><button aria-pressed="true" onClick={() => setSelected(null)}>Company Apps</button><button aria-label="Refresh company apps" disabled={busy} onClick={() => action('refresh')}><RefreshCw size={14}/>Refresh</button></nav><div className="store-scroll" ref={scroll}>
  {app ? <><button className="staff-back" onClick={() => setSelected(null)}><ArrowLeft size={16}/>Back to apps</button><header className="store-detail">{image(app.id)}<div><span className="store-kicker">COMPANY APP COLLECTION</span><h2>{app.title}</h2><p>{app.description}</p><small>Company publisher · Staging sample</small></div>{controls(app)}</header><div className="store-facts"><span>Store version<strong>{app.version}</strong></span><span>Active<strong>{app.activeVersion ?? 'Not installed'}</strong></span><span>Pending<strong>{app.pendingVersion ?? 'None'}</strong></span><span>Trial<strong>{app.trialVersion ?? 'None'}</strong></span><span>Known good<strong>{app.knownGoodVersion ?? 'None yet'}</strong></span><span>Platform<strong>Windows / Linux</strong></span><span>Access<strong>Clinic account</strong></span></div><section className="store-copy"><h3>About this release</h3><p>{app.notes}</p><h3>Requested capabilities</h3><p>{app.capabilities.map(capabilityLabel).join(', ') || 'No additional capabilities.'}</p>{app.reason && <p role={/failed|recovery/i.test(app.reason) ? 'alert' : 'status'}>{app.reason}</p>}{app.activeVersion && <div className="store-manage">{confirm ? <div role="group" aria-label="Confirm uninstall"><strong>Uninstall {app.title}?</strong><p>Close its window first. This removes local application files; your clinic records remain on the server.</p><button autoFocus onClick={() => setConfirm(false)}>Keep app</button><button className="lab-danger" disabled={busy || !view.canInstall} onClick={() => { action('uninstall', app.id); setConfirm(false); }}>Confirm uninstall</button></div> : <button className="store-uninstall" disabled={busy || !view.canInstall} onClick={() => setConfirm(true)}>Uninstall</button>}</div>}<p className="store-disclaimer">Signed company sample apps. Preparing an update keeps this running app and its work in place. The verified version is tried the next time you fully open the app; the Store reports whether startup health completed.</p></section></> : <><header className="store-heading"><div><span className="store-kicker">COMPANY APP COLLECTION</span><h2>Your apps. One workspace.</h2><p>Install verified company apps for your clinic.</p></div></header><label className="staff-search"><Search size={16}/><input aria-label="Search store" placeholder="Search company apps…" value={search} onChange={e => setSearch(e.target.value)}/></label><div className="store-grid">{view.apps.filter(a => a.title.toLowerCase().includes(search.toLowerCase())).map(a => <article key={a.id}><button className="store-app-link" aria-label={`Details ${a.title}`} onClick={() => setSelected(a.id)}>{image(a.id)}<div><h3>{a.title}</h3><p>{a.description}</p><small>{a.trialVersion ? `Starting trial · ${a.trialVersion}` : a.activeVersion ? `Active · ${a.activeVersion}${a.pendingVersion ? ` · Update ${a.pendingVersion} pending` : ''}` : a.available ? `Available · ${a.version}` : a.reason}</small></div></button>{controls(a)}</article>)}</div>{!view.apps.length && <div className="store-empty" aria-busy={view.phase === 'refreshing'}><h3>{view.phase === 'refreshing' ? 'Checking company apps…' : view.phase === 'idle' ? 'Opening company apps…' : 'Catalogue unavailable'}</h3><p>{unavailable ? 'Refresh to check the company catalogue again.' : 'Verified releases and clinic app permissions are being checked.'}</p></div>}</>}
 </div><footer className="staff-footer"><span>{view.canInstall ? 'Clinic administrator · App management allowed' : 'App management requires clinic administrator permission'}</span></footer></div>;
}
