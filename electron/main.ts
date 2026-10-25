import { app, BrowserWindow, ipcMain, screen, protocol, powerMonitor, session, dialog, shell } from 'electron';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {writeFileSync} from 'node:fs';
import {DiagnosticStore} from './diagnostics/store';
import { OsStateStore } from './storage/osState';
import { LocalFileService } from './host/localFiles';
import { FilePickerCoordinator } from './host/filePicker';
import { FixtureRuntime } from './runtime/manager';
import type { ApiTraceRecord } from './sdk/broker';
import { SessionManager } from './identity/session';
import { FirebaseClient } from './identity/client';
import { CredentialStore } from './identity/storage';
import { systemSecretProvider } from './identity/provider';
import { loadDevelopmentCredentials } from './identity/devCredentials';
import { identityFixtures } from './identity/fixtures';
import { fixtureRegistry } from './packages/fixtures';
import { PackageRegistry } from './packages/registry';
import { stagingDistribution } from './distribution/staging';
import { DistributionService } from './distribution/service';
import { CatalogueStore } from './distribution/storage';
import { distributionFixtures as createDistributionFixtures } from './distribution/fixtures';
import { fixtureServices } from './sdk/fixtures';
import type { SessionView } from './identity/contracts';
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let diagnostics:DiagnosticStore|undefined;
let recoveryWindow:BrowserWindow|undefined;
let hostWindow: BrowserWindow | undefined;
let runtime: FixtureRuntime | undefined;
let packages: PackageRegistry;
let distribution: DistributionService;
const privateRuntimeDisplay = process.platform === 'linux' && !process.env.DISPLAY && !!process.env.ELECTRON_OS_TEST_DISPLAY && path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') === process.env.ELECTRON_OS_TEST_DISPLAY;
const m18FinanceApiTraceEnabled = privateRuntimeDisplay && app.commandLine.hasSwitch('identity-staging') && app.commandLine.hasSwitch('m18-finance-api-trace');
const m18FinanceApiTrace: ApiTraceRecord[] = [];
if (m18FinanceApiTraceEnabled) Object.defineProperty(globalThis, '__m18FinanceApiTrace', { value: m18FinanceApiTrace, enumerable: false });
const runtimeFixtures = app.commandLine.hasSwitch('runtime-fixtures') && (privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows'));
const stagingMediaFixtures = privateRuntimeDisplay && runtimeFixtures && app.commandLine.hasSwitch('identity-staging') && app.commandLine.hasSwitch('media-upload-staging-fixtures');
const identityStageDiagnostics = (() => {
  if (!privateRuntimeDisplay || !app.commandLine.hasSwitch('identity-staging') || !app.commandLine.hasSwitch('identity-stage-diagnostics')) return undefined;
  const requested = process.env.DENTAL_OS_AUTH_DIAGNOSTIC_FILE;
  if (!requested) return undefined;
  const target = path.resolve(requested);
  if (path.dirname(target) !== path.resolve(tmpdir()) || !/^dental-os-staging-auth-[a-f0-9-]{16,}\.json$/.test(path.basename(target))) return undefined;
  return (value: { stage: string; outcome: string }) => writeFileSync(target, JSON.stringify(value), { mode: 0o600, flag: 'w' });
})();
const runtimeFixtureAppCount = runtimeFixtures && app.commandLine.hasSwitch('runtime-app-count') ? Number(app.commandLine.getSwitchValue('runtime-app-count')) : 2;
const modulePreviewFixtures = runtimeFixtures && app.commandLine.hasSwitch('module-preview-fixtures');
const slowModuleAckFixtures = modulePreviewFixtures && app.commandLine.hasSwitch('slow-module-ack-fixtures');
const launchFeedbackFixture = runtimeFixtures && app.commandLine.hasSwitch('launch-feedback-fixtures');
const runtimeResourceFixtures = runtimeFixtures && (runtimeFixtureAppCount > 2 || launchFeedbackFixture || stagingMediaFixtures);
const trustedTest = privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows');
const storeFixtures = trustedTest && app.commandLine.hasSwitch('distribution-fixtures');
const onboardingFixtures = storeFixtures && app.commandLine.hasSwitch('onboarding-fixtures');
const identityFixture = trustedTest && app.commandLine.hasSwitch('identity-fixtures');
const devCredentialFixtures = trustedTest && app.commandLine.hasSwitch('dev-credentials-fixtures');
const identityBypass = trustedTest && !identityFixture && !app.commandLine.hasSwitch('identity-staging');
let identity: SessionManager | undefined;
const canUseWorkspace = () => identityBypass || identity?.view().phase === 'ready';
const identityView = (): SessionView => identity?.view() ?? { phase: 'ready', generation: 1, userLabel: '', clinicLabel: '', role: '', rememberAvailable: false, remembered: false, message: 'Private synthetic regression mode.', mode: 'demo-fixture' };
const isShell = (event: Electron.IpcMainInvokeEvent) => !!hostWindow && event.sender === hostWindow.webContents && event.senderFrame === event.sender.mainFrame;
let osStore: OsStateStore;
let localFiles: LocalFileService | undefined;
let filePicker: FilePickerCoordinator | undefined;
let bootPhase: 'initializing' | 'ready' | 'recovery' | 'exiting' = 'initializing';
const appIconPath = path.join(__dirname, '../assets/electron-os.png');

if (process.platform === 'linux') app.setDesktopName('electron-os.desktop');

// A host-dock launch must activate the current session, never create a new one.
const profile = app.commandLine.getSwitchValue('user-data-dir');
if (profile) app.setPath('userData', path.resolve(profile));
const primary = app.requestSingleInstanceLock();
let activateExisting = () => {};
if (!primary) app.quit();
app.on('second-instance', () => activateExisting());
app.on('activate', () => activateExisting());

function createWindow() {
  const display = screen.getPrimaryDisplay();
  const win = new BrowserWindow({
    ...display.bounds,
    title: 'Sajilo Dental', icon: appIconPath, frame: false, fullscreen: true, fullscreenable: true, resizable: true, backgroundColor: '#10162e',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false, sandbox: true, autoplayPolicy: 'no-user-gesture-required' },
  });
  hostWindow = win;
  if(localFiles)filePicker=new FilePickerCoordinator(win,localFiles,()=>identityView().generation,()=>canUseWorkspace());
  if (runtimeFixtures || storeFixtures || !trustedTest || app.commandLine.hasSwitch('identity-staging')) runtime = new FixtureRuntime(win, packages, path.join(__dirname, 'runtime/appPreload.js'), identity,()=>distribution?.changed(),{transport:stagingMediaFixtures?'staging':runtimeFixtures||storeFixtures||identityFixture?'fixture':'staging',dropFirstWriteResponse:trustedTest&&app.commandLine.hasSwitch('api-loss-once'),modulePreviewFixture:modulePreviewFixtures,launchFeedbackFixture,diagnostic:(code,target)=>{diagnostics?.record(code,target);},apiTrace:m18FinanceApiTraceEnabled?record=>{if(m18FinanceApiTrace.length<1000)m18FinanceApiTrace.push(record);}:undefined});
  if(filePicker)runtime?.setFilePicker(filePicker);
  win.on('close', event => {if(runtime?.blockUnsafeExit()){event.preventDefault();return;}filePicker?.cancelAll();runtime?.dispose();});
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  let transitioning = false, restoring = false, wantsFocus = false;
  let restoreAttempts = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  const publish = (value: boolean) => {
    transitioning = value;
    if (!win.isDestroyed()) win.webContents.send('window:host-transition', value);
  };
  const settleRestore = () => {
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (win.isDestroyed() || win.isMinimized()) return;
      // Fullscreen is asynchronous on some hosts; resume only after it settles.
      if (!win.isFullScreen() && ++restoreAttempts < 100) { settleRestore(); return; }
      restoring = false;
      publish(false);
      if (wantsFocus) { wantsFocus = false; win.focus(); }
    }, 80);
  };
  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.on('minimize', () => {
    if (settleTimer) clearTimeout(settleTimer);
    restoring = false;
    // Hide child WebContents without a fresh screenshot; the host window is leaving the screen.
    runtime?.hideAll(false);
    publish(true);
  });
  win.on('restore', () => {
    if (restoring || !transitioning && win.isFullScreen()) return;
    restoring = true; restoreAttempts = 0;
    publish(true);
    // Do not setBounds/focus here: either can reenter the host restore event.
    // Defer fullscreen until the native restore callback has completed.
    setImmediate(() => {
      if (win.isDestroyed() || win.isMinimized()) return;
      if (!win.isFullScreen()) win.setFullScreen(true);
      settleRestore();
    });
  });
  win.on('enter-full-screen', () => { if (restoring) settleRestore(); });
  win.on('resize', () => { if (restoring) settleRestore(); });
  win.on('closed', () => { if (settleTimer) clearTimeout(settleTimer); });
  activateExisting = () => {
    if (win.isDestroyed()) return;
    if (win.isMinimized() || transitioning) {
      wantsFocus = true;
      if (win.isMinimized()) win.restore();
    } else { win.show(); win.focus(); }
  };
  void win.loadFile(path.join(__dirname, '../dist/index.html'), { query: storeFixtures ? {} : process.env.ELECTRON_OS_TEST_DISPLAY && app.commandLine.hasSwitch('prototype-fixtures') ? { prototypeFixtures: '1', ...(runtimeFixtures ? { runtimeFixtures: '1', ...(runtimeResourceFixtures ? { resourceFixtures: '1' } : {}) } : {}) } : runtimeFixtures ? { prototypeFixtures: '1', runtimeFixtures: '1', ...(runtimeResourceFixtures ? { resourceFixtures: '1' } : {}) } : {} });
}

