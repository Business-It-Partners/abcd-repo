// Prove active synthetic clinic-A media bytes are denied to clinic-B signed first-party apps.
// This verifier writes only labelled synthetic records/media in Cloudflare staging.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [guard, clinicACredentialFile, clinicBCredentialFile, signerFile, outputDirInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-active-media-isolation-only' || !clinicACredentialFile || !clinicBCredentialFile || !signerFile || !outputDirInput || process.argv.length !== 7) {
  throw Error('Explicit staging active-media isolation mode, two protected clinic accounts, pinned signer, and private report directory required');
}

const require = createRequire(import.meta.url);
const outputDir = path.resolve(outputDirInput);
const reportFile = path.join(outputDir, 'report.json');
const journalFile = path.join(outputDir, 'journal.json');
const {
  FirebaseClient,
} = require('../dist-electron/identity/client.js');
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
const {
  verifyUpdatePolicy,
  allowUpdatedPackage,
  apiOperationsForPackage,
  apiReleaseGrantForPackage,
  apiReleaseGrantMatchesCatalogue,
} = require('../dist-electron/distribution/updatePolicy.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');

if (staging.environment !== 'cloudfare-staging'
  || staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev'
  || staging.firebaseProject !== 'dental-managemetn-staging') {
  throw Error('Staging configuration fence');
}

const protectedFile = (file, maxBytes) => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0 || stat.size > maxBytes) throw Error('Protected input file required');
  return stat;
};
const credentialA = loadDevelopmentCredentials(clinicACredentialFile);
let credentialB;
if (clinicBCredentialFile === '-') {
  const email = process.env.DENTAL_OS_M15_CLINIC_B_EMAIL;
  const password = process.env.DENTAL_OS_M15_CLINIC_B_PASSWORD;
  delete process.env.DENTAL_OS_M15_CLINIC_B_EMAIL;
  delete process.env.DENTAL_OS_M15_CLINIC_B_PASSWORD;
  if (typeof email === 'string' && email.length >= 3 && email.length <= 254 && /^\S+@\S+\.\S+$/.test(email)
    && typeof password === 'string' && password.length >= 1 && password.length <= 1024 && !password.includes('\0')) {
    credentialB = { email, password };
  }
} else credentialB = loadDevelopmentCredentials(clinicBCredentialFile);
if (!credentialA || !credentialB) throw Error('Protected staging credentials unavailable');
protectedFile(signerFile, 8192);
const signingKeyId = 'company-staging-m08-20261016';

if (fs.existsSync(outputDir)) {
  const stat = fs.lstatSync(outputDir);
  if (!stat.isDirectory() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw Error('Private report directory required');
} else fs.mkdirSync(outputDir, { recursive: true, mode: 0o700 });
if (fs.existsSync(journalFile) || fs.existsSync(reportFile)) throw Error('Fresh private report directory required');

const hash = value => createHash('sha256').update(value).digest('hex');
const marker = 'dental-os-m15-' + randomBytes(6).toString('hex');
const date = new Date(Date.now() + 5.75 * 3600000).toISOString().slice(0, 10);
const journal = { environment: 'cloudfare-staging', marker, date, createdRecords: {}, assets: {}, cleanup: {} };
const saveJournal = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
saveJournal();

const entries = [];
const transportOutcomes = [];
const phaseState = { phase: 'staging-sign-in', activeIntent: undefined, cleanupFailures: [] };
const cleanupEvidence = {};
const check = (name, passed, details = {}) => {
  const row = { name, passed: !!passed, ...details };
  entries.push(row);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) throw Error('Acceptance check failed');
  return row;
};
const opKey = label => hash(`${marker}:${label}`);
const publicFeed = async () => {
  const controls = {};
  for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) {
    const response = await fetch(new URL(name, stagingDistribution.publicBase), {
      redirect: 'error', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw Error('Public staging control read failed');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 65536) throw Error('Public metadata bound');
    controls[name] = hash(Buffer.from(bytes));
  }
  return controls;
};
const api = async (token, method, requestPath, body, key) => {
  if (!['GET', 'POST'].includes(method) || !requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%') || !token) throw Error('Fixed staging API fence');
  const url = new URL(requestPath, staging.apiBase);
  if (url.origin !== staging.apiBase) throw Error('Staging origin fence');
  const response = await fetch(url, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      accept: 'application/json',
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
      ...(key ? { 'idempotency-key': key } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(30000),
  });
  if (response.redirected || response.status >= 300 && response.status < 400) throw Error('Staging redirect denied');
  let value;
  if (response.status !== 204) {
    const text = await response.text();
    if (text.length > 262144) throw Error('Response bound');
    try { value = JSON.parse(text); } catch { throw Error('Staging response was not JSON'); }
  }
  return { status: response.status, value };
};
const traceHash = files => Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))]));
const fingerprintFiles = [
  'tools/verify-staging-media-active-tenant-isolation.mjs',
  'electron/sdk/broker.ts', 'electron/sdk/appPolicy.ts', 'electron/sdk/clinicRoutes.ts', 'electron/sdk/mediaRead.ts', 'electron/sdk/mediaUpload.ts',
  'dist-electron/sdk/broker.js', 'dist-electron/sdk/appPolicy.js', 'dist-electron/sdk/clinicRoutes.js', 'dist-electron/sdk/mediaRead.js', 'dist-electron/sdk/mediaUpload.js',
];
const sourceSha256 = traceHash(fingerprintFiles);
const worktreeChangesPresent = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;

