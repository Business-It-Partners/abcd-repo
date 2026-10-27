import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const mainSource = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const appCatalogSource = mainSource.match(/const apps = (\[[\s\S]*?^\]);/m)?.[1];
const policySource = mainSource.match(/function visibleAppsForCapabilities\(appCatalog, rawCapabilities\) \{[\s\S]*?^\}/m)?.[0];
const sessionSource = mainSource.match(/function clinicSessionFromMeResponse\(payload\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(appCatalogSource, 'The browser shell must define its first-party app catalog.');
assert.ok(policySource, 'The browser shell must define its capability-based app filter.');
assert.ok(sessionSource, 'The browser shell must read the staging Worker session envelope.');
const apps = JSON.parse(JSON.stringify(runInNewContext(appCatalogSource)));
const visibleAppsForCapabilities = runInNewContext('(' + policySource + ')');
const clinicSessionFromMeResponse = runInNewContext('(' + sessionSource + ')');

const adminCapabilities = apps.flatMap((app) => app.capabilities);
const doctorCapabilities = [
  'followups.access', 'appointments.access', 'work_entry.access', 'lab_requests.create',
  'patient_record.access', 'treatment_progress.access', 'staff.reference.read',
  'treatment_protocols.reference.read', 'calendar.access', 'clinic_profile.read',
];
const receptionCapabilities = [
  'followups.access', 'appointments.access', 'patient_record.access', 'treatment_progress.access',
  'lab_tracker.access', 'patient_billing_ledger.read', 'patient_payments.outstanding.read',
  'patient_payments.collect', 'staff.reference.read', 'calendar.access', 'clinic_profile.read',
];

function ids(capabilities) {
  return Array.from(visibleAppsForCapabilities(apps, capabilities), (app) => app.id);
}

test('shows only apps allowed by the staging Worker capabilities for each clinic role', () => {
  assert.deepEqual(ids(adminCapabilities), apps.map((app) => app.id));
  assert.deepEqual(ids(doctorCapabilities), [
    'appointments', 'patients', 'calendar', 'followups', 'staff', 'lab', 'treatment', 'protocols', 'workentry',
  ]);
  assert.deepEqual(ids(receptionCapabilities), [
    'appointments', 'patients', 'calendar', 'finance', 'followups', 'staff', 'lab', 'treatment',
  ]);
});

test('fails closed for absent or unrelated capabilities', () => {
  assert.deepEqual(ids(undefined), []);
  assert.deepEqual(ids(['clinic_profile.read', 'unknown.admin']), []);
  assert.deepEqual(ids([{ role: 'admin' }]), []);
});

test('unwraps the staging Worker /v1/me session response and rejects malformed payloads', () => {
  const session = { clinicUser: { capabilities: ['appointments.access'] }, clinic: {}, branches: [] };
  assert.equal(clinicSessionFromMeResponse({ session }), session);
  assert.equal(clinicSessionFromMeResponse({ clinicUser: { capabilities: ['appointments.access'] } }), null);
  assert.equal(clinicSessionFromMeResponse({ session: { clinicUser: { capabilities: 'appointments.access' } } }), null);
});

test('keeps extra retry and sign-out buttons off the clinic sign-in form', () => {
  assert.doesNotMatch(pageSource, /retry-session-button|Retry saved session|identity-signout-button|Sign out of this account/);
  assert.doesNotMatch(mainSource, /retrySessionButton|identitySignOutButton|Signing out clears the clinic session/);
});
