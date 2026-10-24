import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Search } from 'lucide-react';
import type { StoreView } from '../electron/distribution/contracts';
import { runtimeIdForPackage } from '../electron/runtime/contracts';
import { useSessionGeneration } from './SessionBoundary';
import { StoreArtwork } from './StoreArtwork';
import type { WindowController } from './ManagedWindow';
import './DeliveryStore.css';

const brandMarkUrl = new URL('./assets/sajilo-dental-mark.svg', import.meta.url).href;

export const emptyStore: StoreView = { phase: 'idle', apps: [], canInstall: false, job: null, message: '' };
type DeliveryAction = 'refresh' | 'cancel' | 'install' | 'uninstall';
type StoreApp = StoreView['apps'][number];
type StoreTab = 'all' | 'updates';

function hasAvailableUpdate(app: StoreApp) {
 return !!app.activeVersion && app.available && !app.reason && !app.pendingVersion && !app.trialVersion && app.version !== app.activeVersion;
}

function appStatus(app: StoreApp) {
 if (app.reason) return app.reason;
 if (app.trialVersion) return `Checking update · ${app.trialVersion}`;
 if (app.pendingVersion) return app.pendingReady ? `Update ready · ${app.pendingVersion}` : `Update staged · ${app.pendingVersion}`;
 if (hasAvailableUpdate(app)) return `Update available · ${app.version}`;
 if (app.activeVersion) return `Installed · ${app.activeVersion}`;
 if (app.available) return `Version ${app.version}`;
 return app.reason || 'Unavailable';
}

function updateStatus(app: StoreApp) {
 if (app.trialVersion) return `Starting updated app · ${app.trialVersion}`;
 if (app.pendingVersion) return app.pendingReady
  ? `Update ready · ${app.pendingVersion} applies the next time you open this app.`
  : `Update ${app.pendingVersion} is staged and needs a current readiness check before trial.`;
 if (app.activeVersion && app.knownGoodVersion === app.activeVersion) return `Startup health confirmed · ${app.activeVersion}`;
 return '';
}

function jobDescription(job: NonNullable<StoreView['job']>) {
 const percent = job.total > 0 ? Math.min(100, Math.floor(job.received / job.total * 100)) : 0;
 if (job.phase === 'downloading') return { label: 'Downloading', percent };
 if (job.phase === 'verifying') return { label: 'Verifying app', percent };
 if (job.phase === 'installing') return { label: 'Installing', percent };
 return { label: 'Checking permission', percent };
}

export function useDeliveryStore(enabled: boolean, onInstalled?: (id: string) => void) {
 const generation = useSessionGeneration();
 const [view, setView] = useState<StoreView>(emptyStore);
 const current = useRef(emptyStore);
 const epoch = useRef(0);
 const [installedOrder, setInstalledOrder] = useState<string[]>([]);
 const [installingId, setInstallingId] = useState<string | null>(null);

 useEffect(() => {
  if (!enabled || !window.desktop) return;
  let alive = true;
  epoch.current++;
  const publish = (next: StoreView) => {
   if (!alive) return;
   current.current = next;
   setView(next);
   const ids = next.apps.filter(app => app.installedVersion).map(app => app.id);
   setInstalledOrder(previous => [...previous.filter(id => ids.includes(id)), ...ids.filter(id => !previous.includes(id))]);
  };
  const unsubscribe = window.desktop.store.subscribe(publish);
  void window.desktop.store.action('view', undefined, generation).then(publish);
  void window.desktop.store.action('refresh', undefined, generation);
  return () => { alive = false; epoch.current++; unsubscribe(); };
 }, [enabled, generation]);

 const action = async (kind: DeliveryAction, id?: string) => {
  const started = epoch.current;
  const firstInstall = kind === 'install' && !!id && current.current.apps.some(app => app.id === id && !app.installedVersion);
  if (firstInstall) setInstallingId(id!);
  try {
   const result = await window.desktop?.store.action(kind, id, generation);
   if (result?.ok && firstInstall && started === epoch.current) onInstalled?.(id!);
  } catch { /* Store state owns operation errors; never celebrate a rejected IPC call. */ }
  finally { if (firstInstall && started === epoch.current) setInstallingId(null); }
 };

 return { view, action, installedOrder, installingId };
}

