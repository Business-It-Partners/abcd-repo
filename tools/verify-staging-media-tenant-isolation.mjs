// Synthetic, staging-only cross-clinic media isolation acceptance. Never prints credentials or API payloads.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';

const [guard, clinicACredentialFile, clinicBCredentialFile, signerFile, journalDirInput, reportFileInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-media-tenant-isolation-only' || !clinicACredentialFile || !clinicBCredentialFile || !signerFile || !journalDirInput || !reportFileInput || process.argv.length !== 8) {
  throw Error('Explicit staging tenant-isolation mode, two protected clinic accounts, signer, synthetic journal, and report path required');
}
const require = createRequire(import.meta.url), journalDir = path.resolve(journalDirInput), reportFile = path.resolve(reportFileInput);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { ApiBroker } = require('../dist-electron/sdk/broker.js'), { SDK } = require('../dist-electron/sdk/contracts.js');
const { staging } = require('../dist-electron/sdk/environment.js'), { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const { appAllowed, clinicApps, clinicRequestAllowed } = require('../dist-electron/sdk/appPolicy.js');
const { mediaKindForApp } = require('../dist-electron/sdk/mediaRead.js');
const { uploadKindForApp } = require('../dist-electron/sdk/mediaUpload.js');
const { buildPackage, verifyPackage, canonical, sha256 } = require('../dist-electron/packages/format.js');
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { verifyUpdatePolicy, allowUpdatedPackage, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../dist-electron/distribution/updatePolicy.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');

if (staging.environment !== 'cloudfare-staging' || staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' || staging.firebaseProject !== 'dental-managemetn-staging') throw Error('Staging configuration fence');
const protectedJSON = file => {
  const stat = fs.lstatSync(file);
  if (!stat.isFile() || stat.isSymbolicLink() || (stat.mode & 0o077) !== 0) throw Error('Protected file required');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
};
const journal = protectedJSON(path.join(journalDir, 'journal.json'));
if (journal.environment !== 'cloudfare-staging' || !/^dental-os-m15-[a-f0-9]{12}$/.test(journal.marker)
  || !/^[0-9a-f-]{36}$/i.test(journal.patientId ?? '') || !/^[0-9a-f-]{36}$/i.test(journal.staffId ?? '')
  || !journal.assets?.patient_media?.withdrawn || !journal.assets?.staff_document?.withdrawn
  || !/^[0-9a-f-]{36}$/i.test(journal.assets.patient_media.assetId ?? '') || !/^[0-9a-f-]{36}$/i.test(journal.assets.staff_document.assetId ?? '')) {
  throw Error('Only the exact withdrawn synthetic M15 media fixture is eligible');
}
const credentialA = loadDevelopmentCredentials(clinicACredentialFile), credentialB = loadDevelopmentCredentials(clinicBCredentialFile);
if (!credentialA || !credentialB) throw Error('Protected staging credentials unavailable');
const signerStat = fs.lstatSync(signerFile);
if (!signerStat.isFile() || signerStat.isSymbolicLink() || (signerStat.mode & 0o077) !== 0 || signerStat.size > 8192) throw Error('Protected external staging signer required');

const entries = [], phaseState = { phase: 'staging-sign-in', privateIntentAsset: undefined, contentRequestBlocked: false, contentRequestForwarded: false };
let auth, tokensA, tokensB, clinicA, clinicB, broker, registry, leases = [], tempRoot, activeClinic;
const check = (name, passed, details = {}) => {
  const row = { name, passed: !!passed, ...details };
  entries.push(row);
  console.log(`${passed ? 'PASS' : 'FAIL'} ${name}`);
  if (!passed) throw Error('Acceptance check failed');
};
const hashLabel = value => createHash('sha256').update(value).digest('hex');
const opKey = name => hashLabel(`${journal.marker}:tenant-isolation:${name}`);
const fingerprintFiles = [
  'tools/verify-staging-media-tenant-isolation.mjs',
  'electron/sdk/broker.ts', 'electron/sdk/appPolicy.ts', 'electron/sdk/clinicRoutes.ts', 'electron/sdk/mediaRead.ts', 'electron/sdk/mediaUpload.ts',
  'dist-electron/sdk/broker.js', 'dist-electron/sdk/appPolicy.js', 'dist-electron/sdk/clinicRoutes.js', 'dist-electron/sdk/mediaRead.js', 'dist-electron/sdk/mediaUpload.js',
];
const sourceSha256 = Object.fromEntries(fingerprintFiles.map(file => [file, hashLabel(fs.readFileSync(file))]));
const worktreeChangesPresent = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length > 0;
const publicFeed = async () => {
  const hashes = {};
  for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) {
    const response = await fetch(new URL(name, stagingDistribution.publicBase), { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw Error('Public staging control read failed');
    const bytes = await response.arrayBuffer();
    if (bytes.byteLength > 65536) throw Error('Public metadata bound');
    hashes[name] = hashLabel(Buffer.from(bytes));
  }
  return hashes;
};
const directApi = async (token, method, requestPath, body) => {
  if (!requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%') || !token) throw Error('Fixed staging request fence');
  const url = new URL(requestPath, staging.apiBase);
  if (url.origin !== staging.apiBase) throw Error('Staging origin fence');
  const response = await fetch(url, {
    method,
    headers: { authorization: `Bearer ${token}`, accept: 'application/json', ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(method === 'GET' ? {} : { 'idempotency-key': opKey(`direct-${method}-${url.pathname}`) }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(20000),
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
const packages = [];
let callNumber = 0;
const clients = new Map();
const transport = async (url, init) => {
  const parsed = new URL(url);
  if (parsed.origin !== staging.apiBase) throw Error('Broker staging origin fence');
  // If a broken cross-tenant authorization unexpectedly creates an intent, stop before any file bytes leave this process.
  if (init.method === 'PUT' && parsed.pathname.endsWith('/content')) {
    phaseState.contentRequestBlocked = true;
    return new Response(JSON.stringify({ error: { code: 'm15_test_blocked_content' } }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  const response = await fetch(url, init);
  if (init.method === 'POST' && (parsed.pathname.endsWith('/upload-intents') || /^\/v1\/clinic\/staff\/[0-9a-f-]{36}\/documents$/i.test(parsed.pathname)) && response.status === 201) {
    const result = await response.clone().json().catch(() => null);
    phaseState.privateIntentAsset = result?.uploadIntent?.media?.mediaAssetId ?? result?.uploadIntent?.document?.staffDocumentId;
  }
  if (init.method === 'PUT' && parsed.pathname.endsWith('/content')) phaseState.contentRequestForwarded = true;
  return response;
};
const request = (appId, operation, input) => {
  const client = clients.get(appId);
  if (!client) throw Error('Private fixture app unavailable');
  return broker.request(client.caller, { version: 1, connection: client.connection.connection, generation: client.connection.generation, requestId: 'tenant-check-' + (++callNumber), operation, input });
};
const clinicGet = (appId, requestPath) => request(appId, 'clinic.api.request', { method: 'GET', path: requestPath, body: null, idempotencyKey: null });
const apiOutcome = result => result?.ok === true && Number.isInteger(result.value?.status) ? result.value.status : null;

try {
  const feedBefore = await publicFeed();
  phaseState.phase = 'staging-sign-in';
  auth = new FirebaseClient();
  tokensA = await auth.signIn(credentialA.email, credentialA.password, AbortSignal.timeout(20000));
  clinicA = await auth.resolve(tokensA.idToken, AbortSignal.timeout(20000));
  tokensB = await auth.signIn(credentialB.email, credentialB.password, AbortSignal.timeout(20000));
  clinicB = await auth.resolve(tokensB.idToken, AbortSignal.timeout(20000));
  check('both staging accounts authenticate and resolve clinic authority', !!clinicA.tenantId && !!clinicB.tenantId);
  check('second account resolves to a different clinic tenant', clinicA.tenantId !== clinicB.tenantId);
  check('second clinic has the capabilities needed to exercise both media app paths', appAllowed('company.dental.patient-record', clinicB.role, clinicB.capabilities) && appAllowed('company.dental.staff', clinicB.role, clinicB.capabilities));

  phaseState.phase = 'clinic-a-synthetic-record-ownership';
  const [patient, staff, patientMediaList, staffDocumentList] = await Promise.all([
    directApi(tokensA.idToken, 'GET', `/v1/patients/${journal.patientId}/core`),
    directApi(tokensA.idToken, 'GET', `/v1/clinic/staff/${journal.staffId}`),
    directApi(tokensA.idToken, 'GET', `/v1/patients/${journal.patientId}/media`),
    directApi(tokensA.idToken, 'GET', `/v1/clinic/staff/${journal.staffId}/documents`),
  ]);
  const patientOwnerOK = patient.status === 200 && patient.value?.patient?.fullName === `Synthetic M15 patient ${journal.marker}`;
  const staffOwnerOK = staff.status === 200 && staff.value?.staff?.fullName === `Synthetic M15 staff ${journal.marker}`;
  const patientItems = patientMediaList.value?.media, staffItems = staffDocumentList.value?.documents;
  const assetsAbsent = patientMediaList.status === 200 && Array.isArray(patientItems) && !patientItems.some(item => item?.mediaAssetId === journal.assets.patient_media.assetId)
    && staffDocumentList.status === 200 && Array.isArray(staffItems) && !staffItems.some(item => item?.staffDocumentId === journal.assets.staff_document.assetId);
  check('clinic A still owns the exact synthetic target records and test media is withdrawn from active lists', patientOwnerOK && staffOwnerOK && assetsAbsent);

  phaseState.phase = 'private-signed-fixture';
  const keyId = 'company-staging-m08-20261016', signer = createPrivateKey(fs.readFileSync(signerFile, 'utf8')), now = Date.now();
  for (const name of ['patient-record', 'staff']) {
    const appId = 'company.dental.' + name, family = clinicApps[appId].operation;
    const caps = [family, 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
    const bytes = buildPackage({ appId, publisher: 'company', version: '0.0.15', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: caps }, new Map([['index.html', Buffer.from('<h1>Private M15 tenant isolation probe</h1>')]]), keyId, signer);
    packages.push({ appId, caps, bytes, verified: verifyPackage(bytes, stagingDistribution.policy) });
  }
  const policy = { format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, revokedKeys: [], apps: packages.map(p => ({ id: p.appId, capabilities: p.caps, minimumVersion: '0.0.15', revokedDigests: [], rollback: null, releases: [{ version: '0.0.15', packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest, apiOperations: ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'] }] })) };
  const catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, releases: packages.map(p => ({ id: p.appId, title: 'Private M15 tenant isolation probe', description: 'Private synthetic acceptance only.', version: '0.0.15', notes: 'No public release.', capabilities: p.caps, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${p.appId}/0.0.15/${sha256(p.bytes)}.dentalpkg`, packageSha256: sha256(p.bytes), packageBytes: p.bytes.length, payloadDigest: p.verified.release.digest, status: 'approved', minimumVersion: '0.0.15' })) };
  const envelope = (value, field, purpose) => Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), signer).toString('base64') }));
  const verifiedPolicy = verifyUpdatePolicy(envelope(policy, 'policy', 'dental-os-update-policy'), stagingDistribution.policy, noWatermark, now).policy;
  const verifiedCatalogue = verifyCatalogue(envelope(catalogue, 'catalogue', 'dental-os-catalogue'), stagingDistribution.policy, noWatermark, now).catalogue;
  tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'm15-media-tenant-'));
  registry = new PackageRegistry(path.join(tempRoot, 'profile/packages'), stagingDistribution.policy);
  registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => {
    const grant = apiReleaseGrantForPackage(value, verifiedPolicy);
    return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : [];
  });

  activeClinic = clinicB;
  let sessionActive = true, sessionGeneration = 1;
  const identity = {
    snapshot: () => ({ generation: sessionGeneration, active: sessionActive, userLabel: sessionActive ? 'Private clinic B' : '', clinicLabel: sessionActive ? 'Private clinic B' : '' }),
    allowed: operation => !operation.startsWith('clinic.app.') || Object.entries(clinicApps).some(([appId, entry]) => entry.operation === operation && appAllowed(appId, activeClinic.role, activeClinic.capabilities)),
    allowedClinicRequest: (appId, requestPath, method) => clinicRequestAllowed(appId, activeClinic.role, activeClinic.capabilities, requestPath, method),
    allowedMediaRead: (appId, kind) => mediaKindForApp(appId) === kind && appAllowed(appId, activeClinic.role, activeClinic.capabilities),
    allowedMediaUpload: (appId, kind) => uploadKindForApp(appId) === kind && appAllowed(appId, activeClinic.role, activeClinic.capabilities),
    credential: async generation => generation === sessionGeneration && sessionActive ? tokensB.idToken : Promise.reject(new Error('No active clinic B session')),
  };
  broker = new ApiBroker(staging, identity, transport);
  for (const p of packages) {
    registry.install(p.bytes);
    const lease = registry.launch(p.appId); leases.push(lease);
    const sender = {}, frame = {}, origin = `dental-fixture://tenant-isolation-${p.appId.split('.').at(-1)}/index.html`, caller = { sender, frame, url: origin };
    broker.register({ sender, frame, origin, appId: p.appId, appVersion: lease.manifest.version, capabilities: lease.capabilities,
      authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } },
      authorizeApiOperation: operation => registry.authorizeApiOperation(lease, operation), report() {} });
    const connected = broker.connect(caller, SDK);
    if (!connected.ok) throw Error('Private signed fixture did not connect');
    clients.set(p.appId, { caller, connection: connected.value });
    check('clinic B private signed app is admitted through the host broker', connected.value.capabilities.includes('clinic.media.read') && connected.value.capabilities.includes('clinic.media.upload'));
  }

  phaseState.phase = 'clinic-b-cross-clinic-reads';
  for (const [label, appId, route, readKind, recordId, assetId] of [
    ['patient', 'company.dental.patient-record', `/v1/patients/${journal.patientId}/core`, 'patient_media', journal.patientId, journal.assets.patient_media.assetId],
    ['staff', 'company.dental.staff', `/v1/clinic/staff/${journal.staffId}`, 'staff_document', journal.staffId, journal.assets.staff_document.assetId],
  ]) {
    const before = phaseState.phase;
    const core = await clinicGet(appId, route);
    const coreStatus = apiOutcome(core), serialized = core?.ok ? JSON.stringify(core.value.body) : '';
    check(`clinic B cannot read clinic A ${label} record`, (coreStatus === 403 || coreStatus === 404) && !serialized.includes(journal.marker));
    const media = await request(appId, 'clinic.media.read', { kind: readKind, recordId, assetId });
    check(`clinic B media read broker refuses clinic A ${label} file`, media.ok === false && media.error.code === 'ACCESS_DENIED');
    if (before !== phaseState.phase) throw Error('Unexpected phase transition');
  }

  const mediaProbe = async (kind, appId, recordId) => {
    phaseState.privateIntentAsset = undefined;
    phaseState.contentRequestBlocked = false;
    phaseState.contentRequestForwarded = false;
    const bytes = new Uint8Array([0x4d]), date = new Date().toISOString().slice(0, 10), idempotencyKey = opKey(kind);
    const metadata = kind === 'patient_media'
      ? { displayFilename: 'tenant-isolation-synthetic.png', mimeType: 'image/png', byteSize: 1, chiefComplaintId: null, xrayType: 'IOPA', toothCode: null, clinicalNote: 'Synthetic tenant isolation check', capturedOn: date }
      : { displayFilename: 'tenant-isolation-synthetic.png', mimeType: 'image/png', byteSize: 1, documentType: 'other', expiresOn: null };
    const begun = await request(appId, 'clinic.media.upload', { action: 'begin', kind, recordId, metadata, idempotencyKey });
    if (!begun.ok) throw Error(`Host refused the authorized private ${kind} test probe`);
    const transferId = begun.value.transferId;
    const chunk = await request(appId, 'clinic.media.upload', { action: 'chunk', transferId, offset: 0, data: Buffer.from(bytes).toString('base64') });
    if (!chunk.ok) throw Error(`Host refused the synthetic ${kind} check byte`);
    const result = await request(appId, 'clinic.media.upload', { action: 'commit', transferId, idempotencyKey });
    const expectedDenied = result.ok === false && result.error.code === 'CONFLICT' && result.error.outcome === 'rejected' && !phaseState.privateIntentAsset;
    const noContentBytesSent = !phaseState.contentRequestForwarded && !phaseState.contentRequestBlocked;
    check(`clinic B ${kind} upload intent for clinic A record is rejected before any file bytes`, expectedDenied && noContentBytesSent, { denialCode: result.ok ? 'unexpected_success' : result.error.code, outcome: result.ok ? 'unexpected_success' : result.error.outcome, contentBytesForwarded: phaseState.contentRequestForwarded });
  };
  phaseState.phase = 'clinic-b-cross-clinic-upload-intents';
  await mediaProbe('patient_media', 'company.dental.patient-record', journal.patientId);
  await mediaProbe('staff_document', 'company.dental.staff', journal.staffId);

  phaseState.phase = 'public-control-check';
  const feedAfter = await publicFeed();
  check('private tenant-isolation probe leaves public catalogue and update policy unchanged', JSON.stringify(feedAfter) === JSON.stringify(feedBefore));
  const report = {
    date: new Date().toISOString().slice(0, 10), environment: 'cloudfare-staging', passed: true,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktreeChangesPresent, sourceSha256,
    checksPassed: entries.length, checks: entries,
    clinicAAndBResolveToDistinctTenants: true,
    firstPartyAppsExercised: ['company.dental.patient-record', 'company.dental.staff'],
    appCapabilityGatePresent: true, publicCatalogueAndPolicyUnchanged: true,
    uploadContentBytesForwarded: false, productionRequests: false, publicAppGrantPublished: false,
    existingBusinessRecordsModified: false, testMediaRecordsCreated: false,
    scope: 'Two real staging clinic identities, private company-signed profiles and the host ApiBroker against the staging Worker. Clinic B cannot read clinic A synthetic patient/staff records, read their withdrawn media through the host media capability, or create upload intents for their record IDs. The host test blocks any content PUT before network dispatch. No clinic B record or file bytes were created. This does not test access to an active clinic A file because the eligible synthetic files were already withdrawn, and it does not decide physical R2 retention/deletion.'
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.log(JSON.stringify({ passed: true, checksPassed: entries.length, report: reportFile }));
} catch (error) {
  const report = {
    date: new Date().toISOString().slice(0, 10), environment: 'cloudfare-staging', passed: false,
    sourceHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), worktreeChangesPresent, sourceSha256, phase: phaseState.phase,
    checksPassed: entries.filter(item => item.passed).length, checksFailed: entries.filter(item => !item.passed).length,
    checks: entries, uploadContentBytesForwarded: phaseState.contentRequestForwarded,
    unexpectedIntentCreated: !!phaseState.privateIntentAsset,
    safeError: error?.message === 'Acceptance check failed' ? 'Assertion failed' : (typeof error?.message === 'string' && /^[A-Za-z0-9 ._:/()-]{1,120}$/.test(error.message) ? error.message : 'Staging verification failed'),
    productionRequests: false, publicAppGrantPublished: false,
  };
  fs.mkdirSync(path.dirname(reportFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
  console.error(`Staging tenant-isolation verification stopped during ${phaseState.phase}; credentials and API payloads withheld.`);
  console.error(JSON.stringify({ passed: false, checksPassed: report.checksPassed, checksFailed: report.checksFailed, safeError: report.safeError }));
  process.exitCode = 1;
} finally {
  broker?.dispose();
  for (const lease of leases) lease.releaseLease();
  if (tempRoot) fs.rmSync(tempRoot, { recursive: true, force: true });
  tokensA = undefined; tokensB = undefined; clinicA = undefined; clinicB = undefined; activeClinic = undefined;
}
