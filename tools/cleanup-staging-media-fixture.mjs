// Withdraw only the synthetic media objects recorded by the guarded M15 staging verifier.
// This changes active metadata; it does not delete R2 bytes.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const [guard, credentialFile, outputInput] = process.argv.slice(2);
if (guard !== '--synthetic-staging-media-cleanup-only' || !credentialFile || !outputInput || process.argv.length !== 5) throw Error('Explicit staging synthetic-media cleanup mode, protected credentials and acceptance journal required');
const require = createRequire(import.meta.url), output = path.resolve(outputInput);
const { FirebaseClient } = require('../dist-electron/identity/client.js');
const { loadDevelopmentCredentials } = require('../dist-electron/identity/devCredentials.js');
const { staging } = require('../dist-electron/sdk/environment.js');
if (staging.environment !== 'cloudfare-staging' || staging.apiBase !== 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev') throw Error('Staging configuration fence');
const protectedJSON = file => { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Protected file required'); return JSON.parse(fs.readFileSync(file, 'utf8')); };
const journalPath = path.join(output, 'journal.json'), reportPath = path.join(output, 'report.json');
const journal = protectedJSON(journalPath), report = protectedJSON(reportPath);
if (journal.environment !== 'cloudfare-staging' || !/^dental-os-m15-[a-f0-9]{12}$/.test(journal.marker) || report.environment !== 'cloudfare-staging' || report.productionRequests !== false) throw Error('Not an M15 synthetic staging journal');
const expected = {
  patient_media: { field: 'mediaAssetId', recordId: journal.patientId, bytes: 10 * 1024 * 1024 },
  staff_document: { field: 'staffDocumentId', recordId: journal.staffId, bytes: 25 * 1024 * 1024 },
};
for (const [kind, contract] of Object.entries(expected)) {
  const item = journal.assets?.[kind];
  if (!item || item.recordId !== contract.recordId || item.bytes !== contract.bytes || !/^[0-9a-f]{64}$/.test(item.sha256) || !/^[0-9a-f-]{36}$/i.test(item.assetId ?? '')) throw Error('Synthetic acceptance asset record did not match the guarded fixture');
}
const credential = loadDevelopmentCredentials(credentialFile); if (!credential) throw Error('Protected staging credentials unavailable');
let tokens, clinic;
const api = async (method, requestPath, body, key) => {
  if (!['GET', 'POST'].includes(method) || !requestPath.startsWith('/v1/') || requestPath.includes('..') || requestPath.includes('%')) throw Error('Fixed staging API fence');
  const url = new URL(requestPath, staging.apiBase); if (url.origin !== staging.apiBase || !tokens?.idToken) throw Error('Staging origin/session fence');
  const response = await fetch(url, { method, headers: { authorization: `Bearer ${tokens.idToken}`, ...(body !== undefined ? { 'content-type': 'application/json' } : {}), ...(key ? { 'idempotency-key': key } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: 'manual', signal: AbortSignal.timeout(30000) });
  if (response.status >= 300 && response.status < 400) throw Error('Staging redirect denied');
  let value; if (response.status !== 204) { const text = await response.text(); if (text.length > 262144) throw Error('Response bound'); try { value = JSON.parse(text); } catch { throw Error('Invalid staging response'); } }
  return { status: response.status, value };
};
const opKey = name => createHash('sha256').update(journal.marker + ':withdraw:' + name).digest('hex');
const check = (name, passed) => { if (!passed) throw Error('Synthetic staging cleanup check failed: ' + name); console.log('PASS ' + name); };
const saveProgress = () => {
  const patientDone = journal.assets.patient_media.withdrawn === true, staffDone = journal.assets.staff_document.withdrawn === true;
  journal.cleanup = { completed: patientDone && staffDone, patientMediaWithdrawn: patientDone, staffDocumentWithdrawn: staffDone, physicalR2DeletionPerformed: false, storedBytesCleanupPending: true };
  fs.writeFileSync(journalPath, JSON.stringify(journal, null, 2) + '\n', { mode: 0o600 });
  report.activeSyntheticMediaCleanupPending = !journal.cleanup.completed; report.storedBytesCleanupPending = true; report.cleanup = journal.cleanup;
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
};
const listActive = async kind => {
  const route = kind === 'patient_media' ? `/v1/patients/${journal.patientId}/media` : `/v1/clinic/staff/${journal.staffId}/documents`;
  const result = await api('GET', route), items = kind === 'patient_media' ? result.value?.media : result.value?.documents;
  if (result.status !== 200 || !Array.isArray(items)) throw Error('Staging active-media list did not match its contract');
  return items;
};
const withdrawFixture = async kind => {
  const record = journal.assets[kind], rule = expected[kind], collection = await listActive(kind), itemKey = rule.field;
  const matching = collection.filter(item => item?.[itemKey] === record.assetId);
  if (matching.length > 1) throw Error('Duplicate synthetic asset appeared in the active-media list');
  if (matching.length === 1) {
    const item = matching[0], correctOwner = kind === 'patient_media' ? item.patientId === record.recordId : item.staffId === record.recordId;
    if (!correctOwner || item.displayFilename !== `${journal.marker}.png` || item.byteSize !== rule.bytes || item.checksum !== record.sha256 || item.status !== 'active') throw Error('Refusing to withdraw an asset that does not exactly match the synthetic journal');
  }
  if (record.withdrawn === true && matching.length) throw Error('Previously withdrawn synthetic media unexpectedly became active');
  if (record.withdrawn !== true) {
    const route = kind === 'patient_media' ? `/v1/patient-media/${record.assetId}/withdraw` : `/v1/clinic/staff/${record.recordId}/documents/${record.assetId}/withdraw`;
    const result = await api('POST', route, { reason: 'Synthetic Dental OS M15 staging acceptance cleanup' }, opKey(kind));
    if (![204, 409].includes(result.status)) throw Error('Staging refused the exact synthetic media withdrawal');
    const after = await listActive(kind);
    check(`${kind} synthetic media is absent from the active list`, !after.some(item => item?.[itemKey] === record.assetId));
    record.withdrawn = true; saveProgress();
  } else check(`${kind} synthetic media remains absent from the active list`, !matching.length);
};
try {
  const auth = new FirebaseClient(); tokens = await auth.signIn(credential.email, credential.password, AbortSignal.timeout(20000)); clinic = await auth.resolve(tokens.idToken, AbortSignal.timeout(20000));
  check('same staging clinic has patient_record.access and staff.manage', clinic.role === 'admin' && clinic.capabilities.includes('patient_record.access') && clinic.capabilities.includes('staff.manage'));
  const [patient, staff] = await Promise.all([api('GET', `/v1/patients/${journal.patientId}/core`), api('GET', `/v1/clinic/staff/${journal.staffId}`)]);
  check('both target records still match this journal marker', patient.status === 200 && patient.value?.patient?.fullName === `Synthetic M15 patient ${journal.marker}` && staff.status === 200 && staff.value?.staff?.fullName === `Synthetic M15 staff ${journal.marker}`);
  await withdrawFixture('patient_media');
  await withdrawFixture('staff_document');
  saveProgress();
  console.log(JSON.stringify({ passed: true, patientMediaWithdrawn: true, staffDocumentWithdrawn: true, activeMediaRemaining: false, physicalR2DeletionPerformed: false, storedBytesCleanupPending: true }));
} finally { tokens = undefined; clinic = undefined; }
