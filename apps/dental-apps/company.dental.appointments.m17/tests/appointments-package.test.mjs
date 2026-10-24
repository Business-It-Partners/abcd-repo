import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relativePath => fs.readFile(path.join(root, relativePath));
const readText = async relativePath => (await read(relativePath)).toString('utf8');

test('package identity is the 1.0.4 M17 Appointments update with the platform SDK grant', async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('app.manifest.json'));

  assert.equal(packageJson.name, 'company.dental.appointments.m17');
  assert.equal(packageJson.version, '1.0.5');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.publisher, 'company');
  assert.equal(manifest.version, packageJson.version);
  assert.equal(manifest.entry, 'index.html');
  assert.equal(manifest.sdkMajor, 1);
  assert.equal(manifest.apiMajor, 1);
  assert.deepEqual(manifest.capabilities, ['clinic.app.appointments', 'clinic.api.request', 'session.context']);
  assert.deepEqual(Object.keys(manifest).sort(), ['apiMajor', 'appId', 'capabilities', 'entry', 'publisher', 'sdkMajor', 'version']);
});

test('appointments table hides the Doctor column while keeping doctor selection and details', async () => {
  const source = await readText('src/main.tsx');
  const table = source.slice(source.indexOf('<table className="appointmentTable"'), source.indexOf('</table>'));

  assert.ok(table.length > 0);
  assert.doesNotMatch(table, /data-label="Doctor"|>Doctor</);
  assert.match(source, /className="appointmentDoctorFilter"/);
  assert.match(source, /<label className="appointmentField"><span>Doctor<\/span>/);
  assert.match(source, /<dt>Status<\/dt><dd>\{statusLabels\[appointment\.status\]\}<\/dd><dt>Reason<\/dt><dd>\{appointment\.reason\}<\/dd><dt>Doctor<\/dt>/);
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
