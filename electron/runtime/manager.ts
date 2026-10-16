import { WebContentsView, session, nativeImage, type BrowserWindow, type IpcMainEvent, type NativeImage } from 'electron';
import { ApiBroker, type Caller, type Identity, type Transport } from '../sdk/broker';
import { staging } from '../sdk/environment';
import { fixtureServices } from '../sdk/fixtures';
import { PackageRegistry, type Lease } from '../packages/registry';
import { randomUUID } from 'node:crypto';
import { compositePixels, parseLayout, runtimeIds, type RuntimeId, type RuntimeLayout, type RuntimeState, type RuntimeRect } from './contracts';
type Entry = { connected?: boolean; healthy?:boolean; healthTimer?:ReturnType<typeof setTimeout>; view: WebContentsView; lease?: Lease; state: RuntimeState; rect: RuntimeRect; image?: NativeImage; capturePromise?: Promise<void>; captureTimer?: ReturnType<typeof setTimeout>; watchdog?: ReturnType<typeof setInterval>; pingTimer?: ReturnType<typeof setTimeout> };
export class FixtureRuntime {
  private services = fixtureServices();
  private broker: ApiBroker;
  private entries = new Map<RuntimeId, Entry>();
  private desired: RuntimeLayout[] = [];
  private sessions = new Map<RuntimeId, ReturnType<typeof session.fromPartition>>();
  private instance = randomUUID();
  private lastEmission = '';
  constructor(private win: BrowserWindow, private packages: PackageRegistry, private preload: string, identity?: Identity, private changed:()=>void=()=>{}, options:{transport:'fixture'|'staging';dropFirstWriteResponse?:boolean}={transport:'fixture'}) {
    const base:Transport=options.transport==='staging'?fetch:this.services.transport;let drop=!!options.dropFirstWriteResponse;
    const transport:Transport=async(url,init)=>{const response=await base(url,init);if(drop&&init.method==='POST'&&new URL(url).pathname.match(/^\/v1\/appointments\/[0-9a-f-]{36}\/status$/)&&response.ok){drop=false;await response.arrayBuffer();throw Error('Private one-shot lost-response injection');}return response;};
    this.broker=new ApiBroker(staging,identity??this.services.identity,transport,undefined,appId=>{const e=[...this.entries.values()].find(e=>e.lease?.manifest.appId===appId);if(e){e.state.writeState=this.broker.writeState(appId);this.emit();}});
  }
  private emit() {
    const states=[...this.entries.values()].map(e=>e.state), key=JSON.stringify(states);
    if (!this.win.isDestroyed() && key!==this.lastEmission) { this.lastEmission=key; this.win.webContents.send('runtime:state', states); }
  }
  private fail(e: Entry, reason: string) {
    if (this.entries.get(e.state.id)!==e || e.state.phase === 'failed') return;
    const wasVisible = e.view.getVisible();
    clearTimeout(e.healthTimer);if(e.lease){try{this.packages.markFailed(e.lease.manifest.appId,e.lease.release.digest);this.changed();}catch{reason='update-recovery-required';}}
    this.broker.unregister(e.view.webContents);
    e.state.phase = 'failed'; e.state.reason = reason; e.view.setVisible(false);
    if (wasVisible && !this.win.isDestroyed()) this.win.webContents.focus();
    clearInterval(e.watchdog); clearTimeout(e.pingTimer); this.emit();
  }
  private applyVisibility(e: Entry) {
    const wanted = this.desired.find(v => v.id === e.state.id);
    const visible = !!wanted?.visible && e.state.phase === 'ready';
    e.view.setVisible(visible);
  }
  private async refresh(e: Entry, fresh = false) {
    // An explicit shell capture must not return an older frame just because a
    // debounced mirror capture is still running. Serialize, then refresh again.
    if (e.capturePromise) { await e.capturePromise; if (!fresh) return; }
    if (e.state.phase !== 'ready' || e.view.webContents.isDestroyed()) return;
    e.capturePromise = (async () => {
      try {
        const image = await e.view.webContents.capturePage();
        if (this.entries.get(e.state.id) === e && !image.isEmpty()) { e.image = image; e.state.snapshot=image.toDataURL(); this.emit(); }
      } catch { /* Failed renderer is handled by lifecycle supervision. */ }
      finally { e.capturePromise = undefined; }
    })();
    await e.capturePromise;
  }
  private asset(id: RuntimeId, url: string) {
    const lease = this.entries.get(id)?.lease; if (!lease) return;
    try {
      const u = new URL(url), host = id === 'studio' ? 'alpha' : 'beta';
      if (u.protocol !== 'dental-fixture:' || u.host !== host || u.username || u.password || u.search || u.hash || u.pathname.includes('%')) return;
      const name = u.pathname.slice(1), bytes = lease.files.get(name); if (!bytes) return;
      const ext = name.split('.').pop() ?? '';
      const types: Record<string, string> = { html: 'text/html; charset=utf-8', js: 'text/javascript; charset=utf-8', css: 'text/css; charset=utf-8', json: 'application/json', svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', woff2: 'font/woff2' };
      return { bytes, type: types[ext] ?? 'application/octet-stream' };
    } catch { return; }
  }
  private create(id: RuntimeId, rect: RuntimeRect) {
    const host = id === 'studio' ? 'alpha' : 'beta';
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
      return asset ? new Response(new Uint8Array(asset.bytes), { headers: { 'Content-Type': asset.type, 'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'", 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' } }) : new Response('Denied', { status: 403 });
    });
    }
    const view = new WebContentsView({ webPreferences: { session: ses, preload: this.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck: false, webSecurity: true, backgroundThrottling: false } });
    const e: Entry = { view, state: { id, phase: 'loading', dirty: false, modal: false }, rect };
    this.entries.set(id, e); view.setVisible(false); this.win.contentView.addChildView(view);
    view.setBounds(rect);
    const wc = view.webContents;
    try { e.lease = this.packages.launch(`company.sample.${host}`); } catch { this.fail(e, 'package-verification-failed'); return e; }
    e.healthTimer=setTimeout(()=>this.fail(e,'launch-health-timeout'),8000);
    const lease = e.lease, entryURL = `dental-fixture://${host}/${lease.manifest.entry}`;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', event => event.preventDefault());
    wc.on('will-frame-navigate', event => event.preventDefault());
    wc.on('will-attach-webview', event => event.preventDefault());
    wc.on('render-process-gone', () => this.fail(e, 'renderer-exited'));
    wc.on('unresponsive', () => { this.fail(e, 'unresponsive'); if (!wc.isDestroyed()) wc.forcefullyCrashRenderer(); });
    wc.on('did-finish-load', () => {
      if (this.entries.get(id) !== e) return;
      this.broker.register({ sender: wc, frame: wc.mainFrame, origin: entryURL, appId: lease.manifest.appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities], authorize:()=>{try{this.packages.assertAllowed(lease);return true;}catch{return false;}}, report: value => this.reportState(e, value) });
      e.connected=this.broker.connect({sender:wc,frame:wc.mainFrame,url:entryURL},{major:1,minor:0}).ok;
      e.state.phase = 'ready'; this.applyVisibility(e); if (e.view.getVisible()) wc.focus(); this.emit();
      e.captureTimer = setTimeout(() => void this.refresh(e), 100);
      let pending = false;
      e.watchdog = setInterval(() => {
        if (pending || wc.isDestroyed() || e.state.phase !== 'ready') return;
        pending = true;
        e.pingTimer = setTimeout(() => { this.fail(e, 'unresponsive'); if (!wc.isDestroyed()) wc.forcefullyCrashRenderer(); }, 1500);
        void wc.executeJavaScript('document.readyState === "complete" && !!document.body && typeof window.dentalApp?.connect === "function"').then(ready => { clearTimeout(e.pingTimer); pending = false;if(ready&&e.connected&&!e.healthy&&this.entries.get(id)===e){try{this.packages.markHealthy(lease.manifest.appId,lease.release.digest);e.healthy=true;clearTimeout(e.healthTimer);this.changed();}catch{this.fail(e,'update-policy-refused');}} }).catch(() => { clearTimeout(e.pingTimer); pending = false; });
      }, 2000);
    });
    void wc.loadURL(entryURL).catch(() => this.fail(e, 'load-failed'));
    return e;
  }
  sync(input: unknown) {
    const next = parseLayout(input);
    const [width, height] = this.win.getContentSize();
    for (const layout of next) {
      if (layout.rect.x + layout.rect.width > width + 1 || layout.rect.y + layout.rect.height > height + 1) throw new Error('Outside host');
    }
    const hadNativeInput = [...this.entries.values()].some(e => e.view.getVisible());
    this.desired = next;
    for (const layout of this.desired) {
      let e = this.entries.get(layout.id);
      if (!layout.open) { if (e) {if(this.broker.hasUnsafeWrites(e.lease?.manifest.appId??'')){e.view.setVisible(false);this.win.webContents.send('runtime:close-blocked',{id:layout.id});}else this.close(layout.id);} continue; }
      const rect = Object.fromEntries(Object.entries(layout.rect).map(([k, v]) => [k, Math.round(v)])) as RuntimeRect;
      e ??= this.create(layout.id, rect);
      e.rect = rect; e.view.setBounds(rect); e.view.setBorderRadius(rect.x===0&&rect.width===width?0:10);
      if (e.view.getVisible() && !layout.visible) void this.refresh(e);
      this.applyVisibility(e);
    }
    // Choose focus after all visibility changes, independent of registry order.
    const foreground = [...this.entries.values()].find(e => e.view.getVisible());
    if (foreground && !foreground.view.webContents.isFocused()) foreground.view.webContents.focus();
    else if (!foreground && hadNativeInput) this.win.webContents.focus();
    this.emit();
  }
  restart(id: unknown) {
    if (!runtimeIds.includes(id as RuntimeId)) throw new Error('Invalid runtime');
    const e = this.entries.get(id as RuntimeId);
    if (!e || e.state.phase !== 'failed') throw new Error('Runtime not failed');
    const rect = e.rect; this.close(id as RuntimeId); this.create(id as RuntimeId, rect);
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
    this.broker.unregister(e.view.webContents);
    e.lease?.releaseLease();
    this.entries.delete(id); clearTimeout(e.healthTimer); clearTimeout(e.captureTimer); clearTimeout(e.pingTimer); clearInterval(e.watchdog);
    this.win.contentView.removeChildView(e.view);
    if (!e.view.webContents.isDestroyed()) e.view.webContents.close();
    e.image = undefined;
  }
  updateNow(appId:string) {
    const id=appId==='company.sample.alpha'?'studio':appId==='company.sample.beta'?'records':undefined;if(!id)throw Error('Unknown update app');
    const e=this.entries.get(id);if(this.broker.hasUnsafeWrites(appId))throw Error('Resolve pending or unknown write before updating');
    if(e&&(e.state.dirty||e.state.modal||e.state.phase!=='ready'))throw Error('Save work and close dialogs before updating');
    if(e){const rect=e.rect;this.close(id);this.create(id,rect);}this.changed();
  }
  clearSession() {
    this.broker.invalidateSession();for(const id of [...this.entries.keys()])this.close(id);
    // Closing a WebContents does not erase session storage. Never reuse a prior
    // account's in-memory partition, even while asynchronous erasure completes.
    const previous=[...this.sessions.values()];this.sessions.clear();this.instance=randomUUID();
    for(const ses of previous){try{ses.protocol.unhandle('dental-fixture');}catch{}void ses.clearStorageData().catch(()=>{});void ses.clearCache().catch(()=>{});}
  }
  dispose() { for (const id of [...this.entries.keys()]) this.close(id); this.broker.dispose(); }
}
