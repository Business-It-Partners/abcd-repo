// Private synthetic acceptance host. Never packaged or used by the normal app.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');
process.on('uncaughtException', error => { global.__m17LabTrackerDiagnostic = error instanceof Error ? error.stack : String(error); });
process.on('unhandledRejection', error => { global.__m17LabTrackerDiagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY) throw Error('Private display required');
const root = path.resolve(__dirname, '../..');
const { FixtureRuntime } = require(path.join(root, 'dist-electron/runtime/manager.js'));
const { PackageRegistry } = require(path.join(root, 'dist-electron/packages/registry.js'));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, 'dist-electron/packages/format.js'));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, 'dist-electron/distribution/updatePolicy.js'));
const { verifyCatalogue, noWatermark } = require(path.join(root, 'dist-electron/distribution/catalogue.js'));
const { clinicRequestAllowed } = require(path.join(root, 'dist-electron/sdk/appPolicy.js'));
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.lab-tracker.m17';
const patientPending = '11111111-1111-4111-8111-111111111111';
const patientSent = '22222222-2222-4222-8222-222222222222';
const pendingId = '33333333-3333-4333-8333-333333333333';
const sentId = '44444444-4444-4444-8444-444444444444';
const labId = '55555555-5555-4555-8555-555555555555';
const calls = [];
const roleDenied = process.env.M17_DENY_ROLE === '1';
const caps = roleDenied ? [] : ['lab_tracker.access', 'finance.manage'];
let runtime, win, effects = 0, moduleSelectionResult;
const moduleAcks = [];
const now = new Date().toISOString();
const today = now.slice(0, 10);
const stamp = '2026-10-01T00:00:00.000Z';
const orders = [
  { labOrderId: pendingId, patientId: patientPending, patientNumber: 'SYN-LAB-001', patientName: 'Synthetic Pending Patient', chiefComplaintId: '66666666-6666-4666-8666-666666666666', supplierId: null, labNameSnapshot: null, labWorkName: 'PFM Crown', toothScope: '46', shade: 'A2', requestedOn: today, sentOn: null, receivedOn: null, fittedOn: null, status: 'pending_assignment', clinicalNote: 'Synthetic clinical instruction', receptionNote: null, createdAt: stamp, updatedAt: stamp, rowVersion: 1 },
  { labOrderId: sentId, patientId: patientSent, patientNumber: 'SYN-LAB-002', patientName: 'Synthetic Sent Patient', chiefComplaintId: '77777777-7777-4777-8777-777777777777', supplierId: labId, labNameSnapshot: 'Bright Dental Lab', labWorkName: 'Zirconia Crown', toothScope: '36', shade: 'A1', requestedOn: today, sentOn: today, receivedOn: null, fittedOn: null, status: 'sent', clinicalNote: 'Read-only doctor instruction', receptionNote: null, createdAt: stamp, updatedAt: stamp, rowVersion: 2 },
];
const suppliers = [
  { supplierId: labId, name: 'Bright Dental Lab', supplierType: 'lab', contactPerson: 'Synthetic Contact', phone: '+977-9800000000', email: 'lab@example.invalid', address: 'Synthetic address', openingBalanceAmount: 0, openingBalanceAsOf: today, active: true, currentDueAmount: 0, createdAt: stamp, updatedAt: stamp, rowVersion: 1 },
];

