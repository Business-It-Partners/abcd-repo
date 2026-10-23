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
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.m17.treatment-protocols';
const protocolId = '11111111-1111-4111-8111-111111111111';
const stageOneId = '22222222-2222-4222-8222-222222222222';
const stageTwoId = '33333333-3333-4333-8333-333333333333';
const newProtocolId = '44444444-4444-4444-8444-444444444444';
const newStageId = '55555555-5555-4555-8555-555555555555';
const calls = [], receipts = new Map();
const protocols = [{
  protocolId, name: 'Synthetic Root Canal', category: 'Endodontics', description: null, toothScope: 'tooth',
  recordsCanalMeasurements: true, usesMobilityGrade: false, active: true,
  starterTemplateCode: null, starterPackVersion: null, rowVersion: 1, totalPrice: 2500,
  stages: [
    { protocolStageId: stageOneId, stageOrder: 1, stageName: 'Clean and shape', price: 1500, active: true, rowVersion: 1 },
    { protocolStageId: stageTwoId, stageOrder: 2, stageName: 'Fill canals', price: 1000, active: true, rowVersion: 1 },
  ],
}];
const generation = { value: 1 }, active = { value: true };
const roleDenied = process.env.M17_DENY_ROLE === '1';
const caps = roleDenied ? ['treatment_protocols.reference.read'] : ['treatment_protocols.manage', 'treatment_protocols.reference.read'];
let dropReply = false, conflictNext = false, effects = 0, runtime, win;
const moduleAcks = [];
let moduleSelectionResult;
function json(value, status = 200) { return Response.json(value, { status }); }
function clone(value) { return structuredClone(value); }

global.fetch = async (url, init) => {
  const target = new URL(url), headers = new Headers(init.headers), key = headers.get('idempotency-key');
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing fixture host credential');
  const entry = { path: target.pathname + target.search, method: init.method, operationId: key, body: init.body ? JSON.parse(init.body) : null };
  calls.push(entry);
  if (init.method === 'GET' && target.pathname === '/v1/treatment-protocols') return json({ treatmentProtocols: clone(protocols) });
  if (!key) throw Error('Missing operation identity');
  const previous = receipts.get(key);
  if (previous) return json(previous.body, previous.status);
  if (conflictNext) {
    conflictNext = false;
    const existing = protocols.find(row => row.protocolId === target.pathname.split('/').at(-1));
    if (existing) existing.rowVersion++;
    return json({ code: 'protocol_conflict' }, 409);
  }
  const input = entry.body;
  let response, status = 200;
  if (init.method === 'POST' && target.pathname === '/v1/treatment-protocols') {
    const row = { protocolId: newProtocolId, ...input, starterTemplateCode: null, starterPackVersion: null, rowVersion: 1, totalPrice: 0, stages: [] };
    protocols.unshift(row); response = { treatmentProtocol: clone(row) }; status = 201;
  } else if (init.method === 'PUT' && target.pathname.startsWith('/v1/treatment-protocols/')) {
    const row = protocols.find(value => value.protocolId === target.pathname.split('/').at(-1));
    if (!row) return json({ code: 'protocol_not_found' }, 404);
    if (row.rowVersion !== input.rowVersion) return json({ code: 'protocol_conflict' }, 409);
    const stages = input.stages.map(stage => {
      const previousStage = stage.protocolStageId && row.stages.find(value => value.protocolStageId === stage.protocolStageId);
      return { protocolStageId: stage.protocolStageId ?? newStageId, stageOrder: stage.stageOrder, stageName: stage.stageName, price: stage.price,
        active: stage.active, rowVersion: previousStage ? previousStage.rowVersion + 1 : 1 };
    });
    Object.assign(row, { name: input.name, category: input.category, description: input.description, toothScope: input.toothScope,
      recordsCanalMeasurements: input.recordsCanalMeasurements, usesMobilityGrade: input.usesMobilityGrade, active: input.active,
      rowVersion: row.rowVersion + 1, stages, totalPrice: stages.filter(stage => stage.active).reduce((total, stage) => total + stage.price, 0) });
    response = { treatmentProtocol: clone(row) };
  } else return json({ code: 'route_not_found' }, 404);
  effects++;
  receipts.set(key, { body: response, status });
  if (dropReply) { dropReply = false; throw Error('Synthetic response dropped after commit'); }
  return json(response, status);
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-treatment-protocols';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), now = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Treatment Protocols', description: 'Private synthetic fixture', version: manifest.version,
    notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1,
    objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: bytes.length,
    payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
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
  await win.loadURL('data:text/html,<title>Private M17 Treatment Protocols host</title>');
  const identity = {
    allowed: () => active.value,
    allowedClinicRequest: (id, route, method) => active.value && clinicRequestAllowed(id, 'admin', caps, route, method),
    snapshot: () => ({ generation: generation.value, active: active.value, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: protocolId, displayName: 'Synthetic user', role: 'admin', capabilities: [...caps] },
      clinic: { tenantId: protocolId, displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: protocolId, hasActiveTrial: false },
      branches: [{ branchId: protocolId, branchCode: 'SYN', name: 'Synthetic branch' }],
    } }),
    credential: async () => 'synthetic-m17-host-only',
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  ipcMain.on('runtime:navigation-report', (event, value) => runtime.navigationReport(event, value));
  ipcMain.on('runtime:module-selection-ack', (event, value) => { moduleAcks.push(value); runtime.acknowledgeModule(event, value); });
  global.m17 = {
    calls, protocols, effects: () => effects, dropReply: () => { dropReply = true; }, conflict: () => { conflictNext = true; },
    module: async () => { moduleSelectionResult = await runtime.selectModule(appId, 'treatment-protocols'); return moduleSelectionResult; },
    moduleAcks, moduleSelectionResult: () => moduleSelectionResult,
    navigate: direction => runtime.navigate(appId, direction),
    navigation: () => runtime.entries.get(appId)?.state.navigation ?? null,
    package: { appId, version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: bytes.length, assetCount: pkg.files.size },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 PRIVATE HOST FAILED', global.__m17Diagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
