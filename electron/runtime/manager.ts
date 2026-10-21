import { WebContentsView, session, nativeImage, type BrowserWindow, type IpcMainEvent, type IpcMainInvokeEvent, type NativeImage } from 'electron';
import { ApiBroker, type Caller, type Identity, type Transport } from '../sdk/broker';
import type { Result } from '../sdk/contracts';
import { staging } from '../sdk/environment';
import { fixtureServices } from '../sdk/fixtures';
import { PackageRegistry, type Lease } from '../packages/registry';
import { RestartBudget } from './restartBudget';
import { appInfo, parseDentalAppMetadata, type DentalAppInfo, type DentalAppMetadata } from '../packages/appMetadata';
import type { EventCode, Target } from '../diagnostics/store';
import { randomUUID } from 'node:crypto';
import { compositePixels, isRuntimeId, packageIdForRuntime, runtimeHost, runtimeIdForPackage, parseLayout, type RuntimeId, type RuntimeLayout, type RuntimeState, type RuntimeRect } from './contracts';
const moduleSelectionAckTimeoutMs=10_000;
const appLaunchHealthTimeoutMs=20_000;
type Entry = { connected?: boolean; healthy?:boolean; healthTimer?:ReturnType<typeof setTimeout>; view: WebContentsView; lease?: Lease; appMetadata?: DentalAppMetadata; moduleId?: string; moduleAcks?: Map<string,{resolve:(accepted:boolean)=>void;timer:ReturnType<typeof setTimeout>}>; state: RuntimeState; rect: RuntimeRect; image?: NativeImage; capturePromise?: Promise<void>; captureTimer?: ReturnType<typeof setTimeout>; watchdog?: ReturnType<typeof setInterval>; pingTimer?: ReturnType<typeof setTimeout>; launchFadePrepared?:boolean; launchFadeStarted?:boolean };
export class FixtureRuntime {
  private services = fixtureServices();
  private broker: ApiBroker;
  private identity: Identity;
  private entries = new Map<RuntimeId, Entry>();
  private desired: RuntimeLayout[] = [];
  private sessions = new Map<RuntimeId, ReturnType<typeof session.fromPartition>>();
  private selectedModules = new Map<RuntimeId, string>();
  private instance = randomUUID();
  private lastEmission = '';
  private restartBudget=new RestartBudget();
  private launchFeedbackFixture = false;
  constructor(private win: BrowserWindow, private packages: PackageRegistry, private preload: string, identity?: Identity, private changed:()=>void=()=>{}, options:{transport:'fixture'|'staging';dropFirstWriteResponse?:boolean;modulePreviewFixture?:boolean;launchFeedbackFixture?:boolean;diagnostic?:(code:EventCode,target:Target)=>void}={transport:'fixture'}) {
    this.diagnostic=options.diagnostic??(()=>{});
    this.launchFeedbackFixture=!!options.launchFeedbackFixture;
    const baseIdentity=identity??this.services.identity;
    this.identity=options.launchFeedbackFixture?{...baseIdentity,snapshot:()=>({...baseIdentity.snapshot(),clinicSession:{clinicUser:{role:'admin',capabilities:['followups.access','appointments.access','work_entry.access','patient_record.access','treatment_progress.access','lab_tracker.access','finance.manage','patient_payments.outstanding.read','staff.manage','treatment_protocols.manage','calendar.access','future_billing.access']}}})}:options.modulePreviewFixture?{...baseIdentity,snapshot:()=>({...baseIdentity.snapshot(),clinicSession:{clinicUser:{role:'admin',capabilities:['fixture.module-preview']}}})}:baseIdentity;
    const base:Transport=options.transport==='staging'?fetch:this.services.transport;let drop=!!options.dropFirstWriteResponse;
    const transport:Transport=async(url,init)=>{const response=await base(url,init);if(drop&&init.method==='POST'&&new URL(url).pathname.match(/^\/v1\/appointments\/[0-9a-f-]{36}\/status$/)&&response.ok){drop=false;await response.arrayBuffer();throw Error('Private one-shot lost-response injection');}return response;};
    this.broker=new ApiBroker(staging,this.identity,transport,undefined,appId=>{const e=[...this.entries.values()].find(e=>e.lease?.manifest.appId===appId);if(e){e.state.writeState=this.broker.writeState(appId);this.emit();}});
  }
  private diagnostic:(code:EventCode,target:Target)=>void;
  private emit() {
    const states=[...this.entries.values()].map(e=>e.state), key=JSON.stringify(states);
    if (!this.win.isDestroyed() && key!==this.lastEmission) { this.lastEmission=key; this.win.webContents.send('runtime:state', states); }
  }
  private resolveModuleAcks(e:Entry,accepted:boolean){
    if(!e.moduleAcks)return;
    for(const ack of e.moduleAcks.values()){clearTimeout(ack.timer);ack.resolve(accepted);}
    e.moduleAcks.clear();
  }
  private markUnresponsive(e:Entry) {
    if(this.entries.get(e.state.id)!==e||e.state.phase!=='ready')return;
    e.state.phase='unresponsive';e.state.reason='unresponsive';
    // Keep the last frame available behind the recovery notice, but stop
    // routing input to a renderer that Electron says is not responding.
    e.view.setVisible(false);this.emit();
  }
  private markResponsive(e:Entry) {
    if(this.entries.get(e.state.id)!==e||e.state.phase!=='unresponsive')return;
    e.state.phase='ready';delete e.state.reason;this.applyVisibility(e);this.emit();
    void this.refresh(e,true);
  }
  private fail(e: Entry, reason: string) {
    if (this.entries.get(e.state.id)!==e || e.state.phase === 'failed') return;
    const wasVisible = e.view.getVisible();
    this.restartBudget.failed(e.state.id);this.diagnostic('app-failed',e.state.id==='studio'||e.state.id==='records'?e.state.id:'company-app');
    e.image=undefined;e.state.snapshot=undefined;clearTimeout(e.captureTimer);this.resolveModuleAcks(e,false);
    clearTimeout(e.healthTimer);if(e.lease){try{this.packages.markFailed(e.lease.manifest.appId,e.lease.release.digest);this.changed();}catch{reason='update-recovery-required';}}
    this.broker.unregister(e.view.webContents);
    e.state.phase = 'failed'; e.state.reason = reason; e.view.setVisible(false);
    if (wasVisible && !this.win.isDestroyed()) this.win.webContents.focus();
    clearInterval(e.watchdog); clearTimeout(e.pingTimer); this.emit();
  }
  private applyVisibility(e: Entry) {
    const wanted = this.desired.find(v => v.id === e.state.id);
    const visible = !!wanted?.visible && e.state.phase === 'ready';
    if (visible) {
      e.view.setVisible(true);
      if(e.launchFadePrepared&&!e.launchFadeStarted){
        e.launchFadeStarted=true;
        void e.view.webContents.executeJavaScript('window.__dentalOSLaunchAnimation?.play()').catch(()=>{});
      }
    }
    else this.hideForMirror(e);
  }
  private async prepareLaunchFade(e:Entry):Promise<boolean>{
    if(packageIdForRuntime(e.state.id)!==e.state.id||e.view.webContents.isDestroyed())return false;
    try{return await e.view.webContents.executeJavaScript(`(()=>{
      if(matchMedia('(prefers-reduced-motion: reduce)').matches||typeof document.documentElement.animate!=='function')return false;
      const animation=document.documentElement.animate([{opacity:0},{opacity:1}],{duration:260,easing:'ease-out',fill:'both'});
      animation.pause();animation.currentTime=0;
      Object.defineProperty(window,'__dentalOSLaunchAnimation',{value:animation,configurable:true});
      return true;
    })()`);}catch{return false;}
  }
  private hideForMirror(e:Entry) {
    if (!e.view.getVisible()) return;
    // Keep the last stable app frame in the shell while the replacement is
    // captured. Clearing it first flashes the renderer's empty/loading surface
    // during ordinary handoffs such as revealing the dock.
    void this.refresh(e,true);
    e.view.setVisible(false);
  }
  /** Hide native child surfaces immediately before the renderer changes its front window. */
  hideAll() {
    for (const e of this.entries.values()) this.hideForMirror(e);
  }
  private async refresh(e: Entry, fresh = false) {
    // An explicit shell capture must not return an older frame just because a
    // debounced mirror capture is still running. Serialize, then refresh again.
    if (e.capturePromise) { await e.capturePromise; if (!fresh) return; }
    if (e.state.phase !== 'ready' || e.view.webContents.isDestroyed()) return;
    e.capturePromise = (async () => {
      try {
        const image = await e.view.webContents.capturePage();
        if (this.entries.get(e.state.id) === e && e.state.phase==='ready' && !image.isEmpty()) {
          e.image = image;
          // Inactive app windows show this image at the full native surface size.
          // A 640px overview thumbnail stretched across that window made its text
          // look blurred whenever another app or shell window took focus.
          e.state.snapshot = image.toDataURL();
          this.emit();
        }
      } catch { /* Failed renderer is handled by lifecycle supervision. */ }
      finally { e.capturePromise = undefined; }
    })();
    await e.capturePromise;
  }
  private asset(id: RuntimeId, url: string) {
    const lease = this.entries.get(id)?.lease; if (!lease) return;
    try {
      const u = new URL(url), host = runtimeHost(id);
      if (u.protocol !== 'dental-fixture:' || u.host !== host || u.username || u.password || u.search || u.hash || u.pathname.includes('%')) return;
      let name = u.pathname.slice(1); if(!name||name.endsWith('/'))name+='index.html';
      const bytes = lease.files.get(name); if (!bytes) return;
      const ext = name.split('.').pop() ?? '';
      const types: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2' };
      return { bytes, type: types[ext] ?? 'application/octet-stream' };
    } catch { return; }
  }
  private callerEntry(event: IpcMainInvokeEvent) {
    if(event.senderFrame!==event.sender.mainFrame)return undefined;
    return [...this.entries.values()].find(entry=>entry.view.webContents===event.sender&&entry.state.phase==='ready'&&entry.lease);
  }
  private appInfoFor(pkg: Lease | ReturnType<PackageRegistry['inspectPackage']>, metadata?: DentalAppMetadata): DentalAppInfo | undefined {
    const session=this.identity.snapshot().clinicSession as {clinicUser?:{role?:string;capabilities?:unknown}}|undefined;
    if(!session?.clinicUser||!Array.isArray(session.clinicUser.capabilities))return undefined;
    return appInfo(pkg,metadata,session.clinicUser.role,session.clinicUser.capabilities.filter((value):value is string=>typeof value==='string'));
  }
  private visibleAppInfo(entry: Entry): DentalAppInfo | undefined {
    return entry.lease ? this.appInfoFor(entry.lease,entry.appMetadata) : undefined;
  }
  private installedAppInfo(id: RuntimeId): DentalAppInfo | undefined {
    try {
      const pkg=this.packages.inspectPackage(packageIdForRuntime(id));
      return this.appInfoFor(pkg,parseDentalAppMetadata(pkg));
    } catch { return undefined; }
  }
  discoverApp(id: unknown): Result<(DentalAppInfo & {runtimeId:RuntimeId}) | null> {
    if(!isRuntimeId(id))return{ok:false,error:{code:'INVALID_REQUEST',message:'This app cannot be opened.',outcome:'not_sent'}};
    try {
      const pkg=this.packages.inspectPackage(packageIdForRuntime(id));
      const metadata=parseDentalAppMetadata(pkg);
      if(!metadata)return{ok:true,value:null};
      const info=this.appInfoFor(pkg,metadata);
      if(!info)return{ok:false,error:{code:'ACCESS_DENIED',message:'This app is not available for your current clinic role.',outcome:'not_sent'}};
      return{ok:true,value:{runtimeId:id,...info}};
    } catch {
      return{ok:false,error:{code:'UNAVAILABLE',message:'The installed app could not be verified.',outcome:'not_sent'}};
    }
  }
  appInfo(event: IpcMainInvokeEvent) {
    const entry=this.callerEntry(event),info=entry&&this.visibleAppInfo(entry);
    return info?{ok:true as const,value:info}:{ok:false as const,error:{code:'ACCESS_DENIED',message:'This app is not available for the current clinic role.',outcome:'not_sent' as const}};
  }
  openExplorer(event: IpcMainInvokeEvent) {
    const entry=this.callerEntry(event),info=entry&&this.visibleAppInfo(entry);
    if(!entry||!info||info.modules.length<2)return{ok:false as const,error:{code:'ACCESS_DENIED',message:'There are no additional apps available for this window.',outcome:'not_sent' as const}};
    this.win.webContents.send('runtime:app-explorer',{runtimeId:entry.state.id,...info});
    return{ok:true as const,value:{opened:true}};
  }
  private sendModuleSelection(entry:Entry,moduleId:string):Promise<boolean>{
    const wc=entry.view.webContents;
    if(wc.isDestroyed())return Promise.resolve(false);
    const selectionId=randomUUID(),acks=entry.moduleAcks??=new Map();
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{acks.delete(selectionId);resolve(false);},moduleSelectionAckTimeoutMs);
      acks.set(selectionId,{resolve,timer});
      try{wc.send('runtime:module-selected',{moduleId,selectionId});}
      catch{clearTimeout(timer);acks.delete(selectionId);resolve(false);}
    });
  }
  acknowledgeModule(event:IpcMainEvent,input:unknown){
    if(event.senderFrame!==event.sender.mainFrame||!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).sort().join()!=='selectionId'||typeof (input as {selectionId?:unknown}).selectionId!=='string'||!/^[a-f0-9-]{36}$/.test((input as {selectionId:string}).selectionId))return;
    const entry=[...this.entries.values()].find(value=>value.view.webContents===event.sender),selectionId=(input as {selectionId:string}).selectionId,ack=entry?.moduleAcks?.get(selectionId);
    if(!entry||!ack)return;
    clearTimeout(ack.timer);entry.moduleAcks!.delete(selectionId);
    if(entry.state.phase==='ready'){
      // The selected module may have replaced the entire app body without
      // changing lifecycle state. Do not let the explorer close until its
      // full-resolution mirror represents that newly selected module.
      entry.image=undefined;entry.state.snapshot=undefined;this.emit();
      void this.refresh(entry,true).finally(()=>ack.resolve(true));
    }else ack.resolve(true);
  }
  async selectModule(id: unknown,moduleId: unknown) {
    if(!isRuntimeId(id)||typeof moduleId!=='string'||!/^[a-z0-9][a-z0-9-]{0,63}$/.test(moduleId))return{ok:false as const,code:'INVALID'};
    const entry=this.entries.get(id),info=entry?this.visibleAppInfo(entry):this.installedAppInfo(id);
    if(!info||!info.modules.some(module=>module.id===moduleId))return{ok:false as const,code:'DENIED'};
    if(entry?.state.phase==='failed')return{ok:false as const,code:'UNAVAILABLE'};
    if(entry?.state.phase==='ready'&&!await this.sendModuleSelection(entry,moduleId))return{ok:false as const,code:'NOT_READY'};
    this.selectedModules.set(id,moduleId);
    if(entry)entry.moduleId=moduleId;
    return{ok:true as const};
  }
  private create(id: RuntimeId, rect: RuntimeRect) {
    const host = runtimeHost(id);
    let ses = this.sessions.get(id);
    if (!ses) {
    ses = session.fromPartition(`fixture-${host}-${this.instance}`);
    this.sessions.set(id, ses);
    ses.setSpellCheckerEnabled(false);
    ses.setSpellCheckerLanguages([]);
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', event => event.preventDefault());
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !this.asset(id, details.url) }));
    void ses.protocol.handle('dental-fixture', request => {
      const asset = this.asset(id, request.url);
      return asset ? new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': asset.type, 'Content-Security-Policy': "default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } }) : new Response('Denied', { status: 403 });
    });
    }
    const view = new WebContentsView({ webPreferences: { session: ses, preload: this.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, webSecurity: true, backgroundThrottling: false } });
    const e: Entry = { view, state: { id, phase: 'loading', dirty: false, modal: false }, rect };
    this.entries.set(id, e); view.setVisible(false); this.win.contentView.addChildView(view);
    view.setBounds(rect);
    const wc = view.webContents;
    if(this.restartBudget.remaining(id)){e.state.phase='failed';e.state.reason='restart-limit';this.emit();return e;}
    try { e.lease = this.packages.launch(packageIdForRuntime(id)); e.appMetadata=parseDentalAppMetadata(e.lease); } catch { this.fail(e, 'package-verification-failed'); return e; }
    const selected=this.selectedModules.get(id),info=this.visibleAppInfo(e);
    if(selected&&info?.modules.some(module=>module.id===selected))e.moduleId=selected;
    else if(selected)this.selectedModules.delete(id);
    e.healthTimer=setTimeout(()=>this.fail(e,'launch-health-timeout'),appLaunchHealthTimeoutMs);
    const lease = e.lease, entryLocation=lease.manifest.entry==='index.html'?'':lease.manifest.entry.endsWith('/index.html')?lease.manifest.entry.slice(0,-'index.html'.length):lease.manifest.entry, entryURL = `dental-fixture://${host}/${entryLocation}`;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', event => event.preventDefault());
    wc.on('will-frame-navigate', event => event.preventDefault());
    wc.on('will-attach-webview', event => event.preventDefault());
    wc.on('render-process-gone', () => this.fail(e, 'renderer-exited'));
    wc.on('unresponsive', () => this.markUnresponsive(e));
    wc.on('responsive', () => this.markResponsive(e));
    wc.on('did-finish-load', async () => {
      if (this.entries.get(id) !== e) return;
      if(e.moduleId){
        // Keep this native surface hidden until the chosen UI has applied its
        // module, preventing the default screen from flashing on first launch.
        let stable=false;
        for(let attempt=0;attempt<8&&e.moduleId;attempt++){
          const requested:string=e.moduleId;
          if(!await this.sendModuleSelection(e,requested)){this.fail(e,'module-selection-unavailable');return;}
          if(e.moduleId===requested){stable=true;break;}
        }
        if(!stable){this.fail(e,'module-selection-unavailable');return;}
        if(this.entries.get(id)!==e)return;
      }
      if(this.launchFeedbackFixture&&id==='company.dental.patient-record'){
        // Keep one private first-party fixture loading long enough to verify
        // that shell feedback waits for readiness as well as the minimum.
        await new Promise(resolve=>setTimeout(resolve,1200));
        if(this.entries.get(id)!==e||wc.isDestroyed())return;
      }
      e.launchFadePrepared=await this.prepareLaunchFade(e);
      if(this.entries.get(id)!==e||wc.isDestroyed())return;
      this.broker.register({ sender: wc, frame: wc.mainFrame, origin: entryURL, appId: lease.manifest.appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities], authorize:()=>{try{this.packages.assertAllowed(lease);return true;}catch{return false;}}, report: value => this.reportState(e, value) });
      e.connected=this.broker.connect({sender:wc,frame:wc.mainFrame,url:entryURL},{major:1,minor:0}).ok;
      e.state.phase = 'ready'; this.applyVisibility(e); if (e.view.getVisible()) wc.focus(); this.emit();
      e.captureTimer = setTimeout(() => void this.refresh(e), 100);
      let pending = false;
      e.watchdog = setInterval(() => {
        if (pending || wc.isDestroyed() || e.state.phase !== 'ready') return;
        pending = true;
        // executeJavaScript can be delayed by renderer/desktop load even when
        // the app is alive. Wait for a sustained miss and present recovery;
        // never kill an app solely because this advisory ping was late.
        e.pingTimer = setTimeout(() => this.markUnresponsive(e), 5000);
        void wc.executeJavaScript('document.readyState === "complete" && !!document.body && typeof window.dentalApp?.connect === "function"').then(ready => { clearTimeout(e.pingTimer); pending = false;if(this.entries.get(id)!==e)return;if(e.state.phase==='unresponsive')this.markResponsive(e);if(ready&&e.connected&&!e.healthy){try{this.packages.markHealthy(lease.manifest.appId,lease.release.digest);e.healthy=true;clearTimeout(e.healthTimer);this.changed();}catch{this.fail(e,'update-policy-refused');}} }).catch(() => { clearTimeout(e.pingTimer); pending = false; });
      }, 2000);
    });
    void wc.loadURL(entryURL).catch(() => this.fail(e, 'load-failed'));
    return e;
  }
  sync(input: unknown) {
    const next = parseLayout(input);
    const [width, height] = this.win.getContentSize();
    for (const layout of next) {
      const horizontalOverflow = Math.max(0, -layout.rect.x, layout.rect.x + layout.rect.width - width);
      if (horizontalOverflow > layout.rect.width * .7 + 1 || layout.rect.y + layout.rect.height > height + 1) throw new Error('Outside host');
    }
    const hadNativeInput = [...this.entries.values()].some(e => e.view.getVisible());
    this.desired = next;
    const retained = new Set(next.map(layout => layout.id));
    for (const id of [...this.entries.keys()]) if (!retained.has(id)) {
      const e = this.entries.get(id)!;
      if (this.broker.hasUnsafeWrites(e.lease?.manifest.appId ?? '')) { e.view.setVisible(false); this.win.webContents.send('runtime:close-blocked', { id }); }
      else this.close(id);
    }
    for (const layout of this.desired) {
      let e = this.entries.get(layout.id);
      if (!layout.open) { if (e) {if(this.broker.hasUnsafeWrites(e.lease?.manifest.appId??'')){e.view.setVisible(false);this.win.webContents.send('runtime:close-blocked',{id:layout.id});}else this.close(layout.id);} continue; }
      const rect = Object.fromEntries(Object.entries(layout.rect).map(([k, v]) => [k, Math.round(v)])) as RuntimeRect;
      e ??= this.create(layout.id, rect);
      e.rect = rect; e.view.setBounds(rect); e.view.setBorderRadius(rect.x===0&&rect.width===width?0:10);
      this.applyVisibility(e);
    }
    // Choose focus after all visibility changes, independent of registry order.
    const foreground = [...this.entries.values()].find(e => e.view.getVisible());
    if (foreground && !foreground.view.webContents.isFocused()) foreground.view.webContents.focus();
    else if (!foreground && hadNativeInput) this.win.webContents.focus();
    this.emit();
  }
  restart(id: unknown) {
    if (!isRuntimeId(id)) throw new Error('Invalid runtime');
    const e = this.entries.get(id);
    if (!e || !['failed','unresponsive'].includes(e.state.phase)) throw new Error('Runtime is not awaiting recovery');
    if(this.broker.hasUnsafeWrites(e.lease?.manifest.appId??''))throw Error('Resolve the server change before restarting');
    if(this.restartBudget.remaining(id)){e.state.reason='restart-limit';this.emit();throw Error('Restart limit reached. Wait one minute, then try again.');}
    this.diagnostic('app-restarted',id==='studio'||id==='records'?id:'company-app');const rect = e.rect; this.close(id); this.create(id, rect);
  }
  report(event: IpcMainEvent, input: unknown) {
    const e = [...this.entries.values()].find(e => e.view.webContents === event.sender);
    if (!e || event.senderFrame !== event.sender.mainFrame) return;
    const v = input as { dirty: boolean; modal: boolean };
    if (!v || Object.keys(v).sort().join() !== 'dirty,modal' || typeof v.dirty !== 'boolean' || typeof v.modal !== 'boolean') return;
    this.reportState(e, v);
  }
  private reportState(e: Entry, v: { dirty: boolean; modal: boolean }) {
    const changed=e.state.dirty!==v.dirty||e.state.modal!==v.modal;
    e.state.dirty = v.dirty; e.state.modal = v.modal; if(changed)this.emit();
    clearTimeout(e.captureTimer); e.captureTimer = setTimeout(() => void this.refresh(e), 120);
  }
  sdk(kind: 'connect' | 'request' | 'cancel', event: { sender: Electron.WebContents; senderFrame: Electron.WebFrameMain | null }, input: unknown) {
    const caller: Caller = { sender: event.sender, frame: event.senderFrame, url: event.senderFrame?.url ?? '' };
    const result=this.broker[kind](caller, input);
    if(kind==='connect'&&!(result instanceof Promise)&&result.ok){const e=[...this.entries.values()].find(e=>e.view.webContents===event.sender);if(e)e.connected=true;}
    return result;
  }
  edge(event: IpcMainEvent, input: unknown) {
    const e = [...this.entries.values()].find(e => e.view.webContents === event.sender);
    if (!e || event.senderFrame !== event.sender.mainFrame || !e.view.getVisible()) return;
    const v = input as { x: number; y: number };
    if (!v || ![v.x,v.y].every(n=>typeof n==='number'&&Number.isFinite(n)) || v.x<0 || v.x>e.rect.width || v.y<e.rect.height-160 || v.y>e.rect.height) return;
    this.win.webContents.send('runtime:edge', { x: v.x + e.rect.x, y: v.y + e.rect.y });
  }
  shortcut(event: IpcMainEvent, input: unknown) {
    const e=[...this.entries.values()].find(e=>e.view.webContents===event.sender);
    if(!e || event.senderFrame!==event.sender.mainFrame || !e.view.getVisible())return;
    const v=input as {key:string;code:string;repeat:boolean};
    if(!v || Object.keys(v).sort().join()!=='code,key,repeat' || typeof v.repeat!=='boolean' || !((v.key==='`'&&v.code==='Backquote')||(v.key==='Escape'&&v.code==='Escape')))return;
    this.win.webContents.send('runtime:key',v);
  }
  async capture(rect: RuntimeRect, base: NativeImage): Promise<NativeImage> {
    const size = base.getSize(); const bytes = base.toBitmap(); const scaleX = size.width / rect.width, scaleY = size.height / rect.height;
    for (const e of this.entries.values()) {
      const [hostWidth,hostHeight]=this.win.getContentSize();
      const wholeHost=rect.x===0&&rect.y===0&&rect.width===hostWidth&&rect.height===hostHeight;
      if (wholeHost ? !e.view.getVisible() : (Math.abs(e.rect.x - rect.x) > 3 || Math.abs(e.rect.width - rect.width) > 3 || e.rect.y - rect.y < 40 || e.rect.y - rect.y > 46)) continue;
      await this.refresh(e, true); if (!e.image) continue;
      const s = e.image.getSize();
      compositePixels(bytes, size.width, size.height, e.image.toBitmap(), s.width, s.height, { x: (e.rect.x-rect.x)*scaleX, y: (e.rect.y-rect.y)*scaleY, width:e.rect.width*scaleX,height:e.rect.height*scaleY, radius:e.rect.x===0&&e.rect.width===hostWidth?0:10*scaleX });
    }
    return nativeImage.createFromBitmap(bytes, { width: size.width, height: size.height });
  }
  close(id: RuntimeId) {
    const e = this.entries.get(id); if (!e) return;
    this.resolveModuleAcks(e,false);
    this.broker.unregister(e.view.webContents);
    e.lease?.releaseLease();
    this.entries.delete(id); clearTimeout(e.healthTimer); clearTimeout(e.captureTimer); clearTimeout(e.pingTimer); clearInterval(e.watchdog);
    this.win.contentView.removeChildView(e.view);
    if (!e.view.webContents.isDestroyed()) e.view.webContents.close();
    e.image = undefined;
  }
  updateNow(appId:string) {
    const id=runtimeIdForPackage(appId);if(!isRuntimeId(id))throw Error('Unknown update app');
    const e=this.entries.get(id);if(this.broker.hasUnsafeWrites(appId))throw Error('Resolve pending or unknown write before updating');
    if(e&&(e.state.dirty||e.state.modal||e.state.phase!=='ready'))throw Error('Save work and close dialogs before updating');
    const layout=this.desired.find(item=>item.id===id);
    const rect=e?.rect??(layout?.open?layout.rect:undefined);
    if(!rect)throw Error('Open the app before applying its update');
    const expected=this.packages.describe(appId).pendingVersion;
    if(!expected)throw Error('No verified app update is staged');
    if(this.packages.pendingActivationVersion(appId)!==expected)throw Error('The current app release has not passed its launch health check');
    if(e)this.close(id);
    if(this.packages.hasActiveLease(appId))throw Error('Another runtime instance still holds the app package');
    const next=this.create(id,rect);
    if(!next.lease||next.state.phase==='failed'||next.lease.manifest.version!==expected){this.close(id);throw Error('The staged app version did not start');}
    this.applyVisibility(next);this.emit();this.changed();
  }
  blockUnsafeExit(){const e=[...this.entries.values()].find(e=>this.broker.hasUnsafeWrites(e.lease?.manifest.appId??''));if(!e)return false;this.diagnostic('exit-blocked','host');this.win.webContents.send('runtime:close-blocked',{id:e.state.id});return true;}
  clearSession() {
    this.broker.invalidateSession();for(const id of [...this.entries.keys()])this.close(id);
    // Closing a WebContents does not erase session storage. Never reuse a prior
    // account's in-memory partition, even while asynchronous erasure completes.
    const previous=[...this.sessions.values()];this.sessions.clear();this.instance=randomUUID();
    for(const ses of previous){try{ses.protocol.unhandle('dental-fixture');}catch{}void ses.clearStorageData().catch(()=>{});void ses.clearCache().catch(()=>{});}
  }
  dispose() { for (const id of [...this.entries.keys()]) this.close(id); this.broker.dispose(); }
}
