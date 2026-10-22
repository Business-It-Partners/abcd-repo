// Bounded synthetic staging acceptance for the remaining M15 upload failures.
// Never prints credentials or response bodies. Private app grants are local-only.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [guard, credentialFile, signerFile, seedJournalFile, outputInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-media-failures-only' || !credentialFile || !signerFile || !seedJournalFile || !outputInput || process.argv.length !== 7) {
  throw Error('Synthetic staging failure mode, protected Clinic A credentials/signer/seed journal and a new private output directory are required');
}

const require = createRequire(import.meta.url), output = path.resolve(outputInput);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { ApiBroker } = require('../dist-electron/sdk/broker.js');
const { SDK } = require('../dist-electron/sdk/contracts.js');
const { staging } = require('../dist-electron/sdk/environment.js');
const { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const { appAllowed, clinicApps, clinicRequestAllowed } = require('../dist-electron/sdk/appPolicy.js');
const { mediaKindForApp } = require('../dist-electron/sdk/mediaRead.js');
const { uploadKindForApp } = require('../dist-electron/sdk/mediaUpload.js');
const { buildPackage, verifyPackage, canonical, sha256 } = require('../dist-electron/packages/format.js');
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { verifyUpdatePolicy, allowUpdatedPackage, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../dist-electron/distribution/updatePolicy.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');

const expectedApi = 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev';
if (staging.environment !== 'cloudfare-staging' || staging.apiBase !== expectedApi || staging.firebaseProject !== 'dental-managemetn-staging') throw Error('Staging configuration fence');
const protectedJSON = file => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077)) throw Error('Protected regular file required');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const seed = protectedJSON(seedJournalFile);
if (seed.environment !== 'cloudfare-staging' || !/^dental-os-m15-[a-f0-9]{12}$/.test(seed.marker)
  || !/^[0-9a-f-]{36}$/i.test(seed.createdRecords?.patientId ?? '') || !/^[0-9a-f-]{36}$/i.test(seed.createdRecords?.staffId ?? '')) {
  throw Error('Existing Clinic A synthetic seed journal is invalid');
}
const patientId = seed.createdRecords.patientId, staffId = seed.createdRecords.staffId;
const date = /^\d{4}-\d{2}-\d{2}$/.test(seed.date) ? seed.date : new Date(Date.now() + 5.75 * 3600000).toISOString().slice(0, 10);
if (fs.existsSync(output)) throw Error('Output directory must be new; refusing to overwrite prior evidence');
fs.mkdirSync(output, { mode: 0o700 });
if ((fs.lstatSync(output).mode & 0o077) !== 0) throw Error('Private output directory required');

