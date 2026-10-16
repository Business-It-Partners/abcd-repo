import { WebContentsView, session, net, nativeImage, type BrowserWindow, type IpcMainEvent, type NativeImage } from 'electron';
import path from 'node:path';
import { ApiBroker, type Caller, type Identity } from '../sdk/broker';
import { staging } from '../sdk/environment';
import { fixtureServices } from '../sdk/fixtures';
import { operations } from '../sdk/contracts';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { compositePixels, fixtureAsset, parseLayout, runtimeIds, type RuntimeId, type RuntimeLayout, type RuntimeState, type RuntimeRect } from './contracts';
type Entry = { view: WebContentsView; state: RuntimeState; rect: RuntimeRect; image?: NativeImage; capturePromise?: Promise<void>; captureTimer?: ReturnType<typeof setTimeout>; watchdog?: ReturnType<typeof setInterval>; pingTimer?: ReturnType<typeof setTimeout> };
export class FixtureRuntime {
  private services = fixtureServices();
  private broker: ApiBroker;
  private entries = new Map<RuntimeId, Entry>();
  private desired: RuntimeLayout[] = [];
  private sessions = new Map<RuntimeId, ReturnType<typeof session.fromPartition>>();
  private instance = randomUUID();
  private lastEmission = '';
  constructor(private win: BrowserWindow, private assets: string, private preload: string, identity?: Identity) { this.broker = new ApiBroker(staging, identity ?? this.services.identity, this.services.transport); }
  private emit() {
    const states=[...this.entries.values()].map(e=>e.state), key=JSON.stringify(states);
    if (!this.win.isDestroyed() && key!==this.lastEmission) { this.lastEmission=key; this.win.webContents.send('runtime:state', states); }
  }
  private fail(e: Entry, reason: string) {
    if (this.entries.get(e.state.id)!==e || e.state.phase === 'failed') return;
    const wasVisible = e.view.getVisible();
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
  private create(id: RuntimeId, rect: RuntimeRect) {
    const host = id === 'studio' ? 'alpha' : 'beta';
    let ses = this.sessions.get(id);
    if (!ses) {
    ses = session.fromPartition(`fixture-${host}-${this.instance}`);
    this.sessions.set(id, ses);
    ses.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    ses.setPermissionCheckHandler(() => false);
    ses.on('will-download', event => event.preventDefault());
    ses.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !fixtureAsset(details.url, host) }));
    void ses.protocol.handle('dental-fixture', request => {
      const file = fixtureAsset(request.url, host);
      return file ? net.fetch(pathToFileURL(path.join(this.assets, file)).href) : new Response('Denied', { status: 403 });
    });
    }
    const view = new WebContentsView({ webPreferences: { session: ses, preload: this.preload, sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, backgroundThrottling: false } });
    const e: Entry = { view, state: { id, phase: 'loading', dirty: false, modal: false }, rect };
    this.entries.set(id, e); view.setVisible(false); this.win.contentView.addChildView(view);
    view.setBounds(rect);
    const wc = view.webContents;
    wc.setWindowOpenHandler(() => ({ action: 'deny' }));
    wc.on('will-navigate', event => event.preventDefault());
    wc.on('will-frame-navigate', event => event.preventDefault());
    wc.on('will-attach-webview', event => event.preventDefault());
    wc.on('render-process-gone', () => this.fail(e, 'renderer-exited'));
    wc.on('unresponsive', () => { this.fail(e, 'unresponsive'); if (!wc.isDestroyed()) wc.forcefullyCrashRenderer(); });
    wc.on('did-finish-load', () => {
      if (this.entries.get(id) !== e) return;
      this.broker.register({ sender: wc, frame: wc.mainFrame, origin: `dental-fixture://${host}/index.html`, appId: `company.sample.${host}`, appVersion: '1.0.0', capabilities: operations.filter(op => id === 'studio' || op !== 'appointments.setStatus'), report: value => this.reportState(e, value) });
      e.state.phase = 'ready'; this.applyVisibility(e); if (e.view.getVisible()) wc.focus(); this.emit();
      e.captureTimer = setTimeout(() => void this.refresh(e), 100);
      let pending = false;
      e.watchdog = setInterval(() => {
        if (pending || wc.isDestroyed() || e.state.phase !== 'ready') return;
        pending = true;
        e.pingTimer = setTimeout(() => { this.fail(e, 'unresponsive'); if (!wc.isDestroyed()) wc.forcefullyCrashRenderer(); }, 1500);
        void wc.executeJavaScript('true').then(() => { clearTimeout(e.pingTimer); pending = false; }).catch(() => { clearTimeout(e.pingTimer); pending = false; });
      }, 2000);
    });
    void wc.loadURL(`dental-fixture://${host}/index.html`).catch(() => this.fail(e, 'load-failed'));
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
      if (!layout.open) { if (e) this.close(layout.id); continue; }
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
    return this.broker[kind](caller, input);
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
    this.entries.delete(id); clearTimeout(e.captureTimer); clearTimeout(e.pingTimer); clearInterval(e.watchdog);
    this.win.contentView.removeChildView(e.view);
    if (!e.view.webContents.isDestroyed()) e.view.webContents.close();
    e.image = undefined;
  }
  clearSession() { this.broker.invalidateSession(); for (const id of [...this.entries.keys()]) this.close(id); }
  dispose() { for (const id of [...this.entries.keys()]) this.close(id); this.broker.dispose(); }
}