export function DeliveryStore({ view, action, open, locked, controller, settling = false }: {
 view: StoreView;
 action(kind: DeliveryAction, id?: string): void;
 open(id: string): void;
 locked: boolean;
 controller: WindowController;
 settling?: boolean;
}) {
 const [search, setSearch] = useState('');
 const [tab, setTab] = useState<StoreTab>('all');
 const [confirm, setConfirm] = useState(false);
 const scroll = useRef<HTMLDivElement>(null);
 const pages = useRef(new Map<string, string | null>());
 const navigation = controller.win.navigation;
 const activeEntry = navigation.index >= 0 ? navigation.entries[navigation.index] : undefined;
 const selected = activeEntry ? pages.current.get(activeEntry) ?? null : null;

 useEffect(() => { scroll.current?.scrollTo(0, 0); setConfirm(false); }, [selected, tab]);
 useEffect(() => { controller.setModal(confirm); return () => controller.setModal(false); }, [confirm, controller.setModal]);
 useEffect(() => {
  if (controller.win.phase === 'closed') pages.current.clear();
  if (controller.win.phase === 'visible' && controller.win.navigation.index < 0) {
   const entry = crypto.randomUUID();
   pages.current.set(entry, null);
   controller.resetNavigation(entry);
  }
 }, [controller.win.phase, controller.win.navigation.index, controller.resetNavigation]);

 const app = view.apps.find(item => item.id === selected);
 const busy = !!view.job || view.phase === 'refreshing' || locked || settling;
 const unavailable = view.phase === 'unavailable';
 const notice = view.job ? '' : view.phase === 'refreshing' ? '' : view.message;
 const updateApps = view.apps.filter(hasAvailableUpdate);
 const filteredApps = view.apps
  .filter(item => tab === 'all' || hasAvailableUpdate(item))
  .filter(item => item.title.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

 const image = (app: StoreApp, className = '') => <StoreArtwork appId={app.id} artworkSha256={app.iconSha256} className={className}/>;
 const showHome = () => {
  const entry = crypto.randomUUID();
  pages.current.set(entry, null);
  controller.navigate(entry);
 };
 const selectTab = (next: StoreTab) => {
  setTab(next);
  setConfirm(false);
  if (selected !== null) showHome();
  else scroll.current?.scrollTo(0, 0);
 };
 const showDetails = (id: string) => {
  const entry = crypto.randomUUID();
  pages.current.set(entry, id);
  controller.navigate(entry);
 };

 const controls = (item: StoreApp, showOpenAlongsideUpdate = true) => {
  const job = view.job?.appId === item.id ? view.job : null;
  if (job) {
   const progress = jobDescription(job);
   return <div className="store-action delivery-store-progress" aria-label={`${item.title} installation progress`}>
    <div className="delivery-store-progress-label"><span>{progress.label}</span><strong>{progress.percent}%</strong></div>
    <progress aria-label={`${item.title} progress`} max={Math.max(1, job.total)} value={job.received}/>
    <button className="delivery-store-cancel" type="button" onClick={() => action('cancel')}>Cancel</button>
   </div>;
  }

  if (!item.activeVersion) {
   return <div className="store-action delivery-store-actions">
    <button className="delivery-store-primary" type="button" disabled={busy || !view.canInstall || !item.available} onClick={() => action('install', item.id)}>Install</button>
   </div>;
  }

  if (hasAvailableUpdate(item)) {
   return <div className="store-action delivery-store-actions">
    <button className="delivery-store-primary" type="button" disabled={busy || !view.canInstall} onClick={() => action('install', item.id)}>Update</button>
    {showOpenAlongsideUpdate && <button className="delivery-store-secondary" type="button" disabled={locked} onClick={() => open(runtimeIdForPackage(item.id))}>Open</button>}
   </div>;
  }

  return <div className="store-action delivery-store-actions">
   <button className="delivery-store-secondary" type="button" disabled={locked} onClick={() => open(runtimeIdForPackage(item.id))}>Open</button>
  </div>;
 };

 const statusRole = (reason: string) => /failed|recovery|withdrawn|unavailable/i.test(reason) ? 'alert' : 'status';
 const emptyTitle = unavailable ? 'App catalogue unavailable' : view.phase === 'refreshing' ? 'Checking apps…' : search ? 'No matching apps' : tab === 'updates' ? 'No new updates' : 'No apps available';
 const emptyDescription = unavailable ? 'Refresh to check the company catalogue again.' : search ? 'Try another app name.' : tab === 'updates' ? 'Your installed apps have no updates available.' : 'Verified company apps will appear here.';

 return <div className="store-body store-body--delivery" data-testid="store-window">
  <header className="delivery-store-header">
   <div className="delivery-store-brand">
    <img src={brandMarkUrl} alt="" aria-hidden="true" />
    <div><span>Sajilo Dental</span><h1>App Store</h1></div>
   </div>
   <button className="delivery-store-refresh" type="button" aria-label="Refresh company apps" disabled={busy} onClick={() => action('refresh')}><RefreshCw size={15} aria-hidden="true"/>Refresh</button>
  </header>
  {notice && <div className="delivery-store-notice" data-state={unavailable ? 'unavailable' : view.phase === 'refreshing' ? 'refreshing' : 'message'} role={unavailable ? 'alert' : 'status'} aria-live={unavailable ? 'assertive' : 'polite'} aria-atomic="true">
   <strong>{notice}</strong>
   {unavailable && <span>{view.apps.some(item => item.installedVersion) ? 'Installed apps remain available. Refresh to try again.' : 'App installation and updates are unavailable. Refresh to try again.'}</span>}
  </div>}
  <div className="delivery-store-toolbar">
   <nav className="delivery-store-tabs" role="tablist" aria-label="Store sections">
    <button type="button" role="tab" aria-selected={tab === 'all'} aria-pressed={tab === 'all'} disabled={settling} onClick={() => selectTab('all')}>All Apps</button>
    <button type="button" role="tab" aria-selected={tab === 'updates'} aria-pressed={tab === 'updates'} disabled={settling} onClick={() => selectTab('updates')}>New Updates{updateApps.length > 0 && <span className="delivery-store-update-count" aria-hidden="true">{updateApps.length}</span>}</button>
   </nav>
   <label className="staff-search delivery-store-search">
    <Search size={16} aria-hidden="true"/>
    <input aria-label="Search store" placeholder="Search apps…" value={search} disabled={settling} onChange={event => setSearch(event.target.value)}/>
   </label>
  </div>
  <div className="store-scroll delivery-store-scroll" ref={scroll} data-settling={settling || undefined} aria-busy={settling || undefined}>
   {app ? <>
    <header className="store-detail delivery-store-detail">
     {image(app, 'delivery-store-icon')}
     <div className="delivery-store-detail-copy"><h2>{app.title}</h2><p>{app.description}</p></div>
     {controls(app)}
    </header>
    <dl className="delivery-store-versions" aria-label="App versions">
     <div><dt>Store version</dt><dd>{app.version}</dd></div>
     <div><dt>Installed version</dt><dd>{app.activeVersion ?? 'Not installed'}</dd></div>
     {app.pendingVersion && <div><dt>Update</dt><dd>{app.pendingReady ? `Ready · ${app.pendingVersion}` : `Staged · ${app.pendingVersion}`}</dd></div>}
     {app.trialVersion && <div><dt>Update check</dt><dd>In progress · {app.trialVersion}</dd></div>}
    </dl>
    {updateStatus(app) && <p className="delivery-update-state" role="status">{updateStatus(app)}</p>}
    {app.reason && <p className="delivery-store-reason" role={statusRole(app.reason)}>{app.reason}</p>}
    {app.activeVersion && <div className="store-manage delivery-store-manage">
     {confirm ? <div role="group" aria-label="Confirm uninstall">
      <strong>Uninstall {app.title}?</strong>
      <p>Close its window first. This removes the app from this device; clinic records remain on the server.</p>
      <div className="delivery-store-manage-actions">
       <button className="delivery-store-secondary" type="button" autoFocus onClick={() => setConfirm(false)}>Keep app</button>
       <button className="delivery-store-danger" type="button" disabled={busy || !view.canInstall} onClick={() => { action('uninstall', app.id); setConfirm(false); }}>Confirm uninstall</button>
      </div>
     </div> : <button className="delivery-store-uninstall" type="button" disabled={busy || !view.canInstall} onClick={() => setConfirm(true)}>Uninstall</button>}
    </div>}
   </> : <>
    <div className="store-grid delivery-store-list">
     {filteredApps.map(item => <article key={item.id} className="delivery-store-row">
      <button className="store-app-link delivery-store-app-link" type="button" aria-label={`Details ${item.title}`} disabled={settling} onClick={() => showDetails(item.id)}>
       {image(item, 'delivery-store-icon')}
       <span className="delivery-store-app-copy">
        <strong>{item.title}</strong>
        <span className="delivery-store-description">{item.description}</span>
        <small>{appStatus(item)}</small>
       </span>
      </button>
      {controls(item, tab === 'all')}
     </article>)}
    </div>
    {!filteredApps.length && <section className="store-empty delivery-store-empty" role={unavailable ? 'alert' : 'status'} aria-busy={view.phase === 'refreshing'}><h2>{emptyTitle}</h2><p>{emptyDescription}</p></section>}
   </>}
  </div>
  <footer className="staff-footer delivery-store-footer"><span>{view.canInstall ? 'Clinic administrator · App management allowed' : 'App management requires clinic administrator permission'}</span></footer>
 </div>;
}
