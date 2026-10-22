// Explicit, resumable synthetic staging proof. Credentials and clinical payloads never enter reports.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash, createPrivateKey, randomBytes, sign } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const [guard, credentialsFile, signerFile, outputInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-only' || !credentialsFile || !signerFile || !outputInput || process.argv.length !== 6) throw Error('Explicit staging mode and protected inputs required');
const require = createRequire(import.meta.url), output = path.resolve(outputInput);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { SessionManager } = require('../dist-electron/identity/session.js');
const { ApiBroker } = require('../dist-electron/sdk/broker.js');
const { SDK } = require('../dist-electron/sdk/contracts.js');
const { staging } = require('../dist-electron/sdk/environment.js');
const { stagingDistribution } = require('../dist-electron/distribution/staging.js');
const { clinicApps } = require('../dist-electron/sdk/appPolicy.js');
const { PackageRegistry } = require('../dist-electron/packages/registry.js');
const { buildPackage, verifyPackage, canonical, sha256 } = require('../dist-electron/packages/format.js');
const { verifyUpdatePolicy, allowUpdatedPackage, apiOperationsForPackage, apiReleaseGrantForPackage, apiReleaseGrantMatchesCatalogue } = require('../dist-electron/distribution/updatePolicy.js');
const { verifyCatalogue, noWatermark } = require('../dist-electron/distribution/catalogue.js');
if (staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' || staging.firebaseProject !== 'dental-managemetn-staging') throw Error('Staging fence');
if (!fs.existsSync(output)) fs.mkdirSync(output, { mode: 0o700 });
if (fs.lstatSync(output).mode & 0o077) throw Error('Protected output required');
function protectedRead(file) { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Protected regular file required'); return fs.readFileSync(file, 'utf8'); }
const journalFile = path.join(output, 'journal.json');
const j = fs.existsSync(journalFile) ? JSON.parse(protectedRead(journalFile)) : { environment: 'cloudfare-staging', marker: 'dental-os-m15-json-' + randomBytes(6).toString('hex'), date: '2199-11-' + String(1 + randomBytes(1)[0] % 27).padStart(2, '0'), checks: [] };
if (j.environment !== 'cloudfare-staging' || !/^dental-os-m15-json-[a-f0-9]{12}$/.test(j.marker)) throw Error('Journal fence');
const save = () => { const temp = journalFile + '.tmp'; fs.writeFileSync(temp, JSON.stringify(j, null, 2), { mode: 0o600 }); fs.renameSync(temp, journalFile); }; save();
const key = suffix => createHash('sha256').update(j.marker + ':' + suffix).digest('hex');
let phase = 'configuration', broker, admin, roleSession, registry, leases = [], network = 0, dropCreate = !j.createResponseDropped;
const store = () => ({ available: () => false, load: async () => null, clear: async () => {} });
const check = (name, result) => { j.checks.push({ name, passed: !!result }); save(); if (!result) throw Error('Check failed'); console.log('PASS ' + name); };
const clients = new Map(); let sequence = 0;
const call = (app, method, requestPath, body, operationKey) => { const c = clients.get(app); return broker.request(c.caller, { version: 1, connection: c.connection.connection, generation: c.connection.generation, requestId: 'staging-json-' + (++sequence), operation: 'clinic.api.request', input: { method, path: requestPath, body: body === undefined ? null : JSON.stringify(body), idempotencyKey: method === 'GET' ? null : operationKey } }); };
async function direct(session, method, requestPath, body, operationKey, extra = {}) {
  if (!/^\/v1\/(?:me$|clinic\/users(?:\/[a-f0-9-]{36})?$|clinic\/staff(?:\/[a-f0-9-]{36})?$|appointments(?:\?|$))/.test(requestPath)) throw Error('Operator route fence');
  const token = await session.credential(session.snapshot().generation, AbortSignal.timeout(20000));
  const url = new URL(requestPath, staging.apiBase); if (url.origin !== staging.apiBase) throw Error('Origin fence');
  const response = await fetch(url, { method, headers: { ...extra, authorization: 'Bearer ' + token, ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(operationKey ? { 'idempotency-key': operationKey } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'error', signal: AbortSignal.timeout(20000) });
  const text = await response.text(); if (text.length > 262144) throw Error('Response bound'); return { status: response.status, value: text ? JSON.parse(text) : null };
}
async function feedHashes() { const hashes = {}; for (const name of ['catalogue/staging.json', 'update-policy/staging.json']) { const r = await fetch(new URL(name, stagingDistribution.publicBase), { redirect: 'error', signal: AbortSignal.timeout(15000) }); if (!r.ok) throw Error('Feed unavailable'); const bytes = await r.arrayBuffer(); if (bytes.byteLength > 65536) throw Error('Feed bound'); hashes[name] = sha256(Buffer.from(bytes)); } return hashes; }
const staffBody = { fullName: 'Synthetic doctor ' + j.marker, staffType: 'doctor', jobTitle: 'Synthetic platform JSON verification only', phone: null, email: null, joinedOn: '2026-10-22', baseSalaryAmount: null, status: 'active' };
const appointmentBody = { patientName: 'Synthetic patient ' + j.marker, contactPhone: null, doctorName: staffBody.fullName, appointmentDate: j.date, startMinute: 540, durationMinutes: 15, reason: 'Synthetic platform verification only; ' + j.marker };
try {
  phase = 'sign-in'; admin = new SessionManager(new FirebaseClient(), store(), () => broker?.invalidateSession());
  let credentials = loadDevelopmentCredentials(credentialsFile); if (!credentials) throw Error('Protected staging credentials unavailable');
  check('real host session authenticates supplied staging account', (await admin.login({ ...credentials, remember: false })).ok); credentials = undefined;
  check('authoritative staging account is clinic admin', admin.view().role === 'admin');
  const me = await direct(admin, 'GET', '/v1/me'), owner = key(me.value.session.clinic.tenantId + ':' + me.value.session.clinicUser.clinicUserId);
  if (j.owner && j.owner !== owner) throw Error('Journal belongs to another authenticated owner'); j.owner = owner; save();
  j.feedBefore ??= await feedHashes();
  phase = 'signed-private-profile'; const signer = createPrivateKey(protectedRead(signerFile)), keyId = 'company-staging-m08-20261016', now = Date.now();
  const packages = ['staff', 'appointments', 'followups'].map(name => {
    const appId = 'company.dental.' + name, capabilities = [clinicApps[appId].operation, 'clinic.api.request'];
    const bytes = buildPackage({ appId, publisher: 'company', version: '0.0.15', entry: 'index.html', sdkMajor: 1, apiMajor: 1, capabilities }, new Map([['index.html', Buffer.from('<h1>Private synthetic platform JSON probe</h1>')]]), keyId, signer);
    return { appId, capabilities, bytes, verified: verifyPackage(bytes, stagingDistribution.policy) };
  });
  const envelope = (value, field, purpose) => Buffer.from(canonical({ [field]: value, keyId, signature: sign(null, Buffer.from(canonical({ purpose, keyId, [field]: value })), signer).toString('base64') }));
  const policy = verifyUpdatePolicy(envelope({ format: 2, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, revokedKeys: [], apps: packages.map(p => ({ id: p.appId, capabilities: p.capabilities, minimumVersion: '0.0.15', revokedDigests: [], rollback: null, releases: [{ version: '0.0.15', packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest, apiOperations: ['clinic.api.request'] }] })) }, 'policy', 'dental-os-update-policy'), stagingDistribution.policy, noWatermark, now).policy;
  const catalogue = verifyCatalogue(envelope({ format: 1, environment: 'cloudfare-staging', channel: 'staging', sequence: 1, issuedAt: now, expiresAt: now + 3600000, releases: packages.map(p => ({ id: p.appId, title: 'Private synthetic JSON probe', description: 'Not a public app release', version: '0.0.15', notes: 'Disposable acceptance profile', capabilities: p.capabilities, platforms: ['linux', 'win32'], sdkMajor: 1, apiMajor: 1, objectKey: `releases/${p.appId}/0.0.15/${sha256(p.bytes)}.dentalpkg`, packageSha256: sha256(p.bytes), packageBytes: p.bytes.length, payloadDigest: p.verified.release.digest, status: 'approved', minimumVersion: '0.0.15' })) }, 'catalogue', 'dental-os-catalogue'), stagingDistribution.policy, noWatermark, now).catalogue;
  registry = new PackageRegistry(path.join(output, 'packages'), stagingDistribution.policy); registry.initialize();
  registry.setUpdateGuards(value => allowUpdatedPackage(value, policy, catalogue, Date.now()), () => false);
  registry.setApiGrantResolver(value => { const grant = apiReleaseGrantForPackage(value, policy); return grant && apiReleaseGrantMatchesCatalogue(value.manifest.appId, grant, catalogue) ? apiOperationsForPackage(value, policy) : []; });
  broker = new ApiBroker(staging, admin, async (url, init) => {
    if (new URL(url).origin !== staging.apiBase) throw Error('Broker origin fence'); network++;
    const r = await fetch(url, init);
    if (dropCreate && init.method === 'POST' && new URL(url).pathname === '/v1/appointments' && r.status === 201) { dropCreate = false; j.createResponseDropped = true; save(); await r.body?.cancel(); throw Error('Deliberately lost synthetic create response'); }
    return r;
  }, { timeoutMs: 20000, responseBytes: 262144, perApp: 2, total: 4, operationKeys: 64 });
  for (const p of packages) {
    if (!registry.inspect().apps[p.appId]) registry.install(p.bytes); const lease = registry.launch(p.appId); leases.push(lease);
    const caller = { sender: {}, frame: {}, url: 'dental-fixture://private-json-' + p.appId.split('.').at(-1) + '/index.html' };
    broker.register({ sender: caller.sender, frame: caller.frame, origin: caller.url, appId: p.appId, appVersion: lease.manifest.version, capabilities: [...lease.capabilities], authorize: () => { try { registry.assertAllowed(lease); return true; } catch { return false; } }, authorizeApiOperation: op => registry.authorizeApiOperation(lease, op), report() {} });
    const connection = broker.connect(caller, SDK); check('exact signed private release authorizes ' + p.appId.split('.').at(-1), connection.ok && connection.value.capabilities.includes('clinic.api.request')); clients.set(p.appId, { caller, connection: connection.value });
  }
  j.signedProbes = packages.map(p => ({ appId: p.appId, packageSha256: sha256(p.bytes), payloadDigest: p.verified.release.digest })); save();
  phase = 'synthetic-json-write';
  if (!j.staffId) { const r = await call('company.dental.staff', 'POST', '/v1/clinic/staff', staffBody, key('staff')); check('create only labelled synthetic doctor through actual signed broker grant', r.ok && r.value.status === 201 && r.value.body.staff.fullName === staffBody.fullName); j.staffId = r.value.body.staff.staffId; save(); }
  const staff = await call('company.dental.staff', 'GET', '/v1/clinic/staff/' + j.staffId); check('synthetic doctor ownership verified', staff.ok && staff.value.body.staff.fullName === staffBody.fullName);
  if (!j.appointmentId) {
    let r = await call('company.dental.appointments', 'POST', '/v1/appointments', appointmentBody, key('appointment'));
    if (!r.ok) { check('lost committed response is explicitly unknown', r.error.outcome === 'unknown' && j.createResponseDropped === true); r = await call('company.dental.appointments', 'POST', '/v1/appointments', appointmentBody, key('appointment')); }
    check('explicit original-key retry confirms real staging create', r.ok && r.value.status === 201 && r.value.body.appointment.patientName === appointmentBody.patientName); j.appointmentId = r.value.body.appointment.appointmentId; save();
  }
  const listed = await call('company.dental.appointments', 'GET', '/v1/appointments?date=' + j.date);
  const owned = listed.ok && listed.value.body.appointments.filter(a => a.appointmentId === j.appointmentId && a.patientName === appointmentBody.patientName && a.doctorName === appointmentBody.doctorName);
  check('real staging contains exactly one original synthetic appointment', Array.isArray(owned) && owned.length === 1);
  const before = network, denied = await call('company.dental.followups', 'GET', '/v1/clinic/users');
  check('unrelated privileged route denied before credentials and transport', !denied.ok && denied.error.code === 'FORBIDDEN' && network === before);
  const conflict = await call('company.dental.appointments', 'POST', '/v1/appointments', { ...appointmentBody, reason: appointmentBody.reason + ' changed' }, key('appointment'));
  check('changed payload cannot reuse original operation identity', !conflict.ok && conflict.error.code === 'CONFLICT');
  // These test selector rejection, not access to a known foreign resource.
  const selector = await call('company.dental.appointments', 'GET', '/v1/appointments?date=' + j.date + '&tenantId=foreign');
  check('app-supplied tenant selector denied by exact host contract', !selector.ok && selector.error.code === 'FORBIDDEN');
  const header = await direct(admin, 'GET', '/v1/appointments?date=' + j.date, undefined, undefined, { 'x-tenant-id': 'foreign', 'x-clinic-id': 'foreign' });
  check('Worker ignores forged tenant headers and retains authenticated tenant', header.status === 200 && header.value.appointments.some(a => a.appointmentId === j.appointmentId));
  phase = 'real-role-denial';
  j.roleAccount ??= { loginName: j.marker, password: randomBytes(24).toString('base64url'), displayName: 'Synthetic verifier ' + j.marker }; save();
  if (!j.roleAccount.id) { const r = await direct(admin, 'POST', '/v1/clinic/users', { ...j.roleAccount, role: 'doctor' }, key('doctor-user')); check('create isolated synthetic doctor login', r.status === 201 && r.value.user.displayName === j.roleAccount.displayName); j.roleAccount.id = r.value.user.clinicUserId; save(); }
  roleSession = new SessionManager(new FirebaseClient(), store(), () => {});
  check('synthetic doctor authenticates against real Worker', (await roleSession.login({ email: j.roleAccount.loginName + '@sphirontech.com', password: j.roleAccount.password, remember: false })).ok && roleSession.view().role === 'doctor');
  check('real trusted doctor session denies Staff app', !roleSession.allowed('clinic.app.staff'));
  const deniedStaff = await direct(roleSession, 'GET', '/v1/clinic/staff'); check('Worker independently denies doctor Staff access', deniedStaff.status === 403);
  const deniedUsers = await direct(roleSession, 'GET', '/v1/clinic/users'); check('Worker independently denies doctor account administration', deniedUsers.status === 403);
  phase = 'cleanup';
  const users = await direct(admin, 'GET', '/v1/clinic/users'), user = users.value.users.find(u => u.clinicUserId === j.roleAccount.id);
  if (!user || user.displayName !== j.roleAccount.displayName) throw Error('Synthetic user ownership fence');
  if (user.status !== 'disabled') { const r = await direct(admin, 'PATCH', '/v1/clinic/users/' + user.clinicUserId, { displayName: user.displayName, role: user.role, status: 'disabled', expectedRowVersion: user.rowVersion }, key('disable-user')); check('disable only synthetic login after checks', r.status === 200 && r.value.user.status === 'disabled'); }
  j.roleAccount.disabled = true; save();
  const revoked = await direct(roleSession, 'GET', '/v1/me'); check('Worker revokes disabled membership despite still-valid identity token', [401,403].includes(revoked.status)); await roleSession.rejected(revoked.status); check('host clears revoked session authority', !roleSession.snapshot().active);
  if (owned[0].status !== 'cancelled') { const r = await call('company.dental.appointments', 'POST', '/v1/appointments/' + j.appointmentId + '/status', { status: 'cancelled', expectedRowVersion: owned[0].rowVersion }, key('cancel-appointment')); check('cancel only owned synthetic appointment', r.ok && r.value.status === 200 && r.value.body.appointment.status === 'cancelled'); }
  if (staff.value.body.staff.status !== 'inactive') { const r = await call('company.dental.staff', 'PATCH', '/v1/clinic/staff/' + j.staffId, { ...staffBody, status: 'inactive', expectedRowVersion: staff.value.body.staff.rowVersion }, key('inactivate-staff')); check('inactivate only owned synthetic doctor', r.ok && r.value.status === 200 && r.value.body.staff.status === 'inactive'); }
  j.cleaned = true; j.feedAfter = await feedHashes(); check('public catalogue and policy unchanged', JSON.stringify(j.feedBefore) === JSON.stringify(j.feedAfter)); phase = 'complete';
} catch { console.error('Synthetic staging JSON proof stopped at ' + phase + '; credentials and API payloads withheld.'); process.exitCode = 1; }
finally {
  broker?.dispose(); admin?.dispose(); roleSession?.dispose(); for (const lease of leases) lease.releaseLease(); j.phase = phase; save();
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), environment: 'cloudfare-staging', phase, passed: phase === 'complete', checks: j.checks, signedProbes: j.signedProbes, cleanupCompleted: j.cleaned === true, createResponseDropped: j.createResponseDropped === true, productionRequests: false, existingRecordsModified: false, limits: ['Private signed disposable profile, no public grant rollout or native live-service window.', 'Tenant selectors/headers tested; known cross-tenant resource isolation requires separate backend proof.', 'Disabled synthetic identity/account and cancelled/inactive synthetic audit records retained.'] };
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 }); console.log(JSON.stringify({ phase, checks: report.checks.length, cleanupCompleted: report.cleanupCompleted }));
}
