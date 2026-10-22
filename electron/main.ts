import { app, BrowserWindow, ipcMain, screen, protocol, powerMonitor, session, dialog, shell } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {mkdirSync, writeFileSync} from 'node:fs';
import {DiagnosticStore} from './diagnostics/store';
import { OsStateStore } from './storage/osState';
import { LocalFileService } from './host/localFiles';
import { FilePickerCoordinator } from './host/filePicker';
import { parseFilesList } from './host/filesShell';
import { FixtureRuntime } from './runtime/manager';
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
const runtimeFixtures = app.commandLine.hasSwitch('runtime-fixtures') && (privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows'));
const runtimeFixtureAppCount = runtimeFixtures && app.commandLine.hasSwitch('runtime-app-count') ? Number(app.commandLine.getSwitchValue('runtime-app-count')) : 2;
const modulePreviewFixtures = runtimeFixtures && app.commandLine.hasSwitch('module-preview-fixtures');
const slowModuleAckFixtures = modulePreviewFixtures && app.commandLine.hasSwitch('slow-module-ack-fixtures');
const launchFeedbackFixture = runtimeFixtures && app.commandLine.hasSwitch('launch-feedback-fixtures');
const runtimeResourceFixtures = runtimeFixtures && (runtimeFixtureAppCount > 2 || launchFeedbackFixture || app.commandLine.hasSwitch('files-picker-app-fixtures'));
const trustedTest = privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows');
const filePickerAppFixture = runtimeFixtures && trustedTest && app.commandLine.hasSwitch('files-picker-app-fixtures') && app.commandLine.hasSwitch('files-fixtures') && app.commandLine.hasSwitch('files-picker-verify');
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
    title: 'Desktop — Motion Prototype', frame: false, fullscreen: true, fullscreenable: true, resizable: true, backgroundColor: '#eef3f8',
    show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, spellcheck: false, sandbox: true },
  });
  hostWindow = win;
  if(localFiles)filePicker=new FilePickerCoordinator(win,localFiles,()=>identityView().generation,()=>canUseWorkspace());
  if (runtimeFixtures || storeFixtures || !trustedTest || app.commandLine.hasSwitch('identity-staging')) runtime = new FixtureRuntime(win, packages, path.join(__dirname, 'runtime/appPreload.js'), identity,()=>distribution?.changed(),{transport:runtimeFixtures||storeFixtures||identityFixture?'fixture':'staging',dropFirstWriteResponse:trustedTest&&app.commandLine.hasSwitch('api-loss-once'),modulePreviewFixture:modulePreviewFixtures,launchFeedbackFixture,filePickerFixture:filePickerAppFixture,diagnostic:(code,target)=>{diagnostics?.record(code,target);}});
  if(filePicker)runtime?.setFilePicker(filePicker);
  // M16 UI acceptance harness: unavailable on normal desktops, staging sessions
  // and any runner without the three explicit CI-only guards.
  if (process.platform==='win32' && process.env.GITHUB_ACTIONS==='true' &&
      process.env.RUNNER_OS==='Windows' && app.commandLine.hasSwitch('files-fixtures') &&
      app.commandLine.hasSwitch('files-picker-verify') && identityBypass && filePicker) {
    let outcome: { status:'idle'|'pending'|'selected'|'cancelled'|'denied'; files?: string[] } = {status:'idle'};
    const fixture = {
      start(){
        if(outcome.status==='pending' || !filePicker || !win.webContents || !canUseWorkspace())return false;
        outcome={status:'pending'};
        const sender=win.webContents;
        void filePicker.pick(
          {purpose:'patient-attachment',fileTypes:'medical-images',maxSelections:1},
          {sender,frame:sender.mainFrame,appId:'company.dental.patient-record',
           appVersion:'synthetic-test',windowId:'fixture-only',generation:identityView().generation,
           requestId:randomUUID(),authorized:()=>!sender.isDestroyed()&&canUseWorkspace()},
          'Synthetic Picker Test',new AbortController().signal
        ).then(result=>{outcome={status:'selected',files:result.files.map(file=>file.name)};})
         .catch(error=>{outcome={status:(error as {code?:string})?.code==='CANCELLED'?'cancelled':'denied'};});
        return true;
      },
      outcome(){return {...outcome};},
    };
    Object.assign(globalThis,{__m16FilesCiFixture:fixture});
    win.once('closed',()=>{delete (globalThis as typeof globalThis & {__m16FilesCiFixture?:unknown}).__m16FilesCiFixture;});
  }
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
  `Dental OS ${report.appVersion} · Electron ${report.electron}`,
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
  const result=await dialog.showSaveDialog(owner,{title:'Save safe Dental OS diagnostics',defaultPath:'dental-os-support.json',filters:[{name:'JSON',extensions:['json']}]});
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
    win.webContents.send('window:host-transition', true);
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
// OS-only file browsing. Never expose arbitrary paths, file bytes or these channels to app preloads.
function requireFilesShell(event: Electron.IpcMainInvokeEvent, generation: unknown): LocalFileService {
  if (!isShell(event) || bootPhase !== 'ready' || !canUseWorkspace()
    || !Number.isSafeInteger(generation) || generation !== identityView().generation || !localFiles) {
    throw new Error('FORBIDDEN');
  }
  return localFiles;
}
ipcMain.handle('files:roots', (event, generation: unknown) => requireFilesShell(event, generation).roots());
ipcMain.handle('files:pick-response', async(event,input:unknown)=>{
  if(!isShell(event)||!canUseWorkspace()||!filePicker)throw new Error('FORBIDDEN');
  return filePicker.respond(input);
});
ipcMain.handle('files:list', (event, input: unknown) => {
  const request = parseFilesList(input);
  if (!request) throw new Error('INVALID_REQUEST');
  return requireFilesShell(event, request.generation).list(request.directoryId, request.cursor, request.limit);
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
ipcMain.on('runtime:report', (event, value: unknown) => runtime?.report(event, value));
ipcMain.on('runtime:shortcut', (event,value: unknown) => runtime?.shortcut(event,value));
ipcMain.on('runtime:file-activation',event=>runtime?.fileActivated(event));
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
    packages = runtimeFixtures ? fixtureRegistry(packageRoot, path.join(__dirname, '../fixtures/packages'), runtimeFixtureAppCount,modulePreviewFixtures,slowModuleAckFixtures,launchFeedbackFixture,filePickerAppFixture) : new PackageRegistry(packageRoot, storeFixture?.config.policy ?? stagingDistribution.policy);
    if (!runtimeFixtures) packages.initialize();
    if (!identityBypass) {
      const provider = identityFixture ? { available: () => false, encrypt: async () => { throw new Error('Unavailable'); }, decrypt: async () => { throw new Error('Unavailable'); } } : systemSecretProvider;
      identity = new SessionManager(identityFixture ? identityFixtures() : new FirebaseClient(), new CredentialStore(path.join(app.getPath('userData'), 'identity'), provider), () => { diagnostics?.record('session-reset');runtime?.clearSession(); distribution?.invalidate(); }, identityFixture ? 'fixture' : 'staging');
      identity.subscribe(view => { filePicker?.cancelAll();localFiles?.invalidateGeneration(view.generation); if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('identity:state', view); });
      powerMonitor.on('lock-screen', () => identity?.lock()); powerMonitor.on('suspend', () => identity?.lock());
    }
    distribution = new DistributionService(runtimeFixtures ? {...stagingDistribution,updates:false} : storeFixture?.config ?? stagingDistribution, packages, identity ?? fixtureServices().identity, catalogueStore, storeFixture?.transport);
    if(!trustedTest)distribution.startUpdates();
    distribution.subscribe(view => { if(view.phase==='unavailable')diagnostics?.record('store-unavailable');if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('store:state', view); });
    // Synthetic, non-clinical roots are available only on a private UI test display
    // or an explicitly trusted hosted runner. Normal users see real accessible roots.
    if (trustedTest && app.commandLine.hasSwitch('files-fixtures')) {
      const fixtureRoot = path.join(app.getPath('userData'), 'm16-files-fixture');
      mkdirSync(path.join(fixtureRoot, 'X-rays'), { recursive: true });
      writeFileSync(path.join(fixtureRoot, 'X-rays', 'm16-synthetic-xray.png'), 'synthetic-only');
      writeFileSync(path.join(fixtureRoot, 'notes-synthetic.pdf'), 'synthetic-only');
      localFiles = new LocalFileService([{ label: 'Test Files', path: fixtureRoot, kind: 'folder' }]);
    } else localFiles = new LocalFileService();
    bootPhase = 'ready';diagnostics?.record('boot-ready'); createWindow(); if (identity) void identity.restore();
  } catch {
    bootPhase = 'recovery';diagnostics?.record('boot-recovery');
    const recovery = new BrowserWindow({ width: 680, height: 340, title: 'Dental OS recovery', webPreferences: { preload:path.join(__dirname,'recoveryPreload.js'),sandbox: true, contextIsolation: true, nodeIntegration: false, spellcheck:false } });
    recoveryWindow=recovery;
    recovery.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    recovery.webContents.on('will-navigate', event => event.preventDefault());
    activateExisting = () => { if (!recovery.isDestroyed()) { recovery.show(); recovery.focus(); } };
    await recovery.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Dental OS recovery</title><h1>Dental OS needs recovery</h1><p>Local OS state or installed applications could not be opened safely. Your files have been preserved.</p><p>Close this window and contact support to inspect the application user-data directory. No reset was performed.</p><p>Support can inspect the preserved OS state and restore a verified copy after this application is closed. Do not delete identity files or replace clinical records.</p><button id="show-files">Show local files</button><button id="export-support">Preview safe diagnostics</button><pre id="support-preview"></pre><button id="save-support" hidden>Save diagnostics file</button><p id="support-status" role="status"></p>`));
  }
});
let quitFlushed = false;
app.on('before-quit', event => {
  if(runtime?.blockUnsafeExit()){event.preventDefault();return;}
  bootPhase = 'exiting'; filePicker?.cancelAll();localFiles?.dispose(); distribution?.dispose();
  if (identity && !quitFlushed) { event.preventDefault(); identity.dispose(); void identity.flush().finally(() => { quitFlushed = true; app.quit(); }); }
});
app.on('window-all-closed', () => app.quit());
