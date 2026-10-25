import { app, BrowserWindow, ipcMain, screen, protocol, powerMonitor, session, dialog, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { tmpdir } from 'node:os';
import {writeFileSync} from 'node:fs';
import {DiagnosticStore} from './diagnostics/store';
import { DockCaptionOverlay } from './host/dockCaptionOverlay';
import { OsStateStore } from './storage/osState';
import { LocalFileService } from './host/localFiles';
import { FilePickerCoordinator } from './host/filePicker';
import { FixtureRuntime } from './runtime/manager';
import { RestartBudget } from './runtime/restartBudget';
import type { ApiTraceRecord } from './sdk/broker';
import { SessionManager } from './identity/session';
import { FirebaseClient } from './identity/client';
import { CredentialStore } from './identity/storage';
import { systemSecretProvider } from './identity/provider';
import { loadDevelopmentCredentials } from './identity/devCredentials';
import { identityFixtureSecretProvider, identityFixtures } from './identity/fixtures';
import { fixtureRegistry } from './packages/fixtures';
import { PackageRegistry } from './packages/registry';
import { stagingDistribution } from './distribution/staging';
import { DistributionService } from './distribution/service';
import { CatalogueStore } from './distribution/storage';
import { distributionFixtures as createDistributionFixtures } from './distribution/fixtures';
import { fixtureServices } from './sdk/fixtures';
import { DevelopmentAppService } from './developmentApps';
import type { SessionView } from './identity/contracts';
import { ResourcePressureGate, resourceBudgets, type ResourcePressureLevel, type SystemMemorySample } from './host/resourcePressure';
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let diagnostics:DiagnosticStore|undefined;
let recoveryWindow:BrowserWindow|undefined;
let shellRecoveryWindow:BrowserWindow|undefined;
let hostWindow: BrowserWindow | undefined;
let runtime: FixtureRuntime | undefined;
let shellRecoveryActive=false;
let shellRuntimeStateReplayPending=false;
let retryShellRenderer:((manual:boolean)=>boolean)|undefined;
const shellRecoveryBudget=new RestartBudget();
let dockCaptionOverlay: DockCaptionOverlay | undefined;
let packages: PackageRegistry;
let distribution: DistributionService;
let developmentApps: DevelopmentAppService | undefined;
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
const resourcePressureFixtures = privateRuntimeDisplay && runtimeFixtures && app.commandLine.hasSwitch('resource-pressure-fixtures');
const modulePreviewFixtures = runtimeFixtures && app.commandLine.hasSwitch('module-preview-fixtures');
const slowModuleAckFixtures = modulePreviewFixtures && app.commandLine.hasSwitch('slow-module-ack-fixtures');
const launchFeedbackFixture = runtimeFixtures && app.commandLine.hasSwitch('launch-feedback-fixtures');
const runtimeResourceFixtures = runtimeFixtures && (runtimeFixtureAppCount > 2 || launchFeedbackFixture || stagingMediaFixtures);
const trustedTest = privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows');
const developmentAppUiFixtures = privateRuntimeDisplay && app.commandLine.hasSwitch('development-apps-fixtures');
const developmentAppBuildFixtures = privateRuntimeDisplay && app.commandLine.hasSwitch('development-app-build-fixtures');
const storeFixtures = trustedTest && app.commandLine.hasSwitch('distribution-fixtures');
const onboardingFixtures = storeFixtures && app.commandLine.hasSwitch('onboarding-fixtures');
const identityFixture = trustedTest && app.commandLine.hasSwitch('identity-fixtures');
const identityPersistentFixture = privateRuntimeDisplay && identityFixture && app.commandLine.hasSwitch('identity-persistent-fixtures');
const identityRestoreOutageFixture = identityPersistentFixture && app.commandLine.hasSwitch('identity-restore-outage-once');
const devCredentialFixtures = trustedTest && app.commandLine.hasSwitch('dev-credentials-fixtures');
const identityBypass = trustedTest && !identityFixture && !app.commandLine.hasSwitch('identity-staging');
let identity: SessionManager | undefined;
const canUseWorkspace = () => identityBypass || identity?.view().phase === 'ready';
const identityView = (): SessionView => identity?.view() ?? { phase: 'ready', generation: 1, userLabel: '', clinicLabel: '', role: '', rememberAvailable: false, remembered: false, restoreAvailable: false, message: 'Private synthetic regression mode.', mode: 'demo-fixture' };
const isShell = (event: Electron.IpcMainInvokeEvent | Electron.IpcMainEvent) => !!hostWindow && !shellRecoveryActive && bootPhase === 'ready' && event.sender === hostWindow.webContents && event.senderFrame === event.sender.mainFrame;
let osStore: OsStateStore;
let localFiles: LocalFileService | undefined;
let filePicker: FilePickerCoordinator | undefined;
let bootPhase: 'initializing' | 'ready' | 'recovery' | 'exiting' = 'initializing';
const resourcePressureGate = new ResourcePressureGate();
let resourcePressureTimer: ReturnType<typeof setInterval> | undefined;
let resourcePressureActionPending = false;
let resourcePressureAck: { requestId: string; resolve: () => void; timer: ReturnType<typeof setTimeout> } | undefined;
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
  const captionOverlay = new DockCaptionOverlay(win, path.join(__dirname, 'dockCaptionOverlayPreload.js'), path.join(__dirname, '../dist/dock-caption.html'));
  dockCaptionOverlay = captionOverlay;
  if(localFiles)filePicker=new FilePickerCoordinator(win,localFiles,()=>identityView().generation,()=>canUseWorkspace());
  if (runtimeFixtures || storeFixtures || !trustedTest || app.commandLine.hasSwitch('identity-staging')) runtime = new FixtureRuntime(win, packages, path.join(__dirname, 'runtime/appPreload.js'), identity,()=>distribution?.changed(),{transport:stagingMediaFixtures?'staging':runtimeFixtures||storeFixtures||identityFixture?'fixture':'staging',dropFirstWriteResponse:trustedTest&&app.commandLine.hasSwitch('api-loss-once'),modulePreviewFixture:modulePreviewFixtures,launchFeedbackFixture,developmentApps,diagnostic:(code,target)=>{diagnostics?.record(code,target);},apiTrace:m18FinanceApiTraceEnabled?record=>{if(m18FinanceApiTrace.length<1000)m18FinanceApiTrace.push(record);}:undefined});
  if(filePicker)runtime?.setFilePicker(filePicker);
  let hostClosing = false;
  win.on('close', event => {if(runtime?.blockUnsafeExit()){event.preventDefault();return;}hostClosing=true;filePicker?.cancelAll();runtime?.dispose();});
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  let transitioning = false, restoring = false, wantsFocus = false;
  let restoreAttempts = 0;
  let settleTimer: ReturnType<typeof setTimeout> | undefined;
  let shellUnresponsiveTimer: ReturnType<typeof setTimeout> | undefined;
  let shellLoadTimer: ReturnType<typeof setTimeout> | undefined;
  let shellHeartbeatTimer: ReturnType<typeof setTimeout> | undefined;
  let shellHeartbeatGeneration = 0;
  let shellReloadInProgress = false;
  let shellReloadQueued = false;
  const stopShellHeartbeat = () => {
    if (shellHeartbeatTimer) clearTimeout(shellHeartbeatTimer);
    shellHeartbeatTimer = undefined;
    shellHeartbeatGeneration++;
  };
  const closeShellRecovery = () => {
    const recovery = shellRecoveryWindow;
    shellRecoveryWindow = undefined;
    if (recovery && !recovery.isDestroyed()) recovery.close();
  };
  const showShellRecovery = () => {
    shellRecoveryActive = true;
    bootPhase = 'recovery';
    shellReloadInProgress = false;
    shellReloadQueued = false;
    stopShellHeartbeat();
    if (shellLoadTimer) clearTimeout(shellLoadTimer);
    runtime?.hideAll(false);
    const existing = shellRecoveryWindow;
    if (existing && !existing.isDestroyed()) { existing.show(); existing.focus(); return; }
    diagnostics?.record('shell-recovery-required');
    const recovery = new BrowserWindow({
      parent: win, modal: true, alwaysOnTop: true, width: 620, height: 430, title: 'Sajilo Dental desktop recovery', icon: appIconPath,
      show: false, webPreferences: { preload:path.join(__dirname,'recoveryPreload.js'),sandbox:true,contextIsolation:true,nodeIntegration:false,spellcheck:false },
    });
    shellRecoveryWindow = recovery;
    recovery.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    recovery.webContents.on('will-navigate', event => event.preventDefault());
    recovery.on('close', event => { if (shellRecoveryActive && !hostClosing && !win.isDestroyed()) event.preventDefault(); });
    recovery.on('closed', () => { if (shellRecoveryWindow === recovery) shellRecoveryWindow = undefined; });
    recovery.once('ready-to-show', () => { if (shellRecoveryActive && !recovery.isDestroyed()) { recovery.show(); recovery.focus(); } });
    const page = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><title>Sajilo Dental desktop recovery</title><style>body{font:16px system-ui,sans-serif;max-width:520px;margin:38px auto;padding:0 24px;color:#202936}h1{font-size:24px}p{line-height:1.5;color:#4b5563}button{margin:8px 8px 0 0;padding:10px 14px;border:1px solid #aeb9c5;border-radius:7px;background:#fff;color:#202936;font:inherit;cursor:pointer}pre{max-height:110px;overflow:auto;background:#f4f6f8;padding:10px}</style><h1>Desktop shell needs recovery</h1><p>Sajilo Dental paused app surfaces after repeated shell renderer failures. Your platform session remains in the main process. Reopen the desktop to restore controls and any still-running app windows.</p><button id="retry-shell">Retry desktop</button><button id="export-support">Preview safe diagnostics</button><pre id="support-preview"></pre><button id="save-support" hidden>Save diagnostics file</button><button id="quit-recovery">Quit Sajilo Dental</button><p id="support-status" role="status"></p>`;
    void recovery.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(page)).then(() => {
      if (shellRecoveryActive && !recovery.isDestroyed()) { recovery.show(); recovery.focus(); }
    }).catch(() => {});
  };
  const queueShellReload = () => {
    if (shellReloadQueued) return;
    shellReloadQueued = true;
    setImmediate(() => {
      if (win.isDestroyed() || !shellReloadInProgress) { shellReloadQueued = false; return; }
      try { win.webContents.reload(); }
      catch { shellReloadQueued = false; showShellRecovery(); }
    });
  };
  const beginShellRecovery = (manual: boolean) => {
    if (win.isDestroyed() || bootPhase === 'exiting' || shellReloadInProgress) return false;
    if (!manual && shellRecoveryBudget.remaining('host') > 0) { showShellRecovery(); return false; }
    if (!manual) shellRecoveryBudget.failed('host');
    stopShellHeartbeat();
    if (shellUnresponsiveTimer) clearTimeout(shellUnresponsiveTimer);
    shellUnresponsiveTimer = undefined;
    shellRecoveryActive = true;
    bootPhase = 'recovery';
    shellRuntimeStateReplayPending = true;
    filePicker?.cancelAll();
    runtime?.hideAll(false);
    const recovery = shellRecoveryWindow;
    if (recovery && !recovery.isDestroyed()) recovery.hide();
    shellReloadInProgress = true;
    shellReloadQueued = false;
    diagnostics?.record('shell-recovery-started');
    if (shellLoadTimer) clearTimeout(shellLoadTimer);
    shellLoadTimer = setTimeout(() => { if (shellRecoveryActive) showShellRecovery(); }, 15_000);
    // If the renderer is still alive, kill it first and let its gone event
    // queue the replacement load after Chromium finishes teardown.
    try {
      if (!win.webContents.isCrashed()) {
        win.webContents.forcefullyCrashRenderer();
        return true;
      }
    }
    catch { /* The bounded reload below still gets a chance to recover it. */ }
    queueShellReload();
    return true;
  };
  retryShellRenderer = manual => beginShellRecovery(manual);
  const scheduleShellHeartbeat = () => {
    if (win.isDestroyed() || hostClosing || shellRecoveryActive || shellReloadInProgress || bootPhase !== 'ready') return;
    if (shellHeartbeatTimer) clearTimeout(shellHeartbeatTimer);
    shellHeartbeatTimer = setTimeout(() => {
      shellHeartbeatTimer = undefined;
      if (win.isDestroyed() || hostClosing || shellRecoveryActive || shellReloadInProgress || bootPhase !== 'ready') return;
      const generation = ++shellHeartbeatGeneration;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const probe = win.webContents.executeJavaScript('void 0').then(() => true, () => false);
      const deadline = new Promise<'timeout'>(resolve => { timeout = setTimeout(() => resolve('timeout'), 5000); });
      void Promise.race([probe, deadline]).then(result => {
        if (timeout) clearTimeout(timeout);
        if (generation !== shellHeartbeatGeneration || win.isDestroyed()) return;
        if (result !== true) { beginShellRecovery(false); return; }
        scheduleShellHeartbeat();
      });
    }, 10_000);
  };
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
  win.webContents.on('unresponsive', () => {
    if (shellUnresponsiveTimer) clearTimeout(shellUnresponsiveTimer);
    if (shellRecoveryActive || shellReloadInProgress) return;
    // Allow a short, transient main-thread stall to clear before reloading.
    shellUnresponsiveTimer = setTimeout(() => { if (!win.isDestroyed() && !shellRecoveryActive) beginShellRecovery(false); }, 1500);
  });
  win.webContents.on('responsive', () => {
    if (shellUnresponsiveTimer) clearTimeout(shellUnresponsiveTimer);
    shellUnresponsiveTimer = undefined;
  });
  win.webContents.on('render-process-gone', () => {
    // Recovery already owns this renderer teardown after an explicit watchdog
    // kill. Queue the load without counting the same failure twice.
    if (shellReloadInProgress) { queueShellReload(); return; }
    if (shellRecoveryActive && shellRecoveryWindow && !shellRecoveryWindow.isDestroyed()) return;
    if (shellLoadTimer) clearTimeout(shellLoadTimer);
    shellLoadTimer = undefined;
    beginShellRecovery(false);
  });
  win.webContents.on('did-fail-load', (_event, errorCode, _description, _validatedURL, isMainFrame) => {
    if (!isMainFrame || errorCode === -3) return;
    if (shellRecoveryActive) showShellRecovery();
    else if (bootPhase === 'ready') beginShellRecovery(false);
  });
  win.webContents.on('did-finish-load', () => {
    if (!shellRecoveryActive) { scheduleShellHeartbeat(); return; }
    if (shellLoadTimer) clearTimeout(shellLoadTimer);
    shellLoadTimer = undefined;
    shellReloadInProgress = false;
    shellReloadQueued = false;
    shellRecoveryActive = false;
    bootPhase = 'ready';
    diagnostics?.record('shell-recovered');
    closeShellRecovery();
    if (!win.isDestroyed()) { win.show(); win.focus(); }
    scheduleShellHeartbeat();
  });
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
  win.on('closed', () => {
    if (settleTimer) clearTimeout(settleTimer);
    if (shellUnresponsiveTimer) clearTimeout(shellUnresponsiveTimer);
    if (shellLoadTimer) clearTimeout(shellLoadTimer);
    stopShellHeartbeat();
    shellReloadQueued = false;
    retryShellRenderer = undefined;
    captionOverlay.dispose(); if(dockCaptionOverlay===captionOverlay)dockCaptionOverlay=undefined;
    if (hostWindow === win) hostWindow = undefined;
  });
  activateExisting = () => {
    if (shellRecoveryActive && shellRecoveryWindow && !shellRecoveryWindow.isDestroyed()) { shellRecoveryWindow.show(); shellRecoveryWindow.focus(); return; }
    if (win.isDestroyed()) return;
    if (win.isMinimized() || transitioning) {
      wantsFocus = true;
      if (win.isMinimized()) win.restore();
    } else { win.show(); win.focus(); }
  };
  void win.loadFile(path.join(__dirname, '../dist/index.html'), { query: storeFixtures ? {} : process.env.ELECTRON_OS_TEST_DISPLAY && app.commandLine.hasSwitch('prototype-fixtures') ? { prototypeFixtures: '1', ...(runtimeFixtures ? { runtimeFixtures: '1', ...(runtimeResourceFixtures ? { resourceFixtures: '1' } : {}) } : {}) } : runtimeFixtures ? { prototypeFixtures: '1', runtimeFixtures: '1', ...(runtimeResourceFixtures ? { resourceFixtures: '1' } : {}) } : {} });
}