function clone(value) { return structuredClone(value); }
function json(value, status = 200) { return Response.json(value, { status }); }
global.fetch = async (url, init = {}) => {
  const target = new URL(url), headers = new Headers(init.headers);
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing fixture host credential');
  const entry = { path: target.pathname + target.search, method: init.method ?? 'GET', operationId: headers.get('idempotency-key'), body: init.body ? JSON.parse(init.body) : null };
  calls.push(entry);
  if (entry.method === 'GET' && target.pathname === '/v1/lab-orders') return json({ labOrders: clone(orders) });
  if (entry.method === 'GET' && target.pathname === '/v1/clinic/suppliers' && target.searchParams.get('scope') === 'lab') return json({ suppliers: clone(suppliers) });
  if (entry.method === 'POST' && /^\/v1\/lab-orders\/[^/]+\/assign$/.test(target.pathname)) {
    effects++;
    const id = target.pathname.split('/')[3], row = orders.find(item => item.labOrderId === id);
    if (!row || row.status !== 'pending_assignment' || row.rowVersion !== entry.body.expectedRowVersion) return json({ code: 'row_conflict' }, 409);
    const supplier = suppliers.find(item => item.supplierId === entry.body.supplierId);
    Object.assign(row, { supplierId: supplier.supplierId, labNameSnapshot: supplier.name, labWorkName: entry.body.labWorkName, toothScope: entry.body.toothScope, shade: entry.body.shade, sentOn: entry.body.sentOn, receptionNote: entry.body.receptionNote, status: 'sent', rowVersion: row.rowVersion + 1, updatedAt: new Date().toISOString() });
    return json({ labOrder: clone(row) });
  }
  if (entry.method === 'PATCH' && /^\/v1\/lab-orders\/[^/]+$/.test(target.pathname)) {
    effects++;
    const id = target.pathname.split('/').at(-1), row = orders.find(item => item.labOrderId === id);
    if (!row || row.rowVersion !== entry.body.expectedRowVersion) return json({ code: 'row_conflict' }, 409);
    const body = entry.body;
    if (body.clearAssignment) Object.assign(row, { supplierId: null, labNameSnapshot: null, sentOn: null, receivedOn: null, fittedOn: null, status: 'pending_assignment' });
    else {
      if (body.status === 'received') { row.status = 'received'; row.receivedOn = body.receivedOn ?? today; }
      if (body.status === 'fitted') { row.status = 'fitted'; row.receivedOn ??= today; row.fittedOn = body.fittedOn ?? today; }
      if (body.status === 'cancelled') row.status = 'cancelled';
      if (Object.hasOwn(body, 'receptionNote')) row.receptionNote = body.receptionNote;
    }
    row.rowVersion++;
    row.updatedAt = new Date().toISOString();
    return json({ labOrder: clone(row) });
  }
  if (entry.method === 'POST' && target.pathname === '/v1/clinic/suppliers') {
    effects++;
    const row = { supplierId: '88888888-8888-4888-8888-888888888888', ...entry.body, currentDueAmount: entry.body.openingBalanceAmount, createdAt: now, updatedAt: now, rowVersion: 1 };
    suppliers.push(row);
    return json({ supplier: clone(row) }, 201);
  }
  if (entry.method === 'PATCH' && /^\/v1\/clinic\/suppliers\/[^/]+$/.test(target.pathname)) {
    effects++;
    const row = suppliers.find(item => item.supplierId === target.pathname.split('/').at(-1));
    if (!row || row.rowVersion !== entry.body.expectedRowVersion) return json({ code: 'row_conflict' }, 409);
    Object.assign(row, entry.body, { rowVersion: row.rowVersion + 1, updatedAt: new Date().toISOString() });
    return json({ supplier: clone(row) });
  }
  return json({ code: 'route_not_found' }, 404);
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-lab-tracker';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), timestamp = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: timestamp, expiresAt: timestamp + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Lab Tracker', description: 'Private synthetic fixture', version: manifest.version, notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: bytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
  const policy = { format: 2, ...stamp, revokedKeys: [], apps: [{ id: appId, capabilities: manifest.capabilities, minimumVersion: '1.0.0', revokedDigests: [], rollback: null, releases: [grant] }] };
  function signed(field, value, purpose) { return Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), keys.privateKey).toString('base64') })); }
  const verifiedCatalogue = verifyCatalogue(signed('catalogue', catalogue, 'dental-os-catalogue'), trust, noWatermark, timestamp).catalogue;
  const verifiedPolicy = verifyUpdatePolicy(signed('policy', policy, 'dental-os-update-policy'), trust, noWatermark, timestamp).policy;
  const registry = new PackageRegistry(path.join(app.getPath('userData'), 'packages'), trust); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue), () => true);
  registry.setApiGrantResolver(value => {
    const match = apiReleaseGrantForPackage(value, verifiedPolicy);
    return match && apiReleaseGrantMatchesCatalogue(value.manifest.appId, match, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });
  registry.install(bytes);
  win = new BrowserWindow({ width: 1365, height: 950, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>Private M17 Lab Tracker host</title>');
  const identity = {
    allowed: () => true,
    allowedClinicRequest: (id, route, method) => clinicRequestAllowed(id, 'admin', caps, route, method),
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: '99999999-9999-4999-8999-999999999999', displayName: 'Synthetic user', role: 'admin', capabilities: [...caps] },
      clinic: { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: null, hasActiveTrial: false }, branches: [],
    } }),
    credential: async () => 'synthetic-m17-host-only',
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  ipcMain.on('runtime:module-selection-ack', (event, value) => { moduleAcks.push(value); runtime.acknowledgeModule(event, value); });
  global.m17LabTracker = {
    calls, effects: () => effects, orders, suppliers, moduleAcks,
    selectModule: async moduleId => { moduleSelectionResult = await runtime.selectModule(appId, moduleId); return moduleSelectionResult; },
    moduleSelectionResult: () => moduleSelectionResult,
    package: { appId, version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: bytes.length, assetCount: pkg.files.size },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17LabTrackerDiagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 LAB TRACKER PRIVATE HOST FAILED', global.__m17LabTrackerDiagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
