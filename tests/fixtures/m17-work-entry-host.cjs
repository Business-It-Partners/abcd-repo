// Private synthetic acceptance host. Never packaged or loaded by normal Dental OS.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { generateKeyPairSync, sign } = require('node:crypto');
process.on('uncaughtException', error => { global.__m17WorkEntryDiagnostic = error instanceof Error ? error.stack : String(error); });
process.on('unhandledRejection', error => { global.__m17WorkEntryDiagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY) throw Error('Private display required');
const root = path.resolve(__dirname, '../..');
const { FixtureRuntime } = require(path.join(root, 'dist-electron/runtime/manager.js'));
const { PackageRegistry } = require(path.join(root, 'dist-electron/packages/registry.js'));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, 'dist-electron/packages/format.js'));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, 'dist-electron/distribution/updatePolicy.js'));
const { verifyCatalogue, noWatermark } = require(path.join(root, 'dist-electron/distribution/catalogue.js'));
const { clinicRequestAllowed } = require(path.join(root, 'dist-electron/sdk/appPolicy.js'));
const { staging } = require(path.join(root, 'dist-electron/sdk/environment.js'));
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.work-entry.m17';
const patientId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const protocolId = '33333333-3333-4333-8333-333333333333';
const stageId = '44444444-4444-4444-8444-444444444444';
const patientProtocolId = '55555555-5555-4555-8555-555555555555';
const staffId = '66666666-6666-4666-8666-666666666666';
const mediaAssetId = '88888888-8888-4888-8888-888888888888';
const mediaAssetIds = [mediaAssetId, '99999999-9999-4999-8999-999999999999', 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'];
const mediaAssets = new Map();
let nextMediaAssetIndex = 0;
let caseWorklistStatus = 'in_progress';
let mediaUploadDelayMs = 0;
const calls = [];
const roleDenied = process.env.M17_DENY_ROLE === '1';
const caps = roleDenied ? [] : ['work_entry.access', 'patient_payments.collect', 'lab_tracker.access', 'staff.reference.read', 'treatment_protocols.reference.read', 'patient_billing_ledger.read', 'followups.access'];
let runtime, win, effects = 0, moduleSelectionResult;
const moduleAcks = [];
const summary = {
  patientId, patientNumber: 'SYN-001', fullName: 'Synthetic Work Entry Patient', dateOfBirth: null, ageYears: 34,
  sex: 'female', phone: '+977-9800000000', status: 'active', registeredOn: '2026-10-01', rowVersion: 1,
};
const caseValue = {
  chiefComplaintId: caseId, patientId, patientNumber: summary.patientNumber, patientName: summary.fullName,
  chiefComplaint: 'Synthetic molar pain', openedOn: '2026-10-22', status: 'open', outcomeNote: null, closedOn: null,
  rowVersion: 1, caseDoctorStaffIds: [staffId], protocols: [{ patientProtocolId, rowVersion: 1, sourceProtocolId: protocolId,
    protocolName: 'Synthetic root canal', toothCode: '46', treatmentArea: null, status: 'active', stages: [{ stageId, rowVersion: 1,
      sourceProtocolStageId: '77777777-7777-4777-8777-777777777777', stageName: 'Clean and shape', stageOrder: 1, price: 12500, status: 'pending' }] }],
};
const protocolValue = {
  protocolId, name: 'Synthetic root canal', category: 'Endodontics', description: null, toothScope: 'tooth',
  recordsCanalMeasurements: false, usesMobilityGrade: false, active: true, starterTemplateCode: null, starterPackVersion: null,
  rowVersion: 1, totalPrice: 12500, stages: [{ protocolStageId: caseValue.protocols[0].stages[0].sourceProtocolStageId,
    stageOrder: 1, stageName: 'Clean and shape', price: 12500, active: true, rowVersion: 1 }],
};
const callsFor = path => calls.filter(call => call.path === path);
function json(value, status = 200) { return Response.json(value, { status }); }
function clone(value) { return structuredClone(value); }

global.fetch = async (url, init = {}) => {
  const target = new URL(url), headers = new Headers(init.headers);
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing fixture host credential');
  const entry = { path: target.pathname + target.search, method: init.method ?? 'GET', operationId: headers.get('idempotency-key'), body: typeof init.body === 'string' ? JSON.parse(init.body) : null };
  calls.push(entry);
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/media`) return json({ media: [...mediaAssets.values()].map(clone) });
  if (entry.method === 'POST' && target.pathname === '/v1/patient-media/upload-intents') {
    const uploadMediaAssetId = mediaAssetIds[nextMediaAssetIndex++ % mediaAssetIds.length];
    const asset = { ...entry.body, mediaAssetId: uploadMediaAssetId, patientId, branchId: patientId, assetType: 'xray', status: 'pending', createdAt: '2026-10-24T00:00:00.000Z', updatedAt: '2026-10-24T00:00:00.000Z', rowVersion: 1, replacesMediaAssetId: null };
    mediaAssets.set(uploadMediaAssetId, asset);
    return json({ uploadIntent: { media: asset, uploadUrl: `${staging.apiBase}/v1/patient-media/${uploadMediaAssetId}/content`, uploadHeaders: { 'content-type': asset.mimeType } } }, 201);
  }
  const contentUploadId = /^\/v1\/patient-media\/([^/]+)\/content$/.exec(target.pathname)?.[1];
  if (entry.method === 'PUT' && contentUploadId && mediaAssets.has(contentUploadId)) {
    if (mediaUploadDelayMs > 0) await new Promise(resolve => setTimeout(resolve, mediaUploadDelayMs));
    return new Response(null, { status: 204 });
  }
  const finaliseId = /^\/v1\/patient-media\/([^/]+)\/finalise$/.exec(target.pathname)?.[1];
  if (entry.method === 'POST' && finaliseId && mediaAssets.has(finaliseId)) {
    const asset = { ...mediaAssets.get(finaliseId), status: 'active', updatedAt: '2026-10-24T00:01:00.000Z' };
    mediaAssets.set(finaliseId, asset);
    return json({ media: asset });
  }
  const withdrawId = /^\/v1\/patient-media\/([^/]+)\/withdraw$/.exec(target.pathname)?.[1];
  if (entry.method === 'POST' && withdrawId && mediaAssets.has(withdrawId)) {
    mediaAssets.set(withdrawId, { ...mediaAssets.get(withdrawId), status: 'withdrawn', updatedAt: '2026-10-24T00:02:00.000Z' });
    return json({ withdrawn: true });
  }
  if (entry.method === 'GET' && target.pathname === '/v1/work-entry/cases') return json({ cases: [{ ...summary,
    cases: [{ chiefComplaintId: caseId, chiefComplaint: caseValue.chiefComplaint, openedOn: caseValue.openedOn, status: 'open', rowVersion: 1, treatmentProtocolCount: 1, worklistStatus: caseWorklistStatus }],
    latestCase: { chiefComplaintId: caseId, chiefComplaint: caseValue.chiefComplaint, openedOn: caseValue.openedOn, status: 'open', rowVersion: 1, treatmentProtocolCount: 1, worklistStatus: caseWorklistStatus },
  }] });
  if (entry.method === 'GET' && target.pathname === '/v1/treatment-protocols') return json({ treatmentProtocols: [clone(protocolValue)] });
  if (entry.method === 'GET' && target.pathname === '/v1/clinic/staff-references') return json({ staff: [{ staffId, fullName: 'Synthetic Dentist', staffType: 'doctor', status: 'active' }] });
  if (entry.method === 'GET' && target.pathname === `/v1/chief-complaints/${caseId}/work-entry`) return json({ case: clone(caseValue) });
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/core`) return json({ patient: { ...clone(summary), address: null, preferredLanguage: null,
    emergencyContactName: null, emergencyContactPhone: null, chiefComplaintId: caseId,
    medicalProfile: { conditionsSummary: null, currentMedicationsSummary: null, habitsSummary: null, medicalNotes: null, verifiedOn: null, rowVersion: 1 }, allergies: [],
  } });
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/ledger`) return json({ ledger: { summary: { totalBilled: 0, totalCollected: 0, totalDiscount: 0, outstandingDue: 0 }, entries: [], nextCursor: null } });
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/odontogram`) return json({ marks: [] });
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/periodontal-chart`) return json({ chart: { patientId, lastChartedOn: null, teeth: [] } });
  if (entry.method === 'GET' && target.pathname === `/v1/patients/${patientId}/canal-measurements`) return json({ sessions: [] });
  if (entry.method === 'GET' && target.pathname === '/v1/clinic/suppliers') return json({ suppliers: [] });
  if (entry.method === 'GET' && target.pathname === '/v1/follow-ups') return json({ followUps: [] });
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-work-entry';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const bytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(bytes, trust), digest = sha256(bytes), now = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000 };
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'] };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Work Entry', description: 'Private synthetic fixture', version: manifest.version,
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
  win = new BrowserWindow({ width: 1280, height: 900, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>Private M17 Work Entry host</title>');
  const identity = {
    allowed: () => true,
    allowedMediaRead: (family, kind) => family === 'clinic.app.work-entry' && kind === 'patient_media',
    allowedMediaUpload: (family, kind) => family === 'clinic.app.work-entry' && kind === 'patient_media',
    allowedClinicRequest: (id, route, method) => clinicRequestAllowed(id, 'admin', caps, route, method),
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: staffId, displayName: 'Synthetic user', role: 'admin', capabilities: [...caps] },
      clinic: { tenantId: patientId, displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: patientId, hasActiveTrial: false },
      branches: [{ branchId: patientId, branchCode: 'SYN', name: 'Synthetic branch' }],
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
  global.m17WorkEntry = {
    calls, effects: () => effects, caseValue,
    setWorklistStatus: status => { if (status !== 'open' && status !== 'in_progress') throw Error('Invalid fixture status'); caseWorklistStatus = status; },
    setMediaUploadDelay: delayMs => { mediaUploadDelayMs = Math.max(0, Number(delayMs) || 0); },
    navigate: (direction, discardDirty = false, preserveDraft = false) => runtime.navigate(appId, direction, discardDirty, preserveDraft),
    navigation: () => runtime.entries.get(appId)?.state.navigation ?? null,
    module: async () => { moduleSelectionResult = await runtime.selectModule(appId, 'work-entry'); return moduleSelectionResult; },
    moduleAcks, moduleSelectionResult: () => moduleSelectionResult,
    package: { appId, version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: bytes.length, assetCount: pkg.files.size },
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17WorkEntryDiagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 WORK ENTRY PRIVATE HOST FAILED', global.__m17WorkEntryDiagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