const supportCaller=(event:Electron.IpcMainInvokeEvent)=>isShell(event)||!!recoveryWindow&&event.sender===recoveryWindow.webContents&&event.senderFrame===event.sender.mainFrame||!!shellRecoveryWindow&&event.sender===shellRecoveryWindow.webContents&&event.senderFrame===event.sender.mainFrame;
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
  if(kind==='show-files'){if(owner!==recoveryWindow&&owner!==shellRecoveryWindow)return {ok:false};await shell.openPath(app.getPath('userData'));return {ok:true};}
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
ipcMain.handle('shell:reload', event => {
  if (!hostWindow || event.sender !== hostWindow.webContents || event.senderFrame !== event.sender.mainFrame || bootPhase === 'exiting') return false;
  return retryShellRenderer?.(true) ?? false;
});
ipcMain.handle('shell:recovery-retry', event => {
  if (!shellRecoveryActive || !shellRecoveryWindow || event.sender !== shellRecoveryWindow.webContents || event.senderFrame !== event.sender.mainFrame) return false;
  return retryShellRenderer?.(true) ?? false;
});
ipcMain.handle('shell:recovery-quit', event => {
  if (!shellRecoveryWindow || event.sender !== shellRecoveryWindow.webContents || event.senderFrame !== event.sender.mainFrame) return false;
  app.quit();
  return true;
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
ipcMain.on('dock-caption:show', (event, input: unknown) => {
  if (!isShell(event)) return;
  dockCaptionOverlay?.show(input);
});
ipcMain.on('dock-caption:hide', event => {
  if (!isShell(event)) return;
  dockCaptionOverlay?.hide();
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
function resourceMemorySample() {
  const system=process.getSystemMemoryInfo();
  const totalKiB=system.total;
  const availableKiB=process.platform==='linux'
    ?system.available??system.free
    :process.platform==='darwin'
      ?system.free+(system.purgeable??0)
      :system.free;
  const renderers=runtime?.rendererProcesses()??[];
  const rendererPids=new Set(renderers.map(value=>value.pid));
  const rendererMetrics=app.getAppMetrics().filter(metric=>rendererPids.has(metric.pid));
  const sample:SystemMemorySample={
    totalKiB,
    availableKiB,
    managedRendererWorkingSetKiB:rendererMetrics.reduce((sum,metric)=>sum+metric.memory.workingSetSize,0),
  };
  return {sample,managedRendererCount:rendererPids.size,budgets:resourceBudgets(totalKiB)};
}
async function applyResourcePressure(level:ResourcePressureLevel) {
  if(resourcePressureActionPending||!runtime||!hostWindow||hostWindow.isDestroyed()||bootPhase!=='ready')return;
  resourcePressureActionPending=true;
  const win=hostWindow,requestId=randomUUID(),before=resourceMemorySample();
  try{
    if(!shellRecoveryActive&&!win.webContents.isDestroyed()){
      await new Promise<void>(resolve=>{
        let settled=false;
        const finish=()=>{
          if(settled)return;
          settled=true;
          clearTimeout(timer);
          if(resourcePressureAck?.requestId===requestId)resourcePressureAck=undefined;
          resolve();
        };
        const timer=setTimeout(finish,1200);
        resourcePressureAck={requestId,resolve:finish,timer};
        try{win.webContents.send('resource:pressure',{phase:'prepare',requestId,level,before,pressureActive:resourcePressureGate.currentLevel!=='normal'});}
        catch{finish();}
      });
    }
    const result=runtime.reclaimUnderPressure(level);
    await new Promise(resolve=>setTimeout(resolve,800));
    if(!win.isDestroyed()&&!win.webContents.isDestroyed())win.webContents.send('resource:pressure',{
      phase:'complete',requestId,level,before,after:resourceMemorySample(),pressureActive:resourcePressureGate.currentLevel!=='normal',
      reclaimedCount:result.reclaimed.length,skippedAppCount:result.skippedAppCount,
      skippedUnsavedCount:result.skippedUnsaved,skippedWritingCount:result.skippedWriting,eligibleCount:result.eligible,
    });
  }catch{/* Renderer cleanup is best-effort; the shell and main-process services stay available. */}
  finally{
    if(resourcePressureAck?.requestId===requestId){clearTimeout(resourcePressureAck.timer);resourcePressureAck=undefined;}
    resourcePressureActionPending=false;
  }
}
function startResourcePressureMonitor() {
  if(resourcePressureTimer)clearInterval(resourcePressureTimer);
  resourcePressureTimer=setInterval(()=>{
    if(!runtime||bootPhase!=='ready')return;
    try{
      const previous=resourcePressureGate.currentLevel;
      const next=resourcePressureGate.observe(resourceMemorySample().sample);
      if(next)void applyResourcePressure(next);
      else if(previous!=='normal'&&resourcePressureGate.currentLevel==='normal'&&hostWindow&&!hostWindow.isDestroyed()&&!hostWindow.webContents.isDestroyed())
        hostWindow.webContents.send('resource:pressure',{phase:'recovered',pressureActive:false});
    }catch{/* A failed system telemetry read must not trigger destructive cleanup. */}
  },10_000);
  resourcePressureTimer.unref?.();
}
ipcMain.on('resource:pressure-ack',(event,requestId:unknown)=>{
  if(!isShell(event)||typeof requestId!=='string'||requestId!==resourcePressureAck?.requestId)return;
  resourcePressureAck.resolve();
});
if(resourcePressureFixtures)ipcMain.on('resource:pressure-fixture',(event,level:unknown)=>{
  if(!isShell(event)||(level!=='warning'&&level!=='critical'))return;
  void applyResourcePressure(level);
});
ipcMain.handle('runtime:sync', (event, value: unknown, generation: unknown) => {
  if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Unavailable');
  runtime.sync(value);
  if (shellRuntimeStateReplayPending) { runtime.replayState(); shellRuntimeStateReplayPending = false; }
});
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
ipcMain.handle('runtime:resume', (event, id: unknown, generation: unknown) => { if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Unavailable'); if(resourcePressureGate.currentLevel!=='normal')throw new Error('Wait for system memory to recover before reopening this app.'); runtime.resume(id); });
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
ipcMain.handle('identity:clinic-logo', event => {
  if (!isShell(event) || !identity || !canUseWorkspace()) return undefined;
  return identity.clinicLogo();
});
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
  if (kind === 'restore') return identity.restore();
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
ipcMain.handle('development-apps:view', event => {
  if (!isShell(event) || !canUseWorkspace()) return { enabled: false, apps: [] };
  return developmentApps?.view() ?? { enabled: false, apps: [] };
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
    developmentApps = new DevelopmentAppService(app.getAppPath(), path.join(app.getPath('userData'), 'development-apps'), !app.isPackaged && (!trustedTest || developmentAppUiFixtures) && !app.commandLine.hasSwitch('identity-staging'), developmentAppBuildFixtures);
    if (!identityBypass) {
      const provider = identityFixture
        ? identityPersistentFixture ? identityFixtureSecretProvider() : { available: () => false, encrypt: async () => { throw new Error('Unavailable'); }, decrypt: async () => { throw new Error('Unavailable'); } }
        : systemSecretProvider;
      identity = new SessionManager(identityFixture ? identityFixtures({ failFirstRefresh: identityRestoreOutageFixture }) : new FirebaseClient(), new CredentialStore(path.join(app.getPath('userData'), 'identity'), provider), () => { diagnostics?.record('session-reset');runtime?.clearSession(); distribution?.invalidate(); }, identityFixture ? 'fixture' : 'staging', Date.now, 8000, identityFixture ? undefined : identityStageDiagnostics);
      identity.subscribe(view => { filePicker?.cancelAll();localFiles?.invalidateGeneration(view.generation); if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('identity:state', view); });
      powerMonitor.on('lock-screen', () => identity?.lock()); powerMonitor.on('suspend', () => identity?.lock());
    }
    distribution = new DistributionService(runtimeFixtures ? {...stagingDistribution,updates:false} : storeFixture?.config ?? stagingDistribution, packages, identity ?? fixtureServices().identity, catalogueStore, storeFixture?.transport);
    if(!trustedTest)distribution.startUpdates();
    distribution.subscribe(view => { if(view.phase==='unavailable')diagnostics?.record('store-unavailable');if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('store:state', view); });
    localFiles = new LocalFileService();
    bootPhase = 'ready';diagnostics?.record('boot-ready'); createWindow(); startResourcePressureMonitor(); if (identity) void identity.restore();
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
  bootPhase = 'exiting'; shellRecoveryActive = false; retryShellRenderer = undefined; if(resourcePressureTimer)clearInterval(resourcePressureTimer);resourcePressureTimer=undefined;resourcePressureAck?.resolve();resourcePressureAck=undefined;filePicker?.cancelAll();localFiles?.dispose(); distribution?.dispose();
  if (identity && !quitFlushed) { event.preventDefault(); identity.dispose(); void identity.flush().finally(() => { quitFlushed = true; app.quit(); }); }
});
app.on('window-all-closed', () => app.quit());
