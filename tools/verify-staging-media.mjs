// Explicit synthetic staging acceptance. Never prints credentials or API payloads; never targets production.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [guard, credentialFile, signerFile, outputInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-media-only' || !credentialFile || !signerFile || !outputInput || process.argv.length !== 6) throw Error('Explicit synthetic staging media mode, protected credentials/signer and journal directory required');
const require = createRequire(import.meta.url), output = path.resolve(outputInput);
const { FirebaseClient } = require('../dist-electron/identity/client.js'), { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { ApiBroker } = require('../dist-electron/sdk/broker.js'), { SDK } = require('../dist-electron/sdk/contracts.js');
const { staging } = require('../dist-electron/sdk/environment.js'), { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const { appAllowed, clinicApps, clinicRequestAllowed } = require('../dist-electron/sdk/appPolicy.js');
const { mediaKindForApp } = require('../dist-electron/sdk/mediaRead.js'), { uploadKindForApp } = require('../dist-electron/sdk/mediaUpload.js');
const { buildPackage, verifyPackage, canonical, sha256 } = require('../dist-electron/packages/format.js');
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { verifyUpdatePolicy, allowUpdatedPackage, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../dist-electron/distribution/updatePolicy.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
if (staging.environment !== 'cloudfare-staging' || staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' || staging.firebaseProject !== 'dental-managemetn-staging') throw Error('Staging configuration fence');
const protectedJSON = file => { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Protected file required'); return JSON.parse(fs.readFileSync(file, 'utf8')); };
if (!fs.existsSync(output)) fs.mkdirSync(output, { mode: 0o700 });
const journalFile = path.join(output, 'journal.json');
let journal = fs.existsSync(journalFile) ? protectedJSON(journalFile) : { environment: 'cloudfare-staging', marker: 'dental-os-m15-' + randomBytes(6).toString('hex'), date: new Date(Date.now() + 5.75 * 3600000).toISOString().slice(0, 10), assets: {} };
if (journal.environment !== 'cloudfare-staging' || !/^dental-os-m15-[a-f0-9]{12}$/.test(journal.marker)) throw Error('Invalid synthetic journal');
const save = () => fs.writeFileSync(journalFile, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 }); save();
const check = (name, passed) => { journal.checks ??= []; journal.checks.push({ name, passed: !!passed }); save(); if (!passed) throw Error('Acceptance check failed'); console.log('PASS ' + name); };
const opKey = name => createHash('sha256').update(journal.marker + ':' + name).digest('hex');
const ownedName = suffix => `Synthetic M15 ${suffix} ${journal.marker}`;
const patientBody = { fullName: ownedName('patient'), registeredOn: journal.date, medicalProfile: {}, allergies: [] };
const staffBody = { fullName: ownedName('staff'), staffType: 'other', jobTitle: 'Synthetic platform verification only', phone: null, email: null, joinedOn: journal.date, baseSalaryAmount: null, status: 'active' };
let credential, tokens, clinic, broker, registry, leases = [], phase = 'configuration';
const clients = new Map(); let callNumber = 0;
const publicFeed = async () => {
  const hashes = {};
  for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) { const response = await fetch(new URL(name, stagingDistribution.publicBase), { redirect: 'error', signal: AbortSignal.timeout(15000) }); if (!response.ok) throw Error('Public staging control read failed'); const bytes = await response.arrayBuffer(); if (bytes.byteLength > 65536) throw Error('Public metadata bound'); hashes[name] = createHash('sha256').update(Buffer.from(bytes)).digest('hex'); }
  return hashes;
};
const api = async (method, requestPath, body, key, token = tokens?.idToken) => {
  if (!requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%') || !token) throw Error('Staging request fence');
  const url = new URL(requestPath, staging.apiBase); if (url.origin !== staging.apiBase) throw Error('Staging origin fence');
  const response = await fetch(url, { method, headers: { authorization: 'Bearer ' + token, ...(key ? { 'idempotency-key': key } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (response.status >= 300 && response.status < 400) throw Error('Staging redirect denied');
  let value; if (response.status !== 204) { const text = await response.text(); if (text.length > 262144) throw Error('Response bound'); try { value = JSON.parse(text); } catch { throw Error('Invalid response'); } }
  journal.lastHTTP = { method, status: response.status, phase, ...(typeof value?.error?.code === 'string' && /^[a-z_]{1,80}$/.test(value.error.code) ? { code: value.error.code } : {}) }; save();
  return { status: response.status, value };
};
const request = async (appId, operation, input) => {
  const client = clients.get(appId); if (!client) throw Error('Missing registered probe');
  return broker.request(client.caller, { version: 1, connection: client.connection.connection, generation: 1, requestId: 'live-media-' + (++callNumber), operation, input });
};
const jsonRequest = (appId, method, requestPath, body, key) => request(appId, 'clinic.api.request', { method, path: requestPath, body: body === undefined ? null : JSON.stringify(body), idempotencyKey: method === 'GET' ? null : key });
try {
  phase = 'staging-sign-in'; credential = loadDevelopmentCredentials(credentialFile); if (!credential) throw Error('Protected staging credentials unavailable');
  const auth = new FirebaseClient(); tokens = await auth.signIn(credential.email, credential.password, AbortSignal.timeout(20000)); credential = undefined; clinic = await auth.resolve(tokens.idToken, AbortSignal.timeout(20000));
  check('supplied staging account has required authoritative fixture permissions', clinic.role === 'admin' && clinic.capabilities.includes('patient_record.access') && clinic.capabilities.includes('staff.manage'));
  journal.feedBefore ??= await publicFeed(); save();
  phase = 'signed-private-probes';
  const info = fs.lstatSync(signerFile); if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077 || info.size > 8192) throw Error('Protected external staging signer required');
  const signer = createPrivateKey(fs.readFileSync(signerFile, 'utf8')), keyId = 'company-staging-m08-20261016', now = Date.now(), packages = [];
  phase = 'signed-package-build';
  for (const name of ['patient-record', 'staff']) {
    const appId = 'company.dental.' + name, caps = [clinicApps[appId].operation, 'clinic.api.request', 'clinic.media.read', 'clinic.media.upload'];
    const bytes = buildPackage({ appId, publisher: 'company', version: '0.0.15', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities: caps }, new Map([['index.html', Buffer.from('<h1>Private synthetic M15 platform probe only</h1>')]]), keyId, signer);
    const verified = verifyPackage(bytes, stagingDistribution.policy); packages.push({ appId, caps, bytes, verified }); fs.writeFileSync(path.join(output, name + '.dentalpkg'), bytes, { mode: 0o600 });
  }
  phase = 'signed-policy-catalogue';
  const policy = { format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, revokedKeys: [], apps: packages.map(p => ({ id: p.appId, capabilities: p.caps, minimumVersion: '0.0.15', revokedDigests: [], rollback: null, releases: [{ version: '0.0.15', packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest, apiOperations: ['clinic.api.request', 'clinic.media.read', 'clinic.media.upload'] }] })) };
  const catalogue = { format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, releases: packages.map(p => ({ id: p.appId, title: 'Private synthetic platform probe', description: 'Not an M14 app release or public publication.', version: '0.0.15', notes: 'Private disposable verification profile only.', capabilities: p.caps, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${p.appId}/0.0.15/${sha256(p.bytes)}.dentalpkg`, packageSha256: sha256(p.bytes), packageBytes: p.bytes.length, payloadDigest: p.verified.release.digest, status: 'approved', minimumVersion: '0.0.15' })) };
  const envelope = (value, field, purpose) => Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), signer).toString('base64') }));
  const policyBytes = envelope(policy, 'policy', 'dental-os-update-policy'), catalogueBytes = envelope(catalogue, 'catalogue', 'dental-os-catalogue');
  const verifiedPolicy = verifyUpdatePolicy(policyBytes, stagingDistribution.policy, noWatermark, now).policy, verifiedCatalogue = verifyCatalogue(catalogueBytes, stagingDistribution.policy, noWatermark, now).catalogue;
  fs.writeFileSync(path.join(output, 'private-policy.json'), policyBytes, { mode: 0o600 }); fs.writeFileSync(path.join(output, 'private-catalogue.json'), catalogueBytes, { mode: 0o600 });
  phase = 'signed-registry-registration';
  registry = new PackageRegistry(path.join(output, 'profile/packages'), stagingDistribution.policy); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, verifiedPolicy, verifiedCatalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => { const grant = apiReleaseGrantForPackage(value, verifiedPolicy); return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, verifiedCatalogue) ? apiOperationsForPackage(value, verifiedPolicy) : []; });
  let finaliseDropped = false;
  const identity = { snapshot: () => ({ generation: 1, active: true, userLabel: 'Staging verification', clinicLabel: 'Staging verification' }), allowed: operation => !operation.startsWith('clinic.app.') || Object.entries(clinicApps).some(([appId, p]) => p.operation === operation && appAllowed(appId, clinic.role, clinic.capabilities)), allowedClinicRequest: (appId, requestPath, method) => clinicRequestAllowed(appId, clinic.role, clinic.capabilities, requestPath, method), allowedMediaRead: (appId, kind) => mediaKindForApp(appId) === kind && appAllowed(appId, clinic.role, clinic.capabilities), allowedMediaUpload: (appId, kind) => uploadKindForApp(appId) === kind && appAllowed(appId, clinic.role, clinic.capabilities), credential: async () => tokens.idToken };
  broker = new ApiBroker(staging, identity, async (url, init) => {
    if (new URL(url).origin !== staging.apiBase) throw Error('Broker staging origin fence');
    const response = await fetch(url, init);
    journal.transportOutcomes ??= []; journal.transportOutcomes.push({ phase, method: init.method, action: new URL(url).pathname.split('/').at(-1), status: response.status }); if (journal.transportOutcomes.length > 80) journal.transportOutcomes.shift(); save();
    if (phase === 'staff_document-upload' && !finaliseDropped && new URL(url).pathname.endsWith('/finalise') && response.status === 200) { await response.body?.cancel(); finaliseDropped = true; journal.finaliseResponseDeliberatelyDropped = true; save(); throw Error('Deliberate lost staging finalise response'); }
    return response;
  });
  for (const p of packages) {
    if (!registry.inspect().apps[p.appId]) registry.install(p.bytes);
    const lease = registry.launch(p.appId); leases.push(lease); const caller = { sender: {}, frame: {}, url: 'dental-fixture://private-' + p.appId.split('.').at(-1) + '/index.html' };
    broker.register({ sender: caller.sender, frame: caller.frame, origin: caller.url, appId: p.appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities], authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } }, authorizeApiOperation: operation => registry.authorizeApiOperation(lease, operation), report() {} });
    const connected = broker.connect(caller, SDK); check('normal staging trust and exact signed release grant authorize private ' + p.appId.split('.').at(-1) + ' probe', connected.ok && connected.value.capabilities.includes('clinic.media.upload')); clients.set(p.appId, { caller, connection: connected.value });
  }
  journal.signedProbes = packages.map(p => ({ appId: p.appId, packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest })); save();
  phase = 'synthetic-record-creation';
  if (!journal.patientId) { const result = await jsonRequest('company.dental.patient-record', 'POST', '/v1/patient-intakes', patientBody, opKey('patient')); check('create only labelled synthetic patient through broker and real Worker', result.ok && result.value.status === 201 && result.value.body?.patient?.fullName === patientBody.fullName); journal.patientId = result.value.body.patient.patientId; save(); }
  if (!journal.staffId) { const result = await jsonRequest('company.dental.staff', 'POST', '/v1/clinic/staff', staffBody, opKey('staff')); check('create only labelled synthetic staff through broker and real Worker', result.ok && result.value.status === 201 && result.value.body?.staff?.fullName === staffBody.fullName); journal.staffId = result.value.body.staff.staffId; save(); }
  const patient = await api('GET', `/v1/patients/${journal.patientId}/core`), staff = await api('GET', `/v1/clinic/staff/${journal.staffId}`);
  check('synthetic record ownership verified before media mutations', patient.status === 200 && patient.value.patient.fullName === patientBody.fullName && staff.status === 200 && staff.value.staff.fullName === staffBody.fullName);
  for (const [kind, size] of [['patient_media', 10 * 1024 * 1024], ['staff_document', 25 * 1024 * 1024]]) {
    const appId = kind === 'patient_media' ? 'company.dental.patient-record' : 'company.dental.staff', recordId = kind === 'patient_media' ? journal.patientId : journal.staffId;
    const data = new Uint8Array(size); data.set(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64')); const checksum = createHash('sha256').update(data).digest('hex');
    const metadata = { displayFilename: journal.marker + '.png', mimeType: 'image/png', byteSize: size, ...(kind === 'patient_media' ? { chiefComplaintId: null, xrayType: 'IOPA', toothCode: null, clinicalNote: 'Synthetic platform verification only', capturedOn: journal.date } : { documentType: 'other', expiresOn: null }) };
    phase = kind + '-upload'; journal.phase = phase; save();
    if (!journal.assets[kind]?.assetId) {
      const begun = await request(appId, 'clinic.media.upload', { action: 'begin', kind, recordId, metadata, idempotencyKey: opKey(kind) }); check(kind + ' begin holds host close/update safety', begun.ok && broker.hasUnsafeWrites(appId)); const transferId = begun.value.transferId;
      if (!begun.value.committed) {
        for (let offset = 0; offset < size; offset += 8192) { const result = await request(appId, 'clinic.media.upload', { action: 'chunk', transferId, offset, data: Buffer.from(data.subarray(offset, offset + 8192)).toString('base64') }); if (!result.ok) throw Error('Bounded staging chunk refused'); }
      }
      let result = await request(appId, 'clinic.media.upload', { action: 'commit', transferId, idempotencyKey: opKey(kind) });
      if (!result.ok && result.error.outcome === 'unknown') { check(kind + ' unknown response retains close/update safety', broker.hasUnsafeWrites(appId)); result = await request(appId, 'clinic.media.upload', { action: 'commit', transferId, idempotencyKey: opKey(kind) }); }
      check(kind + ' real D1/R2 upload confirms original-key outcome and clears safety', result.ok && result.value.committed && !broker.hasUnsafeWrites(appId)); journal.assets[kind] = { assetId: result.value.assetId, recordId, bytes: size, sha256: checksum }; save();
    }
    phase = kind + '-read';
    const read = await request(appId, 'clinic.media.read', { kind, recordId, assetId: journal.assets[kind].assetId });
    check(kind + ' real staged private bytes pass host MIME/size/SHA-256 verification', read.ok && read.value.body.byteLength === size && createHash('sha256').update(read.value.body).digest('hex') === checksum);
    journal.assets[kind].readVerified = true; save();
  }
  phase = 'post-checks';
  check('real finalise response loss was reconciled without pretending cancellation', journal.finaliseResponseDeliberatelyDropped === true);
  journal.feedAfter = await publicFeed(); check('public feed and grants unchanged by private signed acceptance profile', JSON.stringify(journal.feedBefore) === JSON.stringify(journal.feedAfter));
  phase = 'media-passed-awaiting-failure-and-cleanup-cases'; journal.phase = phase; save();
} catch (cause) { journal.safeError = { name: cause?.name, ...(phase.startsWith('signed-') && typeof cause?.message === 'string' && /^[A-Za-z0-9 ._:()/-]{1,150}$/.test(cause.message) ? { message: cause.message } : {}) }; journal.phase = phase; journal.failed = true; save(); console.error('Staging media verification stopped at ' + phase + '; credentials and API payloads withheld.'); if (journal.safeError.message) console.error('Fixture diagnostic: ' + journal.safeError.message); process.exitCode = 1; }
finally {
  broker?.dispose(); for (const lease of leases) lease.releaseLease(); credential = undefined; tokens = undefined; clinic = undefined;
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), environment: 'cloudfare-staging', phase, checks: journal.checks ?? [], assets: journal.assets, signedProbes: journal.signedProbes, feedUnchanged: JSON.stringify(journal.feedBefore) === JSON.stringify(journal.feedAfter), scope: 'Real staging identity, exact staging-company signed private packages/policy/catalogue and actual ApiBroker/D1/R2 media transfers. Private isolated profile only; no public feed/grant rollout, native live-media window, tenant-negative or final acceptance claim.', productionRequests: false, existingRecordsModified: false, cleanupPending: true };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); console.log(JSON.stringify({ phase, passedChecks: (journal.checks ?? []).filter(c => c.passed).length, failedChecks: (journal.checks ?? []).filter(c => !c.passed).length }));
}
