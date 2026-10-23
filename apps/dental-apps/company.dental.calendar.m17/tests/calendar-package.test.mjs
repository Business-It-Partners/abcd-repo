import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');
const read = relative => fs.readFile(path.join(root, relative));
const readText = async relative => (await read(relative)).toString('utf8');

test('Calendar gets a unique first-release identity and only its existing app capability', async () => {
  const packageJson = JSON.parse(await readText('package.json'));
  const manifest = JSON.parse(await readText('app.manifest.json'));
  const metadata = JSON.parse(await readText('app.json'));
  assert.equal(packageJson.name, 'company.dental.calendar.m17');
  assert.equal(packageJson.version, '1.0.0');
  assert.equal(manifest.appId, packageJson.name);
  assert.equal(manifest.version, packageJson.version);
  assert.deepEqual(manifest.capabilities, ['clinic.app.calendar', 'clinic.api.request', 'session.context']);
  assert.deepEqual(metadata.anyCapabilities, ['calendar.access']);
  assert.deepEqual(metadata.modules, [{ id: 'calendar', label: 'Calendar', tab: 'calendar', capability: 'calendar.access' }]);
});

test('Calendar uses brokered SaaS routes and preserves versioned/idempotent command safeguards', async () => {
  const source = `${await readText('src/main.tsx')}\n${await readText('src/calendarTasks.ts')}`;
  assert.match(source, /new ClinicClient\(window\.dentalApp/);
  assert.match(source, /\/v1\/calendar-tasks/);
  assert.match(source, /expectedRowVersion/);
  assert.match(source, /outcome === 'unknown'/);
  assert.match(source, /.command\('POST'/);
  assert.match(source, /\.command\('PATCH'/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|axios\s*\(|navigator\.sendBeacon/);
  assert.doesNotMatch(source, /localStorage|sessionStorage|indexedDB|document\.cookie|access_token|refresh_token|password|clientSecret/i);
  assert.doesNotMatch(source, /calendar-task.*edit|\/v1\/calendar-tasks\/[^'"`]*PUT/i);
});

test('Calendar build reuses the Dental OS date helpers and emits app metadata with its artwork', async () => {
  const builder = await readText('../../../tools/app-packages/build-calendar-m17.mjs');
  const metadata = JSON.parse(await readText('app.json'));
  const artwork = await read(metadata.icon);
  assert.match(builder, /packages\/dental-ui\/src\/shared/);
  assert.match(builder, /outDir: 'dist'/);
  assert.match(builder, /path\.join\(app, 'app\.json'\)/);
  assert.equal(artwork.readUInt32BE(16), 512);
  assert.equal(artwork.readUInt32BE(20), 512);
});
