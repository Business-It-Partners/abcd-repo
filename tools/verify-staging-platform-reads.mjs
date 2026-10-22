// Real staging identity + broker reads only. Payloads and credentials never enter evidence.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const [guard, credentialFile, output] = process.argv.slice(2);
if (guard !== '--staging-read-only' || !credentialFile || !output || process.argv.length !== 5) throw Error('Explicit staging read-only mode, protected credentials and report path required');
const require = createRequire(import.meta.url);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { ApiBroker } = require('../dist-electron/sdk/broker.js');
const { SDK } = require('../dist-electron/sdk/contracts.js');
const { clinicRequestAllowed, appAllowed } = require('../dist-electron/sdk/appPolicy.js');
const { staging } = require('../dist-electron/sdk/environment.js');
const checks = []; let broker, credentials, tokens, clinic, phase = 'configuration';
const check = (name, passed) => { checks.push({ name, passed: !!passed }); if (!passed) throw Error('Check failed'); };
try {
  check('pinned staging API and identity project', staging.environment === 'cloudfare-staging' && staging.apiBase === 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev' && staging.firebaseProject === 'dental-managemetn-staging');
  credentials = loadDevelopmentCredentials(path.resolve(credentialFile)); check('protected supplied staging account configuration', !!credentials);
  phase = 'staging-sign-in'; const client = new FirebaseClient();
  tokens = await client.signIn(credentials.email, credentials.password, AbortSignal.timeout(20_000)); credentials = undefined;
  phase = 'authoritative-session'; clinic = await client.resolve(tokens.idToken, AbortSignal.timeout(20_000));
  check('real Worker resolves authenticated clinic access', !!clinic.tenantId && !!clinic.clinicUserId);
  check('existing backend grants representative Follow-ups access', appAllowed('company.dental.followups', clinic.role, clinic.capabilities));
  let transports = 0;
  const identity = { snapshot: () => ({ generation: 1, active: true, userLabel: 'Staging verification', clinicLabel: 'Staging verification' }),
    allowed: operation => operation !== 'clinic.app.followups' || appAllowed('company.dental.followups', clinic.role, clinic.capabilities),
    allowedClinicRequest: (appId, requestPath, method) => clinicRequestAllowed(appId, clinic.role, clinic.capabilities, requestPath, method),
    credential: async () => tokens.idToken };
  broker = new ApiBroker(staging, identity, async (url, init) => {
    if (new URL(url).origin !== staging.apiBase || init.method !== 'GET') throw Error('Read-only staging fence');
    transports++; return fetch(url, init);
  }, { timeoutMs: 20_000, responseBytes: 262_144, perApp: 1, total: 1, operationKeys: 1 });
  const sender = {}, frame = {}, caller = { sender, frame, url: 'dental-fixture://staging-read/index.html' };
  // Synthetic registration authority; real signed release-grant validation is covered separately.
  broker.register({ sender, frame, origin: caller.url, appId: 'company.dental.followups', appVersion: '1.0.0', capabilities: ['clinic.app.followups', 'clinic.api.request'], authorizeApiOperation: operation => operation === 'clinic.api.request', report() {} });
  const connection = broker.connect(caller, SDK); check('broker handshake', connection.ok);
  const request = (requestId, requestPath) => broker.request(caller, { version: 1, connection: connection.value.connection, generation: 1, requestId, operation: 'clinic.api.request', input: { path: requestPath, method: 'GET', body: null, idempotencyKey: null } });
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  phase = 'representative-live-read';
  let result = await request('staging-read-0001', `/v1/follow-ups?date=${today}`);
  check('real staging Follow-ups read passes host contract', result.ok && result.value.status === 200 && !!result.value.body && typeof result.value.body === 'object'); result = undefined;
  phase = 'pretransport-negative'; const before = transports;
  const denied = await request('staging-read-0002', '/v1/clinic/users');
  check('unrelated privileged route denied before transport', !denied.ok && denied.error.code === 'FORBIDDEN' && transports === before);
  phase = 'complete';
} catch { console.error('Staging read verification failed at ' + phase + '; credentials and API payloads withheld.'); process.exitCode = 1; }
finally {
  credentials = undefined; tokens = undefined; clinic = undefined; broker?.dispose();
  const report = { source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeDirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(), environment: 'cloudfare-staging', phase, passed: phase === 'complete', checks,
    scope: 'Real staging authentication/session and read-only Follow-ups transport through the actual broker with synthetic local registration authority. No signed public grant, installed runtime, media/write/tenant-negative proof is inferred.', clinicalWrites: false, productionRequests: false, credentialsRetained: false };
  fs.mkdirSync(path.dirname(path.resolve(output)), { recursive: true }); fs.writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ phase, passed: report.passed, checks: checks.length }));
}
