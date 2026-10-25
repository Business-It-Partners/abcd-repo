// Private synthetic acceptance host. Never packaged or loaded by normal Dental OS.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');
process.on('uncaughtException', error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); });
process.on('unhandledRejection', error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY) throw Error('Private display required');
const root = path.resolve(__dirname, '../..');
const { FixtureRuntime } = require(path.join(root, 'dist-electron/runtime/manager.js'));
const { PackageRegistry } = require(path.join(root, 'dist-electron/packages/registry.js'));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, 'dist-electron/packages/format.js'));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, 'dist-electron/distribution/updatePolicy.js'));
const { verifyCatalogue, noWatermark } = require(path.join(root, 'dist-electron/distribution/catalogue.js'));
const { clinicRequestAllowed } = require(path.join(root, 'dist-electron/sdk/appPolicy.js'));
const { adToBs } = require(path.join(root, 'node_modules/@sbmdkl/nepali-date-converter'));
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.calendar.m17';
const syntheticId = '11111111-1111-4111-8111-111111111111';
const todayParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const today = ['year', 'month', 'day'].map(key => todayParts.find(row => row.type === key).value).join('-');
const calls = [], receipts = new Map(), tasks = [];
const generation = { value: 1 }, active = { value: true };
const roleDenied = process.env.M17_DENY_ROLE === '1';
const caps = roleDenied ? [] : ['calendar.access'];
let dropReply = false, conflictNext = false, effects = 0, runtime, win, moduleSelectionResult;
let generatedTaskId = 333;
const moduleAcks = [];
const timestamp = new Date().toISOString();
tasks.push({ calendarTaskId: '22222222-2222-4222-8222-222222222222', taskDate: today, title: 'Synthetic clinic task', category: 'clinical', status: 'open', completedAt: null, createdAt: timestamp, updatedAt: timestamp, rowVersion: 1 });
function json(value, status = 200) { return Response.json(value, { status }); }

global.fetch = async (url, init) => {
  const u = new URL(url), headers = new Headers(init.headers), key = headers.get('idempotency-key');
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing host credential');
  const entry = { path: u.pathname + u.search, method: init.method, operationId: key, body: init.body ? JSON.parse(init.body) : null };
  calls.push(entry);
  if (init.method === 'GET' && u.pathname === '/v1/calendar-tasks') {
    const from = u.searchParams.get('from'), to = u.searchParams.get('to');
    return json({ calendarTasks: tasks.filter(task => task.status !== 'archived' && task.taskDate >= from && task.taskDate <= to).map(task => ({ ...task })) });
  }
  if (!key) throw Error('Missing operation identity');
  const prior = receipts.get(key);
  if (prior) return json(prior.body, prior.status);
  if (conflictNext) {
    conflictNext = false;
    const id = u.pathname.split('/').at(-1);
    const row = tasks.find(value => value.calendarTaskId === id);
    if (row) row.rowVersion++;
    return json({ code: 'calendar_task_conflict' }, 409);
  }
  const input = entry.body;
  let row, status = 200;
  if (init.method === 'POST' && u.pathname === '/v1/calendar-tasks') {
    const id = `${String(generatedTaskId++).padStart(8, '0')}-3333-4333-8333-333333333333`;
    row = { calendarTaskId: id, taskDate: input.taskDate, title: input.title, category: input.category,
      status: 'open', completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), rowVersion: 1 };
    tasks.push(row); status = 201;
  } else {
    const match = u.pathname.match(/^\/v1\/calendar-tasks\/([0-9a-f-]{36})(\/archive)?$/i);
    row = match && tasks.find(value => value.calendarTaskId === match[1]);
    if (!row) return json({ code: 'calendar_task_not_found' }, 404);
    if (row.rowVersion !== input.expectedRowVersion) return json({ code: 'calendar_task_conflict' }, 409);
    if (init.method === 'PATCH' && !match[2]) {
      row.status = input.status;
      row.completedAt = input.status === 'completed' ? new Date().toISOString() : null;
    } else if (init.method === 'POST' && match[2]) row.status = 'archived';
    else return json({ code: 'method_not_allowed' }, 405);
    row.updatedAt = new Date().toISOString(); row.rowVersion++;
  }
  effects++;
  const result = { calendarTask: { ...row } };
  receipts.set(key, { body: result, status });
  if (dropReply) { dropReply = false; throw Error('Synthetic response dropped after commit'); }
  return json(result, status);
};

function collect(dir, relative = '') {
  const files = new Map();
  for (const item of fs.readdirSync(path.join(dir, relative), { withFileTypes: true })) {
    const name = path.posix.join(relative, item.name);
    if (item.isDirectory()) for (const [file, data] of collect(dir, name)) files.set(file, data);
    else files.set(name, fs.readFileSync(path.join(dir, name)));
  }
  return files;
}

app.whenReady().then(async () => {
  const source = path.join(root, 'apps/dental-apps', appId), manifest = JSON.parse(fs.readFileSync(path.join(source, 'app.manifest.json')));
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-calendar';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), now = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Calendar', description: 'Private synthetic fixture', version: manifest.version, notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: bytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
  const policy = { format: 2, ...stamp, revokedKeys: [], apps: [{ id: appId, capabilities: manifest.capabilities, minimumVersion: '1.0.0', revokedDigests: [], rollback: null, releases: [grant] }] };
  function signed(field, value, purpose) { return Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), keys.privateKey).toString('base64') })); }
  const verifiedCatalogue = verifyCatalogue(signed('catalogue', catalogue, 'dental-os-catalogue'), trust, noWatermark, now).catalogue;
  const verifiedPolicy = verifyUpdatePolicy(signed('policy', policy, 'dental-os-update-policy'), trust, noWatermark, now).policy;
  const registry = new PackageRegistry(path.join(app.getPath('userData'), 'packages'), trust); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue), () => true);
  registry.setApiGrantResolver(value => {
    const match = apiReleaseGrantForPackage(value, verifiedPolicy);
    return match && apiReleaseGrantMatchesCatalogue(value.manifest.appId, match, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });
  registry.install(bytes);
  win = new BrowserWindow({ width: 1200, height: 850, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>Private M17 Calendar host</title>');
  const identity = {
    allowed: () => active.value,
    allowedClinicRequest: (id, route, method) => active.value && clinicRequestAllowed(id, 'admin', caps, route, method),
    snapshot: () => ({ generation: generation.value, active: active.value, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: syntheticId, displayName: 'Synthetic user', role: roleDenied ? 'reception' : 'admin', capabilities: [...caps] },
      clinic: { tenantId: syntheticId, displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: syntheticId, hasActiveTrial: false },
      branches: [{ branchId: syntheticId, branchCode: 'SYN', name: 'Synthetic branch' }],
    } }),
    credential: async () => 'synthetic-m17-host-only',
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  ipcMain.on('runtime:module-selection-ack', (event, value) => runtime.acknowledgeModule(event, value));
  global.m17 = {
    calls, tasks, today, todayBs: adToBs(today), effects: () => effects, dropReply: () => { dropReply = true; }, conflict: () => { conflictNext = true; },
    revoke: () => { generation.value++; active.value = false; },
    package: { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: bytes.length, assetCount: pkg.files.size },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 PRIVATE HOST FAILED', global.__m17Diagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
