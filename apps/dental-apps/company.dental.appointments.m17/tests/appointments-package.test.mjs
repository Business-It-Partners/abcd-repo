import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFile(path.join(root, relativePath));
const readText = async relativePath => (await read(relativePath)).toString('utf8');

test('package identity is the 1.0.8 M17 Appointments update with the platform SDK grant', async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('app.manifest.json'));

  assert.equal(packageJson.name, 'company.dental.appointments.m17');
  assert.equal(packageJson.version, '1.0.8');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.entry, 'index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, ['clinic.app.appointments', 'clinic.api.request', 'session.context']);
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
});

test('appointment table removes the phone and no-show columns and matches Follow-ups row typography', async () => {
  const source = await readText('src/main.tsx');
  const styles = await readText('src/styles.css');
  assert.doesNotMatch(source, /<th[^>]*>Phone<\/th>|data-label="Phone"/);
  assert.doesNotMatch(source, /No-show<\/th>|data-label="No-show"/);
  assert.match(source, /className="btn btn-primary btn-sm" onClick=\{\(\) => setDetails\(item\)\}>Details/);
  assert.match(styles, /\.appointmentTable td\s*\{[^}]*font-family:\s*ui-sans-serif,\s*system-ui,\s*sans-serif[^}]*font-size:\s*14px/);
  assert.match(styles, /\.appointmentTable td > strong\s*\{[^}]*font-size:\s*14px/);
  assert.match(styles, /\.appointmentSummary\s*\{[^}]*width:\s*100%[^}]*grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)[^}]*margin:\s*0 0 16px/);
  assert.match(source, /<col className="appointmentTimeColumn" \/><col className="appointmentPatientColumn" \/><col className="appointmentReasonColumn" \/><col className="appointmentDoctorColumn"/);
  assert.match(styles, /\.appointmentTable\s*\{[^}]*table-layout:\s*fixed/);
  assert.match(styles, /\.appointmentTimeColumn\s*\{\s*width:\s*9\.5%/);
  assert.match(styles, /\.appointmentPatientColumn\s*\{\s*width:\s*19%/);
  assert.match(styles, /\.appointmentReasonColumn, \.appointmentDoctorColumn\s*\{\s*width:\s*20%/);
  assert.match(styles, /\.appointmentTable td\[data-label="Time"\]\s*\{\s*white-space:\s*nowrap/);
});

test('appointment business routes use the Dental OS client and have no direct transport or patient lookup', async () => {
  const source = `${await readText('src/main.tsx')}\n${await readText('src/appointments.ts')}`;

  assert.match(source, /new ClinicClient\(window\.dentalApp/);
  assert.match(source, /client\.read\('\/v1\/clinic\/staff-references'\)/);
  assert.match(source, /client\.command\('POST', '\/v1\/appointments'/);
  assert.match(source, /client\.command\('PATCH'/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|axios\s*\(|navigator\.sendBeacon/);
  assert.doesNotMatch(source, /\/v1\/patients(?:\/|['"?])/);
  assert.doesNotMatch(source, /\bpatientId\b|localStorage|sessionStorage|indexedDB|document\.cookie|access_token|refresh_token|password|clientSecret/i);
});

test('app metadata declares the Appointments module and preserves the existing app artwork', async () => {
  const metadata = JSON.parse(await readText('app.json'));
  const artwork = await read(metadata.icon);
  const original = await read('../../../src/assets/dock/appointments.png');

  assert.equal(metadata.appId, 'company.dental.appointments.m17');
  assert.equal(metadata.title, 'Appointments');
  assert.equal(metadata.icon, 'assets/appointments.png');
  assert.deepEqual(metadata.anyCapabilities, ['appointments.access']);
  assert.deepEqual(metadata.modules, [{ id: 'appointments', label: 'Appointments', tab: 'appointments', capability: 'appointments.access' }]);
  assert.equal(artwork.readUInt32BE(16), 512);
  assert.equal(artwork.readUInt32BE(20), 512);
  assert.ok(original.readUInt32BE(16) > 512 && original.readUInt32BE(20) > 512);
  assert.ok(original.length > artwork.length);
});

test('package build emits the app bundle, metadata, and existing artwork', async () => {
  const builder = await readText('../../../tools/app-packages/build-appointments-m17.mjs');

  assert.match(builder, /root: app/);
  assert.match(builder, /outDir: 'dist'/);
  assert.match(builder, /path\.join\(app, 'assets'\)/);
  assert.match(builder, /path\.join\(app, 'app\.json'\)/);
});
