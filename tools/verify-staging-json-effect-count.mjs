// Read-only follow-up: count every owned synthetic row, not just the returned record ID.
import fs from 'node:fs';
import { createHash } from 'node:crypto';
const [guard, credentialsFile, journalFile, reportFile] = process.argv.slice(2);
if (guard !== '--staging-read-only' || !credentialsFile || !journalFile || !reportFile || process.argv.length !== 6) throw Error('Explicit read-only mode and protected inputs required');
function read(file) { const stat = fs.lstatSync(file); if (!stat.isFile() || stat.isSymbolicLink() || stat.mode & 0o077) throw Error('Protected regular file required'); return JSON.parse(fs.readFileSync(file, 'utf8')); }
let credential = read(credentialsFile), token;
const j = read(journalFile), base = 'https://dentmitra-api-cloudfare-staging.tiwariamritbabu.workers.dev';
if (j.environment !== 'cloudfare-staging' || !/^dental-os-m15-json-[a-f0-9]{12}$/.test(j.marker) || !/^21\d{2}-\d{2}-\d{2}$/.test(j.date) || !/^[a-f0-9-]{36}$/.test(j.appointmentId) || j.cleaned !== true) throw Error('Only completed known synthetic journal accepted');
const hash = value => createHash('sha256').update(value).digest('hex');
try {
  const auth = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=AIzaSyDA9f3oRA07zV4YdtF7P7ZUVY6iScEku1c', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: credential.email, password: credential.password, returnSecureToken: true }), redirect: 'error', signal: AbortSignal.timeout(20000) });
  credential = undefined; if (!auth.ok) throw Error('Staging authentication refused'); token = (await auth.json()).idToken;
  const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')); if (claims.aud !== 'dental-managemetn-staging' || claims.iss !== 'https://securetoken.google.com/dental-managemetn-staging') throw Error('Staging project fence');
  const get = async suffix => { const r = await fetch(new URL(suffix, base), { headers: { authorization: 'Bearer ' + token }, redirect: 'error', signal: AbortSignal.timeout(20000) }); if (!r.ok) throw Error('Read refused'); const text = await r.text(); if (text.length > 262144) throw Error('Read bound'); return JSON.parse(text); };
  const me = (await get('/v1/me')).session;
  if (j.owner !== hash(j.marker + ':' + me.clinic.tenantId + ':' + me.clinicUser.clinicUserId)) throw Error('Authenticated journal owner mismatch');
  const matches = (await get('/v1/appointments?date=' + j.date)).appointments.filter(a => a.patientName === 'Synthetic patient ' + j.marker && a.doctorName === 'Synthetic doctor ' + j.marker && a.reason === 'Synthetic platform verification only; ' + j.marker);
  if (matches.length !== 1 || matches[0].appointmentId !== j.appointmentId || matches[0].status !== 'cancelled') throw Error('Single-effect or cleanup proof failed');
  fs.writeFileSync(reportFile, JSON.stringify({ passed: true, environment: 'cloudfare-staging', authenticatedOwnerMatchesJournal: true, matchingOwnedAppointmentsAcrossAllIds: matches.length, originalReceiptIdMatches: true, syntheticAppointmentCancelled: true, clinicalWrites: false, productionRequests: false, scope: 'Independent read of all rows matching the exact owned synthetic marker/name/doctor/reason, without filtering by returned ID. Confirms no duplicate synthetic appointment remains after the deliberately lost create response and original-key retry.' }, null, 2) + '\n');
  console.log(JSON.stringify({ passed: true, matchingOwnedAppointmentsAcrossAllIds: 1, clinicalWrites: false }));
} catch { console.error('Read-only single-effect verification failed; no credentials or record payloads logged.'); process.exitCode = 1; }
finally { credential = undefined; token = undefined; }