const supportCaller=(event:Electron.IpcMainInvokeEvent)=>isShell(event)||!!recoveryWindow&&event.sender===recoveryWindow.webContents&&event.senderFrame===event.sender.mainFrame;
let supportBusy=false;
const supportView=()=>({appVersion:app.getVersion(),electron:process.versions.electron,platform:process.platform,arch:process.arch,...diagnostics?.preview()});
const supportReviewText=(report:ReturnType<typeof supportView>)=>{
 const events=report.events??[];
 const recent=events.slice(-5);
 return [
  `Sajilo Dental ${report.appVersion} · Dental OS · Electron ${report.electron}`,
  `${report.platform} ${report.arch} · Diagnostics storage: ${report.persistence}`,
  `Recent events (${recent.length} shown of ${events.length}):`,
  ...(recent.length?recent.map(entry=>`• ${new Date(entry.time).toLocaleString()}  ${entry.code} (${entry.target})`):['• No events recorded']),
  '',
  report.policy,
 ].join('\n');
};
ipcMain.handle('support:action',async(event,kind:unknown)=>{
 if(!supportCaller(event))throw Error('Invalid caller');
 const owner=BrowserWindow.fromWebContents(event.sender);if(!owner)throw Error('Unavailable');
 if(kind==='view')return supportView();
 if(supportBusy||!['preview','export','show-files'].includes(kind as string))return {ok:false};
 supportBusy=true;
 try{
  if(kind==='show-files'){if(owner!==recoveryWindow)return {ok:false};await shell.openPath(app.getPath('userData'));return {ok:true};}
  if(kind==='preview'){
   const review=await dialog.showMessageBox(owner,{type:'info',title:'Safe support diagnostics',message:'Review safe support diagnostics',detail:supportReviewText(supportView()),buttons:['Close','Save diagnostics file'],defaultId:0,cancelId:0});
   if(review.response!==1)return {ok:false,cancelled:true};
  }
  const result=await dialog.showSaveDialog(owner,{title:'Save Sajilo Dental support diagnostics',defaultPath:'sajilo-dental-support.json',filters:[{name:'JSON',extensions:['json']}]});
  if(result.canceled||!result.filePath)return {ok:false,cancelled:true};
  writeFileSync(result.filePath,JSON.stringify(supportView(),null,2),{flag:'wx',mode:0o600});
  diagnostics?.record('support-exported');return {ok:true};
 }catch{
  await dialog.showMessageBox(owner,{type:'warning',title:'Diagnostics unavailable',message:'Could not save diagnostics',detail:'Choose a new filename in a writable folder. Existing files are never overwritten.',buttons:['Close']}).catch(()=>{});
  return {ok:false};
 }finally{supportBusy=false;}
});
ipcMain.handle('window:control', (event, action: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !isShell(event)) throw new Error('Invalid caller');
  if (action === 'close') win.close();
  else if (action === 'minimize') {
    // Do not spend time capturing app mirrors before minimizing the whole OS.
    runtime?.hideAll(false);
    win.minimize();
  }
  else throw new Error('Unknown control');
});
// Capture only this application's main frame, in device-independent pixels.
ipcMain.handle('window:capture', async (event, rect: unknown, generation: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || !isShell(event) || !rect || typeof rect !== 'object') throw new Error('Invalid capture');
  if (!canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Workspace locked or stale');
  const captureGeneration = identityView().generation;
  const r = rect as Record<string, unknown>;
  const values = ['x', 'y', 'width', 'height'].map(k => r[k]);
  if (!values.every(v => typeof v === 'number' && Number.isFinite(v))) throw new Error('Invalid rectangle');
  const [x, y, width, height] = (values as number[]).map(Math.round);
  const [w, h] = win.getContentSize();
  if (x < 0 || y < 0 || width < 1 || height < 1 || x + width > w || y + height > h) throw new Error('Capture outside window');
  let image = await event.sender.capturePage({ x, y, width, height });
  if (runtime) image = await runtime.capture({x,y,width,height}, image);
  if (!canUseWorkspace() || captureGeneration !== identityView().generation) throw new Error('Stale capture');
  if (image.isEmpty()) throw new Error('Empty snapshot');
  return image.toDataURL();
});
ipcMain.handle('os:preferences', (event, input: unknown) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (bootPhase !== 'ready' || !win || !isShell(event)) throw new Error('Unavailable');
  return input === undefined ? osStore.load() : osStore.update(input);
});
ipcMain.handle('os:status', event => {
  if (!isShell(event)) throw new Error('Invalid caller');
  return { phase: bootPhase };
});
ipcMain.handle('runtime:sync', (event, value: unknown, generation: unknown) => { if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Unavailable'); runtime.sync(value); });
ipcMain.handle('runtime:navigate', (event, id: unknown, direction: unknown, generation: unknown, discardDirty: unknown, preserveDraft: unknown) => {
  if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) return false;
  return runtime.navigate(id, direction, discardDirty === true, preserveDraft === true);
});
ipcMain.on('runtime:hide-all', (event, generation: unknown) => {
  const trustedShell = !!hostWindow && event.sender === hostWindow.webContents && event.senderFrame === event.sender.mainFrame;
  if (!trustedShell || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) { event.returnValue = false; return; }
  runtime.hideAll();
  event.returnValue = true;
});
ipcMain.handle('runtime:restart', (event, id: unknown, generation: unknown) => { if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Unavailable'); runtime.restart(id); });
ipcMain.handle('runtime:app-info', event => runtime?.appInfo(event) ?? {ok:false,code:'UNAVAILABLE'});
ipcMain.handle('runtime:open-explorer', event => runtime?.openExplorer(event) ?? {ok:false,code:'UNAVAILABLE'});
ipcMain.handle('runtime:discover-app', (event,id:unknown) => {
  if(!isShell(event)||!runtime||!canUseWorkspace())return{ok:false,error:{code:'ACCESS_DENIED',message:'App discovery is unavailable for this workspace.',outcome:'not_sent'}};
  return runtime.discoverApp(id);
});
ipcMain.handle('runtime:select-module', (event,id:unknown,moduleId:unknown) => { if(!isShell(event)||!runtime||!canUseWorkspace())return{ok:false,code:'DENIED'};return runtime.selectModule(id,moduleId); });
ipcMain.on('runtime:module-selection-ack',(event,input:unknown)=>runtime?.acknowledgeModule(event,input));
for (const kind of ['connect', 'request', 'cancel'] as const) ipcMain.handle(`sdk:${kind}`, (event, input: unknown) => runtime ? runtime.sdk(kind, event, input) : { ok: false, error: { code: 'UNAVAILABLE', message: 'No application runtime.', outcome: 'not_sent' } });
ipcMain.handle('identity:view', event => { if (!isShell(event)) throw new Error('Invalid caller'); return identityView(); });
const developmentCredentials = () => {
  if (app.isPackaged) return undefined;
  if (devCredentialFixtures) return { email: 'dev-login@fixture.invalid', password: 'synthetic-dev-fill-only' };
  return loadDevelopmentCredentials(path.join(app.getAppPath(), '.dev-login.local.json'));
};
ipcMain.handle('identity:dev-credentials-available', event => isShell(event) && !!developmentCredentials());
ipcMain.handle('identity:dev-credentials', event => isShell(event) ? developmentCredentials() : undefined);
ipcMain.handle('identity:action', (event, kind: unknown, input: unknown) => {
  if (!isShell(event) || !identity) return { ok: false, code: 'UNAVAILABLE' };
  if (kind === 'login') return identity.login(input);
  if (input !== undefined) return { ok: false, code: 'INVALID_INPUT' };
  if (kind === 'lock') { identity.lock(); return { ok: true }; }
  if (kind === 'logout') return identity.logout();
  return { ok: false, code: 'INVALID_INPUT' };
});
ipcMain.handle('store:action', (event, kind: unknown, input: unknown, generation: unknown) => {
  if (!isShell(event) || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) return { ok: false, code: 'DENIED' };
  if (kind === 'view' && input === undefined) return distribution.view();
  if (kind === 'refresh' && input === undefined) return distribution.refresh();
  if (kind === 'cancel' && input === undefined) return distribution.cancel();
  if (kind === 'install') return distribution.install(input);
  if (kind === 'uninstall') return distribution.uninstall(input);
  if (kind === 'update-now') return distribution.updateNow(input,id=>{if(!runtime)throw Error('Runtime unavailable');runtime.updateNow(id);});
  return { ok: false, code: 'INVALID' };
});
ipcMain.handle('store:artwork', (event, appId: unknown, expectedSha256: unknown, generation: unknown) => {
  if (!isShell(event) || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) return null;
  return distribution?.artwork(appId, expectedSha256, generation) ?? null;
});
ipcMain.on('runtime:report', (event, value: unknown) => runtime?.report(event, value));
ipcMain.on('runtime:navigation-report', (event, value: unknown) => runtime?.navigationReport(event, value));
ipcMain.on('runtime:file-activation', event => runtime?.fileActivated(event));
ipcMain.on('runtime:shortcut', (event,value: unknown) => runtime?.shortcut(event,value));
ipcMain.on('runtime:edge', (event, value: unknown) => runtime?.edge(event, value));
if (primary) void app.whenReady().then(async () => {
  diagnostics=new DiagnosticStore(path.join(app.getPath('userData'),'diagnostics'));
  session.defaultSession.setSpellCheckerEnabled(false);
  session.defaultSession.setSpellCheckerLanguages([]);
  try {
    osStore = new OsStateStore(path.join(app.getPath('userData'), 'state'));
    osStore.load();
    const packageRoot = path.join(app.getPath('userData'), 'packages');
    const catalogueStore = new CatalogueStore(path.join(app.getPath('userData'), 'distribution'));
    const storeFixture = storeFixtures ? createDistributionFixtures(path.join(__dirname, '../fixtures/packages'), catalogueStore.load().sequence + 1, app.commandLine.hasSwitch('update-fixtures') ? path.join(app.getPath('userData'),'update-fixture.json') : undefined, onboardingFixtures, { unavailableControlFile: app.commandLine.hasSwitch('distribution-unavailable-fixtures') ? path.join(app.getPath('userData'),'distribution-unavailable.fixture') : undefined, packageDelayMs: app.commandLine.hasSwitch('distribution-progress-fixtures') ? 900 : 0 }) : undefined;
    packages = runtimeFixtures ? fixtureRegistry(packageRoot, path.join(__dirname, '../fixtures/packages'), runtimeFixtureAppCount,modulePreviewFixtures,slowModuleAckFixtures,launchFeedbackFixture,stagingMediaFixtures) : new PackageRegistry(packageRoot, storeFixture?.config.policy ?? stagingDistribution.policy);
    if (!runtimeFixtures) packages.initialize();
    if (!identityBypass) {
      const provider = identityFixture ? { available: () => false, encrypt: async () => { throw new Error('Unavailable'); }, decrypt: async () => { throw new Error('Unavailable'); } } : systemSecretProvider;
      identity = new SessionManager(identityFixture ? identityFixtures() : new FirebaseClient(), new CredentialStore(path.join(app.getPath('userData'), 'identity'), provider), () => { diagnostics?.record('session-reset');runtime?.clearSession(); distribution?.invalidate(); }, identityFixture ? 'fixture' : 'staging', Date.now, 8000, identityFixture ? undefined : identityStageDiagnostics);
      identity.subscribe(view => { filePicker?.cancelAll();localFiles?.invalidateGeneration(view.generation); if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('identity:state', view); });
      powerMonitor.on('lock-screen', () => identity?.lock()); powerMonitor.on('suspend', () => identity?.lock());
    }
    distribution = new DistributionService(runtimeFixtures ? {...stagingDistribution,updates:false} : storeFixture?.config ?? stagingDistribution, packages, identity ?? fixtureServices().identity, catalogueStore, storeFixture?.transport);
    if(!trustedTest)distribution.startUpdates();
    distribution.subscribe(view => { if(view.phase==='unavailable')diagnostics?.record('store-unavailable');if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('store:state', view); });
    localFiles = new LocalFileService();
    bootPhase = 'ready';diagnostics?.record('boot-ready'); createWindow(); if (identity) void identity.restore();
  } catch {
    bootPhase = 'recovery';diagnostics?.record('boot-recovery');
    const recovery = new BrowserWindow({ width: 680, height: 340, title: 'Sajilo Dental recovery', icon: appIconPath, webPreferences: { preload:path.join(__dirname,'recoveryPreload.js'),sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck:false } });
    recoveryWindow=recovery;
    recovery.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    recovery.webContents.on('will-navigate', event => event.preventDefault());
    activateExisting = () => { if (!recovery.isDestroyed()) { recovery.show(); recovery.focus(); } };
    await recovery.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Sajilo Dental recovery</title><h1>Sajilo Dental needs recovery</h1><p>Sajilo Dental could not open local state or installed applications safely. Your files have been preserved.</p><p>Close this window and contact support to inspect the application user-data directory. No reset was performed.</p><p>Support can inspect the preserved OS state and restore a verified copy after this application is closed. Do not delete identity files or replace clinical records.</p><button id="show-files">Show local files</button><button id="export-support">Preview safe diagnostics</button><pre id="support-preview"></pre><button id="save-support" hidden>Save diagnostics file</button><p id="support-status" role="status"></p>`));
  }
});
let quitFlushed = false;
app.on('before-quit', event => {
  if(runtime?.blockUnsafeExit()){event.preventDefault();return;}
  bootPhase = 'exiting'; filePicker?.cancelAll();localFiles?.dispose(); distribution?.dispose();
  if (identity && !quitFlushed) { event.preventDefault(); identity.dispose(); void identity.flush().finally(() => { quitFlushed = true; app.quit(); }); }
});
app.on('window-all-closed', () => app.quit());
