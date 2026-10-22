// Reconcile only labelled records from the paused M15 probe. No media write or binary request.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const [guard, credentialFile, journalFile, reportFile] = process.argv.slice(2);
if (guard !== '--reconcile-staging-only' || !credentialFile || !journalFile || !reportFile || process.argv.length !== 6) throw Error('Explicit staging reconciliation required');
const info = fs.lstatSync(journalFile); if (!info.isFile() || info.isSymbolicLink() || info.mode & 0o077) throw Error('Protected fixture journal required');
const j = JSON.parse(fs.readFileSync(journalFile, 'utf8'));
if (j.environment !== 'cloudfare-staging' || !/^dental-os-m15-[a-f0-9]{12}$/.test(j.marker) || Object.keys(j.assets).length || !j.transportOutcomes?.length || j.transportOutcomes.some(o => o.method !== 'POST' || o.action !== 'upload-intents' || o.status !== 500)) throw Error('Only the known pre-transfer failed fixture is eligible');
for (const id of [j.patientId, j.staffId]) if (!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id)) throw Error('Fixture identifier required');
const require = createRequire(import.meta.url);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { staging } = require('../dist-electron/sdk/environment.js');
if (staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev') throw Error('Staging fence');
const client = new FirebaseClient(); let credentials = loadDevelopmentCredentials(credentialFile), token;
const checks = []; const check = (name, passed) => { if (!passed) throw Error('Reconciliation check failed'); checks.push(name); };
try {
  const tokens = await client.signIn(credentials.email, credentials.password, AbortSignal.timeout(20000)); credentials = undefined; token = tokens.idToken;
  const clinic = await client.resolve(token, AbortSignal.timeout(20000)); check('authenticated staging admin with fixture capabilities', clinic.role === 'admin' && clinic.capabilities.includes('staff.manage') && clinic.capabilities.includes('patient_record.access'));
  const api = async (method, suffix, body) => {
    if (![`/v1/patients/${j.patientId}/core`, `/v1/patients/${j.patientId}/media`, `/v1/clinic/staff/${j.staffId}`, `/v1/clinic/staff/${j.staffId}/documents`].includes(suffix)) throw Error('Exact own-record route fence');
    const response = await fetch(new URL(suffix, staging.apiBase), { method, headers: { authorization: 'Bearer ' + token, ...(body ? { 'content-type': 'application/json', 'idempotency-key': j.marker + '-reconcile-staff' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}), redirect: 'error', signal: AbortSignal.timeout(20000) });
    if (response.status !== 200) throw Error('Fixture reconciliation refused'); return response.json();
  };
  const patient = (await api('GET', `/v1/patients/${j.patientId}/core`)).patient, staff = (await api('GET', `/v1/clinic/staff/${j.staffId}`)).staff;
  check('both existing synthetic names match the preserved marker', patient.fullName === 'Synthetic M15 patient ' + j.marker && staff.fullName === 'Synthetic M15 staff ' + j.marker && staff.jobTitle === 'Synthetic platform verification only');
  check('patient has no active media from the failed pre-transfer probe', (await api('GET', `/v1/patients/${j.patientId}/media`)).media.length === 0);
  check('synthetic Staff has no active document', (await api('GET', `/v1/clinic/staff/${j.staffId}/documents`)).documents.length === 0);
  if (staff.status !== 'inactive') {
    const result = await api('PATCH', `/v1/clinic/staff/${j.staffId}`, { fullName: staff.fullName, staffType: staff.staffType, jobTitle: staff.jobTitle, phone: staff.phone, email: staff.email, joinedOn: staff.joinedOn, baseSalaryAmount: staff.baseSalaryAmount, status: 'inactive', expectedRowVersion: staff.rowVersion });
    check('only labelled synthetic Staff was inactivated', result.staff.status === 'inactive');
  } else check('labelled synthetic Staff already inactive', true);
  const report = { environment: 'cloudfare-staging', passed: true, checks, binaryRequests: 0, mediaMutations: 0, productionRequests: false, preserved: 'Labelled synthetic patient, inactive Staff and audit history retained. No patient archive route exists; no destructive SQL or fabricated deletion performed.', noBinaryTransferEvidence: 'Preserved broker transport journal contains only failed intent POSTs, no PUT or finalise. Active media/document lists empty; this does not certify arbitrary abandoned-upload cleanup.' };
  fs.mkdirSync(path.dirname(path.resolve(reportFile)), { recursive: true }); fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n'); console.log(JSON.stringify({ passed: true, checks: checks.length, binaryRequests: 0 }));
} catch { console.error('Deferred fixture reconciliation failed; no credentials or record data logged.'); process.exitCode = 1; }
finally { credentials = undefined; token = undefined; }