const marker = 'dental-os-m15-' + randomBytes(6).toString('hex');
const report = {
  date: new Date(Date.now() + 5.75 * 3600000).toISOString().slice(0, 10),
  environment: 'cloudfare-staging',
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  marker,
  checks: [],
  mismatchCases: [],
  requestTrace: [],
  productionRequests: false,
  publicAppGrantPublished: false,
  storedBytesCleanupPending: true,
};
const check = (name, passed, details = {}) => {
  report.checks.push({ name, passed: !!passed, ...details });
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
};
const sha = value => createHash('sha256').update(value).digest('hex');
const operationKey = value => sha(marker + ':' + value);
const stageKey = (value, stage) => sha(JSON.stringify([value, stage]));
const safePath = value => value.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/ig, ':id');
let credential, auth, tokens, clinic, broker, registry, sessionGeneration = 1, sessionActive = true;
let credentialsRequested = 0, appCallNumber = 0, phase = 'configuration', tamperMode = null, revokeContentResponse = false;
let revokePutReached, activeScenario = '', raceAssetId = '', raceOriginalKey = '', revokedAssetId = '', raceCleanupCompleted = false;
const appClients = new Map(), packageLeases = [], scenarioAssetIds = new Map();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\n2 0 obj<< /Length 0 >>stream\nendstream endobj\ntrailer<<>>\n%%EOF\n', 'utf8');
const rawFeed = async () => {
  const values = {};
  for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) {
    const response = await fetch(new URL(name, stagingDistribution.publicBase), { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Public staging control read failed');
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 65536) throw Error('Public staging control response bound');
    values[name] = sha(bytes);
  }
  return values;
};
const api = async (method, requestPath, body, key) => {
  if (!requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%') || !tokens?.idToken) throw Error('Staging API fence');
  const url = new URL(requestPath, staging.apiBase);
  if (url.origin !== expectedApi) throw Error('Staging API origin fence');
  const response = await fetch(url, {
    method,
    headers: { authorization: 'Bearer ' + tokens.idToken, accept: 'application/json', ...(key ? { 'idempotency-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20000),
  });
  if (response.status >= 300 && response.status < 400) throw Error('Staging redirect refused');
  let value = null;
  if (response.status !== 204) {
    const text = await response.text();
    if (text.length > 262144) throw Error('Staging response bound');
    try { value = JSON.parse(text); } catch { throw Error('Staging API returned invalid JSON'); }
  }
  const code = typeof value?.error?.code === 'string' && /^[a-z_]{1,80}$/.test(value.error.code) ? value.error.code : undefined;
  report.requestTrace.push({ phase, method, path: safePath(url.pathname), status: response.status, ...(code ? { code } : {}) });
  return { status: response.status, value };
};
const transport = async (url, init) => {
  const target = new URL(url);
  if (target.origin !== expectedApi) throw Error('Broker staging origin fence');
  let outgoing = init;
  const isContent = init.method === 'PUT' && target.pathname.endsWith('/content');
  const currentTamper = isContent ? tamperMode : null;
  if (currentTamper) {
    const headers = new Headers(init.headers);
    if (currentTamper === 'wrong-mime') headers.set('content-type', headers.get('content-type') === 'image/png' ? 'application/pdf' : 'image/png');
    if (currentTamper === 'wrong-checksum') {
      const bytes = Buffer.from(init.body);
      if (!bytes.length) throw Error('Synthetic checksum mutation requires bytes');
      bytes[0] ^= 0x01;
      outgoing = { ...init, headers, body: bytes };
    } else outgoing = { ...init, headers };
    tamperMode = null;
  }
  const response = await fetch(target, outgoing);
  let code;
  if (response.status !== 204) {
    try { const body = await response.clone().json(); if (/^[a-z_]{1,80}$/.test(body?.error?.code ?? '')) code = body.error.code; } catch { /* status and route are sufficient diagnostics */ }
  }
  report.requestTrace.push({ phase, method: init.method ?? 'GET', path: safePath(target.pathname), status: response.status, ...(currentTamper ? { injected: currentTamper } : {}), ...(code ? { code } : {}) });
  if (response.status === 201 && init.method === 'POST' && (target.pathname.endsWith('/upload-intents') || /\/documents$/.test(target.pathname))) {
    const value = await response.clone().json();
    const uploadIntent = value?.uploadIntent;
    const item = uploadIntent?.media ?? uploadIntent?.document;
    const id = item?.mediaAssetId ?? item?.staffDocumentId;
    if (/^[0-9a-f-]{36}$/i.test(id ?? '')) scenarioAssetIds.set(activeScenario, id);
  }
  if (revokeContentResponse && isContent && response.status === 204) {
    revokeContentResponse = false;
    revokePutReached?.(response.status);
    await new Promise(resolve => {
      const signal = init.signal;
      if (!signal || signal.aborted) resolve();
      else signal.addEventListener('abort', resolve, { once: true });
    });
  }
  return response;
};
const request = (appId, operation, input) => {
  const client = appClients.get(appId);
  if (!client) throw Error('Private signed fixture is not registered');
  return broker.request(client.caller, {
    version: 1,
    connection: client.connection.connection,
    generation: sessionGeneration,
    requestId: 'm15-upload-failure-' + (++appCallNumber),
    operation,
    input,
  });
};
const appApi = (appId, method, requestPath, body, key) => request(appId, 'clinic.api.request', {
  method, path: requestPath, body: body === undefined ? null : JSON.stringify(body), idempotencyKey: method === 'GET' ? null : key,
});
const activeList = async (kind, recordId) => {
  const listPath = kind === 'patient_media' ? `/v1/patients/${recordId}/media` : `/v1/clinic/staff/${recordId}/documents`;
  const result = await api('GET', listPath);
  const rows = kind === 'patient_media' ? result.value?.media : result.value?.documents;
  if (result.status !== 200 || !Array.isArray(rows)) throw Error('Synthetic active-list query failed');
  return rows;
};
const uploadBytes = (kind, caseName) => kind === 'patient_media' ? PNG : PDF;
const metadata = (kind, caseName, bytes) => kind === 'patient_media' ? {
  displayFilename: `${marker}-${caseName}.png`, mimeType: 'image/png', byteSize: bytes.length,
  chiefComplaintId: null, xrayType: 'IOPA', toothCode: null, clinicalNote: 'Synthetic M15 failure acceptance only', capturedOn: date,
} : {
  displayFilename: `${marker}-${caseName}.pdf`, mimeType: 'application/pdf', byteSize: bytes.length,
  documentType: 'other', expiresOn: null,
};
const beginHostUpload = async (appId, kind, recordId, scenario) => {
  const bytes = uploadBytes(kind, scenario), key = operationKey(scenario);
  activeScenario = scenario;
  const begun = await request(appId, 'clinic.media.upload', { action: 'begin', kind, recordId, metadata: metadata(kind, scenario, bytes), idempotencyKey: key });
  if (!begun.ok) throw Error('Synthetic upload begin was refused');
  const chunked = await request(appId, 'clinic.media.upload', { action: 'chunk', transferId: begun.value.transferId, offset: 0, data: bytes.toString('base64') });
  if (!chunked.ok || chunked.value.received !== bytes.length) throw Error('Synthetic upload chunk was refused');
  return { bytes, key, transferId: begun.value.transferId };
};
const cancelHostUpload = async (appId, transferId, key) => request(appId, 'clinic.media.upload', { action: 'cancel', transferId, idempotencyKey: key });
const cleanupActiveRaceRecord = async () => {
  if (!raceAssetId || !tokens?.idToken) return;
  const active = (await activeList('patient_media', patientId)).some(row => row.mediaAssetId === raceAssetId && row.status === 'active');
  const result = active
    ? await api('POST', `/v1/patient-media/${raceAssetId}/withdraw`, { reason: 'Synthetic M15 receipt-race acceptance cleanup' }, operationKey('race-withdrawal'))
    : await api('POST', `/v1/patient-media/${raceAssetId}/abort`, undefined, stageKey(raceOriginalKey, 'abort'));
  const rows = await activeList('patient_media', patientId);
  raceCleanupCompleted = result.status === 204 && !rows.some(row => row.mediaAssetId === raceAssetId);
  check('SaaS cleanup removes only the synthetic receipt-race row from the active list', raceCleanupCompleted, { action: active ? 'withdraw' : 'abort' });
};
let feedBefore, feedAfter, failureReason;

try {
  phase = 'protected-local-inputs';
  credential = loadDevelopmentCredentials(credentialFile);
  if (!credential) throw Error('Protected staging credentials unavailable');
  const signerStat = fs.lstatSync(signerFile);
  if (!signerStat.isFile() || signerStat.isSymbolicLink() || (signerStat.mode & 0o077) || signerStat.size > 8192) throw Error('Protected pinned staging signer unavailable');
  const signer = createPrivateKey(fs.readFileSync(signerFile, 'utf8'));
  const keyId = 'company-staging-m08-20261016', now = Date.now(), packageDefs = [];

  phase = 'clinic-a-staging-sign-in';
  auth = new FirebaseClient();
  tokens = await auth.signIn(credential.email, credential.password, AbortSignal.timeout(20000));
  clinic = await auth.resolve(tokens.idToken, AbortSignal.timeout(20000));
  const oldTenantId = clinic.tenantId;
  const syntheticPatient = await api('GET', `/v1/patients/${patientId}/core`);
  const syntheticStaff = await api('GET', `/v1/clinic/staff/${staffId}`);
  const expectedPatientName = `Synthetic M15 patient ${seed.marker}`;
  const expectedStaffName = `Synthetic M15 staff ${seed.marker}`;
  check('Clinic A staging identity resolves and owns the existing labelled synthetic patient and staff records',
    clinic.role === 'admin' && clinic.capabilities.includes('patient_record.access') && clinic.capabilities.includes('staff.manage')
      && syntheticPatient.status === 200 && syntheticPatient.value?.patient?.fullName === expectedPatientName
      && syntheticStaff.status === 200 && syntheticStaff.value?.staff?.fullName === expectedStaffName);
  if (!report.checks.at(-1).passed) throw Error('The protected seed records do not match the supplied staging clinic');

  phase = 'public-control-read-before';
  feedBefore = await rawFeed();
  for (const appId of ['company.dental.patient-record', 'company.dental.staff']) {
    const caps = [clinicApps[appId].operation, 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
    const bytes = buildPackage({ appId, publisher: 'company', version: '0.0.15', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: caps }, new Map([['index.html', Buffer.from('<h1>Private M15 upload-failure probe</h1>')]]), keyId, signer);
    const verified = verifyPackage(bytes, stagingDistribution.policy);
    packageDefs.push({ appId, caps, bytes, verified });
  }
  const policy = { format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, revokedKeys: [], apps: packageDefs.map(p => ({ id: p.appId, capabilities: p.caps, minimumVersion: '0.0.15', revokedDigests: [], rollback: null, releases: [{ version: '0.0.15', packageSha256: sha(p.bytes), payloadDigest: p.verified.release.digest, apiOperations: ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'] }] })) };
  const catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, releases: packageDefs.map(p => ({ id: p.appId, title: 'Private synthetic M15 acceptance fixture', description: 'Not an app release or publication.', version: '0.0.15', notes: 'Local disposable acceptance profile only.', capabilities: p.caps, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${p.appId}/0.0.15/${sha(p.bytes)}.dentalpkg`, packageSha256: sha(p.bytes), packageBytes: p.bytes.length, payloadDigest: p.verified.release.digest, status: 'approved', minimumVersion: '0.0.15' })) };
  const envelope = (value, field, purpose) => Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), signer).toString('base64') }));
  const policyBytes = envelope(policy, 'policy', 'dental-os-update-policy'), catalogueBytes = envelope(catalogue, 'catalogue', 'dental-os-catalogue');
  const verifiedPolicy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy;
  const verifiedCatalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  registry = new PackageRegistry(path.join(output, 'profile', 'packages'), stagingDistribution.policy);
  registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const grant = apiReleaseGrantForPackage(value, verifiedPolicy);
    return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });
  const identity = {
    snapshot: () => ({ generation: sessionGeneration, active: sessionActive, userLabel: sessionActive ? 'Clinic A staging acceptance' : '', clinicLabel: sessionActive ? 'Clinic A staging' : '' }),
    allowed: operation => !operation.startsWith('clinic.app.') || !!clinic && Object.entries(clinicApps).some(([appId, value]) => value.operation === operation && appAllowed(appId, clinic.role, clinic.capabilities)),
    allowedClinicRequest: (appId, requestPath, method) => !!clinic && clinicRequestAllowed(appId, clinic.role, clinic.capabilities, requestPath, method),
    allowedMediaRead: (appId, kind) => !!clinic && mediaKindForApp(appId) === kind && appAllowed(appId, clinic.role, clinic.capabilities),
    allowedMediaUpload: (appId, kind) => !!clinic && uploadKindForApp(appId) === kind && appAllowed(appId, clinic.role, clinic.capabilities),
    credential: async () => { credentialsRequested++; if (!sessionActive || !tokens?.idToken) throw Error('No active Clinic A staging session'); return tokens.idToken; },
  };
  broker = new ApiBroker(staging, identity, transport);
  for (const p of packageDefs) {
    registry.install(p.bytes);
    const lease = registry.launch(p.appId); packageLeases.push(lease);
    const caller = { sender: {}, frame: {}, url: `dental-fixture://private-m15/${p.appId.split('.').at(-1)}/index.html` };
    broker.register({ sender: caller.sender, frame: caller.frame, origin: caller.url, appId: p.appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities],
      authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } },
      authorizeApiOperation: operation => registry.authorizeApiOperation(lease, operation), report() {} });
    const connected = broker.connect(caller, SDK);
    check(`local exact signed release grant authorizes the private ${p.appId.split('.').at(-1)} upload probe`, connected.ok && connected.value.capabilities.includes('clinic.media.upload'));
    if (!connected.ok) throw Error('Private signed upload profile did not connect');
    appClients.set(p.appId, { caller, connection: connected.value });
  }
  report.signedApps = packageDefs.map(p => ({ appId: p.appId, packageSha256: sha(p.bytes), payloadDigest: p.verified.release.digest, published: false }));
  check('private signed packages and exact format-2 grants exist only in the isolated local profile', packageDefs.length === 2 && packageDefs.every(p => registry.inspect().apps[p.appId]));

  for (const [kind, appId, recordId, mismatch] of [
    ['patient_media', 'company.dental.patient-record', patientId, 'wrong-mime'],
    ['patient_media', 'company.dental.patient-record', patientId, 'wrong-checksum'],
    ['staff_document', 'company.dental.staff', staffId, 'wrong-mime'],
    ['staff_document', 'company.dental.staff', staffId, 'wrong-checksum'],
  ]) {
    const label = `${kind}-${mismatch}`;
    phase = label;
    const before = report.requestTrace.length;
    const transfer = await beginHostUpload(appId, kind, recordId, label);
    tamperMode = mismatch;
    const result = await request(appId, 'clinic.media.upload', { action: 'commit', transferId: transfer.transferId, idempotencyKey: transfer.key });
    const id = scenarioAssetIds.get(label);
    const contentRequests = report.requestTrace.slice(before).filter(event => event.method === 'PUT' && event.path.endsWith('/content'));
    const finaliseRequests = report.requestTrace.slice(before).filter(event => event.method === 'POST' && event.path.endsWith('/finalise'));
    check(`${kind} ${mismatch} reaches the real staging Worker and is rejected with HTTP 422`, contentRequests.length === 1 && contentRequests[0].status === 422 && contentRequests[0].code === (kind === 'patient_media' ? 'invalid_patient_media' : 'invalid_staff_document'));
    check(`${kind} ${mismatch} does not dispatch finalisation and leaves the app result unknown`, finaliseRequests.length === 0 && !result.ok && result.error.code === 'UNKNOWN_OUTCOME' && result.error.outcome === 'unknown');
    const cancelled = await cancelHostUpload(appId, transfer.transferId, transfer.key);
    check(`${kind} ${mismatch} pending intent is resolved through the existing SaaS abort action`, cancelled.ok && cancelled.value.cancelled === true && cancelled.value.committed === false);
    if (!id) throw Error('Staging Worker did not return the bounded synthetic upload identity');
    const rows = await activeList(kind, recordId);
    const idField = kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId';
    const noActive = !rows.some(row => row?.[idField] === id);
    check(`${kind} ${mismatch} rejected bytes never appear in the active media list`, noActive);
    report.mismatchCases.push({ kind, mismatch, syntheticBytes: transfer.bytes.length, declaredMimeType: kind === 'patient_media' ? 'image/png' : 'application/pdf', workerHttpStatus: contentRequests[0]?.status ?? null, workerErrorCode: contentRequests[0]?.code ?? null, hostOutcome: result.ok ? 'success-unexpected' : result.error.code, finaliseDispatched: finaliseRequests.length > 0, saasAbortConfirmed: cancelled.ok && cancelled.value.cancelled === true, absentFromActiveList: noActive });
  }

  phase = 'real-server-receipt-race';
  const raceBytes = PNG, raceChecksum = sha(raceBytes); raceOriginalKey = operationKey('real-server-receipt-race');
  const raceIntentBody = { patientId, chiefComplaintId: null, assetType: 'xray', xrayType: 'IOPA', toothCode: null, clinicalNote: 'Synthetic M15 real Worker receipt-race case', capturedOn: date,
    displayFilename: `${marker}-receipt-race.png`, mimeType: 'image/png', byteSize: raceBytes.length, checksum: raceChecksum };
  const created = await api('POST', '/v1/patient-media/upload-intents', raceIntentBody, stageKey(raceOriginalKey, 'intent'));
  raceAssetId = created.value?.uploadIntent?.media?.mediaAssetId;
  const intent = created.value?.uploadIntent;
  const expectedContentPath = `/v1/patient-media/${raceAssetId}/content`;
  const safeIntent = created.status === 201 && /^[0-9a-f-]{36}$/i.test(raceAssetId ?? '') && intent?.uploadUrl === expectedApi + expectedContentPath
    && Object.keys(intent.uploadHeaders ?? {}).join() === 'content-type' && intent.uploadHeaders['content-type'] === 'image/png'
    && intent.media?.status === 'pending' && intent.media?.checksum === raceChecksum && intent.media?.byteSize === raceBytes.length;
  check('real Worker allocates one owner-scoped synthetic receipt-race intent with the declared SHA-256', safeIntent, { byteSize: raceBytes.length, mimeType: 'image/png', checksum: raceChecksum });
  if (!safeIntent) throw Error('Real staging Worker did not return the expected synthetic receipt-race intent');
  const contentResponse = await fetch(intent.uploadUrl, { method: 'PUT', headers: { authorization: 'Bearer ' + tokens.idToken, ...intent.uploadHeaders }, body: raceBytes, redirect: 'manual', cache: 'no-store', credentials: 'omit', signal: AbortSignal.timeout(20000) });
  report.requestTrace.push({ phase, method: 'PUT', path: '/v1/patient-media/:id/content', status: contentResponse.status });
  check('receipt-race control bytes are accepted by the real staging Worker before finalisation', contentResponse.status === 204);
  if (contentResponse.status !== 204) throw Error('Real staging content PUT failed before receipt-race');
  const raceKey = stageKey(raceOriginalKey, 'finalise'), raceStart = Date.now();
  const raced = await Promise.all([
    api('POST', `/v1/patient-media/${raceAssetId}/finalise`, undefined, raceKey),
    api('POST', `/v1/patient-media/${raceAssetId}/finalise`, undefined, raceKey),
  ]);
  const success = raced.find(item => item.status === 200);
  const raceStatusesValid = raced.length === 2 && !!success && raced.every(item => [200, 409].includes(item.status));
  check('two concurrent same-key finalise requests reach the real staging Worker/D1 receipt path', raceStatusesValid, { simultaneousRequests: 2, responseStatuses: raced.map(item => item.status), elapsedMs: Date.now() - raceStart });
  const replay = await api('POST', `/v1/patient-media/${raceAssetId}/finalise`, undefined, raceKey);
  check('post-race same-key replay returns the stored successful server receipt', replay.status === 200 && !!success && JSON.stringify(replay.value) === JSON.stringify(success.value));
  const raceRows = await activeList('patient_media', patientId);
  const activeRaceRows = raceRows.filter(row => row?.mediaAssetId === raceAssetId && row.status === 'active');
  check('the real receipt race leaves exactly one active media row and one row-version transition', activeRaceRows.length === 1 && activeRaceRows[0].rowVersion === 2 && activeRaceRows[0].checksum === raceChecksum && activeRaceRows[0].byteSize === raceBytes.length && activeRaceRows[0].mimeType === 'image/png');
  report.receiptRace = { environment: 'cloudfare-staging Worker/D1/R2', simultaneousRequests: 2, responseStatuses: raced.map(item => item.status), replayStatus: replay.status, replayMatchesSuccessfulResponse: !!success && JSON.stringify(replay.value) === JSON.stringify(success.value), activeRowsForSyntheticAsset: activeRaceRows.length, rowVersion: activeRaceRows[0]?.rowVersion ?? null, syntheticBytes: raceBytes.length, checksum: raceChecksum, elapsedMs: Date.now() - raceStart };
  await cleanupActiveRaceRecord();

  phase = 'revoke-session-during-live-content-put';
  activeScenario = 'patient_media-session-revocation';
  const revocationUpload = await beginHostUpload('company.dental.patient-record', 'patient_media', patientId, activeScenario);
  const reached = new Promise(resolve => { revokePutReached = resolve; });
  revokeContentResponse = true;
  const commitPromise = request('company.dental.patient-record', 'clinic.media.upload', { action: 'commit', transferId: revocationUpload.transferId, idempotencyKey: revocationUpload.key });
  let putBarrierTimer;
  const actualPutStatus = await Promise.race([reached, new Promise((_, reject) => { putBarrierTimer = setTimeout(() => reject(Error('Staging content PUT did not reach the session-revocation barrier')), 20000); })]).finally(() => clearTimeout(putBarrierTimer));
  revokedAssetId = scenarioAssetIds.get(activeScenario) ?? '';
  const oldTenantFingerprint = sha(oldTenantId);
  sessionActive = false; sessionGeneration++; tokens = undefined; clinic = undefined;
  broker.invalidateSession();
  const revokedResult = await commitPromise;
  const revokeEvents = report.requestTrace.filter(event => event.phase === phase);
  const finaliseAfterRevocation = revokeEvents.filter(event => event.method === 'POST' && event.path.endsWith('/finalise')).length;
  check('real content PUT completed at the Worker but local session revocation fences completion before finalise', actualPutStatus === 204 && revokedResult.ok === false && revokedResult.error.code === 'STALE_SESSION' && revokedResult.error.outcome === 'unknown' && finaliseAfterRevocation === 0 && !!revokedAssetId,
    { contentHttpStatus: actualPutStatus, brokerCode: revokedResult.ok ? 'unexpected-success' : revokedResult.error.code, outcome: revokedResult.ok ? 'success' : revokedResult.error.outcome, finaliseDispatched: finaliseAfterRevocation > 0 });

  phase = 'fresh-session-saas-owned-revocation-cleanup';
  tokens = await auth.signIn(credential.email, credential.password, AbortSignal.timeout(20000));
  clinic = await auth.resolve(tokens.idToken, AbortSignal.timeout(20000));
  const sameClinic = clinic.tenantId === oldTenantId && clinic.role === 'admin';
  check('fresh sign-in returns to the same authorized staging clinic for SaaS-owned cleanup', sameClinic);
  const beforeAbort = await activeList('patient_media', patientId);
  const revokedStillInactive = !beforeAbort.some(row => row.mediaAssetId === revokedAssetId);
  check('session-revoked upload is still absent from the active media list before cleanup', revokedStillInactive);
  const abortResult = await api('POST', `/v1/patient-media/${revokedAssetId}/abort`, undefined, stageKey(revocationUpload.key, 'abort'));
  const afterAbort = await activeList('patient_media', patientId);
  check('the SaaS abort route resolves the pending synthetic upload after session revocation', abortResult.status === 204 && !afterAbort.some(row => row.mediaAssetId === revokedAssetId));
  report.sessionRevocation = { localBrokerSessionRevokedDuringUpload: true, contentHttpStatus: actualPutStatus, brokerCode: revokedResult.ok ? 'unexpected-success' : revokedResult.error.code, outcome: revokedResult.ok ? 'success' : revokedResult.error.outcome, finaliseDispatched: finaliseAfterRevocation > 0, freshSignInSameClinic: sameClinic, activeBeforeSaasAbort: !revokedStillInactive, saasAbortHttpStatus: abortResult.status, absentAfterSaasAbort: !afterAbort.some(row => row.mediaAssetId === revokedAssetId), clinicFingerprint: oldTenantFingerprint };

  phase = 'public-control-read-after';
  feedAfter = await rawFeed();
  check('public staging catalogue and update-policy hashes remain unchanged; no grant was published', JSON.stringify(feedBefore) === JSON.stringify(feedAfter), { publicControlHashesUnchanged: JSON.stringify(feedBefore) === JSON.stringify(feedAfter) });
  report.publicControlHashesUnchanged = JSON.stringify(feedBefore) === JSON.stringify(feedAfter);
  report.privateSignedProfilePublished = false;
  report.productionRequests = false;
  report.storedBytesCleanupPending = true;
  report.scope = 'Clinic A existing synthetic patient/staff records only; four tiny signed-app host uploads deliberately mismatch MIME/checksum and receive real Worker 422 responses; one live content PUT is fenced by local session revocation; two concurrent same-key finalise requests and replay hit the staging Worker/D1/R2 receipt path. Existing SaaS abort/withdraw routes resolve synthetic test state. No production, Clinic B, public app grant, app withdrawal/deletion implementation, or external bucket-retention check.';
} catch (cause) {
  failureReason = cause;
  report.failure = { phase, name: cause?.name ?? 'Error', message: typeof cause?.message === 'string' && /^[A-Za-z0-9 ._:()/-]{1,180}$/.test(cause.message) ? cause.message : 'Staging verifier stopped on a bounded check.' };
  console.error(`Staging media failure acceptance stopped at ${phase}; credentials and response bodies withheld.`);
  if (report.failure.message) console.error('Fixture diagnostic: ' + report.failure.message);
} finally {
  try {
    if (raceAssetId && tokens?.idToken && !raceCleanupCompleted) await cleanupActiveRaceRecord();
  } catch { /* Preserve the primary result and leave SaaS-owned state discoverable. */ }
  broker?.dispose();
  for (const lease of packageLeases) lease.releaseLease();
  credential = undefined; tokens = undefined; clinic = undefined;
  report.sourceSha256 = sha(fs.readFileSync(new URL(import.meta.url)));
  report.passed = report.checks.length > 0 && report.checks.every(item => item.passed) && !failureReason;
  report.checksPassed = report.checks.filter(item => item.passed).length;
  report.checksFailed = report.checks.filter(item => !item.passed).length;
  report.finishedAt = new Date().toISOString();
  const reportFile = path.join(output, 'report.json');
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ phase, passed: report.passed, checksPassed: report.checksPassed, checksFailed: report.checksFailed, report: reportFile }));
}
if (failureReason || !report.passed) process.exitCode = 1;