let auth, tokensA, tokensB, clinicA, clinicB, broker, registry, leases = [], tempRoot;
let activeClinic, activeTokens, sessionActive = true, sessionGeneration = 1;
const packages = [];
const clients = new Map();
let callNumber = 0;
const transport = async (url, init) => {
  const parsed = new URL(url);
  if (parsed.origin !== staging.apiBase || parsed.username || parsed.password || parsed.hash) throw Error('Broker staging origin fence');
  const response = await fetch(url, init);
  transportOutcomes.push({ phase: phaseState.phase, tenant: activeClinic?.tenantId === clinicA?.tenantId ? 'clinic-a' : activeClinic?.tenantId === clinicB?.tenantId ? 'clinic-b' : 'unknown', method: init.method, path: parsed.pathname, status: response.status });
  if (transportOutcomes.length > 120) transportOutcomes.shift();
  return response;
};
const connectApps = () => {
  for (const p of packages) {
    const client = clients.get(p.appId);
    const connected = broker.connect(client.caller, SDK);
    if (!connected.ok) throw Error('Private signed fixture did not connect');
    client.connection = connected.value;
    if (!connected.value.capabilities.includes('clinic.media.read') || !connected.value.capabilities.includes('clinic.media.upload')) throw Error('Signed app media capabilities missing');
  }
};
const request = (appId, operation, input) => {
  const client = clients.get(appId);
  if (!client?.connection) throw Error('Private fixture app is not connected to the active staging session');
  return broker.request(client.caller, {
    version: 1, connection: client.connection.connection, generation: sessionGeneration,
    requestId: 'active-isolation-' + (++callNumber), operation, input,
  });
};
const jsonRequest = (appId, method, requestPath, body, key) => request(appId, 'clinic.api.request', {
  method, path: requestPath, body: body === undefined ? null : JSON.stringify(body), idempotencyKey: method === 'GET' ? null : key,
});
const listPathFor = (kind, recordId) => kind === 'patient_media' ? `/v1/patients/${recordId}/media` : `/v1/clinic/staff/${recordId}/documents`;
const listItems = (kind, value) => value?.[kind === 'patient_media' ? 'media' : 'documents'];
const assetKey = kind => kind === 'patient_media' ? 'mediaAssetId' : 'staffDocumentId';
const ownerKey = kind => kind === 'patient_media' ? 'patientId' : 'staffId';
const readKindFromApp = kind => kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff';
const byteRoute = pathName => pathName.endsWith('/view') || pathName.endsWith('/download');
const activeAsset = async (kind, recordId, asset) => {
  const result = await api(tokensA.idToken, 'GET', listPathFor(kind, recordId));
  const items = listItems(kind, result.value);
  const matches = Array.isArray(items) ? items.filter(item => item?.[assetKey(kind)] === asset.assetId) : [];
  return {
    status: result.status,
    exactActive: result.status === 200 && matches.length === 1
      && matches[0]?.[ownerKey(kind)] === recordId
      && matches[0]?.status === 'active'
      && matches[0]?.displayFilename === asset.displayFilename
      && matches[0]?.mimeType === asset.mimeType
      && matches[0]?.byteSize === asset.bytes
      && matches[0]?.checksum === asset.sha256,
  };
};
const imageBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const tinyPdf = () => {
  const stream = 'BT /F1 10 Tf 12 70 Td (Synthetic M15 staff document) Tj ET';
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 220 90] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xrefOffset = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets.slice(1)) body += `${String(offset).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(body, 'utf8');
};
const upload = async (kind, appId, recordId, bytes, metadata, keyLabel) => {
  const key = opKey(keyLabel);
  const begun = await request(appId, 'clinic.media.upload', { action: 'begin', kind, recordId, metadata, idempotencyKey: key });
  if (!begun.ok) throw Error(`Clinic A ${kind} synthetic media begin failed`);
  const transferId = begun.value.transferId;
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    const chunk = bytes.subarray(offset, Math.min(offset + 8192, bytes.length));
    const result = await request(appId, 'clinic.media.upload', { action: 'chunk', transferId, offset, data: chunk.toString('base64') });
    if (!result.ok) throw Error(`Clinic A ${kind} synthetic media chunk failed`);
  }
  const result = await request(appId, 'clinic.media.upload', { action: 'commit', transferId, idempotencyKey: key });
  if (!result.ok || result.value?.committed !== true || !/^[0-9a-f-]{36}$/i.test(result.value?.assetId ?? '')) throw Error(`Clinic A ${kind} synthetic media commit did not confirm`);
  return { assetId: result.value.assetId, recordId, displayFilename: metadata.displayFilename, mimeType: metadata.mimeType, bytes: bytes.length, sha256: hash(bytes) };
};
const readByApp = async (kind, appId, asset) => request(appId, 'clinic.media.read', { kind, recordId: asset.recordId, assetId: asset.assetId });

const record = {
  date: new Date(Date.now() + 5.75 * 3600000).toISOString().slice(0, 10),
  environment: 'cloudfare-staging',
  passed: false,
  sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  worktreeChangesPresent,
  sourceSha256,
  checks: entries,
  signedApps: [],
  clinicBLoginSource: clinicBCredentialFile === '-' ? 'ephemeral in-memory input; not persisted' : 'protected local file',
  syntheticTargets: {},
  transportEvidence: {},
  saasCleanup: cleanupEvidence,
  firstPartyAppsExercised: ['company.dental.patient-record', 'company.dental.staff'],
  publicCatalogueAndPolicyUnchanged: false,
  activeSyntheticMediaWithdrawnThroughSaaS: false,
  physicalR2DeletionPerformed: false,
  storedBytesCleanupPending: true,
  existingRecordsModified: false,
  onlyNewSyntheticRecordsCreated: true,
  productionRequests: false,
  publicAppGrantPublished: false,
  scope: 'Only Clinic B signed-app reads of Clinic A synthetic media while each exact asset is confirmed active. Prior withdrawn-file, cross-clinic record-read, and upload-intent cases are not used as proof. Files are newly created, tiny synthetic PNG/PDFs; Clinic A positive reads establish active-byte controls; Clinic B reads run through ApiBroker and the live staging Worker. SaaS withdrawal is invoked for these synthetic media records after the read attempts; no R2 deletion is performed.',
};
const saveReport = () => fs.writeFileSync(reportFile, JSON.stringify(record, null, 2) + '\n', { mode: 0o600 });

try {
  const feedBefore = await publicFeed();
  phaseState.phase = 'staging-sign-in';
  auth = new FirebaseClient();
  tokensA = await auth.signIn(credentialA.email, credentialA.password, AbortSignal.timeout(20000));
  clinicA = await auth.resolve(tokensA.idToken, AbortSignal.timeout(20000));
  tokensB = await auth.signIn(credentialB.email, credentialB.password, AbortSignal.timeout(20000));
  clinicB = await auth.resolve(tokensB.idToken, AbortSignal.timeout(20000));
  check('Clinic A and Clinic B staging identities authenticate and resolve clinic authority', !!clinicA.tenantId && !!clinicB.tenantId);
  check('Clinic B resolves to a distinct staging clinic tenant', clinicA.tenantId !== clinicB.tenantId);
  check('Clinic B has authority for Patient Record media and Staff documents',
    appAllowed('company.dental.patient-record', clinicB.role, clinicB.capabilities)
      && appAllowed('company.dental.staff', clinicB.role, clinicB.capabilities));

  phaseState.phase = 'private-signed-fixture';
  const signer = createPrivateKey(fs.readFileSync(signerFile, 'utf8'));
  const now = Date.now();
  for (const name of ['patient-record', 'staff']) {
    const appId = 'company.dental.' + name;
    const capabilities = [clinicApps[appId].operation, 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
    const bytes = buildPackage({ appId, publisher: 'company', version: '0.0.15', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities },
      new Map([['index.html', Buffer.from('<h1>Private M15 active-media isolation fixture</h1>')]]), signingKeyId, signer);
    packages.push({ appId, capabilities, bytes, verified: verifyPackage(bytes, stagingDistribution.policy) });
  }
  const apiOperations = ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
  const policy = {
    format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1,
    issuedAt: now, expiresAt: now + 3600000, revokedKeys: [],
    apps: packages.map(p => ({
      id: p.appId, capabilities: p.capabilities, minimumVersion: '0.0.15', revokedDigests: [], rollback: null,
      releases: [{ version: '0.0.15', packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest, apiOperations }],
    })),
  };
  const catalogue = {
    format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1,
    issuedAt: now, expiresAt: now + 3600000,
    releases: packages.map(p => ({
      id: p.appId, title: 'Private M15 active-media isolation probe', description: 'Private synthetic acceptance only.',
      version: '0.0.15', notes: 'Local signed profile; no public release.', capabilities: p.capabilities,
      platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1,
      objectKey: `releases/${p.appId}/0.0.15/${sha256(p.bytes)}.dentalpkg`, packageSha256: sha256(p.bytes),
      packageBytes: p.bytes.length, payloadDigest: p.verified.release.digest, status: 'approved', minimumVersion: '0.0.15',
    })),
  };
  const envelope = (value, field, purpose) => Buffer.from(canonical({
    [field]: value, keyId: signingKeyId,
    signature: sign(null, Buffer.from(canonical({ purpose, keyId: signingKeyId, [field]: value })), signer).toString('base64'),
  }));
  const verifiedPolicy = verifyUpdatePolicy(envelope(policy, 'policy', 'dental-os-update-policy'), stagingDistribution.policy, noWatermark, now).policy;
  const verifiedCatalogue = verifyCatalogue(envelope(catalogue, 'catalogue', 'dental-os-catalogue'), stagingDistribution.policy, noWatermark, now).catalogue;
  record.signedApps = packages.map(p => ({
    appId: p.appId,
    packageSha256: sha256(p.bytes),
    payloadDigest: p.verified.release.digest,
    exactReleaseGrantOperations: apiOperations,
    freshPrivatePolicyAndCatalogueVerified: true,
  }));
  check('Patient Record and Staff fixtures verify under the pinned company staging signing key and fresh private exact-release grants', packages.length === 2);

  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'm15-active-media-isolation-'));
  registry = new PackageRegistry(path.join(tempRoot, 'profile/packages'), stagingDistribution.policy);
  registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const grant = apiReleaseGrantForPackage(value, verifiedPolicy);
    return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, verifiedCatalogue)
      ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });

  activeClinic = clinicA;
  activeTokens = tokensA;
  const identity = {
    snapshot: () => ({ generation: sessionGeneration, active: sessionActive, userLabel: sessionActive ? 'Private clinic A' : '', clinicLabel: sessionActive ? 'Private clinic A' : '' }),
    allowed: operation => !operation.startsWith('clinic.app.') || Object.entries(clinicApps).some(([appId, entry]) => entry.operation === operation && appAllowed(appId, activeClinic.role, activeClinic.capabilities)),
    allowedClinicRequest: (appId, requestPath, method) => clinicRequestAllowed(appId, activeClinic.role, activeClinic.capabilities, requestPath, method),
    allowedMediaRead: (appId, kind) => mediaKindForApp(appId) === kind && appAllowed(appId, activeClinic.role, activeClinic.capabilities),
    allowedMediaUpload: (appId, kind) => uploadKindForApp(appId) === kind && appAllowed(appId, activeClinic.role, activeClinic.capabilities),
    credential: async generation => generation === sessionGeneration && sessionActive && activeTokens?.idToken
      ? activeTokens.idToken : Promise.reject(new Error('No active staging clinic session')),
  };
  broker = new ApiBroker(staging, identity, transport);
  for (const p of packages) {
    registry.install(p.bytes);
    const lease = registry.launch(p.appId); leases.push(lease);
    const sender = {}, frame = {}, origin = `dental-fixture://active-isolation-${p.appId.split('.').at(-1)}/index.html`;
    const caller = { sender, frame, url: origin };
    broker.register({
      sender, frame, origin, appId: p.appId, appVersion: lease.manifest.version, capabilities: lease.capabilities,
      authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } },
      authorizeApiOperation: operation => registry.authorizeApiOperation(lease, operation),
      report() {},
    });
    clients.set(p.appId, { caller, connection: undefined });
  }
  connectApps();
  check('Clinic A private signed first-party apps connect with exact media grants', packages.every(p => clients.get(p.appId).connection.capabilities.includes('clinic.media.read')));

  phaseState.phase = 'clinic-a-synthetic-record-creation';
  const patientName = `Synthetic M15 patient ${marker}`;
  const staffName = `Synthetic M15 staff ${marker}`;
  const patientBody = { fullName: patientName, registeredOn: date, medicalProfile: {}, allergies: [] };
  const staffBody = { fullName: staffName, staffType: 'other', jobTitle: 'Synthetic active-media isolation check', phone: null, email: null, joinedOn: date, baseSalaryAmount: null, status: 'active' };
  const patientCreated = await jsonRequest('company.dental.patient-record', 'POST', '/v1/patient-intakes', patientBody, opKey('patient-record'));
  if (!patientCreated.ok || patientCreated.value.status !== 201 || patientCreated.value.body?.patient?.fullName !== patientName) throw Error('Synthetic patient creation did not confirm');
  const patientId = patientCreated.value.body.patient.patientId;
  journal.createdRecords.patientId = patientId; saveJournal();
  const staffCreated = await jsonRequest('company.dental.staff', 'POST', '/v1/clinic/staff', staffBody, opKey('staff-record'));
  if (!staffCreated.ok || staffCreated.value.status !== 201 || staffCreated.value.body?.staff?.fullName !== staffName) throw Error('Synthetic Staff creation did not confirm');
  const staffId = staffCreated.value.body.staff.staffId;
  journal.createdRecords.staffId = staffId; saveJournal();
  check('Clinic A creates only new marker-labelled synthetic patient and Staff records through signed first-party apps', !!patientId && !!staffId);

  phaseState.phase = 'clinic-a-synthetic-media-upload';
  const patientMetadata = {
    displayFilename: `${marker}-patient-image.png`, mimeType: 'image/png', byteSize: imageBytes.length,
    chiefComplaintId: null, xrayType: 'IOPA', toothCode: null,
    clinicalNote: 'Synthetic M15 active-media isolation check', capturedOn: date,
  };
  const staffBytes = tinyPdf();
  const staffMetadata = {
    displayFilename: `${marker}-staff-document.pdf`, mimeType: 'application/pdf', byteSize: staffBytes.length,
    documentType: 'other', expiresOn: null,
  };
  journal.assets.patient_media = await upload('patient_media', 'company.dental.patient-record', patientId, imageBytes, patientMetadata, 'patient-image-upload');
  saveJournal();
  journal.assets.staff_document = await upload('staff_document', 'company.dental.staff', staffId, staffBytes, staffMetadata, 'staff-document-upload');
  saveJournal();
  record.syntheticTargets = Object.fromEntries(Object.entries(journal.assets).map(([kind, asset]) => [kind, {
    mimeType: asset.mimeType, byteSize: asset.bytes, sha256: asset.sha256,
  }]));
  check('Clinic A uploads a tiny synthetic PNG image and PDF staff document through signed first-party apps', journal.assets.patient_media.bytes === imageBytes.length && journal.assets.staff_document.bytes === staffBytes.length);

  phaseState.phase = 'clinic-a-positive-read-controls';
  for (const kind of ['patient_media', 'staff_document']) {
    const asset = journal.assets[kind];
    const read = await readByApp(kind, readKindFromApp(kind), asset);
    const positiveControlPassed = read.ok && read.value.body?.byteLength === asset.bytes && hash(read.value.body) === asset.sha256;
    check(`Clinic A positive control reads its active synthetic ${kind} through ApiBroker`, positiveControlPassed, {
      bytesReturned: read.ok ? read.value.body?.byteLength ?? 0 : 0,
      sha256Matched: !!positiveControlPassed,
      sha256: asset.sha256,
    });
    const active = await activeAsset(kind, asset.recordId, asset);
    check(`Clinic A confirms the exact synthetic ${kind} asset is active before Clinic B attempts access`, active.exactActive, { activeListStatus: active.status, status: active.exactActive ? 'active' : 'unconfirmed' });
  }

  phaseState.phase = 'clinic-b-signed-app-read-attempts';
  activeClinic = clinicB;
  activeTokens = tokensB;
  sessionGeneration++;
  broker.invalidateSession();
  connectApps();
  check('Clinic B private signed first-party Patient Record and Staff apps are admitted with media-read authority', packages.every(p => clients.get(p.appId).connection.capabilities.includes('clinic.media.read')));

  for (const kind of ['patient_media', 'staff_document']) {
    const appId = readKindFromApp(kind), asset = journal.assets[kind];
    const before = await activeAsset(kind, asset.recordId, asset);
    check(`Clinic A ${kind} target is confirmed active immediately before Clinic B read`, before.exactActive, { activeListStatus: before.status, status: before.exactActive ? 'active' : 'unconfirmed' });
    const beforeTrace = transportOutcomes.length;
    phaseState.phase = kind === 'patient_media' ? 'clinic-b-active-patient-image-read' : 'clinic-b-active-staff-document-read';
    const result = await readByApp(kind, appId, asset);
    const trace = transportOutcomes.slice(beforeTrace).filter(item => item.tenant === 'clinic-b');
    const metadataRoute = listPathFor(kind, asset.recordId);
    const metadataStatuses = trace.filter(item => item.method === 'GET' && item.path === metadataRoute).map(item => item.status);
    const binaryRequests = trace.filter(item => byteRoute(item.path));
    const returnedBytes = result.ok ? result.value.body?.byteLength : 0;
    const denied = !result.ok && result.error.code === 'ACCESS_DENIED' && metadataStatuses.length > 0 && !binaryRequests.length && returnedBytes === 0;
    const status = metadataStatuses.at(-1) ?? null;
    record.transportEvidence[kind] = {
      metadataRoute,
      metadataRequestStatuses: metadataStatuses,
      binaryRouteAttempts: binaryRequests.map(item => ({ method: item.method, path: item.path, status: item.status })),
      brokerError: result.ok ? null : result.error.code,
      metadataHttpStatus: status,
      binaryRequestDispatched: binaryRequests.length > 0,
      bytesReturnedToClinicBApp: returnedBytes ?? 0,
    };
    check(`Clinic B signed ${kind === 'patient_media' ? 'Patient Record app is denied the active synthetic patient image' : 'Staff app is denied the active synthetic Staff document'} through ApiBroker`, denied, {
      brokerError: result.ok ? null : result.error.code,
      metadataHttpStatus: status,
      binaryRequestDispatched: binaryRequests.length > 0,
      bytesReturnedToClinicBApp: returnedBytes ?? 0,
    });
    const after = await activeAsset(kind, asset.recordId, asset);
    check(`Clinic A synthetic ${kind} remains active across Clinic B denial`, after.exactActive, { activeListStatus: after.status, status: after.exactActive ? 'active' : 'unconfirmed' });
  }

  const feedAfter = await publicFeed();
  record.publicCatalogueAndPolicyUnchanged = JSON.stringify(feedBefore) === JSON.stringify(feedAfter);
  check('Private active-file isolation probe leaves public catalogue and update policy unchanged', record.publicCatalogueAndPolicyUnchanged);
} catch (error) {
  const safeError = error?.message === 'Acceptance check failed'
    ? 'Assertion failed'
    : typeof error?.message === 'string' && /^[A-Za-z0-9 ._:/()-]{1,160}$/.test(error.message)
      ? error.message : 'Active-media staging verification failed';
  record.passed = false;
  record.phase = phaseState.phase;
  record.safeError = safeError;
  record.productionRequests = false;
  console.error(`Active-media staging verification stopped during ${phaseState.phase}; credentials and API payloads withheld.`);
  console.error(JSON.stringify({ passed: false, checksPassed: entries.filter(item => item.passed).length, checksFailed: entries.filter(item => !item.passed).length, safeError }));
  process.exitCode = 1;
} finally {
  phaseState.phase = 'saas-owned-synthetic-media-cleanup';
  if (tokensA?.idToken) {
    for (const [kind, asset] of Object.entries(journal.assets)) {
      if (!asset?.assetId || !asset?.recordId) continue;
      const route = kind === 'patient_media'
        ? `/v1/patient-media/${asset.assetId}/withdraw`
        : `/v1/clinic/staff/${asset.recordId}/documents/${asset.assetId}/withdraw`;
      let withdrawalStatus = null;
      try {
        const result = await api(tokensA.idToken, 'POST', route, { reason: 'Synthetic Dental OS M15 active-media isolation acceptance cleanup' }, opKey(`withdraw-${kind}`));
        withdrawalStatus = result.status;
        if (![204, 409].includes(result.status)) throw Error('SaaS withdrawal refused');
        const after = await api(tokensA.idToken, 'GET', listPathFor(kind, asset.recordId));
        const items = listItems(kind, after.value);
        const absent = after.status === 200 && Array.isArray(items) && !items.some(item => item?.[assetKey(kind)] === asset.assetId);
        if (!absent) throw Error('Withdrawn synthetic asset remains active');
        journal.assets[kind].withdrawn = true;
        cleanupEvidence[kind] = { withdrawalHttpStatus: withdrawalStatus, absentFromActiveList: true, physicalR2DeletionPerformed: false };
      } catch {
        cleanupEvidence[kind] = { withdrawalHttpStatus, absentFromActiveList: false, physicalR2DeletionPerformed: false };
        phaseState.cleanupFailures.push(kind);
      }
    }
  }
  journal.cleanup = {
    completed: Object.keys(journal.assets).length === 2 && Object.values(journal.assets).every(asset => asset.withdrawn === true),
    patientImageWithdrawnThroughSaaS: journal.assets.patient_media?.withdrawn === true,
    staffDocumentWithdrawnThroughSaaS: journal.assets.staff_document?.withdrawn === true,
    physicalR2DeletionPerformed: false,
    storedBytesCleanupPending: true,
  };
  record.activeSyntheticMediaWithdrawnThroughSaaS = journal.cleanup.completed;
  record.physicalR2DeletionPerformed = false;
  record.storedBytesCleanupPending = true;
  record.saasCleanup = cleanupEvidence;
  record.checks = entries;
  record.sourceHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  record.transportRequestCounts = {
    clinicAPositiveMediaReads: transportOutcomes.filter(item => item.tenant === 'clinic-a' && (item.path.endsWith('/view') || item.path.endsWith('/download'))).length,
    clinicBMediaReadAttempts: Object.keys(record.transportEvidence).length,
    productionRequests: false,
  };
  if (phaseState.cleanupFailures.length) {
    record.passed = false;
    record.cleanupFailureKinds = phaseState.cleanupFailures;
    process.exitCode = 1;
  } else if (!record.safeError && entries.length && entries.every(item => item.passed) && journal.cleanup.completed) record.passed = true;
  if (broker) broker.dispose();
  for (const lease of leases) lease.releaseLease();
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  credentialA.password = undefined; credentialB.password = undefined;
  tokensA = undefined; tokensB = undefined; activeTokens = undefined; clinicA = undefined; clinicB = undefined;
  saveJournal();
  saveReport();
  console.log(JSON.stringify({ passed: record.passed, checksPassed: entries.filter(item => item.passed).length, checksFailed: entries.filter(item => !item.passed).length, cleanupCompleted: journal.cleanup.completed, report: reportFile }));
}
