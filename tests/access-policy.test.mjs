import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { firstPartyApps } from '../apps/manifest.js';
import { visibleAppsForCapabilities } from '../apps/catalog.js';

const mainSource = readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const pageSource = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const devServerSource = readFileSync(new URL('../tools/dev-server.mjs', import.meta.url), 'utf8');
const sessionSource = mainSource.match(/function clinicSessionFromMeResponse\(payload\) \{[\s\S]*?^\}/m)?.[0];
const workspaceRolesSource = mainSource.match(/function availableWorkspaceRoles\(session\) \{[\s\S]*?^\}/m)?.[0];
const workspaceRoleNameSource = mainSource.match(/function workspaceRoleName\(role\) \{[\s\S]*?^\}/m)?.[0];
const workspaceRoleErrorSource = mainSource.match(/function workspaceRoleError\(status, payload\) \{[\s\S]*?^\}/m)?.[0];
assert.ok(sessionSource, 'The browser shell must read the staging Worker session envelope.');
assert.ok(workspaceRolesSource, 'The browser shell must filter workspace roles returned by the staging Worker.');
assert.ok(workspaceRoleNameSource, 'The browser shell must label supported workspace roles.');
assert.ok(workspaceRoleErrorSource, 'The browser shell must explain workspace switch failures.');
const apps = firstPartyApps;
const clinicSessionFromMeResponse = runInNewContext('(' + sessionSource + ')');
const [availableWorkspaceRoles, workspaceRoleName, workspaceRoleError] = runInNewContext(
  `const clinicWorkspaceRoles = new Set(['admin', 'doctor', 'reception']);\n[(${workspaceRolesSource}), (${workspaceRoleNameSource}), (${workspaceRoleErrorSource})]`,
);

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
    'appointments', 'patients', 'calendar', 'followups', 'staff', 'lab', 'treatment', 'workentry',
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

test('offers only distinct server-authorized alternate workspaces', () => {
  const session = { clinicUser: { role: 'doctor', workspaceRoles: ['admin', 'doctor', 'reception', 'admin', 'owner'] } };
  assert.deepEqual([...availableWorkspaceRoles(session)], ['admin', 'reception']);
  assert.deepEqual([...availableWorkspaceRoles({ clinicUser: { role: 'owner', workspaceRoles: ['admin'] } })], []);
  assert.deepEqual([...availableWorkspaceRoles({ clinicUser: { role: 'admin', workspaceRoles: 'doctor' } })], []);
  assert.equal(workspaceRoleName('reception'), 'Reception');
  assert.equal(workspaceRoleName('owner'), '');
});

test('uses the Worker workspace-role endpoint and maps its authorization errors', () => {
  assert.match(mainSource, /fetch\(`\$\{config\.apiBaseUrl\}\/v1\/clinic\/workspace-role`,\s*\{\s*method: 'PUT'/);
  assert.match(mainSource, /authorization: `Bearer \$\{idToken\}`/);
  assert.doesNotMatch(mainSource, /switchRoleButton\.addEventListener\('click', \(\) => void signOutCurrentAccount/);
  assert.equal(workspaceRoleError(403, { error: { code: 'clinic_access_denied' } }), 'That workspace is not available for this clinic account.');
  assert.equal(workspaceRoleError(422, { error: { code: 'invalid_workspace_pin' } }), 'The Admin PIN is incorrect. Check it and try again.');
  assert.equal(workspaceRoleError(429, { error: { code: 'workspace_pin_locked' } }), 'Admin PIN entry is temporarily locked. Try again in 15 minutes.');
  assert.equal(workspaceRoleError(503, { error: { code: 'unavailable' } }), 'The clinic service is unavailable right now. Try again in a moment.');
});

test('keeps workspace role switching inside an accessible confirmation dialog', () => {
  assert.match(pageSource, /<dialog[^>]*id="workspace-switch-dialog"[^>]*aria-labelledby=/);
  assert.match(pageSource, /id="workspace-pin-input"[^>]*type="password"[^>]*inputmode="numeric"/);
  assert.match(mainSource, /workspaceSwitchDialog\.addEventListener\('cancel'/);
  assert.match(mainSource, /workspaceSwitchDialog\.addEventListener\('close'/);
});

test('keeps extra retry and sign-out buttons off the clinic sign-in form', () => {
  assert.doesNotMatch(pageSource, /retry-session-button|Retry saved session|identity-signout-button|Sign out of this account/);
  assert.doesNotMatch(mainSource, /retrySessionButton|identitySignOutButton|Signing out clears the clinic session/);
});

test('serves host modules required to initialize the browser shell and app catalog', () => {
  assert.match(devServerSource, /\['\/vendor\/nepali-date-utils\/index\.js', 'vendor\/nepali-date-utils\/index\.js'\]/);
  assert.match(devServerSource, /\['\/apps\/treatment-protocols\/asset-manifest\.js', 'apps\/treatment-protocols\/asset-manifest\.js'\]/);
});
