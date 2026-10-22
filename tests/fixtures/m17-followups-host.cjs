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
const appId = 'company.dental.followups', id = '11111111-1111-4111-8111-111111111111', doctor = '22222222-2222-4222-8222-222222222222';
const dateParts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
const today = ['year', 'month', 'day'].map(key => dateParts.find(row => row.type === key).value).join('-');
const calls = [], receipts = new Map();
const rows = [{ followUpId: id, patientId: id, chiefComplaintId: null, dueOn: today, dueTime: '10:30', reason: 'Synthetic scheduled recall', status: 'pending', rowVersion: 1, patientNumber: 'SYN-M17', patientName: 'Synthetic M17 Patient', patientPhone: '9800000000', requestedByStaffName: 'Synthetic Doctor', lastVisitOn: null, called: false, noAnswer: false }];
let generation = 1, active = true, dropReply = false, conflict = false, effects = 0, runtime, win;
const moduleAcks = [];
let moduleSelectionResult;
const caps = ['followups.access', 'staff.reference.read'];
const identity = {
  allowed: () => active,
  allowedClinicRequest: (appId, route, method) => active && clinicRequestAllowed(appId, 'admin', caps, route, method),
  snapshot: () => ({ generation, active, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
    clinicUser: { clinicUserId: id, displayName: 'Synthetic user', role: 'admin', capabilities: caps },
    clinic: { tenantId: id, displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: id, hasActiveTrial: false }, branches: [{ branchId: id, branchCode: 'SYN', name: 'Synthetic branch' }],
  } }),
  credential: async () => 'synthetic-m17-host-only',
};
global.fetch = async (url, init) => {
  const u = new URL(url), key = new Headers(init.headers).get('idempotency-key');
  if (new Headers(init.headers).get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing host credential');
  calls.push({ path: u.pathname + u.search, method: init.method, operationId: key });
  if (init.method === 'GET') {
    if (u.pathname === '/v1/follow-ups') return Response.json({ followUps: rows });
    if (u.pathname === '/v1/clinic/staff-references') return Response.json({ staff: [
      { staffId: doctor, fullName: 'Synthetic Doctor', staffType: 'doctor', jobTitle: null, status: 'active' },
      { staffId: '44444444-4444-4444-8444-444444444444', fullName: 'Synthetic Inactive Doctor', staffType: 'doctor', jobTitle: null, status: 'inactive' },
      { staffId: '55555555-5555-4555-8555-555555555555', fullName: 'Synthetic Active Helper', staffType: 'helper', jobTitle: null, status: 'active' },
    ] });
    if (u.pathname === '/v1/patients') return Response.json({ patients: [{ patientId: id, patientNumber: 'SYN-M17', fullName: 'Synthetic M17 Patient', phone: '9800000000', status: 'active', registeredOn: today, rowVersion: 1, dateOfBirth: null, sex: null, ageYears: null }] });
    return Response.json({}, { status: 404 });
  }
  if (!key) throw Error('Missing operation identity');
  const prior = receipts.get(key);
  if (prior) return Response.json(prior.body, { status: prior.status });
  const input = JSON.parse(init.body);
  if (conflict) { conflict = false; rows[0].rowVersion++; return Response.json({ code: 'conflict' }, { status: 409 }); }
  let result, status = 200;
  if (init.method === 'POST' && u.pathname === '/v1/follow-ups') {
    const row = { followUpId: '33333333-3333-4333-8333-333333333333', patientId: input.patientId, chiefComplaintId: input.chiefComplaintId,
      dueOn: input.dueOn, dueTime: input.dueTime, reason: input.reason, status: 'pending', rowVersion: 1,
      patientNumber: 'SYN-M17', patientName: 'Synthetic M17 Patient', patientPhone: '9800000000', requestedByStaffName: 'Synthetic Doctor',
      lastVisitOn: null, called: false, noAnswer: false };
    rows.push(row); result = { followUp: { followUpId: row.followUpId, patientId: row.patientId, chiefComplaintId: row.chiefComplaintId, dueOn: row.dueOn, dueTime: row.dueTime, reason: row.reason, status: row.status } }; status = 201;
  } else {
    const row = rows.find(row => u.pathname.includes(row.followUpId));
    if (!row) return Response.json({}, { status: 404 });
    if (row.rowVersion !== input.expectedRowVersion) return Response.json({}, { status: 409 });
    if (u.pathname.endsWith('/toggle')) {
      if (input.field === 'called') row.called = input.checked;
      if (input.field === 'no_answer') row.noAnswer = input.checked;
      if (input.field === 'caught') row.status = input.checked ? 'caught' : 'pending';
    } else if (u.pathname.endsWith('/schedule')) Object.assign(row, { dueOn: input.dueOn, dueTime: input.dueTime, reason: input.reason, called: false, noAnswer: false, status: 'pending' });
    else return Response.json({}, { status: 404 });
    row.rowVersion++;
    result = { followUp: u.pathname.endsWith('/toggle')
      ? { followUpId: row.followUpId, field: input.field, checked: input.checked, status: row.status, rowVersion: row.rowVersion }
      : { followUpId: row.followUpId, dueOn: row.dueOn, dueTime: row.dueTime, reason: row.reason, rowVersion: row.rowVersion } };
  }
  effects++; receipts.set(key, { body: result, status });
  if (dropReply) { dropReply = false; throw Error('Synthetic response dropped after commit'); }
  return Response.json(result, { status });
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), now = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Follow-ups', description: 'Private synthetic fixture', version: manifest.version, notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: bytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
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
  await win.loadURL('data:text/html,<title>Private M17 host</title>');
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  ipcMain.on('runtime:module-selection-ack', (event, value) => { moduleAcks.push(value); runtime.acknowledgeModule(event, value); });
  global.m17 = { calls, rows, today, states: () => [...runtime.entries.values()].map(value => value.state), effects: () => effects,
    dropReply: () => { dropReply = true; }, conflict: () => { conflict = true; },
    revoke: () => { generation++; active = false; }, module: async () => { moduleSelectionResult = await runtime.selectModule(appId, 'followups'); return moduleSelectionResult; },
    moduleAcks, moduleSelectionResult: () => moduleSelectionResult,
    deny: () => { caps.splice(0, caps.length, 'staff.reference.read'); }, allow: () => { caps.splice(0, caps.length, 'followups.access', 'staff.reference.read'); },
    resize: (width, height) => { win.setContentSize(width, height); runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width, height } }]); },
  package: { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: bytes.length, assetCount: pkg.files.size },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17Diagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 PRIVATE HOST FAILED', global.__m17Diagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
