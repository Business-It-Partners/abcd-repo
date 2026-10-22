// Local cryptographic/SQL integration of the exact committed staging backend.
// No cloud requests, no backend checkout mutation, no authentication bypass in source.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash, createPrivateKey, sign } from 'node:crypto';
import assert from 'node:assert/strict';
const [backendInput, reportFile] = process.argv.slice(2);
if (!backendInput || !reportFile || process.argv.length !== 4) throw Error('Backend and report paths required');
const backend = path.resolve(backendInput), require = createRequire(path.join(backend, 'package.json'));
const source = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: backend, encoding: 'utf8' }).trim();
if (source !== 'af4faf356db4fbea8d56f1d3bccb2da411bfea06') throw Error('Only reviewed deployed staging source accepted');
const { build } = require('esbuild'), { DatabaseSync } = require('node:sqlite');
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'm15-tenant-proof-')), databases = [], checks = [], originalFetch = globalThis.fetch;
const check = (name, value) => { assert.ok(value, name); checks.push(name); console.log('PASS ' + name); };
function database(sql) {
  const db = new DatabaseSync(':memory:'); databases.push(db); db.exec(sql); let accesses = 0;
  const prepare = (statement, params = []) => ({ bind: (...args) => prepare(statement, args), first: async () => { accesses++; return db.prepare(statement).get(...params) ?? null; }, all: async () => { accesses++; return { results: db.prepare(statement).all(...params) }; }, run: async () => { accesses++; return { meta: { changes: Number(db.prepare(statement).run(...params).changes) } }; } });
  const binding = { prepare, withSession: value => { assert.equal(value, 'first-primary'); return binding; }, batch: async statements => { db.exec('BEGIN'); try { const results = []; for (const s of statements) results.push(await s.run()); db.exec('COMMIT'); return results; } catch (cause) { db.exec('ROLLBACK'); throw cause; } } };
  return { db, binding, accesses: () => accesses };
}
try {
  const archive = execFileSync('git', ['archive', source, 'apps/platform-worker/src', 'apps/platform-worker/migrations'], { cwd: backend, maxBuffer: 20 * 1024 * 1024 });
  const extracted = spawnSync('tar', ['-xf', '-', '-C', scratch], { input: archive }); assert.equal(extracted.status, 0);
  const worker = path.join(scratch, 'apps/platform-worker'); fs.symlinkSync(path.join(backend, 'node_modules'), path.join(scratch, 'node_modules'));
  const entry = path.join(scratch, 'entry.ts'); fs.writeFileSync(entry, "export {appointmentsRoute} from './apps/platform-worker/src/clinic/appointments/appointments.controller'; export {resolveClinicActor,clearClinicAuthCaches} from './apps/platform-worker/src/clinic/auth/clinicAuth.service';");
  await build({ entryPoints: [entry], bundle: true, platform: 'node', format: 'cjs', outfile: path.join(scratch, 'probe.cjs'), logLevel: 'silent' });
  const { appointmentsRoute, resolveClinicActor, clearClinicAuthCaches } = createRequire(import.meta.url)(path.join(scratch, 'probe.cjs'));
  const keyFile = path.join(scratch, 'synthetic-key.pem'), certFile = path.join(scratch, 'synthetic-cert.pem');
  execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', keyFile, '-out', certFile, '-subj', '/CN=M15 synthetic certificate only', '-days', '1'], { stdio: 'ignore' });
  const privateKey = createPrivateKey(fs.readFileSync(keyFile)), certificate = fs.readFileSync(certFile, 'utf8'), project = 'dental-managemetn-staging', now = Math.floor(Date.now() / 1000);
  const jwt = (uid, audience = project) => { const unsigned = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'synthetic-local-only' })).toString('base64url') + '.' + Buffer.from(JSON.stringify({ sub: uid, aud: audience, iss: 'https://securetoken.google.com/' + audience, auth_time: now, iat: now, exp: now + 3600 })).toString('base64url'); return unsigned + '.' + sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url'); };
  let certificateReads = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url) === 'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com') { certificateReads++; return Response.json({ 'synthetic-local-only': certificate }); }
    if (String(url) === 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=synthetic-local-only') { const token = JSON.parse(init.body).idToken; const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); return Response.json({ users: [{ localId: claims.sub, disabled: false, validSince: '0' }] }); }
    throw Error('All real network is forbidden in local tenant proof');
  };
  const migration = (kind, name) => fs.readFileSync(path.join(worker, 'migrations', kind, name), 'utf8');
  const control = database(migration('control', '0001_control_d1.sql'));
  const a = database(migration('clinic', '0001_clinic_schema.sql') + migration('clinic', '0002_staff_command_safety.sql'));
  const b = database(migration('clinic', '0001_clinic_schema.sql') + migration('clinic', '0002_staff_command_safety.sql'));
  const env = { APP_ENV: 'cloudfare-staging', FIREBASE_PROJECT_ID: project, FIREBASE_WEB_API_KEY: 'synthetic-local-only', ALLOWED_ORIGINS: '', CONTROL_DB: control.binding, CLINIC_AAAAAAAAAAAAAAAA: a.binding, CLINIC_BBBBBBBBBBBBBBBB: b.binding };
  for (const [name, db] of [['a', a.db], ['b', b.db]]) {
    control.db.prepare("INSERT INTO tenants(tenant_id,clinic_name,contact_name,contact_email,status,r2_prefix,created_at,updated_at) VALUES (?,?,?,'synthetic@example.test','active',?,?,?)").run(name, 'Synthetic ' + name, 'Synthetic', name, 'now', 'now');
    control.db.prepare("INSERT INTO clinic_users(clinic_user_id,tenant_id,display_name,username,firebase_uid,role,status,identity_status,created_at,updated_at) VALUES (?,?,?,?,?,'admin','enabled','linked','now','now')").run('user-' + name, name, 'Synthetic ' + name, name + '@example.test', 'uid-' + name);
    control.db.prepare("INSERT INTO tenant_databases(tenant_id,binding_name,state,created_at,updated_at) VALUES (?,?,'active','now','now')").run(name, name === 'a' ? 'CLINIC_AAAAAAAAAAAAAAAA' : 'CLINIC_BBBBBBBBBBBBBBBB');
    control.db.prepare("INSERT INTO tenant_schema_status(tenant_id,expected_schema_version,observed_schema_version,status,updated_at) VALUES (?,'fixture-v1','fixture-v1','verified','now')").run(name);
    db.prepare("INSERT INTO branches(branch_id,branch_code,name,status,created_at,updated_at) VALUES ('same-branch','MAIN','Synthetic','active','now','now')").run();
    db.prepare("INSERT INTO clinic_profile(id,clinic_display_name,patient_number_prefix,default_branch_id,created_at,updated_at) VALUES (1,?,'SYN','same-branch','now','now')").run('Synthetic ' + name);
  }
  const ownId = '11111111-1111-4111-8111-111111111111';
  a.db.prepare("INSERT INTO appointments(appointment_id,branch_id,patient_name,doctor_name,appointment_date,start_minute,duration_minutes,reason,status,created_at,updated_at,created_by_clinic_user_id,updated_by_clinic_user_id) VALUES (?,'same-branch','Synthetic A patient','Synthetic doctor','2199-11-01',540,15,'Synthetic','booked','now','now','user-a','user-a')").run(ownId);
  const req = (uid, suffix, method = 'GET', body, audience = project) => new Request('https://fixture.invalid' + suffix, { method, headers: { authorization: 'Bearer ' + jwt(uid, audience), 'x-tenant-id': 'a', 'x-clinic-id': 'a', 'idempotency-key': 'same-synthetic-key', ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const actorA = await resolveClinicActor(req('uid-a', '/v1/me?tenantId=b'), env), actorB = await resolveClinicActor(req('uid-b', '/v1/me?tenantId=a'), env);
  check('cryptographically verified identities resolve different actual SQLite bindings despite forged selectors', actorA.tenantId === 'a' && actorB.tenantId === 'b' && actorA.clinicDatabase === a.binding && actorB.clinicDatabase === b.binding && certificateReads === 1);
  const listA = await appointmentsRoute(req('uid-a', '/v1/appointments?date=2199-11-01&tenantId=b'), env), listB = await appointmentsRoute(req('uid-b', '/v1/appointments?date=2199-11-01&tenantId=a'), env);
  check('known A record is visible only to A; B list remains empty', (await listA.json()).appointments[0].appointmentId === ownId && (await listB.json()).appointments.length === 0);
  const body = { status: 'cancelled', expectedRowVersion: 1 };
  const foreign = await appointmentsRoute(req('uid-b', '/v1/appointments/' + ownId + '/status', 'POST', body), env);
  check('B cannot mutate a known existing A identifier', foreign.status === 404 && a.db.prepare('SELECT status FROM appointments').get().status === 'booked');
  check('foreign denial creates no B appointment audit or command receipt', b.db.prepare('SELECT count(*) AS n FROM clinic_audit_events').get().n === 0 && b.db.prepare('SELECT count(*) AS n FROM clinic_command_receipts').get().n === 0);
  const own = await appointmentsRoute(req('uid-a', '/v1/appointments/' + ownId + '/status', 'POST', body), env);
  check('A can mutate its own record through the same source route', own.status === 200 && a.db.prepare('SELECT status FROM appointments').get().status === 'cancelled');
  const replay = await appointmentsRoute(req('uid-a', '/v1/appointments/' + ownId + '/status', 'POST', body), env);
  check('same-key replay returns one effect and one real SQL audit', replay.status === 200 && a.db.prepare('SELECT row_version FROM appointments').get().row_version === 2 && a.db.prepare('SELECT count(*) AS n FROM clinic_audit_events').get().n === 1);
  const againB = await appointmentsRoute(req('uid-b', '/v1/appointments/' + ownId + '/status', 'POST', body), env); check('B cannot replay A receipt using an identical key', againB.status === 404);
  control.db.prepare("UPDATE clinic_users SET status='disabled' WHERE firebase_uid='uid-a'").run(); const before = a.accesses();
  const disabled = await appointmentsRoute(req('uid-a', '/v1/appointments?date=2199-11-01'), env); check('Control mapping disable takes effect before Clinic SQL despite cached Firebase account check', disabled.status === 403 && a.accesses() === before);
  const wrongProject = await appointmentsRoute(req('uid-b', '/v1/appointments?date=2199-11-01', 'GET', undefined, 'unapproved-project'), env); check('valid signature with wrong audience/issuer is rejected', wrongProject.status === 401);
  control.db.prepare("UPDATE tenants SET status='suspended' WHERE tenant_id='b'").run(); const beforeB = b.accesses();
  const suspended = await appointmentsRoute(req('uid-b', '/v1/appointments?date=2199-11-01'), env); check('tenant suspension prevents any Clinic SQL', suspended.status === 403 && b.accesses() === beforeB);
  clearClinicAuthCaches();
  const report = { passed: true, backendSource: source, archiveSha256: createHash('sha256').update(archive).digest('hex'), checks, scope: 'Unmodified committed auth/controller/service/repository source, actual RS256 signature verification, two separate canonical-schema SQLite databases and Control mapping. Only Google certificate/account responses are synthetic and all real network is forbidden. This is not a two-remote-D1 staging run.', productionRequests: false, remoteRequests: 0 };
  fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
} finally { globalThis.fetch = originalFetch; for (const db of databases) db.close(); fs.rmSync(scratch, { recursive: true, force: true }); }
