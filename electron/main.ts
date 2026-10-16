import { app, BrowserWindow, ipcMain, screen, protocol, powerMonitor } from 'electron';
import path from 'node:path';
import { OsStateStore } from './storage/osState';
import { FixtureRuntime } from './runtime/manager';
import { SessionManager } from './identity/session';
import { FirebaseClient } from './identity/client';
import { CredentialStore } from './identity/storage';
import { systemSecretProvider } from './identity/provider';
import { identityFixtures } from './identity/fixtures';
import { fixtureRegistry } from './packages/fixtures';
import { PackageRegistry } from './packages/registry';
import { productionTrust } from './packages/format';
import type { SessionView } from './identity/contracts';
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
let hostWindow: BrowserWindow | undefined;
let runtime: FixtureRuntime | undefined;
let packages: PackageRegistry;
const privateRuntimeDisplay = process.platform === 'linux' && !process.env.DISPLAY && !!process.env.ELECTRON_OS_TEST_DISPLAY && path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') === process.env.ELECTRON_OS_TEST_DISPLAY;
const runtimeFixtures = app.commandLine.hasSwitch('runtime-fixtures') && (privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows'));
const trustedTest = privateRuntimeDisplay || (process.platform === 'win32' && process.env.GITHUB_ACTIONS === 'true' && process.env.RUNNER_OS === 'Windows');
const identityFixture = trustedTest && app.commandLine.hasSwitch('identity-fixtures');
const identityBypass = trustedTest && !identityFixture && !app.commandLine.hasSwitch('identity-staging');
let identity: SessionManager | undefined;
const canUseWorkspace = () => identityBypass || identity?.view().phase === 'ready';
const identityView = (): SessionView => identity?.view() ?? { phase: 'ready', generation: 1, userLabel: '', clinicLabel: '', role: '', rememberAvailable: false, remembered: false, message: 'Private synthetic regression mode.', mode: 'demo-fixture' };
const isShell = (event: Electron.IpcMainInvokeEvent) => !!hostWindow && event.sender === hostWindow.webContents && event.senderFrame === event.sender.mainFrame;
let osStore: OsStateStore;
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
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  hostWindow = win;
  if (runtimeFixtures) runtime = new FixtureRuntime(win, packages, path.join(__dirname, 'runtime/appPreload.js'), identity);
  win.on('close', () => runtime?.dispose());
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
  void win.loadFile(path.join(__dirname, '../dist/index.html'), { query: process.env.ELECTRON_OS_TEST_DISPLAY && app.commandLine.hasSwitch('prototype-fixtures') ? { prototypeFixtures: '1', ...(runtimeFixtures ? { runtimeFixtures: '1' } : {}) } : runtimeFixtures ? { prototypeFixtures: '1', runtimeFixtures: '1' } : {} });
}

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
ipcMain.handle('runtime:restart', (event, id: unknown, generation: unknown) => { if (!isShell(event) || !runtime || !canUseWorkspace() || !identityBypass && generation !== identity?.view().generation) throw new Error('Unavailable'); runtime.restart(id); });
for (const kind of ['connect', 'request', 'cancel'] as const) ipcMain.handle(`sdk:${kind}`, (event, input: unknown) => runtime ? runtime.sdk(kind, event, input) : { ok: false, error: { code: 'UNAVAILABLE', message: 'No application runtime.', outcome: 'not_sent' } });
ipcMain.handle('identity:view', event => { if (!isShell(event)) throw new Error('Invalid caller'); return identityView(); });
ipcMain.handle('identity:action', (event, kind: unknown, input: unknown) => {
  if (!isShell(event) || !identity) return { ok: false, code: 'UNAVAILABLE' };
  if (kind === 'login') return identity.login(input);
  if (input !== undefined) return { ok: false, code: 'INVALID_INPUT' };
  if (kind === 'lock') { identity.lock(); return { ok: true }; }
  if (kind === 'logout') return identity.logout();
  return { ok: false, code: 'INVALID_INPUT' };
});
ipcMain.on('runtime:report', (event, value: unknown) => runtime?.report(event, value));
ipcMain.on('runtime:shortcut', (event,value: unknown) => runtime?.shortcut(event,value));
ipcMain.on('runtime:edge', (event, value: unknown) => runtime?.edge(event, value));
if (primary) void app.whenReady().then(async () => {
  try {
    osStore = new OsStateStore(path.join(app.getPath('userData'), 'state'));
    osStore.load();
    const packageRoot = path.join(app.getPath('userData'), 'packages');
    packages = runtimeFixtures ? fixtureRegistry(packageRoot, path.join(__dirname, '../fixtures/packages')) : new PackageRegistry(packageRoot, productionTrust);
    if (!runtimeFixtures) packages.initialize();
    if (!identityBypass) {
      const provider = identityFixture ? { available: () => false, encrypt: async () => { throw new Error('Unavailable'); }, decrypt: async () => { throw new Error('Unavailable'); } } : systemSecretProvider;
      identity = new SessionManager(identityFixture ? identityFixtures() : new FirebaseClient(), new CredentialStore(path.join(app.getPath('userData'), 'identity'), provider), () => runtime?.clearSession(), identityFixture ? 'fixture' : 'staging');
      identity.subscribe(view => { if (hostWindow && !hostWindow.isDestroyed()) hostWindow.webContents.send('identity:state', view); });
      powerMonitor.on('lock-screen', () => identity?.lock()); powerMonitor.on('suspend', () => identity?.lock());
    }
    bootPhase = 'ready'; createWindow(); if (identity) void identity.restore();
  } catch {
    bootPhase = 'recovery';
    const recovery = new BrowserWindow({ width: 680, height: 340, title: 'Dental OS recovery', webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
    recovery.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    recovery.webContents.on('will-navigate', event => event.preventDefault());
    activateExisting = () => { if (!recovery.isDestroyed()) { recovery.show(); recovery.focus(); } };
    await recovery.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(`<meta http-equiv="Content-Security-Policy" content="default-src 'none'"><title>Dental OS recovery</title><h1>Dental OS needs recovery</h1><p>Local OS settings could not be opened safely. Your files have been preserved.</p><p>Close this window and contact support to inspect the state folder in the application user-data directory. No reset was performed.</p>`));
  }
});
let quitFlushed = false;
app.on('before-quit', event => {
  bootPhase = 'exiting';
  if (identity && !quitFlushed) { event.preventDefault(); identity.dispose(); void identity.flush().finally(() => { quitFlushed = true; app.quit(); }); }
});
app.on('window-all-closed', () => app.quit());
