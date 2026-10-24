// Private synthetic acceptance host. Never packaged or used by the normal app.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');
process.on('uncaughtException', error => { global.__m17FinanceDiagnostic = error instanceof Error ? error.stack : String(error); });
process.on('unhandledRejection', error => { global.__m17FinanceDiagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY) throw Error('Private display required');
const root = path.resolve(__dirname, '../..');
const { FixtureRuntime } = require(path.join(root, 'dist-electron/runtime/manager.js'));
const { PackageRegistry } = require(path.join(root, 'dist-electron/packages/registry.js'));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, 'dist-electron/packages/format.js'));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, 'dist-electron/distribution/updatePolicy.js'));
const { verifyCatalogue, noWatermark } = require(path.join(root, 'dist-electron/distribution/catalogue.js'));
const { clinicRequestAllowed } = require(path.join(root, 'dist-electron/sdk/appPolicy.js'));
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.finance.m17';
const capabilities = ['finance.manage'];
const calls = [];
const overview = {
  patientOutstandingDueAmount: 0, generalExpenseAmount: 0, purchaseAmount: 0,
  supplierPayoutAmount: 0, salaryPayoutAmount: 0, currentSupplierOutstandingAmount: 0,
  labPurchaseAmount: 0, labPayoutAmount: 0, currentLabOutstandingAmount: 0,
};
let runtime;
global.fetch = async (url, init = {}) => {
  const target = new URL(url), headers = new Headers(init.headers);
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing fixture host credential');
  calls.push({ path: target.pathname + target.search, method: init.method ?? 'GET' });
  if ((init.method ?? 'GET') === 'GET' && target.pathname === '/v1/clinic/transaction-record') {
    return Response.json({ report: { transactions: [], cashInTotal: 0, cashOutTotal: 0, netCashAmount: 0, overview } });
  }
  return Response.json({ code: 'route_not_found' }, { status: 404 });
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-finance';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), now = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Finance', description: 'Private synthetic fixture', version: manifest.version, notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: bytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
  const policy = { format: 2, ...stamp, revokedKeys: [], apps: [{ id: appId, capabilities: manifest.capabilities, minimumVersion: '1.0.0', revokedDigests: [], rollback: null, releases: [grant] }] };
  const signed = (field, value, purpose) => Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), keys.privateKey).toString('base64') }));
  const verifiedCatalogue = verifyCatalogue(signed('catalogue', catalogue, 'dental-os-catalogue'), trust, noWatermark, now).catalogue;
  const verifiedPolicy = verifyUpdatePolicy(signed('policy', policy, 'dental-os-update-policy'), trust, noWatermark, now).policy;
  const registry = new PackageRegistry(path.join(app.getPath('userData'), 'packages'), trust); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue), () => true);
  registry.setApiGrantResolver(value => {
    const match = apiReleaseGrantForPackage(value, verifiedPolicy);
    return match && apiReleaseGrantMatchesCatalogue(value.manifest.appId, match, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });
  registry.install(bytes);
  const win = new BrowserWindow({ width: 1365, height: 950, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>Private M17 Finance host</title>');
  const identity = {
    allowed: () => true,
    allowedClinicRequest: (id, route, method) => clinicRequestAllowed(id, 'admin', capabilities, route, method),
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: '99999999-9999-4999-8999-999999999999', displayName: 'Synthetic user', role: 'admin', capabilities },
      clinic: { tenantId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: null, hasActiveTrial: false }, branches: [],
    } }),
    credential: async () => 'synthetic-m17-host-only',
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  global.m17Finance = { calls, package: { appId, version: manifest.version, wireBytes: bytes.length, assetCount: pkg.files.size } };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17FinanceDiagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 FINANCE PRIVATE HOST FAILED', global.__m17FinanceDiagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
