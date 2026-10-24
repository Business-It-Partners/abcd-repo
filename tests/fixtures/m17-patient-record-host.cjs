// Private synthetic M17.2 acceptance host. Never packaged or connected to a live clinic.
const { app, BrowserWindow, ipcMain, protocol } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { createHash, generateKeyPairSync, sign } = require('node:crypto');
process.on('uncaughtException', error => { global.__m17PatientRecordDiagnostic = error instanceof Error ? error.stack : String(error); });
process.on('unhandledRejection', error => { global.__m17PatientRecordDiagnostic = error instanceof Error ? error.stack : String(error); });
if (!process.env.ELECTRON_OS_TEST_DISPLAY || process.env.DISPLAY || path.join(process.env.XDG_RUNTIME_DIR || '', process.env.WAYLAND_DISPLAY || '') !== process.env.ELECTRON_OS_TEST_DISPLAY) throw Error('Private display required');
const root = path.resolve(__dirname, '../..');
const { FixtureRuntime } = require(path.join(root, 'dist-electron/runtime/manager.js'));
const { PackageRegistry } = require(path.join(root, 'dist-electron/packages/registry.js'));
const { buildPackage, verifyPackage, sha256, canonical } = require(path.join(root, 'dist-electron/packages/format.js'));
const { apiOperations } = require(path.join(root, 'dist-electron/sdk/contracts.js'));
const { verifyUpdatePolicy, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue, allowUpdatedPackage } = require(path.join(root, 'dist-electron/distribution/updatePolicy.js'));
const { verifyCatalogue, noWatermark } = require(path.join(root, 'dist-electron/distribution/catalogue.js'));
const { clinicRequestAllowed } = require(path.join(root, 'dist-electron/sdk/appPolicy.js'));
protocol.registerSchemesAsPrivileged([{ scheme: 'dental-fixture', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);

const appId = 'company.dental.patient-record.m17';
const family = 'clinic.app.patient-record';
const patientId = '11111111-1111-4111-8111-111111111111';
const assetId = '22222222-2222-4222-8222-222222222222';
const uploadAssetId = '33333333-3333-4333-8333-333333333333';
const caseId = '99999999-9999-4999-8999-999999999999';
const protocolId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const stageSourceId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const pendingLabId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const supplierId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const apiBase = 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev';
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l1sAAAAASUVORK5CYII=', 'base64');
const checksum = value => createHash('sha256').update(value).digest('hex');
const calls = [], mediaWrites = [];
const roleDenied = process.env.M17_DENY_ROLE === '1';
const capabilities = roleDenied ? [] : ['patient_record.access', 'work_entry.access', 'lab_tracker.access', 'lab_requests.create', 'treatment_protocols.reference.read', 'clinic.media.read', 'clinic.media.upload'];
let runtime, win, writeEffects = 0, profileAttempts = 0, mediaItem, uploadIntent;
const now = new Date().toISOString().slice(0, 10);
const stamp = new Date().toISOString();
const patient = {
  patientId, patientNumber: 'SYN-PR-001', fullName: 'Synthetic Patient', dateOfBirth: null, ageYears: 34,
  sex: 'female', phone: '+977-9800000000', status: 'active', registeredOn: now, rowVersion: 4,
  address: 'Synthetic address', preferredLanguage: 'English', emergencyContactName: 'Synthetic Contact', emergencyContactPhone: '+977-9800000001',
  medicalProfile: { conditionsSummary: 'Synthetic condition', currentMedicationsSummary: null, habitsSummary: null, medicalNotes: null, verifiedOn: now, rowVersion: 3 },
  allergies: [{ patientAllergyId: '44444444-4444-4444-8444-444444444444', allergen: 'Synthetic pollen', reaction: 'Sneezing', severity: 'mild', note: null, recordedOn: now, status: 'active', rowVersion: 1 }],
};
const treatmentProtocol = { id: protocolId, name: 'Synthetic Root Canal', category: 'Endodontics', recordCanals: true,
  stages: [{ sourceProtocolStageId: stageSourceId, order: 1, label: 'Canal treatment', procedureCode: 'RCT', toothScope: 'tooth', recallIntervalDays: 0, defaultCost: 4500 }] };
const clinicalCase = { chiefComplaintId: caseId, patientId, patientNumber: patient.patientNumber, patientName: patient.fullName,
  chiefComplaint: 'Synthetic tooth pain', openedOn: now, status: 'open', outcomeNote: null, closedOn: null, rowVersion: 2, caseDoctorStaffIds: [], protocols: [] };
const periodontalChart = { patientId, lastChartedOn: null, teeth: [] };
const canalSessions = [];
const labSuppliers = [{ supplierId, name: 'Synthetic Dental Lab', supplierType: 'lab', active: true, rowVersion: 1 }];
const labOrders = [{ labOrderId: pendingLabId, patientId, patientNumber: patient.patientNumber, patientName: patient.fullName,
  chiefComplaintId: caseId, supplierId: null, labNameSnapshot: null, labWorkName: 'Synthetic PFM crown', toothScope: '16', shade: 'A2',
  requestedOn: now, sentOn: null, receivedOn: null, fittedOn: null, status: 'pending_assignment', clinicalNote: 'Synthetic request',
  receptionNote: null, createdAt: stamp, updatedAt: stamp, rowVersion: 1 }];
mediaItem = {
  mediaAssetId: assetId, patientId, branchId: '55555555-5555-4555-8555-555555555555', chiefComplaintId: null,
  assetType: 'xray', xrayType: 'IOPA', toothCode: '16', clinicalNote: 'Synthetic image', capturedOn: now,
  displayFilename: 'synthetic-xray.png', mimeType: 'image/png', byteSize: bytes.length, checksum: checksum(bytes), status: 'active',
  createdAt: stamp, updatedAt: stamp, rowVersion: 1, replacesMediaAssetId: null,
};
const clone = value => structuredClone(value);
const json = (value, status = 200) => Response.json(value, { status });
const bodyOf = init => {
  if (!init?.body) return null;
  if (typeof init.body === 'string') {
    try { return JSON.parse(init.body); } catch { return { binaryBytes: Buffer.byteLength(init.body) }; }
  }
  return { binaryBytes: Buffer.from(init.body).length };
};

global.fetch = async (input, init = {}) => {
  const target = new URL(input), headers = new Headers(init.headers);
  if (headers.get('authorization') !== 'Bearer synthetic-m17-host-only') throw Error('Missing fixture host credential');
  const method = init.method ?? 'GET';
  const body = bodyOf(init);
  const entry = { path: target.pathname + target.search, method, operationId: headers.get('idempotency-key'), body };
  calls.push(entry);
  if (method === 'GET' && target.pathname === '/v1/patients') {
    return json({ patients: [{ ...patient, medicalProfile: undefined, allergies: undefined }], nextCursor: null, total: 1, counts: { all: 1, new: 1, regular: 0 } });
  }
  if (method === 'GET' && target.pathname === '/v1/patient-intakes/context') {
    return json({ context: { patientNumberPrefix: 'SYN-PR-', currentCounter: 1, nextPatientNumber: 'SYN-PR-002' } });
  }
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/core`) return json({ patient: clone(patient) });
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/timeline`) return json({ timeline: [
    { eventId: 'evt-clinical-1', occurredOn: '2026-10-20', recordedAt: '2026-10-20T04:00:00.000Z', eventType: 'clinical_work', title: 'Synthetic crown preparation', detail: 'Clinical stage', chiefComplaintId: caseId, doctors: ['Synthetic dentist'], patientProtocolId: 'synthetic-protocol', protocolName: 'Synthetic Root Canal', toothCode: '16', treatmentArea: null },
    { eventId: 'evt-clinical-2', occurredOn: '2026-10-20', recordedAt: '2026-10-20T05:00:00.000Z', eventType: 'clinical_work', title: 'Synthetic canal measurement', detail: 'Clinical stage', chiefComplaintId: caseId, doctors: ['Synthetic dentist'], patientProtocolId: 'synthetic-protocol', protocolName: 'Synthetic Root Canal', toothCode: '16', treatmentArea: null },
    { eventId: 'evt-note', occurredOn: '2026-10-20', recordedAt: '2026-10-20T06:00:00.000Z', eventType: 'note', title: 'Synthetic note excluded from treatment timeline', detail: null, chiefComplaintId: caseId, doctors: [], patientProtocolId: null, protocolName: null, toothCode: null, treatmentArea: null },
    { eventId: 'evt-unscoped', occurredOn: '2026-10-20', recordedAt: '2026-10-20T07:00:00.000Z', eventType: 'clinical_work', title: 'Unscoped work excluded from treatment timeline', detail: null, chiefComplaintId: null, doctors: [], patientProtocolId: null, protocolName: null, toothCode: null, treatmentArea: null },
  ] });
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/treatment-plans`) return json({ treatmentPlans: [{
    chiefComplaintId: caseId, chiefComplaint: clinicalCase.chiefComplaint, openedOn: clinicalCase.openedOn, status: clinicalCase.status,
    outcomeNote: clinicalCase.outcomeNote, closedOn: clinicalCase.closedOn, protocols: clone(clinicalCase.protocols).map(protocol => ({
      patientProtocolId: protocol.patientProtocolId, protocolName: protocol.protocolName, toothCode: protocol.toothCode, treatmentArea: protocol.treatmentArea,
      status: protocol.status, stages: protocol.stages.map(stage => ({ stageId: stage.stageId, stageName: stage.stageName, stageOrder: stage.stageOrder,
        price: stage.price, status: stage.status, completedOn: null, completedAt: null, completedBy: [] })) })) }] });
  if (method === 'GET' && target.pathname === `/v1/chief-complaints/${caseId}/work-entry`) return json({ case: clone(clinicalCase) });
  if (method === 'GET' && target.pathname === '/v1/treatment-protocols') return json({ treatmentProtocols: [clone(treatmentProtocol)] });
  if (method === 'POST' && target.pathname === `/v1/chief-complaints/${caseId}/treatment-protocols`) {
    const protocol = { patientProtocolId: `protocol-${clinicalCase.protocols.length + 1}`, rowVersion: 1, sourceProtocolId: body.plan.sourceProtocolId,
      protocolName: treatmentProtocol.name, toothCode: body.plan.toothCode, treatmentArea: body.plan.treatmentArea, status: 'active',
      stages: body.plan.stages.map((stage, index) => ({ stageId: `stage-${clinicalCase.protocols.length + 1}-${index + 1}`, rowVersion: 1,
        sourceProtocolStageId: stage.sourceProtocolStageId, stageName: stage.stageName, stageOrder: index + 1, price: stage.price, status: 'pending' })) };
    clinicalCase.protocols.push(protocol); clinicalCase.rowVersion++; writeEffects++;
    return json({ case: clone(clinicalCase) }, 201);
  }
  if (method === 'PUT' && target.pathname === `/v1/patients/${patientId}/periodontal-chart`) {
    const existing = new Map(periodontalChart.teeth.map(item => [item.toothCode, item]));
    for (const tooth of body.teeth) existing.set(tooth.toothCode, clone(tooth));
    periodontalChart.teeth = [...existing.values()]; periodontalChart.lastChartedOn = body.recordedOn; writeEffects++;
    return json({ chart: clone(periodontalChart) });
  }
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/periodontal-chart`) return json({ chart: clone(periodontalChart) });
  if (method === 'POST' && target.pathname === `/v1/patients/${patientId}/canal-measurements`) {
    const session = { canalMeasurementSessionId: `canal-${canalSessions.length + 1}`, patientId, chiefComplaintId: body.chiefComplaintId,
      patientProtocolId: body.patientProtocolId ?? 'synthetic-plan', toothCode: body.plan?.toothCode ?? null, recordedOn: body.recordedOn,
      recordedByStaffId: body.recordedByStaffId, obturationMaterial: body.obturationMaterial, note: body.note, records: clone(body.records), createdAt: stamp };
    canalSessions.push(session); writeEffects++; return json({ session }, 201);
  }
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/canal-measurements`) return json({ sessions: clone(canalSessions) });
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/lab-orders`) return json({ labOrders: clone(labOrders) });
  if (method === 'GET' && target.pathname === '/v1/clinic/suppliers' && target.searchParams.get('scope') === 'lab') return json({ suppliers: clone(labSuppliers) });
  if (method === 'POST' && target.pathname === `/v1/lab-orders/${pendingLabId}/assign`) {
    const order = labOrders[0];
    if (order.rowVersion !== body.expectedRowVersion) return json({ code: 'row_conflict' }, 409);
    const supplier = labSuppliers.find(value => value.supplierId === body.supplierId);
    if (!supplier || !supplier.active) return json({ code: 'supplier_invalid' }, 422);
    Object.assign(order, { supplierId: supplier.supplierId, labNameSnapshot: supplier.name, labWorkName: body.labWorkName,
      toothScope: body.toothScope, shade: body.shade, sentOn: body.sentOn, receptionNote: body.receptionNote, status: 'sent', rowVersion: order.rowVersion + 1 });
    writeEffects++; return json({ labOrder: clone(order) });
  }
  if (method === 'PUT' && target.pathname === `/v1/patients/${patientId}/profile`) {
    profileAttempts++;
    if (profileAttempts === 1) return json({ code: 'temporary_unavailable' }, 503);
    if (entry.body?.expectedPatientRowVersion !== patient.rowVersion || entry.body?.expectedMedicalProfileRowVersion !== patient.medicalProfile.rowVersion) return json({ code: 'row_conflict' }, 409);
    Object.assign(patient, entry.body.patient, { medicalProfile: { ...entry.body.medicalProfile, rowVersion: patient.medicalProfile.rowVersion + 1 }, allergies: entry.body.allergies, rowVersion: patient.rowVersion + 1 });
    writeEffects++;
    return json({ patient: clone(patient) });
  }
  if (method === 'GET' && target.pathname === `/v1/patients/${patientId}/media`) return json({ media: [clone(mediaItem)] });
  if (method === 'POST' && target.pathname === `/v1/patient-media/${assetId}/view`) {
    return new Response(bytes, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(bytes.length) } });
  }
  if (method === 'POST' && target.pathname === '/v1/patient-media/upload-intents') {
    uploadIntent = { ...body, mediaAssetId: uploadAssetId, patientId, status: 'pending', rowVersion: 1, createdAt: stamp, updatedAt: stamp, replacesMediaAssetId: null };
    const contentPath = `/v1/patient-media/${uploadAssetId}/content`;
    mediaWrites.push({ ...entry, body: { byteSize: uploadIntent.byteSize, mimeType: uploadIntent.mimeType, checksum: uploadIntent.checksum } });
    return json({ uploadIntent: { media: clone(uploadIntent), uploadUrl: apiBase + contentPath, uploadHeaders: { 'content-type': uploadIntent.mimeType }, expiresInSeconds: 300 } }, 201);
  }
  if (method === 'PUT' && target.pathname === `/v1/patient-media/${uploadAssetId}/content`) {
    const uploaded = Buffer.from(init.body);
    if (uploaded.length !== uploadIntent?.byteSize || checksum(uploaded) !== uploadIntent?.checksum || headers.get('content-type') !== uploadIntent?.mimeType) return json({ code: 'invalid_upload' }, 422);
    mediaWrites.push({ ...entry, body: { binaryBytes: uploaded.length, checksum: checksum(uploaded), mimeType: headers.get('content-type') } });
    return new Response(null, { status: 204 });
  }
  if (method === 'POST' && target.pathname === `/v1/patient-media/${uploadAssetId}/finalise`) {
    mediaItem = { ...uploadIntent, status: 'active', checksum: uploadIntent.checksum, rowVersion: 1 };
    writeEffects++;
    mediaWrites.push({ ...entry, body: { finalised: true } });
    return json({ media: clone(mediaItem) });
  }
  if (method === 'POST' && target.pathname === `/v1/patient-media/${uploadAssetId}/view`) {
    const uploaded = Buffer.from(mediaItem?.byteSize ? bytes : bytes);
    return new Response(uploaded, { status: 200, headers: { 'content-type': 'image/png', 'content-length': String(uploaded.length) } });
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
  const keys = generateKeyPairSync('ed25519'), keyId = 'test-only-m17-patient-record';
  const trust = { keys: { [keyId]: { publisher: 'company', publicKey: keys.publicKey.export({ type: 'spki', format: 'pem' }).toString() } }, apps: { [appId]: { publisher: 'company', capabilities: manifest.capabilities } } };
  const packageBytes = buildPackage(manifest, collect(path.join(source, 'dist')), keyId, keys.privateKey), pkg = verifyPackage(packageBytes, trust), digest = sha256(packageBytes), timestamp = Date.now();
  const stamp = { environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: timestamp, expiresAt: timestamp + 3_600_000 };
  const grants = manifest.capabilities.filter(capability => apiOperations.includes(capability));
  const grant = { version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, apiOperations: grants };
  const catalogue = { format: 1, ...stamp, releases: [{ id: appId, title: 'Patient Record', description: 'Private synthetic fixture', version: manifest.version, notes: 'Test only', capabilities: manifest.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${appId}/${manifest.version}/${digest}.dentalpkg`, packageSha256: digest, packageBytes: packageBytes.length, payloadDigest: pkg.release.digest, status: 'approved', minimumVersion: '1.0.0' }] };
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
  registry.install(packageBytes);
  win = new BrowserWindow({ width: 1440, height: 1000, show: true, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } });
  await win.loadURL('data:text/html,<title>Private M17 Patient Record host</title>');
  const identity = {
    allowed: () => true,
    allowedClinicRequest: (id, route, method) => clinicRequestAllowed(id, 'admin', capabilities, route, method),
    allowedMediaRead: (id, kind) => id === family && kind === 'patient_media' && capabilities.includes('clinic.media.read'),
    allowedMediaUpload: (id, kind) => id === family && kind === 'patient_media' && capabilities.includes('clinic.media.upload'),
    snapshot: () => ({ generation: 1, active: true, userLabel: 'Synthetic user', clinicLabel: 'Synthetic clinic', clinicSession: {
      clinicUser: { clinicUserId: '66666666-6666-4666-8666-666666666666', displayName: 'Synthetic user', role: 'admin', capabilities: [...capabilities] },
      clinic: { tenantId: '77777777-7777-4777-8777-777777777777', displayName: 'Synthetic clinic', timezone: 'Asia/Kathmandu', currency: 'NPR', defaultBranchId: '88888888-8888-4888-8888-888888888888', hasActiveTrial: false },
      branches: [{ branchId: '88888888-8888-4888-8888-888888888888', branchCode: 'SYN', name: 'Synthetic branch' }],
    } }),
    credential: async () => 'synthetic-m17-host-only',
  };
  runtime = new FixtureRuntime(win, registry, path.join(root, 'dist-electron/runtime/appPreload.js'), identity, () => {}, { transport: 'staging' });
  for (const kind of ['connect', 'request', 'cancel']) ipcMain.handle(`sdk:${kind}`, (event, input) => runtime.sdk(kind, event, input));
  ipcMain.handle('runtime:app-info', event => runtime.appInfo(event));
  ipcMain.handle('runtime:open-explorer', event => runtime.openExplorer(event));
  ipcMain.on('runtime:report', (event, value) => runtime.report(event, value));
  ipcMain.on('runtime:navigation-report', (event, value) => runtime.navigationReport(event, value));
  ipcMain.on('runtime:module-selection-ack', (event, value) => runtime.acknowledgeModule(event, value));
  global.m17PatientRecord = {
    calls, mediaWrites, getEffects: () => writeEffects, getPackage: () => ({ appId, version: manifest.version, packageSha256: digest, payloadDigest: pkg.release.digest, wireBytes: packageBytes.length, assetCount: pkg.files.size, grants }),
    setCapabilities: values => { capabilities.splice(0, capabilities.length, ...values); },
    selectModule: async () => runtime.selectModule(appId, 'patient-record'),
    navigate: (direction, discardDirty = false) => runtime.navigate(appId, direction, discardDirty),
    navigation: () => runtime.entries.get(appId)?.state.navigation ?? null,
    snapshot: () => ({ patient: clone(patient), media: clone(mediaItem), profileAttempts, writeEffects }),
  };
  runtime.sync([{ id: appId, open: true, visible: true, rect: { x: 0, y: 0, width: win.getContentSize()[0], height: win.getContentSize()[1] } }]);
}).catch(error => { global.__m17PatientRecordDiagnostic = error instanceof Error ? error.stack : String(error); console.error('M17 PATIENT RECORD PRIVATE HOST FAILED', global.__m17PatientRecordDiagnostic); });
app.on('before-quit', () => runtime?.dispose());
app.on('window-all-closed', () => app.quit());
