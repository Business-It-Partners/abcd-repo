import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = relative => fs.readFileSync(path.join(app, relative), 'utf8');

test('M17 Work Entry has its current release identity and only its approved host capabilities', () => {
  const manifest = JSON.parse(read('app.manifest.json'));
  const metadata = JSON.parse(read('app.json'));
  assert.equal(manifest.appId, 'company.dental.work-entry.m17');
  assert.equal(manifest.version, '1.0.3');
  assert.deepEqual(manifest.capabilities, ['clinic.app.work-entry', 'clinic.api.request', 'session.context']);
  assert.equal(metadata.appId, manifest.appId);
  assert.equal(metadata.modules[0].id, 'work-entry');
  assert.deepEqual(metadata.anyCapabilities, ['work_entry.access']);
});

test('Work Entry business adapters use the host SDK and preserve the atomic commit route', () => {
  const source = [
    'src/main.tsx',
    'src/sdk/client.ts',
    'src/sdk/commands.ts',
    'src/features/work-entry/api.ts',
    'src/features/work-entry/WorkEntryWorkspace.tsx',
  ].map(read).join('\n');
  assert.match(source, /ClinicClient/);
  assert.match(source, /\/v1\/work-entry\/commit/);
  assert.match(source, /entry\.commandId/);
  assert.match(source, /The original save is unresolved/);
  assert.doesNotMatch(source, /getIdToken|clinicAuth|firebaseAuth|fetch\s*\(/i);
});

test('radiograph UI makes the current host media limitation explicit', () => {
  const source = read('src/features/patients/media/RadiographUploader.tsx');
  assert.match(source, /Radiograph upload and withdrawal are not enabled/);
  assert.doesNotMatch(source, /type="file"|\.upload\(/i);
});

test('source import record pins the production SaaS revision and records adaptations', () => {
  const pin = JSON.parse(read('SOURCE_IMPORT.json'));
  assert.equal(pin.revision, 'f44d3e30ca6f79cba61e32601c53d58826500201');
  assert.equal(pin.branch, 'production');
  assert.equal(pin.appId, 'company.dental.work-entry.m17');
  assert.ok(pin.imports.length >= 50);
  assert.ok(pin.contractReferences.some(reference => reference.source.endsWith('workEntry.routes.ts')));
  assert.ok(pin.imports.every(item => /^[a-f0-9]{64}$/.test(item.sourceSha256)));
});
